import { rand } from '../util';
import { ringFx, FROST_WHITE } from '../fx/spellFx';
import { applyRoot } from '../mobs';
import { mobsInRadius, hasRune, schedule } from './core';
import { burstFx, ICE, ICE_WHITE } from './fx';
import { t } from '../i18n';

const AFTERSHOCK = { ms: 2000, mul: 0.5 }, WIDE = 1.5;   // PH

export const glacier = {
  name: t('spell.glacier.name'), desc: t('spell.glacier.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Fläche'], cls: 'frost',
  mana: 240, cd: 18000, min: 70, max: 84, radius: 7, range: 30, delay: 1000, root: 3000, ground: true,   // PH
  runes: [
    { id: 'fast', name: t('spell.glacier.runes.fast.name'), desc: t('spell.glacier.runes.fast.desc') },
    { id: 'after', name: t('spell.glacier.runes.after.name'), desc: t('spell.glacier.runes.after.desc') },
    { id: 'wide', name: t('spell.glacier.runes.wide.name'), desc: t('spell.glacier.runes.wide.desc') },
  ],
  effect(c, point) {
    const wide = hasRune('glacier', 'wide'), r = c.radius(glacier.radius) * (wide ? WIDE : 1), delay = hasRune('glacier', 'fast') ? 0 : glacier.delay;
    const erupt = k => {
      for (const m of mobsInRadius(point, r)) if (c.hit(m, rand(glacier.min, glacier.max) * k) && !m.dead && !wide) applyRoot(m, glacier.root, 'ice');
      burstFx(point, r, [ICE, ICE_WHITE], 0x9fdcff);
    };
    if (delay) ringFx(point, r, FROST_WHITE, delay);
    schedule(delay, () => erupt(1));
    if (hasRune('glacier', 'after')) schedule(delay + AFTERSHOCK.ms, () => erupt(AFTERSHOCK.mul));
  },
};
