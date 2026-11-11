// ============================================================
// main.js — collega il form al builder.
// Flusso: input utente → readForm() → buildNpc() → anteprima/export.
// ============================================================
import { buildNpc, validateNpc } from './builders/npc.js';
import { validateActor } from './builders/validate.js';
import { overlayActor } from './builders/actor-overlay.js';
import { parseStatblock, emptyTemplate } from './parsers/statblock.js';
import { importActor, itemToDescriptor } from './parsers/actor-import.js';
import { importItem, importSpell } from './parsers/item-import.js';
import { initDprTab } from './ui/dpr-tab.js';
import { initItemTab, editItemFromSheet, itemTabBusy } from './ui/item-tab.js';
import { initSpellTab, editSpellFromSheet, spellTabBusy } from './ui/spell-tab.js';
import { initInfoTab } from './ui/info-tab.js';
import { initThemePicker } from './ui/theme.js';
import { initSectionNav } from './ui/section-nav.js';
import { initSkillPills, initDamageMatrix, syncStudioWidgets } from './ui/studio-widgets.js';
import { initSpellcastingSection, syncSpellcastingSection } from './ui/spellcasting-section.js';
import { initCRReadout, renderCR } from './ui/cr-readout.js';
import { initEncounterTab } from './ui/encounter-tab.js';
// ?raw: Vite ci passa il CODICE della macro come stringa, senza eseguirlo.
// La macro vive come vero file .js (lintabile), qui la copiamo solo negli appunti.
import importerMacro from './foundry/import-actor.macro.js?raw';
import { downloadJson } from './utils/download.js';
import { esc } from './utils/html.js';
import { armedConfirm } from './utils/confirm.js';
import { ABILITIES, SIZES, CREATURE_TYPES } from './data/constants.js';
import { initItemsEditor, getItems, setItems, refreshItems, addItem } from './ui/items-editor.js';
import { createChipGroup } from './ui/chips.js';
import { initMobile } from './ui/mobile.js';
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
        <option value="0.5">${t('sk_half')}</option>
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
    rules: val('rules'), sourceBook: val('sourceBook'), sourcePage: val('sourcePage'),
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
  const li = (i) => `<li class="${i.level}">${esc(i.msg)}</li>`;
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
    const data = readForm();
    const cur = buildCurrentActor(data);
    document.getElementById('preview').textContent = JSON.stringify(cur.actor, null, 2);
    // Validazione strutturale live: confronta il JSON coi golden template.
    renderValidation(cur.validation);
    renderReloadBanner(cur.ov);
    // Cartellino CR stimato (metodo DMG) — a lato dell'anteprima.
    renderCR(calcView(data));
  } catch (err) {
    // Se qualcosa va storto lo mostriamo nell'anteprima invece di rompere la pagina.
    document.getElementById('preview').textContent = `Errore: ${err.message}`;
    document.getElementById('validation').className = 'val';
    document.getElementById('validation').textContent = '';
    console.error(err);
  }
}

// ---------- Voci create nelle tab Oggetto / Incantesimo ----------
// Entrano nel mostro così come sono (card 'raw' con il JSON completo): la
// tab resta l'unico editor. Per i calcoli (CR stimato, DPR, Scontro) la
// card porta anche la "lettura" del JSON fatta da itemToDescriptor.

/** Dati per i calcoli: una voce 'raw' conta per ciò che è (attacco, tiro salvezza…). */
function calcView(data) {
  return { ...data, items: (data.items || []).map((it) => (it.kind === 'raw' ? { ...it, kind: it.rawKind || 'passive' } : it)) };
}

/**
 * "Lettura" di un oggetto/incantesimo completo per i calcoli: gli stessi
 * lettori del Ricarica da JSON (per un'arma mettono insieme il dado base e
 * i danni extra); se il tipo non è tra quelli delle tab, la lettura generica.
 */
function readForCalc(json) {
  const viaTab = json.type === 'spell' ? importSpell(structuredClone(json)).data : importItem(structuredClone(json)).data;
  const d = viaTab || itemToDescriptor(json, { ok: [], warn: [], skipped: [] });
  return { ...d, kind: ['attack', 'save', 'utility', 'passive'].includes(d.kind) ? d.kind : 'passive' };
}

const newRawId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Aggiunge (o aggiorna, se `id` è una voce ancora presente) un oggetto o un
 * incantesimo completo tra le voci del mostro. Ritorna { id, updated, monster }.
 */
