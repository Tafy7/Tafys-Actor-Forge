// ============================================================
// Banco di prova della macro Importa/Esporta con un FOUNDRY FINTO.
//
// La macro gira solo dentro Foundry: qui ricostruiamo la parte minima di API
// che usa (DialogV2.wait, document per stile e listener, game.folders/packs/collections, Folder con
// genitori e sottocartelle, classi documento con createDocuments che
// rifiutano gli ID duplicati come quelle vere, compendi bloccabili,
// saveDataToFile, notifiche) ed eseguiamo il codice VERO della macro.
// Il collaudo finale resta in Foundry: questo test verifica la logica.
// Si lancia con: node test/macro-io.mjs  (incluso in npm test)
// ============================================================
import { readFileSync } from 'node:fs';
import { buildNpc } from '../src/builders/npc.js';
import { buildSpell } from '../src/builders/spell.js';

const MACRO = readFileSync(process.env.MACRO_PATH || new URL('../src/foundry/import-actor.macro.js', import.meta.url), 'utf8');

let failures = 0;
function check(desc, cond, detail) {
  if (cond) console.log(`  ✔ ${desc}`);
  else { failures++; console.error(`  ✘ ${desc}${detail !== undefined ? ' → ' + JSON.stringify(detail) : ''}`); }
}

// ---------- Foundry finto ----------
class Coll extends Map {
  // Come la Collection di Foundry: iterare dà i VALORI, non le coppie.
  *[Symbol.iterator]() { yield* this.values(); }
  find(fn) { for (const v of this.values()) if (fn(v)) return v; return undefined; }
  filter(fn) { return [...this.values()].filter(fn); }
}
let seq = 0;
const rid = () => `id${String(++seq).padStart(14, '0')}`;
const DOC_NAMES = ['Actor', 'Item', 'JournalEntry', 'Scene', 'RollTable', 'Macro', 'Playlist', 'Cards'];

function makeEnv(lang = 'it') {
  const env = { log: [], notes: [], saved: [], rendered: [], configured: [] };
  const world = { folders: new Coll(), collections: new Map(DOC_NAMES.map(n => [n, new Coll()])) };
  const packs = new Coll();

  class Folder {
    constructor(data, pack) {
      this.id = data._id || rid(); this.name = data.name; this.type = data.type;
      this._parent = data.folder ?? null; this.pack = pack ?? null;
    }
    get pool() { return this.pack ? this.pack.folders : world.folders; }
    get folder() { return this._parent ? this.pool.get(this._parent) ?? null : null; }
    getSubfolders(recursive = false) {
      const kids = this.pool.filter(f => f._parent === this.id);
      return recursive ? kids.flatMap(k => [k, ...k.getSubfolders(true)]) : kids;
    }
    get contents() { return world.collections.get(this.type).filter(d => d._folder === this.id); }
    static async create(data, opts = {}) {
      const pack = opts.pack ? packs.get(opts.pack) : null;
      const f = new Folder(data, pack);
      (pack ? pack.folders : world.folders).set(f.id, f);
      env.log.push(['Folder.create', data.name, data.type, data.folder ?? null, opts.pack ?? null]);
      return f;
    }
  }

  class Doc {
    constructor(documentName, data, pack) {
      this.documentName = documentName; this._data = data; this.id = data._id; this.name = data.name;
      this._folder = data.folder ?? null; this.pack = pack ?? null;
    }
    get folder() { return this._folder ? (this.pack ? this.pack.folders : world.folders).get(this._folder) ?? null : null; }
    toCompendium(_pack, opts = {}) {
      const d = structuredClone(this._data);
      if (opts.clearFolder) delete d.folder;
      if (!opts.keepId) delete d._id;
      return d;
    }
    get sheet() { return { render: () => env.rendered.push(this.name) }; }
  }
  const docClass = (documentName) => ({
    async createDocuments(list, opts = {}) {
      const pack = opts.pack ? packs.get(opts.pack) : null;
      const coll = pack ? pack.docs : world.collections.get(documentName);
      const made = list.map((d) => {
        const data = structuredClone(d);
        if (!opts.keepId || !data._id) data._id = rid();
        if (coll.has(data._id)) throw new Error(`ID duplicato ${data._id}`); // come Foundry
        const doc = new Doc(documentName, data, pack);
        coll.set(doc.id, doc);
        if (pack) pack.index.set(doc.id, { _id: doc.id, name: doc.name });
        return doc;
      });
      env.log.push(['create', documentName, made.length, opts.pack ?? null, opts.keepId]);
      return made;
    },
  });

  const makePack = (collection, documentName, title, locked = false) => {
    const p = {
      collection, documentName, title, locked, folders: new Coll(), docs: new Coll(), index: new Coll(),
      async configure(o) { Object.assign(this, o); env.configured.push([collection, o]); },
      async getIndex() { return this.index; },
      async getDocuments() { return [...this.docs.values()]; },
    };
    packs.set(collection, p);
    return p;
  };

  // Aggiunge un documento esistente al mondo (o a un compendio).
  const seed = (documentName, data, pack = null) => {
    const d = new Doc(documentName, { _id: rid(), ...data }, pack);
    (pack ? pack.docs : world.collections.get(documentName)).set(d.id, d);
    if (pack) pack.index.set(d.id, { _id: d.id, name: d.name });
    return d;
  };

  const ui = { notifications: {
    info: (m) => env.notes.push(['info', m]), warn: (m) => env.notes.push(['warn', m]), error: (m) => env.notes.push(['error', m]),
  } };
  const game = {
    folders: world.folders, packs, collections: world.collections,
    user: { isGM: true }, version: '13.351', system: { id: 'dnd5e', version: '5.3.3' }, i18n: { lang },
  };
  const CONFIG = Object.fromEntries(DOC_NAMES.map(n => [n, { documentClass: docClass(n) }]));
  return { env, world, packs, Folder, makePack, seed, ui, game, CONFIG };
}

