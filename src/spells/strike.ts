import { rand } from '../util';
import { applyRoot } from '../mobs';
import { shakeCamera } from '../camera';
import { mobsInRadius, hasRune, schedule } from './core';
import { mods } from '../config';
import { boltFx, burstFx, BOLT } from './fx';

const DOUBLE = { delay: 400, k: 0.5 }, WIDE = 2, LONG_STUN = 1500, TRIPLE = { n: 3, k: 0.6, gap: 250 };   // PH

export const strike = {
  name: 'Blitzschlag', desc: 'Bodenziel: harter Schlag in 3 yd, betäubt 0,5 s.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Fläche', 'Kontrolle'], cls: 'lightning',
  mana: 160, charge: 20, cd: 2000, min: 60, max: 70,   // v29: halbiert
  radius: 3, range: 30, stun: 500, ground: true,   // PH
  runes: [
    { id: 'double', name: 'Doppelschlag', desc: 'Ein zweiter Schlag nach 0,4 s mit 50 %.' },
    { id: 'wide', name: 'Weiter Schlag', desc: 'Doppelter Radius.', radius: 6 },
    { id: 'long', name: 'Lange Betäubung', desc: 'Betäubt 1,5 s.' },
    { id: 'triple', name: 'Dreifachschlag', desc: '3 Schläge mit je 60 %.' },
  ],
  effect(c, point) {
    const r = c.radius(strike.radius) * (hasRune('strike', 'wide') ? WIDE : 1), stun = hasRune('strike', 'long') ? LONG_STUN : strike.stun;
    const hit = k => {
      boltFx({ x: point.x, y: point.y + 14, z: point.z }, point, BOLT, 240);
      for (const m of mobsInRadius(point, r)) if (c.hit(m, rand(strike.min, strike.max) * k) && !m.dead) applyRoot(m, stun);
      burstFx(point, r, [BOLT, [2.2, 2.4, 2.8]], 0xbfd8ff);
      shakeCamera(0.15);
    };
    if (hasRune('strike', 'triple')) for (let i = 0; i < TRIPLE.n; i++) schedule(i * TRIPLE.gap, () => hit(TRIPLE.k));
    else hit(1);
    if (hasRune('strike', 'double')) schedule(DOUBLE.delay, () => hit(DOUBLE.k));
    for (let i = 1; i <= mods.strikeExtra; i++) schedule(i * DOUBLE.delay + 150, () => hit(DOUBLE.k));   // Talent Donnerhall
  },
};
