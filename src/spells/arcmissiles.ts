import { dist2d } from '../util';
import { state, player } from '../state';
import { mobsInRadius, startChannel, hasRune } from './core';
import { nearestTarget } from './target';
import { boltFx, burstFx, SHADOW, VOID } from './fx';

const SPLIT = { range: 5, mul: 0.5 }, FAST_MS = 2000, CHARGE_RADIUS = 4;   // PH

// Ein Geschoss aufs Ziel; ist es tot, nimmt der Kanal das nächste
function fire(ch) {
  if (!ch.target || ch.target.dead) ch.target = nearestTarget(arcmissiles.range);
  const m = ch.target;
  if (!m) return;
  ch.shots++;
  boltFx({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z }, m.pos, SHADOW, 140);
  ch.c.hitProjectile(m, arcmissiles.dmg);
  if (hasRune('arcmissiles', 'split')) {
    const next = mobsInRadius(m.pos, SPLIT.range, Infinity).filter(o => o !== m).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos))[0];
    if (next) { boltFx(m.pos, next.pos, SHADOW, 120); ch.c.hit(next, arcmissiles.dmg * SPLIT.mul); }
  }
  if (ch.shots === arcmissiles.missiles && hasRune('arcmissiles', 'charge')) {
    const r = ch.c.radius(CHARGE_RADIUS);
    for (const o of mobsInRadius(m.pos, r)) ch.c.hit(o, arcmissiles.dmg);
    burstFx(m.pos, r, [SHADOW, VOID], 0xb070ff);
  }
}

export const arcmissiles = {
  name: 'Arkane Geschosse', desc: 'Kanal 3 s aufs nächste Ziel, 5 Geschosse.', ranks: ['dmg', 'mana'], tags: ['Arkan', 'Geschoss', 'Kanal'], cls: 'arcane',
  mana: 140, cd: 0, channel: 3000, dmg: 48, missiles: 5, range: 30,   // PH
  runes: [
    { id: 'split', name: 'Splitter', desc: 'Jeder Treffer springt auf 1 Mob in 5 yd (50 %).' },
    { id: 'fast', name: 'Schnellfeuer', desc: 'Kanal 2 s, gleicher Schaden.' },
    { id: 'charge', name: 'Arkane Ladung', desc: 'Das letzte Geschoss explodiert in 4 yd.' },
  ],
  canCast: () => nearestTarget(arcmissiles.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const ch = startChannel(c, player.pos, hasRune('arcmissiles', 'fast') ? FAST_MS : arcmissiles.channel);
    ch.target = nearestTarget(arcmissiles.range);
    ch.shots = 0;
    ch.nextTick = Infinity;   // eigener Takt statt der Sekunden-Ticks
    ch.every = (ch.end - ch.start) / arcmissiles.missiles;
    ch.nextShot = state.now;
  },
  tick() {},
  // Geschosse gleichmäßig über den Kanal, das erste sofort
  channelUpdate(ch) {
    while (ch.nextShot <= state.now && ch.nextShot < ch.end) { fire(ch); ch.nextShot += ch.every; }
  },
};
