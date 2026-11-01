// Neue Feuer-Optik. Alle Werte PH.

import { rand, pick } from '../util';
import { particles } from './particles';
import { impact, lightFlash, shockwave } from './impact';
import { playSound } from './sound';
import { waveFx, shellFx, flareFx, sparksFx, columnFx } from './prims';

const FIRE = [1.5, 0.48, 0.06], EMBER = [1.1, 0.2, 0.03], HOT = [1.9, 0.95, 0.22];   // unter der Sättigung, sonst brennt alles weiß aus
const SPARK = [2.4, 0.9, 0.15];

function embersUp(pos, radius, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), r = radius * Math.sqrt(Math.random());
    particles.spawn({ x: pos.x + Math.cos(a) * r, y: pos.y + rand(0.1, 1), z: pos.z + Math.sin(a) * r, vx: rand(-0.8, 0.8), vy: rand(3, 8), vz: rand(-0.8, 0.8),
      drag: 0.6, life: rand(0.7, 1.5), color: pick([SPARK, EMBER, HOT]), size: rand(0.14, 0.34) });
  }
}

// Flammenstoß: Feuersäule stürzt ins Ziel, dann läuft die Welle
export function flamestrikeNew(pos, radius) {
  impact(pos, 0xff8030, { radius, power: 300, kickBy: 0.32, sound: 'fire' });
  flareFx(pos, 0xff7a20, radius * 1.1, 300);
  columnFx(pos, radius * 0.6, 13, HOT, EMBER, { dur: 680, top: 0.55, grow: 0.14, scroll: 1.7, dens: 0.34 });
  waveFx(pos, radius, HOT, EMBER, { dur: 460, width: 0.24, peak: 0.85 });
  shellFx(pos, radius, FIRE, { dur: 420, squash: 0.55 });
  sparksFx(pos, 80, [SPARK, EMBER, HOT], radius * 2.2, { up: 5, size: 0.42, grav: 3 });
  embersUp(pos, radius * 0.8, 50);
}

// Druckwelle: wenig Säule, viel Druck
export function blastNew(pos, radius, inward) {
  impact(pos, 0xff8030, { radius, power: 260, kickBy: 0.42, sound: 'fire' });
  shockwave(pos, radius * 1.4, inward ? -0.05 : 0.055, 420);
  flareFx(pos, 0xff8028, radius * 0.9, 260);
  waveFx(pos, radius, HOT, FIRE, { dur: 380, width: 0.26, peak: 0.8 });
  waveFx(pos, radius * 0.72, FIRE, EMBER, { dur: 520, width: 0.16, peak: 0.6 });
  shellFx(pos, radius * 1.05, FIRE, { dur: 340, squash: 0.4, peak: 0.8 });
  for (let i = 0; i < 150; i++) {
    const a = rand(0, 6.28), sp = rand(radius * 1.5, radius * 3);
    const out = inward ? -1 : 1, s = inward ? radius : 0;
    particles.spawn({ x: pos.x + Math.cos(a) * s, y: pos.y + rand(0.2, 0.9), z: pos.z + Math.sin(a) * s, vx: Math.cos(a) * sp * out, vy: rand(0, 1.5), vz: Math.sin(a) * sp * out,
      drag: 3.2, life: rand(0.35, 0.6), color: pick([SPARK, EMBER, HOT]), size: rand(0.25, 0.55) });
  }
}

export function hellfireOpen(pos, radius) {
  playSound('fire', 0.8);
  lightFlash(pos, 0xff7030, 340, radius * 2.4, 320);
  flareFx(pos, 0xff8040, radius * 0.9, 340);
  waveFx(pos, radius, FIRE, [0.8, 0.15, 1.5], { dur: 480, width: 0.3 });
}
export function hellfirePulse(pos, radius) {
  playSound('fire', 0.35);
  lightFlash(pos, 0xff6020, 170, radius * 2, 340);
  waveFx(pos, radius, FIRE, [0.5, 0.08, 0.9], { dur: 620, width: 0.16, peak: 0.5 });
  embersUp(pos, radius, 22);
}
