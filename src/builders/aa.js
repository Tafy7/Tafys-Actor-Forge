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
// v1: menu 'ontoken' (l'unico osservato a livello item nei golden) con
// animazione PRIMARIA (su bersaglio o lanciatore) ed eventuale animazione
// TARGET aggiuntiva. Melee/range/template arriveranno quando avremo un
// golden con quei menu compilati.
// ============================================================
import { randomID } from '../utils/id.js';

// Un blocco sound neutro (identico in tutti gli slot del golden).
const SOUND = { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 };
// Un blocco video neutro (i default del golden quando lo slot è spento).
const VIDEO = {
  dbSection: 'static', menuType: 'spell', animation: 'curewounds', variant: '01',
  color: 'blue', enableCustom: false, customPath: '',
};
// Opzioni complete come nel golden Power Word Stun (primary).
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

/**
 * Costruisce flags.autoanimations dal descrittore della UI:
 * `aa` = { enabled, path ('fireball.explosion.orange' SENZA prefisso jb2a),
 *          playOn ('target'|'source'), persistent, scale,
 *          tgtEnabled, tgtPath, tgtPersistent, tgtScale }
 * Ritorna null se disattivata o senza animazione scelta.
 */
export function buildAAFlags(aa, label) {
  if (!aa || !aa.enabled || !String(aa.path || '').trim()) return null;
  const flag = {
    id: aaId(),
    label: label || '',
    levels3d: structuredClone(LEVELS3D),
    macro: { enable: false, playWhen: '0' },
    menu: 'ontoken',
    primary: {
      video: { ...VIDEO, enableCustom: true, customPath: 'jb2a.' + String(aa.path).trim() },
      sound: { ...SOUND },
      options: {
        ...OPTIONS,
        playOn: aa.playOn === 'source' ? 'source' : 'target',
        persistent: Boolean(aa.persistent),
        size: Number(aa.scale) > 0 ? Number(aa.scale) : 1,
      },
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
  return flag;
}

/** Stato di default della sezione A-A nel form. */
export function defaultAA() {
  return {
    enabled: false,
    path: '', search: '', playOn: 'target', persistent: false, scale: '',
    tgtEnabled: false, tgtPath: '', tgtSearch: '', tgtPersistent: false, tgtScale: '',
  };
}
