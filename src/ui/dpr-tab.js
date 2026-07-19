// ============================================================
// Tab "Calcolatore DPR" — UI. La matematica sta in tools/dpr.js.
// Novità rispetto al calcolatore di riferimento: critici, cap corretto
// della probabilità, lettura degli attacchi dal mostro in costruzione,
// grafico DPR-vs-CA in SVG inline (nessuna dipendenza esterna).
// ============================================================
import { totalDPR, dprCurve, attacksFromMonster } from '../tools/dpr.js';
import { t } from '../i18n.js';

let rows = [];
let getMonsterData = () => ({});

const newRow = () => ({ name: '', dice: '', atkBonus: 0, count: 1, type: 'attack' });
const esc = (s) => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function rowHtml(r, i) {
  const isSave = r.type === 'save';
  return `
  <div class="dpr-row" data-i="${i}">
    <select data-f="type">
      <option value="attack" ${!isSave ? 'selected' : ''}>${t('dpr_t_attack')}</option>
      <option value="save" ${isSave ? 'selected' : ''}>${t('dpr_t_save')}</option>
    </select>
    <input type="text" data-f="name" value="${esc(r.name)}" placeholder="${t('dpr_ph_name')}" />
    <input type="text" data-f="dice" value="${esc(r.dice)}" placeholder="2d8 + 4" title="${t('dpr_dice_hint')}" />
    <input type="number" data-f="atkBonus" value="${esc(r.atkBonus)}" title="${isSave ? t('dpr_dc') : t('dpr_bonus')}" style="width:4.5rem" />
    <input type="number" data-f="count" value="${esc(r.count)}" min="1" title="${t('dpr_count')}" style="width:3.5rem" />
    <button type="button" class="remove" data-del="${i}" title="${t('dpr_remove')}">✖</button>
  </div>`;
}

function renderRows() {
  const box = document.getElementById('dpr-rows');
  box.innerHTML = `
    <div class="dpr-row dpr-head">
      <span>${t('dpr_type')}</span><span>${t('dpr_name')}</span><span>${t('dpr_damage')}</span>
      <span>${t('dpr_bonus_dc')}</span><span>${t('dpr_num')}</span><span></span>
    </div>` + rows.map(rowHtml).join('');
}

/** Righe con il TS del bersaglio globale iniettato (per le azioni a TS). */
function rowsForCalc() {
  const ts = Number(document.getElementById('dpr-save').value) || 0;
  return rows.map(r => (r.type === 'save' ? { ...r, targetSave: ts, half: true } : r));
}

function recompute() {
  const ac = Number(document.getElementById('dpr-ac').value) || 15;
  const calcRows = rowsForCalc();
  document.getElementById('dpr-out').textContent = totalDPR(calcRows, ac).toFixed(2);
  drawChart(dprCurve(calcRows, 8, 25), ac);
}

/** Grafico DPR-vs-CA in SVG puro (niente librerie): curva + marker sulla CA scelta. */
function drawChart(curve, currentAc) {
  // padT ampio e "headroom" del 18% sopra il massimo: così una curva PIATTA
  // (tipico delle azioni a solo TS, che non dipendono dalla CA) non finisce
  // schiacciata sul bordo superiore con l'etichetta tagliata fuori.
  const W = 380, H = 220, padL = 36, padB = 40, padT = 20, padR = 12;
  const dataMax = Math.max(1, ...curve.map(p => p.dpr)); // per le etichette dell'asse
  const top = dataMax * 1.18;                            // per la scala verticale
  const a0 = curve[0].ac, a1 = curve[curve.length - 1].ac;
  const X = (ac) => padL + (ac - a0) / (a1 - a0) * (W - padL - padR);
  const Y = (dpr) => H - padB - dpr / top * (H - padB - padT);
  const pts = curve.map(p => `${X(p.ac).toFixed(1)},${Y(p.dpr).toFixed(1)}`).join(' ');
  const cur = curve.find(p => p.ac === currentAc);
  const marker = cur ? `
    <line x1="${X(cur.ac)}" y1="${padT}" x2="${X(cur.ac)}" y2="${H - padB}" class="dpr-marker" />
    <circle cx="${X(cur.ac)}" cy="${Y(cur.dpr)}" r="4" class="dpr-dot" />
    <text x="${X(cur.ac)}" y="${Y(cur.dpr) - 8}" class="dpr-lbl" text-anchor="middle">${cur.dpr.toFixed(1)}</text>` : '';
  const yTicks = [0, 0.5, 1].map(f => {
    const v = dataMax * f;
    return `<text x="${padL - 6}" y="${Y(v) + 3}" class="dpr-axis" text-anchor="end">${v.toFixed(0)}</text>`;
  }).join('');
  const xTicks = [a0, Math.round((a0 + a1) / 2), a1].map(ac =>
    `<text x="${X(ac)}" y="${H - padB + 15}" class="dpr-axis" text-anchor="middle">${ac}</text>`).join('');
  document.getElementById('dpr-chart').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="dpr-svg">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" class="dpr-axisline" />
      <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" class="dpr-axisline" />
      ${yTicks}${xTicks}
      <polyline points="${pts}" class="dpr-curve" />
      ${marker}
      <text x="${(padL + W - padR) / 2}" y="${H - 6}" class="dpr-axis dpr-axis-title" text-anchor="middle">${t('dpr_x')}</text>
    </svg>`;
}

function loadFromMonster() {
  const loaded = attacksFromMonster(getMonsterData());
  const msg = document.getElementById('dpr-msg');
  if (!loaded.length) { msg.textContent = t('dpr_none'); return; }
  rows = loaded;
  msg.textContent = t('dpr_loaded', { n: loaded.length });
  setTimeout(() => { if (msg.textContent === t('dpr_loaded', { n: loaded.length })) msg.textContent = ''; }, 3000);
  renderRows();
  recompute();
}

export function initDprTab({ getData }) {
  getMonsterData = getData;
  document.getElementById('dpr-add').addEventListener('click', () => { rows.push(newRow()); renderRows(); recompute(); });
  document.getElementById('dpr-load').addEventListener('click', loadFromMonster);
  document.getElementById('dpr-ac').addEventListener('input', recompute);
  document.getElementById('dpr-save').addEventListener('input', recompute);

  const box = document.getElementById('dpr-rows');
  box.addEventListener('input', (ev) => {
    const row = ev.target.closest('[data-i]'); const f = ev.target.dataset.f;
    if (!row || !f) return;
    const r = rows[Number(row.dataset.i)];
    r[f] = ev.target.value;
    if (f === 'type') { renderRows(); } // cambia le etichette bonus/CD
    recompute();
  });
  box.addEventListener('click', (ev) => {
    if (ev.target.dataset.del === undefined) return;
    rows.splice(Number(ev.target.dataset.del), 1);
    renderRows(); recompute();
  });

  if (!rows.length) rows.push(newRow());
  renderRows();
  recompute();
}
