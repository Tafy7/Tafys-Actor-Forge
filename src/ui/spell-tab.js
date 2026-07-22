// ============================================================
// Tab "Incantesimo" — crea una Spell STANDALONE ed esporta il JSON.
// Stesso pattern della Tab Item: stato singolo, form rigenerato sui
// campi strutturali, sezione effetti DAE condivisa (applyEffectsEvent),
// builder in builders/spell.js (schema dai 12 golden spell).
// ============================================================
import { buildSpell, validateSpell, SPELL_SCHOOLS, CAST_METHODS, TEMPLATE_TYPES, DURATION_UNITS } from '../builders/spell.js';
import { effectsSectionHtml, applyEffectsEvent } from './effects-editor.js';
import { aaSectionHtml, applyAAEvent, loadAAIndex, aaIndexReady } from './aa-editor.js';
import { defaultAA } from '../builders/aa.js';
import { applyOnUseEvent } from './onuse-editor.js';
import { extrasSectionHtml } from './extras-editor.js';
import { ABILITIES, CONDITIONS, CONDITION_LABELS, CONDITION_LABELS_EN, byLang } from '../data/constants.js';
import { downloadJson } from '../utils/download.js';
import { t, getLang } from '../i18n.js';

const LANG = getLang();
const condLabels = byLang(CONDITION_LABELS, CONDITION_LABELS_EN, LANG);
const CONDITION_OPTIONS = CONDITIONS.map(c => [c, condLabels[c] ?? c]);
const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abEn = LANG === 'en';

let state = defaultSpell();
let addToBatch = () => {};

function defaultSpell() {
  return {
    name: '', img: '', description: '', rules: '2014',
    sourceBook: '', sourcePage: '',
    level: '1', school: 'evo',
    vocal: true, somatic: true, material: false, materialText: '', materialConsumed: false,
    concentration: false, ritual: false, method: 'spell',
    activation: 'action', castValue: '1',
    rangeMode: 'ft', rangeValue: '60',
    targetMode: 'creature', targetCount: '1', templateType: 'sphere', templateSize: '20',
    durationValue: '1', durationUnits: 'inst',
    kind: 'save', attackType: 'ranged', ability: 'str', reach: '5', range: '30', longRange: '',
    damage: '', dcMode: 'spellcasting', saveAbility: 'dex', dc: '', onSave: 'half',
    onHit: 'none', condition: 'prone', condRounds: '',
    riderSaveAbility: 'con', riderDc: '',
    upcastFormula: '', usesMode: 'none', usesValue: '',
    effects: [],
    aa: defaultAA(),
    onUse: [],
  };
}

