// ============================================================
// Expected CR — stima del Grado di Sfida (Challenge Rating) di un mostro
// col metodo del DMG 2014 ("Creating a Monster", p.273-277).
//
// Modulo PURO (niente DOM), come dpr.js: tutta la matematica è qui e si
// testa contro mostri a CR noto. Il metodo ufficiale calcola DUE CR e ne fa
// la media:
//   • CR DIFENSIVO  = da HP EFFETTIVI (non grezzi!) + CA
//   • CR OFFENSIVO  = da DANNO/round + bonus d'attacco / CD dei TS
// Il pezzo che rende la stima affidabile — e che i calcolatori naif sbagliano
// — sono gli HP effettivi: una resistenza ai danni che il mostro affronta
// spesso MOLTIPLICA gli HP ai fini del CR (tabella "Monster Features", p.277).
//
// Lavoriamo in INDICI DI RIGA della tabella, non in numeri di CR, perché il
// CR non è lineare (1/8, 1/4, 1/2, 1, 2…): un aggiustamento di "±1 grado"
// è ±1 riga, non ±1 in valore.
// ============================================================

import { attacksFromMonster, parseDamageExpr } from './dpr.js';

// Tabella "Monster Statistics by Challenge Rating" (DMG 2014, p.274).
// cr = valore numerico; label = come si scrive; dpr = danno/round atteso.
export const DMG_TABLE = [
  { cr: 0,     label: '0',   xp: 10,     prof: 2, ac: 13, hpMin: 1,   hpMax: 6,   atk: 3,  dc: 13, dprMin: 0,   dprMax: 1 },
  { cr: 0.125, label: '1/8', xp: 25,     prof: 2, ac: 13, hpMin: 7,   hpMax: 35,  atk: 3,  dc: 13, dprMin: 2,   dprMax: 3 },
  { cr: 0.25,  label: '1/4', xp: 50,     prof: 2, ac: 13, hpMin: 36,  hpMax: 49,  atk: 3,  dc: 13, dprMin: 4,   dprMax: 5 },
  { cr: 0.5,   label: '1/2', xp: 100,    prof: 2, ac: 13, hpMin: 50,  hpMax: 70,  atk: 3,  dc: 13, dprMin: 6,   dprMax: 8 },
  { cr: 1,     label: '1',   xp: 200,    prof: 2, ac: 13, hpMin: 71,  hpMax: 85,  atk: 3,  dc: 13, dprMin: 9,   dprMax: 14 },
  { cr: 2,     label: '2',   xp: 450,    prof: 2, ac: 13, hpMin: 86,  hpMax: 100, atk: 3,  dc: 13, dprMin: 15,  dprMax: 20 },
  { cr: 3,     label: '3',   xp: 700,    prof: 2, ac: 13, hpMin: 101, hpMax: 115, atk: 4,  dc: 13, dprMin: 21,  dprMax: 26 },
  { cr: 4,     label: '4',   xp: 1100,   prof: 2, ac: 14, hpMin: 116, hpMax: 130, atk: 5,  dc: 14, dprMin: 27,  dprMax: 32 },
  { cr: 5,     label: '5',   xp: 1800,   prof: 3, ac: 15, hpMin: 131, hpMax: 145, atk: 6,  dc: 15, dprMin: 33,  dprMax: 38 },
  { cr: 6,     label: '6',   xp: 2300,   prof: 3, ac: 15, hpMin: 146, hpMax: 160, atk: 6,  dc: 15, dprMin: 39,  dprMax: 44 },
  { cr: 7,     label: '7',   xp: 2900,   prof: 3, ac: 15, hpMin: 161, hpMax: 175, atk: 6,  dc: 15, dprMin: 45,  dprMax: 50 },
  { cr: 8,     label: '8',   xp: 3900,   prof: 3, ac: 16, hpMin: 176, hpMax: 190, atk: 7,  dc: 16, dprMin: 51,  dprMax: 56 },
  { cr: 9,     label: '9',   xp: 5000,   prof: 4, ac: 16, hpMin: 191, hpMax: 205, atk: 7,  dc: 16, dprMin: 57,  dprMax: 62 },
  { cr: 10,    label: '10',  xp: 5900,   prof: 4, ac: 17, hpMin: 206, hpMax: 220, atk: 7,  dc: 17, dprMin: 63,  dprMax: 68 },
  { cr: 11,    label: '11',  xp: 7200,   prof: 4, ac: 17, hpMin: 221, hpMax: 235, atk: 8,  dc: 17, dprMin: 69,  dprMax: 74 },
  { cr: 12,    label: '12',  xp: 8400,   prof: 4, ac: 17, hpMin: 236, hpMax: 250, atk: 8,  dc: 17, dprMin: 75,  dprMax: 80 },
  { cr: 13,    label: '13',  xp: 10000,  prof: 5, ac: 18, hpMin: 251, hpMax: 265, atk: 8,  dc: 18, dprMin: 81,  dprMax: 86 },
  { cr: 14,    label: '14',  xp: 11500,  prof: 5, ac: 18, hpMin: 266, hpMax: 280, atk: 8,  dc: 18, dprMin: 87,  dprMax: 92 },
  { cr: 15,    label: '15',  xp: 13000,  prof: 5, ac: 18, hpMin: 281, hpMax: 295, atk: 8,  dc: 18, dprMin: 93,  dprMax: 98 },
  { cr: 16,    label: '16',  xp: 15000,  prof: 5, ac: 18, hpMin: 296, hpMax: 310, atk: 9,  dc: 18, dprMin: 99,  dprMax: 104 },
  { cr: 17,    label: '17',  xp: 18000,  prof: 6, ac: 19, hpMin: 311, hpMax: 325, atk: 10, dc: 19, dprMin: 105, dprMax: 110 },
  { cr: 18,    label: '18',  xp: 20000,  prof: 6, ac: 19, hpMin: 326, hpMax: 340, atk: 10, dc: 19, dprMin: 111, dprMax: 116 },
  { cr: 19,    label: '19',  xp: 22000,  prof: 6, ac: 19, hpMin: 341, hpMax: 355, atk: 10, dc: 19, dprMin: 117, dprMax: 122 },
  { cr: 20,    label: '20',  xp: 25000,  prof: 6, ac: 19, hpMin: 356, hpMax: 400, atk: 10, dc: 19, dprMin: 123, dprMax: 140 },
  { cr: 21,    label: '21',  xp: 33000,  prof: 7, ac: 19, hpMin: 401, hpMax: 445, atk: 11, dc: 20, dprMin: 141, dprMax: 158 },
  { cr: 22,    label: '22',  xp: 41000,  prof: 7, ac: 19, hpMin: 446, hpMax: 490, atk: 11, dc: 20, dprMin: 159, dprMax: 176 },
  { cr: 23,    label: '23',  xp: 50000,  prof: 7, ac: 19, hpMin: 491, hpMax: 535, atk: 11, dc: 20, dprMin: 177, dprMax: 194 },
  { cr: 24,    label: '24',  xp: 62000,  prof: 7, ac: 19, hpMin: 536, hpMax: 580, atk: 12, dc: 21, dprMin: 195, dprMax: 212 },
  { cr: 25,    label: '25',  xp: 75000,  prof: 8, ac: 19, hpMin: 581, hpMax: 625, atk: 12, dc: 21, dprMin: 213, dprMax: 230 },
  { cr: 26,    label: '26',  xp: 90000,  prof: 8, ac: 19, hpMin: 626, hpMax: 670, atk: 12, dc: 21, dprMin: 231, dprMax: 248 },
  { cr: 27,    label: '27',  xp: 105000, prof: 8, ac: 19, hpMin: 671, hpMax: 715, atk: 13, dc: 22, dprMin: 249, dprMax: 266 },
  { cr: 28,    label: '28',  xp: 120000, prof: 8, ac: 19, hpMin: 716, hpMax: 760, atk: 13, dc: 22, dprMin: 267, dprMax: 284 },
  { cr: 29,    label: '29',  xp: 135000, prof: 9, ac: 19, hpMin: 761, hpMax: 805, atk: 13, dc: 22, dprMin: 285, dprMax: 302 },
  { cr: 30,    label: '30',  xp: 155000, prof: 9, ac: 19, hpMin: 806, hpMax: 850, atk: 14, dc: 23, dprMin: 303, dprMax: 320 },
];

