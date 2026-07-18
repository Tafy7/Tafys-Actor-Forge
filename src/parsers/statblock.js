// ============================================================
// Parser di statblock 5e — Fase 4 (v0.7: bilingue EN/IT, formato 2014).
//
// Filosofia: è un ACCELERATORE, non un sostituto della revisione.
// L'output non diventa mai JSON direttamente: è lo stato del form
// (stesso formato di readForm/restoreForm), così ogni errore del
// parser lo correggi a occhio prima dell'export.
//
// Novità v0.7: le etichette e i pattern esistono in doppia versione
// inglese/italiana, e le distanze in METRI vengono convertite in piedi
// con la scala ufficiale italiana (1,5 m = 5 ft → ft = m × 10/3).
//
// parseStatblock(raw) → { state, report }
//   state  = campi del form riconosciuti (parziale)
//   report = { ok: [...], warn: [...], skipped: [...] } per l'utente
// ============================================================
import {
  CREATURE_TYPE_LABELS, CONDITION_LABELS, DAMAGE_TYPE_LABELS, LANGUAGE_LABELS,
} from '../data/constants.js';

// ---------- Mappe di traduzione ----------

// Le mappe id→etichetta di constants.js, INVERTITE (etichetta → id):
// stessa fonte di verità della UI, niente doppioni da tenere allineati.
function invert(labels) {
  const map = {};
  for (const [id, label] of Object.entries(labels)) map[label.toLowerCase()] = id;
  return map;
}
const TYPE_IT = invert(CREATURE_TYPE_LABELS);       // 'mostruosità' → 'monstrosity'
const CONDITION_IT = invert(CONDITION_LABELS);      // 'avvelenato' → 'poisoned'
const DAMAGE_IT = invert(DAMAGE_TYPE_LABELS);       // 'acido' → 'acid'
const LANGUAGE_IT = invert(LANGUAGE_LABELS);        // 'infernale' → 'infernal'

// Sinonimi e varianti ortografiche non presenti nelle etichette ufficiali
// della UI, ma diffusi nei bestiari homebrew italiani. Li aggiungiamo alle
// mappe invertite così sia il parser sia i chip li riconoscono.
//  - "Non-morto"/"Nonmorto" (col trattino) invece di "Non Morto" → undead.
//  - "Indebolimento"/"Stremo" al posto di "Sfinimento" (traduzione ufficiale
//    di exhaustion): era il caso dell'Ao Andon, finiva nelle immunità custom.
Object.assign(TYPE_IT, { 'non-morto': 'undead', 'nonmorto': 'undead' });
Object.assign(CONDITION_IT, { 'indebolimento': 'exhaustion', 'stremo': 'exhaustion' });

// Le taglie italiane concordano in genere col tipo: "Folletto Medio"
// (maschile) ma "Mostruosità Media" (femminile). Accettiamo entrambe le
// forme — è un insieme CHIUSO (6 taglie), non "un termine homebrew a caso".
const SIZE_MAP = {
  tiny: 'tiny', small: 'sm', medium: 'med', large: 'lg', huge: 'huge', gargantuan: 'grg',
  minuscola: 'tiny', minuscolo: 'tiny', piccola: 'sm', piccolo: 'sm',
  media: 'med', medio: 'med', grande: 'lg', enorme: 'huge',
  mastodontica: 'grg', mastodontico: 'grg',
};

// Sottotipi standard tradotti (finiti, non homebrew): il resto resta
// testo libero capitalizzato. "mutaforma" è il caso del Gumiho.
const SUBTYPE_IT = { 'mutaforma': 'Shapechanger' };

const ABILITY_MAP = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha',
  forza: 'str', destrezza: 'dex', costituzione: 'con',
  intelligenza: 'int', saggezza: 'wis', carisma: 'cha',
  str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha',
  for: 'str', des: 'dex', cos: 'con', sag: 'wis', car: 'cha',
};
const ABILITY_WORDS = 'Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Forza|Destrezza|Costituzione|Intelligenza|Saggezza|Carisma';

const SKILL_MAP = {
  // inglese
  'acrobatics': 'acr', 'animal handling': 'ani', 'arcana': 'arc', 'athletics': 'ath',
  'deception': 'dec', 'history': 'his', 'insight': 'ins', 'intimidation': 'itm',
  'investigation': 'inv', 'medicine': 'med', 'nature': 'nat', 'perception': 'prc',
  'performance': 'prf', 'persuasion': 'per', 'religion': 'rel',
  'sleight of hand': 'slt', 'stealth': 'ste', 'survival': 'sur',
  // italiano (stesse etichette della UI)
  'acrobazia': 'acr', 'addestrare animali': 'ani', 'arcano': 'arc', 'atletica': 'ath',
  'inganno': 'dec', 'storia': 'his', 'intuizione': 'ins', 'intimidire': 'itm',
  'indagare': 'inv', 'medicina': 'med', 'natura': 'nat', 'percezione': 'prc',
  'intrattenere': 'prf', 'persuasione': 'per', 'religione': 'rel',
  'rapidità di mano': 'slt', 'furtività': 'ste', 'sopravvivenza': 'sur',
};

