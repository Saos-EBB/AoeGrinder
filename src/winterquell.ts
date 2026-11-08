// Winterquell: erste Anime-Map (docs/map-konzepte-anime.md). Toon-Look immer an, Schnee, Eisseen, auf Eis rutschen Mobs und fliegen doppelt so weit.
// Umgebung in 6 Draw Calls: Gelände, Tannen, Eisblöcke, Steine, Seen, Schnee (Himmel kommt aus render.ts). Alle Zahlen // PH.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, rand, lerpTo } from './util';
import { WORLD_K } from './config';
import { state, player } from './state';
import { box, cyl, cone, scatter } from './props';
import { toonMat } from './toon';
import { t } from './i18n';

const WQ = {
  lakes: [[34, 26, 15], [-46, -18, 19], [8, -58, 12], [-30, 52, 13], [130, -60, 24], [-120, 110, 20], [60, 140, 18]] as [number, number, number][],
  lakeY: -0.7,
  shade: 0x9cb8f0,                              // Halbton und Schatten in Kaltblau
  snow: { n: 800, box: 46, height: 16, fall: 2.2, sway: 0.6, size: 0.11, maxPx: 5, seeR: 20 },   // seeR: Flocken nur im Umkreis sichtbar (Lichtkreis im Dunkel)
  ice: { grip: 1.6, knockMul: 2 },              // grip: wie schnell Mobs auf Eis ihre Richtung ändern (1/s)
};
// Seen außerhalb der Karte fallen weg (WORLD_K 1 = kleine Karte)
const LAKES = WQ.lakes.filter(([x, z]) => Math.hypot(x, z) < 84 * WORLD_K);
const lakeDist = (x, z) => Math.min(...LAKES.map(([cx, cz, r]) => Math.hypot(x - cx, z - cz) - r));
export const onIce = (x, z) => lakeDist(x, z) < 0;

// Geometrie einfärben, damit Teile mit eigener Farbe in einem InstancedMesh landen
function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const colored = (parts: [any, number][]) => mergeGeometries(parts.map(([g, hex]) => paint(g, hex)));

