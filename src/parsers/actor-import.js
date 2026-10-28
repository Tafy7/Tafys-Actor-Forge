// ============================================================
// Round-trip (Fase 8) — IMPORT di un Actor Foundry nel form.
//
// È il ROVESCIO di builders/npc.js + builders/item.js: legge un JSON actor
// (dnd5e 5.x) e ricostruisce il descrittore piatto del form (la stessa forma
// di readForm()), così si può ricaricare, ritoccare e ri-esportare.
//
// Regola d'oro speculare: ci appoggiamo alla STESSA conoscenza dei golden
// usata in andata. Ciò che il form non modella (es. spellcasting, parti di
// danno esotiche) viene segnalato nel report invece di essere perso in
// silenzio. Modulo PURO (niente DOM): si testa col round-trip sui golden.
// ============================================================
import { DAMAGE_BYPASSES } from '../data/constants.js';

// Reverse di DAMAGE_BYPASSES: mgc → nonmagical, sil → silvered, ada → adamantine.
const BYPASS_REV = Object.fromEntries(Object.entries(DAMAGE_BYPASSES).map(([k, v]) => [v, k]));

/** Numero CR → etichetta del form ("0.5" → "1/2"). */
function crLabel(n) {
  const v = Number(n) || 0;
  if (v === 0.125) return '1/8';
  if (v === 0.25) return '1/4';
  if (v === 0.5) return '1/2';
  return String(v);
}

/** {value[], bypasses[], custom} → "cold, fire, nonmagical, silvered, custom". */
function traitToString(tr) {
  if (!tr) return '';
  const parts = [...(tr.value || [])];
  for (const b of tr.bypasses || []) if (BYPASS_REV[b]) parts.push(BYPASS_REV[b]);
  if (tr.custom) parts.push(...String(tr.custom).split(';').map(s => s.trim()).filter(Boolean));
  return parts.join(', ');
}
/** {value[], custom} → "common, infernal, custom". */
function knownToString(tr) {
  if (!tr) return '';
  const parts = [...(tr.value || [])];
  if (tr.custom) parts.push(...String(tr.custom).split(';').map(s => s.trim()).filter(Boolean));
  return parts.join(', ');
}

/** Parti di danno dnd5e → stringa del form ("4d8 + 8 piercing, 16d6 force"). */
function partsToString(parts) {
  return (parts || []).map((p) => {
    const type = (p.types && p.types[0]) || '';
    if (p.custom && p.custom.enabled && p.custom.formula) return `${p.custom.formula} ${type}`.trim();
    let f = `${p.number}d${p.denomination}`;
    const bonus = String(p.bonus || '').trim();
    if (bonus) f += ` + ${bonus}`;
    return `${f} ${type}`.trim();
  }).filter(Boolean).join(', ');
}

/** flags.autoanimations → descrittore `aa` del form (reverse di buildAAFlags). */
function aaFromFlags(flag) {
  if (!flag || !flag.primary) return null;
  const path = String(flag.primary.video?.customPath || '').replace(/^jb2a\./, '');
  if (!path) return null;
  const o = flag.primary.options || {};
  const menu = flag.menu || 'ontoken';
  const scale = menu === 'templatefx' ? String(o.scale ?? '')
    : menu === 'range' ? '' : String(o.size ?? '');
  const snd = flag.primary.sound || {};
  const tgt = flag.target || {};
  const tgtPath = String(tgt.video?.customPath || '').replace(/^jb2a\./, '');
  return {
    enabled: true, menu, path, search: path,
    playOn: o.playOn === 'source' ? 'source' : 'target',
    persistent: Boolean(o.persistent),
    scale,
    soundEnable: Boolean(snd.enable && snd.file),
    soundFile: String(snd.file || ''),
    soundVolume: String(snd.volume ?? '0.75'),
    tgtEnabled: Boolean(tgt.enable && tgtPath),
    tgtPath, tgtSearch: tgtPath,
    tgtPersistent: Boolean(tgt.options?.persistent),
    tgtScale: String(tgt.options?.size ?? ''),
  };
}

/** flags["midi-qol"].onUseMacroName → righe [{timing, macro}]. */
function onUseFromFlags(item) {
  const raw = String(item.flags?.['midi-qol']?.onUseMacroName || '').trim();
  if (!raw) return [];
  const rows = [];
  for (const part of raw.split(',')) {
    const m = part.trim().match(/^\[([^\]]+)\]\s*(.+)$/);
    if (m) rows.push({ timing: m[1].trim(), macro: m[2].trim() });
  }
  return rows;
}

