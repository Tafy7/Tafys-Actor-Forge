// ============================================================
// Selettore di tema. I temi "classici" sono puri override di variabili
// CSS su html[data-theme]. Il NUOVO DESIGN ("Studio", in due varianti)
// cambia anche forme, spazi e disposizione: oltre a data-theme mette
// html[data-design="studio"], a cui è agganciato styles-studio.css.
// Cambiare tema = scambiare due attributi, nessun reload. La scelta è
// persistita in localStorage e applicata PRIMA del paint da uno script
// inline in <head> (niente flash del tema di default).
// ============================================================
import { t } from '../i18n.js';

const THEME_KEY = 'tafys-forge-theme';
// Gruppi mostrati nel menu: [chiave i18n del gruppo, temi].
export const THEME_GROUPS = [
  ['theme_group_new', ['studio', 'studio-light']],
  ['theme_group_classic', ['taf', 'avernus', 'spelljammer', 'barovia', 'parchment', 'contrast']],
];
export const THEMES = THEME_GROUPS.flatMap(([, list]) => list);

/** Design (struttura) a cui appartiene un tema (colori). */
export const designOf = (theme) => (String(theme).startsWith('studio') ? 'studio' : 'classic');

// Migrazioni dei nomi storici: 'infernal' → 'taf', 'aurora' → 'spelljammer'.
function normalize(name) {
  if (name === 'infernal') return 'taf';
  if (name === 'aurora') return 'spelljammer';
  return THEMES.includes(name) ? name : 'taf';
}

function currentTheme() {
  try { return normalize(localStorage.getItem(THEME_KEY)); } catch { return 'taf'; }
}

export function applyTheme(name) {
  const theme = normalize(name);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.design = designOf(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage off */ }
  // Chi dispone gli elementi in base al design (es. l'indice delle sezioni) si aggiorna.
  document.dispatchEvent(new CustomEvent('forge:theme', { detail: { theme, design: designOf(theme) } }));
}

/** Popola il <select> nell'header e collega il cambio tema. */
export function initThemePicker() {
  const sel = document.getElementById('theme-picker');
  if (!sel) return;
  const cur = currentTheme();
  const opt = (th) => `<option value="${th}" ${th === cur ? 'selected' : ''}>${t('theme_' + th.replace(/-/g, '_'))}</option>`;
  sel.innerHTML = THEME_GROUPS
    .map(([label, list]) => `<optgroup label="${t(label)}">${list.map(opt).join('')}</optgroup>`)
    .join('');
  sel.addEventListener('change', () => applyTheme(sel.value));
}
