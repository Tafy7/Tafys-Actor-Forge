// ============================================================
// Editor degli effetti DAE dentro le card azione — Fase 3, parte 2.
//
// Questo modulo genera SOLO l'HTML della sezione effetti e le piccole
// utility di stato: gli event listener restano in items-editor.js
// (event delegation unica per tutta la card, stesso pattern di prima).
//
// Convenzione dei data-attribute (per non collidere con data-f delle card):
//   data-eidx        → indice dell'effetto nell'item
//   data-ef          → campo dell'effetto (name, application, rounds, img)
//   data-cidx        → indice della riga di modifica
//   data-cf          → campo della riga (key, mode, value, priority)
//   data-eff-add / data-eff-remove / data-chg-add / data-chg-remove → bottoni
//   data-eff-add-preset → select "effetto pronto da un click"
// ============================================================
import { CHANGE_KEYS, CHANGE_MODES, EFFECT_PRESETS, presetById, keyDefaults } from '../data/effect-keys.js';
import { t } from '../i18n.js';

/** Descrittore di un nuovo effetto vuoto (parte con una riga di modifica). */
export function newEffect() {
  return { name: '', application: 'passive', rounds: '', img: '', changes: [newChange()] };
}

/** Riga di modifica vuota: mode 2 (Aggiungi) è il default più comune. */
export function newChange() {
  return { key: '', mode: 2, value: '', priority: '' };
}

/**
 * Normalizza un effetto caricato da una bozza (anche di versioni vecchie
 * dell'app): i campi mancanti prendono i default di newEffect/newChange.
 */
export function normalizeEffect(e) {
  return {
    ...newEffect(),
    ...e,
    changes: (e?.changes || []).map(c => ({ ...newChange(), ...c })),
  };
}

/**
 * Crea (una volta sola) la datalist globale con le chiavi DAE note:
 * l'autocomplete del browser mostra chiave + etichetta italiana.
 */
export function ensureChangeKeysDatalist() {
  if (document.getElementById('change-keys-list')) return;
  const dl = document.createElement('datalist');
  dl.id = 'change-keys-list';
  for (const k of CHANGE_KEYS) {
    const opt = document.createElement('option');
    opt.value = k.key;
    opt.label = k.label;
    dl.appendChild(opt);
  }
  document.body.appendChild(dl);
}

const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function options(pairs, selected) {
  return pairs
    .map(([v, l]) => `<option value="${v}" ${String(v) === String(selected) ? 'selected' : ''}>${l}</option>`)
    .join('');
}

/** Una riga dell'array changes: chiave (con autocomplete) + modalità + valore + priorità. */
function changeRowHtml(c, k) {
  const hint = CHANGE_KEYS.find(x => x.key === c.key)?.hint || t('ef_value').toLowerCase();
  return `
    <div class="change-row" data-cidx="${k}">
      <input type="text" data-cf="key" list="change-keys-list" value="${esc(c.key)}"
             placeholder="system.attributes.ac.bonus" title="${t('ef_key_title')}" />
      <select data-cf="mode" title="${t('ef_mode')}">${options(CHANGE_MODES, c.mode)}</select>
      <input type="text" data-cf="value" value="${esc(c.value)}" placeholder="${esc(hint)}" title="${t('ef_value')}" />
      <input type="number" data-cf="priority" value="${esc(c.priority)}" placeholder="prio" title="${t('ef_priority')}" />
      <button type="button" class="remove" data-chg-remove="${k}" title="${t('ef_change_remove')}">✖</button>
    </div>`;
}

