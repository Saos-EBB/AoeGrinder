// Benzin: Kanister aufs Bodenziel, Lache verlangsamt. Ein Feuer-Treffer auf einen Mob in der Lache zündet sie (Haken onFireHit in core.ts).

import { state } from '../state';
import { UNIT } from '../config';
import { mobsInRadius, applySlow, addField } from './core';
import { canisterLook, oilField, igniteLook } from '../vfx/fireLook';
import { t } from '../i18n';
import { onFireHit } from '../hooks';

// PH: Lache 6 yd 8 s, 30 % Slow; gezündet 6 s Brand mit 1,5 Einheiten pro Sekunde
const G = { radius: 6, ms: 8000, slow: 0.3, burnMs: 6000, burn: 1.5, slowTickMs: 500 };

export const gasoline = {
  name: t('spell.gasoline.name'), desc: t('spell.gasoline.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Fläche'], cls: 'fire',
  mana: 120, cd: 10000, range: 30, radius: G.radius, ground: true, showDmg: G.burn * UNIT,   // PH
  effect(c, point) {
    canisterLook(point);
    const f = addField(c, { pos: point, radius: c.radius(G.radius), dur: G.ms, tickMs: G.slowTickMs, visual: oilField(), gas: true,
      onTick: f => {
        for (const m of mobsInRadius(f.pos, f.radius)) applySlow(m, G.slow, 700);
        if (f.lit && state.now >= f.nextBurn) { f.nextBurn += 1000; for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, G.burn * UNIT); }
      },
    });
    f.ignite = () => {
      if (f.lit) return;
      f.lit = true;
      f.nextBurn = state.now;
      f.end = state.now + G.burnMs;                     // ab dem Zünden brennt sie 6 s
      igniteLook(f.visual);
    };
  },
};

// Feuer-Treffer auf einen Mob in einer ungezündeten Lache: zünden
onFireHit(m => {
  for (const f of state.fields) if (f.gas && !f.lit && Math.hypot(m.pos.x - f.pos.x, m.pos.z - f.pos.z) <= f.radius) f.ignite();
});
