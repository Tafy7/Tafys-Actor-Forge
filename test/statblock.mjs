// Test del parser di statblock (Fase 4). Si lancia con: npm test
// Fixture 1: Barbed Devil dall'SRD 5.1 (formato 2014 reale).
// Fixture 2: mostro sintetico per rider, recharge, leggendarie e righe spezzate.
import { parseStatblock, profFromCR } from '../src/parsers/statblock.js';
import { buildNpc } from '../src/builders/npc.js';

let failures = 0;
function check(desc, cond) {
  console.log(cond ? `  ✔ ${desc}` : `  ✘ ${desc}`);
  if (!cond) failures += 1;
}

console.log('Test parser statblock:');

// ------------------------------------------------------------
// Fixture 1 — Barbed Devil (SRD), con righe spezzate stile PDF.
// ------------------------------------------------------------
const barbed = `
Barbed Devil
Medium fiend (devil), lawful evil
Armor Class 15 (natural armor)
Hit Points 110 (13d8 + 52)
Speed 30 ft.
STR 16 (+3) DEX 17 (+3) CON 18 (+4)
INT 12 (+1) WIS 14 (+2) CHA 14 (+2)
Saving Throws Str +6, Con +7, Wis +5, Cha +5
Skills Deception +5, Insight +5, Perception +8
Damage Resistances cold; bludgeoning, piercing, and slashing from
nonmagical attacks that aren't silvered
Damage Immunities fire, poison
Condition Immunities poisoned
Senses darkvision 120 ft., passive Perception 18
Languages Infernal, telepathy 120 ft.
Challenge 5 (1,800 XP)
Barbed Hide. At the start of each of its turns, the barbed devil deals
5 (1d10) piercing damage to any creature grappling it.
Devil's Sight. Magical darkness doesn't impede the devil's darkvision.
Magic Resistance. The devil has advantage on saving throws against
spells and other magical effects.
Actions
Multiattack. The devil makes three melee attacks: one with its tail and
two with its claws. Alternatively, it can use Hurl Flame twice.
Claw. Melee Weapon Attack: +6 to hit, reach 5 ft., one target.
Hit: 6 (1d6 + 3) piercing damage.
Tail. Melee Weapon Attack: +6 to hit, reach 5 ft., one target.
Hit: 10 (2d6 + 3) piercing damage.
Hurl Flame. Ranged Spell Attack: +5 to hit, range 150 ft., one target.
Hit: 10 (3d6) fire damage. If the target is a flammable object that
isn't being worn or carried, it also catches fire.
`;

const { state: s1, report: r1 } = parseStatblock(barbed);

check('profFromCR: CR 5 → +3, CR 13 → +5', profFromCR(5) === 3 && profFromCR(13) === 5);
check('nome: Barbed Devil', s1.name === 'Barbed Devil');
check('taglia med, tipo fiend, sottotipo Devil', s1.size === 'med' && s1.creatureType === 'fiend' && s1.subtype === 'Devil');
check('allineamento Lawful Evil', s1.alignment === 'Lawful Evil');
check('CA 15 naturale', s1.acFlat === '15' && s1.acCalc === 'natural');
check('HP 110 (13d8 + 52)', s1.hpMax === '110' && s1.hpFormula === '13d8 + 52');
check('velocità 30', s1.walk === '30' && !s1.fly);
check('caratteristiche (colonne spezzate)', s1.str === '16' && s1.dex === '17' && s1.con === '18' && s1.int === '12' && s1.wis === '14' && s1.cha === '14');
check('TS: str, con, wis, cha', JSON.stringify(s1.saves) === JSON.stringify(['str', 'con', 'wis', 'cha']));
check('skill: Deception/Insight competenza', s1.skills.dec === '1' && s1.skills.ins === '1');
check('skill: Perception +8 riconosciuta come EXPERTISE (mod +2, prof +3)', s1.skills.prc === '2');
check('resistenze: gruppo nonmagical sciolto in id + token bypass',
  s1.dr === 'cold, bludgeoning, piercing, slashing, nonmagical, silvered');
check('immunità fire, poison; condizioni poisoned', s1.di.includes('fire') && s1.di.includes('poison') && s1.ci.includes('poisoned'));
check('scurovisione 120, telepatia 120', s1.darkvision === '120' && s1.telepathy === '120');
check('lingue: infernal', /infernal/i.test(s1.languages));
check('CR 5', s1.cr === '5');

