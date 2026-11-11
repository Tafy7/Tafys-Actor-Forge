// ============================================================
// Incantesimi dei mostri (blocco "Spellcasting" / "Incantesimi").
//
// Uno statblock elenca gli incantesimi a gruppi:
//   2024  "At Will: Light, Mage Hand · 1/Day Each: Fireball, Fly"
//   2014  "At will: … · 3/day each: … · Cantrips (at will): … ·
//          1st level (4 slots): …"
//   IT    "A volontà: … · 1/giorno ciascuno: … · Trucchetti (a volontà): … ·
//          1° livello (4 slot): … / Livello 1 (4 slot): …"
// Qui li leggiamo (dal testo dello statblock o dalla lista scritta nel form),
// li riscriviamo in una forma canonica e li colleghiamo agli incantesimi dei
// compendi del sistema dnd5e (indice in data/srd-spells.js).
// Modulo PURO (niente DOM): si testa con node.
// ============================================================
import { SRD_SPELLS } from '../data/srd-spells.js';

const ABILITY_WORD = {
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
  forza: 'str', destrezza: 'dex', costituzione: 'con', intelligenza: 'int', saggezza: 'wis', carisma: 'cha',
};
const ABILITY_RE = Object.keys(ABILITY_WORD).join('|');

/** Il nome di una voce indica un blocco di incantesimi? */
export function isSpellcastingName(name) {
  return /^(?:innate\s+)?spellcasting\b|^(?:lanciare\s+)?incantesimi(?:\s+innati)?\b|^incantatore\b/i.test(String(name || '').trim());
}

// Intestazioni dei gruppi. L'ordine conta: le forme lunghe prima delle corte.
const HEADERS = [
  // Trucchetti (2014): "Cantrips (at will):" / "Trucchetti (a volontà):"
  { re: /(?:cantrips|trucchetti)\s*\((?:at will|a volont[àa])\)\s*:/iy, make: () => ({ mode: 'atwill', cantrips: true }) },
  // Slot (2014): "1st level (4 slots):" / "1° livello (4 slot):" / "Livello 1 (4 slot):"
  { re: /(\d)(?:st|nd|rd|th|°)?[\s-]+(?:level|livello)\s*\((\d+)\s+slots?\)\s*:/iy, make: (m) => ({ mode: 'slots', level: Number(m[1]), slots: Number(m[2]) }) },
  { re: /(?:livello|level)\s+(\d)\s*\((\d+)\s+slots?\)\s*:/iy, make: (m) => ({ mode: 'slots', level: Number(m[1]), slots: Number(m[2]) }) },
  // A volontà
  { re: /(?:at[\s-]will|a volont[àa])\s*:/iy, make: () => ({ mode: 'atwill' }) },
  // N al giorno (ciascuno)
  { re: /(\d+)\s*\/\s*(?:day|giorno)(?:\s+(?:each|ciascuno|ciascuna|ognuno|ognuna))?\s*:/iy, make: (m) => ({ mode: 'day', uses: Number(m[1]) }) },
];

/** Trova la prossima intestazione di gruppo a partire da `from`. */
function nextHeader(text, from) {
  let best = null;
  for (let i = from; i < text.length; i++) {
    // un'intestazione comincia a inizio testo o dopo spazio/punteggiatura
    if (i > 0 && !/[\s.;:,)]/.test(text[i - 1])) continue;
    for (const h of HEADERS) {
      h.re.lastIndex = i;
      const m = h.re.exec(text);
      if (m) { best = { index: i, end: h.re.lastIndex, group: h.make(m) }; break; }
    }
    if (best) return best;
  }
  return null;
}

/** "fireball (level 4 version)*" → { name: 'fireball', castLevel: 4, note: '…' } */
function parseSpellToken(raw) {
  let s = String(raw || '').replace(/[*†‡]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  let castLevel = null;
  const notes = [];
  s = s.replace(/\(([^)]*)\)/g, (_, inner) => {
    const lv = inner.match(/(?:level|livello)\s*(\d)|(\d)(?:st|nd|rd|th|°)[\s-]*(?:level|livello)/i);
    if (lv) castLevel = Number(lv[1] || lv[2]);
    else notes.push(inner.trim());
    return '';
  }).trim();
  s = s.replace(/^(?:and|e)\s+/i, '').replace(/[.;:]+$/, '').trim();
  if (!s || s.length > 60) return null;
  return { name: s, castLevel, note: notes.join('; ') };
}

