// ============================================================
// Controlli "a clic" del design Studio per competenze e danni.
//
// Sono un secondo modo di usare gli STESSI dati dei temi classici:
//  - le competenze restano nei <select data-skill> (nascosti in Studio);
//  - resistenze / immunità / vulnerabilità restano nei tre gruppi di chip.
// Qui si legge e si scrive lì dentro: readForm, bozze, statblock e
// round-trip non cambiano di una virgola.
// ============================================================
import { DAMAGE_TYPES, DAMAGE_BYPASSES } from '../data/constants.js';
import { t } from '../i18n.js';
import { esc } from '../utils/html.js';

const fire = (el) => el.dispatchEvent(new Event('input', { bubbles: true }));

// ---------- Competenze nelle abilità ----------
// Un clic sul nome fa girare: niente → competenza → maestria → mezza → niente
// (le più usate per prime). I valori sono quelli di dnd5e: 0, 1, 2, 0.5.
const SKILL_CYCLE = ['0', '1', '2', '0.5'];
const SKILL_KEY = { 0: 'sk_none_l', 0.5: 'sk_half_l', 1: 'sk_prof_l', 2: 'sk_exp_l' };

let skillHost = null;

export function initSkillPills({ host, legend, skills }) {
  skillHost = host;
  if (!host) return;
  host.innerHTML = Object.entries(skills).map(([id, label]) => `
    <button type="button" class="sk-pill" data-sk="${id}" data-lv="0">
      <i class="sk-dot" aria-hidden="true"></i><span>${esc(label)}</span>
    </button>`).join('');
  if (legend) {
    legend.innerHTML = ['0', '0.5', '1', '2']
      .map((lv) => `<span class="sk-key"><i class="sk-dot" data-lv="${lv}" aria-hidden="true"></i>${t(SKILL_KEY[lv])}</span>`)
      .join('') + `<span class="sk-key">${t('sk_click')}</span>`;
  }
  host.addEventListener('click', (ev) => {
    const pill = ev.target.closest('[data-sk]');
    if (!pill) return;
    const sel = document.querySelector(`select[data-skill="${pill.dataset.sk}"]`);
    if (!sel) return;
    const at = SKILL_CYCLE.indexOf(sel.value);
    sel.value = SKILL_CYCLE[(at + 1) % SKILL_CYCLE.length];
    syncSkillPills();
    fire(sel);
  });
  syncSkillPills();
}

export function syncSkillPills() {
  if (!skillHost) return;
  for (const pill of skillHost.querySelectorAll('[data-sk]')) {
    const sel = document.querySelector(`select[data-skill="${pill.dataset.sk}"]`);
    const lv = SKILL_CYCLE.includes(sel?.value) ? sel.value : '0';
    pill.dataset.lv = lv;
    const name = pill.querySelector('span').textContent;
    pill.setAttribute('aria-label', `${name}: ${t(SKILL_KEY[lv])}`);
    pill.title = t(SKILL_KEY[lv]);
  }
}

// ---------- Danni: resistente / immune / vulnerabile ----------
// Un tipo di danno ha UNO stato solo; un clic lo fa girare:
//   niente → "/" resistente → "X" immune → "!" vulnerabile → niente.
const STATES = ['r', 'i', 'v'];
const GROUP_OF = { r: 'dr', i: 'di', v: 'dv' };
const MARK = { r: '/', i: 'X', v: '!' };
const PHYSICAL = ['bludgeoning', 'piercing', 'slashing'];
const BYPASS_IDS = Object.keys(DAMAGE_BYPASSES); // nonmagical, silvered, adamantine

let dm = null; // { host, groups, labels }

/** "fire, nonmagical, voce mia" → { known:Set, bypass:Set, custom:[] } */
function parseTrait(str) {
  const out = { known: new Set(), bypass: new Set(), custom: [] };
  for (const raw of String(str || '').split(/[,;]/)) {
    const tok = raw.trim();
    if (!tok) continue;
    const low = tok.toLowerCase();
    if (DAMAGE_TYPES.includes(low)) out.known.add(low);
    else if (BYPASS_IDS.includes(low)) out.bypass.add(low);
    else out.custom.push(tok);
  }
  return out;
}

