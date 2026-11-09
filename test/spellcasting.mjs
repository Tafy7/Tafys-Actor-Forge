// Incantesimi dei mostri (v0.45): lettura dei gruppi dallo statblock,
// collegamento ai compendi di sistema, attività "cast" come i mostri
// ufficiali 2024, livello e slot da incantatore. Si lancia con: npm test
import { parseSpellGroups, parseSpellcastingHeader, formatSpellGroups, resolveSpell, isSpellcastingName } from '../src/parsers/spellcasting.js';
import { buildSpellcastingItem } from '../src/builders/spellcasting.js';
import { buildNpc } from '../src/builders/npc.js';
import { validateActor } from '../src/builders/validate.js';
import { parseStatblock } from '../src/parsers/statblock.js';
import { importActor } from '../src/parsers/actor-import.js';
import { overlayActor } from '../src/builders/actor-overlay.js';
import { SRD_SPELLS } from '../src/data/srd-spells.js';

let failures = 0;
const check = (label, ok) => { console.log(`  ${ok ? '✔' : '✘'} ${label}`); if (!ok) failures++; };
const J = (o) => JSON.stringify(o);

const MAGE_2014 = 'The mage is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit with spell attacks). The mage has the following wizard spells prepared: Cantrips (at will): fire bolt, light, mage hand 1st level (4 slots): detect magic, mage armor*, magic missile, shield 3rd level (3 slots): counterspell, fireball, fly 5th level (1 slot): cone of cold *The mage casts mage armor on itself before combat.';
const INNATE_2024 = 'The creature casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): At Will: Detect Magic, Invisibility (self only), Mage Hand 1/Day Each: Fireball (level 4 version), Fly';
const IT = 'La strega usa Saggezza come caratteristica da incantatore (CD del tiro salvezza degli incantesimi 13, +5 al tiro per colpire con gli attacchi con incantesimo) senza bisogno di componenti materiali. A volontà: light, mage hand 3/giorno ciascuno: fireball';

console.log('\n— Lettura dei gruppi —');
{
  const g = parseSpellGroups(MAGE_2014);
  check('2014: trucchetti + 3 livelli di slot', J(g.map(x => x.mode + (x.level ?? '') + (x.slots ?? ''))) === J(['atwill', 'slots14', 'slots33', 'slots51']));
  check('2014: asterisco tolto, nota finale ignorata', g[1].spells.map(s => s.name).join('|') === 'detect magic|mage armor|magic missile|shield' && g[3].spells.length === 1);
  const h = parseSpellcastingHeader(MAGE_2014);
  check('2014: INT, CD 14, +6, livello 9', h.ability === 'int' && h.dc === '14' && h.attack === '6' && h.casterLevel === '9' && !h.noMaterial);
  const g2 = parseSpellGroups(INNATE_2024);
  check('2024: a volontà + 1/giorno', g2[0].mode === 'atwill' && g2[1].mode === 'day' && g2[1].uses === 1);
  check('2024: "(level 4 version)" → lanciato al 4°, "(self only)" resta come nota', g2[1].spells[0].castLevel === 4 && g2[0].spells[1].note === 'self only');
  const h2 = parseSpellcastingHeader(INNATE_2024);
  check('2024: CAR, CD 15, senza componenti materiali', h2.ability === 'cha' && h2.dc === '15' && h2.noMaterial);
  const h3 = parseSpellcastingHeader(IT);
  check('italiano: SAG, CD 13, +5, senza materiali, 3/giorno', h3.ability === 'wis' && h3.dc === '13' && h3.attack === '5' && h3.noMaterial && parseSpellGroups(IT)[1].uses === 3);
  const txt = formatSpellGroups(g, 'it');
  check('forma canonica rileggibile (andata e ritorno)', J(parseSpellGroups(txt)) === J(g));
  check('forma canonica in inglese', formatSpellGroups(g2, 'en').startsWith('At will: Detect Magic, Invisibility (self only)'));
  check('nomi dei blocchi riconosciuti', isSpellcastingName('Spellcasting') && isSpellcastingName('Innate Spellcasting (Psionics)') && isSpellcastingName('Incantesimi Innati') && !isSpellcastingName('Spell Reflection'));
}

