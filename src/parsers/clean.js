// ============================================================
// Pulizia dei documenti RICARICATI da Foundry (round-trip).
//
// Prima di ri-esportare un documento che arriva da un altro mondo togliamo
// ciò che lo lega a quel mondo (statistiche interne, permessi, cartella,
// riferimenti al compendio d'origine), le immagini che altrove non
// esisterebbero e i dati dei moduli che il Forge non usa. Usato dal
// round-trip di oggetti/incantesimi e dei mostri.
// ============================================================

/**
 * Immagini PORTABILI: il JSON del Forge deve funzionare in qualsiasi mondo.
 * Un percorso dentro `modules/…` esiste solo dove quel modulo è installato, e
 * un indirizzo web esterno spesso viene da importatori o siti di terze parti
 * (e in mappa può non vedersi per il CORS). Al round-trip li togliamo, li
 * contiamo e lo diciamo nel resoconto: l'utente sceglie un'immagine sua
 * (icons/…, systems/…, worlds/… o una cartella dei suoi dati).
 */
const FOREIGN_IMG = /^\s*(?:(?:https?:)?\/\/|\/?modules\/)/i;
export function portableImg(src, report) {
  const s = String(src || '').trim();
  if (!s) return '';
  if (FOREIGN_IMG.test(s)) { report.droppedImgs = (report.droppedImgs || 0) + 1; return ''; }
  return s;
}

/**
 * Flag che il Forge conserva: sistema, core e i moduli d'automazione
 * con cui lavora (Midi-QOL, DAE e compagni, Active Auras, A-A, Sequencer,
 * Item Piles, premade di automazione). Tutto il resto (fogli, importatori,
 * strumenti di terze parti) viene tolto: il JSON del Forge deve restare
 * pulito e portabile. Elenco "chi resta", mai "chi va via".
 */
const KEEP_FLAGS = new Set([
  'dnd5e', 'core', 'midi-qol', 'midiProperties', 'dae', 'times-up', 'effectmacro',
  'ActiveAuras', 'autoanimations', 'sequencer', 'item-piles', 'itemacro',
  'chris-premades', 'gambits-premades', 'walledtemplates',
]);

// Riferimento SEGNAPOSTO: un UUID di compendio con id tutto a zeri non punta a
// nessun documento (lo usano alcuni strumenti esterni per i "finti" link).
const PLACEHOLDER_UUID = /^Compendium\.[^\s\]]*\.0{16}$/;
const PLACEHOLDER_LINK = /@UUID\[Compendium\.[^\]\s]*\.0{16}\](?:\{([^}]*)\})?/g;

/** Testo HTML: i link segnaposto diventano il loro testo (o spariscono). */
function cleanText(html, report) {
  if (typeof html !== 'string' || !html.includes('0000000000000000')) return html;
  return html.replace(PLACEHOLDER_LINK, (_, label) => { report.droppedRefs = (report.droppedRefs || 0) + 1; return label || ''; });
}

/** Attività: profili di evocazione/trasformazione con riferimenti segnaposto. */
function cleanActivity(act, report) {
  if (act.flags) act.flags = cleanFlags(act.flags, report);
  for (const p of act.profiles || []) {
    if (p && PLACEHOLDER_UUID.test(String(p.uuid || ''))) { p.uuid = ''; report.droppedRefs = (report.droppedRefs || 0) + 1; }
  }
}

function cleanFlags(flags, report) {
  if (!flags || typeof flags !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(flags)) {
    if (KEEP_FLAGS.has(k)) out[k] = v;
    else report.droppedFlags = (report.droppedFlags || 0) + 1;
  }
  // core.sourceId: vecchio riferimento al compendio d'origine (oggi sta in
  // _stats, che togliamo): legava il JSON a un compendio di un altro mondo.
  if (out.core && 'sourceId' in out.core) {
    out.core = { ...out.core };
    delete out.core.sourceId;
    if (!Object.keys(out.core).length) delete out.core;
  }
  return out;
}

/**
 * Copia dell'originale pronta per essere ri-esportata: via i dati legati al
 * mondo d'origine (_stats, permessi, cartella, ordinamento), flag filtrati,
 * immagini portabili (come per i mostri).
 */
export function cleanSource(doc, report, { embedded = false } = {}) {
  const src = structuredClone(doc);
  delete src._stats; delete src.ownership; delete src.folder;
  if (!embedded) delete src.sort; // dentro un actor l'ordine delle voci sulla scheda conta
  src.flags = cleanFlags(src.flags, report);
  const img = portableImg(src.img, report);
  if (img) src.img = img; else delete src.img; // Foundry mette l'icona di default
  for (const act of Object.values(src.system?.activities || {})) {
    if (act) cleanActivity(act, report);
  }
  if (src.system?.description) src.system.description.value = cleanText(src.system.description.value, report);
  src.effects = (src.effects || []).map((e) => {
    const eff = { ...e, flags: cleanFlags(e.flags, report), origin: null };
    delete eff._stats;
    const eimg = portableImg(eff.img, report);
    eff.img = eimg || 'icons/svg/aura.svg';
    return eff;
  });
  return src;
}


/**
 * Actor (mostro) ricaricato: stessa pulizia per l'actor, il suo token, i
 * suoi effetti e ogni voce che contiene (attacchi, tratti, incantesimi…).
 */
export function cleanActorSource(actor, report) {
  const src = structuredClone(actor);
  delete src._stats; delete src.ownership; delete src.folder; delete src.sort;
  src.flags = cleanFlags(src.flags, report);
  const img = portableImg(src.img, report);
  if (img) src.img = img; else delete src.img;
  if (src.prototypeToken) {
    const tok = src.prototypeToken;
    tok.flags = cleanFlags(tok.flags, report);
    if (tok.ring?.subject?.texture) {
      // Anello dinamico del token: anche la sua immagine deve essere portabile.
      tok.ring.subject.texture = portableImg(tok.ring.subject.texture, report) || null;
    }
    if (tok.texture?.src) {
      const t = portableImg(tok.texture.src, report);
      tok.texture = { ...tok.texture, src: t || src.img || 'icons/svg/mystery-man.svg' };
    }
  }
  src.effects = (src.effects || []).map((e) => {
    const eff = { ...e, flags: cleanFlags(e.flags, report), origin: null };
    delete eff._stats;
    eff.img = portableImg(eff.img, report) || 'icons/svg/aura.svg';
    return eff;
  });
  if (src.system?.details?.biography) src.system.details.biography.value = cleanText(src.system.details.biography.value, report);
  src.items = (src.items || []).map((it) => cleanSource(it, report, { embedded: true }));
  return src;
}