// Aggettivi italiani dei danni nelle azioni ("danni taglienti", "danni acidi"):
// le forme flesse non stanno nelle etichette dei chip, quindi mappa dedicata.
const DAMAGE_ADJ_IT = {
  'acido': 'acid', 'acidi': 'acid', 'contundente': 'bludgeoning', 'contundenti': 'bludgeoning',
  'freddo': 'cold', 'fuoco': 'fire', 'forza': 'force', 'fulmine': 'lightning',
  'necrotico': 'necrotic', 'necrotici': 'necrotic', 'perforante': 'piercing', 'perforanti': 'piercing',
  'veleno': 'poison', 'psichico': 'psychic', 'psichici': 'psychic',
  'radioso': 'radiant', 'radiosi': 'radiant', 'tagliente': 'slashing', 'taglienti': 'slashing',
  'tuono': 'thunder',
  // Traduzioni alternative diffuse ai tavoli italiani: "radiant" viene
  // reso spesso "radiante" invece del "radioso" ufficiale.
  'radiante': 'radiant', 'radianti': 'radiant',
  'elettrico': 'lightning', 'elettrici': 'lightning',
};

// Nelle LISTE di tratti (Resistenze/Immunità/Vulnerabilità) i termini
// possono arrivare sia come etichette ufficiali sia come aggettivi
// flessi o sinonimi: uniamo le due mappe.
const DAMAGE_LIST_IT = { ...DAMAGE_IT, ...DAMAGE_ADJ_IT };

// Condizioni nelle clausole "…saving throw or be X" / "…tiro salvezza o è X".
const CONDITION_PATTERNS = [
  [/knocked prone|cade a terra|a terra prono/i, 'prone'], [/\bprono\b/i, 'prone'],
  [/\bblinded\b|\baccecat[oa]\b/i, 'blinded'], [/\bcharmed\b|\baffascinat[oa]\b/i, 'charmed'],
  [/\bdeafened\b|\bassordat[oa]\b/i, 'deafened'], [/\bfrightened\b|\bspaventat[oa]\b/i, 'frightened'],
  [/\bgrappled\b|\bafferrat[oa]\b/i, 'grappled'], [/\bincapacitated\b|\bincapacitat[oa]\b/i, 'incapacitated'],
  [/\bparalyzed\b|\bparalizzat[oa]\b/i, 'paralyzed'], [/\bpetrified\b|\bpietrificat[oa]\b/i, 'petrified'],
  [/\bpoisoned\b|\bavvelenat[oa]\b/i, 'poisoned'], [/\brestrained\b|\btrattenut[oa]\b/i, 'restrained'],
  [/\bstunned\b|\bstordit[oa]\b/i, 'stunned'], [/\bunconscious\b|privo di sensi|\bincosciente\b/i, 'unconscious'],
];

const ALIGN_IT = {
  'legale': 'Lawful', 'caotico': 'Chaotic', 'caotica': 'Chaotic', 'neutrale': 'Neutral',
  'buono': 'Good', 'buona': 'Good', 'malvagio': 'Evil', 'malvagia': 'Evil',
};

/** Bonus di competenza dal CR (tabella standard 5e). */
export function profFromCR(cr) {
  return Math.max(2, 2 + Math.floor((Math.max(cr, 1) - 1) / 4));
}

/** "1,5 m" → 5 ft; "30 ft" → 30. Scala italiana ufficiale: ft = m × 10/3. */
function toFeet(numStr, unit) {
  const n = Number(String(numStr).replace(',', '.'));
  return String(Math.round(/^m/i.test(unit) ? n * 10 / 3 : n));
}
const DIST = "(\\d+(?:[.,]\\d+)?)\\s*(ft|m)\\b";

// ---------- Pulizia del testo incollato dai PDF ----------

function normalizeText(raw) {
  return String(raw || '')
    .replace(/\r/g, '')
    .replace(/[–—]/g, '-')      // en/em dash → trattino
    .replace(/[‘’]/g, "'")      // apostrofi curvi
    .replace(/[“”]/g, '"')
    .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl') // legature ﬁ ﬂ
    .replace(/ /g, ' ')              // spazi non separabili
    .replace(/(ft|m)\s*\.\s*,/gi, '$1.,')  // "m . ," → "m.,"
    .replace(/[ \t]+/g, ' ');
}

// Etichette delle righe statistiche (EN | IT).
// ATTENZIONE: niente \b dopo le parole accentate! Il \b di JavaScript è
// ASCII-only: dopo la "à" di "Velocità" non c'è boundary e il match
// fallirebbe in silenzio. Usiamo un lookahead su spazio/fine riga.
const LABEL_RE = /^(Armor Class|Hit Points|Speed|Saving Throws|Skills|Damage Resistances|Damage Immunities|Damage Vulnerabilities|Condition Immunities|Senses|Languages|Challenge|Proficiency Bonus|Classe Armatura|Punti Ferita|Velocità|Tiri Salvezza|Competenze|Abilità|Resistenze ai Danni|Immunità ai Danni|Vulnerabilità ai Danni|Immunità alle Condizioni|Sensi|Lingue|Linguaggi|Sfida|Bonus di Competenza)(?=\s|$)/i;

/**
 * Una riga è un'etichetta solo se INIZIA con la maiuscola: le righe
 * spezzate dal PDF che iniziano con "velocità..." (minuscola, in mezzo
 * a una frase) NON devono essere scambiate per la riga "Velocità" —
 * è successo davvero col Bai Ze, che si è visto spezzare Carica Divina.
 */
