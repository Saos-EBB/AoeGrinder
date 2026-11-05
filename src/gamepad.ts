// Gamepad API, Standard-Mapping: einmal pro Frame abfragen. Ereignisse gibt es nur fürs Ein- und Ausstecken.

import { spellAtAction } from './hotbar';
import { startDodge } from './player';
import { charOpen, charTab, toggleChar } from './ui/charWindow';
import { openPause, closePause, cycleChar } from './ui/mainMenu';
import * as THREE from 'three';
import { state, player } from './state';
import { $, clamp } from './util';
import { CFG, SPELLS, SPELL_ACTIONS } from './config';
import { cam } from './camera';
import { groundAt, SKY } from './collision';
import { blizCursor } from './fx/spellFx';
import { castSpell, isGround } from './spells';
import { showError, refreshKeyLabels } from './ui/hud';
import { pressSpell } from './input';
import { closeBinds, renderBinds } from './ui/menus';
import { touch, updateTouch } from './mobile';

export const pad = {
  move: { x: 0, y: 0 },    // linker Stick: x rechts, y vorwärts, Länge 0..1
  look: { x: 0, y: 0 },    // rechter Stick: x rechts, y unten, Länge 0..1
  down: [] as boolean[],
  prev: [] as boolean[],
};

// Aktion -> Button-Index im Standard-Mapping
export const PAD_ACTIONS = [
  { id: 'jump',      label: 'Springen',            btn: 0 },
  { id: 'dodge',     label: 'Ausweichen',          btn: 6 },   // L2; B (○) ist Cone of Cold und Abbruch
  { id: 'coc',       label: 'Cone of Cold',        btn: 1 },
  { id: 'ae',        label: 'Arcane Explosion',    btn: 2 },
  { id: 'nova',      label: 'Frost Nova',          btn: 3 },
  { id: 'blink',     label: 'Blink',               btn: 4 },
  { id: 'bliz',      label: 'Blizzard',            btn: 5 },
  { id: 'charWin',   label: 'Charakterfenster',    btn: 8 },
  { id: 'menu',      label: 'Pause und Belegung',  btn: 9 },
  { id: 'autorun',   label: 'Autorun',             btn: 10 },
  { id: 'camBehind', label: 'Kamera hinter Figur', btn: 11 },
  { id: 'zoomIn',    label: 'Zoom rein',           btn: 12 },
  { id: 'zoomOut',   label: 'Zoom raus',           btn: 13 },
  { id: 'drink',     label: 'Trinken',             btn: 14 },
  { id: 'slot7',     label: 'Slot 7',              btn: 7 },
  { id: 'slot8',     label: 'Slot 8',              btn: 15 },
];
const padDefaults = () => Object.fromEntries(PAD_ACTIONS.map(a => [a.id, a.btn]));
const PAD_STORE = 'frostgrind.padbinds.v1';
export const padBinds: Record<string, number> = padDefaults();
try { Object.assign(padBinds, JSON.parse(localStorage.getItem(PAD_STORE) || '{}')); } catch { /* kein Storage */ }

export function savePadBinds() {
  try { localStorage.setItem(PAD_STORE, JSON.stringify(padBinds)); } catch { /* egal */ }
}
export function resetPadBinds() { Object.assign(padBinds, padDefaults()); }

function setPadBind(id, btn) {
  for (const other in padBinds) if (padBinds[other] === btn) padBinds[other] = -1;   // Doppelbelegung aufheben
  padBinds[id] = btn;
  savePadBinds();
}

const PAD_LABELS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→'];
export const padLabel = btn => PAD_LABELS[btn] ?? '–';

const pressed = i => pad.down[i] && !pad.prev[i];   // Flanke: ein Druck löst genau einmal aus

const PAD_EFFECTS = {
  jump() { state.jumpQueued = true; },
  dodge() { startDodge(); },
  autorun() { state.autorun = !state.autorun; },
  charWin() { toggleChar(); },
  camBehind() { cam.offset = 0; },
  zoomIn() { cam.dist = clamp(cam.dist - 1.5, 3, 35); },
  zoomOut() { cam.dist = clamp(cam.dist + 1.5, 3, 35); },
};

// Bodenziel-Spells in jedem Slot: halten zum Zielen, loslassen zum Zaubern
const CANCEL_BTN = 1;
let aimAction = null;   // Aktion, deren Taste gerade gehalten wird

function cancelAim() {
  state.padAim = null;
  player.targeting = false;
  blizCursor.visible = false;
}

