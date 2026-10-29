// ============================================================
// Mobile — comportamenti che il solo CSS non può dare.
//
// Su telefono (≤ 760px) le tab diventano una barra in basso e, nelle tab
// con un form (Mostro, Oggetto, Incantesimo), la colonna di destra
// (anteprima JSON + comandi + CR) non sta più IN FONDO a 4000px di form:
// diventa un "foglio" a tutto schermo che si apre da una barra fissa con
// lo stato (✓ / ⚠, CR stimato) e il pulsante Esporta sempre a portata di
// pollice. Su desktop non cambia nulla: barra e intestazione del foglio
// sono nascoste dal CSS.
//
// Inoltre: le sezioni del form Mostro si possono chiudere toccando il
// titolo (anche su desktop); su telefono, alla prima visita, quelle meno
// usate partono chiuse. Lo stato è ricordato in localStorage.
// ============================================================
import { t } from '../i18n.js';

const MQ = '(max-width: 760px)';       // telefono: tab in basso, sezioni chiuse
const MQ_SHEET = '(max-width: 980px)'; // telefono + tablet: barra azioni e foglio
const FOLD_KEY = 'tafys-forge-fold';
// Sezioni chiuse di default su telefono (chiave = data-i18n della legend).
const FOLD_MOBILE_DEFAULT = ['sk_legend', 'tr_legend', 'leg_legend', 'img_legend', 'bio_legend'];

const isMobile = () => typeof matchMedia === 'function' && matchMedia(MQ).matches;

function loadFold() {
  try { return JSON.parse(localStorage.getItem(FOLD_KEY) || 'null'); } catch { return null; }
}
function saveFold(state) {
  try { localStorage.setItem(FOLD_KEY, JSON.stringify(state)); } catch { /* storage off */ }
}

/** Sezioni richiudibili del form Mostro. */
function initFolding() {
  const sets = [...document.querySelectorAll('#npc-form > fieldset')];
  const stored = loadFold();
  const state = stored ?? {};
  for (const fs of sets) {
    const legend = fs.querySelector(':scope > legend');
    const key = legend?.querySelector('[data-i18n]')?.dataset.i18n ?? legend?.dataset.i18n;
    if (!legend || !key) continue;
    legend.classList.add('fold-toggle');
    legend.tabIndex = 0;
    legend.setAttribute('role', 'button');
    legend.title = t('m_fold');
    const closed = key in state ? state[key] : (!stored && isMobile() && FOLD_MOBILE_DEFAULT.includes(key));
    const apply = (c) => { fs.classList.toggle('folded', c); legend.setAttribute('aria-expanded', String(!c)); };
    apply(closed);
    const toggle = (ev) => {
      if (ev.target.closest('input, select, button, a, textarea')) return;
      const c = !fs.classList.contains('folded');
      apply(c);
      state[key] = c;
      saveFold(state);
    };
    legend.addEventListener('click', toggle);
    legend.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(ev); }
    });
  }
}

/** Stato sintetico dell'anteprima: validazione, CR, avvisi. */
function readStatus(aside) {
  const val = aside.querySelector('.val');
  const state = !val || !val.textContent.trim() ? ''
    : val.classList.contains('has-error') ? 'err'
    : val.classList.contains('has-warn') ? 'warn'
    : val.classList.contains('ok') ? 'ok' : '';
  const cr = aside.querySelector('.cr-est')?.textContent.trim() ?? '';
  const warn = [...aside.querySelectorAll('#warnings, #item-warn, #spell-warn')]
    .map((el) => el.textContent.trim()).filter(Boolean).join(' · ');
  return { state, cr, warn };
}

