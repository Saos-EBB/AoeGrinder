// Entladung: Nova, verbraucht die ganze Ladung. Außerhalb von Blitz only zählt eine feste Ladung, dafür kostet sie Mana.
import { player } from '../state';
import { BATTERY } from '../config';
import { applyRoot } from '../mobs';
import { batteryMode } from '../battery';
import { shakeCamera } from '../camera';
import { mobsInRadius, hasRune } from './core';
import { boltFx, burstFx, BOLT } from './fx';

const D = { perCharge: 3, manaLoad: 50, minCharge: 10, keep: 0.3, wide: 12, stun: 1000 };   // PH: Schaden pro Ladung, Ladung ohne Batterie, Rest-Rune behält 30 %

export const discharge = {
  name: 'Entladung', desc: 'Nova 8 yd, verbraucht die ganze Ladung: Schaden = Ladung × 3.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Nova'], cls: 'lightning',
  mana: 200, charge: 0, cd: 4000, radius: 8, showDmg: D.perCharge * BATTERY.max,   // PH
  runes: [
    { id: 'keep', name: 'Restladung', desc: 'Behält 30 % der Ladung.' },
    { id: 'wide', name: 'Weite Entladung', desc: 'Radius 12 yd.' },
    { id: 'shock', name: 'Schockwelle', desc: 'Betäubt 1 s.' },
  ],
  canCast: () => batteryMode() && player.mana < D.minCharge && !player.overcharged ? 'Zu wenig Ladung' : null,
  effect(c) {
    // Überladen leert die Batterie schon vor der Wirkung (release), dann zählt sie als voll
    const load = !batteryMode() ? D.manaLoad : c.over ? BATTERY.max : player.mana;
    if (batteryMode()) player.mana = hasRune('discharge', 'keep') ? load * D.keep : 0;
    const r = c.radius(hasRune('discharge', 'wide') ? D.wide : discharge.radius);
    for (const m of mobsInRadius(player.pos, r)) {
      boltFx(player.pos, m.pos, BOLT, 160);
      if (c.hit(m, load * D.perCharge) && !m.dead && hasRune('discharge', 'shock')) applyRoot(m, D.stun);
    }
    burstFx(player.pos, r, [BOLT, [2.2, 2.4, 2.8]], 0xbfd8ff);
    shakeCamera(Math.min(0.5, load / 200));
  },
};
