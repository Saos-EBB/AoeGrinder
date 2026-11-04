import { pick } from '../util';
import { player } from '../state';
import { mobsInRadius, addField, hasRune } from './core';
import { boltFx, fieldDecal, areaParticles, BOLT } from './fx';
import { galeTex } from '../fx/spellFx';

const FOLLOW_SPEED = 4, BIG = 12;   // PH

export const storm = {
  name: 'Gewitter', desc: 'Bodenziel: Gewitter 8 s, alle 0,5 s ein Blitz auf einen zufälligen Gegner darin.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Fläche'], cls: 'lightning',
  mana: 300, charge: 35, cd: 12000, dur: 8000, tickMs: 500, dmg: 60, radius: 8, range: 30, ground: true,   // PH
  runes: [
    { id: 'double', name: 'Doppelblitz', desc: '2 Blitze pro Takt.' },
    { id: 'follow', name: 'Wanderndes Gewitter', desc: 'Folgt dir.' },
    { id: 'big', name: 'Großes Gewitter', desc: 'Radius 12 yd.', radius: 12 },
  ],
  effect(c, point) {
    const radius = c.radius(hasRune('storm', 'big') ? BIG : storm.radius);
    addField(c, { pos: point, radius, dur: storm.dur, tickMs: storm.tickMs, visual: fieldDecal(galeTex, BOLT, 0.25, 1.2),
      onUpdate(f, dt) {
        areaParticles(f.pos, f.radius, 30, dt, [BOLT, [2.2, 2.4, 2.8]], { up: 6, size: 0.25, life: 0.5 });
        if (!hasRune('storm', 'follow')) return;
        const dx = player.pos.x - f.pos.x, dz = player.pos.z - f.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { const step = Math.min(d, FOLLOW_SPEED * dt / 1000); f.pos.x += dx / d * step; f.pos.z += dz / d * step; }
      },
      onTick(f) {
        const list = mobsInRadius(f.pos, f.radius);
        for (let i = 0; i < (hasRune('storm', 'double') ? 2 : 1) && list.length; i++) {
          const m = pick(list);
          boltFx({ x: m.pos.x, y: m.pos.y + 14, z: m.pos.z }, m.pos, BOLT, 220);
          c.hit(m, storm.dmg);
        }
      },
    });
  },
};
