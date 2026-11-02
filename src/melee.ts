// Gemeinsame Helfer der Nahkämpfer (Real Men, Ronin, Schatten): Kosten und Abklingzeit, Linie, Sprint nach vorn,
// verzögerte Treffer und Wellen. Zahlen stehen in den Configs der Modi (REALMEN, RONIN, SCHATTEN).

import { state, player } from './state';
import { rand } from './util';
import { SPELL_AOE_HEIGHT } from './config';
import { groundAt, resolve, STEP } from './collision';
import { spellCd } from './formulas';
import { showError } from './ui/hud';

export const roll = (r: number[]) => rand(r[0], r[1]);
export const forward = () => ({ x: Math.sin(player.facing), z: Math.cos(player.facing) });

// Prüft Boden, Abklingzeit und Ressource, zieht beides ab. cost 0 = nichts abziehen.
export function payMove(id, cost, what = 'Wut') {
  if (!player.grounded) { showError('Du kannst das nicht im Sprung tun'); return false; }
  if ((player.cds[id] || 0) > state.now) { showError('Fähigkeit ist noch nicht bereit'); return false; }
  if (player.mana < cost) { showError(`Nicht genug ${what}`); return false; }
  player.mana -= cost;
  player.cds[id] = state.now + spellCd(id);
  player.lastCombat = state.now;
  return true;
}

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
export function stepForward(step) {
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

// Verzögerte Treffer (Rückweg der Axt, Nachbeben) und Wellen, die geradeaus fliegen
let later = [], waves = [];
export function after(ms, fn) { later.push({ at: state.now + ms, fn }); }
export function wave(from, dir, { speed, range, width }, onMob) {
  waves.push({ x: from.x, z: from.z, dir, speed, left: range, width, seen: new Set(), onMob });
}
export function clearMelee() { later = []; waves = []; }
export function updateMelee(dt) {
  const due = later.filter(l => l.at <= state.now);
  later = later.filter(l => l.at > state.now);
  for (const l of due) l.fn();
  for (const w of waves) {
    const step = Math.min(w.left, w.speed * dt / 1000), a = { x: w.x, z: w.z };
    w.x += w.dir.x * step; w.z += w.dir.z * step; w.left -= step;
    for (const m of mobsOnLine(a, w, w.width)) if (!w.seen.has(m)) { w.seen.add(m); w.onMob(m); }
  }
  waves = waves.filter(w => w.left > 0);
}
