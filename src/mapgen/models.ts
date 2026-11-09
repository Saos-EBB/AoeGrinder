// Modelle der generierten Maps: Wände, Props und Landmarken, je eine Geometrie mit Vertex-Farben (ein Draw Call pro Art).
// Glüh-Teile getrennt (unbeleuchtet, > 1 = Bloom). Bausteine aus props.ts. Alle Maße // PH

import * as THREE from 'three';
import { box, cyl, cone, ball } from '../props';
import { colored, plain, type Prop, type Landmark } from './build';
import { CELL } from './grid';

const dodeca = (r: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const g = new THREE.DodecahedronGeometry(r).toNonIndexed(); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };

// ---------- Wände (eine Rand-Wandzelle, 8 × 8 yd) ----------
export const wallBlock = (stone: number, top: number, h = 9, glowLine = false): Prop => ({
  geo: colored([[box(CELL, h, CELL, 0, h / 2, 0), stone], [box(CELL + 0.3, 0.8, CELL + 0.3, 0, h + 0.4, 0), top], [box(CELL + 0.1, 0.6, CELL + 0.1, 0, 0.3, 0), top]]),
  glow: glowLine ? plain([box(CELL + 0.12, 0.12, CELL + 0.12, 0, 2.2, 0)]) : undefined,
});
// Kanäle: Ziegel mit Rohr und Gitter
export const sewerWall = (): Prop => ({
  geo: colored([[box(CELL, 10, CELL, 0, 5, 0), 0x3a4440], [box(CELL + 0.2, 0.6, CELL + 0.2, 0, 1.2, 0), 0x2a3230], [box(CELL + 0.3, 0.9, CELL + 0.3, 0, 10.2, 0), 0x4a5450],
    [cyl(0.5, 0.5, CELL + 0.2, 0, 6.5, CELL / 2 + 0.2, Math.PI / 2, 0, Math.PI / 2, 8), 0x5a4a3a]]),
});
// Hölle: zackiger Fels mit Glut-Adern
export const hellWall = (): Prop => ({
  geo: colored([[box(CELL, 8, CELL, 0, 4, 0), 0x2a1614], [cone(2.4, 6, -2, 10, -1.5, 0, 0, 0, 5), 0x3a1a16], [cone(1.8, 5, 2.2, 9.5, 1.8, 0, 0, 0, 5), 0x341816],
    [cone(1.4, 4, 0.4, 9.5, 2.6, 0, 0, 0, 5), 0x2a1614]]),
  glow: plain([box(CELL + 0.1, 0.18, CELL + 0.1, 0, 0.8, 0)]),
});
// Kathedrale: Mauer mit Spitzbogen-Nische und Strebepfeiler
export const nave = (): Prop => ({
  geo: colored([[box(CELL, 14, CELL, 0, 7, 0), 0x55596a], [box(CELL + 0.3, 1, CELL + 0.3, 0, 14.5, 0), 0x6a6e7a], [box(1.6, 16, 1.6, CELL / 2 - 0.4, 8, CELL / 2 - 0.4), 0x4a4e5a]]),
});

