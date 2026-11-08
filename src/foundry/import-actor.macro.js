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
      world: "Il mondo", packDest: "Compendio · {title}", pkgWorld: "Mondo",
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
      srcPack: "compendio «{title}» ({pkg})", srcPackFolder: "compendio «{title}» ({pkg}) › {path}",
      srcFolder: "cartella «{path}»", srcAll: "tutti i documenti di «{label}»",
      eFail: "Actor Forge: esportazione fallita — {msg}", eEmpty: "Actor Forge: nessun documento in {src}.",
      eZipDone: "Actor Forge: esportati {n} file da {src} → {file} ({mb} MB)",
      eJsonDone: "Actor Forge: esportati {n} documenti da {src} → {file}",
      eLoading: "Actor Forge: esporto {n} documenti da {src}…",
      eMissing: "Actor Forge: {n} documenti non sono stati caricati (dettagli in console, F12).",
      eZipLimit: "zip troppo grande (oltre 65.535 file o 4 GB): esporta una cartella alla volta",
      eStopped: "Actor Forge: esportazione interrotta.",
      packsMulti: "Compendi — più di uno ({n})", multiFilter: "Filtra per modulo, compendio o tipo…",
      selVisible: "Seleziona visibili", selNone: "Nessuno", selCount: "{n} selezionati",
      multiHint: "Un file per compendio, «Modulo - Compendio», con tutte le sottocartelle.",
      stop: "⏹ Interrompi", stopAsked: "Interruzione richiesta: mi fermo dopo il blocco in corso…",
      destDir: "Cartella di destinazione", dirPick: "📁 Scegli…", dirNone: "Download del browser", dirClear: "Torna ai Download",
      dirUnsupported: "Questo browser non permette di scegliere una cartella: i file vanno nei Download (serve Chrome o Edge).",
      dirHint: "Nella cartella scelta i file con lo stesso nome vengono sostituiti. La scelta vale finché non ricarichi Foundry.",
      dirDenied: "permesso negato", dirFail: "Actor Forge: non riesco a scrivere nella cartella scelta ({msg}): scarico nei Download.",
      mNone: "Actor Forge: spunta almeno un compendio.", mStep: "({i}/{tot}) {label}…",
      mDone: "Actor Forge: esportati {n} di {tot} compendi.", mStopped: "Actor Forge: interrotto, esportati {n} di {tot} compendi.",
      mItem: "✔ {file} — {count} voci", mErr: "✖ {label}: {msg}",
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
      world: "The world", packDest: "Compendium · {title}", pkgWorld: "World",
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
      srcPack: "compendium “{title}” ({pkg})", srcPackFolder: "compendium “{title}” ({pkg}) › {path}",
      srcFolder: "folder “{path}”", srcAll: "all documents in “{label}”",
      eFail: "Actor Forge: export failed — {msg}", eEmpty: "Actor Forge: no documents in {src}.",
      eZipDone: "Actor Forge: exported {n} files from {src} → {file} ({mb} MB)",
      eJsonDone: "Actor Forge: exported {n} documents from {src} → {file}",
      eLoading: "Actor Forge: exporting {n} documents from {src}…",
      eMissing: "Actor Forge: {n} documents could not be loaded (details in the console, F12).",
      eZipLimit: "zip too large (over 65,535 files or 4 GB): export one folder at a time",
      eStopped: "Actor Forge: export stopped.",
      packsMulti: "Compendiums — several ({n})", multiFilter: "Filter by module, compendium or type…",
      selVisible: "Select visible", selNone: "None", selCount: "{n} selected",
      multiHint: "One file per compendium, “Module - Compendium”, with every subfolder.",
      stop: "⏹ Stop", stopAsked: "Stop requested: finishing the current batch…",
      destDir: "Destination folder", dirPick: "📁 Choose…", dirNone: "Browser downloads", dirClear: "Back to downloads",
      dirUnsupported: "This browser can’t choose a folder: files go to Downloads (use Chrome or Edge).",
      dirHint: "Files with the same name are replaced in the chosen folder. The choice lasts until you reload Foundry.",
      dirDenied: "permission denied", dirFail: "Actor Forge: can’t write to the chosen folder ({msg}): downloading instead.",
      mNone: "Actor Forge: tick at least one compendium.", mStep: "({i}/{tot}) {label}…",
      mDone: "Actor Forge: exported {n} of {tot} compendiums.", mStopped: "Actor Forge: stopped, exported {n} of {tot} compendiums.",
      mItem: "✔ {file} — {count} entries", mErr: "✖ {label}: {msg}",
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
  /**
   * `root` + tutte le sue sottocartelle, a ogni livello, ricavate dai
   * genitori. NON usiamo Folder#getSubfolders: cerca solo fra le cartelle
   * del MONDO e su una cartella di compendio restituisce un elenco vuoto
   * (export di "Mostri 2014" → "nessun documento").
   */
  const descendantIds = (root, pool) => {
    const ids = new Set([root.id]);
    const list = [...(pool ?? [])];
    for (let grew = true; grew;) {
      grew = false;
      for (const f of list) {
        const parent = f.folder?.id ?? null;
        if (parent && ids.has(parent) && !ids.has(f.id)) { ids.add(f.id); grew = true; }
      }
    }
    return ids;
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
    .tfx-io:not(.src-packs) .tfx-multi, .tfx-io.src-packs .tfx-single { display: none !important; }
    .tfx-io .tfx-multi { display: flex; flex-direction: column; gap: .35rem; }
    .tfx-io .tfx-bar { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    .tfx-io .tfx-bar input[type="search"] { flex: 1 1 14rem; }
    .tfx-io .tfx-bar button { flex: 0 0 auto; width: auto; }
    .tfx-io .tfx-list { max-height: min(32vh, 300px); overflow-y: auto; display: flex; flex-direction: column; gap: .3rem; padding-right: .25rem; }
    .tfx-io .tfx-list fieldset { margin: 0; padding: .2rem .5rem .35rem; border: 1px solid rgba(127,127,127,.35); border-radius: 4px; }
    .tfx-io .tfx-list legend { padding: 0 .25rem; font-weight: bold; }
    .tfx-io .tfx-list label { flex-direction: row; align-items: center; gap: .4rem; }
    .tfx-io .tfx-list label input { flex: none; margin: 0; }
    .tfx-io .tfx-pk { padding-left: 1.1rem; }
    .tfx-io .tfx-meta { opacity: .65; font-size: .9em; }
    .tfx-io .tfx-hidden { display: none !important; }
    .tfx-io .tfx-dirname { font-weight: bold; }
    .tfx-io .tfx-status { margin: 0; padding: .3rem .5rem; border-radius: 4px; font-size: .85em; background: rgba(127,127,127,.12); white-space: pre-line; max-height: 9rem; overflow-y: auto; }
    .tfx-io .tfx-status:empty { display: none; }
    .tfx-io .tfx-status[data-level="info"] { color: #7fd18b; }
    .tfx-io .tfx-status[data-level="warn"] { color: #f0a45c; }
    .tfx-io .tfx-status[data-level="error"] { color: #ff7a5c; }
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
  // Compendi raggruppati per PACCHETTO (mondo, moduli, sistema): con
  // decine di compendi lo stesso titolo ("Oggetti", "Mostri") compare in
  // pacchetti diversi e il solo titolo non basta a distinguerli.
  const packageTitle = (p) => {
    const m = p.metadata ?? {};
    try {
      if (m.packageType === "world") return `🌍 ${game.world?.title ?? T("pkgWorld")}`;
      if (m.packageType === "system") return `⚙️ ${game.system?.title ?? m.packageName ?? "?"}`;
      return `🧩 ${game.modules?.get(m.packageName)?.title ?? m.packageName ?? "?"}`;
    } catch { return m.packageName ?? "?"; }
  };
  const packRank = (p) => ({ world: 0, module: 1, system: 2 }[p.metadata?.packageType] ?? 1);
  const packs = game.packs.filter((p) => SUPPORTED.includes(p.documentName)).sort((a, b) =>
    packRank(a) - packRank(b) || packageTitle(a).localeCompare(packageTitle(b)) || String(a.title).localeCompare(String(b.title)));
  // Numero di voci dall'indice (Foundry lo costruisce all'avvio): aiuta a
  // riconoscere il compendio giusto senza aprirlo.
  const packLabel = (p) => {
    const n = p.index?.size ?? 0;
    return `${p.title} · ${DOC_LABELS[p.documentName]}${n ? ` (${n})` : ""}${p.locked ? " 🔒" : ""}`;
  };
  const byPackage = (list, optionHtml) => {
    const groups = new Map();
    for (const p of list) {
      const k = packageTitle(p);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    return [...groups].map(([k, ps]) => `<optgroup label="${esc(k)}">${ps.map(optionHtml).join("")}</optgroup>`).join("");
  };
  const packFolders = Object.fromEntries(packs.map((p) => [p.collection, treeOptions([...(p.folders ?? [])])]));
  const folderOptions = (list, total) =>
    `<option value="">— ${total == null ? T("allPack") : T("allN", { n: total })} —</option>` +
    list.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join("");

  const sourceOptions = worldSources.map((s) => `<option value="${s.type}">${esc(DOC_LABELS[s.type])} (${s.count})</option>`).join("") +
    (packs.length ? `<option value="pack">${esc(T("packs", { n: packs.length }))}</option>` +
      `<option value="packs">${esc(T("packsMulti", { n: packs.length }))}</option>` : "");
  // Stesso ordine di `packs`: la prima opzione del menu è packs[0], quindi
  // le cartelle mostrate all'apertura sono proprio le sue.
  const packOptions = byPackage(packs, (p) => `<option value="${esc(p.collection)}">${esc(packLabel(p))}</option>`);
  // Selezione MULTIPLA: un gruppo di caselle per pacchetto (+ casella "tutto il pacchetto").
  const plainPackage = (p) => packageTitle(p).replace(/^\S+\s/, ""); // senza l'emoji iniziale
  const multiList = (() => {
    const groups = new Map();
    for (const p of packs) {
      const k = packageTitle(p);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    return [...groups].map(([k, ps], gi) => `
      <fieldset class="tfx-group" data-group="${gi}">
        <legend><label><input type="checkbox" class="tfx-all" data-group="${gi}" /> ${esc(k)} <span class="tfx-meta">(${ps.length})</span></label></legend>
        ${ps.map((p) => `<label class="tfx-pk" data-search="${esc(`${k} ${p.title} ${DOC_LABELS[p.documentName]}`.toLowerCase())}">
          <input type="checkbox" name="pk" value="${esc(p.collection)}" data-group="${gi}" /> <span>${esc(packLabel(p))}</span></label>`).join("")}
      </fieldset>`).join("");
  })();
  // Cartella di destinazione (File System Access API: Chrome / Edge). La
  // cartella scelta resta in memoria finché la pagina di Foundry non si ricarica.
  const DIR_KEY = "__tafysForgeExportDir";
  const canPickDir = typeof globalThis.showDirectoryPicker === "function";
  const dirLabel = () => globalThis[DIR_KEY]?.name ?? T("dirNone");
  const firstSource = worldSources[0]?.type ?? (packs.length ? "pack" : "");
  const firstFolders = firstSource === "pack"
    ? folderOptions(packFolders[packs[0]?.collection] ?? [], null)
    : folderOptions(worldSources[0]?.folders ?? [], worldSources[0]?.count ?? 0);
  const destOptions = `<option value="world">${esc(T("world"))}</option>` +
    byPackage(packs, (p) => `<option value="pack|${esc(p.collection)}">${esc(T("packDest", { title: packLabel(p) }))}</option>`);

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
      <div class="tfx-multi">
        <div class="tfx-bar">
          <input type="search" name="pkFilter" placeholder="${esc(T("multiFilter"))}" />
          <button type="button" class="tfx-sel-all">${esc(T("selVisible"))}</button>
          <button type="button" class="tfx-sel-none">${esc(T("selNone"))}</button>
          <span class="tfx-count tfx-meta">${esc(T("selCount", { n: 0 }))}</span>
        </div>
        <div class="tfx-list">${multiList}</div>
        <p class="tfx-hint">${esc(T("multiHint"))}</p>
      </div>
      <label class="tfx-single">${esc(T("folder"))}
        <select name="exFolder">${firstFolders}</select>
      </label>
      <div class="tfx-g2">
        <div class="tfx-checks tfx-single"><label><input type="checkbox" name="subfolders" checked /> ${esc(T("subfolders"))}</label></div>
        <div class="tfx-checks">
          <label title="${esc(T("singleTitle"))}">
            <input type="radio" name="format" value="single" checked /> ${esc(T("single"))}</label>
          <label title="${esc(T("zipTitle"))}">
            <input type="radio" name="format" value="zip" /> ${esc(T("zip"))}</label>
        </div>
      </div>
      <label class="tfx-single">${esc(T("filename"))} <input type="text" name="filename" placeholder="${esc(T("filenamePh"))}" /></label>
      <div class="tfx-bar">
        <span>${esc(T("destDir"))}:</span> <span class="tfx-dirname">${esc(dirLabel())}</span>
        <button type="button" class="tfx-dir-pick"${canPickDir ? "" : " disabled"}>${esc(T("dirPick"))}</button>
        <button type="button" class="tfx-dir-clear" title="${esc(T("dirClear"))}">✕</button>
      </div>
      <p class="tfx-hint">${esc(canPickDir ? T("dirHint") : T("dirUnsupported"))} ${esc(T("expHint"))}</p>
      <div class="tfx-bar"><button type="button" class="tfx-stop" disabled>${esc(T("stop"))}</button></div>
    </div>
    <p class="tfx-status" role="status" aria-live="polite"></p>
  </div>`;

  const refreshExport = (root) => {
    const src = root.querySelector('[name="source"]').value;
    root.classList.toggle("src-pack", src === "pack");
    root.classList.toggle("src-packs", src === "packs");
    if (src === "packs") return;
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
  // Selezione multipla: caselle visibili (rispettano il filtro) e contatore.
  const visibleBoxes = (root) => [...root.querySelectorAll('input[name="pk"]')].filter((b) => !b.closest(".tfx-pk")?.classList.contains("tfx-hidden"));
  const refreshCount = (root) => {
    const c = root.querySelector(".tfx-count");
    if (c) c.textContent = T("selCount", { n: root.querySelectorAll('input[name="pk"]:checked').length });
    for (const all of root.querySelectorAll(".tfx-all")) {
      const boxes = visibleBoxes(root).filter((b) => b.dataset.group === all.dataset.group);
      all.checked = boxes.length > 0 && boxes.every((b) => b.checked);
      all.indeterminate = !all.checked && boxes.some((b) => b.checked); // pacchetto scelto solo in parte
    }
  };
  let cancel = false;
  const onClick = (ev) => {
    const root = mine(ev);
    if (!root) return;
    if (ev.target.closest(".tfx-sel-all")) { visibleBoxes(root).forEach((b) => { b.checked = true; }); return refreshCount(root); }
    if (ev.target.closest(".tfx-sel-none")) { root.querySelectorAll('input[name="pk"]').forEach((b) => { b.checked = false; }); return refreshCount(root); }
    if (ev.target.closest(".tfx-stop")) { cancel = true; return say("warn", T("stopAsked")); }
    if (ev.target.closest(".tfx-dir-clear")) {
      globalThis[DIR_KEY] = null;
      root.querySelector(".tfx-dirname").textContent = dirLabel();
      return;
    }
    if (ev.target.closest(".tfx-dir-pick") && canPickDir) {
      // Il selettore va aperto DENTRO il clic (il browser lo richiede).
      globalThis.showDirectoryPicker({ id: "tafys-forge-export", mode: "readwrite" })
        .then((h) => { globalThis[DIR_KEY] = h; root.querySelector(".tfx-dirname").textContent = dirLabel(); })
        .catch(() => { /* annullato */ });
      return;
    }
    const tab = ev.target.closest(".tfx-tab");
    if (!tab) return;
    ev.preventDefault();
    const exp = tab.classList.contains("tfx-tab-export");
    root.classList.toggle("is-export", exp);
    root.classList.toggle("is-import", !exp);
    setGoLabel(root);
  };
  const onChange = (ev) => {
    const root = mine(ev);
    if (!root) return;
    if (ev.target.name === "source" || ev.target.name === "pack") refreshExport(root);
    if (ev.target.classList?.contains("tfx-all")) {
      visibleBoxes(root).filter((b) => b.dataset.group === ev.target.dataset.group).forEach((b) => { b.checked = ev.target.checked; });
    }
    if (ev.target.name === "pk" || ev.target.classList?.contains("tfx-all")) refreshCount(root);
    // Finestra che resta aperta: cambiando cosa esportare, il nome file
    // scritto per l'export precedente non deve "trascinarsi" su quello nuovo.
    if (["source", "pack", "exFolder"].includes(ev.target.name)) {
      const fn = root.querySelector('[name="filename"]');
      if (fn) fn.value = "";
    }
  };
  const onInput = (ev) => {
    const root = mine(ev);
    if (!root || ev.target.name !== "pkFilter") return;
    const q = ev.target.value.trim().toLowerCase();
    for (const lab of root.querySelectorAll(".tfx-pk")) lab.classList.toggle("tfx-hidden", !!q && !lab.dataset.search.includes(q));
    for (const fs of root.querySelectorAll(".tfx-group")) fs.classList.toggle("tfx-hidden", !fs.querySelector(".tfx-pk:not(.tfx-hidden)"));
    refreshCount(root);
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("input", onInput, true);

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
      packs: [...form.querySelectorAll('input[name="pk"]:checked')].map((b) => b.value),
    };
  };

  // ---------- Esecuzione: la finestra RESTA APERTA ----------
  // Ogni clic su "Importa" / "Esporta" esegue l'operazione e lascia la
  // finestra aperta (form.closeOnSubmit: false): si possono fare più export
  // di fila e si chiude con la X. DialogV2 chiama `submit` a ogni invio con
  // il valore restituito dal callback del pulsante (qui: i campi del modulo).
  // L'esito compare nella riga di stato della finestra e nelle notifiche.
  let statusEl = null;
  const say = (level, msg, opts) => {
    try { if (statusEl) { statusEl.textContent = msg; statusEl.dataset.level = level; } } catch { /* solo estetica */ }
    return ui.notifications[level](msg, opts);
  };
  // Solo la riga di stato della finestra (niente notifica): per i passaggi
  // intermedi, così 40 compendi non diventano 40 avvisi.
  const status = (msg) => { try { if (statusEl) { statusEl.textContent = msg; statusEl.dataset.level = "info"; } } catch { /* solo estetica */ } };
  let busy = false;
  const run = async (choice, dlg) => {
    if (!choice || typeof choice !== "object" || busy) return; // niente doppio clic durante un export
    const el = dlg?.element;
    const root = el?.querySelector?.(`.tfx-io-${u}`);
    const btn = el?.querySelector?.('button[data-action="go"]');
    const stopBtn = root?.querySelector?.(".tfx-stop");
    statusEl = root?.querySelector?.(".tfx-status") ?? null;
    busy = true;
    cancel = false;
    if (btn) btn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    try {
      if (choice.tab === "export" && choice.source === "packs") await exportMany(choice);
      else if (choice.tab === "export") await exportDocuments(choice);
      else if ((await importDocuments(choice)) === true && root) {
        // Importato: svuotiamo testo e file, così un secondo clic non duplica.
        const pasted = root.querySelector('[name="payload"]');
        const picked = root.querySelector('[name="files"]');
        if (pasted) pasted.value = "";
        if (picked) picked.value = "";
      }
    } catch (err) {
      console.error("Actor Forge:", err);
      say("error", T(choice.tab === "export" ? "eFail" : "iFail", { msg: err.message }));
    } finally {
      busy = false;
      cancel = false;
      if (btn) btn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
    }
  };
  const cleanup = () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("input", onInput, true);
    cancel = true; // finestra chiusa durante un export: ci si ferma
  };
  let dialog = null;
  try {
    dialog = new DialogV2({
      window: { title: T("title"), resizable: true },
      position: { width: 760 },
      content,
      form: { closeOnSubmit: false },
      buttons: [{
        action: "go", label: T("goImport"), icon: "fa-solid fa-play", default: true,
        callback: (event, button) => readForm(button.form),
      }],
      submit: (choice, dlg) => run(choice, dlg ?? dialog),
    });
    // Alla chiusura (X) togliamo i listener delegati.
    dialog.addEventListener?.("close", cleanup, { once: true });
    await dialog.render({ force: true });
  } catch (err) {
    cleanup();
    console.error("Actor Forge:", err);
    return ui.notifications.error(T("eFail", { msg: err.message }));
  }
  return;

  // ======================================================================
  // 📤 ESPORTA
  // ======================================================================
  /**
   * PREPARA il file di un export (un compendio, una cartella o "tutto")
   * senza consegnarlo: { blob, mime, filename, count, … } oppure
   * { level, msg } in caso di problema, { stopped } se interrotto.
   */
  async function buildExport(c, progressIn = null) {
    if (!c.source) return { level: "warn", msg: T("eNothing") };
    // toCompendium() = gli stessi dati dell'export nativo, ripuliti
    // (ownership, stato). Teniamo gli _id (servono a "Mantieni gli ID") e
    // l'ordinamento; la cartella la sostituiamo col PERCORSO relativo.
    const opts = { clearFolder: true, clearSort: false, keepId: true };
    const BATCH = 25; // documenti chiesti al server per volta
    let documentName;
    let pkgInfo = null; // compendio: pacchetto e collezione d'origine nel file
    let rootName;
    let sourceLabel;
    let root = null;
    let plan = [];   // [{ id, name, folder }] — cosa esportare, SENZA i dati
    let loadBatch;   // (voci del piano) => Promise<Document[]> nello STESSO ordine
    try {
      if (c.source === "pack") {
        const pack = game.packs.get(c.pack);
        if (!pack) throw new Error(T("ePackMissing"));
        documentName = pack.documentName;
        pkgInfo = { package: { type: pack.metadata?.packageType ?? null, id: pack.metadata?.packageName ?? null, title: plainPackage(pack) }, pack: pack.collection };
        root = c.exFolder ? pack.folders.get(c.exFolder) : null;
        const allowed = root ? (c.subfolders ? descendantIds(root, pack.folders) : new Set([root.id])) : null;
        rootName = root ? root.name : pack.title;
        const pkg = packageTitle(pack);
        sourceLabel = root ? T("srcPackFolder", { title: pack.title, pkg, path: folderPath(root) }) : T("srcPack", { title: pack.title, pkg });
        // Un compendio NON va caricato tutto insieme: con migliaia di mostri
        // il server deve leggere e spedire centinaia di MB in una risposta
        // sola e può riavviarsi. Prima leggiamo l'INDICE (solo _id, nome,
        // cartella: leggerissimo), scegliamo cosa serve, poi carichiamo a
        // blocchi con una query sugli _id.
        const index = await pack.getIndex({ fields: ["folder"] });
        for (const e of index) {
          const fid = e.folder ?? null;
          if (allowed && !allowed.has(fid)) continue;
          if (!allowed && !c.subfolders && fid) continue; // tutto il compendio senza sottocartelle = solo la radice
          plan.push({ id: e._id, name: e.name, folder: fid ? pack.folders.get(fid) ?? null : null });
        }
        loadBatch = async (slice) => {
          const got = await pack.getDocuments({ _id__in: slice.map((p) => p.id) });
          const byId = new Map((got ?? []).filter(Boolean).map((d) => [d.id, d]));
          return slice.map((p) => byId.get(p.id)); // undefined = non restituito dal server
        };
      } else {
        documentName = c.source;
        const coll = game.collections.get(c.source);
        if (c.exFolder) {
          root = game.folders.get(c.exFolder);
          if (!root) throw new Error(T("eFolderMissing"));
          rootName = root.name;
          sourceLabel = T("srcFolder", { path: folderPath(root) });
          const ids = c.subfolders ? descendantIds(root, game.folders) : new Set([root.id]);
          for (const f of [...ids].map((id) => game.folders.get(id)).filter(Boolean)) {
            for (const doc of f.contents) plan.push({ id: doc.id, name: doc.name, folder: f, doc });
          }
        } else {
          // "tutto": ogni documento di quel tipo, coi percorsi completi.
          rootName = DOC_LABELS[c.source];
          sourceLabel = T("srcAll", { label: rootName });
          for (const doc of coll ?? []) {
            if (!c.subfolders && doc.folder) continue;
            plan.push({ id: doc.id, name: doc.name, folder: doc.folder ?? null, doc });
          }
        }
        // Nel mondo i documenti sono già in memoria: li abbiamo nel piano.
        loadBatch = async (slice) => slice.map((p) => p.doc);
      }
    } catch (err) {
      console.error("Actor Forge export:", err);
      return { level: "error", msg: T("eFail", { msg: err.message }) };
    }
    if (!plan.length) return { level: "warn", msg: T("eEmpty", { src: sourceLabel }) };

    // Percorsi e ordine (cartella, poi nome) decisi PRIMA di caricare.
    plan = plan.map((p) => {
      const folders = p.folder ? folderParts(p.folder, root) : [];
      return { ...p, folders, path: folders.join("/") };
    });
    plan.sort((x, y) => x.path.localeCompare(y.path) || String(x.name).localeCompare(String(y.name)));

    const base = safeName(c.filename || rootName || "export");
    const zip = c.format === "zip" ? createZip() : null;
    const parts = [];      // file unico: un pezzo di testo per documento
    const used = new Set(); // zip: nomi già usati (doppioni → " (2)")
    let missing = 0;
    const progress = progressIn ?? startProgress(T("eLoading", { n: plan.length, src: sourceLabel }));
    try {
      for (let i = 0; i < plan.length; i += BATCH) {
        if (cancel) { progress.done(); return { stopped: true }; } // ⏹ Interrompi o finestra chiusa
        const slice = plan.slice(i, i + BATCH);
        const docs = await loadBatch(slice);
        for (let k = 0; k < slice.length; k++) {
          const p = slice[k];
          const doc = docs[k];
          if (!doc) { missing += 1; console.warn("Actor Forge export: non caricato", p.id, p.name); continue; }
          const data = doc.toCompendium(null, opts);
          if (zip) {
            const dir = [rootName, ...p.folders].filter(Boolean).map(safeName).join("/");
            let name = `${dir}/${safeName(data.name)}.json`;
            for (let n = 2; used.has(name.toLowerCase()); n++) name = `${dir}/${safeName(data.name)} (${n}).json`;
            used.add(name.toLowerCase());
            await zip.add(name, JSON.stringify(data, null, 2));
          } else {
            // Una riga per documento: il file resta compatto e leggibile a righe.
            parts.push(JSON.stringify({ path: p.path, folders: p.folders, data }));
          }
        }
        progress.update((i + slice.length) / plan.length);
      }
    } catch (err) {
      progress.done();
      console.error("Actor Forge export:", err);
      return { level: "error", msg: T("eFail", { msg: err.message }) };
    }
    progress.done();

    if (zip) {
      if (!zip.count) return { level: "warn", msg: T("eEmpty", { src: sourceLabel }) };
      let blob;
      try { blob = zip.finish(); } catch (err) { return { level: "error", msg: T("eFail", { msg: err.message }) }; }
      return { zip: true, blob, mime: "application/zip", filename: `${base}.zip`, count: zip.count, sourceLabel, missing };
    }
    if (!parts.length) return { level: "warn", msg: T("eEmpty", { src: sourceLabel }) };
    const head = JSON.stringify({
      tafysForgeExport: FORMAT, documentName, rootName, source: sourceLabel, ...(pkgInfo ?? {}),
      exportedAt: new Date().toISOString(), foundry: game.version, system: `${game.system.id} ${game.system.version}`,
      count: parts.length,
    }).slice(0, -1) + ',\n"entries":[\n';
    // Il Blob si compone dai pezzi: niente stringa unica gigante (un
    // compendio intero supererebbe il limite di lunghezza delle stringhe).
    const chunks = [head];
    parts.forEach((p, k) => chunks.push(k ? ",\n" + p : p));
    chunks.push("\n]}\n");
    return { blob: new Blob(chunks, { type: "application/json" }), mime: "application/json", filename: `${base}.json`, count: parts.length, sourceLabel, missing };
  }

  /**
   * CONSEGNA un file: nella cartella scelta (File System Access API, Chrome /
   * Edge) oppure, se non c'è o non si può scrivere, come download normale.
   * Restituisce il nome mostrato all'utente ("Cartella/file.json").
   */
  async function deliver(blob, mime, filename) {
    const dir = globalThis[DIR_KEY];
    if (dir) {
      try {
        // Il browser può chiedere di nuovo il permesso (vale finché la pagina è aperta).
        let perm = (await dir.queryPermission?.({ mode: "readwrite" })) ?? "granted";
        if (perm !== "granted") perm = (await dir.requestPermission?.({ mode: "readwrite" })) ?? "denied";
        if (perm !== "granted") throw new Error(T("dirDenied"));
        const fh = await dir.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        return `${dir.name}/${filename}`;
      } catch (err) {
        console.warn("Actor Forge export:", err);
        say("warn", T("dirFail", { msg: err.message }));
      }
    }
    (foundry.utils.saveDataToFile ?? globalThis.saveDataToFile)(blob, mime, filename);
    return filename;
  }

  /** Export di UNA sorgente (cartella, "tutto" o un compendio). */
  async function exportDocuments(c) {
    const r = await buildExport(c);
    if (r.stopped) return say("warn", T("eStopped"));
    if (r.msg) return say(r.level, r.msg);
    if (r.missing) say("warn", T("eMissing", { n: r.missing }));
    const file = await deliver(r.blob, r.mime, r.filename);
    if (r.zip) say("info", T("eZipDone", { n: r.count, src: r.sourceLabel, file, mb: (r.blob.size / 1048576).toFixed(1) }));
    else say("info", T("eJsonDone", { n: r.count, src: r.sourceLabel, file }));
  }

  /**
   * Export di PIÙ compendi: un file per compendio, "Modulo - Compendio",
   * con tutte le sottocartelle. Uno dopo l'altro (un errore non ferma gli
   * altri), una barra di avanzamento unica, ⏹ Interrompi tra un blocco e l'altro.
   */
  async function exportMany(c) {
    const chosen = packs.filter((p) => (c.packs ?? []).includes(p.collection));
    if (!chosen.length) return say("warn", T("mNone"));
    const used = new Set();
    const done = [];
    const failed = [];
    const progress = startProgress(T("mStep", { i: 1, tot: chosen.length, label: plainPackage(chosen[0]) + " - " + chosen[0].title }));
    for (const [k, p] of chosen.entries()) {
      if (cancel) break;
      const label = `${plainPackage(p)} - ${p.title}`;
      const step = T("mStep", { i: k + 1, tot: chosen.length, label });
      status(step);
      if (k) progress.update(k / chosen.length, step); // il testo della barra segue il compendio in corso
      let name = safeName(label);
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${safeName(label)} (${n})`;
      used.add(name.toLowerCase());
      const one = { update: (pct) => progress.update((k + pct) / chosen.length), done: () => {} };
      try {
        const r = await buildExport({ ...c, source: "pack", pack: p.collection, exFolder: "", subfolders: true, filename: name }, one);
        if (r.stopped) break;
        if (r.msg) { failed.push(T("mErr", { label, msg: r.msg.replace(/^Actor Forge:\s*/, "") })); continue; }
        const file = await deliver(r.blob, r.mime, r.filename);
        done.push(T("mItem", { file, count: r.count }));
        await new Promise((ok) => setTimeout(ok, 400)); // il browser accetta meglio i download in fila
      } catch (err) {
        console.error("Actor Forge export:", p.collection, err);
        failed.push(T("mErr", { label, msg: err.message }));
      }
    }
    progress.done();
    const head = cancel ? T("mStopped", { n: done.length, tot: chosen.length }) : T("mDone", { n: done.length, tot: chosen.length });
    const report = [head, ...done, ...failed].join("\n");
    console.log(report);
    say(failed.length || cancel ? "warn" : "info", report);
  }

  /**
   * Barra di avanzamento nelle notifiche (Foundry 13: { progress: true }
   * restituisce una notifica con update({ pct })). Se la versione non la
   * supporta resta un semplice messaggio iniziale.
   */
  function startProgress(message) {
    let note = null;
    try { note = say("info", message, { progress: true }); } catch { /* solo estetica */ }
    const set = (pct, msg) => { try { if (typeof note?.update === "function") note.update(msg ? { pct, message: msg } : { pct }); } catch { /* solo estetica */ } };
    return { update: (pct, msg) => set(Math.min(1, Math.max(0, pct)), msg), done: () => set(1) };
  }

  /**
   * ZIP scritto a mano (il formato è semplice: per ogni file un'intestazione
   * locale + i dati, poi la "directory centrale" e un record di chiusura).
   * Ogni file viene compresso APPENA aggiunto (DEFLATE nativo del browser,
   * CompressionStream) e in memoria resta solo la versione compressa: si
   * possono esportare compendi enormi. Senza CompressionStream, o se non
   * conviene, il file viene salvato senza compressione. Nessuna libreria.
   */
  function createZip() {
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
    // Limiti del formato zip classico (senza ZIP64): 65.535 file, 4 GB.
    const MAX_FILES = 0xffff;
    const MAX_BYTES = 0xffffffff;
    const parts = [];
    const central = [];
    let offset = 0;
    let count = 0;
    return {
      get count() { return count; },
      async add(fileName, text) {
        if (count >= MAX_FILES) throw new Error(T("eZipLimit"));
        const name = enc.encode(fileName);
        const data = enc.encode(text);
        const crc = crc32(data);
        let body = await deflate(data);
        let method = 8;
        if (!body || body.length >= data.length) { body = data; method = 0; }
        if (offset + 30 + name.length + body.length > MAX_BYTES) throw new Error(T("eZipLimit"));
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
        count += 1;
      },
      finish() {
        const centralSize = central.reduce((s, b) => s + b.length, 0);
        if (offset + centralSize > MAX_BYTES) throw new Error(T("eZipLimit"));
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, count, true);
        end.setUint16(10, count, true);
        end.setUint32(12, centralSize, true);
        end.setUint32(16, offset, true);
        return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
      },
    };
  }

  // ======================================================================
  // 📥 IMPORTA
  // ======================================================================
  async function importDocuments(c) {
    // 1) Raccolta: testo incollato + file scelti.
    const payloads = [];
    if (c.json.trim()) payloads.push({ label: T("iPasted"), text: c.json });
    for (const f of c.files) payloads.push({ label: f.name, text: await f.text() });
    if (!payloads.length) return say("warn", T("iNothing"));

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
        return say("error", T("iDraft"));
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
      if (!pack) return say("error", T("iPackMissing"));
      if (!game.user.isGM) return say("error", T("iGmOnly"));
      // Un compendio accetta un solo tipo di documento: il resto lo saltiamo.
      for (const e of valid.filter((x) => x.docName !== pack.documentName)) {
        problems.push(T("iWrongType", { name: e.data.name, type: DOC_LABELS[e.docName], packType: DOC_LABELS[pack.documentName] }));
      }
      valid.splice(0, valid.length, ...valid.filter((x) => x.docName === pack.documentName));
      if (valid.length && pack.locked) {
        if (!c.unlock) return say("error", T("iLocked", { title: pack.title }));
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
      return say("error", T("iFail", { msg: err.message }));
    }
    const where = pack ? T("iInPack", { title: pack.title }) : "";
    const names = created.slice(0, 8).map((d) => d.name).join(", ") + (created.length > 8 ? "…" : "");
    say("info", T("iDone", { n: created.length, where, counts: counts.join(" · "), names }));
    if (reIds) say("warn", T("iReIds", { n: reIds }));
    if (problems.length) reportProblems(problems);
    // Comodità: se ne hai importato uno solo nel mondo, apriamo la sua scheda.
    if (!pack && created.length === 1) created[0].sheet?.render(true);
    return true;
  }

  // Avvisi raccolti: i primi in notifica, l'elenco completo in console (F12).
  function reportProblems(problems, headline) {
    if (headline && !problems.length) return say("warn", `Actor Forge: ${headline}.`);
    console.warn(T("rpConsole") + "\n" + problems.join("\n"));
    say("warn", T("rpWarn", { head: headline ? headline + " — " : "", n: problems.length, first: problems.slice(0, 2).join(" · "), more: problems.length > 2 ? T("rpMore") : "" }));
  }
})();
