// ============================================================
// Descrizioni: testo semplice o HTML?
//
// Il form accetta testo semplice (lo avvolgiamo in un paragrafo) ma un
// oggetto ricaricato da Foundry porta la sua descrizione in HTML (elenchi,
// tabelle, riferimenti @UUID…). Se il testo COMINCIA con un tag lo
// lasciamo intatto, così il round-trip non lo appiattisce.
// ============================================================
export function descriptionHtml(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  return /^<[a-z!]/i.test(s) ? s : `<p>${s}</p>`;
}

/**
 * Testo → HTML sicuro, per tutto ciò che finisce in innerHTML (contenuto di
 * un elemento, di una <textarea> o valore di un attributo). I dati del form
 * possono arrivare da un JSON importato, cioè da chi l'ha scritto: senza
 * questo passaggio una descrizione con "</textarea><img onerror=…>" verrebbe
 * eseguita come codice. Si scappa anche "&", così ciò che si vede nel campo
 * è esattamente ciò che c'è nei dati ("&amp;" resta "&amp;").
 */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}
