// ============================================================
// Sezione "Incantesimi" del form Mostro (design "Studio").
//
// Stessi dati della card "Incantesimi" dei temi classici — la prima card con
// kind 'spellcasting' — ma modificati con controlli al posto del testo:
// caratteristica, livello da incantatore, slot dal 1° al 9°, e una lista a
// "pillole" con i suggerimenti mentre si scrive. Ogni pillola ha il suo modo
// di lancio (a slot · a volontà · N al giorno) che cambia con un clic.
//
// La sezione NON ha uno stato suo: legge e riscrive la card (campo
// `spellList` nella forma canonica + `scSlots`). Così statblock, bozze,
// card classica e builder continuano a parlare la stessa lingua.
// ============================================================
import { getItems, addItem, removeItem, refreshItems } from './items-editor.js';
import {
  parseSpellGroups, formatSpellGroups, groupsToChips, chipsToGroups, nextSpellMode,
  suggestSpells, resolveSpell, spellKey, defaultSlots, parseSlotOverrides,
} from '../parsers/spellcasting.js';
import { bestMentalAbility } from '../builders/npc.js';
import { ABILITIES } from '../data/constants.js';
import { t, getLang } from '../i18n.js';
import { esc } from '../utils/html.js';

const EN = getLang() === 'en';
const abilityLabel = (id) => { const a = ABILITIES.find((x) => x.id === id); return a ? (EN ? a.en : a.label) : id; };
const ord = (n) => (EN ? `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || (n > 10 && n < 14) ? 0 : n % 10]}` : `${n}°`);

let root, body, summary, opts;
let chips = [];
let sugg = [];
let suggIdx = -1;

const $ = (id) => document.getElementById(id);
const primary = () => getItems().find((i) => i.kind === 'spellcasting') || null;
const rules = () => (opts.rules ? opts.rules() : '2024');
const hasLevel = (card) => Number(card?.scLevel) > 0;

/** La card su cui lavora la sezione; se non c'è la crea (il mostro diventa un incantatore). */
function ensureCard() {
  let card = primary();
  if (card) return card;
  card = addItem({ kind: 'spellcasting', name: 'Spellcasting', scAbility: '' });
  return card;
}

/** Slot scritti nella lista ("Livello 3 (3 slot)") diversi da quelli del livello → diventano scelte a mano. */
function adoptListedSlots(card) {
  const hand = parseSlotOverrides(card.scSlots);
  const def = defaultSlots(card.scLevel);
  let changed = false;
  for (const g of parseSpellGroups(card.spellList)) {
    if (g.mode !== 'slots' || g.level < 1 || g.level > 9) continue;
    if (hand[g.level - 1] == null && g.slots !== def[g.level - 1]) { hand[g.level - 1] = g.slots; changed = true; }
  }
  if (changed) card.scSlots = hand.map((x) => (x == null ? '' : x)).join(',');
}

/** Numero di slot per livello come li vede la sezione: scelti a mano, altrimenti quelli del livello. */
function slotNumbers(card) {
  const hand = parseSlotOverrides(card.scSlots);
  return defaultSlots(card.scLevel).map((d, i) => hand[i] ?? d);
}

/**
 * Riscrive la lista canonica della card a partire dalle pillole, poi rilegge
 * le pillole dalla lista: così sono sempre nell'ordine degli statblock
 * (trucchetti, a volontà, N/giorno, slot dal 1°) e non saltano di posto al
 * prossimo caricamento.
 */
function writeList(card) {
  card.spellList = formatSpellGroups(chipsToGroups(chips, { rules: rules(), slots: slotNumbers(card), caster: hasLevel(card) }), EN ? 'en' : 'it');
  chips = groupsToChips(parseSpellGroups(card.spellList));
}

function changed({ structure = false } = {}) {
  if (structure) refreshItems();
  renderSummary();
  opts.onChange?.();
}

// ---------- Disegno ----------

