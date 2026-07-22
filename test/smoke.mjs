// Smoke test: costruisce un NPC di prova e verifica che la struttura
// combaci con lo schema dei golden template. Si lancia con: npm test
import { buildNpc, parseCR, validateNpc } from '../src/builders/npc.js';
import { parseDamageParts } from '../src/builders/item.js';
import { validateActor, looksLikeValidFormula } from '../src/builders/validate.js';
import { parseDamageExpr, hitChance, totalDPR, attacksFromMonster } from '../src/tools/dpr.js';
import { buildStandaloneItem, validateStandaloneItem } from '../src/builders/standalone-item.js';
import { readFileSync } from 'node:fs';

const sample = {
  name: 'Diavolo di Prova', size: 'lg', creatureType: 'fiend', subtype: 'Devil',
  alignment: 'Lawful Evil', cr: '1/2', rules: '2014',
  str: '18', dex: '14', con: '16', int: '10', wis: '12', cha: '15',
  saves: ['con', 'cha'], skills: { prc: '1', ste: '2' },
  hpMax: '112', hpFormula: '15d10 + 30',
  acCalc: 'natural', acFlat: '16',
  walk: '30', fly: '60', swim: '', climb: '', burrow: '', hover: false,
  darkvision: '120', blindsight: '', tremorsense: '', truesight: '',
  telepathy: '120',
  dr: 'cold, bludgeoning, nonmagical, silvered, fuoco magico', di: 'poison', dv: '', ci: 'poisoned',
  languages: 'common, infernal, linguaggio segreto',
  legact: '3', legres: '2',
  img: 'https://example.com/devil.webp?cors-retry=1784332051199', tokenImg: '', bio: '<p>Test</p>',
  items: [
    {
      name: 'Coda Spinata', kind: 'attack', activation: 'action',
      attackType: 'melee', ability: 'str', reach: '10', range: '', longRange: '',
      damage: '2d8 + @mod piercing, 8d8 fire', magical: true,
      saveAbility: 'con', dc: '', onSave: 'none',
      usesMode: 'none', usesValue: '', img: '', description: 'Attacco di prova',
    },
    {
      name: 'Soffio Tossico', kind: 'save', activation: 'action',
      attackType: 'melee', ability: 'str', reach: '', range: '', longRange: '',
      damage: '8d10 necrotic', magical: false,
      saveAbility: 'con', dc: '26', onSave: 'half',
      condition: 'poisoned', condRounds: '',
      usesMode: 'recharge', usesValue: '5', img: '', description: '',
      // Fase 3.2: oltre alla condizione, chi fallisce il TS subisce
      // anche un effetto DAE con modifica alle statistiche.
      effects: [{
        name: 'CA Corrosa', application: 'target', rounds: '1', img: '',
        changes: [{ key: 'system.attributes.ac.bonus', mode: 2, value: '-2', priority: '18' }],
      }],
    },
    {
      name: 'Morso', kind: 'attack', activation: 'action',
      attackType: 'melee', ability: 'str', reach: '5', range: '', longRange: '',
      damage: '2d4 + 2 + @mod piercing', magical: false,
      saveAbility: 'con', dc: '', onSave: 'none',
      onHit: 'save', condition: 'prone', condRounds: '',
      riderSaveAbility: 'str', riderDc: '11',
      usesMode: 'none', usesValue: '', img: '', description: 'Morso di lupo',
    },
    {
      name: 'Resistenza alla Magia', kind: 'passive', activation: 'action',
      attackType: 'melee', ability: 'str', reach: '', range: '', longRange: '',
      damage: '', magical: false, saveAbility: 'con', dc: '', onSave: 'none',
      usesMode: 'none', usesValue: '', img: '', description: 'Vantaggio ai TS contro le magie.',
    },
    {
      // Fase 3.2: tratto passivo con effetto DAE transfer (pattern Bracers).
      name: 'Corpo Infernale', kind: 'passive', activation: 'action',
      attackType: 'melee', ability: 'str', reach: '', range: '', longRange: '',
      damage: '', magical: false, saveAbility: 'con', dc: '', onSave: 'none',
      usesMode: 'none', usesValue: '', img: '', description: 'Resistenza al fuoco di Avernus.',
      effects: [{
        name: 'Resistenza al Fuoco', application: 'passive', rounds: '', img: '',
        changes: [{ key: 'system.traits.dr.value', mode: 2, value: 'fire', priority: '1' }],
      }],
    },
  ],
};

