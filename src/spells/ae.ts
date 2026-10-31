import { rand } from '../util';
import { player } from '../state';
import { arcaneExplosionFx } from '../fx/spellFx';
import { pullMob } from '../mobs';
import { mobsInRadius, hasRune } from './core';

export const ae = {
  name: 'Arcane Explosion', desc: 'Arkane Explosion um dich.', ranks: ['dmg', 'mana', 'radius'], tags: ['Arkan', 'Nova'], cls: 'arcane',
  mana: 75, cd: 0, min: 34, max: 38, radius: 10,   // Rang 1 Wowhead, Radius PH
  runes: [
    { id: 'pull', name: 'Arkaner Sog', desc: 'Zieht Gegner 3 yd an.' },
    { id: 'free5', name: 'Überladung', desc: 'Gratis bei 5+ Treffern.' },
    { id: 'third', name: 'Rhythmus', desc: 'Jede 3. gratis.' },
  ],
  effect(c) {
    const r = c.radius(ae.radius);
    let hits = 0;
    for (const m of mobsInRadius(player.pos, r)) {
      if (c.hit(m, rand(ae.min, ae.max))) hits++;
      if (hasRune('ae', 'pull') && !m.dead) pullMob(m, player.pos, 3);
    }
    arcaneExplosionFx(player.pos, r);
    const n = player.spellCounts.ae = (player.spellCounts.ae || 0) + 1;
    if ((hasRune('ae', 'free5') && hits >= 5) || (hasRune('ae', 'third') && n % 3 === 0)) player.mana += c.cost ?? 0;
  },
};
