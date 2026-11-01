// Neue Arkan- und Leeren-Optik. Alle Werte PH.

import { rand, pick, perFrame } from '../util';
import { heightAt } from '../world';
import { particles } from './particles';
import { impact, lightFlash, shockwave } from './impact';
import { bolt } from './bolts';
import { waveFx, markFx, shellFx, flareFx, sparksFx } from './prims';

const ARC = [1.5, 0.45, 2.1], PINK = [1.9, 0.7, 1.6], WHITE = [2.2, 1.7, 2.6];

export function aeNew(pos, radius, runeTex) {
  impact(pos, 0xd890ff, { radius, power: 300, kickBy: 0.24 });
  flareFx(pos, 0xe8b0ff, radius * 0.9, 300);
  markFx(runeTex, pos, radius, [1.8, 0.75, 2.4], 750, { additive: true, spin: 1.3, grow: 0.22, rim: WHITE });
  waveFx(pos, radius, WHITE, ARC, { dur: 400, width: 0.3 });
  shellFx(pos, radius, ARC, { dur: 380, squash: 0.75 });
  for (let i = 0; i < 130; i++) {                          // Kugel-Explosion
    const a = rand(0, 6.28), up = rand(-0.2, 1), sp = rand(14, 26), h = Math.sqrt(Math.max(0, 1 - up * up));
    particles.spawn({ x: pos.x, y: pos.y + 1, z: pos.z, vx: Math.cos(a) * h * sp, vy: up * sp * 0.6, vz: Math.sin(a) * h * sp,
      drag: 3.2, life: rand(0.4, 0.7), color: pick([ARC, PINK]), size: rand(0.2, 0.42) });
  }
  for (let i = 0; i < 34; i++) {                           // Funken, die nachglühen und aufsteigen
    const a = rand(0, 6.28), r = rand(1, radius);
    particles.spawn({ x: pos.x + Math.cos(a) * r, y: pos.y + rand(0.3, 1.5), z: pos.z + Math.sin(a) * r,
      vy: rand(1, 3), life: rand(0.7, 1.2), color: PINK, size: rand(0.16, 0.3) });
  }
}

export function blinkNew(from, to) {
  // Start: alles fällt nach innen. Ziel: alles fliegt nach außen.
  flareFx(from, 0xd890ff, 5, 280, 1.2);
  shockwave(from, 4, -0.025, 300);
  for (let i = 0; i < 60; i++) {
    const a = rand(0, 6.28), r = rand(1.2, 2.6);
    particles.spawn({ x: from.x + Math.cos(a) * r, y: from.y + rand(0.2, 2.2), z: from.z + Math.sin(a) * r, cx: from.x, cz: from.z, spin: 3, pull: 6, life: rand(0.25, 0.5), color: pick([ARC, PINK]), size: rand(0.18, 0.36) });
  }
  const a = { x: from.x, y: from.y + 1.2, z: from.z }, b = { x: to.x, y: to.y + 1.2, z: to.z };
  bolt(a, b, ARC, { life: 340, width: 1.1, branches: 0, depth: 3, jitter: 0.25 });
  bolt(a, b, PINK, { life: 220, width: 0.5, branches: 2, depth: 4, jitter: 0.7 });
  flareFx(to, 0xe8b0ff, 6, 340, 1.2);
  lightFlash(to, 0xd890ff, 220, 16);
  shockwave(to, 5, 0.03, 320);
  shellFx(to, 3, ARC, { dur: 300, squash: 1, y: 1.1 });
  sparksFx(to, 70, [ARC, PINK, WHITE], 9, { up: 5, size: 0.38, y: 1.6, life: 0.6 });
  for (let i = 0; i < 40; i++) {                           // Spur zwischen Start und Ziel
    const t = Math.random();
    particles.spawn({ x: from.x + (to.x - from.x) * t + rand(-0.3, 0.3), y: from.y + (to.y - from.y) * t + rand(0.5, 1.8), z: from.z + (to.z - from.z) * t + rand(-0.3, 0.3),
      vy: rand(0.2, 1), life: rand(0.3, 0.7), color: ARC, size: rand(0.15, 0.3) });
  }
}

// Sog der Leerenkugel: Partikel starten außen und spiralen zur Mitte
export function voidSpiral(pos, radius, k, dt, colors) {
  for (let i = perFrame(75 * k, dt); i > 0; i--) {
    const a = rand(0, 6.28), r = radius * rand(0.55, 1), x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    particles.spawn({ x, y: heightAt(x, z) + rand(0.2, 2.4), z, vy: rand(-0.2, 0.5), cx: pos.x, cz: pos.z, spin: rand(4, 7), pull: radius * rand(0.55, 0.9),
      life: rand(1, 1.6), color: pick(colors), size: rand(0.16, 0.36) });
  }
}
export function voidOpen(pos, radius) {
  flareFx(pos, 0x7a2fd0, radius * 0.5, 380, 1.6);
  lightFlash(pos, 0x7a2fd0, 260, radius);
  shockwave(pos, radius * 0.6, -0.03, 500);
}
