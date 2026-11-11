// Energie-Optik aus den Spell-Viewern („Frost Grind – Spell-Viewer“): ein Shader für alle Fähigkeiten.
// Noise läuft durch die Form (Welt- oder Objektkoordinaten), harte 5-Farben-Bänder vom Rand nach innen, Auflösen über uK.
// Meshes kommen aus einem Pool pro Form: das Material entsteht einmal pro Mesh, ein Cast setzt nur Uniforms und Transform.
// Alle Größen und Dauern hier sind Optik, keine Spielregel. // PH

import * as THREE from 'three';
import { scene } from '../render';
import { particles } from '../fx/particles';
import { groundAt } from '../collision';
import { player } from '../state';
import { V, clamp, outC, outBack, rand as rnd } from '../util';

export const TAU = Math.PI * 2;
// clamp, outC, outBack, rnd kommen aus util.ts und werden hier nur weitergereicht (alte Importe aus energy bleiben gültig)
export { clamp, outC, outBack, rnd };
// Bodenhöhe unter p, gesucht ab p.y + up (Treppen, Brücken); bosses/core.ts nimmt up = 2
export const gy = (p, up = 1) => groundAt(p.x, p.z, (p.y ?? 0) + up);
export const onGround = (p, up = 1) => V(p.x, gy(p, up), p.z);
// Flugzeit eines Geschosses von a nach b in s
export const flight = (a: THREE.Vector3, b: THREE.Vector3, speed = 60, max = .35) => Math.min(max, Math.max(.06, a.distanceTo(b) / speed));
// Blickrichtung der Figur am Boden
export const fwd = () => V(Math.sin(player.facing), 0, Math.cos(player.facing));
// 0 → 1 → 0: Einblenden über a, Ausblenden über b (Anteile der Dauer)
export const env = (k, a = .15, b = .35) => clamp(Math.min(k / a, (1 - k) / b), 0, 1);

// ───────────────────────── Paletten (Werte aus den drei Viewern)
const C5 = (...h) => h.map(x => new THREE.Color(x));
export const PAL = {
  fire: C5(0x5c0a06, 0xd11d0a, 0xff7a0d, 0xffd23a, 0xfff6d0),
  ice: C5(0x1a4f8f, 0x3f97e8, 0x8fdcff, 0xd8f6ff, 0xffffff),
  arcane: C5(0x2a0a4a, 0x7a2adb, 0xc45cff, 0xff9cf0, 0xfff0ff),
  void: C5(0x05010d, 0x1f0840, 0x4a1490, 0x9a3dff, 0xe8c8ff),
  blitz: C5(0x0a1a4a, 0x2a5cff, 0x4fd0ff, 0xc8f8ff, 0xffffff),
  storm: C5(0x0e1426, 0x1d2a4d, 0x34507f, 0x6f8fc9, 0xcfe0ff),
  oil: C5(0x120d06, 0x2a1f0c, 0x4a3a16, 0x7a6426, 0xb8a040),
  slime: C5(0x16300e, 0x2f6b1c, 0x5fae3a, 0xa8e05a, 0xe8ffc0),
  gift: C5(0x1a0a24, 0x3d1a5c, 0x6b3a8f, 0x8fd84a, 0xe8ffd0),
  drain: C5(0x3a0610, 0x8a1424, 0x5fae3a, 0xa8e05a, 0xf0ffd8),
  wut: C5(0x3a0606, 0xa3131a, 0xff3b1f, 0xffb02e, 0xfff0d0),
  donner: C5(0x2a1a08, 0x8a5a10, 0xffb02e, 0xffe27a, 0xfffbe0),
  furcht: C5(0x07040a, 0x1e0c22, 0x46163a, 0x8a1a3a, 0xff9a8a),
  staub: C5(0x3a332a, 0x6a6052, 0x9a8f7c, 0xc9bfa9, 0xf4efe4),
  blut: C5(0x2a0306, 0x7a0a12, 0xd8121c, 0xff5a4a, 0xffd8d0),
  stahl: C5(0x1d1b18, 0x4a4a55, 0x9aa0aa, 0xd8dde4, 0xffffff),
  rauch: C5(0x2a2a2e, 0x46464c, 0x6e6e76, 0x9e9ea6, 0xd4d4da),
  schatten: C5(0x050508, 0x14141c, 0x2a2a3a, 0x4a4a66, 0x9a9ad0),
};
export type Pal = THREE.Color[];

