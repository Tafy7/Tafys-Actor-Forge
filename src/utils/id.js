// Foundry identifica ogni documento embedded (item, effetti, activities)
// con un id alfanumerico di 16 caratteri. Questa funzione replica il formato
// di foundry.utils.randomID(). Nella v0.1 non ci serve ancora (l'actor base
// non ha item), ma è la fondamenta per le Fasi 2 e 3.
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function randomID(length = 16) {
  let id = '';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    id += CHARS[values[i] % CHARS.length];
  }
  return id;
}
