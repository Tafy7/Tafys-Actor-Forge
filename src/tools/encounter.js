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

  const multiplier = is2024 ? 1 : multiplier2014(monsterCount, partySize);
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
