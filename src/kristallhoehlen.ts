// Kristallhöhlen: dritte Anime-Map (docs/map-konzepte-anime.md). Dunkles Violett, leuchtende Kristalle in Türkis und Pink mit harten Farbbändern,
// Stalagmiten, Leuchtpilze, schwebende Sporen. Kristalle spiegeln Einzelziel-Geschosse (spells/core.ts bounceShot), höchstens einmal pro Schuss.
// Umgebung: Gelände, Stalagmiten, Pilze, Kristalle Türkis, Kristalle Pink, Sporen = 6 Draw Calls. Alle Zahlen // PH.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, rand } from './util';
import { state, player } from './state';
import { cone, cyl, ball, scatter } from './props';
import { toonMat } from './toon';
import { t } from './i18n';

const KH = {
  shade: 0x7a5ac8,
  // Kristallfarben in 3 harten Bändern (unten → oben), Werte > 1 = Bloom
  teal: [[0.05, 0.35, 0.45], [0.2, 1.3, 1.4], [0.8, 2.4, 2.3]],
  pink: [[0.4, 0.05, 0.3], [1.5, 0.35, 1.2], [2.5, 1.2, 2.2]],
  clusters: 34, clusterR: [1.4, 2.6],
  bounce: { cone: 0.6, range: 26 },              // gespiegeltes Geschoss sucht ein Ziel in diesem Kegel (cos ≈ 53°) und dieser Reichweite
  spores: { n: 320, box: 70, height: 6, size: 0.16, maxPx: 7, seeR: 34 },
};

// Kristalle der aktuellen Karte für die Spiegelung: { x, z, r }
export const crystals: { x: number; z: number; r: number }[] = [];

// Gestrecktes Oktaeder mit harten Bändern: Farbe je Dreieck nach der Höhe seiner Mitte
function shard(h, w, x, z, tilt, ry, pal) {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(w, h, w);
  g.translate(0, h * 0.6, 0);
  g.rotateZ(tilt); g.rotateY(ry); g.translate(x, 0, z);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, band = y < h * 0.35 ? 0 : y < h * 0.9 ? 1 : 2;
    for (let k = 0; k < 3; k++) col.set(pal[band], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}
function cluster(pal) {
  const parts = [shard(2.6, 0.55, 0, 0, 0, 0, pal)];
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + rand(-0.4, 0.4); parts.push(shard(rand(1.1, 1.9), rand(0.3, 0.45), Math.cos(a) * 0.55, Math.sin(a) * 0.55, rand(0.3, 0.6), a, pal)); }
  return mergeGeometries(parts);
}

function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const colored = (parts: [any, number][]) => mergeGeometries(parts.map(([g, hex]) => paint(g, hex)));

