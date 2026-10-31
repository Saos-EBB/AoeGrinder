import { dist2d } from '../util';
import { state, player } from '../state';
import { schedule, mobsInRadius, hasRune } from './core';
import { boltFx } from './fx';

const STEP_DELAY = 45;   // PH: ms je Sprung, damit man die Kette sieht

const nearestFirst = (list, pos) => list.sort((a, b) => dist2d(a.pos, pos) - dist2d(b.pos, pos));

// Kette von Ziel zu Ziel, auch für Bogenblitz. Alle Äste teilen sich dasselbe Budget an Sprüngen.
export function runChain(c, first, { jumps, range, dmg, falloff = 1, repeat = false, killBonus = 0, forkEvery = 0, overCorpses = false, onHit = null }) {
  const run = { left: jumps, count: 0, seen: new Set() };
  const jump = (from, mob, amount) => {
    if (run.left <= 0) return;
    run.left--;
    run.count++;
    run.seen.add(mob);
    boltFx(from, mob.pos);
    if (!mob.dead) {
      if (c.hit(mob, amount)) onHit?.(mob);
      if (mob.dead) run.left += killBonus;
    }
    const pool = nearestFirst(state.mobs.filter(o => o !== mob && (!o.dead || overCorpses) && dist2d(o.pos, mob.pos) <= range && (repeat || !run.seen.has(o))), mob.pos);
    const branches = forkEvery && run.count % forkEvery === 0 ? 2 : 1;
    for (const next of pool.slice(0, branches)) {
      run.seen.add(next);   // sonst nehmen beide Äste dasselbe Ziel
      schedule(STEP_DELAY, () => jump(mob.pos, next, amount * falloff));
    }
  };
  jump(player.pos, first, dmg);
}

export const nearestMob = range => nearestFirst(mobsInRadius(player.pos, range), player.pos)[0];

export const chain = {
  name: 'Kettenblitz', desc: 'Bis zu 50 Sprünge in 12 yd, jeder Sprung −2 % Schaden, 1,5 s Zauber.', ranks: ['dmg', 'mana'], tags: ['Blitz', 'Kette'], cls: 'lightning',
  mana: 280, cd: 6000, castTime: 1500, dmg: 50, jumps: 50, jumpRange: 12, range: 30,   // PH
  runes: [
    { id: 'repeat', name: 'Wiederkehr', desc: 'Gleiches Ziel mehrfach.' },
    { id: 'kill', name: 'Entladung', desc: 'Kill = +5 Sprünge.' },
    { id: 'fork', name: 'Gabelung', desc: 'Gabelt bei jedem 10. Sprung.' },
  ],
  canCast: () => nearestMob(chain.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const first = nearestMob(chain.range);
    if (!first) return;
    runChain(c, first, { jumps: chain.jumps, range: chain.jumpRange, dmg: chain.dmg, falloff: 0.98,
      repeat: hasRune('chain', 'repeat'), killBonus: hasRune('chain', 'kill') ? 5 : 0, forkEvery: hasRune('chain', 'fork') ? 10 : 0 });
  },
};
