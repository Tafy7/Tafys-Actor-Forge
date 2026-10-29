// ============================================================
// Encounter builder — difficoltà di uno scontro (party vs mostri).
//
// Modulo PURO (niente DOM), come dpr.js ed expected-cr.js. Due metodi
// ufficiali, scelti dall'utente:
//   • 2014 (DMG 2014, cap. 3): soglie XP per personaggio (facile / media /
//     difficile / mortale). La somma degli XP dei mostri viene MOLTIPLICATA
//     in base a quanti mostri ci sono (l'azione economica dei gruppi), con
//     correzione per party piccoli (<3) o grandi (6+).
//   • 2024 (DMG 2024): budget XP per personaggio (bassa / moderata / alta).
//     Niente moltiplicatori: si sommano gli XP e si confrontano col budget.
// Gli XP per CR vengono dalla stessa tabella DMG usata dall'Expected CR.
// ============================================================
import { DMG_TABLE, crToNum, xpForCR } from './expected-cr.js';
import { hitChance } from './dpr.js';

// DMG 2014 — "XP Thresholds by Character Level": [facile, media, difficile, mortale].
export const THRESHOLDS_2014 = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
};
export const TIERS_2014 = ['easy', 'medium', 'hard', 'deadly'];

// DMG 2024 — "XP Budget per Character": [bassa, moderata, alta].
export const BUDGET_2024 = {
  1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500],
  5: [500, 750, 1100], 6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100],
  9: [1300, 2000, 2600], 10: [1600, 2300, 3100], 11: [1900, 2900, 4100], 12: [2200, 3700, 4700],
  13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800], 16: [3800, 6100, 9800],
  17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000],
};
export const TIERS_2024 = ['low', 'moderate', 'high'];

// Moltiplicatori 2014: la scala completa, così la correzione per la taglia del
// party può scendere a ×0.5 (party grande, mostro singolo) o salire a ×5.
const MULT_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
function baseMultIndex(n) {
  if (n <= 1) return 1;   // 1 mostro → ×1
  if (n === 2) return 2;  // 2 → ×1.5
  if (n <= 6) return 3;   // 3-6 → ×2
  if (n <= 10) return 4;  // 7-10 → ×2.5
  if (n <= 14) return 5;  // 11-14 → ×3
  return 6;               // 15+ → ×4
}
/** Moltiplicatore 2014 per n. mostri, corretto per la taglia del party. */
export function multiplier2014(monsterCount, partySize) {
  if (monsterCount <= 0) return 1;
  let i = baseMultIndex(monsterCount);
  if (partySize > 0 && partySize < 3) i += 1;   // party piccolo: scalino sopra
  else if (partySize >= 6) i -= 1;              // party grande: scalino sotto
  return MULT_STEPS[Math.max(0, Math.min(MULT_STEPS.length - 1, i))];
}

// Soglia "mostro trascurabile" per il moltiplicatore 2014 (vedi computeEncounter).
const WEAK_FRACTION = 0.2;
const lvl = (l) => Math.max(1, Math.min(20, Math.round(Number(l) || 1)));
const cnt = (c) => Math.max(0, Math.round(Number(c) || 0));

/**
 * Calcolo completo. Input:
 *   rules: '2014' | '2024'
 *   party: [{ level, count }]          gruppi di PG dello stesso livello
 *   monsters: [{ cr, count }]          cr come etichetta ("1/2") o numero
 * Ritorna i totali, le soglie del party (tiers), il verdetto e l'XP per PG.
 */
