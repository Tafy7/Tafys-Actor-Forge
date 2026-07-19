/*
 * ============================================================
 * Tafy's Actor Forge — Importer (macro Foundry VTT 13)
 * ============================================================
 * COME SI USA
 *  1. In Foundry: barra macro → nuova macro → Tipo: "Script".
 *  2. Incolla TUTTO questo codice, salva, trascina la macro sulla hotbar.
 *  3. Da ora, ogni volta che la lanci: si apre una finestra, incolli il
 *     JSON generato dal Forge (un mostro, un oggetto, o un array misto) e
 *     l'Actor / l'Item viene creato subito, con dentro già attacchi ed effetti.
 *
 * SMISTAMENTO Actor vs Item
 *  Lo stesso file può contenere Actor (npc/character…) e Item standalone
 *  (weapon/equipment/consumable/feat…). La macro li divide per `type` e crea
 *  ciascun gruppo con la sua factory (Actor.createDocuments / Item.createDocuments).
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

  // Tipi che sono Actor in dnd5e: tutto il resto (weapon, equipment,
  // consumable, feat, spell, tool…) viene trattato come Item standalone.
  const ACTOR_TYPES = new Set(["npc", "character", "vehicle", "group"]);

  // 1) Finestra con la casella dove incollare il JSON + cartella opzionale.
  const content = `
    <p>Incolla il JSON generato da <strong>Tafy's Actor Forge</strong>:
    un mostro, un oggetto, oppure un array <code>[ {…}, {…} ]</code> misto.</p>
    <textarea name="payload" rows="12"
      style="width:100%; font-family:monospace; white-space:pre; overflow:auto;"></textarea>
    <label style="display:block; margin-top:.5rem;">
      Cartella di destinazione (opzionale, solo per gli Actor)
      <input type="text" name="folder" placeholder="es. Avernus - Mostri" style="width:100%;" />
    </label>`;

  // DialogV2.prompt LANCIA un'eccezione se chiudi senza confermare:
  // la intercettiamo e usciamo in silenzio (= "annullato").
  let choice;
  try {
    choice = await DialogV2.prompt({
      window: { title: "Actor Forge — Importa" },
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
  //    b) Sono documenti validi (hanno name, type e system).
  const invalid = list.filter((a) => !a || !a.name || !a.type || !a.system);
  if (invalid.length) {
    return ui.notifications.error(
      `Actor Forge: ${invalid.length} elemento/i non validi (manca name/type/system).`
    );
  }

  // 4) Smistamento: Actor da una parte, Item standalone dall'altra.
  const actors = list.filter((a) => ACTOR_TYPES.has(a.type));
  const items = list.filter((a) => !ACTOR_TYPES.has(a.type));

  // 5) Cartella opzionale (solo per gli Actor): la troviamo per nome o la creiamo.
  let folderId = null;
  if (choice.folder && actors.length) {
    let folder = game.folders.find((f) => f.type === "Actor" && f.name === choice.folder);
    if (!folder) folder = await Folder.create({ name: choice.folder, type: "Actor" });
    folderId = folder.id;
  }

  // 6) Prepariamo i dati per la creazione:
  //    - togliamo l'_id del documento di primo livello → Foundry ne assegna
  //      uno nuovo ad ogni import, così re-importare NON dà "id duplicato".
  //    - MANTENIAMO gli _id degli elementi interni (keepId sotto): attività
  //      ed effetti si riferiscono l'uno all'altro tramite _id (es. il rider
  //      del "morso di lupo" punta all'effetto col suo _id). Rigenerarli
  //      spezzerebbe quei collegamenti e l'automazione non partirebbe.
  const prep = (a, withFolder) => {
    const clone = foundry.utils.deepClone(a);
    delete clone._id;
    if (withFolder && folderId) clone.folder = folderId;
    return clone;
  };

  // 7) Creazione in blocco, un gruppo per classe di documento.
  const created = [];
  try {
    if (actors.length) {
      const madeA = await Actor.createDocuments(actors.map((a) => prep(a, true)), { keepId: true });
      created.push(...madeA);
    }
    if (items.length) {
      // Item standalone → finiscono negli "Items" del mondo, con dentro
      // già attività ed effetti DAE (transfer per i tratti passivi).
      const madeI = await Item.createDocuments(items.map((a) => prep(a, false)), { keepId: true });
      created.push(...madeI);
    }
    ui.notifications.info(
      `Actor Forge: creati ${created.length} documenti` +
      (actors.length ? ` · ${actors.length} attori` : "") +
      (items.length ? ` · ${items.length} oggetti` : "") +
      ` — ${created.map((d) => d.name).join(", ")}`
    );
    // Comodità: se ne hai importato uno solo, apriamo la sua scheda.
    if (created.length === 1) created[0].sheet.render(true);
  } catch (err) {
    console.error("Actor Forge importer:", err);
    ui.notifications.error(`Actor Forge: creazione fallita — ${err.message}`);
  }
})();