// Periodo di recovery dnd5e → modalità "usi" del form.
const PERIOD_REV = { day: 'day', sr: 'sr', lr: 'lr', turn: 'turn' };

/** Effetto DAE "vero" (con changes) → descrittore effetto del form. */
function daeEffectToDescriptor(eff) {
  return {
    name: eff.name || '',
    application: eff.transfer ? 'passive' : 'target',
    rounds: eff.duration?.rounds ? String(eff.duration.rounds) : '',
    img: eff.img && eff.img !== 'icons/svg/aura.svg' ? eff.img : '',
    changes: (eff.changes || []).map(c => ({
      key: c.key || '', mode: Number.isFinite(Number(c.mode)) ? Number(c.mode) : 2,
      value: String(c.value ?? ''), priority: Number(c.priority) || 20,
    })),
  };
}

/** Un item embedded → descrittore del form. `report` raccoglie i non-mappati. */
function itemToDescriptor(item, report) {
  const sys = item.system || {};
  const acts = Object.values(sys.activities || {});
  // Effetti status (condizioni) vs effetti DAE "veri" (con changes).
  const statusEffects = (item.effects || []).filter(e => (e.statuses || []).length);
  const daeEffects = (item.effects || []).filter(e => !(e.statuses || []).length && (e.changes || []).length);

  const d = {
    name: item.name || '', description: stripHtml(sys.description?.value || ''),
    img: item.img && !/mystery-man|aura\.svg|sword\.svg/.test(item.img) ? item.img : '',
    kind: 'passive', activation: 'action',
    attackType: 'melee', ability: 'str', reach: '5', range: '30', longRange: '',
    damage: '', magical: (sys.properties || []).includes('mgc'),
    saveAbility: 'con', dc: '', onSave: 'none',
    onHit: 'none', condition: 'prone', condRounds: '',
    riderSaveAbility: 'con', riderDc: '',
    usesMode: 'none', usesValue: '',
    effects: daeEffects.map(daeEffectToDescriptor),
    aa: aaFromFlags(item.flags?.autoanimations) || undefined,
    onUse: onUseFromFlags(item),
  };

  // Attività principale e eventuale rider (save automationOnly da un attacco).
  const main = acts.find(a => !a.midiProperties?.automationOnly) || acts[0];
  const rider = acts.find(a => a.midiProperties?.automationOnly);

  // Tipo (kind) dall'item + attività.
  if (item.type === 'weapon' || main?.type === 'attack') d.kind = 'attack';
  else if (main?.type === 'save') d.kind = 'save';
  else if (main?.type === 'utility') d.kind = 'utility';
  else d.kind = 'passive';

  if (main) {
    d.activation = main.activation?.type || 'action';
  }

  if (d.kind === 'attack' && main) {
    d.attackType = main.attack?.type?.value === 'ranged' ? 'ranged' : 'melee';
    d.ability = main.attack?.ability || 'str';
    if (d.attackType === 'melee') d.reach = String(sys.range?.value ?? 5);
    else { d.range = String(sys.range?.value ?? 30); d.longRange = sys.range?.long ? String(sys.range.long) : ''; }
    d.damage = partsToString(main.damage?.parts);
    // Condizione sul colpito: effetto status referenziato dall'attività, o rider save.
    if (rider && rider.type === 'save') {
      d.onHit = 'save';
      d.riderSaveAbility = (rider.save?.ability || ['con'])[0];
      d.riderDc = String(rider.save?.dc?.formula || '');
      const st = statusEffects[0];
      if (st) { d.condition = st.statuses[0]; d.condRounds = st.duration?.rounds ? String(st.duration.rounds) : ''; }
    } else if (statusEffects.length) {
      d.onHit = 'condition';
      d.condition = statusEffects[0].statuses[0];
      d.condRounds = statusEffects[0].duration?.rounds ? String(statusEffects[0].duration.rounds) : '';
    }
  } else if (d.kind === 'save' && main) {
    d.saveAbility = (main.save?.ability || ['con'])[0];
    d.dc = String(main.save?.dc?.formula || '');
    d.onSave = main.damage?.onSave === 'half' ? 'half' : 'none';
    d.damage = partsToString(main.damage?.parts);
    const st = statusEffects[0];
    if (st) { d.condition = st.statuses[0]; d.condRounds = st.duration?.rounds ? String(st.duration.rounds) : ''; }
  }

  // Usi limitati (recharge X / N per periodo).
  const uses = sys.uses || {};
  const rec = (uses.recovery || [])[0];
  if (rec?.period === 'recharge') { d.usesMode = 'recharge'; d.usesValue = String(rec.formula || ''); }
  else if (rec && PERIOD_REV[rec.period]) { d.usesMode = PERIOD_REV[rec.period]; d.usesValue = String(uses.max || ''); }

  // Segnala nel report ciò che il form non modella (perdite note).
  if (acts.length > 1 && !rider) report.warn.push(`"${item.name}": ha più attività — importata solo la principale.`);
  if ((main?.damage?.parts || []).length > 1) report.warn.push(`"${item.name}": danno multi-parte importato come lista (ricontrolla).`);

  if (!d.aa) delete d.aa;
  return d;
}

