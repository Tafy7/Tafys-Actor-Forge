// ============================================================
// Round-trip di ITEM e INCANTESIMI standalone (blocco 13).
//
// Rovescio di builders/standalone-item.js e builders/spell.js: un JSON
// di Foundry (dnd5e 5.x) → descrittore del form della Tab Item o della
// Tab Incantesimo, così lo si può ricaricare, ritoccare e ri-esportare.
//
// Differenza importante rispetto all'import dei mostri: un oggetto
// ufficiale ha molte cose che il form non modella (prezzo, peso,
// proprietà delle armi, attività di cura, più attività…). Per non
// perderle teniamo anche l'ORIGINALE ripulito (`source`): all'export
// (builders/overlay.js) i campi che l'utente non tocca restano identici
// all'originale, quelli toccati vengono riscritti dal form.
//
// Modulo PURO (niente DOM): si testa con node.
// ============================================================
import { itemToDescriptor, partsToString, aaFromFlags, onUseFromFlags } from './actor-import.js';
import { cleanSource, isLegacy } from './clean.js';

export { cleanSource };
import { defaultAA } from '../builders/aa.js';
import { WEAPON_TYPES, WEAPON_MASTERIES } from '../data/constants.js';
import { RARITIES, ATTUNEMENTS } from '../builders/standalone-item.js';
import { SPELL_SCHOOLS } from '../builders/spell.js';
import { t } from '../i18n.js';

/** Tipi gestiti dalla Tab Item (gli altri — loot, tool, container… — non hanno un form). */
export const ITEM_TYPES = ['weapon', 'equipment', 'consumable', 'feat'];

/**
 * Cosa andrebbe perso SE l'utente modificasse il comportamento (attività,
 * danni, usi, effetti): il form ne modella una sola, più una "rider".
 */
function rebuildLosses(doc) {
  const out = [];
  const acts = Object.values(doc.system?.activities || {});
  const modelled = ['attack', 'save', 'utility'];
  const other = [...new Set(acts.map(a => a.type).filter(t => !modelled.includes(t)))];
  const riders = acts.filter(a => a.midiProperties?.automationOnly).length;
  if (acts.length - riders > 1) out.push(t('ii_loss_acts', { n: acts.length }));
  if (other.length) out.push(t('ii_loss_types', { types: other.join(', ') }));
  const plain = (doc.effects || []).filter(e => !(e.statuses || []).length && !(e.changes || []).length).length;
  if (plain) out.push(t('ii_loss_fx', { n: plain }));
  return out;
}

const str = (v) => (v == null ? '' : String(v));

/**
 * CD dell'attività principale. Gli oggetti ufficiali spesso non hanno un
 * numero ma la CALCOLANO (dalla caratteristica di chi li usa, o dalla CD
 * da incantatore): la traduciamo nella formula equivalente, così anche
 * ricostruendo il comportamento la CD resta quella giusta.
 */
function dcOf(doc, fallback) {
  const acts = Object.values(doc.system?.activities || {});
  const main = acts.find(a => !a.midiProperties?.automationOnly && a.type === 'save');
  const dc = main?.save?.dc;
  if (!dc || String(dc.formula || '').trim()) return fallback;
  if (dc.calculation === 'spellcasting') return '@attributes.spell.dc';
  if (/^(str|dex|con|int|wis|cha)$/.test(dc.calculation || '')) return `8 + @prof + @abilities.${dc.calculation}.mod`;
  return fallback;
}

/** Righe "ok" e avvisi comuni a item e incantesimi. */
function finishReport(doc, data, report) {
  report.ok.push(t('ii_ok', { name: data.name || '?', type: doc.type }));
  const losses = rebuildLosses(doc);
  if (losses.length) report.warn.push(t('ii_losses', { list: losses.join('; ') }));
  if (report.droppedImgs) {
    report.warn.push(t('ii_imgs', { n: report.droppedImgs }));
    delete report.droppedImgs;
  }
  if (report.droppedFlags) {
    report.warn.push(t('ii_flags', { n: report.droppedFlags }));
    delete report.droppedFlags;
  }
  if (report.droppedRefs) {
    report.warn.push(t('ii_refs', { n: report.droppedRefs }));
    delete report.droppedRefs;
  }
}

