// Round-trip di item e incantesimi standalone (blocco 13): import di un JSON
// di Foundry nel form → export. Regola da verificare: "campo toccato →
// riscritto dal form; campo non toccato → identico all'originale".
// Dati INVENTATI (niente contenuti ufficiali né nomi di moduli reali di terzi).
// Si lancia con: npm test
import { importItem, importSpell, pickDocuments, cleanSource } from '../src/parsers/item-import.js';
import { overlayItem, overlaySpell } from '../src/builders/overlay.js';
import { buildStandaloneItem } from '../src/builders/standalone-item.js';
import { buildSpell } from '../src/builders/spell.js';
import { dcFormula } from '../src/builders/item.js';
import { descriptionHtml } from '../src/utils/html.js';

let failures = 0;
const check = (label, ok) => { console.log(`  ${ok ? '✔' : '✘'} ${label}`); if (!ok) failures++; };
const J = (o) => JSON.stringify(o);

/** Come fa la tab: stato = descrittore, foto dell'originale, poi export. */
function session(doc, kind = 'item') {
  const imp = kind === 'item' ? importItem(doc) : importSpell(doc);
  const orig = structuredClone(imp.data);
  const run = (edit = {}) => {
    const state = { ...structuredClone(orig), ...edit };
    const built = kind === 'item' ? buildStandaloneItem(state) : buildSpell(state);
    return (kind === 'item' ? overlayItem : overlaySpell)(imp.source, orig, state, built);
  };
  return { ...imp, orig, run };
}

// ---------- Un oggetto "ricco" (come quelli ufficiali), inventato ----------
const lantern = {
  _id: 'lanternaProva001', name: 'Lanterna del Guardiano', type: 'weapon',
  img: 'modules/some-art-pack/lantern.webp',
  folder: 'cartellaXYZ', sort: 300000, ownership: { default: 0 },
  _stats: { compendiumSource: 'Compendium.example-mirror.items.Item.abc', systemVersion: '5.3.3' },
  flags: {
    dnd5e: { riskyFlag: false }, 'midi-qol': { effectActivation: false },
    'some-importer': { id: 42, url: 'https://example-mirror.test/x' }, 'some-sheet': { favorite: true },
    core: { sourceId: 'Compendium.example-mirror.items.Item.abc' },
  },
  system: {
    description: { value: '<p>Una lanterna che <strong>brucia</strong> i non morti.</p><ul><li>Luce 30 ft</li></ul>' },
    source: { book: 'Manuale Inventato', page: '12', rules: '2024' },
    rarity: 'rare', attunement: 'required', magicalBonus: '1', mastery: 'topple',
    price: { value: 500, denomination: 'gp' }, weight: { value: 2, units: 'lb' }, quantity: 1,
    properties: ['mgc', 'ver', 'fin'],
    type: { value: 'martialM', baseItem: 'mace' },
    range: { value: 5, long: null, units: 'ft' },
    damage: { base: { number: 1, denomination: 6, bonus: '', types: ['bludgeoning'], custom: { enabled: false, formula: '' }, scaling: { mode: '', number: null, formula: '' } }, versatile: { number: 1, denomination: 8, types: [] } },
    uses: { max: '3', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] },
    activities: {
      atk00000000001: { _id: 'atk00000000001', type: 'attack', activation: { type: 'action' }, attack: { ability: '', type: { value: 'melee', classification: 'weapon' } }, damage: { includeBase: true, parts: [{ number: 1, denomination: 6, bonus: '', types: ['radiant'], custom: { enabled: false } }] }, flags: { 'some-sheet': { x: 1 } } },
      heal0000000001: { _id: 'heal0000000001', type: 'heal', activation: { type: 'bonus' }, healing: { number: 2, denomination: 4, bonus: '2', types: ['healing'] } },
    },
  },
  effects: [{ _id: 'eff0000000000001', name: 'Aura della lanterna', img: 'https://example-mirror.test/aura.png', transfer: true, origin: 'Compendium.example-mirror.items.Item.abc', changes: [{ key: 'system.attributes.ac.bonus', mode: 2, value: '1', priority: 20 }], statuses: [], flags: { dae: { stackable: 'noneName' } }, _stats: { x: 1 } }],
};

