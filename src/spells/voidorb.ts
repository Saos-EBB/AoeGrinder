import { clamp, dist2d } from '../util';
import { player } from '../state';
import { pullMob } from '../mobs';
import { voidTex } from '../fx/spellFx';
import { mobsInRadius, applySlow, addField, hasRune } from './core';
import { vfxOld } from '../fx/shaders';
import { voidSpiral, voidOpen } from '../fx/arcaneFx';
import { fieldDecal, orbVisual, visuals, areaParticles, burstFx, SHADOW, VOID } from './fx';

const PULL_PER_S = 4, MAX_SLOW = 0.4, FOLLOW_SPEED = 3, IMPLODE = 25, TWIN_OFFSET = 6;   // PH

function spawnOrb(c, pos, radius, k) {
  if (!vfxOld()) voidOpen(pos, radius);
  addField(c, { pos, radius, dur: voidorb.dur, visual: visuals(fieldDecal(voidTex, VOID, vfxOld() ? 0.8 : 0.5, 1.2), orbVisual(0x7a2fd0, 3.5 * k + 1, true)),
    onUpdate(f, dt) {
      if (hasRune('voidorb', 'follow')) {
        const dx = player.pos.x - f.pos.x, dz = player.pos.z - f.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { const step = Math.min(d, FOLLOW_SPEED * dt / 1000); f.pos.x += dx / d * step; f.pos.z += dz / d * step; }
      }
      for (const m of mobsInRadius(f.pos, f.radius)) {
        pullMob(m, f.pos, PULL_PER_S * dt / 1000);
        applySlow(m, MAX_SLOW * clamp(1 - dist2d(m.pos, f.pos) / f.radius, 0, 1), 200);
      }
      if (vfxOld()) areaParticles(f.pos, f.radius, 40 * k, dt, [SHADOW, VOID], { up: 1, size: 0.35, swirl: 6 });
      else voidSpiral(f.pos, f.radius, k, dt, [SHADOW, VOID, [1.4, 0.4, 2.2]]);
    },
    onTick(f) {
      for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, voidorb.pulse * k);
    },
    onEnd(f) {
      if (!hasRune('voidorb', 'implode')) return;
      const caught = mobsInRadius(f.pos, f.radius);
      for (const m of caught) c.hit(m, IMPLODE * caught.length * k);
      burstFx(f.pos, f.radius / 2, [SHADOW, VOID], 0x7a2fd0);
    },
  });
}

export const voidorb = {
  name: 'Leerenkugel', desc: 'Dunkle Kugel aufs Bodenziel 6 s, zieht alle in 15 yd zur Mitte, Schattenschaden, bis 40 % Slow nahe der Mitte.', ranks: ['dmg', 'mana', 'radius'], tags: ['Schatten', 'Leere', 'Fläche'], cls: 'shadow',
  mana: 350, cd: 30000, dur: 6000, pulse: 18, range: 30, radius: 15, ground: true,   // PH
  runes: [
    { id: 'follow', name: 'Schattenbegleiter', desc: 'Folgt dir.' },
    { id: 'implode', name: 'Implosion', desc: 'Implodiert am Ende, Schaden pro Gefangenem.' },
    { id: 'twins', name: 'Zwillinge', desc: '2 kleine Kugeln.' },
  ],
  effect(c, point) {
    const radius = c.radius(voidorb.radius);
    if (!hasRune('voidorb', 'twins')) return spawnOrb(c, point, radius, 1);
    for (const side of [-1, 1]) spawnOrb(c, point.clone().setX(point.x + side * TWIN_OFFSET), radius / 2, 0.5);
  },
};
