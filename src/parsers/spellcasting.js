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
  m = s.match(/([+-]\d+)\s+to hit with spell attacks|([+-]\d+)\s+(?:al tiro per colpire|per colpire)\s+con\s+(?:gli\s+)?attacchi\s+(?:con|di)\s+incantesimo/i);
  if (m) out.attack = (m[1] || m[2] || '').replace('+', '');
  m = s.match(/(\d+)(?:st|nd|rd|th)[\s-]+level\s+spellcaster|incantatore\s+di\s+(\d+)°?\s*livello/i);
  if (m) out.casterLevel = m[1] || m[2] || '';
  out.noMaterial = /(?:requiring|requires|without|needing)\s+no\s+material\s+components|no\s+material\s+components|senza\s+(?:bisogno\s+di\s+)?componenti\s+material/i.test(s);
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