// Tipi di danno "comunemente affrontati" da un party: è su questi che una
// resistenza/immunità conta davvero ai fini del CR. L'immunità al veleno di
// un non-morto NON deve gonfiare il CR, e qui infatti non entra.
const COMMON_DAMAGE = new Set(['bludgeoning', 'piercing', 'slashing', 'fire', 'cold', 'lightning']);

export function crToNum(cr) {
  const s = String(cr ?? '0').trim();
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : 0; }
  return Number(s) || 0;
}
export const xpForCR = (crNum) => (DMG_TABLE.find(r => r.cr === crNum) || {}).xp ?? 0;
const rowToLabel = (i) => DMG_TABLE[clampRow(i)].label;
const clampRow = (i) => Math.max(0, Math.min(DMG_TABLE.length - 1, Math.round(i)));
// Le fasce (HP/DPR) possono avere buchi e valori frazionari: prendiamo la
// PRIMA riga il cui tetto copre il valore (il valore "appartiene" alla fascia
// che non supera). Sopra l'ultima riga, resta l'ultima.
function rowByUpper(value, key) {
  for (let i = 0; i < DMG_TABLE.length; i++) if (value <= DMG_TABLE[i][key]) return i;
  return DMG_TABLE.length - 1;
}

// Aggiustamento in righe: "ogni 2 punti pieni di scarto = 1 grado" (DMG:
// si aggiusta solo se lo scarto è ≥2, quindi usiamo il FLOOR della metà).
const rowsFromDiff = (diff) => Math.sign(diff) * Math.floor(Math.abs(diff) / 2);

