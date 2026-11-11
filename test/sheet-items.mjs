// Voci del mostro create nelle tab Oggetto / Incantesimo (v0.48): entrano
// nel mostro "così come sono" (card kind 'raw'). Si lancia con: npm test
import { buildNpc, embedRawItem, validateNpc } from '../src/builders/npc.js';
import { buildStandaloneItem } from '../src/builders/standalone-item.js';
import { buildSpell } from '../src/builders/spell.js';
import { validateActor } from '../src/builders/validate.js';
import { importActor, itemToDescriptor } from '../src/parsers/actor-import.js';
import { importItem, importSpell } from '../src/parsers/item-import.js';
import { overlayActor } from '../src/builders/actor-overlay.js';
import { computeMonsterCR } from '../src/tools/expected-cr.js';

let failures = 0;
const check = (label, ok, detail) => { console.log(`  ${ok ? '✔' : '✘'} ${label}${!ok && detail !== undefined ? ' → ' + JSON.stringify(detail) : ''}`); if (!ok) failures++; };
const J = (o) => JSON.stringify(o);
const noId = (o) => { const c = structuredClone(o); delete c._id; return c; };

const sword = buildStandaloneItem({
  itemType: 'weapon', name: 'Spadone di Brace', img: 'icons/weapons/swords/sword-flame.webp',
  description: 'Una lama avvolta dalle fiamme.', rarity: 'rare', attunement: 'required', magical: true,
  kind: 'attack', activation: 'action', attackType: 'melee', ability: 'str', reach: '10',
  damage: '2d8 + @mod slashing, 4d8 necrotic', usesMode: 'none', effects: [],
});
const bolt = buildSpell({ name: 'Dardo di Brace', level: '2', school: 'evo', kind: 'attack', attackType: 'ranged', damage: '3d8 fire', vocal: true, somatic: true, method: 'spell' });
const innate = buildSpell({ name: 'Soffio Cupo', level: '3', school: 'nec', kind: 'save', damage: '6d6 necrotic', vocal: true, method: 'innate' });

// Card come la crea main.js (addDocToSheet): lettura del JSON + JSON intero.
const rawCard = (doc) => { const d = (doc.type === 'spell' ? importSpell(structuredClone(doc)).data : importItem(structuredClone(doc)).data) || itemToDescriptor(doc, { ok: [], warn: [], skipped: [] }); return { ...d, kind: 'raw', rawKind: d.kind, name: doc.name, _raw: structuredClone(doc), _rawId: 'r' + doc.name }; };
const monster = (items) => ({
  name: 'Custode di Prova', size: 'lg', creatureType: 'fiend', subtype: '', alignment: '', cr: '5', rules: '2014', sourceBook: '', sourcePage: '',
  str: '20', dex: '10', con: '16', int: '10', wis: '10', cha: '10', saves: [], skills: {}, hpMax: '120', hpFormula: '', acCalc: 'natural', acFlat: '16',
  walk: '30', fly: '', swim: '', climb: '', burrow: '', hover: false, darkvision: '', blindsight: '', tremorsense: '', truesight: '', telepathy: '',
  dr: '', di: '', dv: '', ci: '', languages: '', legact: '', legres: '', img: '', tokenImg: '', bio: '', items,
});

