import { rand } from '../util';
import { novaFx } from '../fx/spellFx';
import { applyRoot } from '../mobs';
import { player } from '../state';
import { mobsInRadius } from './core';

export const nova = {
  name: 'Frost Nova', cls: 'frost', desc: 'Friert Gegner um dich bis zu 8 s ein.', ranks: ['dmg','mana','radius'], tags: ['Frost', 'Nova'],
  mana: 55, cd: 25000, min: 19, max: 21, radius: 10, root: 8000,   // Rang 1 Wowhead, Radius PH
  effect(c) {
    const r = c.radius(nova.radius);
    for (const m of mobsInRadius(player.pos, r)) {
      if (c.hit(m, rand(nova.min, nova.max)) && !m.dead) applyRoot(m, nova.root);
    }
    novaFx(player.pos, r);
  },
};
