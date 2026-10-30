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
 *    uno o più file .json: il JSON del Forge, un export nativo di Foundry,
 *    o un file prodotto dalla scheda Esporta di questa macro.
 *  - Destinazione: il MONDO oppure un COMPENDIO a scelta.
 *  - Riconosce da solo il tipo di documento: Actor, Item (oggetti, spell,
 *    feature…), Diario, Scene, Tabelle, Macro, Playlist, Carte.
 *  - Se il file viene dalla scheda Esporta, ricrea le sottocartelle.
 *
 * 📤 ESPORTA
 *  - Sorgente (Attori, Oggetti, Diario, Scene… o un Compendio) → Cartella
 *    (o "tutto"), con o senza sottocartelle.
 *  - FILE UNICO .json: tutti i documenti + percorsi delle cartelle, si
 *    reimporta con la scheda Importa ricreando la struttura.
 *  - FILE SINGOLI .zip: un .json per documento, nelle sue cartelle
 *    (ogni file va bene anche per l'"Import Data" nativo di Foundry).
 *  - Le scene portano i dati e i PERCORSI delle immagini, non i file.
 *
 * Lingua: segue quella di Foundry (italiano → italiano, altrimenti
 * inglese). Per forzarla: FORCE_LANG qui sotto.
 * Compatibile con Foundry VTT 13 (DialogV2) e dnd5e 5.3.3.
 *
 * ------------------------------------------------------------
 * HOW TO USE (English)
 *  1. In Foundry: macro bar → new macro → Type: "Script".
 *  2. Paste ALL of this code, save, drag the macro to the hotbar.
 *  3. Run it: a window with two tabs opens.
 * 📥 IMPORT — paste a JSON (one document or an array) OR pick one or more
 *    .json files (Forge JSON, native Foundry export, or a file made by the
 *    Export tab). Destination: the WORLD or any COMPENDIUM. Document type is
 *    detected automatically (Actor, Item, Journal, Scene, Table, Macro,
 *    Playlist, Cards); subfolders from an Export file are rebuilt.
 * 📤 EXPORT — Source (Actors, Items, Journals, Scenes… or a Compendium) →
 *    Folder (or "all"), with or without subfolders. SINGLE FILE .json
 *    (re-importable, keeps the folder structure) or SEPARATE FILES .zip
 *    (one .json per document, also fine for Foundry's native Import Data).
 *    Scenes carry data and image PATHS, not the image files.
 * Language follows Foundry's (Italian → Italian, otherwise English).
 * To force it: FORCE_LANG below. Foundry VTT 13 (DialogV2), dnd5e 5.3.3.
 */
(async () => {
  const FORCE_LANG = ""; // "it" | "en" — vuoto = lingua di Foundry / empty = Foundry's language

  // ---------- Testi IT / EN ----------
  // Un solo dizionario: ogni testo visibile passa da T(chiave, { variabili }).
  const I18N = {
    it: {
      docs: { Actor: "Attori", Item: "Oggetti", JournalEntry: "Diario", Scene: "Scene (mappe)", RollTable: "Tabelle", Macro: "Macro", Playlist: "Playlist", Cards: "Carte" },
      title: "Actor Forge — Importa / Esporta",
      tabImport: "📥 Importa", tabExport: "📤 Esporta", goImport: "Importa", goExport: "Esporta",
      allPack: "tutto il compendio", allN: "tutto ({n})", packs: "Compendi ({n})",
      world: "Il mondo", packDest: "Compendio · {title} ({type})",
      pastePh: "Incolla qui il JSON: un documento o un array [ {…}, {…} ]",
      orFiles: "…oppure uno o più file JSON", dest: "Destinazione",
      fActor: "Cartella Actor", fActorPh: "es. I Miei Mostri",
      fItem: "Cartella Item / Spell", fItemPh: "es. I Miei Oggetti",
      fOther: "Cartella altri documenti", fOtherPh: "es. Capitolo 1", fOtherTitle: "Diario, Scene, Tabelle, Macro, Playlist, Carte",
      keepIds: "Mantieni gli ID originali",
      keepIdsTitle: "Conserva i collegamenti tra documenti (link nei diari, token delle scene verso gli actor). Se un ID esiste già, quel documento ne riceve uno nuovo.",
      unlock: "Sblocca il compendio se bloccato", unlockTitle: "Solo il GM. Il compendio resta sbloccato dopo l'importazione.",
      impHint: "Cartelle vuote = ricrea quelle del file esportato (o nessuna). Passa il mouse sulle opzioni per i dettagli.",
      source: "Sorgente", nothing: "(niente da esportare)", pack: "Compendio", folder: "Cartella",
      subfolders: "Includi le sottocartelle",
      single: "File unico (.json)", singleTitle: "Un solo .json con tutti i documenti e la struttura delle cartelle: si reimporta dalla scheda Importa.",
      zip: "File singoli (.zip)", zipTitle: "Uno .zip con un .json per documento, nelle sue cartelle (vanno bene anche per l'Import Data di Foundry).",
      filename: "Nome del file", filenamePh: "vuoto = nome della cartella",
      expHint: "Le scene portano i dati e i percorsi delle immagini, non i file delle immagini.",
      eNothing: "Actor Forge: non c'è niente da esportare.",
      ePackMissing: "compendio non trovato", eFolderMissing: "cartella non trovata",
      srcPack: "compendio «{title}»", srcPackFolder: "compendio «{title}» › {path}",
      srcFolder: "cartella «{path}»", srcAll: "tutti i documenti di «{label}»",
      eFail: "Actor Forge: esportazione fallita — {msg}", eEmpty: "Actor Forge: nessun documento in {src}.",
      eZipDone: "Actor Forge: esportati {n} file da {src} → {file} ({mb} MB)",
      eJsonDone: "Actor Forge: esportati {n} documenti da {src} → {file}",
      iNothing: "Actor Forge: incolla un JSON o scegli almeno un file.", iPasted: "testo incollato",
      iBadJson: "{from}: JSON non valido ({msg})",
      iDraft: "Actor Forge: questo è un file di BOZZA dell'app, non un export per Foundry. Nel Forge usa il pulsante «⬇️ Esporta JSON».",
      iNoName: "{from}: un elemento senza nome è stato saltato",
      iUnknown: "{from}: «{name}» — tipo di documento non riconosciuto",
      iInvalid: "{from}: «{name}» non valido (manca type/system)",
      iPackMissing: "Actor Forge: compendio di destinazione non trovato.",
      iGmOnly: "Actor Forge: solo il GM può importare in un compendio.",
      iWrongType: "«{name}» ({type}) saltato: il compendio contiene {packType}",
      iLocked: "Actor Forge: il compendio «{title}» è bloccato. Spunta «Sblocca il compendio» e riprova.",
      iNone: "nessun documento da importare", iNoClass: "{type}: classe di documento non disponibile",
      iFail: "Actor Forge: creazione fallita — {msg}", iInPack: " nel compendio «{title}»",
      iDone: "Actor Forge: creati {n} documenti{where} · {counts} — {names}",
      iReIds: "Actor Forge: {n} documenti avevano un ID già presente e ne hanno ricevuto uno nuovo.",
      rpConsole: "Actor Forge — elementi saltati:", rpWarn: "Actor Forge: {head}{n} avvisi: {first}{more}",
      rpMore: " … (elenco completo in console, F12)",
    },
    en: {
      docs: { Actor: "Actors", Item: "Items", JournalEntry: "Journal", Scene: "Scenes (maps)", RollTable: "Roll Tables", Macro: "Macros", Playlist: "Playlists", Cards: "Cards" },
      title: "Actor Forge — Import / Export",
      tabImport: "📥 Import", tabExport: "📤 Export", goImport: "Import", goExport: "Export",
      allPack: "whole compendium", allN: "all ({n})", packs: "Compendiums ({n})",
      world: "The world", packDest: "Compendium · {title} ({type})",
      pastePh: "Paste the JSON here: one document or an array [ {…}, {…} ]",
      orFiles: "…or one or more JSON files", dest: "Destination",
      fActor: "Actor folder", fActorPh: "e.g. My Monsters",
      fItem: "Item / Spell folder", fItemPh: "e.g. My Items",
      fOther: "Other documents folder", fOtherPh: "e.g. Chapter 1", fOtherTitle: "Journals, Scenes, Tables, Macros, Playlists, Cards",
      keepIds: "Keep the original IDs",
      keepIdsTitle: "Keeps links between documents (journal links, scene tokens pointing to actors). If an ID already exists, that document gets a new one.",
      unlock: "Unlock the compendium if locked", unlockTitle: "GM only. The compendium stays unlocked after the import.",
      impHint: "Empty folders = rebuild the ones from the exported file (or none). Hover the options for details.",
      source: "Source", nothing: "(nothing to export)", pack: "Compendium", folder: "Folder",
      subfolders: "Include subfolders",
      single: "Single file (.json)", singleTitle: "One .json with every document and the folder structure: re-import it from the Import tab.",
      zip: "Separate files (.zip)", zipTitle: "A .zip with one .json per document, inside its folders (also fine for Foundry's Import Data).",
      filename: "File name", filenamePh: "empty = folder name",
      expHint: "Scenes carry their data and image paths, not the image files.",
      eNothing: "Actor Forge: there is nothing to export.",
      ePackMissing: "compendium not found", eFolderMissing: "folder not found",
      srcPack: "compendium “{title}”", srcPackFolder: "compendium “{title}” › {path}",
      srcFolder: "folder “{path}”", srcAll: "all documents in “{label}”",
      eFail: "Actor Forge: export failed — {msg}", eEmpty: "Actor Forge: no documents in {src}.",
      eZipDone: "Actor Forge: exported {n} files from {src} → {file} ({mb} MB)",
      eJsonDone: "Actor Forge: exported {n} documents from {src} → {file}",
      iNothing: "Actor Forge: paste a JSON or pick at least one file.", iPasted: "pasted text",
      iBadJson: "{from}: invalid JSON ({msg})",
      iDraft: "Actor Forge: this is an app DRAFT file, not a Foundry export. In the Forge use the “⬇️ Export JSON” button.",
      iNoName: "{from}: an element without a name was skipped",
      iUnknown: "{from}: “{name}” — unrecognised document type",
      iInvalid: "{from}: “{name}” is invalid (missing type/system)",
      iPackMissing: "Actor Forge: destination compendium not found.",
      iGmOnly: "Actor Forge: only the GM can import into a compendium.",
      iWrongType: "“{name}” ({type}) skipped: the compendium holds {packType}",
      iLocked: "Actor Forge: the compendium “{title}” is locked. Tick “Unlock the compendium” and try again.",
      iNone: "no documents to import", iNoClass: "{type}: document class not available",
      iFail: "Actor Forge: creation failed — {msg}", iInPack: " in the compendium “{title}”",
      iDone: "Actor Forge: created {n} documents{where} · {counts} — {names}",
      iReIds: "Actor Forge: {n} documents had an ID already in use and received a new one.",
      rpConsole: "Actor Forge — skipped elements:", rpWarn: "Actor Forge: {head}{n} warnings: {first}{more}",
      rpMore: " … (full list in the console, F12)",
    },
  };
  // game.i18n.lang = lingua scelta nelle impostazioni di Foundry ("it", "en", "de"…).
  const LANG = (FORCE_LANG || String(game.i18n?.lang ?? "en")).toLowerCase().startsWith("it") ? "it" : "en";
  const T = (key, vars = {}) => String(I18N[LANG][key] ?? I18N.en[key] ?? key)
    .replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

  // DialogV2 è l'API delle finestre di Foundry 13 (la vecchia Dialog è
  // deprecata). Vive sotto foundry.applications.api.
  const { DialogV2 } = foundry.applications.api;

  // Tipi che sono Actor in dnd5e (tutto ciò che ha type+system e non è un
  // Actor viene trattato come Item: weapon, spell, feat, loot…).
  const ACTOR_TYPES = new Set(["npc", "character", "vehicle", "group"]);
  const DOC_LABELS = I18N[LANG].docs; // { Actor: "Attori" | "Actors", … }
  const SUPPORTED = Object.keys(DOC_LABELS);
  const FORMAT = 1; // versione del formato del file di esportazione

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Nome sicuro per file e cartelle (Windows non accetta \ / : * ? " < > |).
  const safeName = (s) => String(s ?? "").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "_";

  /** Nomi delle cartelle risalendo i genitori, fino a `stopAt` escluso. */
  const folderParts = (folder, stopAt = null) => {
    const parts = [];
    for (let f = folder; f && f.id !== stopAt?.id; f = f.folder) parts.unshift(f.name);
    return parts;
  };
  const folderPath = (folder, stopAt = null) => folderParts(folder, stopAt).join("/");
  // Voce del file di esportazione: `path` leggibile ("Party/Eroi") + `folders`
  // con i livelli separati, perché un nome di cartella può contenere "/".
  const entryOf = (doc, f, stopAt, opts) => {
    const folders = f ? folderParts(f, stopAt) : [];
    return { path: folders.join("/"), folders, data: doc.toCompendium(null, opts) };
  };

  /** Il JSON di un documento non dice di che tipo è: lo deduciamo dalla struttura. */
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

  // ---------- Stile ----------
  // Foundry RIPULISCE l'HTML delle finestre e toglie i tag <style>: lo stile
  // va iniettato nell'<head> della pagina (sostituito a ogni avvio, così una
  // versione nuova della macro aggiorna anche l'aspetto).
  const STYLE_ID = "tafys-forge-io-style";
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .tfx-io { display: flex; flex-direction: column; gap: .5rem; max-height: min(68vh, 620px); overflow-y: auto; padding-right: .25rem; }
    .tfx-io .tfx-tabs { display: flex; gap: .25rem; border-bottom: 1px solid rgba(127,127,127,.4); }
    .tfx-io .tfx-tab { flex: 0 0 auto; width: auto; margin: 0; padding: .3rem 1rem; background: none; border: none;
      border-bottom: 2px solid transparent; border-radius: 0; box-shadow: none; opacity: .55; font-weight: bold; }
    .tfx-io.is-import .tfx-tab-import, .tfx-io.is-export .tfx-tab-export { opacity: 1; border-bottom-color: currentColor; }
    .tfx-io.is-import .tfx-p-exp, .tfx-io.is-export .tfx-p-imp { display: none !important; }
    .tfx-io .tfx-pane { display: flex; flex-direction: column; gap: .5rem; }
    .tfx-io label { display: flex; flex-direction: column; gap: .15rem; margin: 0; }
    .tfx-io .tfx-g2 { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem .75rem; align-items: end; }
    .tfx-io .tfx-g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem .75rem; align-items: end; }
    .tfx-io .tfx-checks { display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; align-items: center; }
    .tfx-io .tfx-checks label { flex-direction: row; align-items: center; gap: .35rem; }
    .tfx-io .tfx-checks input { margin: 0; flex: none; }
    .tfx-io textarea { font-family: monospace; resize: vertical; min-height: 4.5rem; }
    .tfx-io .tfx-hint { margin: 0; font-size: .85em; opacity: .7; }
    .tfx-io:not(.src-pack) .tfx-packfield { visibility: hidden; }
  `;
  document.head.append(style);

  // ---------- Dati per i menu ----------
  /** Cartelle in ordine d'albero, con rientro: [{ id, label }]. */
  const treeOptions = (folders) => {
    const byParent = new Map();
    for (const f of folders) {
      const k = f.folder?.id ?? null;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(f);
    }
    const out = [];
    const walk = (parentId, depth) => {
      for (const f of (byParent.get(parentId) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
        out.push({ id: f.id, label: `${"   ".repeat(depth)}${depth ? "└ " : ""}${f.name}` });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    for (const f of folders) if (!out.some((o) => o.id === f.id)) out.push({ id: f.id, label: f.name }); // sicurezza
    return out;
  };
  const worldSources = SUPPORTED
    .map((type) => ({ type, count: game.collections.get(type)?.size ?? 0, folders: treeOptions(game.folders.filter((f) => f.type === type)) }))
    .filter((s) => s.count || s.folders.length);
  const packs = game.packs.filter((p) => SUPPORTED.includes(p.documentName));
  const packFolders = Object.fromEntries(packs.map((p) => [p.collection, treeOptions([...(p.folders ?? [])])]));
  const folderOptions = (list, total) =>
    `<option value="">— ${total == null ? T("allPack") : T("allN", { n: total })} —</option>` +
    list.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join("");

  const sourceOptions = worldSources.map((s) => `<option value="${s.type}">${esc(DOC_LABELS[s.type])} (${s.count})</option>`).join("") +
    (packs.length ? `<option value="pack">${esc(T("packs", { n: packs.length }))}</option>` : "");
  const packOptions = SUPPORTED.map((type) => {
    const list = packs.filter((p) => p.documentName === type);
    return list.length ? `<optgroup label="${esc(DOC_LABELS[type])}">${list
      .map((p) => `<option value="${esc(p.collection)}">${esc(p.title)}${p.locked ? " 🔒" : ""}</option>`).join("")}</optgroup>` : "";
  }).join("");
  const firstSource = worldSources[0]?.type ?? (packs.length ? "pack" : "");
  const firstFolders = firstSource === "pack"
    ? folderOptions(packFolders[packs[0]?.collection] ?? [], null)
    : folderOptions(worldSources[0]?.folders ?? [], worldSources[0]?.count ?? 0);
  const destOptions = `<option value="world">${esc(T("world"))}</option>${packs
    .map((p) => `<option value="pack|${esc(p.collection)}">${esc(T("packDest", { title: p.title, type: DOC_LABELS[p.documentName] }))}${p.locked ? " 🔒" : ""}</option>`).join("")}`;

  // ---------- Finestra ----------
  // Nessuno script nel contenuto (Foundry lo toglierebbe): schede e menu
  // dipendenti si gestiscono con listener DELEGATI sul document, filtrati
  // sulla classe univoca di questa finestra e rimossi alla chiusura.
  const u = foundry.utils.randomID(8);
  const content = `
  <div class="tfx-io tfx-io-${u} is-import${firstSource === "pack" ? " src-pack" : ""}">
    <div class="tfx-tabs">
      <button type="button" class="tfx-tab tfx-tab-import">${esc(T("tabImport"))}</button>
      <button type="button" class="tfx-tab tfx-tab-export">${esc(T("tabExport"))}</button>
    </div>

    <div class="tfx-pane tfx-p-imp">
      <textarea name="payload" rows="4" placeholder="${esc(T("pastePh"))}"></textarea>
      <div class="tfx-g2">
        <label>${esc(T("orFiles"))}
          <input type="file" name="files" accept=".json,application/json" multiple />
        </label>
        <label>${esc(T("dest"))}
          <select name="dest">${destOptions}</select>
        </label>
      </div>
      <div class="tfx-g3">
        <label>${esc(T("fActor"))} <input type="text" name="folder" placeholder="${esc(T("fActorPh"))}" /></label>
        <label>${esc(T("fItem"))} <input type="text" name="folderItems" placeholder="${esc(T("fItemPh"))}" /></label>
        <label title="${esc(T("fOtherTitle"))}">${esc(T("fOther"))} <input type="text" name="folderOther" placeholder="${esc(T("fOtherPh"))}" /></label>
      </div>
      <div class="tfx-checks">
        <label title="${esc(T("keepIdsTitle"))}">
          <input type="checkbox" name="keepIds" /> ${esc(T("keepIds"))}</label>
        <label title="${esc(T("unlockTitle"))}">
          <input type="checkbox" name="unlock" /> ${esc(T("unlock"))}</label>
      </div>
      <p class="tfx-hint">${esc(T("impHint"))}</p>
    </div>

    <div class="tfx-pane tfx-p-exp">
      <div class="tfx-g2">
        <label>${esc(T("source"))}
          <select name="source">${sourceOptions || `<option value="">${esc(T("nothing"))}</option>`}</select>
        </label>
        <label class="tfx-packfield">${esc(T("pack"))}
          <select name="pack">${packOptions}</select>
        </label>
      </div>
      <label>${esc(T("folder"))}
        <select name="exFolder">${firstFolders}</select>
      </label>
      <div class="tfx-g2">
        <div class="tfx-checks"><label><input type="checkbox" name="subfolders" checked /> ${esc(T("subfolders"))}</label></div>
        <div class="tfx-checks">
          <label title="${esc(T("singleTitle"))}">
            <input type="radio" name="format" value="single" checked /> ${esc(T("single"))}</label>
          <label title="${esc(T("zipTitle"))}">
            <input type="radio" name="format" value="zip" /> ${esc(T("zip"))}</label>
        </div>
      </div>
      <label>${esc(T("filename"))} <input type="text" name="filename" placeholder="${esc(T("filenamePh"))}" /></label>
      <p class="tfx-hint">${esc(T("expHint"))}</p>
    </div>
  </div>`;

  const refreshExport = (root) => {
    const src = root.querySelector('[name="source"]').value;
    root.classList.toggle("src-pack", src === "pack");
    const sel = root.querySelector('[name="exFolder"]');
    if (src === "pack") {
      sel.innerHTML = folderOptions(packFolders[root.querySelector('[name="pack"]').value] ?? [], null);
    } else {
      const s = worldSources.find((x) => x.type === src);
      sel.innerHTML = folderOptions(s?.folders ?? [], s?.count ?? 0);
    }
  };
  // L'etichetta del pulsante segue la scheda ("Importa" / "Esporta").
  const setGoLabel = (root) => {
    try {
      const btn = root.closest("form")?.querySelector('button[data-action="go"]');
      const label = root.classList.contains("is-export") ? T("goExport") : T("goImport");
      const span = btn?.querySelector("span");
      if (span) span.textContent = label; else if (btn) btn.textContent = label;
    } catch { /* solo estetica */ }
  };
  const mine = (ev) => ev.target?.closest?.(`.tfx-io-${u}`);
  const onClick = (ev) => {
    const root = mine(ev);
    const tab = root && ev.target.closest(".tfx-tab");
    if (!tab) return;
    ev.preventDefault();
    const exp = tab.classList.contains("tfx-tab-export");
    root.classList.toggle("is-export", exp);
    root.classList.toggle("is-import", !exp);
    setGoLabel(root);
  };
  const onChange = (ev) => {
    const root = mine(ev);
    if (root && (ev.target.name === "source" || ev.target.name === "pack")) refreshExport(root);
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);

  const readForm = (form) => {
    const el = form.elements;
    const root = form.querySelector(".tfx-io");
    return {
      tab: root?.classList.contains("is-export") ? "export" : "import",
      json: el.payload.value,
      files: [...(el.files?.files ?? [])],
      dest: el.dest.value,
      folder: el.folder.value.trim(),
      folderItems: el.folderItems.value.trim(),
      folderOther: el.folderOther.value.trim(),
      keepIds: el.keepIds.checked,
      unlock: el.unlock.checked,
      source: el.source.value,
      pack: el.pack?.value ?? "",
      exFolder: el.exFolder.value,
      subfolders: el.subfolders.checked,
      format: el.format.value || "single",
      filename: el.filename.value.trim(),
    };
  };

  let choice = null;
  try {
    // wait() risolve col valore del callback, o null se chiudi la finestra.
    choice = await DialogV2.wait({
      window: { title: T("title"), resizable: true },
      position: { width: 760 },
      content,
      rejectClose: false,
      buttons: [{
        action: "go", label: T("goImport"), icon: "fa-solid fa-play", default: true,
        callback: (event, button) => readForm(button.form),
      }],
    });
  } catch (err) {
    choice = null;
  } finally {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
  }
  if (!choice || typeof choice !== "object") return;
  return choice.tab === "export" ? exportDocuments(choice) : importDocuments(choice);

  // ======================================================================
  // 📤 ESPORTA
  // ======================================================================
  async function exportDocuments(c) {
    if (!c.source) return ui.notifications.warn(T("eNothing"));
    // toCompendium() = gli stessi dati dell'export nativo, ripuliti
    // (ownership, stato). Teniamo gli _id (servono a "Mantieni gli ID") e
    // l'ordinamento; la cartella la sostituiamo col PERCORSO relativo.
    const opts = { clearFolder: true, clearSort: false, keepId: true };
    const entries = [];
    let documentName;
    let rootName;
    let sourceLabel;
    try {
      if (c.source === "pack") {
        const pack = game.packs.get(c.pack);
        if (!pack) throw new Error(T("ePackMissing"));
        documentName = pack.documentName;
        // Un compendio carica i documenti su richiesta: li prendiamo tutti e
        // filtriamo per cartella (root + eventuali sottocartelle).
        const root = c.exFolder ? pack.folders.get(c.exFolder) : null;
        const allowed = root ? new Set([root.id, ...(c.subfolders ? root.getSubfolders(true).map((f) => f.id) : [])]) : null;
        rootName = root ? root.name : pack.title;
        sourceLabel = root ? T("srcPackFolder", { title: pack.title, path: folderPath(root) }) : T("srcPack", { title: pack.title });
        for (const doc of await pack.getDocuments()) {
          const f = doc.folder ?? null;
          if (allowed && !allowed.has(f?.id)) continue;
          if (!allowed && !c.subfolders && f) continue; // tutto il compendio senza sottocartelle = solo la radice
          entries.push(entryOf(doc, f, root, opts));
        }
      } else {
        documentName = c.source;
        if (c.exFolder) {
          const root = game.folders.get(c.exFolder);
          if (!root) throw new Error(T("eFolderMissing"));
          rootName = root.name;
          sourceLabel = T("srcFolder", { path: folderPath(root) });
          const folders = [root, ...(c.subfolders ? root.getSubfolders(true) : [])];
          for (const f of folders) {
            for (const doc of f.contents) entries.push(entryOf(doc, f, root, opts));
          }
        } else {
          // "tutto": ogni documento di quel tipo, coi percorsi completi.
          rootName = DOC_LABELS[c.source];
          sourceLabel = T("srcAll", { label: rootName });
          for (const doc of game.collections.get(c.source) ?? []) {
            if (!c.subfolders && doc.folder) continue;
            entries.push(entryOf(doc, doc.folder, null, opts));
          }
        }
      }
    } catch (err) {
      console.error("Actor Forge export:", err);
      return ui.notifications.error(T("eFail", { msg: err.message }));
    }
    if (!entries.length) return ui.notifications.warn(T("eEmpty", { src: sourceLabel }));
    entries.sort((x, y) => x.path.localeCompare(y.path) || String(x.data.name).localeCompare(String(y.data.name)));

    const base = safeName(c.filename || rootName || "export");
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    if (c.format === "zip") {
      // Un .json per documento, nelle sue cartelle; nomi doppi → " (2)".
      const used = new Set();
      const files = entries.map((e) => {
        const dir = [rootName, ...e.folders].filter(Boolean).map(safeName).join("/");
        let name = `${dir}/${safeName(e.data.name)}.json`;
        for (let n = 2; used.has(name.toLowerCase()); n++) name = `${dir}/${safeName(e.data.name)} (${n}).json`;
        used.add(name.toLowerCase());
        return { name, text: JSON.stringify(e.data, null, 2) };
      });
      const blob = await makeZip(files);
      save(blob, "application/zip", `${base}.zip`);
      ui.notifications.info(T("eZipDone", { n: files.length, src: sourceLabel, file: `${base}.zip`, mb: (blob.size / 1048576).toFixed(1) }));
    } else {
      const file = {
        tafysForgeExport: FORMAT, documentName, rootName, source: sourceLabel,
        exportedAt: new Date().toISOString(), foundry: game.version, system: `${game.system.id} ${game.system.version}`,
        count: entries.length, entries,
      };
      save(JSON.stringify(file, null, 2), "application/json", `${base}.json`);
      ui.notifications.info(T("eJsonDone", { n: entries.length, src: sourceLabel, file: `${base}.json` }));
    }
  }

  /**
   * ZIP scritto a mano (il formato è semplice: per ogni file un'intestazione
   * locale + i dati, poi la "directory centrale" e un record di chiusura).
   * Comprimiamo col DEFLATE nativo del browser (CompressionStream); se non è
   * disponibile, o non conviene, il file viene salvato senza compressione.
   * Nessuna libreria da scaricare: funziona anche offline.
   */
  async function makeZip(files) {
    const enc = new TextEncoder();
    const table = new Uint32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    const crc32 = (bytes) => {
      let c = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
    const deflate = async (bytes) => {
      if (typeof CompressionStream === "undefined") return null;
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch { return null; }
    };
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = enc.encode(f.text);
      const crc = crc32(data);
      let body = await deflate(data);
      let method = 8;
      if (!body || body.length >= data.length) { body = data; method = 0; }
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // bit 11: nomi in UTF-8
      local.setUint16(8, method, true);
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, body);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, method, true);
      cen.setUint16(12, dosTime, true);
      cen.setUint16(14, dosDate, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, body.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const centralSize = central.reduce((s, b) => s + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  // ======================================================================
  // 📥 IMPORTA
  // ======================================================================
  async function importDocuments(c) {
    // 1) Raccolta: testo incollato + file scelti.
    const payloads = [];
    if (c.json.trim()) payloads.push({ label: T("iPasted"), text: c.json });
    for (const f of c.files) payloads.push({ label: f.name, text: await f.text() });
    if (!payloads.length) return ui.notifications.warn(T("iNothing"));

    // 2) Parse e normalizzazione in "entry" { data, path, root, docName }.
    const problems = [];
    const entries = [];
    for (const p of payloads) {
      let parsed;
      try { parsed = JSON.parse(p.text); } catch (err) {
        problems.push(T("iBadJson", { from: p.label, msg: err.message }));
        continue;
      }
      // a) File di BOZZA dell'app (ha il marchio "app"): non è un export.
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (list.some((x) => x && x.app === "tafys-actor-forge")) {
        return ui.notifications.error(T("iDraft"));
      }
      if (parsed && parsed.tafysForgeExport) {
        // b) File della scheda Esporta: tipo, cartella d'origine e percorsi.
        for (const e of parsed.entries ?? []) {
          entries.push({ data: e.data, path: e.path ?? "", folders: Array.isArray(e.folders) ? e.folders : null, root: parsed.rootName ?? "", docName: parsed.documentName ?? inferDocumentName(e.data), from: p.label });
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
      if (!d || typeof d !== "object" || !d.name) { problems.push(T("iNoName", { from: e.from })); continue; }
      if (!e.docName || !SUPPORTED.includes(e.docName)) { problems.push(T("iUnknown", { from: e.from, name: d.name })); continue; }
      if ((e.docName === "Actor" || e.docName === "Item") && (!d.type || !d.system)) {
        problems.push(T("iInvalid", { from: e.from, name: d.name }));
        continue;
      }
      valid.push(e);
    }

    // 4) Destinazione: mondo o compendio.
    let pack = null;
    if (c.dest.startsWith("pack|")) {
      pack = game.packs.get(c.dest.slice(5));
      if (!pack) return ui.notifications.error(T("iPackMissing"));
      if (!game.user.isGM) return ui.notifications.error(T("iGmOnly"));
      // Un compendio accetta un solo tipo di documento: il resto lo saltiamo.
      for (const e of valid.filter((x) => x.docName !== pack.documentName)) {
        problems.push(T("iWrongType", { name: e.data.name, type: DOC_LABELS[e.docName], packType: DOC_LABELS[pack.documentName] }));
      }
      valid.splice(0, valid.length, ...valid.filter((x) => x.docName === pack.documentName));
      if (valid.length && pack.locked) {
        if (!c.unlock) return ui.notifications.error(T("iLocked", { title: pack.title }));
        await pack.configure({ locked: false });
      }
      if (c.keepIds) await pack.getIndex(); // per controllare gli ID già presenti
    }
    if (!valid.length) return reportProblems(problems, T("iNone"));

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
        // La radice si cerca per nome (come sempre fatto da questa macro);
        // le sottocartelle si cercano DENTRO la cartella genitore.
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
    //      attività ed effetti si riferiscono l'uno all'altro tramite _id.
    const usedIds = new Set();
    let reIds = 0;
    const idTaken = (docName, id) => usedIds.has(id) || (pack ? pack.index.has(id) : game.collections.get(docName)?.has(id));
    const groups = new Map();
    for (const e of valid) {
      const clone = foundry.utils.deepClone(e.data);
      const root = rootField(e.docName) || e.root;
      // `folders` (livelli espliciti) se c'è; i file v0.33 hanno solo `path`.
      const sub = e.folders ?? String(e.path || "").split("/");
      const segments = [root, ...sub].map((s) => String(s || "").trim()).filter(Boolean);
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
        if (!cls) { problems.push(T("iNoClass", { type: DOC_LABELS[docName] })); continue; }
        const made = await cls.createDocuments(list, { keepId: true, ...(pack ? { pack: pack.collection } : {}) });
        created.push(...made);
        counts.push(`${made.length} ${DOC_LABELS[docName].toLowerCase()}`);
      }
    } catch (err) {
      console.error("Actor Forge importer:", err);
      return ui.notifications.error(T("iFail", { msg: err.message }));
    }
    const where = pack ? T("iInPack", { title: pack.title }) : "";
    const names = created.slice(0, 8).map((d) => d.name).join(", ") + (created.length > 8 ? "…" : "");
    ui.notifications.info(T("iDone", { n: created.length, where, counts: counts.join(" · "), names }));
    if (reIds) ui.notifications.warn(T("iReIds", { n: reIds }));
    if (problems.length) reportProblems(problems);
    // Comodità: se ne hai importato uno solo nel mondo, apriamo la sua scheda.
    if (!pack && created.length === 1) created[0].sheet?.render(true);
  }

  // Avvisi raccolti: i primi in notifica, l'elenco completo in console (F12).
  function reportProblems(problems, headline) {
    if (headline && !problems.length) return ui.notifications.warn(`Actor Forge: ${headline}.`);
    console.warn(T("rpConsole") + "\n" + problems.join("\n"));
    ui.notifications.warn(T("rpWarn", { head: headline ? headline + " — " : "", n: problems.length, first: problems.slice(0, 2).join(" · "), more: problems.length > 2 ? T("rpMore") : "" }));
  }
})();
