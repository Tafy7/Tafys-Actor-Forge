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
 * Compatibile con Foundry VTT 13 (DialogV2) e dnd5e 5.3.3.
 */
(async () => {
  // DialogV2 è l'API delle finestre di Foundry 13 (la vecchia Dialog è
  // deprecata). Vive sotto foundry.applications.api.
  const { DialogV2 } = foundry.applications.api;

  // Tipi che sono Actor in dnd5e (tutto ciò che ha type+system e non è un
  // Actor viene trattato come Item: weapon, spell, feat, loot…).
  const ACTOR_TYPES = new Set(["npc", "character", "vehicle", "group"]);
  const DOC_LABELS = {
    Actor: "Attori", Item: "Oggetti", JournalEntry: "Diario", Scene: "Scene (mappe)",
    RollTable: "Tabelle", Macro: "Macro", Playlist: "Playlist", Cards: "Carte",
  };
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
    `<option value="">— ${total == null ? "tutto il compendio" : `tutto (${total})`} —</option>` +
    list.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join("");

  const sourceOptions = worldSources.map((s) => `<option value="${s.type}">${esc(DOC_LABELS[s.type])} (${s.count})</option>`).join("") +
    (packs.length ? `<option value="pack">Compendi (${packs.length})</option>` : "");
  const packOptions = SUPPORTED.map((type) => {
    const list = packs.filter((p) => p.documentName === type);
    return list.length ? `<optgroup label="${esc(DOC_LABELS[type])}">${list
      .map((p) => `<option value="${esc(p.collection)}">${esc(p.title)}${p.locked ? " 🔒" : ""}</option>`).join("")}</optgroup>` : "";
  }).join("");
  const firstSource = worldSources[0]?.type ?? (packs.length ? "pack" : "");
  const firstFolders = firstSource === "pack"
    ? folderOptions(packFolders[packs[0]?.collection] ?? [], null)
    : folderOptions(worldSources[0]?.folders ?? [], worldSources[0]?.count ?? 0);
  const destOptions = `<option value="world">Il mondo</option>${packs
    .map((p) => `<option value="pack|${esc(p.collection)}">Compendio · ${esc(p.title)} (${esc(DOC_LABELS[p.documentName])})${p.locked ? " 🔒" : ""}</option>`).join("")}`;

  // ---------- Finestra ----------
  // Nessuno script nel contenuto (Foundry lo toglierebbe): schede e menu
  // dipendenti si gestiscono con listener DELEGATI sul document, filtrati
  // sulla classe univoca di questa finestra e rimossi alla chiusura.
  const u = foundry.utils.randomID(8);
  const content = `
  <div class="tfx-io tfx-io-${u} is-import${firstSource === "pack" ? " src-pack" : ""}">
    <div class="tfx-tabs">
      <button type="button" class="tfx-tab tfx-tab-import">📥 Importa</button>
      <button type="button" class="tfx-tab tfx-tab-export">📤 Esporta</button>
    </div>

    <div class="tfx-pane tfx-p-imp">
      <textarea name="payload" rows="4" placeholder="Incolla qui il JSON: un documento o un array [ {…}, {…} ]"></textarea>
      <div class="tfx-g2">
        <label>…oppure uno o più file JSON
          <input type="file" name="files" accept=".json,application/json" multiple />
        </label>
        <label>Destinazione
          <select name="dest">${destOptions}</select>
        </label>
      </div>
      <div class="tfx-g3">
        <label>Cartella Actor <input type="text" name="folder" placeholder="es. I Miei Mostri" /></label>
        <label>Cartella Item / Spell <input type="text" name="folderItems" placeholder="es. I Miei Oggetti" /></label>
        <label title="Diario, Scene, Tabelle, Macro, Playlist, Carte">Cartella altri documenti <input type="text" name="folderOther" placeholder="es. Capitolo 1" /></label>
      </div>
      <div class="tfx-checks">
        <label title="Conserva i collegamenti tra documenti (link nei diari, token delle scene verso gli actor). Se un ID esiste già, quel documento ne riceve uno nuovo.">
          <input type="checkbox" name="keepIds" /> Mantieni gli ID originali</label>
        <label title="Solo il GM. Il compendio resta sbloccato dopo l'importazione.">
          <input type="checkbox" name="unlock" /> Sblocca il compendio se bloccato</label>
      </div>
      <p class="tfx-hint">Cartelle vuote = ricrea quelle del file esportato (o nessuna). Passa il mouse sulle opzioni per i dettagli.</p>
    </div>

    <div class="tfx-pane tfx-p-exp">
      <div class="tfx-g2">
        <label>Sorgente
          <select name="source">${sourceOptions || '<option value="">(niente da esportare)</option>'}</select>
        </label>
        <label class="tfx-packfield">Compendio
          <select name="pack">${packOptions}</select>
        </label>
      </div>
      <label>Cartella
        <select name="exFolder">${firstFolders}</select>
      </label>
      <div class="tfx-g2">
        <div class="tfx-checks"><label><input type="checkbox" name="subfolders" checked /> Includi le sottocartelle</label></div>
        <div class="tfx-checks">
          <label title="Un solo .json con tutti i documenti e la struttura delle cartelle: si reimporta dalla scheda Importa.">
            <input type="radio" name="format" value="single" checked /> File unico (.json)</label>
          <label title="Uno .zip con un .json per documento, nelle sue cartelle (vanno bene anche per l'Import Data di Foundry).">
            <input type="radio" name="format" value="zip" /> File singoli (.zip)</label>
        </div>
      </div>
      <label>Nome del file <input type="text" name="filename" placeholder="vuoto = nome della cartella" /></label>
      <p class="tfx-hint">Le scene portano i dati e i percorsi delle immagini, non i file delle immagini.</p>
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
      const label = root.classList.contains("is-export") ? "Esporta" : "Importa";
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
      window: { title: "Actor Forge — Importa / Esporta", resizable: true },
      position: { width: 760 },
      content,
      rejectClose: false,
      buttons: [{
        action: "go", label: "Importa", icon: "fa-solid fa-play", default: true,
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
    if (!c.source) return ui.notifications.warn("Actor Forge: non c'è niente da esportare.");
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
        if (!pack) throw new Error("compendio non trovato");
        documentName = pack.documentName;
        // Un compendio carica i documenti su richiesta: li prendiamo tutti e
        // filtriamo per cartella (root + eventuali sottocartelle).
        const root = c.exFolder ? pack.folders.get(c.exFolder) : null;
        const allowed = root ? new Set([root.id, ...(c.subfolders ? root.getSubfolders(true).map((f) => f.id) : [])]) : null;
        rootName = root ? root.name : pack.title;
        sourceLabel = root ? `compendio «${pack.title}» › ${folderPath(root)}` : `compendio «${pack.title}»`;
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
          if (!root) throw new Error("cartella non trovata");
          rootName = root.name;
          sourceLabel = `cartella «${folderPath(root)}»`;
          const folders = [root, ...(c.subfolders ? root.getSubfolders(true) : [])];
          for (const f of folders) {
            for (const doc of f.contents) entries.push(entryOf(doc, f, root, opts));
          }
        } else {
          // "tutto": ogni documento di quel tipo, coi percorsi completi.
          rootName = DOC_LABELS[c.source];
          sourceLabel = `tutti i documenti di «${rootName}»`;
          for (const doc of game.collections.get(c.source) ?? []) {
            if (!c.subfolders && doc.folder) continue;
            entries.push(entryOf(doc, doc.folder, null, opts));
          }
        }
      }
    } catch (err) {
      console.error("Actor Forge export:", err);
      return ui.notifications.error(`Actor Forge: esportazione fallita — ${err.message}`);
    }
    if (!entries.length) return ui.notifications.warn(`Actor Forge: nessun documento in ${sourceLabel}.`);
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
      ui.notifications.info(`Actor Forge: esportati ${files.length} file da ${sourceLabel} → ${base}.zip (${(blob.size / 1048576).toFixed(1)} MB)`);
    } else {
      const file = {
        tafysForgeExport: FORMAT, documentName, rootName, source: sourceLabel,
        exportedAt: new Date().toISOString(), foundry: game.version, system: `${game.system.id} ${game.system.version}`,
        count: entries.length, entries,
      };
      save(JSON.stringify(file, null, 2), "application/json", `${base}.json`);
      ui.notifications.info(`Actor Forge: esportati ${entries.length} documenti da ${sourceLabel} → ${base}.json`);
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
    if (c.json.trim()) payloads.push({ label: "testo incollato", text: c.json });
    for (const f of c.files) payloads.push({ label: f.name, text: await f.text() });
    if (!payloads.length) return ui.notifications.warn("Actor Forge: incolla un JSON o scegli almeno un file.");

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