function frameHtml() {
  const abOpts = ABILITIES.map((a) => `<option value="${a.id}">${esc(EN ? a.en : a.label)}</option>`).join('');
  const slots = Array.from({ length: 9 }, (_, i) => `
      <label class="scs-slot"><span>${ord(i + 1)}</span>
        <input type="number" min="0" max="9" inputmode="numeric" data-slot="${i}" aria-label="${esc(t('scs_slot_aria', { n: i + 1 }))}" />
      </label>`).join('');
  return `
    <div class="grid-3">
      <label>${t('sc_ability')} <span class="hint">${t('scs_auto_hint')}</span>
        <select id="scs-ability"><option value="">${t('scs_auto')}</option>${abOpts}</select>
      </label>
      <label>${t('sc_level')} <span class="hint">${t('scs_level_hint')}</span>
        <input type="number" id="scs-level" min="0" max="20" placeholder="—" />
      </label>
      <label class="check">${t('sc_nomat')} <input type="checkbox" id="scs-nomat" /></label>
    </div>
    <div id="scs-slots-box" hidden>
      <div class="scs-row-head"><span class="trait-title">${t('scs_slots')}</span> <span class="hint">${t('scs_slots_hint')}</span></div>
      <div class="scs-slots">${slots}</div>
    </div>
    <div class="scs-list">
      <div class="scs-row-head">
        <span class="trait-title">${t('scs_list')}</span>
        <span class="hint scs-legend">
          <span><b class="scs-mode" data-mode="slot">${t('scs_m_slot')}</b> ${t('scs_k_slot')}</span>
          <span><b class="scs-mode" data-mode="atwill">∞</b> ${t('scs_k_atwill')}</span>
          <span><b class="scs-mode" data-mode="day">${t('scs_m_day', { n: 2 })}</b> ${t('scs_k_day')}</span>
          <span>${t('scs_k_click')}</span>
        </span>
      </div>
      <div id="scs-chips" class="scs-chips"></div>
      <div class="scs-add">
        <input type="text" id="scs-input" autocomplete="off" spellcheck="false" role="combobox"
          aria-autocomplete="list" aria-expanded="false" aria-controls="scs-sugg" placeholder="${esc(t('scs_input_ph'))}" />
        <ul id="scs-sugg" class="scs-sugg" role="listbox" hidden></ul>
      </div>
      <p class="hint" id="scs-note"></p>
    </div>
    <details class="scs-adv">
      <summary class="hint">${t('scs_adv')}</summary>
      <div class="grid-3">
        <label>${t('sc_dc')} <span class="hint">${t('sc_auto_hint')}</span><input type="number" id="scs-dc" placeholder="auto" /></label>
        <label>${t('sc_attack')} <span class="hint">${t('sc_auto_hint')}</span><input type="number" id="scs-attack" placeholder="auto" /></label>
      </div>
    </details>
    <div class="scs-foot"><button type="button" id="scs-remove" class="secondary small" hidden>${t('scs_remove')}</button></div>`;
}

function modeLabel(c, hit) {
  if (c.mode === 'day') return t('scs_m_day', { n: c.uses || 1 });
  if (c.mode === 'slot' && !(hit && hit.level === 0)) return hit ? `${t('scs_m_slot')} ${ord(hit.level)}` : t('scs_m_slot');
  return '∞';
}

function renderChips() {
  const box = $('scs-chips');
  if (!chips.length) { box.innerHTML = `<span class="hint">${t('scs_empty')}</span>`; return; }
  box.innerHTML = chips.map((c, i) => {
    const hit = resolveSpell(c.name, rules());
    const mode = c.mode === 'slot' && hit && hit.level === 0 ? 'atwill' : c.mode;
    const extra = [c.castLevel ? t('scs_cast_at', { n: ord(c.castLevel) }) : '', c.note].filter(Boolean).map((x) => `<small>${esc(x)}</small>`).join('');
    const title = hit ? `${hit.name} · SRD ${hit.rules}${hit.level ? ' · ' + ord(hit.level) : ''}` : t('sc_missing_title');
    // Non lo conosco e va a slot: il livello lo sceglie chi scrive (la macro, all'import, mette quello vero).
    const lv = !hit && c.mode === 'slot'
      ? `<button type="button" class="scs-lv" data-lv="${i}" title="${esc(t('scs_lv_title'))}">${t('scs_lv', { n: ord(Number(c.level) || 1) })}</button>` : '';
    return `<span class="scs-chip ${hit ? 'ok' : 'miss'}" title="${esc(title)}">
      <button type="button" class="scs-mode" data-mode="${mode}" data-cycle="${i}" title="${esc(t('scs_mode_title'))}">${esc(modeLabel(c, hit))}</button>
      <span class="scs-name">${esc(c.name)}${extra}</span>${lv}
      <button type="button" class="scs-x" data-del="${i}" aria-label="${esc(t('scs_del', { name: c.name }))}">×</button>
    </span>`;
  }).join('');
}

