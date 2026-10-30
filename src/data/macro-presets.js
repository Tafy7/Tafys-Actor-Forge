// ============================================================
// Preset di macro utili per la Tab Info (Fase 8).
// Ogni preset è una macro Foundry VTT 13 pronta: si copia, si incolla in
// una macro di tipo "Script" e si regola il blocco CONFIG in testa.
// I codici evitano i backtick per stare comodi nei template literal.
//
// Bilingui (v0.36): ogni macro sceglie la lingua da quella di Foundry
// (game.i18n.lang: italiano → italiano, altrimenti inglese) con un mini
// dizionario M = { it, en }; i commenti del CONFIG sono in tutte e due.
// ============================================================

/** Riga comune: lingua di Foundry → "it" | "en". */
const LANG_LINE = 'const L = String(game.i18n?.lang ?? "en").toLowerCase().startsWith("it") ? "it" : "en";';

export const MACRO_PRESETS = [
  {
    id: 'cinematic',
    icon: '🎬',
    code: `// ============ CONFIG ============
const IMAGE    = "worlds/my-world/img/scene.webp"; // immagine da mostrare / image to show
const PLAYLIST = "Ambience";                        // nome playlist / playlist name
const TRACK    = "Tavern";                          // nome traccia / track name
// ================================
(async () => {
  ${LANG_LINE}
  const M = {
    it: { noSound: "Playlist o traccia non trovata: ", noImage: "Immagine non trovata: " },
    en: { noSound: "Playlist or track not found: ", noImage: "Image not found: " },
  }[L];
  const playlist = game.playlists.getName(PLAYLIST);
  const sound = playlist?.sounds.getName(TRACK);
  if (!playlist || !sound) return ui.notifications.warn(M.noSound + PLAYLIST + " / " + TRACK);
  // PRECARICA immagine e audio, così partono INSIEME senza scatti.
  try { await (foundry.canvas?.loadTexture ?? loadTexture)(IMAGE); } catch (e) { return ui.notifications.error(M.noImage + IMAGE); }
  try { await foundry.audio.AudioHelper.preloadSound(sound.path ?? sound.src); } catch (e) { /* l'audio parte comunque */ }
  // VIA: musica + immagine nello stesso momento, condivisa con tutti.
  await playlist.playSound(sound);
  const Popout = foundry.applications?.apps?.ImagePopout ?? ImagePopout;
  let popout;
  try { popout = new Popout({ src: IMAGE, window: { title: "" } }); }        // Foundry 13 (AppV2)
  catch (e) { popout = new Popout(IMAGE, { title: "" }); }                    // fallback firma vecchia
  await popout.render(true);
  if (popout.shareImage) popout.shareImage();                                 // mostra anche ai giocatori
})();`,
  },
  {
    id: 'transform',
    icon: '🐺',
    code: `// ============ CONFIG ============
const NEW_IMG = "worlds/my-world/tokens/wolf-form.webp"; // token della nuova forma / new form token
const SOUND   = "worlds/my-world/audio/transform.ogg";   // vuoto = niente suono / empty = no sound
const ANIM    = "jb2a.smoke.puff.centered.grey.2";       // path Sequencer (vuoto = niente / empty = none)
// ================================
(async () => {
  ${LANG_LINE}
  const M = {
    it: { select: "Seleziona un token", back: " torna alla forma originale" },
    en: { select: "Select a token", back: " returns to its original form" },
  }[L];
  const token = canvas.tokens.controlled[0];
  if (!token) return ui.notifications.warn(M.select);
  const FLAG = "tafyTransform";
  const saved = token.document.getFlag("world", FLAG);
  if (saved) {
    // SECONDO uso: ripristina la forma originale e ferma l'animazione.
    if (globalThis.Sequencer) Sequencer.EffectManager.endEffects({ name: FLAG + token.id });
    await token.document.update({ "texture.src": saved.img, "texture.scaleX": saved.sx, "texture.scaleY": saved.sy });
    await token.document.unsetFlag("world", FLAG);
    return ui.notifications.info(token.name + M.back);
  }
  // PRIMO uso: salva la forma attuale, poi trasforma.
  await token.document.setFlag("world", FLAG, {
    img: token.document.texture.src,
    sx: token.document.texture.scaleX,
    sy: token.document.texture.scaleY,
  });
  if (SOUND) foundry.audio.AudioHelper.play({ src: SOUND, volume: 0.8 }, true);
  if (ANIM && globalThis.Sequencer) {
    new Sequence().effect().file(ANIM).atLocation(token).scaleToObject(1.8)
      .name(FLAG + token.id).play();
    // Per un'aura PERSISTENTE che si spegne al ripristino: aggiungi .persist()
  }
  await token.document.update({ "texture.src": NEW_IMG });
})();`,
  },
  {
    id: 'groupsave',
    icon: '🎲',
    code: `// ============ CONFIG ============
const ABILITY = "dex"; // str/dex/con/int/wis/cha
const DC = 15;
// ================================
(async () => {
  ${LANG_LINE}
  const M = {
    it: { select: "Seleziona i token che devono tirare", save: "TS", dc: "CD", roll: "Tiro", result: "Esito" },
    en: { select: "Select the tokens that must roll", save: "Save", dc: "DC", roll: "Roll", result: "Result" },
  }[L];
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) return ui.notifications.warn(M.select);
  const rows = [];
  for (const t of tokens) {
    const actor = t.actor;
    if (!actor) continue;
    let roll;
    if (actor.rollSavingThrow) {                       // dnd5e 4.1+
      const r = await actor.rollSavingThrow({ ability: ABILITY }, { configure: false });
      roll = Array.isArray(r) ? r[0] : r;
    } else {                                            // fallback API vecchia
      roll = await actor.rollAbilitySave(ABILITY, { fastForward: true });
    }
    const total = roll?.total ?? 0;
    rows.push("<tr><td>" + t.name + "</td><td>" + total + "</td><td>" + (total >= DC ? "✅" : "❌") + "</td></tr>");
  }
  ChatMessage.create({
    content: "<h3>" + M.save + " " + ABILITY.toUpperCase() + " — " + M.dc + " " + DC + "</h3>" +
      "<table><tr><th>Token</th><th>" + M.roll + "</th><th>" + M.result + "</th></tr>" + rows.join("") + "</table>",
  });
})();`,
  },
  {
    id: 'condition',
    icon: '💫',
    code: `// ============ CONFIG ============
const CONDITION = "prone"; // blinded, charmed, frightened, poisoned, prone, restrained, stunned...
// ================================
(async () => {
  ${LANG_LINE}
  const M = {
    it: { select: "Seleziona i token", done: " commutata su {n} token" },
    en: { select: "Select the tokens", done: " toggled on {n} tokens" },
  }[L];
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) return ui.notifications.warn(M.select);
  for (const t of tokens) await t.actor?.toggleStatusEffect(CONDITION);
  ui.notifications.info(CONDITION + M.done.replace("{n}", tokens.length));
})();`,
  },
  {
    id: 'massdamage',
    icon: '💥',
    code: `(async () => {
  ${LANG_LINE}
  const M = {
    it: { select: "Seleziona i token", title: "Danno / Cura di massa", amount: "Quantità", mode: "Modo",
      damage: "Danno (applica resistenze a mano)", heal: "Cura", apply: "Applica", healed: "Curati ", hurt: "Feriti ", tok: " token" },
    en: { select: "Select the tokens", title: "Mass damage / healing", amount: "Amount", mode: "Mode",
      damage: "Damage (apply resistances by hand)", heal: "Healing", apply: "Apply", healed: "Healed ", hurt: "Damaged ", tok: " tokens" },
  }[L];
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) return ui.notifications.warn(M.select);
  const { DialogV2 } = foundry.applications.api;
  let res;
  try {
    res = await DialogV2.prompt({
      window: { title: M.title },
      content: "<label>" + M.amount + ' <input type="number" name="amount" value="10" autofocus /></label>' +
        "<label>" + M.mode + ' <select name="mode"><option value="damage">' + M.damage + "</option>" +
        '<option value="heal">' + M.heal + "</option></select></label>",
      ok: { label: M.apply, callback: (ev, btn) => ({
        amount: Number(btn.form.elements.amount.value) || 0,
        mode: btn.form.elements.mode.value,
      }) },
    });
  } catch (e) { return; } // annullato
  if (!res || res.amount <= 0) return;
  for (const t of tokens) {
    if (!t.actor) continue;
    // dnd5e: applyDamage con multiplier -1 = cura (clampata al massimo).
    await t.actor.applyDamage(res.amount, { multiplier: res.mode === "heal" ? -1 : 1 });
  }
  ui.notifications.info((res.mode === "heal" ? M.healed : M.hurt) + tokens.length + M.tok + " (" + res.amount + ")");
})();`,
  },
];
