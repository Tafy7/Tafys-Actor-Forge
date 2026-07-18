// ============================================================
// main.js — collega il form al builder.
// Flusso: input utente → readForm() → buildNpc() → anteprima/export.
// ============================================================
import { buildNpc, validateNpc } from './builders/npc.js';
import { validateActor } from './builders/validate.js';
import { parseStatblock, emptyTemplate } from './parsers/statblock.js';
// ?raw: Vite ci passa il CODICE della macro come stringa, senza eseguirlo.
// La macro vive come vero file .js (lintabile), qui la copiamo solo negli appunti.
import importerMacro from './foundry/import-actor.macro.js?raw';
import { downloadJson } from './utils/download.js';
import { ABILITIES, SIZES, CREATURE_TYPES } from './data/constants.js';
import { initItemsEditor, getItems, setItems } from './ui/items-editor.js';
import { createChipGroup } from './ui/chips.js';
import {
  DAMAGE_TYPES, CONDITIONS, LANGUAGES, CRS, ALIGNMENTS,
  DAMAGE_TYPE_LABELS, CONDITION_LABELS, LANGUAGE_LABELS, CREATURE_TYPE_LABELS,
  DAMAGE_TYPE_LABELS_EN, CONDITION_LABELS_EN, LANGUAGE_LABELS_EN, CREATURE_TYPE_LABELS_EN,
  DAMAGE_BYPASSES, BYPASS_LABELS, BYPASS_LABELS_EN, byLang,
} from './data/constants.js';
import { getLang, setLang, t, applyI18n } from './i18n.js';

const LANG = getLang();

// Le 18 skill di dnd5e: id interno → etichetta, in italiano e inglese.
const SKILLS_IT = {
  acr: 'Acrobazia', ani: 'Addestrare Animali', arc: 'Arcano', ath: 'Atletica',
  dec: 'Inganno', his: 'Storia', ins: 'Intuizione', itm: 'Intimidire',
  inv: 'Indagare', med: 'Medicina', nat: 'Natura', prc: 'Percezione',
  prf: 'Intrattenere', per: 'Persuasione', rel: 'Religione',
  slt: 'Rapidità di Mano', ste: 'Furtività', sur: 'Sopravvivenza',
};
const SKILLS_EN = {
  acr: 'Acrobatics', ani: 'Animal Handling', arc: 'Arcana', ath: 'Athletics',
  dec: 'Deception', his: 'History', ins: 'Insight', itm: 'Intimidation',
  inv: 'Investigation', med: 'Medicine', nat: 'Nature', prc: 'Perception',
  prf: 'Performance', per: 'Persuasion', rel: 'Religion',
  slt: 'Sleight of Hand', ste: 'Stealth', sur: 'Survival',
};
const SKILLS = LANG === 'en' ? SKILLS_EN : SKILLS_IT;

// ---------- Costruzione delle parti dinamiche del form ----------

function buildStaticOptions() {
  const sizeSelect = document.getElementById('size');
  for (const s of SIZES) {
    sizeSelect.add(new Option(LANG === 'en' ? s.en : s.label, s.id));
  }
  sizeSelect.value = 'med';

  const typeLabels = byLang(CREATURE_TYPE_LABELS, CREATURE_TYPE_LABELS_EN, LANG);
  const typeSelect = document.getElementById('creatureType');
  for (const ct of CREATURE_TYPES) {
    // Etichetta localizzata, id inglese come value (è quello che va nel JSON).
    typeSelect.add(new Option(typeLabels[ct] ?? ct, ct));
  }
  typeSelect.value = 'humanoid';

  const crSelect = document.getElementById('cr');
  for (const cr of CRS) crSelect.add(new Option(cr, cr));
  crSelect.value = '1';

  const alignList = document.getElementById('alignments-list');
  for (const a of ALIGNMENTS) alignList.appendChild(new Option(a));
}

