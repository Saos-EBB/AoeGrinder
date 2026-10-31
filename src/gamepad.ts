// Gamepad API, Standard-Mapping: einmal pro Frame abfragen. Ereignisse gibt es nur fürs Ein- und Ausstecken.

import { state, player } from './state';
import { clamp } from './util';
import { CFG } from './config';
import { cam } from './camera';
import { showError } from './ui/hud';

export const pad = {
  move: { x: 0, y: 0 },    // linker Stick: x rechts, y vorwärts, Länge 0..1
  look: { x: 0, y: 0 },    // rechter Stick: x rechts, y unten, Länge 0..1
  down: [] as boolean[],
  prev: [] as boolean[],
};

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
});
