// ============================================================
// Editor delle azioni/attacchi/tratti: gestisce lo stato di una
// lista di "descrittori item" e le card nel form.
//
// Pattern usato: lo stato vive in un array JS (itemsState) e la UI
// viene ridisegnata solo quando cambia la STRUTTURA (aggiungi/rimuovi
// card, cambio di tipo). I singoli caratteri digitati aggiornano lo
// stato senza ridisegnare, così non perdi il focus mentre scrivi.
// ============================================================
import { ABILITIES, CONDITIONS, CONDITION_LABELS, CONDITION_LABELS_EN, byLang } from '../data/constants.js';
import { t, getLang } from '../i18n.js';
import {
  newEffect, newChange, normalizeEffect,
  effectsSectionHtml, ensureChangeKeysDatalist,
} from './effects-editor.js';
import { keyDefaults, presetById } from '../data/effect-keys.js';

// Coppie [id, etichetta localizzata] per le select delle condizioni.
const _condLabels = byLang(CONDITION_LABELS, CONDITION_LABELS_EN, getLang());
const CONDITION_OPTIONS = CONDITIONS.map(c => [c, _condLabels[c] ?? c]);

const itemsState = [];

/** Ritorna lo stato corrente (usato da readForm in main.js). */
export function getItems() {
  return itemsState;
}

/** Sostituisce lo stato (usato dal caricamento delle bozze) e ridisegna. */
export function setItems(items) {
  itemsState.length = 0;
  // Merge con newItem(): le bozze salvate con versioni vecchie dell'app
  // acquisiscono automaticamente i campi aggiunti in seguito.
  // Gli effetti (array annidato) hanno la loro normalizzazione dedicata.
  for (const it of items || []) {
    itemsState.push({
      ...newItem(),
      ...it,
      effects: (it.effects || []).map(normalizeEffect),
    });
  }
  render();
}

function newItem() {
  return {
    name: '', kind: 'attack', activation: 'action',
    attackType: 'melee', ability: 'str', reach: '5', range: '30', longRange: '',
    damage: '', magical: false,
    saveAbility: 'con', dc: '', onSave: 'none',
    onHit: 'none', condition: 'prone', condRounds: '',
    riderSaveAbility: 'con', riderDc: '',
    usesMode: 'none', usesValue: '',
    img: '', description: '',
    effects: [], // effetti DAE (Fase 3.2), vedi effects-editor.js
  };
}

const ACTIVATIONS = [
  ['action', t('act_action')], ['bonus', t('act_bonus')], ['reaction', t('act_reaction')],
  ['legendary', t('act_legendary')], ['special', t('act_special')],
];

const _abEn = getLang() === 'en';
function abilityOptions(selected) {
  return ABILITIES
    .map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${_abEn ? a.en : a.label}</option>`)
    .join('');
}

function options(pairs, selected) {
  return pairs
    .map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`)
    .join('');
}

