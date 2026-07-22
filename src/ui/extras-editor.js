// ============================================================
// Blocco "Extra" — UN SOLO menù a scomparsa che raggruppa le tre
// sezioni opzionali (richiesta utente: vista pulita, l'opzionale non
// deve spaventare): Effetti DAE → On-Use Macros (Midi) → Animazione
// A-A (ultima perché è la più ingombrante).
// Il riepilogo nel titolo (badge verdi) dice a colpo d'occhio se
// qualcosa è configurato anche a blocco chiuso.
// ============================================================
import { effectsSectionHtml } from './effects-editor.js';
import { onUseSectionHtml } from './onuse-editor.js';
import { aaSectionHtml } from './aa-editor.js';
import { t } from '../i18n.js';

export function extrasSectionHtml(item, forcePassive) {
  const nEff = (item.effects || []).length;
  const nOu = (item.onUse || []).length;
  const aaOn = Boolean(item.aa?.enabled && item.aa?.path);
  const badges = [];
  if (nEff) badges.push(`DAE×${nEff}`);
  if (nOu) badges.push(`Midi×${nOu}`);
  if (aaOn) badges.push('A-A●');
  return `
  <details class="extra-block" data-open="_openExtra" ${item._openExtra ? 'open' : ''}>
    <summary>🧰 ${t('xt_legend')}${badges.length ? ` <em>${badges.join(' · ')}</em>` : ''}</summary>
    <div class="extra-body">
      ${effectsSectionHtml(item, forcePassive)}
      ${onUseSectionHtml(item)}
      ${aaSectionHtml(item)}
    </div>
  </details>`;
}
