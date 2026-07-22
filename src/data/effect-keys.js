// ============================================================
// Catalogo per gli effetti DAE — Fase 3, parte 2.
//
// Tre cose vivono qui:
//  1. CHANGE_MODES  — le modalità con cui un ActiveEffect modifica un
//     valore (sono i CONST.ACTIVE_EFFECT_MODES di Foundry: 0..5).
//  2. CHANGE_KEYS   — le chiavi più utili per `changes[].key`, con
//     etichetta italiana e la coppia modalità/priorità "giusta"
//     osservata nei golden template (es. la CA usa priorità 18 nei
//     Bracers of Defense, le resistenze priorità 1 nella Sword of Kas).
//  3. EFFECT_PRESETS — effetti completi pronti da un click.
//
// REGOLA D'ORO anche qui: modalità e priorità NON sono inventate, sono
// copiate dagli export reali in templates/ (Bracers, Cloak, Sword of
// Kas/Zariel, Alzati). Le uniche voci non presenti nei golden sono i
// flag Midi-QOL (vantaggio/svantaggio): seguono la convenzione DAE
// documentata (modalità 0 = Custom, valore "1") — da verificare al
// primo import, come facciamo sempre.
// ============================================================

// Modalità di Foundry: [valore, etichetta]. Il catalogo DAE resta in
// INGLESE anche con UI italiana: le chiavi sono l'API di Foundry e la
// documentazione di DAE che l'utente consulta è in inglese, quindi i
// termini inglesi sono più utili (e universali) di una traduzione.
// 0 Custom lo interpreta DAE (flag Midi, formule "*0.5"); 2 Add è la più
// comune; 4 Upgrade = "usa questo valore se è migliore di quello attuale".
export const CHANGE_MODES = [
  [0, 'Custom (DAE)'],
  [1, 'Multiply'],
  [2, 'Add'],
  [3, 'Downgrade (min)'],
  [4, 'Upgrade (max)'],
  [5, 'Override'],
];

// Chiavi note: { key, label, mode, priority, hint }.
// `mode`/`priority` sono i default che la UI imposta quando scegli la
// chiave dal menu; restano modificabili a mano.
export const CHANGE_KEYS = [
  // --- Defenses (priorities from the golden templates: AC 18, saves 20) ---
  { key: 'system.attributes.ac.bonus', label: 'AC bonus/penalty', mode: 2, priority: 18, hint: 'e.g. 2 or -2' },
  { key: 'system.bonuses.abilities.save', label: 'Bonus to all saves', mode: 2, priority: 20, hint: 'e.g. 1 or 1d4' },
  { key: 'system.bonuses.abilities.check', label: 'Bonus to all checks', mode: 2, priority: 20, hint: 'e.g. 1 or 1d4' },
  { key: 'system.attributes.init.bonus', label: 'Initiative bonus', mode: 2, priority: 20, hint: 'e.g. 2 or 1d10 (Sword of Kas)' },

  // --- Attack & damage (dnd5e system bonuses) ---
  { key: 'system.bonuses.mwak.attack', label: 'Melee attack bonus', mode: 2, priority: 20, hint: 'e.g. 1' },
  { key: 'system.bonuses.rwak.attack', label: 'Ranged attack bonus', mode: 2, priority: 20, hint: 'e.g. 1' },
  { key: 'system.bonuses.mwak.damage', label: 'Melee damage bonus', mode: 2, priority: 20, hint: 'e.g. 2 or 1d6' },
  { key: 'system.bonuses.rwak.damage', label: 'Ranged damage bonus', mode: 2, priority: 20, hint: 'e.g. 2 or 1d6' },

  // --- Traits (resistances are ADDED with priority 1, see Kas/Zariel) ---
  { key: 'system.traits.dr.value', label: 'Damage resistance', mode: 2, priority: 1, hint: 'english id: fire, cold...' },
  { key: 'system.traits.di.value', label: 'Damage immunity', mode: 2, priority: 1, hint: 'english id: fire, poison...' },
  { key: 'system.traits.dv.value', label: 'Damage vulnerability', mode: 2, priority: 1, hint: 'english id: radiant...' },
  { key: 'system.traits.languages.value', label: 'Extra language', mode: 2, priority: 0, hint: 'english id: celestial...' },

  // --- Movement & senses (Upgrade = never slows down a faster creature) ---
  { key: 'system.attributes.movement.all', label: 'All speeds', mode: 0, priority: 20, hint: '*0.5 = halve (Custom)' },
  { key: 'system.attributes.movement.walk', label: 'Walk speed', mode: 4, priority: 5, hint: 'e.g. 40' },
  { key: 'system.attributes.movement.fly', label: 'Fly speed', mode: 4, priority: 5, hint: 'e.g. 90 (Sword of Zariel)' },
  { key: 'system.attributes.senses.darkvision', label: 'Darkvision', mode: 4, priority: 20, hint: 'e.g. 60' },
  { key: 'system.attributes.senses.truesight', label: 'Truesight', mode: 4, priority: 20, hint: 'e.g. 60' },

  // --- Ability scores (Upgrade, "Divine Presence" pattern of the Sword of Zariel) ---
  { key: 'system.abilities.str.value', label: 'Strength score (upgrade to)', mode: 4, priority: 3, hint: 'e.g. 20' },
  { key: 'system.abilities.dex.value', label: 'Dexterity score (upgrade to)', mode: 4, priority: 3, hint: 'e.g. 20' },
  { key: 'system.abilities.con.value', label: 'Constitution score (upgrade to)', mode: 4, priority: 3, hint: 'e.g. 20' },
  { key: 'system.abilities.cha.value', label: 'Charisma score (upgrade to)', mode: 4, priority: 3, hint: 'e.g. 20' },

  // --- Midi-QOL flags (DAE convention: Custom + value "1") ---
  { key: 'flags.midi-qol.advantage.attack.all', label: 'Advantage on attacks', mode: 0, priority: 20, hint: 'value: 1' },
  { key: 'flags.midi-qol.disadvantage.attack.all', label: 'Disadvantage on attacks', mode: 0, priority: 20, hint: 'value: 1' },
  { key: 'flags.midi-qol.grants.advantage.attack.all', label: 'Attacks AGAINST have advantage', mode: 0, priority: 20, hint: 'value: 1' },
  { key: 'flags.midi-qol.advantage.ability.save.all', label: 'Advantage on all saves', mode: 0, priority: 20, hint: 'value: 1' },
  { key: 'flags.midi-qol.disadvantage.ability.save.all', label: 'Disadvantage on all saves', mode: 0, priority: 20, hint: 'value: 1' },
];

