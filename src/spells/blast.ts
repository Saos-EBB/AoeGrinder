import { rand, dist2d } from '../util';
import { player } from '../state';
import { particles } from '../fx/particles';
import { groundAt } from '../collision';
import { knockbackMob, pullMob } from '../mobs';
import { mobsInRadius, applySlow, addField, hasRune } from './core';
import { burstFx, FIRE, EMBER } from './fx';

const RING = { dur: 5000, width: 1.5, dmg: 14 };   // PH

export const blast = {
  name: 'Druckwelle', desc: 'Nova mit Rückschlag und 50 % Slow.', ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Nova'], cls: 'fire',
  mana: 150, cd: 12000, min: 40, max: 48, radius: 10, knock: 8, slow: 0.5, slowDur: 6000,   // PH
  runes: [
    { id: 'suck', name: 'Implosion', desc: 'Sog statt Rückschlag.' },
    { id: 'ring', name: 'Feuerring', desc: 'Hinterlässt einen Feuerring.' },
    { id: 'quick', name: 'Kurzer Stoß', desc: 'Halbe CD, kein Rückschlag.', cdMul: 0.5 },
  ],
  effect(c) {
    const r = c.radius(blast.radius), center = player.pos.clone();
    for (const m of mobsInRadius(center, r)) {
      if (!c.hit(m, rand(blast.min, blast.max)) || m.dead) continue;
      applySlow(m, blast.slow, blast.slowDur);
      if (hasRune('blast', 'suck')) pullMob(m, center, blast.knock);
      else if (!hasRune('blast', 'quick')) knockbackMob(m, center, blast.knock);
    }
    burstFx(center, r, [FIRE, EMBER], 0xffa050);
    if (!hasRune('blast', 'ring')) return;
    addField(c, { pos: center, radius: r, dur: RING.dur,
      onTick: f => {
        for (const m of mobsInRadius(f.pos, f.radius + RING.width)) if (dist2d(m.pos, f.pos) >= f.radius - RING.width) c.hit(m, RING.dmg);
      },
      onUpdate: f => {
        for (let i = 0; i < 6; i++) {
          const a = rand(0, Math.PI * 2), x = f.pos.x + Math.cos(a) * f.radius, z = f.pos.z + Math.sin(a) * f.radius;
          particles.spawn({ x, y: groundAt(x, z, f.pos.y) + 0.2, z, vy: rand(2, 5), life: rand(0.4, 0.8), color: i % 2 ? FIRE : EMBER, size: rand(0.25, 0.5) });
        }
      },
    });
  },
};