// Esegue la macro VERA simulando la finestra: `fields` = valori dei campi.
// La scheda attiva si legge dalla classe is-import/is-export della radice.
const FIELD_NAMES = ['payload', 'files', 'dest', 'folder', 'folderItems', 'folderOther', 'keepIds', 'unlock',
  'source', 'pack', 'exFolder', 'subfolders', 'format', 'filename'];
async function runMacro(F, fields) {
  const v = {
    tab: 'import', payload: '', files: [], dest: 'world', folder: '', folderItems: '', folderOther: '',
    keepIds: false, unlock: false, source: '', pack: '', exFolder: '', subfolders: true, format: 'single', filename: '', ...fields,
  };
  const elements = {
    payload: { value: v.payload }, files: { files: v.files }, dest: { value: v.dest },
    folder: { value: v.folder }, folderItems: { value: v.folderItems }, folderOther: { value: v.folderOther },
    keepIds: { checked: v.keepIds }, unlock: { checked: v.unlock }, source: { value: v.source }, pack: { value: v.pack },
    exFolder: { value: v.exFolder }, subfolders: { checked: v.subfolders }, format: { value: v.format }, filename: { value: v.filename },
  };
  const root = { classList: { contains: (c) => c === (v.tab === 'export' ? 'is-export' : 'is-import') } };
  const form = { elements, querySelector: (sel) => (sel === '.tfx-io' ? root : null) };
  // document finto: stile nell'head + listener delegati (contati per
  // verificare che la macro li rimuova alla chiusura).
  const listeners = F.env.listeners ??= new Set();
  const head = F.env.head ??= [];
  const document = {
    head: { append: (el) => head.push(el) },
    getElementById: (id) => { const el = head.find((e) => e.id === id && !e.removed); return el ? { remove: () => { el.removed = true; } } : null; },
    createElement: (tag) => ({ tag, id: '', textContent: '' }),
    addEventListener: (type, fn) => listeners.add(`${type}`) && (F.env.added = (F.env.added ?? 0) + 1),
    removeEventListener: (type) => listeners.delete(`${type}`),
  };
  const foundry = {
    applications: { api: { DialogV2: { wait: async (cfg) => {
      F.env.content = cfg.content; F.env.cfg = cfg;
      if (v.closeDialog) return null; // finestra chiusa con la X
      const go = cfg.buttons.find((b) => b.action === 'go');
      return go.callback({}, { form });
    } } } },
    utils: {
      deepClone: (x) => structuredClone(x), randomID: () => 'u1',
      saveDataToFile: (data, type, filename) => F.env.saved.push({ data, type, filename }),
    },
  };
  // "return " davanti all'IIFE per poterla attendere (il commento iniziale
  // va saltato: un return seguito da a-capo restituirebbe undefined).
  const i = MACRO.indexOf('(async () => {');
  const body = MACRO.slice(0, i) + 'return ' + MACRO.slice(i);
  const run = new Function('foundry', 'game', 'ui', 'CONFIG', 'Folder', 'document', body);
  await run(foundry, F.game, F.ui, F.CONFIG, F.Folder, document);
}
const file = (name, obj) => ({ name, text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) });
const notes = (F, level) => F.env.notes.filter(n => n[0] === level).map(n => n[1]);
const docsIn = (F, docName) => [...F.world.collections.get(docName).values()];
const folderByPath = (pool, type, path) => {
  let parent = null;
  for (const name of path.split('/')) {
    parent = pool.find(f => f.type === type && f.name === name && (f._parent ?? null) === (parent?.id ?? null));
    if (!parent) return null;
  }
  return parent;
};

