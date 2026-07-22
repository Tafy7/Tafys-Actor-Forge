// ============================================================
// Sezione "On-Use Macros (Midi-QOL)" — condivisa tra le tab e le card
// azione dei mostri, stesso pattern di effects-editor/aa-editor.
// A scomparsa (details): visibile solo se l'utente la apre.
// Righe [timing][nome macro] → flags['midi-qol'].onUseMacroName.
// ============================================================
import { ONUSE_TIMINGS, newOnUseRow } from '../builders/onuse.js';
import { t } from '../i18n.js';

const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function rowHtml(r, i) {
  return `
  <div class="onuse-row" data-ouidx="${i}">
    <select data-ou="timing">${ONUSE_TIMINGS.map(x => `<option value="${x}" ${x === r.timing ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <input type="text" data-ou="macro" value="${esc(r.macro)}" placeholder="${t('ou_macro_ph')}" title="${t('ou_macro_title')}" />
    <button type="button" class="remove" data-ou-remove="${i}" title="${t('ou_remove')}">✖</button>
  </div>`;
}

/** Sezione completa (a scomparsa). `item.onUse` = array di righe. */
export function onUseSectionHtml(item) {
  const rows = item.onUse || [];
  return `
  <details class="opt-block" data-open="_openOnUse" ${item._openOnUse ? 'open' : ''}>
    <summary>🎯 ${t('ou_legend')}${rows.length ? ` <em>(${rows.length})</em>` : ''} <span class="hint">${t('ou_legend_hint')}</span></summary>
    <div class="onuse-body">
      ${rows.map(rowHtml).join('')}
      <button type="button" class="secondary small" data-ou-add>${t('ou_add')}</button>
      <p class="hint">${t('ou_note')}</p>
    </div>
  </details>`;
}

/**
 * Gestore CONDIVISO (input + click). `item.onUse` array. Ritorna
 * { handled, structural } come gli altri editor condivisi.
 */
export function applyOnUseEvent(item, ev) {
  const ds = ev.target.dataset;
  if ('ouAdd' in ds) {
    item.onUse = item.onUse || [];
    item.onUse.push(newOnUseRow());
    return { handled: true, structural: true };
  }
  if ('ouRemove' in ds) {
    item.onUse.splice(Number(ds.ouRemove), 1);
    return { handled: true, structural: true };
  }
  if (ds.ou) {
    const row = item.onUse[Number(ev.target.closest('[data-ouidx]').dataset.ouidx)];
    if (row) row[ds.ou] = ev.target.value;
    return { handled: true, structural: false };
  }
  return { handled: false, structural: false };
}
