// Incantesimi dei mostri (v0.45): lettura dei gruppi dallo statblock,
// collegamento ai compendi di sistema, attività "cast" come i mostri
// ufficiali 2024, livello e slot da incantatore. Si lancia con: npm test
import {
  parseSpellGroups, parseSpellcastingHeader, formatSpellGroups, resolveSpell, isSpellcastingName,
  defaultSlots, parseSlotOverrides, effectiveSlots, groupsToChips, chipsToGroups, nextSpellMode, suggestSpells, spellKey,
} from '../src/parsers/spellcasting.js';
import { buildSpellcastingItem } from '../src/builders/spellcasting.js';
import { buildNpc, bestMentalAbility } from '../src/builders/npc.js';
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
  check('1/giorno: gli usi sono dichiarati come consumo (senza, Foundry non li mostra né li scala)', J(acts[2].consumption.targets.map(x => [x.type, x.value])) === J([['activityUses', '1']]) && acts[0].consumption.targets.length === 0);
  check('livello: base dal compendio, oppure quello del testo', acts[0].spell.level === 1 && acts[2].spell.level === 4);
  check('senza materiali → ["material"]; CD dello statblock come override', J(acts[0].spell.properties) === J(['material']) && acts[0].spell.challenge.override === true && acts[0].spell.challenge.save === 15 && acts[0].spell.challenge.attack === null);
  check('caratteristica sull\'incantesimo', acts[0].spell.ability === 'cha');
  check('senza descrizione: il tratto riporta la lista, un gruppo per riga', it.system.description.value === '<p>A volontà: Detect Magic, Incantesimo Inventato<br>1/giorno: Fireball (livello 4)</p>', it.system.description.value);
  const own = buildSpellcastingItem({ ...base, description: 'Testo mio', spellList: 'A volontà: <b>Light</b>' }, '2024').system.description.value;
  const tag = buildSpellcastingItem({ ...base, spellList: 'A volontà: <img src=x>' }, '2024').system.description.value;
  check('la descrizione scritta a mano vince; la lista non diventa mai HTML', /Testo mio/.test(own) && !/A volontà/.test(own) && tag === '<p>A volontà: &lt;img src=x&gt;</p>', tag);
  const noOverride = Object.values(buildSpellcastingItem({ ...base, scDc: '', spellList: 'A volontà: Light' }, '2024').system.activities)[0];
  check('CD e attacco vuoti → calcolati da Foundry (nessun override)', noOverride.spell.challenge.override === false);
}