export function computeEncounter({ rules = '2014', party = [], monsters = [] }) {
  const partySize = party.reduce((s, g) => s + cnt(g.count), 0);
  const monsterCount = monsters.reduce((s, m) => s + cnt(m.count), 0);
  const baseXP = monsters.reduce((s, m) => s + xpForCR(crToNum(m.cr)) * cnt(m.count), 0);
  const is2024 = rules === '2024';

  // Soglie del party: somma per gruppo (soglia del livello × n. PG).
  const table = is2024 ? BUDGET_2024 : THRESHOLDS_2014;
  const keys = is2024 ? TIERS_2024 : TIERS_2014;
  const sums = keys.map((_, i) => party.reduce((s, g) => s + table[lvl(g.level)][i] * cnt(g.count), 0));
  const tiers = keys.map((key, i) => ({ key, xp: sums[i] }));

  // DMG 2014: per il moltiplicatore NON si contano i mostri con CR molto
  // inferiore alla media degli altri (a meno che pesino davvero). Il DMG non
  // quantifica "molto": lo traduciamo in "meno di 1/5 dei PE medi degli altri
  // mostri". Senza questa regola un CR 1/8 accanto a un Ogre faceva scattare
  // ×1.5 → ×2 da solo. I loro PE restano comunque nel totale.
  let countedForMult = monsterCount;
  if (!is2024 && monsterCount > 1) {
    countedForMult = monsters.reduce((s, m) => {
      const n = cnt(m.count);
      if (!n) return s;
      const xp = xpForCR(crToNum(m.cr));
      const avgOthers = (baseXP - xp) / (monsterCount - 1);
      return s + (xp >= avgOthers * WEAK_FRACTION ? n : 0);
    }, 0);
    countedForMult = Math.max(1, countedForMult);
  }
  const multiplier = is2024 ? 1 : multiplier2014(countedForMult, partySize);
  const adjustedXP = Math.round(baseXP * multiplier);

  let difficulty;
  if (!monsterCount || !partySize) difficulty = 'none';
  else if (is2024) {
    // Il budget 2024 è quanto bisogna SPENDERE per ottenere quella difficoltà,
    // quindi è una soglia da RAGGIUNGERE (come nel 2014): 2000 PE col budget
    // Basso a 2000 = Bassa; per Moderata servono i PE del budget Moderato.
    // (Trattarlo come un tetto faceva scattare Moderata con +25 PE.)
    difficulty = adjustedXP >= sums[2] ? 'high' : adjustedXP >= sums[1] ? 'moderate' : adjustedXP >= sums[0] ? 'low' : 'under';
  } else {
    // Le soglie 2014 sono un MINIMO: raggiungi "difficile" = difficile, ecc.
    difficulty = adjustedXP >= sums[3] ? 'deadly' : adjustedXP >= sums[2] ? 'hard' : adjustedXP >= sums[1] ? 'medium' : adjustedXP >= sums[0] ? 'easy' : 'trivial';
  }

  // Sforamento del livello massimo (2014 Letale, 2024 Alta), in %: utile
  // per avvisare "oltre il budget Alto del 40%". 0 se non sforato.
  const topXP = sums[sums.length - 1];
  const overTopPct = topXP > 0 && adjustedXP > topXP ? Math.round((adjustedXP / topXP - 1) * 100) : 0;

  return {
    rules: is2024 ? '2024' : '2014', partySize, monsterCount,
    ignoredForMult: is2024 ? 0 : monsterCount - countedForMult,
    baseXP, multiplier, adjustedXP, tiers, difficulty, overTopPct,
    perPC: partySize ? Math.floor(baseXP / partySize) : 0,
  };
}

// Ordine di gravità dei verdetti, per confrontarli.
const RANK = { none: -1, trivial: 0, easy: 1, medium: 2, hard: 3, deadly: 4, under: 0, low: 1, moderate: 2, high: 3 };
export const difficultyRank = (d) => RANK[d] ?? -1;

/**
 * "Che mostro aggiungo per arrivare a `target`?" — prova ad aggiungere UN
 * mostro di ogni CR (dal più basso) e restituisce il primo che porta lo
 * scontro almeno a quel livello. Nel 2014 tiene conto che il moltiplicatore
 * sale con un mostro in più. `overshoot` = il salto supera il bersaglio.
 */
export function suggestAddition(input, target) {
  const want = difficultyRank(target);
  for (const row of DMG_TABLE) {
    if (row.cr === 0) continue;
    const enc = computeEncounter({ ...input, monsters: [...(input.monsters || []), { cr: row.cr, count: 1 }] });
    const got = difficultyRank(enc.difficulty);
    if (got >= want) return { cr: row.cr, label: row.label, xp: row.xp, result: enc.difficulty, overshoot: got > want };
  }
  return null;
}

/** Il livello successivo al verdetto attuale (per il suggerimento), o null. */
export function nextTier(enc) {
  const order = enc.rules === '2024' ? ['low', 'moderate', 'high'] : ['easy', 'medium', 'hard', 'deadly'];
  if (enc.difficulty === 'none') return null;
  const r = difficultyRank(enc.difficulty);
  return order.find(k => difficultyRank(k) > r) || null;
}

// ============================================================
// SIMULAZIONE A DUE LATI (valore atteso, round per round).
//
// Ogni round ciascun lato infligge il suo danno atteso = danno grezzo ×
// probabilità di colpire la CA media avversaria (stesso hitChance del
// calcolatore DPR, col cap 5%-95%). Il danno di un lato CALA in proporzione
// ai PF che gli restano (logoramento: chi cade smette di colpire). I danni
// dei due lati si applicano insieme (l'iniziativa non è nota). Un lato è
// fuori combattimento sotto il 5% dei PF iniziali: senza questa soglia uno
// scontro alla pari tenderebbe a zero senza mai finire.
// ============================================================

const DEFEAT_FRACTION = 0.05;
const MAX_ROUNDS = 30;
const clampLvl = (l) => Math.max(1, Math.min(20, Math.round(Number(l) || 1)));
const given = (v) => String(v ?? '').trim() !== '' && Number.isFinite(Number(v));