const items1 = s1.items || [];
const names1 = items1.map(i => i.name);
check('7 item (3 tratti + multiattack + 3 attacchi)', items1.length === 7);
check('tratti passivi: Barbed Hide, Devil\'s Sight, Magic Resistance',
  ['Barbed Hide', "Devil's Sight", 'Magic Resistance'].every(n => items1.find(i => i.name === n)?.kind === 'passive'));
check('Multiattack → utility con descrizione', items1.find(i => i.name === 'Multiattack')?.kind === 'utility');
const claw = items1.find(i => i.name === 'Claw');
check('Claw: attacco mischia, STR (+6 = mod 3 + prof 3), reach 5', claw?.kind === 'attack' && claw.attackType === 'melee' && claw.ability === 'str' && claw.reach === '5');
check('Claw: danni "1d6 + 3 piercing" (riga spezzata riattaccata)', claw?.damage === '1d6 + 3 piercing');
const flame = items1.find(i => i.name === 'Hurl Flame');
check('Hurl Flame: distanza 150, spell → CHA (+5 = mod 2 + prof 3), magico', flame?.attackType === 'ranged' && flame.range === '150' && flame.ability === 'cha' && flame.magical === true);
check('Hurl Flame: danni 3d6 fire', flame?.damage === '3d6 fire');
check('report: nessuna riga ignorata sul Barbed Devil', r1.skipped.length === 0);

// Lo stato del parser deve essere digeribile da buildNpc senza esplodere.
const actor1 = buildNpc({
  ...{ subtype: '', alignment: '', bio: '', img: '', tokenImg: '', hpFormula: '', acFlat: '', legact: '', legres: '', telepathy: '', dv: '', hover: false, blindsight: '', tremorsense: '', truesight: '', swim: '', climb: '', burrow: '', fly: '', rules: '2014' },
  ...s1,
});
check('buildNpc digerisce lo stato del parser (5 item con activity)', actor1.items.length === 7 && actor1.name === 'Barbed Devil');
check('actor: CR 5 numerico e skill expertise', actor1.system.details.cr === 5 && actor1.system.skills.prc.value === 2);

// ------------------------------------------------------------
// Fixture 2 — sintetico: rider su attacco, breath recharge,
// condizione su TS, leggendarie, X/Day.
// ------------------------------------------------------------
const synthetic = `
Test Wolf Fiend
Large fiend, chaotic evil
Armor Class 14
Hit Points 90 (12d10 + 24)
Speed 40 ft., fly 80 ft. (hover), swim 30 ft.
STR 18 (+4) DEX 15 (+2) CON 14 (+2) INT 8 (-1) WIS 12 (+1) CHA 10 (+0)
Senses blindsight 10 ft., darkvision 60 ft., passive Perception 11
Languages —
Challenge 6 (2,300 XP)
Legendary Resistance (2/Day). If the fiend fails a saving throw, it can
choose to succeed instead.
Actions
Bite. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit:
11 (2d6 + 4) piercing damage and the target must succeed on a DC 13
Strength saving throw or be knocked prone.
Fire Breath (Recharge 5-6). The fiend exhales fire in a 30-foot cone.
Each creature in that area must make a DC 13 Dexterity saving throw,
taking 33 (6d10) fire damage on a failed save, or half as much damage
on a successful one.
Howl (3/Day). Each creature within 30 feet must succeed on a DC 12
Wisdom saving throw or be frightened for 1 minute.
Legendary Actions
The fiend can take 2 legendary actions, choosing from the options below.
Snap. The fiend makes one Bite attack.
`;

const { state: s2, report: r2 } = parseStatblock(synthetic);
const items2 = s2.items || [];

check('sintetico: tipo fiend senza sottotipo', s2.creatureType === 'fiend' && !s2.subtype);
check('CA 14 senza parentesi → fissa', s2.acFlat === '14' && s2.acCalc === 'flat');
check('velocità walk 40, fly 80, swim 30, hover', s2.walk === '40' && s2.fly === '80' && s2.swim === '30' && s2.hover === true);
check('vista cieca 10 + scurovisione 60', s2.blindsight === '10' && s2.darkvision === '60');
check('resistenze leggendarie 2 (dal tratto)', s2.legres === '2');
check('azioni leggendarie 2 (dal preambolo)', s2.legact === '2');

