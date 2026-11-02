import { rand } from '../util';
import { player } from '../state';
import { mobsInRadius, hasRune, addField } from './core';
import { nearestTarget } from './target';
import { burstFx, boltFx, fieldDecal, areaParticles, FIRE, EMBER } from './fx';
import { burnTex } from '../fx/spellFx';

const SPLASH_MUL = 0.5, BIG = 1.75, SWIFT_DMG = 0.6, BURN = { dmg: 16, ms: 4000 };   // PH

export const fireball = {
  name: 'Feuerball', desc: '1,5 s Zauber aufs nächste Ziel, explodiert mit 50 % Schaden drumherum.', ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Geschoss'], cls: 'fire',
  mana: 110, cd: 0, castTime: 1500, min: 85, max: 100, radius: 4, range: 30,   // PH
  runes: [
    { id: 'big', name: 'Große Explosion', desc: '+75 % Radius.' },
    { id: 'burn', name: 'Entzünden', desc: 'Hinterlässt 4 s Brandfläche.' },
    { id: 'swift', name: 'Schnellwurf', desc: 'Sofort, −40 % Schaden.' },
  ],
  instantCast: () => hasRune('fireball', 'swift'),
  canCast: () => nearestTarget(fireball.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const target = nearestTarget(fireball.range);
    if (!target) return;
    const k = hasRune('fireball', 'swift') ? SWIFT_DMG : 1, r = c.radius(fireball.radius) * (hasRune('fireball', 'big') ? BIG : 1);
    const at = target.pos.clone();
    boltFx({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z }, at, FIRE, 160);
    c.hitProjectile(target, rand(fireball.min, fireball.max) * k);
    for (const m of mobsInRadius(at, r)) if (m !== target) c.hit(m, rand(fireball.min, fireball.max) * k * SPLASH_MUL);
    burstFx(at, r, [FIRE, EMBER], 0xff9a40);
    if (hasRune('fireball', 'burn')) addField(c, { pos: at, radius: r, dur: BURN.ms, visual: fieldDecal(burnTex, EMBER, 0.3, 0.05),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, BURN.dmg); },
      onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 30, dt, [FIRE, EMBER], { up: 4, size: 0.35 }),
    });
  },
};
