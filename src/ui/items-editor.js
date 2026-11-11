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
import { aaSectionHtml, applyAAEvent, loadAAIndex, aaIndexReady } from './aa-editor.js';
import { defaultAA } from '../builders/aa.js';
import { applyOnUseEvent } from './onuse-editor.js';
import { extrasSectionHtml } from './extras-editor.js';
import { spellcastingSummary } from '../builders/spellcasting.js';
import { esc } from '../utils/html.js';

// Coppie [id, etichetta localizzata] per le select delle condizioni.
const _condLabels = byLang(CONDITION_LABELS, CONDITION_LABELS_EN, getLang());
const CONDITION_OPTIONS = CONDITIONS.map(c => [c, _condLabels[c] ?? c]);

const itemsState = [];

/** Ritorna lo stato corrente (usato da readForm in main.js). */
export function getItems() {
  return itemsState;
}

/** Aggiunge una card (campi mancanti = quelli di una card nuova) e ridisegna. Ritorna la card. */
export function addItem(partial = {}) {
  const item = { ...newItem(), ...partial };
  itemsState.push(item);
  if (container) render();
  return item;
}

/** Toglie una card (per riferimento) e ridisegna. */
export function removeItem(item) {
  const i = itemsState.indexOf(item);
  if (i < 0) return false;
  itemsState.splice(i, 1);
  if (container) render();
  return true;
}

/** Design "Studio" attivo? Lì il primo blocco Incantesimi si modifica nella sua sezione. */
const isStudio = () => typeof document !== 'undefined' && document.documentElement.dataset.design === 'studio';

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
      aa: { ...defaultAA(), ...(it.aa || {}) },
      onUse: it.onUse || [],
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
    // Card "Incantesimi" (kind 'spellcasting'): attività cast verso i compendi.
    // scAbility '' = automatica (la più alta tra INT/SAG/CAR); scSlots = slot
    // scelti a mano ("4,3,,2": vuoto = quelli del livello da incantatore).
    scAbility: '', scDc: '', scAttack: '', scLevel: '', scSlots: '', scNoMaterial: false, spellList: '',
    effects: [], // effetti DAE (Fase 3.2), vedi effects-editor.js
    aa: defaultAA(), // animazione Automated Animations (Fase 7)
    onUse: [], // On-Use Macros di Midi-QOL
  };
}

const ACTIVATIONS = [
  ['action', t('act_action')], ['bonus', t('act_bonus')], ['reaction', t('act_reaction')],
  ['legendary', t('act_legendary')], ['special', t('act_special')],
];

const _abEn = getLang() === 'en';
function abilityOptions(selected, withAuto = false) {
  // Attacchi: "Automatica" = sceglie Foundry (FOR in mischia, DES a distanza/accurata).
  // Incantesimi ('sc'): "Automatica" = la più alta tra INT, SAG e CAR.
  const auto = withAuto ? `<option value="" ${selected === '' ? 'selected' : ''}>${t(withAuto === 'sc' ? 'scs_auto' : 'ab_auto')}</option>` : '';
  return auto + ABILITIES
    .map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${_abEn ? a.en : a.label}</option>`)
    .join('');
}

function options(pairs, selected) {
  return pairs
    .map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`)
    .join('');
}


// Regole del mostro (2014/2024): decidono in quale compendio cercare gli incantesimi.
let getRules = () => '2024';

/** Elenco degli incantesimi della card: ✓ collegato al compendio di sistema, ✗ da cercare. */
function scResolveHtml(item) {
  const list = spellcastingSummary(item.spellList, getRules());
  if (!list.length) return `<span class="hint">${t('sc_none')}</span>`;
  const missing = list.filter(x => !x.found).length;
  const chips = list.map(x => x.found
    ? `<span class="sc-chip ok" title="${esc(x.srdName)} · SRD ${x.rules}${x.level ? ' · ' + x.level : ''}">✓ ${esc(x.name)}</span>`
    : `<span class="sc-chip miss" title="${esc(t('sc_missing_title'))}">✗ ${esc(x.name)}</span>`).join(' ');
  return `<div class="hint">${t('sc_summary', { n: list.length, ok: list.length - missing })}${missing ? ' · ' + t('sc_missing_hint') : ''}</div><div class="sc-chips">${chips}</div>`;
}

