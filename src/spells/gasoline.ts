// Benzin: Kanister aufs Bodenziel, Lache verlangsamt. Ein Feuer-Treffer auf einen Mob in der Lache zündet sie (Haken onFireHit in core.ts).

import { state } from '../state';
import { UNIT } from '../config';
import { burnTex, blightTex } from '../fx/spellFx';
import { mobsInRadius, applySlow, addField, onFireHit } from './core';
import { fieldDecal, areaParticles, burstFx, FIRE, EMBER } from './fx';

// PH: Lache 6 yd 8 s, 30 % Slow; gezündet 6 s Brand mit 1,5 Einheiten pro Sekunde
const G = { radius: 6, ms: 8000, slow: 0.3, burnMs: 6000, burn: 1.5, slowTickMs: 500 };
const OIL = [0.25, 0.22, 0.12];

export const gasoline = {
  name: 'Benzin', desc: 'Kanister aufs Bodenziel: Lache 6 yd für 8 s, 30 % langsamer. Ein Feuer-Treffer zündet sie: 6 s Brand, 1,5 Einheiten pro Sekunde.', ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Fläche'], cls: 'fire',
  mana: 120, cd: 10000, range: 30, radius: G.radius, ground: true, showDmg: G.burn * UNIT,   // PH
  effect(c, point) {
    const f = addField(c, { pos: point, radius: c.radius(G.radius), dur: G.ms, tickMs: G.slowTickMs, visual: fieldDecal(blightTex, OIL, 0.6, 0.02), gas: true,
      onTick: f => {
        for (const m of mobsInRadius(f.pos, f.radius)) applySlow(m, G.slow, 700);
        if (f.lit && state.now >= f.nextBurn) { f.nextBurn += 1000; for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, G.burn * UNIT); }
      },
      onUpdate: (f, dt) => { if (f.lit) areaParticles(f.pos, f.radius, 50, dt, [FIRE, EMBER], { up: 4, size: 0.4 }); },
    });
    f.ignite = () => {
      if (f.lit) return;
      f.lit = true;
      f.nextBurn = state.now;
      f.end = state.now + G.burnMs;                     // ab dem Zünden brennt sie 6 s
      f.visual.remove();
      f.visual = fieldDecal(burnTex, EMBER, 0.45, 0.05);
      burstFx(f.pos, f.radius, [FIRE, EMBER], 0xff7a30);
    };
  },
};

// Feuer-Treffer auf einen Mob in einer ungezündeten Lache: zünden
onFireHit(m => {
  for (const f of state.fields) if (f.gas && !f.lit && Math.hypot(m.pos.x - f.pos.x, m.pos.z - f.pos.z) <= f.radius) f.ignite();
});
