// Scarica un oggetto JS come file .json.
// Tecnica standard nel browser: si crea un Blob (un "file in memoria"),
// gli si assegna un URL temporaneo e si simula il click su un link invisibile.
export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url); // libera la memoria dell'URL temporaneo
}