function startAim(action, id) {
  aimAction = action;
  const x = player.pos.x + Math.sin(player.facing) * CFG.blizAimStart;
  const z = player.pos.z + Math.cos(player.facing) * CFG.blizAimStart;
  state.padAim = new THREE.Vector3(x, groundAt(x, z, SKY), z);
  player.targeting = id;
  blizCursor.visible = true;
}

function moveAim(s) {
  const yaw = player.facing + cam.offset, a = state.padAim, fwd = -pad.look.y, right = pad.look.x;
  a.x += (Math.sin(yaw) * fwd - Math.cos(yaw) * right) * CFG.blizAimSpeed * s;
  a.z += (Math.cos(yaw) * fwd + Math.sin(yaw) * right) * CFG.blizAimSpeed * s;
  a.y = groundAt(a.x, a.z, SKY);
}

function gameButtons() {
  if (pressed(padBinds.menu)) return openPause();
  const cancelled = player.targeting && pressed(CANCEL_BTN);
  if (cancelled) cancelAim();
  const b = padBinds[aimAction];
  if (state.padAim && pad.prev[b] && !pad.down[b]) {
    const point = state.padAim, id = player.targeting;
    cancelAim();
    castSpell(id, point);
  }
  for (const { id } of PAD_ACTIONS) {
    if (!pressed(padBinds[id]) || (cancelled && padBinds[id] === CANCEL_BTN)) continue;
    const spell = spellAtAction(id);
    if (spell && isGround(spell)) startAim(id, spell);
    else if (SPELLS[id]) pressSpell(id);
    else PAD_EFFECTS[id]?.();
  }
  if (Math.abs(pad.move.y) > 0.5) state.autorun = false;   // wie W/S an der Tastatur
}

// Menüs: Kreuz bestätigt, Steuerkreuz oder linker Stick wählt
const CONFIRM_BTN = 0, DPAD = { up: 12, down: 13, left: 14, right: 15 };
const isOpen = id => $(id).classList.contains('show');
let stickNav = { x: 0, y: 0 };

function navStep() {
  const now = { x: Math.abs(pad.move.x) > 0.5 ? Math.sign(pad.move.x) : 0, y: Math.abs(pad.move.y) > 0.5 ? -Math.sign(pad.move.y) : 0 };
  const step = {
    x: (pressed(DPAD.right) ? 1 : 0) - (pressed(DPAD.left) ? 1 : 0) || (now.x !== stickNav.x ? now.x : 0),
    y: (pressed(DPAD.down) ? 1 : 0) - (pressed(DPAD.up) ? 1 : 0) || (now.y !== stickNav.y ? now.y : 0),
  };
  stickNav = now;
  return step;
}

// Hebt den gewählten Eintrag der Liste hervor; ohne Auswahl den ersten (auch nach Neuaufbau der Liste)
function moveSelection(items, step, cls = 'selected') {
  const n = items.length, cur = items.findIndex(el => el.classList.contains(cls));
  const next = cur < 0 ? 0 : (cur + step + n) % n;
  items[cur]?.classList.remove(cls);
  items[next]?.classList.add(cls);
  return items[next];
}

function bindMenuButtons(step) {
  const row = moveSelection([...document.querySelectorAll('#bindList .padBtn')], step.y);
  if (step.y) row?.scrollIntoView({ block: 'nearest' });
  if (pressed(CONFIRM_BTN)) row?.click();
  else if (pressed(CANCEL_BTN)) closeBinds();
}

function captureRebind() {
  const btn = pad.down.findIndex((d, i) => d && !pad.prev[i]);
  if (btn < 0) return;
  const id = state.padRebinding;
  state.padRebinding = null;
  setPadBind(id, btn);
  renderBinds();
  refreshKeyLabels();
}