function snowFall() {
  const S = WQ.snow, pos = new Float32Array(S.n * 3), seed = new Float32Array(S.n);
  for (let i = 0; i < S.n; i++) { pos.set([rand(0, S.box), rand(0, S.height), rand(0, S.box)], i * 3); seed[i] = rand(0, 6.28); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: `uniform float uTime; uniform vec3 uCenter; attribute float seed; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * ${S.fall.toFixed(2)} * (0.7 + 0.3 * sin(seed)), ${S.height.toFixed(1)});
        p.x += sin(uTime * 0.7 + seed) * ${S.sway.toFixed(2)};
        p.z += cos(uTime * 0.5 + seed * 1.3) * ${S.sway.toFixed(2)};
        vec3 w = vec3(uCenter.x + mod(p.x - uCenter.x, ${S.box.toFixed(1)}) - ${(S.box / 2).toFixed(1)}, uCenter.y - 4.0 + p.y,
                      uCenter.z + mod(p.z - uCenter.z, ${S.box.toFixed(1)}) - ${(S.box / 2).toFixed(1)});
        vA = smoothstep(${S.seeR.toFixed(1)}, ${(S.seeR * 0.35).toFixed(1)}, distance(w.xz, uCenter.xz)) * smoothstep(${S.height.toFixed(1)}, ${(S.height * 0.4).toFixed(1)}, p.y);   // oben aus: sonst Sterne am schwarzen Himmel
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_PointSize = min(${S.size.toFixed(2)} * 900.0 / -mv.z, ${S.maxPx.toFixed(1)});
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(0.9, 0.95, 1.0, vA * smoothstep(0.5, 0.15, d));
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, uniforms };
}
let snow: ReturnType<typeof snowFall> | null = null;

function winterProps(ctx) {
  const free = (x, z) => lakeDist(x, z) > 3 && Math.hypot(x, z) > 8;
  const mat = toonMat({ vertexColors: true, shade: WQ.shade });

  // Kegel-Tannen mit Schneekappen: Stamm, drei Etagen, auf jeder ein weißer Kegel
  const pine = colored([
    [cyl(0.3, 0.45, 2.2, 0, 1.1, 0), 0x5a3f2a],
    [cone(2.4, 3.2, 0, 3.2, 0, 0, 0, 0, 8), 0x1f4a3c], [cone(1.25, 1.1, 0, 4.35, 0, 0, 0, 0, 8), 0xf2f7ff],
    [cone(1.8, 2.6, 0, 5.0, 0, 0, 0, 0, 8), 0x24563f], [cone(0.95, 0.9, 0, 5.95, 0, 0, 0, 0, 8), 0xf2f7ff],
    [cone(1.15, 2.0, 0, 6.6, 0, 0, 0, 0, 8), 0x2a5f44], [cone(0.55, 0.75, 0, 7.3, 0, 0, 0, 0, 8), 0xffffff],
  ]);
  const pines = scatter(60, 12, 90, free).map(p => ({ ...p, s: rand(0.8, 1.5), ry: rand(0, 6) }));
  for (const t of pines) ctx.obstacle(t.x, t.z, 0.5 * t.s, 2.6 * t.s);
  ctx.place([{ geo: pine, mat }], [...pines, ...scatter(200, 98, 165, free).map(p => ({ ...p, s: rand(1.1, 2), ry: rand(0, 6) }))]);

  // Eisblöcke: schiefe Quader, hell mit kaltem Kern
  const iceMat = toonMat({ vertexColors: true, shade: WQ.shade, rimColor: 0x2a5a8a, emissive: 0x16304a });
  const block = colored([[box(1.6, 1.4, 1.2, 0, 0.7, 0, 0.1, 0, 0.12), 0xbfe6ff], [box(0.9, 1.1, 0.8, 0.9, 0.5, 0.5, -0.2, 0.5, 0), 0x9fd4f5]]);
  const blocks = scatter(26, 10, 90, free).map(p => ({ ...p, s: rand(0.8, 1.8), ry: rand(0, 6) }));
  for (const b of blocks) ctx.circle(b.x, b.z, 1.0 * b.s, 1.4 * b.s);
  ctx.place([{ geo: block, mat: iceMat }], blocks);

  // Steine mit Schneehaube
  const rock = new THREE.DodecahedronGeometry(1), cap = new THREE.DodecahedronGeometry(0.85);
  cap.scale(1, 0.45, 1); cap.translate(0, 0.62, 0);
  const stone = colored([[rock, 0x6f7a8c], [cap, 0xf2f7ff]]);
  const stones = scatter(30, 10, 90, free).map(p => {
    const s = rand(0.7, 1.8);
    ctx.circle(p.x, p.z, s * 0.9, s * 0.9);
    return { ...p, y: 0.2 * s, s, sy: rand(0.6, 0.9), ry: rand(0, 6) };
  });
  ctx.place([{ geo: stone, mat: toonMat({ vertexColors: true, shade: WQ.shade }) }], stones);

  // Eisseen: alle Seen in einem Mesh, halbdurchsichtig, heller Rand
  const lakes = mergeGeometries(LAKES.map(([x, z, r]) => new THREE.CircleGeometry(r + 1.5, 40).rotateX(-Math.PI / 2).translate(x, 0, z)));
  const lake = new THREE.Mesh(lakes, toonMat({ color: 0xbfeaff, transparent: true, opacity: 0.72, depthWrite: false, rimColor: 0xffffff, shade: WQ.shade, emissive: 0x0c2238 }));
  lake.position.y = WQ.lakeY + 0.06;
  lake.renderOrder = 1;
  ctx.add(lake);

  snow = snowFall();
  ctx.add(snow.pts);
}

export const winterquell = {
  name: t('zone.winterquell.name'),
  toon: true,
  env: {   // PH: Anime-Wintermorgen, im Dunkel-Modus übersteuert dunkel.ts Himmel und Nebel
    fog: 0xdfe8f8, fogNear: 45, fogFar: 170,
    top: 0x8fb8ff, mid: 0xf4c8dc, sunDisc: 0,
    sky: 0xeaf2ff, ground: 0x9cb0d0, hemi: 1.5,
    sun: 0xfff0f4, sunPower: 1.6, sunPos: [80, 40, 50],
  },
  height(x, z) {
    let h = 2 * Math.sin(x * 0.03) * Math.cos(z * 0.027) + 0.8 * Math.sin(x * 0.07 + z * 0.05) + 0.4 * Math.sin(z * 0.15 - x * 0.06);
    const d = lakeDist(x, z);
    if (d < 6) h = lerpTo(h, WQ.lakeY, clamp(1 - d / 6, 0, 1));
    return h;
  },
  ground: (() => {
    const a = new THREE.Color(0xf4f8ff), b = new THREE.Color(0xd2e0f4), blue = new THREE.Color(0xa8c2e6), shore = new THREE.Color(0xcfeeff);
    return (c, x, z, h) => {
      const n = Math.sin(x * 0.12) * Math.cos(z * 0.1) + Math.sin(x * 0.035 + z * 0.045);
      c.copy(a).lerp(b, clamp(0.4 + n * 0.3 + rand(-0.06, 0.06), 0, 1));
      if (h < 0) c.lerp(blue, clamp(-h * 0.35, 0, 0.6));      // Mulden kaltblau
      const d = lakeDist(x, z);
      if (d < 3) c.lerp(shore, clamp((3 - d) / 3, 0, 1));
    };
  })(),
  props: winterProps,
  update() {
    if (!snow) return;
    snow.uniforms.uTime.value = state.now / 1000;
    snow.uniforms.uCenter.value.copy(player.pos);
  },
  iceAt: onIce,
  slide: (mob, dt) => slideMob(mob, dt),
  knockMul: (x, z) => iceKnockMul(x, z),
  spawn: { x: 0, z: 0 },
  mobs: ['yeti', 'frostsaebler', 'eulenbestie'],
  packs: { count: 11, initialMobs: 32, sizeBonus: 0 },   // PH
};

// Eis: Mobs rutschen. moveMob setzt nur die Wunsch-Geschwindigkeit (iceWant), slideMob gleitet einmal pro Frame dahin
export function slideMob(mob, dt) {
  if (!onIce(mob.pos.x, mob.pos.z)) { mob.iceV = null; return false; }
  const v = mob.iceV ??= { x: mob.iceWant?.x ?? 0, z: mob.iceWant?.z ?? 0 }, want = mob.iceWant ?? { x: 0, z: 0 }, k = Math.min(1, WQ.ice.grip * dt / 1000);
  v.x += (want.x - v.x) * k; v.z += (want.z - v.z) * k;
  mob.pos.x += v.x * dt / 1000; mob.pos.z += v.z * dt / 1000;
  mob.iceWant = null;
  return true;
}
export const iceKnockMul = (x, z) => onIce(x, z) ? WQ.ice.knockMul : 1;
