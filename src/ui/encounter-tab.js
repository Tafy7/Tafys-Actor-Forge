// ============================================================
// Tab "Scontro" — encounter builder (party vs mostri → difficoltà).
// Mobile-first: card impilate, stepper con bersagli da 40px, niente tabelle
// larghe; da 900px in su diventa a due colonne (impostazione | risultato).
// Due letture affiancate: i PE (DMG 2014/2024) e una SIMULAZIONE a valore
// atteso che usa PF/CA/attacco/danno di PG e mostri. Le stat stanno in una
// sezione richiudibile per card, così la vista resta pulita.
// La matematica vive in tools/encounter.js e parsers/pc-import.js (pure,
// testate); qui solo stato, DOM ed eventi. Stato in localStorage.
// ============================================================
import {
  computeEncounter, suggestAddition, nextTier, difficultyRank,
  simulateCombat, pcEstimates, monsterEstimates,
} from '../tools/encounter.js';
import { DMG_TABLE, crToNum, computeMonsterCR, monsterACValue, rawDprFromMonster } from '../tools/expected-cr.js';
import { importActor } from '../parsers/actor-import.js';
import { importPCs } from '../parsers/pc-import.js';
import { t } from '../i18n.js';

const KEY = 'tafys-forge-encounter';
const STATS = ['hp', 'ac', 'atk', 'dpr'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const crLabelOf = (n) => (DMG_TABLE.find(r => r.cr === crToNum(n)) || DMG_TABLE[0]).label;
const given = (v) => String(v ?? '').trim() !== '' && Number.isFinite(Number(v));

let getData = () => ({});
let getBatch = () => [];

const blankStats = () => ({ hp: '', ac: '', atk: '', dpr: '' });
function defaults() {
  return { rules: '2014', party: [{ name: '', level: 5, count: 4, ...blankStats() }], monsters: [] };
}
// Migrazione: lo stato della v0.31 aveva party [{level,count}] e mostri senza stat.
function normalize(s) {
  return {
    rules: s.rules === '2024' ? '2024' : '2014',
    party: (s.party || []).map(p => ({ name: '', ...blankStats(), ...p })),
    monsters: (s.monsters || []).map(m => ({ ...blankStats(), estCr: null, ...m })),
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.party) && Array.isArray(s.monsters)) return normalize(s);
  } catch { /* storage non disponibile o corrotto */ }
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage off */ }
}
// ⚠ Lo stato si carica DOPO aver definito tutti gli helper: load() usa
// blankStats (una const), e chiamarla prima della sua dichiarazione è un
// errore TDZ che, in un bundle unico, ferma l'esecuzione dell'INTERA app.
let state = load();

// ---- Rendering --------------------------------------------------------------

const stepper = (attr, idx, value) => `
  <div class="enc-stepper">
    <button type="button" class="secondary" data-${attr}-dec="${idx}" aria-label="−">−</button>
    <span class="enc-count">${value}</span>
    <button type="button" class="secondary" data-${attr}-inc="${idx}" aria-label="+">+</button>
  </div>`;

// Riepilogo delle stat nel <summary>: "35 PF · CA 15 · +5 · ~19 danno".
// Il "~" marca i valori stimati (campo vuoto).
function statSummary(entry, est) {
  const v = (k) => (given(entry[k]) ? Number(entry[k]) : `~${est[k]}`);
  const atk = given(entry.atk) ? `+${Number(entry.atk)}` : `~+${est.atk}`;
  return `${v('hp')} ${t('enc_st_hp')} · ${t('enc_st_ac')} ${v('ac')} · ${atk} · ${v('dpr')} ${t('enc_sum_dmg')}`;
}

// Sezione richiudibile con i 4 campi; i placeholder mostrano la stima.
function statsBlock(kind, i, entry, est) {
  const field = (k, step = '1') => `
    <label>${t('enc_st_' + k)}
      <input type="number" inputmode="decimal" step="${step}" data-${kind}-stat="${i}:${k}" value="${esc(entry[k])}" placeholder="${est[k]}" />
    </label>`;
  return `
    <details class="enc-stats" data-${kind}-open="${i}" ${entry._open ? 'open' : ''}>
      <summary><span class="enc-stats-label">${t('enc_stats')}</span> <span class="enc-stat-sum">${statSummary(entry, est)}</span></summary>
      <div class="enc-stats-grid">${field('hp')}${field('ac')}${field('atk')}${field('dpr', '0.5')}</div>
      <p class="hint">${t(kind === 'pc' ? 'enc_st_hint_pc' : 'enc_st_hint_mon')}</p>
    </details>`;
}

function renderRules() {
  document.querySelectorAll('[data-enc-rules]').forEach((b) => {
    b.classList.toggle('on', b.dataset.encRules === state.rules);
  });
}

