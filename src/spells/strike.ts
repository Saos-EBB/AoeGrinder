import { rand } from '../util';
import { applyRoot } from '../mobs';
import { shakeCamera } from '../camera';
import { mobsInRadius, hasRune, schedule } from './core';
import { mods } from '../config';
import { strikeLook } from '../vfx/boltLook';
import { t } from '../i18n';

const DOUBLE = { delay: 400, k: 0.5 }, WIDE = 2, LONG_STUN = 1500, TRIPLE = { n: 3, k: 0.6, gap: 250 };   // PH

export const strike = {
  name: t('spell.strike.name'), desc: t('spell.strike.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Fläche', 'Kontrolle'], cls: 'lightning',
  mana: 160, charge: 20, cd: 2000, min: 60, max: 70,   // v29: halbiert
  radius: 3, range: 30, stun: 500, ground: true,   // PH
  runes: [
    { id: 'double', name: t('spell.strike.runes.double.name'), desc: t('spell.strike.runes.double.desc') },
    { id: 'wide', name: t('spell.strike.runes.wide.name'), desc: t('spell.strike.runes.wide.desc'), radius: 6 },
    { id: 'long', name: t('spell.strike.runes.long.name'), desc: t('spell.strike.runes.long.desc') },
    { id: 'triple', name: t('spell.strike.runes.triple.name'), desc: t('spell.strike.runes.triple.desc') },
  ],
  effect(c, point) {
    const r = c.radius(strike.radius) * (hasRune('strike', 'wide') ? WIDE : 1), stun = hasRune('strike', 'long') ? LONG_STUN : strike.stun;
    const hit = k => {
      for (const m of mobsInRadius(point, r)) if (c.hit(m, rand(strike.min, strike.max) * k) && !m.dead) applyRoot(m, stun);
      strikeLook(point, r);
      shakeCamera(0.15);
    };
    if (hasRune('strike', 'triple')) for (let i = 0; i < TRIPLE.n; i++) schedule(i * TRIPLE.gap, () => hit(TRIPLE.k));
    else hit(1);
    if (hasRune('strike', 'double')) schedule(DOUBLE.delay, () => hit(DOUBLE.k));
    for (let i = 1; i <= mods.strikeExtra; i++) schedule(i * DOUBLE.delay + 150, () => hit(DOUBLE.k));   // Talent Donnerhall
  },
};