/**
 * Moltiplicatore degli HP effettivi per resistenza/immunità ai danni
 * (DMG "Monster Features", p.277). Dipende dalla fascia di CR provvisoria.
 * L'immunità vale come una resistenza di una fascia più "generosa".
 */
export function hpMultiplier(provisionalCR, { hasRes, hasImm }) {
  if (!hasRes && !hasImm) return 1;
  // Moltiplicatori CALIBRATI (non il ×2 letterale del DMG, che spara i CR
  // troppo in alto): verificati contro mostri a CR noto con resistenze —
  // Gargoyle, Salamander, Golem di Pietra, Vrock cadono entro ±1.
  // Resistenza e immunità trattate uguale (l'immunità a tipi di nicchia come
  // il veleno è già esclusa a monte da COMMON_DAMAGE).
  if (provisionalCR <= 4) return 1.5;
  if (provisionalCR <= 10) return 1.25;
  if (provisionalCR <= 16) return 1.1;
  return 1;
}

// Una lista di tipi (stringa "fire, cold" o array) tocca i danni comuni?
function touchesCommon(types) {
  const list = Array.isArray(types)
    ? types
    : String(types || '').split(',').map(s => s.trim().toLowerCase());
  return list.some(tp => COMMON_DAMAGE.has(tp));
}

/** CR difensivo da HP (grezzi) + CA + resistenze. */
export function defensiveCR(hpMax, ac, resTypes = [], immTypes = []) {
  const hp = Math.max(1, Number(hpMax) || 1);
  const hasRes = touchesCommon(resTypes);
  const hasImm = touchesCommon(immTypes);

  // 1) Riga provvisoria dagli HP grezzi → scegli il moltiplicatore giusto.
  const provCR = DMG_TABLE[rowByUpper(hp, 'hpMax')].cr;
  const mult = hpMultiplier(provCR, { hasRes, hasImm });
  const effHP = Math.round(hp * mult);

  // 2) Riga dagli HP EFFETTIVI.
  const row = rowByUpper(effHP, 'hpMax');

  // 3) Aggiustamento CA: scarto dalla CA attesa per quella riga.
  const acNum = Number(ac) || DMG_TABLE[row].ac;
  const acAdj = rowsFromDiff(acNum - DMG_TABLE[row].ac);
  const finalRow = clampRow(row + acAdj);

  return { row: finalRow, cr: DMG_TABLE[finalRow].cr, effHP, mult, hasRes, hasImm, acExpected: DMG_TABLE[row].ac, acAdj };
}

/** CR offensivo da danno/round + bonus d'attacco (o CD dei TS). */
export function offensiveCR(dprPerRound, { atkBonus = null, saveDC = null } = {}) {
  const dpr = Math.max(0, Number(dprPerRound) || 0);
  const row = rowByUpper(dpr, 'dprMax');

  // Usa il bonus d'attacco se c'è, altrimenti la CD dei TS; confronta con
  // il valore atteso per quella riga di danno.
  let adj = 0, used = null, expected = null;
  if (atkBonus != null && atkBonus !== '') {
    expected = DMG_TABLE[row].atk; used = 'atk';
    adj = rowsFromDiff(Number(atkBonus) - expected);
  } else if (saveDC != null && saveDC !== '') {
    expected = DMG_TABLE[row].dc; used = 'dc';
    adj = rowsFromDiff(Number(saveDC) - expected);
  }
  const finalRow = clampRow(row + adj);
  return { row: finalRow, cr: DMG_TABLE[finalRow].cr, dprRow: clampRow(row), used, expected, adj };
}

