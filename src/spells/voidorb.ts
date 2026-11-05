import { clamp, dist2d } from '../util';
import { player } from '../state';
import { pullMob } from '../mobs';
import { mobsInRadius, applySlow, addField, hasRune } from './core';
import { voidOrbField } from '../vfx/arcaneLook';
import { boom, PAL } from '../vfx/energy';

const PULL_PER_S = 4, MAX_SLOW = 0.4, FOLLOW_SPEED = 3, IMPLODE = 25, TWIN_OFFSET = 6;   // PH

function spawnOrb(c, pos, radius, k) {
  addField(c, { pos, radius, dur: voidorb.dur, void: true, tickMs: 1e9, visual: voidOrbField(k),
    onUpdate(f, dt) {
      if (hasRune('voidorb', 'follow')) {
        const dx = player.pos.x - f.pos.x, dz = player.pos.z - f.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { const step = Math.min(d, FOLLOW_SPEED * dt / 1000); f.pos.x += dx / d * step; f.pos.z += dz / d * step; }
      }
      for (const m of mobsInRadius(f.pos, f.radius)) {
        pullMob(m, f.pos, PULL_PER_S * dt / 1000);
        applySlow(m, MAX_SLOW * clamp(1 - dist2d(m.pos, f.pos) / f.radius, 0, 1), 200);
      }
    },
    // v31: kein Schaden mehr, nur Sog und Slow. Die Rune Implosion macht weiter Schaden
    onEnd(f) {
      if (!hasRune('voidorb', 'implode')) return;
      const caught = mobsInRadius(f.pos, f.radius);
      for (const m of caught) c.hit(m, IMPLODE * caught.length * k);
      boom(f.pos.clone().setY(f.pos.y + 1.6), f.radius / 2, PAL.void, .6, { ground: f.pos.y, n: 40 });
    },
  });
}

export const voidorb = {
  name: 'Leerenkugel', desc: 'Dunkle Kugel aufs Bodenziel 6 s, zieht alle in 15 yd zur Mitte, bis 40 % Slow nahe der Mitte. Kein Schaden.', ranks: ['dmg', 'mana', 'radius'], tags: ['Arkan', 'Leere', 'Fläche'], cls: 'arcane',
  mana: 350, cd: 30000, dur: 6000, pulse: 18, range: 30, radius: 15, ground: true,   // PH
  runes: [
    { id: 'follow', name: 'Leerenbegleiter', desc: 'Folgt dir.' },
    { id: 'implode', name: 'Implosion', desc: 'Implodiert am Ende, Schaden pro Gefangenem.' },
    { id: 'twins', name: 'Zwillinge', desc: '2 kleine Kugeln.' },
  ],
  effect(c, point) {
    const radius = c.radius(voidorb.radius);
    if (!hasRune('voidorb', 'twins')) return spawnOrb(c, point, radius, 1);
    for (const side of [-1, 1]) spawnOrb(c, point.clone().setX(point.x + side * TWIN_OFFSET), radius / 2, 0.5);
  },
};
