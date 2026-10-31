// Zonen: Himmel, Nebel, Licht, Gelände, Props, Mobs. Alle Werte sind Design-Werte (PH).
// mobs[0] ist der Start-Mob mit etwa 50 % der Spawns, der Rest teilt sich die andere Hälfte.

import * as THREE from 'three';
import { clamp, rand, lerpTo } from './util';
import { forestProps, lambert, box, cyl, cone, ball, prefab, scatter, grass, rocks } from './props';

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

const near = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) < r;
// Abstand zum Polygonzug, für Wege und Flüsse
function polyDist(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
const pathsDist = (x, z, paths) => Math.min(...paths.map(p => polyDist(x, z, p)));

// ---------- Tirisfal: Die Felder von Agamand ----------
const TIR = {   // PH
  lake: [62, 48, 24], mill: [0, -17], cemetery: [-62, 40], tower: [56, -60],
  paths: [[[0, -6], [-8, 30], [4, 60], [0, 96]], [[-96, -8], [-40, -4], [0, -6], [50, -18], [96, -12]], [[-40, -4], [-62, 28]], [[50, -18], [56, -52]]],
};
const tirPath = (x, z) => pathsDist(x, z, TIR.paths);
const inLake = (x, z, pad = 0) => near(x, z, TIR.lake[0], TIR.lake[1], TIR.lake[2] + pad);
const WATER_Y = -1.5;

function tirisfalProps(ctx) {
  const free = (x, z) => tirPath(x, z) > 3.5 && !inLake(x, z, 3) && !near(x, z, TIR.mill[0], TIR.mill[1], 10)
    && !near(x, z, TIR.cemetery[0], TIR.cemetery[1], 16) && !near(x, z, TIR.tower[0], TIR.tower[1], 7);
  const bark = lambert(0x6a5a48), stone = lambert(0x9c988c, { flatShading: true }), wood = lambert(0x75593c), darkWood = lambert(0x4a3a2a);

  // Kahle, verdrehte Bäume
  const tree = prefab([[bark, [
    cyl(0.3, 0.5, 2.6, 0, 1.3, 0, 0, 0, 0.14), cyl(0.2, 0.3, 2, -0.3, 3.2, 0, 0, 0, -0.42),
    cyl(0.08, 0.17, 1.9, -1.1, 4.4, 0.2, 0.3, 0, 0.8), cyl(0.08, 0.15, 1.6, 0.5, 3.9, -0.3, -0.5, 0, -0.9),
    cyl(0.05, 0.11, 1.2, 0.2, 4.9, 0.5, 0.8, 0, -0.2), cyl(0.05, 0.1, 1.1, -0.9, 3.3, -0.5, -0.8, 0, 0.9),
  ]]]);
  const trees = scatter(50, 14, 90, free).map(p => ({ ...p, s: rand(0.9, 1.7), ry: rand(0, 6) }));
  for (const t of trees) ctx.obstacle(t.x, t.z, 0.5 * t.s);
  ctx.place(tree, [...trees, ...scatter(170, 98, 165).map(p => ({ ...p, s: rand(1.2, 2.4), ry: rand(0, 6) }))]);

  // Kürbisfelder mit schiefen Zäunen
  const pumpkin = prefab([[lambert(0xb5661c), [ball(0.42, 0, 0.3, 0, 1, 0.75, 1)]], [lambert(0x3f4a22), [cyl(0.04, 0.06, 0.2, 0, 0.66, 0)]]]);
  const fence = prefab([[wood, [box(0.14, 1.2, 0.14, -1.5, 0.6, 0), box(0.14, 1.2, 0.14, 1.5, 0.6, 0), box(3.2, 0.1, 0.05, 0, 0.9, 0), box(3.2, 0.1, 0.05, 0, 0.45, 0, 0, 0, 0.06)]]]);
  const crops = [], fences = [];
  for (const [cx, cz] of [[-26, -30], [28, 16], [-32, 30], [26, -42], [-52, -48]]) {
    for (let x = -7; x <= 7; x += 2.3) for (let z = -5; z <= 5; z += 2.3) {
      if (Math.random() < 0.72) crops.push({ x: cx + x + rand(-0.4, 0.4), z: cz + z + rand(-0.4, 0.4), s: rand(0.7, 1.25), ry: rand(0, 6) });
    }
    for (let x = -8; x <= 8; x += 3.3) for (const sz of [-1, 1]) if (Math.random() < 0.8) fences.push({ x: cx + x, z: cz + sz * 7, ry: rand(-0.08, 0.08), tiltZ: rand(-0.2, 0.2), tilt: rand(-0.15, 0.15) });
    for (let z = -6; z <= 6; z += 3.3) for (const sx of [-1, 1]) if (Math.random() < 0.8) fences.push({ x: cx + sx * 9, z: cz + z, ry: Math.PI / 2 + rand(-0.08, 0.08), tiltZ: rand(-0.2, 0.2), tilt: rand(-0.15, 0.15) });
  }
  ctx.place(pumpkin, crops);
  ctx.place(fence, fences);

  // Zerfallene Windmühle in der Mitte
  const mill = prefab([
    [stone, [cyl(3.2, 4.4, 8, 0, 4, 0, 0, 0, 0, 9), cyl(2.9, 3.3, 2.4, 0.2, 9.2, 0, 0.05, 0, 0.07, 9), box(2, 1.5, 1, 3.6, 0.7, 2), box(1.4, 1, 1.2, -4, 0.5, 1.5)]],
    [darkWood, [cone(3.5, 3, 0.4, 11.4, 0, 0.1, 0, 0.3, 8), box(1.6, 2.6, 0.2, 0, 1.3, 4.1)]],
    [wood, [cyl(0.2, 0.2, 2, 0, 9.3, 3.6, Math.PI / 2), box(0.3, 7.5, 0.12, 0, 9.3, 4.5, 0, 0, 0.5), box(1.2, 5.2, 0.05, -0.5, 11, 4.45, 0, 0, 0.5), box(0.3, 3.8, 0.12, 1.5, 8.2, 4.5, 0, 0, 2.0)]],
  ]);
  ctx.place(mill, [{ x: TIR.mill[0], z: TIR.mill[1] }]);
  ctx.obstacle(TIR.mill[0], TIR.mill[1], 5);

  // Friedhof
  const [gx, gz] = TIR.cemetery;
  const grave = prefab([[stone, [box(0.8, 1.2, 0.2, 0, 0.55, 0), cyl(0.4, 0.4, 0.2, 0, 1.15, 0, Math.PI / 2, 0, 0, 8), box(0.8, 0.1, 1.5, 0, 0.05, 0.8)]]]);
  const graves = [];
  for (let x = -10; x <= 10; x += 3.4) for (let z = -10; z <= 8; z += 4) if (Math.random() < 0.8 && Math.hypot(x, z - 7) > 5) {
    const p = { x: gx + x + rand(-0.4, 0.4), z: gz + z, ry: rand(-0.2, 0.2), tiltZ: rand(-0.2, 0.2), tilt: rand(-0.14, 0.14) };
    graves.push(p); ctx.obstacle(p.x, p.z, 0.5);
  }
  ctx.place(grave, graves);
  const crypt = prefab([[stone, [box(6, 3.4, 5, 0, 1.7, 0), box(1.5, 2.2, 0.4, 0, 1.1, 2.5)]], [darkWood, [box(7, 0.5, 6, 0, 3.6, 0), cone(4.6, 2, 0, 4.8, 0, 0, Math.PI / 4, 0, 4)]]]);
  ctx.place(crypt, [{ x: gx, z: gz + 7, ry: Math.PI }]);
  ctx.obstacle(gx, gz + 7, 3.8);
  const wall = prefab([[stone, [box(3.2, 1, 0.4, 0, 0.5, 0)]]]);
  const walls = [];
  for (let i = -4; i <= 4; i++) if (Math.random() < 0.85) { walls.push({ x: gx + i * 3.2, z: gz - 13, tiltZ: rand(-0.08, 0.08) }); walls.push({ x: gx - 14, z: gz + i * 3, ry: Math.PI / 2, tiltZ: rand(-0.08, 0.08) }); }
  ctx.place(wall, walls);
  for (const w of walls) ctx.obstacle(w.x, w.z, 1);

  // Wachturm
  const crenel = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; crenel.push(box(0.9, 1, 0.5, Math.cos(a) * 3, 15.5, Math.sin(a) * 3, 0, -a + Math.PI / 2)); }
  ctx.place(prefab([[stone, [cyl(3, 3.5, 15, 0, 7.5, 0, 0, 0, 0, 9), cyl(3.5, 3, 1, 0, 15, 0, 0, 0, 0, 9), ...crenel]], [darkWood, [box(1.4, 2.4, 0.3, 0, 1.2, 3.5)]]]), [{ x: TIR.tower[0], z: TIR.tower[1], ry: 2.4 }]);
  ctx.obstacle(TIR.tower[0], TIR.tower[1], 4);

  // Trüber See
  const water = new THREE.Mesh(new THREE.CircleGeometry(TIR.lake[2] + 4, 40).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x3d5240, transparent: true, opacity: 0.85 }));
  water.position.set(TIR.lake[0], WATER_Y, TIR.lake[1]);
  ctx.add(water);

  rocks(ctx, 14, 0x6c6a60, 14, 90, free);
  grass(ctx, 5000, 0.19, 0.3, 0.2, (x, z) => tirPath(x, z) > 2 && !inLake(x, z));
}

