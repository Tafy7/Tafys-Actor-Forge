// ============================================================
// Builder dell'Actor NPC — il cuore di Tafy's Actor Forge.
//
// Filosofia "golden template": NON costruiamo il JSON da zero.
// Partiamo da NPC_BASE (un export reale di Foundry, svuotato) e
// riempiamo solo i campi che l'utente ha compilato. Così lo schema
// è per costruzione identico a quello che Foundry si aspetta.
//
// Regola importante imparata dai golden template: i campi che
// Foundry CALCOLA (bonus skill, save, iniziativa, spell DC) non
// vanno scritti nel JSON — scriviamo solo i dati sorgente.
// ============================================================
import { NPC_BASE } from '../data/npc-base.js';
import { SIZES, DAMAGE_TYPES, CONDITIONS, LANGUAGES, DAMAGE_BYPASSES } from '../data/constants.js';
import { buildItem, parseDamageParts } from './item.js';
import { cleanImagePath, hasValidImageExt } from '../utils/img.js';

/**
 * Divide una stringa "fire, cold, fuoco magico" negli id riconosciuti
 * dal sistema (→ array `value`) e nel resto (→ stringa `custom`).
 * Il sistema automatizza solo gli id standard; il testo custom è
 * comunque mostrato sulla scheda.
 */
function splitKnown(input, knownIds) {
  const value = [];
  const custom = [];
  for (const raw of (input || '').split(/[,;]/)) {
    const token = raw.trim();
    if (!token) continue;
    const id = token.toLowerCase();
    if (knownIds.includes(id)) value.push(id);
    else custom.push(token);
  }
  return { value, custom: custom.join('; ') };
}

/**
 * Come splitKnown, ma per i TRATTI DI DANNO (dr/di/dv), che oltre a
 * value/custom hanno `bypasses`: i token speciali "nonmagical",
 * "silvered" e "adamantine" diventano i codici mgc/sil/ada di dnd5e
 * (pattern preso da Zariel: value fisici + bypasses ["mgc","sil"] =
 * "resistenza a contundente/perforante/tagliente da attacchi non
 * magici non argentati"). Il sistema applica i bypass SOLO ai tipi
 * fisici: fire/radiant in value restano incondizionati.
 */
function splitDamageTrait(input) {
  const value = [];
  const bypasses = [];
  const custom = [];
  for (const raw of (input || '').split(/[,;]/)) {
    const token = raw.trim();
    if (!token) continue;
    const id = token.toLowerCase();
    if (DAMAGE_TYPES.includes(id)) value.push(id);
    else if (DAMAGE_BYPASSES[id]) bypasses.push(DAMAGE_BYPASSES[id]);
    else custom.push(token);
  }
  return { value, bypasses, custom: custom.join('; ') };
}

