// Tastenbelegung wird in localStorage gespeichert, falls verfügbar.

import * as THREE from 'three';
import { KEYS, read, write } from './storage';
import { state, player } from './state';
import { $, clamp } from './util';
import { SPELLS, SPELL_ACTIONS } from './config';
import { renderer, camera } from './render';
import { groundAt } from './collision';
import { groundCursor } from './fx/spellFx';
import { cam } from './camera';
import { cast } from './spells';
import { isGround } from './spells/core';
import { spellAtAction, modeAt } from './hotbar';
import { refreshKeyLabels } from './feedback';
import { startDodge } from './player/move';
import { t } from './i18n';
import { doUse } from './useKey';
import { hooks } from './hooks';
const ui = hooks.ui;   // Fenster und Menüs (hooks.ts UiApi, ui/connect.ts setzt ein)

export const ACTIONS = [
  { group: t('bind.group.move') },
  { id: 'forward',     label: t('bind.forward'),          code: 'KeyW',   key: 'W' },
  { id: 'back',        label: t('bind.back'),         code: 'KeyS',   key: 'S' },
  { id: 'turnLeft',    label: t('bind.turnLeft'),      code: 'KeyA',   key: 'A' },
  { id: 'turnRight',   label: t('bind.turnRight'),     code: 'KeyD',   key: 'D' },
  { id: 'strafeLeft',  label: t('bind.strafeLeft'),   code: 'KeyQ',   key: 'Q' },
  { id: 'strafeRight', label: t('bind.strafeRight'),  code: 'KeyE',   key: 'E' },
  { id: 'jump',        label: t('bind.jump'),          code: 'Space',  key: 'Leertaste' },
  { id: 'dodge',       label: t('bind.dodge'),        code: 'ShiftLeft', key: 'Shift' },
  { id: 'autorun',     label: t('bind.autorun'),           code: 'KeyR',   key: 'R' },
  { id: 'use',         label: t('bind.use'),           code: 'KeyG',   key: 'G' },   // Truhen, Schreine, Hebel, Waffen am Boden (useKey.ts); F ist Spell-Slot 5
  { group: t('bind.group.windows') },
  { id: 'charWin', label: t('bind.charWin'), code: 'KeyX', key: 'X' },
  { id: 'gearWin', label: t('bind.gearWin'), code: 'KeyI', key: 'I' },   // X und I öffnen dasselbe Fenster (ui/heroWindow.ts), im Run nur zum Ansehen
  { group: t('bind.group.spells') },
  // Raster seit v31 (SLOT in config.ts): 5 Attacken, Trinken, Bewegung auf der alten Blink-Taste, Relikt. Die 5. Attacke liegt auf F, weil 5 die Bewegung bleibt
  { id: 'nova',  label: t('bind.nova'),        code: 'Digit1', key: '1', spell: true },
  { id: 'ae',    label: t('bind.ae'),        code: 'Digit2', key: '2', spell: true },
  { id: 'bliz',  label: t('bind.bliz'),        code: 'Digit3', key: '3', spell: true },
  { id: 'coc',   label: t('bind.coc'),        code: 'Digit4', key: '4', spell: true },
  { id: 'slot7', label: t('bind.slot7'),        code: 'KeyF',   key: 'F', spell: true },
  { id: 'drink', label: t('bind.drink'),  code: 'Digit6', key: '6', spell: true },
  { id: 'blink', label: t('bind.blink'),         code: 'Digit5', key: '5', spell: true },
  { id: 'slot8', label: t('bind.slot8'),           code: 'Digit8', key: '8', spell: true },
];
export let binds = loadBinds();
// Der Strichkrieger hat eine eigene Belegung der Slots: Q, E, R, Maus 4, Maus 5, 1, 2, 3. Was sie belegt (Seitwärts, Autorun), ist in diesem Modus frei.
// Der Speicher-Name stammt vom Klingenstrich (geparkt in maybeLater/) und bleibt, damit gespeicherte Tasten gelten
const MELEE_SLOTS = { nova: ['KeyQ', 'Q'], ae: ['KeyE', 'E'], bliz: ['KeyR', 'R'], coc: ['Mouse3', 'Maus 4'], blink: ['Mouse4', 'Maus 5'], drink: ['Digit1', '1'], slot7: ['Digit2', '2'], slot8: ['Digit3', '3'] };
let meleeBinds = false, normalBinds = binds;
function meleeDefaults() {
  const b = { ...normalBinds }, used = Object.values(MELEE_SLOTS).map(s => s[0]);
  for (const id in b) if (used.includes(b[id].code)) b[id] = { code: '', key: '–' };
  for (const [id, [code, key]] of Object.entries(MELEE_SLOTS)) b[id] = { code, key };
  return b;
}
export function useMeleeBinds(on) {
  if (on === meleeBinds) return;
  if (on) {
    normalBinds = binds;
    binds = meleeDefaults();
    Object.assign(binds, read(KEYS.bindsMelee, {}));
  } else binds = normalBinds;
  meleeBinds = on;
}