const actor = buildNpc(sample);
const golden = JSON.parse(readFileSync(new URL('../templates/golden-actor-zariel-2014.json', import.meta.url)));

let failures = 0;
function check(desc, cond) {
  console.log(cond ? `  ✔ ${desc}` : `  ✘ ${desc}`);
  if (!cond) failures++;
}

console.log('Smoke test Tafy\'s Actor Forge:');
check('parseCR("1/2") = 0.5', parseCR('1/2') === 0.5);
check('nome impostato', actor.name === 'Diavolo di Prova');
check('CR = 0.5', actor.system.details.cr === 0.5);
check('STR 18 / save CON competente', actor.system.abilities.str.value === 18 && actor.system.abilities.con.proficient === 1);
check('HP 112 con formula', actor.system.attributes.hp.max === 112 && actor.system.attributes.hp.formula === '15d10 + 30');
check('CA naturale 16', actor.system.attributes.ac.calc === 'natural' && actor.system.attributes.ac.flat === 16);
check('velocità volare 60', actor.system.attributes.movement.fly === '60');
check('resistenza cold in value, resto in custom', actor.system.traits.dr.value.includes('cold') && actor.system.traits.dr.custom.includes('fuoco magico'));
check('bypasses: nonmagical+silvered → ["mgc","sil"] (pattern Zariel)',
  JSON.stringify(actor.system.traits.dr.bypasses) === JSON.stringify(['mgc', 'sil'])
  && actor.system.traits.dr.value.includes('bludgeoning'));
check('bypasses: di senza token bypass resta vuoto', actor.system.traits.di.bypasses.length === 0);
check('telepatia 120 ft', actor.system.traits.languages.communication?.telepathy?.value === 120);
check('skill Percezione=1, Furtività=2', actor.system.skills.prc.value === 1 && actor.system.skills.ste.value === 2);
check('token 2x2 (taglia grande)', actor.prototypeToken.width === 2);
check('token vede al buio 120', actor.prototypeToken.sight.range === 120 && actor.prototypeToken.sight.visionMode === 'darkvision');
check('azioni leggendarie 3', actor.system.resources.legact.max === 3);

// --- Immagini: Foundry 13 rifiuta estensioni non valide (lezione 18/07) ---
check('img: query string rimossa ("...webp?cors-retry=..." → "...webp")',
  actor.img === 'https://example.com/devil.webp');
check('token: eredita l\'avatar già pulito', actor.prototypeToken.texture.src === 'https://example.com/devil.webp');
const badImg = { ...sample, img: 'https://example.com/pagina-senza-estensione' };
check('validate: avviso su immagine senza estensione valida',
  validateNpc(badImg).some(w => w.includes('estensione immagine')));

// --- Fase 2: item embedded e activities ---
const [weapon, breath, bite, passive, infernal] = actor.items;
const wAct = Object.values(weapon.system.activities)[0];
const bAct = Object.values(breath.system.activities)[0];

check('5 item embedded', actor.items.length === 5);
check('id item in formato Foundry (16 alfanumerici)', /^[a-zA-Z0-9]{16}$/.test(weapon._id));
check('arma: type weapon, proprietà mgc', weapon.type === 'weapon' && weapon.system.properties.includes('mgc'));
check('arma: activity attack con 2 parti di danno', wAct.type === 'attack' && wAct.damage.parts.length === 2);
check('arma: prima parte 2d8+@mod piercing', wAct.damage.parts[0].number === 2 && wAct.damage.parts[0].bonus === '@mod' && wAct.damage.parts[0].types[0] === 'piercing');
check('arma: portata 10 ft', weapon.system.range.value === 10);
check('soffio: activity save CD 26 su CON', bAct.type === 'save' && bAct.save.dc.formula === '26' && bAct.save.ability[0] === 'con');
check('soffio: metà danno al TS superato', bAct.damage.onSave === 'half');
check('soffio: recharge 5-6 con consumo usi', breath.system.uses.max === '1' && breath.system.uses.recovery[0].period === 'recharge' && bAct.consumption.targets[0].type === 'itemUses');
check('tratto passivo: nessuna activity', Object.keys(passive.system.activities).length === 0);
check('parser danni: errore su formato sbagliato', parseDamageParts('mille fuoco').errors.length === 1);