/**
 * Gruppi di incantesimi da un testo (statblock o lista del form).
 * Ritorna [{ mode: 'atwill'|'day'|'slots', uses?, level?, slots?, cantrips?, spells: [{name, castLevel, note}] }].
 */
export function parseSpellGroups(text) {
  const src = String(text || '').replace(/\r/g, '').replace(/\n+/g, ' \n ');
  const groups = [];
  let h = nextHeader(src, 0);
  while (h) {
    const next = nextHeader(src, h.end);
    let body = src.slice(h.end, next ? next.index : src.length);
    // Il blocco finisce alla prima frase che non è più una lista
    // ("…, fly. The lich casts…", "*The mage casts…").
    body = body.split(/\.\s+(?=[A-Z*À-Ö])|\s\*(?=[A-Z])|\n\s*\n/)[0];
    const spells = body.split(/,|\n|;/).map(parseSpellToken).filter(Boolean);
    if (spells.length) groups.push({ ...h.group, spells });
    h = next;
  }
  return groups;
}

/** Testo d'intestazione → caratteristica, CD, bonus d'attacco, livello d'incantatore, senza materiali. */
export function parseSpellcastingHeader(text) {
  const s = String(text || '');
  const out = { ability: '', dc: '', attack: '', casterLevel: '', noMaterial: false };
  let m = s.match(new RegExp(`(?:using|uses|usando|usa)\\s+(${ABILITY_RE})\\s+(?:as\\s+(?:the|its)\\s+spellcasting ability|come\\s+caratteristica\\s+(?:da|di)\\s+incantatore)`, 'i'))
    || s.match(new RegExp(`(?:spellcasting ability is|caratteristica (?:da|di) incantatore (?:è|e))\\s+(${ABILITY_RE})`, 'i'))
    || s.match(new RegExp(`\\b(${ABILITY_RE})\\b`, 'i'));
  if (m) out.ability = ABILITY_WORD[m[1].toLowerCase()] || '';
  m = s.match(/spell\s+save\s+DC\s*(\d+)|(?:CD|DC)\s+(?:del\s+)?(?:tiro\s+salvezza\s+(?:degli|contro\s+(?:i|gli))\s+incantesimi\s*)?(\d+)/i);
  if (m) out.dc = m[1] || m[2] || '';
  // IT: "+5 al tiro per colpire con gli attacchi con incantesimo" e la forma breve "…per colpire con incantesimo".
  m = s.match(/([+-]\d+)\s+to hit with spell attacks|([+-]\d+)\s+(?:al tiro per colpire|per colpire)\s+con\s+(?:(?:gli\s+)?attacchi\s+(?:con|di)\s+)?incantesim[oi]/i);
  if (m) out.attack = (m[1] || m[2] || '').replace('+', '');
  m = s.match(/(\d+)(?:st|nd|rd|th)[\s-]+level\s+spellcaster|incantatore\s+di\s+(\d+)°?\s*livello/i);
  if (m) out.casterLevel = m[1] || m[2] || '';
  out.noMaterial = /(?:requiring|requires|without|needing)\s+no\s+material\s+components|no\s+material\s+components|senza\s+(?:bisogno\s+di\s+)?componenti\s+material|non\s+richied\w+\s+(?:alcuna\s+|nessuna\s+)?component[ei]\s+material/i.test(s);
  return out;
}

const GROUP_LABEL = {
  it: { atwill: 'A volontà', cantrips: 'Trucchetti (a volontà)', day: (n) => `${n}/giorno`, slots: (l, n) => `Livello ${l} (${n} slot)` },
  en: { atwill: 'At will', cantrips: 'Cantrips (at will)', day: (n) => `${n}/day`, slots: (l, n) => `Level ${l} (${n} slots)` },
};

/** Gruppi → lista canonica, una riga per gruppo (quella che si modifica nel form). */
export function formatSpellGroups(groups, lang = 'it') {
  const L = GROUP_LABEL[lang] || GROUP_LABEL.it;
  return (groups || []).map((g) => {
    const head = g.mode === 'atwill' ? (g.cantrips ? L.cantrips : L.atwill)
      : g.mode === 'day' ? L.day(g.uses) : L.slots(g.level, g.slots);
    const names = g.spells.map(sp => sp.name + (sp.castLevel ? ` (${lang === 'en' ? 'level' : 'livello'} ${sp.castLevel})` : '') + (sp.note ? ` (${sp.note})` : ''));
    return `${head}: ${names.join(', ')}`;
  }).join('\n');
}

