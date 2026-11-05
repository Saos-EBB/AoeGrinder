// Gletschernadel: verbraucht alle Eissplitter (figures.ts), durchbohrendes Geschoss nach vorn.

import { player } from '../state';
import { UNIT } from '../config';
import { mobsOnLine, forward } from '../melee';
import { takeShards } from '../figures';
import { combatText } from '../ui/hud';
import { boltFx, ICE_WHITE } from './fx';

// PH: 25 yd, 2 yd breit, 2 Einheiten +40 % pro Splitter
const N = { len: 25, width: 2, dmg: 2, perShard: 0.4 };

export const needle = {
  name: 'Gletschernadel', desc: 'Verbraucht alle Eissplitter. Geschoss 25 yd, durchbohrt, 2 Einheiten +40 % pro Splitter.', ranks: ['dmg', 'mana'], tags: ['Frost', 'Geschoss'], cls: 'frost',
  mana: 100, cd: 6000, showDmg: N.dmg * UNIT,   // PH
  effect(c) {
    const n = takeShards(), f = forward(), from = player.pos, to = { x: from.x + f.x * N.len, y: from.y, z: from.z + f.z * N.len };
    for (const m of mobsOnLine(from, to, N.width)) c.hitProjectile(m, N.dmg * UNIT * (1 + N.perShard * n));
    boltFx({ x: from.x, y: from.y + 1.2, z: from.z }, to, ICE_WHITE, 260);
    if (n) combatText(player.pos, `${n} Splitter`, 'info', 2.4);
  },
};