// --- Fix parser: bonus composti ---
const compound = parseDamageParts('1d4 + 2 + @mod piercing, 1d6 fire');
check('parser: "1d4 + 2 + @mod piercing" accettato', compound.errors.length === 0 && compound.parts.length === 2);
check('parser: bonus composto normalizzato a "2 + @mod"', compound.parts[0].bonus === '2 + @mod');

// --- Fase 3 parte 1: condizioni ed effetti secondari ---
const poisonedEff = breath.effects.find(e => e.statuses[0] === 'poisoned');
check('soffio: effetto poisoned nell\'item', Boolean(poisonedEff));
check('soffio: effetto referenziato con onSave:false', bAct.effects.some(r => r._id === poisonedEff._id && r.onSave === false));
const biteActs = Object.values(bite.system.activities);
const biteAttack = biteActs.find(a => a.type === 'attack');
const biteRider = biteActs.find(a => a.type === 'save');
check('morso: due activities (attack + save rider)', biteActs.length === 2 && biteAttack && biteRider);
check('morso: attack collegato al rider via otherActivityId', biteAttack.otherActivityId === biteRider._id);
check('morso: rider TS FOR CD 11, automationOnly', biteRider.save.ability[0] === 'str' && biteRider.save.dc.formula === '11' && biteRider.midiProperties.automationOnly === true);
check('morso: effetto prone, non applicato se TS superato', bite.effects[0].statuses[0] === 'prone' && biteRider.effects[0].onSave === false);
check('morso: danno con bonus composto', biteAttack.damage.parts[0].bonus === '2 + @mod');

// --- Fase 3 parte 2: effetti DAE con changes ---
const malus = breath.effects.find(e => e.name === 'CA Corrosa');
check('soffio: effetto DAE "CA Corrosa" presente e non transfer', Boolean(malus) && malus.transfer === false);
check('soffio: change CA -2 (mode 2, priorità 18)',
  malus.changes[0].key === 'system.attributes.ac.bonus' && malus.changes[0].value === '-2'
  && malus.changes[0].mode === 2 && malus.changes[0].priority === 18);
check('soffio: durata 1 round sull\'effetto DAE', malus.duration.rounds === 1);
check('soffio: effetto DAE agganciato al TS con onSave:false', bAct.effects.some(r => r._id === malus._id && r.onSave === false));

// Anti-doppione: senza forceCEOff, Midi applica anche la versione
// Convenient Effects della condizione e il bersaglio la riceve 2 volte.
check('anti-doppione: forceCEOff sull\'effetto condizione (pattern golden)',
  poisonedEff.flags['midi-qol']?.forceCEOff === true);
check('anti-doppione: forceCEOff sull\'effetto DAE applicato', malus.flags['midi-qol']?.forceCEOff === true);

const fireRes = infernal.effects[0];
check('tratto passivo: effetto transfer (dae.transfer=true, noneNameOnly)',
  fireRes.transfer === true && fireRes.flags.dae.transfer === true && fireRes.flags.dae.stackable === 'noneNameOnly');
check('anti-doppione: forceCEOff anche sull\'effetto transfer', fireRes.flags['midi-qol']?.forceCEOff === true);
check('tratto passivo: change resistenza fire (mode 2, priorità 1)',
  fireRes.changes[0].key === 'system.traits.dr.value' && fireRes.changes[0].value === 'fire'
  && fireRes.changes[0].mode === 2 && fireRes.changes[0].priority === 1);
check('tratto passivo: nessuna activity aggiunta dagli effetti', Object.keys(infernal.system.activities).length === 0);

// Validazione: una riga di modifica incompleta deve produrre un avviso.
const badSample = structuredClone(sample);
badSample.items[4].effects[0].changes.push({ key: 'system.attributes.ac.bonus', mode: 2, value: '', priority: '' });
check('validate: avviso su riga di modifica incompleta',
  validateNpc(badSample).some(w => w.includes('incompleta')));
