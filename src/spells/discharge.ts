// Entladung: Nova, verbraucht die ganze Ladung. Außerhalb von Blitz only zählt eine feste Ladung, dafür kostet sie Mana.
import { player } from '../state';
import { BATTERY } from '../config';
import { applyRoot } from '../mobs';
import { batteryMode, batteryMax } from '../battery';
import { shakeCamera } from '../camera';
import { mobsInRadius, hasRune, schedule } from './core';
import { boltFx, BOLT } from './fx';
import { dischargeLook } from '../vfx/boltLook';

const D = { overMul: 1.5, perCharge: 1.5, after: { ms: 500, k: 0.5 }, manaLoad: 50, minCharge: 10, keep: 0.3, wide: 12, stun: 1000 };   // PH: Schaden pro Ladung, Ladung ohne Batterie, Rest-Rune behält 30 %

export const discharge = {
  name: 'Entladung', desc: 'Nova 8 yd, verbraucht die ganze Ladung: Schaden = Ladung × 1,5, überladen noch einmal ×1,5.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Nova'], cls: 'lightning',
  mana: 200, charge: 0, cd: 4000, radius: 8, showDmg: D.perCharge * BATTERY.max,   // PH
  runes: [
    { id: 'keep', name: 'Restladung', desc: 'Behält 30 % der Ladung.' },
    { id: 'wide', name: 'Weite Entladung', desc: 'Radius 12 yd.' },
    { id: 'shock', name: 'Schockwelle', desc: 'Betäubt 1 s.' },
    { id: 'after', name: 'Nachentladung', desc: 'Zweite Nova nach 0,5 s mit 50 %.' },
  ],
  canCast: () => batteryMode() && player.mana < D.minCharge && !player.overcharged ? 'Zu wenig Ladung' : null,
  effect(c) {
    // Überladen leert die Batterie schon vor der Wirkung (release), dann zählt sie als voll
    const load = !batteryMode() ? D.manaLoad : c.over ? batteryMax() : player.mana;
    const over = c.over ? D.overMul : 1;   // v31: überladen ×1,5 obendrauf
    if (batteryMode()) player.mana = hasRune('discharge', 'keep') ? load * D.keep : 0;
    const r = c.radius(hasRune('discharge', 'wide') ? D.wide : discharge.radius);
    const nova = k => {
      for (const m of mobsInRadius(player.pos, r)) {
        boltFx(player.pos, m.pos, BOLT, 160);
        if (c.hit(m, load * D.perCharge * k * over) && !m.dead && hasRune('discharge', 'shock')) applyRoot(m, D.stun);
      }
      dischargeLook(r);
    };
    nova(1);
    if (hasRune('discharge', 'after')) schedule(D.after.ms, () => nova(D.after.k));
    shakeCamera(Math.min(0.5, load / 200));
  },
};
