import { mods } from '../config';
import { blizRadius } from '../formulas';
import { drape } from '../world';
import { blizFx, resetShard } from '../fx/spellFx';
import { mobsInRadius, applySlow, startChannel } from './core';

export const bliz = {
  name: 'Blizzard', cls: 'frost', tags: ['Frost', 'Fläche', 'Kanal'],
  mana: 320, cd: 0, tickDmg: 26, channel: 8000, range: 30, radius: 8, ground: true,   // Rang 1 Wowhead, Radius PH
  effect(c, point) {
    startChannel(c, point.clone(), bliz.channel);
    blizFx.g.position.copy(point);
    drape(blizFx.disc, point, blizRadius());
    for (const sh of blizFx.shards) resetShard(sh, true);
    blizFx.g.visible = blizFx.disc.visible = true;
    blizFx.cloud.scale.setScalar(blizRadius() / 8 * 0.2);
  },
  tick(ch) {
    for (const m of mobsInRadius(ch.point, blizRadius())) {
      if (ch.c.hit(m, bliz.tickDmg) && !m.dead && mods.blizSlow > 0) applySlow(m, mods.blizSlow, 1500);
    }
  },
  onChannelEnd() {
    blizFx.g.visible = blizFx.disc.visible = false;
  },
};