// ---------- Dati realistici dal Forge ----------
const npc = buildNpc({
  name: 'Diavolo di Prova', size: 'lg', creatureType: 'fiend', subtype: '', alignment: '', cr: '2', rules: '2014',
  sourceBook: '', sourcePage: '', str: '18', dex: '12', con: '16', int: '8', wis: '10', cha: '10',
  saves: [], skills: {}, hpMax: '60', hpFormula: '', acCalc: 'natural', acFlat: '15',
  walk: '30', fly: '', swim: '', climb: '', burrow: '', hover: false,
  darkvision: '60', blindsight: '', tremorsense: '', truesight: '', telepathy: '',
  dr: '', di: '', dv: '', ci: '', languages: '', legact: '', legres: '', img: '', tokenImg: '', bio: '',
  items: [{ name: 'Morso', kind: 'attack', activation: 'action', attackType: 'melee', ability: 'str', reach: '5', range: '', longRange: '',
    damage: '2d6 + 4 piercing', magical: false, saveAbility: 'con', dc: '', onSave: 'none', onHit: 'save', condition: 'prone',
    condRounds: '', riderSaveAbility: 'str', riderDc: '13', usesMode: 'none', usesValue: '', img: '', description: '', effects: [] }],
});
const spell = buildSpell({ name: 'Dardo di Prova', level: '1', school: 'evo', kind: 'attack', attackType: 'ranged', damage: '1d10 fire', vocal: true, somatic: true });
const embeddedIds = npc.items.map(i => i._id);

