// ============================================================
// Banco di prova delle macro PRESET della tab Info (Foundry finto).
// Esegue il codice VERO di ogni preset in italiano e in inglese e
// controlla i messaggi, la chat e le finestre nella lingua giusta.
// Si lancia con: node test/presets.mjs  (incluso in npm test)
// ============================================================
import { MACRO_PRESETS } from '../src/data/macro-presets.js';

let failures = 0;
function check(desc, cond, detail) {
  if (cond) console.log(`  ✔ ${desc}`);
  else { failures++; console.error(`  ✘ ${desc}${detail !== undefined ? ' → ' + JSON.stringify(detail) : ''}`); }
}

/** Foundry finto con quel che serve ai preset; `tokens` = token selezionati. */
function makeEnv(lang, tokens = []) {
  const out = { notes: [], chat: [], dialogs: [], log: [] };
  const mkToken = (name) => {
    const doc = { flags: {}, texture: { src: 'orig.webp', scaleX: 1, scaleY: 1 },
      getFlag: (s, k) => doc.flags[k], setFlag: async (s, k, v) => { doc.flags[k] = v; }, unsetFlag: async (s, k) => { delete doc.flags[k]; },
      update: async (d) => { out.log.push(['update', name, d]); if (d['texture.src']) doc.texture.src = d['texture.src']; } };
    return { name, id: name, document: doc, actor: {
      rollSavingThrow: async ({ ability }) => [{ total: name === 'Shaq' ? 18 : 9, ability }],
      toggleStatusEffect: async (c) => out.log.push(['toggle', name, c]),
      applyDamage: async (n, o) => out.log.push(['damage', name, n, o.multiplier]),
    } };
  };
  const sound = { path: 'a.ogg' };
  const env = {
    game: { i18n: { lang }, playlists: { getName: (n) => (n === 'Ambience' ? { sounds: { getName: (t) => (t === 'Tavern' ? sound : null) }, playSound: async () => out.log.push(['play']) } : null) } },
    canvas: { tokens: { controlled: tokens.map(mkToken) } },
    ui: { notifications: { info: (m) => out.notes.push(['info', m]), warn: (m) => out.notes.push(['warn', m]), error: (m) => out.notes.push(['error', m]) } },
    ChatMessage: { create: (d) => out.chat.push(d.content) },
    foundry: {
      canvas: { loadTexture: async () => {} },
      audio: { AudioHelper: { preloadSound: async () => {}, play: () => out.log.push(['sound']) } },
      applications: {
        apps: { ImagePopout: class { constructor(o) { out.log.push(['popout', o.src]); } async render() {} shareImage() { out.log.push(['share']); } } },
        api: { DialogV2: { prompt: async (cfg) => {
          out.dialogs.push(cfg);
          const elements = { amount: { value: '7' }, mode: { value: out.mode ?? 'damage' } };
          return cfg.ok.callback({}, { form: { elements } });
        } } },
      },
    },
    out,
  };
  return env;
}
async function run(id, lang, tokens, extra = {}) {
  const env = makeEnv(lang, tokens);
  Object.assign(env.out, extra);
  const code = MACRO_PRESETS.find((p) => p.id === id).code;
  const i = code.indexOf('(async () => {');
  const fn = new Function('game', 'canvas', 'ui', 'ChatMessage', 'foundry', 'Sequencer', 'Sequence', code.slice(0, i) + 'return ' + code.slice(i));
  await fn(env.game, env.canvas, env.ui, env.ChatMessage, env.foundry, undefined, undefined);
  return env.out;
}
const ITALIAN = /\b(Seleziona|token che|Tiro|Esito|Cura|Danno|Applica|Curati|Feriti|commutata|torna|trovata|Quantità|Modo)\b/;

