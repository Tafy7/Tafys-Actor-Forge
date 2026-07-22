// ============================================================
// Builder di Incantesimi STANDALONE (Tab Spell, Fase 6).
//
// Regola d'oro: schema copiato dai 12 incantesimi REALI embedded nei
// golden actor (Fireball, Ray of Sickness, Invisibility, Detect Magic,
// Blade Barrier, Wall of Fire…). Da lì arrivano i dettagli che contano:
//  - save.dc = { calculation: 'spellcasting' } → la CD si calcola DA SOLA
//    dalla caratteristica da incantatore di chi possiede la spell;
//  - attack.type.classification = 'spell' + ability '' → il tiro per
//    colpire usa il bonus da incantatore, non FOR/DES;
//  - scaling { mode: 'whole', formula: '1d6' } → upcast automatico
//    (+X dadi per ogni slot sopra il livello base, come Fireball);
//  - properties = componenti (vocal/somatic/material) + concentration
//    + ritual, tutti osservati nei golden.
// Il COMPORTAMENTO (attività, danni, condizioni, effetti DAE, usi) è
// riusato da buildItem() e trapiantato sulla SPELL_BASE, come per la
// Tab Item: un incantesimo e un'azione di mostro sono la stessa
// meccanica, cambia solo la "carrozzeria".
// ============================================================
import { SPELL_BASE } from '../data/item-bases.js';
import { buildItem, parseDamageParts, applyExtraFlags } from './item.js';
import { randomID } from '../utils/id.js';
import { cleanImagePath } from '../utils/img.js';

// Scuole di magia (id dnd5e a 3 lettere; evo/abj/nec/trs/div/ill osservate
// nei golden, con/enc sono gli id standard delle due mancanti).
export const SPELL_SCHOOLS = ['abj', 'con', 'div', 'enc', 'evo', 'ill', 'nec', 'trs'];

// Metodo di lancio (system.method): 'innate' osservato nei golden di mostri,
// 'spell' CONFERMATO dagli export utente di spell da PG (Polymorph, Meteor
// Swarm, Silvery Barbs… tutti method:'spell').
export const CAST_METHODS = ['spell', 'innate', 'atwill', 'pact'];

// Sagome area: sphere/wall/self osservate nei golden; le altre sono gli
// id standard delle sagome dnd5e (cono, cubo, linea, cilindro, raggio).
export const TEMPLATE_TYPES = ['sphere', 'cone', 'cube', 'line', 'wall', 'cylinder', 'radius'];

// Unità di durata: inst/minute/hour osservate; round e day id standard.
export const DURATION_UNITS = ['inst', 'round', 'minute', 'hour', 'day'];

/**
 * `d` (descrittore dal form della Tab Spell):
 *   { name, img, description, rules, level, school,
 *     vocal, somatic, material, materialText, materialConsumed,
 *     concentration, ritual, method,
 *     activation, castValue, rangeMode('ft'|'touch'|'self'), rangeValue,
 *     targetMode(''|'creature'|'template'|'self'), targetCount,
 *     templateType, templateSize, durationValue, durationUnits,
 *     ...campi comportamentali di buildItem: kind('attack'|'save'|'utility'),
 *     attackType, damage, dcMode('spellcasting'|'flat'), dc, onSave,
 *     condition, condRounds, upcastFormula, usesMode, usesValue, effects[] }
 */
