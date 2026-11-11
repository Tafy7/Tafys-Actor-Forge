// ============================================================
// Indice delle sezioni del form Mostro (nuovo design "Studio").
//
// Il form è lungo (dieci sezioni, migliaia di pixel): l'indice a sinistra
// porta alla sezione con un clic e mostra dove ci si trova mentre si
// scorre. Vive in tutti i temi ma si VEDE solo nel design Studio su
// schermi larghi (lo decide il CSS): nei temi classici non cambia nulla.
// Si può nascondere con il pulsante accanto al titolo.
// ============================================================
import { t } from '../i18n.js';

const NAV_KEY = 'tafys-forge-nav';

/** Testo del titolo di una sezione, senza il suggerimento tra parentesi. */
function titleOf(legend) {
  const main = legend.querySelector(':scope > [data-i18n]:not(.hint)') || legend;
  const clone = main.cloneNode(true);
  clone.querySelectorAll('.hint').forEach((h) => h.remove());
  return clone.textContent.trim();
}

export function initSectionNav() {
  const form = document.getElementById('npc-form');
  const panel = document.getElementById('tab-npc');
  if (!form || !panel) return;
  const sections = [...form.querySelectorAll(':scope > fieldset')].filter((fs) => fs.querySelector(':scope > legend'));
  if (!sections.length) return;

  const nav = document.createElement('nav');
  nav.className = 'section-nav';
  nav.setAttribute('aria-label', t('nav_sections'));
  const links = sections.map((fs, i) => {
    if (!fs.id) fs.id = `sec-${i + 1}`;
    const a = document.createElement('a');
    a.href = `#${fs.id}`;
    a.textContent = titleOf(fs.querySelector(':scope > legend'));
    return a;
  });
  const title = document.createElement('div');
  title.className = 'section-nav-title';
  const titleText = document.createElement('span');
  titleText.textContent = t('nav_sections');
  // L'indice si può nascondere: il form prende il suo spazio e resta solo
  // il pulsante per riaprirlo. La scelta è ricordata.
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'section-nav-toggle';
  toggle.setAttribute('aria-controls', 'section-nav');
  nav.id = 'section-nav';
  const applyNav = (off) => {
    document.documentElement.dataset.nav = off ? 'off' : 'on';
    toggle.textContent = off ? '☰' : '«';
    toggle.title = t(off ? 'nav_show' : 'nav_hide');
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-expanded', String(!off));
  };
  let navOff = false;
  try { navOff = localStorage.getItem(NAV_KEY) === 'off'; } catch { /* storage off */ }
  applyNav(navOff);
  toggle.addEventListener('click', () => {
    navOff = !navOff;
    applyNav(navOff);
    try { localStorage.setItem(NAV_KEY, navOff ? 'off' : 'on'); } catch { /* storage off */ }
  });
  title.append(titleText, toggle);
  nav.append(title, ...links);
  panel.insertBefore(nav, form);

  // Numero di azioni accanto alla voce giusta (si aggiorna da sé).
  const list = document.getElementById('items-list');
  const actionsLink = list ? links[sections.indexOf(list.closest('fieldset'))] : null;
  const updateCount = () => {
    if (!actionsLink) return;
    const n = list.querySelectorAll(':scope > .item-card').length;
    actionsLink.dataset.count = n ? String(n) : '';
  };
  if (list) { new MutationObserver(updateCount).observe(list, { childList: true }); updateCount(); }

  let pinned = null; // voce scelta con un clic (vedi sotto)
  const setActive = (i) => links.forEach((a, k) => {
    a.classList.toggle('active', k === i);
    if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });

  nav.addEventListener('click', (ev) => {
    const a = ev.target.closest('a');
    if (!a) return;
    ev.preventDefault();
    const fs = sections[links.indexOf(a)];
    // Una sezione chiusa si riapre: si è chiesto di andarci.
    if (fs.classList.contains('folded')) fs.querySelector(':scope > legend')?.click();
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // La voce scelta resta evidenziata finché non si scorre a mano: in fondo
    // alla pagina più sezioni corte stanno insieme nello schermo e la
    // posizione da sola non direbbe quale si è chiesta.
    pinned = links.indexOf(a);
    fs.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActive(pinned);
  });
  for (const type of ['wheel', 'touchmove', 'keydown']) {
    window.addEventListener(type, () => { pinned = null; }, { passive: true });
  }

  // Sezione corrente = l'ultima il cui inizio ha superato la parte alta dello schermo.
  let ticking = false;
  const spy = () => {
    ticking = false;
    if (panel.hidden || !nav.offsetParent) return; // tab non attiva o indice nascosto
    if (pinned != null) { setActive(pinned); return; }
    const line = 140;
    let cur = 0;
    sections.forEach((fs, i) => { if (fs.getBoundingClientRect().top <= line) cur = i; });
    // In fondo alla pagina l'ultima sezione può non arrivare alla linea.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = sections.length - 1;
    setActive(cur);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('forge:theme', onScroll);
  spy();
}
