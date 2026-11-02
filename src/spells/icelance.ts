import { rand } from '../util';
import { state, player } from '../state';
import { mobsOnLine, forward } from '../melee';
import { applySlow, hasRune } from './core';
import { boltFx, ICE_WHITE } from './fx';

const CHILL = { slow: 0.4, ms: 3000 }, SWIFT_DMG = 0.75, WIDE = 2, FROZEN_MUL = 2;   // PH

export const icelance = {
  name: 'Eislanze', desc: 'Durchbohrt alles auf 20 yd vor dir, Eingefrorene nehmen doppelten Schaden.', ranks: ['dmg', 'mana'], tags: ['Frost', 'Geschoss'], cls: 'frost',
  mana: 70, cd: 4000, min: 44, max: 52, length: 20, width: 2,   // PH
  runes: [
    { id: 'wide', name: 'Breite Lanze', desc: 'Doppelte Breite.' },
    { id: 'chill', name: 'Kalte Spitze', desc: 'Getroffene sind 3 s 40 % langsamer.' },
    { id: 'swift', name: 'Schnelle Lanze', desc: 'Halbe CD, −25 % Schaden.', cdMul: 0.5 },
  ],
  effect(c) {
    const f = forward(), from = player.pos, to = { x: from.x + f.x * icelance.length, y: from.y, z: from.z + f.z * icelance.length };
    const k = hasRune('icelance', 'swift') ? SWIFT_DMG : 1;
    for (const m of mobsOnLine(from, to, icelance.width * (hasRune('icelance', 'wide') ? WIDE : 1))) {
      const landed = c.hitProjectile(m, rand(icelance.min, icelance.max) * k * (m.rootUntil > state.now ? FROZEN_MUL : 1));
      if (landed && !m.dead && hasRune('icelance', 'chill')) applySlow(m, CHILL.slow, CHILL.ms);
    }
    boltFx({ x: from.x, y: from.y + 1.2, z: from.z }, to, ICE_WHITE, 200);
  },
};
