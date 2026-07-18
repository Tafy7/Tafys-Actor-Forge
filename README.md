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

Non inventiamo mai lo schema dei dati: lo copiamo da export reali fatti da Foundry è generato dall'export di actors complessi (ad esempio Zariel o Tiamat) svuotati dei valori. Se aggiorni la versione di dnd5e, ri-esporta un actor e confronta le differenze prima di fidarti dell'app.

## Progetto in sviluppo

Il tool è completamente funzionante, verrà aggiornato con nuove features ed eventuali fix.
