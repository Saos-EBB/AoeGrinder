import { rand, dist2d } from '../util';
import { player } from '../state';
import { mods } from '../config';
import { mobsInRadius, hasRune, bounceShot } from './core';
import { nearestTarget } from './target';
import { fireballLook } from '../vfx/fireLook';
import { t } from '../i18n';

const SPLASH_MUL = 0.5, BIG = 1.75, SWIFT_DMG = 0.6, SPLIT = { n: 2, k: 0.7 };   // PH: Splitterball +2 Projektile mit je 70 %

export const fireball = {
  name: t('spell.fireball.name'), desc: t('spell.fireball.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Geschoss'], cls: 'fire',
  mana: 110, cd: 0, castTime: 350, min: 85, max: 100, radius: 4, range: 30,   // PH
  runes: [
    { id: 'big', name: t('spell.fireball.runes.big.name'), desc: t('spell.fireball.runes.big.desc') },
    { id: 'split', name: t('spell.fireball.runes.split.name'), desc: t('spell.fireball.runes.split.desc') },
    { id: 'swift', name: t('spell.fireball.runes.swift.name'), desc: t('spell.fireball.runes.swift.desc') },
  ],
  instantCast: () => hasRune('fireball', 'swift'),
  canCast: () => nearestTarget(fireball.range) ? null : t('msg.noTarget'),
  effect(c) {
    const target = nearestTarget(fireball.range);
    if (!target) return;
    const k = hasRune('fireball', 'swift') ? SWIFT_DMG : 1, r = c.radius(fireball.radius) * (hasRune('fireball', 'big') ? BIG : 1);
    // Projektile: das Hauptziel, Wahnsinn +1 pro Rang mit vollem Schaden, Splitterball +2 mit 70 %. Weitere gehen auf die nächsten Ziele, gibt es zu wenige, wieder aufs Hauptziel
    const shots = [1, ...Array(mods.fbExtra).fill(1), ...(hasRune('fireball', 'split') ? Array(SPLIT.n).fill(SPLIT.k) : [])];
    const others = mobsInRadius(player.pos, fireball.range, Infinity).filter(m => m !== target).sort((a, b) => dist2d(a.pos, player.pos) - dist2d(b.pos, player.pos));
    shots.forEach((mul, i) => {
      const t = bounceShot(i === 0 ? target : others[i - 1] ?? target);   // Kristallhöhlen
      if (!t) return;
      const at = t.pos.clone();
      c.hitProjectile(t, rand(fireball.min, fireball.max) * k * mul);
      for (const m of mobsInRadius(at, r)) if (m !== t) c.hit(m, rand(fireball.min, fireball.max) * k * mul * SPLASH_MUL);
      fireballLook(at, r, mul < 1 ? .7 : 1);
    });
    // Dauerfeuer: jeder 3. oder 4. Feuerball gibt sein Mana zurück
    const n = player.spellCounts.fireball = (player.spellCounts.fireball || 0) + 1;
    if (mods.fbFreeEvery && n % mods.fbFreeEvery === 0) player.mana += c.cost ?? 0;
  },
};
