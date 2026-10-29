/*
 * ============================================================
 * Tafy's Actor Forge — Importa / Esporta (macro Foundry VTT 13)
 * ============================================================
 * COME SI USA
 *  1. In Foundry: barra macro → nuova macro → Tipo: "Script".
 *  2. Incolla TUTTO questo codice, salva, trascina la macro sulla hotbar.
 *  3. Lanciala: si apre una finestra con due schede.
 *
 * 📥 IMPORTA
 *  - Incolla un JSON (un documento o un array [ {…}, {…} ]) OPPURE scegli
 *    uno o più file .json: il JSON generato dal Forge, un export nativo di
 *    Foundry, o un file prodotto dalla scheda Esporta di questa macro.
 *  - Destinazione: il MONDO oppure un COMPENDIO a scelta.
 *  - Riconosce da solo il tipo di documento: Actor, Item (oggetti, spell,
 *    feature…), Diario, Scene, Tabelle, Macro, Playlist, Carte.
 *  - Se il file viene da un'esportazione, ricrea la struttura delle
 *    sottocartelle (anche dentro il compendio).
 *
 * 📤 ESPORTA
 *  - Scegli una cartella del mondo (Attori, Oggetti, Diario, Scene…) oppure
 *    un compendio (intero o una sua cartella), con o senza sottocartelle.
 *  - Esce UN file JSON con tutti i documenti e i percorsi delle cartelle:
 *    si reimporta con la scheda Importa, anche in un altro mondo.
 *  - Le scene portano i dati e i PERCORSI delle immagini, non i file delle
 *    immagini: per un altro server vanno copiati a parte.
 *
 * PERCHÉ UNA MACRO E NON L'"IMPORT DATA" NATIVO?
 *  - Import Data SOVRASCRIVE un documento già esistente (devi crearne prima
 *    uno vuoto, e se sbagli bersaglio cancelli altro) e lavora un documento
 *    alla volta. Qui si CREANO documenti nuovi, tanti in un colpo solo.
 *
 * Compatibile con Foundry VTT 13 (DialogV2) e dnd5e 5.3.3.
 */
