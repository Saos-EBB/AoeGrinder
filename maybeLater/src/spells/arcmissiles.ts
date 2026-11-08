import { dist2d } from '../util';
import { state, player } from '../state';
import { mobsInRadius, startChannel, hasRune, schedule, bounceShot } from './core';
import { mods } from '../config';
import { meterSchool } from '../schoolMeter';

// Spellslinger (Arkan-Figur): jeder Treffer mit dieser Chance ein Splitter, der nach 1 s ins Ziel fliegt // PH
const SLINGER = { chance: 0.2, delay: 1000, mul: 0.3 };
import { nearestTarget } from './target';
import { missileLook, missileBoom } from '../vfx/arcaneLook';
import { PAL } from '../vfx/energy';
import { t } from '../i18n';

const SPLIT = { range: 5, mul: 0.5 }, FAST_MS = 2000, CHARGE_RADIUS = 4;   // PH

// Ein Geschoss aufs Ziel; ist es tot, nimmt der Kanal das nächste
function fire(ch) {
  if (!ch.target || ch.target.dead) ch.target = nearestTarget(arcmissiles.range);
  if (!ch.target) return;
  ch.shots++;
  const m = bounceShot(ch.target);   // Kristallhöhlen: dieser Schuss geht woanders hin oder verpufft
  if (!m) return;
  missileLook(m.pos);
  const landed = ch.c.hitProjectile(m, arcmissiles.dmg);
  if (landed && meterSchool() === 'Arkan' && Math.random() < SLINGER.chance + mods.splinterSwarm)
    schedule(SLINGER.delay, () => { if (m.dead) return; missileLook(m.pos, PAL.void, .09); ch.c.hit(m, arcmissiles.dmg * SLINGER.mul); });
  if (hasRune('arcmissiles', 'split')) {
    const next = mobsInRadius(m.pos, SPLIT.range, Infinity).filter(o => o !== m).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos))[0];
    if (next) { missileLook(next.pos, PAL.arcane, .09); ch.c.hit(next, arcmissiles.dmg * SPLIT.mul); }
  }
  if (ch.shots === arcmissiles.missiles && hasRune('arcmissiles', 'charge')) {
    const r = ch.c.radius(CHARGE_RADIUS);
    for (const o of mobsInRadius(m.pos, r)) ch.c.hit(o, arcmissiles.dmg);
    missileBoom(m.pos, r);
  }
}

export const arcmissiles = {
  name: t('spell.arcmissiles.name'), desc: t('spell.arcmissiles.desc'), ranks: ['dmg', 'mana'], tags: ['Arkan', 'Geschoss', 'Kanal'], cls: 'arcane',
  mana: 140, cd: 0, channel: 3000, dmg: 48, missiles: 5, range: 30,   // PH
  runes: [
    { id: 'split', name: t('spell.arcmissiles.runes.split.name'), desc: t('spell.arcmissiles.runes.split.desc') },
    { id: 'fast', name: t('spell.arcmissiles.runes.fast.name'), desc: t('spell.arcmissiles.runes.fast.desc') },
    { id: 'charge', name: t('spell.arcmissiles.runes.charge.name'), desc: t('spell.arcmissiles.runes.charge.desc') },
  ],
  canCast: () => nearestTarget(arcmissiles.range) ? null : t('msg.noTarget'),
  effect(c) {
    const ch = startChannel(c, player.pos, hasRune('arcmissiles', 'fast') ? FAST_MS : arcmissiles.channel);
    ch.target = nearestTarget(arcmissiles.range);
    ch.shots = 0;
    ch.nextTick = Infinity;   // eigener Takt statt der Sekunden-Ticks
    ch.every = (ch.end - ch.start) / arcmissiles.missiles;
    ch.nextShot = state.now;
  },
  tick() {},
  // Geschosse gleichmäßig über den Kanal, das erste sofort
  channelUpdate(ch) {
    while (ch.nextShot <= state.now && ch.nextShot < ch.end) { fire(ch); ch.nextShot += ch.every; }
  },
};
