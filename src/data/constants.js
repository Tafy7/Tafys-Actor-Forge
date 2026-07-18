// Costanti del sistema dnd5e 5.3.3.
// Gli "id" (le chiavi) sono quelli interni di Foundry e NON vanno tradotti:
// nel JSON finisce sempre l'id inglese, l'etichetta italiana serve solo alla UI.

// Ogni etichetta esiste in italiano e inglese: la UI sceglie in base
// alla lingua, ma nel JSON finisce SEMPRE l'id inglese interno.
export const ABILITIES = [
  { id: 'str', label: 'Forza', en: 'Strength' },
  { id: 'dex', label: 'Destrezza', en: 'Dexterity' },
  { id: 'con', label: 'Costituzione', en: 'Constitution' },
  { id: 'int', label: 'Intelligenza', en: 'Intelligence' },
  { id: 'wis', label: 'Saggezza', en: 'Wisdom' },
  { id: 'cha', label: 'Carisma', en: 'Charisma' },
];

export const SIZES = [
  { id: 'tiny', label: 'Minuscola', en: 'Tiny', token: 0.5 },
  { id: 'sm',   label: 'Piccola',   en: 'Small', token: 1 },
  { id: 'med',  label: 'Media',     en: 'Medium', token: 1 },
  { id: 'lg',   label: 'Grande',    en: 'Large', token: 2 },
  { id: 'huge', label: 'Enorme',    en: 'Huge', token: 3 },
  { id: 'grg',  label: 'Mastodontica', en: 'Gargantuan', token: 4 },
];

export const CREATURE_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
  'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
];

// Tipi di danno riconosciuti dal sistema: se l'utente scrive uno di questi id,
// finisce nell'array `value` (e il sistema lo automatizza); altrimenti in `custom`.
export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];

// "Bypass" delle resistenze/immunità fisiche (schema dnd5e: traits.dr.bypasses).
// Esempio Zariel: dr.value [bludgeoning, piercing, slashing] + bypasses [mgc, sil]
// = "resistente a contundente/perforante/tagliente da attacchi non magici non argentati".
// Nel form viaggiano come token testuali accanto ai tipi di danno; il builder
// li traduce nei codici di sistema.
export const DAMAGE_BYPASSES = { nonmagical: 'mgc', silvered: 'sil', adamantine: 'ada' };
export const BYPASS_LABELS = {
  nonmagical: 'solo non magici',
  silvered: 'solo non argentati',
  adamantine: 'solo non adamantio',
};

export const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone',
  'restrained', 'stunned', 'unconscious',
];

export const LANGUAGES = [
  'common', 'aarakocra', 'abyssal', 'aquan', 'auran', 'celestial', 'deep',
  'draconic', 'druidic', 'dwarvish', 'elvish', 'giant', 'gith', 'gnomish',
  'goblin', 'gnoll', 'halfling', 'ignan', 'infernal', 'orc', 'primordial',
  'sylvan', 'terran', 'cant', 'undercommon', 'sign',
];

// ---------- Etichette italiane per la UI ----------
// Nel JSON finiscono SEMPRE gli id inglesi qui sopra: queste mappe
// servono solo a mostrare nomi leggibili nel form.

export const DAMAGE_TYPE_LABELS = {
  acid: 'Acido', bludgeoning: 'Contundente', cold: 'Freddo', fire: 'Fuoco',
  force: 'Forza', lightning: 'Fulmine', necrotic: 'Necrotico',
  piercing: 'Perforante', poison: 'Veleno', psychic: 'Psichico',
  radiant: 'Radioso', slashing: 'Tagliente', thunder: 'Tuono',
};

export const CONDITION_LABELS = {
  blinded: 'Accecato', charmed: 'Affascinato', deafened: 'Assordato',
  exhaustion: 'Sfinimento', frightened: 'Spaventato', grappled: 'Afferrato',
  incapacitated: 'Incapacitato', invisible: 'Invisibile',
  paralyzed: 'Paralizzato', petrified: 'Pietrificato', poisoned: 'Avvelenato',
  prone: 'Prono', restrained: 'Trattenuto', stunned: 'Stordito',
  unconscious: 'Privo di Sensi',
};

