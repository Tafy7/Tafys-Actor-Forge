// ============================================================
// Automated Animations (Fase 7) — flags.autoanimations v5.
//
// Regola d'oro: la struttura del flag è copiata ESATTAMENTE dai due golden
// che la contengono (Power Word Stun: menu 'ontoken' con playOn target;
// Circle of Power: persistent + isRadius). Noi compiliamo la via più
// robusta e universale: `enableCustom: true` + `customPath: "jb2a...."`
// (la stessa casella "Custom" del menu A-A, vista nello screenshot
// dell'utente con "jb2a.fireball.explosion.dark_red") — così non
// dipendiamo dai menu interni del modulo per trovare l'animazione.
//
// v2: TRE menu osservati nei golden — 'ontoken' (Power Word Stun),
// 'melee' (Fireball export utente: aggiunge la chiave top-level
// meleeSwitch e opzioni primary ridotte) e 'range' (spell di prova
// dell'utente: opzioni con isReturning/onlyX e SENZA size). Ogni menu
// usa il SUO set di opzioni primary, copiato dal rispettivo golden.
// Suono della primaria supportato (golden range: sound con `file`).
// ============================================================
import { randomID } from '../utils/id.js';

// Un blocco sound neutro (identico in tutti gli slot del golden).
const SOUND = { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 };
// Un blocco video neutro (i default del golden quando lo slot è spento).
const VIDEO = {
  dbSection: 'static', menuType: 'spell', animation: 'curewounds', variant: '01',
  color: 'blue', enableCustom: false, customPath: '',
};
// Opzioni primary del menu MELEE (golden Fireball export: niente
// anchor/fade/persistent/playOn, ha size).
const OPTIONS_MELEE = {
  contrast: 0, delay: 0, elevation: 1000, isWait: false, opacity: 1,
  playbackRate: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1,
  tint: false, tintColor: '#FFFFFF', zIndex: 1,
};
// Opzioni primary del menu RANGE (golden "Prova del Tafy": isReturning e
// onlyX, NIENTE size).
const OPTIONS_RANGE = {
  contrast: 0, delay: 0, elevation: 1000, isReturning: false, isWait: false,
  onlyX: false, opacity: 1, playbackRate: 1, repeat: 1, repeatDelay: 250,
  saturate: 0, tint: false, tintColor: '#FFFFFF', zIndex: 1,
};
// Opzioni primary del menu AURA (golden Shield export): l'animazione è un
// aura persistente sul lanciatore (isRadius, playOn source, size = raggio).
const OPTIONS_AURA = {
  addTokenWidth: true, alpha: false, alphaMax: 0.5, alphaMin: -0.5, alphaDuration: 1000,
  breath: false, breathMax: 1.05, breathMin: 0.95, breathDuration: 1000,
  delay: 0, elevation: 1000, fadeIn: 250, fadeOut: 500, isRadius: true, isWait: false,
  opacity: 1, playbackRate: 1, playOn: 'source', size: 3, tint: false,
  tintColor: '#FFFFFF', tintSaturate: 0, unbindAlpha: false, unbindVisibility: false, zIndex: 1,
};
// Opzioni primary del menu TEMPLATEFX (golden Chromatic Orb "Preset"):
// l'animazione gira sul template piazzato; `scale` è una STRINGA.
const OPTIONS_TEMPLATEFX = {
  contrast: 0, delay: 0, elevation: 1000, isMasked: false, isWait: false,
  occlusionAlpha: 0.5, occlusionMode: '3', opacity: 1, persistent: false,
  persistType: 'sequencerground', playbackRate: 1, removeTemplate: false,
  repeat: 1, repeatDelay: 250, rotate: 0, saturate: 0, scale: '1',
  tint: false, tintColor: '#FFFFFF', zIndex: 1,
};
// Blocco meleeSwitch (solo menu melee, dal golden Fireball): il passaggio
// automatico all'animazione a distanza quando il bersaglio è lontano.
const MELEE_SWITCH = {
  video: { dbSection: 'range', menuType: 'weapon', animation: 'arrow', variant: 'regular', color: 'regular' },
  sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 },
  options: { detect: 'automatic', range: 2, returning: false, switchType: 'on' },
};
// Opzioni complete come nel golden Power Word Stun (primary, menu ontoken).
const OPTIONS = {
  addTokenWidth: false, anchor: '0.5', contrast: 0, delay: 0, elevation: 1000,
  fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: false, isWait: false,
  opacity: 1, persistent: false, playbackRate: 1, playOn: 'target',
  repeat: 1, repeatDelay: 250, saturate: 0, size: 1, tint: false,
  tintColor: '#FFFFFF', unbindAlpha: false, unbindVisibility: false, zIndex: 1,
};
// Varianti degli altri slot (dal golden: secondary senza playOn/persistent
// extra, source con isWait, target con persistent).
const OPTIONS_SECONDARY = {
  addTokenWidth: false, anchor: '0.5', contrast: 0, delay: 0, elevation: 1000,
  fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: true, isWait: false,
  opacity: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1.5,
  tint: false, tintColor: '#FFFFFF', zIndex: 1,
};
const OPTIONS_SOURCE = {
  addTokenWidth: false, anchor: '0.5', contrast: 0, delay: 0, elevation: 1000,
  fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: false, isWait: true,
  opacity: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1,
  tint: false, tintColor: '#FFFFFF', zIndex: 1,
};
const OPTIONS_TARGET = {
  addTokenWidth: false, anchor: '0.5', contrast: 0, delay: 0, elevation: 1000,
  fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: false,
  opacity: 1, persistent: false, repeat: 1, repeatDelay: 250, saturate: 0,
  size: 1, tint: false, tintColor: '#FFFFFF', unbindAlpha: false,
  unbindVisibility: false, zIndex: 1,
};
const LEVELS3D = {
  type: 'explosion',
  data: { color01: '#FFFFFF', color02: '#FFFFFF', spritePath: 'modules/levels-3d-preview/assets/particles/dust.png' },
  sound: { enable: false },
  secondary: { enable: false, data: { color01: '#FFFFFF', color02: '#FFFFFF', spritePath: 'modules/levels-3d-preview/assets/particles/dust.png' } },
};

