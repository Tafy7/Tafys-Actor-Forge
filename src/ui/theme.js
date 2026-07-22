// ============================================================
// Selettore di tema (Fase design). I temi sono puri override di
// variabili CSS su html[data-theme]: cambiare tema = scambiare
// l'attributo, nessun reload. La scelta è persistita in localStorage
// e applicata PRIMA del paint da uno script inline in <head> (niente
// flash del tema di default).
// ============================================================
import { t } from '../i18n.js';

const THEME_KEY = 'tafys-forge-theme';
export const THEMES = ['taf', 'avernus', 'spelljammer', 'barovia', 'parchment', 'contrast'];

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
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage off */ }
}

/** Popola il <select> nell'header e collega il cambio tema. */
export function initThemePicker() {
  const sel = document.getElementById('theme-picker');
  if (!sel) return;
  const cur = currentTheme();
  sel.innerHTML = THEMES
    .map(th => `<option value="${th}" ${th === cur ? 'selected' : ''}>${t('theme_' + th)}</option>`)
    .join('');
  sel.addEventListener('change', () => applyTheme(sel.value));
}