/** Converte il CR: accetta "5", "1/2", "1/4", "0.25"... → numero. */
export function parseCR(input) {
  const s = String(input ?? '').trim();
  if (!s) return 0;
  if (s.includes('/')) {
    const [num, den] = s.split('/').map(Number);
    if (den) return num / den;
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Costruisce l'oggetto Actor completo a partire dai dati del form.
 * `data` è un oggetto piatto (vedi readForm() in main.js).
 */
export function buildNpc(data) {
  // structuredClone: copia profonda del template, così NPC_BASE resta intatto
  // e ogni export parte da una base pulita.
  const actor = structuredClone(NPC_BASE);
  const sys = actor.system;

  // --- Identità ---
  actor.name = data.name.trim();
  sys.details.alignment = data.alignment.trim();
  sys.details.type.value = data.creatureType;
  sys.details.type.subtype = data.subtype.trim();
  sys.details.cr = parseCR(data.cr);
  sys.details.biography.value = data.bio;
  sys.source.rules = data.rules; // '2014' oppure '2024'
  // Source personalizzata (es. "DMG p.94"), come per Item e Spell.
  sys.source.book = String(data.sourceBook || '').trim();
  sys.source.page = String(data.sourcePage || '').trim();
  sys.traits.size = data.size;

  // --- Caratteristiche ---
  for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    sys.abilities[ab].value = Number(data[ab]) || 10;
    // proficient = 1 → l'NPC è competente nel TIRO SALVEZZA di quella
    // caratteristica (il bonus lo calcola Foundry da CR e proficiency).
    sys.abilities[ab].proficient = data.saves.includes(ab) ? 1 : 0;
  }

  // --- Punti ferita ---
  const hp = Number(data.hpMax) || 0;
  sys.attributes.hp.value = hp;
  sys.attributes.hp.max = hp;
  sys.attributes.hp.formula = data.hpFormula.trim();

  // --- Classe Armatura ---
  // 'default' = calcolata dal sistema; 'natural'/'flat' usano il valore fisso.
  sys.attributes.ac.calc = data.acCalc;
  sys.attributes.ac.flat = data.acCalc === 'default' ? null : (Number(data.acFlat) || null);

  // --- Velocità (scriviamo solo quelle valorizzate: i campi assenti
  //     prendono i default di sistema, come negli export reali) ---
  const mv = sys.attributes.movement;
  mv.walk = String(Number(data.walk) || 0);
  for (const key of ['fly', 'swim', 'climb', 'burrow']) {
    const v = Number(data[key]) || 0;
    if (v > 0) mv[key] = String(v);
  }
  mv.hover = Boolean(data.hover);

  // --- Sensi ---
  const ranges = sys.attributes.senses.ranges;
  for (const sense of ['darkvision', 'blindsight', 'tremorsense', 'truesight']) {
    ranges[sense] = Number(data[sense]) || 0;
  }

  // --- Skill: value 0 = niente, 1 = competenza, 2 = expertise ---
  for (const [skillId, level] of Object.entries(data.skills)) {
    if (sys.skills[skillId]) sys.skills[skillId].value = Number(level) || 0;
  }

  // --- Resistenze / immunità / vulnerabilità (con bypasses) e condizioni ---
  Object.assign(sys.traits.dr, splitDamageTrait(data.dr));
  Object.assign(sys.traits.di, splitDamageTrait(data.di));
  Object.assign(sys.traits.dv, splitDamageTrait(data.dv));
  Object.assign(sys.traits.ci, splitKnown(data.ci, CONDITIONS));

  // --- Lingue (+ eventuale telepatia) ---
  Object.assign(sys.traits.languages, splitKnown(data.languages, LANGUAGES));
  const telepathy = Number(data.telepathy) || 0;
  if (telepathy > 0) {
    sys.traits.languages.communication = { telepathy: { value: telepathy, units: 'ft' } };
  }

  // --- Risorse leggendarie ---
  sys.resources.legact.max = Number(data.legact) || 0;
  sys.resources.legres.max = Number(data.legres) || 0;

  // --- Immagini: avatar della scheda e token ---
  // cleanImagePath toglie query/hash dagli URL: Foundry 13 rifiuta
  // l'INTERO import se l'estensione non è valida (visto in collaudo
  // con un URL "...jpg?cors-retry=...").
  const img = cleanImagePath(data.img);
  if (img) actor.img = img;
  const token = actor.prototypeToken;
  token.name = actor.name;
  token.texture.src = cleanImagePath(data.tokenImg) || actor.img;
  const size = SIZES.find(s => s.id === data.size);
  token.width = size ? size.token : 1;
  token.height = size ? size.token : 1;
  // La darkvision del token segue quella della scheda: QoL che in Foundry
  // andrebbe impostata a mano.
  token.sight.range = ranges.darkvision;
  if (ranges.darkvision > 0) token.sight.visionMode = 'darkvision';

  // --- Item embedded: attacchi, azioni, tratti (Fase 2) ---
  actor.items = (data.items || []).map(buildItem);

  return actor;
}

/**
 * Controlli di buon senso prima dell'export: ritorna una lista di
 * avvisi (stringhe). Lista vuota = tutto ok.
 */
export function validateNpc(data) {
  const warnings = [];
  if (!data.name.trim()) warnings.push('Il nome è obbligatorio.');
  if (!Number(data.hpMax)) warnings.push('HP massimi mancanti o pari a 0.');
  if (data.acCalc !== 'default' && !Number(data.acFlat)) {
    warnings.push('Hai scelto CA naturale/fissa ma non hai indicato il valore.');
  }
  // Immagini: Foundry 13 rifiuta l'import se il percorso non termina
  // con un'estensione immagine valida (la query string viene già
  // rimossa dal builder; qui blocchiamo i casi irrecuperabili).
  for (const [field, label] of [['img', 'Avatar'], ['tokenImg', 'Immagine token']]) {
    const p = cleanImagePath(data[field]);
    if (p && !hasValidImageExt(p)) {
      warnings.push(`${label}: "${p}" non termina con un'estensione immagine valida (.webp, .png, .jpg...): Foundry rifiuterebbe l'intero import.`);
    }
  }
  // Validazione delle azioni: nome e formato dei danni.
  for (const item of data.items || []) {
    if (!item.name.trim()) warnings.push('Una delle azioni non ha nome.');
    if ((item.kind === 'attack' || item.kind === 'save') && item.damage.trim()) {
      const { errors } = parseDamageParts(item.damage);
      warnings.push(...errors.map(e => `${item.name || 'Azione'}: ${e}`));
    }
    // Effetti DAE: ogni riga di modifica deve avere sia chiave che valore
    // (il builder scarta in silenzio le righe a metà: meglio avvisare prima).
    for (const eff of item.effects || []) {
      const label = `${item.name || 'Azione'} → effetto "${eff.name || 'senza nome'}"`;
      const rows = eff.changes || [];
      const complete = rows.filter(c => String(c.key || '').trim() && String(c.value ?? '').trim());
      const partial = rows.filter(c => (String(c.key || '').trim() ? !String(c.value ?? '').trim() : String(c.value ?? '').trim()));
      if (partial.length) warnings.push(`${label}: una riga di modifica è incompleta (servono chiave E valore).`);
      if (!complete.length) warnings.push(`${label}: nessuna modifica completa, l'effetto non farebbe nulla.`);
    }
  }
  return warnings;
}