/** HTML di una singola card. I data-attribute legano input ↔ stato. */
function cardHtml(item, idx) {
  const isAttack = item.kind === 'attack';
  const isSave = item.kind === 'save';
  const hasDamage = isAttack || isSave;

  return `
  <div class="item-card" data-idx="${idx}">
    <div class="item-card-head">
      <strong>#${idx + 1}${item.name ? ' · ' + esc(item.name) : ''}</strong>
      <span>
        <button type="button" class="remove" data-dup="${idx}" title="${t('ed_dup')}">⧉</button>
        <button type="button" class="remove" data-remove="${idx}" title="${t('ed_remove')}">✖</button>
      </span>
    </div>
    <div class="grid-3">
      <label>${t('ed_name')}
        <input type="text" data-f="name" value="${esc(item.name)}" placeholder="${t('ed_name_ph')}" />
      </label>
      <label>${t('ed_type')}
        <select data-f="kind">${options([
          ['attack', t('opt_attack')],
          ['save', t('opt_save')],
          ['utility', t('opt_utility')],
          ['passive', t('opt_passive')],
          ['spellcasting', t('opt_spellcasting')],
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
        <select data-f="ability">${abilityOptions(item.ability, true)}</select>
      </label>
      ${item.attackType === 'melee'
        ? `<label>${t('ed_reach')} <input type="number" data-f="reach" value="${esc(item.reach)}" /></label>`
        : `<label>${t('ed_range')}
             <span class="row">
               <input type="number" data-f="range" value="${esc(item.range)}" placeholder="30" />
               <input type="number" data-f="longRange" value="${esc(item.longRange)}" placeholder="120" />
             </span>
           </label>`}
      <label class="check">${t('ed_magical')} <input type="checkbox" data-f="magical" ${item.magical ? 'checked' : ''} /></label>
    </div>` : ''}

    ${isSave ? `
    <div class="grid-3">
      <label>${t('ed_save_req')}
        <select data-f="saveAbility">${abilityOptions(item.saveAbility)}</select>
      </label>
      <label>${t('ed_dc')} <span class="hint">${t('ed_dc_formula_hint')}</span><input type="text" data-f="dc" value="${esc(item.dc)}" placeholder="13" /></label>
      <label>${t('ed_onsave')}
        <select data-f="onSave">${options([['none', t('opt_nodmg')], ['half', t('opt_halfdmg')]], item.onSave)}</select>
      </label>
      <label>${t('ed_cond_fail')}
        <select data-f="condition">${options([['', t('opt_none_f')], ...CONDITION_OPTIONS], item.condition)}</select>
      </label>
      <label>${t('ed_duration')} <span class="hint">${t('ed_dur_hint')}</span>
        <input type="number" data-f="condRounds" value="${esc(item.condRounds)}" />
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
        <input type="number" data-f="condRounds" value="${esc(item.condRounds)}" />
      </label>` : ''}
      ${item.onHit === 'save' ? `
      <label>${t('ed_save_avoid')}
        <select data-f="riderSaveAbility">${abilityOptions(item.riderSaveAbility)}</select>
      </label>
      <label>${t('ed_dc_save')} <input type="text" data-f="riderDc" value="${esc(item.riderDc)}" placeholder="11" /></label>` : ''}
    </div>` : ''}

    ${item.kind === 'spellcasting' && isStudio() && itemsState.find(x => x.kind === 'spellcasting') === item ? `
    <div class="sc-stub">
      <span class="hint">${t('scs_stub')}</span>
      <button type="button" class="secondary small" data-goto-spells>${t('scs_goto')}</button>
    </div>` : item.kind === 'spellcasting' ? `
    <div class="grid-3">
      <label>${t('sc_ability')} <span class="hint">${t('scs_auto_hint')}</span><select data-f="scAbility">${abilityOptions(item.scAbility, 'sc')}</select></label>
      <label>${t('sc_dc')} <span class="hint">${t('sc_auto_hint')}</span><input type="number" data-f="scDc" value="${esc(item.scDc)}" placeholder="auto" /></label>
      <label>${t('sc_attack')} <span class="hint">${t('sc_auto_hint')}</span><input type="number" data-f="scAttack" value="${esc(item.scAttack)}" placeholder="auto" /></label>
      <label>${t('sc_level')} <span class="hint">${t('sc_level_hint')}</span><input type="number" data-f="scLevel" value="${esc(item.scLevel)}" min="0" max="20" /></label>
      <label class="check">${t('sc_nomat')} <input type="checkbox" data-f="scNoMaterial" ${item.scNoMaterial ? 'checked' : ''} /></label>
    </div>
    <label>${t('sc_list')} <span class="hint">${t('sc_list_hint')}</span>
      <textarea data-f="spellList" rows="4" placeholder="${esc(t('sc_list_ph'))}">${esc(item.spellList)}</textarea>
    </label>
    <div class="sc-resolve">${scResolveHtml(item)}</div>` : ''}

    ${hasDamage ? `
    <label>${t('ed_damage')} <span class="hint">${t('ed_damage_hint')}</span>
      <input type="text" data-f="damage" value="${esc(item.damage)}" placeholder="${t('ed_damage_ph')}" />
    </label>` : ''}

    ${item.kind !== 'passive' && item.kind !== 'spellcasting' ? `
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
             <input type="number" data-f="usesValue" value="${esc(item.usesValue)}" placeholder="${item.usesMode === 'recharge' ? '5' : '3'}" />
           </label>` : ''}
      <label>${t('ed_icon')} <input type="text" data-f="img" value="${esc(item.img)}" /></label>
    </div>` : ''}

    ${extrasSectionHtml(item, item.kind === 'passive')}

    <label>${t('ed_description')}
      <textarea data-f="description" rows="2">${esc(item.description)}</textarea>
    </label>
  </div>`;
}

let container;
let onStructureChange = () => {};

/** Ridisegna le card dall'esterno (es. cambio di regole 2014/2024). */
export function refreshItems() { if (container) render(); }

/** Ridisegna tutte le card (solo per cambi strutturali). */
function render() {
  container.innerHTML = itemsState.map(cardHtml).join('');
  // Indice JB2A in lazy: al primo uso della sezione A-A in una card.
  if (itemsState.some(it => it.aa?.enabled) && !aaIndexReady()) loadAAIndex().then(render);
}

/** Campi che cambiano la struttura della card → serve un re-render. */
const STRUCTURAL = ['kind', 'attackType', 'usesMode', 'onHit'];

export function initItemsEditor({ listEl, addBtn, onChange, rules }) {
  container = listEl;
  if (typeof rules === 'function') getRules = rules;
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

    // --- Sezione animazione A-A ---
    const aaRes = applyAAEvent(item, ev);
    if (aaRes.handled) { if (aaRes.structural) render(); onStructureChange(); return; }
    // --- Sezione On-Use Macros ---
    const ouRes = applyOnUseEvent(item, ev);
    if (ouRes.handled) { if (ouRes.structural) render(); onStructureChange(); return; }

    // --- Campi della card azione (comportamento originale) ---
    const field = ds.f;
    if (!field) return;
    item[field] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    // Lista incantesimi: aggiorna solo il riepilogo ✓/✗ (niente re-render: il cursore resta dov'è).
    if (field === 'spellList') {
      // La lista scritta a mano torna a comandare anche sugli slot.
      item.scSlots = '';
      const box = card.querySelector('.sc-resolve');
      if (box) box.innerHTML = scResolveHtml(item);
    }
    if (STRUCTURAL.includes(field)) {
      render();
      onStructureChange();
    }
  });

  // Stato aperto/chiuso dei details (effetti/AA/OnUse) per card: senza
  // questo, ogni re-render richiuderebbe le sezioni ('toggle' non bubbla).
  container.addEventListener('toggle', (ev) => {
    const k = ev.target.dataset?.open;
    const card = ev.target.closest('[data-idx]');
    if (k && card) itemsState[Number(card.dataset.idx)][k] = ev.target.open;
  }, true);

  container.addEventListener('click', (ev) => {
    // --- Blocco Incantesimi nel design Studio: si modifica nella sua sezione ---
    if (ev.target.closest('[data-goto-spells]')) {
      document.dispatchEvent(new CustomEvent('forge:goto-spells'));
      return;
    }
    // --- Bottoni On-Use Macros (aggiungi/rimuovi riga) ---
    const cardOu = ev.target.closest('[data-idx]');
    if (cardOu && ('ouAdd' in ev.target.dataset || 'ouRemove' in ev.target.dataset)) {
      const itemOu = itemsState[Number(cardOu.dataset.idx)];
      const ouRes = applyOnUseEvent(itemOu, ev);
      if (ouRes.handled) { if (ouRes.structural) render(); onStructureChange(); return; }
    }
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
      delete copy._srcId; // la copia è una voce NUOVA, non l'originale ricaricato
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
