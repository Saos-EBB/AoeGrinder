import { dist2d } from '../util';
import { state, player } from '../state';
import { schedule, mobsInRadius, hasRune } from './core';
import { mods, UNIT } from '../config';
import { modValue } from '../modifiers';
import { applyRoot } from '../mobs';
import { tempestLook } from '../vfx/boltLook';

// Tempest (Blitz-Figur, passiv): nach 6 Kettenblitzen wird der nächste ein Spaltschlag 8 yd vor dir, 5 Einheiten, betäubt 1 s. Sturmhüter: ×2 und sofort // PH
const TEMPEST = { every: 6, radius: 8, angle: Math.PI, dmg: 5, stunMs: 1000 }, KEEPER_MUL = 2, KILL_DMG = 0.005;
import { boltFx } from './fx';
import { t } from '../i18n';

const STEP_DELAY = 45, MORE = 40, KILL = 10;   // MORE: Rune Überschlag, KILL: Rune Entladung (v30 verdoppelt)   // PH: ms je Sprung, damit man die Kette sieht

const nearestFirst = (list, pos) => list.sort((a, b) => dist2d(a.pos, pos) - dist2d(b.pos, pos));

// Kette von Ziel zu Ziel, auch für Bogenblitz und Frostschlag. Alle Äste teilen sich dasselbe Budget an Sprüngen.
// killDmg: jeder Kill in der Kette macht die restlichen Sprünge um diesen Anteil stärker. from: Startpunkt des ersten Blitzes (sonst der Spieler)
export function runChain(c, first, { jumps, range, dmg, falloff = 1, repeat = false, killBonus = 0, killDmg = 0, forkEvery = 0, overCorpses = false, onHit = null, boltColor = undefined, from = null }) {
  const run = { left: jumps, count: 0, seen: new Set() };
  const jump = (from, mob, amount) => {
    if (run.left <= 0) return;
    run.left--;
    run.count++;
    run.seen.add(mob);
    boltFx(from, mob.pos, boltColor);
    if (!mob.dead) {
      if (c.hit(mob, amount)) onHit?.(mob);
      if (mob.dead) { run.left += killBonus; amount *= 1 + killDmg; }
    }
    const pool = nearestFirst(state.mobs.filter(o => o !== mob && (!o.dead || overCorpses) && dist2d(o.pos, mob.pos) <= range && (repeat || !run.seen.has(o))), mob.pos);
    const branches = forkEvery && run.count % forkEvery === 0 ? 2 : 1;
    for (const next of pool.slice(0, branches)) {
      run.seen.add(next);   // sonst nehmen beide Äste dasselbe Ziel
      schedule(STEP_DELAY, () => jump(mob.pos, next, amount * falloff));
    }
  };
  jump(from ?? player.pos, first, dmg);
}

export const nearestMob = range => nearestFirst(mobsInRadius(player.pos, range, Infinity), player.pos)[0];

export const chain = {
  name: t('spell.chain.name'), desc: t('spell.chain.desc'), ranks: ['dmg', 'mana'], tags: ['Blitz', 'Kette'], cls: 'lightning',
  mana: 280, cd: 6000, castTime: 350, dmg: 25, jumps: 100,   // v29: 0,35 s statt 1,5 s, Schaden halbiert; v30: doppelte Sprünge
  jumpRange: 12, range: 30,   // PH
  runes: [
    { id: 'repeat', name: t('spell.chain.runes.repeat.name'), desc: t('spell.chain.runes.repeat.desc') },
    { id: 'kill', name: t('spell.chain.runes.kill.name'), desc: t('spell.chain.runes.kill.desc') },
    { id: 'fork', name: t('spell.chain.runes.fork.name'), desc: t('spell.chain.runes.fork.desc') },
    { id: 'more', name: t('spell.chain.runes.more.name'), desc: t('spell.chain.runes.more.desc') },
  ],
  canCast: () => nearestMob(chain.range) ? null : 'Kein Ziel in Reichweite',
  instantCast: () => (state.keeper ?? 0) > 0,
  effect(c) {
    const first = nearestMob(chain.range);
    if (!first) return;
    const k = (state.keeper ?? 0) > 0 ? KEEPER_MUL : 1;
    if (k > 1) state.keeper--;
    if (modValue('onlyTag') === 'Blitz' && (state.chainCount = (state.chainCount ?? 0) + 1) > TEMPEST.every) {
      state.chainCount = 0;
      const r = c.radius(TEMPEST.radius);
      for (const m of mobsInRadius(player.pos, r)) {
        const a = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z) - player.facing;
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= TEMPEST.angle / 2 && c.hit(m, TEMPEST.dmg * UNIT * k) && !m.dead) applyRoot(m, TEMPEST.stunMs);
      }
      return tempestLook(r, TEMPEST.angle);
    }
    runChain(c, first, { jumps: (chain.jumps + mods.chainJumps + (hasRune('chain', 'more') ? MORE : 0)) * mods.jumpMul, range: chain.jumpRange, dmg: chain.dmg * k, killDmg: KILL_DMG,
      repeat: hasRune('chain', 'repeat'), killBonus: hasRune('chain', 'kill') ? KILL : 0, forkEvery: hasRune('chain', 'fork') ? 10 : 0 });
  },
};
