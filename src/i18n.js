// ============================================================
// i18n — internazionalizzazione IT/EN. Fase packaging.
//
// Filosofia di manutenzione: UNA sola fonte. Ogni stringa dell'interfaccia
// vive qui, in coppia it/en. Aggiungere una lingua o una stringa = toccare
// solo questo file (+ l'attributo data-i18n nell'HTML per i testi statici).
//
// Il cambio lingua RICARICA la pagina (semplice e a prova di bug: niente
// widget da ridisegnare a mano). Lo stato del form è autosalvato, quindi
// non si perde nulla.
//
// Node-safe: durante i test (niente DOM/localStorage) la lingua è 'it' di
// default e t() ritorna comunque le stringhe italiane.
// ============================================================

const LANG_KEY = 'tafys-forge-lang';
let LANG = 'it';
try { if (typeof localStorage !== 'undefined') LANG = localStorage.getItem(LANG_KEY) || 'it'; } catch { /* storage off */ }

export function getLang() { return LANG; }

export function setLang(lang) {
  LANG = lang === 'en' ? 'en' : 'it';
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LANG_KEY, LANG); } catch { /* storage off */ }
  if (typeof location !== 'undefined') location.reload();
}

/** Traduce una chiave; `vars` sostituisce i segnaposto {nome}. */
export function t(key, vars) {
  let s = (UI[LANG] && UI[LANG][key]) ?? UI.it[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}

/** Applica le traduzioni ai nodi statici marcati con data-i18n[-ph|-title|-html]. */
export function applyI18n(root) {
  if (typeof document === 'undefined') return;
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  r.querySelectorAll('[data-i18n-ph]').forEach(el => { el.setAttribute('placeholder', t(el.dataset.i18nPh)); });
  r.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  r.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
}

export const UI = {
  it: {
    langToggle: 'EN', langLabel: 'Lingua',
    subtitle: 'Generatore di Actor per Foundry VTT 13 · dnd5e 5.3.3',
    // Import statblock
    sb_legend: 'Importa da statblock', sb_legend_hint: '(italiano o inglese, formato 2014 — metri convertiti in piedi)',
    sb_summary: 'Incolla uno statblock e lascia che compili il form per te (poi controlla!)',
    sb_placeholder: 'Incolla qui lo statblock (dal PDF o dal template)...',
    sb_analyze: '🔎 Analizza e compila il form', sb_template: '📋 Copia template vuoto',
    // Identità
    id_legend: 'Identità', f_name: 'Nome *', f_size: 'Taglia', f_type: 'Tipo di creatura',
    f_subtype: 'Sottotipo', f_alignment: 'Allineamento', f_cr: 'Grado Sfida (CR)', f_rules: 'Regole',
    rules_2014: '2014 (classiche)', rules_2024: '2024 (revised)',
    // Caratteristiche
    ab_legend: 'Caratteristiche', ab_hint: '(spunta = competenza nel tiro salvezza)', ab_save: 'TS',
    // Difese
    def_legend: 'Difese e velocità', f_hpmax: 'HP massimi *', f_hpformula: 'Formula HP', f_ac: 'Classe Armatura',
    ac_default: 'Calcolata', ac_natural: 'Naturale', ac_flat: 'Fissa',
    f_walk: 'Cammina', f_fly: 'Vola', f_swim: 'Nuota', f_climb: 'Scala', f_burrow: 'Scava', f_hover: 'Fluttua',
    f_darkvision: 'Scurovisione', f_blindsight: 'Vista cieca', f_tremorsense: 'Tremorsenso',
    f_truesight: 'Vista pura', f_telepathy: 'Telepatia',
    // Skill
    sk_legend: 'Skill', sk_hint: '(— / Competenza / Expertise)', sk_none: '—', sk_prof: 'Competenza', sk_exp: 'Expertise',
    // Tratti
    tr_legend: 'Tratti', tr_hint: '(clicca per selezionare; il campo libero è per le voci homebrew)',
    tr_dr: 'Resistenze ai danni', tr_di: 'Immunità ai danni', tr_dv: 'Vulnerabilità ai danni',
    tr_ci: 'Immunità alle condizioni', tr_langs: 'Lingue',
    // Azioni
    act_legend: 'Azioni, attacchi e tratti', act_add: '➕ Aggiungi azione / tratto',
    // Leggendario
    leg_legend: 'Leggendario', f_legact: 'Azioni leggendarie', f_legres: 'Resistenze leggendarie',
    // Immagini
    img_legend: 'Immagini', img_legend_hint: '(percorso Foundry o URL web)',
    f_avatar: 'Avatar scheda', f_token: 'Immagine token',
    img_warn: '⚠ Il percorso deve finire con .webp/.png/.jpg (le ?query vengono rimosse in automatico). Gli URL esterni si vedono in scheda ma spesso NON in mappa (CORS): meglio caricare l\'immagine dentro il server (worlds/...).',
    // Bio
    bio_legend: 'Descrizione / Biografia',
    // Batch + azioni
    batch_title: '📦 Collezione batch', batch_add: '➕ Aggiungi', batch_export: 'Esporta collezione', batch_clear: '🗑️ Svuota',
    main_export: '⬇️ Esporta JSON', main_savedraft: '💾 Salva bozza', main_loaddraft: '📂 Carica bozza',
    main_new: '🗑️ Nuova scheda', main_copymacro: '🎲 Copia macro importer',
    preview_title: 'Anteprima JSON', btn_copy: '📋 Copia',
    title_copymacro: 'Copia la macro da incollare una volta sola in Foundry: poi importi gli actor senza il giro «crea vuoto → Import Data»',
    title_copypreview: 'Copia tutto il JSON negli appunti',
    // Placeholder
    ph_name: 'Diavolo delle Sabbie', ph_subtype: 'Devil', ph_alignment: 'Lawful Evil',
    ph_hpmax: '112', ph_hpformula: '15d10 + 30', ph_acflat: 'Valore CA (per naturale/fissa)',
    ph_avatar: 'https://... oppure worlds/avernus/img/mostro.webp', ph_token: 'vuoto = usa l\'avatar',
    ph_bio: 'Supporta HTML: <p>, <b>, tabelle...',
    // Messaggi dinamici
    val_ok: '✓ Struttura valida — nessun problema rilevato',
    val_errors: '⛔ {n} error{s}', val_warns: '⚠ {n} avvis{s}',
    copied: '✔ Copiato!', clip_denied: '✖ Clipboard negata',
    macro_copied: '✔ Macro copiata!', macro_downloaded: '✔ Macro scaricata',
    tpl_copied: '✔ Copiato!', tpl_inserted: '✔ Inserito nella casella',
    sb_paste_first: 'Incolla prima uno statblock nella casella qui sopra.',
    sb_confirm: 'Il form verrà sovrascritto con i dati dello statblock. Procedo?',
    sb_confirm_btn: '⚠ Sovrascrivo il form? Clicca ancora',
    batch_confirm_btn: '⚠ Svuoto? Clicca ancora', new_confirm_btn: '⚠ Nuova scheda? Clicca ancora',
    sb_head_ok: '✔ Riconosciuto', sb_head_warn: '⚠ Da controllare', sb_head_skip: '✘ Ignorato — aggiungi a mano',
    sb_reminder: 'Ricorda: il parser è un acceleratore, la revisione è tua. Controlla il form prima di esportare.',
    batch_added: '✔ "{name}" aggiunto — {n} in collezione', batch_cleared: 'Collezione svuotata',
    batch_list: '📋 Contenuto della collezione', batch_empty: '(vuota)',
    batch_remove_one: 'Rimuovi dalla collezione', batch_removed: '✔ "{name}" rimosso',
    batch_confirm_clear: 'Svuotare la collezione? Contiene {n} mostri (l\'operazione non tocca la scheda in corso).',
    batch_correct: '⛔ non aggiunto: ci sono errori',
    correct_add: '⛔ Correggi prima di aggiungere alla collezione: ',
    build_err: '⛔ Errore nella costruzione: ',
    confirm_new: 'Svuotare la scheda? La bozza autosalvata verrà cancellata.',
    draft_invalid: 'File di bozza non valido.',
    // Editor azioni/effetti
    ed_dup: 'Duplica questa azione', ed_remove: 'Rimuovi',
    ed_name: 'Nome', ed_name_ph: 'Coda Spinata', ed_type: 'Tipo',
    opt_attack: 'Attacco con arma', opt_save: 'Tiro salvezza', opt_utility: 'Utility (nessun tiro)', opt_passive: 'Tratto passivo',
    ed_activation: 'Attivazione',
    act_action: 'Azione', act_bonus: 'Azione bonus', act_reaction: 'Reazione', act_legendary: 'Azione leggendaria', act_special: 'Speciale',
    ed_meleeranged: 'Mischia / Distanza', opt_melee: 'Mischia', opt_ranged: 'Distanza',
    ed_ability: 'Caratteristica', ed_reach: 'Portata (ft)', ed_range: 'Gittata corta/lunga', ed_magical: 'Arma magica',
    ed_save_req: 'TS richiesto', ed_dc: 'CD', ed_onsave: 'Se supera il TS',
    opt_nodmg: 'Nessun danno', opt_halfdmg: 'Metà danno',
    ed_cond_fail: 'Condizione se fallisce', ed_duration: 'Durata (round)', ed_dur_hint: 'vuoto = finché rimossa',
    opt_none_f: 'Nessuna', ed_onhit: 'Effetto sul colpito',
    opt_onhit_none: 'Nessuno', opt_onhit_cond: 'Condizione automatica', opt_onhit_save: 'Condizione con TS',
    ed_condition: 'Condizione', ed_save_avoid: 'TS per evitarla', ed_dc_save: 'CD del TS',
    ed_damage: 'Danni', ed_damage_hint: 'formato: 2d8 + @mod piercing, 8d8 fire (@mod = modificatore caratteristica)', ed_damage_ph: '1d6 + @mod slashing',
    ed_uses: 'Usi limitati', opt_unlimited: 'Illimitati', opt_recharge: 'Recharge X–6', opt_perday: 'N volte al giorno',
    ed_recharge_x: 'Ricarica con (X)', ed_uses_day: 'Usi al giorno', ed_icon: 'Icona (path/URL)', ed_description: 'Descrizione',
    // Effetti DAE
    ef_dae: 'Effetti DAE', ef_passive_hint: 'su un tratto passivo sono sempre attivi (transfer)',
    ef_mixed_hint: 'passivo = sempre attivo sul mostro · sul bersaglio = via colpo/TS come le condizioni',
    ef_num: 'Effetto', ef_remove: 'Rimuovi effetto', ef_name: 'Nome effetto', ef_name_ph: 'Resistenza al Fuoco',
    ef_application: 'Applicazione', ef_app_passive: 'Passivo (sempre attivo)', ef_app_target: 'Sul bersaglio (colpito / TS fallito)',
    ef_rounds: 'Durata (round)', ef_rounds_hint: 'vuoto = finché rimosso', ef_icon: 'Icona (path/URL)', ef_icon_hint: 'vuoto = aura standard',
    ef_change_add: '➕ Riga di modifica', ef_add: '➕ Effetto', ef_preset: '➕ Effetto da preset…',
    ef_change_remove: 'Rimuovi riga', ef_mode: 'Modalità', ef_priority: 'Priorità (vuoto = default)', ef_value: 'Valore',
    ef_key_title: 'Chiave DAE (scrivi o scegli dalla lista)',
    chip_custom: 'altro (testo libero)...',
    // Tab Oggetto (Fase 6)
    tab_item: '🎒 Oggetto',
    it_type: 'Tipo di oggetto', it_weapon: 'Arma', it_equipment: 'Equipaggiamento', it_consumable: 'Consumabile', it_feat: 'Feature / Tratto',
    it_name_ph: 'Spada Fiammeggiante', it_rarity: 'Rarità', it_attunement: 'Sintonia', it_magical: 'Magico',
    it_armor: 'Valore armatura (CA)', it_armor_hint: '(0 = nessuna)',
    it_behavior: 'Comportamento', it_behavior_hint: '(cosa fa quando lo usi; per un oggetto meraviglioso passivo scegli «Tratto passivo»)',
    rar_none: '— (nessuna)', rar_common: 'Comune', rar_uncommon: 'Non comune', rar_rare: 'Raro', rar_veryRare: 'Molto raro', rar_legendary: 'Leggendario', rar_artifact: 'Artefatto',
    att_none: '— (nessuna)', att_required: 'Richiesta', att_optional: 'Opzionale',
    it_feattype: 'Tipo di feature', ft_monster: 'Tratto di mostro', ft_class: 'Privilegio di classe',
    it_requirements: 'Requisiti', it_requirements_ph: 'Barbarian 9',
    src_book: 'Source (manuale)', src_book_ph: "DMG'14", src_page: 'Pagina',
    opt_sr: 'N per riposo breve', opt_lr: 'N per riposo lungo', opt_turn: 'N per turno',
    ed_uses_n: 'Usi (numero o formula)', ed_uses_formula_hint: 'es. 2 oppure max(1, @abilities.int.mod)',
    it_export: '⬇️ Esporta oggetto', it_batch: '➕ Aggiungi alla collezione', it_preview_title: 'Anteprima JSON oggetto',
    it_wtype: 'Arma base', it_wtype_hint: '(imposta categoria e competenza)',
    it_magicbonus: 'Bonus magico', it_magicbonus_hint: '(+X a colpire e danno, automatico)',
    it_mastery: 'Maestria', it_mastery_hint: '(solo regole 5.5e/2024)', mst_none: '— (nessuna)',
    it_silvered: 'Argentata', it_adamantine: 'Adamantina', it_adamantine_hint: '(armatura: critici come colpi normali)',
    it_unidentified: 'Descrizione da non identificato', it_unidentified_hint: '(mostrata finché l\'oggetto non è identificato)',
    // Sezione Automated Animations (Fase 7)
    aa_legend: 'Animazione A-A (JB2A)',
    aa_legend_hint: '(facoltativa: richiede i moduli Automated Animations + JB2A sul server)',
    aa_loading: '⏳ Carico la libreria JB2A free (2000+ animazioni)...',
    aa_search: 'Cerca animazione', aa_anim: 'Animazione', aa_anim_hint: '(libreria JB2A free)',
    aa_pick: '— scegli —', aa_noprev: 'anteprima: scegli un\'animazione',
    aa_playon: 'Riproduci su', aa_on_target: 'Bersaglio', aa_on_source: 'Lanciatore',
    aa_persistent: 'Persistente', aa_scale: 'Scala',
    aa_target: 'Animazione aggiuntiva sul bersaglio', aa_target_hint: '(secondo effetto, opzionale)',
    aa_note: 'ℹ L\'anteprima è il webm reale della libreria JB2A free (da GitHub). Nel JSON va il path Sequencer (jb2a.…) nel campo Custom di A-A: in Foundry serve la libreria installata (free o Patreon).',
    // Tab Incantesimo (Fase 6)
    tab_spell: '✨ Incantesimo',
    sp_name_ph: 'Palla di Fuoco', sp_level: 'Livello', sp_cantrip: 'Trucchetto', sp_school: 'Scuola',
    sp_method: 'Metodo di lancio', sp_method_hint: '(innato = mostri/NPC)',
    sch_abj: 'Abiurazione', sch_con: 'Evocazione (Conjuration)', sch_div: 'Divinazione', sch_enc: 'Ammaliamento',
    sch_evo: 'Invocazione (Evocation)', sch_ill: 'Illusione', sch_nec: 'Necromanzia', sch_trs: 'Trasmutazione',
    mth_spell: 'Incantatore (slot)', mth_innate: 'Innato', mth_atwill: 'A volontà', mth_pact: 'Magia del Patto',
    sp_conc: 'Concentrazione', sp_ritual: 'Rituale',
    sp_material: 'Componente materiale', sp_material_ph: 'una pallina di guano e zolfo', sp_consumed: 'Consumata',
    sp_cast: 'Tempo di lancio', sp_cast_min: 'Minuti', act_minute: 'Minuti',
    sp_range: 'Gittata', rng_ft: 'Piedi (ft)', rng_touch: 'Contatto', rng_self: 'Se stesso', rng_mi: 'Miglia', sp_range_val: 'Piedi',
    sp_target: 'Bersaglio', tgt_creature: 'Creature', tgt_template: 'Area (sagoma)', tgt_self: 'Se stesso', tgt_none: 'Nessuno',
    sp_target_n: 'Quante (anche formula)', sp_tpl_type: 'Sagoma', sp_tpl_size: 'Dimensione (ft)',
    tpl_sphere: 'Sfera', tpl_cone: 'Cono', tpl_cube: 'Cubo', tpl_line: 'Linea', tpl_wall: 'Muro', tpl_cylinder: 'Cilindro', tpl_radius: 'Raggio',
    sp_duration: 'Durata', sp_dur_val: 'Valore',
    dur_inst: 'Istantanea', dur_round: 'Round', dur_minute: 'Minuti', dur_hour: 'Ore', dur_day: 'Giorni',
    sp_behavior_hint: '(la CD «automatica» usa la caratteristica da incantatore di chi possiede la spell)',
    sp_attack: 'Attacco con incantesimo', sp_atk_hint: '(bonus da incantatore automatico)',
    sp_dc: 'CD del TS', dc_auto: 'Automatica (spellcasting)', dc_flat: 'Fissa',
    sp_upcast: 'Upcast per slot', sp_upcast_hint: '(dadi extra per slot superiore, es. 1d6 — applicati alla PRIMA parte di danno)',
    sp_export: '⬇️ Esporta incantesimo', sp_batch: '➕ Aggiungi alla collezione', sp_preview_title: 'Anteprima JSON incantesimo',
    // Tab + calcolatore DPR
    tab_npc: '🐲 Mostro / NPC', tab_dpr: '📊 Calcolatore DPR',
    dpr_title: 'Calcolatore DPR', dpr_intro: 'Danno medio per round: media dei dadi × probabilità di colpire (critici inclusi), sommato su tutti gli attacchi.',
    dpr_add: '➕ Attacco', dpr_load: '📥 Carica dal mostro', dpr_load_title: 'Legge gli attacchi dal mostro nella scheda NPC',
    dpr_t_attack: 'Attacco', dpr_t_save: 'TS', dpr_ph_name: 'Nome attacco', dpr_dice_hint: 'dadi + bonus, es. 2d8 + 4 (i tipi di danno si ignorano)',
    dpr_dc: 'CD del TS', dpr_bonus: 'Bonus al tiro per colpire', dpr_count: 'Numero di attacchi', dpr_remove: 'Rimuovi',
    dpr_type: 'Tipo', dpr_name: 'Nome', dpr_damage: 'Danno', dpr_bonus_dc: 'Bonus / CD', dpr_num: 'N°',
    dpr_ac: 'CA bersaglio', dpr_ts: 'TS bersaglio', dpr_total: 'DPR totale',
    dpr_chart_title: 'DPR vs CA', dpr_chart_hint: 'La curva mostra come cambia il DPR al variare della CA del bersaglio; il punto rosso è la CA scelta.',
    dpr_x: 'Classe Armatura', dpr_none: 'Nessun attacco/TS con danno nel mostro corrente.', dpr_loaded: '✔ {n} caricati dal mostro',
  },
  en: {
    langToggle: 'IT', langLabel: 'Language',
    subtitle: 'Actor generator for Foundry VTT 13 · dnd5e 5.3.3',
    sb_legend: 'Import from stat block', sb_legend_hint: '(Italian or English, 2014 format — metres converted to feet)',
    sb_summary: 'Paste a stat block and let it fill the form for you (then check it!)',
    sb_placeholder: 'Paste the stat block here (from the PDF or the template)...',
    sb_analyze: '🔎 Parse and fill the form', sb_template: '📋 Copy blank template',
    id_legend: 'Identity', f_name: 'Name *', f_size: 'Size', f_type: 'Creature type',
    f_subtype: 'Subtype', f_alignment: 'Alignment', f_cr: 'Challenge Rating (CR)', f_rules: 'Rules',
    rules_2014: '2014 (classic)', rules_2024: '2024 (revised)',
    ab_legend: 'Ability scores', ab_hint: '(check = proficient in the saving throw)', ab_save: 'ST',
    def_legend: 'Defenses & speed', f_hpmax: 'Max HP *', f_hpformula: 'HP formula', f_ac: 'Armor Class',
    ac_default: 'Calculated', ac_natural: 'Natural', ac_flat: 'Flat',
    f_walk: 'Walk', f_fly: 'Fly', f_swim: 'Swim', f_climb: 'Climb', f_burrow: 'Burrow', f_hover: 'Hover',
    f_darkvision: 'Darkvision', f_blindsight: 'Blindsight', f_tremorsense: 'Tremorsense',
    f_truesight: 'Truesight', f_telepathy: 'Telepathy',
    sk_legend: 'Skills', sk_hint: '(— / Proficient / Expertise)', sk_none: '—', sk_prof: 'Proficient', sk_exp: 'Expertise',
    tr_legend: 'Traits', tr_hint: '(click to select; the free field is for homebrew entries)',
    tr_dr: 'Damage resistances', tr_di: 'Damage immunities', tr_dv: 'Damage vulnerabilities',
    tr_ci: 'Condition immunities', tr_langs: 'Languages',
    act_legend: 'Actions, attacks & traits', act_add: '➕ Add action / trait',
    leg_legend: 'Legendary', f_legact: 'Legendary actions', f_legres: 'Legendary resistances',
    img_legend: 'Images', img_legend_hint: '(Foundry path or web URL)',
    f_avatar: 'Sheet avatar', f_token: 'Token image',
    img_warn: '⚠ The path must end in .webp/.png/.jpg (any ?query is stripped automatically). External URLs show on the sheet but often NOT on the map (CORS): better to upload the image inside the server (worlds/...).',
    bio_legend: 'Description / Biography',
    batch_title: '📦 Batch collection', batch_add: '➕ Add', batch_export: 'Export collection', batch_clear: '🗑️ Clear',
    main_export: '⬇️ Export JSON', main_savedraft: '💾 Save draft', main_loaddraft: '📂 Load draft',
    main_new: '🗑️ New sheet', main_copymacro: '🎲 Copy importer macro',
    preview_title: 'JSON preview', btn_copy: '📋 Copy',
    title_copymacro: 'Copy the macro to paste once into Foundry: then import actors without the "create empty → Import Data" dance',
    title_copypreview: 'Copy the whole JSON to the clipboard',
    ph_name: 'Sand Devil', ph_subtype: 'Devil', ph_alignment: 'Lawful Evil',
    ph_hpmax: '112', ph_hpformula: '15d10 + 30', ph_acflat: 'AC value (for natural/flat)',
    ph_avatar: 'https://... or worlds/avernus/img/monster.webp', ph_token: 'empty = use the avatar',
    ph_bio: 'Supports HTML: <p>, <b>, tables...',
    val_ok: '✓ Valid structure — no issues found',
    val_errors: '⛔ {n} error{s}', val_warns: '⚠ {n} warning{s}',
    copied: '✔ Copied!', clip_denied: '✖ Clipboard denied',
    macro_copied: '✔ Macro copied!', macro_downloaded: '✔ Macro downloaded',
    tpl_copied: '✔ Copied!', tpl_inserted: '✔ Inserted in the box',
    sb_paste_first: 'Paste a stat block in the box above first.',
    sb_confirm: 'The form will be overwritten with the stat block data. Proceed?',
    sb_confirm_btn: '⚠ Overwrite the form? Click again',
    batch_confirm_btn: '⚠ Clear? Click again', new_confirm_btn: '⚠ New sheet? Click again',
    sb_head_ok: '✔ Recognized', sb_head_warn: '⚠ To review', sb_head_skip: '✘ Ignored — add by hand',
    sb_reminder: 'Remember: the parser is an accelerator, the review is yours. Check the form before exporting.',
    batch_added: '✔ "{name}" added — {n} in the collection', batch_cleared: 'Collection cleared',
    batch_list: '📋 Collection contents', batch_empty: '(empty)',
    batch_remove_one: 'Remove from collection', batch_removed: '✔ "{name}" removed',
    batch_confirm_clear: 'Clear the collection? It holds {n} monsters (this does not touch the current sheet).',
    batch_correct: '⛔ not added: there are errors',
    correct_add: '⛔ Fix the errors before adding to the collection: ',
    build_err: '⛔ Build error: ',
    confirm_new: 'Clear the sheet? The autosaved draft will be deleted.',
    draft_invalid: 'Invalid draft file.',
    ed_dup: 'Duplicate this action', ed_remove: 'Remove',
    ed_name: 'Name', ed_name_ph: 'Barbed Tail', ed_type: 'Type',
    opt_attack: 'Weapon attack', opt_save: 'Saving throw', opt_utility: 'Utility (no roll)', opt_passive: 'Passive trait',
    ed_activation: 'Activation',
    act_action: 'Action', act_bonus: 'Bonus action', act_reaction: 'Reaction', act_legendary: 'Legendary action', act_special: 'Special',
    ed_meleeranged: 'Melee / Ranged', opt_melee: 'Melee', opt_ranged: 'Ranged',
    ed_ability: 'Ability', ed_reach: 'Reach (ft)', ed_range: 'Range short/long', ed_magical: 'Magic weapon',
    ed_save_req: 'Save vs', ed_dc: 'DC', ed_onsave: 'On save',
    opt_nodmg: 'No damage', opt_halfdmg: 'Half damage',
    ed_cond_fail: 'Condition on fail', ed_duration: 'Duration (rounds)', ed_dur_hint: 'empty = until removed',
    opt_none_f: 'None', ed_onhit: 'On-hit effect',
    opt_onhit_none: 'None', opt_onhit_cond: 'Automatic condition', opt_onhit_save: 'Condition with save',
    ed_condition: 'Condition', ed_save_avoid: 'Save to avoid', ed_dc_save: 'Save DC',
    ed_damage: 'Damage', ed_damage_hint: 'format: 2d8 + @mod piercing, 8d8 fire (@mod = ability modifier)', ed_damage_ph: '1d6 + @mod slashing',
    ed_uses: 'Limited uses', opt_unlimited: 'Unlimited', opt_recharge: 'Recharge X–6', opt_perday: 'N times per day',
    ed_recharge_x: 'Recharge on (X)', ed_uses_day: 'Uses per day', ed_icon: 'Icon (path/URL)', ed_description: 'Description',
    ef_dae: 'DAE effects', ef_passive_hint: 'on a passive trait they are always on (transfer)',
    ef_mixed_hint: 'passive = always on the monster · on target = via hit/save like conditions',
    ef_num: 'Effect', ef_remove: 'Remove effect', ef_name: 'Effect name', ef_name_ph: 'Fire Resistance',
    ef_application: 'Application', ef_app_passive: 'Passive (always on)', ef_app_target: 'On target (hit / failed save)',
    ef_rounds: 'Duration (rounds)', ef_rounds_hint: 'empty = until removed', ef_icon: 'Icon (path/URL)', ef_icon_hint: 'empty = standard aura',
    ef_change_add: '➕ Change row', ef_add: '➕ Effect', ef_preset: '➕ Effect from preset…',
    ef_change_remove: 'Remove row', ef_mode: 'Mode', ef_priority: 'Priority (empty = default)', ef_value: 'Value',
    ef_key_title: 'DAE key (type or pick from the list)',
    chip_custom: 'other (free text)...',
    // Item tab (Phase 6)
    tab_item: '🎒 Item',
    it_type: 'Item type', it_weapon: 'Weapon', it_equipment: 'Equipment', it_consumable: 'Consumable', it_feat: 'Feature / Trait',
    it_name_ph: 'Flame Tongue', it_rarity: 'Rarity', it_attunement: 'Attunement', it_magical: 'Magical',
    it_armor: 'Armor value (AC)', it_armor_hint: '(0 = none)',
    it_behavior: 'Behavior', it_behavior_hint: '(what it does when used; for a passive wondrous item pick "Passive trait")',
    rar_none: '— (none)', rar_common: 'Common', rar_uncommon: 'Uncommon', rar_rare: 'Rare', rar_veryRare: 'Very rare', rar_legendary: 'Legendary', rar_artifact: 'Artifact',
    att_none: '— (none)', att_required: 'Required', att_optional: 'Optional',
    it_feattype: 'Feature type', ft_monster: 'Monster trait', ft_class: 'Class feature',
    it_requirements: 'Requirements', it_requirements_ph: 'Barbarian 9',
    src_book: 'Source (book)', src_book_ph: "DMG'14", src_page: 'Page',
    opt_sr: 'N per short rest', opt_lr: 'N per long rest', opt_turn: 'N per turn',
    ed_uses_n: 'Uses (number or formula)', ed_uses_formula_hint: 'e.g. 2 or max(1, @abilities.int.mod)',
    it_export: '⬇️ Export item', it_batch: '➕ Add to collection', it_preview_title: 'Item JSON preview',
    it_wtype: 'Base weapon', it_wtype_hint: '(sets category & proficiency)',
    it_magicbonus: 'Magic bonus', it_magicbonus_hint: '(+X to hit & damage, automatic)',
    it_mastery: 'Mastery', it_mastery_hint: '(5.5e/2024 rules only)', mst_none: '— (none)',
    it_silvered: 'Silvered', it_adamantine: 'Adamantine', it_adamantine_hint: '(armor: crits become normal hits)',
    it_unidentified: 'Unidentified description', it_unidentified_hint: '(shown while the item is unidentified)',
    // Automated Animations section (Phase 7)
    aa_legend: 'A-A Animation (JB2A)',
    aa_legend_hint: '(optional: requires the Automated Animations + JB2A modules on the server)',
    aa_loading: '⏳ Loading the free JB2A library (2000+ animations)...',
    aa_search: 'Search animation', aa_anim: 'Animation', aa_anim_hint: '(free JB2A library)',
    aa_pick: '— pick —', aa_noprev: 'preview: pick an animation',
    aa_playon: 'Play on', aa_on_target: 'Target', aa_on_source: 'Caster',
    aa_persistent: 'Persistent', aa_scale: 'Scale',
    aa_target: 'Extra animation on the target', aa_target_hint: '(second effect, optional)',
    aa_note: 'ℹ The preview is the real webm from the free JB2A library (GitHub). The JSON stores the Sequencer path (jb2a.…) in A-A\'s Custom field: Foundry needs the library installed (free or Patreon).',
    // Spell tab (Phase 6)
    tab_spell: '✨ Spell',
    sp_name_ph: 'Fireball', sp_level: 'Level', sp_cantrip: 'Cantrip', sp_school: 'School',
    sp_method: 'Casting method', sp_method_hint: '(innate = monsters/NPCs)',
    sch_abj: 'Abjuration', sch_con: 'Conjuration', sch_div: 'Divination', sch_enc: 'Enchantment',
    sch_evo: 'Evocation', sch_ill: 'Illusion', sch_nec: 'Necromancy', sch_trs: 'Transmutation',
    mth_spell: 'Spellcasting (slots)', mth_innate: 'Innate', mth_atwill: 'At will', mth_pact: 'Pact Magic',
    sp_conc: 'Concentration', sp_ritual: 'Ritual',
    sp_material: 'Material component', sp_material_ph: 'a tiny ball of bat guano and sulfur', sp_consumed: 'Consumed',
    sp_cast: 'Casting time', sp_cast_min: 'Minutes', act_minute: 'Minutes',
    sp_range: 'Range', rng_ft: 'Feet (ft)', rng_touch: 'Touch', rng_self: 'Self', rng_mi: 'Miles', sp_range_val: 'Feet',
    sp_target: 'Target', tgt_creature: 'Creatures', tgt_template: 'Area (template)', tgt_self: 'Self', tgt_none: 'None',
    sp_target_n: 'How many (or formula)', sp_tpl_type: 'Template', sp_tpl_size: 'Size (ft)',
    tpl_sphere: 'Sphere', tpl_cone: 'Cone', tpl_cube: 'Cube', tpl_line: 'Line', tpl_wall: 'Wall', tpl_cylinder: 'Cylinder', tpl_radius: 'Radius',
    sp_duration: 'Duration', sp_dur_val: 'Value',
    dur_inst: 'Instantaneous', dur_round: 'Rounds', dur_minute: 'Minutes', dur_hour: 'Hours', dur_day: 'Days',
    sp_behavior_hint: '(the "automatic" DC uses the owner\'s spellcasting ability)',
    sp_attack: 'Spell attack', sp_atk_hint: '(spellcasting attack bonus, automatic)',
    sp_dc: 'Save DC', dc_auto: 'Automatic (spellcasting)', dc_flat: 'Flat',
    sp_upcast: 'Upcast per slot', sp_upcast_hint: '(extra dice per higher slot, e.g. 1d6 — applied to the FIRST damage part)',
    sp_export: '⬇️ Export spell', sp_batch: '➕ Add to collection', sp_preview_title: 'Spell JSON preview',
    tab_npc: '🐲 Monster / NPC', tab_dpr: '📊 DPR Calculator',
    dpr_title: 'DPR Calculator', dpr_intro: 'Average damage per round: dice average × chance to hit (crits included), summed over all attacks.',
    dpr_add: '➕ Attack', dpr_load: '📥 Load from monster', dpr_load_title: 'Reads the attacks from the monster in the NPC tab',
    dpr_t_attack: 'Attack', dpr_t_save: 'Save', dpr_ph_name: 'Attack name', dpr_dice_hint: 'dice + bonus, e.g. 2d8 + 4 (damage types are ignored)',
    dpr_dc: 'Save DC', dpr_bonus: 'Attack bonus to hit', dpr_count: 'Number of attacks', dpr_remove: 'Remove',
    dpr_type: 'Type', dpr_name: 'Name', dpr_damage: 'Damage', dpr_bonus_dc: 'Bonus / DC', dpr_num: 'N°',
    dpr_ac: 'Target AC', dpr_ts: 'Target save', dpr_total: 'Total DPR',
    dpr_chart_title: 'DPR vs AC', dpr_chart_hint: 'The curve shows how DPR changes with the target AC; the red dot is the chosen AC.',
    dpr_x: 'Armor Class', dpr_none: 'No damaging attack/save in the current monster.', dpr_loaded: '✔ {n} loaded from the monster',
  },
};
