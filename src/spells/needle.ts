// Gletschernadel: verbraucht alle Eissplitter (figures.ts), durchbohrendes Geschoss nach vorn.

import { player } from '../state';
import { UNIT } from '../config';
import { mobsOnLine, forward } from '../melee';
import { takeShards } from '../figures';
import { combatText } from '../ui/hud';
import { needleLook } from '../vfx/frostLook';
import { t } from '../i18n';

// PH: 25 yd, 2 yd breit, 2 Einheiten +40 % pro Splitter
const N = { len: 25, width: 2, dmg: 2, perShard: 0.4 };

export const needle = {
  name: t('spell.needle.name'), desc: t('spell.needle.desc'), ranks: ['dmg', 'mana'], tags: ['Frost', 'Geschoss'], cls: 'frost',
  mana: 100, cd: 6000, showDmg: N.dmg * UNIT,   // PH
  effect(c) {
    const n = takeShards(), f = forward(), from = player.pos, to = { x: from.x + f.x * N.len, y: from.y, z: from.z + f.z * N.len };
    for (const m of mobsOnLine(from, to, N.width)) c.hitProjectile(m, N.dmg * UNIT * (1 + N.perShard * n));
    needleLook(to as any, n);
    if (n) combatText(player.pos, t('msg.shards', { n }), 'info', 2.4);
  },
};