/** Pseudo-uuid nel formato usato da A-A (8-4-4-4-12 esadecimale). */
function aaId() {
  const hex = () => randomID().toLowerCase().replace(/[^0-9a-f]/g, '3');
  const s = (hex() + hex()).padEnd(32, '0');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export const AA_MENUS = ['ontoken', 'melee', 'range', 'aura', 'templatefx'];

/**
 * Costruisce flags.autoanimations dal descrittore della UI:
 * `aa` = { enabled, menu ('ontoken'|'melee'|'range'),
 *          path ('fireball.explosion.orange' SENZA prefisso jb2a),
 *          playOn ('target'|'source'), persistent, scale,
 *          soundEnable, soundFile, soundVolume,
 *          tgtEnabled, tgtPath, tgtPersistent, tgtScale }
 * Ritorna null se disattivata o senza animazione scelta.
 */
export function buildAAFlags(aa, label) {
  if (!aa || !aa.enabled || !String(aa.path || '').trim()) return null;
  const menu = AA_MENUS.includes(aa.menu) ? aa.menu : 'ontoken';

  // Opzioni primary fedeli al golden del menu scelto.
  let primaryOptions;
  if (menu === 'melee') {
    primaryOptions = { ...OPTIONS_MELEE, size: Number(aa.scale) > 0 ? Number(aa.scale) : 1 };
  } else if (menu === 'range') {
    primaryOptions = { ...OPTIONS_RANGE }; // il range non ha size
  } else if (menu === 'aura') {
    // Aura: `size` è il raggio (default golden 3), gira sul lanciatore.
    // NIENTE `persistent` nelle opzioni (l'aura dura quanto l'effetto).
    primaryOptions = { ...OPTIONS_AURA, size: Number(aa.scale) > 0 ? Number(aa.scale) : 3 };
  } else if (menu === 'templatefx') {
    // Su template: `scale` è una STRINGA; persistent opzionale.
    primaryOptions = { ...OPTIONS_TEMPLATEFX, scale: String(Number(aa.scale) > 0 ? Number(aa.scale) : 1), persistent: Boolean(aa.persistent) };
  } else {
    primaryOptions = {
      ...OPTIONS,
      playOn: aa.playOn === 'source' ? 'source' : 'target',
      persistent: Boolean(aa.persistent),
      size: Number(aa.scale) > 0 ? Number(aa.scale) : 1,
    };
  }

  // Suono della primaria (golden range: sound.file + volume).
  const vol = Number(aa.soundVolume);
  const primarySound = (aa.soundEnable && String(aa.soundFile || '').trim())
    ? { enable: true, delay: 0, file: String(aa.soundFile).trim(), repeat: 1, repeatDelay: 250, startTime: 0, volume: vol > 0 && vol <= 1 ? vol : 0.75 }
    : { ...SOUND };

  const flag = {
    id: aaId(),
    label: label || '',
    levels3d: structuredClone(LEVELS3D),
    macro: { enable: false, playWhen: '0' },
    menu,
    primary: {
      video: { ...VIDEO, enableCustom: true, customPath: 'jb2a.' + String(aa.path).trim() },
      sound: primarySound,
      options: primaryOptions,
    },
    secondary: { enable: false, video: { ...VIDEO }, sound: { ...SOUND }, options: { ...OPTIONS_SECONDARY } },
    soundOnly: { sound: { ...SOUND } },
    source: { enable: false, video: { ...VIDEO }, sound: { ...SOUND }, options: { ...OPTIONS_SOURCE } },
    target: {
      enable: Boolean(aa.tgtEnabled && String(aa.tgtPath || '').trim()),
      video: aa.tgtEnabled && aa.tgtPath
        ? { ...VIDEO, enableCustom: true, customPath: 'jb2a.' + String(aa.tgtPath).trim() }
        : { ...VIDEO },
      sound: { ...SOUND },
      options: {
        ...OPTIONS_TARGET,
        persistent: Boolean(aa.tgtPersistent),
        size: Number(aa.tgtScale) > 0 ? Number(aa.tgtScale) : 1,
      },
    },
    isEnabled: true,
    isCustomized: true,
    fromAmmo: false,
    version: 5,
  };
  // Il blocco meleeSwitch esiste SOLO nel menu melee (golden Fireball).
  if (menu === 'melee') flag.meleeSwitch = structuredClone(MELEE_SWITCH);
  return flag;
}

/** Stato di default della sezione A-A nel form. */
export function defaultAA() {
  return {
    enabled: false, menu: 'ontoken',
    path: '', search: '', playOn: 'target', persistent: false, scale: '',
    soundEnable: false, soundFile: '', soundVolume: '0.75',
    tgtEnabled: false, tgtPath: '', tgtSearch: '', tgtPersistent: false, tgtScale: '',
  };
}