function makeSpores() {
  const S = KH.spores, pos = new Float32Array(S.n * 3), seed = new Float32Array(S.n);
  for (let i = 0; i < S.n; i++) { pos.set([rand(0, S.box), rand(0.2, S.height), rand(0, S.box)], i * 3); seed[i] = rand(0, 6.28); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; uniform vec3 uCenter; attribute float seed; varying float vA; varying float vS;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.15 + 0.1 * fract(seed)), ${S.height.toFixed(1)});   // steigen langsam
        p.x += sin(uTime * 0.2 + seed * 2.0) * 1.5; p.z += cos(uTime * 0.17 + seed * 3.0) * 1.5;
        vec3 w = vec3(uCenter.x + mod(p.x - uCenter.x, ${S.box.toFixed(1)}) - ${(S.box / 2).toFixed(1)}, uCenter.y - 0.5 + p.y,
                      uCenter.z + mod(p.z - uCenter.z, ${S.box.toFixed(1)}) - ${(S.box / 2).toFixed(1)});
        vA = smoothstep(${S.seeR.toFixed(1)}, ${(S.seeR * 0.4).toFixed(1)}, distance(w.xz, uCenter.xz)) * (0.5 + 0.5 * sin(uTime * 1.7 + seed * 5.0));
        vS = fract(seed * 2.3);
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_PointSize = min(${S.size.toFixed(2)} * 900.0 / -mv.z, ${S.maxPx.toFixed(1)});
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying float vS;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        vec3 c = mix(vec3(0.3, 1.6, 1.5), vec3(1.6, 0.5, 1.4), step(0.5, vS));
        gl_FragColor = vec4(c * vA * smoothstep(0.5, 0.0, d), 1.0);
      }`,
  }));
  pts.frustumCulled = false;
  return { pts, uniforms };
}
let spores: ReturnType<typeof makeSpores> | null = null;

function caveProps(ctx) {
  crystals.length = 0;
  const free = (x, z) => Math.hypot(x, z) > 9;
  const mat = toonMat({ vertexColors: true, shade: KH.shade });

  // Kristall-Cluster, halb türkis, halb pink. Unbeleuchtet: sie leuchten selbst
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });   // leuchten auch im Dunkel-Nebel
  const spots = scatter(KH.clusters, 12, 88, free).map(p => ({ ...p, s: rand(KH.clusterR[0], KH.clusterR[1]) / 2, ry: rand(0, 6) }));
  const far = scatter(90, 98, 165).map(p => ({ ...p, s: rand(1, 2.4), ry: rand(0, 6) }));
  for (const p of spots) { crystals.push({ x: p.x, z: p.z, r: 1.1 * p.s }); ctx.circle(p.x, p.z, 1.1 * p.s, 2.6 * p.s); }
  const all = [...spots, ...far];
  ctx.place([{ geo: cluster(KH.teal), mat: glow }], all.filter((_, i) => i % 2 === 0));
  ctx.place([{ geo: cluster(KH.pink), mat: glow }], all.filter((_, i) => i % 2 === 1));

  // Stalagmiten: zwei Kegel übereinander
  const stal = colored([[cone(0.9, 3.4, 0, 1.7, 0, 0, 0, 0, 7), 0x3a2a52], [cone(0.5, 2.2, 0.5, 1.1, 0.3, 0.1, 0, 0.15, 6), 0x4a3866]]);
  const stals = scatter(55, 10, 90, free).map(p => ({ ...p, s: rand(0.7, 1.6), ry: rand(0, 6) }));
  for (const s of stals) ctx.circle(s.x, s.z, 0.8 * s.s, 3.4 * s.s);
  ctx.place([{ geo: stal, mat }], [...stals, ...scatter(180, 98, 165).map(p => ({ ...p, s: rand(1, 2.4), ry: rand(0, 6) }))]);

  // Leuchtpilze in Gruppen: Stiel und Hut, der Hut glüht schwach (emissive)
  const shroom = colored([[cyl(0.08, 0.12, 0.7, 0, 0.35, 0), 0xd8d0e8], [ball(0.38, 0, 0.75, 0, 1, 0.45, 1), 0x6ad8e0]]);
  const shrooms = [];
  for (const c of scatter(30, 8, 88, free)) for (let i = 0; i < 6; i++) shrooms.push({ x: c.x + rand(-1.6, 1.6), z: c.z + rand(-1.6, 1.6), s: rand(0.6, 1.5), ry: rand(0, 6) });
  ctx.place([{ geo: shroom, mat: toonMat({ vertexColors: true, shade: KH.shade, emissive: 0x1a4a58 }) }], shrooms);

  spores = makeSpores();
  ctx.add(spores.pts);
}

// Spiegelung: erster Kristall auf der Strecke from → Ziel. Gibt { at, target } (target null = geschluckt) oder null ohne Kristall
export function reflectShot(from, mob) {
  const dx = mob.pos.x - from.x, dz = mob.pos.z - from.z, len = Math.hypot(dx, dz);
  if (len < 0.5) return null;
  const ux = dx / len, uz = dz / len;
  let best = null, bestT = len;
  for (const c of crystals) {
    const fx = c.x - from.x, fz = c.z - from.z, t = fx * ux + fz * uz;       // Projektion der Kristallmitte auf die Strecke
    if (t <= 0 || t >= bestT) continue;
    const off2 = fx * fx + fz * fz - t * t;
    if (off2 > c.r * c.r) continue;
    const tIn = t - Math.sqrt(c.r * c.r - off2);                             // Eintrittspunkt in den Kreis
    if (tIn > 0 && tIn < bestT) { bestT = tIn; best = c; }
  }
  if (!best) return null;
  const at = { x: from.x + ux * bestT, y: mob.pos.y + 1, z: from.z + uz * bestT };
  const nx = (at.x - best.x) / best.r, nz = (at.z - best.z) / best.r, dot = ux * nx + uz * nz;
  const rx = ux - 2 * dot * nx, rz = uz - 2 * dot * nz;                       // gespiegelte Richtung
  let target = null, bestD = KH.bounce.range;
  for (const m of state.mobs) {
    if (m.dead || m === mob) continue;
    const ex = m.pos.x - at.x, ez = m.pos.z - at.z, d = Math.hypot(ex, ez);
    if (d < 0.5 || d > bestD || (ex * rx + ez * rz) / d < KH.bounce.cone) continue;
    bestD = d; target = m;
  }
  return { at, target };
}

export const kristallhoehlen = {
  name: t('zone.kristall.name'),
  toon: true,
  env: {   // PH: im Dunkel-Modus übersteuert dunkel.ts Himmel und Nebel
    fog: 0x120a24, fogNear: 25, fogFar: 110,
    top: 0x05020c, mid: 0x0e0620, sunDisc: 0,
    sky: 0x6a4ab0, ground: 0x140a24, hemi: 1.1,
    sun: 0xb89aff, sunPower: 0.8, sunPos: [30, 70, 20],
  },
  height(x, z) {
    return 0.9 * Math.sin(x * 0.06) * Math.cos(z * 0.05) + 0.5 * Math.sin(x * 0.13 + z * 0.11) + 0.25 * Math.sin(z * 0.3 - x * 0.2);
  },
  ground: (() => {
    const a = new THREE.Color(0x24183a), b = new THREE.Color(0x342552), teal = new THREE.Color(0x1f4a58), pink = new THREE.Color(0x4a2048);
    return (c, x, z) => {
      const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) + Math.sin(x * 0.037 + z * 0.043);
      c.copy(a).lerp(b, clamp(0.45 + n * 0.3 + rand(-0.06, 0.06), 0, 1));
      if (n > 1.2) c.lerp(teal, 0.35); else if (n < -1.3) c.lerp(pink, 0.35);
    };
  })(),
  props: caveProps,
  update() {
    if (!spores) return;
    spores.uniforms.uTime.value = state.now / 1000;
    spores.uniforms.uCenter.value.copy(player.pos);
  },
  leave() { crystals.length = 0; spores = null; },
  reflect: (from, mob) => reflectShot(from, mob),
  spawn: { x: 0, z: 0 },
  mobs: ['kristallgolem', 'hoehlenfledermaus'],
  packs: { count: 11, initialMobs: 32, sizeBonus: 0 },   // PH
};
