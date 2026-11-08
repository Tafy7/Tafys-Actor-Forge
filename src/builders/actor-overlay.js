// ============================================================
// Export di un MOSTRO RICARICATO (round-trip "campo toccato").
//
// Stessa regola di oggetti e incantesimi (overlay.js): si parte
// dall'originale ripulito e si riscrive SOLO ciò che l'utente ha cambiato
// rispetto a come l'aveva caricato. Due livelli:
//  - la scheda: ogni campo del form ha il suo pezzo di JSON;
//  - le voci (attacchi, tratti, incantesimi…): ogni card sa da quale voce
//    dell'originale viene (`_srcId`). Card invariata → voce identica;
//    card modificata → voce rattoppata o ricostruita; card nuova → voce
//    nuova; card tolta → voce tolta.
// ============================================================
import { changedFields, overlayEmbedded } from './overlay.js';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const MOVES = ['walk', 'fly', 'swim', 'climb', 'burrow'];
const SENSES = ['darkvision', 'blindsight', 'tremorsense', 'truesight'];
export const ACTOR_FIELDS = ['name', 'size', 'creatureType', 'subtype', 'alignment', 'cr', 'rules',
  'sourceBook', 'sourcePage', ...ABILITIES, 'saves', 'skills', 'hpMax', 'hpFormula', 'acCalc', 'acFlat',
  ...MOVES, 'hover', ...SENSES, 'telepathy', 'dr', 'di', 'dv', 'ci', 'languages', 'legact', 'legres',
  'img', 'tokenImg', 'bio'];

/** Crea (se manca) e ritorna l'oggetto al percorso indicato. */
function at(obj, ...path) {
  let o = obj;
  for (const k of path) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  return o;
}

/**
 * @param source  actor originale ripulito (parsers/clean.js)
 * @param orig    stato del form appena caricato (readForm)
 * @param data    stato del form adesso
 * @param built   buildNpc(data)
 * @returns { actor, changed, modes, report: { kept, patched, rebuilt, added, removed } }
 *   `modes[i]` = cosa è successo alla card i ('kept'|'patched'|'rebuilt'|'new'):
 *   serve alla validazione (si controlla solo ciò che ha costruito il Forge).
 */
