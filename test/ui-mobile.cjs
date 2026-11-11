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
  for (const theme of ['taf', 'avernus', 'parchment', 'contrast', 'spelljammer', 'barovia', 'studio', 'studio-light']) {
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
    check('sezioni meno usate chiuse alla prima visita', (await p.$$('#npc-form > fieldset.folded:not(.studio-only)')).length === 5);

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
    check('sezioni tutte aperte (le chiusure di default sono solo per telefono)', (await p.$$('#npc-form > fieldset.folded:not(.studio-only)')).length === 0);
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

  console.log('\n— Nuovo design "Studio" (selezionabile tra i temi) —');
  for (const theme of ['studio', 'studio-light']) {
    const p = await page(1366, 900, theme);
    check(`${theme}: design applicato prima del primo disegno`, await p.evaluate(() => document.documentElement.dataset.design === 'studio'));
    check(`${theme}: indice delle sezioni a sinistra del form`, await shown(p, '.section-nav') && await p.evaluate(() => document.querySelector('.section-nav').getBoundingClientRect().right <= document.querySelector('#npc-form').getBoundingClientRect().left));
    check(`${theme}: form al centro, comandi a destra`, await p.evaluate(() => document.querySelector('#tab-npc > aside').getBoundingClientRect().left > document.querySelector('#npc-form').getBoundingClientRect().right));
    check(`${theme}: Esporta è il primo comando della colonna`, await p.evaluate(() => { const a = document.querySelector('#tab-npc .aside-fixed'); const top = (s) => a.querySelector(s).getBoundingClientRect().top; return top('#btn-export') < top('.cr-panel') && top('.cr-panel') < top('.panel-box') && top('.panel-box') < top('.preview-head'); }));
    // l'indice porta alla sezione e la segna come corrente
    await p.evaluate(() => [...document.querySelectorAll('.section-nav a')].find((a) => a.getAttribute('href') === '#' + document.getElementById('items-list').closest('fieldset').id).click());
    await p.waitForTimeout(900);
    check(`${theme}: clic sull'indice → la sezione arriva sotto la barra delle tab`, await p.evaluate(() => { const r = document.getElementById('items-list').closest('fieldset').getBoundingClientRect(); const tabs = document.getElementById('tabs').getBoundingClientRect(); return r.top >= tabs.bottom - 1 && r.top < 200; }));
    check(`${theme}: voce corrente evidenziata`, await p.evaluate(() => document.querySelector('.section-nav a.active')?.getAttribute('href') === '#' + document.getElementById('items-list').closest('fieldset').id));
    check(`${theme}: la barra delle tab resta in alto scorrendo`, await p.evaluate(() => Math.round(document.getElementById('tabs').getBoundingClientRect().top) === 0 && window.scrollY > 300));
    await p.evaluate(() => document.getElementById('btn-add-item').click());
    check(`${theme}: l'indice conta le azioni`, await p.evaluate(() => document.querySelector('.section-nav a[data-count]')?.dataset.count === '1'));
    check(`${theme}: nessuno scroll orizzontale`, await noHScroll(p));
    check(`${theme}: nessun errore JS`, p.errors.length === 0, p.errors);
    await p.context().close();
  }
  {
    // Il cambio dal menu dei temi non ricarica la pagina e torna indietro pulito.
    const p = await page(1366, 900, 'taf');
    check('tema classico: niente indice delle sezioni, design "classic"', !(await shown(p, '.section-nav')) && await p.evaluate(() => document.documentElement.dataset.design === 'classic'));
    check('menu dei temi a gruppi (nuovo design / classici)', await p.evaluate(() => document.querySelectorAll('#theme-picker optgroup').length === 2 && document.querySelectorAll('#theme-picker option').length === 8));
    await p.selectOption('#theme-picker', 'studio-light');
    check('scelta dal menu → Studio attivo senza ricaricare', await shown(p, '.section-nav') && await p.evaluate(() => document.documentElement.dataset.theme === 'studio-light' && localStorage.getItem('tafys-forge-theme') === 'studio-light'));
    await p.selectOption('#theme-picker', 'taf');
    check('ritorno al classico → tutto come prima', !(await shown(p, '.section-nav')) && await p.evaluate(() => document.documentElement.dataset.design === 'classic'));
    const narrow = await page(1100, 800, 'studio');
    check('schermo medio (1100px): due colonne, indice nascosto', !(await shown(narrow, '.section-nav')) && await narrow.evaluate(() => document.querySelector('#tab-npc > aside').getBoundingClientRect().left > document.querySelector('#npc-form').getBoundingClientRect().right));
    await narrow.context().close();
    await p.context().close();
  }

  console.log('\n— Studio: competenze e danni "a clic", sezione Incantesimi —');
  {
    const p = await page(1366, 900, 'studio');
    const json = () => p.evaluate(() => new Promise((r) => setTimeout(() => r(JSON.parse(document.getElementById('preview').textContent)), 220)));
    const click = (sel, n = 1) => p.evaluate(([s, k]) => { for (let i = 0; i < k; i++) document.querySelector(s).click(); }, [sel, n]);
    const hit = 'onerror="window.__xss=(window.__xss||0)+1"';

    // --- Competenze ---
    check('abilità: pallini al posto dei menu, 3 colonne × 6 righe', !(await shown(p, '#skills-grid')) && await p.evaluate(() => { const b = [...document.querySelectorAll('#skills-pills .sk-pill')]; const xs = new Set(b.map((x) => Math.round(x.getBoundingClientRect().left))); const ys = new Set(b.map((x) => Math.round(x.getBoundingClientRect().top))); return b.length === 18 && xs.size === 3 && ys.size === 6; }));
    check('legenda accanto al titolo: nessuna, mezza, competenza, expertise', await p.evaluate(() => document.querySelectorAll('#skills-legend .sk-dot').length === 4));
    const lv = () => p.evaluate(() => [document.querySelector('[data-sk="ste"]').dataset.lv, document.querySelector('select[data-skill="ste"]').value]);
    const seen = [];
    for (let i = 0; i < 4; i++) { await click('[data-sk="ste"]'); seen.push((await lv()).join('='));}
    check('clic sul nome: competenza → expertise → mezza → niente (menu classico allineato)', seen.join(' ') === '1=1 2=2 0.5=0.5 0=0', seen);
    await click('[data-sk="prf"]', 3); await click('[data-sk="acr"]', 1);
    let a = await json();
    check('il JSON segue i pallini (0.5 e 1)', a.system.skills.prf.value === 0.5 && a.system.skills.acr.value === 1 && a.system.skills.ste.value === 0);

    // --- Danni ---
    check('danni: una pillola per tipo, i tre gruppi classici nascosti', !(await shown(p, '#chips-dr')) && await p.evaluate(() => document.querySelectorAll('#dmg-matrix [data-dm]').length === 13));
    const st = (id) => p.evaluate((d) => document.querySelector(`[data-dm="${d}"]`).dataset.st, id);
    const cyc = [];
    for (let i = 0; i < 4; i++) { await click('[data-dm="fire"]'); cyc.push(await st('fire')); }
    check('clic: "/" resistente → "X" immune → "!" vulnerabile → niente', cyc.join(',') === 'r,i,v,', cyc);
    check('senza danni fisici resistenti non si chiede "non valgono contro…"', await p.evaluate(() => !document.querySelector('#dmg-matrix .dm-bypass')));
    await click('[data-dm="fire"]', 2); await click('[data-dm="cold"]'); await click('[data-dm="slashing"]');
    await p.evaluate(() => { const c = document.querySelector('[data-bp="r:nonmagical"]'); c.click(); });
    await p.evaluate(() => document.querySelector('[data-bp="r:silvered"]').click());
    a = await json();
    check('un tipo sta in UN solo elenco; i "non valgono contro" finiscono nei bypass', JSON.stringify([a.system.traits.dr.value, a.system.traits.dr.bypasses, a.system.traits.di.value, a.system.traits.dv.value]) === JSON.stringify([['cold', 'slashing'], ['mgc', 'sil'], ['fire'], []]), a.system.traits.dr);
    await click('[data-dm="slashing"]');
    a = await json();
    check('tagliente passa a immune: i bypass delle resistenze spariscono, compare la riga delle immunità', a.system.traits.dr.bypasses.length === 0 && a.system.traits.di.value.includes('slashing') && await p.evaluate(() => !!document.querySelector('[data-bp="i:nonmagical"]') && !document.querySelector('[data-bp="r:nonmagical"]')));
    await p.evaluate((x) => { document.getElementById('dm-custom').value = `legno<img src=x ${x}>`; document.getElementById('dm-custom-st').value = 'v'; document.getElementById('dm-add').click(); }, hit);
    a = await json();
    check('voce libera con lo stato scelto (vulnerabile), mostrata come testo', /legno/.test(a.system.traits.dv.custom) && await p.evaluate(() => !window.__xss && !document.querySelector('#dmg-matrix img') && /legno<img/.test(document.querySelector('#dmg-matrix .dm-custom').textContent)));
    await click('#dmg-matrix [data-dmx="0"]');
    a = await json();
    check('× toglie la voce libera', a.system.traits.dv.custom === '');

    // --- Incantesimi ---
    check('sezione Incantesimi: chiusa finché non serve, col riepilogo nel titolo', await p.evaluate(() => document.getElementById('sec-spells').classList.contains('folded') && /nessuno/.test(document.getElementById('scs-summary').textContent)));
    await click('#sec-spells > legend');
    await p.fill('#cha', '18');
    check('"Automatica" dice quale caratteristica vale (la più alta: Carisma)', await p.evaluate(() => /Carisma/.test(document.getElementById('scs-ability').options[0].textContent)));
    await p.fill('#scs-input', 'me');
    check('due caratteri: nessun suggerimento', await p.evaluate(() => document.getElementById('scs-sugg').hidden));
    await p.fill('#scs-input', 'Mend');
    check('"Mend" → suggerisce Mending', await p.evaluate(() => !document.getElementById('scs-sugg').hidden && document.querySelector('#scs-sugg li span').textContent === 'Mending'));
    check('scrivere nella casella non crea ancora nulla', (await json()).items.length === 0);
    await p.press('#scs-input', 'ArrowDown'); await p.press('#scs-input', 'Enter');
    const chips = () => p.evaluate(() => [...document.querySelectorAll('#scs-chips .scs-chip')].map((c) => `${c.querySelector('.scs-name').textContent.trim()}|${c.querySelector('.scs-mode').textContent.trim()}`));
    check('freccia + Invio: pillola "Mending", a volontà (è un trucchetto)', (await chips()).join() === 'Mending|∞');
    await p.fill('#scs-level', '5');
    check('livello 5: gli slot del livello compaiono in grigio (4/3/2)', await p.evaluate(() => [...document.querySelectorAll('#scs-slots-box [data-slot]')].slice(0, 4).map((i) => i.placeholder).join() === '4,3,2,0' && !document.getElementById('scs-slots-box').hidden));
    await p.fill('#scs-input', 'fireball, FIREBALL , Silvery Barbs'); await p.press('#scs-input', 'Enter');
    await p.evaluate((x) => { const i = document.getElementById('scs-input'); i.value = `Finto<img src=x ${x}>`; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, hit);
    const list = await chips();
    check('virgole = più incantesimi, doppioni scartati, nome del compendio, ordine degli statblock', list.filter((x) => !/Finto/.test(x)).join() === 'Mending|∞,Silvery Barbs|slot,Fireball|slot 3°', list);
    check('un nome con HTML resta testo', list.length === 4 && await p.evaluate(() => !window.__xss && !document.querySelector('#scs-chips img')));
    await p.evaluate(() => [...document.querySelectorAll('#scs-chips .scs-chip')].find((c) => /Finto/.test(c.textContent)).querySelector('.scs-x').click());
    check('fuori dai compendi di sistema: tratteggiato, con avviso e livello a scelta', await p.evaluate(() => { const c = [...document.querySelectorAll('#scs-chips .scs-chip')].find((x) => /Silvery/.test(x.textContent)); return c.classList.contains('miss') && !!c.querySelector('.scs-lv') && !document.getElementById('scs-note').hidden; }));
    a = await json();
    const acts = (x) => Object.values(x.items.find((i) => i.type === 'feat').system.activities);
    const tg = (act) => act.consumption.targets.map((t) => `${t.type}:${t.target || ''}`).join();
    check('JSON: Fireball consuma uno slot di 3°, livello 5 e caratteristica automatica', acts(a).some((x) => tg(x) === 'spellSlots:3' && x.spell.level === 3) && a.system.attributes.spell.level === 5 && a.system.attributes.spellcasting === 'cha' && a.system.spells.spell3.value === 2 && a.system.spells.spell3.override === null);
    await p.fill('#scs-slots-box [data-slot="2"]', '3');
    a = await json();
    check('slot di 3° scritto a mano → override', a.system.spells.spell3.value === 3 && a.system.spells.spell3.override === 3 && a.system.spells.spell1.override === null);
    for (let i = 0; i < 3; i++) await p.evaluate(() => [...document.querySelectorAll('#scs-chips .scs-chip')].find((c) => /Fireball/.test(c.textContent)).querySelector('.scs-mode').click());
    a = await json();
    check('clic sul simbolo: slot → ∞ → 1/g → 2/g (usi + consumo nel JSON)', (await chips()).includes('Fireball|2/g') && acts(a).some((x) => x.uses.max === '2' && tg(x) === 'activityUses:'), await chips());
    check('nei temi Studio la card tra le azioni rimanda alla sezione', await p.evaluate(() => !!document.querySelector('#items-list .sc-stub') && !document.querySelector('#items-list [data-f="spellList"]')));

    // --- Stessi dati nei due design ---
    await p.selectOption('#theme-picker', 'taf');
    check('tema classico: stessi dati nei controlli di sempre', !(await shown(p, '#sec-spells')) && !(await shown(p, '#skills-pills')) && !(await shown(p, '#dmg-matrix')) && await shown(p, '#skills-grid') && await shown(p, '#chips-dr')
      && await p.evaluate(() => document.querySelector('select[data-skill="prf"]').value === '0.5' && document.querySelector('#chips-di .chip[data-id="fire"]').classList.contains('on')
        && /Trucchetti \(a volontà\): Mending/.test(document.querySelector('#items-list [data-f="spellList"]').value) && /2\/giorno: Fireball/.test(document.querySelector('#items-list [data-f="spellList"]').value)));
    await p.evaluate(() => { document.querySelector('#chips-dr .chip[data-id="acid"]').click(); const s = document.querySelector('select[data-skill="arc"]'); s.value = '2'; s.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.selectOption('#theme-picker', 'studio');
    check('modificato nel classico → il design Studio lo mostra', await st('acid') === 'r' && await p.evaluate(() => document.querySelector('[data-sk="arc"]').dataset.lv === '2') && (await chips()).length === 3);
    await click('#scs-remove');
    a = await json();
    check('"Togli il blocco": niente più incantesimi nel JSON, livello a zero', !a.items.some((i) => i.type === 'feat') && a.system.attributes.spell.level === 0 && (await chips()).length === 0);

    await p.evaluate(() => { for (const id of ['scs-ability', 'scs-level', 'scs-nomat']) document.getElementById(id).dispatchEvent(new Event('input', { bubbles: true })); });
    check('toccare un campo lasciandolo vuoto non fa del mostro un incantatore', !(await json()).items.some((i) => i.type === 'feat') && await p.evaluate(() => document.getElementById('scs-remove').hidden));

    // --- Dallo statblock ---
    await p.evaluate(() => { document.getElementById('statblock-input').value = `Strega di Prova\nMedium Humanoid, Neutral Evil\nArmor Class 12\nHit Points 40 (9d8)\nSpeed 30 ft.\nSTR 9 (-1) DEX 14 (+2) CON 11 (+0) INT 10 (+0) WIS 17 (+3) CHA 11 (+0)\nSkills Stealth +6\nDamage Resistances cold; bludgeoning, piercing, and slashing from nonmagical attacks\nChallenge 4 (1,100 XP)\nInnate Spellcasting. The witch's innate spellcasting ability is Wisdom (spell save DC 13). She can innately cast the following spells, requiring no material components:\nAt will: light, mage hand\n2/day each: fireball\nActions\nDagger. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.`; });
    await click('#btn-parse-statblock', 2); // secondo clic = conferma (il form ha già dati)
    await p.waitForTimeout(300);
    check('statblock → sezione Incantesimi (Saggezza, senza materiali, ∞ e 2/g)', (await chips()).join() === 'light|∞,mage hand|∞,fireball|2/g' && await p.evaluate(() => document.getElementById('scs-ability').value === 'wis' && document.getElementById('scs-nomat').checked && /3 incantesimi · Saggezza/.test(document.getElementById('scs-summary').textContent)), await chips());
    check('statblock → pallini e danni (Furtività, freddo e fisici resistenti, non magici)', await p.evaluate(() => document.querySelector('[data-sk="ste"]').dataset.lv !== '0' && ['cold', 'bludgeoning', 'piercing', 'slashing'].every((d) => document.querySelector(`[data-dm="${d}"]`).dataset.st === 'r') && document.querySelector('[data-bp="r:nonmagical"]').checked));

    // --- Indice nascondibile ---
    const formW = () => p.evaluate(() => Math.round(document.getElementById('npc-form').getBoundingClientRect().width));
    const w0 = await formW();
    await click('.section-nav-toggle');
    check('indice nascosto: resta il pulsante, il form si allarga', await p.evaluate(() => getComputedStyle(document.querySelector('.section-nav a')).display === 'none' && document.querySelector('.section-nav-toggle').getAttribute('aria-expanded') === 'false') && (await formW()) > w0 + 60);
    await p.reload(); await p.waitForSelector('.section-nav-toggle', { state: 'attached' });
    check('la scelta è ricordata al ricaricamento', await p.evaluate(() => document.documentElement.dataset.nav === 'off'));
    await click('.section-nav-toggle');
    check('un clic e l\'indice torna', await p.evaluate(() => getComputedStyle(document.querySelector('.section-nav a')).display !== 'none'));
    check('nessuno scroll orizzontale, nessun errore JS', await noHScroll(p) && p.errors.length === 0, p.errors);
    await p.context().close();
  }
  for (const theme of ['studio', 'studio-light']) {
    // Telefono: i controlli nuovi stanno dentro sezioni chiuse di default → si aprono tutte.
    const p = await page(390, 844, theme);
    await p.evaluate(() => document.querySelectorAll('#npc-form > fieldset.folded > legend').forEach((l) => l.click()));
    await p.evaluate(() => { document.getElementById('scs-level').value = '9'; document.getElementById('scs-level').dispatchEvent(new Event('input', { bubbles: true })); });
    await p.evaluate(() => { const i = document.getElementById('scs-input'); i.value = 'Fireball, Evard\'s Black Tentacles, Un Incantesimo Dal Nome Davvero Molto Lungo, Mage Hand'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await p.evaluate(() => { for (const d of ['bludgeoning', 'fire', 'poison']) document.querySelector(`[data-dm="${d}"]`).click(); });
    check(`${theme} su telefono: abilità su 2 colonne, tutto entro i 390px`, await noHScroll(p) && await p.evaluate(() => new Set([...document.querySelectorAll('#skills-pills .sk-pill')].map((x) => Math.round(x.getBoundingClientRect().left))).size === 2 && document.querySelectorAll('#scs-chips .scs-chip').length === 4));
    check(`${theme} su telefono: bersagli da dito (pillole ≥ 40px)`, await p.evaluate(() => [...document.querySelectorAll('.sk-pill, .dm-pill, .scs-chip')].every((x) => x.getBoundingClientRect().height >= 40)));
    check(`${theme} su telefono: nessun errore JS`, p.errors.length === 0, p.errors);
    await p.context().close();
  }

  console.log('\n— Voci del mostro create nelle tab Oggetto / Incantesimo —');
  for (const theme of ['taf', 'studio']) {
    const p = await page(1366, 900, theme);
    const json = () => p.evaluate(() => new Promise((r) => setTimeout(() => r(JSON.parse(document.getElementById('preview').textContent)), 220)));
    const tabShown = (n) => p.evaluate((x) => !document.getElementById('tab-' + x).hidden, n);
    const setF = (form, f, v) => p.evaluate(([a, b, c]) => { const el = document.querySelector(`#${a}-form-body [data-f="${b}"]`); el.value = c; el.dispatchEvent(new Event('input', { bubbles: true })); }, [form, f, v]);
    const cards = () => p.evaluate(() => [...document.querySelectorAll('#items-list .item-card')].map((c) => (c.classList.contains('raw-card') ? 'raw:' : 'card:') + c.querySelector('.item-card-head strong').textContent.replace(/^#\d+ · /, '')));
    const hit = 'onerror="window.__xss=(window.__xss||0)+1"';
    await p.fill('#name', 'Custode di Prova'); await p.fill('#hpMax', '90');
    await p.click('#btn-from-item');
    check(`${theme}: "Crea nella tab Oggetto" porta alla tab`, await tabShown('item') && !(await tabShown('npc')));
    await p.click('#item-sheet');
    check(`${theme}: senza nome non si aggiunge (stessi controlli della collezione)`, /⛔/.test(await p.textContent('#item-warn')) && (await cards()).length === 0);
    await setF('item', 'name', `Spadone<img src=x ${hit}>`); await setF('item', 'damage', '2d8 + @mod slashing, 4d8 necrotic');
    await p.click('#item-sheet');
    check(`${theme}: aggiunto alla scheda, con il nome del mostro nel messaggio`, /aggiunto alla scheda di «Custode di Prova»/.test(await p.textContent('#item-warn')) && (await p.textContent('#item-sheet')).includes('Aggiungi'));
    await p.click('#item-warn [data-goto-tab]');
    let list = await cards();
    check(`${theme}: "Vai al mostro" → la voce è tra le azioni, come testo (niente HTML iniettato)`, await tabShown('npc') && list.length === 1 && /^raw:Spadone<img/.test(list[0]) && await p.evaluate(() => !window.__xss && !document.querySelector('#items-list img')));
    let a = await json();
    check(`${theme}: nel JSON del mostro c'è l'oggetto intero (tipo, danni, attività)`, a.items.length === 1 && a.items[0].type === 'weapon' && Object.keys(a.items[0].system.activities).length === 1 && /^[A-Za-z0-9]{16}$/.test(a.items[0]._id));
    check(`${theme}: struttura valida (l'export non è bloccato) e il CR conta l'attacco`, await p.evaluate(() => !document.getElementById('validation').classList.contains('has-error') && /\d/.test(document.getElementById('cr-readout').textContent)));
    // seconda voce uguale: NON sostituisce la prima
    await p.click('#btn-from-item'); await setF('item', 'name', 'Artiglio'); await p.click('#item-sheet');
    check(`${theme}: un'altra aggiunta crea una seconda voce`, (await cards()).join('|').replace(/<img[^>]*>/, '') === 'raw:Spadone|raw:Artiglio', await cards());
    // modifica dalla card: la tab ha altro lavoro → secondo clic
    await p.click('.tab[data-tab="npc"]');
    await p.click('#items-list [data-raw-edit="0"]');
    check(`${theme}: "Modifica nella tab" chiede conferma se la tab ha altro lavoro`, await tabShown('npc') && /clicca di nuovo/.test(await p.textContent('#items-list [data-raw-edit="0"]')));
    await p.click('#items-list [data-raw-edit="0"]');
    check(`${theme}: secondo clic → la voce si riapre nella tab, collegata ("Aggiorna")`, await tabShown('item') && /^Spadone/.test(await p.inputValue('#item-form-body [data-f="name"]')) && /Aggiorna/.test(await p.textContent('#item-sheet')));
    await setF('item', 'name', 'Spadone di Brace'); await p.click('#item-sheet');
    check(`${theme}: "Aggiorna sulla scheda" cambia QUELLA voce, non ne aggiunge`, /aggiornato/.test(await p.textContent('#item-warn')) && (await cards()).join('|') === 'raw:Spadone di Brace|raw:Artiglio', await cards());
    // incantesimo
    await p.click('.tab[data-tab="npc"]'); await p.click('#btn-from-spell');
    await setF('spell', 'name', 'Dardo di Brace'); await p.click('#spell-sheet');
    a = await json();
    check(`${theme}: incantesimo aggiunto come incantesimo vero`, await tabShown('spell') && a.items.length === 3 && a.items[2].type === 'spell' && a.items[2].name === 'Dardo di Brace' && (await cards())[2] === 'raw:Dardo di Brace');
    // duplica e ricarica della pagina
    await p.click('.tab[data-tab="npc"]');
    await p.click('#items-list [data-dup="1"]');
    check(`${theme}: duplicare una voce delle tab → copia con il suo nome`, (await cards())[2] === 'raw:Artiglio (copia)' && (await json()).items[2].name === 'Artiglio (copia)');
    await p.waitForTimeout(600); await p.reload(); await p.waitForSelector('#tab-npc .m-bar', { state: 'attached' });
    check(`${theme}: dopo un ricaricamento della pagina le voci ci sono ancora`, (await cards()).length === 4 && (await json()).items.length === 4);
    check(`${theme}: nessun errore JS, nessuno scroll orizzontale`, p.errors.length === 0 && await noHScroll(p), p.errors);
    await p.context().close();
  }

  console.log('\n— Sicurezza: un JSON importato non esegue codice —');
  {
    // Chi condivide un JSON può scriverci dentro dell'HTML: caricandolo nel
    // form non deve MAI diventare codice (né elementi) della pagina.
    const hit = 'onerror="window.__xss=(window.__xss||0)+1"';
    const P = `</textarea><img src=x ${hit}>`;
    const A = `"><img src=x ${hit}>`;
    const actor = { name: 'Prova', type: 'npc', system: { abilities: {}, attributes: { hp: { max: 5 } }, details: { cr: 1 }, traits: {} },
      items: [{ _id: 'aaaaaaaaaaaaaaaa', name: 'Morso' + A, type: 'weapon', img: 'icons/x.webp' + A,
        system: { description: { value: 'Tom &amp; Jerry' + P }, range: { value: '5' + A }, activities: { a: { _id: 'a', type: 'attack', attack: { type: { value: 'melee' } }, damage: { parts: [] } } } } }] };
    const spell = { name: 'Dardo', type: 'spell', system: { level: 1, school: 'evo', description: { value: 'x' + P },
      target: { template: { type: `cono<img src=x ${hit}>` } }, range: { units: 'ft' + A }, activities: {} } };
    const p = await page(1366, 900);
    await p.evaluate((json) => { document.getElementById('actor-import-input').value = json; document.getElementById('btn-import-actor').click(); }, JSON.stringify(actor));
    await p.waitForTimeout(400);
    const desc = await p.evaluate(() => document.querySelector('#items-list [data-f="description"]')?.value);
    await p.evaluate((json) => { document.getElementById('spell-import-input').value = json; document.getElementById('spell-import-btn').click(); }, JSON.stringify(spell));
    await p.waitForTimeout(400);
    check('nessun codice eseguito, nessun elemento iniettato', await p.evaluate(() => !window.__xss && !document.querySelector('img[src="x"]')));
    check('il campo mostra ESATTAMENTE il testo dei dati (anche "&amp;")', desc === 'Tom &amp; Jerry' + P, desc);
    check('nessun errore JS', p.errors.length === 0, p.errors);
    await p.context().close();
  }

  await browser.close();
  srv.close();
  if (failures) { console.error(`\n${failures} controlli UI falliti.`); process.exit(1); }
  console.log('\nTutti i controlli UI passati ✔');
})();
