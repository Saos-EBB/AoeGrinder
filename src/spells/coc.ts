import { rand } from '../util';
import { coneOfColdFx } from '../fx/spellFx';
import { player } from '../state';
import { mobsInRadius, applySlow } from './core';

export const coc = {
  name: 'Cone of Cold', cls: 'frost', desc: 'Kegel vor dir, verlangsamt um 50 %.', ranks: ['dmg','mana','radius'], tags: ['Frost', 'Fläche'],
  mana: 210, cd: 10000, min: 98, max: 108, range: 10, angle: Math.PI / 3, slow: 0.5, slowDur: 8000,   // Rang 1 Wowhead, Reichweite PH
  effect(c) {
    const range = c.radius(coc.range);
    for (const m of mobsInRadius(player.pos, range)) {
      const angleToMob = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      const diff = Math.abs(Math.atan2(Math.sin(angleToMob - player.facing), Math.cos(angleToMob - player.facing)));
      if (diff > coc.angle / 2) continue;
      if (c.hit(m, rand(coc.min, coc.max)) && !m.dead) applySlow(m, coc.slow, coc.slowDur);
    }
    coneOfColdFx(range, coc.angle);
  },
};
