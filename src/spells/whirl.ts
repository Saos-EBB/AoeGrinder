import { rand } from '../util';
import { player } from '../state';
import { pullMob } from '../mobs';
import { novaFx, galeTex } from '../fx/spellFx';
import { mobsInRadius, applySlow, addField, hasRune } from './core';
import { fieldDecal, areaParticles, visuals, ICE, ICE_WHITE } from './fx';
import { vortexVisual } from '../fx/prims';
import { vfxOld } from '../fx/shaders';

const FOLLOW_SPEED = 5, PULL_PER_S = 2, SMALL_OFFSET = 5;   // PH

// Boden und niedriger Trichter; alte Optik nur der Boden
function whirlVisual(k) {
  const floor = fieldDecal(galeTex, ICE, 0.3, 2.4);
  return vfxOld() ? floor : visuals(floor, vortexVisual([1.2, 1.9, 2.8], ICE, 3.6 * k, { peak: 0.42, top: 1.1, spin: 2.2 }));
}

function spawnWhirl(c, pos, radius, k) {
  addField(c, { pos, radius, dur: whirl.dur, visual: whirlVisual(k), tickMs: 1000,
    onUpdate(f, dt) {
      if (hasRune('whirl', 'follow')) {
        const dx = player.pos.x - f.pos.x, dz = player.pos.z - f.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { const step = Math.min(d, FOLLOW_SPEED * dt / 1000); f.pos.x += dx / d * step; f.pos.z += dz / d * step; }
      }
      for (const m of mobsInRadius(f.pos, f.radius)) {
        applySlow(m, whirl.slow, 300);
        if (hasRune('whirl', 'pull')) pullMob(m, f.pos, PULL_PER_S * dt / 1000);
      }
      areaParticles(f.pos, f.radius, 55 * k, dt, [ICE, ICE_WHITE], { up: 3, size: 0.3, swirl: 10 });
    },
    onTick(f) {
      for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, whirl.tickDmg * k);
    },
  });
}

export const whirl = {
  name: 'Wirbel', desc: 'Nova + Wirbel 6 s am Boden, 30 % Slow.', ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Nova', 'Fläche'], cls: 'frost',
  mana: 140, cd: 15000, min: 28, max: 32, radius: 8, dur: 6000, field: 6, tickDmg: 12, slow: 0.3,   // PH
  runes: [
    { id: 'follow', name: 'Eisläufer', desc: 'Folgt dir.' },
    { id: 'three', name: 'Dreifach', desc: '3 kleine Wirbel.' },
    { id: 'pull', name: 'Mahlstrom', desc: 'Zieht an.' },
  ],
  effect(c) {
    const r = c.radius(whirl.radius), center = player.pos.clone(), field = c.radius(whirl.field);
    for (const m of mobsInRadius(center, r)) c.hit(m, rand(whirl.min, whirl.max));
    novaFx(center, r);
    if (!hasRune('whirl', 'three')) return spawnWhirl(c, center, field, 1);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      spawnWhirl(c, center.clone().setX(center.x + Math.cos(a) * SMALL_OFFSET).setZ(center.z + Math.sin(a) * SMALL_OFFSET), field / 2, 0.5);
    }
  },
};