check('validate: il campione di test è valido', validateNpc(sample).length === 0);

// Confronto strutturale: le chiavi del nostro effetto devono tutte esistere
// nell'effetto dei Bracers of Defense (export reale dnd5e 5.3.3).
const goldenBracers = JSON.parse(readFileSync(new URL('../templates/golden-equipment-bracers-defense-2024.json', import.meta.url)));
const goldenEffect = goldenBracers.effects[0];
const effKeys = Object.keys(fireRes).filter(k => !(k in goldenEffect));
check(`effetto DAE: nessuna chiave estranea (${effKeys.join(',') || 'ok'})`, effKeys.length === 0);
const chgKeys = Object.keys(fireRes.changes[0]).filter(k => !(k in goldenEffect.changes[0]));
check(`change DAE: stesse chiavi del golden (${chgKeys.join(',') || 'ok'})`, chgKeys.length === 0);

// Confronto strutturale con gli item del golden template.
const goldenFlail = golden.items.find(i => i.name === 'Flail');
const goldenAct = Object.values(goldenFlail.system.activities)[0];
const itemKeys = Object.keys(weapon.system).filter(k => !(k in goldenFlail.system));
check(`item weapon: nessuna chiave estranea (${itemKeys.join(',') || 'ok'})`, itemKeys.length === 0);
const actKeys = Object.keys(wAct).filter(k => !(k in goldenAct));
check(`activity attack: nessuna chiave estranea (${actKeys.join(',') || 'ok'})`, actKeys.length === 0);

// Confronto strutturale col golden template: ogni chiave di primo e secondo
// livello del nostro actor deve esistere anche nell'export reale di Foundry.
const rootKeys = Object.keys(actor).filter(k => !(k in golden));
check(`nessuna chiave estranea alla radice (${rootKeys.join(',') || 'ok'})`, rootKeys.length === 0);
const sysKeys = Object.keys(actor.system).filter(k => !(k in golden.system));
check(`nessuna chiave estranea in system (${sysKeys.join(',') || 'ok'})`, sysKeys.length === 0);

// --- Fase 5: validatore strutturale (validateActor) ---
console.log('\n— Validatore strutturale —');
check('actor valido: nessun errore strutturale',
  validateActor(actor).filter(i => i.level === 'error').length === 0);

// Sabotaggio A: chiave estranea alla radice.
const sabA = structuredClone(actor); sabA.pippo = 1;
check('rileva chiave estranea alla radice',
  validateActor(sabA).some(i => i.level === 'error' && /Chiave estranea alla radice/.test(i.msg)));

// Sabotaggio B: otherActivityId che punta al nulla (automazione rotta).
const sabB = structuredClone(actor);
const biteItemS = sabB.items.find(i => i.name === 'Morso');
Object.values(biteItemS.system.activities).find(a => a.type === 'attack').otherActivityId = 'ID_INESISTENTE99';
check('rileva riferimento otherActivityId pendente',
  validateActor(sabB).some(i => i.level === 'error' && /otherActivityId/.test(i.msg)));

// Sabotaggio C: attività che referenzia un effetto assente.
const sabC = structuredClone(actor);
const breathItemS = sabC.items.find(i => i.name === 'Soffio Tossico');
breathItemS.effects = []; // tolgo l'effetto ma lascio il riferimento nell'attività
check('rileva effetto referenziato ma inesistente',
  validateActor(sabC).some(i => i.level === 'error' && /referenzia un effetto/.test(i.msg)));

// Sabotaggio D: immagine senza estensione valida.
const sabD = structuredClone(actor); sabD.img = 'https://esempio.it/pagina-senza-estensione';
check('rileva immagine senza estensione valida',
  validateActor(sabD).some(i => i.level === 'error' && /estensione/.test(i.msg)));