function defaultBinds() {
  const b = {};
  for (const a of ACTIONS) if (a.id) b[a.id] = { code: a.code, key: a.key };
  return b;
}
function loadBinds() {
  const b = defaultBinds();
  Object.assign(b, read(KEYS.binds, {}));
  return b;
}
export function saveBinds() {
  write(meleeBinds ? KEYS.bindsMelee : KEYS.binds, binds);
}
// Tastennamen werden so gespeichert (Leertaste, Maus 4); keyText übersetzt sie nur für die Anzeige
export const keyText = (k: string) => k === 'Leertaste' ? t('key.space') : k?.startsWith('Maus ') ? `${t('key.mouse')} ${k.slice(5) === 'Mitte' ? t('key.middle') : k.slice(5)}` : k;
export const keyName = e => e.code === 'Space' ? 'Leertaste' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
export const actionForCode = code => Object.keys(binds).find(id => binds[id].code === code);

// Eingabe
const held = new Set();      // gedrückte Tasten (e.code)
export const mouseBtn = { left: false, right: false };
export const mouse = { ndc: new THREE.Vector2(), ground: new THREE.Vector3(), dragged: false, downX: 0, downY: 0 };
export const act = id => held.has(binds[id].code);

export function pressSpell(id) {
  if (state.paused || player.dead) return;
  cast(id);
}

addEventListener('keydown', e => {
  if (e.target instanceof HTMLTextAreaElement) return;   // Textfeld (Spielstand-Code): Tasten gehören dem Feld
  if (state.lastInput !== 'key') { state.lastInput = 'key'; refreshKeyLabels(); }
  if (state.rebinding) {
    e.preventDefault();
    if (e.code !== 'Escape') ui.fn.setBind(state.rebinding, e);
    state.rebinding = null;
    ui.fn.renderBinds();
    return;
  }
  if ($('resetModal').classList.contains('show')) {   // Fenster fängt alle Tasten ab, Enter löst den fokussierten Knopf aus
    if (e.code === 'Escape') ui.fn.closeResetConfirm();
    return;
  }
  if (e.code === 'Escape') {
    if (ui.fn.heroOpen()) ui.fn.closeHero();
    else if ($('settingsModal').classList.contains('show')) $('settingsClose').click();
    else if (ui.fn.pauseOpen() && !$('bindModal').classList.contains('show')) ui.fn.closePause();
    else if (player.targeting) { player.targeting = false; groundCursor.visible = false; }
    else if ($('bindModal').classList.contains('show')) ui.fn.closeBinds();
    else if (!state.paused) ui.fn.openPause();
    return;
  }
  const id = actionForCode(e.code);
  if (id) e.preventDefault();
  held.add(e.code);
  if (e.repeat || !id) return;
  runAction(id, e.code);
});
addEventListener('keyup', e => { held.delete(e.code); spellUp(e.code); });

// Auslöse-Modus des Platzes (hotbar.ts): sofort, bei Loslassen oder klicken. code: Taste, deren Loslassen „Bei Loslassen“ auslöst
const releaseOf = new Map<string, string>();
const groundSpell = id => isGround(id) && !SPELLS[id].press;   // eigene Steuerung (Nahkampf, Eisblock) kennt keine Zielfläche
function spellDown(action, code) {
  const id = spellAtAction(action);
  if (!id || state.paused || player.dead) return;
  const ground = groundSpell(id), mode = modeAt(SPELL_ACTIONS.indexOf(action), ground);
  if (mode === 'release') { releaseOf.set(code, action); if (ground && player.targeting !== id) pressSpell(action); return; }   // Bodenziel: Zielkreis, solange gehalten
  if (mode === 'instant' && ground && !state.bossAim) { pickGround(); player.targeting = false; groundCursor.visible = false; cast(action, mouse.ground.clone()); return; }   // Bodenziel unter der Maus
  pressSpell(action);
}
function spellUp(code) {
  const action = releaseOf.get(code);
  if (!action) return;
  releaseOf.delete(code);
  const id = spellAtAction(action);
  if (!id || state.paused || player.dead) return;
  if (!groundSpell(id) || state.bossAim) return pressSpell(action);
  if (player.targeting !== id) return;                 // Zielen abgebrochen (Esc, Rechtsklick)
  pickGround();
  cast(action, mouse.ground.clone());
}

