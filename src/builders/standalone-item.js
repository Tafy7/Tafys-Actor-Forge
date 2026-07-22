// ============================================================
// Builder di Item STANDALONE (Tab Item, Fase 6).
//
// Un item embedded in un mostro E un item singolo sono LO STESSO oggetto:
// la differenza è solo che qui lo esportiamo da solo. Quindi riusiamo la
// logica già collaudata di buildItem() (attività, danni, condizioni,
// effetti DAE, usi) e la "trapiantiamo" sulla base del tipo giusto
// (weapon / equipment / consumable / feat), aggiungendo i metadati da
// oggetto magico (rarità, sintonia, magico, valore armatura).
// ============================================================
import { WEAPON_BASE, FEAT_BASE, EQUIPMENT_BASE, CONSUMABLE_BASE } from '../data/item-bases.js';
import { WEAPON_TYPES, WEAPON_MASTERIES } from '../data/constants.js';
import { buildItem, parseDamageParts } from './item.js';
import { buildAAFlags } from './aa.js';
import { randomID } from '../utils/id.js';
import { cleanImagePath } from '../utils/img.js';

const BASES = { weapon: WEAPON_BASE, equipment: EQUIPMENT_BASE, consumable: CONSUMABLE_BASE, feat: FEAT_BASE };
export const RARITIES = ['', 'common', 'uncommon', 'rare', 'veryRare', 'legendary', 'artifact'];
export const ATTUNEMENTS = ['', 'required', 'optional'];

/**
 * `d` (descrittore dal form della Tab Item):
 *   { itemType: 'weapon'|'equipment'|'consumable'|'feat',
 *     name, description, img, rarity, attunement, magical, armorValue,
 *     ...e i campi comportamentali riusati da buildItem:
 *       kind, activation, attackType, ability, reach, range, longRange,
 *       damage, saveAbility, dc, onSave, onHit, condition, condRounds,
 *       riderSaveAbility, riderDc, usesMode, usesValue, effects[] }
 */