// ---------- Chip group dei tratti ----------
// Ogni gruppo espone getValue() nello stesso formato testuale che il
// builder già capisce ("fire, cold, voce custom"): npc.js resta intatto.
const traitGroups = {};

function buildTraitChips() {
  // I tratti di danno hanno anche i chip "bypass" (schema dnd5e traits.*.bypasses):
  // cliccando "solo non magici" le resistenze FISICHE selezionate valgono solo
  // contro attacchi non magici, come per Zariel nel golden template.
  const damageIds = [...DAMAGE_TYPES, ...Object.keys(DAMAGE_BYPASSES)];
  const damageLabels = {
    ...byLang(DAMAGE_TYPE_LABELS, DAMAGE_TYPE_LABELS_EN, LANG),
    ...byLang(BYPASS_LABELS, BYPASS_LABELS_EN, LANG),
  };
  const groups = [
    ['dr', damageIds, damageLabels],
    ['di', damageIds, damageLabels],
    ['dv', damageIds, damageLabels],
    ['ci', CONDITIONS, byLang(CONDITION_LABELS, CONDITION_LABELS_EN, LANG)],
    ['languages', LANGUAGES, byLang(LANGUAGE_LABELS, LANGUAGE_LABELS_EN, LANG)],
  ];
  for (const [key, ids, labels] of groups) {
    traitGroups[key] = createChipGroup({
      container: document.getElementById(`chips-${key}`),
      ids, labels,
    });
  }
}

function buildAbilitiesGrid() {
  const grid = document.getElementById('abilities-grid');
  for (const ab of ABILITIES) {
    const label = document.createElement('label');
    label.innerHTML = `
      ${LANG === 'en' ? ab.en : ab.label}
      <input type="number" id="${ab.id}" min="1" max="30" value="10" />
      <span class="check small">${t('ab_save')} <input type="checkbox" data-save="${ab.id}" /></span>
    `;
    grid.appendChild(label);
  }
}

function buildSkillsGrid() {
  const grid = document.getElementById('skills-grid');
  for (const [id, label] of Object.entries(SKILLS)) {
    const wrap = document.createElement('label');
    wrap.innerHTML = `
      ${label}
      <select data-skill="${id}">
        <option value="0">${t('sk_none')}</option>
        <option value="1">${t('sk_prof')}</option>
        <option value="2">${t('sk_exp')}</option>
      </select>
    `;
    grid.appendChild(wrap);
  }
}

// ---------- Lettura del form in un oggetto piatto ----------

const val = (id) => document.getElementById(id).value;

function readForm() {
  const skills = {};
  for (const sel of document.querySelectorAll('[data-skill]')) {
    if (sel.value !== '0') skills[sel.dataset.skill] = sel.value;
  }
  const saves = [...document.querySelectorAll('[data-save]:checked')]
    .map(cb => cb.dataset.save);

  return {
    name: val('name'), size: val('size'), creatureType: val('creatureType'),
    subtype: val('subtype'), alignment: val('alignment'), cr: val('cr'),
    rules: val('rules'),
    str: val('str'), dex: val('dex'), con: val('con'),
    int: val('int'), wis: val('wis'), cha: val('cha'),
    saves, skills,
    hpMax: val('hpMax'), hpFormula: val('hpFormula'),
    acCalc: val('acCalc'), acFlat: val('acFlat'),
    walk: val('walk'), fly: val('fly'), swim: val('swim'),
    climb: val('climb'), burrow: val('burrow'),
    hover: document.getElementById('hover').checked,
    darkvision: val('darkvision'), blindsight: val('blindsight'),
    tremorsense: val('tremorsense'), truesight: val('truesight'),
    telepathy: val('telepathy'),
    dr: traitGroups.dr.getValue(), di: traitGroups.di.getValue(),
    dv: traitGroups.dv.getValue(), ci: traitGroups.ci.getValue(),
    languages: traitGroups.languages.getValue(),
    legact: val('legact'), legres: val('legres'),
    img: val('img'), tokenImg: val('tokenImg'), bio: val('bio'),
    items: getItems(), // descrittori delle azioni/tratti (ui/items-editor.js)
  };
}

