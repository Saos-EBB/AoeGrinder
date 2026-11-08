// Mondsee: zweite Anime-Map (docs/map-konzepte-anime.md). Nacht, riesiger Mond, schwarzes Wasser mit Mond-Spiegelstreifen,
// Stege, Steinlaternen, Tore, tote Bäume, Geisterlichter. Mondphase wechselt alle MS.phaseMs: Vollmond doppelte Packs, Neumond Champions.
// Umgebung: Gelände, Wasser, Mond, Bäume, Stege, Tore, Laternen, Laternen-Licht, Geisterlichter = 9 Draw Calls. Alle Zahlen // PH.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, rand, lerpTo } from './util';
import { WORLD_K } from './config';
import { state, player } from './state';
import { camera } from './render';
import { box, cyl, scatter } from './props';
import { toonMat } from './toon';
import { t } from './i18n';

const MS = {
  lake: { x: 0, z: -70, rx: 70, rz: 46 },       // Ellipse, der See liegt nördlich der Mitte
  waterY: -1.4,
  moon: { dir: new THREE.Vector3(0.05, 0.17, -1).normalize(), dist: 150, size: 95 },   // tief am Horizont (Kamera blickt im Dunkel-Modus nach unten), vor den Randbergen (ab ~180 yd)
  shade: 0x6a78c8,                               // Halbton und Schatten in Nachtblau
  // Phasen in dieser Reihenfolge ab Run-Start (zunehmend zuerst, damit man den Mond sieht), jede phaseMs lang. packMul: Mob-Dichte, champ: Champion-Chance je Pack (statt 20 %), fog: Nebel dazu
  phaseMs: 180000,
  phases: [
    { name: t('moon.0.name'), moon: 0.25, packMul: 1, champ: null, fog: 0.004, text: t('moon.0.text') },
    { name: t('moon.1.name'), moon: 0.5, packMul: 2, champ: null, fog: -0.008, text: t('moon.1.text') },
    { name: t('moon.2.name'), moon: 0.75, packMul: 1, champ: null, fog: 0.004, text: t('moon.2.text') },
    { name: t('moon.3.name'), moon: 0.0, packMul: 1, champ: 0.6, fog: 0.012, text: t('moon.3.text') },
  ],
  lights: { n: 260, box: 90, height: 5, size: 0.22, maxPx: 9, seeR: 42 },
};
const lakeK = (x, z) => Math.hypot((x - MS.lake.x) / MS.lake.rx, (z - MS.lake.z) / MS.lake.rz);   // < 1 = im See
const inLake = (x, z, pad = 0) => lakeK(x, z) < 1 + pad / MS.lake.rx;

function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const colored = (parts: [any, number][]) => mergeGeometries(parts.map(([g, hex]) => paint(g, hex)));

