// ============================================================
// "Aggiungi alla scheda del mostro" (tab Oggetto e Incantesimo).
//
// L'oggetto o l'incantesimo che si sta creando entra tra le voci del mostro
// COSÌ COM'È (JSON completo, card di tipo 'raw'): niente doppio editor,
// niente campi persi. Dalla card del mostro lo si riapre qui ("Modifica
// nella tab…"): in quel caso la tab resta COLLEGATA a quella voce e il
// pulsante diventa "Aggiorna sulla scheda".
// ============================================================
import { t } from '../i18n.js';
import { esc } from '../utils/html.js';

/**
 * @param {object} o
 * @param {string} o.prefix             'item' | 'spell' (id dei pulsanti)
 * @param {()=>object} o.getItem        JSON corrente della tab
 * @param {()=>string[]} o.getWarnings  problemi che bloccano (come per la collezione)
 * @param {(doc, id)=>{id, updated, monster}} o.onAddToSheet
 * @param {()=>void} o.onLinkChange     il collegamento è cambiato (per salvare la bozza)
 */
export function initSheetLink(o) {
  const btn = document.getElementById(`${o.prefix}-sheet`);
  const warn = document.getElementById(`${o.prefix}-warn`);
  let linkId = null;
  const paint = () => { if (btn) btn.textContent = t(linkId ? 'sheet_update' : 'sheet_add'); };
  const api = {
    get: () => linkId,
    set: (id) => { linkId = id || null; paint(); },
  };
  if (!btn) return api;
  btn.addEventListener('click', () => {
    const w = o.getWarnings();
    if (w.length) { warn.textContent = '⛔ ' + w.join('  •  '); return; }
    const doc = o.getItem();
    const res = o.onAddToSheet(doc, linkId);
    // Resta collegata solo se stava già modificando una voce della scheda:
    // dopo un'aggiunta nuova si può subito creare la voce successiva.
    if (!res.updated && linkId) { linkId = null; o.onLinkChange?.(); }
    paint();
    const who = res.monster ? t('sheet_of', { name: esc(res.monster) }) : t('sheet_unnamed');
    warn.innerHTML = `${t(res.updated ? 'sheet_updated' : 'sheet_added', { name: esc(doc.name || '?'), who })} <button type="button" class="secondary small" data-goto-tab="npc">${t('sheet_goto')}</button>`;
  });
  warn?.addEventListener('click', (ev) => {
    const go = ev.target.closest('[data-goto-tab]');
    if (go) document.querySelector(`#tabs .tab[data-tab="${go.dataset.gotoTab}"]`)?.click();
  });
  paint();
  return api;
}
