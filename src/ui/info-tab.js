// ============================================================
// Tab "Info" (Fase 8) — mini-guida all'uso + preset di macro utili
// da copiare con un click. Contenuti nel dizionario i18n (IT/EN).
// ============================================================
import { MACRO_PRESETS } from '../data/macro-presets.js';
import importerMacro from '../foundry/import-actor.macro.js?raw';
import { t } from '../i18n.js';

function presetCard(p) {
  return `
  <div class="preset-card">
    <div class="preset-head">
      <strong>${p.icon} ${t('mp_' + p.id)}</strong>
      <button type="button" class="secondary small" data-copy-preset="${p.id}">📋 ${t('info_copy')}</button>
    </div>
    <p class="hint">${t('mp_' + p.id + '_desc')}</p>
  </div>`;
}

export function initInfoTab() {
  const box = document.getElementById('info-body');
  box.innerHTML = `
    <div class="info-col">
      <h2>${t('info_how_title')}</h2>
      <div class="info-text">${t('info_how_html')}</div>
      <h2>${t('info_tips_title')}</h2>
      <div class="info-text">${t('info_tips_html')}</div>
      <p class="info-bye">${t('info_bye')}</p>
    </div>
    <div class="info-col">
      <h2>${t('info_macros_title')}</h2>
      <p class="hint">${t('info_macros_hint')}</p>
      <div class="preset-card">
        <div class="preset-head">
          <strong>📥 ${t('mp_importer')}</strong>
          <button type="button" class="secondary small" data-copy-preset="importer">📋 ${t('info_copy')}</button>
        </div>
        <p class="hint">${t('mp_importer_desc')}</p>
      </div>
      ${MACRO_PRESETS.map(presetCard).join('')}
    </div>`;

  box.addEventListener('click', async (ev) => {
    const id = ev.target.dataset.copyPreset;
    if (!id) return;
    const code = id === 'importer' ? importerMacro : MACRO_PRESETS.find(p => p.id === id)?.code;
    if (!code) return;
    const btn = ev.target;
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = t('copied');
    } catch {
      btn.textContent = t('clip_denied');
    }
    setTimeout(() => { btn.textContent = '📋 ' + t('info_copy'); }, 1800);
  });
}
