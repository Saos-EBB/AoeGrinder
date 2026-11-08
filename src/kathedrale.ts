// Kathedrale der Hölle: vierte Anime-Map (docs/map-konzepte-anime.md). Runder Kirchenbau mit Säulenringen, Bänken, Altar und Kerzen.
// Etagen: alle KA.killsPerFloor Kills geht es eine Etage tiefer. Nur Farben, Glut-Risse, Funken und Spawn-Tabelle wechseln, nichts wird neu geladen.
// Umgebung: Gelände, Fugen, Wände, Säulen, Bänke, Altar, Kerzen, Flammen, Risse, Funken = 10 Draw Calls. Alle Zahlen // PH.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, rand } from './util';
import { WORLD_K } from './config';
import { state, player } from './state';
import { box, cyl, cone } from './props';
import { toonMat } from './toon';
import { recolorGround } from './world';
import { shakeCamera } from './camera';
import { t } from './i18n';

const R = 72 * WORLD_K;                      // Innenradius der Außenwand
const KA = {
  killsPerFloor: 60,
  // Pro Etage: Boden (zwei Fliesen, Fugen), Tönung aller Props, Glut der Risse (0 = aus), Funken-Farbe und -Menge, Spawn-Tabelle (erster = Start-Mob)
  floors: [
    { name: t('floor.1'), tileA: 0x6a6e7a, tileB: 0x585c68, seam: 0x3a3e4a, tint: [0.85, 0.92, 1.1], crack: 0, spark: [0.5, 0.55, 0.65], sparkK: 0.35, mobs: ['skelett', 'gefallener', 'daemon'] },
    { name: t('floor.2'), tileA: 0x5a4844, tileB: 0x4a3a38, seam: 0x2a1c1a, tint: [1.1, 0.78, 0.66], crack: 1.4, spark: [2.2, 0.9, 0.25], sparkK: 0.7, mobs: ['gefallener', 'daemon', 'skelett'] },
    { name: t('floor.3'), tileA: 0x3a1a18, tileB: 0x2a1010, seam: 0x120606, tint: [0.95, 0.42, 0.36], crack: 3.0, spark: [3.0, 1.2, 0.3], sparkK: 1, mobs: ['daemon', 'gefallener', 'skelett'] },
  ],
  sparks: { n: 420, box: 60, height: 12, size: 0.12, maxPx: 6, seeR: 30 },
};

let floor = 0;
const F = () => KA.floors[floor];
let tinted: THREE.InstancedMesh[] = [], cracks: THREE.Mesh | null = null, seams: THREE.Mesh | null = null, sparks: { pts: THREE.Points; uniforms: any } | null = null;

function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const colored = (parts: [any, number][]) => mergeGeometries(parts.map(([g, hex]) => paint(g, hex)));

