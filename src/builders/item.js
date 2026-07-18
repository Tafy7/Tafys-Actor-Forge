// ============================================================
// Builder degli Item embedded (attacchi, azioni, tratti) — Fase 2.
//
// Come per l'actor, ogni item parte da una base estratta da un
// export reale (item-bases.js) e viene riempito con i dati del form.
// Struttura dnd5e 5.x da tenere a mente:
//   Item (weapon/feat) → system.activities → { attack | save | utility }
// L'activity è "il pulsante che tiri": contiene attivazione, bersagli,
// tiro per colpire o tiro salvezza, e le parti di danno.
// ============================================================
import { WEAPON_BASE, FEAT_BASE, ACTIVITY_BASES, DAMAGE_PART_BASE, EFFECT_BASE } from '../data/item-bases.js';
import { DAMAGE_TYPES } from '../data/constants.js';
import { randomID } from '../utils/id.js';
import { cleanImagePath } from '../utils/img.js';

/**
 * Converte una stringa di danni in parti strutturate dnd5e.
 * Formato: "2d8 + @mod piercing, 8d8 fire" — e il bonus può essere
 * COMPOSTO: "1d4 + 2 + @mod piercing" → bonus "2 + @mod".
 * Nel campo `bonus` di dnd5e ci sta qualsiasi formula di roll valida
 * (numeri, @mod, @prof, @abilities.str.mod...): noi la passiamo intera.
 * Il tipo di danno è sempre l'ULTIMA parola (id inglese standard).
 * Ritorna { parts: [...], errors: [...] }.
 */
export function parseDamageParts(input) {
  const parts = [];
  const errors = [];
  for (const raw of (input || '').split(',')) {
    const token = raw.trim();
    if (!token) continue;

    // 1) Stacca l'ultima parola: è il tipo di danno.
    const split = token.match(/^(.*?)\s+([a-zA-Z]+)$/);
    if (!split) {
      errors.push(`Formato non riconosciuto: "${token}" (esempio: 1d4 + 2 + @mod piercing)`);
      continue;
    }
    const [, formula, typeRaw] = split;
    const type = typeRaw.toLowerCase();
    if (!DAMAGE_TYPES.includes(type)) {
      errors.push(`Tipo di danno sconosciuto: "${typeRaw}" (usa gli id inglesi: ${DAMAGE_TYPES.join(', ')})`);
      continue;
    }

    // 2) Il resto è "NdX" seguito da zero o più addendi (+ numero o + @formula).
    const m = formula.trim().match(/^(\d+)\s*d\s*(\d+)((?:\s*\+\s*(?:@[\w.]+|\d+))*)$/);
    if (!m) {
      errors.push(`Formula dadi non riconosciuta: "${formula}" (esempio: 1d4 + 2 + @mod)`);
      continue;
    }
    const [, number, denomination, bonusRaw] = m;
    const part = structuredClone(DAMAGE_PART_BASE);
    part.number = Number(number);
    part.denomination = Number(denomination);
    // Normalizza gli addendi in una formula pulita: " +2 +@mod" → "2 + @mod"
    part.bonus = bonusRaw
      .split('+').map(s => s.trim()).filter(Boolean).join(' + ');
    part.types = [type];
    parts.push(part);
  }
  return { parts, errors };
}

// Icone delle condizioni: dnd5e le fornisce già per tutti gli status standard.
const conditionIcon = (c) => `systems/dnd5e/icons/svg/statuses/${c}.svg`;

/**
 * Crea un ActiveEffect che applica una condizione (status) al bersaglio.
 * Base presa dal golden template MagIRA LOCA. `rounds` vuoto = la
 * condizione resta finché non viene rimossa a mano o da un TS ripetuto.
 */
function buildConditionEffect(condition, rounds, itemName) {
  const eff = structuredClone(EFFECT_BASE);
  eff._id = randomID();
  eff.name = `${itemName}: ${condition}`;
  eff.img = conditionIcon(condition);
  eff.statuses = [condition];
  // forceCEOff: dice a Midi-QOL di NON applicare anche la versione
  // "Convenient Effects" della condizione, altrimenti il bersaglio la
  // riceve DUE volte (la nostra + quella di CE). Tutti i golden template
  // (Bracers, Cloak, Sword of Zariel "Status: Blinded") ce l'hanno.
  eff.flags['midi-qol'] = { forceCEOff: true };
  const n = Number(rounds) || 0;
  if (n > 0) eff.duration = { rounds: n, startTime: null, combat: null };
  return eff;
}

