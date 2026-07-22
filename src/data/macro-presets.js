// ============================================================
// Preset di macro utili per la Tab Info (Fase 8).
// Ogni preset è una macro Foundry VTT 13 pronta: si copia, si incolla in
// una macro di tipo "Script" e si regola il blocco CONFIG in testa.
// I codici evitano i backtick per stare comodi nei template literal.
// ============================================================

export const MACRO_PRESETS = [
  {
    id: 'cinematic',
    icon: '🎬',
    code: `// ============ CONFIG ============
const IMAGE    = "worlds/il-tuo-mondo/img/scena.webp"; // immagine da mostrare
const PLAYLIST = "Ambience";                            // nome playlist
const TRACK    = "Taverna";                             // nome traccia
// ================================
(async () => {
  const playlist = game.playlists.getName(PLAYLIST);
  const sound = playlist?.sounds.getName(TRACK);
  if (!playlist || !sound) return ui.notifications.warn("Playlist o traccia non trovata: " + PLAYLIST + " / " + TRACK);
  // PRECARICA immagine e audio, così partono INSIEME senza scatti.
  try { await (foundry.canvas?.loadTexture ?? loadTexture)(IMAGE); } catch (e) { return ui.notifications.error("Immagine non trovata: " + IMAGE); }
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
const NEW_IMG = "worlds/il-tuo-mondo/tokens/forma-lupo.webp"; // token della nuova forma
const SOUND   = "worlds/il-tuo-mondo/audio/trasformazione.ogg"; // vuoto = niente suono
const ANIM    = "jb2a.smoke.puff.centered.grey.2";              // path Sequencer (vuoto = niente)
// ================================
(async () => {
  const token = canvas.tokens.controlled[0];
  if (!token) return ui.notifications.warn("Seleziona un token");
  const FLAG = "tafyTransform";
  const saved = token.document.getFlag("world", FLAG);
  if (saved) {
    // SECONDO uso: ripristina la forma originale e ferma l'animazione.
    if (globalThis.Sequencer) Sequencer.EffectManager.endEffects({ name: FLAG + token.id });
    await token.document.update({ "texture.src": saved.img, "texture.scaleX": saved.sx, "texture.scaleY": saved.sy });
    await token.document.unsetFlag("world", FLAG);
    return ui.notifications.info(token.name + " torna alla forma originale");
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
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) return ui.notifications.warn("Seleziona i token che devono tirare");
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
    content: "<h3>TS " + ABILITY.toUpperCase() + " — CD " + DC + "</h3>" +
      "<table><tr><th>Token</th><th>Tiro</th><th>Esito</th></tr>" + rows.join("") + "</table>",
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
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) return ui.notifications.warn("Seleziona i token");
  for (const t of tokens) await t.actor?.toggleStatusEffect(CONDITION);
  ui.notifications.info(CONDITION + " commutata su " + tokens.length + " token");
})();`,
  },
  {
    id: 'massdamage',
    icon: '💥',
    code: `(async () => {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) return ui.notifications.warn("Seleziona i token");
  const { DialogV2 } = foundry.applications.api;
  let res;
  try {
    res = await DialogV2.prompt({
      window: { title: "Danno / Cura di massa" },
      content: '<label>Quantita\\' <input type="number" name="amount" value="10" autofocus /></label>' +
        '<label>Modo <select name="mode"><option value="damage">Danno (applica resistenze a mano)</option>' +
        '<option value="heal">Cura</option></select></label>',
      ok: { label: "Applica", callback: (ev, btn) => ({
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
  ui.notifications.info((res.mode === "heal" ? "Curati " : "Feriti ") + tokens.length + " token (" + res.amount + ")");
})();`,
  },
];