function renderSlots(card) {
  const box = $('scs-slots-box');
  const hand = parseSlotOverrides(card?.scSlots);
  const def = defaultSlots(card?.scLevel);
  // Slot scritti nella lista (statblock) e non ancora adottati: si mostrano come scelti a mano.
  const listed = Array(9).fill(null);
  for (const g of parseSpellGroups(card?.spellList)) if (g.mode === 'slots' && g.level >= 1 && g.level <= 9) listed[g.level - 1] = g.slots;
  const shown = hand.map((h, i) => h ?? (listed[i] != null && listed[i] !== def[i] ? listed[i] : null));
  box.hidden = !(hasLevel(card) || shown.some((x) => x != null));
  for (const inp of box.querySelectorAll('[data-slot]')) {
    const i = Number(inp.dataset.slot);
    inp.placeholder = String(def[i]);
    if (document.activeElement !== inp) inp.value = shown[i] == null ? '' : String(shown[i]);
  }
}

function renderSummary() {
  const card = primary();
  if (!summary) return;
  if (!card) { summary.textContent = t('scs_sum_none'); return; }
  const ab = card.scAbility || bestMentalAbility(opts.abilities ? opts.abilities() : {});
  const parts = [t('scs_sum_n', { n: chips.length }), abilityLabel(ab)];
  if (hasLevel(card)) parts.push(t('scs_sum_level', { n: card.scLevel }));
  summary.textContent = `(${parts.join(' · ')})`;
}

function renderNote(card) {
  const note = $('scs-note');
  const missing = chips.filter((c) => !resolveSpell(c.name, rules())).length;
  const orphanSlots = card && !hasLevel(card) && chips.some((c) => c.mode === 'slot' && !(resolveSpell(c.name, rules())?.level === 0));
  const lines = [];
  if (missing) lines.push(t('scs_note_missing', { n: missing }));
  if (orphanSlots) lines.push(t('scs_note_nolevel'));
  note.textContent = lines.join(' ');
  note.hidden = !lines.length;
}

/** Rilegge la card e aggiorna tutta la sezione (dopo un caricamento, un cambio di tema o di regole). */
export function syncSpellcastingSection() {
  if (!body) return;
  const card = primary();
  chips = groupsToChips(parseSpellGroups(card?.spellList));
  const set = (id, v) => { const el = $(id); if (el && document.activeElement !== el) el.value = v ?? ''; };
  set('scs-ability', card?.scAbility || '');
  set('scs-level', card?.scLevel || '');
  set('scs-dc', card?.scDc || '');
  set('scs-attack', card?.scAttack || '');
  $('scs-nomat').checked = Boolean(card?.scNoMaterial);
  // "Automatica" dice quale caratteristica vale adesso.
  const auto = $('scs-ability').options[0];
  auto.textContent = `${t('scs_auto')} — ${abilityLabel(bestMentalAbility(opts.abilities ? opts.abilities() : {}))}`;
  if (card?.scDc || card?.scAttack) body.querySelector('.scs-adv').open = true;
  $('scs-remove').hidden = !card;
  renderSlots(card);
  renderChips();
  renderNote(card);
  renderSummary();
}

// ---------- Aggiunta dalla casella (con suggerimenti) ----------

/** Testo dopo l'ultima virgola: è la parola che si sta scrivendo. */
const currentToken = (v) => String(v).split(/[,;\n]/).pop().trim();

function closeSugg() {
  sugg = []; suggIdx = -1;
  const ul = $('scs-sugg');
  ul.hidden = true; ul.innerHTML = '';
  $('scs-input').setAttribute('aria-expanded', 'false');
  $('scs-input').removeAttribute('aria-activedescendant');
}

function renderSugg() {
  const ul = $('scs-sugg');
  const input = $('scs-input');
  if (!sugg.length) return closeSugg();
  ul.innerHTML = sugg.map((sp, i) => `<li role="option" id="scs-opt-${i}" data-pick="${i}" aria-selected="${i === suggIdx}" class="${i === suggIdx ? 'on' : ''}">
    <span>${esc(sp.name)}</span><small>${sp.level ? ord(sp.level) : t('scs_cantrip')}</small></li>`).join('');
  ul.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  if (suggIdx >= 0) input.setAttribute('aria-activedescendant', `scs-opt-${suggIdx}`); else input.removeAttribute('aria-activedescendant');
}