function menuButtons() {
  const step = navStep();
  if (isOpen('bindModal')) return bindMenuButtons(step);
  if (charOpen()) {
    if (step.x) charTab(step.x);
    if (pressed(CANCEL_BTN)) toggleChar();
    return;
  }
  if (isOpen('cardModal') && !isOpen('bindModal')) {
    const card = moveSelection([...document.querySelectorAll('#cards .card')], step.x);
    if (pressed(CONFIRM_BTN)) card?.click();
  } else if (isOpen('deathModal') && !isOpen('bindModal')) {
    if (pressed(CONFIRM_BTN)) (!$('deathShopBtn').hidden ? $('deathShopBtn') : $('restartBtn')).click();
  } else if (isOpen('shopModal')) {
    const b = moveSelection([...document.querySelectorAll('#shopModal button:not(:disabled)')], step.y, 'navSel');
    if (pressed(CONFIRM_BTN)) (b as any)?.click();
  } else if (isOpen('pauseModal')) {
    const b = moveSelection([...document.querySelectorAll('#pauseModal button')], step.y, 'navSel');
    if (pressed(CONFIRM_BTN)) (b as any)?.click();
    else if (pressed(CANCEL_BTN) || pressed(padBinds.menu)) closePause();
  } else if (isOpen('settingsModal')) {
    if (pressed(CANCEL_BTN)) $('settingsClose').click();
  } else if (isOpen('startModal')) {
    if (pressed(4)) cycleChar(-1);                // L1, R1 wechseln die Figur
    if (pressed(5)) cycleChar(1);
    const b = moveSelection([...document.querySelectorAll('#startModal button:not(:disabled)')], step.x || step.y, 'navSel');
    if (pressed(CONFIRM_BTN)) (b as any)?.click();
  }
}

// Radiale Deadzone, danach auf 0..1 neu skaliert
function deadzone(x, y) {
  const len = Math.hypot(x, y);
  if (len < CFG.padDeadzone) return { x: 0, y: 0 };
  const scale = Math.min(1, (len - CFG.padDeadzone) / (1 - CFG.padDeadzone)) / len;
  return { x: x * scale, y: y * scale };
}

// Kurzer Rumble, nur wenn der Browser dual-rumble für das Pad meldet
let activePad = null;
export function rumble(strong, weak, ms) {
  const v = activePad?.vibrationActuator;
  if (v?.type === 'dual-rumble' || v?.effects?.includes('dual-rumble')) {
    v.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak })?.catch(() => {});
  }
}

function readPad() {
  try {
    return [...navigator.getGamepads()].find(p => p && p.mapping === 'standard') || null;
  } catch {
    return null;   // Permissions-Policy verbietet die API, z. B. in einem fremden iframe
  }
}

export function pollGamepad() {
  const gp = readPad();
  activePad = gp;
  pad.prev = pad.down;
  pad.down = gp ? gp.buttons.map(b => b.pressed) : [];
  const left = gp ? deadzone(gp.axes[0], gp.axes[1]) : { x: 0, y: 0 };
  pad.move = { x: left.x, y: left.y && -left.y };   // nach oben gedrückt ist negativ
  pad.look = gp ? deadzone(gp.axes[2], gp.axes[3]) : { x: 0, y: 0 };
  updateTouch();                                     // Touch-Steuerung (mobile.ts) wirkt wie ein zweites Pad
  for (const id of touch.held) if (padBinds[id] >= 0) pad.down[padBinds[id]] = true;
  if (touch.move.x || touch.move.y) pad.move = { ...touch.move };
  if (touch.look.x || touch.look.y) pad.look = { ...touch.look };
  const touching = touch.held.size > 0;
  if (!player.targeting || (!gp && !touching) || state.paused) { if (state.padAim) cancelAim(); }
  if (state.lastInput !== 'pad' && (pad.down.some(Boolean) || pad.move.x || pad.move.y || pad.look.x || pad.look.y)) {
    state.lastInput = 'pad';
    refreshKeyLabels();
  }
  if (state.padRebinding) captureRebind();
  else if (!state.paused) gameButtons();
  else if (pressed(padBinds.menu) && isOpen('bindModal')) closeBinds();
  else if (pressed(padBinds.charWin)) toggleChar();
  else menuButtons();
}

// Im Stand kreist die Kamera, beim Laufen dreht sich der Charakter mit (wie rechte Maustaste)
export function updatePadCamera(dt) {
  const s = dt / 1000;
  if (state.padAim) {                       // rechter Stick verschiebt den Zielkreis statt der Kamera
    moveAim(s);
    pad.look = { x: 0, y: 0 };
  }
  const moving = pad.move.x || pad.move.y;
  if (!moving && !pad.look.x && !pad.look.y) return;
  const yaw = -pad.look.x * CFG.padYaw * s;
  if (moving || state.autorun) {
    player.facing += cam.offset + yaw;
    cam.offset = 0;
  } else cam.offset += yaw;
  cam.pitch = clamp(cam.pitch + pad.look.y * CFG.padPitch * s, -0.2, 1.35);
}

addEventListener('gamepadconnected', (e: any) => {
  showError(e.gamepad.mapping === 'standard' ? 'Pad verbunden' : 'Pad ohne Standard-Mapping, keine Steuerung möglich');
});
addEventListener('gamepaddisconnected', () => {
  showError('Pad getrennt');
  state.autorun = false;
});
