// ============================================================
// Import dei PG da JSON di Foundry (dnd5e 5.x) per il tab Scontro.
//
// Un actor "character" esportato NON contiene i valori derivati: HP massimi
// e CA li calcola Foundry al volo (nel JSON: hp.max = null, ac.calc =
// "unarmoredBarb"…). Qui li ricostruiamo con le stesse regole:
//   • livello  = somma dei livelli delle classi;
//   • HP max   = per ogni classe, l'avanzamento HitPoints ({"1":"max",
//                "2":"avg",…}) sul suo dado vita + livello × mod COS
//                (+ eventuali bonus numerici), oppure hp.max se impostato;
//   • CA       = secondo ac.calc (armatura indossata col limite di DES,
//                scudo, Barbaro/Monaco senza armatura, Armatura magica…);
//   • attacco  = miglior arma impugnata (o tiro per colpire da incantatore).
// Il danno per round NON si ricava in modo affidabile: lo inserisce l'utente.
// Modulo PURO: verificato sul golden di Shaq Ira (Barbaro 3: 35 PF, CA 15).
// ============================================================

const mod = (v) => Math.floor(((Number(v) || 10) - 10) / 2);
export const profForLevel = (l) => 2 + Math.floor((Math.max(1, Number(l) || 1) - 1) / 4);
const dieOf = (hd) => Number(String(hd?.denomination ?? hd ?? '').replace(/\D/g, '')) || 8;
const num = (v) => (String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const asList = (x) => (Array.isArray(x) ? x : Object.values(x || {}));

function abilityMods(sys) {
  const a = sys.abilities || {};
  return Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => [k, mod(a[k]?.value)]));
}

function levelOf(actor) {
  const classes = (actor.items || []).filter(i => i.type === 'class');
  const sum = classes.reduce((s, c) => s + (Number(c.system?.levels) || 0), 0);
  return sum || Number(actor.system?.details?.level) || 1;
}

function hpOf(actor, level, m, notes) {
  const hp = actor.system?.attributes?.hp || {};
  if (num(hp.max) > 0) return num(hp.max); // valore sovrascritto a mano in Foundry
  let total = 0;
  let found = false;
  for (const cls of (actor.items || []).filter(i => i.type === 'class')) {
    const adv = asList(cls.system?.advancement).find(a => a?.type === 'HitPoints');
    const die = dieOf(cls.system?.hd ?? cls.system?.hitDice);
    for (const v of Object.values(adv?.value || {})) {
      found = true;
      total += v === 'max' ? die : v === 'avg' ? Math.floor(die / 2) + 1 : (Number(v) || 0);
    }
  }
  if (found) {
    total += level * m.con;
    const perLevel = num(hp.bonuses?.level);
    const overall = num(hp.bonuses?.overall);
    if (perLevel) total += perLevel * level;
    if (overall) total += overall;
    if ((hp.bonuses?.level && perLevel == null) || (hp.bonuses?.overall && overall == null)) {
      notes.push('bonus agli HP con formula non conteggiati');
    }
    return total;
  }
  if (num(hp.value) > 0) { notes.push('HP presi dai PF attuali'); return num(hp.value); }
  return null;
}

