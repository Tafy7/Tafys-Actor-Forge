/*
 * ============================================================
 * Tafy's Actor Forge — Importer di Actor (macro Foundry VTT 13)
 * ============================================================
 * COME SI USA
 *  1. In Foundry: barra macro → nuova macro → Tipo: "Script".
 *  2. Incolla TUTTO questo codice, salva, trascina la macro sulla hotbar.
 *  3. Da ora, ogni volta che la lanci: si apre una finestra, incolli il
 *     JSON generato dal Forge (un mostro o un array di più mostri) e
 *     l'Actor viene creato subito, con dentro già attacchi ed effetti.
 *
 * PERCHÉ UNA MACRO E NON L'"IMPORT DATA" NATIVO?
 *  - Import Data SOVRASCRIVE un documento già esistente: sei costretto a
 *    creare prima un actor vuoto, e se sbagli bersaglio cancelli altro.
 *  - Actor.create() crea un documento NUOVO da zero. Nessun giro manuale,
 *    nessun rischio di sovrascrivere l'actor sbagliato, e in un colpo solo
 *    puoi crearne molti (utile per popolare un intero scontro).
 *
 * Compatibile con Foundry VTT 13 (DialogV2) e dnd5e 5.3.3.
 */
(async () => {
  // DialogV2 è l'API delle finestre di Foundry 13 (la vecchia Dialog è
  // deprecata). Vive sotto foundry.applications.api.
  const { DialogV2 } = foundry.applications.api;

  // 1) Finestra con la casella dove incollare il JSON + cartella opzionale.
  const content = `
    <p>Incolla il JSON generato da <strong>Tafy's Actor Forge</strong>:
    un singolo mostro, oppure un array <code>[ {…}, {…} ]</code> di più mostri.</p>
    <textarea name="payload" rows="12"
      style="width:100%; font-family:monospace; white-space:pre; overflow:auto;"></textarea>
    <label style="display:block; margin-top:.5rem;">
      Cartella di destinazione (opzionale)
      <input type="text" name="folder" placeholder="es. Avernus - Mostri" style="width:100%;" />
    </label>`;

  // DialogV2.prompt LANCIA un'eccezione se chiudi senza confermare:
  // la intercettiamo e usciamo in silenzio (= "annullato").
  let choice;
  try {
    choice = await DialogV2.prompt({
      window: { title: "Actor Forge — Importa Actor" },
      position: { width: 560 },
      content,
      ok: {
        label: "Importa",
        icon: "fa-solid fa-file-import",
        // Ciò che il callback ritorna diventa il valore di prompt().
        callback: (event, button) => ({
          json: button.form.elements.payload.value,
          folder: button.form.elements.folder.value.trim(),
        }),
      },
    });
  } catch (err) {
    return; // finestra chiusa/annullata
  }
  if (!choice || !choice.json.trim()) return;

  // 2) Parse del JSON, con messaggio d'errore leggibile.
  let data;
  try {
    data = JSON.parse(choice.json);
  } catch (err) {
    return ui.notifications.error(`Actor Forge: JSON non valido — ${err.message}`);
  }
  const list = Array.isArray(data) ? data : [data];

  // 3) Controlli di sanità.
  //    a) Non è un file di BOZZA dell'app (quello ha il marchio "app").
  if (list.some((a) => a && a.app === "tafys-actor-forge")) {
    return ui.notifications.error(
      "Actor Forge: questo è un file di BOZZA dell'app, non un export per Foundry. " +
      "Nel Forge usa il pulsante «Esporta JSON per Foundry»."
    );
  }
  //    b) Sono davvero Actor (hanno name, type e system).
  const invalid = list.filter((a) => !a || !a.name || !a.type || !a.system);
  if (invalid.length) {
    return ui.notifications.error(
      `Actor Forge: ${invalid.length} elemento/i non sembrano Actor validi (manca name/type/system).`
    );
  }

  // 4) Cartella opzionale: la troviamo per nome o la creiamo.
  let folderId = null;
  if (choice.folder) {
    let folder = game.folders.find((f) => f.type === "Actor" && f.name === choice.folder);
    if (!folder) folder = await Folder.create({ name: choice.folder, type: "Actor" });
    folderId = folder.id;
  }

  // 5) Prepariamo i dati per la creazione:
  //    - togliamo l'_id dell'Actor → Foundry ne assegna uno nuovo ad ogni
  //      import, così re-importare lo stesso file NON dà "id duplicato".
  //    - MANTENIAMO gli _id degli elementi interni (keepId sotto): attività
  //      ed effetti si riferiscono l'uno all'altro tramite _id (es. il rider
  //      del "morso di lupo" punta all'effetto col suo _id). Rigenerarli
  //      spezzerebbe quei collegamenti e l'automazione non partirebbe.
  const toCreate = list.map((a) => {
    const clone = foundry.utils.deepClone(a);
    delete clone._id;
    if (folderId) clone.folder = folderId;
    return clone;
  });

  // 6) Creazione in blocco: createDocuments accetta un array e crea in un
  //    colpo solo l'actor, gli item embedded e i loro effetti.
  try {
    const created = await Actor.createDocuments(toCreate, { keepId: true });
    ui.notifications.info(
      `Actor Forge: creati ${created.length} attori — ${created.map((a) => a.name).join(", ")}`
    );
    // Comodità: se ne hai importato uno solo, apriamo la sua scheda.
    if (created.length === 1) created[0].sheet.render(true);
  } catch (err) {
    console.error("Actor Forge importer:", err);
    ui.notifications.error(`Actor Forge: creazione fallita — ${err.message}`);
  }
})();
