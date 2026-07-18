# Pubblicare Tafy's Actor Forge su GitHub Pages

Guida passo-passo. La prima volta richiede ~10 minuti; dopo, ogni aggiornamento
è **un solo `git push`** e il sito si ricostruisce e ripubblica da solo.

## Come funziona (in breve)
Il file `.github/workflows/deploy.yml` è una **GitHub Action**: a ogni push su
`main` installa le dipendenze, lancia i test (`npm test`), fa il build
(`npm run build` → cartella `dist/`) e pubblica `dist/` su GitHub Pages.
Se test o build falliscono, il deploy **non parte**: online non finisce mai una
versione rotta.

Non serve committare `node_modules/` né `dist/` (li rigenera la Action; sono già
in `.gitignore`).

## Prima pubblicazione

### 1. Crea il repository su GitHub
- Vai su https://github.com/new
- Nome a piacere, es. `tafys-actor-forge`
- Puoi tenerlo **privato**: GitHub Pages funziona anche da repo privati.
- NON aggiungere README/licenza dall'interfaccia (li abbiamo già in locale).

### 2. Collega e carica la cartella del progetto
Da un terminale nella cartella `Tafys-Actor-Forge` (PowerShell o Git Bash):

```bash
git init
git add .
git commit -m "Tafy's Actor Forge — prima versione pubblica"
git branch -M main
git remote add origin https://github.com/TUO-UTENTE/tafys-actor-forge.git
git push -u origin main
```

(Sostituisci `TUO-UTENTE` e il nome repo. Se Git chiede login, usa un Personal
Access Token come password: GitHub → Settings → Developer settings → Tokens.)

### 3. Abilita GitHub Pages con sorgente "GitHub Actions"
- Sul repo → **Settings** → **Pages**
- In **Build and deployment → Source** scegli **GitHub Actions** (NON "Deploy from a branch").
- Salva. Non serve altro: il workflow è già nel repo.

### 4. Attendi il primo deploy
- Vai nella scheda **Actions** del repo: vedrai il workflow "Deploy to GitHub Pages" in esecuzione.
- Al termine (~1–2 min) l'URL del sito compare in **Settings → Pages** in alto,
  di solito `https://TUO-UTENTE.github.io/tafys-actor-forge/`.

Fatto: quella è l'app, accessibile da browser.

## Aggiornamenti successivi
Ogni volta che modifichi il codice:

```bash
git add .
git commit -m "descrizione della modifica"
git push
```

La Action riparte da sola e in un paio di minuti il sito è aggiornato.

## Note
- **HTTPS**: Pages serve in https, quindi i pulsanti "Copia" (clipboard) e il
  salvataggio bozze (localStorage) funzionano senza problemi.
- **Percorsi relativi**: `vite.config.js` ha `base: './'`, quindi il sito
  funziona sia a `.../tafys-actor-forge/` sia con un dominio personalizzato,
  senza cambiare configurazione.
- **Accesso riservato (Patreon)**: un sito Pages pubblico è raggiungibile da
  chiunque abbia l'URL. Per limitare l'accesso ai soli patron servirà un livello
  a monte (es. hosting con password tipo Netlify/Cloudflare Access, o link non
  indicizzati riservati) — è una scelta di distribuzione, non di codice, da
  definire al momento della pubblicazione vera.
