// Round-trip "campo toccato" dei MOSTRI (v0.43): import di un actor di Foundry
// nel form → export che riscrive solo ciò che è cambiato. Dati INVENTATI.
// Si lancia con: npm test
import { importActor } from '../src/parsers/actor-import.js';
import { buildNpc } from '../src/builders/npc.js';
import { overlayActor } from '../src/builders/actor-overlay.js';
import { validateActor } from '../src/builders/validate.js';

let failures = 0;
const check = (label, ok) => { console.log(`  ${ok ? '✔' : '✘'} ${label}`); if (!ok) failures++; };
const J = (o) => JSON.stringify(o);

const act = (id, extra) => ({ _id: id, type: 'attack', activation: { type: 'action' }, attack: { ability: '', type: { value: 'melee', classification: 'weapon' } }, damage: { includeBase: true, parts: [] }, effects: [], ...extra });
const monster = {
  _id: 'mostroProva00001', name: 'Guardiano di Brace', type: 'npc',
  img: 'modules/some-art-pack/guardiano.webp', folder: 'abc', sort: 5, ownership: { default: 0 },
  _stats: { compendiumSource: 'Compendium.example-mirror.bestiary.Actor.x' },
  flags: { dnd5e: {}, 'some-importer': { page: 'bestiary.html' }, 'chris-premades': { info: { identifier: 'guardiano' } } },
  prototypeToken: {
    name: 'Guardiano di Brace', width: 2, height: 2, sight: { range: 60, visionMode: 'darkvision' },
    texture: { src: 'https://example-mirror.test/token.webp' }, ring: { subject: { texture: 'https://example-mirror.test/ring.webp' } },
    flags: { 'some-sheet': { x: 1 } },
  },
  system: {
    abilities: { str: { value: 18, proficient: 0 }, dex: { value: 12, proficient: 0 }, con: { value: 16, proficient: 1 }, int: { value: 8, proficient: 0 }, wis: { value: 14, proficient: 1 }, cha: { value: 10 } }, // senza "proficient": il form non deve aggiungerlo se non tocca CAR
    attributes: {
      hp: { value: 85, max: 85, formula: '10d10 + 30' }, ac: { calc: 'natural', flat: 17 },
      movement: { walk: '30', fly: '40', swim: null, climb: null, burrow: null, hover: false, units: 'ft' },
      senses: { ranges: { darkvision: 60, blindsight: 0, tremorsense: 0, truesight: 0 }, units: 'ft' },
      spell: { level: 5 },
    },
    details: { cr: 6, alignment: 'Neutrale', type: { value: 'elemental', subtype: '' }, biography: { value: '<p>Custode delle forge. Evoca @UUID[Compendium.example-tool.custom.Actor.0000000000000000]{Spiriti di Brace}.</p>' }, habitat: { value: [{ type: 'mountain' }] } },
    traits: { size: 'lg', di: { value: ['fire'], bypasses: [], custom: '' }, dr: { value: [], bypasses: [], custom: '' }, dv: { value: ['cold'], bypasses: [], custom: '' }, ci: { value: [], custom: '' },
      languages: { value: ['primordial'], custom: '', communication: { telepathy: { value: 60, units: 'ft' } } } },
    skills: { prc: { value: 1, ability: 'wis' }, ath: { value: 0, ability: 'str' } },
    resources: { legact: { max: 0 }, legres: { max: 0 }, lair: { value: false } },
    source: { rules: '2024', book: 'Manuale Inventato', page: '33' },
  },
  items: [
    { _id: 'martelloBrace001', name: 'Martello di Brace', type: 'weapon', sort: 100, img: 'icons/weapons/hammers/hammer-war-spiked.webp',
      flags: { 'midi-qol': { onUseMacroName: '[postDamageRoll]ItemMacro' }, 'some-sheet': { fav: true } },
      system: { description: { value: '<p>Colpo rovente.</p>' }, properties: ['mgc'], type: { value: 'natural', baseItem: '' }, range: { value: 10, long: null, units: 'ft', reach: 10 },
        damage: { base: { number: 2, denomination: 8, bonus: '', types: ['bludgeoning'], custom: { enabled: false } } },
        activities: { atk0000000000001: act('atk0000000000001', { damage: { includeBase: true, parts: [{ number: 1, denomination: 6, bonus: '', types: ['fire'], custom: { enabled: false } }] } }) } } },
    { _id: 'soffioBrace00001', name: 'Soffio di Brace', type: 'feat', sort: 200,
      system: { description: { value: '<p>Cono di cenere.</p>' }, type: { value: 'monster' }, uses: { max: '1', recovery: [{ period: 'recharge', formula: '5', type: 'recoverAll' }] },
        activities: {
          sv00000000000001: { _id: 'sv00000000000001', type: 'save', activation: { type: 'action' }, save: { ability: ['dex'], dc: { calculation: 'con', formula: '' } }, damage: { onSave: 'half', parts: [{ number: 6, denomination: 6, types: ['fire'] }] }, effects: [] },
          sm00000000000001: { _id: 'sm00000000000001', type: 'summon', activation: { type: 'action' }, profiles: [{ _id: 'p1', uuid: 'Compendium.example-tool.custom.Actor.0000000000000000', count: '2' }] },
        } } },
    { _id: 'incantProva00001', name: 'Muro di Fuoco', type: 'spell', sort: 300, system: { level: 4, school: 'evo', method: 'innate', description: { value: '<p>1/giorno.</p>' }, activities: {} } },
    { _id: 'resistProva00001', name: 'Corpo Rovente', type: 'feat', sort: 400, system: { description: { value: '<p>Chi lo tocca subisce 1d10 fuoco.</p>' }, type: { value: 'monster' }, activities: {} },
      effects: [{ _id: 'eff0000000000001', name: 'Aura rovente', transfer: true, img: 'modules/some-art-pack/aura.webp', changes: [{ key: 'system.traits.dr.value', mode: 2, value: 'cold', priority: 20 }], statuses: [], flags: { ActiveAuras: { isAura: true } } }] },
  ],
  effects: [],
};

