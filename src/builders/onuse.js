// ============================================================
// On-Use Macros di Midi-QOL (flags['midi-qol'].onUseMacroName).
//
// Formato osservato nei golden:
//   Fireball: "[postDamageRoll]function.game.gps.fireball,[preActiveEffects]function.game.gps.fireball"
//   Power Word Stun: "[postPreambleComplete]function.game.gps.powerWordStun"
// → voci "[timing]nomeMacro" separate da virgola. Il nome può essere:
//   - il nome di una macro del mondo ("La Mia Macro")
//   - "ItemMacro" (la macro DIME embedded nell'item)
//   - "function.percorso.funzione" (una funzione globale)
// ============================================================

// Timing di Midi-QOL (id tecnici; i tre marcati ✓ sono osservati nei golden).
export const ONUSE_TIMINGS = [
  'preTargeting', 'preItemRoll', 'postPreambleComplete', 'templatePlaced',
  'preAttackRoll', 'postAttackRoll', 'preCheckHits',
  'preDamageRoll', 'postDamageRoll', 'damageBonus',
  'preCheckSaves', 'postCheckSaves',
  'preDamageApplication', 'preActiveEffects', 'postActiveEffects',
];

/** Riga vuota per la UI. */
export const newOnUseRow = () => ({ timing: 'postActiveEffects', macro: '' });

/**
 * Converte le righe della UI nella stringa onUseMacroName.
 * Ritorna '' se non c'è nessuna riga completa.
 */
export function buildOnUseMacroName(rows) {
  return (rows || [])
    .filter(r => ONUSE_TIMINGS.includes(r.timing) && String(r.macro || '').trim())
    .map(r => `[${r.timing}]${String(r.macro).trim()}`)
    .join(',');
}

/**
 * Applica all'item i flag EXTRA opzionali (A-A + On-Use), in un punto solo.
 * Usata da buildItem (azioni dei mostri), buildStandaloneItem e buildSpell.
 */
export function applyOnUseFlag(item, d) {
  const s = buildOnUseMacroName(d.onUse);
  if (!s) return;
  item.flags = { ...item.flags, 'midi-qol': { ...(item.flags?.['midi-qol'] || {}), onUseMacroName: s } };
}
