// Zonen: Himmel, Nebel, Licht, Gelände, Props, Mobs. Alle Werte sind Design-Werte (PH).
// mobs[0] ist der Start-Mob mit etwa 50 % der Spawns, der Rest teilt sich die andere Hälfte.

import * as THREE from 'three';
import { clamp, rand } from './util';
import { forestProps } from './props';

const placeholder = {
  env: {   // PH
    fog: 0xe8c9a4, fogNear: 45, fogFar: 185,
    top: 0x2c4f8c, mid: 0x9fb4d0, sunDisc: 1,
    sky: 0xb8c8ff, ground: 0x6a4a2a, hemi: 1.25,
    sun: 0xffb070, sunPower: 2.1, sunPos: [120, 45, -60],
  },
  height(x, z) {
    return 2.2 * Math.sin(x * 0.035) * Math.cos(z * 0.03)
         + 1.2 * Math.sin(x * 0.08 + z * 0.06)
         + 0.6 * Math.sin(z * 0.13 - x * 0.05);
  },
  ground: (() => {
    const grassA = new THREE.Color(0x3f6e22), grassB = new THREE.Color(0x86a83e),
          dirt = new THREE.Color(0x8a6a42), rock = new THREE.Color(0x7d766a);
    return (c, x, z, h) => {
      const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) + Math.sin(x * 0.031 + z * 0.047);
      c.copy(grassA).lerp(grassB, clamp(0.5 + n * 0.3 + h * 0.05 + rand(-0.06, 0.06), 0, 1));
      if (n > 1.3) c.lerp(dirt, 0.65);
      if (h > 6) c.lerp(rock, clamp((h - 6) / 10, 0, 0.9));
    };
  })(),
  props: forestProps,
  spawn: { x: 0, z: 0 },
  mobs: ['wildeber'],
  packs: { count: 9, initialMobs: 30, sizeBonus: 0 },   // PH
};

export const ZONES: any = {
  tirisfal: { ...placeholder, name: 'Tirisfal' },
  brd: { ...placeholder, name: 'Blackrock Depths' },
  stv: { ...placeholder, name: 'Schlingendorntal' },
  tanaris: { ...placeholder, name: 'Tanaris' },
};