function addDocToSheet(doc, id) {
  const json = structuredClone(doc);
  const d = readForCalc(json);
  const fields = { ...d, kind: 'raw', rawKind: d.kind, name: json.name || '', _raw: json };
  delete fields._srcId;
  let card = id ? getItems().find((c) => c.kind === 'raw' && c._rawId === id) : null;
  const updated = Boolean(card);
  if (card) Object.assign(card, fields);
  else card = addItem({ ...fields, _rawId: newRawId() });
  refreshItems();
  syncSpellcastingSection();
  schedulePreview();
  autosave();
  return { id: card._rawId, updated, monster: val('name').trim() };
}

const showTab = (name) => document.querySelector(`#tabs .tab[data-tab="${name}"]`)?.click();

// ---------- Round-trip "campo toccato" del mostro ----------
// Un mostro RICARICATO da JSON tiene l'originale ripulito (`source`) e la
// foto del form appena caricato (`orig`): all'export si riscrive solo ciò
// che è cambiato (builders/actor-overlay.js). Resta in localStorage insieme
// alla bozza, così un ricaricamento della pagina non lo perde.
const RELOAD_KEY = 'tafys-forge-actor-reload';
let loadedActor = null;

let reloadStored = true; // false = l'originale non è entrato nel salvataggio del browser

function setLoadedActor(v) {
  loadedActor = v || null;
  reloadStored = true;
  try {
    if (loadedActor) localStorage.setItem(RELOAD_KEY, JSON.stringify(loadedActor));
    else localStorage.removeItem(RELOAD_KEY);
  } catch {
    // Storage pieno o disattivato: l'originale vale finché la pagina resta
    // aperta. Lo diciamo nel riquadro, perché ricaricando si perderebbe.
    reloadStored = false;
  }
}

/**
 * Mostro corrente → { actor, validation, formData, ov }. `formData` è ciò che
 * va controllato da validateNpc: per un mostro ricaricato solo le azioni
 * toccate e i campi cambiati (un originale ufficiale non va "corretto").
 */
function buildCurrentActor(data) {
  const built = buildNpc(data);
  // Le voci create nelle tab Oggetto/Incantesimo hanno la LORO forma (già
  // controllata lì): qui si guardano solo riferimenti e immagini.
  const isRaw = (i) => data.items?.[i]?.kind === 'raw';
  if (!loadedActor) return { actor: built, validation: validateActor(built, { itemMode: (it, i) => (isRaw(i) ? 'refs' : 'full') }), formData: data, ov: null };
  const ov = overlayActor(loadedActor.source, loadedActor.orig, data, built);
  const mode = (it, i) => (ov.modes[i] === 'kept' ? 'none' : ov.modes[i] === 'patched' || isRaw(i) ? 'refs' : 'full');
  const ch = new Set(ov.changed);
  const formData = {
    ...data,
    hpMax: ch.has('hpMax') ? data.hpMax : '1',
    acCalc: ch.has('acCalc') || ch.has('acFlat') ? data.acCalc : 'default',
    img: ch.has('img') ? data.img : '', tokenImg: ch.has('tokenImg') ? data.tokenImg : '',
    items: (data.items || []).filter((_, i) => ov.modes[i] !== 'kept'),
  };
  return { actor: ov.actor, validation: validateActor(ov.actor, { loaded: true, itemMode: mode }), formData, ov };
}

function renderReloadBanner(ov) {
  const banner = document.getElementById('npc-editing');
  if (!banner) return;
  banner.hidden = !loadedActor;
  if (!loadedActor) return;
  banner.querySelector('.reload-text').textContent = t('ai_editing', { name: loadedActor.source.name });
  const r = ov?.report;
  const lines = r ? [
    r.patched.length && t('ai_patched', { list: r.patched.join(', ') }),
    r.rebuilt.length && t('ai_rebuilt', { list: r.rebuilt.join(', ') }),
    r.added.length && t('ai_added', { list: r.added.join(', ') }),
    r.removed.length && t('ai_removed', { list: r.removed.join(', ') }),
    !reloadStored && t('ai_not_stored'),
  ].filter(Boolean) : [];
  const box = banner.querySelector('.reload-rebuilt');
  box.hidden = !lines.length;
  box.textContent = lines.join('\n');
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
  // I controlli del design Studio mostrano gli stessi dati: si riallineano.
  syncStudioWidgets();
  syncSpellcastingSection();
  renderPreview();
}

function saveDraftFile() {
  const state = readForm();
  const slug = (state.name || 'senza-nome').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  // Un mostro ricaricato porta con sé l'originale: la bozza resta "campo toccato".
  const extra = loadedActor ? { _reload: loadedActor } : {};
  downloadJson({ app: 'tafys-actor-forge', version: 1, savedAt: new Date().toISOString(), ...state, ...extra }, `bozza-${slug}.json`);
}

function loadDraftFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const draft = JSON.parse(reader.result);
      setLoadedActor(draft._reload?.source && draft._reload?.orig ? draft._reload : null);
      restoreForm(draft);
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

  let actor, cur;
  try {
    cur = buildCurrentActor(data);
    actor = cur.actor;
  } catch (err) {
    warnBox.textContent = t('build_err') + err.message;
    return;
  }

  // Due livelli di controllo prima di scaricare:
  //  - validateNpc: problemi del FORM (nome/HP/CA mancanti, danni malformati);
  //  - validateActor: errori STRUTTURALI del JSON (chiavi estranee, riferimenti
  //    pendenti, immagini non valide) — solo il livello 'error' blocca.
  const formIssues = validateNpc(cur.formData);
  const structErrors = cur.validation.filter(i => i.level === 'error').map(i => i.msg);
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


// ---------- Import da statblock (Fase 4) ----------
// Il parser produce uno stato PARZIALE del form: lo appoggiamo sopra i
// default di una scheda vuota, così i campi non riconosciuti tornano
// puliti invece di restare sporchi del mostro precedente.

const DEFAULT_STATE = {
  name: '', size: 'med', creatureType: 'humanoid', subtype: '',
  alignment: '', cr: '1', rules: '2014', sourceBook: '', sourcePage: '',
  str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10',
  saves: [], skills: {},
  hpMax: '', hpFormula: '', acCalc: 'default', acFlat: '',
  walk: '30', fly: '', swim: '', climb: '', burrow: '', hover: false,
  darkvision: '', blindsight: '', tremorsense: '', truesight: '', telepathy: '',
  dr: '', di: '', dv: '', ci: '', languages: '',
  legact: '', legres: '', img: '', tokenImg: '', bio: '',
  items: [],
};

/**
 * Round-trip (Fase 8): importa un JSON actor di Foundry nel form, così lo si
 * può modificare e ri-esportare. Riusa restoreForm (il descrittore prodotto da
 * importActor ha la stessa forma di readForm) e mostra un report come lo
 * statblock. `text` = JSON grezzo.
 */
function applyActorImport(text) {
  const reportBox = document.getElementById('import-report');
  if (!text || !text.trim()) {
    reportBox.hidden = false;
    reportBox.textContent = t('imp_paste_first');
    return;
  }
  let actor;
  try { actor = JSON.parse(text); } catch {
    reportBox.hidden = false;
    reportBox.textContent = t('imp_bad_json');
    return;
  }
  // File della scheda Esporta della macro (o un array): il form contiene UN
  // mostro, quindi prendiamo il primo NPC e diciamo quanti ce n'erano.
  let manyNote = '';
  if (actor && (actor.tafysForgeExport || Array.isArray(actor))) {
    const list = actor.tafysForgeExport ? (actor.entries || []).map(e => e.data) : actor;
    const npcs = list.filter(d => d && d.type === 'npc');
    if (!npcs.length) {
      reportBox.hidden = false;
      reportBox.textContent = t('imp_no_npc');
      return;
    }
    if (npcs.length > 1) manyNote = t('imp_many', { n: npcs.length, name: npcs[0].name });
    actor = npcs[0];
  }
  const { data, source, report } = importActor(actor);
  if (!data) {
    reportBox.hidden = false;
    reportBox.textContent = '⛔ ' + report.warn.join('\n');
    return;
  }
  if (manyNote) report.warn.unshift(manyNote);
  setLoadedActor(null);
  restoreForm({ ...DEFAULT_STATE, ...data });
  // Foto del form APPENA caricato (passata da readForm, quindi nella stessa
  // forma che avrà dopo): è il termine di paragone del "campo toccato".
  if (source) setLoadedActor({ source, orig: structuredClone(readForm()) });
  renderPreview();
  autosave();

  const lines = [`${t('imp_head_ok')} (${report.ok.length}):`];
  for (const r of report.ok) lines.push(`   ${r}`);
  if (report.warn.length) {
    lines.push('', `${t('imp_head_warn')} (${report.warn.length}):`);
    for (const r of report.warn) lines.push(`   ${r}`);
  }
  lines.push('', t('imp_reminder'));
  reportBox.hidden = false;
  reportBox.textContent = lines.join('\n');
}

