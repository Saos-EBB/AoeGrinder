import * as THREE from 'three';
import { rand, pick } from '../util';
import { player } from '../state';
import { mobsInRadius, applySlow, addField, hasRune } from './core';
import { orbVisual, areaParticles, boltFx, burstFx, ICE, ICE_WHITE } from './fx';

const SPEED = 8, RANGE = 20, HOLD = 4000, SPLINTER_SLOW = 0.3;   // PH

export const frostorb = {
  name: 'Frostkugel', desc: 'Fliegt 20 yd vorwärts, Splitter rundum, Explosion am Ende.', ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Geschoss', 'Fläche'], cls: 'frost',
  mana: 180, cd: 8000, splinter: 14, splinterRadius: 8, splinters: 4, blast: 40, blastRadius: 6,   // PH
  runes: [
    { id: 'return', name: 'Bumerang', desc: 'Kehrt zurück.' },
    { id: 'hold', name: 'Eisstern', desc: 'Bleibt stehen und dreht.' },
    { id: 'chill', name: 'Kalte Splitter', desc: 'Splitter verlangsamen.' },
  ],
  effect(c) {
    const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    const flyTime = RANGE / SPEED * 1000;
    const dur = hasRune('frostorb', 'return') ? flyTime * 2 : hasRune('frostorb', 'hold') ? flyTime + HOLD : flyTime;
    let flown = 0;
    addField(c, { pos: player.pos, radius: c.radius(frostorb.splinterRadius), dur, tickMs: 500, visual: orbVisual(0x9fdcff, 3.2),
      onUpdate(f, dt) {
        const step = SPEED * dt / 1000, back = hasRune('frostorb', 'return') && flown >= RANGE;
        if (flown < RANGE || back) f.pos.addScaledVector(dir, back ? -step : step);
        flown += step;
        areaParticles(f.pos, 1, 60, dt, [ICE, ICE_WHITE], { up: 3, size: 0.3, swirl: hasRune('frostorb', 'hold') && flown >= RANGE ? 12 : 3 });
      },
      onTick(f) {
        const around = mobsInRadius(f.pos, f.radius);
        for (let i = 0; i < frostorb.splinters && around.length; i++) {
          const m = pick(around);
          around.splice(around.indexOf(m), 1);
          boltFx({ x: f.pos.x, y: f.pos.y + 0.4, z: f.pos.z }, m.pos, ICE_WHITE, 120);
          if (c.hitProjectile(m, frostorb.splinter * rand(0.9, 1.1)) && !m.dead && hasRune('frostorb', 'chill')) applySlow(m, SPLINTER_SLOW, 2000);
        }
      },
      onEnd(f) {
        const r = c.radius(frostorb.blastRadius);
        for (const m of mobsInRadius(f.pos, r)) c.hit(m, frostorb.blast);
        burstFx(f.pos, r, [ICE, ICE_WHITE], 0x9fdcff);
      },
    });
  },
};