/** HTML di una singola card. I data-attribute legano input ↔ stato. */
function cardHtml(item, idx) {
  const isAttack = item.kind === 'attack';
  const isSave = item.kind === 'save';
  const hasDamage = isAttack || isSave;

  return `
  <div class="item-card" data-idx="${idx}">
    <div class="item-card-head">
      <strong>#${idx + 1}${item.name ? ' · ' + item.name.replace(/</g, '&lt;') : ''}</strong>
      <span>
        <button type="button" class="remove" data-dup="${idx}" title="${t('ed_dup')}">⧉</button>
        <button type="button" class="remove" data-remove="${idx}" title="${t('ed_remove')}">✖</button>
      </span>
    </div>
    <div class="grid-3">
      <label>${t('ed_name')}
        <input type="text" data-f="name" value="${item.name.replace(/"/g, '&quot;')}" placeholder="${t('ed_name_ph')}" />
      </label>
      <label>${t('ed_type')}
        <select data-f="kind">${options([
          ['attack', t('opt_attack')],
          ['save', t('opt_save')],
          ['utility', t('opt_utility')],
          ['passive', t('opt_passive')],
        ], item.kind)}</select>
      </label>
      ${item.kind !== 'passive' ? `
      <label>${t('ed_activation')}
        <select data-f="activation">${options(ACTIVATIONS, item.activation)}</select>
      </label>` : ''}
    </div>

    ${isAttack ? `
    <div class="grid-3">
      <label>${t('ed_meleeranged')}
        <select data-f="attackType">${options([['melee', t('opt_melee')], ['ranged', t('opt_ranged')]], item.attackType)}</select>
      </label>
      <label>${t('ed_ability')}
        <select data-f="ability">${abilityOptions(item.ability)}</select>
      </label>
      ${item.attackType === 'melee'
        ? `<label>${t('ed_reach')} <input type="number" data-f="reach" value="${item.reach}" /></label>`
        : `<label>${t('ed_range')}
             <span class="row">
               <input type="number" data-f="range" value="${item.range}" placeholder="30" />
               <input type="number" data-f="longRange" value="${item.longRange}" placeholder="120" />
             </span>
           </label>`}
      <label class="check">${t('ed_magical')} <input type="checkbox" data-f="magical" ${item.magical ? 'checked' : ''} /></label>
    </div>` : ''}

    ${isSave ? `
    <div class="grid-3">
      <label>${t('ed_save_req')}
        <select data-f="saveAbility">${abilityOptions(item.saveAbility)}</select>
      </label>
      <label>${t('ed_dc')} <input type="number" data-f="dc" value="${item.dc}" placeholder="13" /></label>
      <label>${t('ed_onsave')}
        <select data-f="onSave">${options([['none', t('opt_nodmg')], ['half', t('opt_halfdmg')]], item.onSave)}</select>
      </label>
      <label>${t('ed_cond_fail')}
        <select data-f="condition">${options([['', t('opt_none_f')], ...CONDITION_OPTIONS], item.condition)}</select>
      </label>
      <label>${t('ed_duration')} <span class="hint">${t('ed_dur_hint')}</span>
        <input type="number" data-f="condRounds" value="${item.condRounds}" />
      </label>
    </div>` : ''}

    ${isAttack ? `
    <div class="grid-3">
      <label>${t('ed_onhit')}
        <select data-f="onHit">${options([
          ['none', t('opt_onhit_none')],
          ['condition', t('opt_onhit_cond')],
          ['save', t('opt_onhit_save')],
        ], item.onHit)}</select>
      </label>
      ${item.onHit !== 'none' ? `
      <label>${t('ed_condition')}
        <select data-f="condition">${options(CONDITION_OPTIONS, item.condition)}</select>
      </label>
      <label>${t('ed_duration')} <span class="hint">${t('ed_dur_hint')}</span>
        <input type="number" data-f="condRounds" value="${item.condRounds}" />
      </label>` : ''}
      ${item.onHit === 'save' ? `
      <label>${t('ed_save_avoid')}
        <select data-f="riderSaveAbility">${abilityOptions(item.riderSaveAbility)}</select>
      </label>
      <label>${t('ed_dc_save')} <input type="number" data-f="riderDc" value="${item.riderDc}" placeholder="11" /></label>` : ''}
    </div>` : ''}

    ${hasDamage ? `
    <label>${t('ed_damage')} <span class="hint">${t('ed_damage_hint')}</span>
      <input type="text" data-f="damage" value="${item.damage.replace(/"/g, '&quot;')}" placeholder="${t('ed_damage_ph')}" />
    </label>` : ''}

    ${item.kind !== 'passive' ? `
    <div class="grid-3">
      <label>${t('ed_uses')}
        <select data-f="usesMode">${options([
          ['none', t('opt_unlimited')],
          ['recharge', t('opt_recharge')],
          ['day', t('opt_perday')],
        ], item.usesMode)}</select>
      </label>
      ${item.usesMode !== 'none'
        ? `<label>${item.usesMode === 'recharge' ? t('ed_recharge_x') : t('ed_uses_day')}
             <input type="number" data-f="usesValue" value="${item.usesValue}" placeholder="${item.usesMode === 'recharge' ? '5' : '3'}" />
           </label>` : ''}
      <label>${t('ed_icon')} <input type="text" data-f="img" value="${item.img.replace(/"/g, '&quot;')}" /></label>
    </div>` : ''}

    ${effectsSectionHtml(item, item.kind === 'passive')}

    <label>${t('ed_description')}
      <textarea data-f="description" rows="2">${item.description}</textarea>
    </label>
  </div>`;
}

let container;
let onStructureChange = () => {};

