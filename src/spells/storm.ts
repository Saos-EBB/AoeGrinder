import { pick } from '../util';
import { player } from '../state';
import { mobsInRadius, addField, hasRune } from './core';
import { stormField, stormHit } from '../vfx/boltLook';
import { groundAt } from '../collision';
import { mods } from '../config';

const FOLLOW_SPEED = 4, BIG = 12;   // PH

export const storm = {
  name: 'Gewitter', desc: 'Bodenziel: Gewitter 8 s, alle 0,5 s ein Blitz auf einen zufälligen Gegner darin.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Fläche'], cls: 'lightning',
  mana: 300, charge: 35, cd: 12000, dur: 8000, tickMs: 500, dmg: 60, radius: 8, range: 30, ground: true,   // PH
  runes: [
    { id: 'double', name: 'Doppelblitz', desc: '2 Blitze pro Takt.' },
    { id: 'follow', name: 'Wanderndes Gewitter', desc: 'Folgt dir.' },
    { id: 'big', name: 'Großes Gewitter', desc: 'Radius 12 yd.', radius: 12 },
    { id: 'hail', name: 'Blitzhagel', desc: '3 Blitze pro Takt.' },
  ],
  effect(c, point) {
    const radius = c.radius(hasRune('storm', 'big') ? BIG : storm.radius);
    addField(c, { pos: point, radius, dur: storm.dur, tickMs: storm.tickMs, visual: stormField(),
      onUpdate(f, dt) {
        if (!hasRune('storm', 'follow')) return;
        const dx = player.pos.x - f.pos.x, dz = player.pos.z - f.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { const step = Math.min(d, FOLLOW_SPEED * dt / 1000); f.pos.x += dx / d * step; f.pos.z += dz / d * step; }
      },
      onTick(f) {
        const list = mobsInRadius(f.pos, f.radius);
        const n = (hasRune('storm', 'hail') ? 3 : hasRune('storm', 'double') ? 2 : 1) + mods.stormBolts;
        for (let i = 0; i < n && list.length; i++) {
          const m = pick(list);
          stormHit(m.pos, groundAt(f.pos.x, f.pos.z, f.pos.y + 1) + 9.5);
          c.hit(m, storm.dmg);
        }
      },
    });
  },
};
