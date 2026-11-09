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

## Crediti e licenze

Strumento non ufficiale, non affiliato né approvato da Foundry Gaming LLC o da Wizards of the Coast. Foundry Virtual Tabletop e Dungeons & Dragons sono marchi dei rispettivi proprietari.

Per collegare gli incantesimi dei mostri il Forge contiene nomi, livelli e id degli incantesimi dei compendi del sistema dnd5e (`src/data/srd-spells.js`):

> This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

L'elenco delle animazioni (`src/data/jb2a-free-index.js`) deriva da [JB2A — Jules&Ben's Animated Assets](https://github.com/Jules-Bens-Aa/JB2A_DnD5e) (libreria gratuita), licenza [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); i video non sono inclusi, le anteprime si caricano dal repository di JB2A.

Il Forge funziona interamente nel browser: nessun account, nessun server, nessun dato raccolto.