const bite = items2.find(i => i.name === 'Bite');
check('Bite: rider TS FOR CD 13 → prono ("morso di lupo")',
  bite?.kind === 'attack' && bite.onHit === 'save' && bite.riderSaveAbility === 'str' && bite.riderDc === '13' && bite.condition === 'prone');
const breath = items2.find(i => i.name === 'Fire Breath');
check('Fire Breath: save DEX CD 13, metà danno, Recharge 5',
  breath?.kind === 'save' && breath.saveAbility === 'dex' && breath.dc === '13' && breath.onSave === 'half'
  && breath.usesMode === 'recharge' && breath.usesValue === '5');
check('Fire Breath: danni 6d10 fire', breath?.damage === '6d10 fire');
const howl = items2.find(i => i.name === 'Howl');
check('Howl: 3/giorno, condizione frightened per 10 round (1 minuto)',
  howl?.usesMode === 'day' && howl.usesValue === '3' && howl.condition === 'frightened' && howl.condRounds === '10');
const snap = items2.find(i => i.name === 'Snap');
check('Snap: azione leggendaria (utility)', snap?.activation === 'legendary');

// I descrittori del parser devono attraversare buildNpc: il Bite deve
// produrre il pattern attack + rider automationOnly già collaudato.
const actor2 = buildNpc({
  ...{ subtype: '', alignment: '', bio: '', img: '', tokenImg: '', acFlat: s2.acFlat, legact: s2.legact, legres: s2.legres, telepathy: '', dr: '', di: '', dv: '', ci: '', languages: '', saves: [], skills: {}, hover: s2.hover, tremorsense: '', truesight: '', climb: '', burrow: '', rules: '2014' },
  ...s2,
});
const biteItem = actor2.items.find(i => i.name === 'Bite');
const biteActs = Object.values(biteItem.system.activities);
check('buildNpc: Bite → attack + save rider collegati', biteActs.length === 2
  && biteActs.find(a => a.type === 'attack')?.otherActivityId === biteActs.find(a => a.type === 'save')?._id);

// ------------------------------------------------------------
// Fixture 3 — Akaname (statblock ITALIANO reale, in metri, dal
// bestiario homebrew dell'utente: il caso d'uso vero della Fase 4).
// ------------------------------------------------------------
const akaname = `
Akaname
Mostruosità Media, neutrale malvagio
Classe Armatura 13 (armatura naturale)
Punti Ferita 30 (4d8 + 12)
Velocità 9 m, scalare 9 m
FOR DES COS INT SAG CAR
14 (+2) 16 (+3) 14 (+2) 5 (-3) 10 (+0) 7 (-2)
Competenze Furtività +5
Sensi Scurovisione 18 m., Percezione passiva 10
Lingue Comprende il Comune ma non può parlare
Sfida 2 (450 PE)
Corpo Melmoso. L'Akaname può muoversi attraverso uno spazio
largo solo 2,5 cm senza stringersi.
Azioni
Lingua Velenosa (Ricarica 5-6). Attacco con arma da mischia: +5
per colpire, gittata 1,5 m., un bersaglio. Colpito: 9 (2d6 + 3)
danni da veleno, e il bersaglio deve superare un tiro salvezza su
Costituzione DC 12 o è avvelenato fino alla fine del suo
prossimo turno.
Artiglio. Attacco con arma da mischia: +4 per colpire, Gittata 1,5
m., un bersaglio. Colpito: 7 (1d8 + 2) danni taglienti.
`;

const { state: s3, report: r3 } = parseStatblock(akaname);
const items3 = s3.items || [];

console.log('\n— Fixture italiana: Akaname —');
check('IT: nome e identità (Mostruosità Media → monstrosity/med)', s3.name === 'Akaname' && s3.creatureType === 'monstrosity' && s3.size === 'med');
check('IT: allineamento tradotto (neutrale malvagio → Neutral Evil)', s3.alignment === 'Neutral Evil');
check('IT: CA 13 naturale, HP 30 (4d8 + 12)', s3.acFlat === '13' && s3.acCalc === 'natural' && s3.hpMax === '30' && s3.hpFormula === '4d8 + 12');
check('IT: metri → piedi (9 m → 30 ft, anche scalare)', s3.walk === '30' && s3.climb === '30');
check('IT: caratteristiche FOR…CAR a colonne', s3.str === '14' && s3.dex === '16' && s3.con === '14' && s3.int === '5' && s3.wis === '10' && s3.cha === '7');
check('IT: Furtività +5 = competenza (dex +3 + prof +2)', s3.skills.ste === '1');
check('IT: Scurovisione 18 m → 60 ft', s3.darkvision === '60');
check('IT: lingue custom ("Comprende il Comune…")', /Comprende il Comune/i.test(s3.languages));
check('IT: Sfida 2 → CR 2', s3.cr === '2');
check('IT: Corpo Melmoso tratto passivo', items3.find(i => i.name === 'Corpo Melmoso')?.kind === 'passive');