export function buildStandaloneItem(d) {
  const type = BASES[d.itemType] ? d.itemType : 'weapon';
  // 1) Comportamento (attività + effetti + usi) con la logica esistente.
  const behavior = buildItem({ ...d });

  // 2) Base del tipo scelto.
  const item = structuredClone(BASES[type]);
  item._id = randomID();
  item.name = (d.name || '').trim() || 'Senza nome';
  item.system.identifier = item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const img = cleanImagePath(d.img);
  if (img) item.img = img;
  item.system.description.value = d.description ? `<p>${d.description}</p>` : '';

  // 3) Trapianto del comportamento (chiavi presenti in TUTTE le basi item).
  item.system.activities = behavior.system.activities || {};
  item.system.uses = behavior.system.uses;
  item.effects = behavior.effects || [];

  // 4) Metadati da oggetto magico — SOLO per i tipi che li hanno nello
  // schema: la FEAT_BASE (golden) NON ha rarity/attunement/unidentified,
  // aggiungerli sarebbe schema drift.
  if (type !== 'feat') {
    item.system.rarity = RARITIES.includes(d.rarity) ? (d.rarity || '') : '';
    item.system.attunement = ATTUNEMENTS.includes(d.attunement) ? (d.attunement || '') : '';
    // Descrizione da oggetto NON identificato (quello che si legge finché
    // l'oggetto è "non identificato" in Foundry).
    item.system.unidentified = { description: d.unidentified ? `<p>${d.unidentified}</p>` : '' };
  }
  const props = new Set(item.system.properties || []);
  if (d.magical) props.add('mgc'); else props.delete('mgc');
  // Argentata / adamantina: proprietà che bypassano resistenze (sil/ada);
  // l'adamantio su un'armatura fa trattare i critici come colpi normali.
  if (d.silvered) props.add('sil'); else props.delete('sil');
  if (d.adamantine) props.add('ada'); else props.delete('ada');
  item.system.properties = [...props];

  // Source personalizzata (es. "DMG p.94"): chiavi presenti in tutte le basi.
  item.system.source.book = String(d.sourceBook || '').trim();
  item.system.source.page = String(d.sourcePage || '').trim();

  // 5) Campi specifici del tipo.
  if (type === 'weapon') {
    item.system.range = behavior.system.range;

    // Tipo d'arma base + categoria (system.type.value: simpleM/martialM/…).
    // Scegliendo l'arma base, Foundry conosce competenza e mastery ammesse.
    const wt = WEAPON_TYPES.find(w => w.id === d.weaponBase);
    item.system.type = { value: wt ? wt.cat : 'natural', baseItem: wt && wt.id ? wt.id : '' };

    // Bonus magico (+1/+2/+3): il sistema lo somma AUTOMATICAMENTE a tiro
    // per colpire e danno — non va messo a mano nei parametri d'attacco.
    const mb = Number(d.magicalBonus);
    item.system.magicalBonus = mb ? String(mb) : '';

    // Maestria d'arma (2024). Con regole 2014 il sistema la ignora da solo.
    item.system.mastery = WEAPON_MASTERIES.includes(d.mastery) ? (d.mastery || '') : '';

    // Danno base dell'arma → system.damage.base (come il golden Battleaxe):
    // la PRIMA parte di danno è il dado base dell'arma; le parti EXTRA (es.
    // +2d6 fire di una lama fiammeggiante) restano nell'activity. Con
    // includeBase:true l'attacco somma base + mod + magicalBonus + extra.
    const atk = Object.values(item.system.activities).find(a => a.type === 'attack');
    if (atk && Array.isArray(atk.damage?.parts) && atk.damage.parts.length) {
      const [first, ...rest] = atk.damage.parts;
      item.system.damage.base = {
        number: first.number ?? null,
        denomination: first.denomination ?? null,
        bonus: first.bonus || '',
        types: first.types || [],
        // Se la prima parte era una formula composta (custom), la formula
        // deve seguire il danno base, non andare persa.
        custom: first.custom?.enabled
          ? { enabled: true, formula: first.custom.formula || '' }
          : { enabled: false, formula: '' },
        scaling: { mode: '', number: null, formula: '' },
      };
      atk.damage.parts = rest;
      atk.damage.includeBase = true;
    }
  } else if (type === 'equipment' && Number(d.armorValue) > 0) {
    item.system.armor = { value: Number(d.armorValue), dex: null };
  } else if (type === 'feat') {
    // Feature di CLASSE o di MOSTRO (golden: Bladesong/Sneak Attack = class,
    // tratti dei golden actor = monster) + requisiti ("Barbarian 9").
    item.system.type = { value: d.featType === 'class' ? 'class' : 'monster', subtype: '' };
    item.system.requirements = String(d.requirements || '').trim();
  }

  // 6) Animazione Automated Animations (facoltativa, Fase 7).
  const aaFlag = buildAAFlags(d.aa, item.name);
  if (aaFlag) item.flags = { ...item.flags, autoanimations: aaFlag };
  return item;
}

/** Controlli minimi prima dell'export di un item standalone. */
export function validateStandaloneItem(d) {
  const w = [];
  if (!String(d.name || '').trim()) w.push('Il nome dell\'oggetto è obbligatorio.');
  const img = cleanImagePath(d.img);
  if (img && !/\.(apng|avif|bmp|gif|jpe?g|png|svg|tiff|webp)$/i.test(img)) {
    w.push(`Immagine "${img}": estensione non valida (Foundry rifiuterebbe l'import).`);
  }
  // Danni: gli errori del parser bloccano l'export (una parte malformata
  // verrebbe scartata in silenzio e l'oggetto uscirebbe senza danno).
  if ((d.kind === 'attack' || d.kind === 'save') && String(d.damage || '').trim()) {
    w.push(...parseDamageParts(d.damage).errors);
  }
  return w;
}