/** Comportamento comune (attività principale, danni, usi, effetti, A-A, On-Use). */
function behaviorOf(doc, report) {
  const r = { ok: [], warn: [], skipped: [] };
  // Avvisi "multi-attività" già coperti da rebuildLosses; le immagini le
  // conta cleanSource (una volta sola).
  return itemToDescriptor(doc, r);
}

/**
 * JSON item (weapon/equipment/consumable/feat) → { data, source, report }.
 * `data` ha la forma dello stato della Tab Item; `source` è l'originale
 * ripulito su cui l'export riapplica i campi modificati.
 */
export function importItem(doc, report = { ok: [], warn: [], skipped: [] }) {
  if (isLegacy(doc)) { report.warn.push(t('ii_legacy')); return { data: null, source: null, report }; }
  if (!doc || !ITEM_TYPES.includes(doc.type)) {
    report.warn.push(doc?.type === 'spell' ? t('ii_is_spell')
      : doc?.type ? t('ii_bad_type', { type: doc.type }) : t('ii_not_item'));
    return { data: null, source: null, report };
  }
  const sys = doc.system || {};
  const source = cleanSource(doc, report);
  const b = behaviorOf(doc, report);
  const props = sys.properties || [];
  const wt = WEAPON_TYPES.find(w => w.id && w.id === sys.type?.baseItem);
  // Danno di un'arma: il dado BASE sta in system.damage.base (con
  // includeBase), le parti extra nell'attività. Nel form sono una stringa
  // sola, prima parte = dado base (come la scrive il builder).
  let damage = b.damage;
  if (doc.type === 'weapon') {
    const base = partsToString([sys.damage?.base].filter(Boolean));
    damage = [base, b.damage].filter(Boolean).join(', ');
  }
  const data = {
    ...b,
    itemType: doc.type,
    name: doc.name || '',
    img: source.img && !/item-bag\.svg|sword\.svg|aura\.svg|mystery-man/.test(source.img) ? source.img : '',
    description: str(sys.description?.value).trim(), // HTML intatto (il builder non lo riavvolge)
    unidentified: str(sys.unidentified?.description).trim(),
    sourceBook: str(sys.source?.book), sourcePage: str(sys.source?.page),
    rarity: RARITIES.includes(sys.rarity) ? sys.rarity : '',
    attunement: ATTUNEMENTS.includes(sys.attunement) ? sys.attunement : '',
    magical: props.includes('mgc'), silvered: props.includes('sil'), adamantine: props.includes('ada'),
    armorValue: doc.type === 'equipment' && sys.armor?.value ? String(sys.armor.value) : '',
    weaponBase: wt ? wt.id : '',
    magicalBonus: sys.magicalBonus ? String(sys.magicalBonus) : '',
    mastery: WEAPON_MASTERIES.includes(sys.mastery) ? (sys.mastery || '') : '',
    // Talenti, tratti di specie, doni…: il menu ha solo classe/mostro, ma il
    // valore originale resta (il menu lo mostra come opzione in più).
    featType: /^[a-zA-Z]+$/.test(sys.type?.value || '') ? sys.type.value : 'monster',
    requirements: str(sys.requirements),
    damage,
    dc: dcOf(doc, b.dc),
    magicalDamage: false,
    aa: aaFromFlags(doc.flags?.autoanimations) || defaultAA(),
    onUse: onUseFromFlags(doc),
  };
  finishReport(doc, data, report);
  return { data, source, report };
}

/** Prima parte di danno con scala → formula di upcast del form ("1d6"). */
function upcastOf(act) {
  const p = (act?.damage?.parts || [])[0];
  const sc = p?.scaling;
  if (!sc || sc.mode !== 'whole') return ''; // mode vuoto = nessuna scala (number:1 è solo il default)
  if (sc.formula) return String(sc.formula);
  if (sc.number && p.denomination) return `${sc.number}d${p.denomination}`;
  return '';
}