/**
 * Crea un ActiveEffect "vero" con modifiche alle statistiche (Fase 3.2).
 * `e` (descrittore dal form): { name, application, rounds, img, changes[] }
 *   application 'passive' → transfer:true, sempre attivo su chi possiede
 *     l'item (pattern Bracers of Defense / Sword of Kas);
 *   application 'target'  → transfer:false, applicato al bersaglio tramite
 *     il riferimento nell'activity (stesso canale delle condizioni).
 * `forcePassive`: i tratti passivi non hanno activity, quindi ogni loro
 * effetto può solo essere transfer.
 */
function buildDaeEffect(e, itemName, forcePassive) {
  const eff = structuredClone(EFFECT_BASE);
  eff._id = randomID();
  eff.name = (e.name || '').trim() || itemName;
  eff.img = cleanImagePath(e.img) || 'icons/svg/aura.svg';

  // Solo le righe complete finiscono nel JSON (la validazione avvisa
  // comunque l'utente di quelle a metà, vedi validateNpc).
  eff.changes = (e.changes || [])
    .filter(c => String(c.key || '').trim() && String(c.value ?? '').trim())
    .map(c => ({
      key: String(c.key).trim(),
      // Attenzione: mode 0 (Custom) è un valore VALIDO, quindi niente "|| 0".
      mode: Number.isFinite(Number(c.mode)) ? Number(c.mode) : 2,
      value: String(c.value).trim(),
      priority: Number(c.priority) || 20,
    }));

  // Anti-doppione: come per le condizioni, forceCEOff evita che Midi
  // applichi anche l'eventuale effetto Convenient Effects omonimo
  // (presente su TUTTI gli effetti dei golden template).
  eff.flags['midi-qol'] = { forceCEOff: true };

  if (forcePassive || e.application !== 'target') {
    // Passivo: il flag dae.transfer è quello che dice a DAE di applicare
    // l'effetto all'actor che possiede l'item (copiato dai golden 2024).
    eff.transfer = true;
    eff.flags.dae = { transfer: true, stackable: 'noneNameOnly' };
  } else {
    const n = Number(e.rounds) || 0;
    if (n > 0) eff.duration = { rounds: n, startTime: null, combat: null };
  }
  return eff;
}

/** Imposta gli usi limitati sull'item: nessuno, Recharge X-6, oppure N/giorno. */
function applyUses(item, activity, usesMode, usesValue) {
  const n = Number(usesValue) || 0;
  if (usesMode === 'none' || n <= 0) return;

  if (usesMode === 'recharge') {
    // "Recharge 5–6" → max 1 uso, recovery di tipo 'recharge' con formula "5"
    // (= si ricarica con 5 o più sul d6, come nel golden template di Horrid Touch).
    item.system.uses.max = '1';
    item.system.uses.recovery = [{ formula: String(n), period: 'recharge', type: 'recoverAll' }];
  } else if (usesMode === 'day') {
    item.system.uses.max = String(n);
    item.system.uses.recovery = [{ period: 'day', type: 'recoverAll' }];
  }
  // L'activity deve CONSUMARE quegli usi, altrimenti il contatore non scala
  // (pattern preso pari pari da Horrid Touch).
  activity.consumption.targets = [
    { target: '', value: '1', type: 'itemUses', scaling: {} },
  ];
}

/**
 * Costruisce un Item embedded a partire da un descrittore del form.
 * `d` (descrittore): { name, kind, activation, attackType, ability, reach,
 *   range, longRange, damage, magical, saveAbility, dc, onSave,
 *   usesMode, usesValue, img, description }
 * kind: 'attack' | 'save' | 'utility' | 'passive'
 */