console.log('\n— Incantatore a slot: consumo, livelli, slot —');
{
  const it = buildSpellcastingItem({ ...base, scAbility: '', scDc: '', scLevel: '5', scNoMaterial: false,
    spellList: 'Trucchetti (a volontà): Light\nLivello 1 (4 slot): Misty Step, Fire Bolt\nLivello 2 (3 slot): Incantesimo Inventato\nLivello 3 (3 slot): Fireball (livello 5)' }, '2014');
  const acts = Object.values(it.system.activities);
  const [light, misty, bolt, inv, fb] = acts;
  const slot = (a) => a.consumption.targets.find(x => x.type === 'spellSlots');
  check('a slot: lanciarlo consuma uno slot (bersaglio "spellSlots", scalabile)', slot(misty)?.value === '1' && slot(misty).scaling.mode === 'level' && misty.consumption.scaling.allowed === true);
  check('scritto nel gruppo sbagliato (Misty Step al 1°): vale il livello vero (2°)', misty.spell.level === 2 && slot(misty).target === '2');
  check('trucchetto in un gruppo a slot: resta a volontà, nessun consumo', bolt.consumption.targets.length === 0 && !bolt.flags?.['tafys-actor-forge'] && bolt.spell.level === null);
  check('non nei compendi di sistema: livello del gruppo (lo corregge la macro all\'import)', inv.spell.level === 2 && slot(inv).target === '2' && inv.name === 'Incantesimo Inventato');
  check('"(livello 5)" in un gruppo a slot: slot e lancio al 5°', fb.spell.level === 5 && slot(fb).target === '5');
  check('le attività a slot sono marcate per la macro, le altre no', [misty, inv, fb].every(a => a.flags['tafys-actor-forge'].slot === true) && !light.flags?.['tafys-actor-forge']);
  check('caratteristica vuota sull\'attività = quella dell\'actor', acts.every(a => a.spell.ability === ''));

  check('tabella degli slot: livello 5 → 4/3/2, livello 20 → 4/3/3/3/3/2/2/1/1, nessun livello → zero',
    J(defaultSlots(5)) === J([4, 3, 2, 0, 0, 0, 0, 0, 0]) && J(defaultSlots('20')) === J([4, 3, 3, 3, 3, 2, 2, 1, 1]) && J(defaultSlots('')) === J(Array(9).fill(0)) && J(defaultSlots(1)) === J([2, 0, 0, 0, 0, 0, 0, 0, 0]));
  check('slot scelti a mano: "4,3,,2" → vuoto = quello del livello', J(parseSlotOverrides('4,3,,2')) === J([4, 3, null, 2, null, null, null, null, null]) && J(parseSlotOverrides('x,-1')) === J(Array(9).fill(null)));
  const eff = effectiveSlots({ scLevel: '5', scSlots: ',,3', spellList: 'Livello 1 (5 slot): Shield\nLivello 2 (3 slot): Misty Step\nLivello 3 (1 slot): Fly' });
  check('precedenza: a mano → scritti nella lista → livello', J(eff.slice(0, 4).map(x => x.n)) === J([5, 3, 3, 0]));
  check('override solo dove serve: a mano o diverso dal livello', J(eff.slice(0, 4).map(x => x.explicit)) === J([true, false, true, false]));
  const mk = (extra, spells) => buildNpc({ name: 'X', size: 'med', creatureType: 'humanoid', subtype: '', alignment: '', cr: '1', rules: '2014', sourceBook: '', sourcePage: '',
    str: '10', dex: '10', con: '10', int: '12', wis: '16', cha: '16', saves: [], skills: { prf: '0.5', ste: '2' }, hpMax: '10', hpFormula: '', acCalc: 'default', acFlat: '',
    walk: '30', fly: '', swim: '', climb: '', burrow: '', hover: false, darkvision: '', blindsight: '', tremorsense: '', truesight: '', telepathy: '',
    dr: '', di: '', dv: '', ci: '', languages: '', legact: '', legres: '', img: '', tokenImg: '', bio: '', items: [{ ...base, scAbility: '', scDc: '', scNoMaterial: false, spellList: spells, ...extra }] });
  const lv5 = mk({ scLevel: '5' }, 'A volontà: Light').system;
  check('livello 5 senza slot scritti: 4/3/2 pronti, nessun override, 4° vuoto', lv5.attributes.spell.level === 5 && J([1, 2, 3, 4].map(n => lv5.spells['spell' + n])) === J([{ value: 4, override: null }, { value: 3, override: null }, { value: 2, override: null }, { value: 0, override: null }]));
  const hand = mk({ scLevel: '5', scSlots: ',,3,1' }, 'A volontà: Light').system;
  check('slot a mano: 3° = 3 e 4° = 1 diventano override', J([3, 4].map(n => hand.spells['spell' + n])) === J([{ value: 3, override: 3 }, { value: 1, override: 1 }]) && hand.spells.spell1.override === null);
  check('caratteristica automatica: la più alta tra INT/SAG/CAR (a parità la prima)', lv5.attributes.spellcasting === 'wis' && bestMentalAbility({ int: '8', wis: '8', cha: '9' }) === 'cha' && bestMentalAbility({}) === 'int');
  check('mezza competenza (0.5) ed expertise (2) nelle abilità', lv5.skills.prf.value === 0.5 && lv5.skills.ste.value === 2);
}