function updateSugg() {
  const input = $('scs-input');
  sugg = suggestSpells(currentToken(input.value), rules(), { exclude: chips.map((c) => c.name) });
  suggIdx = -1;
  renderSugg();
}

/** Aggiunge uno o più nomi ("a, b, c"): scarta vuoti e doppioni, usa il nome del compendio se lo riconosce. */
function addSpells(text) {
  const tokens = parseSpellGroups(`At will: ${String(text).replace(/\n/g, ', ')}`)[0]?.spells || [];
  if (!tokens.length) return 0;
  const created = !primary();
  const card = ensureCard();
  adoptListedSlots(card);
  const have = new Set(chips.map((c) => spellKey(c.name)));
  let added = 0;
  for (const tok of tokens) {
    const hit = resolveSpell(tok.name, rules());
    const name = hit && spellKey(hit.name) === spellKey(tok.name) ? hit.name : tok.name;
    const key = spellKey(name);
    if (!key || have.has(key)) continue;
    have.add(key);
    const cantrip = Boolean(hit && hit.level === 0);
    chips.push({
      name, castLevel: tok.castLevel || null, note: tok.note || '',
      mode: hasLevel(card) && !cantrip ? 'slot' : 'atwill', uses: null,
      level: hit ? hit.level : 1, cantrips: cantrip && hasLevel(card),
    });
    added += 1;
  }
  if (added) {
    writeList(card);
    renderChips(); renderSlots(card); renderNote(card);
    $('scs-remove').hidden = false;
    changed({ structure: created });
  }
  return added;
}

function commitInput(pick) {
  const input = $('scs-input');
  const parts = String(input.value).split(/[,;\n]/);
  if (pick) parts[parts.length - 1] = pick;
  addSpells(parts.join(', '));
  input.value = '';
  closeSugg();
}

// ---------- Eventi ----------

function onFieldInput(ev) {
  const el = ev.target;
  if (el.id === 'scs-input') { updateSugg(); ev.stopPropagation(); return; }
  const isSlot = 'slot' in el.dataset;
  const fields = { 'scs-ability': 'scAbility', 'scs-level': 'scLevel', 'scs-dc': 'scDc', 'scs-attack': 'scAttack', 'scs-nomat': 'scNoMaterial' };
  if (!isSlot && !(el.id in fields)) return;
  // Un campo svuotato su un mostro che non è un incantatore non crea nulla.
  const empty = el.type === 'checkbox' ? !el.checked : String(el.value).trim() === '';
  if (!primary() && empty) return;
  const created = !primary();
  const card = ensureCard();
  adoptListedSlots(card);
  if (isSlot) {
    const hand = parseSlotOverrides(card.scSlots);
    const raw = String(el.value).trim();
    hand[Number(el.dataset.slot)] = raw === '' || Number(raw) < 0 ? null : Math.floor(Number(raw));
    card.scSlots = hand.some((x) => x != null) ? hand.map((x) => (x == null ? '' : x)).join(',') : '';
  } else if (el.type === 'checkbox') card[fields[el.id]] = el.checked;
  else card[fields[el.id]] = String(el.value).trim();
  // Livello e slot cambiano le intestazioni della lista ("Livello 3 (3 slot)").
  if (isSlot || el.id === 'scs-level') { writeList(card); renderSlots(card); renderChips(); }
  renderNote(card);
  $('scs-remove').hidden = false;
  changed({ structure: created });
}

