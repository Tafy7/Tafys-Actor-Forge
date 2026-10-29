// ============================================================
// Tab "Scontro" — encounter builder (party vs mostri → difficoltà).
// Mobile-first: card impilate, stepper con bersagli da 40px, niente tabelle
// larghe; da 900px in su diventa a due colonne (impostazione | risultato).
// La matematica vive in tools/encounter.js (pura, testata); qui solo stato,
// DOM ed eventi. Lo stato è salvato in localStorage (comodità per-utente).
// ============================================================
import {
  computeEncounter, suggestAddition, nextTier, difficultyRank,
} from '../tools/encounter.js';
import { DMG_TABLE, crToNum, computeMonsterCR } from '../tools/expected-cr.js';
import { importActor } from '../parsers/actor-import.js';
import { t } from '../i18n.js';

const KEY = 'tafys-forge-encounter';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const crLabelOf = (n) => (DMG_TABLE.find(r => r.cr === crToNum(n)) || DMG_TABLE[0]).label;

let state = load();
let getData = () => ({});
let getBatch = () => [];

function defaults() {
  return { rules: '2014', party: [{ level: 5, count: 4 }], monsters: [] };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.party) && Array.isArray(s.monsters)) return { ...defaults(), ...s };
  } catch { /* storage non disponibile o corrotto */ }
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage off */ }
}

// ---- Rendering --------------------------------------------------------------

const stepper = (attr, idx, value) => `
  <div class="enc-stepper">
    <button type="button" class="secondary" data-${attr}-dec="${idx}" aria-label="−">−</button>
    <span class="enc-count">${value}</span>
    <button type="button" class="secondary" data-${attr}-inc="${idx}" aria-label="+">+</button>
  </div>`;

function renderRules() {
  document.querySelectorAll('[data-enc-rules]').forEach((b) => {
    b.classList.toggle('on', b.dataset.encRules === state.rules);
  });
}