// ---------- Props ----------
export const pine = (): Prop => ({ r: 0.7, geo: colored([[cyl(0.35, 0.55, 3, 0, 1.5, 0), 0x5a3d22], [cone(2.6, 5, 0, 4, 0, 0, 0, 0, 8), 0x2f5a2c], [cone(1.8, 3.5, 0, 6.4, 0, 0, 0, 0, 8), 0x3a6a32]]) });
export const oak = (): Prop => ({ r: 0.8, geo: colored([[cyl(0.4, 0.65, 3.4, 0, 1.7, 0), 0x5a4028], [ball(2.2, 0, 4.6, 0, 1.2, 0.9, 1.2), 0x3f6e2a], [ball(1.6, 1.2, 5.6, 0.4), 0x4a7a32], [ball(1.4, -1, 5.2, -0.6), 0x386428]]) });
export const rock = (hex = 0x7d766a): Prop => ({ r: 1.1, h: 1.2, geo: colored([[dodeca(1.2, 0, 0.5, 0, 1, 0.7, 1), hex], [dodeca(0.6, 0.9, 0.3, 0.5, 1, 0.8, 1), hex]]) });
export const boulder = (hex = 0x8a6a48): Prop => ({ r: 2.2, geo: colored([[dodeca(2.4, 0, 1.6, 0, 1, 1.1, 1), hex], [dodeca(1.4, 1.6, 0.8, 1.1), hex]]) });
export const cactus = (): Prop => ({ r: 0.5, geo: colored([[cyl(0.35, 0.4, 3.2, 0, 1.6, 0), 0x4a7a3a], [cyl(0.22, 0.25, 1.4, 0.7, 2.2, 0, 0, 0, -0.9), 0x4a7a3a], [cyl(0.2, 0.22, 1, -0.6, 1.8, 0, 0, 0, 0.9), 0x447034]]) });
// Feigenkaktus: flache Scheiben
export const cactus2 = (): Prop => ({ r: 0.9, geo: colored([[ball(0.7, 0, 0.6, 0, 1, 1, 0.3), 0x5a8a3a], [ball(0.55, 0.6, 1.4, 0, 1, 1, 0.3), 0x4e7e34], [ball(0.5, -0.5, 1.5, 0.1, 1, 1, 0.3), 0x5a8a3a], [ball(0.12, 0.6, 2.0, 0), 0xd84a6a]]) });
export const bones = (): Prop => ({ r: 0.9, h: 1, geo: colored([[cyl(0.12, 0.12, 2.4, 0, 0.2, 0, 0, 0, Math.PI / 2), 0xd8ccb0], ...[-0.8, -0.3, 0.2, 0.7].map(x => [cyl(0.07, 0.07, 1.2, x, 0.5, 0, 0.3, 0, 0), 0xc8bc9c] as [THREE.BufferGeometry, number]), [ball(0.35, 1.4, 0.3, 0), 0xd8ccb0]]) });
export const pillar = (stone = 0x787c88, base = 0x5a5e6a, h = 9): Prop => ({ r: 1, geo: colored([[box(2, 0.8, 2, 0, 0.4, 0), base], [cyl(0.7, 0.8, h, 0, h / 2 + 0.7, 0, 0, 0, 0, 10), stone], [box(2.2, 0.9, 2.2, 0, h + 1.1, 0), base]]) });
export const bench = (): Prop => ({ w: 4, d: 0.9, h: 1.2, geo: colored([[box(4, 0.15, 0.8, 0, 0.6, 0), 0x5a3a26], [box(4, 0.9, 0.12, 0, 1.0, 0.4), 0x4a2e1e], [box(0.15, 0.6, 0.7, -1.8, 0.3, 0), 0x3a2418], [box(0.15, 0.6, 0.7, 1.8, 0.3, 0), 0x3a2418]]) });
// Kerze mit Flamme (Glühen) und Lichtfleck am Boden als Lichtinsel
export const candles = (): Prop => ({
  geo: colored([[cyl(0.09, 0.11, 0.6, 0, 0.3, 0, 0, 0, 0, 6), 0xe8dcc0], [cyl(0.08, 0.1, 0.9, 0.3, 0.45, 0.2, 0, 0, 0, 6), 0xe0d4b8], [cyl(0.4, 0.45, 0.12, 0.1, 0.06, 0.1, 0, 0, 0, 8), 0x6a5a40]]),
  glow: plain([cone(0.09, 0.32, 0, 0.78, 0, 0, 0, 0, 5), cone(0.08, 0.28, 0.3, 1.04, 0.2, 0, 0, 0, 5)]),
});
export const rubble = (hex = 0x5a5e6a): Prop => ({ r: 1.6, h: 1.4, geo: colored([[dodeca(1, 0, 0.4, 0, 1.3, 0.6, 1), hex], [box(1.6, 0.6, 0.8, 1, 0.3, 0.6, 0, 0.5, 0.2), hex], [box(1.2, 0.5, 0.7, -0.9, 0.25, -0.5, 0.1, 1.1, 0), hex], [dodeca(0.6, -0.4, 0.3, 1), hex]]) });
// Steg über die Wasserrinne (Kanäle), begehbar ohne Bremse: build setzt dort trocken
export const bridge = (): Prop => ({ geo: colored([[box(5.2, 0.25, 3, 0, 0.2, 0), 0x6a5038], [box(0.2, 0.7, 3, -2.5, 0.45, 0), 0x4a3828], [box(0.2, 0.7, 3, 2.5, 0.45, 0), 0x4a3828]]) });
export const grate = (): Prop => ({ geo: colored([[box(2.4, 0.08, 2.4, 0, 0.04, 0), 0x2a2e2c], ...[-0.8, -0.27, 0.27, 0.8].map(x => [box(0.12, 0.1, 2.3, x, 0.08, 0), 0x4a524e] as [THREE.BufferGeometry, number])]) });
export const barrel = (): Prop => ({ r: 0.7, h: 1.4, geo: colored([[cyl(0.6, 0.6, 1.3, 0, 0.65, 0, 0, 0, 0, 10), 0x5a4028], [cyl(0.63, 0.63, 0.12, 0, 0.3, 0, 0, 0, 0, 10), 0x3a3a3a], [cyl(0.63, 0.63, 0.12, 0, 1.0, 0, 0, 0, 0, 10), 0x3a3a3a]]) });
export const spikes = (): Prop => ({ r: 1.2, geo: colored([[cone(0.5, 3.2, 0, 1.6, 0, 0.1, 0, 0.12, 5), 0x3a1a16], [cone(0.4, 2.4, 0.8, 1.2, 0.4, -0.2, 0, -0.3, 5), 0x2a1210], [cone(0.35, 2, -0.7, 1, 0.5, 0.2, 0, 0.3, 5), 0x341614]]) });
export const brazier = (): Prop => ({ r: 0.8, h: 1.6, geo: colored([[cyl(0.2, 0.35, 1.2, 0, 0.6, 0, 0, 0, 0, 6), 0x2a2220], [cyl(0.8, 0.5, 0.5, 0, 1.45, 0, 0, 0, 0, 8), 0x3a2a24]]),
  glow: plain([cone(0.55, 1.2, 0, 2.2, 0, 0, 0, 0, 6), cone(0.3, 0.8, 0.25, 2.4, 0.1, 0, 0, 0, 5)]) });