console.log('— Preset: compilano e hanno il mini-dizionario —');
for (const p of MACRO_PRESETS) {
  let ok = true;
  try { new Function(p.code); } catch { ok = false; }
  check(`${p.icon} ${p.id}: sintassi valida, lingua da game.i18n.lang`, ok && /game\.i18n\?\.lang/.test(p.code) && /\bit: \{/.test(p.code) && /\ben: \{/.test(p.code));
}

console.log('\n— Nessun token selezionato: avviso nella lingua di Foundry —');
for (const id of ['transform', 'groupsave', 'condition', 'massdamage']) {
  const it = await run(id, 'it', []);
  const en = await run(id, 'en', []);
  check(`${id}: IT "${it.notes[0]?.[1]}" / EN "${en.notes[0]?.[1]}"`, /^Seleziona/.test(it.notes[0]?.[1]) && /^Select/.test(en.notes[0]?.[1]));
}

console.log('\n— Percorsi completi —');
{
  const it = await run('groupsave', 'it', ['Shaq', 'Elara']);
  const en = await run('groupsave', 'en', ['Shaq', 'Elara']);
  check('TS di gruppo: tabella in chat in italiano', /TS DEX — CD 15/.test(it.chat[0]) && /<th>Tiro<\/th><th>Esito<\/th>/.test(it.chat[0]) && /Shaq<\/td><td>18<\/td><td>✅/.test(it.chat[0]) && /Elara<\/td><td>9<\/td><td>❌/.test(it.chat[0]));
  check('group save: chat table in English', /Save DEX — DC 15/.test(en.chat[0]) && /<th>Roll<\/th><th>Result<\/th>/.test(en.chat[0]) && !ITALIAN.test(en.chat[0]));
}
{
  const en = await run('massdamage', 'en', ['Shaq', 'Elara'], { mode: 'heal' });
  check('mass damage: dialog + notification in English, heal = multiplier -1',
    en.dialogs[0].window.title === 'Mass damage / healing' && en.dialogs[0].ok.label === 'Apply' && !ITALIAN.test(en.dialogs[0].content) &&
    en.log.filter((l) => l[0] === 'damage' && l[2] === 7 && l[3] === -1).length === 2 && en.notes[0][1] === 'Healed 2 tokens (7)');
  const it = await run('massdamage', 'it', ['Shaq']);
  check('danno di massa: finestra e notifica in italiano', it.dialogs[0].window.title === 'Danno / Cura di massa' && /Quantità/.test(it.dialogs[0].content) && it.notes[0][1] === 'Feriti 1 token (7)');
}
{
  const en = await run('condition', 'en', ['Shaq', 'Elara']);
  check('condition: toggled on both, English message', en.log.filter((l) => l[0] === 'toggle' && l[2] === 'prone').length === 2 && en.notes[0][1] === 'prone toggled on 2 tokens');
}
{
  const en = await run('transform', 'en', ['Shaq']);
  check('transform: first use swaps the token image', en.log.some((l) => l[0] === 'update' && l[2]['texture.src'] === 'worlds/my-world/tokens/wolf-form.webp'));
}
{
  const it = await run('cinematic', 'it', []);
  check('cinematica: playlist + immagine condivisa', it.log.some((l) => l[0] === 'play') && it.log.some((l) => l[0] === 'share') && !it.notes.length);
  const code = MACRO_PRESETS.find((p) => p.id === 'cinematic').code;
  const p = { ...MACRO_PRESETS.find((x) => x.id === 'cinematic'), code: code.replace('const TRACK    = "Tavern";', 'const TRACK    = "Nope";') };
  MACRO_PRESETS.push({ ...p, id: 'cinematic-missing' });
  const en = await run('cinematic-missing', 'en', []);
  check('cinematic: missing track warning in English', /^Playlist or track not found: Ambience \/ Nope$/.test(en.notes[0]?.[1]));
  MACRO_PRESETS.pop();
}
{
  // Esempi di percorso neutri (prodotto pubblico: niente "il-tuo-mondo").
  check('percorsi d\'esempio neutri (worlds/my-world/…)', MACRO_PRESETS.every((p) => !/il-tuo-mondo/.test(p.code)));
}

if (failures) { console.error(`\n${failures} test dei preset falliti.`); process.exit(1); }
console.log('\nTutti i test dei preset passati ✔');