function readDamage() {
  const st = { type: {}, custom: [], bypass: { r: new Set(), i: new Set(), v: new Set() } };
  // Se un tipo fosse in più gruppi (dati vecchi) vince il più forte: immune, poi resistente.
  for (const s of ['v', 'r', 'i']) {
    const p = parseTrait(dm.groups[GROUP_OF[s]].getValue());
    for (const id of p.known) st.type[id] = s;
    st.bypass[s] = p.bypass;
  }
  for (const s of STATES) for (const text of parseTrait(dm.groups[GROUP_OF[s]].getValue()).custom) st.custom.push({ text, st: s });
  return st;
}

function writeDamage(st) {
  for (const s of STATES) {
    const ids = DAMAGE_TYPES.filter((id) => st.type[id] === s);
    const custom = st.custom.filter((c) => c.st === s).map((c) => c.text);
    // Un "superata da…" senza tipi fisici in quello stato non avrebbe senso: via.
    const physical = ids.some((id) => PHYSICAL.includes(id));
    const bypass = physical ? BYPASS_IDS.filter((b) => st.bypass[s].has(b)) : [];
    dm.groups[GROUP_OF[s]].setValue([...ids, ...bypass, ...custom].join(', '));
  }
}

const markHtml = (s) => `<b class="dm-mark" data-st="${s || ''}" aria-hidden="true">${s ? MARK[s] : ''}</b>`;
const stateName = (s) => t(s ? `dm_${s}` : 'dm_none');

function bypassRow(st, s) {
  const physical = PHYSICAL.some((id) => st.type[id] === s);
  if (!physical && !st.bypass[s].size) return '';
  const boxes = BYPASS_IDS.map((b) => `
      <label class="check"><input type="checkbox" data-bp="${s}:${b}" ${st.bypass[s].has(b) ? 'checked' : ''} ${physical ? '' : 'disabled'} /> ${t('dm_bp_' + b)}</label>`).join('');
  return `<div class="dm-bypass"><span class="dm-bypass-q">${t('dm_bp_' + s)}</span>${boxes}</div>`;
}

export function syncDamageMatrix() {
  if (!dm) return;
  const st = readDamage();
  const keep = dm.host.querySelector('#dm-custom')?.value ?? '';
  const keepSt = dm.host.querySelector('#dm-custom-st')?.value ?? 'r';
  const hadFocus = document.activeElement?.id === 'dm-custom';
  // Prima i tre tipi fisici (quelli a cui si applicano i "non valgono contro…"), poi gli altri in ordine alfabetico.
  const order = [...PHYSICAL, ...DAMAGE_TYPES.filter((id) => !PHYSICAL.includes(id)).sort((a, b) => String(dm.labels[a] ?? a).localeCompare(String(dm.labels[b] ?? b)))];
  const pills = order.map((id) => {
    const s = st.type[id] || '';
    const name = dm.labels[id] ?? id;
    return `<button type="button" class="dm-pill" data-dm="${id}" data-st="${s}" title="${esc(stateName(s))}" aria-label="${esc(`${name}: ${stateName(s)}`)}">${markHtml(s)}<span>${esc(name)}</span></button>`;
  }).join('');
  const customs = st.custom.map((c, i) => `
    <span class="dm-pill dm-custom" data-st="${c.st}">
      <button type="button" class="dm-cy" data-dmc="${i}" title="${esc(stateName(c.st))}" aria-label="${esc(`${c.text}: ${stateName(c.st)}`)}">${markHtml(c.st)}<span>${esc(c.text)}</span></button>
      <button type="button" class="dm-x" data-dmx="${i}" aria-label="${esc(t('dm_del', { name: c.text }))}">×</button>
    </span>`).join('');
  dm.host.innerHTML = `
    <div class="dm-head">
      <span class="trait-title">${t('dm_title')}</span>
      <span class="hint dm-legend">
        <span>${markHtml('r')} ${t('dm_r')}</span><span>${markHtml('i')} ${t('dm_i')}</span><span>${markHtml('v')} ${t('dm_v')}</span>
        <span>${t('dm_click')}</span>
      </span>
    </div>
    <div class="dm-grid">${pills}${customs}</div>
    ${bypassRow(st, 'r')}${bypassRow(st, 'i')}
    <div class="dm-add">
      <input type="text" id="dm-custom" placeholder="${esc(t('dm_custom_ph'))}" aria-label="${esc(t('dm_custom_ph'))}" />
      <select id="dm-custom-st" aria-label="${esc(t('dm_custom_st'))}">${STATES.map((s) => `<option value="${s}">${MARK[s]} ${t('dm_' + s)}</option>`).join('')}</select>
      <button type="button" class="secondary small" id="dm-add">${t('dm_add')}</button>
    </div>`;
  dm.host.querySelector('#dm-custom').value = keep;
  dm.host.querySelector('#dm-custom-st').value = keepSt;
  if (hadFocus) dm.host.querySelector('#dm-custom').focus();
}

