import { rand } from '../util';
import { state, player } from '../state';
import { mods } from '../config';
import { meterHeat } from '../schoolMeter';
import { shakeCamera } from '../camera';
import { knockbackMob } from '../mobs';
import { mobsInRadius, addField, hasRune, schedule } from './core';
import { meteorLook, fireField } from '../vfx/fireLook';
import { t } from '../i18n';

const SWARM = { n: 3, offset: 7, k: 0.5, gap: 300 }, STARS = { n: 6, offset: 8, k: 0.4, gap: 200 }, LONG_BURN = 2, KNOCK = 8;   // PH
const STARFALL = { perHeat: 25, ms: 2000, min: 5000 };   // PH: Sternenfall

export const meteor = {
  name: t('spell.meteor.name'), desc: t('spell.meteor.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Fläche'], cls: 'fire',
  mana: 320, cd: 20000, min: 180, max: 210, radius: 9, range: 30, delay: 1500, burn: 16, burnDur: 6000, ground: true,   // PH
  runes: [
    { id: 'swarm', name: t('spell.meteor.runes.swarm.name'), desc: t('spell.meteor.runes.swarm.desc') },
    { id: 'crater', name: t('spell.meteor.runes.crater.name'), desc: t('spell.meteor.runes.crater.desc') },
    { id: 'impact', name: t('spell.meteor.runes.impact.name'), desc: t('spell.meteor.runes.impact.desc') },
    { id: 'stars', name: t('spell.meteor.runes.stars.name'), desc: t('spell.meteor.runes.stars.desc') },
  ],
  effect(c, point) {
    const strike = (pos, k, delay) => {
      const r = c.radius(meteor.radius) * k;
      meteorLook(pos, r, delay / 1000);
      schedule(delay, () => {
        for (const m of mobsInRadius(pos, r)) if (c.hit(m, rand(meteor.min, meteor.max) * k) && !m.dead && hasRune('meteor', 'impact')) knockbackMob(m, pos, KNOCK);
        shakeCamera(0.3);
        addField(c, { pos, radius: r, dur: meteor.burnDur * (hasRune('meteor', 'crater') ? LONG_BURN : 1), visual: fireField({ h: 1.1 }),
          onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, meteor.burn * k); },
        });
      });
    };
    // Sternenfall: Abklingzeit −2 s pro 25 Hitze und Rang, mindestens 5 s
    if (mods.starfall && player.cds.meteor > state.now) {
      const cut = STARFALL.ms * Math.floor(meterHeat() / STARFALL.perHeat) * mods.starfall;
      player.cds.meteor = Math.max(state.now + STARFALL.min, player.cds.meteor - cut);
    }
    const S = hasRune('meteor', 'stars') ? STARS : hasRune('meteor', 'swarm') ? SWARM : null;
    if (!S) return strike(point, 1, meteor.delay);
    for (let i = 0; i < S.n; i++) {
      const a = i / S.n * Math.PI * 2;
      strike(point.clone().setX(point.x + Math.cos(a) * S.offset).setZ(point.z + Math.sin(a) * S.offset), S.k, meteor.delay + i * S.gap);
    }
  },
};