// Mond: Billboard mit harten Bändern, Phase schiebt eine Schattenscheibe über die Scheibe. Steht immer in MS.moon.dist vor der Kamera
function makeMoon() {
  const uniforms = { uPhase: { value: 0.5 } };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uPhase; varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float halo = smoothstep(1.0, 0.36, r) * 0.22;
        if (r > 0.36) { if (halo < 0.01) discard; gl_FragColor = vec4(vec3(0.55, 0.62, 1.0) * halo, halo); return; }
        vec2 q = p / 0.36;
        float off = (1.0 - abs(uPhase * 2.0 - 1.0)) * 2.2 * (uPhase < 0.5 ? 1.0 : -1.0);   // 0 = Neumond, 0,5 = voll
        float lit = step(1.0, length(q - vec2(off, 0.0))) ;
        float band = q.y > 0.35 - q.x * 0.2 ? 1.0 : 0.82;                                   // harte Licht-Stufe (Anime)
        float crater = step(0.2, length(q - vec2(-0.3, -0.25))) * step(0.13, length(q - vec2(0.35, 0.2)));
        vec3 c = vec3(1.0, 0.96, 0.82) * band * mix(0.8, 1.0, crater) * 1.05;               // knapp über 1: leichter Bloom, Stufen bleiben sichtbar
        vec3 dark = vec3(0.05, 0.06, 0.13);
        gl_FragColor = vec4(mix(dark, c, lit), 1.0);
      }`,
  }));
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// Schwarzes Wasser: Spiegelstreifen zur Kamera hin unter dem Mond, gebrochen von Wellen
function makeWater(uMoon) {
  const uniforms = { uTime: { value: 0 }, uMoonDir: { value: MS.moon.dir }, uPhase: uMoon };
  const geo = new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
  geo.scale(MS.lake.rx + 6, 1, MS.lake.rz + 6);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform vec3 uMoonDir; uniform float uPhase; varying vec3 vW;
      void main() {
        vec2 toFrag = normalize(vW.xz - cameraPosition.xz), toMoon = normalize(uMoonDir.xz);
        float along = dot(toFrag, toMoon), side = toFrag.x * toMoon.y - toFrag.y * toMoon.x;
        float wave = sin(vW.x * 0.9 + uTime * 1.3) * sin(vW.z * 1.3 - uTime * 0.9);
        float width = 0.03 + 0.05 * smoothstep(0.0, 60.0, distance(vW.xz, cameraPosition.xz));
        float streak = step(abs(side + wave * 0.012), width) * step(0.0, along) * step(0.35, fract(vW.z * 0.35 + wave * 0.4));
        float full = 1.0 - abs(uPhase * 2.0 - 1.0);   // Neumond: kein Streifen
        vec3 c = vec3(0.012, 0.018, 0.045) + vec3(0.02, 0.03, 0.07) * step(0.6, wave);
        c += vec3(1.0, 0.95, 0.8) * streak * (0.4 + 1.4 * full);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  mesh.position.set(MS.lake.x, MS.waterY, MS.lake.z);
  return { mesh, uniforms };
}

// Geisterlichter: schweben, blinken, wandern mit der Figur mit (Positionen werden um sie herum gefaltet)
function makeLights() {
  const L = MS.lights, pos = new Float32Array(L.n * 3), seed = new Float32Array(L.n);
  for (let i = 0; i < L.n; i++) { pos.set([rand(0, L.box), rand(0.3, L.height), rand(0, L.box)], i * 3); seed[i] = rand(0, 6.28); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; uniform vec3 uCenter; attribute float seed; varying float vA; varying float vS;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.31 + seed * 2.0) * 2.5; p.z += cos(uTime * 0.27 + seed * 3.0) * 2.5; p.y += sin(uTime * 0.8 + seed) * 0.5;
        vec3 w = vec3(uCenter.x + mod(p.x - uCenter.x, ${L.box.toFixed(1)}) - ${(L.box / 2).toFixed(1)}, uCenter.y - 1.0 + p.y,
                      uCenter.z + mod(p.z - uCenter.z, ${L.box.toFixed(1)}) - ${(L.box / 2).toFixed(1)});
        float blink = smoothstep(0.2, 1.0, sin(uTime * (1.2 + fract(seed) * 1.5) + seed * 7.0));
        vA = blink * smoothstep(${L.seeR.toFixed(1)}, ${(L.seeR * 0.5).toFixed(1)}, distance(w.xz, uCenter.xz));
        vS = fract(seed * 3.7);
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_PointSize = min(${L.size.toFixed(2)} * 900.0 / -mv.z, ${L.maxPx.toFixed(1)});
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying float vS;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        vec3 c = mix(vec3(0.75, 1.0, 0.45), vec3(0.45, 0.8, 1.0), step(0.6, vS)) * 2.0;   // Glühwürmchen oder Geisterlicht
        gl_FragColor = vec4(c * vA * smoothstep(0.5, 0.0, d), 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, uniforms };
}

let fx: { moon: ReturnType<typeof makeMoon>; water: ReturnType<typeof makeWater>; lights: ReturnType<typeof makeLights> } | null = null;
let phaseIdx = -1;

function moonProps(ctx) {
  const shore = (x, z) => !inLake(x, z, 4) && Math.hypot(x, z) > 8;
  const mat = toonMat({ vertexColors: true, shade: MS.shade });

  // Tote Bäume: Stamm und kahle Äste
  const tree = colored([
    [cyl(0.25, 0.42, 3.2, 0, 1.6, 0, 0, 0, 0.1), 0x4a4652], [cyl(0.1, 0.18, 1.8, -0.5, 3.4, 0, 0, 0, 0.7), 0x4a4652],
    [cyl(0.08, 0.15, 1.6, 0.5, 3.2, 0.2, 0.4, 0, -0.8), 0x3e3a46], [cyl(0.05, 0.1, 1.2, 0.1, 4.2, -0.3, -0.6, 0, 0.2), 0x3e3a46],
  ]);
  const trees = scatter(46, 12, 90, shore).map(p => ({ ...p, s: rand(0.9, 1.6), ry: rand(0, 6) }));
  for (const t of trees) ctx.obstacle(t.x, t.z, 0.4 * t.s);
  ctx.place([{ geo: tree, mat }], [...trees, ...scatter(160, 98, 165, shore).map(p => ({ ...p, s: rand(1.2, 2.2), ry: rand(0, 6) }))]);

  // Holzstege vom Ufer in den See, Planken auf Pfählen
  const jetty = colored([
    ...Array.from({ length: 9 }, (_, i) => [box(2.2, 0.12, 0.7, 0, 0.5, i * 0.85, 0, rand(-0.04, 0.04), 0), i % 2 ? 0x6a4a2e : 0x5a3e26] as [any, number]),
    ...[0, 3.4, 6.8].flatMap(zz => [[cyl(0.1, 0.1, 2.6, -1, -0.6, zz), 0x3a2a1c], [cyl(0.1, 0.1, 2.6, 1, -0.6, zz), 0x3a2a1c]] as [any, number][]),
  ]);
  const jetties = [0.2, 1.3, 2.6, 3.9, 5.1].map(a => {   // Winkel am Seeufer, Steg zeigt zur Seemitte
    const x = MS.lake.x + Math.cos(a) * MS.lake.rx * 0.97, z = MS.lake.z + Math.sin(a) * MS.lake.rz * 0.97;
    return { x, z, y: MS.waterY + 0.3 - ctx.heightAt(x, z), ry: Math.atan2(MS.lake.x - x, MS.lake.z - z) };
  });
  ctx.place([{ geo: jetty, mat }], jetties);

  // Tore (Torii-artig): zwei rote Pfosten, schwarzer geschwungener Balken, roter Querbalken
  const gate = colored([
    [cyl(0.28, 0.32, 5, -2.2, 2.5, 0, 0, 0, 0, 10), 0xc22a2a], [cyl(0.28, 0.32, 5, 2.2, 2.5, 0, 0, 0, 0, 10), 0xc22a2a],
    [box(6.6, 0.4, 0.6, 0, 5.2, 0), 0x18141c], [box(5.6, 0.3, 0.4, 0, 4.2, 0), 0xc22a2a], [box(0.4, 1, 0.3, 0, 4.7, 0), 0xc22a2a],
  ]);
  const gates = [{ x: 0, z: -18, ry: 0 }, { x: -60, z: -30, ry: 0.9 }, { x: 62, z: -28, ry: -0.9 }, { x: 0, z: 40, ry: 0 }];
  for (const g of gates) for (const sx of [-2.2, 2.2]) ctx.circle(g.x + Math.cos(g.ry) * sx, g.z - Math.sin(g.ry) * sx, 0.35);
  ctx.place([{ geo: gate, mat }], gates);

  // Steinlaternen am Ufer und an den Wegen, Kern leuchtet (eigenes Material ohne Licht, > 1 für Bloom)
  const lantern = colored([
    [cyl(0.5, 0.6, 0.3, 0, 0.15, 0, 0, 0, 0, 6), 0x7a7c86], [cyl(0.16, 0.2, 1.0, 0, 0.8, 0, 0, 0, 0, 6), 0x6c6e78],
    [box(0.75, 0.12, 0.75, 0, 1.36, 0), 0x7a7c86], [box(0.12, 0.45, 0.12, -0.28, 1.64, -0.28), 0x6c6e78], [box(0.12, 0.45, 0.12, 0.28, 1.64, 0.28), 0x6c6e78],
    [box(0.12, 0.45, 0.12, -0.28, 1.64, 0.28), 0x6c6e78], [box(0.12, 0.45, 0.12, 0.28, 1.64, -0.28), 0x6c6e78],
    [cyl(0.05, 0.7, 0.5, 0, 2.12, 0, 0, Math.PI / 4, 0, 4), 0x5a5c66],
  ]);
  const lanterns = [
    ...Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return { x: MS.lake.x + Math.cos(a) * (MS.lake.rx + 7), z: MS.lake.z + Math.sin(a) * (MS.lake.rz + 7), ry: a }; }),
    ...scatter(14, 14, 80, shore).map(p => ({ ...p, ry: rand(0, 6) })),
  ].filter(p => Math.hypot(p.x, p.z) < 84 * WORLD_K);
  for (const l of lanterns) ctx.circle(l.x, l.z, 0.55, 2.2);
  ctx.place([{ geo: lantern, mat }], lanterns);
  ctx.place([{ geo: box(0.4, 0.38, 0.4, 0, 1.64, 0), mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.6), fog: false }) }], lanterns);

  const moon = makeMoon(), water = makeWater(moon.uniforms.uPhase), lights = makeLights();
  ctx.add(water.mesh); ctx.add(moon.mesh); ctx.add(lights.pts);
  fx = { moon, water, lights };
  phaseIdx = -1;
}

function setPhase(i, announce) {
  const P = MS.phases[i];
  phaseIdx = i;
  state.packMul = P.packMul;
  state.champChance = P.champ;
  state.fogExtra = P.fog;
  if (announce) state.newMob = { text: P.text, at: state.now };
}
export const moonPhase = () => MS.phases[Math.max(0, phaseIdx)];

export const mondsee = {
  name: t('zone.mondsee.name'),
  toon: true,
  env: {   // PH: im Dunkel-Modus übersteuert dunkel.ts Himmel und Nebel
    fog: 0x0a1028, fogNear: 30, fogFar: 140,
    top: 0x02040e, mid: 0x0a1230, sunDisc: 0,
    sky: 0x5868b0, ground: 0x10142a, hemi: 1.2,
    sun: 0xc8d4ff, sunPower: 1.0, sunPos: [20, 60, -120],
  },
  height(x, z) {
    let h = 1.4 * Math.sin(x * 0.035) * Math.cos(z * 0.03) + 0.6 * Math.sin(x * 0.08 + z * 0.06);
    const k = lakeK(x, z);
    if (k < 1.25) h = lerpTo(h, MS.waterY - 1.6, clamp((1.25 - k) / 0.35, 0, 1));
    return h;
  },
  ground: (() => {
    const a = new THREE.Color(0x2a3350), b = new THREE.Color(0x3a4468), moss = new THREE.Color(0x26402e), mud = new THREE.Color(0x14161e);
    return (c, x, z, h) => {
      const n = Math.sin(x * 0.12) * Math.cos(z * 0.1) + Math.sin(x * 0.033 + z * 0.041);
      c.copy(a).lerp(b, clamp(0.45 + n * 0.3 + rand(-0.06, 0.06), 0, 1));
      if (n > 1.1) c.lerp(moss, 0.5);
      if (h < MS.waterY + 0.8) c.lerp(mud, clamp((MS.waterY + 0.8 - h) * 0.8, 0, 1));
    };
  })(),
  props: moonProps,
  update() {
    if (!fx) return;
    const i = Math.floor(state.now / MS.phaseMs) % MS.phases.length;
    if (i !== phaseIdx) setPhase(i, phaseIdx >= 0);
    const t = state.now / 1000, ph = MS.phases[i].moon;
    fx.moon.uniforms.uPhase.value = ph;
    fx.moon.mesh.position.copy(camera.position).addScaledVector(MS.moon.dir, MS.moon.dist);
    fx.moon.mesh.quaternion.copy(camera.quaternion);
    fx.moon.mesh.scale.setScalar(MS.moon.size);
    fx.water.uniforms.uTime.value = t;
    fx.lights.uniforms.uTime.value = t;
    fx.lights.uniforms.uCenter.value.copy(player.pos);
  },
  // Beim Verlassen der Zone (world.ts ruft leave) die Phasen-Werte zurücksetzen
  leave() { fx = null; phaseIdx = -1; state.packMul = 1; state.champChance = null; state.fogExtra = 0; },
  spawnOk: (x, z) => !inLake(x, z, 2),
  spawn: { x: 0, z: 6 },
  mobs: ['ertrunkener', 'geist'],
  packs: { count: 11, initialMobs: 32, sizeBonus: 0 },   // PH
};