// ---------- Anteprima live ed export ----------

const escHtml = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** Disegna il pannello di validazione strutturale (verde se tutto ok). */
function renderValidation(issues) {
  const box = document.getElementById('validation');
  if (!issues.length) {
    box.className = 'val ok';
    box.textContent = t('val_ok');
    return;
  }
  const errors = issues.filter(i => i.level === 'error');
  const warns = issues.filter(i => i.level === 'warn');
  box.className = 'val' + (errors.length ? ' has-error' : ' has-warn');
  // Plurale it/en gestito col segnaposto {s} nel dizionario.
  const plur = (n) => (LANG === 'en' ? (n > 1 ? 's' : '') : (n > 1 ? 'i' : 'e'));
  const parts = [];
  if (errors.length) parts.push(t('val_errors', { n: errors.length, s: plur(errors.length) }));
  if (warns.length) parts.push(t('val_warns', { n: warns.length, s: LANG === 'en' ? (warns.length > 1 ? 's' : '') : (warns.length > 1 ? 'i' : 'o') }));
  const head = parts.join(' · ');
  const li = (i) => `<li class="${i.level}">${escHtml(i.msg)}</li>`;
  box.innerHTML = `<div class="val-head">${head}</div><ul>${errors.map(li).join('')}${warns.map(li).join('')}</ul>`;
}

// L'anteprima+validazione ricostruiscono l'actor e ristampano il JSON:
// per un mostro grande è lavoro non banale. Se lo lanciassimo a ogni
// singolo tasto (evento 'input'), la digitazione risulterebbe a scatti.
// Lo "debounciamo": gira una volta ~120ms dopo che smetti di scrivere,
// così i campi e i menu restano sempre reattivi.
let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 120);
}

function renderPreview() {
  try {
    const actor = buildNpc(readForm());
    document.getElementById('preview').textContent = JSON.stringify(actor, null, 2);
    // Validazione strutturale live: confronta il JSON coi golden template.
    renderValidation(validateActor(actor));
  } catch (err) {
    // Se qualcosa va storto lo mostriamo nell'anteprima invece di rompere la pagina.
    document.getElementById('preview').textContent = `Errore: ${err.message}`;
    document.getElementById('validation').className = 'val';
    document.getElementById('validation').textContent = '';
    console.error(err);
  }
}

// ---------- Bozze: salvataggio/caricamento + autosave ----------
// Il file di bozza NON è il JSON di Foundry: è lo stato del form
// (l'output di readForm), così ricaricarlo ripopola ogni campo.

const DRAFT_KEY = 'tafys-forge-draft';

function restoreForm(state) {
  if (!state || typeof state !== 'object') return;
  // Campi semplici: stesso id nel form e nello stato.
  for (const [key, value] of Object.entries(state)) {
    const el = document.getElementById(key);
    if (!el || typeof value === 'object') continue;
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value;
  }
  // Skill e competenze nei TS (vivono in data-attribute, non in id).
  for (const sel of document.querySelectorAll('[data-skill]')) {
    sel.value = state.skills?.[sel.dataset.skill] ?? '0';
  }
  for (const cb of document.querySelectorAll('[data-save]')) {
    cb.checked = (state.saves || []).includes(cb.dataset.save);
  }
  // I tratti vivono nei chip group, non in input con id.
  for (const key of ['dr', 'di', 'dv', 'ci', 'languages']) {
    traitGroups[key]?.setValue(state[key] || '');
  }
  setItems(state.items);
  renderPreview();
}

function saveDraftFile() {
  const state = readForm();
  const slug = (state.name || 'senza-nome').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadJson({ app: 'tafys-actor-forge', version: 1, savedAt: new Date().toISOString(), ...state }, `bozza-${slug}.json`);
}

function loadDraftFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      restoreForm(JSON.parse(reader.result));
    } catch {
      document.getElementById('warnings').textContent = t('draft_invalid');
    }
  };
  reader.readAsText(file);
}