console.log('\n— Oggetto ricaricato: pulizia —');
{
  const s = session(lantern);
  const src = s.source;
  check('via _stats, permessi, cartella e ordinamento', !('_stats' in src) && !('ownership' in src) && !('folder' in src) && !('sort' in src));
  check('flag tenuti: sistema e automazioni (dnd5e, midi-qol)', src.flags.dnd5e && src.flags['midi-qol']);
  check('flag tolti: importatori e fogli (anche dentro le attività)', !/some-importer|some-sheet|example-mirror/.test(J(src)));
  check('core.sourceId tolto (legava il JSON al compendio d\'origine)', !src.flags.core);
  check('immagini esterne / di moduli tolte (item + effetto)', !('img' in src) && src.effects[0].img === 'icons/svg/aura.svg');
  check('origine degli effetti azzerata', src.effects[0].origin === null && !('_stats' in src.effects[0]));
  check('resoconto: immagini e gruppi di dati tolti', s.report.warn.some(w => /^2 immagini tolte/.test(w)) && s.report.warn.some(w => /^Tolti 3 gruppi/.test(w)));
  check('resoconto: il form non modella attività di cura e la seconda attività', s.report.warn.some(w => /2 attività/.test(w) && /heal/.test(w)));
  check('l\'originale passato non viene modificato', lantern.flags['some-importer'] && lantern._stats);
}

console.log('\n— Oggetto ricaricato: lettura nel form —');
{
  const { data } = session(lantern);
  check('tipo, nome, rarità, sintonia', data.itemType === 'weapon' && data.name === 'Lanterna del Guardiano' && data.rarity === 'rare' && data.attunement === 'required');
  check('descrizione HTML intatta', data.description.startsWith('<p>Una lanterna') && data.description.includes('<li>'));
  check('arma: base, bonus magico, maestria, magico', data.weaponBase === 'mace' && data.magicalBonus === '1' && data.mastery === 'topple' && data.magical);
  check('danno = dado base + parte extra', data.damage === '1d6 bludgeoning, 1d6 radiant');
  check('usi 3 per riposo lungo', data.usesMode === 'lr' && data.usesValue === '3');
  check('fonte', data.sourceBook === 'Manuale Inventato' && data.sourcePage === '12');
  check('effetto passivo nel form', data.effects.length === 1 && data.effects[0].application === 'passive');
}

console.log('\n— Oggetto ricaricato: export —');
{
  const s = session(lantern);
  const r0 = s.run();
  check('niente modifiche → identico all\'originale ripulito', J(r0.item) === J(s.source) && !r0.rebuilt && r0.changed.length === 0);
  const r1 = s.run({ name: 'Lanterna Spenta' });
  check('solo il nome → cambia solo il nome', J({ ...r1.item, name: s.source.name }) === J(s.source) && r1.item.name === 'Lanterna Spenta');
  const r2 = s.run({ rarity: 'veryRare', magical: false });
  check('rarità e magico: il resto delle proprietà resta (ver, fin)', r2.item.system.rarity === 'veryRare'
    && J(r2.item.system.properties) === J(['ver', 'fin']) && r2.item.system.price.value === 500);
  check('…e le attività originali restano (anche la cura)', Object.keys(r2.item.system.activities).length === 2 && !r2.rebuilt);
  const r3 = s.run({ damage: '1d8 bludgeoning, 2d6 radiant' });
  check('danno modificato → comportamento ricostruito dal form', r3.rebuilt && Object.values(r3.item.system.activities).length === 1);
  check('…dado base nell\'arma, extra nell\'attività', r3.item.system.damage.base.denomination === 8
    && Object.values(r3.item.system.activities)[0].damage.parts[0].number === 2);
  check('…prezzo, peso, proprietà, versatile restano', r3.item.system.price.value === 500 && r3.item.system.weight.value === 2
    && r3.item.system.properties.includes('ver') && r3.item.system.damage.versatile.denomination === 8);
  check('…l\'_id originale resta (aggiornabile con "mantieni ID")', r3.item._id === 'lanternaProva001');
  const r4 = s.run({ description: 'Testo nuovo semplice' });
  check('descrizione riscritta (testo semplice → paragrafo)', r4.item.system.description.value === '<p>Testo nuovo semplice</p>');
  const r5 = s.run({ itemType: 'equipment' });
  check('tipo cambiato → oggetto ricostruito da zero', r5.item.type === 'equipment' && r5.rebuilt && !r5.item.system.price?.value);
}