console.log('\n— Collegamento ai compendi di sistema —');
{
  check('indice: 319 incantesimi 2014 + 340 2024', SRD_SPELLS['2014'].spells.length === 319 && SRD_SPELLS['2024'].spells.length === 340);
  const f24 = resolveSpell('fireball', '2024');
  const f14 = resolveSpell('Fireball', '2014');
  check('stesso nome, regole diverse → compendi diversi', f24.uuid.startsWith('Compendium.dnd5e.spells24.Item.') && f14.uuid.startsWith('Compendium.dnd5e.spells.Item.') && f24.level === 3);
  check('maiuscole, apostrofi e accenti non contano', resolveSpell("MAGE  hand", '2024')?.name === 'Mage Hand');
  check('nome del mago davanti tolto ("Melf\'s Acid Arrow" → Acid Arrow)', resolveSpell("Melf's Acid Arrow", '2024')?.name === 'Acid Arrow');
  check('non nei compendi di sistema → null', resolveSpell('Incantesimo Inventato', '2024') === null);
}

const base = { name: 'Spellcasting', kind: 'spellcasting', activation: 'action', description: '', img: '', scAbility: 'cha', scDc: '15', scAttack: '', scLevel: '', scNoMaterial: true, effects: [], onUse: [] };

console.log('\n— Attività "cast" (forma dei mostri ufficiali 2024) —');
{
  const it = buildSpellcastingItem({ ...base, spellList: 'A volontà: Detect Magic, Incantesimo Inventato\n1/giorno: Fireball (livello 4)' }, '2024');
  const acts = Object.values(it.system.activities);
  check('una feature con 3 attività cast', it.type === 'feat' && acts.length === 3 && acts.every(a => a.type === 'cast'));
  check('collegati: UUID del compendio, nome vuoto (lo prende dall\'incantesimo)', acts[0].spell.uuid.startsWith('Compendium.dnd5e.spells24.Item.') && acts[0].name === '');
  check('non collegato: niente UUID, il nome resta per la macro', acts[1].spell.uuid === '' && acts[1].name === 'Incantesimo Inventato');
  check('1/giorno: usi sull\'attività, ricarica giornaliera', acts[2].uses.max === '1' && acts[2].uses.recovery[0].period === 'day' && acts[0].uses.max === '');
  check('livello: base dal compendio, oppure quello del testo', acts[0].spell.level === 1 && acts[2].spell.level === 4);
  check('senza materiali → ["material"]; CD dello statblock come override', J(acts[0].spell.properties) === J(['material']) && acts[0].spell.challenge.override === true && acts[0].spell.challenge.save === 15 && acts[0].spell.challenge.attack === null);
  check('caratteristica sull\'incantesimo', acts[0].spell.ability === 'cha');
  const noOverride = Object.values(buildSpellcastingItem({ ...base, scDc: '', spellList: 'A volontà: Light' }, '2024').system.activities)[0];
  check('CD e attacco vuoti → calcolati da Foundry (nessun override)', noOverride.spell.challenge.override === false);
}