function applyStatblock() {
  const text = document.getElementById('statblock-input').value;
  const reportBox = document.getElementById('parse-report');
  if (!text.trim()) {
    reportBox.hidden = false;
    reportBox.textContent = t('sb_paste_first');
    return;
  }

  const { state, report } = parseStatblock(text);
  setLoadedActor(null); // uno statblock è un mostro nuovo, non un originale da conservare
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
// Icona per tipo di documento nella lista collezione.
const BATCH_ICONS = { npc: '🐲', character: '🧝', weapon: '⚔️', equipment: '🛡️', consumable: '🧪', feat: '📜', spell: '✨' };

function updateBatchUI() {
  document.getElementById('batch-count').textContent = batch.length;
  document.getElementById('btn-batch-export').disabled = batch.length === 0;
  document.getElementById('btn-batch-clear').disabled = batch.length === 0;
  // Lista del contenuto: nome + tipo + ✖ per rimuovere il singolo elemento
  // (utile per buttare un salvataggio sbagliato senza svuotare tutto).
  const list = document.getElementById('batch-list');
  list.innerHTML = batch.map((doc, i) => `
    <div class="batch-row">
      <span class="batch-name">${BATCH_ICONS[doc.type] || '📦'} ${esc(doc.name || '?')}</span>
      <span class="hint">${esc(doc.type)}</span>
      <button type="button" class="remove" data-bdel="${i}" title="${t('batch_remove_one')}">✖</button>
    </div>`).join('') || `<span class="hint">${t('batch_empty')}</span>`;
}
function batchMsg(text) {
  const el = document.getElementById('batch-msg');
  el.textContent = text;
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3000);
}

/**
 * Aggiunge un documento GIÀ COSTRUITO e VALIDO alla collezione batch.
 * La collezione è mista: può contenere sia Actor (dalla tab NPC) sia Item
 * (dalla tab Oggetto). La macro importer smista per `type` in fase d'import.
 */
function pushDocToBatch(doc) {
  batch.push(doc);
  saveBatch();
  updateBatchUI();
  batchMsg(t('batch_added', { name: doc.name, n: batch.length }));
}

/** Aggiunge il mostro corrente alla collezione, ma solo se è valido. */
function addToBatch() {
  const data = readForm();
  let cur;
  try {
    cur = buildCurrentActor(data);
  } catch (err) {
    batchMsg('⛔ ' + err.message);
    return;
  }
  const actor = cur.actor;
  const blocking = [
    ...validateNpc(cur.formData),
    ...cur.validation.filter(i => i.level === 'error').map(i => i.msg),
  ];
  if (blocking.length) {
    document.getElementById('warnings').textContent = t('correct_add') + blocking.join('  •  ');
    batchMsg(t('batch_correct'));
    return;
  }
  pushDocToBatch(actor);
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
initThemePicker(); // selettore tema nell'header (scambio istantaneo, no reload)

buildStaticOptions();
buildAbilitiesGrid();
buildSkillsGrid();
buildTraitChips();
initItemsEditor({
  listEl: document.getElementById('items-list'),
  addBtn: document.getElementById('btn-add-item'),
  // Una card aggiunta, tolta o cambiata di tipo può essere il blocco Incantesimi.
  onChange: () => { syncSpellcastingSection(); schedulePreview(); autosave(); },
  rules: () => val('rules'),
});
// Design Studio: competenze e danni "a clic", incantesimi in una sezione loro.
initSkillPills({ host: document.getElementById('skills-pills'), legend: document.getElementById('skills-legend'), skills: SKILLS });
initDamageMatrix({
  host: document.getElementById('dmg-matrix'), groups: traitGroups,
  labels: byLang(DAMAGE_TYPE_LABELS, DAMAGE_TYPE_LABELS_EN, LANG),
});
initSpellcastingSection({
  rules: () => val('rules'),
  abilities: () => ({ int: val('int'), wis: val('wis'), cha: val('cha') }),
  onChange: () => { schedulePreview(); autosave(); },
});
// "Crea nella tab Oggetto / Incantesimo": lì c'è "Aggiungi alla scheda del mostro".
for (const id of ['btn-from-item', 'btn-from-spell']) {
  document.getElementById(id).addEventListener('click', (ev) => showTab(ev.currentTarget.dataset.gotoTab));
}
// "Modifica nella tab…" su una voce creata lì: la riapre collegata alla card.
document.addEventListener('forge:edit-raw', (ev) => {
  const card = ev.detail?.card;
  if (!card?._raw) return;
  const isSpell = card._raw.type === 'spell';
  const open = () => {
    const ok = isSpell ? editSpellFromSheet(card._raw, card._rawId) : editItemFromSheet(card._raw, card._rawId);
    if (ok) showTab(isSpell ? 'spell' : 'item');
  };
  const btn = document.querySelector(`#items-list [data-raw-edit="${getItems().indexOf(card)}"]`);
  // La tab ha già un altro lavoro in corso: secondo clic per sostituirlo.
  if (btn && (isSpell ? spellTabBusy(card._rawId) : itemTabBusy(card._rawId))) armedConfirm(btn, t('raw_edit_confirm'), open);
  else open();
});
// Cambiando regole (2014/2024) cambia il compendio in cui cercare gli incantesimi.
document.getElementById('rules').addEventListener('change', () => { refreshItems(); syncSpellcastingSection(); });
// Il blocco Incantesimi si disegna in modo diverso nei due design; i controlli
// a clic rileggono i dati (potrebbero essere cambiati con quelli classici).
document.addEventListener('forge:theme', () => { refreshItems(); syncStudioWidgets(); syncSpellcastingSection(); });
// "Automatica" e il riepilogo seguono le caratteristiche mentre le si cambia.
for (const ab of ['int', 'wis', 'cha']) document.getElementById(ab).addEventListener('input', () => syncSpellcastingSection());
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

// Round-trip: import di un JSON actor (incolla o file), con conferma se il
// form contiene già dati (come lo statblock).
function triggerActorImport(ev) {
  const run = () => applyActorImport(document.getElementById('actor-import-input').value);
  const hasData = document.getElementById('name').value.trim() || getItems().length > 0;
  if (hasData && document.getElementById('actor-import-input').value.trim()) {
    armedConfirm(ev.currentTarget, t('imp_confirm_btn'), run);
  } else {
    run();
  }
}
document.getElementById('btn-import-actor').addEventListener('click', triggerActorImport);
document.getElementById('npc-reset').addEventListener('click', (ev) => {
  armedConfirm(ev.currentTarget, t('ii_reset_confirm'), () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(RELOAD_KEY);
    location.reload();
  });
});
document.getElementById('btn-import-actor-file').addEventListener('click', () => document.getElementById('actor-import-file').click());
document.getElementById('actor-import-file').addEventListener('change', (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('actor-import-input').value = String(reader.result || '');
    applyActorImport(String(reader.result || ''));
  };
  reader.readAsText(file);
  ev.target.value = '';
});
document.getElementById('btn-copy-template').addEventListener('click', copyTemplate);
document.getElementById('btn-copy-macro').addEventListener('click', copyMacro);
document.getElementById('btn-copy-preview').addEventListener('click', copyPreview);
document.getElementById('btn-batch-add').addEventListener('click', addToBatch);
// Rimozione del singolo elemento dalla lista collezione.
document.getElementById('batch-list').addEventListener('click', (ev) => {
  const i = ev.target.dataset.bdel;
  if (i === undefined) return;
  const [removed] = batch.splice(Number(i), 1);
  saveBatch();
  updateBatchUI();
  if (removed) batchMsg(t('batch_removed', { name: removed.name }));
});
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
    localStorage.removeItem(RELOAD_KEY);
    location.reload();
  });
});

