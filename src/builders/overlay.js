// ============================================================
// Export di un item/incantesimo RICARICATO (round-trip, blocco 13).
//
// Regola: "campo toccato → riscritto dal form; campo non toccato →
// identico all'originale". Si parte dall'originale ripulito (`source`,
// vedi parsers/item-import.js) e si copiano dal JSON costruito dal form
// (`built`) SOLO le parti dei campi che l'utente ha cambiato rispetto a
// come li aveva ricevuti (`orig`). Così prezzo, peso, proprietà delle
// armi, attività di cura, macro, automazioni… restano intatti.
//
// La sezione "Comportamento" (attività, danni, usi, effetti) è un blocco
// unico: se cambia anche un solo campo viene ricostruita tutta dal form.
// ============================================================

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Campi del form cambiati rispetto all'import. */
export function changedFields(orig, state, fields) {
  return fields.filter(f => !same(orig?.[f], state?.[f]));
}

// Campi che compongono il "comportamento" (attività + effetti + usi).
const BEHAVIOR_COMMON = ['kind', 'activation', 'attackType', 'ability', 'reach', 'range', 'longRange', 'damage',
  'saveAbility', 'dc', 'onSave', 'onHit', 'condition', 'condRounds', 'riderSaveAbility', 'riderDc',
  'usesMode', 'usesValue', 'effects'];
export const ITEM_BEHAVIOR = [...BEHAVIOR_COMMON, 'magicalDamage'];
// Nell'incantesimo "activation" è il tempo di lancio (identità), non il comportamento.
export const SPELL_BEHAVIOR = [...BEHAVIOR_COMMON.filter(f => f !== 'activation'), 'dcMode', 'upcastFormula'];

const ITEM_FIELDS = ['itemType', 'name', 'img', 'description', 'unidentified', 'sourceBook', 'sourcePage',
  'rarity', 'attunement', 'magical', 'silvered', 'adamantine', 'armorValue', 'weaponBase', 'magicalBonus',
  'mastery', 'featType', 'requirements', 'aa', 'onUse', ...ITEM_BEHAVIOR];
const SPELL_FIELDS = ['name', 'img', 'description', 'rules', 'sourceBook', 'sourcePage', 'level', 'school',
  'vocal', 'somatic', 'material', 'materialText', 'materialConsumed', 'concentration', 'ritual', 'method',
  'activation', 'castValue', 'rangeMode', 'rangeValue', 'targetMode', 'targetCount', 'templateType',
  'templateSize', 'durationValue', 'durationUnits', 'aa', 'onUse', ...SPELL_BEHAVIOR];

/** Accende/spegne una proprietà (mgc, sil, vocal…) senza toccare le altre. */
function toggleProp(sys, prop, on) {
  const set = new Set(sys.properties || []);
  if (on) set.add(prop); else set.delete(prop);
  sys.properties = [...set];
}

/** Parti comuni: nome, immagine, descrizione, fonte, flag A-A / On-Use, comportamento. */
function common(out, built, ch, behaviorFields) {
  if (ch.has('name')) out.name = built.name;
  if (ch.has('img')) { if (built.img) out.img = built.img; else delete out.img; }
  if (ch.has('description')) out.system.description = { ...(out.system.description || {}), value: built.system.description.value };
  if (ch.has('sourceBook') || ch.has('sourcePage')) {
    out.system.source = { ...(out.system.source || {}) };
    if (ch.has('sourceBook')) out.system.source.book = built.system.source.book;
    if (ch.has('sourcePage')) out.system.source.page = built.system.source.page;
  }
  out.flags = { ...(out.flags || {}) };
  if (ch.has('aa')) {
    if (built.flags?.autoanimations) out.flags.autoanimations = built.flags.autoanimations;
    else delete out.flags.autoanimations;
  }
  if (ch.has('onUse')) {
    const mq = { ...(out.flags['midi-qol'] || {}) };
    const s = built.flags?.['midi-qol']?.onUseMacroName || '';
    if (s) mq.onUseMacroName = s; else delete mq.onUseMacroName;
    if (Object.keys(mq).length) out.flags['midi-qol'] = mq; else delete out.flags['midi-qol'];
  }
  const rebuilt = behaviorFields.some(f => ch.has(f));
  if (rebuilt) {
    out.system.activities = built.system.activities;
    // Usi: quelli del form, ma senza perdere "si distrugge a 0" dei consumabili.
    out.system.uses = { ...built.system.uses, ...(out.system.uses?.autoDestroy != null ? { autoDestroy: out.system.uses.autoDestroy } : {}) };
    out.effects = built.effects;
  }
  return rebuilt;
}

/**
 * Item ricaricato → JSON da esportare. Ritorna { item, rebuilt, changed }.
 * Se l'utente ha cambiato il TIPO (arma → equipaggiamento…) l'originale non
 * vale più: si esporta quello costruito dal form.
 */