// Formule di roll (il caso trovato dall'utente: "16d10 + aa64a").
check('formula: "15d10 + 30" valida', looksLikeValidFormula('15d10 + 30'));
check('formula: "2d8 + @mod" valida', looksLikeValidFormula('2d8 + @mod'));
check('formula: "16d10 + aa64a" NON valida', !looksLikeValidFormula('16d10 + aa64a'));
check('formula: vuota lecita (opzionale)', looksLikeValidFormula(''));
const sabE = structuredClone(actor); sabE.system.attributes.hp.formula = '16d10 + aa64a';
check('validateActor: avviso su formula HP sbagliata',
  validateActor(sabE).some(i => i.level === 'warn' && /Formula HP/.test(i.msg)));

// --- Fase 6: calcolatore DPR (tools/dpr.js) ---
console.log('\n— Calcolatore DPR —');
const de = parseDamageExpr('2d8 + 4 piercing, 8d8 fire');
check('parseDamageExpr: dadi sommati (2d8+8d8=45), flat 4', de.diceAvg === 45 && de.flat === 4);
check('parseDamageExpr ignora i tipi di danno', parseDamageExpr('1d10 + 4 slashing').diceAvg === 5.5);
check('hitChance CA16 +7 = 0.6', hitChance(16, 7) === 0.6);
check('hitChance cap: max 0.95 (nat1 manca sempre), min 0.05 (nat20 colpisce)',
  hitChance(5, 20) === 0.95 && hitChance(30, 0) === 0.05);

// Esempio della guida utente (Morso 1d10+4 +7, Artigli 2d6+3 +5, CA 16):
// senza crit = 10.70; coi crit (nostra aggiunta) ~11.33.
const dprRows = [
  { name: 'Morso', type: 'attack', dice: '1d10 + 4', atkBonus: 7, count: 1, critChance: 0 },
  { name: 'Artigli', type: 'attack', dice: '2d6 + 3', atkBonus: 5, count: 1, critChance: 0 },
];
check('totalDPR senza crit = 10.70 (come il calcolatore di riferimento)',
  Math.abs(totalDPR(dprRows, 16) - 10.7) < 0.001);
const dprCrit = dprRows.map(r => ({ ...r, critChance: 0.05 }));
check('totalDPR coi crit ≈ 11.33 (> versione senza crit)',
  totalDPR(dprCrit, 16) > 11.3 && totalDPR(dprCrit, 16) < 11.35);
check('DPR scala con la CA (CA20 < CA10)', totalDPR(dprRows, 20) < totalDPR(dprRows, 10));

// Lettura dal mostro: risolve @mod (str 18 → +4) e prof da CR (5 → +3).
const dprMon = attacksFromMonster({
  cr: '5', str: '18', con: '16',
  items: [
    { kind: 'attack', name: 'Coda', ability: 'str', damage: '2d8 + @mod piercing' },
    { kind: 'save', name: 'Soffio', saveAbility: 'con', dc: '15', onSave: 'half', damage: '8d6 fire' },
  ],
});
check('attacksFromMonster: Coda atkBonus = mod4 + prof3 = 7, @mod risolto',
  dprMon[0].atkBonus === 7 && dprMon[0].dice.includes('2d8 + 4'));
check('attacksFromMonster: Soffio riconosciuto come save (CD 15, metà)',
  dprMon[1].type === 'save' && dprMon[1].atkBonus === 15 && dprMon[1].half === true);

// --- Fase 6: Item standalone (builders/standalone-item.js) ---
console.log('\n— Item standalone —');

// Golden rule: la base di ogni tipo deve avere le stesse chiavi di system
// del rispettivo golden template — nessuna chiave inventata, nessuna persa.
// Confrontiamo le chiavi di primo livello di system tra la base e l'output.
function topKeys(o) { return Object.keys(o).sort().join(','); }

