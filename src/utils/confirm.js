// ============================================================
// Conferma NON bloccante "a secondo clic".
//
// I dialog nativi confirm()/alert() BLOCCANO tutti gli eventi della pagina e
// negli webview embedded possono far sembrare l'app piantata. Al loro posto:
// il primo clic "arma" il pulsante (cambia testo e colore), il secondo entro
// 4 secondi esegue l'azione; se non arriva, il pulsante torna com'era.
// Un solo punto per tutto il Forge (prima c'erano due copie).
// ============================================================
const armed = new WeakMap();

export function armedConfirm(btn, confirmLabel, action) {
  const state = armed.get(btn);
  if (state) {
    clearTimeout(state.timer);
    btn.textContent = state.original;
    btn.classList.remove('armed');
    armed.delete(btn);
    action();
    return;
  }
  const original = btn.textContent;
  btn.textContent = confirmLabel;
  btn.classList.add('armed');
  const timer = setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('armed');
    armed.delete(btn);
  }, 4000);
  armed.set(btn, { original, timer });
}
