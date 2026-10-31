import { rand } from '../util';
import { arcaneExplosionFx } from '../fx/spellFx';
import { player } from '../state';
import { mobsInRadius } from './core';

export const ae = {
  name: 'Arcane Explosion', cls: 'arcane', tags: ['Arkan', 'Nova'],
  mana: 75, cd: 0, min: 34, max: 38, radius: 10,   // Rang 1 Wowhead, Radius PH
  effect(c) {
    const r = c.radius(ae.radius);
    for (const m of mobsInRadius(player.pos, r)) c.hit(m, rand(ae.min, ae.max));
    arcaneExplosionFx(player.pos, r);
  },
};
