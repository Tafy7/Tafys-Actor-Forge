// ============================================================
// Tab "Item" — crea un Item STANDALONE (arma / equipaggiamento /
// consumabile / feature) ed esporta il JSON, come per l'NPC.
// Riusa la sezione effetti DAE (effectsSectionHtml + applyEffectsEvent)
// e il builder standalone-item.js.
// ============================================================
import { buildStandaloneItem, validateStandaloneItem, RARITIES, ATTUNEMENTS } from '../builders/standalone-item.js';
import { effectsSectionHtml, applyEffectsEvent, normalizeEffect } from './effects-editor.js';
import { ABILITIES, CONDITIONS, CONDITION_LABELS, CONDITION_LABELS_EN, byLang, WEAPON_TYPES, WEAPON_MASTERIES } from '../data/constants.js';
import { downloadJson } from '../utils/download.js';
import { t, getLang } from '../i18n.js';

const LANG = getLang();
const condLabels = byLang(CONDITION_LABELS, CONDITION_LABELS_EN, LANG);
const CONDITION_OPTIONS = CONDITIONS.map(c => [c, condLabels[c] ?? c]);
const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abEn = LANG === 'en';

let state = defaultItem();
let addToBatch = () => {};

function defaultItem() {
  return {
    itemType: 'weapon', name: '', img: '', description: '', unidentified: '',
    rarity: '', attunement: '', magical: true, silvered: false, adamantine: false, armorValue: '',
    weaponBase: '', magicalBonus: '', mastery: '',
    kind: 'attack', activation: 'action',
    attackType: 'melee', ability: 'str', reach: '5', range: '30', longRange: '', damage: '', magicalDamage: false,
    saveAbility: 'con', dc: '', onSave: 'none',
    onHit: 'none', condition: 'prone', condRounds: '',
    riderSaveAbility: 'con', riderDc: '',
    usesMode: 'none', usesValue: '',
    effects: [],
  };
}