console.log('\n— Mostro completo —');
{
  const data = {
    name: 'Mago di Prova', size: 'med', creatureType: 'humanoid', subtype: '', alignment: '', cr: '6', rules: '2014',
    sourceBook: '', sourcePage: '', str: '9', dex: '14', con: '11', int: '17', wis: '12', cha: '11', saves: [], skills: {},
    hpMax: '40', hpFormula: '9d8', acCalc: 'default', acFlat: '', walk: '30', fly: '', swim: '', climb: '', burrow: '', hover: false,
    darkvision: '', blindsight: '', tremorsense: '', truesight: '', telepathy: '', dr: '', di: '', dv: '', ci: '', languages: '',
    legact: '', legres: '', img: '', tokenImg: '', bio: '',
    items: [{ ...base, scAbility: 'int', scDc: '14', scAttack: '6', scLevel: '9', scNoMaterial: false, spellList: formatSpellGroups(parseSpellGroups(MAGE_2014), 'it') }],
  };
  const a = buildNpc(data);
  check('caratteristica da incantatore dell\'actor', a.system.attributes.spellcasting === 'int');
  check('incantatore a slot: livello 9 e slot dello statblock', a.system.attributes.spell.level === 9 && a.system.spells.spell1.override === 4 && a.system.spells.spell3.value === 3 && a.system.spells.spell5.override === 1 && a.system.spells.spell2.override == null);
  check('incantatore a slot con componenti: nessuna componente tolta', Object.values(a.items[0].system.activities).every(x => J(x.spell.properties) === '[]'));
  check('regole 2014 → compendio dnd5e.spells', Object.values(a.items[0].system.activities).every(x => x.spell.uuid.startsWith('Compendium.dnd5e.spells.Item.')));
  check('nessun errore strutturale', validateActor(a).filter(i => i.level === 'error').length === 0);
  const innate = buildNpc({ ...data, rules: '2024', items: [{ ...base, spellList: 'A volontà: Light' }] });
  check('solo innati: niente livello/slot toccati', innate.system.attributes.spell.level === 0 && innate.system.spells.spell1.override == null);
}

console.log('\n— Dallo statblock —');
{
  const sb = `Strega di Prova
Medium Humanoid, Neutral Evil
Armor Class 12
Hit Points 40 (9d8)
Speed 30 ft.
STR 9 (-1) DEX 14 (+2) CON 11 (+0) INT 10 (+0) WIS 17 (+3) CHA 11 (+0)
Challenge 4 (1,100 XP)
Innate Spellcasting. The witch's innate spellcasting ability is Wisdom (spell save DC 13). She can innately cast the following spells, requiring no material components:
At will: light, mage hand
2/day each: fireball, Incantesimo Inventato
Actions
Dagger. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.`;
  const r = parseStatblock(sb);
  const sc = r.state.items[0];
  check('card "Incantesimi" con caratteristica, CD e materiali', sc.kind === 'spellcasting' && sc.scAbility === 'wis' && sc.scDc === '13' && sc.scNoMaterial);
  check('lista canonica pronta da modificare', /2\/giorno: fireball, Incantesimo Inventato/.test(sc.spellList));
  check('resoconto: collegati e da cercare', r.report.ok.some(x => /4 \(3 collegati/.test(x)) && r.report.warn.some(x => /Incantesimo Inventato/.test(x)));
  check('l\'attacco dopo resta un attacco', r.state.items[1].kind === 'attack');
}

console.log('\n— Round-trip di un mostro creato col Forge —');
{
  const a = buildNpc({ name: 'X', size: 'med', creatureType: 'humanoid', subtype: '', alignment: '', cr: '1', rules: '2024', sourceBook: '', sourcePage: '',
    str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '14', saves: [], skills: {}, hpMax: '10', hpFormula: '', acCalc: 'default', acFlat: '',
    walk: '30', fly: '', swim: '', climb: '', burrow: '', hover: false, darkvision: '', blindsight: '', tremorsense: '', truesight: '', telepathy: '',
    dr: '', di: '', dv: '', ci: '', languages: '', legact: '', legres: '', img: '', tokenImg: '', bio: '', items: [{ ...base, spellList: 'A volontà: Light' }] });
  const imp = importActor(a);
  const d = structuredClone(imp.data);
  d.name = 'Y';
  const r = overlayActor(imp.source, imp.data, d, buildNpc(d));
  check('ricaricato e modificato altrove: le attività cast restano identiche', J(r.actor.items[0].system.activities) === J(a.items[0].system.activities));
}

if (failures) {
  console.error(`\n${failures} test falliti.`);
  process.exit(1);
}
console.log('\nTutti i test degli incantesimi dei mostri passati ✔');