export function buildItem(d) {
  const isWeapon = d.kind === 'attack';
  const item = structuredClone(isWeapon ? WEAPON_BASE : FEAT_BASE);

  item._id = randomID();
  item.name = d.name.trim() || 'Senza nome';
  item.system.identifier = item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  item.system.description.value = d.description ? `<p>${d.description}</p>` : '';
  const itemImg = cleanImagePath(d.img);
  if (itemImg) item.img = itemImg;

  // --- Tratto passivo: niente activity, solo descrizione (es. Magic Resistance).
  //     Gli effetti DAE qui sono per forza transfer: è IL posto giusto per
  //     "Resistenza al Fuoco" e simili bonus permanenti del mostro. ---
  if (d.kind === 'passive') {
    for (const e of d.effects || []) item.effects.push(buildDaeEffect(e, item.name, true));
    return item;
  }

  // --- Effetti DAE (Fase 3.2): i passivi vanno solo in item.effects;
  //     quelli "sul bersaglio" vanno ANCHE referenziati dall'activity,
  //     come le condizioni (onSave:false = il TS superato li evita). ---
  const appliedEffects = [];
  for (const e of d.effects || []) {
    const eff = buildDaeEffect(e, item.name, false);
    item.effects.push(eff);
    if (!eff.transfer) appliedEffects.push(eff);
  }
  const attachApplied = (act, viaSave) => {
    for (const eff of appliedEffects) {
      act.effects.push(viaSave ? { _id: eff._id, onSave: false, level: {} } : { _id: eff._id, level: {} });
    }
  };

  // --- Activity: clona la base giusta e le dà un id nuovo ---
  const activity = structuredClone(ACTIVITY_BASES[d.kind]);
  activity._id = randomID();
  activity.activation.type = d.activation; // action | bonus | reaction | legendary | special

  if (d.kind === 'attack') {
    activity.attack.type.value = d.attackType; // melee | ranged
    activity.attack.ability = d.ability;       // str | dex | ...
    if (d.attackType === 'melee') {
      item.system.range = { value: Number(d.reach) || 5, long: null, units: 'ft' };
    } else {
      item.system.range = {
        value: Number(d.range) || 30,
        long: Number(d.longRange) || null,
        units: 'ft',
      };
    }
    if (d.magical) item.system.properties = ['mgc'];
    const { parts } = parseDamageParts(d.damage);
    activity.damage.parts = parts;

    // --- Effetto sul colpito ---
    if (d.onHit === 'condition' && d.condition) {
      // Condizione applicata DIRETTAMENTE quando l'attacco colpisce
      // (pattern Sword of Zariel: effetto referenziato dall'activity attack;
      // Midi-QOL lo applica al bersaglio colpito).
      const eff = buildConditionEffect(d.condition, d.condRounds, item.name);
      item.effects.push(eff);
      activity.effects.push({ _id: eff._id, level: {} });
    }
    if (d.onHit === 'save' && d.condition) {
      // "Morso di lupo": colpisci → il bersaglio tira un TS o subisce
      // la condizione. Si modella con una SECONDA activity di tipo save
      // collegata all'attacco tramite otherActivityId: Midi-QOL la
      // esegue automaticamente su ogni colpo andato a segno.
      const eff = buildConditionEffect(d.condition, d.condRounds, item.name);
      item.effects.push(eff);

      const rider = structuredClone(ACTIVITY_BASES.save);
      rider._id = randomID();
      rider.name = `TS ${d.riderSaveAbility.toUpperCase()} o ${d.condition}`;
      rider.activation = { type: 'special', value: null, override: true, condition: '' };
      rider.save = { ability: [d.riderSaveAbility], dc: { calculation: '', formula: String(Number(d.riderDc) || 10) } };
      rider.damage = { onSave: 'none', parts: [], critical: { allow: false } };
      rider.effects = [{ _id: eff._id, onSave: false, level: {} }]; // onSave:false = TS superato → niente condizione
      // automationOnly: la rider non appare come pulsante sulla scheda,
      // esiste solo per l'automazione (pattern del Check di Counterspell).
      rider.midiProperties.automationOnly = true;

      activity.otherActivityId = rider._id;
      // Gli effetti DAE "sul bersaglio" seguono lo stesso TS della
      // condizione: li agganciamo alla rider, non all'attacco.
      attachApplied(rider, true);
      applyUses(item, activity, d.usesMode, d.usesValue);
      item.system.activities = { [activity._id]: activity, [rider._id]: rider };
      return item;
    }
  }

  if (d.kind === 'save') {
    activity.save.ability = [d.saveAbility];
    // CD fissa scritta nel formula (come Horrid Touch: "26"); in futuro
    // aggiungeremo il calcolo automatico da caratteristica.
    activity.save.dc = { calculation: '', formula: String(Number(d.dc) || 10) };
    activity.damage.onSave = d.onSave; // 'none' = danno pieno, 'half' = metà
    const { parts } = parseDamageParts(d.damage);
    activity.damage.parts = parts;

    // Condizione applicata a chi FALLISCE il TS (pattern Horrid Touch:
    // onSave:false = chi supera il tiro non riceve l'effetto).
    if (d.condition) {
      const eff = buildConditionEffect(d.condition, d.condRounds, item.name);
      item.effects.push(eff);
      activity.effects.push({ _id: eff._id, onSave: false, level: {} });
    }
  }

  // Effetti sul bersaglio: con un'activity save il riferimento porta
  // onSave:false (TS superato = niente effetto); con attack/utility
  // l'effetto si applica direttamente al colpito/bersaglio.
  attachApplied(activity, d.kind === 'save');
  applyUses(item, activity, d.usesMode, d.usesValue);
  item.system.activities = { [activity._id]: activity };
  return item;
}