const lingua = items3.find(i => i.name === 'Lingua Velenosa');
check('IT: Lingua Velenosa attacco mischia DES (+5 = 3+2), gittata 1,5 m → 5 ft',
  lingua?.kind === 'attack' && lingua.ability === 'dex' && lingua.reach === '5');
check('IT: Ricarica 5-6 riconosciuta', lingua?.usesMode === 'recharge' && lingua.usesValue === '5');
check('IT: danni "2d6 + 3 poison" (danni da veleno tradotti)', lingua?.damage === '2d6 + 3 poison');
check('IT: rider "TS Costituzione DC 12 o avvelenato" per 1 round (prossimo turno)',
  lingua?.onHit === 'save' && lingua.riderSaveAbility === 'con' && lingua.riderDc === '12'
  && lingua.condition === 'poisoned' && lingua.condRounds === '1');
const artiglio = items3.find(i => i.name === 'Artiglio');
check('IT: Artiglio FOR (+4 = 2+2), 1d8 + 2 slashing', artiglio?.ability === 'str' && artiglio.damage === '1d8 + 2 slashing');
check('IT: nessuna riga ignorata sull\'Akaname', r3.skipped.length === 0);

// ------------------------------------------------------------
// Fixture 4 — Akaname Anziano: aura con TS nei tratti, resistenze
// da tradurre, immunità custom ("Malattie"), matematica homebrew
// sballata (Artigli +7 con FOR +4 e prof +2) che DEVE dare warning.
// ------------------------------------------------------------
const anziano = `
Akaname Anziano
Mostruosità Media, neutrale malvagio
Classe Armatura 15 (armatura naturale)
Punti Ferita 65 (10d8 + 20)
Velocità 9 m, scalare 9 m
FOR DES COS INT SAG CAR
18 (+4) 16 (+3) 16 (+3) 8 (-1) 12 (+1) 7 (-2)
Tiri Salvezza Des +5, Cos +5
Competenze Percezione +4, Furtività +6
Resistenze ai Danni acido, veleno
Immunità ai Danni Malattie
Sensi Scurovisione 18 m., Percezione passiva 14
Lingue Comprende il Comune ma non può parlare
Sfida 4 (1,100 PE)
Aura di Sporcizia. L'area entro 3 m dall'Akaname è riempita di un
odore nauseabondo. Ogni creatura che inizia il suo turno
all'interno di questa area deve superare un tiro salvezza su
Costituzione DC 14 o subire 7 (2d6) danni da veleno.
Zampe Appicicose. L'Akaname può arrampicarsi su superfici
difficili, incluso al rovescio sui soffitti, senza dover effettuare
nessuna prova di abilità.
Azioni
Multiattacco. L'Akaname effettua due attacchi: uno con la sua
Lingua Velenosa e uno con gli Artigli.
Lingua Velenosa. Attacco con arma da mischia: +5 per colpire,
gittata 1,5 m., un bersaglio. Colpito: 13 (3d6 + 4) danni da veleno
e il bersaglio deve superare un tiro salvezza su Costituzione DC
12 o essere avvelenato per 1 minuto.
Artigli. Attacco con arma da mischia: +7 per colpire, gittata 1,5 m.,
un bersaglio. Colpito: 11 (2d6 + 4) danni taglienti.
Sputo Bile (Ricarica 5-6). L'Akaname sputa bile acida in un cono di
4,5 m. Ogni creatura in quell'area deve effettuare un tiro
salvezza su Destrezza DC 13, subendo 21 (6d6) danni acidi in
caso di fallimento, o la metà di questi danni in caso di successo.
`;

const { state: s4, report: r4 } = parseStatblock(anziano);
const items4 = s4.items || [];