function acOf(actor, m, notes) {
  const ac = actor.system?.attributes?.ac || {};
  const equipped = (actor.items || []).filter(i => i.type === 'equipment' && i.system?.equipped);
  const armor = equipped.find(i => ['light', 'medium', 'heavy'].includes(i.system?.type?.value));
  const shield = equipped.find(i => i.system?.type?.value === 'shield');
  const shieldBonus = shield ? (num(shield.system.armor?.value) ?? 2) + (num(shield.system.armor?.magicalBonus) ?? 0) : 0;

  // Contributo dell'armatura indossata (con il limite alla DES del tipo).
  const armorAC = () => {
    if (!armor) return { base: 10, dex: m.dex };
    const a = armor.system.armor || {};
    const base = (num(a.value) ?? 10) + (num(a.magicalBonus) ?? 0);
    const type = armor.system.type.value;
    const cap = num(a.dex);
    const dex = type === 'heavy' ? 0 : type === 'medium' ? Math.min(m.dex, cap ?? 2) : (cap != null ? Math.min(m.dex, cap) : m.dex);
    return { base, dex };
  };

  let value;
  switch (ac.calc) {
    case 'flat': value = num(ac.flat); break;
    case 'natural': value = (num(ac.flat) ?? 10) + shieldBonus; break;
    case 'unarmoredBarb': value = 10 + m.dex + m.con + shieldBonus; break;
    case 'unarmoredMonk': value = 10 + m.dex + m.wis; break;
    case 'mage': case 'draconic': value = 13 + m.dex + shieldBonus; break;
    case 'custom': {
      // Formula personalizzata: sostituiamo i riferimenti noti e valutiamo
      // SOLO se resta un'espressione aritmetica pura (numeri e + - * / ()).
      const { base, dex } = armorAC();
      const expr = String(ac.formula || '')
        .replace(/@abilities\.(\w+)\.mod/g, (_, k) => String(m[k] ?? 0))
        .replace(/@attributes\.ac\.armor/g, String(base))
        .replace(/@attributes\.ac\.dex/g, String(dex))
        .replace(/@attributes\.ac\.shield/g, String(shieldBonus));
      if (/^[\d\s+\-*/().]+$/.test(expr)) {
        try { value = Math.round(Function(`"use strict";return (${expr})`)()); } catch { value = null; }
      }
      if (value == null) { notes.push('CA con formula personalizzata non valutabile: stimata'); value = 10 + m.dex; }
      break;
    }
    default: { const { base, dex } = armorAC(); value = base + dex + shieldBonus; }
  }
  const bonus = num(ac.bonus);
  if (bonus) value += bonus;
  return value;
}

function attackOf(actor, level, m) {
  const prof = profForLevel(level);
  let best = null;
  for (const w of (actor.items || []).filter(i => i.type === 'weapon' && i.system?.equipped)) {
    const s = w.system;
    const props = s.properties || [];
    const ranged = /R$/.test(s.type?.value || '');
    const ab = s.ability || (props.includes('fin') ? (m.str >= m.dex ? 'str' : 'dex') : ranged ? 'dex' : 'str');
    const v = (m[ab] ?? 0) + (s.proficient === 0 ? 0 : prof) + (num(s.magicalBonus) ?? 0);
    if (best == null || v > best) best = v;
  }
  // Incantatori: il tiro per colpire con incantesimo può superare le armi.
  const sc = actor.system?.attributes?.spellcasting;
  if (sc && m[sc] != null) best = Math.max(best ?? -99, prof + m[sc]);
  return best ?? prof + Math.max(m.str, m.dex);
}

/** Un actor Foundry → riga PG del tab Scontro, con note sulle stime. */
export function importPC(actor) {
  if (!actor || typeof actor !== 'object') return { ok: false, reason: 'JSON non riconosciuto' };
  if (actor.type !== 'character') {
    return { ok: false, reason: `"${actor.name || '?'}" è di tipo ${actor.type || '?'}: servono personaggi (character)` };
  }
  const notes = [];
  const m = abilityMods(actor.system || {});
  const level = Math.max(1, Math.min(20, levelOf(actor)));
  const hp = hpOf(actor, level, m, notes);
  const ac = acOf(actor, m, notes);
  const atk = attackOf(actor, level, m);
  return {
    ok: true, notes,
    pc: {
      name: actor.name || '', level, count: 1,
      hp: hp != null ? String(hp) : '', ac: ac != null ? String(ac) : '', atk: String(atk), dpr: '',
    },
  };
}

/** JSON incollato/caricato (un actor o un array di actor) → righe PG + report. */
export function importPCs(json) {
  // Accetta anche il file della scheda Esporta della macro (es. la cartella
  // "Party" esportata da Foundry): { tafysForgeExport, entries: [{ path, data }] }.
  const src = json && json.tafysForgeExport ? (json.entries || []).map(e => e.data) : json;
  const list = Array.isArray(src) ? src : [src];
  const pcs = [];
  const report = [];
  for (const a of list) {
    const r = importPC(a);
    if (r.ok) {
      pcs.push(r.pc);
      report.push(`✔ ${r.pc.name}: liv. ${r.pc.level}, ${r.pc.hp || '?'} PF, CA ${r.pc.ac}, +${r.pc.atk}${r.notes.length ? ` (${r.notes.join('; ')})` : ''}`);
    } else {
      report.push(`⛔ ${r.reason}`);
    }
  }
  return { pcs, report };
}