/**
 * Stime generiche per un PG quando un campo è vuoto. NON sono regole
 * ufficiali: medie ragionevoli per un party misto (classe a d8 con COS +2,
 * caratteristica d'attacco +3/+4/+5, una CA che sale col livello, danno
 * grezzo che cresce con attacchi extra e trucchetti). La UI le marca "~".
 */
export function pcEstimates(level) {
  const L = clampLvl(level);
  const prof = 2 + Math.floor((L - 1) / 4);
  const abil = L >= 8 ? 5 : L >= 4 ? 4 : 3;
  return { hp: 10 + 7 * (L - 1), ac: 14 + Math.floor(L / 5), atk: prof + abil, dpr: 4 + 3 * L };
}

/** Medie del DMG (tabella dei CR) per un mostro del CR dato. */
export function monsterEstimates(cr) {
  const row = DMG_TABLE.find(r => r.cr === crToNum(cr)) || DMG_TABLE[1];
  return {
    hp: Math.round((row.hpMin + row.hpMax) / 2), ac: row.ac, atk: row.atk,
    dpr: Math.round(((row.dprMin + row.dprMax) / 2) * 10) / 10,
  };
}

function resolve(entry, est) {
  const out = { est: {} };
  for (const k of ['hp', 'ac', 'atk', 'dpr']) {
    out[k] = given(entry[k]) ? Number(entry[k]) : est[k];
    out.est[k] = !given(entry[k]);
  }
  out.n = Math.max(0, Math.round(Number(entry.count) || 0));
  return out;
}
export const resolvePC = (pc) => resolve(pc, pcEstimates(pc.level));
export const resolveMonster = (m) => resolve(m, monsterEstimates(m.cr));

/**
 * Ritorna null se manca un lato; altrimenti esito, round, % di PF persi dal
 * party, danni attesi per round e percentuali di colpo, verdetto.
 */
export function simulateCombat({ party = [], monsters = [] }) {
  const P = party.map(resolvePC).filter(x => x.n > 0 && x.hp > 0);
  const M = monsters.map(resolveMonster).filter(x => x.n > 0 && x.hp > 0);
  if (!P.length || !M.length) return null;

  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const partyHP0 = sum(P, x => x.hp * x.n);
  const monsterHP0 = sum(M, x => x.hp * x.n);
  // Bersagli: i mostri colpiscono i PG (CA media per numero); il party passa
  // più tempo sui mostri con più PF (CA media pesata sui PF).
  const partyAC = sum(P, x => x.ac * x.n) / sum(P, x => x.n);
  const monsterAC = sum(M, x => x.ac * x.hp * x.n) / monsterHP0;

  const partyRaw = sum(P, x => x.dpr * x.n);
  const monsterRaw = sum(M, x => x.dpr * x.n);
  const partyEff = sum(P, x => x.dpr * hitChance(monsterAC, x.atk) * x.n);
  const monsterEff = sum(M, x => x.dpr * hitChance(partyAC, x.atk) * x.n);

  let pHP = partyHP0;
  let mHP = monsterHP0;
  let rounds = 0;
  const pOut = () => pHP <= partyHP0 * DEFEAT_FRACTION;
  const mOut = () => mHP <= monsterHP0 * DEFEAT_FRACTION;
  while (rounds < MAX_ROUNDS && !pOut() && !mOut()) {
    rounds += 1;
    const toMonsters = partyEff * (pHP / partyHP0);
    const toParty = monsterEff * (mHP / monsterHP0);
    mHP -= toMonsters;
    pHP -= toParty;
  }
  const winner = pOut() && mOut() ? 'both' : mOut() ? 'party' : pOut() ? 'monsters' : 'stall';
  const lostPct = Math.min(100, Math.round((1 - Math.max(0, pHP) / partyHP0) * 100));

  let verdict;
  if (winner === 'monsters' || winner === 'both') verdict = 'tpk';
  else if (winner === 'stall') verdict = 'stall';
  else verdict = lostPct < 20 ? 'smooth' : lostPct < 40 ? 'fair' : lostPct < 65 ? 'tough' : 'brutal';

  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    winner, rounds, lostPct, verdict,
    partyHP0, monsterHP0, partyAC: r1(partyAC), monsterAC: r1(monsterAC),
    partyEff: r1(partyEff), monsterEff: r1(monsterEff),
    partyHitPct: partyRaw ? Math.round((partyEff / partyRaw) * 100) : 0,
    monsterHitPct: monsterRaw ? Math.round((monsterEff / monsterRaw) * 100) : 0,
    estimated: [...P, ...M].some(x => Object.values(x.est).some(Boolean)),
  };
}