/** Ritorna la voce di catalogo per una chiave esatta (o undefined). */
export function keyDefaults(key) {
  return CHANGE_KEYS.find(k => k.key === (key || '').trim());
}

// Preset completi: { id, label, name, application, rounds?, changes[] }.
// `application`: 'passive' = sempre attivo su chi possiede l'item
// (transfer, stile Bracers); 'target' = applicato al bersaglio
// colpito / che fallisce il TS (stile MagIRA LOCA).
export const EFFECT_PRESETS = [
  {
    id: 'res-fire', label: 'Fire resistance',
    name: 'Fire Resistance', application: 'passive',
    changes: [{ key: 'system.traits.dr.value', mode: 2, value: 'fire', priority: 1 }],
  },
  {
    id: 'imm-fire', label: 'Fire immunity',
    name: 'Fire Immunity', application: 'passive',
    changes: [{ key: 'system.traits.di.value', mode: 2, value: 'fire', priority: 1 }],
  },
  {
    id: 'ac-plus2', label: 'AC bonus +2 (Bracers style)',
    name: 'AC Bonus +2', application: 'passive',
    changes: [{ key: 'system.attributes.ac.bonus', mode: 2, value: '2', priority: 18 }],
  },
  {
    id: 'save-plus1', label: '+1 to all saves (Cloak style)',
    name: 'Protection +1', application: 'passive',
    changes: [{ key: 'system.bonuses.abilities.save', mode: 2, value: '1', priority: 20 }],
  },
  {
    id: 'adv-attack', label: 'Advantage on attacks',
    name: 'Advantage on Attacks', application: 'passive',
    changes: [{ key: 'flags.midi-qol.advantage.attack.all', mode: 0, value: '1', priority: 20 }],
  },
  {
    id: 'ac-minus2', label: 'AC penalty -2 → target',
    name: 'Reduced AC', application: 'target',
    changes: [{ key: 'system.attributes.ac.bonus', mode: 2, value: '-2', priority: 18 }],
  },
  {
    id: 'dis-attack', label: 'Disadvantage on attacks → target',
    name: 'Disadvantage on Attacks', application: 'target',
    changes: [{ key: 'flags.midi-qol.disadvantage.attack.all', mode: 0, value: '1', priority: 20 }],
  },
  {
    id: 'grants-adv', label: 'Attacks against it have advantage → target',
    name: 'Exposed', application: 'target',
    changes: [{ key: 'flags.midi-qol.grants.advantage.attack.all', mode: 0, value: '1', priority: 20 }],
  },
  {
    id: 'half-speed', label: 'Speed halved → target (Alzati style)',
    name: 'Slowed', application: 'target',
    changes: [{ key: 'system.attributes.movement.all', mode: 0, value: '*0.5', priority: 20 }],
  },
];

/** Ritorna il preset con l'id dato (o undefined). */
export function presetById(id) {
  return EFFECT_PRESETS.find(p => p.id === id);
}