// All'avvio: se c'è una bozza autosalvata, la ripristiniamo.
try {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) {
    try { loadedActor = JSON.parse(localStorage.getItem(RELOAD_KEY)) || null; } catch { loadedActor = null; }
    restoreForm(JSON.parse(saved));
  }
} catch { /* bozza corrotta: si riparte puliti */ }

// Tab: mostra il pannello scelto, nasconde gli altri.
document.getElementById('tabs').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.tab');
  if (!btn) return;
  const tab = btn.dataset.tab;
  document.querySelectorAll('#tabs .tab').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== `tab-${tab}`; });
});
// Il calcolatore DPR legge il mostro corrente tramite readForm().
initDprTab({ getData: () => calcView(readForm()) });
initCRReadout(() => calcView(readForm())); // input multiattacco del cartellino CR
// Tab Scontro: legge il mostro in scheda e la collezione batch (per aggiungerli).
initEncounterTab({ getData: () => calcView(readForm()), getBatch: () => batch });

// Tab Oggetto: crea Item standalone. Condivide la collezione batch con la
// tab NPC (la macro importer smista Actor vs Item in fase d'import).
initItemTab({ onAddToBatch: pushDocToBatch, onAddToSheet: addDocToSheet });

// Tab Incantesimo: le spell sono Item di tipo 'spell' → la macro le
// smista già su Item.createDocuments, nessuna modifica alla macro.
initSpellTab({ onAddToBatch: pushDocToBatch, onAddToSheet: addDocToSheet });

// Tab Info: mini-guida + preset di macro copiabili.
initInfoTab();

renderPreview(); // prima anteprima

// Telefono: barra azioni + foglio anteprima, sezioni richiudibili.
initMobile();
// Indice delle sezioni (visibile nel design Studio): dopo initMobile, che
// rende richiudibili le sezioni.
initSectionNav();