/** Come fa la tab: carica, fotografa il form, poi esporta dopo le modifiche. */
const imp = importActor(monster);
const run = (edit) => {
  const d = structuredClone(imp.data);
  edit?.(d);
  return overlayActor(imp.source, imp.data, d, buildNpc(d));
};
const src = imp.source;
const modeOf = (ov) => (it, i) => (ov.modes[i] === 'kept' ? 'none' : ov.modes[i] === 'patched' ? 'refs' : 'full');
const without = (o, ...paths) => { const c = structuredClone(o); for (const p of paths) { const k = p.split('.'); let x = c; for (const s of k.slice(0, -1)) x = x[s]; delete x[k.at(-1)]; } return c; };

console.log('\n— Mostro ricaricato: pulizia —');
check('via _stats, permessi, cartella, ordinamento (della radice)', !src._stats && !src.ownership && !src.folder && !('sort' in src));
check('ordine delle voci conservato (sort)', src.items.map(i => i.sort).join() === '100,200,300,400');
check('flag tolti ovunque (actor, token, voci), automazioni tenute', !/some-importer|some-sheet|example-mirror/.test(J(src)) && src.flags['chris-premades'] && src.items[0].flags['midi-qol'] && src.items[3].effects[0].flags.ActiveAuras);
check('immagini esterne tolte: avatar, token, anello, effetto', !src.img && src.prototypeToken.texture.src === 'icons/svg/mystery-man.svg' && src.prototypeToken.ring.subject.texture === null && src.items[3].effects[0].img === 'icons/svg/aura.svg');
check('riferimenti segnaposto: profilo di evocazione svuotato, link → testo', src.items[1].system.activities.sm00000000000001.profiles[0].uuid === '' && src.system.details.biography.value.includes('Evoca Spiriti di Brace.') && !src.system.details.biography.value.includes('0000000000000000'));
check('resoconto: immagini (4), dati di moduli, riferimenti (2)', imp.report.warn.some(w => /^4 immagini/.test(w)) && imp.report.warn.some(w => /^Tolti 3 gruppi/.test(w)) && imp.report.warn.some(w => /^Tolti 2 riferimenti/.test(w)));
check('voce con più attività: avviso "resta identica"', imp.report.warn.some(w => /Soffio di Brace/.test(w) && /identica/.test(w)));
check('ogni card sa da quale voce viene (_srcId)', J(imp.data.items.map(d => d._srcId)) === J(monster.items.map(i => i._id)));
check('descrizioni e biografia restano HTML', imp.data.items[0].description === '<p>Colpo rovente.</p>' && imp.data.bio.startsWith('<p>Custode'));