// Glut-Risse: Zickzack-Bänder flach am Boden, ein Mesh, Farbe kommt aus material.color (Etage)
function makeCracks() {
  const pos: number[] = [], idx: number[] = [];
  const quad = (ax, az, bx, bz, w) => {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w, nz = dx / l * w, i = pos.length / 3;
    pos.push(ax + nx, 0.04, az + nz, ax - nx, 0.04, az - nz, bx + nx, 0.04, bz + nz, bx - nx, 0.04, bz - nz);
    idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
  };
  for (let k = 0; k < 70; k++) {
    let a = rand(0, Math.PI * 2), r = rand(10, R - 6), x = Math.cos(a) * r, z = Math.sin(a) * r, dir = rand(0, Math.PI * 2);
    for (let s = 0, n = Math.floor(rand(4, 9)); s < n; s++) {
      dir += rand(-0.9, 0.9);
      const l = rand(1.2, 3), nx = x + Math.cos(dir) * l, nz = z + Math.sin(dir) * l;
      quad(x, z, nx, nz, rand(0.06, 0.16) * (1 - s / n * 0.6));
      x = nx; z = nz;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff6a1a, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.renderOrder = 1;
  return mesh;
}

// Fugen der Bodenfliesen: dünne Linien im 4-yd-Raster innerhalb der Wand. Eigenes Mesh, weil das Gelände-Raster (~2,3 yd) zu grob für Fliesen ist
function makeSeams() {
  const pos: number[] = [], idx: number[] = [], w = 0.07, step = 4;
  const quad = (ax, az, bx, bz, alongX) => {
    const i = pos.length / 3, ox = alongX ? 0 : w, oz = alongX ? w : 0;
    pos.push(ax - ox, 0.03, az - oz, ax + ox, 0.03, az + oz, bx - ox, 0.03, bz - oz, bx + ox, 0.03, bz + oz);
    idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
  };
  for (let v = -R + step; v < R; v += step) {
    const half = Math.sqrt(R * R - v * v);
    quad(-half, v, half, v, true);
    quad(v, -half, v, half, false);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
}

// Asche und Funken steigen auf; Farbe und Menge je Etage über Uniforms
function makeSparks() {
  const S = KA.sparks, pos = new Float32Array(S.n * 3), seed = new Float32Array(S.n);
  for (let i = 0; i < S.n; i++) { pos.set([rand(0, S.box), rand(0, S.height), rand(0, S.box)], i * 3); seed[i] = rand(0, 6.28); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color() }, uK: { value: 0.3 } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uK; attribute float seed; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.8 + 1.6 * fract(seed * 1.7)) * uK, ${S.height.toFixed(1)});
        p.x += sin(uTime * 0.9 + seed * 3.0) * 0.8; p.z += cos(uTime * 0.7 + seed * 2.0) * 0.8;
        vec3 w = vec3(uCenter.x + mod(p.x - uCenter.x, ${S.box.toFixed(1)}) - ${(S.box / 2).toFixed(1)}, uCenter.y - 1.0 + p.y,
                      uCenter.z + mod(p.z - uCenter.z, ${S.box.toFixed(1)}) - ${(S.box / 2).toFixed(1)});
        vA = smoothstep(${S.seeR.toFixed(1)}, ${(S.seeR * 0.4).toFixed(1)}, distance(w.xz, uCenter.xz)) * smoothstep(${S.height.toFixed(1)}, 2.0, p.y)
           * step(fract(seed * 5.3), uK);                     // weniger Funken auf den oberen Etagen
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_PointSize = min(${S.size.toFixed(2)} * 900.0 / -mv.z, ${S.maxPx.toFixed(1)});
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor * vA * smoothstep(0.5, 0.05, d), 1.0);
      }`,
  }));
  pts.frustumCulled = false;
  return { pts, uniforms };
}

function cathedralProps(ctx) {
  tinted = [];
  const mat = toonMat({ vertexColors: true, shade: 0x7a86b0 });
  const keep = list => { tinted.push(...list); return list; };

  // Außenwand: Ring aus Blöcken mit Strebepfeilern
  const N = Math.round(R * 2 * Math.PI / 6), segW = R * 2 * Math.PI / N + 0.4;
  const wall = colored([[box(segW, 16, 2.4, 0, 8, 0), 0x5a5e6a], [box(1.6, 18, 3.4, segW / 2, 9, -0.4), 0x4a4e5a], [box(segW, 1.2, 2.8, 0, 16.4, 0), 0x6a6e7a]]);
  const walls = Array.from({ length: N }, (_, i) => { const a = i / N * Math.PI * 2; return { x: Math.cos(a) * (R + 1.2), z: Math.sin(a) * (R + 1.2), ry: -a + Math.PI / 2 }; });
  for (const w of walls) ctx.solid(w.x, w.z, segW, 2.4, w.ry);
  keep(ctx.place([{ geo: wall, mat }], walls));

  // Säulen in drei Ringen
  const pillar = colored([[box(2, 0.8, 2, 0, 0.4, 0), 0x5a5e6a], [cyl(0.7, 0.8, 9, 0, 5.2, 0, 0, 0, 0, 10), 0x787c88], [box(2.2, 0.9, 2.2, 0, 10.1, 0), 0x5a5e6a]]);
  const pillars = [];
  for (const [rr, n] of [[R * 0.28, 8], [R * 0.52, 14], [R * 0.78, 20]] as [number, number][])
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; pillars.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, ry: a }); }
  for (const p of pillars) ctx.circle(p.x, p.z, 1);
  keep(ctx.place([{ geo: pillar, mat }], pillars));

  // Bänke in 8 Sektoren zwischen den Gängen, quer zur Mitte
  const bench = colored([[box(4, 0.15, 0.8, 0, 0.6, 0), 0x5a3a26], [box(4, 0.9, 0.12, 0, 1.0, 0.4), 0x4a2e1e], [box(0.15, 0.6, 0.7, -1.8, 0.3, 0), 0x3a2418], [box(0.15, 0.6, 0.7, 1.8, 0.3, 0), 0x3a2418]]);
  const benches = [];
  for (let s = 0; s < 8; s++) {
    const a = (s + 0.5) / 8 * Math.PI * 2;
    for (let r = 16; r < R * 0.72; r += 5.5) if (Math.random() < 0.8) benches.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ry: -a + Math.PI / 2 + rand(-0.06, 0.06) });
  }
  for (const b of benches) ctx.solid(b.x, b.z, 4, 0.9, b.ry, 1.2);
  keep(ctx.place([{ geo: bench, mat }], benches));

  // Altar in der Mitte: Stufen, Block, zwei hohe Leuchter
  const altar = colored([[cyl(6, 6.4, 0.5, 0, 0.25, 0, 0, 0, 0, 16), 0x4a4e5a], [cyl(4.4, 4.6, 0.5, 0, 0.75, 0, 0, 0, 0, 16), 0x5a5e6a], [box(4, 1.4, 1.8, 0, 1.7, 0), 0x6a6e7a],
    [box(4.6, 0.25, 2.3, 0, 2.5, 0), 0x2a1a1a], [cyl(0.12, 0.2, 3.6, -2.6, 2.3, 0), 0x8a7a50], [cyl(0.12, 0.2, 3.6, 2.6, 2.3, 0), 0x8a7a50]]);
  ctx.circle(0, 0, 3.2, 2.6);
  keep(ctx.place([{ geo: altar, mat }], [{ x: 0, z: 0 }]));

  // Kerzen: Wachs (Toon) und Flamme (unbeleuchtet, > 1 = Bloom). Auf dem Altar, an den Säulen, an Bankenden
  const candles = [
    ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return { x: Math.cos(a) * 4.9, z: Math.sin(a) * 4.9, y: 0.5, s: 1.2 }; }),
    { x: -2.6, z: 0, y: 4.1, s: 1.4 }, { x: 2.6, z: 0, y: 4.1, s: 1.4 },
    ...pillars.map(p => ({ x: p.x * 0.97, z: p.z * 0.97, y: 0, s: rand(0.9, 1.3) })),
    ...benches.filter((_, i) => i % 3 === 0).map(b => ({ x: b.x + Math.cos(b.ry) * 2.3, z: b.z - Math.sin(b.ry) * 2.3, y: 0, s: 1 })),
  ];
  keep(ctx.place([{ geo: paint(cyl(0.09, 0.11, 0.6, 0, 0.3, 0, 0, 0, 0, 6), 0xe8dcc0), mat }], candles));
  ctx.place([{ geo: cone(0.09, 0.32, 0, 0.78, 0, 0, 0, 0, 5), mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.5, 0.4), fog: false }) }], candles);

  seams = makeSeams();
  ctx.add(seams);
  cracks = makeCracks();
  ctx.add(cracks);
  sparks = makeSparks();
  ctx.add(sparks.pts);
  applyFloor(floorFromKills(), false);
}

const floorFromKills = () => clamp(Math.floor((player.kills || 0) / KA.killsPerFloor), 0, KA.floors.length - 1);   // beim ersten Aufbau gibt es player.kills noch nicht
const tmp = new THREE.Color();
function applyFloor(i, announce) {
  floor = i;
  const f = F();
  kathedrale.mobs = f.mobs;                                    // Spawn-Tabelle der Etage (mobs.ts liest zone.mobs)
  recolorGround();
  tmp.setRGB(f.tint[0], f.tint[1], f.tint[2]);
  for (const m of tinted) { for (let k = 0; k < m.count; k++) m.setColorAt(k, tmp); m.instanceColor.needsUpdate = true; }
  if (seams) (seams.material as THREE.MeshBasicMaterial).color.setHex(f.seam);
  if (cracks) { cracks.visible = f.crack > 0; (cracks.material as THREE.MeshBasicMaterial).color.setRGB(f.crack, f.crack * 0.38, f.crack * 0.08); }
  if (sparks) { sparks.uniforms.uColor.value.setRGB(f.spark[0], f.spark[1], f.spark[2]); sparks.uniforms.uK.value = f.sparkK; }
  if (announce) { state.newMob = { text: t('msg.stairs', { name: f.name }), at: state.now }; shakeCamera(0.5); }
}

export const kathedrale: any = {
  name: t('zone.kathedrale.name'),
  toon: true,
  env: {   // PH: im Dunkel-Modus übersteuert dunkel.ts Himmel und Nebel
    fog: 0x10121a, fogNear: 30, fogFar: 130,
    top: 0x04050a, mid: 0x0a0c14, sunDisc: 0,
    sky: 0x8a90b0, ground: 0x1a1414, hemi: 1.2,
    sun: 0xc8ccff, sunPower: 0.9, sunPos: [30, 80, 40],
  },
  height: () => 0,   // ebener Kirchenboden
  ground(c, x, z) {   // Stein in den Farben der Etage, Fugen kommen aus makeSeams
    const f = F(), n = Math.sin(x * 0.09) * Math.cos(z * 0.08) + Math.sin(x * 0.031 + z * 0.037);
    c.setHex(f.tileA).lerp(tmp.setHex(f.tileB), clamp(0.5 + n * 0.3, 0, 1)).multiplyScalar(0.94 + rand(0, 0.08));
    if (Math.hypot(x, z) > R) c.setHex(f.seam);
  },
  props: cathedralProps,
  update() {
    if (!sparks) return;
    const i = floorFromKills();
    if (i !== floor) applyFloor(i, i > floor);
    sparks.uniforms.uTime.value = state.now / 1000;
    sparks.uniforms.uCenter.value.copy(player.pos);
  },
  leave() { tinted = []; cracks = null; seams = null; sparks = null; floor = 0; },
  edgeR: R - 6,   // Wellen kommen innen an der Wand, nicht vom Kartenrand (waves.ts)
  spawnOk: (x, z) => Math.hypot(x, z) < R - 4 && Math.hypot(x, z) > 8,
  spawn: { x: 0, z: 10 },
  mobs: KA.floors[0].mobs,
  packs: { count: 11, initialMobs: 32, sizeBonus: 0 },   // PH
};