function isLabelLine(line) {
  return LABEL_RE.test(line) && /^[A-ZÀ-ÖØ-Þ]/.test(line);
}
const SECTION_RE = /^(Actions|Legendary Actions|Reactions|Bonus Actions|Lair Actions|Azioni|Azioni Leggendarie|Reazioni|Azioni Bonus|Azioni di Tana)\.?$/i;

// Inizio di un tratto/azione: nome in Title Case (accenti inclusi, max 8
// parole con particelle minuscole ammesse), usi tra parentesi, poi punto.
// "Attacco con arma da mischia: ..." NON matcha ("arma" non è né maiuscola
// né particella; e i due punti non possono stare nel nome).
const UP = "[A-ZÀ-ÖØ-Þ]";
const WCH = "[\\wÀ-ÖØ-öø-ÿ'-]";
const STOP = "(?:of|the|and|or|with|in|to|a|an|its|di|da|del|della|dello|dei|delle|degli|con|la|le|lo|il|gli|i|e|o|per|su|un|una|uno|al|alla|allo|ai|agli|alle)";
const WORD = `(?:${UP}${WCH}*|${STOP})`;
const ENTRY_RE = new RegExp(`^(${UP}${WCH}*(?: ${WORD}){0,7})(\\s*\\([^)]{1,40}\\))?\\.\\s+\\S`);

/**
 * Ricompone il testo in "entry" logiche: le righe spezzate dal PDF
 * vengono riattaccate alla entry precedente, i trattini di sillabazione
 * a fine riga vengono fusi ("long-\nsword" → "longsword").
 */
function toEntries(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  const push = () => { if (current) entries.push(current); current = null; };

  for (const line of lines) {
    const isNew = isLabelLine(line) || SECTION_RE.test(line) || ENTRY_RE.test(line)
      || entries.length < 2; // le prime due righe (nome + tipo/taglia) sono sempre entry

    if (isNew || !current) {
      push();
      current = line;
    } else if (SECTION_RE.test(current)) {
      // Un titolo di sezione ("Actions", "Azioni"...) non assorbe mai la
      // riga successiva: quella è sempre una nuova entry.
      push();
      current = line;
    } else if (current.endsWith('-') && /^[a-zà-ÿ]/.test(line)) {
      current = current.slice(0, -1) + line; // sillabazione: fondi senza spazio
    } else {
      current += ' ' + line;
    }
  }
  push();
  return entries;
}

// ---------- Parser dei singoli pezzi ----------

/**
 * Riga taglia/tipo. Inglese: "Medium fiend (devil), lawful evil"
 * (taglia→tipo). Italiano: "Mostruosità Media, neutrale malvagio"
 * (tipo→taglia, allineamento da tradurre).
 */
function parseTypeLine(line, state, report) {
  let m = line.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([a-z]+)(?:\s*\(([^)]+)\))?\s*,\s*(.+)$/i);
  if (m) {
    state.size = SIZE_MAP[m[1].toLowerCase()] || 'med';
    state.creatureType = m[2].toLowerCase();
    if (m[3]) state.subtype = m[3][0].toUpperCase() + m[3].slice(1);
    state.alignment = m[4].trim().replace(/\b\w/g, c => c.toUpperCase());
    report.ok.push('Identità (taglia, tipo, allineamento)');
    return;
  }
  const TYPES_IT = Object.keys(TYPE_IT).join('|'); // aberrazione|…|non morto
  // Taglia in entrambi i generi: Minuscol[ao], Piccol[ao], Medi[ao], Mastodontic[ao].
  m = line.match(new RegExp(`^(${TYPES_IT})\\s+(Minuscol[ao]|Piccol[ao]|Medi[ao]|Grande|Enorme|Mastodontic[ao])(?:\\s*\\(([^)]+)\\))?\\s*,\\s*(.+)$`, 'i'));
  if (m) {
    state.creatureType = TYPE_IT[m[1].toLowerCase()];
    state.size = SIZE_MAP[m[2].toLowerCase()];
    if (m[3]) {
      const sub = m[3].trim();
      state.subtype = SUBTYPE_IT[sub.toLowerCase()] || (sub[0].toUpperCase() + sub.slice(1));
    }
    // "neutrale malvagio" → "Neutral Evil" (il JSON resta in inglese).
    const words = m[4].trim().toLowerCase();
    if (/senza allineamento|non allineato/.test(words)) state.alignment = 'Unaligned';
    else {
      const parts = words.split(/\s+/).map(w => ALIGN_IT[w]).filter(Boolean);
      state.alignment = parts.length === 1 && parts[0] === 'Neutral' ? 'True Neutral'
        : parts.length ? parts.join(' ') : m[4].trim();
    }
    report.ok.push('Identità (taglia, tipo, allineamento — tradotti)');
    return;
  }
  report.skipped.push(`Riga taglia/tipo non riconosciuta: "${line}"`);
}