export function overlayActor(source, orig, data, built) {
  const changed = changedFields(orig, data, ACTOR_FIELDS);
  const ch = new Set(changed);
  const out = structuredClone(source);
  const s = at(out, 'system');
  const b = built.system;
  const tok = out.prototypeToken;

  if (ch.has('name')) {
    // Il nome del token segue quello del mostro solo se prima coincidevano.
    if (tok && (!tok.name || tok.name === source.name)) tok.name = built.name;
    out.name = built.name;
  }
  if (ch.has('size')) {
    at(s, 'traits').size = b.traits.size;
    if (tok) { tok.width = built.prototypeToken.width; tok.height = built.prototypeToken.height; }
  }
  if (ch.has('creatureType')) at(s, 'details', 'type').value = b.details.type.value;
  if (ch.has('subtype')) at(s, 'details', 'type').subtype = b.details.type.subtype;
  if (ch.has('alignment')) at(s, 'details').alignment = b.details.alignment;
  if (ch.has('cr')) at(s, 'details').cr = b.details.cr;
  if (ch.has('bio')) at(s, 'details', 'biography').value = b.details.biography.value;
  if (ch.has('rules')) at(s, 'source').rules = b.source.rules;
  if (ch.has('sourceBook')) at(s, 'source').book = b.source.book;
  if (ch.has('sourcePage')) at(s, 'source').page = b.source.page;

  for (const ab of ABILITIES) if (ch.has(ab)) at(s, 'abilities', ab).value = b.abilities[ab].value;
  if (ch.has('saves')) {
    for (const ab of ABILITIES) {
      if ((orig.saves || []).includes(ab) !== (data.saves || []).includes(ab)) at(s, 'abilities', ab).proficient = b.abilities[ab].proficient;
    }
  }
  if (ch.has('skills')) {
    const keys = new Set([...Object.keys(orig.skills || {}), ...Object.keys(data.skills || {})]);
    for (const k of keys) {
      if (String(orig.skills?.[k] ?? '0') !== String(data.skills?.[k] ?? '0')) at(s, 'skills', k).value = Number(data.skills?.[k]) || 0;
    }
  }

  const hp = at(s, 'attributes', 'hp');
  if (ch.has('hpMax')) { hp.max = b.attributes.hp.max; hp.value = b.attributes.hp.value; }
  if (ch.has('hpFormula')) hp.formula = b.attributes.hp.formula;
  if (ch.has('acCalc') || ch.has('acFlat')) {
    const ac = at(s, 'attributes', 'ac');
    ac.calc = b.attributes.ac.calc;
    ac.flat = b.attributes.ac.flat;
  }
  for (const m of MOVES) if (ch.has(m)) at(s, 'attributes', 'movement')[m] = b.attributes.movement[m] ?? null;
  if (ch.has('hover')) at(s, 'attributes', 'movement').hover = b.attributes.movement.hover;
  for (const sn of SENSES) if (ch.has(sn)) at(s, 'attributes', 'senses', 'ranges')[sn] = b.attributes.senses.ranges[sn];
  if (ch.has('darkvision') && tok) tok.sight = { ...(tok.sight || {}), range: built.prototypeToken.sight.range, visionMode: built.prototypeToken.sight.visionMode };

  for (const k of ['dr', 'di', 'dv', 'ci']) if (ch.has(k)) at(s, 'traits')[k] = { ...(s.traits[k] || {}), ...b.traits[k] };
  if (ch.has('languages')) {
    const lang = at(s, 'traits', 'languages');
    lang.value = b.traits.languages.value;
    lang.custom = b.traits.languages.custom;
  }
  if (ch.has('telepathy')) {
    const comm = at(s, 'traits', 'languages', 'communication');
    const tp = b.traits.languages.communication?.telepathy;
    if (tp) comm.telepathy = tp; else delete comm.telepathy;
  }
  if (ch.has('legact')) at(s, 'resources', 'legact').max = b.resources.legact.max;
  if (ch.has('legres')) at(s, 'resources', 'legres').max = b.resources.legres.max;

  if (ch.has('img')) {
    // Il token non aveva un'immagine sua (vuota, uguale all'avatar o quella
    // di default)? Allora segue l'avatar, come nel builder.
    const ts = tok?.texture?.src;
    if (tok && !data.tokenImg && (!ts || ts === source.img || /mystery-man/.test(ts))) {
      tok.texture = { ...(tok.texture || {}), src: built.prototypeToken.texture.src };
    }
    if (built.img) out.img = built.img; else delete out.img;
  }
  if (ch.has('tokenImg') && tok) tok.texture = { ...(tok.texture || {}), src: built.prototypeToken.texture.src };

  // ---- Voci ----
  const srcItems = new Map((source.items || []).map(it => [it._id, it]));
  const origItems = new Map((orig.items || []).filter(d => d._srcId).map(d => [d._srcId, d]));
  const used = new Set();
  const modes = [];
  const rep = { kept: 0, patched: [], rebuilt: [], added: [], removed: [] };
  out.items = (data.items || []).map((d, i) => {
    const sid = d._srcId;
    if (sid && srcItems.has(sid) && origItems.has(sid) && !used.has(sid)) {
      used.add(sid);
      const r = overlayEmbedded(srcItems.get(sid), origItems.get(sid), d, built.items[i]);
      modes.push(r.mode);
      if (r.mode === 'kept') rep.kept++;
      else rep[r.mode].push(r.item.name);
      return r.item;
    }
    modes.push('new');
    rep.added.push(built.items[i].name);
    return built.items[i];
  });
  for (const [id, it] of srcItems) if (!used.has(id)) rep.removed.push(it.name);
  return { actor: out, changed, modes, report: rep };
}
