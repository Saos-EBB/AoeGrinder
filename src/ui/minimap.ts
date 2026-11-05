// Minimap: runde Karte um den Spieler, oben ist die Blickrichtung der Kamera. Lage und Größe über hud/layout.ts (Element minimap).
// Zeigt Mobs im Umkreis (rot, im Kampf heller, Champions blau), den Kartenrand und den Spieler als Pfeil. Alles PH.

import { state, player } from '../state';
import { $ } from '../util';
import { CFG } from '../config';
import { cam } from '../camera';
import { COLORS } from './colors';

const MINIMAP = {
  px: 150,               // Kantenlänge in CSS-Pixeln, die Größe im Spiel kommt aus dem HUD-Layout (Mausrad)
  yd: 55,                // Radius der Karte in yd
  everyMs: 50,           // Neu zeichnen höchstens alle 50 ms
  mob: '#c8322a', fight: '#ff6a4a', champ: '#6fb8ff', edge: '#efe0b8', player: '#f2c94c',
};

const box = $('hudMap');
const canvas = document.createElement('canvas');
box.appendChild(canvas);
const ctx = canvas.getContext('2d');
let size = 0, last = -1e9;

function fit() {
  const px = Math.round(MINIMAP.px * Math.min(2, devicePixelRatio || 1));
  if (px === size) return;
  size = canvas.width = canvas.height = px;
  canvas.style.width = canvas.style.height = `${MINIMAP.px}px`;
}

export function updateMinimap() {
  const now = performance.now();
  if (now - last < MINIMAP.everyMs || document.body.classList.contains('menu')) return;
  last = now;
  fit();
  const c = ctx, r = size / 2, k = r / MINIMAP.yd, yaw = player.facing + cam.offset;
  const sin = Math.sin(yaw), cos = Math.cos(yaw), px = player.pos.x, pz = player.pos.z;
  // Welt → Karte: oben = Blickrichtung (sin, cos), rechts = Kamera-rechts (−cos, sin)
  const toMap = (x, z) => { const dx = x - px, dz = z - pz; return [r + (-dx * cos + dz * sin) * k, r - (dx * sin + dz * cos) * k]; };

  c.clearRect(0, 0, size, size);
  c.save();
  c.beginPath(); c.arc(r, r, r - 1, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#0b0906e6'; c.fillRect(0, 0, size, size);
  // Ringe alle 20 yd
  c.strokeStyle = '#efe0b81a'; c.lineWidth = 1;
  for (let yd = 20; yd < MINIMAP.yd; yd += 20) { c.beginPath(); c.arc(r, r, yd * k, 0, Math.PI * 2); c.stroke(); }
  // Kartenrand: Kreis um den Ursprung
  const [ox, oy] = toMap(0, 0);
  c.strokeStyle = MINIMAP.edge; c.globalAlpha = 0.5; c.lineWidth = 2 * size / MINIMAP.px;
  c.beginPath(); c.arc(ox, oy, CFG.playRadius * k, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = 1;
  // Mobs: erst normale, dann Kampf und Champions obendrauf
  const dot = size / MINIMAP.px;
  for (const pass of [0, 1]) for (const m of state.mobs) {
    if (m.dead || m.hidden) continue;
    const top = !!m.champion || m.state === 'combat';
    if (top !== !!pass) continue;
    const [x, y] = toMap(m.pos.x, m.pos.z);
    if (Math.hypot(x - r, y - r) > r) continue;
    c.fillStyle = m.champion ? MINIMAP.champ : m.state === 'combat' ? MINIMAP.fight : MINIMAP.mob;
    c.beginPath(); c.arc(x, y, (m.champion ? 3.2 : 2.3) * dot, 0, Math.PI * 2); c.fill();
  }
  // Spieler: Pfeil in Laufrichtung, relativ zur Kamera
  c.translate(r, r); c.rotate(cam.offset);
  c.fillStyle = MINIMAP.player; c.strokeStyle = '#000'; c.lineWidth = dot;
  c.beginPath(); c.moveTo(0, -7 * dot); c.lineTo(5 * dot, 6 * dot); c.lineTo(0, 3 * dot); c.lineTo(-5 * dot, 6 * dot); c.closePath(); c.fill(); c.stroke();
  c.restore();
  // Rahmen
  c.strokeStyle = COLORS.goldFrame; c.lineWidth = 3 * dot;
  c.beginPath(); c.arc(r, r, r - 1.5 * dot, 0, Math.PI * 2); c.stroke();
}
