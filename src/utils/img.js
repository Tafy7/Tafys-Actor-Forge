// ============================================================
// Percorsi immagine — lezione dal collaudo del 18/07.
//
// Foundry 13 VALIDA le estensioni: un actor con img o token che non
// terminano in .webp/.png/.jpg/... viene rifiutato in blocco all'import
// (DataModelValidationError: "does not have a valid file extension").
// Un URL tipo "...jpg?cors-retry=123" per Foundry NON finisce in .jpg:
// finisce nella query string. Quindi: puliamo sempre query e hash, e
// la validazione blocca l'export se l'estensione resta invalida.
// ============================================================

// Estensioni immagine accettate da Foundry (CONST.IMAGE_FILE_EXTENSIONS).
const IMAGE_EXT_RE = /\.(apng|avif|bmp|gif|jpeg|jpg|png|svg|tiff|webp)$/i;

/**
 * Normalizza un percorso/URL immagine: trim + rimozione di query
 * string e hash ("...jpg?cors-retry=123" → "...jpg").
 */
export function cleanImagePath(path) {
  return String(path || '').trim().split(/[?#]/)[0];
}

/** True se il percorso (già pulito) ha un'estensione immagine valida. */
export function hasValidImageExt(path) {
  return IMAGE_EXT_RE.test(cleanImagePath(path));
}