console.log('\n— Oggetto creato dal Forge: andata e ritorno —');
{
  const made = buildStandaloneItem({
    itemType: 'consumable', name: 'Fiala Acida', description: 'Brucia.', kind: 'save', activation: 'action',
    saveAbility: 'dex', dc: '13', onSave: 'none', damage: '2d6 acid', condition: '', usesMode: 'none', usesValue: '',
    rarity: 'common', attunement: '', magical: false, effects: [], onUse: [], aa: undefined,
  });
  const s = session(made);
  check('rilettura: TS, CD, danno', s.data.kind === 'save' && s.data.saveAbility === 'dex' && s.data.dc === '13' && s.data.damage === '2d6 acid');
  check('niente modifiche → identico', J(s.run().item) === J(s.source));
}

console.log('\n— CD calcolate —');
{
  check('dcFormula: numero', dcFormula('13') === '13' && dcFormula(' 015 ') === '15');
  check('dcFormula: formula di Foundry conservata', dcFormula('8 + @prof + @abilities.con.mod') === '8 + @prof + @abilities.con.mod');
  check('dcFormula: vuoto o testo → 10', dcFormula('') === '10' && dcFormula('ciao') === '10');
  const totem = { name: 'Totem', type: 'feat', system: { type: { value: 'monster' }, activities: { a: { _id: 'a', type: 'save', save: { ability: ['con'], dc: { calculation: 'con', formula: '' } }, damage: { parts: [] } } } } };
  check('CD dalla caratteristica → formula equivalente', importItem(totem).data.dc === '8 + @prof + @abilities.con.mod');
}

console.log('\n— Descrizioni —');
check('testo semplice → <p>', descriptionHtml('ciao') === '<p>ciao</p>');
check('HTML → intatto', descriptionHtml(' <ul><li>a</li></ul> ') === '<ul><li>a</li></ul>');
check('vuoto → vuoto', descriptionHtml('') === '');

// ---------- Incantesimo inventato ----------
const flare = {
  _id: 'splFlare0000001', name: 'Vampata Stellare', type: 'spell', img: 'icons/magic/fire/explosion.webp',
  flags: { dnd5e: {}, 'some-importer': { id: 7 } },
  system: {
    description: { value: '<p>Una vampata.</p>' }, source: { rules: '2024', book: '', page: '' },
    level: 3, school: 'evo', properties: ['vocal', 'somatic', 'material'], materials: { value: 'un pizzico di zolfo', consumed: false, cost: 0, supply: 0 },
    method: 'spell', activation: { type: 'action', value: null }, range: { value: '120', units: 'ft' },
    target: { template: { type: 'emanationNoTemplate', size: '15', units: 'ft' }, affects: { type: 'creature' } },
    duration: { value: '', units: 'inst' },
    activities: { s1: { _id: 's1', type: 'save', save: { ability: ['dex'], dc: { calculation: 'spellcasting', formula: '' } },
      damage: { onSave: 'half', parts: [{ number: 6, denomination: 6, bonus: '', types: ['fire'], custom: { enabled: false }, scaling: { mode: 'whole', number: 1, formula: '' } }] } } },
  },
  effects: [],
};