const opts = (pairs, sel) => pairs.map(([v, l]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${l}</option>`).join('');
const abilityOpts = (sel) => ABILITIES.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${abEn ? a.en : a.label}</option>`).join('');

const LEVELS = () => [['0', t('sp_cantrip')], ...Array.from({ length: 9 }, (_, i) => [String(i + 1), `${i + 1}°`])];
const SCHOOL_OPTS = () => SPELL_SCHOOLS.map(s => [s, t('sch_' + s)]);
const METHOD_OPTS = () => CAST_METHODS.map(m => [m, t('mth_' + m)]);
const TEMPLATE_OPTS = () => TEMPLATE_TYPES.map(x => [x, t('tpl_' + x)]);
const DUR_OPTS = () => DURATION_UNITS.map(u => [u, t('dur_' + u)]);
const ACTIVATIONS = () => [
  ['action', t('act_action')], ['bonus', t('act_bonus')], ['reaction', t('act_reaction')],
  ['minute', t('act_minute')], ['special', t('act_special')],
];

function formHtml(it) {
  const isAttack = it.kind === 'attack';
  const isSave = it.kind === 'save';
  return `
  <div class="grid-3">
    <label>${t('ed_name')} <input type="text" data-f="name" value="${esc(it.name)}" placeholder="${t('sp_name_ph')}" /></label>
    <label>${t('sp_level')} <select data-f="level">${opts(LEVELS(), it.level)}</select></label>
    <label>${t('sp_school')} <select data-f="school">${opts(SCHOOL_OPTS(), it.school)}</select></label>
    <label>${t('f_rules')} <select data-f="rules">${opts([['2014', t('rules_2014')], ['2024', t('rules_2024')]], it.rules)}</select></label>
    <label>${t('sp_method')} <span class="hint">${t('sp_method_hint')}</span><select data-f="method">${opts(METHOD_OPTS(), it.method)}</select></label>
    <label>${t('ed_icon')} <input type="text" data-f="img" value="${esc(it.img)}" placeholder="icons/..." /></label>
    <label>${t('src_book')} <input type="text" data-f="sourceBook" value="${esc(it.sourceBook)}" placeholder="${t('src_book_ph')}" /></label>
    <label>${t('src_page')} <input type="text" data-f="sourcePage" value="${esc(it.sourcePage)}" placeholder="241" /></label>
  </div>

  <div class="grid-6 sp-comps">
    <label class="check">V <input type="checkbox" data-f="vocal" ${it.vocal ? 'checked' : ''} /></label>
    <label class="check">S <input type="checkbox" data-f="somatic" ${it.somatic ? 'checked' : ''} /></label>
    <label class="check">M <input type="checkbox" data-f="material" ${it.material ? 'checked' : ''} /></label>
    <label class="check">${t('sp_conc')} <input type="checkbox" data-f="concentration" ${it.concentration ? 'checked' : ''} /></label>
    <label class="check">${t('sp_ritual')} <input type="checkbox" data-f="ritual" ${it.ritual ? 'checked' : ''} /></label>
  </div>
  ${it.material ? `
  <div class="grid-3">
    <label>${t('sp_material')} <input type="text" data-f="materialText" value="${esc(it.materialText)}" placeholder="${t('sp_material_ph')}" /></label>
    <label class="check">${t('sp_consumed')} <input type="checkbox" data-f="materialConsumed" ${it.materialConsumed ? 'checked' : ''} /></label>
  </div>` : ''}

  <div class="grid-3">
    <label>${t('sp_cast')} <select data-f="activation">${opts(ACTIVATIONS(), it.activation)}</select></label>
    ${it.activation === 'minute' ? `<label>${t('sp_cast_min')} <input type="number" data-f="castValue" value="${esc(it.castValue)}" /></label>` : ''}
    <label>${t('sp_range')} <select data-f="rangeMode">${opts([['ft', t('rng_ft')], ['touch', t('rng_touch')], ['self', t('rng_self')], ['mi', t('rng_mi')]], it.rangeMode)}</select></label>
    ${(it.rangeMode === 'ft' || it.rangeMode === 'mi') ? `<label>${it.rangeMode === 'mi' ? t('rng_mi') : t('sp_range_val')} <input type="number" data-f="rangeValue" value="${esc(it.rangeValue)}" /></label>` : ''}
  </div>

  <div class="grid-3">
    <label>${t('sp_target')} <select data-f="targetMode">${opts([
      ['creature', t('tgt_creature')], ['template', t('tgt_template')], ['self', t('tgt_self')], ['', t('tgt_none')],
    ], it.targetMode)}</select></label>
    ${it.targetMode === 'creature' ? `<label>${t('sp_target_n')} <input type="text" data-f="targetCount" value="${esc(it.targetCount)}" /></label>` : ''}
    ${it.targetMode === 'template' ? `
    <label>${t('sp_tpl_type')} <select data-f="templateType">${opts(TEMPLATE_OPTS(), it.templateType)}</select></label>
    <label>${t('sp_tpl_size')} <input type="number" data-f="templateSize" value="${esc(it.templateSize)}" /></label>` : ''}
  </div>

  <div class="grid-3">
    <label>${t('sp_duration')} <select data-f="durationUnits">${opts(DUR_OPTS(), it.durationUnits)}</select></label>
    ${it.durationUnits !== 'inst' ? `<label>${t('sp_dur_val')} <input type="number" data-f="durationValue" value="${esc(it.durationValue)}" /></label>` : ''}
  </div>

  <fieldset class="inner">
    <legend>${t('it_behavior')} <span class="hint">${t('sp_behavior_hint')}</span></legend>
    <div class="grid-3">
      <label>${t('ed_type')} <select data-f="kind">${opts([
        ['save', t('opt_save')], ['attack', t('sp_attack')], ['utility', t('opt_utility')],
      ], it.kind)}</select></label>
    </div>
    ${isAttack ? `
    <div class="grid-3">
      <label>${t('ed_meleeranged')} <span class="hint">${t('sp_atk_hint')}</span><select data-f="attackType">${opts([['melee', t('opt_melee')], ['ranged', t('opt_ranged')]], it.attackType)}</select></label>
      <label>${t('ed_onhit')} <select data-f="onHit">${opts([['none', t('opt_onhit_none')], ['condition', t('opt_onhit_cond')], ['save', t('opt_onhit_save')]], it.onHit)}</select></label>
      ${it.onHit !== 'none' ? `<label>${t('ed_condition')} <select data-f="condition">${opts(CONDITION_OPTIONS, it.condition)}</select></label>` : ''}
      ${it.onHit === 'save' ? `
      <label>${t('ed_save_avoid')} <select data-f="riderSaveAbility">${abilityOpts(it.riderSaveAbility)}</select></label>
      <label>${t('ed_dc_save')} <input type="number" data-f="riderDc" value="${esc(it.riderDc)}" /></label>` : ''}
    </div>` : ''}
    ${isSave ? `
    <div class="grid-3">
      <label>${t('ed_save_req')} <select data-f="saveAbility">${abilityOpts(it.saveAbility)}</select></label>
      <label>${t('sp_dc')} <select data-f="dcMode">${opts([['spellcasting', t('dc_auto')], ['flat', t('dc_flat')]], it.dcMode)}</select></label>
      ${it.dcMode === 'flat' ? `<label>${t('ed_dc')} <input type="number" data-f="dc" value="${esc(it.dc)}" /></label>` : ''}
      <label>${t('ed_onsave')} <select data-f="onSave">${opts([['none', t('opt_nodmg')], ['half', t('opt_halfdmg')]], it.onSave)}</select></label>
      <label>${t('ed_cond_fail')} <select data-f="condition">${opts([['', t('opt_none_f')], ...CONDITION_OPTIONS], it.condition)}</select></label>
      <label>${t('ed_duration')} <span class="hint">${t('ed_dur_hint')}</span><input type="number" data-f="condRounds" value="${esc(it.condRounds)}" /></label>
    </div>` : ''}
    ${(isAttack || isSave) ? `
    <div class="grid-2">
      <label>${t('ed_damage')} <span class="hint">${t('ed_damage_hint')}</span><input type="text" data-f="damage" value="${esc(it.damage)}" placeholder="8d6 fire" /></label>
      <label>${t('sp_upcast')} <span class="hint">${t('sp_upcast_hint')}</span><input type="text" data-f="upcastFormula" value="${esc(it.upcastFormula)}" placeholder="1d6" /></label>
    </div>` : ''}
    <div class="grid-3">
      <label>${t('ed_uses')} <select data-f="usesMode">${opts([['none', t('opt_unlimited')], ['day', t('opt_perday')]], it.usesMode)}</select></label>
      ${it.usesMode !== 'none' ? `<label>${t('ed_uses_day')} <input type="number" data-f="usesValue" value="${esc(it.usesValue)}" /></label>` : ''}
    </div>
  </fieldset>

  ${extrasSectionHtml(it, false)}

  <label>${t('ed_description')} <textarea data-f="description" rows="3">${esc(it.description)}</textarea></label>`;
}

// Campi che cambiano la struttura del form → serve ridisegnare.
const STRUCTURAL = ['kind', 'attackType', 'onHit', 'dcMode', 'targetMode', 'rangeMode', 'activation', 'usesMode', 'material', 'durationUnits'];

function render() {
  document.getElementById('spell-form-body').innerHTML = formHtml(state);
  renderPreview();
  // Indice JB2A in lazy (vedi item-tab): carica e ridisegna al primo uso.
  if (state.aa.enabled && !aaIndexReady()) loadAAIndex().then(render);
}

function renderPreview() {
  try {
    document.getElementById('spell-preview').textContent = JSON.stringify(buildSpell(state), null, 2);
  } catch (err) {
    document.getElementById('spell-preview').textContent = 'Errore: ' + err.message;
  }
}

export function initSpellTab({ onAddToBatch }) {
  addToBatch = onAddToBatch || (() => {});
  const body = document.getElementById('spell-form-body');

  body.addEventListener('input', (ev) => {
    const res = applyEffectsEvent(state, ev);
    if (res.handled) { if (res.structural) render(); else renderPreview(); return; }
    const aaRes = applyAAEvent(state, ev);
    if (aaRes.handled) { if (aaRes.structural) render(); else renderPreview(); return; }
    const ouRes = applyOnUseEvent(state, ev);
    if (ouRes.handled) { if (ouRes.structural) render(); else renderPreview(); return; }
    const f = ev.target.dataset.f;
    if (!f) return;
    state[f] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    if (STRUCTURAL.includes(f)) render(); else renderPreview();
  });
  // Stato aperto/chiuso delle sezioni a scomparsa (details): va ricordato
  // nello stato, altrimenti ogni re-render strutturale le richiuderebbe.
  // 'toggle' non fa bubbling → serve la fase di capture.
  body.addEventListener('toggle', (ev) => {
    const k = ev.target.dataset?.open;
    if (k) state[k] = ev.target.open;
  }, true);
  body.addEventListener('click', (ev) => {
    const res = applyEffectsEvent(state, ev);
    if (res.handled) { if (res.structural) render(); else renderPreview(); return; }
    const ouRes = applyOnUseEvent(state, ev);
    if (ouRes.handled) { if (ouRes.structural) render(); else renderPreview(); }
  });

  document.getElementById('spell-export').addEventListener('click', exportSpell);
  document.getElementById('spell-batch').addEventListener('click', () => {
    const w = validateSpell(state);
    if (w.length) { document.getElementById('spell-warn').textContent = '⛔ ' + w.join('  •  '); return; }
    document.getElementById('spell-warn').textContent = '';
    addToBatch(buildSpell(state));
  });
  document.getElementById('spell-copy').addEventListener('click', async () => {
    const btn = document.getElementById('spell-copy');
    try { await navigator.clipboard.writeText(JSON.stringify(buildSpell(state), null, 2)); btn.textContent = t('copied'); }
    catch { btn.textContent = t('clip_denied'); }
    setTimeout(() => { btn.textContent = t('btn_copy'); }, 1600);
  });

  render();
}

function exportSpell() {
  const warns = validateSpell(state);
  const warnBox = document.getElementById('spell-warn');
  if (warns.length) { warnBox.textContent = '⛔ ' + warns.join('  •  '); return; }
  warnBox.textContent = '';
  const spell = buildSpell(state);
  const slug = spell.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadJson(spell, `fvttSpell-${slug}.json`);
}