console.log('\n— Fixture italiana: Akaname Anziano —');
check('IT: TS Des/Cos → dex, con', JSON.stringify(s4.saves) === JSON.stringify(['dex', 'con']));
check('IT: resistenze tradotte (acido, veleno → acid, poison)', s4.dr === 'acid, poison');
check('IT: immunità "Malattie" resta custom', s4.di === 'Malattie');
check('IT: CR 4 (ignora "1,100 PE")', s4.cr === '4');
const aura = items4.find(i => i.name === 'Aura di Sporcizia');
check('IT: Aura di Sporcizia → save CON CD 14, 2d6 poison, danno pieno',
  aura?.kind === 'save' && aura.saveAbility === 'con' && aura.dc === '14' && aura.damage === '2d6 poison' && aura.onSave === 'none');
check('IT: Zampe Appicicose tratto passivo', items4.find(i => i.name === 'Zampe Appicicose')?.kind === 'passive');
check('IT: Multiattacco → utility', items4.find(i => i.name === 'Multiattacco')?.kind === 'utility');
const lingua2 = items4.find(i => i.name === 'Lingua Velenosa');
check('IT: rider avvelenato per 1 minuto → 10 round', lingua2?.condition === 'poisoned' && lingua2.condRounds === '10');
check('IT: Percezione +4 e Furtività +6 anomale → 2 warning matematica homebrew',
  r4.warn.filter(w => w.includes('anomalo')).length === 2);
check('IT: Artigli +7 impossibile (FOR+4, prof+2) → warning e fallback FOR',
  items4.find(i => i.name === 'Artigli')?.ability === 'str' && r4.warn.some(w => w.startsWith('Artigli')));
const sputo = items4.find(i => i.name === 'Sputo Bile');
check('IT: Sputo Bile save DEX CD 13, metà danno, 6d6 acid, Ricarica 5',
  sputo?.kind === 'save' && sputo.saveAbility === 'dex' && sputo.dc === '13' && sputo.onSave === 'half'
  && sputo.damage === '6d6 acid' && sputo.usesMode === 'recharge' && sputo.usesValue === '5');

// ------------------------------------------------------------
// Fixture 5 — Bai Ze (statblock IT complesso, dal collaudo v0.7):
// "Abilità"/"Linguaggi" come etichette, "+11 a colpire", "radiante",
// leggendarie articolate, e la trappola della riga spezzata che inizia
// con "velocità..." (che in v0.7 veniva scambiata per l'etichetta).
// ------------------------------------------------------------
const baize = `
Bai Ze
Celestiale Grande, legale buono
Classe Armatura 19 (armatura naturale)
Punti Ferita 184 (20d10 + 60)
Velocità 12 m, volare 18 m
FOR DES COS INT SAG CAR
20 (+5) 14 (+2) 20 (+5) 18 (+4) 22 (+6) 18 (+4)
Tiri Salvezza Int +10, Sag +12, Car +10
Abilità Arcana +10, Intuizione +12, Percezione +12
Resistenze ai Danni radiante; contundente, perforante e
tagliente da attacchi non magici
Immunità alle Condizioni affascinato, spaventato
Sensi vista truesight 36 m, Percezione passiva 22
Linguaggi Tutti, telepatia 36 m
Sfida 15 (13.000 PE)
Resistenza Leggendaria (3/giorno). Se il Bai Ze fallisce un tiro
salvezza, può scegliere invece di superarlo.
Incantesimi Innati. La capacità di lanciare incantesimi del Bai
Ze è basata su Saggezza (CD tiro salvezza incantesimi 20).
Azioni
Multiattacco. Il Bai Ze effettua tre attacchi con gli zoccoli.
Zoccoli. Attacco con Arma da Mischia: +11 a colpire, portata 1,5
m, un bersaglio. Colpito: 21 (4d6 + 5) danni contundenti.
Raggio Divino (Ricarica 5-6). Il Bai Ze può rilasciare un raggio di
energia divina in una linea di 18 m lunga e larga 3m. Ogni
creatura in quella linea deve effettuare un tiro salvezza su
Destrezza CD 20, subendo 40 (8d10) danni radianti se fallisce
il tiro salvezza, o la metà dei danni se lo supera.
Azioni Leggendarie
Il Bai Ze può compiere 3 azioni leggendarie, scegliendo tra le
opzioni seguenti.
Intuizione Mistica. Il Bai Ze può usare la sua azione
leggendaria per ottenere un'intuizione sulle debolezze del
suo avversario.
Carica Divina (2 Azioni). Il Bai Ze si muove fino alla sua
velocità in linea retta verso un bersaglio ed effettua un
attacco in mischia con le corna. Se l'attacco colpisce, infligge
22 (4d10) danni radianti extra, e il bersaglio deve superare
un tiro salvezza su Forza CD 18 o diventa prono.
Muoversi. Il Bai Ze può muoversi fino alla sua velocità senza
provocare attacchi di opportunità.
`;