/** Estrae le 6 caratteristiche (STR…CHA oppure FOR…CAR, inline o a colonne). */
function parseAbilities(text, state, report) {
  // Tentativo 1: "STR 16 (+3) …" / "FOR 14 (+2) …" (valore accanto alla sigla)
  const found = {};
  for (const m of text.matchAll(/\b(STR|DEX|CON|INT|WIS|CHA|FOR|DES|COS|SAG|CAR)\.?\s+(\d+)\s*\(/g)) {
    found[ABILITY_MAP[m[1].toLowerCase()]] = m[2];
  }
  if (Object.keys(found).length === 6) {
    Object.assign(state, found);
    report.ok.push('Caratteristiche (formato inline)');
    return;
  }
  // Tentativo 2 (colonne PDF): dopo l'header STR…CHA / FOR…CAR arrivano
  // sei "N (±M)" in fila, nell'ordine canonico for/des/cos/int/sag/car.
  const zone = text.match(/\b(?:STR|FOR)\b[\s\S]*?\b(?:CHA|CAR)\b([\s\S]*?)(?=Saving Throws|Skills|Damage |Condition |Senses|Languages|Challenge|Tiri Salvezza|Competenze|Resistenze|Immunità|Sensi|Lingue|Sfida)/);
  if (zone) {
    const scores = [...zone[1].matchAll(/(\d+)\s*\([+-]\d+\)/g)].map(m => m[1]);
    if (scores.length >= 6) {
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((ab, i) => { state[ab] = scores[i]; });
      report.ok.push('Caratteristiche (formato a colonne)');
      return;
    }
  }
  report.warn.push('Caratteristiche non trovate: compilale a mano.');
}

/**
 * Liste di DANNI (dr/di/dv) con gestione dei bypass: un segmento (i
 * segmenti sono separati da ";") che contiene "from nonmagical attacks"
 * / "da attacchi non magici" è un GRUPPO condizionato — i tipi fisici
 * al suo interno diventano id normali e la condizione diventa i token
 * "nonmagical"/"silvered"/"adamantine", che il builder traduce nel
 * campo `bypasses` di dnd5e (pattern golden Zariel).
 */
function parseDamageList(value) {
  const out = [];
  const allWords = { ...DAMAGE_LIST_IT };
  for (const id of Object.keys(DAMAGE_TYPE_LABELS)) allWords[id] = id; // anche gli id inglesi
  for (const segment of String(value || '').split(';')) {
    const seg = segment.trim();
    if (!seg) continue;
    const bypass = [];
    if (/from nonmagical|nonmagical attacks|da attacchi non magici|da armi non magiche/i.test(seg)) bypass.push('nonmagical');
    if (/silvered|argentat/i.test(seg)) bypass.push('silvered');
    if (/adamantine|adamantio/i.test(seg)) bypass.push('adamantine');
    if (bypass.length) {
      // Gruppo condizionato: peschiamo i tipi di danno citati nel segmento.
      const found = new Set();
      for (const [word, id] of Object.entries(allWords)) {
        if (new RegExp(`(^|[^\\wÀ-ÿ])${word}([^\\wÀ-ÿ]|$)`, 'i').test(seg)) found.add(id);
      }
      out.push(...found, ...bypass);
    } else {
      out.push(...cleanTraitList(seg, DAMAGE_LIST_IT).split(', ').filter(Boolean));
    }
  }
  return [...new Set(out)].join(', ');
}

/**
 * Liste di tratti generiche (condizioni, lingue): pulisce le
 * congiunzioni e traduce i termini italiani noti nell'id inglese; il
 * resto resta testo custom (comparirà comunque sulla scheda).
 */
function cleanTraitList(value, itMap) {
  return value
    .replace(/\b(and|e)\b/gi, ' ')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(tok => itMap?.[tok.toLowerCase()] || tok)
    .join(', ');
}

/** Righe statistiche etichettate: ognuna riempie i campi del form. */
function parseLabelLine(line, state, report) {
  let m;

  if ((m = line.match(/^(?:Armor Class|Classe Armatura)\s+(\d+)\s*(?:\(([^)]+)\))?/i))) {
    // "natural armor"/"armatura naturale" → CA naturale; il resto → fissa.
    state.acFlat = m[1];
    state.acCalc = m[2] && /natural/i.test(m[2]) ? 'natural' : 'flat';
    report.ok.push(`CA ${m[1]}${m[2] ? ` (${m[2]})` : ''}`);
    return true;
  }
  if ((m = line.match(/^(?:Hit Points|Punti Ferita)\s+(\d+)\s*(?:\(([^)]+)\))?/i))) {
    state.hpMax = m[1];
    if (m[2]) state.hpFormula = m[2].trim();
    report.ok.push(`HP ${m[1]}`);
    return true;
  }
  if ((m = line.match(/^(?:Speed|Velocità)\s+(.+)$/i))) {
    const speeds = m[1];
    const walk = speeds.match(new RegExp(`^${DIST}`));
    if (walk) state.walk = toFeet(walk[1], walk[2]);
    for (const [key, words] of [
      ['fly', 'fly|volare'], ['swim', 'swim|nuotare'],
      ['climb', 'climb|scalare'], ['burrow', 'burrow|scavare'],
    ]) {
      const sm = speeds.match(new RegExp(`(?:${words})\\s+${DIST}`, 'i'));
      if (sm) state[key] = toFeet(sm[1], sm[2]);
    }
    state.hover = /hover|fluttuare/i.test(speeds);
    report.ok.push('Velocità' + (/\d\s*m\b/.test(speeds) ? ' (metri → piedi)' : ''));
    return true;
  }
  if ((m = line.match(/^(?:Saving Throws|Tiri Salvezza)\s+(.+)$/i))) {
    state.saves = [];
    for (const sm of m[1].matchAll(/(Str|Dex|Con|Int|Wis|Cha|For|Des|Cos|Sag|Car)\w*\s*[+-]\d+/gi)) {
      const id = ABILITY_MAP[sm[1].toLowerCase()];
      if (id && !state.saves.includes(id)) state.saves.push(id);
    }
    report.ok.push(`Tiri salvezza: ${state.saves.join(', ')}`);
    return true;
  }
  if ((m = line.match(/^(?:Skills|Competenze|Abilità)\s+(.+)$/i))) {
    state._rawSkills = m[1]; // risolte dopo, quando conosciamo CR e caratteristiche
    return true;
  }
  if ((m = line.match(/^(?:Damage Resistances|Resistenze ai Danni)\s+(.+)$/i))) { state.dr = parseDamageList(m[1]); report.ok.push('Resistenze ai danni'); return true; }
  if ((m = line.match(/^(?:Damage Immunities|Immunità ai Danni)\s+(.+)$/i))) { state.di = parseDamageList(m[1]); report.ok.push('Immunità ai danni'); return true; }
  if ((m = line.match(/^(?:Damage Vulnerabilities|Vulnerabilità ai Danni)\s+(.+)$/i))) { state.dv = parseDamageList(m[1]); report.ok.push('Vulnerabilità ai danni'); return true; }
  if ((m = line.match(/^(?:Condition Immunities|Immunità alle Condizioni)\s+(.+)$/i))) { state.ci = cleanTraitList(m[1], CONDITION_IT); report.ok.push('Immunità alle condizioni'); return true; }
  if ((m = line.match(/^(?:Senses|Sensi)\s+(.+)$/i))) {
    for (const [key, words] of [
      ['darkvision', 'darkvision|scurovisione'], ['blindsight', 'blindsight|vista cieca'],
      ['tremorsense', 'tremorsense|percezione del tremore|tremorsenso'], ['truesight', 'truesight|vista pura'],
    ]) {
      const sm = m[1].match(new RegExp(`(?:${words})\\s+${DIST}`, 'i'));
      if (sm) state[key] = toFeet(sm[1], sm[2]);
    }
    report.ok.push('Sensi (la Percezione passiva la calcola Foundry)');
    return true;
  }
  if ((m = line.match(/^(?:Languages|Lingue|Linguaggi)\s+(.+)$/i))) {
    const tel = m[1].match(new RegExp(`(?:telepathy|telepatia)\\s+${DIST}`, 'i'));
    if (tel) state.telepathy = toFeet(tel[1], tel[2]);
    const langs = m[1].replace(new RegExp(`(?:telepathy|telepatia)\\s+${DIST}\\.?`, 'i'), '');
    state.languages = cleanTraitList(langs, LANGUAGE_IT).replace(/^, |, $/g, '').replace(/^[-—]$/, '');
    report.ok.push('Lingue');
    return true;
  }
  if ((m = line.match(/^(?:Challenge|Sfida)\s+([\d/]+)/i))) {
    state.cr = m[1];
    report.ok.push(`CR ${m[1]}`);
    return true;
  }
  if (/^(?:Proficiency Bonus|Bonus di Competenza)/i.test(line)) return true; // lo calcola Foundry dal CR
  return false;
}