export function overlayItem(source, orig, state, built) {
  const changed = changedFields(orig, state, ITEM_FIELDS);
  const ch = new Set(changed);
  if (ch.has('itemType')) return { item: built, rebuilt: true, changed };
  const out = structuredClone(source);
  out.system = out.system || {};
  const rebuilt = common(out, built, ch, ITEM_BEHAVIOR);
  const sys = out.system;
  const bs = built.system;
  if (ch.has('unidentified') && bs.unidentified) sys.unidentified = { ...(sys.unidentified || {}), description: bs.unidentified.description };
  for (const k of ['rarity', 'attunement', 'magicalBonus', 'mastery', 'requirements']) if (ch.has(k)) sys[k] = bs[k];
  if (ch.has('magical')) toggleProp(sys, 'mgc', state.magical);
  if (ch.has('silvered')) toggleProp(sys, 'sil', state.silvered);
  if (ch.has('adamantine')) toggleProp(sys, 'ada', state.adamantine);
  if (ch.has('armorValue')) sys.armor = { ...(sys.armor || {}), value: Number(state.armorValue) > 0 ? Number(state.armorValue) : null };
  if (ch.has('weaponBase')) sys.type = { ...(sys.type || {}), value: bs.type.value, baseItem: bs.type.baseItem };
  if (ch.has('featType')) sys.type = { ...(sys.type || {}), value: bs.type.value };
  if (rebuilt && state.itemType === 'weapon') {
    sys.range = bs.range;
    sys.damage = { ...(sys.damage || {}), base: bs.damage.base };
  }
  return { item: out, rebuilt, changed };
}

/** Incantesimo ricaricato → JSON da esportare. Ritorna { item, rebuilt, changed }. */
export function overlaySpell(source, orig, state, built) {
  const changed = changedFields(orig, state, SPELL_FIELDS);
  const ch = new Set(changed);
  const out = structuredClone(source);
  out.system = out.system || {};
  const rebuilt = common(out, built, ch, SPELL_BEHAVIOR);
  const sys = out.system;
  const bs = built.system;
  if (ch.has('rules')) sys.source = { ...(sys.source || {}), rules: bs.source.rules };
  if (ch.has('level')) sys.level = bs.level;
  if (ch.has('school')) sys.school = bs.school;
  for (const p of ['vocal', 'somatic', 'material', 'concentration', 'ritual']) if (ch.has(p)) toggleProp(sys, p, state[p]);
  if (ch.has('materialText') || ch.has('materialConsumed') || ch.has('material')) {
    sys.materials = { ...(sys.materials || {}), value: bs.materials.value, consumed: bs.materials.consumed };
  }
  if (ch.has('method')) sys.method = bs.method;
  // Le attività ufficiali di solito "ereditano" tempo di lancio, gittata,
  // bersaglio e durata dall'incantesimo (override: false): basta cambiarli qui.
  if (ch.has('activation') || ch.has('castValue')) sys.activation = bs.activation;
  if (ch.has('rangeMode') || ch.has('rangeValue')) sys.range = bs.range;
  if (['targetMode', 'targetCount', 'templateType', 'templateSize'].some(f => ch.has(f))) sys.target = bs.target;
  if (ch.has('durationValue') || ch.has('durationUnits')) sys.duration = bs.duration;
  return { item: out, rebuilt, changed };
}

// ---------- Voci dentro un mostro (attacchi, azioni, tratti) ----------
export const EMBED_FIELDS = ['name', 'img', 'description', 'magical', 'aa', 'onUse', ...ITEM_BEHAVIOR];

/**
 * Una voce di un mostro ricaricato. `src` = voce originale ripulita, `orig` =
 * la sua card appena caricata, `d` = la card adesso, `built` = buildItem(d).
 * Ritorna { item, mode }: 'kept' (identica), 'patched' (solo campi
 * d'identità o comportamento ricostruito sopra l'originale), 'rebuilt'
 * (ricostruita da zero: è cambiata la "famiglia", es. da attacco a TS).
 */
export function overlayEmbedded(src, orig, d, built) {
  const changed = changedFields(orig, d, EMBED_FIELDS);
  if (!changed.length) return { item: structuredClone(src), mode: 'kept', changed };
  const ch = new Set(changed);
  const behavior = ITEM_BEHAVIOR.some(f => ch.has(f));
  // buildItem fa un'ARMA per gli attacchi e una FEATURE per il resto: se la
  // card cambia famiglia l'originale non si può più "rattoppare".
  const srcFamily = src.type === 'weapon' ? 'attack' : 'other';
  const newFamily = d.kind === 'attack' ? 'attack' : 'other';
  if (behavior && srcFamily !== newFamily) {
    const item = { ...built, _id: src._id || built._id };
    if (src.sort != null) item.sort = src.sort;
    return { item, mode: 'rebuilt', changed };
  }
  const out = structuredClone(src);
  out.system = out.system || {};
  common(out, built, ch, ITEM_BEHAVIOR);
  if (ch.has('magical')) toggleProp(out.system, 'mgc', d.magical);
  if (behavior && src.type === 'weapon') {
    // Il danno ora è tutto nell'attività: il dado base dell'originale va
    // svuotato, altrimenti con includeBase verrebbe sommato due volte.
    out.system.range = built.system.range;
    if (built.system.damage) out.system.damage = { ...(out.system.damage || {}), base: built.system.damage.base };
  }
  return { item: out, mode: 'patched', changed };
}