const tirisfal = {
  name: 'Tirisfal',
  env: {   // PH
    fog: 0x71895e, fogNear: 30, fogFar: 125,
    top: 0x4f5e52, mid: 0x74836f, sunDisc: 0,
    sky: 0xc0d0bc, ground: 0x6a7058, hemi: 1.9,
    sun: 0xc5d4c0, sunPower: 1.0, sunPos: [50, 45, 60],
  },
  height(x, z) {
    let h = 1.3 * Math.sin(x * 0.04) * Math.cos(z * 0.035) + 0.5 * Math.sin(x * 0.09 + z * 0.07);
    const lake = Math.hypot(x - TIR.lake[0], z - TIR.lake[1]);
    if (lake < TIR.lake[2] + 6) h = lerpTo(h, -3.2, clamp(1 - (lake - TIR.lake[2] + 6) / 12, 0, 1));
    return h;
  },
  ground: (() => {
    const a = new THREE.Color(0x56613a), b = new THREE.Color(0x7b7f4c), path = new THREE.Color(0x6a5f4e), mud = new THREE.Color(0x3b3d2e);
    return (c, x, z, h) => {
      const n = Math.sin(x * 0.13) * Math.cos(z * 0.11) + Math.sin(x * 0.04 + z * 0.05);
      c.copy(a).lerp(b, clamp(0.45 + n * 0.3 + rand(-0.08, 0.08), 0, 1));
      const p = tirPath(x, z);
      if (p < 3.4) c.lerp(path, clamp((3.4 - p) / 1.6, 0, 1));
      if (h < WATER_Y + 0.6) c.lerp(mud, clamp((WATER_Y + 0.6 - h) * 1.5, 0, 1));
    };
  })(),
  props: tirisfalProps,
  spawn: { x: 0, z: 0 },
  mobs: ['skelett', 'dunkelhund', 'knochenwirker', 'fledermaus', 'waechter'],
  packs: { count: 13, initialMobs: 34, sizeBonus: -1 },   // PH: viele kleine Packs
};

export const ZONES: any = {
  tirisfal,
  brd: { ...placeholder, name: 'Blackrock Depths' },
  stv: { ...placeholder, name: 'Schlingendorntal' },
  tanaris: { ...placeholder, name: 'Tanaris' },
};