// Autosave: a ogni modifica lo stato finisce in localStorage (con un
// piccolo debounce per non scrivere a ogni singolo tasto premuto).
let autosaveTimer;
function autosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(readForm())); } catch { /* storage pieno o disabilitato: pazienza */ }
  }, 400);
}

function exportJson() {
  const data = readForm();
  const warnBox = document.getElementById('warnings');

  let actor;
  try {
    actor = buildNpc(data);
  } catch (err) {
    warnBox.textContent = t('build_err') + err.message;
    return;
  }

  // Due livelli di controllo prima di scaricare:
  //  - validateNpc: problemi del FORM (nome/HP/CA mancanti, danni malformati);
  //  - validateActor: errori STRUTTURALI del JSON (chiavi estranee, riferimenti
  //    pendenti, immagini non valide) — solo il livello 'error' blocca.
  const formIssues = validateNpc(data);
  const structErrors = validateActor(actor).filter(i => i.level === 'error').map(i => i.msg);
  const blocking = [...formIssues, ...structErrors];
  if (blocking.length) {
    warnBox.textContent = '⛔ ' + blocking.join('  •  ');
    return; // non esportiamo un JSON che Foundry rifiuterebbe o che è rotto
  }
  warnBox.textContent = '';

  // Nome file nello stesso stile degli export di Foundry.
  const slug = actor.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadJson(actor, `fvttActor-${slug}.json`);
}

// ---------- Conferma NON bloccante ----------
// I dialog nativi confirm()/alert() BLOCCANO tutti gli eventi della pagina
// e negli webview embedded (es. il browser di VS Code) possono far sembrare
// l'app piantata. Li sostituiamo con un doppio-click: il primo "arma" il
// pulsante (cambia testo), il secondo entro 4s esegue l'azione.
const _armed = new WeakMap();
function armedConfirm(btn, confirmLabel, action) {
  if (_armed.has(btn)) {
    clearTimeout(_armed.get(btn).timer);
    btn.textContent = _armed.get(btn).original;
    btn.classList.remove('armed');
    _armed.delete(btn);
    action();
    return;
  }
  const original = btn.textContent;
  btn.textContent = confirmLabel;
  btn.classList.add('armed');
  const timer = setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('armed');
    _armed.delete(btn);
  }, 4000);
  _armed.set(btn, { original, timer });
}

// ---------- Import da statblock (Fase 4) ----------
// Il parser produce uno stato PARZIALE del form: lo appoggiamo sopra i
// default di una scheda vuota, così i campi non riconosciuti tornano
// puliti invece di restare sporchi del mostro precedente.

const DEFAULT_STATE = {
  name: '', size: 'med', creatureType: 'humanoid', subtype: '',
  alignment: '', cr: '1', rules: '2014',
  str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10',
  saves: [], skills: {},
  hpMax: '', hpFormula: '', acCalc: 'default', acFlat: '',
  walk: '30', fly: '', swim: '', climb: '', burrow: '', hover: false,
  darkvision: '', blindsight: '', tremorsense: '', truesight: '', telepathy: '',
  dr: '', di: '', dv: '', ci: '', languages: '',
  legact: '', legres: '', img: '', tokenImg: '', bio: '',
  items: [],
};

function applyStatblock() {
  const text = document.getElementById('statblock-input').value;
  const reportBox = document.getElementById('parse-report');
  if (!text.trim()) {
    reportBox.hidden = false;
    reportBox.textContent = t('sb_paste_first');
    return;
  }

  const { state, report } = parseStatblock(text);
  restoreForm({ ...DEFAULT_STATE, ...state });
  autosave();

  // Report leggibile: cosa ho capito, dove ho tirato a indovinare,
  // cosa ho ignorato del tutto (da ricopiare a mano).
  const lines = [];
  lines.push(`${t('sb_head_ok')} (${report.ok.length}):`);
  for (const r of report.ok) lines.push(`   ${r}`);
  if (report.warn.length) {
    lines.push('', `${t('sb_head_warn')} (${report.warn.length}):`);
    for (const r of report.warn) lines.push(`   ${r}`);
  }
  if (report.skipped.length) {
    lines.push('', `${t('sb_head_skip')} (${report.skipped.length}):`);
    for (const r of report.skipped) lines.push(`   ${r.slice(0, 120)}${r.length > 120 ? '…' : ''}`);
  }
  lines.push('', t('sb_reminder'));
  reportBox.hidden = false;
  reportBox.textContent = lines.join('\n');
}