/** Ridisegna tutte le card (solo per cambi strutturali). */
function render() {
  container.innerHTML = itemsState.map(cardHtml).join('');
}

/** Campi che cambiano la struttura della card → serve un re-render. */
const STRUCTURAL = ['kind', 'attackType', 'usesMode', 'onHit'];

export function initItemsEditor({ listEl, addBtn, onChange }) {
  container = listEl;
  onStructureChange = onChange;
  ensureChangeKeysDatalist(); // autocomplete globale delle chiavi DAE

  addBtn.addEventListener('click', () => {
    itemsState.push(newItem());
    render();
    onStructureChange();
  });

  // Event delegation: un solo listener per tutte le card, presenti e future.
  container.addEventListener('input', (ev) => {
    const card = ev.target.closest('[data-idx]');
    if (!card) return;
    const item = itemsState[Number(card.dataset.idx)];
    const ds = ev.target.dataset;

    // --- Select "effetto da preset": aggiunge un effetto già configurato ---
    if ('effAddPreset' in ds) {
      const preset = presetById(ev.target.value);
      if (preset) {
        item.effects.push({
          ...newEffect(),
          name: preset.name,
          application: preset.application,
          changes: structuredClone(preset.changes),
        });
        render();
        onStructureChange();
      }
      return;
    }

    // --- Campi di una riga di modifica (changes) di un effetto ---
    if (ds.cf) {
      const eff = item.effects[Number(ev.target.closest('[data-eidx]').dataset.eidx)];
      const row = ev.target.closest('[data-cidx]');
      const change = eff.changes[Number(row.dataset.cidx)];
      change[ds.cf] = ev.target.value;
      // QoL: scegliendo una chiave nota dal catalogo, modalità e priorità
      // si impostano da sole (senza re-render, per non perdere il focus).
      if (ds.cf === 'key') {
        const def = keyDefaults(ev.target.value);
        if (def) {
          change.mode = def.mode;
          if (!String(change.priority).trim()) change.priority = def.priority;
          row.querySelector('[data-cf="mode"]').value = String(def.mode);
          row.querySelector('[data-cf="priority"]').value = String(change.priority);
          row.querySelector('[data-cf="value"]').placeholder = def.hint || 'valore';
        }
      }
      return;
    }

    // --- Campi dell'effetto (nome, applicazione, durata, icona) ---
    if (ds.ef) {
      const eff = item.effects[Number(ev.target.closest('[data-eidx]').dataset.eidx)];
      eff[ds.ef] = ev.target.value;
      // Il cambio di applicazione mostra/nasconde il campo durata.
      if (ds.ef === 'application') {
        render();
        onStructureChange();
      }
      return;
    }

    // --- Campi della card azione (comportamento originale) ---
    const field = ds.f;
    if (!field) return;
    item[field] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    if (STRUCTURAL.includes(field)) {
      render();
      onStructureChange();
    }
  });

  container.addEventListener('click', (ev) => {
    // --- Bottoni della sezione effetti (aggiungi/rimuovi effetto o riga) ---
    const ds = ev.target.dataset;
    const card = ev.target.closest('[data-idx]');
    if (card && ('effAdd' in ds || 'effRemove' in ds || 'chgAdd' in ds || 'chgRemove' in ds)) {
      const item = itemsState[Number(card.dataset.idx)];
      if ('effAdd' in ds) {
        item.effects.push(newEffect());
      } else if ('effRemove' in ds) {
        item.effects.splice(Number(ds.effRemove), 1);
      } else {
        const eff = item.effects[Number(ev.target.closest('[data-eidx]').dataset.eidx)];
        if ('chgAdd' in ds) eff.changes.push(newChange());
        else eff.changes.splice(Number(ds.chgRemove), 1);
      }
      render();
      onStructureChange();
      return;
    }

    const { remove, dup } = ev.target.dataset;
    if (dup !== undefined) {
      // Duplica: copia profonda della card, inserita subito dopo l'originale.
      const copy = structuredClone(itemsState[Number(dup)]);
      copy.name = copy.name ? `${copy.name} (copia)` : '';
      itemsState.splice(Number(dup) + 1, 0, copy);
    } else if (remove !== undefined) {
      itemsState.splice(Number(remove), 1);
    } else {
      return;
    }
    render();
    onStructureChange();
  });
}