// Eine Uhr für alle Energie-Materialien, in Sekunden
export const EU = { uTime: { value: 0 } };

// Optionen: k (Sichtbarkeit 0…1), sc (Noise-Maßstab), core (Mitte hell, negativ = Rand hell), flow (Laufrichtung des Noise),
// puff (Wabern), inf (entlang der Normalen aufblasen), edge (Scheibe: Rand aus), tip (nach oben auslaufen), local (Noise im Objekt),
// side, alpha (halbdurchsichtig)
export type EOpts = { k?: number; sc?: number; core?: number; flow?: number[]; puff?: number; inf?: number; edge?: number; tip?: number; local?: boolean; side?: THREE.Side; alpha?: number; parent?: THREE.Object3D };

function uniformsOf(pal: Pal, o: EOpts) {
  return {
    uTime: EU.uTime, uK: { value: o.k ?? 1 }, uFlow: { value: V(...(o.flow || [0, 1.5, 0])) }, uSc: { value: o.sc ?? 3 },
    uCore: { value: o.core ?? .5 }, uPuff: { value: o.puff ?? 0 }, uInf: { value: o.inf ?? 0 }, uEdge: { value: o.edge ?? 0 }, uTip: { value: o.tip ?? 0 },
    uLocal: { value: o.local ? 1 : 0 }, uSeed: { value: Math.random() * 50 }, uC: { value: pal },
  };
}
// Energie-Material 1:1 aus dem Viewer. Ergänzt: instanceMatrix für InstancedMesh, kein Tone-Mapping (Farben wie im Viewer).
export function eMat(pal: Pal, o: EOpts = {}) {
  const u = uniformsOf(pal, o);
  const m = new THREE.MeshBasicMaterial({ side: o.side ?? THREE.FrontSide, transparent: o.alpha !== undefined, opacity: o.alpha ?? 1, depthWrite: o.alpha === undefined });
  m.toneMapped = false;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform float uTime, uPuff, uInf, uSeed; varying vec3 vW, vWN, vL; varying vec2 vUv2;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', 'vec3 transformed = position + normal * (uInf + uPuff * sin(uTime * 7. + position.y * 9. + position.x * 7. + uSeed)); vL = position;')
      .replace('#include <project_vertex>', `vec4 lp = vec4(transformed, 1.); vec3 ln = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp; ln = mat3(instanceMatrix) * ln;
        #endif
        vec4 wp = modelMatrix * lp; vW = wp.xyz; vWN = normalize(mat3(modelMatrix) * ln); vUv2 = uv;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = `uniform float uTime, uK, uSc, uCore, uEdge, uTip, uLocal, uSeed; uniform vec3 uFlow; uniform vec3 uC[5]; varying vec3 vW, vWN, vL; varying vec2 vUv2;
      float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      ` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        vec3 p = mix(vW, vL, uLocal) * uSc - uFlow * uTime + uSeed;
        float q = .6 * n3(p) + .3 * n3(p * 2.1 + 3.) + .1 * n3(p * 4.3 + 7.);
        float face = abs(dot(normalize(vWN), normalize(cameraPosition - vW)));
        float f = q + uCore * (face - .5) + uEdge * (.5 - length(vUv2 - .5) * 2.) - uTip * (vUv2.y - .5);
        float thr = mix(1.25, .2, uK);
        if (f < thr) discard;
        float g = (f - thr) / max(.12, 1.3 - thr);
        vec3 c = uC[0];
        c = mix(c, uC[1], step(.12, g)); c = mix(c, uC[2], step(.32, g)); c = mix(c, uC[3], step(.55, g)); c = mix(c, uC[4], step(.78, g));
        vec4 diffuseColor = vec4(c, opacity);`);
  };
  m.customProgramCacheKey = () => 'eMat';
  m.userData.u = u;
  return m;
}
// Uniforms eines vorhandenen Energie-Materials neu setzen (Pool)
function setE(m: THREE.MeshBasicMaterial, pal: Pal, o: EOpts) {
  const u = m.userData.u;
  u.uK.value = o.k ?? 1; u.uFlow.value.set(...(o.flow || [0, 1.5, 0])); u.uSc.value = o.sc ?? 3; u.uCore.value = o.core ?? .5;
  u.uPuff.value = o.puff ?? 0; u.uInf.value = o.inf ?? 0; u.uEdge.value = o.edge ?? 0; u.uTip.value = o.tip ?? 0;
  u.uLocal.value = o.local ? 1 : 0; u.uSeed.value = Math.random() * 50; u.uC.value = pal;
}
export const uK = (m: THREE.Mesh, v: number) => { (m.material as any).userData.u.uK.value = v; };
// Boden-Form (gdisk, gring) um c mit Radius r aufs Gelände legen; nur neu, wenn sich Ort oder Radius ändern
export function lay(m: THREE.Mesh, c: THREE.Vector3, r: number, lift = .06) {
  const L = m.userData.laid;
  if (L && Math.abs(L[0] - c.x) + Math.abs(L[1] - c.z) + Math.abs(L[2] - r) < .01) return;
  m.userData.laid = [c.x, c.z, r];
  const base = m.geometry.userData.base, pos = m.geometry.attributes.position, arr = pos.array as Float32Array, y0 = c.y ?? 0;
  m.position.set(c.x, 0, c.z); m.scale.set(1, 1, 1);
  for (let i = 0; i < base.length; i += 3) { const x = base[i] * r, z = base[i + 2] * r; arr[i] = x; arr[i + 2] = z; arr[i + 1] = groundAt(c.x + x, c.z + z, y0 + 1) + lift; }
  pos.needsUpdate = true;
}

