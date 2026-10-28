// ============================================================
// Cartellino "CR stimato" (Expected CR) — vive nel tab Mostro, sopra
// l'anteprima JSON. Si aggiorna a ogni modifica del form (chiamato da
// renderPreview in main.js). La matematica sta in tools/expected-cr.js
// (modulo puro, validato contro mostri a CR noto); qui solo DOM + testo.
//
// Il moltiplicatore di multiattacco è un input STATICO (non rigenerato),
// così non perde il focus mentre lo si digita; il suo valore entra nel
// calcolo del danno/round degli attacchi.
// ============================================================
import { computeMonsterCR, DMG_TABLE, crToNum } from '../tools/expected-cr.js';
import { t } from '../i18n.js';

const rowForCR = (crNum) => DMG_TABLE.findIndex(r => r.cr === crNum);

/** Collega l'input multiattacco: a ogni cambio ridisegna il cartellino. */
export function initCRReadout(getData) {
  const ma = document.getElementById('cr-multiattack');
  if (ma) ma.addEventListener('input', () => renderCR(getData()));
}

/** Calcola e disegna il cartellino per i dati correnti del form. */
export function renderCR(data) {
  const box = document.getElementById('cr-readout');
  if (!box) return;

  const maEl = document.getElementById('cr-multiattack');
  // Vuoto = auto (conta gli attacchi una volta ciascuno); un numero = attacchi/round.
  const attacksPerRound = Math.max(0, Number(maEl?.value) || 0);

  const hp = Number(data.hpMax) || 0;
  const r = computeMonsterCR(data, { attacksPerRound });
  // Mostra il default automatico (n. di armi) nel placeholder del campo.
  if (maEl && !maEl.value) maEl.placeholder = String(r.inputs.nAtk || 1);
  // Senza HP o senza alcun danno la stima non ha senso: messaggio neutro.
  if (hp <= 0 || (r.inputs.atkBonus == null && r.inputs.saveDC == null)) {
    box.innerHTML = `<p class="hint">${t('cr_nodata')}</p>`;
    return;
  }

  // Verdetto: confronto in RIGHE di tabella (il CR non è lineare).
  const estRow = r.row;
  const declRow = rowForCR(r.declaredCR);
  const diff = declRow >= 0 ? estRow - declRow : 0;
  let verdictKey = 'cr_inline', cls = 'ok';
  if (declRow >= 0 && diff >= 2) { verdictKey = 'cr_strong'; cls = 'strong'; }
  else if (declRow >= 0 && diff <= -2) { verdictKey = 'cr_weak'; cls = 'weak'; }

  // Nota HP effettivi (se le resistenze/immunità li hanno moltiplicati).
  let effNote = '';
  if (r.hpMult > 1) {
    const k = r.hasImm ? 'cr_effnote_imm' : 'cr_effnote_res';
    effNote = ` <span class="cr-sub">${t(k, { mult: r.hpMult })}</span>`;
  }

  // Suggerimento per rientrare nel CR dichiarato: solo se DAVVERO fuori scala
  // (±2 gradi o più), non quando è già "in linea".
  let suggest = '';
  if (declRow >= 0 && Math.abs(diff) >= 2) {
    const row = DMG_TABLE[declRow];
    suggest = `<div class="cr-suggest">${t('cr_suggest', { cr: r.declaredLabel })}
      <span>${t('cr_hint_hp', { lo: row.hpMin, hi: row.hpMax })}</span>
      <span>${t('cr_hint_dpr', { lo: row.dprMin, hi: row.dprMax })}</span>
      <span>${t('cr_hint_ac', { ac: row.ac })}</span>
    </div>`;
  }

  const atkInfo = r.inputs.attacks ? ` · ${r.inputs.attacks}×att` : '';
  const dprLabel = r.dprUsed === 'dc'
    ? `${r.inputs.dpr} · CD ${r.inputs.saveDC}`
    : `${r.inputs.dpr}${atkInfo}${r.inputs.atkBonus != null ? ` · +${r.inputs.atkBonus}` : ''}`;

  box.innerHTML = `
  <div class="cr-card cr-${cls}">
    <div class="cr-verdict">
      <div class="cr-big">
        <span class="cr-est">${r.label}</span>
        <span class="cr-vs">${t('cr_estimated')}</span>
      </div>
      <div class="cr-decl">
        <span class="cr-declval">${r.declaredLabel}</span>
        <span class="cr-vs">${t('cr_declared')}</span>
      </div>
      <div class="cr-tag">${t(verdictKey)}</div>
    </div>
    <div class="cr-stats">
      <span>${t('cr_defensive')}: <b>${r.defensive.label}</b></span>
      <span>${t('cr_offensive')}: <b>${r.offensive.label}</b></span>
      <span>${t('cr_effhp')}: <b>${r.effHP}</b>${effNote}</span>
      <span>${t('cr_dpr')}: <b>${dprLabel}</b></span>
      <span>${t('cr_xp')}: <b>${r.xp.toLocaleString()}</b></span>
    </div>
    ${suggest}
    ${r.legendary ? `<p class="cr-legendary">${t('cr_legendary')}</p>` : ''}
  </div>`;
}