function renderParty() {
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);
  document.getElementById('enc-party').innerHTML = state.party.map((g, i) => `
    <div class="enc-card enc-party-row">
      <label class="enc-lvl">${t('enc_level')}
        <select data-party-level="${i}">${levels.map(l => `<option value="${l}" ${l === Number(g.level) ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <div class="enc-qty"><span class="enc-qty-label">${t('enc_pcs')}</span>${stepper('party', i, g.count)}</div>
      <button type="button" class="remove" data-party-del="${i}" title="${t('enc_remove')}" ${state.party.length < 2 ? 'disabled' : ''}>✖</button>
    </div>`).join('');
}

function renderMonsters() {
  const box = document.getElementById('enc-monsters');
  if (!state.monsters.length) { box.innerHTML = `<p class="hint enc-empty">${t('enc_none_monsters')}</p>`; return; }
  box.innerHTML = state.monsters.map((m, i) => `
    <div class="enc-card enc-mon-row">
      <input type="text" data-mon-name="${i}" value="${esc(m.name)}" placeholder="${t('enc_name_ph')}" aria-label="${t('enc_name_ph')}" />
      <div class="enc-mon-ctrls">
        <label class="enc-cr">CR
          <select data-mon-cr="${i}">${DMG_TABLE.map(r => `<option value="${r.label}" ${r.label === m.cr ? 'selected' : ''}>${r.label}</option>`).join('')}</select>
        </label>
        <div class="enc-qty">${stepper('mon', i, m.count)}</div>
        <button type="button" class="remove" data-mon-del="${i}" title="${t('enc_remove')}">✖</button>
      </div>
      ${m.estCr && m.estCr !== m.cr ? `<button type="button" class="secondary enc-est" data-mon-est="${i}" title="${t('enc_est_title')}">${t('enc_est', { cr: m.estCr })}</button>` : ''}
    </div>`).join('');
}

// Riepilogo compatto (solo telefono): resta in cima mentre si modifica,
// un tocco porta al risultato completo.
function renderMini(enc) {
  const el = document.getElementById('enc-mini');
  if (!el) return;
  el.className = `secondary enc-mini enc-d-${enc.difficulty}`;
  el.innerHTML = enc.difficulty === 'none'
    ? `<span class="hint">${t('enc_need_both')}</span>`
    : `<span class="enc-mini-label">${t('enc_difficulty')}</span>
       <b class="enc-mini-val">${t('enc_d_' + enc.difficulty)}</b>
       <span class="enc-mini-xp">${enc.adjustedXP.toLocaleString()} ${t('enc_xp_short')}</span>
       <span class="enc-mini-go" aria-hidden="true">↓</span>`;
}

function renderResult() {
  const enc = computeEncounter(state);
  renderMini(enc);
  const box = document.getElementById('enc-result');
  if (enc.difficulty === 'none') {
    box.innerHTML = `<div class="enc-res-card enc-d-none"><p class="hint">${t('enc_need_both')}</p></div>`;
    return;
  }
  // Barra: scala fino al livello più alto (o oltre, se lo scontro lo supera).
  const top = enc.tiers[enc.tiers.length - 1].xp;
  const max = Math.max(top, enc.adjustedXP, 1) * 1.08;
  const pct = (x) => `${Math.min(100, (x / max) * 100).toFixed(1)}%`;
  const ticks = enc.tiers.map(tr => `<span class="enc-tick" style="left:${pct(tr.xp)}"></span>`).join('');
  const legend = enc.tiers.map(tr => `
    <li class="${difficultyRank(enc.difficulty) >= difficultyRank(tr.key) ? 'reached' : ''}">
      <span class="enc-dot enc-d-${tr.key}"></span>${t('enc_d_' + tr.key)} <b>${tr.xp.toLocaleString()}</b>
    </li>`).join('');

  // Suggerimento: cosa aggiungere per salire di un livello.
  let suggest = '';
  const target = nextTier(enc);
  if (target) {
    const s = suggestAddition(state, target);
    if (s) {
      suggest = `<p class="enc-suggest">💡 ${t('enc_suggest', { tier: t('enc_d_' + target), cr: s.label, xp: s.xp.toLocaleString() })}${s.overshoot ? ` ${t('enc_overshoot', { tier: t('enc_d_' + s.result) })}` : ''}</p>`;
    }
  } else if (enc.overTopPct > 0) {
    // Oltre il livello massimo (Letale / budget Alto): quanto si sfora.
    suggest = `<p class="enc-suggest enc-warn">⚠ ${t(enc.rules === '2024' ? 'enc_warn_over_high' : 'enc_warn_over_deadly', { pct: enc.overTopPct })}</p>`;
  } else {
    suggest = `<p class="enc-suggest">${t(enc.rules === '2024' ? 'enc_at_high' : 'enc_at_deadly')}</p>`;
  }

  const is2014 = enc.rules === '2014';
  box.innerHTML = `
  <div class="enc-res-card enc-d-${enc.difficulty}">
    <div class="enc-verdict">
      <span class="enc-verdict-label">${t('enc_difficulty')}</span>
      <span class="enc-verdict-val">${t('enc_d_' + enc.difficulty)}</span>
    </div>
    <div class="enc-bar" role="img" aria-label="${t('enc_d_' + enc.difficulty)}">
      <span class="enc-fill" style="width:${pct(enc.adjustedXP)}"></span>${ticks}
    </div>
    <ul class="enc-legend">${legend}</ul>
    <div class="enc-nums">
      <div><span>${t('enc_xp_base')}</span><b>${enc.baseXP.toLocaleString()}</b></div>
      ${is2014 ? `<div><span>${t('enc_mult')}</span><b>×${enc.multiplier}</b></div>
      <div><span>${t('enc_xp_adj')}</span><b>${enc.adjustedXP.toLocaleString()}</b></div>` : ''}
      <div><span>${t('enc_per_pc')}</span><b>${enc.perPC.toLocaleString()}</b></div>
    </div>
    ${suggest}
    <p class="hint enc-note">${t(is2014 ? 'enc_note_2014' : 'enc_note_2024', { pcs: enc.partySize, mons: enc.monsterCount })}</p>
  </div>`;
}

function renderAll() { renderRules(); renderParty(); renderMonsters(); renderResult(); }
function changed(structural) { save(); if (structural) renderAll(); else renderResult(); }

function msg(text) {
  const el = document.getElementById('enc-msg');
  if (!el) return;
  el.textContent = text;
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3000);
}

// ---- Aggiunta mostri --------------------------------------------------------

// Se c'è già un mostro con lo stesso nome e CR, aumenta la quantità invece di
// duplicare la riga (tre goblin = una riga ×3).
function addMonster({ name, cr, estCr = null, count = 1 }) {
  const label = crLabelOf(cr);
  const same = state.monsters.find(m => m.name.trim().toLowerCase() === String(name).trim().toLowerCase() && m.cr === label);
  if (same && String(name).trim()) same.count += count;
  else state.monsters.push({ name: String(name || ''), cr: label, count, estCr: estCr ? crLabelOf(estCr) : null });
}

// CR stimato (Expected CR) di un descrittore del form, se calcolabile.
function estimateOf(data) {
  try {
    const r = computeMonsterCR(data, {});
    const hasOffense = r.inputs.atkBonus != null || r.inputs.saveDC != null;
    return Number(data.hpMax) > 0 && hasOffense ? r.cr : null;
  } catch { return null; }
}

function addCurrent() {
  const data = getData() || {};
  if (!String(data.name || '').trim() && !Number(data.hpMax)) { msg(t('enc_msg_no_monster')); return; }
  addMonster({ name: data.name || t('enc_unnamed'), cr: data.cr || '0', estCr: estimateOf(data) });
  msg(t('enc_msg_added', { name: data.name || t('enc_unnamed') }));
  changed(true);
}

function addFromBatch() {
  const actors = (getBatch() || []).filter(d => d && d.type === 'npc');
  if (!actors.length) { msg(t('enc_msg_batch_empty')); return; }
  for (const doc of actors) {
    // Il round-trip ci dà il descrittore del form → stessa stima del cartellino CR.
    let est = null;
    try { est = estimateOf(importActor(doc).data); } catch { /* actor esotico */ }
    addMonster({ name: doc.name, cr: doc.system?.details?.cr ?? 0, estCr: est });
  }
  msg(t('enc_msg_batch', { n: actors.length }));
  changed(true);
}

// ---- Eventi -----------------------------------------------------------------

export function initEncounterTab(opts = {}) {
  getData = opts.getData || getData;
  getBatch = opts.getBatch || getBatch;
  const root = document.getElementById('tab-enc');
  if (!root) return;

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.encRules) { state.rules = d.encRules; return changed(true); }
    if (d.partyInc !== undefined) { state.party[d.partyInc].count = Math.min(12, state.party[d.partyInc].count + 1); return changed(true); }
    if (d.partyDec !== undefined) { state.party[d.partyDec].count = Math.max(1, state.party[d.partyDec].count - 1); return changed(true); }
    if (d.partyDel !== undefined) { if (state.party.length > 1) state.party.splice(Number(d.partyDel), 1); return changed(true); }
    if (d.monInc !== undefined) { state.monsters[d.monInc].count = Math.min(99, state.monsters[d.monInc].count + 1); return changed(true); }
    if (d.monDec !== undefined) { state.monsters[d.monDec].count = Math.max(1, state.monsters[d.monDec].count - 1); return changed(true); }
    if (d.monDel !== undefined) { state.monsters.splice(Number(d.monDel), 1); return changed(true); }
    if (d.monEst !== undefined) { const m = state.monsters[d.monEst]; m.cr = m.estCr; return changed(true); }
    if (b.id === 'enc-add-group') { const last = state.party[state.party.length - 1]; state.party.push({ level: last ? last.level : 1, count: 1 }); return changed(true); }
    if (b.id === 'enc-add-monster') { state.monsters.push({ name: '', cr: '1', count: 1, estCr: null }); return changed(true); }
    if (b.id === 'enc-add-current') return addCurrent();
    if (b.id === 'enc-add-batch') return addFromBatch();
    if (b.id === 'enc-clear') { state.monsters = []; return changed(true); }
    if (b.id === 'enc-mini') { document.getElementById('enc-result').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  root.addEventListener('change', (ev) => {
    const d = ev.target.dataset;
    if (d.partyLevel !== undefined) { state.party[d.partyLevel].level = Number(ev.target.value); changed(true); }
    if (d.monCr !== undefined) { state.monsters[d.monCr].cr = ev.target.value; changed(true); }
  });
  // Il nome non cambia la struttura: aggiorna solo lo stato (focus preservato).
  root.addEventListener('input', (ev) => {
    const d = ev.target.dataset;
    if (d.monName !== undefined) { state.monsters[d.monName].name = ev.target.value; save(); }
  });

  renderAll();
}