export const LANGUAGE_LABELS = {
  common: 'Comune', aarakocra: 'Aarakocra', abyssal: 'Abissale',
  aquan: 'Acquano', auran: 'Aurano', celestial: 'Celestiale',
  deep: 'Deep Speech', draconic: 'Draconico', druidic: 'Druidico',
  dwarvish: 'Nanico', elvish: 'Elfico', giant: 'Gigante', gith: 'Gith',
  gnomish: 'Gnomesco', goblin: 'Goblin', gnoll: 'Gnoll', halfling: 'Halfling',
  ignan: 'Ignano', infernal: 'Infernale', orc: 'Orchesco',
  primordial: 'Primordiale', sylvan: 'Silvano', terran: 'Terrano',
  cant: 'Gergo Ladresco', undercommon: 'Sottocomune', sign: 'Lingua dei Segni',
};

export const CREATURE_TYPE_LABELS = {
  aberration: 'Aberrazione', beast: 'Bestia', celestial: 'Celestiale',
  construct: 'Costrutto', dragon: 'Drago', elemental: 'Elementale',
  fey: 'Folletto', fiend: 'Immondo', giant: 'Gigante', humanoid: 'Umanoide',
  monstrosity: 'Mostruosità', ooze: 'Melma', plant: 'Pianta', undead: 'Non Morto',
};

// ---------- Etichette inglesi (stessi id) ----------
export const DAMAGE_TYPE_LABELS_EN = {
  acid: 'Acid', bludgeoning: 'Bludgeoning', cold: 'Cold', fire: 'Fire',
  force: 'Force', lightning: 'Lightning', necrotic: 'Necrotic',
  piercing: 'Piercing', poison: 'Poison', psychic: 'Psychic',
  radiant: 'Radiant', slashing: 'Slashing', thunder: 'Thunder',
};

export const CONDITION_LABELS_EN = {
  blinded: 'Blinded', charmed: 'Charmed', deafened: 'Deafened',
  exhaustion: 'Exhaustion', frightened: 'Frightened', grappled: 'Grappled',
  incapacitated: 'Incapacitated', invisible: 'Invisible',
  paralyzed: 'Paralyzed', petrified: 'Petrified', poisoned: 'Poisoned',
  prone: 'Prone', restrained: 'Restrained', stunned: 'Stunned',
  unconscious: 'Unconscious',
};

export const LANGUAGE_LABELS_EN = {
  common: 'Common', aarakocra: 'Aarakocra', abyssal: 'Abyssal',
  aquan: 'Aquan', auran: 'Auran', celestial: 'Celestial',
  deep: 'Deep Speech', draconic: 'Draconic', druidic: 'Druidic',
  dwarvish: 'Dwarvish', elvish: 'Elvish', giant: 'Giant', gith: 'Gith',
  gnomish: 'Gnomish', goblin: 'Goblin', gnoll: 'Gnoll', halfling: 'Halfling',
  ignan: 'Ignan', infernal: 'Infernal', orc: 'Orc',
  primordial: 'Primordial', sylvan: 'Sylvan', terran: 'Terran',
  cant: "Thieves' Cant", undercommon: 'Undercommon', sign: 'Sign Language',
};

export const CREATURE_TYPE_LABELS_EN = {
  aberration: 'Aberration', beast: 'Beast', celestial: 'Celestial',
  construct: 'Construct', dragon: 'Dragon', elemental: 'Elemental',
  fey: 'Fey', fiend: 'Fiend', giant: 'Giant', humanoid: 'Humanoid',
  monstrosity: 'Monstrosity', ooze: 'Ooze', plant: 'Plant', undead: 'Undead',
};

export const BYPASS_LABELS_EN = {
  nonmagical: 'nonmagical only',
  silvered: 'non-silvered only',
  adamantine: 'non-adamantine only',
};

// Selettore per lingua: byLang(mappaIT, mappaEN, 'it'|'en').
export function byLang(mapIt, mapEn, lang) {
  return lang === 'en' ? mapEn : mapIt;
}

// Gradi Sfida standard, per il menu a tendina.
export const CRS = ['0', '1/8', '1/4', '1/2',
  ...Array.from({ length: 30 }, (_, i) => String(i + 1))];

export const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned',
];
