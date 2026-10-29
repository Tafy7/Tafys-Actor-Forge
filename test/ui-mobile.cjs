// ============================================================
// Collaudo UI in un browser VERO (Chromium via Playwright).
//
// Non è dentro `npm test` perché richiede Playwright (npm i -D playwright
// && npx playwright install chromium). Si lancia DOPO la build:
//   npm run build && npm run test:ui
// Serve la cartella dist/ con un mini server e controlla, a varie
// larghezze e temi: niente scroll orizzontale, tab in basso su telefono,
// barra azioni + foglio anteprima (tasto indietro, ✕, Esporta, avvisi),
// barre nascoste con la tastiera aperta, sezioni richiudibili ricordate,
// desktop invariato (niente barra, aside a destra).
// ============================================================
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };

let failures = 0;
const check = (desc, cond, extra) => {
  if (cond) console.log(`  ✔ ${desc}`);
  else { failures++; console.error(`  ✘ ${desc}${extra !== undefined ? ' → ' + JSON.stringify(extra) : ''}`); }
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(DIST, url === '/' ? 'index.html' : url);
      if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

(async () => {
  process.on('unhandledRejection', (e) => { console.error('  ✘ errore inatteso:', e.message.split('\n')[0]); process.exit(1); });
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('Manca dist/: lancia prima npm run build'); process.exit(1); }
  const srv = await serve();
  const URL = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const page = async (width, height, theme = 'taf') => {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000, isMobile: width < 1000 });
    await ctx.addInitScript((th) => { try { localStorage.setItem('tafys-forge-theme', th); } catch { /* */ } }, theme);
    const p = await ctx.newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.goto(URL);
    await p.waitForSelector('#tab-npc .m-bar', { state: 'attached' });
    return p;
  };
  // Confronto con la larghezza del DISPOSITIVO: se la pagina sborda, il
  // browser mobile allarga la sua area di layout (innerWidth cresce con lei)
  // e rimpicciolisce tutto, quindi scrollWidth <= innerWidth passerebbe.
  const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= screen.width && window.innerWidth <= screen.width);
  const shown = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0; }, sel);

  console.log('— Telefono 390×844: nessuno scroll orizzontale, in nessuna tab e in nessun tema —');
  for (const theme of ['taf', 'avernus', 'parchment', 'contrast', 'spelljammer', 'barovia']) {
    const p = await page(390, 844, theme);
    const bad = [];
    for (const tab of ['npc', 'item', 'spell', 'dpr', 'enc', 'info']) {
      // click via DOM: se la pagina sborda, il telefono rimpicciolisce tutto e
      // le barre fisse coprono le tab → il test segnalerebbe un crash, non lo sbordo.
      await p.evaluate((t) => document.querySelector(`.tab[data-tab="${t}"]`).click(), tab);
      // apre tutto ciò che è richiudibile: è lì che si nascondono gli sbordi
      await p.evaluate(() => document.querySelectorAll('.tab-panel:not([hidden]) details').forEach((d) => { d.open = true; }));
      if (tab === 'npc') await p.evaluate(() => document.getElementById('btn-add-item').click());
      if (!(await noHScroll(p))) bad.push(tab);
    }
    check(`${theme}: tutte le tab entro i 390px`, bad.length === 0, bad);
    check(`${theme}: nessun errore JS`, p.errors.length === 0, p.errors);
    await p.context().close();
  }

  console.log('\n— Telefono: navigazione e foglio anteprima —');
  {
    const p = await page(390, 844);
    const nav = await p.$eval('.tabs', (n) => { const r = n.getBoundingClientRect(); return { bottom: Math.round(r.bottom), pos: getComputedStyle(n).position }; });
    check('tab fisse in basso, sei voci a icona', nav.pos === 'fixed' && nav.bottom === 844 && await shown(p, '.tab-m .tab-ico'));
    check('testata compatta (≤ 70px)', (await p.$eval('header', (h) => h.getBoundingClientRect().height)) <= 70);
    check('form Mostro: anteprima fuori dal flusso, barra azioni visibile', !(await shown(p, '#tab-npc > aside')) && await shown(p, '#tab-npc .m-bar'));
    check('campi a 16px (iOS non zooma) e alti ≥ 40px', await p.$eval('#name', (i) => parseFloat(getComputedStyle(i).fontSize) >= 16 && i.getBoundingClientRect().height >= 40));
    check('sezioni meno usate chiuse alla prima visita', (await p.$$('#npc-form > fieldset.folded')).length === 5);

    await p.fill('#name', 'Barbazu di prova');
    await p.fill('#hpMax', '110');
    await p.click('#btn-add-item');
    await p.fill('.item-card input[data-f="name"]', 'Artiglio');
    await p.evaluate(() => document.activeElement.blur());
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const gap = await p.evaluate(() => {
      const last = [...document.querySelectorAll('#npc-form > fieldset')].at(-1).getBoundingClientRect();
      return document.querySelector('#tab-npc .m-bar').getBoundingClientRect().top - last.bottom;
    });
    check('in fondo alla pagina l\'ultima sezione non finisce sotto la barra', gap >= 0, gap);

    await p.click('#tab-npc .m-open');
    const sheet = await p.$eval('#tab-npc > aside', (a) => ({ top: a.getBoundingClientRect().top, fixed: getComputedStyle(a).position === 'fixed', lock: document.documentElement.classList.contains('sheet-lock') }));
    check('foglio aperto a tutto schermo, pagina sotto bloccata', sheet.top === 0 && sheet.fixed && sheet.lock, sheet);
    check('nel foglio: Esporta, collezione, CR e anteprima JSON', await shown(p, '#btn-export') && await shown(p, '#batch-count') && await shown(p, '#cr-readout') && await shown(p, '#preview'));
    await p.goBack();
    await p.waitForTimeout(150);
    check('tasto indietro: chiude il foglio senza lasciare la pagina', !(await p.$eval('#tab-npc', (s) => s.classList.contains('sheet-open'))) && p.url() === URL);
    await p.click('#tab-npc .m-open');
    await p.click('#tab-npc .m-close');
    await p.waitForTimeout(150);
    check('✕ chiude il foglio e sblocca lo scroll', await p.evaluate(() => !document.querySelector('#tab-npc').classList.contains('sheet-open') && !document.documentElement.classList.contains('sheet-lock')));

    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 3000 }).catch(() => null), p.click('#tab-npc .m-export')]);
    check('Esporta dalla barra scarica il JSON', dl?.suggestedFilename() === 'fvttActor-barbazu-di-prova.json', dl?.suggestedFilename());
    await p.fill('#name', '');
    await p.evaluate(() => document.activeElement.blur());
    await p.click('#tab-npc .m-export');
    await p.waitForTimeout(100);
    check('export bloccato: il motivo compare nella barra', /obbligatorio|required/i.test(await p.textContent('#tab-npc .m-msg')) && await shown(p, '#tab-npc .m-msg'));

    // Tastiera: solo il focus NON nasconde le barre; l'area visibile ridotta sì;
    // tastiera chiusa col tasto indietro (focus rimasto nel campo) → tornano.
    await p.focus('#name');
    await p.waitForTimeout(100);
    check('focus senza tastiera: barre visibili', await shown(p, '.tabs'));
    await p.setViewportSize({ width: 390, height: 470 });
    await p.waitForTimeout(150);
    check('tastiera aperta: tab e barra azioni nascoste', !(await shown(p, '.tabs')) && !(await shown(p, '#tab-npc .m-bar')));
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(150);
    check('tastiera chiusa (focus ancora nel campo): barre di nuovo visibili', await shown(p, '.tabs') && await shown(p, '#tab-npc .m-bar'));
    await p.evaluate(() => document.activeElement.blur());

    await p.click('#npc-form > fieldset:nth-of-type(2) > legend');
    await p.reload();
    await p.waitForSelector('#tab-npc .m-bar', { state: 'attached' });
    check('sezione chiusa a mano: ricordata dopo il ricaricamento', await p.$eval('#npc-form > fieldset:nth-of-type(2)', (f) => f.classList.contains('folded')));

    await p.evaluate(() => window.scrollTo(0, 600));
    await p.click('.tab[data-tab="item"]');
    await p.waitForTimeout(100);
    check('cambio tab: nuova tab dall\'alto, con la sua barra', (await p.evaluate(() => window.scrollY)) === 0 && await shown(p, '#tab-item .m-bar') && !(await shown(p, '#tab-npc .m-bar')));
    await p.click('.tab[data-tab="dpr"]');
    check('DPR e Scontro: nessuna barra azioni', !(await shown(p, '.m-bar')));
    check('nessun errore JS', p.errors.length === 0, p.errors);
    await p.context().close();
  }

  console.log('\n— Tablet 820×1180: tab in alto, barra azioni + foglio —');
  {
    const p = await page(820, 1180);
    check('tab in alto (non fisse)', await p.$eval('.tabs', (n) => getComputedStyle(n).position !== 'fixed'));
    check('tab su una riga sola (icona + nome breve)', await p.$$eval('.tab', (ts) => ts.every((t) => t.getBoundingClientRect().height < 48 && getComputedStyle(t.querySelector('.tab-full')).display === 'none')));
    await p.focus('#name');
    await p.setViewportSize({ width: 820, height: 700 });
    await p.waitForTimeout(150);
    check('tastiera aperta anche su tablet: barra azioni nascosta', !(await shown(p, '#tab-npc .m-bar')));
    await p.setViewportSize({ width: 820, height: 1180 });
    await p.evaluate(() => document.activeElement.blur());
    await p.waitForTimeout(150);
    check('barra azioni in fondo allo schermo', await shown(p, '#tab-npc .m-bar') && await p.$eval('#tab-npc .m-bar', (b) => Math.round(b.getBoundingClientRect().bottom) === 1180));
    check('nessuno scroll orizzontale', await noHScroll(p));
    check('sezioni tutte aperte (le chiusure di default sono solo per telefono)', (await p.$$('#npc-form > fieldset.folded')).length === 0);
    await p.context().close();
  }

  console.log('\n— Desktop 1366×900: invariato —');
  {
    const p = await page(1366, 900);
    check('niente barra azioni né intestazione del foglio', !(await shown(p, '.m-bar')) && !(await shown(p, '.m-sheet-head')));
    check('anteprima a destra del form', await p.evaluate(() => document.querySelector('#tab-npc > aside').getBoundingClientRect().left > document.querySelector('#npc-form').getBoundingClientRect().right));
    check('tab con etichetta completa', await shown(p, '.tab-full') && !(await shown(p, '.tab-m .tab-ico')));
    check('sottotitolo completo con versione', /Foundry VTT 13.*v0\.\d+/.test(await p.textContent('.subtitle')));
    check('nessuno scroll orizzontale', await noHScroll(p));
    check('nessun errore JS', p.errors.length === 0, p.errors);
    await p.context().close();
  }

  await browser.close();
  srv.close();
  if (failures) { console.error(`\n${failures} controlli UI falliti.`); process.exit(1); }
  console.log('\nTutti i controlli UI passati ✔');
})();
