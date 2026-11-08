// ============================================================
// Pannello "Ricarica da JSON" delle tab Item e Incantesimo (blocco 13).
//
// Stesso schema dell'import dei mostri: incolla o scegli un file, il
// JSON viene letto (documento singolo, array o file della macro
// Esporta), si prende il primo documento adatto alla tab e lo si passa
// a `onLoad`. Il resoconto dice cosa è stato caricato e cosa ricontrollare.
// Se il form contiene già qualcosa il pulsante chiede conferma (secondo clic).
// ============================================================
import { pickDocuments } from '../parsers/item-import.js';
import { t } from '../i18n.js';

/** Conferma "a secondo clic" (come nel resto del Forge), senza finestre. */
function armed(btn, label, action) {
  if (btn.dataset.armed) {
    clearTimeout(Number(btn.dataset.armed));
    delete btn.dataset.armed;
    btn.textContent = btn.dataset.label;
    btn.classList.remove('armed');
    action();
    return;
  }
  btn.dataset.label = btn.textContent;
  btn.textContent = label;
  btn.classList.add('armed');
  btn.dataset.armed = String(setTimeout(() => {
    delete btn.dataset.armed;
    btn.textContent = btn.dataset.label;
    btn.classList.remove('armed');
  }, 4000));
}

/**
 * @param {object} o
 * @param {string} o.prefix      id di base degli elementi ("item" → #item-import-input…)
 * @param {(d:object)=>boolean} o.accept   documenti adatti a questa tab
 * @param {(d:object)=>boolean} o.other    documenti dell'ALTRA tab (per suggerirla)
 * @param {string} o.noneKey / o.otherKey  chiavi i18n dei messaggi
 * @param {(doc:object)=>{data, source, report}} o.importFn
 * @param {(data, source)=>void} o.onLoad
 * @param {()=>boolean} o.hasData  il form contiene già qualcosa?
 */
export function initJsonReload(o) {
  const $ = (s) => document.getElementById(`${o.prefix}-${s}`);
  const input = $('import-input');
  const box = $('import-report');
  const show = (text) => { box.hidden = false; box.textContent = text; };

  const apply = (text) => {
    if (!String(text || '').trim()) return show(t('imp_paste_first'));
    let json;
    try { json = JSON.parse(text); } catch { return show(t('imp_bad_json')); }
    const { docs } = pickDocuments(json, o.accept);
    if (!docs.length) {
      const others = pickDocuments(json, o.other).docs.length;
      return show(others ? `${t(o.noneKey)}\n${t(o.otherKey)}` : t(o.noneKey));
    }
    const { data, source, report } = o.importFn(docs[0]);
    if (!data) return show(report.warn.join('\n'));
    if (docs.length > 1) report.warn.unshift(t('ii_many', { n: docs.length, name: docs[0].name }));
    o.onLoad(data, source);
    const lines = [`${t('imp_head_ok')} (${report.ok.length}):`, ...report.ok.map(r => `   ${r}`)];
    if (report.warn.length) lines.push('', `${t('imp_head_warn')} (${report.warn.length}):`, ...report.warn.map(r => `   ${r}`));
    lines.push('', t('imp_reminder'));
    show(lines.join('\n'));
  };

  $('import-btn').addEventListener('click', (ev) => {
    const run = () => apply(input.value);
    if (o.hasData() && input.value.trim()) armed(ev.currentTarget, t('imp_confirm_btn'), run);
    else run();
  });
  $('import-file-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      input.value = String(reader.result || '');
      apply(input.value);
    };
    reader.readAsText(file);
    ev.target.value = '';
  });
  return { armed };
}

/** HTML del pannello (stessi id usati da initJsonReload). */
export function jsonReloadHtml(prefix, summaryKey) {
  return `
  <details id="${prefix}-import-details" class="json-reload">
    <summary class="hint">${t(summaryKey)}</summary>
    <textarea id="${prefix}-import-input" rows="5" placeholder="${t('ii_placeholder')}"></textarea>
    <div class="row" style="margin-top:0.4rem">
      <button type="button" id="${prefix}-import-btn" class="secondary">${t('imp_analyze')}</button>
      <input type="file" id="${prefix}-import-file" accept=".json" hidden />
      <button type="button" id="${prefix}-import-file-btn" class="secondary">${t('imp_file')}</button>
    </div>
    <pre id="${prefix}-import-report" hidden></pre>
  </details>
  <div id="${prefix}-editing" class="reload-banner" hidden>
    <span class="reload-text"></span>
    <span class="reload-rebuilt" hidden>${t('ii_rebuilt')}</span>
    <button type="button" id="${prefix}-reset" class="secondary small">${t('ii_reset')}</button>
  </div>`;
}