// ───────────────────────── Geteilte Formen (einmal angelegt)
export const G = {
  sph: new THREE.SphereGeometry(1, 22, 16),
  hemi: new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, Math.PI / 2),
  cone: new THREE.ConeGeometry(1, 1, 14, 4, true).translate(0, .5, 0),                       // Spitze oben, Basis am Boden
  coneF: new THREE.ConeGeometry(1, 1, 22, 6, true).translate(0, -.5, 0).rotateX(-Math.PI / 2), // Spitze im Ursprung, öffnet nach +z
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24, 6, true).translate(0, .5, 0),
  disk: new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
  ring: new THREE.RingGeometry(.82, 1, 64, 2).rotateX(-Math.PI / 2),
  torus: new THREE.TorusGeometry(1, .08, 8, 40).rotateX(Math.PI / 2),
  box: new THREE.BoxGeometry(1, 1, 1, 3, 4, 3),
  wave: new THREE.CylinderGeometry(1, 1, 1, 32, 3, true, -Math.PI * .3, Math.PI * .6).translate(0, .5, 0),
  oct: new THREE.OctahedronGeometry(1, 0),
  streak: new THREE.BoxGeometry(1, 1, 1, 1, 1, 12),   // Linie: Länge entlang z
};
// Boden-Formen: eigene Geometrie pro Mesh, lay() legt sie ans Gelände (wie world.ts drape)
const GROUND = { gdisk: () => new THREE.RingGeometry(0, 1, 40, 8), gring: () => new THREE.RingGeometry(.82, 1, 64, 1) };
export type GeoName = keyof typeof G | keyof typeof GROUND | `arc${number}`;
// Sicheln: Ringsegment mit Öffnung th (Radius 1, innen .62), XY-Ebene, offen Richtung +y. Pro Öffnung einmal gebaut.
const arcGeos = new Map<number, THREE.BufferGeometry>();
function geoOf(name: GeoName) {
  if (name in G) return G[name];
  if (name in GROUND) { const g = GROUND[name]().rotateX(-Math.PI / 2); g.userData.base = g.attributes.position.array.slice(); return g; }
  const th = +name.slice(3) / 100;
  let g = arcGeos.get(th);
  if (!g) { g = new THREE.RingGeometry(.62, 1, 48, 3, Math.PI / 2 - th / 2, th); arcGeos.set(th, g); }
  return g;
}
export const arcName = (th: number): GeoName => `arc${Math.round(th * 100)}`;

// ───────────────────────── Pool
const POOL_N: Record<string, number> = { cone: 160, sph: 64, ring: 32, disk: 32, cyl: 48, gring: 40, gdisk: 32 };   // PH: Meshes pro Form, sonst 16
type Fx = { a: number; dur: number; up?: (k: number, dt: number, e: Fx) => void; end?: () => void; ms: THREE.Mesh[]; dead?: boolean; [k: string]: any };
type Pool = { all: THREE.Mesh[]; free: THREE.Mesh[] };
const pools = new Map<string, Pool>();
const FX: Fx[] = [];
let serial = 0;

