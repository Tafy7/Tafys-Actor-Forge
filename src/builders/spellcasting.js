// ============================================================
// Builder del blocco "Incantesimi" di un mostro.
//
// Stessa forma dei mostri ufficiali 2024 (Monster Manual): una feature
// "Spellcasting" con un'attività CAST per ogni incantesimo. L'attività punta
// all'incantesimo del compendio di sistema (dnd5e.spells / dnd5e.spells24) e
// dnd5e, quando il mostro viene creato, ne fa da solo la copia sull'actor.
// Gli usi "N al giorno" stanno sull'attività. Nessun modulo richiesto.
// ============================================================
import { FEAT_BASE, CAST_ACTIVITY_BASE } from '../data/item-bases.js';
import { applyExtraFlags } from './item.js';
import { parseSpellGroups, resolveSpell } from '../parsers/spellcasting.js';
import { randomID } from '../utils/id.js';
import { cleanImagePath } from '../utils/img.js';
import { descriptionHtml } from '../utils/html.js';

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
  item.system.description.value = descriptionHtml(d.description);
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
      act.spell.level = sp.castLevel || (hit && hit.level > 0 ? hit.level : null);
      act.spell.properties = d.scNoMaterial ? ['material'] : [];
      act.spell.ability = d.scAbility || '';
      // CD / attacco scritti nello statblock: valgono anche se la matematica
      // dell'homebrew non torna con caratteristica + competenza.
      act.spell.challenge = { attack: atk, save: dc, override: Boolean(dc || atk !== null) };
      if (group.mode === 'day') {
        act.uses = { spent: 0, max: String(group.uses), recovery: [{ period: 'day', type: 'recoverAll' }] };
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
