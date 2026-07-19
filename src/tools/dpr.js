// ============================================================
// Calcolatore DPR (Damage Per Round) — Fase 6, prima tab-strumento.
//
// Modulo PURO e testabile: nessun DOM qui, solo matematica. La UI sta in
// ui/dpr-tab.js. Migliora il calcolatore di riferimento dell'utente con:
//  - modellazione del CRITICO (20 naturale: i dadi raddoppiano);
//  - cap corretto della probabilità (nat 1 manca sempre → max 95%,
//    nat 20 colpisce sempre → min 5%);
//  - lettura degli attacchi direttamente dal mostro in costruzione.
// ============================================================

/**
 * Media dei dadi + eventuale bonus fisso di un'espressione di danno.
 * Accetta "2d8 + 1d6 + 3", "1d10 - 1", ecc. I termini di TIPO (piercing…)
 * e i riferimenti @mod/@prof vanno risolti PRIMA (li ignoriamo qui).
 * Ritorna { diceAvg, flat }: il critico raddoppia solo diceAvg, non flat.
 */
export function parseDamageExpr(input) {
  const s = String(input ?? '').replace(/[−–—]/g, '-');
  let diceAvg = 0;
  // Termini NdM col loro segno.
  for (const m of s.matchAll(/([+-]?)\s*(\d+)\s*d\s*(\d+)/gi)) {
    const sign = m[1] === '-' ? -1 : 1;
    diceAvg += sign * Number(m[2]) * (Number(m[3]) + 1) / 2;
  }
  // Numeri "sciolti" (bonus fisso): togliamo prima i termini coi dadi.
  let flat = 0;
  const rest = s.replace(/[+-]?\s*\d+\s*d\s*\d+/gi, ' ');
  for (const m of rest.matchAll(/([+-]?)\s*(\d+(?:\.\d+)?)/g)) {
    const sign = m[1] === '-' ? -1 : 1;
    flat += sign * Number(m[2]);
  }
  return { diceAvg, flat };
}

/**
 * Probabilità di colpire con un d20: servono facce ≥ (CA − bonus).
 * Il 20 naturale colpisce sempre (min 5%), il 1 naturale manca sempre
 * (max 95%). Questo è il cap che il calcolatore di riferimento non aveva.
 */
export function hitChance(ac, atkBonus) {
  const raw = (21 - (Number(ac) - Number(atkBonus))) / 20;
  return Math.max(0.05, Math.min(0.95, raw));
}

/**
 * DPR di un singolo attacco (già scomposto in dadi/flat).
 * critChance default 0.05 (solo il 20); si può alzare per range di crit
 * ampliati (es. 19-20 → 0.10). Sul crit si aggiungono i dadi extra.
 *   DPR = colpi × [ P(hit)·(diceAvg+flat) + P(crit)·diceAvg ] × numero
 */
export function attackDPR({ diceAvg, flat = 0, atkBonus = 0, count = 1, ac, critChance = 0.05 }) {
  const pHit = hitChance(ac, atkBonus);
  const perHit = pHit * (diceAvg + flat) + critChance * diceAvg;
  return perHit * (Number(count) || 1);
}

/**
 * DPR di un'azione a TIRO SALVEZZA (soffi, aure): niente tiro per colpire,
 * ma il bersaglio dimezza col successo. Serve il bonus TS del bersaglio.
 *   contributo = (diceAvg+flat) × [ P(fail) + (half ? 0.5 : 0)·P(success) ]
 */
export function saveDPR({ diceAvg, flat = 0, dc, targetSaveBonus = 0, half = true, count = 1 }) {
  // P(fallire) = facce < (DC − bonus), con 20 naturale che di norma passa.
  const pSuccess = Math.max(0.05, Math.min(0.95, (21 - (Number(dc) - Number(targetSaveBonus))) / 20));
  const pFail = 1 - pSuccess;
  const avg = diceAvg + flat;
  return avg * (pFail + (half ? 0.5 : 0) * pSuccess) * (Number(count) || 1);
}

/** Somma il DPR di una lista di righe attacco per una data CA. */
export function totalDPR(rows, ac) {
  return rows.reduce((sum, r) => {
    const { diceAvg, flat } = parseDamageExpr(r.dice);
    if (r.type === 'save') {
      return sum + saveDPR({ diceAvg, flat: flat + (Number(r.flat) || 0), dc: r.atkBonus, targetSaveBonus: Number(r.targetSave) || 0, half: r.half !== false, count: r.count });
    }
    // critChance: 0 è un valore valido (crit disattivati) → non usare "|| default".
    const cc = r.critChance != null && r.critChance !== '' ? Number(r.critChance) : 0.05;
    return sum + attackDPR({ diceAvg, flat: flat + (Number(r.flat) || 0), atkBonus: Number(r.atkBonus) || 0, count: r.count, ac, critChance: cc });
  }, 0);
}

/** Curva DPR vs CA (per il grafico): [{ac, dpr}] da acMin a acMax. */
export function dprCurve(rows, acMin = 8, acMax = 25) {
  const out = [];
  for (let ac = acMin; ac <= acMax; ac++) out.push({ ac, dpr: totalDPR(rows, ac) });
  return out;
}

// ---------- Lettura dal mostro in costruzione ----------

const profFromCR = (cr) => Math.max(2, 2 + Math.floor((Math.max(cr, 1) - 1) / 4));
function crToNum(cr) {
  const s = String(cr ?? '0');
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : 0; }
  return Number(s) || 0;
}
const abilityMod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
// Risolve @mod/@prof coi valori numerici; i tipi di danno restano ma
// parseDamageExpr li ignora (guarda solo dadi e numeri).
const resolveRefs = (dmg, mod, prof) =>
  String(dmg ?? '').replace(/@mod\b/gi, String(mod)).replace(/@prof\b/gi, String(prof));

/**
 * Costruisce le righe DPR dagli item del mostro (output di readForm()).
 * Il bonus d'attacco di un mostro = mod caratteristica + bonus competenza
 * (dedotto dal CR), come lo calcola Foundry per le armi naturali competenti.
 * Il conteggio parte da 1: il multiattacco (es. "fa tre attacchi") lo regoli
 * tu, perché sta nella descrizione dell'azione Multiattacco, non nell'item.
 */
export function attacksFromMonster(data) {
  const prof = profFromCR(crToNum(data.cr));
  const rows = [];
  for (const it of data.items || []) {
    if (it.kind === 'attack' && it.damage) {
      const mod = abilityMod(data[it.ability || 'str']);
      rows.push({
        name: it.name || 'Attacco', type: 'attack',
        dice: resolveRefs(it.damage, mod, prof), flat: 0,
        atkBonus: mod + prof, count: 1,
      });
    } else if (it.kind === 'save' && it.damage) {
      const mod = abilityMod(data[it.saveAbility || 'con']);
      rows.push({
        name: it.name || 'TS', type: 'save',
        dice: resolveRefs(it.damage, mod, prof), flat: 0,
        atkBonus: Number(it.dc) || 10, // per i save qui "atkBonus" è la CD
        half: it.onSave === 'half', targetSave: 0, count: 1,
      });
    }
  }
  return rows;
}
