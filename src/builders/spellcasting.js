// ============================================================
// Builder del blocco "Incantesimi" di un mostro.
//
// Stessa forma dei mostri ufficiali 2024 (Monster Manual): una feature
// "Spellcasting" con un'attività CAST per ogni incantesimo. L'attività punta
// all'incantesimo del compendio di sistema (dnd5e.spells / dnd5e.spells24) e
// dnd5e ne fa la copia sull'actor al primo lancio (la macro del Forge la
// prepara già all'import, come nei mostri ufficiali).
//   a volontà  → nessun consumo
//   N/giorno   → usi sull'attività + consumo "activityUses"
//   a slot     → consumo "spellSlots" del livello dell'incantesimo
// Nessun modulo richiesto.
// ============================================================
import { FEAT_BASE, CAST_ACTIVITY_BASE } from '../data/item-bases.js';
import { applyExtraFlags } from './item.js';
import { parseSpellGroups, resolveSpell } from '../parsers/spellcasting.js';
import { randomID } from '../utils/id.js';
import { cleanImagePath } from '../utils/img.js';
import { descriptionHtml, esc } from '../utils/html.js';

/** Scope dei flag del Forge (solo sulle attività "a slot", li legge la macro). */
export const FORGE_FLAG = 'tafys-actor-forge';

/**
 * `d`: card del form con kind 'spellcasting' — name, description, img,
 * activation, scAbility, scDc, scAttack, scLevel, scNoMaterial, spellList.
 * `rules`: regole del mostro ('2014' | '2024'), per scegliere il compendio.
 * Ritorna l'item; `item._spellReport` NON c'è: usa spellcastingSummary().
 */
export function buildSpellcastingItem(d, rules = '2024') {
  const item = structuredClone(FEAT_BASE);
  item._id = randomID();
  item.name = String(d.name || '').trim() || 'Spellcasting';
  item.system.identifier = item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  // Senza una descrizione scritta a mano, il tratto riporta la lista così
  // com'è (un gruppo per riga), come il testo di uno statblock: sulla scheda
  // si legge cosa sa lanciare anche quando gli incantesimi a slot sono
  // passati nel libro.
  const listed = String(d.spellList || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  item.system.description.value = String(d.description || '').trim() || !listed.length
    ? descriptionHtml(d.description)
    : `<p>${listed.map(esc).join('<br>')}</p>`;
  const img = cleanImagePath(d.img);
  if (img) item.img = img;

  const dc = Number(d.scDc) || null;
  const atk = d.scAttack === '' || d.scAttack == null || Number.isNaN(Number(d.scAttack)) ? null : Number(d.scAttack);
  const activities = {};
  let sort = 0;
  for (const group of parseSpellGroups(d.spellList)) {
    for (const sp of group.spells) {
      const act = structuredClone(CAST_ACTIVITY_BASE);
      act._id = randomID();
      act.sort = (sort += 100);
      act.activation.type = d.activation || 'action';
      const hit = resolveSpell(sp.name, rules);
      act.spell.uuid = hit ? hit.uuid : '';
      // Non trovato nei compendi di sistema: il nome resta sull'attività e
      // la macro del Forge lo cerca negli altri compendi al momento dell'import.
      act.name = hit ? '' : sp.name;
      const base = hit && hit.level > 0 ? hit.level : null;
      act.spell.properties = d.scNoMaterial ? ['material'] : [];
      // Vuota = quella dell'actor (attributes.spellcasting), come nei mostri ufficiali.
      act.spell.ability = d.scAbility || '';
      // CD / attacco scritti nello statblock: valgono anche se la matematica
      // dell'homebrew non torna con caratteristica + competenza.
      act.spell.challenge = { attack: atk, save: dc, override: Boolean(dc || atk !== null) };
      const cantrip = Boolean(hit && hit.level === 0);
      if (group.mode === 'slots' && !cantrip) {
        // Incantatore "a slot" (2014): lanciarlo consuma uno slot del suo
        // livello (o di uno più alto, a scelta nella finestra di Foundry).
        // La macro del Forge, all'import, lo trasforma in un incantesimo
        // "vero" nel libro, come nei mostri ufficiali 2014: il flag dice
        // quali attività sono nate così.
        const lv = Math.max(group.level || 1, base || 0, sp.castLevel || 0);
        act.spell.level = lv;
        act.consumption.scaling = { allowed: true, max: '' };
        act.consumption.targets = [{ type: 'spellSlots', value: '1', target: String(lv), scaling: { mode: 'level', formula: '' } }];
        act.flags = { [FORGE_FLAG]: { slot: true } };
      } else {
        act.spell.level = sp.castLevel || base;
        if (group.mode === 'day') {
          // Gli usi stanno sull'attività E vanno dichiarati come consumo:
          // senza il bersaglio "activityUses" Foundry non li mostra né li scala.
          act.uses = { spent: 0, max: String(group.uses), recovery: [{ period: 'day', type: 'recoverAll' }] };
          act.consumption.targets = [{ type: 'activityUses', value: '1', target: '', scaling: { mode: '', formula: '' } }];
        }
      }
      activities[act._id] = act;
    }
  }
  item.system.activities = activities;
  return applyExtraFlags(item, d);
}

/** Riepilogo per la UI: [{ name, group, found, rules, level }]. */
export function spellcastingSummary(spellList, rules = '2024') {
  const out = [];
  for (const group of parseSpellGroups(spellList)) {
    for (const sp of group.spells) {
      const hit = resolveSpell(sp.name, rules);
      out.push({ name: sp.name, found: Boolean(hit), rules: hit?.rules || '', level: hit ? hit.level : null, srdName: hit?.name || '' });
    }
  }
  return out;
}