console.log('\n— Incantesimo ricaricato —');
{
  const s = session(flare, 'spell');
  check('livello, scuola, componenti, materiale', s.data.level === '3' && s.data.school === 'evo' && s.data.vocal && s.data.material && s.data.materialText === 'un pizzico di zolfo');
  check('TS DES, CD da incantatore, metà danni, danno', s.data.kind === 'save' && s.data.saveAbility === 'dex' && s.data.dcMode === 'spellcasting' && s.data.onSave === 'half' && s.data.damage === '6d6 fire');
  check('upcast dalla scala (number:1 → 1d6)', s.data.upcastFormula === '1d6');
  const dart = structuredClone(flare);
  dart.system.activities.s1.damage.parts[0].scaling = { mode: '', number: 1, formula: '' }; // default del sistema: nessuna scala
  check('scala senza modalità (default del sistema) → niente upcast', importSpell(dart).data.upcastFormula === '');
  check('sagoma sconosciuta ai menu conservata nel form', s.data.targetMode === 'template' && s.data.templateType === 'emanationNoTemplate');
  check('flag dell\'importatore tolto', !/some-importer/.test(J(s.source)));
  check('niente modifiche → identico', J(s.run().item) === J(s.source));
  const r1 = s.run({ level: '4' });
  check('solo il livello → cambia solo il livello', r1.item.system.level === 4 && J({ ...r1.item, system: { ...r1.item.system, level: 3 } }) === J(s.source));
  const r2 = s.run({ templateSize: '20' });
  check('dimensione della sagoma: il tipo sconosciuto resta', r2.item.system.target.template.type === 'emanationNoTemplate' && r2.item.system.target.template.size === '20' && !r2.rebuilt);
  const r3 = s.run({ damage: '8d6 fire' });
  const act = Object.values(r3.item.system.activities)[0];
  check('danno modificato → attività ricostruita con CD da incantatore e upcast', r3.rebuilt && act.save.dc.calculation === 'spellcasting'
    && act.damage.parts[0].number === 8 && act.damage.parts[0].scaling.formula === '1d6');
  const r4 = s.run({ ritual: true, concentration: true });
  check('rituale e concentrazione aggiunti senza perdere le componenti', J(r4.item.system.properties) === J(['vocal', 'somatic', 'material', 'concentration', 'ritual']));
  const r5 = s.run({ durationUnits: 'disp' });
  check('durata "finché dissolto" (senza valore)', r5.item.system.duration.units === 'disp' && r5.item.system.duration.value === '');
}

console.log('\n— Scelta del documento nel file —');
{
  const env = { tafysForgeExport: 1, entries: [{ data: { type: 'loot', name: 'Sasso' } }, { data: flare }, { data: lantern }, { data: { ...lantern, name: 'Seconda' } }] };
  const it = pickDocuments(env, d => ['weapon', 'equipment', 'consumable', 'feat'].includes(d.type));
  check('file della macro Esporta: 2 oggetti su 4 voci', it.docs.length === 2 && it.total === 4 && it.docs[0].name === 'Lanterna del Guardiano');
  check('array e documento singolo', pickDocuments([flare], d => d.type === 'spell').docs.length === 1 && pickDocuments(flare, d => d.type === 'spell').docs.length === 1);
  check('tipo non gestito → niente dati + avviso', importItem({ type: 'loot', name: 'x' }).data === null && importItem({ type: 'spell' }).report.warn[0].includes('Incantesimo'));
  check('oggetto nella tab Incantesimo → avviso', importSpell(lantern).data === null);
  check('cleanSource senza flag non esplode', J(cleanSource({ type: 'feat', system: {} }, {}).flags) === '{}');
}

if (failures) {
  console.error(`\n${failures} test falliti.`);
  process.exit(1);
}
console.log('\nTutti i test del round-trip item/incantesimi passati ✔');
