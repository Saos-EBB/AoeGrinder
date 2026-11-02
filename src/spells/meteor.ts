import { rand } from '../util';
import { burnTex, ringFx } from '../fx/spellFx';
import { shakeCamera } from '../camera';
import { knockbackMob } from '../mobs';
import { mobsInRadius, addField, hasRune, schedule } from './core';
import { burstFx, fieldDecal, areaParticles, FIRE, EMBER } from './fx';

const SWARM = { n: 3, offset: 7, k: 0.5, gap: 300 }, LONG_BURN = 2, KNOCK = 8;   // PH

export const meteor = {
  name: 'Meteor', desc: 'Bodenziel: Schlägt nach 1,5 s ein und lässt eine Brandfläche für 6 s zurück.', ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Fläche'], cls: 'fire',
  mana: 320, cd: 20000, min: 180, max: 210, radius: 9, range: 30, delay: 1500, burn: 16, burnDur: 6000, ground: true,   // PH
  runes: [
    { id: 'swarm', name: 'Meteorschauer', desc: '3 kleine Meteore mit halbem Schaden und Radius.' },
    { id: 'crater', name: 'Glutkrater', desc: 'Brandfläche hält doppelt so lang.' },
    { id: 'impact', name: 'Einschlag', desc: 'Schleudert Gegner weg.' },
  ],
  effect(c, point) {
    const strike = (pos, k, delay) => {
      const r = c.radius(meteor.radius) * k;
      ringFx(pos, r, EMBER, delay);
      schedule(delay, () => {
        for (const m of mobsInRadius(pos, r)) if (c.hit(m, rand(meteor.min, meteor.max) * k) && !m.dead && hasRune('meteor', 'impact')) knockbackMob(m, pos, KNOCK);
        burstFx(pos, r, [FIRE, EMBER], 0xff7a30);
        shakeCamera(0.3);
        addField(c, { pos, radius: r, dur: meteor.burnDur * (hasRune('meteor', 'crater') ? LONG_BURN : 1), visual: fieldDecal(burnTex, EMBER, 0.3, 0.05),
          onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, meteor.burn * k); },
          onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 40 * k, dt, [FIRE, EMBER], { up: 4, size: 0.4 }),
        });
      });
    };
    if (!hasRune('meteor', 'swarm')) return strike(point, 1, meteor.delay);
    for (let i = 0; i < SWARM.n; i++) {
      const a = i / SWARM.n * Math.PI * 2;
      strike(point.clone().setX(point.x + Math.cos(a) * SWARM.offset).setZ(point.z + Math.sin(a) * SWARM.offset), SWARM.k, meteor.delay + i * SWARM.gap);
    }
  },
};
