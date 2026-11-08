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
