import { player } from '../state';
import { mobsInRadius, addField, hasRune } from './core';
import { boltFx, orbVisual, BOLT } from './fx';
import { mods } from '../config';

const BIG = 1.4, SLOW = 0.5, TWIN_ANGLE = 0.5;   // PH

function launch(c, angle, k) {
  const speed = ball.speed * (hasRune('ball', 'slow') ? SLOW : 1), dir = { x: Math.sin(angle), z: Math.cos(angle) };
  const radius = c.radius(ball.radius) * (hasRune('ball', 'big') ? BIG : 1);
  const pos = player.pos.clone();
  addField(c, { pos, radius, dur: ball.dist / speed * 1000, tickMs: ball.tickMs / (hasRune('ball', 'fast') ? 2 : 1) / (1 + mods.ballZaps), visual: orbVisual(0x9fc8ff, 2.2 * k),
    onUpdate(f, dt) { f.pos.x += dir.x * speed * dt / 1000; f.pos.z += dir.z * speed * dt / 1000; },
    onTick(f) { for (const m of mobsInRadius(f.pos, f.radius)) { boltFx({ x: f.pos.x, y: f.pos.y + 0.4, z: f.pos.z }, m.pos, BOLT, 120); c.hit(m, ball.zap * k); } },
  });
}

export const ball = {
  name: 'Kugelblitz', desc: 'Langsame Kugel 20 yd nach vorn, zappt alle 0,5 s alles in 5 yd.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Geschoss', 'Fläche'], cls: 'lightning',
  mana: 220, charge: 25, cd: 6000, zap: 11, radius: 5, dist: 20, speed: 5, tickMs: 500,   // PH
  runes: [
    { id: 'big', name: 'Großkugel', desc: '+40 % Radius.' },
    { id: 'slow', name: 'Träge Kugel', desc: 'Halbes Tempo, zappt doppelt so lange.' },
    { id: 'twin', name: 'Zwillingskugel', desc: '2 Kugeln im Fächer mit je 70 % Schaden.' },
    { id: 'fast', name: 'Schnellzapper', desc: 'Zappt alle 0,25 s.' },
  ],
  effect(c) {
    if (!hasRune('ball', 'twin')) return launch(c, player.facing, 1);
    for (const s of [-1, 1]) launch(c, player.facing + s * TWIN_ANGLE, 0.7);
  },
};
