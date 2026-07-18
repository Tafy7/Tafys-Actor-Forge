# ⚒️ Tafy's Actor Forge

Generatore di JSON importabili in **Foundry VTT 13** (sistema **dnd5e 5.3.3**): compili un form, scarichi il JSON, lo importi in Foundry con *Import Data*.

## Comandi

```bash
npm install    # solo la prima volta: scarica le dipendenze (Vite)
npm run dev    # avvia l'app su http://localhost:5173
npm test       # smoke test del builder
npm run build  # crea la versione pubblicabile in dist/
```

## Come importare in Foundry

1. In Foundry crea un Actor vuoto (tipo NPC).
2. Tasto destro sull'actor nella sidebar → **Import Data**.
3. Seleziona il file `fvttActor-*.json` scaricato dall'app.

⚠️ *Import Data* **sovrascrive** l'actor su cui lo esegui: usalo sempre su un documento vuoto o sacrificabile.

## Filosofia del progetto: i golden template

Non inventiamo mai lo schema dei dati: lo copiamo da export reali fatti da Foundry (cartella `templates/`). Il file `src/data/npc-base.js` è generato dall'export di Zariel svuotato dei valori. Se aggiorni la versione di dnd5e, ri-esporta un actor e confronta le differenze prima di fidarti dell'app.

## Struttura

```
src/
├── main.js            # collega il form al builder
├── styles.css
├── builders/npc.js    # costruisce l'Actor dal form (il cuore dell'app)
├── data/
│   ├── npc-base.js    # template NPC generato dai golden template
│   └── constants.js   # id dnd5e: skill, taglie, tipi di danno, lingue...
└── utils/
    ├── id.js          # generatore di ID in formato Foundry (16 caratteri)
    └── download.js    # download del JSON dal browser
templates/             # export reali di Foundry usati come riferimento schema
test/smoke.mjs         # verifica il builder contro i golden template
```

## Roadmap

Vedi il documento *Actor Forge – Roadmap* nel Project Claude: Fase 2 = item embedded e activities, Fase 3 = effetti DAE e flag Midi-QOL, Fase 4 = parser di statblock, Fase 5 = QoL e packaging.
