import { pick } from '../util';
import { player } from '../state';
import { mobsInRadius, startChannel, hasRune } from './core';
import { nearestTarget } from './target';
import { boltFx, SHADOW } from './fx';

const MORE = 2, WALK_DMG = 0.5;   // PH

export const barrage = {
  name: 'Arkanes Sperrfeuer', desc: 'Kanal 4 s: Pro Sekunde 5 Geschosse auf Gegner in 25 yd.', ranks: ['dmg', 'mana'], tags: ['Arkan', 'Geschoss', 'Kanal'], cls: 'arcane',
  mana: 200, cd: 8000, channel: 4000, tickDmg: 30, missiles: 5, range: 25,   // PH
  runes: [
    { id: 'more', name: 'Dichtes Feuer', desc: '+2 Geschosse pro Sekunde.' },
    { id: 'walk', name: 'Laufendes Feuer', desc: 'Laufen erlaubt, halber Schaden.' },
    { id: 'quick', name: 'Schnelles Laden', desc: 'Halbe CD.', cdMul: 0.5 },
  ],
  canCast: () => nearestTarget(barrage.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const ch = startChannel(c, player.pos, barrage.channel);
    ch.mobile = hasRune('barrage', 'walk');
  },
  tick(ch) {
    const near = mobsInRadius(player.pos, barrage.range, Infinity), n = barrage.missiles + (hasRune('barrage', 'more') ? MORE : 0);
    for (let i = 0; i < n && near.length; i++) {
      const m = pick(near);
      boltFx({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z }, m.pos, SHADOW, 140);
      ch.c.hitProjectile(m, barrage.tickDmg * (ch.mobile ? WALK_DMG : 1));
    }
  },
};