// A) Arma magica con attacco: rarità/sintonia/proprietà mgc + attività.
const wpn = buildStandaloneItem({
  itemType: 'weapon', name: 'Spada Fiammeggiante', img: 'icons/weapons/swords/sword-flame.webp',
  description: 'Una lama avvolta dalle fiamme.', rarity: 'rare', attunement: 'required', magical: true,
  kind: 'attack', activation: 'action', attackType: 'melee', ability: 'str', reach: '5',
  damage: '1d8 + @mod slashing, 2d6 fire', usesMode: 'none', effects: [],
});
check('item arma: type weapon', wpn.type === 'weapon');
check('item arma: rarità raro + sintonia richiesta', wpn.system.rarity === 'rare' && wpn.system.attunement === 'required');
check('item arma: proprietà magica (mgc)', wpn.system.properties.includes('mgc'));
check('item arma: ha 1 attività (attack)', Object.keys(wpn.system.activities).length === 1);
check('item arma: _id assegnato', typeof wpn._id === 'string' && wpn._id.length > 0);
check('item arma: identifier slug dal nome', wpn.system.identifier === 'spada-fiammeggiante');
check('item arma: immagine mantenuta', wpn.img === 'icons/weapons/swords/sword-flame.webp');

// B) Equipaggiamento passivo con effetto DAE transfer + valore armatura.
const eqp = buildStandaloneItem({
  itemType: 'equipment', name: 'Bracciali della Difesa', magical: true, rarity: 'rare', attunement: 'required',
  armorValue: '2', kind: 'passive',
  effects: [{ name: '+2 CA', application: 'passive', rounds: '', img: '', changes: [{ key: 'system.attributes.ac.bonus', mode: 2, value: '2', priority: '' }] }],
});
check('item equip: type equipment', eqp.type === 'equipment');
check('item equip: valore armatura impostato', eqp.system.armor && eqp.system.armor.value === 2);
check('item equip: effetto passivo transfer:true', eqp.effects.length === 1 && eqp.effects[0].transfer === true);
check('item equip: nessuna attività (tratto passivo)', Object.keys(eqp.system.activities).length === 0);

// C) Consumabile con usi limitati e attività a TS.
const pot = buildStandaloneItem({
  itemType: 'consumable', name: 'Pozione del Fuoco', magical: true, rarity: 'uncommon',
  kind: 'save', activation: 'action', saveAbility: 'dex', dc: '13', onSave: 'half',
  damage: '3d6 fire', usesMode: 'day', usesValue: '1', effects: [],
});
check('item consumabile: type consumable', pot.type === 'consumable');
check('item consumabile: 1 uso al giorno (uses.max)', String(pot.system.uses.max) === '1');
check('item consumabile: ha attività a TS', Object.keys(pot.system.activities).length === 1);

// D) Validazione: nome obbligatorio, estensione immagine.
check('validateStandaloneItem: nome mancante bloccato', validateStandaloneItem({ name: '' }).length > 0);
check('validateStandaloneItem: nome valido passa', validateStandaloneItem({ name: 'X', img: 'icons/a.webp' }).length === 0);
check('validateStandaloneItem: immagine senza estensione segnalata',
  validateStandaloneItem({ name: 'X', img: 'https://sito.it/pagina' }).length > 0);

// E) magical=false rimuove mgc dalle proprietà.
const nonMagic = buildStandaloneItem({ itemType: 'weapon', name: 'Spada', magical: false, kind: 'attack', ability: 'str', damage: '1d8 slashing', effects: [] });
check('item non magico: nessuna proprietà mgc', !nonMagic.system.properties.includes('mgc'));

// --- Fase 6 v0.19: arma magica completa (golden Battleaxe come riferimento) ---
console.log('\n— Arma magica: bonus/tipo/mastery/danno base —');
const axe = buildStandaloneItem({
  itemType: 'weapon', name: 'Ascia +2', magical: true, rarity: 'rare',
  weaponBase: 'battleaxe', magicalBonus: '2', mastery: 'topple',
  silvered: false, adamantine: false, unidentified: 'Un\'ascia dall\'aria antica.',
  kind: 'attack', activation: 'action', attackType: 'melee', ability: 'str', reach: '5',
  damage: '1d8 slashing', usesMode: 'none', effects: [],
});
check('arma: categoria martialM da battleaxe', axe.system.type.value === 'martialM' && axe.system.type.baseItem === 'battleaxe');
check('arma: magicalBonus = "2"', axe.system.magicalBonus === '2');
check('arma: mastery = topple', axe.system.mastery === 'topple');
check('arma: danno base 1d8 slashing in system.damage.base', axe.system.damage.base.number === 1 && axe.system.damage.base.denomination === 8 && axe.system.damage.base.types.includes('slashing'));
const axeAtk = Object.values(axe.system.activities).find(a => a.type === 'attack');
check('arma: parti extra vuote, includeBase attivo', axeAtk.damage.parts.length === 0 && axeAtk.damage.includeBase === true);
check('arma: descrizione non identificato salvata', /aria antica/.test(axe.system.unidentified.description));