const { state: s5, report: r5 } = parseStatblock(baize);
const items5 = s5.items || [];

console.log('\n— Fixture italiana: Bai Ze —');
check('Bai Ze: identità (Celestiale Grande → celestial/lg, Lawful Good)',
  s5.creatureType === 'celestial' && s5.size === 'lg' && s5.alignment === 'Lawful Good');
check('Bai Ze: velocità 12 m → 40 ft, volare 18 m → 60 ft', s5.walk === '40' && s5.fly === '60');
check('Bai Ze: etichetta "Abilità" riconosciuta come skill (arc, ins, prc)',
  Boolean(s5.skills.arc && s5.skills.ins && s5.skills.prc));
check('Bai Ze: etichetta "Linguaggi" + telepatia 36 m → 120 ft',
  s5.telepathy === '120' && /tutti/i.test(s5.languages));
check('Bai Ze: resistenze complete (radiante→radiant + gruppo fisico + nonmagical)',
  s5.dr === 'radiant, bludgeoning, piercing, slashing, nonmagical');
check('Bai Ze: immunità condizioni tradotte (affascinato, spaventato)', s5.ci === 'charmed, frightened');
check('Bai Ze: vista truesight 36 m → 120 ft', s5.truesight === '120');
check('Bai Ze: CR 15, Resistenza Leggendaria 3, 3 azioni leggendarie',
  s5.cr === '15' && s5.legres === '3' && s5.legact === '3');
const zoccoli = items5.find(i => i.name === 'Zoccoli');
check('Bai Ze: Zoccoli è un ATTACCO ("+11 a colpire"), portata 1,5 m → 5 ft',
  zoccoli?.kind === 'attack' && zoccoli.reach === '5');
check('Bai Ze: Zoccoli 4d6 + 5 bludgeoning', zoccoli?.damage === '4d6 + 5 bludgeoning');
check('Bai Ze: Zoccoli +11 anomalo (FOR +5, prof +5) → warning matematica',
  r5.warn.some(w => w.startsWith('Zoccoli')));
const raggio = items5.find(i => i.name === 'Raggio Divino');
check('Bai Ze: Raggio Divino save DEX CD 20, 8d10 radiant, metà, Ricarica 5',
  raggio?.kind === 'save' && raggio.saveAbility === 'dex' && raggio.dc === '20'
  && raggio.damage === '8d10 radiant' && raggio.onSave === 'half'
  && raggio.usesMode === 'recharge' && raggio.usesValue === '5');
const carica = items5.find(i => i.name === 'Carica Divina');
check('Bai Ze: Carica Divina INTERA (la riga "velocità..." non spezza più l\'entry)',
  carica?.kind === 'save' && carica.saveAbility === 'str' && carica.dc === '18'
  && carica.condition === 'prone' && carica.damage === '4d10 radiant' && carica.activation === 'legendary');
check('Bai Ze: "Velocità" riconosciuta una volta sola',
  r5.ok.filter(x => x.startsWith('Velocità')).length === 1);
check('Bai Ze: Intuizione Mistica e Muoversi → utility leggendarie',
  items5.find(i => i.name === 'Intuizione Mistica')?.activation === 'legendary'
  && items5.find(i => i.name === 'Muoversi')?.activation === 'legendary');