function renderParty() {
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);
  document.getElementById('enc-party').innerHTML = state.party.map((g, i) => `
    <div class="enc-card enc-party-row">
      <input type="text" data-pc-name="${i}" value="${esc(g.name)}" placeholder="${t('enc_pc_name_ph')}" aria-label="${t('enc_pc_name_ph')}" />
      <div class="enc-row-ctrls">
        <label class="enc-lvl">${t('enc_level')}
          <select data-party-level="${i}">${levels.map(l => `<option value="${l}" ${l === Number(g.level) ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </label>
        <div class="enc-qty"><span class="enc-qty-label">${t('enc_pcs')}</span>${stepper('party', i, g.count)}</div>
        <button type="button" class="remove" data-party-del="${i}" title="${t('enc_remove')}" ${state.party.length < 2 ? 'disabled' : ''}>✖</button>
      </div>
      ${statsBlock('pc', i, g, pcEstimates(g.level))}
    </div>`).join('');
}

function renderMonsters() {
  const box = document.getElementById('enc-monsters');
  if (!state.monsters.length) { box.innerHTML = `<p class="hint enc-empty">${t('enc_none_monsters')}</p>`; return; }
  box.innerHTML = state.monsters.map((m, i) => `
    <div class="enc-card enc-mon-row">
      <input type="text" data-mon-name="${i}" value="${esc(m.name)}" placeholder="${t('enc_name_ph')}" aria-label="${t('enc_name_ph')}" />
      <div class="enc-row-ctrls">
        <label class="enc-cr">CR
          <select data-mon-cr="${i}">${DMG_TABLE.map(r => `<option value="${r.label}" ${r.label === m.cr ? 'selected' : ''}>${r.label}</option>`).join('')}</select>
        </label>
        <div class="enc-qty">${stepper('mon', i, m.count)}</div>
        <button type="button" class="remove" data-mon-del="${i}" title="${t('enc_remove')}">✖</button>
      </div>
      ${m.estCr && m.estCr !== m.cr ? `<button type="button" class="secondary enc-est" data-mon-est="${i}" title="${t('enc_est_title')}">${t('enc_est', { cr: m.estCr })}</button>` : ''}
      ${statsBlock('mon', i, m, monsterEstimates(m.cr))}
    </div>`).join('');
}

// Pannello della simulazione (sotto i PE).
function simHtml(sim) {
  if (!sim) return '';
  let line;
  if (sim.winner === 'party') {
    const lost = Math.round(sim.partyHP0 * sim.lostPct / 100);
    line = t('enc_sim_party_win', { r: sim.rounds, pct: sim.lostPct, lost, tot: sim.partyHP0 });
  } else if (sim.winner === 'monsters') line = t('enc_sim_monsters_win', { r: sim.rounds });
  else if (sim.winner === 'both') line = t('enc_sim_both', { r: sim.rounds });
  else line = t('enc_sim_stall', { r: sim.rounds });
  return `
  <div class="enc-sim enc-s-${sim.verdict}">
    <div class="enc-sim-head">
      <span class="enc-verdict-label">${t('enc_sim_title')}</span>
      <b class="enc-sim-val">${t('enc_s_' + sim.verdict)}</b>
    </div>
    <p class="enc-sim-line">${line}</p>
    <div class="enc-nums">
      <div><span>${t('enc_sim_party_dmg')}</span><b>${sim.partyEff}</b><em>${t('enc_sim_hit', { pct: sim.partyHitPct, ac: sim.monsterAC })}</em></div>
      <div><span>${t('enc_sim_mon_dmg')}</span><b>${sim.monsterEff}</b><em>${t('enc_sim_hit', { pct: sim.monsterHitPct, ac: sim.partyAC })}</em></div>
      <div><span>${t('enc_sim_hp_party')}</span><b>${sim.partyHP0.toLocaleString()}</b></div>
      <div><span>${t('enc_sim_hp_mon')}</span><b>${sim.monsterHP0.toLocaleString()}</b></div>
    </div>
    <p class="hint enc-note">${t('enc_sim_note')}${sim.estimated ? ' ' + t('enc_sim_note_est') : ''}</p>
  </div>`;
}

// Riepilogo compatto (solo telefono): resta in cima mentre si modifica,
// un tocco porta al risultato completo.
function renderMini(enc, sim) {
  const el = document.getElementById('enc-mini');
  if (!el) return;
  el.className = `secondary enc-mini enc-d-${enc.difficulty}`;
  el.innerHTML = enc.difficulty === 'none'
    ? `<span class="hint">${t('enc_need_both')}</span>`
    : `<span class="enc-mini-label">${t('enc_difficulty')}</span>
       <b class="enc-mini-val">${t('enc_d_' + enc.difficulty)}</b>
       ${sim ? `<span class="enc-mini-sim enc-s-${sim.verdict}">${t('enc_mini_sim')}: <b>${t('enc_s_' + sim.verdict)}</b></span>` : ''}
       <span class="enc-mini-go" aria-hidden="true">↓</span>`;
}

function renderResult() {
  const enc = computeEncounter(state);
  const sim = enc.difficulty === 'none' ? null : simulateCombat(state);
  renderMini(enc, sim);
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
    suggest = `<p class="enc-suggest enc-warn">⚠ ${t(enc.rules === '2024' ? 'enc_warn_over_high' : 'enc_warn_over_deadly', { pct: enc.overTopPct })}</p>`;
  } else {
    suggest = `<p class="enc-suggest">${t(enc.rules === '2024' ? 'enc_at_high' : 'enc_at_deadly')}</p>`;
  }

  const is2014 = enc.rules === '2014';
  box.innerHTML = `
  <div class="enc-res-card enc-d-${enc.difficulty}">
    <div class="enc-verdict">
      <span class="enc-verdict-label">${t('enc_difficulty')} · ${t('enc_by_xp')}</span>
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
    <p class="hint enc-note">${t(is2014 ? 'enc_note_2014' : 'enc_note_2024', { pcs: enc.partySize, mons: enc.monsterCount })}${enc.ignoredForMult ? ' ' + t('enc_ignored', { n: enc.ignoredForMult }) : ''}</p>
    ${simHtml(sim)}
  </div>`;
}

function renderAll() { renderRules(); renderParty(); renderMonsters(); renderResult(); }
function changed(structural) { save(); if (structural) renderAll(); else renderResult(); }

function msg(text, id = 'enc-msg') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4000);
}

// ---- Aggiunta mostri --------------------------------------------------------

// Se c'è già un mostro con lo stesso nome e CR, aumenta la quantità invece di
// duplicare la riga (tre goblin = una riga ×3).
function addMonster({ name, cr, estCr = null, count = 1, stats = {} }) {
  const label = crLabelOf(cr);
  const same = state.monsters.find(m => m.name.trim().toLowerCase() === String(name).trim().toLowerCase() && m.cr === label);
  if (same && String(name).trim()) same.count += count;
  else state.monsters.push({ name: String(name || ''), cr: label, count, estCr: estCr ? crLabelOf(estCr) : null, ...blankStats(), ...stats });
}

// Stat reali di un mostro dal descrittore del form. L'attacco di un mostro
// che usa solo tiri salvezza è convertito col criterio del DMG (CD = attacco + 10).
function statsOf(data, attacksPerRound = 0) {
  try {
    const r = rawDprFromMonster(data, attacksPerRound);
    const atk = r.atkBonus != null ? r.atkBonus : (r.saveDC != null ? r.saveDC - 10 : null);
    return {
      hp: Number(data.hpMax) > 0 ? String(Number(data.hpMax)) : '',
      ac: String(monsterACValue(data)),
      atk: atk != null ? String(atk) : '',
      dpr: r.dpr > 0 ? String(Math.round(r.dpr * 10) / 10) : '',
    };
  } catch { return {}; }
}

// CR stimato (Expected CR) di un descrittore del form, se calcolabile.
function estimateOf(data, attacksPerRound = 0) {
  try {
    const r = computeMonsterCR(data, { attacksPerRound });
    const hasOffense = r.inputs.atkBonus != null || r.inputs.saveDC != null;
    return Number(data.hpMax) > 0 && hasOffense ? r.cr : null;
  } catch { return null; }
}

function addCurrent() {
  const data = getData() || {};
  if (!String(data.name || '').trim() && !Number(data.hpMax)) { msg(t('enc_msg_no_monster')); return; }
  // Gli "attacchi/round" del cartellino CR valgono anche qui.
  const apr = Number(document.getElementById('cr-multiattack')?.value) || 0;
  addMonster({ name: data.name || t('enc_unnamed'), cr: data.cr || '0', estCr: estimateOf(data, apr), stats: statsOf(data, apr) });
  msg(t('enc_msg_added', { name: data.name || t('enc_unnamed') }));
  changed(true);
}

function addFromBatch() {
  const actors = (getBatch() || []).filter(d => d && d.type === 'npc');
  if (!actors.length) { msg(t('enc_msg_batch_empty')); return; }
  for (const doc of actors) {
    // Il round-trip ci dà il descrittore del form → stesse stat e stima del cartellino CR.
    let data = null;
    try { data = importActor(doc).data; } catch { /* actor esotico */ }
    addMonster({
      name: doc.name, cr: doc.system?.details?.cr ?? 0,
      estCr: data ? estimateOf(data) : null, stats: data ? statsOf(data) : {},
    });
  }
  msg(t('enc_msg_batch', { n: actors.length }));
  changed(true);
}

// ---- Import dei PG ------------------------------------------------------------

// Un PG con lo stesso nome viene AGGIORNATO (re-import dopo un level-up);
// la riga generica di partenza (senza nome né stat) viene sostituita.
function mergePCs(pcs) {
  const untouched = state.party.length === 1 && !state.party[0].name.trim() && STATS.every(k => !given(state.party[0][k]));
  if (untouched && pcs.length) state.party = [];
  for (const pc of pcs) {
    const same = state.party.find(p => p.name.trim() && p.name.trim().toLowerCase() === pc.name.trim().toLowerCase());
    if (same) Object.assign(same, { level: pc.level, hp: pc.hp, ac: pc.ac, atk: pc.atk, dpr: same.dpr || pc.dpr });
    else state.party.push({ ...pc });
  }
}

function applyPCImport(jsonList) {
  const all = { pcs: [], report: [] };
  for (const json of jsonList) {
    const r = importPCs(json);
    all.pcs.push(...r.pcs);
    all.report.push(...r.report);
  }
  const box = document.getElementById('enc-pc-report');
  if (box) { box.hidden = false; box.textContent = all.report.join('\n') + (all.pcs.length ? '\n\n' + t('enc_pc_dpr_reminder') : ''); }
  if (all.pcs.length) { mergePCs(all.pcs); changed(true); msg(t('enc_msg_pcs', { n: all.pcs.length }), 'enc-pc-msg'); }
}

function readFiles(files) {
  const list = [...files];
  Promise.all(list.map(f => f.text().then(txt => {
    try { return JSON.parse(txt); } catch { return { __bad: f.name }; }
  }))).then((jsons) => {
    const bad = jsons.filter(j => j && j.__bad).map(j => j.__bad);
    applyPCImport(jsons.filter(j => !(j && j.__bad)));
    if (bad.length) msg(t('enc_bad_json_files', { files: bad.join(', ') }), 'enc-pc-msg');
  });
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
    if (b.id === 'enc-add-group') { const last = state.party[state.party.length - 1]; state.party.push({ name: '', level: last ? last.level : 1, count: 1, ...blankStats() }); return changed(true); }
    if (b.id === 'enc-import-pc') { document.getElementById('enc-pc-file').click(); return; }
    if (b.id === 'enc-pc-paste-go') {
      const txt = document.getElementById('enc-pc-paste').value;
      if (!txt.trim()) { msg(t('enc_paste_first'), 'enc-pc-msg'); return; }
      let json;
      try { json = JSON.parse(txt); } catch { msg(t('enc_bad_json'), 'enc-pc-msg'); return; }
      applyPCImport([json]);
      return;
    }
    if (b.id === 'enc-add-monster') { state.monsters.push({ name: '', cr: '1', count: 1, estCr: null, ...blankStats() }); return changed(true); }
    if (b.id === 'enc-add-current') return addCurrent();
    if (b.id === 'enc-add-batch') return addFromBatch();
    if (b.id === 'enc-clear') { state.monsters = []; return changed(true); }
    if (b.id === 'enc-mini') { document.getElementById('enc-result').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  root.addEventListener('change', (ev) => {
    const d = ev.target.dataset;
    if (d.partyLevel !== undefined) { state.party[d.partyLevel].level = Number(ev.target.value); changed(true); }
    if (d.monCr !== undefined) { state.monsters[d.monCr].cr = ev.target.value; changed(true); }
    if (ev.target.id === 'enc-pc-file' && ev.target.files?.length) { readFiles(ev.target.files); ev.target.value = ''; }
  });

  // Nomi e stat non cambiano la struttura: aggiorna stato + risultato e il
  // riepilogo della card in posto (il focus resta nel campo).
  root.addEventListener('input', (ev) => {
    const d = ev.target.dataset;
    if (d.monName !== undefined) { state.monsters[d.monName].name = ev.target.value; save(); return; }
    if (d.pcName !== undefined) { state.party[d.pcName].name = ev.target.value; save(); return; }
    const stat = d.pcStat || d.monStat;
    if (stat) {
      const [i, k] = stat.split(':');
      const isPC = Boolean(d.pcStat);
      const entry = isPC ? state.party[i] : state.monsters[i];
      entry[k] = ev.target.value;
      const sum = ev.target.closest('details')?.querySelector('.enc-stat-sum');
      if (sum) sum.textContent = statSummary(entry, isPC ? pcEstimates(entry.level) : monsterEstimates(entry.cr));
      changed(false);
    }
  });

  // Stato aperto/chiuso delle sezioni stat ('toggle' non fa bubbling → capture).
  root.addEventListener('toggle', (ev) => {
    const d = ev.target.dataset || {};
    if (d.pcOpen !== undefined) { state.party[d.pcOpen]._open = ev.target.open; save(); }
    if (d.monOpen !== undefined) { state.monsters[d.monOpen]._open = ev.target.open; save(); }
  }, true);

  renderAll();
}