(async () => {
  // DialogV2 è l'API delle finestre di Foundry 13 (la vecchia Dialog è
  // deprecata). Vive sotto foundry.applications.api.
  const { DialogV2 } = foundry.applications.api;

  // Tipi che sono Actor in dnd5e (tutto ciò che ha type+system e non è
  // un Actor viene trattato come Item: weapon, spell, feat, loot…).
  const ACTOR_TYPES = new Set(["npc", "character", "vehicle", "group"]);
  // Tipi di documento gestiti (nome nel menu → collezione/cartelle di Foundry).
  const DOC_LABELS = {
    Actor: "Attori", Item: "Oggetti", JournalEntry: "Diario", Scene: "Scene (mappe)",
    RollTable: "Tabelle", Macro: "Macro", Playlist: "Playlist", Cards: "Carte",
  };
  const SUPPORTED = Object.keys(DOC_LABELS);
  const FORMAT = 1; // versione del formato del file di esportazione

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /**
   * Percorso di una cartella risalendo i genitori (Folder#folder), fino a
   * `stopAt` escluso: per root=Party, la sottocartella Party/Eroi/Elite → "Eroi/Elite".
   */
  const folderPath = (folder, stopAt = null) => {
    const parts = [];
    for (let f = folder; f && f.id !== stopAt?.id; f = f.folder) parts.unshift(f.name);
    return parts.join("/");
  };

  /**
   * Da quale collezione viene un JSON? Il JSON di un documento NON dice di che
   * tipo è: lo deduciamo dalla sua struttura (campi che esistono solo lì).
   */
  const inferDocumentName = (d) => {
    if (!d || typeof d !== "object") return null;
    if (d.prototypeToken || ACTOR_TYPES.has(d.type)) return "Actor";
    if (Array.isArray(d.pages)) return "JournalEntry";
    if (Array.isArray(d.walls) || Array.isArray(d.tokens) || (d.grid && "width" in d && "height" in d)) return "Scene";
    if (Array.isArray(d.results) && "formula" in d) return "RollTable";
    if (Array.isArray(d.sounds)) return "Playlist";
    if (Array.isArray(d.cards)) return "Cards";
    if (typeof d.command === "string") return "Macro";
    if (d.type && d.system) return "Item";
    return null;
  };

  // ---------- Menu della finestra ----------

  // Sorgenti per l'esportazione: cartelle del mondo (per tipo, col percorso
  // completo) e compendi (interi o una loro cartella), in UN solo menu.
  const worldGroups = SUPPORTED.map((type) => {
    const folders = game.folders.filter((f) => f.type === type)
      .map((f) => ({ id: f.id, path: folderPath(f) }))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (!folders.length) return "";
    return `<optgroup label="Mondo · ${esc(DOC_LABELS[type])}">${folders
      .map((f) => `<option value="world|${f.id}">${esc(f.path.replaceAll("/", " › "))}</option>`).join("")}</optgroup>`;
  }).join("");
  const packs = game.packs.filter((p) => SUPPORTED.includes(p.documentName));
  const packGroups = packs.map((p) => {
    const folders = [...(p.folders ?? [])].map((f) => ({ id: f.id, path: folderPath(f) }))
      .sort((a, b) => a.path.localeCompare(b.path));
    return `<optgroup label="Compendio · ${esc(p.title)}">
      <option value="pack|${esc(p.collection)}|">— tutto il compendio (${esc(DOC_LABELS[p.documentName])}) —</option>
      ${folders.map((f) => `<option value="pack|${esc(p.collection)}|${f.id}">${esc(f.path.replaceAll("/", " › "))}</option>`).join("")}
    </optgroup>`;
  }).join("");
  // Destinazioni per l'importazione: il mondo o un compendio (🔒 = bloccato).
  const destOptions = `<option value="world">Il mondo (nelle cartelle qui sotto)</option>${packs
    .map((p) => `<option value="pack|${esc(p.collection)}">Compendio · ${esc(p.title)} — ${esc(DOC_LABELS[p.documentName])}${p.locked ? " 🔒" : ""}</option>`).join("")}`;

  // Schede SOLO CSS (radio + selettore di fratello): nessuno script nella
  // finestra, quindi nessuna dipendenza dagli hook di render di DialogV2.
  // L'id univoco evita conflitti se la finestra è aperta due volte.
  const u = foundry.utils.randomID(6);
  const content = `
  <style>
    .tfx-${u} > input[name="tfxTab"] { display: none; }
    .tfx-${u} nav { display: flex; gap: .25rem; margin: 0 0 .6rem; border-bottom: 1px solid #8886; }
    .tfx-${u} nav label { padding: .35rem .9rem; cursor: pointer; opacity: .6; border-bottom: 2px solid transparent; }
    .tfx-${u} .tfx-pane { display: none; }
    #tfx-imp-${u}:checked ~ .tfx-p-imp, #tfx-exp-${u}:checked ~ .tfx-p-exp { display: block; }
    #tfx-imp-${u}:checked ~ nav label[for="tfx-imp-${u}"],
    #tfx-exp-${u}:checked ~ nav label[for="tfx-exp-${u}"] { opacity: 1; font-weight: bold; border-bottom-color: currentColor; }
    .tfx-${u} .row { display: block; margin-top: .55rem; }
    .tfx-${u} .row input[type="text"], .tfx-${u} .row select { width: 100%; }
    .tfx-${u} .hint { font-size: .85em; opacity: .75; margin: .3rem 0 0; }
  </style>
  <div class="tfx-${u}">
    <input type="radio" name="tfxTab" value="import" id="tfx-imp-${u}" checked />
    <input type="radio" name="tfxTab" value="export" id="tfx-exp-${u}" />
    <nav><label for="tfx-imp-${u}">📥 Importa</label><label for="tfx-exp-${u}">📤 Esporta</label></nav>

    <div class="tfx-pane tfx-p-imp">
      <p>Incolla il JSON generato da <strong>Tafy's Actor Forge</strong> (o un export di Foundry):
      un documento, oppure un array <code>[ {…}, {…} ]</code> misto.</p>
      <textarea name="payload" rows="8" style="width:100%; font-family:monospace; white-space:pre; overflow:auto;"></textarea>
      <label class="row">…oppure scegli uno o più file <code>.json</code>
        <input type="file" name="files" accept=".json,application/json" multiple />
      </label>
      <label class="row">Destinazione
        <select name="dest">${destOptions}</select>
      </label>
      <label class="row">Cartella Actor (opzionale)
        <input type="text" name="folder" placeholder="es. I Miei Mostri" />
      </label>
      <label class="row">Cartella Item / Spell (opzionale)
        <input type="text" name="folderItems" placeholder="es. I Miei Oggetti" />
      </label>
      <label class="row">Cartella per gli altri documenti: Diario, Scene, Tabelle… (opzionale)
        <input type="text" name="folderOther" placeholder="es. Capitolo 1" />
      </label>
      <p class="hint">Vuota = se il file viene dalla scheda Esporta ricrea la cartella originale, altrimenti nessuna cartella.
      Con un compendio come destinazione le cartelle vengono create dentro il compendio.</p>
      <label class="row"><input type="checkbox" name="keepIds" /> Mantieni gli ID originali</label>
      <p class="hint">Conserva i collegamenti tra documenti (link nei diari, token delle scene verso gli actor):
      utile importando insieme più file esportati. Se un ID esiste già, quel documento ne riceve uno nuovo.</p>
      <label class="row"><input type="checkbox" name="unlock" /> Sblocca il compendio di destinazione se è bloccato</label>
    </div>

    <div class="tfx-pane tfx-p-exp">
      <label class="row">Cosa esportare
        <select name="source">${worldGroups + packGroups || '<option value="">(nessuna cartella né compendio)</option>'}</select>
      </label>
      <label class="row"><input type="checkbox" name="subfolders" checked /> Includi le sottocartelle</label>
      <label class="row">Nome del file (opzionale)
        <input type="text" name="filename" placeholder="es. Party" />
      </label>
      <p class="hint">Esce UN file JSON con tutti i documenti e la struttura delle cartelle: si reimporta dalla scheda Importa,
      anche in un altro mondo o in un compendio. Le scene portano i percorsi delle immagini, non i file.</p>
    </div>
  </div>`;

  // DialogV2.prompt LANCIA un'eccezione se chiudi senza confermare:
  // la intercettiamo e usciamo in silenzio (= "annullato").
  let choice;
  try {
    choice = await DialogV2.prompt({
      window: { title: "Actor Forge — Importa / Esporta" },
      position: { width: 640 },
      content,
      ok: {
        label: "Avvia",
        icon: "fa-solid fa-play",
        // Ciò che il callback ritorna diventa il valore di prompt(). I File
        // restano leggibili anche dopo la chiusura della finestra.
        callback: (event, button) => {
          const el = button.form.elements;
          return {
            tab: el.tfxTab.value,
            json: el.payload.value,
            files: [...(el.files?.files ?? [])],
            dest: el.dest.value,
            folder: el.folder.value.trim(),
            folderItems: el.folderItems.value.trim(),
            folderOther: el.folderOther.value.trim(),
            keepIds: el.keepIds.checked,
            unlock: el.unlock.checked,
            source: el.source.value,
            subfolders: el.subfolders.checked,
            filename: el.filename.value.trim(),
          };
        },
      },
    });
  } catch (err) {
    return; // finestra chiusa/annullata
  }
  if (!choice) return;
  return choice.tab === "export" ? exportDocuments(choice) : importDocuments(choice);

  // ======================================================================
  // 📤 ESPORTA
  // ======================================================================
  async function exportDocuments(c) {
    if (!c.source) return ui.notifications.warn("Actor Forge: scegli una cartella o un compendio da esportare.");
    // toCompendium() = gli stessi dati dell'export nativo, ripuliti
    // (ownership, stato). Teniamo gli _id (servono a "Mantieni gli ID") e
    // l'ordinamento; la cartella la sostituiamo col PERCORSO relativo.
    const opts = { clearFolder: true, clearSort: false, keepId: true };
    const entries = [];
    let documentName;
    let rootName;
    let sourceLabel;
    try {
      const [kind, a, b] = c.source.split("|");
      if (kind === "world") {
        const root = game.folders.get(a);
        if (!root) throw new Error("cartella non trovata");
        documentName = root.type;
        rootName = root.name;
        sourceLabel = `cartella del mondo «${folderPath(root)}»`;
        const folders = [root, ...(c.subfolders ? root.getSubfolders(true) : [])];
        for (const f of folders) {
          for (const doc of f.contents) entries.push({ path: folderPath(f, root), data: doc.toCompendium(null, opts) });
        }
      } else {
        const pack = game.packs.get(a);
        if (!pack) throw new Error("compendio non trovato");
        documentName = pack.documentName;
        // Un compendio carica i documenti su richiesta: li prendiamo tutti e
        // filtriamo per cartella (root + eventuali sottocartelle).
        const root = b ? pack.folders.get(b) : null;
        const allowed = root ? new Set([root.id, ...(c.subfolders ? root.getSubfolders(true).map((f) => f.id) : [])]) : null;
        rootName = root ? root.name : pack.title;
        sourceLabel = root ? `compendio «${pack.title}» › ${folderPath(root)}` : `compendio «${pack.title}»`;
        for (const doc of await pack.getDocuments()) {
          const f = doc.folder ?? null;
          if (allowed && !allowed.has(f?.id)) continue;
          if (!allowed && !c.subfolders && f) continue; // "tutto il compendio" senza sottocartelle = solo la radice
          entries.push({ path: f ? folderPath(f, root) : "", data: doc.toCompendium(null, opts) });
        }
      }
    } catch (err) {
      console.error("Actor Forge export:", err);
      return ui.notifications.error(`Actor Forge: esportazione fallita — ${err.message}`);
    }
    if (!entries.length) return ui.notifications.warn(`Actor Forge: nessun documento in ${sourceLabel}.`);

    entries.sort((x, y) => x.path.localeCompare(y.path) || String(x.data.name).localeCompare(String(y.data.name)));
    const file = {
      tafysForgeExport: FORMAT,
      documentName,
      rootName,
      source: sourceLabel,
      exportedAt: new Date().toISOString(),
      foundry: game.version,
      system: `${game.system.id} ${game.system.version}`,
      count: entries.length,
      entries,
    };
    const name = (c.filename || rootName || "export").replace(/[\\/:*?"<>|]+/g, "_");
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    save(JSON.stringify(file, null, 2), "application/json", `${name}.json`);
    ui.notifications.info(`Actor Forge: esportati ${entries.length} documenti da ${sourceLabel} → ${name}.json`);
  }

  // ======================================================================
  // 📥 IMPORTA
  // ======================================================================
  async function importDocuments(c) {
    // 1) Raccolta: testo incollato + file scelti.
    const payloads = [];
    if (c.json.trim()) payloads.push({ label: "testo incollato", text: c.json });
    for (const f of c.files) payloads.push({ label: f.name, text: await f.text() });
    if (!payloads.length) return;

    // 2) Parse e normalizzazione in "entry" { data, path, root, docName }.
    const problems = [];
    const entries = [];
    for (const p of payloads) {
      let parsed;
      try { parsed = JSON.parse(p.text); } catch (err) {
        problems.push(`${p.label}: JSON non valido (${err.message})`);
        continue;
      }
      // a) File di BOZZA dell'app (ha il marchio "app"): non è un export.
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (list.some((x) => x && x.app === "tafys-actor-forge")) {
        return ui.notifications.error(
          "Actor Forge: questo è un file di BOZZA dell'app, non un export per Foundry. " +
          "Nel Forge usa il pulsante «Esporta JSON per Foundry»."
        );
      }
      if (parsed && parsed.tafysForgeExport) {
        // b) File della scheda Esporta: tipo, cartella d'origine e percorsi.
        for (const e of parsed.entries ?? []) {
          entries.push({ data: e.data, path: e.path ?? "", root: parsed.rootName ?? "", docName: parsed.documentName ?? inferDocumentName(e.data), from: p.label });
        }
      } else {
        // c) JSON del Forge o export nativo: un documento o un array.
        for (const d of list) entries.push({ data: d, path: "", root: "", docName: inferDocumentName(d), from: p.label });
      }
    }

    // 3) Controlli di sanità per tipo di documento.
    const valid = [];
    for (const e of entries) {
      const d = e.data;
      if (!d || typeof d !== "object" || !d.name) { problems.push(`${e.from}: un elemento senza nome è stato saltato`); continue; }
      if (!e.docName || !SUPPORTED.includes(e.docName)) { problems.push(`${e.from}: «${d.name}» — tipo di documento non riconosciuto`); continue; }
      if ((e.docName === "Actor" || e.docName === "Item") && (!d.type || !d.system)) {
        problems.push(`${e.from}: «${d.name}» non valido (manca type/system)`);
        continue;
      }
      valid.push(e);
    }

    // 4) Destinazione: mondo o compendio.
    let pack = null;
    if (c.dest.startsWith("pack|")) {
      pack = game.packs.get(c.dest.slice(5));
      if (!pack) return ui.notifications.error("Actor Forge: compendio di destinazione non trovato.");
      if (!game.user.isGM) return ui.notifications.error("Actor Forge: solo il GM può importare in un compendio.");
      // Un compendio accetta un solo tipo di documento: il resto lo saltiamo.
      for (const e of valid.filter((x) => x.docName !== pack.documentName)) {
        problems.push(`«${e.data.name}» (${DOC_LABELS[e.docName]}) saltato: il compendio contiene ${DOC_LABELS[pack.documentName]}`);
      }
      valid.splice(0, valid.length, ...valid.filter((x) => x.docName === pack.documentName));
      if (valid.length && pack.locked) {
        if (!c.unlock) return ui.notifications.error(`Actor Forge: il compendio «${pack.title}» è bloccato. Spunta «Sblocca il compendio» e riprova.`);
        await pack.configure({ locked: false });
      }
      if (c.keepIds) await pack.getIndex(); // per controllare gli ID già presenti
    }
    if (!valid.length) return reportProblems(problems, "nessun documento da importare");

    // 5) Cartelle: per nome (trovate o create) + sottocartelle del percorso.
    //    Un campo compilato vince; vuoto = cartella d'origine dell'export.
    const rootField = (docName) => (docName === "Actor" ? c.folder : docName === "Item" ? c.folderItems : c.folderOther);
    const folderCache = new Map();
    const ensureFolder = async (type, segments) => {
      if (!segments.length) return null;
      const key = `${type}|${segments.join("/")}`;
      if (folderCache.has(key)) return folderCache.get(key);
      const pool = pack ? pack.folders : game.folders;
      let parent = null;
      for (const [i, name] of segments.entries()) {
        // La cartella radice si cerca per nome (come sempre fatto da questa
        // macro); le sottocartelle si cercano DENTRO la cartella genitore.
        let found = pool.find((f) => f.type === type && f.name === name && (i === 0 || (f.folder?.id ?? null) === parent.id));
        if (!found) found = await Folder.create({ name, type, folder: parent?.id ?? null }, pack ? { pack: pack.collection } : {});
        parent = found;
      }
      folderCache.set(key, parent.id);
      return parent.id;
    };

    // 6) Preparazione dei dati:
    //    - di norma togliamo l'_id del documento di primo livello → Foundry ne
    //      assegna uno nuovo, così re-importare NON dà "id duplicato";
    //    - MANTENIAMO sempre gli _id degli elementi interni (keepId sotto):
    //      attività ed effetti si riferiscono l'uno all'altro tramite _id
    //      (es. il rider del "morso di lupo" punta all'effetto col suo _id).
    const usedIds = new Set();
    let reIds = 0;
    const idTaken = (docName, id) => usedIds.has(id) || (pack ? pack.index.has(id) : game.collections.get(docName)?.has(id));
    const groups = new Map();
    for (const e of valid) {
      const clone = foundry.utils.deepClone(e.data);
      const root = rootField(e.docName) || e.root;
      const segments = [root, ...String(e.path || "").split("/")].map((s) => String(s || "").trim()).filter(Boolean);
      clone.folder = await ensureFolder(e.docName, segments);
      if (!c.keepIds || !clone._id) delete clone._id;
      else if (idTaken(e.docName, clone._id)) { delete clone._id; reIds += 1; }
      else usedIds.add(clone._id);
      if (!groups.has(e.docName)) groups.set(e.docName, []);
      groups.get(e.docName).push(clone);
    }

    // 7) Creazione in blocco, un gruppo per tipo di documento.
    const created = [];
    const counts = [];
    try {
      for (const [docName, list] of groups) {
        const cls = CONFIG[docName]?.documentClass;
        if (!cls) { problems.push(`${DOC_LABELS[docName]}: classe di documento non disponibile`); continue; }
        const made = await cls.createDocuments(list, { keepId: true, ...(pack ? { pack: pack.collection } : {}) });
        created.push(...made);
        counts.push(`${made.length} ${DOC_LABELS[docName].toLowerCase()}`);
      }
    } catch (err) {
      console.error("Actor Forge importer:", err);
      return ui.notifications.error(`Actor Forge: creazione fallita — ${err.message}`);
    }
    const where = pack ? ` nel compendio «${pack.title}»` : "";
    const names = created.slice(0, 8).map((d) => d.name).join(", ") + (created.length > 8 ? "…" : "");
    ui.notifications.info(`Actor Forge: creati ${created.length} documenti${where} · ${counts.join(" · ")} — ${names}`);
    if (reIds) ui.notifications.warn(`Actor Forge: ${reIds} documenti avevano un ID già presente e ne hanno ricevuto uno nuovo.`);
    if (problems.length) reportProblems(problems);
    // Comodità: se ne hai importato uno solo nel mondo, apriamo la sua scheda.
    if (!pack && created.length === 1) created[0].sheet?.render(true);
  }

  // Avvisi raccolti: i primi in notifica, l'elenco completo in console (F12).
  function reportProblems(problems, headline) {
    if (headline && !problems.length) return ui.notifications.warn(`Actor Forge: ${headline}.`);
    console.warn("Actor Forge — elementi saltati:\n" + problems.join("\n"));
    ui.notifications.warn(`Actor Forge: ${headline ? headline + " — " : ""}${problems.length} avvisi: ${problems.slice(0, 2).join(" · ")}${problems.length > 2 ? " … (elenco completo in console, F12)" : ""}`);
  }
})();