async function copyTemplate() {
  const btn = document.getElementById('btn-copy-template');
  try {
    await navigator.clipboard.writeText(emptyTemplate());
    btn.textContent = t('tpl_copied');
  } catch {
    // Clipboard negata (es. permessi browser): lo mettiamo nella textarea.
    document.getElementById('statblock-input').value = emptyTemplate();
    btn.textContent = t('tpl_inserted');
  }
  setTimeout(() => { btn.textContent = t('sb_template'); }, 2000);
}

// ---------- Collezione batch (Fase 5) ----------
// Accumula più actor già costruiti e li esporta come UN unico file JSON
// che è un ARRAY: si incolla una volta sola nella macro importer, che li
// crea tutti insieme. La collezione è persistita in localStorage così non
// la perdi ricaricando (è separata dalla bozza del form in corso).

const BATCH_KEY = 'tafys-forge-batch';
let batch = [];

function loadBatch() {
  try { batch = JSON.parse(localStorage.getItem(BATCH_KEY)) || []; }
  catch { batch = []; }
  updateBatchUI();
}
function saveBatch() {
  try { localStorage.setItem(BATCH_KEY, JSON.stringify(batch)); } catch { /* storage pieno */ }
}
function updateBatchUI() {
  document.getElementById('batch-count').textContent = batch.length;
  document.getElementById('btn-batch-export').disabled = batch.length === 0;
  document.getElementById('btn-batch-clear').disabled = batch.length === 0;
}
function batchMsg(text) {
  const el = document.getElementById('batch-msg');
  el.textContent = text;
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3000);
}

/** Aggiunge il mostro corrente alla collezione, ma solo se è valido. */
function addToBatch() {
  const data = readForm();
  let actor;
  try {
    actor = buildNpc(data);
  } catch (err) {
    batchMsg('⛔ ' + err.message);
    return;
  }
  const blocking = [
    ...validateNpc(data),
    ...validateActor(actor).filter(i => i.level === 'error').map(i => i.msg),
  ];
  if (blocking.length) {
    document.getElementById('warnings').textContent = t('correct_add') + blocking.join('  •  ');
    batchMsg(t('batch_correct'));
    return;
  }
  batch.push(actor);
  saveBatch();
  updateBatchUI();
  batchMsg(t('batch_added', { name: actor.name, n: batch.length }));
}

/** Scarica tutta la collezione come un array JSON, pronto per la macro. */
function exportBatch() {
  if (!batch.length) return;
  downloadJson(batch, `fvttActors-batch-${batch.length}.json`);
}

function clearBatch() {
  if (!batch.length) return;
  batch = [];
  saveBatch();
  updateBatchUI();
  batchMsg(t('batch_cleared'));
}

// ---------- Macro importer per Foundry ----------
// Copia negli appunti il codice della macro (import ?raw qui sopra): la
// incolli UNA volta in una macro Foundry di tipo Script e poi importi gli
// actor incollando il loro JSON, senza il giro "crea vuoto → Import Data".