console.log('\n— Mostro ricaricato: export —');
{
  const r0 = run();
  check('niente modifiche → identico all\'originale ripulito', J(r0.actor) === J(src) && r0.changed.length === 0 && r0.modes.every(m => m === 'kept'));
  check('…e la validazione non segnala errori sull\'originale', validateActor(r0.actor, { loaded: true, itemMode: modeOf(r0) }).filter(i => i.level === 'error').length === 0);
  check('(senza le opzioni "ricaricato" l\'originale verrebbe bocciato: serve il filtro)', validateActor(r0.actor).some(i => i.level === 'error'));

  const r1 = run(d => { d.name = 'Guardiano Spento'; });
  check('solo il nome → nome + nome del token, nient\'altro', J(r1.actor) === J({ ...src, name: 'Guardiano Spento', prototypeToken: { ...src.prototypeToken, name: 'Guardiano Spento' } }));

  const r2 = run(d => { d.hpMax = '120'; });
  const s2 = structuredClone(src); s2.system.attributes.hp.max = 120; s2.system.attributes.hp.value = 120;
  check('solo i PF → solo i PF', J(r2.actor) === J(s2));

  const r3 = run(d => { d.saves = [...d.saves, 'dex']; d.skills = { ...d.skills, ste: '2' }; });
  check('TS: solo DES diventa competente (le altre restano com\'erano)', r3.actor.system.abilities.dex.proficient === 1 && r3.actor.system.abilities.con.proficient === 1 && J(r3.actor.system.abilities.cha) === J({ value: 10 }));
  check('skill: aggiunta Furtività expertise, Percezione intatta', r3.actor.system.skills.ste.value === 2 && J(r3.actor.system.skills.prc) === J(src.system.skills.prc));

  const r4 = run(d => { d.telepathy = ''; d.di = 'fire, poison'; });
  check('telepatia tolta, immunità aggiornate, lingue intatte', !r4.actor.system.traits.languages.communication.telepathy && J(r4.actor.system.traits.di.value) === J(['fire', 'poison']) && J(r4.actor.system.traits.languages.value) === J(['primordial']));
  check('campi che il form non conosce restano (habitat, tana, livello incantatore)', J(r4.actor.system.details.habitat) === J(src.system.details.habitat) && r4.actor.system.resources.lair.value === false && r4.actor.system.attributes.spell.level === 5);

  const r5 = run(d => { d.img = 'worlds/mio/guardiano.webp'; });
  check('avatar nuovo: il token (che seguiva l\'avatar) lo segue', r5.actor.img === 'worlds/mio/guardiano.webp' && r5.actor.prototypeToken.texture.src === 'worlds/mio/guardiano.webp');
}

console.log('\n— Voci (azioni, tratti, incantesimi) —');
{
  const r1 = run(d => { d.items[0].name = 'Maglio di Brace'; });
  const s1 = structuredClone(src); s1.items[0].name = 'Maglio di Brace';
  check('solo il nome di una voce → solo quel nome', J(r1.actor) === J(s1) && r1.modes[0] === 'patched');

  const r2 = run(d => { d.items[0].damage = '2d10 bludgeoning, 2d6 fire'; });
  const w = r2.actor.items[0];
  const a = Object.values(w.system.activities)[0];
  check('danno cambiato → attività ricostruita con il nuovo danno', r2.modes[0] === 'patched' && a.damage.parts.length === 2 && a.damage.parts[0].denomination === 10);
  check('…dado base dell\'arma svuotato (niente danno contato due volte)', !w.system.damage.base.number);
  check('…flag, id, ordine e descrizione della voce restano', w._id === 'martelloBrace001' && w.sort === 100 && w.flags['midi-qol'].onUseMacroName === '[postDamageRoll]ItemMacro' && w.system.description.value === '<p>Colpo rovente.</p>');
  check('…le altre voci sono identiche', J(r2.actor.items.slice(1)) === J(src.items.slice(1)));
  check('…validazione: solo riferimenti della voce rattoppata, niente errori', validateActor(r2.actor, { loaded: true, itemMode: modeOf(r2) }).filter(i => i.level === 'error').length === 0);

  const r3 = run(d => { d.items[0].kind = 'save'; d.items[0].saveAbility = 'con'; d.items[0].dc = '15'; });
  check('attacco → TS: voce ricostruita da zero ma con stesso _id e ordine', r3.modes[0] === 'rebuilt' && r3.actor.items[0].type === 'feat' && r3.actor.items[0]._id === 'martelloBrace001' && r3.actor.items[0].sort === 100);

  const r4 = run(d => { d.items.splice(2, 1); d.items.push({ ...structuredClone(d.items[0]), _srcId: undefined, name: 'Pugno' }); });
  check('voce tolta e voce nuova', r4.report.removed[0] === 'Muro di Fuoco' && r4.report.added[0] === 'Pugno' && r4.actor.items.length === 4 && !r4.actor.items.some(i => i.name === 'Muro di Fuoco'));

  const r5 = run(d => { d.items.splice(1, 0, structuredClone(d.items[0])); });
  check('due card con la stessa origine: la seconda diventa una voce nuova (niente _id doppi)', r5.modes[1] === 'new' && new Set(r5.actor.items.map(i => i._id)).size === r5.actor.items.length);

  const r6 = run(d => { d.items.reverse(); });
  check('voci riordinate: restano identiche (l\'ordine sulla scheda lo dà sort)', r6.modes.every(m => m === 'kept') && J(r6.actor.items.map(i => i._id)) === J([...src.items].reverse().map(i => i._id)));
}

console.log('\n— Documenti troppo vecchi —');
{
  const old = importActor({ name: 'Imp vecchio', type: 'npc', data: { attributes: { hp: { value: 10 } } }, items: [] });
  check('actor di Foundry 0.x → niente form, avviso chiaro', old.data === null && old.source === null && /0\.x/.test(old.report.warn[0]));
}

if (failures) {
  console.error(`\n${failures} test falliti.`);
  process.exit(1);
}
console.log('\nTutti i test del round-trip dei mostri passati ✔');
