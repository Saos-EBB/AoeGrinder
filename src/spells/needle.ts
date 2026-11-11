// Gletschernadel: verbraucht alle Eissplitter (figures.ts), durchbohrendes Geschoss nach vorn.

import { player } from '../state';
import { UNIT } from '../config';
import { mobsOnLine, forward } from '../melee';
import { takeShards } from '../figures';
import { combatText } from '../feedback';
import { needleLook } from '../vfx/frostLook';
import { t } from '../i18n';
import { state } from '../state';
import { mods } from '../config';
import { makeCtx } from './core';
import { nova } from './nova';
import { SHARD_NEEDLE } from '../gear';

// PH: 25 yd, 2 yd breit, 2 Einheiten +40 % pro Splitter
const N = { len: 25, width: 2, dmg: 2, perShard: 0.4 };

export const needle = {
  name: t('spell.needle.name'), desc: t('spell.needle.desc'), ranks: ['dmg', 'mana'], tags: ['Frost', 'Geschoss'], cls: 'frost',
  mana: 100, cd: 6000, showDmg: N.dmg * UNIT,   // PH
  effect(c) {
    // Splitterkönig 5/5 (gear.ts): +50 % Reichweite, am Endpunkt die normale Frost Nova mit allen Nova-Karten. Durchschlagen tut die Nadel immer (mobsOnLine)
    const king = state.gearSet === 'frost14', len = N.len * (king ? SHARD_NEEDLE.len : 1);
    const n = takeShards(), f = forward(), from = player.pos, to = { x: from.x + f.x * len, y: from.y, z: from.z + f.z * len };
    for (const m of mobsOnLine(from, to, N.width)) c.hitProjectile(m, N.dmg * UNIT * (1 + (N.perShard + (mods.needleShard ?? 0)) * n));
    needleLook(to as any, n);
    if (king) { const nc = makeCtx('nova'); nc.at = player.pos.clone().set(to.x, from.y, to.z); nova.effect(nc); }
    if (n) combatText(player.pos, t('msg.shards', { n }), 'info', 2.4);
  },
};