console.log('\n— Voce "così com\'è" nel mostro —');
{
  const swordBefore = J(sword);
  const e = embedRawItem(sword);
  check('identica all\'oggetto della tab, con un id suo', J(noId(e)) === J(noId(sword)) && e._id !== sword._id && /^[A-Za-z0-9]{16}$/.test(e._id));
  check('l\'oggetto di partenza non viene toccato', J(sword) === swordBefore);
  const unprepared = structuredClone(bolt); unprepared.system.prepared = 0; // es. un incantesimo ricaricato da un JSON di un PG
  check('incantesimo "a slot" non preparato: sulla scheda del mostro entra preparato', embedRawItem(unprepared).system.prepared === 1 && unprepared.system.prepared === 0);
  const trick = structuredClone(unprepared); trick.system.level = 0;
  check('trucchetto: la preparazione non serve e non si tocca', embedRawItem(trick).system.prepared === 0);
  check('incantesimo innato: nessuna preparazione aggiunta', J(noId(embedRawItem(innate))) === J(noId(innate)));
  const a = buildNpc(monster([rawCard(sword), rawCard(bolt)]));
  check('mostro con arma e incantesimo delle tab: due voci, tipi giusti', a.items.length === 2 && a.items[0].type === 'weapon' && a.items[1].type === 'spell');
  check('tutti i campi che il form del mostro non ha (rarità, sintonia, proprietà) restano', a.items[0].system.rarity === 'rare' && a.items[0].system.attunement === 'required' && a.items[0].system.properties.includes('mgc'));
  check('controllo strutturale: solo riferimenti e immagini (la forma l\'ha già controllata la tab)', validateActor(a, { itemMode: () => 'refs' }).filter(i => i.level === 'error').length === 0 && validateActor(a).some(i => i.level === 'error') && validateNpc(monster([rawCard(sword)])).length === 0, validateActor(a, { itemMode: () => 'refs' }).filter(i => i.level === 'error'));
  check('due export di fila: stesso contenuto (cambiano solo gli id)', J(noId(buildNpc(monster([rawCard(sword)])).items[0])) === J(noId(a.items[0])));
  const card = rawCard(sword);
  check('la card porta la "lettura" per i calcoli: attacco con i suoi danni', card.rawKind === 'attack' && /2d8/.test(card.damage) && card.kind === 'raw');
  const view = (items) => ({ ...monster(items), items: items.map(it => (it.kind === 'raw' ? { ...it, kind: it.rawKind } : it)) });
  const withSword = computeMonsterCR(view([card])), without = computeMonsterCR(view([])), blind = computeMonsterCR(monster([card]));
  check('il CR stimato conta l\'arma creata nella tab (dado base + danni extra)', withSword.offensive.cr > without.offensive.cr && blind.offensive.cr === without.offensive.cr && /2d8/.test(card.damage) && /4d8/.test(card.damage), [withSword.offensive, without.offensive, card.damage]);
  const spellCard = rawCard(innate);
  check('incantesimo con tiro salvezza: letto come tale', spellCard.rawKind === 'save' && /6d6/.test(spellCard.damage));
}

console.log('\n— Riaperta nella tab e su un mostro ricaricato —');
{
  // "Modifica nella tab Oggetto": stessa strada del Ricarica da JSON.
  const again = importItem(structuredClone(sword));
  check('la voce si riapre nella tab con i suoi dati', again.data?.name === 'Spadone di Brace' && again.data.itemType === 'weapon' && /2d8/.test(again.data.damage) && again.data.rarity === 'rare');
  // Mostro ricaricato (campo toccato) + una voce nuova dalle tab.
  const original = buildNpc(monster([{ name: 'Morso', kind: 'attack', activation: 'action', attackType: 'melee', ability: 'str', reach: '5', range: '', longRange: '', damage: '1d8 + @mod piercing', magical: false,
    saveAbility: 'con', dc: '', onSave: 'none', onHit: 'none', condition: 'prone', condRounds: '', riderSaveAbility: 'con', riderDc: '', usesMode: 'none', usesValue: '', img: '', description: '', effects: [], onUse: [] }]));
  const imp = importActor(original);
  const d = structuredClone(imp.data);
  d.items.push(rawCard(bolt));
  const r = overlayActor(imp.source, imp.data, d, buildNpc(d));
  check('mostro ricaricato: la voce originale resta identica, quella nuova si aggiunge', r.actor.items.length === 2 && J(r.actor.items[0].system) === J(original.items[0].system) && r.actor.items[1].type === 'spell' && r.actor.items[1].name === 'Dardo di Brace');
  check('resoconto: segnata come aggiunta', r.report.added.includes('Dardo di Brace'), r.report);
}

if (failures) { console.error(`\n${failures} test falliti.`); process.exit(1); }
console.log('\nTutti i test delle voci dalle tab passati ✔');