/** Skills: distingue competenza da expertise confrontando il bonus dichiarato. */
function resolveSkills(state, report) {
  if (!state._rawSkills) return;
  state.skills = {};
  const prof = profFromCR(crToNumber(state.cr));
  const abilityBySkill = {
    acr: 'dex', ani: 'wis', arc: 'int', ath: 'str', dec: 'cha', his: 'int',
    ins: 'wis', itm: 'cha', inv: 'int', med: 'wis', nat: 'int', prc: 'wis',
    prf: 'cha', per: 'cha', rel: 'int', slt: 'dex', ste: 'dex', sur: 'wis',
  };
  for (const m of state._rawSkills.matchAll(/([A-Za-zÀ-ÖØ-öø-ÿ ]+?)\s*([+-]\d+)/g)) {
    const id = SKILL_MAP[m[1].trim().toLowerCase()];
    if (!id) { report.warn.push(`Skill non riconosciuta: "${m[1].trim()}"`); continue; }
    const bonus = Number(m[2]);
    const mod = Math.floor((Number(state[abilityBySkill[id]] || 10) - 10) / 2);
    // competenza = mod + prof; expertise = mod + 2×prof. Se non torna
    // nessuno dei due, segniamo competenza e avvisiamo (spesso è il
    // segnale che la matematica dell'homebrew è sballata).
    if (bonus === mod + 2 * prof) state.skills[id] = '2';
    else if (bonus === mod + prof) state.skills[id] = '1';
    else { state.skills[id] = '1'; report.warn.push(`${m[1].trim()} ${m[2]}: bonus anomalo (né competenza né expertise coi valori letti), segnata competenza.`); }
  }
  delete state._rawSkills;
  report.ok.push(`Skill: ${Object.keys(state.skills).length}`);
}

function crToNumber(cr) {
  const s = String(cr || '0');
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : 0; }
  return Number(s) || 0;
}

// ---------- Tratti e azioni → descrittori item ----------

