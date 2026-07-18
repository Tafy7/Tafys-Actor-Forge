// ============================================================
// Validatore strutturale — Fase 5.
//
// Se validateNpc() (in npc.js) controlla il FORM (hai messo il nome? gli
// HP? il formato dei danni?), questo controlla il RISULTATO: il JSON
// dell'actor già costruito, confrontandolo con lo schema dei golden
// template. È la rete di sicurezza che applica la regola d'oro del
// progetto — "mai inventare lo schema, copiarlo" — e intercetta i guai
// che in Foundry sono invisibili finché non giochi:
//
//  1. CHIAVI ESTRANEE  — un campo che i golden non hanno (bug del builder,
//     refuso): Foundry potrebbe rifiutarlo o ignorarlo in silenzio.
//  2. RIFERIMENTI PENDENTI — un'attività che punta (otherActivityId) a
//     un'attività inesistente, o un effetto referenziato che non esiste:
//     l'automazione non parte e non te ne accorgi finché non tiri.
//  3. IMMAGINI NON VALIDE — percorso senza estensione: import rifiutato
//     (la lezione dell'URL con ?query).
//  4. ID MALFORMATI — non nel formato a 16 caratteri di Foundry.
//
// Ritorna un array di { level: 'error'|'warn', msg }. `error` blocca
// l'export; `warn` è solo un avviso.
// ============================================================
import { NPC_BASE } from '../data/npc-base.js';
import { WEAPON_BASE, FEAT_BASE, ACTIVITY_BASES, EFFECT_BASE } from '../data/item-bases.js';
import { hasValidImageExt } from '../utils/img.js';

const ID_RE = /^[a-zA-Z0-9]{16}$/;
const CHANGE_KEYS_ALLOWED = ['key', 'mode', 'value', 'priority'];

/**
 * Sanity check di una formula di roll (HP, bonus di danno...). Non è un
 * parser completo di Foundry: rimuove tutti i token LECITI e, se resta
 * qualcosa di diverso da spazi/operatori, la considera sospetta.
 * Riconosce: dadi (2d6, 1d20kh1...), numeri, riferimenti (@mod, @prof,
 * @abilities.str.mod), funzioni (floor/ceil/round/min/max/abs),
 * operatori e parentesi. Una formula VUOTA è lecita (campo opzionale).
 * Esempio catturato: "16d10 + aa64a" → resta "aa a" → sospetta.
 */
export function looksLikeValidFormula(formula) {
  const f = String(formula ?? '').trim();
  if (!f) return true;
  const cleaned = f
    .replace(/\d+\s*d\s*\d+(\s*(kh|kl|dh|dl|rr?|xo?|min|max)\d*)*/gi, ' ') // dadi + modificatori
    .replace(/@[\w.]+/g, ' ')                       // riferimenti @mod, @prof...
    .replace(/\b(floor|ceil|round|abs|min|max)\b/gi, ' ') // funzioni
    .replace(/\d+(\.\d+)?/g, ' ')                   // numeri
    .replace(/[+\-*/%(),]/g, ' ')                   // operatori e parentesi
    .trim();
  return cleaned === '';
}

/** Chiavi di `obj` che NON esistono in `base` (stesso livello). */
function extraKeys(obj, base) {
  if (!obj || !base || typeof obj !== 'object') return [];
  return Object.keys(obj).filter(k => !(k in base));
}

/**
 * Valida l'actor costruito da buildNpc(). `actor` è l'oggetto JSON finale.
 * Non lancia mai: raccoglie e ritorna la lista dei problemi.
 */
