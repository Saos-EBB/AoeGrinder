import { rand } from '../util';
import { state, player } from '../state';
import { burnTex } from '../fx/spellFx';
import { vfxOld } from '../fx/shaders';
import { flamestrikeNew } from '../fx/fireFx';
import { mobsInRadius, addField, hasRune } from './core';
import { fieldDecal, areaParticles, burstFx, FIRE, EMBER } from './fx';

const AFTER_BLINK = 5000, WANDER_SPEED = 3;   // PH

export const flame = {
  name: 'Flammenstoß', desc: '2 s Zauber aufs Bodenziel, Treffer + Brandfläche 8 s.', ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Fläche'], cls: 'fire',
  mana: 195, cd: 0, castTime: 2000, min: 55, max: 65, burn: 12, burnDur: 8000, range: 30, radius: 8, ground: true,   // PH
  runes: [
    { id: 'blink', name: 'Heißer Sprung', desc: 'Sofort nach Blink.' },
    { id: 'wander', name: 'Feuerspur', desc: 'Fläche wandert zum Spieler.' },
    { id: 'wide', name: 'Flächenbrand', desc: 'Doppelter Radius, halber Schaden.', radius: 16 },
  ],
  instantCast: () => hasRune('flame', 'blink') && state.now - player.lastBlink < AFTER_BLINK,
  effect(c, point) {
    const wide = hasRune('flame', 'wide'), radius = c.radius(wide ? 16 : flame.radius), k = wide ? 0.5 : 1;
    for (const m of mobsInRadius(point, radius)) c.hit(m, rand(flame.min, flame.max) * k);
    if (vfxOld()) burstFx(point, radius, [FIRE, EMBER], 0xff9a40); else flamestrikeNew(point, radius);
    addField(c, { pos: point, radius, dur: flame.burnDur, visual: fieldDecal(burnTex, EMBER, vfxOld() ? 0.6 : 0.3, 0.05),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, flame.burn * k); },
      onUpdate: (f, dt) => {
        areaParticles(f.pos, f.radius, 45, dt, [FIRE, EMBER], { up: 4, size: 0.4 });
        if (!hasRune('flame', 'wander')) return;
        const dx = player.pos.x - f.pos.x, dz = player.pos.z - f.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.1) return;
        const step = Math.min(d, WANDER_SPEED * dt / 1000);
        f.pos.x += dx / d * step; f.pos.z += dz / d * step;
      },
    });
  },
};