// ------------------------------------------------------------
// Fixture 6 — Ao Andon (IT): riga tipo "Non-morto Grande" (trattino,
// prima ignorata), immunità condizione "Indebolimento" (= exhaustion,
// prima finiva in custom), azioni bonus con TS. Dal collaudo utente.
// ------------------------------------------------------------
const aoAndon = `
Ao Andon
Non-morto Grande, caotico malvagio
Classe Armatura 17 (armatura naturale)
Punti Ferita 152 (16d10 + 64)
Velocità 0 m, volare 12 m (fluttuare)
FOR DES COS INT SAG CAR
10 (+0) 14 (+2) 18 (+4) 16 (+3) 12 (+1) 20 (+5)
Tiri Salvezza Sag +6, Car +10
Resistenze ai Danni freddo, fuoco, necrotico; contundente,
perforante e tagliente da attacchi non magici
Immunità ai Danni veleno
Immunità alle Condizioni affascinato, Indebolimento, spaventato,
afferrato, paralizzato, pietrificato, avvelenato, prono, trattenuto
Lingue Comune, Infernale
Sfida 10 (5,900 PE)
Resistenza allo Scacciare. L'Ao Andon ha vantaggio sui tiri
salvezza contro qualsiasi effetto che scaccia i Non Morti.
Azioni
Multiattacco. L'Ao Andon effettua due attacchi con il Tocco Gelido.
Tocco Gelido. Attacco con arma da mischia: +9 per colpire, gittata
3 m., un bersaglio. Colpito: 17 (3d6 + 7) danni necrotici.
`;

const { state: s6, report: r6 } = parseStatblock(aoAndon);

console.log('\n— Fixture italiana: Ao Andon —');
check('Ao Andon: "Non-morto Grande" → undead / lg (trattino gestito)',
  s6.creatureType === 'undead' && s6.size === 'lg');
check('Ao Andon: allineamento caotico malvagio → Chaotic Evil', s6.alignment === 'Chaotic Evil');
check('Ao Andon: riga tipo NON più ignorata', !r6.skipped.some(x => /Non-morto/i.test(x)));
check('Ao Andon: "Indebolimento" riconosciuto come exhaustion (non custom)',
  s6.ci.split(', ').includes('exhaustion') && !/indebolimento/i.test(s6.ci));
