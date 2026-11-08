import { rand } from '../util';
import { state, player } from '../state';
import { flameStrikeLook, fireField } from '../vfx/fireLook';
import { mobsInRadius, addField, hasRune } from './core';
import { t } from '../i18n';

const AFTER_BLINK = 5000, WANDER_SPEED = 3;   // PH

export const flame = {
  name: t('spell.flame.name'), desc: t('spell.flame.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Fläche'], cls: 'fire',
  mana: 195, cd: 0, castTime: 500, min: 55, max: 65, burn: 12, burnDur: 8000, range: 30, radius: 8, ground: true,   // PH
  runes: [
    { id: 'blink', name: t('spell.flame.runes.blink.name'), desc: t('spell.flame.runes.blink.desc') },
    { id: 'wander', name: t('spell.flame.runes.wander.name'), desc: t('spell.flame.runes.wander.desc') },
    { id: 'wide', name: t('spell.flame.runes.wide.name'), desc: t('spell.flame.runes.wide.desc'), radius: 16 },
  ],
  instantCast: () => hasRune('flame', 'blink') && state.now - player.lastBlink < AFTER_BLINK,
  effect(c, point) {
    const wide = hasRune('flame', 'wide'), radius = c.radius(wide ? 16 : flame.radius), k = wide ? 0.5 : 1;
    for (const m of mobsInRadius(point, radius)) c.hit(m, rand(flame.min, flame.max) * k);
    flameStrikeLook(point, radius);
    addField(c, { pos: point, radius, dur: flame.burnDur, visual: fireField({ h: 1 }),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, flame.burn * k); },
      onUpdate: (f, dt) => {
        if (!hasRune('flame', 'wander')) return;
        const dx = player.pos.x - f.pos.x, dz = player.pos.z - f.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.1) return;
        const step = Math.min(d, WANDER_SPEED * dt / 1000);
        f.pos.x += dx / d * step; f.pos.z += dz / d * step;
      },
    });
  },
};