/** JSON incantesimo → { data, source, report } (forma dello stato della Tab Incantesimo). */
export function importSpell(doc, report = { ok: [], warn: [], skipped: [] }) {
  if (isLegacy(doc)) { report.warn.push(t('ii_legacy')); return { data: null, source: null, report }; }
  if (!doc || doc.type !== 'spell') {
    report.warn.push(doc?.type ? t('ii_not_spell', { type: doc.type }) : t('ii_not_spell_json'));
    return { data: null, source: null, report };
  }
  const sys = doc.system || {};
  const source = cleanSource(doc, report);
  const b = behaviorOf(doc, report);
  const props = sys.properties || [];
  const acts = Object.values(sys.activities || {});
  const main = acts.find(a => !a.midiProperties?.automationOnly) || acts[0];
  const units = sys.range?.units || 'ft';
  const tgt = sys.target || {};
  const kind = main?.type === 'attack' ? 'attack' : main?.type === 'save' ? 'save' : 'utility';
  const dcCalc = main?.save?.dc?.calculation;
  const flatDc = main?.type === 'save' && dcCalc !== 'spellcasting' && dcOf(doc, String(main.save?.dc?.formula || '').trim());
  const data = {
    ...b,
    name: doc.name || '',
    img: source.img && !/book\.svg|mystery-man/.test(source.img) ? source.img : '',
    description: str(sys.description?.value).trim(),
    rules: sys.source?.rules === '2024' ? '2024' : '2014',
    sourceBook: str(sys.source?.book), sourcePage: str(sys.source?.page),
    level: String(Math.max(0, Math.min(9, Number(sys.level) || 0))),
    school: SPELL_SCHOOLS.includes(sys.school) ? sys.school : 'evo',
    vocal: props.includes('vocal'), somatic: props.includes('somatic'), material: props.includes('material'),
    materialText: str(sys.materials?.value), materialConsumed: Boolean(sys.materials?.consumed),
    concentration: props.includes('concentration'), ritual: props.includes('ritual'),
    method: str(sys.method) || 'spell',
    activation: str(sys.activation?.type) || 'action',
    castValue: sys.activation?.value ? String(sys.activation.value) : '1',
    rangeMode: units, // ft / touch / self / mi (altri valori restano com'erano)
    rangeValue: str(sys.range?.value),
    targetMode: tgt.template?.type ? 'template' : tgt.affects?.type === 'self' ? 'self' : tgt.affects?.type ? 'creature' : '',
    targetCount: str(tgt.affects?.count),
    templateType: str(tgt.template?.type) || 'sphere',
    templateSize: str(tgt.template?.size) || '20',
    durationValue: str(sys.duration?.value), durationUnits: str(sys.duration?.units) || 'inst',
    kind,
    attackType: main?.attack?.type?.value === 'melee' ? 'melee' : 'ranged',
    dcMode: flatDc ? 'flat' : 'spellcasting',
    dc: flatDc || '',
    upcastFormula: upcastOf(main),
    usesMode: ['day', 'sr', 'lr'].includes(b.usesMode) ? b.usesMode : 'none',
    usesValue: ['day', 'sr', 'lr'].includes(b.usesMode) ? b.usesValue : '',
    aa: aaFromFlags(doc.flags?.autoanimations) || defaultAA(),
    onUse: onUseFromFlags(doc),
  };
  finishReport(doc, data, report);
  return { data, source, report };
}

/**
 * Da un JSON qualsiasi (documento singolo, array, file della macro
 * Esporta) prende i documenti accettati da `accept` → { docs, total }.
 */
export function pickDocuments(json, accept) {
  const list = json && json.tafysForgeExport ? (json.entries || []).map(e => e && e.data)
    : Array.isArray(json) ? json : [json];
  const docs = list.filter(d => d && accept(d));
  return { docs, total: list.filter(Boolean).length };
}