// Danno con parte extra (lama fiammeggiante): base + 1 parte extra.
const flame = buildStandaloneItem({
  itemType: 'weapon', name: 'Lama Fiammeggiante', magical: true, weaponBase: 'longsword',
  kind: 'attack', activation: 'action', attackType: 'melee', ability: 'str', damage: '1d8 slashing, 2d6 fire', effects: [],
});
const flameAtk = Object.values(flame.system.activities).find(a => a.type === 'attack');
check('lama: base 1d8 slashing, extra 2d6 fire in parts',
  flame.system.damage.base.denomination === 8 && flameAtk.damage.parts.length === 1 && flameAtk.damage.parts[0].types.includes('fire'));

// Materiali: argentata + adamantina → sil/ada nelle proprietà.
const silAda = buildStandaloneItem({ itemType: 'weapon', name: 'X', magical: false, silvered: true, adamantine: true, kind: 'attack', ability: 'str', damage: '1d6 slashing', effects: [] });
check('materiali: sil e ada presenti', silAda.system.properties.includes('sil') && silAda.system.properties.includes('ada'));

// On-hit su arma: condizione con TS → seconda activity rider collegata.
const onHitWpn = buildStandaloneItem({
  itemType: 'weapon', name: 'Mazza Stordente', magical: true, weaponBase: 'mace',
  kind: 'attack', activation: 'action', attackType: 'melee', ability: 'str', damage: '1d6 bludgeoning',
  onHit: 'save', condition: 'stunned', condRounds: '1', riderSaveAbility: 'con', riderDc: '15', effects: [],
});
const acts = Object.values(onHitWpn.system.activities);
check('on-hit arma: 2 activity (attacco + rider TS)', acts.length === 2);
check('on-hit arma: effetto condizione stunned presente', onHitWpn.effects.some(e => e.statuses?.includes('stunned')));

// --- Fase 6 v0.20: incantesimi standalone (builders/spell.js) ---
console.log('\n— Incantesimi standalone —');
const { buildSpell, validateSpell } = await import('../src/builders/spell.js');

// A) Fireball-like: save AoE, CD spellcasting, upcast, componenti VSM.
const fireball = buildSpell({
  name: 'Palla di Fuoco', rules: '2014', level: '3', school: 'evo',
  vocal: true, somatic: true, material: true, materialText: 'guano e zolfo',
  method: 'spell', activation: 'action', rangeMode: 'ft', rangeValue: '150',
  targetMode: 'template', templateType: 'sphere', templateSize: '20',
  durationUnits: 'inst', kind: 'save', saveAbility: 'dex', dcMode: 'spellcasting',
  onSave: 'half', damage: '8d6 fire', upcastFormula: '1d6', usesMode: 'none', effects: [],
});
const fbAct = Object.values(fireball.system.activities)[0];
check('spell: type spell, livello 3, scuola evo', fireball.type === 'spell' && fireball.system.level === 3 && fireball.system.school === 'evo');
check('spell: componenti V,S,M', ['vocal', 'somatic', 'material'].every(p => fireball.system.properties.includes(p)));
check('spell: materiale salvato', fireball.system.materials.value === 'guano e zolfo');
check('spell: gittata 150 ft', fireball.system.range.value === '150' && fireball.system.range.units === 'ft');
check('spell: sagoma sfera 20 ft', fireball.system.target.template.type === 'sphere' && fireball.system.target.template.size === '20');
check('spell: CD automatica spellcasting', fbAct.save.dc.calculation === 'spellcasting' && fbAct.save.dc.formula === '');
check('spell: metà danno al TS superato', fbAct.damage.onSave === 'half');
check('spell: upcast 1d6 (scaling whole)', fbAct.damage.parts[0].scaling.mode === 'whole' && fbAct.damage.parts[0].scaling.formula === '1d6');