function acquire(name: GeoName, side: THREE.Side, alpha: boolean, owner?: Fx) {
  const key = `${name}|${side}|${alpha ? 1 : 0}`;
  let p = pools.get(key);
  if (!p) pools.set(key, p = { all: [], free: [] });
  let m = p.free.pop();
  if (!m && p.all.length < (POOL_N[name] ?? 16)) {
    const mat = eMat(PAL.fire, { side, alpha: alpha ? 1 : undefined });
    m = new THREE.Mesh(geoOf(name), mat);
    m.frustumCulled = false;
    m.userData.pool = p;
    p.all.push(m);
  }
  if (!m) {   // Pool voll: den ältesten Effekt in diesem Pool beenden
    let old: THREE.Mesh = null;
    for (const x of p.all) if (x.userData.owner !== owner && (!old || x.userData.n < old.userData.n)) old = x;
    if (!old) return null;
    release(old.userData.owner);
    m = p.free.pop();
    if (!m) return null;
  }
  m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1); m.visible = true; m.renderOrder = 0; m.userData.laid = null;
  m.userData.n = ++serial;
  return m;
}
function release(e: Fx) {
  if (!e || e.dead) return;
  e.dead = true;
  for (const m of e.ms) {
    m.parent?.remove(m);
    m.userData.owner = null;
    if (m.userData.pool) m.userData.pool.free.push(m);
    else if (m.userData.dispose) m.userData.dispose();
  }
  e.ms.length = 0;
  const i = FX.indexOf(e);
  if (i >= 0) FX.splice(i, 1);
}

// Effekt: läuft dur Sekunden, up(k 0…1, dt, e) jedes Bild, Meshes in e.ms gehen danach zurück in den Pool
export function fx(dur: number, up?: Fx['up'], end?: Fx['end']): Fx {
  const e: Fx = { a: 0, dur, up, end, ms: [] };
  FX.push(e);
  return e;
}
export const after = (s: number, fn: () => void) => fx(s, null, fn);
// Ist der Pool ganz von einem Effekt belegt: unsichtbares Ersatz-Mesh, damit der Effekt weiterläuft
let spare: THREE.Mesh = null;
const dummy = () => { if (!spare) { const mat = eMat(PAL.fire); mat.visible = false; spare = new THREE.Mesh(G.sph, mat); } return spare.clone(); };   // Material unsichtbar, auch wenn der Effekt visible setzt
// Energie-Mesh aus dem Pool an einen Effekt hängen
export function em(e: Fx, name: GeoName, pal: Pal, o: EOpts = {}) {
  const m = acquire(name, o.side ?? THREE.FrontSide, o.alpha !== undefined, e) ?? dummy();
  const mat = m.material as THREE.MeshBasicMaterial;
  setE(mat, pal, o);
  if (o.alpha !== undefined) mat.opacity = o.alpha;
  (o.parent || scene).add(m);
  m.userData.owner = e;
  e.ms.push(m);
  return m;
}
export const killFx = (e: Fx) => release(e);

export function updateEnergy(dt: number) {
  EU.uTime.value += dt;
  for (let i = FX.length - 1; i >= 0; i--) {
    const e = FX[i];
    if (!e) continue;
    e.a += dt;
    const k = Math.min(1, e.a / e.dur);
    try { if (e.up) e.up(k, dt, e); } catch (err) { console.error('Effekt', err); release(e); continue; }   // ein kaputter Effekt darf die Spielschleife nie anhalten
    if (e.dead) continue;
    if (e.a >= e.dur) { release(e); try { e.end?.(); } catch (err) { console.error('Effekt-Ende', err); } }
  }
}
// Dauerfläche für addField (spells/core.ts): visual = { update(pos, radius), remove() }. make(e) baut beim ersten Bild, step(e, fade, dt) läuft jedes Bild.
// fade blendet 0,25 s ein und nach remove() 0,4 s aus.
export function field(make: (e: Fx) => void, step: (e: Fx, fade: number, dt: number) => void) {
  const e = fx(1e9, (_k, dt, e) => {
    if (!e.pos) return;
    if (!e.built) { e.built = true; make(e); }
    const fade = e.out !== undefined ? clamp(1 - (e.a - e.out) / .4, 0, 1) : clamp(e.a / .25, 0, 1);
    step(e, fade, dt);
  });
  return {
    e,
    update(pos: THREE.Vector3, r: number) { e.pos = pos; e.r = r; },
    remove() { if (e.out === undefined) { e.out = e.a; e.dur = e.a + .4; } },
  };
}
// Run-Ende: alles weg
const clearHooks: (() => void)[] = [];
export const onClearEnergy = (fn: () => void) => clearHooks.push(fn);   // weitere Effekt-Listen (Blitze) leeren mit
export function clearEnergy() { for (const e of FX.slice()) release(e); figureLook.meter = null; for (const fn of clearHooks) fn(); }