check('Ao Andon: altre immunità condizione tradotte',
  ['charmed', 'frightened', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained']
    .every(c => s6.ci.split(', ').includes(c)));
check('Ao Andon: resistenze fisiche + nonmagical',
  s6.dr === 'cold, fire, necrotic, bludgeoning, piercing, slashing, nonmagical');

// ------------------------------------------------------------
// Fixture 7 — Gumiho: taglia al MASCHILE ("Folletto Medio", concorda
// col tipo maschile) e sottotipo "mutaforma" → Shapechanger. Prima la
// riga tipo veniva ignorata perché il parser cercava solo "Media".
// ------------------------------------------------------------
const { state: s7, report: r7 } = parseStatblock(
  'Gumiho\nFolletto Medio (mutaforma), caotico neutrale\nClasse Armatura 16 (armatura naturale)\nSfida 8 (3,900 PE)\n'
);
console.log('\n— Fixture italiana: Gumiho (taglia al maschile) —');
check('Gumiho: "Folletto Medio" → fey / med (concordanza di genere)',
  s7.creatureType === 'fey' && s7.size === 'med');
check('Gumiho: sottotipo "mutaforma" → Shapechanger', s7.subtype === 'Shapechanger');
check('Gumiho: allineamento "caotico neutrale" → Chaotic Neutral', s7.alignment === 'Chaotic Neutral');
check('Gumiho: riga tipo NON più ignorata', r7.skipped.length === 0);

// ------------------------------------------------------------
// Fixture 8 — Dolgrim (SRD 2014 EN): conferma che "Melee or Ranged", i
// multi-attacco e i tratti con "advantage on saves" restano gestiti.
// ------------------------------------------------------------
const dolgrim = `
Dolgrim
Small aberration, chaotic evil
Armor Class 15 (natural armor, shield)
Hit Points 13 (3d6 + 3)
Speed 30 ft.
STR 15 (+2) DEX 14 (+2) CON 12 (+1) INT 8 (-1) WIS 10 (+0) CHA 8 (-1)
Senses darkvision 60 ft., passive Perception 10
Languages Deep Speech, Goblin
Challenge 1/2 (100 XP)
Actions
Multiattack. The dolgrim makes three attacks.
Morningstar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) piercing damage.
Spear. Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 5 (1d6 + 2) piercing damage.
Hand Crossbow. Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 5 (1d6 + 2) piercing damage.
`;
const { state: s8 } = parseStatblock(dolgrim);
const it8 = s8.items || [];
console.log('\n— Fixture EN 2014: Dolgrim —');
check('Dolgrim: aberration/sm, CA 15 naturale', s8.creatureType === 'aberration' && s8.size === 'sm' && s8.acFlat === '15');
check('Dolgrim: Morningstar attacco 1d8+2 piercing', it8.find(i => i.name === 'Morningstar')?.damage === '1d8 + 2 piercing');
check('Dolgrim: Hand Crossbow attacco a distanza DEX', it8.find(i => i.name === 'Hand Crossbow')?.attackType === 'ranged');

// ------------------------------------------------------------
// Fixture 9 — Death's Head Tree (Ravenloft, formato 2024 EN): AC/HP/CR
// corti, tabella caratteristiche Mod/Save, "Immunities" combinata,
// "Melee Attack Roll", "Dexterity Saving Throw: DC", Bonus Action.
// ------------------------------------------------------------
const dht = `
Death's Head Tree
Huge Plant, Chaotic Evil
AC 15 Initiative -1 (9)
HP 95 (10d12 + 30)
Speed 20 ft.
STR 18 +4 +6
DEX 8 −1 −1
CON 16 +3 +3
INT 5 −3 −3
WIS 10 +0 +0
CHA 13 +1 +1
Immunities Poison; Exhaustion, Poisoned
Senses Blindsight 120 ft.; Passive Perception 10
Languages None
CR 4 (XP 1,100; PB +2)
Traits
Overhanging Branches. The tree's allies can willingly end their moves in the tree's space.
Actions
Multiattack. The tree makes two Slam attacks.
Slam. Melee Attack Roll: +6, reach 10 ft. Hit: 15 (2d10 + 4) Bludgeoning damage.
Exploding Head. Dexterity Saving Throw: DC 14, each creature in a 10-foot-radius Sphere. Failure: 10 (3d6) Necrotic damage, and the creature has the Poisoned condition until the start of the tree's next turn. Success: Half damage only.
Bonus Action
Head Fruits. Each Undead ally in the tree's space can take a Reaction to gain 5 Temporary Hit Points.
`;
const { state: s9, report: r9 } = parseStatblock(dht);
const it9 = s9.items || [];
console.log('\n— Fixture EN 2024: Death\'s Head Tree —');
check('2024: identità Huge Plant → plant/huge, Chaotic Evil', s9.creatureType === 'plant' && s9.size === 'huge' && s9.alignment === 'Chaotic Evil');
check('2024: AC 15 (sigla corta), HP 95 (10d12 + 30)', s9.acFlat === '15' && s9.hpMax === '95' && s9.hpFormula === '10d12 + 30');
check('2024: caratteristiche da tabella Mod/Save (con segno meno Unicode −)',
  s9.str === '18' && s9.dex === '8' && s9.con === '16' && s9.int === '5' && s9.cha === '13');
check('2024: TS competente dedotto (save≠mod → STR)', JSON.stringify(s9.saves) === JSON.stringify(['str']));
check('2024: "Immunities" combinata → danni (poison) e condizioni (exhaustion, poisoned)',
  s9.di === 'poison' && s9.ci === 'exhaustion, poisoned');
check('2024: CR 4 (sigla corta)', s9.cr === '4');
const slam = it9.find(i => i.name === 'Slam');
check('2024: "Melee Attack Roll: +6" → attacco, 2d10+4 bludgeoning', slam?.kind === 'attack' && slam.damage === '2d10 + 4 bludgeoning');
const eh = it9.find(i => i.name === 'Exploding Head');
check('2024: "Dexterity Saving Throw: DC 14" → save DEX 14, 3d6 necrotic, metà, poisoned',
  eh?.kind === 'save' && eh.saveAbility === 'dex' && eh.dc === '14' && eh.damage === '3d6 necrotic' && eh.onSave === 'half' && eh.condition === 'poisoned');
check('2024: Bonus Action riconosciuta (Head Fruits)', it9.find(i => i.name === 'Head Fruits')?.activation === 'bonus');
check('2024: tratto Overhanging Branches passivo', it9.find(i => i.name === 'Overhanging Branches')?.kind === 'passive');
check('2024: nessuna riga ignorata', r9.skipped.length === 0);

if (failures) {
  console.error(`\n${failures} test falliti.`);
  process.exit(1);
}
console.log('\nTutti i test del parser passati ✔');