export function validateActor(actor) {
  const issues = [];
  const err = (msg) => issues.push({ level: 'error', msg });
  const warn = (msg) => issues.push({ level: 'warn', msg });

  if (!actor || typeof actor !== 'object') {
    err('Actor non valido (oggetto mancante).');
    return issues;
  }

  // --- 1) Schema drift alla radice e in system (vs golden NPC_BASE) ---
  for (const k of extraKeys(actor, NPC_BASE)) {
    err(`Chiave estranea alla radice dell'actor: "${k}" (non esiste nei golden template).`);
  }
  for (const k of extraKeys(actor.system, NPC_BASE.system)) {
    err(`Chiave estranea in system: "${k}".`);
  }

  // --- Formula HP: un refuso non blocca l'import (il max è un numero a
  //     parte) ma fa fallire il tiro degli HP in Foundry → avviso. ---
  const hpFormula = actor.system?.attributes?.hp?.formula;
  if (hpFormula && !looksLikeValidFormula(hpFormula)) {
    warn(`Formula HP sospetta: "${hpFormula}" non sembra una formula di dadi valida.`);
  }

  // --- Id e immagini dell'actor ---
  if (actor._id && !ID_RE.test(actor._id)) warn(`_id dell'actor non nel formato a 16 caratteri: "${actor._id}".`);
  for (const [path, label] of [[actor.img, 'Avatar'], [actor.prototypeToken?.texture?.src, 'Token']]) {
    if (path && !hasValidImageExt(path)) {
      err(`${label}: "${path}" non ha un'estensione immagine valida — Foundry rifiuterebbe l'import.`);
    }
  }

  // --- 2) Item embedded ---
  for (const item of actor.items || []) {
    const tag = `Item "${item.name || '?'}"`;
    const base = item.type === 'weapon' ? WEAPON_BASE : FEAT_BASE;

    for (const k of extraKeys(item, base)) err(`${tag}: chiave estranea "${k}".`);
    for (const k of extraKeys(item.system, base.system)) err(`${tag}: chiave estranea in system "${k}".`);
    if (item._id && !ID_RE.test(item._id)) warn(`${tag}: _id malformato.`);
    if (item.img && !hasValidImageExt(item.img)) err(`${tag}: icona "${item.img}" senza estensione valida.`);

    // Id di attività ed effetti presenti su QUESTO item: servono per
    // controllare i riferimenti incrociati.
    const activities = item.system?.activities || {};
    const activityIds = new Set(Object.keys(activities));
    const effectIds = new Set((item.effects || []).map(e => e._id));

    // Effetti: chiavi vs EFFECT_BASE + changes ben formate.
    for (const eff of item.effects || []) {
      for (const k of extraKeys(eff, EFFECT_BASE)) warn(`${tag} → effetto "${eff.name || '?'}": chiave estranea "${k}".`);
      for (const c of eff.changes || []) {
        const bad = Object.keys(c).filter(k => !CHANGE_KEYS_ALLOWED.includes(k));
        if (bad.length) warn(`${tag} → effetto "${eff.name}": riga di modifica con chiavi impreviste (${bad.join(', ')}).`);
        if (!String(c.key || '').trim()) warn(`${tag} → effetto "${eff.name}": una modifica ha la chiave vuota.`);
      }
    }

    // --- 3) Riferimenti incrociati: il cuore del validatore ---
    for (const [actId, act] of Object.entries(activities)) {
      const base2 = ACTIVITY_BASES[act.type];
      if (base2) {
        for (const k of extraKeys(act, base2)) warn(`${tag} → attività "${act.type}": chiave estranea "${k}".`);
      }
      // otherActivityId (es. il rider del "morso di lupo") deve puntare a
      // un'attività che esiste davvero su questo item.
      const other = act.otherActivityId;
      if (other && other !== 'none' && other !== '' && !activityIds.has(other)) {
        err(`${tag}: l'attività "${actId}" punta a otherActivityId "${other}" che non esiste (automazione rotta).`);
      }
      // Ogni effetto referenziato dall'attività deve esistere in item.effects.
      for (const ref of act.effects || []) {
        if (ref._id && !effectIds.has(ref._id)) {
          err(`${tag}: l'attività "${actId}" referenzia un effetto ("${ref._id}") che non è tra gli effetti dell'item.`);
        }
      }
      // Bonus di danno malformati (stessa logica della formula HP).
      for (const part of act.damage?.parts || []) {
        if (part.bonus && !looksLikeValidFormula(part.bonus)) {
          warn(`${tag} → attività "${actId}": bonus di danno sospetto "${part.bonus}".`);
        }
      }
    }
  }

  return issues;
}