console.log('\n— Lista a pillole (sezione Incantesimi del design Studio) —');
{
  const round = (text, rules, slots) => formatSpellGroups(chipsToGroups(groupsToChips(parseSpellGroups(text)), { rules, slots }), 'it');
  const mage = formatSpellGroups(parseSpellGroups(MAGE_2014), 'it');
  check('2014: testo → pillole → testo identico', round(mage, '2014', [4, 0, 3, 0, 1]) === mage, round(mage, '2014', [4, 0, 3, 0, 1]));
  const innate = formatSpellGroups(parseSpellGroups(INNATE_2024), 'it');
  check('2024: note e "(livello 4)" sopravvivono al giro', round(innate, '2024', []) === innate && /Fireball \(livello 4\)/.test(innate) && /\(self only\)/.test(innate));
  const chips = groupsToChips(parseSpellGroups('A volontà: Light\n2/giorno: Fly\nLivello 3 (3 slot): Fireball'));
  check('pillole: modo e usi dal gruppo', J(chips.map(c => [c.name, c.mode, c.uses, c.level])) === J([['Light', 'atwill', null, null], ['Fly', 'day', 2, null], ['Fireball', 'slot', null, 3]]));
  const g = chipsToGroups([
    { name: 'Fireball', mode: 'slot' }, { name: 'Shield', mode: 'slot' }, { name: 'Fly', mode: 'day', uses: 1 }, { name: 'Light', mode: 'slot' },
    { name: 'Detect Magic', mode: 'atwill' }, { name: 'Misty Step', mode: 'day', uses: 3 }, { name: 'Lama Inventata', mode: 'slot', level: 4 }, { name: 'Altra Inventata', mode: 'slot' },
  ], { rules: '2014', slots: [4, 3, 2, 1] });
  check('ordine degli statblock: trucchetti, a volontà, N/giorno dal più frequente, slot dal 1°', J(g.map(x => x.mode + (x.cantrips ? 'C' : '') + (x.uses ?? '') + (x.level ?? ''))) === J(['atwillC', 'atwill', 'day3', 'day1', 'slots1', 'slots3', 'slots4']));
  check('un trucchetto messo "a slot" finisce tra i trucchetti', g[0].spells[0].name === 'Light');
  const ct = (caster) => chipsToGroups([{ name: 'Mending', mode: 'atwill' }, { name: 'Fly', mode: 'atwill' }], { rules: '2014', caster }).map(x => (x.cantrips ? 'C:' : 'A:') + x.spells.map(y => y.name).join('+')).join(' ');
  check('trucchetto a volontà: sotto "Trucchetti" solo se il mostro ha un livello da incantatore', ct(true) === 'C:Mending A:Fly' && ct(false) === 'A:Mending+Fly');
  check('slot: livello dell\'incantesimo; sconosciuto → quello scelto (o 1°)', g[4].spells.map(x => x.name).join() === 'Shield,Altra Inventata' && g[6].spells[0].name === 'Lama Inventata' && g[5].slots === 2 && g[6].slots === 1);
  const cyc = (c, has) => { const out = []; let cur = c; for (let i = 0; i < 6; i++) { cur = { ...cur, ...nextSpellMode(cur, has) }; out.push(cur.mode + (cur.uses ?? '')); } return out.join(' '); };
  check('giro con gli slot: a volontà → 1/g → 2/g → 3/g → slot → …', cyc({ mode: 'slot' }, true) === 'atwill day1 day2 day3 slot atwill');
  check('giro senza livello da incantatore: lo slot non compare', cyc({ mode: 'atwill' }, false) === 'day1 day2 day3 atwill day1 day2');

  const names = (q, rules, o) => suggestSpells(q, rules, o).map(x => x.name);
  check('"Mend" suggerisce Mending', names('Mend', '2014')[0] === 'Mending' && names('mend', '2024')[0] === 'Mending');
  check('meno di 3 caratteri: nessun suggerimento', names('me', '2024').length === 0 && names('  ', '2024').length === 0);
  check('prima chi INIZIA col testo, poi chi lo contiene (parole intere davanti)', names('fire', '2024').indexOf('Fireball') < names('fire', '2024', { limit: 30 }).indexOf('Wall of Fire') && names('hand', '2024', { limit: 30 }).includes('Mage Hand'));
  check('stesso nome nelle due regole: una volta sola, col livello', suggestSpells('fireball', '2014').filter(x => x.name === 'Fireball').length === 1 && suggestSpells('fireball', '2014')[0].level === 3 && suggestSpells('fireball', '2014')[0].rules === '2014');
  check('già in lista → non riproposto; al massimo 8', !names('fire', '2024', { exclude: ['FIREBALL'] }).includes('Fireball') && names('a', '2024', { min: 1 }).length === 8);
  check('chiave dei nomi: maiuscole, accenti e apostrofi non contano', spellKey("Hunter’s  MARK") === spellKey('hunters mark') && spellKey('Élan') === 'elan');
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
  check('incantatore a slot: livello 9 e slot dello statblock', a.system.attributes.spell.level === 9 && a.system.spells.spell1.value === 4 && a.system.spells.spell3.value === 3 && a.system.spells.spell5.value === 1 && a.system.spells.spell2.value === 3);
  check('slot uguali a quelli del livello: nessun override (come i mostri ufficiali)', [1, 2, 3, 4, 5].every(n => a.system.spells['spell' + n].override === null));
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