// ---------- Collegamento ai compendi del sistema ----------
/** Chiave di confronto dei nomi: senza maiuscole, accenti, apostrofi e punteggiatura. */
export const spellKey = (s) => norm(s);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const INDEX = {};
for (const rules of Object.keys(SRD_SPELLS)) {
  const map = new Map();
  for (const [name, id, level] of SRD_SPELLS[rules].spells) map.set(norm(name), { name, id, level });
  INDEX[rules] = map;
}

/**
 * Nome → incantesimo del compendio di sistema: prima le regole del mostro,
 * poi le altre. Se non c'è, riprova togliendo il nome del mago in testa
 * ("Melf's Acid Arrow" → "Acid Arrow": nello SRD i nomi propri non ci sono).
 * Ritorna { name, id, level, rules, pack, uuid } oppure null.
 */
export function resolveSpell(name, rules = '2024') {
  const order = rules === '2014' ? ['2014', '2024'] : ['2024', '2014'];
  const keys = [norm(name)];
  const stripped = String(name || '').replace(/^\s*[A-ZÀ-Ö][\w-]*['’]s\s+/, '');
  if (stripped !== name) keys.push(norm(stripped));
  for (const key of keys) {
    for (const r of order) {
      const hit = INDEX[r]?.get(key);
      if (hit) {
        const pack = SRD_SPELLS[r].pack;
        return { ...hit, rules: r, pack, uuid: `Compendium.${pack}.Item.${hit.id}` };
      }
    }
  }
  return null;
}

// ---------- Slot di un incantatore completo (tabella del Manuale del Giocatore) ----------
// Riga = livello da incantatore 1…20, colonne = slot di 1°…9° livello.
// È la stessa tabella che dnd5e usa per un NPC con `attributes.spell.level`.
const FULL_CASTER = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Slot di 1°…9° livello (array di 9 numeri) per un livello da incantatore. */
export function defaultSlots(casterLevel) {
  const lv = Math.max(0, Math.min(20, Math.floor(Number(casterLevel) || 0)));
  const row = lv ? FULL_CASTER[lv - 1] : [];
  return Array.from({ length: 9 }, (_, i) => row[i] || 0);
}

/** "4,3,,2" / [4,3,'',2] → array di 9 voci: numero scelto a mano oppure null (= quello del livello). */
export function parseSlotOverrides(v) {
  const list = Array.isArray(v) ? v : String(v ?? '').split(',');
  return Array.from({ length: 9 }, (_, i) => {
    const raw = String(list[i] ?? '').trim();
    if (raw === '' || !Number.isFinite(Number(raw)) || Number(raw) < 0) return null;
    return Math.floor(Number(raw));
  });
}

/**
 * Slot effettivi del mostro: [{ n, explicit }] per i livelli 1…9.
 * Precedenza: scelti a mano (`scSlots`) → scritti nella lista ("Livello 3
 * (3 slot)") → quelli del livello da incantatore. `explicit` = va scritto
 * come override (scelto a mano, o diverso da quello del livello).
 */
export function effectiveSlots(card) {
  const hand = parseSlotOverrides(card?.scSlots);
  const base = defaultSlots(card?.scLevel);
  const listed = Array(9).fill(null);
  for (const g of parseSpellGroups(card?.spellList)) if (g.mode === 'slots' && g.level >= 1 && g.level <= 9) listed[g.level - 1] = g.slots;
  return base.map((def, i) => {
    const chosen = hand[i] ?? listed[i];
    // "Scelto" = diverso da ciò che Foundry calcolerebbe dal livello: solo
    // allora serve un override (i mostri ufficiali lo lasciano vuoto).
    return { n: chosen ?? def, explicit: hand[i] != null || (listed[i] != null && listed[i] !== def) };
  });
}

// ---------- Lista "a pillole" (sezione Incantesimi del design Studio) ----------
// Una pillola = un incantesimo con il suo modo di lancio:
//   slot (usa gli slot del suo livello) · atwill (a volontà) · day (N al giorno).
// È solo un altro modo di scrivere gli stessi gruppi della lista testuale:
// groupsToChips ↔ chipsToGroups, così statblock, bozze e card restano compatibili.

/** Gruppi → pillole [{ name, castLevel, note, mode, uses, level, cantrips }]. */
export function groupsToChips(groups) {
  const out = [];
  for (const g of groups || []) {
    for (const sp of g.spells) {
      out.push({
        name: sp.name, castLevel: sp.castLevel || null, note: sp.note || '',
        mode: g.mode === 'slots' ? 'slot' : g.mode === 'day' ? 'day' : 'atwill',
        uses: g.mode === 'day' ? g.uses : null,
        level: g.mode === 'slots' ? g.level : null,
        cantrips: Boolean(g.cantrips),
      });
    }
  }
  return out;
}

/**
 * Pillole → gruppi nell'ordine degli statblock: trucchetti, a volontà,
 * N/giorno (dal più frequente), slot dal 1° al 9°.
 * `slots` = array di 9 numeri (quanti slot scrivere nell'intestazione).
 * `caster` = il mostro ha un livello da incantatore: i trucchetti a volontà
 * vanno sotto "Trucchetti (a volontà)", come negli statblock 2014.
 */
export function chipsToGroups(chips, { rules = '2024', slots = [], caster = false } = {}) {
  const cantrips = [], atwill = [], day = new Map(), bySlot = new Map();
  const bare = (c) => ({ name: c.name, castLevel: c.castLevel || null, note: c.note || '' });
  for (const c of chips || []) {
    const hit = resolveSpell(c.name, rules);
    if (c.mode === 'day') {
      const n = Math.max(1, Number(c.uses) || 1);
      if (!day.has(n)) day.set(n, []);
      day.get(n).push(bare(c));
    } else if (c.mode === 'slot' && !(hit && hit.level === 0)) {
      // Il livello dello slot è quello dell'incantesimo; per quelli che il
      // Forge non conosce vale quello scelto sulla pillola (1 se non detto).
      const lv = Math.max(1, Math.min(9, hit ? hit.level : Number(c.level) || 1));
      if (!bySlot.has(lv)) bySlot.set(lv, []);
      bySlot.get(lv).push(bare(c));
    } else if (c.cantrips || (hit && hit.level === 0 && (caster || c.mode === 'slot'))) cantrips.push(bare(c));
    else atwill.push(bare(c));
  }
  const groups = [];
  if (cantrips.length) groups.push({ mode: 'atwill', cantrips: true, spells: cantrips });
  if (atwill.length) groups.push({ mode: 'atwill', spells: atwill });
  for (const n of [...day.keys()].sort((a, b) => b - a)) groups.push({ mode: 'day', uses: n, spells: day.get(n) });
  for (const lv of [...bySlot.keys()].sort((a, b) => a - b)) groups.push({ mode: 'slots', level: lv, slots: Number(slots[lv - 1]) || 0, spells: bySlot.get(lv) });
  return groups;
}

/** Prossimo modo di lancio al clic sulla pillola: (slot →) a volontà → 1/g → 2/g → 3/g → da capo. */
export function nextSpellMode(chip, hasSlots) {
  if (chip.mode === 'slot') return { mode: 'atwill', uses: null };
  if (chip.mode === 'atwill') return { mode: 'day', uses: 1 };
  if (chip.mode === 'day' && Number(chip.uses) < 3) return { mode: 'day', uses: Number(chip.uses) + 1 };
  return hasSlots ? { mode: 'slot', uses: null } : { mode: 'atwill', uses: null };
}

/**
 * Suggerimenti mentre si scrive: nomi dei compendi di sistema che iniziano
 * con il testo (prima) o lo contengono (dopo). Da `min` caratteri in su.
 * Prima le regole del mostro; i nomi presenti in entrambe compaiono una volta.
 */
export function suggestSpells(text, rules = '2024', { limit = 8, min = 3, exclude = [] } = {}) {
  const q = norm(text);
  if (q.length < min) return [];
  const skip = new Set(exclude.map(norm));
  const order = rules === '2014' ? ['2014', '2024'] : ['2024', '2014'];
  const seen = new Set();
  const starts = [], inside = [];
  for (const r of order) {
    for (const [key, sp] of INDEX[r] || []) {
      if (seen.has(key) || skip.has(key)) continue;
      const at = key.indexOf(q);
      if (at < 0) continue;
      seen.add(key);
      // "inizia con" vale anche per le parole interne ("hand" → Mage Hand).
      (at === 0 ? starts : inside).push({ name: sp.name, level: sp.level, rules: r, word: at > 0 && key[at - 1] === ' ' });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  inside.sort((a, b) => (b.word - a.word) || byName(a, b));
  return [...starts.sort(byName), ...inside].slice(0, limit).map(({ word, ...x }) => x);
}
