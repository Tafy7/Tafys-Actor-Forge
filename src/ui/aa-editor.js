// ============================================================
// Sezione "Animazione A-A" (Automated Animations + JB2A) — condivisa
// tra Tab Oggetto e Tab Incantesimo, stesso pattern di effects-editor:
// qui HTML + gestore eventi, lo stato vive nel descrittore della tab
// (campo `aa`, vedi builders/aa.js defaultAA()).
//
// L'INDICE della libreria FREE di JB2A (2003 webm) è pesante: viene
// caricato in lazy (dynamic import → chunk separato) solo quando l'utente
// attiva la sezione. L'anteprima è il webm VERO, servito dal repo GitHub
// pubblico della libreria free (CORS aperto, verificato).
// ============================================================
import { t } from '../i18n.js';

let INDEX = null;          // { 'fireball.explosion.orange': 'Library/...webm', ... }
let RAW_BASE = '';
let loading = null;

/** Carica l'indice una volta sola; ritorna la promise (riusabile). */
export function loadAAIndex() {
  if (!loading) {
    loading = import('../data/jb2a-free-index.js').then((m) => {
      INDEX = m.JB2A_FREE;
      RAW_BASE = m.JB2A_RAW_BASE;
      return INDEX;
    });
  }
  return loading;
}
export const aaIndexReady = () => INDEX !== null;

const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Filtra l'indice: ogni parola della query deve comparire nel path. */
function search(query, limit = 80) {
  if (!INDEX) return [];
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const key of Object.keys(INDEX)) {
    if (words.every(w => key.includes(w))) {
      out.push(key);
      if (out.length >= limit) break;
    }
  }
  return out;
}

const previewUrl = (path) => (INDEX && INDEX[path] ? RAW_BASE + INDEX[path] : '');

/** HTML di uno slot animazione (primary o target). */
function slotHtml(aa, slot) {
  const isPrimary = slot === 'primary';
  const path = isPrimary ? aa.path : aa.tgtPath;
  const query = isPrimary ? aa.search : aa.tgtSearch;
  const persistent = isPrimary ? aa.persistent : aa.tgtPersistent;
  const scale = isPrimary ? aa.scale : aa.tgtScale;
  const results = search(query || path);
  const url = previewUrl(path);
  return `
  <div class="aa-slot" data-aa-slot="${slot}">
    <div class="grid-3">
      <label>${t('aa_search')} <input type="text" data-aa="search" value="${esc(query)}" placeholder="fireball explosion" /></label>
      <label>${t('aa_anim')} <span class="hint">${t('aa_anim_hint')}</span>
        <select data-aa="path" size="1">
          <option value="">${t('aa_pick')} (${results.length})</option>
          ${results.map(k => `<option value="${k}" ${k === path ? 'selected' : ''}>${k}</option>`).join('')}
        </select>
      </label>
      <div class="aa-prev-box">${url ? `<video class="aa-prev" src="${esc(url)}" autoplay loop muted playsinline></video>` : `<span class="hint">${t('aa_noprev')}</span>`}</div>
    </div>
    <div class="grid-3">
      ${isPrimary ? `<label>${t('aa_playon')} <select data-aa="playOn">
        <option value="target" ${aa.playOn !== 'source' ? 'selected' : ''}>${t('aa_on_target')}</option>
        <option value="source" ${aa.playOn === 'source' ? 'selected' : ''}>${t('aa_on_source')}</option>
      </select></label>` : ''}
      <label class="check">${t('aa_persistent')} <input type="checkbox" data-aa="persistent" ${persistent ? 'checked' : ''} /></label>
      <label>${t('aa_scale')} <input type="number" step="0.1" data-aa="scale" value="${esc(scale)}" placeholder="1" /></label>
    </div>
  </div>`;
}

/**
 * Sezione completa. `aa` = stato (defaultAA()). Se l'indice non è ancora
 * caricato mostra il segnaposto: la tab lo carica e ridisegna.
 */
export function aaSectionHtml(aa) {
  return `
  <fieldset class="inner aa-block">
    <legend>
      <label class="check">🎞️ ${t('aa_legend')}
        <input type="checkbox" data-aa="enabled" ${aa.enabled ? 'checked' : ''} />
      </label>
      <span class="hint">${t('aa_legend_hint')}</span>
    </legend>
    ${!aa.enabled ? '' : !aaIndexReady() ? `<span class="hint">${t('aa_loading')}</span>` : `
      ${slotHtml(aa, 'primary')}
      <label class="check aa-tgt-toggle">${t('aa_target')} <span class="hint">${t('aa_target_hint')}</span>
        <input type="checkbox" data-aa="tgtEnabled" ${aa.tgtEnabled ? 'checked' : ''} />
      </label>
      ${aa.tgtEnabled ? slotHtml(aa, 'target') : ''}
      <p class="hint">${t('aa_note')}</p>`}
  </fieldset>`;
}

/**
 * Gestore CONDIVISO degli eventi della sezione (stessa convenzione di
 * applyEffectsEvent). Ritorna { handled, structural }.
 * search e path aggiornano il DOM DIRETTAMENTE (select filtrata + video)
 * senza ridisegnare, per non perdere il focus mentre si digita.
 */
export function applyAAEvent(state, ev) {
  const f = ev.target.dataset.aa;
  if (!f) return { handled: false, structural: false };
  const aa = state.aa;
  const slotEl = ev.target.closest('[data-aa-slot]');
  const slot = slotEl?.dataset.aaSlot;
  const isTgt = slot === 'target';
  const val = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;

  if (f === 'enabled') { aa.enabled = val; return { handled: true, structural: true }; }
  if (f === 'tgtEnabled') { aa.tgtEnabled = val; return { handled: true, structural: true }; }

  if (f === 'search') {
    if (isTgt) aa.tgtSearch = val; else aa.search = val;
    // Aggiorna SOLO la select dei risultati (niente re-render → focus ok).
    const sel = slotEl.querySelector('[data-aa="path"]');
    const cur = isTgt ? aa.tgtPath : aa.path;
    const results = search(val);
    sel.innerHTML = `<option value="">${t('aa_pick')} (${results.length})</option>`
      + results.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k}</option>`).join('');
    return { handled: true, structural: false };
  }
  if (f === 'path') {
    if (isTgt) aa.tgtPath = val; else aa.path = val;
    // Aggiorna l'anteprima video dello slot.
    const box = slotEl.querySelector('.aa-prev-box');
    const url = previewUrl(val);
    box.innerHTML = url
      ? `<video class="aa-prev" src="${esc(url)}" autoplay loop muted playsinline></video>`
      : `<span class="hint">${t('aa_noprev')}</span>`;
    return { handled: true, structural: false };
  }
  if (f === 'playOn') { aa.playOn = val; return { handled: true, structural: false }; }
  if (f === 'persistent') {
    if (isTgt) aa.tgtPersistent = val; else aa.persistent = val;
    return { handled: true, structural: false };
  }
  if (f === 'scale') {
    if (isTgt) aa.tgtScale = val; else aa.scale = val;
    return { handled: true, structural: false };
  }
  return { handled: false, structural: false };
}