/** Estrae nome + usi dal titolo ("Sputo Bile (Ricarica 5-6). ..."). */
function splitEntry(entry) {
  const m = entry.match(ENTRY_RE);
  if (!m) return null;
  const name = m[1].trim();
  const parens = (m[2] || '').replace(/[()]/g, '').trim();
  const body = entry.slice(m[0].length - 1).trim();
  let usesMode = 'none', usesValue = '';
  let rm;
  if ((rm = parens.match(/(?:Recharge|Ricarica)\s+(\d)(?:-6)?/i))) { usesMode = 'recharge'; usesValue = rm[1]; }
  else if ((rm = parens.match(/(\d+)\/(?:Day|Giorno)/i))) { usesMode = 'day'; usesValue = rm[1]; }
  return { name, parens, body, usesMode, usesValue };
}

/**
 * Tutte le parti di danno: "(2d8 + 7) piercing damage" e
 * "(2d6 + 3) danni da veleno" / "danni taglienti".
 */
function extractDamage(body, report, label) {
  const parts = [];
  const add = (dice, sign, bonus, type) => {
    if (sign === '-') {
      report.warn.push(`${label}: bonus di danno negativo (${dice} - ${bonus}), non supportato: messo senza bonus, correggi a mano.`);
      parts.push(`${dice} ${type}`);
    } else {
      parts.push(bonus ? `${dice} + ${bonus} ${type}` : `${dice} ${type}`);
    }
  };
  // Inglese: "(2d8 + 7) piercing damage"
  for (const m of body.matchAll(/\((\d+d\d+)(?:\s*([+-])\s*(\d+))?\)\s+([a-z]+)\s+damage/gi)) {
    add(m[1], m[2], m[3], m[4].toLowerCase());
  }
  // Italiano: "(2d6 + 3) danni da veleno", "(1d8 + 2) danni taglienti"
  for (const m of body.matchAll(/\((\d+d\d+)(?:\s*([+-])\s*(\d+))?\)\s+dann[oi]\s+(?:da\s+)?([a-zà-ÿ]+)/gi)) {
    const type = DAMAGE_ADJ_IT[m[4].toLowerCase()];
    if (!type) {
      report.warn.push(`${label}: tipo di danno "${m[4]}" non riconosciuto, lasciato com'è: correggilo nel form.`);
      add(m[1], m[2], m[3], m[4].toLowerCase());
    } else {
      add(m[1], m[2], m[3], type);
    }
  }
  return parts.join(', ');
}

/** Trova il TS: "DC 13 Dexterity saving throw" / "tiro salvezza su Costituzione DC 12". */
function findSave(body) {
  let m = body.match(new RegExp(`DC\\s+(\\d+)\\s+(${ABILITY_WORDS})\\s+saving throw`, 'i'));
  if (m) return { dc: m[1], ability: ABILITY_MAP[m[2].toLowerCase()] };
  m = body.match(new RegExp(`tiro salvezza (?:su|di)\\s+(${ABILITY_WORDS})\\s+(?:DC|CD)\\s*(\\d+)`, 'i'));
  if (m) return { dc: m[2], ability: ABILITY_MAP[m[1].toLowerCase()] };
  m = body.match(new RegExp(`(?:DC|CD)\\s*(\\d+)\\s+(?:su\\s+)?(${ABILITY_WORDS})`, 'i'));
  if (m) return { dc: m[1], ability: ABILITY_MAP[m[2].toLowerCase()] };
  return null;
}

/** Condizione nella clausola dopo "saving throw or…" / "tiro salvezza … o …". */
function extractCondition(text) {
  const clause = text.match(/(?:saving throw|tiro salvezza)(?:[^.]*?)\bor?\b([^.]+)/i);
  const zone = clause ? clause[1] : text;
  for (const [re, id] of CONDITION_PATTERNS) {
    if (re.test(zone)) return id;
  }
  return '';
}

