// ============================================================
// Banco di prova della macro Importa/Esporta con un FOUNDRY FINTO.
//
// La macro gira solo dentro Foundry: qui ricostruiamo la parte minima di API
// che usa (DialogV2.prompt, game.folders/packs/collections, Folder con
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
function check(desc, cond) {
  if (cond) console.log(`  ✔ ${desc}`);
  else { failures++; console.error(`  ✘ ${desc}`); }
}

// ---------- Foundry finto ----------
class Coll extends Map {
  find(fn) { for (const v of this.values()) if (fn(v)) return v; return undefined; }
  filter(fn) { return [...this.values()].filter(fn); }
}
let seq = 0;
const rid = () => `id${String(++seq).padStart(14, '0')}`;
const DOC_NAMES = ['Actor', 'Item', 'JournalEntry', 'Scene', 'RollTable', 'Macro', 'Playlist', 'Cards'];

function makeEnv() {
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
    user: { isGM: true }, version: '13.351', system: { id: 'dnd5e', version: '5.3.3' },
  };
  const CONFIG = Object.fromEntries(DOC_NAMES.map(n => [n, { documentClass: docClass(n) }]));
  return { env, world, packs, Folder, makePack, seed, ui, game, CONFIG };
}

// Esegue la macro VERA simulando la finestra: `fields` = valori dei campi.
const FIELD_NAMES = ['tfxTab', 'payload', 'files', 'dest', 'folder', 'folderItems', 'folderOther', 'keepIds', 'unlock', 'source', 'subfolders', 'filename'];
async function runMacro(F, fields) {
  const v = {
    tfxTab: 'import', payload: '', files: [], dest: 'world', folder: '', folderItems: '', folderOther: '',
    keepIds: false, unlock: false, source: '', subfolders: true, filename: '', ...fields,
  };
  const elements = {
    tfxTab: { value: v.tfxTab }, payload: { value: v.payload }, files: { files: v.files }, dest: { value: v.dest },
    folder: { value: v.folder }, folderItems: { value: v.folderItems }, folderOther: { value: v.folderOther },
    keepIds: { checked: v.keepIds }, unlock: { checked: v.unlock }, source: { value: v.source },
    subfolders: { checked: v.subfolders }, filename: { value: v.filename },
  };
  const foundry = {
    applications: { api: { DialogV2: { prompt: async (cfg) => {
      F.env.content = cfg.content;
      return cfg.ok.callback({}, { form: { elements } });
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
  const run = new Function('foundry', 'game', 'ui', 'CONFIG', 'Folder', body);
  await run(foundry, F.game, F.ui, F.CONFIG, F.Folder);
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
  await runMacro(F, { tfxTab: 'import', payload: '' });
  const missing = FIELD_NAMES.filter(n => !new RegExp(`name="${n}"`).test(F.env.content));
  check('ogni campo letto dal callback esiste nel modulo HTML', missing.length === 0);
  if (missing.length) console.error('    mancano:', missing);
  check('due schede (Importa/Esporta) solo CSS, nessuno <script>', /📥 Importa/.test(F.env.content) && /📤 Esporta/.test(F.env.content) && !/<script/i.test(F.env.content));
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

  await runMacro(F, { tfxTab: 'export', source: `world|${party.id}`, subfolders: true });
  check('un solo file scaricato, .json', F.env.saved.length === 1 && F.env.saved[0].filename === 'Party.json');
  exported = JSON.parse(F.env.saved[0].data);
  check('formato di esportazione: tipo, cartella d\'origine, conteggio', exported.tafysForgeExport === 1 && exported.documentName === 'Actor' && exported.rootName === 'Party' && exported.count === 3);
  check('percorsi delle sottocartelle conservati', exported.entries.map(e => `${e.path}:${e.data.name}`).join('|') === ':Capo|Eroi:Shaq|Eroi/Elite:Elara');
  check('nessun riferimento alla cartella del mondo nei dati (clearFolder)', exported.entries.every(e => !('folder' in e.data)));

  await runMacro(F, { tfxTab: 'export', source: `world|${party.id}`, subfolders: false, filename: 'solo radice' });
  check('senza sottocartelle → solo i documenti della cartella scelta', JSON.parse(F.env.saved[1].data).count === 1 && F.env.saved[1].filename === 'solo radice.json');

  const pk = F.makePack('world.mostri', 'Actor', 'Mostri di Avernus');
  const pf = await F.Folder.create({ name: 'Diavoli', type: 'Actor' }, { pack: 'world.mostri' });
  F.seed('Actor', { name: 'Imp', type: 'npc', system: {}, prototypeToken: {}, folder: pf.id }, pk);
  F.seed('Actor', { name: 'Zariel', type: 'npc', system: {}, prototypeToken: {} }, pk);
  await runMacro(F, { tfxTab: 'export', source: 'pack|world.mostri|', subfolders: true });
  const whole = JSON.parse(F.env.saved[2].data);
  check('compendio intero: tutti i documenti con i loro percorsi', whole.count === 2 && whole.entries.some(e => e.path === 'Diavoli' && e.data.name === 'Imp') && whole.rootName === 'Mostri di Avernus');
  await runMacro(F, { tfxTab: 'export', source: `pack|world.mostri|${pf.id}`, subfolders: true });
  check('cartella di un compendio: solo i suoi documenti', JSON.parse(F.env.saved[3].data).entries.map(e => e.data.name).join() === 'Imp');
  await runMacro(F, { tfxTab: 'export', source: `world|${elite.id}` });
  check('cartella vuota di altri tipi non coinvolta', JSON.parse(F.env.saved[4].data).count === 1);
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
  await runMacro(F, { tfxTab: 'export', source: `world|${party.id}` });
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

if (failures) { console.error(`\n${failures} test della macro falliti.`); process.exit(1); }
console.log('\nTutti i test della macro passati ✔');