// Zero drift: le chiavi di system identiche al golden Fireball di Zariel.
const goldenZariel = JSON.parse(readFileSync(new URL('../templates/golden-actor-zariel-2014.json', import.meta.url)));
const goldenFireball = goldenZariel.items.find(i => i.type === 'spell' && i.name === 'Fireball');
check('spell: chiavi system IDENTICHE al golden Fireball',
  Object.keys(fireball.system).sort().join(',') === Object.keys(goldenFireball.system).sort().join(','));

// B) Attacco con incantesimo (Ray of Sickness): classification spell, ability ''.
const raySpell = buildSpell({
  name: 'Raggio di Infermità', rules: '2024', level: '1', school: 'nec', vocal: true, somatic: true,
  method: 'innate', activation: 'action', rangeMode: 'ft', rangeValue: '60',
  targetMode: 'creature', targetCount: '1', durationUnits: 'inst',
  kind: 'attack', attackType: 'ranged', damage: '2d8 poison', usesMode: 'day', usesValue: '3', effects: [],
});
const rayAct = Object.values(raySpell.system.activities)[0];
check('spell attack: classification spell, ability vuota (= da incantatore)',
  rayAct.attack.type.classification === 'spell' && rayAct.attack.ability === '');
check('spell attack: 3/giorno (metodo innato)', String(raySpell.system.uses.max) === '3' && raySpell.system.method === 'innate');
check('spell attack: bersaglio 1 creatura', raySpell.system.target.affects.type === 'creature' && raySpell.system.target.affects.count === '1');

// C) Buff con effetto DAE sul bersaglio + concentrazione (Invisibility-like).
const buff = buildSpell({
  name: 'Velo', rules: '2014', level: '2', school: 'ill', vocal: true, somatic: true,
  concentration: true, method: 'spell', activation: 'action', rangeMode: 'touch',
  targetMode: 'creature', targetCount: '1', durationValue: '1', durationUnits: 'hour',
  kind: 'utility', usesMode: 'none',
  effects: [{ name: 'Invisibile', application: 'target', rounds: '', img: '', changes: [{ key: 'system.attributes.ac.bonus', mode: 2, value: '2', priority: '' }] }],
});
check('spell buff: concentrazione nelle properties', buff.system.properties.includes('concentration'));
check('spell buff: gittata contatto', buff.system.range.units === 'touch');
check('spell buff: durata 1 ora', buff.system.duration.value === '1' && buff.system.duration.units === 'hour');
check('spell buff: effetto DAE presente e referenziato dall\'activity',
  buff.effects.length === 1 && Object.values(buff.system.activities)[0].effects.length === 1);

// D) Trucchetto + validazione.
const cantrip = buildSpell({ name: 'Fiotto', level: '0', school: 'evo', vocal: true, kind: 'save', saveAbility: 'dex', dcMode: 'spellcasting', damage: '1d8 fire', durationUnits: 'inst', rangeMode: 'ft', rangeValue: '60', targetMode: 'creature', targetCount: '1', usesMode: 'none', effects: [] });
check('spell: trucchetto = livello 0', cantrip.system.level === 0);
check('validateSpell: nome mancante bloccato', validateSpell({ name: '' }).length > 0);
check('validateSpell: upcast malformato segnalato', validateSpell({ name: 'X', upcastFormula: 'abc' }).length > 0);
check('validateSpell: upcast NdX valido passa', validateSpell({ name: 'X', upcastFormula: '2d8' }).length === 0);

// --- Effetto condizione: forma allineata al golden "Status: Blinded" ---
console.log('\n— Effetto condizione anti-doppione —');
const condEff = onHitWpn.effects.find(e => e.statuses?.includes('stunned'));
check('condizione: forceCEOff = true', condEff.flags['midi-qol']?.forceCEOff === true);
check('condizione: dae.stackable = noneNameOnly', condEff.flags.dae?.stackable === 'noneNameOnly');
check('condizione: dae.transfer = false, transfer top = false', condEff.flags.dae?.transfer === false && condEff.transfer === false);

if (failures) {
  console.error(`\n${failures} test falliti.`);
  process.exit(1);
}
console.log('\nTutti i test passati ✔');