/** Durata: "for 1 minute"/"per 1 minuto" → 10 round; "next turn"/"prossimo turno" → 1. */
function extractRounds(body) {
  if (/until the end of (its|the target's) next turn|fino alla fine del (?:suo )?(?:prossimo turno|turno successivo)/i.test(body)) return '1';
  const min = body.match(/(?:for|per)\s+(\d+)\s+minut/i);
  if (min) return String(Number(min[1]) * 10);
  return '';
}

/** Riga d'attacco: EN "Melee Weapon Attack: +6 to hit" / IT "Attacco con arma da mischia: +5 per colpire". */
function findAttack(body) {
  let m = body.match(/(Melee or Ranged|Melee|Ranged)\s+(Weapon|Spell)\s+Attack:\s*([+-]\d+)\s+to hit/i);
  if (m) {
    return {
      both: /^Melee or Ranged$/i.test(m[1]),
      isMelee: !/^Ranged$/i.test(m[1]),
      isSpell: /Spell/i.test(m[2]),
      toHit: Number(m[3]),
    };
  }
  // "per colpire" / "a colpire": entrambe le traduzioni circolano.
  m = body.match(/Attacco con (arma|incantesim[oi])(?:\s+(da mischia o a distanza|da mischia|a distanza))?:\s*([+-]\d+)\s+(?:per|a) colpire/i);
  if (m) {
    const kind = (m[2] || 'da mischia').toLowerCase();
    return {
      both: kind === 'da mischia o a distanza',
      isMelee: kind !== 'a distanza',
      isSpell: /incantesim/i.test(m[1]),
      toHit: Number(m[3]),
    };
  }
  return null;
}

/**
 * Deduce la caratteristica d'attacco dal bonus "to hit": il bonus è
 * mod + prof, quindi mod = toHit − prof; cerchiamo la caratteristica
 * col modificatore giusto tra le candidate per quel tipo di attacco.
 */
function inferAttackAbility(toHit, isMelee, isSpell, state, report, label) {
  const prof = profFromCR(crToNumber(state.cr));
  const want = toHit - prof;
  const mod = (ab) => Math.floor((Number(state[ab] || 10) - 10) / 2);
  const candidates = isSpell
    ? ['cha', 'int', 'wis']
    : (isMelee ? ['str', 'dex'] : ['dex', 'str']);
  for (const ab of candidates) {
    if (mod(ab) === want) return ab;
  }
  const fallback = candidates[0];
  report.warn.push(`${label}: nessuna caratteristica dà +${toHit} al tiro (mod atteso ${want >= 0 ? '+' : ''}${want}); usata ${fallback.toUpperCase()}, verifica (spesso è la matematica dell'homebrew a essere sballata).`);
  return fallback;
}

/** Converte una entry di azione/tratto in un descrittore item del form. */
function entryToItem(parsed, activation, state, report) {
  const { name, body, usesMode, usesValue } = parsed;
  // Un tratto (regione passiva) che contiene un attacco o un TS diventa
  // comunque un'azione utilizzabile: l'attivazione più sensata è 'action'.
  const realActivation = activation === 'passive-region' ? 'action' : activation;
  const base = {
    name, activation: realActivation, usesMode, usesValue,
    description: body, img: '',
    kind: 'passive', attackType: 'melee', ability: 'str',
    reach: '5', range: '30', longRange: '', damage: '', magical: false,
    saveAbility: 'con', dc: '', onSave: 'none',
    onHit: 'none', condition: '', condRounds: '',
    riderSaveAbility: 'con', riderDc: '', effects: [],
  };

  const atk = findAttack(body);
  const save = findSave(body);

  if (atk) {
    // --- Attacco ---
    if (atk.both) {
      report.warn.push(`${name}: attacco "mischia o distanza", importato come mischia — se serve crea la variante a distanza col pulsante duplica.`);
    }
    base.kind = 'attack';
    base.attackType = atk.isMelee ? 'melee' : 'ranged';
    base.ability = inferAttackAbility(atk.toHit, atk.isMelee, atk.isSpell, state, report, name);
    if (atk.isMelee) {
      // EN "reach 5 ft." / IT "gittata 1,5 m." (o "portata")
      const reach = body.match(new RegExp(`(?:reach|gittata|portata)\\s+${DIST}`, 'i'));
      if (reach) base.reach = toFeet(reach[1], reach[2]);
    } else {
      const range2 = body.match(new RegExp(`(?:range|gittata|portata)\\s+(\\d+(?:[.,]\\d+)?)/(\\d+(?:[.,]\\d+)?)\\s*(ft|m)\\b`, 'i'));
      const range1 = body.match(new RegExp(`(?:range|gittata|portata)\\s+${DIST}`, 'i'));
      if (range2) { base.range = toFeet(range2[1], range2[3]); base.longRange = toFeet(range2[2], range2[3]); }
      else if (range1) base.range = toFeet(range1[1], range1[2]);
    }
    base.damage = extractDamage(body, report, name);
    if (atk.isSpell) base.magical = true;
    // Rider: "…must succeed on a DC X … or …" / "…deve superare un tiro salvezza … o …"
    if (save) {
      const condition = extractCondition(body);
      if (condition) {
        base.onHit = 'save';
        base.riderDc = save.dc;
        base.riderSaveAbility = save.ability;
        base.condition = condition;
        base.condRounds = extractRounds(body);
      } else {
        report.warn.push(`${name}: c'è un TS nel testo ma non ho riconosciuto la condizione — aggiungila a mano.`);
      }
    } else {
      // Condizione automatica sul colpo: "the target is grappled" / "il bersaglio è afferrato"
      const auto = body.match(/(?:target is|bersaglio è)\s+(\S+)/i);
      const condition = auto ? (CONDITION_PATTERNS.find(([re]) => re.test(auto[1]))?.[1] || '') : '';
      if (condition) {
        base.onHit = 'condition';
        base.condition = condition;
        base.condRounds = extractRounds(body);
      }
    }
    report.ok.push(`Attacco: ${name}`);
    return base;
  }

  if (save) {
    // --- Azione con tiro salvezza ---
    base.kind = 'save';
    base.dc = save.dc;
    base.saveAbility = save.ability;
    base.damage = extractDamage(body, report, name);
    base.onSave = /half as much|la metà|metà danni/i.test(body) ? 'half' : 'none';
    const condition = extractCondition(body);
    if (condition) {
      base.condition = condition;
      base.condRounds = extractRounds(body);
    }
    report.ok.push(`Tiro salvezza: ${name}`);
    return base;
  }

  if (activation !== 'passive-region') {
    // Nelle sezioni Azioni/Leggendarie un'entry senza attacco né TS
    // (es. Multiattacco, Teleport) diventa una utility con descrizione.
    base.kind = 'utility';
    report.ok.push(`Utility: ${name} (solo descrizione, controlla se serve automazione)`);
    return base;
  }

  // --- Tratto passivo ---
  base.kind = 'passive';
  base.activation = 'action';
  report.ok.push(`Tratto: ${name}`);
  return base;
}

// ---------- Parser principale ----------

const REGION_BY_SECTION = {
  'actions': 'action', 'azioni': 'action',
  'legendary actions': 'legendary', 'azioni leggendarie': 'legendary',
  'reactions': 'reaction', 'reazioni': 'reaction',
  'bonus actions': 'bonus', 'azioni bonus': 'bonus',
  'lair actions': 'lair', 'azioni di tana': 'lair',
};

export function parseStatblock(raw) {
  const report = { ok: [], warn: [], skipped: [] };
  const state = {};
  const text = normalizeText(raw);
  if (!text.trim()) return { state, report };

  const entries = toEntries(text);
  parseAbilities(text, state, report);

  // regione: header → tratti (dopo Challenge/Sfida) → Azioni → Leggendarie...
  let region = 'header';
  let headerCount = 0;
  const items = [];

  for (const entry of entries) {
    // Cambio sezione?
    const section = entry.match(SECTION_RE);
    if (section) {
      region = REGION_BY_SECTION[section[1].toLowerCase().replace(/\.$/, '')] || region;
      if (region === 'lair') report.warn.push('Azioni di tana: fuori scope (vivono nella scena, non nell\'actor), aggiungile a mano.');
      continue;
    }

    // Righe statistiche etichettate.
    if (isLabelLine(entry)) {
      if (!parseLabelLine(entry, state, report)) report.skipped.push(entry);
      if (/^(?:Challenge|Sfida)/i.test(entry)) region = 'traits';
      continue;
    }

    // Header: nome e riga taglia/tipo.
    if (region === 'header') {
      headerCount += 1;
      if (headerCount === 1) { state.name = entry.trim(); report.ok.push(`Nome: ${state.name}`); continue; }
      if (/^(Tiny|Small|Medium|Large|Huge|Gargantuan)/i.test(entry)
        || new RegExp(`^(?:${Object.keys(TYPE_IT).join('|')})\\s`, 'i').test(entry)) {
        parseTypeLine(entry, state, report);
        continue;
      }
      // righe caratteristiche (già lette da parseAbilities) o rumore
      if (/\b(STR|DEX|CON|INT|WIS|CHA|FOR|DES|COS|SAG|CAR)\b/.test(entry) || /^\d+\s*\([+-]\d+\)/.test(entry)) continue;
      report.skipped.push(entry);
      continue;
    }

    // Caratteristiche in mezzo al blocco (colonne PDF): già gestite.
    if (/\b(STR|DEX|CON|INT|WIS|CHA|FOR|DES|COS|SAG|CAR)\b\s+\d/.test(entry) || /^\d+\s*\([+-]\d+\)/.test(entry)) continue;

    // Azioni di tana: fuori scope.
    if (region === 'lair') { report.skipped.push(entry); continue; }

    // Preambolo delle leggendarie: non è un'azione, ma ci dice quante ne ha.
    const pre = entry.match(/can take (\d+) legendary actions|può (?:effettuare|compiere|eseguire) (\d+) azioni leggendarie/i);
    if (region === 'legendary' && pre) {
      state.legact = pre[1] || pre[2];
      report.ok.push(`Azioni leggendarie: ${state.legact}`);
      continue;
    }

    // Tratti e azioni.
    const parsed = splitEntry(entry);
    if (!parsed) { report.skipped.push(entry); continue; }

    if (/^(?:Legendary Resistance|Resistenza Leggendaria)/i.test(parsed.name)) {
      const lr = parsed.parens.match(/(\d+)\/(?:Day|Giorno)/i);
      if (lr) { state.legres = lr[1]; report.ok.push(`Resistenze leggendarie: ${lr[1]}`); }
    }

    if (region === 'traits') {
      items.push(entryToItem(parsed, 'passive-region', state, report));
    } else {
      const activation = region === 'legendary' ? 'legendary' : region;
      items.push(entryToItem(parsed, activation, state, report));
    }
  }

  resolveSkills(state, report);
  if (items.length) state.items = items;
  return { state, report };
}

// ---------- Template vuoto (livello 1 della Fase 4) ----------

/**
 * Scheletro nel formato che il parser legge (versione italiana, visto
 * che i tuoi PDF sono in italiano — ma l'inglese funziona uguale):
 * lo compili copiando i pezzi dal PDF e lo incolli nella textarea.
 */
export function emptyTemplate() {
  return `Nome Mostro
Mostruosità Media, neutrale malvagio
Classe Armatura 13 (armatura naturale)
Punti Ferita 30 (4d8 + 12)
Velocità 9 m, scalare 9 m
FOR DES COS INT SAG CAR
14 (+2) 16 (+3) 14 (+2) 5 (-3) 10 (+0) 7 (-2)
Tiri Salvezza Des +5, Cos +4
Competenze Furtività +5, Percezione +2
Resistenze ai Danni acido, veleno
Immunità alle Condizioni avvelenato
Sensi Scurovisione 18 m., Percezione passiva 10
Lingue Comune, Infernale
Sfida 2 (450 PE)
Nome Tratto. Descrizione del tratto passivo.
Azioni
Nome Attacco. Attacco con arma da mischia: +5 per colpire, gittata 1,5 m., un bersaglio. Colpito: 9 (2d6 + 3) danni perforanti.
Nome Soffio (Ricarica 5-6). Ogni creatura in un cono di 4,5 m deve effettuare un tiro salvezza su Destrezza CD 13, subendo 21 (6d6) danni da fuoco in caso di fallimento, o la metà di questi danni in caso di successo.`;
}
