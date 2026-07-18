// ============================================================
// Chip group: selettore multiplo a "pillole" cliccabili.
// Sostituisce i campi di testo per resistenze/immunità/lingue:
// clicchi le voci standard (etichetta italiana, id inglese nel JSON)
// e per le cose homebrew resta un campo custom libero.
//
// API: createChipGroup(...) → { getValue, setValue }
//  - getValue(): stringa "fire, cold, testo custom" — lo stesso formato
//    che il builder già accetta (splitKnown fa il resto), così npc.js
//    non cambia di una virgola.
//  - setValue(str): usata dal caricamento bozze.
// ============================================================

import { t } from '../i18n.js';

export function createChipGroup({ container, ids, labels, customPlaceholder = t('chip_custom') }) {
  const selected = new Set();

  container.classList.add('chips-wrap');
  const chipBox = document.createElement('div');
  chipBox.className = 'chips';
  const custom = document.createElement('input');
  custom.type = 'text';
  custom.placeholder = customPlaceholder;
  custom.className = 'chips-custom';
  container.append(chipBox, custom);

  for (const id of ids) {
    const btn = document.createElement('button');
    btn.type = 'button'; // MAI 'submit' dentro un form!
    btn.className = 'chip';
    btn.dataset.id = id;
    btn.textContent = labels?.[id] ?? id;
    btn.title = id; // tooltip: l'id inglese che finirà nel JSON
    chipBox.appendChild(btn);
  }

  chipBox.addEventListener('click', (ev) => {
    const id = ev.target.dataset?.id;
    if (!id) return;
    selected.has(id) ? selected.delete(id) : selected.add(id);
    ev.target.classList.toggle('on', selected.has(id));
    // I click sui chip non generano eventi 'input': lo emettiamo noi,
    // con bubbles:true risale fino al <form> e aggiorna anteprima+autosave.
    container.dispatchEvent(new Event('input', { bubbles: true }));
  });

  return {
    getValue() {
      const parts = [...selected];
      if (custom.value.trim()) parts.push(custom.value.trim());
      return parts.join(', ');
    },
    setValue(str) {
      selected.clear();
      const extra = [];
      for (const raw of (str || '').split(/[,;]/)) {
        const token = raw.trim();
        if (!token) continue;
        if (ids.includes(token.toLowerCase())) selected.add(token.toLowerCase());
        else extra.push(token);
      }
      custom.value = extra.join('; ');
      for (const btn of chipBox.children) {
        btn.classList.toggle('on', selected.has(btn.dataset.id));
      }
    },
  };
}
