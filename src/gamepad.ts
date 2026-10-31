// Gamepad API, Standard-Mapping: einmal pro Frame abfragen. Ereignisse gibt es nur fürs Ein- und Ausstecken.

import { state, player } from './state';
import { $, clamp } from './util';
import { CFG, SPELLS } from './config';
import { cam } from './camera';
import { showError } from './ui/hud';
import { pressSpell } from './input';
import { openBinds, closeBinds } from './ui/menus';

export const pad = {
  move: { x: 0, y: 0 },    // linker Stick: x rechts, y vorwärts, Länge 0..1
  look: { x: 0, y: 0 },    // rechter Stick: x rechts, y unten, Länge 0..1
  down: [] as boolean[],
  prev: [] as boolean[],
};

// Aktion -> Button-Index im Standard-Mapping
export const PAD_ACTIONS = [
  { id: 'jump',      label: 'Springen',            btn: 0 },
  { id: 'coc',       label: 'Cone of Cold',        btn: 1 },
  { id: 'ae',        label: 'Arcane Explosion',    btn: 2 },
  { id: 'nova',      label: 'Frost Nova',          btn: 3 },
  { id: 'blink',     label: 'Blink',               btn: 4 },
  { id: 'bliz',      label: 'Blizzard',            btn: 5 },
  { id: 'help',      label: 'Hilfe',               btn: 8 },
  { id: 'menu',      label: 'Pause und Belegung',  btn: 9 },
  { id: 'autorun',   label: 'Autorun',             btn: 10 },
  { id: 'camBehind', label: 'Kamera hinter Figur', btn: 11 },
  { id: 'zoomIn',    label: 'Zoom rein',           btn: 12 },
  { id: 'zoomOut',   label: 'Zoom raus',           btn: 13 },
  { id: 'drink',     label: 'Trinken',             btn: 14 },
];
const padDefaults = () => Object.fromEntries(PAD_ACTIONS.map(a => [a.id, a.btn]));
export const padBinds: Record<string, number> = padDefaults();

const pressed = i => pad.down[i] && !pad.prev[i];   // Flanke: ein Druck löst genau einmal aus

const PAD_EFFECTS = {
  jump() { state.jumpQueued = true; },
  autorun() { state.autorun = !state.autorun; },
  help() { const h = $('help'); h.style.display = h.style.display === 'none' ? '' : 'none'; },
  camBehind() { cam.offset = 0; },
  zoomIn() { cam.dist = clamp(cam.dist - 1.5, 3, 35); },
  zoomOut() { cam.dist = clamp(cam.dist + 1.5, 3, 35); },
};

function gameButtons() {
  if (pressed(padBinds.menu)) return openBinds();
  for (const { id } of PAD_ACTIONS) {
    if (!pressed(padBinds[id])) continue;
    if (SPELLS[id]) pressSpell(id);
    else PAD_EFFECTS[id]?.();
  }
  if (Math.abs(pad.move.y) > 0.5) state.autorun = false;   // wie W/S an der Tastatur
}

// Radiale Deadzone, danach auf 0..1 neu skaliert
function deadzone(x, y) {
  const len = Math.hypot(x, y);
  if (len < CFG.padDeadzone) return { x: 0, y: 0 };
  const scale = Math.min(1, (len - CFG.padDeadzone) / (1 - CFG.padDeadzone)) / len;
  return { x: x * scale, y: y * scale };
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
  pad.prev = pad.down;
  pad.down = gp ? gp.buttons.map(b => b.pressed) : [];
  const left = gp ? deadzone(gp.axes[0], gp.axes[1]) : { x: 0, y: 0 };
  pad.move = { x: left.x, y: left.y && -left.y };   // nach oben gedrückt ist negativ
  pad.look = gp ? deadzone(gp.axes[2], gp.axes[3]) : { x: 0, y: 0 };
  if (!state.paused) gameButtons();
  else if (pressed(padBinds.menu) && $('bindModal').classList.contains('show')) closeBinds();
}

// Im Stand kreist die Kamera, beim Laufen dreht sich der Charakter mit (wie rechte Maustaste)
export function updatePadCamera(dt) {
  const moving = pad.move.x || pad.move.y;
  if (!moving && !pad.look.x && !pad.look.y) return;
  const s = dt / 1000, yaw = -pad.look.x * CFG.padYaw * s;
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