async function copyMacro() {
  const btn = document.getElementById('btn-copy-macro');
  try {
    await navigator.clipboard.writeText(importerMacro);
    btn.textContent = t('macro_copied');
  } catch {
    // Clipboard negata: la scarichiamo come file, così l'utente la apre e copia.
    const blob = new Blob([importerMacro], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'actor-forge-importer.macro.js';
    a.click();
    URL.revokeObjectURL(url);
    btn.textContent = t('macro_downloaded');
  }
  setTimeout(() => { btn.textContent = t('main_copymacro'); }, 2000);
}

// Copia l'intero JSON dell'anteprima negli appunti. Ricostruiamo l'actor
// al volo (così copiamo JSON valido anche se l'anteprima mostrasse un
// errore parziale) e ripieghiamo sul testo dell'anteprima in caso di guai.
async function copyPreview() {
  const btn = document.getElementById('btn-copy-preview');
  let text;
  try {
    text = JSON.stringify(buildNpc(readForm()), null, 2);
  } catch {
    text = document.getElementById('preview').textContent;
  }
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = t('copied');
  } catch {
    btn.textContent = t('clip_denied');
  }
  setTimeout(() => { btn.textContent = t('btn_copy'); }, 1800);
}

// ---------- Avvio ----------

// i18n: traduce i testi statici dell'HTML e imposta il pulsante lingua.
applyI18n(document);
document.documentElement.lang = LANG;
const langBtn = document.getElementById('btn-lang');
langBtn.textContent = t('langToggle');
langBtn.addEventListener('click', () => setLang(LANG === 'en' ? 'it' : 'en'));

buildStaticOptions();
buildAbilitiesGrid();
buildSkillsGrid();
buildTraitChips();
initItemsEditor({
  listEl: document.getElementById('items-list'),
  addBtn: document.getElementById('btn-add-item'),
  onChange: () => { schedulePreview(); autosave(); },
});
// L'input nella casella statblock NON deve rigenerare anteprima/validazione:
// non fa parte dell'actor. Lo escludiamo dal ciclo (perf + niente churn).
document.getElementById('npc-form').addEventListener('input', (ev) => {
  if (ev.target.id === 'statblock-input') return;
  schedulePreview();
  autosave();
});
document.getElementById('btn-export').addEventListener('click', exportJson);
// Analizza: se il form ha già dati, chiediamo conferma (non bloccante) prima
// di sovrascrivere; se è vuoto, importiamo subito.
document.getElementById('btn-parse-statblock').addEventListener('click', (ev) => {
  const hasData = document.getElementById('name').value.trim() || getItems().length > 0;
  if (hasData && document.getElementById('statblock-input').value.trim()) {
    armedConfirm(ev.currentTarget, t('sb_confirm_btn'), applyStatblock);
  } else {
    applyStatblock();
  }
});
document.getElementById('btn-copy-template').addEventListener('click', copyTemplate);
document.getElementById('btn-copy-macro').addEventListener('click', copyMacro);
document.getElementById('btn-copy-preview').addEventListener('click', copyPreview);
document.getElementById('btn-batch-add').addEventListener('click', addToBatch);
document.getElementById('btn-batch-export').addEventListener('click', exportBatch);
document.getElementById('btn-batch-clear').addEventListener('click', (ev) => {
  if (!batch.length) return;
  armedConfirm(ev.currentTarget, t('batch_confirm_btn'), clearBatch);
});
loadBatch();

// Bozze
document.getElementById('btn-save-draft').addEventListener('click', saveDraftFile);
document.getElementById('btn-load-draft').addEventListener('click', () => document.getElementById('draft-file').click());
document.getElementById('draft-file').addEventListener('change', (ev) => {
  if (ev.target.files[0]) loadDraftFile(ev.target.files[0]);
  ev.target.value = ''; // permette di ricaricare lo stesso file due volte
});
document.getElementById('btn-new').addEventListener('click', (ev) => {
  armedConfirm(ev.currentTarget, t('new_confirm_btn'), () => {
    localStorage.removeItem(DRAFT_KEY);
    location.reload();
  });
});

// All'avvio: se c'è una bozza autosalvata, la ripristiniamo.
try {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) restoreForm(JSON.parse(saved));
} catch { /* bozza corrotta: si riparte puliti */ }

renderPreview(); // prima anteprima
