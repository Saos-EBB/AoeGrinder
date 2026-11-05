// Frostblitz: kurzer Zauber aufs nächste Ziel, verlangsamt.

import { dist2d } from '../util';
import { player } from '../state';
import { UNIT } from '../config';
import { mobsInRadius, applySlow, hasRune } from './core';
import { nearestTarget } from './target';
import { frostboltLook } from '../vfx/frostLook';

// PH: 1,2 Einheiten, 30 % Slow 2 s; Runen: +2 Projektile je 70 %, Explosion 4 yd mit 60 %, sofort mit −30 %
const F = { dmg: 1.2, range: 30, slow: 0.3, slowMs: 2000, split: { n: 2, k: 0.7 }, bomb: { radius: 4, k: 0.6 }, swift: 0.7 };

export const frostbolt = {
  name: 'Frostblitz', desc: '0,3 s Zauber aufs nächste Ziel, 1,2 Einheiten, 30 % langsamer für 2 s.', ranks: ['dmg', 'mana'], tags: ['Frost', 'Geschoss'], cls: 'frost',
  mana: 60, cd: 0, castTime: 300, range: F.range, showDmg: F.dmg * UNIT,   // PH
  runes: [
    { id: 'split', name: 'Splitterblitz', desc: '+2 Projektile, je 70 %.' },
    { id: 'bomb', name: 'Frostbombe', desc: 'Explosion 4 yd mit 60 %.' },
    { id: 'swift', name: 'Schnellblitz', desc: 'Sofort, −30 % Schaden.' },
  ],
  instantCast: () => hasRune('frostbolt', 'swift'),
  canCast: () => nearestTarget(F.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const target = nearestTarget(F.range);
    if (!target) return;
    const k = hasRune('frostbolt', 'swift') ? F.swift : 1;
    const others = mobsInRadius(player.pos, F.range, Infinity).filter(m => m !== target).sort((a, b) => dist2d(a.pos, player.pos) - dist2d(b.pos, player.pos));
    const shots = [{ t: target, mul: 1 }, ...(hasRune('frostbolt', 'split') ? Array.from({ length: F.split.n }, (_, i) => ({ t: others[i] ?? target, mul: F.split.k })) : [])];
    for (const { t, mul } of shots) {
      const at = t.pos.clone();
      frostboltLook(at, hasRune('frostbolt', 'bomb') ? c.radius(F.bomb.radius) : 1);
      if (c.hitProjectile(t, F.dmg * UNIT * k * mul) && !t.dead) applySlow(t, F.slow, F.slowMs);
      if (!hasRune('frostbolt', 'bomb')) continue;
      const r = c.radius(F.bomb.radius);
      for (const m of mobsInRadius(at, r)) if (m !== t) c.hit(m, F.dmg * UNIT * k * mul * F.bomb.k);
    }
  },
};