console.log('— Finestra —');
{
  const F = makeEnv();
  const party = await F.Folder.create({ name: 'Party', type: 'Actor' });
  await F.Folder.create({ name: 'Eroi', type: 'Actor', folder: party.id });
  F.seed('Actor', { name: 'Capo', type: 'character', system: {}, prototypeToken: {}, folder: party.id });
  F.seed('Item', { name: 'Spada', type: 'weapon', system: {} });
  F.makePack('world.mostri', 'Actor', 'Mostri di Avernus', true);
  await runMacro(F, { tab: 'import', payload: '' });
  const html = F.env.content;
  const missing = FIELD_NAMES.filter(n => !new RegExp(`name="${n}"`).test(html));
  check('ogni campo letto dal callback esiste nel modulo HTML', missing.length === 0);
  if (missing.length) console.error('    mancano:', missing);
  check('due schede, si parte da Importa', /tfx-tab-import/.test(html) && /tfx-tab-export/.test(html) && /class="tfx-io tfx-io-u1 is-import/.test(html));
  check('niente <style>/<script> nel contenuto (Foundry li toglie): stile iniettato nell\'head',
    !/<style|<script/i.test(html) && F.env.head.some(e => e.id === 'tafys-forge-io-style' && /is-export .tfx-p-imp/.test(e.textContent)));
  check('Sorgente: solo i tipi con contenuto + Compendi', /<option value="Actor">Attori \(1\)/.test(html) && /<option value="Item">Oggetti \(1\)/.test(html) && !/value="Scene"/.test(html) && /<option value="pack">Compendi \(1\)/.test(html));
  check('Cartella: albero della prima sorgente, con rientro', /— tutto \(1\) —/.test(html) && new RegExp(`value="${party.id}">Party<`).test(html) && /└ Eroi/.test(html));
  check('Compendio bloccato segnalato col lucchetto', /Mostri di Avernus 🔒/.test(html));
  check('formato: file unico (predefinito) o zip', /name="format" value="single" checked/.test(html) && /name="format" value="zip"/.test(html));
  check('finestra: DialogV2.wait con un pulsante "go" e altezza contenuta',
    F.env.cfg.buttons.length === 1 && F.env.cfg.buttons[0].action === 'go' && /max-height: min\(68vh/.test(F.env.head.at(-1).textContent));
  check('listener delegati rimossi alla chiusura', F.env.added === 2 && F.env.listeners.size === 0);
  await runMacro(F, { tab: 'import', payload: '' });
  check('relancio: lo stile vecchio viene sostituito', F.env.head.filter(e => !e.removed).length === 1);
  const notesBefore = F.env.notes.length;
  await runMacro(F, { closeDialog: true });
  check('finestra chiusa con la X: nessuna azione, listener rimossi', F.env.saved.length === 0 && F.env.notes.length === notesBefore && F.env.listeners.size === 0);
}

console.log('\n— Importa: compatibilità col JSON del Forge —');
{
  const F = makeEnv();
  await runMacro(F, { payload: JSON.stringify([npc, spell]), folder: 'I Miei Mostri', folderItems: 'I Miei Oggetti' });
  const [a] = docsIn(F, 'Actor'); const [it] = docsIn(F, 'Item');
  check('Actor e Item smistati nelle rispettive collezioni', docsIn(F, 'Actor').length === 1 && docsIn(F, 'Item').length === 1);
  check('cartelle create per nome e tipo (Actor / Item)', a.folder?.name === 'I Miei Mostri' && a.folder.type === 'Actor' && it.folder?.name === 'I Miei Oggetti' && it.folder.type === 'Item');
  check('_id di primo livello rigenerato (re-import senza duplicati)', a.id !== npc._id);
  check('_id interni MANTENUTI (attività/effetti restano collegati)', a._data.items.map(i => i._id).join() === embeddedIds.join());
  check('notifica di successo', notes(F, 'info').some(m => /creati 2 documenti/.test(m)));
  // Re-import identico: riusa le cartelle esistenti invece di crearne altre.
  const before = F.world.folders.size;
  await runMacro(F, { payload: JSON.stringify([npc, spell]), folder: 'I Miei Mostri', folderItems: 'I Miei Oggetti' });
  check('re-import: cartelle riusate, documenti nuovi senza conflitti', F.world.folders.size === before && docsIn(F, 'Actor').length === 2);
}
{
  const F = makeEnv();
  await runMacro(F, { payload: JSON.stringify(npc) });
  check('documento singolo senza cartella → scheda aperta', docsIn(F, 'Actor')[0].folder === null && F.env.rendered[0] === 'Diavolo di Prova');
}
{
  const F = makeEnv();
  await runMacro(F, { payload: JSON.stringify({ app: 'tafys-actor-forge', name: 'bozza' }) });
  check('file di BOZZA dell\'app rifiutato con spiegazione', notes(F, 'error').some(m => /BOZZA/.test(m)) && docsIn(F, 'Actor').length === 0);
}

console.log('\n— Esporta —');
let exported;
{
  const F = makeEnv();
  const party = await F.Folder.create({ name: 'Party', type: 'Actor' });
  const eroi = await F.Folder.create({ name: 'Eroi', type: 'Actor', folder: party.id });
  const elite = await F.Folder.create({ name: 'Elite', type: 'Actor', folder: eroi.id });
  await F.Folder.create({ name: 'Party', type: 'Item' }); // stesso nome, altro tipo: da ignorare
  F.seed('Actor', { ...structuredClone(npc), name: 'Capo', folder: party.id });
  F.seed('Actor', { ...structuredClone(npc), name: 'Shaq', folder: eroi.id });
  F.seed('Actor', { ...structuredClone(npc), name: 'Elara', folder: elite.id });
  F.seed('Actor', { ...structuredClone(npc), name: 'Estraneo' }); // fuori dalla cartella

  await runMacro(F, { tab: 'export', source: 'Actor', exFolder: party.id, subfolders: true });
  check('un solo file scaricato, .json', F.env.saved.length === 1 && F.env.saved[0].filename === 'Party.json');
  exported = JSON.parse(F.env.saved[0].data);
  check('formato di esportazione: tipo, cartella d\'origine, conteggio', exported.tafysForgeExport === 1 && exported.documentName === 'Actor' && exported.rootName === 'Party' && exported.count === 3);
  check('percorsi delle sottocartelle conservati', exported.entries.map(e => `${e.path}:${e.data.name}`).join('|') === ':Capo|Eroi:Shaq|Eroi/Elite:Elara');
  check('nessun riferimento alla cartella del mondo nei dati (clearFolder)', exported.entries.every(e => !('folder' in e.data)));

  await runMacro(F, { tab: 'export', source: 'Actor', exFolder: party.id, subfolders: false, filename: 'solo radice' });
  check('senza sottocartelle → solo i documenti della cartella scelta', JSON.parse(F.env.saved[1].data).count === 1 && F.env.saved[1].filename === 'solo radice.json');

  const pk = F.makePack('world.mostri', 'Actor', 'Mostri di Avernus');
  const pf = await F.Folder.create({ name: 'Diavoli', type: 'Actor' }, { pack: 'world.mostri' });
  F.seed('Actor', { name: 'Imp', type: 'npc', system: {}, prototypeToken: {}, folder: pf.id }, pk);
  F.seed('Actor', { name: 'Zariel', type: 'npc', system: {}, prototypeToken: {} }, pk);
  await runMacro(F, { tab: 'export', source: 'pack', pack: 'world.mostri', exFolder: '', subfolders: true });
  const whole = JSON.parse(F.env.saved[2].data);
  check('compendio intero: tutti i documenti con i loro percorsi', whole.count === 2 && whole.entries.some(e => e.path === 'Diavoli' && e.data.name === 'Imp') && whole.rootName === 'Mostri di Avernus');
  await runMacro(F, { tab: 'export', source: 'pack', pack: 'world.mostri', exFolder: pf.id, subfolders: true });
  check('cartella di un compendio: solo i suoi documenti', JSON.parse(F.env.saved[3].data).entries.map(e => e.data.name).join() === 'Imp');
  await runMacro(F, { tab: 'export', source: 'Actor', exFolder: elite.id });
  check('cartella vuota di altri tipi non coinvolta', JSON.parse(F.env.saved[4].data).count === 1);
}

console.log('\n— Esporta: "tutto" e file singoli (.zip) —');
{
  const F = makeEnv();
  const party = await F.Folder.create({ name: 'Party', type: 'Actor' });
  const eroi = await F.Folder.create({ name: 'Eroi/Erranti', type: 'Actor', folder: party.id }); // "/" nel nome
  F.seed('Actor', { ...structuredClone(npc), name: 'Capo', folder: party.id });
  F.seed('Actor', { ...structuredClone(npc), name: 'Shaq: la Rossa', folder: eroi.id });
  F.seed('Actor', { ...structuredClone(npc), name: 'Shaq: la Rossa', folder: eroi.id }); // nome doppio
  F.seed('Actor', { ...structuredClone(npc), name: 'Sciolto' });

  await runMacro(F, { tab: 'export', source: 'Actor', exFolder: '', subfolders: true });
  const all = JSON.parse(F.env.saved[0].data);
  check('"tutto": ogni Actor del mondo coi percorsi completi', all.count === 4 && all.rootName === 'Attori' && F.env.saved[0].filename === 'Attori.json' &&
    all.entries.some(e => e.path === '' && e.data.name === 'Sciolto') && all.entries.some(e => e.path === 'Party' && e.data.name === 'Capo'));
  await runMacro(F, { tab: 'export', source: 'Actor', exFolder: '', subfolders: false });
  check('"tutto" senza sottocartelle → solo i documenti fuori da ogni cartella', JSON.parse(F.env.saved[1].data).entries.map(e => e.data.name).join() === 'Sciolto');

  await runMacro(F, { tab: 'export', source: 'Actor', exFolder: party.id });
  const slashFile = JSON.parse(F.env.saved.at(-1).data);
  check('file unico: livelli espliciti per i nomi con "/"', slashFile.entries.some(e => e.path === 'Eroi/Erranti' && e.folders.length === 1 && e.folders[0] === 'Eroi/Erranti'));
  const G = makeEnv();
  await runMacro(G, { files: [file('Party.json', slashFile)] });
  const shaqG = docsIn(G, 'Actor').find(d => d.name === 'Shaq: la Rossa');
  check('reimport: la cartella "Eroi/Erranti" resta UNA cartella sotto Party', shaqG.folder?.name === 'Eroi/Erranti' && shaqG.folder.folder?.name === 'Party');
  const legacy = { ...slashFile, entries: slashFile.entries.map(({ folders, ...e }) => e) }; // file v0.33: solo path
  const H = makeEnv();
  await runMacro(H, { files: [file('vecchio.json', legacy)] });
  check('file v0.33 (solo path) ancora importabili', docsIn(H, 'Actor').length === 3 && docsIn(H, 'Actor').find(d => d.name === 'Capo').folder?.name === 'Party');

  for (const [label, kill] of [['DEFLATE', false], ['senza CompressionStream (STORE)', true]]) {
    const saved = globalThis.CompressionStream;
    if (kill) delete globalThis.CompressionStream;
    try {
      await runMacro(F, { tab: 'export', source: 'Actor', exFolder: party.id, format: 'zip', filename: 'party zip' });
    } finally { if (kill) globalThis.CompressionStream = saved; }
    const out = F.env.saved.at(-1);
    check(`zip ${label}: scaricato come Blob application/zip`, out.filename === 'party zip.zip' && out.type === 'application/zip' && out.data instanceof Blob);
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { execFileSync } = await import('node:child_process');
    const dir = mkdtempSync('/tmp/tfxzip-');
    writeFileSync(`${dir}/x.zip`, Buffer.from(await out.data.arrayBuffer()));
    // Il controllo lo fa Python (zipfile verifica CRC e struttura): un lettore
    // indipendente dal nostro scrittore.
    const py = `import zipfile,json,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(json.dumps({"names":z.namelist(),"methods":[i.compress_type for i in z.infolist()],"utf8":all(i.flag_bits & 0x800 for i in z.infolist()),
 "docs":[json.loads(z.read(n))["name"] for n in z.namelist()]}))`;
    const info = JSON.parse(execFileSync('python3', ['-c', py, `${dir}/x.zip`]).toString());
    check(`zip ${label}: valido (CRC ok), nomi UTF-8`, info.utf8 && info.names.length === 3);
    check(`zip ${label}: un .json per documento nelle sue cartelle, nomi resi sicuri e doppioni numerati`,
      info.names.join('|') === 'Party/Capo.json|Party/Eroi_Erranti/Shaq_ la Rossa.json|Party/Eroi_Erranti/Shaq_ la Rossa (2).json');
    check(`zip ${label}: ogni file è il JSON del documento (va bene per l'Import Data di Foundry)`, info.docs.join() === 'Capo,Shaq: la Rossa,Shaq: la Rossa');
    check(`zip ${label}: metodo ${kill ? 'STORE (0)' : 'DEFLATE (8)'}`, info.methods.every(m => m === (kill ? 0 : 8)));
  }
}

console.log('\n— Catena: party esportato da Foundry → tab Scontro del Forge —');
{
  const F = makeEnv();
  const party = await F.Folder.create({ name: 'Party', type: 'Actor' });
  const shaqira = JSON.parse(readFileSync(new URL('../templates/golden-actor-shaqira-pc.json', import.meta.url)));
  F.seed('Actor', { ...shaqira, folder: party.id });
  F.seed('Actor', { type: 'character', name: 'Elara', prototypeToken: {}, folder: party.id,
    system: { abilities: { str: { value: 8 }, dex: { value: 14 }, con: { value: 12 }, int: { value: 16 }, wis: { value: 12 }, cha: { value: 10 } },
      attributes: { hp: { max: null }, ac: { calc: 'mage' }, spellcasting: 'int' } },
    items: [{ type: 'class', system: { levels: 3, hd: { denomination: 'd6' }, advancement: { h: { type: 'HitPoints', value: { 1: 'max', 2: 'avg', 3: 'avg' } } } } }] });
  await runMacro(F, { tab: 'export', source: 'Actor', exFolder: party.id });
  const partyFile = JSON.parse(F.env.saved[0].data);
  const { importPCs } = await import('../src/parsers/pc-import.js');
  const pcs = importPCs(partyFile).pcs;
  check('il file esportato dalla macro si carica nello Scontro (2 PG con PF e CA ricostruiti)',
    pcs.length === 2 && pcs.find(p => p.name === 'Shaq Ira')?.hp === '35' && pcs.find(p => p.name === 'Elara')?.ac === '15');
  if (process.env.WRITE_SAMPLE) (await import('node:fs')).writeFileSync(process.env.WRITE_SAMPLE, F.env.saved[0].data);
}

console.log('\n— Importa un file esportato —');
{
  const F = makeEnv();
  await runMacro(F, { files: [file('Party.json', exported)] });
  const byName = Object.fromEntries(docsIn(F, 'Actor').map(d => [d.name, d]));
  check('struttura ricreata: Party › Eroi › Elite', !!folderByPath(F.world.folders, 'Actor', 'Party/Eroi/Elite'));
  check('ogni documento nella sua sottocartella',
    byName.Capo.folder?.name === 'Party' && byName.Shaq.folder?.name === 'Eroi' && byName.Elara.folder?.name === 'Elite' && byName.Elara.folder.folder.name === 'Eroi');
}
{
  const F = makeEnv();
  await runMacro(F, { files: [file('Party.json', exported)], folder: 'Campagna' });
  check('cartella indicata → diventa la radice, sottocartelle sotto di lei', !!folderByPath(F.world.folders, 'Actor', 'Campagna/Eroi/Elite') && !folderByPath(F.world.folders, 'Actor', 'Party'));
}
{
  // Sottocartelle omonime sotto genitori diversi: "Eroi" esiste già sotto
  // Party; importando sotto "Nemici" deve nascere Nemici/Eroi, non riusare
  // Party/Eroi (altrimenti i documenti finirebbero nella cartella altrui).
  const F = makeEnv();
  const party = await F.Folder.create({ name: 'Party', type: 'Actor' });
  await F.Folder.create({ name: 'Eroi', type: 'Actor', folder: party.id });
  await runMacro(F, { files: [file('Party.json', exported)], folder: 'Nemici' });
  const shaq = docsIn(F, 'Actor').find(d => d.name === 'Shaq');
  check('sottocartelle omonime: si cerca DENTRO la cartella genitore', shaq.folder?.name === 'Eroi' && shaq.folder.folder?.name === 'Nemici');
}
{
  const F = makeEnv();
  F.makePack('world.mostri', 'Actor', 'Mostri di Avernus', true);
  await runMacro(F, { files: [file('Party.json', exported)], dest: 'pack|world.mostri' });
  check('compendio bloccato senza "sblocca" → errore, nulla creato', notes(F, 'error').some(m => /bloccato/.test(m)) && F.packs.get('world.mostri').docs.size === 0);
  await runMacro(F, { files: [file('Party.json', exported)], dest: 'pack|world.mostri', unlock: true });
  const pk = F.packs.get('world.mostri');
  check('con "sblocca" → compendio sbloccato e documenti creati nel compendio', F.env.configured.length === 1 && pk.docs.size === 3 && docsIn(F, 'Actor').length === 0);
  check('cartelle create DENTRO il compendio', !!folderByPath(pk.folders, 'Actor', 'Party/Eroi/Elite') && F.world.folders.size === 0);
  check('creazione col riferimento al compendio', F.env.log.some(l => l[0] === 'create' && l[3] === 'world.mostri'));
}
{
  const F = makeEnv();
  F.makePack('world.oggetti', 'Item', 'Oggetti');
  await runMacro(F, { files: [file('Party.json', exported)], dest: 'pack|world.oggetti' });
  check('tipo sbagliato per il compendio → saltati con avviso', F.packs.get('world.oggetti').docs.size === 0 && notes(F, 'warn').some(m => /saltato|nessun documento/.test(m)));
}
{
  const F = makeEnv();
  F.seed('Actor', { _id: exported.entries[0].data._id, name: 'Già presente', type: 'npc', system: {}, prototypeToken: {} });
  await runMacro(F, { files: [file('Party.json', exported)], keepIds: true });
  const ids = docsIn(F, 'Actor').map(d => d.id);
  check('mantieni ID: gli ID liberi sono conservati', ids.includes(exported.entries[1].data._id) && ids.includes(exported.entries[2].data._id));
  check('mantieni ID: l\'ID già presente riceve un ID nuovo (nessun crash)', docsIn(F, 'Actor').length === 4 && notes(F, 'warn').some(m => /ID già presente/.test(m)));
}

console.log('\n— Altri tipi di documento —');
{
  const F = makeEnv();
  const journal = { name: 'Diario di Avernus', pages: [{ name: 'Pagina 1', type: 'text', text: { content: '<p>…</p>' } }] };
  const scene = { name: 'Elturel', width: 4000, height: 3000, grid: { size: 100 }, tokens: [], walls: [] };
  const table = { name: 'Bottino', formula: '1d6', results: [] };
  await runMacro(F, { payload: JSON.stringify([journal, scene, table, npc]), folderOther: 'Capitolo 1', folder: 'Mostri' });
  check('Diario, Scena e Tabella riconosciuti dalla struttura', docsIn(F, 'JournalEntry').length === 1 && docsIn(F, 'Scene').length === 1 && docsIn(F, 'RollTable').length === 1 && docsIn(F, 'Actor').length === 1);
  check('cartella "altri documenti" creata per ciascun tipo (le cartelle di Foundry sono tipizzate)',
    ['JournalEntry', 'Scene', 'RollTable'].every(t => docsIn(F, t)[0].folder?.name === 'Capitolo 1' && docsIn(F, t)[0].folder.type === t));
}
{
  const F = makeEnv();
  await runMacro(F, { payload: JSON.stringify([npc, { name: 'Misterioso', foo: 1 }, { type: 'weapon' }]), files: [file('rotto.json', '{ non è json')] });
  check('elementi non validi saltati, quelli buoni importati', docsIn(F, 'Actor').length === 1);
  check('avvisi per tipo sconosciuto, elemento senza nome e JSON rotto', (() => { const w = notes(F, 'warn').join(' '); return /3 avvisi/.test(w); })());
}

console.log('\n— Lingua: italiano / inglese —');
{
  // I due dizionari devono avere le stesse chiavi, e ogni T("…") usato deve esistere.
  const src = MACRO.slice(MACRO.indexOf('const I18N = ') + 'const I18N = '.length, MACRO.indexOf('// game.i18n.lang'));
  const I18N = new Function(`return ${src.trim().replace(/;$/, '')}`)();
  const keys = (o) => Object.keys(o).sort().join();
  check('dizionari IT ed EN con le stesse chiavi (anche i tipi di documento)', keys(I18N.it) === keys(I18N.en) && keys(I18N.it.docs) === keys(I18N.en.docs));
  const used = [...MACRO.matchAll(/\bT\("(\w+)"/g)].map(m => m[1]);
  const missing = [...new Set(used)].filter(k => !(k in I18N.it) || !(k in I18N.en));
  check(`ogni T("…") usato esiste nei due dizionari (${new Set(used).size} chiavi)`, missing.length === 0, missing);
  const unused = Object.keys(I18N.it).filter(k => k !== 'docs' && !used.includes(k));
  check('nessuna chiave inutilizzata', unused.length === 0, unused);
  const ph = (str) => [...String(str).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
  const phBad = Object.keys(I18N.it).filter(k => k !== 'docs' && ph(I18N.it[k]) !== ph(I18N.en[k]));
  check('stessi segnaposto {…} in IT ed EN', phBad.length === 0, phBad);
}
{
  const F = makeEnv('en');
  const party = await F.Folder.create({ name: 'Party', type: 'Actor' });
  F.seed('Actor', { ...structuredClone(npc), name: 'Capo', folder: party.id });
  F.makePack('world.mostri', 'Actor', 'Monsters', true);
  await runMacro(F, { tab: 'import', payload: '' });
  const html = F.env.content;
  check('Foundry in inglese → finestra in inglese', /📥 Import</.test(html) && /Destination/.test(html) && /Actors \(1\)/.test(html) && /Compendiums \(1\)/.test(html) && /— all \(1\) —/.test(html) && F.env.cfg.window.title === 'Actor Forge — Import / Export' && F.env.cfg.buttons[0].label === 'Import');
  const italian = ['Importa', 'Esporta', 'Cartella', 'Destinazione', 'Sorgente', 'tutto', 'oppure', 'Mantieni', 'Sblocca', 'Attori', 'Compendio'];
  const left = italian.filter(w => new RegExp(`\\b${w}\\b`).test(html));
  check('nessuna parola italiana nella finestra inglese', left.length === 0, left);
  check('notifica in inglese (niente da importare)', notes(F, 'warn').some(m => /paste a JSON/.test(m)));
  await runMacro(F, { tab: 'export', source: 'Actor', exFolder: '' });
  check('export "all" in inglese: cartella radice "Actors" e notifica', JSON.parse(F.env.saved[0].data).rootName === 'Actors' && F.env.saved[0].filename === 'Actors.json' && notes(F, 'info').some(m => /exported 1 documents from all documents in “Actors”/.test(m)));
  await runMacro(F, { payload: JSON.stringify([npc, { name: 'Misterioso', foo: 1 }]), folder: 'My Monsters' });
  check('import in inglese: creati + avvisi', notes(F, 'info').some(m => /created 1 documents · 1 actors/.test(m)) && notes(F, 'warn').some(m => /1 warnings: pasted text: “Misterioso” — unrecognised document type/.test(m)));
  await runMacro(F, { payload: JSON.stringify({ app: 'tafys-actor-forge', name: 'bozza' }) });
  check('file di bozza: spiegazione in inglese col pulsante giusto', notes(F, 'error').some(m => /DRAFT file.*“⬇️ Export JSON”/.test(m)));
  await runMacro(F, { payload: JSON.stringify(npc), dest: 'pack|world.mostri' });
  check('compendio bloccato: errore in inglese', notes(F, 'error').some(m => /“Monsters” is locked\. Tick “Unlock the compendium”/.test(m)));
}
for (const [lang, expect] of [['de', 'Import'], ['fr', 'Import'], ['it', 'Importa'], [null, 'Import']]) {
  const F = makeEnv(lang);
  await runMacro(F, { tab: 'import', payload: '' });
  check(`lingua di Foundry "${lang}" → pulsante "${expect}"`, F.env.cfg.buttons[0].label === expect);
}
{
  // FORCE_LANG vince sulla lingua di Foundry.
  const forced = MACRO.replace('const FORCE_LANG = "";', 'const FORCE_LANG = "it";');
  const F = makeEnv('en');
  const i = forced.indexOf('(async () => {');
  await new Function('foundry', 'game', 'ui', 'CONFIG', 'Folder', 'document', forced.slice(0, i) + 'return ' + forced.slice(i))(
    { applications: { api: { DialogV2: { wait: async (cfg) => { F.env.cfg = cfg; return null; } } } }, utils: { randomID: () => 'u1' } },
    F.game, F.ui, F.CONFIG, F.Folder,
    { head: { append() {} }, getElementById: () => null, createElement: () => ({}), addEventListener() {}, removeEventListener() {} });
  check('FORCE_LANG = "it" forza l\'italiano anche con Foundry in inglese', F.env.cfg.buttons[0].label === 'Importa');
}

if (failures) { console.error(`\n${failures} test della macro falliti.`); process.exit(1); }
console.log('\nTutti i test della macro passati ✔');