const opts = (pairs, sel) => pairs.map(([v, l]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${l}</option>`).join('');
const abilityOpts = (sel) => ABILITIES.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${abEn ? a.en : a.label}</option>`).join('');
const weaponTypeOpts = (sel) => WEAPON_TYPES.map(w => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${abEn ? w.en : w.it}</option>`).join('');
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const masteryOpts = (sel) => WEAPON_MASTERIES.map(m => `<option value="${m}" ${m === sel ? 'selected' : ''}>${m ? cap(m) : t('mst_none')}</option>`).join('');

// Il "comportamento" ha senso solo per alcuni tipi: un'arma attacca, una
// pozione fa utility/save, un oggetto meraviglioso di solito è passivo.
const KINDS = () => [
  ['attack', t('opt_attack')], ['save', t('opt_save')], ['utility', t('opt_utility')], ['passive', t('opt_passive')],
];
const ACTIVATIONS = () => [
  ['action', t('act_action')], ['bonus', t('act_bonus')], ['reaction', t('act_reaction')],
  ['legendary', t('act_legendary')], ['special', t('act_special')],
];
const RARITY_OPTS = () => RARITIES.map(r => [r, t('rar_' + (r || 'none'))]);
const ATT_OPTS = () => ATTUNEMENTS.map(a => [a, t('att_' + (a || 'none'))]);

function formHtml(it) {
  const isAttack = it.kind === 'attack';
  const isSave = it.kind === 'save';
  const hasDamage = isAttack || isSave;
  const isEquip = it.itemType === 'equipment';
  return `
  <div class="grid-3">
    <label>${t('it_type')}
      <select data-f="itemType">${opts([
        ['weapon', t('it_weapon')], ['equipment', t('it_equipment')],
        ['consumable', t('it_consumable')], ['feat', t('it_feat')],
      ], it.itemType)}</select>
    </label>
    <label>${t('ed_name')} <input type="text" data-f="name" value="${esc(it.name)}" placeholder="${t('it_name_ph')}" /></label>
    <label>${t('ed_icon')} <input type="text" data-f="img" value="${esc(it.img)}" placeholder="icons/..." /></label>
  </div>
  <div class="grid-3">
    <label>${t('it_rarity')} <select data-f="rarity">${opts(RARITY_OPTS(), it.rarity)}</select></label>
    <label>${t('it_attunement')} <select data-f="attunement">${opts(ATT_OPTS(), it.attunement)}</select></label>
    <label class="check">${t('it_magical')} <input type="checkbox" data-f="magical" ${it.magical ? 'checked' : ''} /></label>
    ${isEquip ? `<label>${t('it_armor')} <span class="hint">${t('it_armor_hint')}</span><input type="number" data-f="armorValue" value="${esc(it.armorValue)}" /></label>` : ''}
  </div>
  ${it.itemType === 'weapon' ? `
  <div class="grid-3">
    <label>${t('it_wtype')} <span class="hint">${t('it_wtype_hint')}</span><select data-f="weaponBase">${weaponTypeOpts(it.weaponBase)}</select></label>
    <label>${t('it_magicbonus')} <span class="hint">${t('it_magicbonus_hint')}</span><input type="number" data-f="magicalBonus" value="${esc(it.magicalBonus)}" placeholder="0" /></label>
    <label>${t('it_mastery')} <span class="hint">${t('it_mastery_hint')}</span><select data-f="mastery">${masteryOpts(it.mastery)}</select></label>
  </div>` : ''}
  ${(it.itemType === 'weapon' || isEquip) ? `
  <div class="grid-3">
    <label class="check">${t('it_silvered')} <input type="checkbox" data-f="silvered" ${it.silvered ? 'checked' : ''} /></label>
    <label class="check">${t('it_adamantine')} <span class="hint">${t('it_adamantine_hint')}</span> <input type="checkbox" data-f="adamantine" ${it.adamantine ? 'checked' : ''} /></label>
  </div>` : ''}

  <fieldset class="inner">
    <legend>${t('it_behavior')} <span class="hint">${t('it_behavior_hint')}</span></legend>
    <div class="grid-3">
      <label>${t('ed_type')} <select data-f="kind">${opts(KINDS(), it.kind)}</select></label>
      ${it.kind !== 'passive' ? `<label>${t('ed_activation')} <select data-f="activation">${opts(ACTIVATIONS(), it.activation)}</select></label>` : ''}
    </div>
    ${isAttack ? `
    <div class="grid-3">
      <label>${t('ed_meleeranged')} <select data-f="attackType">${opts([['melee', t('opt_melee')], ['ranged', t('opt_ranged')]], it.attackType)}</select></label>
      <label>${t('ed_ability')} <select data-f="ability">${abilityOpts(it.ability)}</select></label>
      ${it.attackType === 'melee'
        ? `<label>${t('ed_reach')} <input type="number" data-f="reach" value="${esc(it.reach)}" /></label>`
        : `<label>${t('ed_range')} <span class="row"><input type="number" data-f="range" value="${esc(it.range)}" /><input type="number" data-f="longRange" value="${esc(it.longRange)}" /></span></label>`}
    </div>
    <div class="grid-3">
      <label>${t('ed_onhit')} <select data-f="onHit">${opts([['none', t('opt_onhit_none')], ['condition', t('opt_onhit_cond')], ['save', t('opt_onhit_save')]], it.onHit)}</select></label>
      ${it.onHit !== 'none' ? `
      <label>${t('ed_condition')} <select data-f="condition">${opts(CONDITION_OPTIONS, it.condition)}</select></label>
      <label>${t('ed_duration')} <span class="hint">${t('ed_dur_hint')}</span><input type="number" data-f="condRounds" value="${esc(it.condRounds)}" /></label>` : ''}
      ${it.onHit === 'save' ? `
      <label>${t('ed_save_avoid')} <select data-f="riderSaveAbility">${abilityOpts(it.riderSaveAbility)}</select></label>
      <label>${t('ed_dc_save')} <input type="number" data-f="riderDc" value="${esc(it.riderDc)}" /></label>` : ''}
    </div>` : ''}
    ${isSave ? `
    <div class="grid-3">
      <label>${t('ed_save_req')} <select data-f="saveAbility">${abilityOpts(it.saveAbility)}</select></label>
      <label>${t('ed_dc')} <input type="number" data-f="dc" value="${esc(it.dc)}" /></label>
      <label>${t('ed_onsave')} <select data-f="onSave">${opts([['none', t('opt_nodmg')], ['half', t('opt_halfdmg')]], it.onSave)}</select></label>
      <label>${t('ed_cond_fail')} <select data-f="condition">${opts([['', t('opt_none_f')], ...CONDITION_OPTIONS], it.condition)}</select></label>
      <label>${t('ed_duration')} <span class="hint">${t('ed_dur_hint')}</span><input type="number" data-f="condRounds" value="${esc(it.condRounds)}" /></label>
    </div>` : ''}
    ${hasDamage ? `<label>${t('ed_damage')} <span class="hint">${t('ed_damage_hint')}</span><input type="text" data-f="damage" value="${esc(it.damage)}" placeholder="${t('ed_damage_ph')}" /></label>` : ''}
    ${it.kind !== 'passive' ? `
    <div class="grid-3">
      <label>${t('ed_uses')} <select data-f="usesMode">${opts([['none', t('opt_unlimited')], ['recharge', t('opt_recharge')], ['day', t('opt_perday')]], it.usesMode)}</select></label>
      ${it.usesMode !== 'none' ? `<label>${it.usesMode === 'recharge' ? t('ed_recharge_x') : t('ed_uses_day')} <input type="number" data-f="usesValue" value="${esc(it.usesValue)}" /></label>` : ''}
    </div>` : ''}
  </fieldset>

  ${effectsSectionHtml(it, it.kind === 'passive')}

  <label>${t('ed_description')} <textarea data-f="description" rows="3">${esc(it.description)}</textarea></label>
  <label>${t('it_unidentified')} <span class="hint">${t('it_unidentified_hint')}</span><textarea data-f="unidentified" rows="2">${esc(it.unidentified)}</textarea></label>`;
}

// Campi che cambiano la struttura del form → serve ridisegnare.
const STRUCTURAL = ['itemType', 'kind', 'attackType', 'usesMode', 'onHit'];

function render() {
  document.getElementById('item-form-body').innerHTML = formHtml(state);
  renderPreview();
}

function renderPreview() {
  try {
    document.getElementById('item-preview').textContent = JSON.stringify(buildStandaloneItem(state), null, 2);
  } catch (err) {
    document.getElementById('item-preview').textContent = 'Errore: ' + err.message;
  }
}

export function getItemState() { return state; }

export function initItemTab({ onAddToBatch }) {
  addToBatch = onAddToBatch || (() => {});
  const body = document.getElementById('item-form-body');

  body.addEventListener('input', (ev) => {
    // Prima gli eventi della sezione effetti (add/remove/preset/changes).
    const res = applyEffectsEvent(state, ev);
    if (res.handled) { if (res.structural) render(); else renderPreview(); return; }
    const f = ev.target.dataset.f;
    if (!f) return;
    state[f] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    if (STRUCTURAL.includes(f)) render(); else renderPreview();
  });
  body.addEventListener('click', (ev) => {
    const res = applyEffectsEvent(state, ev);
    if (res.handled) { if (res.structural) render(); else renderPreview(); }
  });

  document.getElementById('item-export').addEventListener('click', exportItem);
  document.getElementById('item-batch').addEventListener('click', () => {
    const w = validateStandaloneItem(state);
    if (w.length) { document.getElementById('item-warn').textContent = '⛔ ' + w.join('  •  '); return; }
    document.getElementById('item-warn').textContent = '';
    addToBatch(buildStandaloneItem(state));
  });
  document.getElementById('item-copy').addEventListener('click', async () => {
    const btn = document.getElementById('item-copy');
    try { await navigator.clipboard.writeText(JSON.stringify(buildStandaloneItem(state), null, 2)); btn.textContent = t('copied'); }
    catch { btn.textContent = t('clip_denied'); }
    setTimeout(() => { btn.textContent = t('btn_copy'); }, 1600);
  });

  render();
}

function exportItem() {
  const warns = validateStandaloneItem(state);
  const warnBox = document.getElementById('item-warn');
  if (warns.length) { warnBox.textContent = '⛔ ' + warns.join('  •  '); return; }
  warnBox.textContent = '';
  const item = buildStandaloneItem(state);
  const slug = item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadJson(item, `fvttItem-${slug}.json`);
}