export function buildSpell(d) {
  // 1) Comportamento con la logica già collaudata (attività+effetti+usi).
  const behavior = buildItem({ ...d, kind: d.kind || 'utility' });

  // 2) Base golden.
  const item = structuredClone(SPELL_BASE);
  item._id = randomID();
  item.name = (d.name || '').trim() || 'Senza nome';
  item.system.identifier = item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const img = cleanImagePath(d.img);
  if (img) item.img = img;
  item.system.description.value = d.description ? `<p>${d.description}</p>` : '';
  item.system.source.rules = d.rules === '2024' ? '2024' : '2014';
  // Source personalizzata (come "PHB'14 p.241" dei golden): book + page.
  item.system.source.book = String(d.sourceBook || '').trim();
  item.system.source.page = String(d.sourcePage || '').trim();

  // 3) Identità dell'incantesimo.
  item.system.level = Math.max(0, Math.min(9, Number(d.level) || 0));
  item.system.school = SPELL_SCHOOLS.includes(d.school) ? d.school : 'evo';
  const props = [];
  if (d.vocal) props.push('vocal');
  if (d.somatic) props.push('somatic');
  if (d.material) props.push('material');
  if (d.concentration) props.push('concentration');
  if (d.ritual) props.push('ritual');
  item.system.properties = props;
  item.system.materials = {
    value: d.material ? String(d.materialText || '') : '',
    consumed: Boolean(d.material && d.materialConsumed),
    cost: 0, supply: 0,
  };
  item.system.method = CAST_METHODS.includes(d.method) ? d.method : 'innate';

  // 4) Lancio, gittata, bersaglio, durata.
  item.system.activation = {
    type: d.activation || 'action',
    value: d.activation === 'minute' ? (Number(d.castValue) || 1) : 1,
    condition: '',
  };
  // Gittata: come i golden — ft con valore, self/touch con value '0'
  // (Invisibility), oppure miglia (Meteor Swarm: {value:'1', units:'mi'}).
  if (d.rangeMode === 'self' || d.rangeMode === 'touch') {
    item.system.range = { value: '0', units: d.rangeMode, special: '' };
  } else if (d.rangeMode === 'mi') {
    item.system.range = { value: String(Number(d.rangeValue) || 1), units: 'mi', special: '' };
  } else {
    item.system.range = { value: String(Number(d.rangeValue) || 30), units: 'ft', special: '' };
  }
  // Bersaglio: creature contate (Ray of Sickness), sagoma (Fireball sphere
  // 20ft), se stesso (Detect Magic), o niente.
  const tgt = item.system.target;
  if (d.targetMode === 'template' && TEMPLATE_TYPES.includes(d.templateType)) {
    tgt.template.type = d.templateType;
    tgt.template.size = String(Number(d.templateSize) || 10);
  } else if (d.targetMode === 'creature') {
    tgt.affects.type = 'creature';
    tgt.affects.count = String(d.targetCount || '').trim();
  } else if (d.targetMode === 'self') {
    tgt.affects.type = 'self';
  }
  item.system.duration = {
    value: d.durationUnits === 'inst' ? '' : String(Number(d.durationValue) || ''),
    units: DURATION_UNITS.includes(d.durationUnits) ? d.durationUnits : 'inst',
  };

  // 5) Trapianto del comportamento.
  item.system.activities = behavior.system.activities || {};
  item.system.uses = behavior.system.uses;
  item.effects = behavior.effects || [];

  // 6) Ritocchi da incantesimo sulle attività (pattern dei golden).
  for (const act of Object.values(item.system.activities)) {
    if (act.type === 'attack') {
      // Tiro per colpire da incantatore: ability vuota + classification
      // 'spell' (Ray of Sickness). melee/ranged resta dal form.
      act.attack.ability = '';
      act.attack.type.classification = 'spell';
    }
    if (act.type === 'save' && act.save) {
      if (d.dcMode !== 'flat') {
        // CD automatica dalla caratteristica da incantatore (TUTTI i golden
        // save spell usano calculation:'spellcasting' con formula vuota).
        act.save.dc = { calculation: 'spellcasting', formula: '' };
      }
      // dcMode 'flat': buildItem ha già scritto la CD fissa nel formula.
    }
    // Upcast: +formula dadi per ogni slot sopra il livello base
    // (Fireball: scaling {mode:'whole', number:null, formula:'1d6'}).
    // SOLO sulla PRIMA parte di danno: dnd5e applica la scala a OGNI parte
    // che la dichiara, quindi metterla su tutte significherebbe +1d8 per
    // TIPO di danno a ogni slot (comportamento segnalato dall'utente).
    // Nei golden multi-parte (Meteor Swarm) le parti non scalano affatto.
    const up = String(d.upcastFormula || '').trim();
    if (up && act.damage && Array.isArray(act.damage.parts) && act.damage.parts.length) {
      act.damage.parts[0].scaling = { mode: 'whole', number: null, formula: up };
    }
  }

  // 7) Flag opzionali: animazione A-A + On-Use Macros (Fase 7).
  return applyExtraFlags(item, d);
}

/** Controlli minimi prima dell'export di un incantesimo. */
export function validateSpell(d) {
  const w = [];
  if (!String(d.name || '').trim()) w.push('Il nome dell\'incantesimo è obbligatorio.');
  const img = cleanImagePath(d.img);
  if (img && !/\.(apng|avif|bmp|gif|jpe?g|png|svg|tiff|webp)$/i.test(img)) {
    w.push(`Immagine "${img}": estensione non valida (Foundry rifiuterebbe l'import).`);
  }
  const up = String(d.upcastFormula || '').trim();
  if (up && !/^\d+d\d+$/i.test(up)) {
    w.push(`Upcast "${up}": usa il formato NdX (es. 1d6 = +1d6 per slot superiore).`);
  }
  // Danni: gli errori del parser (tipo mancante, formula rotta) BLOCCANO
  // l'export — altrimenti la parte viene scartata in silenzio e l'incantesimo
  // esce senza danno (bug segnalato dall'utente sulla spell di prova).
  if ((d.kind === 'attack' || d.kind === 'save') && String(d.damage || '').trim()) {
    w.push(...parseDamageParts(d.damage).errors);
  }
  return w;
}