const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();

/**
 * IMPORT principale: JSON actor Foundry → { data (descrittore form), report }.
 */
export function importActor(actor, report = { ok: [], warn: [], skipped: [] }) {
  if (!actor || actor.type !== 'npc') {
    report.warn.push(actor?.type ? `Tipo "${actor.type}" non supportato dall'import (serve un NPC/mostro).` : 'JSON non riconosciuto come actor.');
  }
  const sys = actor?.system || {};
  const ab = sys.abilities || {};
  const senses = sys.attributes?.senses?.ranges || {};
  const data = {
    name: actor?.name || '',
    size: sys.traits?.size || 'med',
    creatureType: sys.details?.type?.value || 'humanoid',
    subtype: sys.details?.type?.subtype || '',
    alignment: sys.details?.alignment || '',
    cr: crLabel(sys.details?.cr),
    rules: sys.source?.rules === '2024' ? '2024' : '2014',
    sourceBook: sys.source?.book || '', sourcePage: sys.source?.page || '',
    str: String(ab.str?.value ?? 10), dex: String(ab.dex?.value ?? 10), con: String(ab.con?.value ?? 10),
    int: String(ab.int?.value ?? 10), wis: String(ab.wis?.value ?? 10), cha: String(ab.cha?.value ?? 10),
    saves: ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter(a => ab[a]?.proficient === 1),
    skills: Object.fromEntries(Object.entries(sys.skills || {}).filter(([, s]) => Number(s.value) > 0).map(([k, s]) => [k, String(s.value)])),
    hpMax: String(sys.attributes?.hp?.max ?? ''), hpFormula: sys.attributes?.hp?.formula || '',
    acCalc: sys.attributes?.ac?.calc || 'default',
    acFlat: sys.attributes?.ac?.flat != null ? String(sys.attributes.ac.flat) : '',
    walk: String(sys.attributes?.movement?.walk ?? ''),
    fly: String(sys.attributes?.movement?.fly ?? ''),
    swim: String(sys.attributes?.movement?.swim ?? ''),
    climb: String(sys.attributes?.movement?.climb ?? ''),
    burrow: String(sys.attributes?.movement?.burrow ?? ''),
    hover: Boolean(sys.attributes?.movement?.hover),
    darkvision: String(senses.darkvision || ''), blindsight: String(senses.blindsight || ''),
    tremorsense: String(senses.tremorsense || ''), truesight: String(senses.truesight || ''),
    telepathy: String(sys.traits?.languages?.communication?.telepathy?.value || ''),
    dr: traitToString(sys.traits?.dr), di: traitToString(sys.traits?.di),
    dv: traitToString(sys.traits?.dv), ci: knownToString(sys.traits?.ci),
    languages: knownToString(sys.traits?.languages),
    legact: String(sys.resources?.legact?.max || ''), legres: String(sys.resources?.legres?.max || ''),
    img: actor?.img && !/mystery-man/.test(actor.img) ? actor.img : '',
    tokenImg: (() => { const ts = actor?.prototypeToken?.texture?.src; return ts && ts !== actor.img && !/mystery-man/.test(ts) ? ts : ''; })(),
    bio: stripHtml(sys.details?.biography?.value || ''),
    items: (actor?.items || []).map(it => itemToDescriptor(it, report)),
  };
  report.ok.push(`Importato: ${data.name || 'senza nome'} (${data.items.length} azioni/tratti)`);
  return { data, report };
}