// ───────────────────────── Funken über das Partikelsystem des Spiels (HDR-Farben für Bloom)
export function sparks(p: THREE.Vector3, n: number, pal: Pal, { v = [0, 2.5, 0], grav = 5, life = .7, spread = .5, band = 3, glow = 1.6 } = {}) {
  const c = pal[band];
  for (let i = 0; i < n; i++) particles.spawn({
    x: p.x + rnd(-.5, .5) * spread, y: p.y + rnd(-.5, .5) * spread, z: p.z + rnd(-.5, .5) * spread,
    vx: v[0] + rnd(-1, 1) * 1.5, vy: v[1] + rnd(-.5, 1) * 1.5, vz: v[2] + rnd(-1, 1) * 1.5,
    life: life * rnd(.6, 1.2), color: [c.r * glow, c.g * glow, c.b * glow], size: rnd(.12, .22), grav, drag: 1.5,
  });
}

// ───────────────────────── Bausteine wie im Viewer
// Explosion: Kugel wächst und löst sich auf, Bodenring läuft aus, Funken. ground: Höhe des Bodens unter pos
export function boom(pos: THREE.Vector3, r: number, pal: Pal, dur = .7, o: { n?: number; ground?: number } = {}) {
  const gp = new THREE.Vector3(pos.x, o.ground ?? pos.y, pos.z);
  return fx(dur, (k, _dt, e) => {
    if (!e.ms.length) {
      em(e, 'sph', pal, { sc: 2.2 / Math.sqrt(r), core: .9, puff: .05, flow: [0, 2.5, 0] }).position.copy(pos);
      em(e, 'gring', pal, { sc: 2.5 / Math.max(1, r * .4), core: 0, flow: [0, 0, 0] });
      sparks(pos, o.n ?? 30, pal, { spread: r * .6 });
    }
    const [s, rg] = e.ms;
    s.scale.setScalar(r * (.25 + .75 * outC(Math.min(1, k * 2.2)))); uK(s, 1 - k * k);
    lay(rg, gp, r * (.4 + 1.2 * outC(k))); uK(rg, 1 - k);
  });
}
// Geschoss von a nach b: Kopf + Schweif-Kegel, optional Bogen (arc) und Ausschlag (curve). hit am Ziel
export function shot(a: THREE.Vector3, b: THREE.Vector3, speed: number, pal: Pal, o: { r?: number; tail?: number | false; arc?: number; curve?: THREE.Vector3; hit?: (p: THREE.Vector3) => void; dur?: number } = {}) {
  const dur = o.dur ?? Math.max(.05, a.distanceTo(b) / speed), r = o.r ?? .22;
  const at = (k, out) => { out.lerpVectors(a, b, k); out.y += (o.arc || 0) * Math.sin(Math.PI * k); if (o.curve) out.addScaledVector(o.curve, Math.sin(Math.PI * k)); return out; };
  const p = V(), nx = V();
  return fx(dur, (k, dt, e) => {
    if (!e.ms.length) {
      const h = em(e, 'sph', pal, { sc: 6 / Math.max(1, r * 3), core: 1, puff: .08, flow: [0, 3, 0] }); h.scale.setScalar(r);
      if (o.tail !== false) { const t = em(e, 'cone', pal, { sc: 5, core: .5, tip: 1.3, flow: [0, 4, 0], parent: h }); t.rotation.x = -Math.PI / 2; t.scale.set(.85, (o.tail as number) ?? 3.2, .85); }
    }
    const h = e.ms[0];
    at(k, p); at(Math.min(1, k + .02), nx);
    h.position.copy(p); if (nx.distanceToSquared(p) > 1e-6) h.lookAt(nx);
    if (Math.random() < dt * 40) sparks(p, 1, pal, { v: [0, .4, 0], grav: -.2, life: .4, spread: r, band: 2 });
  }, () => o.hit?.(b));
}
// Flammenzungen auf einer Fläche (Feuer-Look für Felder). y: Bodenhöhe
export function blaze(e: Fx, pos: THREE.Vector3, r: number, n: number, h: number, pal = PAL.fire) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, rr = r * Math.sqrt(Math.random());
    const m = em(e, 'cone', pal, { sc: 4, core: .35, tip: 1.1, puff: .05, flow: [0, 3.2, 0] });
    m.position.set(pos.x + Math.cos(a) * rr, pos.y, pos.z + Math.sin(a) * rr);
    m.userData.h = h * rnd(.5, 1.2); m.userData.w = rnd(.18, .32) * Math.max(.6, h); m.userData.ph = Math.random() * 9;
  }
}
export function blazeUp(e: Fx, k: number, from = 0) {
  const T = EU.uTime.value;
  for (let i = from; i < e.ms.length; i++) { const m = e.ms[i]; if (m.userData.h === undefined) continue; const f = 1 + .25 * Math.sin(T * 9 + m.userData.ph); m.scale.set(m.userData.w, m.userData.h * f * env(k, .12, .3), m.userData.w); }
}
// Bodenring läuft von r0 auf r aus
export function ring(pos: THREE.Vector3, r: number, pal: Pal, dur = .5, o: { r0?: number; sc?: number } = {}) {
  return fx(dur, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'gring', pal, { sc: o.sc ?? 2.5 / Math.max(1, r * .3), core: 0, flow: [0, 0, 0], side: THREE.DoubleSide });
    lay(e.ms[0], pos, (o.r0 ?? .2) + (r - (o.r0 ?? .2)) * outC(k)); uK(e.ms[0], 1 - k);
  });
}
// Sichel: Ringsegment um den Mittelpunkt c (Welt), Ebene über die Drehung q (Ebene XY, offen nach +y), wächst leicht und löst sich auf
export function arc(c: THREE.Vector3, q: THREE.Quaternion, r: number, th: number, pal: Pal, dur = .4) {
  return fx(dur, (k, _dt, e) => {
    if (!e.ms.length) { const m = em(e, arcName(th), pal, { sc: 3, core: 0, local: true, flow: [0, 0, 0], side: THREE.DoubleSide }); m.position.copy(c); m.quaternion.copy(q); }
    const m = e.ms[0]; m.scale.setScalar(r * (1 + .25 * k)); uK(m, 1 - k * k);
  });
}
// Linie von a nach b auf Höhe y (Strichschnitt, Iaido)
export function streak(a: THREE.Vector3, b: THREE.Vector3, w: number, pal: Pal, dur = .4) {
  return fx(dur, (k, _dt, e) => {
    if (!e.ms.length) { const m = em(e, 'streak', pal, { sc: 3, core: .3, local: true, flow: [0, 0, 0] }); m.position.lerpVectors(a, b, .5); m.lookAt(b); m.scale.set(w * 1.6, w * .6, a.distanceTo(b)); m.userData.w = w; }
    const m = e.ms[0]; uK(m, 1 - k); m.scale.x = m.userData.w * 1.6 * (1 - .6 * k); m.scale.y = m.userData.w * .6 * (1 - .6 * k);
  });
}
// Treffer-Funke im Energie-Look (Blitz)
export function spark(p: THREE.Vector3, r: number, pal = PAL.blitz) {
  sparks(p, 8, pal, { v: [0, 1, 0], grav: 3, life: .3, spread: r * .4 });
  return fx(.25, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'sph', pal, { sc: 5, core: 1.1, local: true, flow: [0, 0, 0] });
    const m = e.ms[0]; m.position.copy(p); m.scale.setScalar(r * (.4 + .6 * k)); m.rotation.y = Math.random() * 9; uK(m, 1 - k);
  });
}

// Figur: Anzeige zeitweise übersteuern (Höllenfeuer = Hitze 100, Archon = 4 Ladungen). main.ts liest sie vor der Spielanzeige
export const figureLook = { meter: null as number | null };