/** Barra fissa + foglio anteprima per una tab con form e aside. */
function initSheet(section) {
  const aside = section.querySelector(':scope > aside');
  const exportBtn = aside?.querySelector('.main-actions > button:not(.secondary)');
  if (!aside || !exportBtn) return;

  // Intestazione del foglio (visibile solo su telefono, quando è aperto).
  const head = document.createElement('div');
  head.className = 'm-sheet-head';
  head.innerHTML = `<strong>${t('m_sheet')}</strong><button type="button" class="secondary m-close" aria-label="${t('m_close')}">✕</button>`;
  aside.prepend(head);

  const bar = document.createElement('div');
  bar.className = 'm-bar';
  bar.innerHTML = `
    <button type="button" class="secondary m-open" aria-haspopup="dialog">
      <span class="m-open-label">📄 ${t('m_sheet')}</span>
      <span class="m-status"></span>
    </button>
    <button type="button" class="m-export">${t('m_export')}</button>
    <span class="m-msg" role="status"></span>`;
  section.append(bar);

  const status = bar.querySelector('.m-status');
  const msg = bar.querySelector('.m-msg');
  const update = () => {
    const s = readStatus(aside);
    const parts = [];
    if (s.cr) parts.push(`CR ${s.cr}`);
    if (s.state === 'ok') parts.push('✓');
    else if (s.state === 'warn') parts.push('⚠');
    else if (s.state === 'err') parts.push('✖');
    status.textContent = parts.join(' · ');
    status.dataset.state = s.state;
    msg.textContent = s.warn;
    bar.classList.toggle('has-msg', !!s.warn);
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }).observe(aside, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  update();

  // Apertura/chiusura. Il tasto "indietro" del telefono chiude il foglio
  // invece di lasciare la pagina (una voce nella cronologia).
  const isOpen = () => section.classList.contains('sheet-open');
  const setOpen = (open) => {
    section.classList.toggle('sheet-open', open);
    document.documentElement.classList.toggle('sheet-lock', open);
    if (open) aside.scrollTop = 0;
  };
  const open = () => {
    if (isOpen()) return;
    setOpen(true);
    try { history.pushState({ tfxSheet: section.id }, ''); } catch { /* ok */ }
  };
  const close = () => {
    if (!isOpen()) return;
    if (history.state?.tfxSheet === section.id) history.back(); // → popstate chiude
    else setOpen(false);
  };
  window.addEventListener('popstate', () => { if (isOpen()) setOpen(false); });
  bar.querySelector('.m-open').addEventListener('click', open);
  head.querySelector('.m-close').addEventListener('click', close);
  bar.querySelector('.m-export').addEventListener('click', () => exportBtn.click());
  // Se si torna a desktop col foglio aperto (rotazione/ridimensionamento).
  matchMedia(MQ_SHEET).addEventListener?.('change', (e) => { if (!e.matches && isOpen()) close(); });
  return { close, isOpen };
}

/**
 * Su telefono la tastiera virtuale riduce lo schermo: barre fisse in basso
 * coprirebbero il campo che si sta scrivendo → le nascondiamo mentre la
 * tastiera è APERTA. Non basta "un campo ha il focus": su Android chiudere
 * la tastiera col tasto indietro lascia il focus nel campo e le barre
 * resterebbero sparite. Misuriamo l'area visibile (visualViewport): se è
 * molto più bassa del massimo visto a questa larghezza, c'è la tastiera.
 */
function initKeyboardGuard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const editable = (el) => el?.matches?.('textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button])');
  let width = vv.width;
  let base = vv.height;
  const check = () => {
    if (Math.abs(vv.width - width) > 1) { width = vv.width; base = vv.height; } // rotazione
    base = Math.max(base, vv.height);
    const keyboard = vv.height < base * 0.75 && editable(document.activeElement);
    document.documentElement.classList.toggle('typing', keyboard);
  };
  vv.addEventListener('resize', check);
  document.addEventListener('focusin', () => setTimeout(check, 50));
  document.addEventListener('focusout', () => setTimeout(check, 50));
}

export function initMobile() {
  if (typeof document === 'undefined') return;
  initFolding();
  const sheets = [...document.querySelectorAll('.tab-panel.npc-grid')].map(initSheet).filter(Boolean);
  initKeyboardGuard();
  // Cambio tab con la barra in basso: si riparte dall'alto della nuova tab
  // e un eventuale foglio aperto si chiude.
  document.getElementById('tabs')?.addEventListener('click', (ev) => {
    if (!ev.target.closest('.tab') || !matchMedia(MQ_SHEET).matches) return;
    for (const s of sheets) s.close();
    window.scrollTo({ top: 0 });
  });
}
