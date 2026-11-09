// ============================================================
// Bozza automatica delle tab Oggetto e Incantesimo.
//
// Come la tab Mostro: lo stato del form (più l'eventuale originale
// ricaricato da JSON) finisce in localStorage a ogni modifica, con un
// piccolo ritardo per non scrivere a ogni tasto. Ricaricando la pagina si
// riparte da dove si era. Il salvataggio può fallire (storage pieno o
// disattivato, finestra anonima): in quel caso il Forge funziona lo stesso.
// ============================================================
export function draftStore(key) {
  let timer;
  return {
    /** Bozza salvata, oppure null. */
    load() {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v && typeof v === 'object' ? v : null;
      } catch { return null; }
    },
    /** Salva tra poco; `snapshot` viene letto al momento del salvataggio. */
    save(snapshot) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { localStorage.setItem(key, JSON.stringify(snapshot())); } catch { /* storage pieno o disattivato */ }
      }, 400);
    },
    clear() {
      clearTimeout(timer);
      try { localStorage.removeItem(key); } catch { /* storage disattivato */ }
    },
  };
}