// ---------- Landmarken (hoch, mit Glühen, das ohne Nebel aus dem Dunkel ragt) ----------
// Wald: alter Riesenbaum mit leuchtenden Pilzen und Glühwürmchen-Kugeln in der Krone
export const giantTree = (): Landmark => ({
  r: 4,
  body: colored([[cyl(2.2, 3.6, 16, 0, 8, 0, 0, 0, 0, 10), 0x4a3420], [cyl(0.8, 1.6, 9, 3.4, 15, 0, 0, 0, -0.7), 0x4a3420], [cyl(0.7, 1.4, 8, -3.2, 14, 1, 0.3, 0, 0.8), 0x4a3420],
    [ball(7, 0, 22, 0, 1.3, 0.8, 1.3), 0x2f5a26], [ball(5, 5, 19, 2, 1, 0.8, 1), 0x386a2c], [ball(5, -5, 20, -2, 1, 0.8, 1), 0x2a5022],
    ...[0, 1.3, 2.6, 3.9, 5.2].map(a => [cyl(0.6, 1.1, 6, Math.cos(a) * 3.4, 0.8, Math.sin(a) * 3.4, Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1), 0x3e2c1a] as [THREE.BufferGeometry, number])]),
  glow: plain([...[0.4, 1.9, 3.5, 5.0].map(a => ball(0.45, Math.cos(a) * 2.6, 2.4 + a, Math.sin(a) * 2.6)), ...[0.9, 2.4, 4.1].map(a => ball(0.6, Math.cos(a) * 7, 21, Math.sin(a) * 7)), ball(0.5, 0, 28, 0)]),
});
// Wüste: Obelisk mit Grabmal-Eingang, Kristall an der Spitze
export const obelisk = (): Landmark => ({
  r: 4.5,
  body: colored([[box(9, 1.2, 9, 0, 0.6, 0), 0xb0905e], [box(7, 1, 7, 0, 1.7, 0), 0xc0a06a], [box(3.2, 20, 3.2, 0, 12, 0), 0xc8a874], [cone(2.3, 4, 0, 24, 0, 0, Math.PI / 4, 0, 4), 0xd8b880],
    [box(4.4, 3.4, 1.2, 0, 3.9, 3.6), 0x8a6a40], [box(2.2, 2.8, 0.6, 0, 3.6, 4.1), 0x1a1208]]),
  glow: plain([new THREE.OctahedronGeometry(1.1).translate(0, 27.5, 0), box(3.3, 0.3, 3.3, 0, 8, 0), box(3.3, 0.3, 3.3, 0, 16, 0)]),
});
// Kanäle: großes Schleusentor mit Zahnrädern und Warnlicht
export const sluice = (): Landmark => ({
  r: 6,
  body: colored([[box(2.4, 16, 2.4, -6, 8, 0), 0x3a4440], [box(2.4, 16, 2.4, 6, 8, 0), 0x3a4440], [box(14.4, 2.4, 2.6, 0, 15, 0), 0x4a5450],
    [box(9.6, 11, 0.6, 0, 6.5, 0), 0x4a3a2a], ...[2, 5, 8, 11].map(y => [box(9.8, 0.4, 0.8, 0, y, 0), 0x2a2a2a] as [THREE.BufferGeometry, number]),
    [cyl(2.2, 2.2, 0.6, -6, 17.6, 0, Math.PI / 2, 0, 0, 12), 0x6a5030], [cyl(1.6, 1.6, 0.6, 6, 17.4, 0, Math.PI / 2, 0, 0, 10), 0x6a5030]]),
  glow: plain([ball(0.7, -6, 18.6, 1.2), ball(0.7, 6, 18.6, 1.2), box(9.4, 0.2, 0.2, 0, 1.2, 0.5)]),
});
// Kathedrale: Glockenturm hinter der Apsis mit leuchtendem Rosenfenster
export const belltower = (): Landmark => ({
  r: 4,
  body: colored([[box(7, 30, 7, 0, 15, 0), 0x4a4e5a], [box(8, 1.2, 8, 0, 30.6, 0), 0x5a5e6a], [cone(5, 10, 0, 36, 0, 0, Math.PI / 4, 0, 4), 0x3a3e4a],
    [box(2.8, 4, 0.6, 0, 26, 3.6), 0x14161e], [cyl(1.1, 1.6, 2.2, 0, 26, 3.4, 0, 0, 0, 8), 0x8a7a40]]),
  glow: plain([new THREE.CircleGeometry(2.6, 12).translate(0, 18, 3.56), box(0.4, 9, 0.2, -2.5, 8, 3.56), box(0.4, 9, 0.2, 2.5, 8, 3.56)]),
});
// Hölle: Höllenschlund-Tor aus Hörnern und Zähnen, Feuer im Bogen
export const hellgate = (): Landmark => ({
  r: 6,
  body: colored([[box(3, 14, 3, -6, 7, 0), 0x2a1210], [box(3, 14, 3, 6, 7, 0), 0x2a1210], [cyl(1.2, 2.6, 10, -5, 18, 0, 0, 0, 0.6), 0x3a1a14], [cyl(1.2, 2.6, 10, 5, 18, 0, 0, 0, -0.6), 0x3a1a14],
    ...[-4, -2, 0, 2, 4].map(x => [cone(0.6, 2.4, x, 12.5, 0.6, Math.PI, 0, 0, 5), 0xd8c8a8] as [THREE.BufferGeometry, number]), [box(15, 2, 3.2, 0, 14, 0), 0x2a1210]]),
  glow: plain([new THREE.PlaneGeometry(9, 12).translate(0, 6.5, 0), ball(0.8, -5, 23, 0), ball(0.8, 5, 23, 0)]),
});
