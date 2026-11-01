import { player } from '../state';
import { mods } from '../config';
import { blizRadius } from '../formulas';
import { blizStart, blizMove, blizStop } from '../fx/spellFx';
import { applyRoot } from '../mobs';
import { mobsInRadius, applySlow, startChannel, hasRune } from './core';

const WANDER_SPEED = 3;     // PH: yd/s
const LAST_TICK_ROOT = 4000;   // PH

export const bliz = {
  name: 'Blizzard', desc: 'Kanal aufs Bodenziel, 8 Ticks.', ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Fläche', 'Kanal'], cls: 'frost',
  mana: 320, cd: 0, tickDmg: 26, channel: 8000, range: 30, radius: 8, ground: true,   // Rang 1 Wowhead, Radius PH
  runes: [
    { id: 'walk', name: 'Wandelnder Sturm', desc: 'Laufen erlaubt, halber Schaden.' },
    { id: 'wander', name: 'Treibender Sturm', desc: 'Wandert zum Spieler.' },
    { id: 'lastfreeze', name: 'Letzter Frost', desc: 'Letzter Tick friert ein.' },
  ],
  effect(c, point) {
    const ch = startChannel(c, point.clone(), bliz.channel);
    ch.mobile = hasRune('bliz', 'walk');
    blizStart(point, blizRadius());
  },
  tick(ch) {
    const dmg = bliz.tickDmg * (ch.mobile ? 0.5 : 1), last = ch.nextTick > ch.end;
    for (const m of mobsInRadius(ch.point, blizRadius())) {
      if (!ch.c.hit(m, dmg) || m.dead) continue;
      if (mods.blizSlow > 0) applySlow(m, mods.blizSlow, 1500);
      if (last && hasRune('bliz', 'lastfreeze')) applyRoot(m, LAST_TICK_ROOT);
    }
  },
  channelUpdate(ch, dt) {
    if (!hasRune('bliz', 'wander')) return;
    const dx = player.pos.x - ch.point.x, dz = player.pos.z - ch.point.z, d = Math.hypot(dx, dz);
    if (d < 0.1) return;
    const step = Math.min(d, WANDER_SPEED * dt / 1000);
    ch.point.x += dx / d * step;
    ch.point.z += dz / d * step;
    blizMove(ch.point, blizRadius());
  },
  onChannelEnd() {
    blizStop();
  },
};
