// Tastenbelegung wird in localStorage gespeichert, falls verfügbar.

import * as THREE from 'three';
import { state, player } from './state';
import { $, clamp } from './util';
import { SPELLS } from './config';
import { renderer, camera } from './render';
import { groundAt } from './collision';
import { blizCursor } from './fx/spellFx';
import { cam } from './camera';
import { closeBinds, closeResetConfirm, renderBinds, setBind } from './ui/menus';
import { cast } from './spells';
import { refreshKeyLabels } from './ui/hud';
import { charOpen, toggleChar } from './ui/charWindow';
import { openPause, closePause, pauseOpen } from './ui/mainMenu';
import { startDodge } from './player';

export const ACTIONS = [
  { group: 'Bewegung' },
  { id: 'forward',     label: 'Vorwärts',          code: 'KeyW',   key: 'W' },
  { id: 'back',        label: 'Rückwärts',         code: 'KeyS',   key: 'S' },
  { id: 'turnLeft',    label: 'Links drehen',      code: 'KeyA',   key: 'A' },
  { id: 'turnRight',   label: 'Rechts drehen',     code: 'KeyD',   key: 'D' },
  { id: 'strafeLeft',  label: 'Seitwärts links',   code: 'KeyQ',   key: 'Q' },
  { id: 'strafeRight', label: 'Seitwärts rechts',  code: 'KeyE',   key: 'E' },
  { id: 'jump',        label: 'Springen',          code: 'Space',  key: 'Leertaste' },
  { id: 'dodge',       label: 'Ausweichen',        code: 'ShiftLeft', key: 'Shift' },
  { id: 'autorun',     label: 'Autorun',           code: 'KeyR',   key: 'R' },
  { group: 'Fenster' },
  { id: 'charWin', label: 'Charakterfenster', code: 'KeyX', key: 'X' },
  { group: 'Zauber' },
  { id: 'nova',  label: 'Frost Nova',       code: 'Digit1', key: '1', spell: true },
  { id: 'ae',    label: 'Arcane Explosion', code: 'Digit2', key: '2', spell: true },
  { id: 'bliz',  label: 'Blizzard',         code: 'Digit3', key: '3', spell: true },
  { id: 'coc',   label: 'Cone of Cold',     code: 'Digit4', key: '4', spell: true },
  { id: 'blink', label: 'Blink',            code: 'Digit5', key: '5', spell: true },
  { id: 'drink', label: 'Trinken',          code: 'Digit6', key: '6', spell: true },
  { id: 'slot7', label: 'Slot 7', code: 'Digit7', key: '7', spell: true },
  { id: 'slot8', label: 'Slot 8', code: 'Digit8', key: '8', spell: true },
];
const BIND_STORE = 'frostgrind.binds.v1';
export let binds = loadBinds();
// Die Nahkämpfer Klingenstrich und Strichkrieger haben eine eigene Belegung der Slots: Q, E, R, Maus 4, Maus 5, 1, 2, 3. Was sie belegt (Seitwärts, Autorun), ist in diesem Modus frei.
const KLINGE_BIND_STORE = 'frostgrind.binds.klinge.v1';
const KLINGE_SLOTS = { nova: ['KeyQ', 'Q'], ae: ['KeyE', 'E'], bliz: ['KeyR', 'R'], coc: ['Mouse3', 'Maus 4'], blink: ['Mouse4', 'Maus 5'], drink: ['Digit1', '1'], slot7: ['Digit2', '2'], slot8: ['Digit3', '3'] };
let klingeBinds = false, normalBinds = binds;
function klingeDefaults() {
  const b = { ...normalBinds }, used = Object.values(KLINGE_SLOTS).map(s => s[0]);
  for (const id in b) if (used.includes(b[id].code)) b[id] = { code: '', key: '–' };
  for (const [id, [code, key]] of Object.entries(KLINGE_SLOTS)) b[id] = { code, key };
  return b;
}
export function useKlingeBinds(on) {
  if (on === klingeBinds) return;
  if (on) {
    normalBinds = binds;
    binds = klingeDefaults();
    try { Object.assign(binds, JSON.parse(localStorage.getItem(KLINGE_BIND_STORE) || '{}')); } catch { /* kein Storage */ }
  } else binds = normalBinds;
  klingeBinds = on;
}

function defaultBinds() {
  const b = {};
  for (const a of ACTIONS) if (a.id) b[a.id] = { code: a.code, key: a.key };
  return b;
}
function loadBinds() {
  const b = defaultBinds();
  try { Object.assign(b, JSON.parse(localStorage.getItem(BIND_STORE) || '{}')); } catch { /* kein Storage */ }
  return b;
}
export function saveBinds() {
  try { localStorage.setItem(klingeBinds ? KLINGE_BIND_STORE : BIND_STORE, JSON.stringify(binds)); } catch { /* egal */ }
}
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
    if (e.code !== 'Escape') setBind(state.rebinding, e);
    state.rebinding = null;
    renderBinds();
    return;
  }
  if ($('resetModal').classList.contains('show')) {   // Fenster fängt alle Tasten ab, Enter löst den fokussierten Knopf aus
    if (e.code === 'Escape') closeResetConfirm();
    return;
  }
  if (e.code === 'Escape') {
    if (charOpen()) toggleChar();
    else if ($('settingsModal').classList.contains('show')) $('settingsClose').click();
    else if (pauseOpen() && !$('bindModal').classList.contains('show')) closePause();
    else if (player.targeting) { player.targeting = false; blizCursor.visible = false; }
    else if ($('bindModal').classList.contains('show')) closeBinds();
    else if (!state.paused) openPause();
    return;
  }
  const id = actionForCode(e.code);
  if (id) e.preventDefault();
  held.add(e.code);
  if (e.repeat || !id) return;
  runAction(id);
});
addEventListener('keyup', e => held.delete(e.code));

function runAction(id) {
  if (SPELLS[id]) pressSpell(id);
  if (id === 'charWin') toggleChar();
  if (id === 'jump') state.jumpQueued = true;
  if (id === 'dodge') startDodge();
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
    setBind(state.rebinding, { code, key });
    state.rebinding = null;
    renderBinds();
    return;
  }
  if (state.lastInput !== 'key') { state.lastInput = 'key'; refreshKeyLabels(); }
  held.add(code);
  const id = actionForCode(code);
  if (id) runAction(id);
});
addEventListener('mouseup', e => {
  if (!MOUSE_KEYS[e.button]) return;
  e.preventDefault();
  held.delete(`Mouse${e.button}`);
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
  else { player.targeting = false; blizCursor.visible = false; }
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
  if (klingeBinds) { normalBinds = defaultBinds(); binds = klingeDefaults(); }
  else binds = defaultBinds();
}