function addCustom() {
  const input = dm.host.querySelector('#dm-custom');
  const text = input.value.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return;
  const st = readDamage();
  const low = text.toLowerCase();
  // Un tipo standard scritto a mano accende la sua pillola; i doppioni si scartano.
  const s = dm.host.querySelector('#dm-custom-st').value;
  if (DAMAGE_TYPES.includes(low)) st.type[low] = s;
  else if (!st.custom.some((c) => c.text.toLowerCase() === low)) st.custom.push({ text, st: s });
  writeDamage(st);
  input.value = '';
  syncDamageMatrix();
  dm.host.querySelector('#dm-custom').focus();
  fire(dm.host);
}

export function initDamageMatrix({ host, groups, labels }) {
  if (!host) return;
  dm = { host, groups, labels };
  host.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.id === 'dm-add') return addCustom();
    const d = btn.dataset;
    if (!('dm' in d) && !('dmc' in d) && !('dmx' in d)) return;
    const st = readDamage();
    const next = (s) => STATES[STATES.indexOf(s) + 1] || '';
    let focus = null;
    if ('dm' in d) {
      const n = next(st.type[d.dm] || '');
      if (n) st.type[d.dm] = n; else delete st.type[d.dm];
      focus = `[data-dm="${d.dm}"]`;
    } else if ('dmc' in d) {
      const c = st.custom[Number(d.dmc)];
      c.st = next(c.st) || 'r'; // una voce scritta a mano ha sempre uno stato: si toglie con ×
      focus = `[data-dmc="${d.dmc}"]`;
    } else st.custom.splice(Number(d.dmx), 1);
    writeDamage(st);
    syncDamageMatrix();
    if (focus) {
      // Le voci scritte a mano sono elencate per stato: dopo il giro cambiano posto.
      const again = 'dmc' in d ? null : dm.host.querySelector(focus);
      again?.focus();
    }
    fire(host);
  });
  host.addEventListener('change', (ev) => {
    const bp = ev.target.dataset?.bp;
    if (!bp) return;
    const [s, id] = bp.split(':');
    const st = readDamage();
    if (ev.target.checked) st.bypass[s].add(id); else st.bypass[s].delete(id);
    writeDamage(st);
    fire(host);
  });
  host.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.id === 'dm-custom') { ev.preventDefault(); addCustom(); }
  });
  // Scrivere nella casella "altro" non è ancora un dato del mostro.
  host.addEventListener('input', (ev) => { if (ev.target.id === 'dm-custom' || ev.target.id === 'dm-custom-st') ev.stopPropagation(); });
  syncDamageMatrix();
}

/** Dopo un caricamento (bozza, statblock, JSON) o un cambio di tema: rilegge i dati veri. */
export function syncStudioWidgets() {
  syncSkillPills();
  syncDamageMatrix();
}