function onClick(ev) {
  const pick = ev.target.closest('[data-pick]');
  if (pick) { commitInput(sugg[Number(pick.dataset.pick)]?.name); $('scs-input').focus(); return; }
  const card = primary();
  const btn = ev.target.closest('button');
  if (!btn) return;
  if (btn.id === 'scs-remove') {
    if (card) removeItem(card);
    chips = [];
    $('scs-input').value = '';
    syncSpellcastingSection();
    changed();
    return;
  }
  if (!card) return;
  const d = btn.dataset;
  if (!('cycle' in d) && !('del' in d) && !('lv' in d)) return;
  adoptListedSlots(card);
  let touched = null; // nome della pillola toccata: dopo il ridisegno può aver cambiato posto
  if ('cycle' in d) {
    const c = chips[Number(d.cycle)];
    touched = c.name;
    const hit = resolveSpell(c.name, rules());
    // Un trucchetto non usa slot: per lui il giro salta quella voce.
    const cur = c.mode === 'slot' && hit && hit.level === 0 ? { ...c, mode: 'atwill' } : c;
    Object.assign(c, nextSpellMode(cur, hasLevel(card) && !(hit && hit.level === 0)), { cantrips: false });
  } else if ('lv' in d) {
    const c = chips[Number(d.lv)];
    touched = c.name;
    c.level = ((Number(c.level) || 1) % 9) + 1;
  } else chips.splice(Number(d.del), 1);
  writeList(card);
  renderChips(); renderSlots(card); renderNote(card);
  changed();
  // Il pulsante è stato ridisegnato: il fuoco torna sulla stessa pillola (tastiera).
  const at = touched == null ? -1 : chips.findIndex((c) => spellKey(c.name) === spellKey(touched));
  const again = at < 0 ? null : body.querySelector('lv' in d ? `[data-lv="${at}"]` : `[data-cycle="${at}"]`) || body.querySelector(`[data-cycle="${at}"]`);
  (again || $('scs-input')).focus();
}

function onKeydown(ev) {
  if (ev.target.id !== 'scs-input') return;
  const input = ev.target;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    if (!sugg.length) return;
    ev.preventDefault();
    const n = sugg.length;
    suggIdx = ev.key === 'ArrowDown' ? (suggIdx + 1) % n : (suggIdx - 1 + n) % n;
    renderSugg();
  } else if (ev.key === 'Enter') {
    ev.preventDefault(); // mai inviare il form
    if (suggIdx >= 0) commitInput(sugg[suggIdx].name);
    else if (input.value.trim()) commitInput();
  } else if (ev.key === 'Tab' && sugg.length && currentToken(input.value)) {
    // Tab completa col suggerimento scelto (o il primo), come in un editor.
    ev.preventDefault();
    commitInput(sugg[Math.max(0, suggIdx)].name);
  } else if (ev.key === ',' || ev.key === ';') {
    ev.preventDefault();
    if (input.value.trim()) commitInput();
  } else if (ev.key === 'Escape' && sugg.length) {
    ev.preventDefault(); ev.stopPropagation();
    closeSugg();
  } else if (ev.key === 'Backspace' && input.value === '' && chips.length) {
    const card = primary();
    if (!card) return;
    adoptListedSlots(card);
    chips.pop();
    writeList(card);
    renderChips(); renderSlots(card); renderNote(card);
    changed();
  }
}

/**
 * @param {object} o
 * @param {()=>string} o.rules        regole del mostro ('2014' | '2024')
 * @param {()=>object} o.abilities    { int, wis, cha } correnti (per "Automatica")
 * @param {()=>void}   o.onChange     anteprima + salvataggio
 */
export function initSpellcastingSection(o) {
  root = document.getElementById('sec-spells');
  body = document.getElementById('scs-body');
  summary = document.getElementById('scs-summary');
  if (!root || !body) return;
  opts = o || {};
  body.innerHTML = frameHtml();
  body.addEventListener('input', onFieldInput);
  body.addEventListener('click', onClick);
  body.addEventListener('keydown', onKeydown);
  // Incollare "a, b, c" aggiunge subito tutti i nomi.
  body.addEventListener('paste', (ev) => {
    if (ev.target.id !== 'scs-input') return;
    const text = ev.clipboardData?.getData('text') || '';
    if (!/[,;\n]/.test(text)) return;
    ev.preventDefault();
    addSpells(`${ev.target.value} ${text}`);
    ev.target.value = '';
    closeSugg();
  });
  // Il clic su un suggerimento non deve togliere il fuoco alla casella.
  $('scs-sugg').addEventListener('mousedown', (ev) => ev.preventDefault());
  $('scs-input').addEventListener('blur', () => setTimeout(closeSugg, 120));
  // "Modifica gli incantesimi" dalla card nell'elenco delle azioni.
  document.addEventListener('forge:goto-spells', () => {
    if (root.classList.contains('folded')) root.querySelector(':scope > legend')?.click();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('scs-input').focus({ preventScroll: true });
  });
  syncSpellcastingSection();
}