/** Card di un singolo effetto. */
function effectCardHtml(e, j, forcePassive) {
  return `
  <div class="effect-card" data-eidx="${j}">
    <div class="item-card-head">
      <em>${t('ef_num')} #${j + 1}${e.name ? ' · ' + esc(e.name) : ''}</em>
      <button type="button" class="remove" data-eff-remove="${j}" title="${t('ef_remove')}">✖</button>
    </div>
    <div class="grid-3">
      <label>${t('ef_name')}
        <input type="text" data-ef="name" value="${esc(e.name)}" placeholder="${t('ef_name_ph')}" />
      </label>
      ${forcePassive ? '' : `
      <label>${t('ef_application')}
        <select data-ef="application">${options([
          ['passive', t('ef_app_passive')],
          ['target', t('ef_app_target')],
        ], e.application)}</select>
      </label>
      ${e.application === 'target' ? `
      <label>${t('ef_rounds')} <span class="hint">${t('ef_rounds_hint')}</span>
        <input type="number" data-ef="rounds" value="${esc(e.rounds)}" />
      </label>` : ''}`}
      <label>${t('ef_icon')} <span class="hint">${t('ef_icon_hint')}</span>
        <input type="text" data-ef="img" value="${esc(e.img)}" />
      </label>
    </div>
    <div class="changes">
      ${e.changes.map((c, k) => changeRowHtml(c, k)).join('')}
      <button type="button" class="secondary small" data-chg-add>${t('ef_change_add')}</button>
    </div>
  </div>`;
}

/**
 * Gestore CONDIVISO degli eventi della sezione effetti su UN item.
 * Lo usa la Tab Item (e in futuro chiunque riusi effectsSectionHtml) senza
 * duplicare la logica. NON tocca items-editor.js (che ha la sua copia
 * storica, per non rischiare la scheda NPC già in produzione).
 * `item` deve avere un array `item.effects`. Ritorna:
 *   { handled, structural } — structural:true = serve ridisegnare.
 */
export function applyEffectsEvent(item, ev) {
  const ds = ev.target.dataset;
  const effEl = ev.target.closest('[data-eidx]');
  const eff = effEl ? item.effects[Number(effEl.dataset.eidx)] : null;

  if ('effAddPreset' in ds) {
    const p = presetById(ev.target.value);
    if (p) item.effects.push({ ...newEffect(), name: p.name, application: p.application, changes: JSON.parse(JSON.stringify(p.changes)) });
    return { handled: true, structural: true };
  }
  if ('effAdd' in ds) { item.effects.push(newEffect()); return { handled: true, structural: true }; }
  if ('effRemove' in ds) { item.effects.splice(Number(ds.effRemove), 1); return { handled: true, structural: true }; }
  if ('chgAdd' in ds && eff) { eff.changes.push(newChange()); return { handled: true, structural: true }; }
  if ('chgRemove' in ds && eff) { eff.changes.splice(Number(ds.chgRemove), 1); return { handled: true, structural: true }; }

  if (ds.cf && eff) {
    const row = ev.target.closest('[data-cidx]');
    const c = eff.changes[Number(row.dataset.cidx)];
    c[ds.cf] = ev.target.value;
    // Scelta chiave nota: imposta mode/priorità di default aggiornando i
    // campi vicini SENZA ridisegnare (così non si perde il focus).
    if (ds.cf === 'key') {
      const def = keyDefaults(ev.target.value);
      if (def) {
        c.mode = def.mode;
        if (!String(c.priority).trim()) c.priority = def.priority;
        row.querySelector('[data-cf="mode"]').value = String(def.mode);
        row.querySelector('[data-cf="priority"]').value = String(c.priority);
      }
    }
    return { handled: true, structural: false };
  }
  if (ds.ef && eff) {
    eff[ds.ef] = ev.target.value;
    return { handled: true, structural: ds.ef === 'application' };
  }
  return { handled: false, structural: false };
}

/**
 * Sezione "Effetti DAE" completa di una card azione.
 * `forcePassive` = true per i tratti passivi (niente activity → gli
 * effetti possono solo essere transfer).
 */
export function effectsSectionHtml(item, forcePassive) {
  const effects = item.effects || [];
  return `
  <div class="effects-block">
    <div class="effects-head">
      <strong>${t('ef_dae')}</strong>
      <span class="hint">${forcePassive ? t('ef_passive_hint') : t('ef_mixed_hint')}</span>
    </div>
    ${effects.map((e, j) => effectCardHtml(e, j, forcePassive)).join('')}
    <div class="row">
      <button type="button" class="secondary small" data-eff-add>${t('ef_add')}</button>
      <select data-eff-add-preset title="${t('ef_preset')}">
        <option value="">${t('ef_preset')}</option>
        ${EFFECT_PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
      </select>
    </div>
  </div>`;
}