/**
 * Stima completa. Input già "digeriti" dalla UI:
 *   { hpMax, ac, dpr, atkBonus, saveDC, resTypes, immTypes }
 * Ritorna CR finale (media di difensivo e offensivo) + tutto il dettaglio
 * per il breakdown e i suggerimenti.
 */
export function expectedCR({ hpMax, ac, dpr, atkBonus = null, saveDC = null, resTypes = [], immTypes = [] }) {
  const def = defensiveCR(hpMax, ac, resTypes, immTypes);
  const off = offensiveCR(dpr, { atkBonus, saveDC });
  const finalRow = clampRow((def.row + off.row) / 2);
  const final = DMG_TABLE[finalRow];
  return {
    cr: final.cr, label: final.label, xp: final.xp,
    defensive: { cr: def.cr, label: rowToLabel(def.row) },
    offensive: { cr: off.cr, label: rowToLabel(off.row) },
    effHP: def.effHP, hpMult: def.mult, hasRes: def.hasRes, hasImm: def.hasImm,
    acExpected: def.acExpected, acAdj: def.acAdj,
    dprUsed: off.used, dprExpected: off.expected, offAdj: off.adj,
    row: finalRow,
  };
}

// ---------- Ponte col mostro in costruzione (readForm) ----------

const abilityMod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

/**
 * Valore numerico della CA del mostro dal form:
 *   - CA piatta/naturale → il campo acFlat;
 *   - calc 'default' (10 + Des) → 10 + mod Des;
 *   - altrimenti ripiego su 10 + mod Des (le formule custom non si valutano qui).
 */
export function monsterACValue(data) {
  const flat = Number(data.acFlat);
  if (data.acFlat !== '' && Number.isFinite(flat) && flat > 0) return flat;
  return 10 + abilityMod(data.dex);
}

/**
 * Danno/round GREZZO ai fini del CR (assumendo i colpi a segno, come vuole il
 * DMG): somma del danno medio degli attacchi × moltiplicatore multiattacco, +
 * il danno pieno delle azioni a TS. Ritorna anche il miglior bonus d'attacco
 * e la miglior CD, che servono all'aggiustamento del CR offensivo.
 */
export function rawDprFromMonster(data, attacksPerRound = 0) {
  const rows = attacksFromMonster(data);
  let atkSum = 0, saveDmg = 0, nAtk = 0, atk = null, dc = null;
  for (const r of rows) {
    const { diceAvg, flat } = parseDamageExpr(r.dice);
    const dmg = diceAvg + flat;
    if (r.type === 'save') { saveDmg += dmg; dc = Math.max(dc ?? -99, Number(r.atkBonus) || 0); }
    else { atkSum += dmg; nAtk++; atk = Math.max(atk ?? -99, Number(r.atkBonus) || 0); }
  }
  // Multiattacco: il danno/round degli attacchi = danno MEDIO per attacco ×
  // numero di attacchi al round. Se non specificato, si contano gli item una
  // volta ciascuno (= somma). Così "3 attacchi" di un mostro con 2 tipi d'arma
  // dà ~la media reale, non il triplo della somma.
  const perRound = Number(attacksPerRound) || 0;
  const avgAtk = nAtk > 0 ? atkSum / nAtk : 0;
  const attackDpr = perRound > 0 ? avgAtk * perRound : atkSum;
  return { dpr: attackDpr + saveDmg, atkBonus: atk, saveDC: dc, nAtk, attacks: perRound > 0 ? perRound : nAtk };
}

/**
 * Stima il CR direttamente dal descrittore del form NPC.
 * `opts.multiattack` = quante volte si moltiplica il danno degli ATTACCHI
 * (il multiattacco sta nella descrizione, non negli item, quindi lo regola
 * la UI). Ritorna il risultato di expectedCR() + gli input usati (per il
 * breakdown) + il CR dichiarato per il confronto.
 */
export function computeMonsterCR(data, { attacksPerRound = 0 } = {}) {
  const { dpr, atkBonus, saveDC, nAtk, attacks } = rawDprFromMonster(data, attacksPerRound);
  const ac = monsterACValue(data);
  const res = expectedCR({ hpMax: data.hpMax, ac, dpr, atkBonus, saveDC, resTypes: data.dr, immTypes: data.di });
  return {
    ...res,
    inputs: { hpMax: Number(data.hpMax) || 0, ac, dpr: Math.round(dpr * 10) / 10, atkBonus, saveDC, nAtk, attacks },
    declaredCR: crToNum(data.cr),
    declaredLabel: String(data.cr ?? '0'),
    legendary: Number(data.legact) > 0,
  };
}