function runAction(id, code = '') {
  if (SPELL_ACTIONS.includes(id)) spellDown(id, code);
  else if (SPELLS[id]) pressSpell(id);
  if (id === 'charWin' || id === 'gearWin') ui.fn.toggleHero();
  if (id === 'jump') state.jumpQueued = true;
  if (id === 'dodge') startDodge();
  if (id === 'use' && !state.paused) doUse();
  if (id === 'autorun') state.autorun = !state.autorun;
  if (id === 'back' || id === 'forward') state.autorun = false;
}

// Mittlere Maustaste und Seitentasten sind belegbar wie Tasten. preventDefault verhindert Autoscroll und Browser-Zurück.
const MOUSE_KEYS = { 1: 'Maus Mitte', 3: 'Maus 4', 4: 'Maus 5' };
addEventListener('mousedown', e => {
  const key = MOUSE_KEYS[e.button];
  if (!key) return;
  e.preventDefault();
  const code = `Mouse${e.button}`;
  if (state.rebinding) {
    ui.fn.setBind(state.rebinding, { code, key });
    state.rebinding = null;
    ui.fn.renderBinds();
    return;
  }
  if (state.lastInput !== 'key') { state.lastInput = 'key'; refreshKeyLabels(); }
  held.add(code);
  const id = actionForCode(code);
  if (id) runAction(id, code);
});
addEventListener('mouseup', e => {
  if (!MOUSE_KEYS[e.button]) return;
  e.preventDefault();
  held.delete(`Mouse${e.button}`);
  spellUp(`Mouse${e.button}`);
});
addEventListener('auxclick', e => { if (MOUSE_KEYS[e.button]) e.preventDefault(); });
addEventListener('blur', () => { held.clear(); mouseBtn.left = mouseBtn.right = false; });

const canvas = renderer.domElement;
canvas.addEventListener('mousedown', e => {
  if (MOUSE_KEYS[e.button]) return;
  if (e.button === 0) mouseBtn.left = true;
  if (e.button === 2) {
    mouseBtn.right = true;
    player.facing += cam.offset;               // Charakter dreht sich in Kamerarichtung
    cam.offset = 0;
  }
  mouse.dragged = false;
  mouse.downX = e.clientX; mouse.downY = e.clientY;
});
addEventListener('mouseup', e => {
  if (MOUSE_KEYS[e.button]) return;
  const wasClick = !mouse.dragged;
  if (e.button === 0) mouseBtn.left = false;
  if (e.button === 2) mouseBtn.right = false;
  if (document.pointerLockElement && !mouseBtn.left && !mouseBtn.right) document.exitPointerLock();
  if (!wasClick || !player.targeting || e.target !== canvas) return;
  if (e.button === 0) cast('bliz', mouse.ground.clone());
  else { player.targeting = false; groundCursor.visible = false; }
});
addEventListener('mousemove', e => {
  if (mouseBtn.left || mouseBtn.right) {
    if (!mouse.dragged && Math.hypot(e.clientX - mouse.downX, e.clientY - mouse.downY) > 4) {
      mouse.dragged = true;
      try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* ohne Lock geht's auch */ }
    }
    if (mouse.dragged) {
      const yaw = -e.movementX * 0.005;
      if (mouseBtn.right) player.facing += yaw; else cam.offset += yaw;
      cam.pitch = clamp(cam.pitch + e.movementY * 0.004, -0.2, 1.35);
    }
  }
  if (!document.pointerLockElement) mouse.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 1.5, 3, 35); });
// Mauszeiger auf den Boden projizieren (Ray-Marching über die Höhenfunktion)
const raycaster = new THREE.Raycaster();
export function pickGround() {
  raycaster.setFromCamera(mouse.ndc, camera);
  const { origin, direction } = raycaster.ray;
  const p = new THREE.Vector3();
  for (let t = 0; t < 150; t += 0.5) {
    p.copy(origin).addScaledVector(direction, t);
    const g = groundAt(p.x, p.z, p.y);   // die erste Fläche, auf die der Strahl von oben trifft
    if (p.y <= g) { mouse.ground.set(p.x, g, p.z); return; }
  }
}

export function resetBinds() {
  if (meleeBinds) { normalBinds = defaultBinds(); binds = meleeDefaults(); }
  else binds = defaultBinds();
}
