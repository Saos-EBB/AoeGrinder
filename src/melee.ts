// Gemeinsame Helfer der Nahkämpfer (Real Men, Klingenstrich): Blickrichtung, Linie, Sprint nach vorn,
// verzögerte Treffer. Zahlen stehen in den Configs der Modi (REALMEN, KLINGE).

import { state, player } from './state';
import { SPELL_AOE_HEIGHT } from './config';
import { groundAt, resolve, STEP } from './collision';

export const forward = () => ({ x: Math.sin(player.facing), z: Math.cos(player.facing) });

// Mobs auf der Strecke a → b, halbe Breite w/2, gleiche Höhenregel wie Flächen-Spells
export function mobsOnLine(a, b, width) {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz || 1, y = groundAt(b.x, b.z, player.pos.y);
  return state.mobs.filter(m => {
    if (m.dead || Math.abs(m.pos.y - y) >= SPELL_AOE_HEIGHT) return false;
    const t = Math.max(0, Math.min(1, ((m.pos.x - a.x) * dx + (m.pos.z - a.z) * dz) / len2));
    return Math.hypot(m.pos.x - a.x - dx * t, m.pos.z - a.z - dz * t) <= width / 2;
  });
}

// Schritt nach vorn mit Wänden und Stufen wie beim Laufen. Gibt false, wenn etwas im Weg steht.
function stepForward(step) {
  const pos = player.pos, f = forward(), x = pos.x + f.x * step, z = pos.z + f.z * step, y0 = pos.y;
  pos.x = x; pos.z = z;
  resolve(pos, 0.45);
  const g = groundAt(pos.x, pos.z, y0);
  if (Math.abs(g - y0) > STEP) { pos.x -= f.x * step; pos.z -= f.z * step; return false; }
  pos.y = g;
  return Math.hypot(pos.x - x, pos.z - z) < step * 0.5;
}

// Bewegungsfenster eines Moves (Anteile der Dauer): bewegt den Spieler gleichmäßig um yd
export function moveInWindow(win, startAt, ms, dt) {
  if (!win) return;
  const t0 = (state.now - dt - startAt) / ms, t1 = (state.now - startAt) / ms;
  const a = Math.max(win.from, t0), b = Math.min(win.to, t1);
  if (b > a) stepForward(win.yd * (b - a) / (win.to - win.from));
}
export const inWindow = (win, startAt, ms) => !!win && (state.now - startAt) / ms >= win[0] && (state.now - startAt) / ms <= win[1];

// Verzögerte Treffer (Rückweg der Axt, Nachbeben)
let later = [];
export function after(ms, fn) { later.push({ at: state.now + ms, fn }); }
export function clearMelee() { later = []; }
export function updateMelee() {
  const due = later.filter(l => l.at <= state.now);
  later = later.filter(l => l.at > state.now);
  for (const l of due) l.fn();
}
