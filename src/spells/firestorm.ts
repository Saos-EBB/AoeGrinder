// Feuersbrunst: trifft das nächste Ziel. Brennt es, springt der Brand auf Nachbarn, die springen weiter, solange sie brennen.

import { mods, UNIT } from '../config';
import { dist2d } from '../util';
import { state } from '../state';
import { mobsInRadius, addField, burnLeft } from './core';
import { nearestTarget } from './target';
import { boltFx, FIRE, EMBER, areaParticles } from './fx';

// PH: 1,5 Einheiten aufs Ziel, je 3 Nachbarn in 5 yd, höchstens 30 Sprünge; Brand der Sprünge 6 s mit 0,5 Einheiten pro Sekunde (Wert nicht vorgegeben)
const S = { dmg: 1.5, range: 30, per: 3, radius: 5, maxJumps: 30, burnMs: 6000, burnDps: 0.5 };

// Brand als eigene kleine Fläche, die am Mob klebt; ihre Ticks setzen mob.burn (core.ts) wie jeder Feuer-Dauerschaden
export function igniteMob(c, m, dps = S.burnDps * UNIT, ms = S.burnMs) {
  m.burn = { dps, until: state.now + ms };
  addField(c, { pos: m.pos, radius: 0.1, dur: ms,
    onTick: () => { if (!m.dead) c.hit(m, dps); },
    onUpdate: (f, dt) => { f.pos.copy(m.pos); if (!m.dead) areaParticles(m.pos, 0.6, 12, dt, [FIRE, EMBER], { up: 3, size: 0.3 }); else f.end = state.now; },
  });
}

export const firestorm = {
  name: 'Feuersbrunst', desc: 'Trifft das nächste Ziel (1,5 Einheiten). Brennt es, springt der Brand auf 3 Mobs in 5 yd, die springen weiter, solange sie brennen. Höchstens 30 Sprünge.', ranks: ['dmg', 'mana'], tags: ['Feuer', 'Kette'], cls: 'fire',
  mana: 90, cd: 8000, range: S.range, showDmg: S.dmg * UNIT,   // PH
  canCast: () => nearestTarget(S.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const target = nearestTarget(S.range);
    if (!target) return;
    const burning = burnLeft(target) > 0;
    c.hit(target, S.dmg * UNIT);
    if (!burning) return;
    const per = S.per + mods.wildfire, seen = new Set([target]), queue = [target];
    let jumps = 0;
    while (queue.length && jumps < S.maxJumps) {
      const from = queue.shift();
      const next = mobsInRadius(from.pos, S.radius).filter(m => !seen.has(m)).sort((a, b) => dist2d(a.pos, from.pos) - dist2d(b.pos, from.pos)).slice(0, per);
      for (const m of next) {
        if (jumps >= S.maxJumps) break;
        seen.add(m); jumps++;
        boltFx(from.pos, m.pos, FIRE, 220);
        igniteMob(c, m);
        queue.push(m);
      }
    }
  },
};
