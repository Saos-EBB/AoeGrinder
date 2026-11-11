// Kosmetik-Teile an der Figur (Kosmetik-Viewer docs/ref/kosmetik-viewer.html, Handoff docs/handoffs/kosmetik.md): 25 Teile, 5 je Slot, nur Aussehen.
// Die Formen sind aus dem Viewer (COS) übernommen und wie gearParts.ts als Object3D-Baum in Viewer-Koordinaten gebaut (userData geo, mat).
// kosmetikPieces wandelt die Bäume in Teile für das Körper-Mesh von strichMagier.ts: alles an Bones, Leuchtteile als Glühen, 0 Draw Calls extra.
// Bewegte Gruppen (key()) bekommen eigene Bones; die Reaktion auf ein Spiel-Ereignis (figEvents.ts) dreht, schiebt oder skaliert nur diese Bones
// (Größe 1e-4 = unsichtbar). Partikel gehen ins Partikelsystem des Spiels (opts.puff in strichMagier.ts).
// Ausnahmen mit je höchstens +1 Draw Call pro Figur: Glas (Fischglas, Limo-Flaschen, Rucksack-Fenster) in einem gemeinsamen transparenten Mesh,
// die Zahl der Kill-Flagge als Canvas-Textur auf eigenem Mesh. Muster (Kuh-Flecken, Karo) als Farbe je Dreieck, keine Textur (Karo: Gitter der Geometrie = Gitter des Musters).
// Abweichungen zum Viewer: keine Inverted-Hull-Outline (toon.ts-Rand), Sprites (Glanz, Halo, Blitz) als Partikel oder Glüh-Teil,
// Marionettenfäden als dünne Zylinder auf eigenen Bones statt Linien, Glühbirne und Schriftrolle ohne Glas bzw. Textur.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { limbFrame, flip, litCol, FIT } from './gearParts';
import { t } from '../i18n';
import { ELEMENTS } from './weapons/baukasten';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
type Mat = { c: THREE.Color; g?: 0 | 1; ds?: boolean; glass?: number; fn?: (p: THREE.Vector3) => THREE.Color } | null;

export const KOS = {   // Optik-Zahlen // PH
  puffSize: 2.4,      // Partikelgröße × (Viewer-Sprites sind für die Nahansicht, die Spielkamera ist weit weg)
  glassAlpha: 0.3,    // Glas ohne eigene Deckkraft
  jet: 45,            // Limo-Jetpack: Tropfen pro Sekunde und Flasche beim Sprint (Viewer: 2 pro Frame)
  drizzle: 12,        // Gewitterwolke: Tropfen pro Sekunde im Stehen
  boltPts: 14,        // Gewitterwolke: Partikel je Blitz
  flagDim: 0.5,       // Kill-Flagge: Textur dunkler, die Lampe hellt sie sonst aus
  neckUp: 0.09,       // Hals-Teile höher: der Rumpf der Figur reicht weiter hoch als im Viewer, Ketten und Kopfhörer steckten sonst im Kragen
};

// ---------------- Material (Farben des Viewers) ----------------
const lit = (c: number, o: Partial<NonNullable<Mat>> = {}): Mat => ({ c: new THREE.Color(c), g: 0, ...o });
const glowM = (c: number): Mat => ({ c: new THREE.Color(c), g: 1 });
const glassM = (c: number, a = KOS.glassAlpha): Mat => ({ c: new THREE.Color(c), glass: a });
const ds = (m: Mat): Mat => (m ? { ...m, ds: true } : m);
const MAT = { schwarz: lit(0x18161c), weiss: lit(0xf4f1ea), gold: lit(0xe8b23a), stahl: lit(0xb8bcc8), holz: lit(0x8a5a32), haut: lit(0xf1dcc6) };
// Fest gestreut, damit ein Teil bei jedem Neubau gleich aussieht
let SEED = 1;
const srnd = () => (SEED = (SEED * 9301 + 49297) % 233280) / 233280;
const rnd = (a: number, b: number) => a + srnd() * (b - a);

// ---------------- Geometrie-Helfer (Viewer, weniger Segmente) ----------------
function mesh(geo: THREE.BufferGeometry, mat: Mat, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.userData.geo = geo; o.userData.mat = mat; parent.add(o); return o;
}
function seg(a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: Mat, parent: THREE.Object3D, joint = true, hs = 1) {
  const d = b.clone().sub(a), len = d.length(); const m = mesh(new THREE.CylinderGeometry(r2, r1, len, hs > 1 ? 12 : 8, hs), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  if (joint) mesh(new THREE.SphereGeometry(r1, 8, 6), mat, parent).position.copy(a);
  return m;
}
function torso(parent, mat: Mat, yTop, yBot, rTop, rBot, depth = 0.62, hs = 1) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, yTop - yBot, hs > 1 ? 20 : 14, hs), mat, parent, 0, (yTop + yBot) / 2, 0); m.scale.z = depth;
  const cap = mesh(new THREE.SphereGeometry(rTop, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat, parent, 0, yTop, 0); cap.scale.set(1, 0.35, depth); return m;
}
const tube = (pts: THREE.Vector3[], r: number, mat: Mat, parent, closed = false, n = 24) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), n, r, 5, closed), mat, parent);
const helix = (r, h, turns, y0 = 0) => { const p = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * turns * Math.PI * 2; p.push(V(Math.cos(a) * r, y0 + i / 40 * h, Math.sin(a) * r)); } return p; };
function plate(pts: number[][], depth: number, mat: Mat, parent, x = 0, y = 0, z = 0) {
  const sh = new THREE.Shape(); pts.forEach(([px, py], i) => (i ? sh.lineTo(px, py) : sh.moveTo(px, py))); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 4 }); g.translate(0, 0, -depth / 2);
  return mesh(g, mat, parent, x, y, z);
}
const spike = (l, w) => [[-w / 2, 0], [w / 2, 0], [0, l]];
const alongArm = (g: THREE.Object3D, el: THREE.Vector3, wr: THREE.Vector3, t = 0.55) => { g.position.copy(el).lerp(wr, t); g.quaternion.setFromUnitVectors(V(0, 1, 0), wr.clone().sub(el).normalize()); };
// Manga-Proportionen des Viewers (Körper-Koordinaten, Boden = 0)
const P = { head: V(0, 1.67, 0), shL: V(-0.19, 1.44, 0), elL: V(-0.24, 1.14, -0.01), wrL: V(-0.26, 0.88, 0.02), haL: V(-0.265, 0.83, 0.02),
  shR: V(0.19, 1.44, 0), elR: V(0.24, 1.14, 0), wrR: V(0.26, 0.9, 0.06), haR: V(0.265, 0.85, 0.07),
  hipL: V(-0.09, 0.9, 0), knL: V(-0.1, 0.49, 0.01), anL: V(-0.105, 0.08, 0), hipR: V(0.09, 0.9, 0), knR: V(0.1, 0.49, 0.01), anR: V(0.105, 0.08, 0) };
// Halskurve: Kette um den Hals, vorne tiefer
const neckLoop = (yFront, rx = 0.15, rz = 0.145, yBack = 1.46) => { const p = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, f = ((1 + Math.cos(a)) / 2) ** 2; p.push(V(Math.sin(a) * rx * (0.75 + 0.25 * (1 - f)), yBack - (yBack - yFront) * f, Math.cos(a) * rz)); } return p; };
const foot = (o: THREE.Object3D) => { o.userData.foot = true; return o; };

// ---------------- Bewegte Gruppen: eigener Bone, Reaktion über Bone-Rotation/-Lage/-Größe ----------------
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
export class Handle {
  bone: THREE.Bone | null = null; pos = V(); quat = new THREE.Quaternion(); scl = V(1, 1, 1);
  rot(x: number, y = 0, z = 0) { if (this.bone) this.bone.quaternion.copy(this.quat).multiply(_q.setFromEuler(_e.set(x, y, z))); return this; }
  at(x: number, y: number, z: number) { this.bone?.position.set(x, y, z); return this; }     // Lage im Raum der Eltern-Gruppe (Viewer-Maß)
  off(x: number, y = 0, z = 0) { this.bone?.position.set(this.pos.x + x, this.pos.y + y, this.pos.z + z); return this; }
  size(x: number, y = x, z = x) { this.bone?.scale.set(this.scl.x * x, this.scl.y * y, this.scl.z * z); return this; }
  show(on: boolean) { return this.size(on ? 1 : 1e-4); }
}
const key = (g: THREE.Object3D) => (g.userData.kb = new Handle());
const group = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// ---------------- Kontext und Reaktion ----------------
export type KosEvent = 'kill' | 'crit' | 'cast' | 'hit' | 'level' | 'streak' | 'idle' | 'sprint';
type Arm = [THREE.Object3D, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, number];   // Baum, Schulter, Ellbogen, Handgelenk, Hand, Seite (−1 = −x)
type Leg = [THREE.Object3D, THREE.Vector3, THREE.Vector3, THREE.Vector3, number];                 // Baum, Hüfte, Knie, Knöchel, Seite
// K: pro Frame. since(e): Sekunden seit dem Ereignis, vals: Mana 0 … 1 und Kills im Run, F: Figur (Bones head, hips, armL/armR.ua …)
export interface KosFrame { t: number; dt: number; since: (e: KosEvent) => number; sprint: boolean; vals: { mana: number; kills: number }; F: any }
type Space = 'head' | 'body' | 'neck' | Handle;
interface Ctx {
  body: THREE.Object3D; head: THREE.Object3D; arms: Arm[]; legs: Leg[]; el: number;
  tick: (fn: (K: KosFrame) => void) => void; on: (fn: (e: KosEvent, K: KosFrame) => void) => void;
  spawn: (space: Space, p: THREE.Vector3, v: THREE.Vector3, col: number, size: number, life: number, grav?: number) => void;
  say: (key: string) => void; hop: (h: number) => void; flag: (h: Handle) => void;
}

// ---------------- Onesie / Anzug ----------------
// hs: Höhen-Segmente für Muster (Kuh-Flecken brauchen kleinere Dreiecke, sonst ist ein Fleck ein halber Ärmel oder gar keiner)
function suit(ctx: Ctx, mat: Mat, o: { rb?: number; cuff?: number; legs?: boolean; legMat?: Mat; hs?: number } = {}) {
  const hs = o.hs ?? 1;
  torso(ctx.body, mat, 1.475, 0.86, 0.22, o.rb ?? 0.172, 0.66, hs > 1 ? hs * 2 : 1);
  for (const [arm, sh, el, wr] of ctx.arms) { mesh(new THREE.SphereGeometry(0.074, 10, 7), mat, arm).position.copy(sh); seg(sh, el, 0.064, 0.056, mat, arm, false, hs); seg(el, wr, 0.056, o.cuff ?? 0.05, mat, arm, true, hs); }
  if (o.legs !== false) for (const [leg, hip, kn, an] of ctx.legs) { seg(hip, kn, 0.085, 0.07, o.legMat ?? mat, leg, true, hs); seg(kn, an.clone().add(V(0, 0.04, 0)), 0.066, 0.06, o.legMat ?? mat, leg, true, hs); }
}
function hood(ctx: Ctx, mat: Mat, r = 0.15) { const h = mesh(new THREE.SphereGeometry(r, 14, 9, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.72), ds(mat), ctx.head, 0, 0.01, -0.005); h.scale.set(1, 1.08, 1); return h; }
// Kuh-Flecken: schwarze Flecken nach Lage (Spielraum), je Dreieck eine Farbe
const hash3 = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const noise3 = (p: THREE.Vector3) => { const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z), fx = p.x - x, fy = p.y - y, fz = p.z - z;
  const l = (a, b, k) => a + (b - a) * k * k * (3 - 2 * k);
  return l(l(l(hash3(x, y, z), hash3(x + 1, y, z), fx), l(hash3(x, y + 1, z), hash3(x + 1, y + 1, z), fx), fy), l(l(hash3(x, y, z + 1), hash3(x + 1, y, z + 1), fx), l(hash3(x, y + 1, z + 1), hash3(x + 1, y + 1, z + 1), fx), fy), fz); };
const COW_W = new THREE.Color(0xf6f3ec), COW_B = new THREE.Color(0x1b1a1e), _np = V();
const COW = { freq: 5, cut: 0.53, hs: 5 };   // Fleckengröße (kleiner = größer), Anteil Schwarz (0.53 ≈ 45 %), Höhen-Segmente des Anzugs // PH
const cowFn = (p: THREE.Vector3) => (noise3(_np.copy(p).multiplyScalar(COW.freq)) > COW.cut ? COW_B : COW_W);
// Karo (Schottenrock): Rock als Zylinder mit Gitter KILT.around × KILT.rows, jede Zelle eine Farbe (beide Dreiecke gleich) → saubere Kästchen.
// Zelle aus Winkel und Radius der Dreiecksmitte (beides unabhängig von der Höhe des Bones, gleich im Körper-Mesh und im Item-Bild).
// Farbe der Zelle = Mischung aus Kett- und Schussfaden (Streifenfolge KILT.sett), wie bei echtem Tartan
const KILT = { rTop: 0.168, rBot: 0.25, h: 0.34, around: 40, rows: 12, sz: 0.8 };   // PH
const TART = { R: new THREE.Color(0xa81e2a), G: new THREE.Color(0x1f4a30), K: new THREE.Color(0x140c12), Y: new THREE.Color(0xe0b850) };
const SETT = 'GGKRRRRY';   // Streifen je Zelle, wiederholt
const _tart = new THREE.Color();
const tartFn = (p: THREE.Vector3) => {
  const zz = p.z / KILT.sz, u = (Math.atan2(p.x, zz) / (Math.PI * 2) + 1) % 1, r = Math.hypot(p.x, zz);
  const i = Math.floor(u * KILT.around) % KILT.around, j = Math.max(0, Math.min(KILT.rows - 1, Math.floor((r - KILT.rTop) / (KILT.rBot - KILT.rTop) * KILT.rows)));
  const a = TART[SETT[i % SETT.length]], b = TART[SETT[j % SETT.length]];
  return a === b ? a : _tart.copy(a).lerp(b, 0.5).clone();
};

// ---------------- Die 25 Teile (Viewer COS) ----------------
const COS: Record<string, { slot: string; build: (ctx: Ctx) => void }> = {
  // ---------------- Kopf ----------------
  pappkrone: { slot: 'kopf', build(ctx) {   // rutscht schief bei Treffer, sitzt beim Level-Up wieder gerade
    const g = group(ctx.head, 0, 0.105, 0), h = key(g), pap = lit(0xc9a46a);
    mesh(new THREE.CylinderGeometry(0.106, 0.1, 0.055, 16, 1, true), ds(pap), g);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, p = plate(spike(0.075, 0.07), 0.004, pap, g, Math.sin(a) * 0.104, 0.027, Math.cos(a) * 0.104); p.rotation.y = a; p.rotation.x = -0.12;
      mesh(new THREE.SphereGeometry(0.009, 6, 4), lit([0xd8262a, 0x3a7bd8, 0x3ad65a][i % 3]), g, Math.sin(a) * 0.112, 0, Math.cos(a) * 0.112); }
    let tilt = 0, target = 0;
    ctx.on(e => { if (e === 'hit') target = Math.min(0.5, target + 0.22); if (e === 'level') target = 0; });
    ctx.tick(K => { tilt += (target - tilt) * Math.min(1, K.dt * 7); h.rot(0, 0, tilt).at(tilt * 0.06, 0.105 - tilt * 0.03, 0); }); } },
  fischglas: { slot: 'kopf', build(ctx) {   // Fisch flitzt beim Sprint, Blasen beim Zaubern
    const H = ctx.head;
    mesh(new THREE.SphereGeometry(0.205, 18, 12), glassM(0xcfeeff, 0.18), H, 0, 0.01, 0.01);
    mesh(new THREE.SphereGeometry(0.2, 18, 7, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), glassM(0x4aa8ff, 0.26), H, 0, 0.01, 0.01);
    mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 18), MAT.stahl, H, 0, -0.17, 0.01).rotation.x = Math.PI / 2;
    const fish = group(H), fh = key(fish); mesh(new THREE.SphereGeometry(1, 8, 6), lit(0xff8a2a), fish).scale.set(0.012, 0.022, 0.036);
    const tail = group(fish, 0, 0, -0.03), th = key(tail); plate([[0, 0], [0.022, 0.02], [-0.022, 0.02]], 0.004, lit(0xffb04a), tail).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.004, 5, 3), MAT.schwarz, fish, 0.011, 0.006, 0.02);
    let a = 0;
    ctx.tick(K => { a += K.dt * (K.sprint ? 7 : 1.4); const r = 0.165; fh.at(Math.sin(a) * r, -0.06 + Math.sin(a * 2) * 0.015, Math.cos(a) * r).rot(0, a + Math.PI / 2, 0); th.rot(0, Math.sin(K.t * (K.sprint ? 30 : 9)) * 0.5, 0); });
    ctx.on(e => { if (e === 'cast') for (let i = 0; i < 7; i++) ctx.spawn('head', V(rnd(-0.1, 0.1), rnd(-0.12, 0), rnd(-0.05, 0.14)), V(0, rnd(0.15, 0.3), 0), 0xd8f4ff, 0.035, 1.0); }); } },
  gluehbirne: { slot: 'kopf', build(ctx) {   // leuchtet bei Crit
    const g = group(ctx.head, 0, 0.3, 0), gh = key(g);
    mesh(new THREE.SphereGeometry(0.06, 12, 9), lit(0xfff6d8), g, 0, 0.06, 0).scale.y = 1.15;   // Viewer: Glas 75 %, hier blickdicht
    for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 10), MAT.stahl, g, 0, -0.002 - i * 0.014, 0);
    const lamp = group(g, 0, 0.06, 0), lh = key(lamp); mesh(new THREE.SphereGeometry(0.064, 12, 9), glowM(0xffe066), lamp).scale.y = 1.15;   // Leuchten: Glüh-Hülle über dem Kolben
    ctx.tick(K => { gh.at(0, 0.3 + Math.sin(K.t * 2.2) * 0.015, 0); const k = Math.max(0, 1 - K.since('crit') / 1.0); lh.show(k > 0.08).size(k > 0.08 ? 1 + 0.08 * k : 1e-4); });
    ctx.on(e => { if (e === 'crit') for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; ctx.spawn(gh, V(0, 0.06, 0), V(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0), 0xffe066, 0.05, 0.4); } }); } },
  bartbrille: { slot: 'kopf', build(ctx) {   // Bart fällt kurz ab bei Treffer
    const H = ctx.head, frame = MAT.schwarz;
    for (const x of [-0.044, 0.044]) mesh(new THREE.TorusGeometry(0.03, 0.0065, 5, 14), frame, H, x, 0.0, 0.118);
    seg(V(-0.014, 0.004, 0.122), V(0.014, 0.004, 0.122), 0.005, 0.005, frame, H, false);
    for (const s of [-1, 1]) seg(V(s * 0.074, 0.004, 0.112), V(s * 0.11, 0.01, 0.0), 0.005, 0.005, frame, H, false);
    const nose = group(H, 0, -0.036, 0.13), nh = key(nose); mesh(new THREE.SphereGeometry(0.026, 10, 7), lit(0xf0a090), nose).scale.set(1, 1.15, 1.2);
    const drop = group(H), dh = key(drop), hair = lit(0x3a2418);
    for (const s of [-1, 1]) { const m = plate([[0, 0], [0.05, 0.004], [0.075, -0.012], [0.05, -0.02], [0, -0.016]], 0.012, hair, drop, 0, -0.068, 0.124); m.scale.x = s; }
    plate([[-0.06, 0], [0.06, 0], [0.04, -0.06], [0, -0.09], [-0.04, -0.06]], 0.016, hair, drop, 0, -0.088, 0.112);
    ctx.tick(K => { nh.rot(0, 0, Math.sin(K.t * 6) * 0.08); const k = K.since('hit') / 0.9;
      if (k < 1) { const s = Math.sin(Math.PI * k); dh.at(0, -0.16 * s, 0.05 * s).rot(0, 0, 0.7 * s); } else dh.at(0, 0, 0).rot(0, 0, 0); }); } },
  fliegenpilz: { slot: 'kopf', build(ctx) {   // Sporenwolke bei Kill-Serie
    const g = group(ctx.head, 0, 0.07, 0);
    mesh(new THREE.SphereGeometry(0.17, 16, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), ds(lit(0xd8262a)), g).scale.y = 0.72;
    mesh(new THREE.CircleGeometry(0.17, 16), ds(lit(0xf1e6cf)), g).rotation.x = Math.PI / 2;
    for (let i = 0; i < 11; i++) { const th = rnd(0, 6.28), ph = rnd(0.12, 1.25), d = mesh(new THREE.SphereGeometry(rnd(0.014, 0.024), 7, 4), MAT.weiss, g); d.position.set(Math.sin(ph) * Math.cos(th) * 0.168, Math.cos(ph) * 0.168 * 0.72, Math.sin(ph) * Math.sin(th) * 0.168); d.scale.y = 0.5; d.lookAt(d.position.clone().multiplyScalar(2)); }
    let next = 0;
    ctx.tick(K => { if (K.t > next) { next = K.t + 0.6; ctx.spawn('head', V(rnd(-0.1, 0.1), 0.17, rnd(-0.1, 0.1)), V(0, 0.08, 0), 0xe8ffd0, 0.03, 1.5); } });
    ctx.on(e => { if (e === 'streak') for (let i = 0; i < 34; i++) { const a = rnd(0, 6.28); ctx.spawn('head', V(0, 0.15, 0), V(Math.cos(a) * rnd(0.2, 0.6), rnd(0.05, 0.4), Math.sin(a) * rnd(0.2, 0.6)), [0xe8ffd0, 0xffe0e0, 0xd0ffb0][i % 3], rnd(0.05, 0.1), 1.8, -0.05); } }); } },

  // ---------------- Hals ----------------
  goldkette: { slot: 'hals', build(ctx) {   // Glanzblitz beim Level-Up
    const b = ctx.body, loop = neckLoop(1.17); tube(loop, 0.017, MAT.gold, b, true, 40); tube(neckLoop(1.19, 0.152, 0.15), 0.008, lit(0xc8901a), b, true, 40);
    const med = group(b, 0, 1.11, 0.16), mh = key(med);
    mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.016, 18), MAT.gold, med).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.02, 18), lit(0xc8901a), med).rotation.x = Math.PI / 2;
    plate([[0, 0.034], [0.01, 0.01], [0.034, 0.008], [0.014, -0.006], [0.022, -0.032], [0, -0.016], [-0.022, -0.032], [-0.014, -0.006], [-0.034, 0.008], [-0.01, 0.01]], 0.01, MAT.gold, med, 0, 0, 0.012);
    const fl = group(med, 0, 0, 0.02), fh = key(fl); mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.004, 18), glowM(0xfff6d0), fl).rotation.x = Math.PI / 2;   // Glanz: leuchtende Scheibe statt Sprite
    let next = 0;
    ctx.tick(K => { mh.rot(0, Math.sin(K.t * 1.5) * 0.25, 0); const k = Math.max(0, 1 - K.since('level') / 1.2); fh.size(k > 0.05 ? 0.4 + k * 0.9 : 1e-4);
      if (K.t > next) { next = K.t + 0.25; const p = loop[Math.floor(((K.t * 0.7) % 1) * 40)]; ctx.spawn('neck', p.clone().multiplyScalar(1.05), V(0, 0.05, 0), 0xfff0b0, 0.05, 0.35); } });
    ctx.on(e => { if (e === 'level') for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; ctx.spawn(mh, V(0, 0, 0.03), V(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.2), 0xffffff, 0.07, 0.5); } }); } },
  zahnkette: { slot: 'hals', build(ctx) {   // +1 Zahn pro 100 Kills im Run (max. 10)
    const b = ctx.body; tube(neckLoop(1.25, 0.15, 0.14), 0.005, lit(0x4a3020), b, true, 40);
    const teeth: Handle[] = [];
    for (let i = 0; i < 10; i++) { const a = (i - 4.5) * 0.16, f = ((1 + Math.cos(a)) / 2) ** 2, p = V(Math.sin(a) * 0.15 * (0.75 + 0.25 * (1 - f)), 1.46 - (1.46 - 1.25) * f - 0.022, Math.cos(a) * 0.145);
      const g = group(b); g.position.copy(p); g.rotation.set(Math.PI, 0, -a * 0.3); teeth.push(key(g)); mesh(new THREE.ConeGeometry(0.011, 0.045, 6), lit(0xf5efe0), g); }
    ctx.tick(K => { const n = Math.min(10, Math.floor(K.vals.kills / 100)); teeth.forEach((h, i) => h.show(i < n)); }); } },
  kopfhoerer: { slot: 'hals', build(ctx) {   // wummern bei Kill-Serie
    const b = ctx.body, acc = lit(0xff3c6a);
    mesh(new THREE.TorusGeometry(0.13, 0.016, 5, 16, Math.PI), MAT.schwarz, b, 0, 1.53, 0.0).rotation.x = -Math.PI / 2;
    const cups: Handle[] = [];
    for (const s of [-1, 1]) { const c = group(b, s * 0.132, 1.52, 0.03); c.rotation.y = s * 0.5; cups.push(key(c));
      mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 14), MAT.schwarz, c).rotation.z = Math.PI / 2;
      mesh(new THREE.TorusGeometry(0.048, 0.011, 5, 14), acc, c, s * 0.022, 0, 0).rotation.y = Math.PI / 2; }
    let next = 0;
    ctx.tick(K => { const k = K.since('streak'), on = k < 2.5; cups.forEach(h => h.size(on ? 1 + 0.22 * Math.abs(Math.sin(k * 11)) : 1));
      if (on && K.t > next) { next = K.t + 0.22; const s = srnd() < 0.5 ? -1 : 1; ctx.spawn('neck', V(s * 0.16, 1.52, 0.02), V(s * 0.3, 0.35, rnd(-0.1, 0.1)), [0xff3c6a, 0x6ad8ff, 0xffe866][Math.floor(rnd(0, 3))], 0.07, 0.8); } }); } },
  pizza: { slot: 'hals', build(ctx) {   // Käse tropft bei Lebensverlust
    const b = ctx.body; tube([V(-0.07, 1.47, 0.05), V(-0.06, 1.33, 0.14), V(0, 1.27, 0.16), V(0.06, 1.33, 0.14), V(0.07, 1.47, 0.05)], 0.004, lit(0x4a3020), b);
    const p = group(b, 0, 1.25, 0.165), ph = key(p);
    plate([[-0.05, 0.03], [0.05, 0.03], [0, -0.075]], 0.01, lit(0xffcf4a), p);
    plate([[-0.056, 0.045], [0.056, 0.045], [0.05, 0.026], [-0.05, 0.026]], 0.016, lit(0xc98a3a), p);
    for (const [x, y] of [[-0.018, 0.012], [0.02, 0.008], [0, -0.025]]) mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 10), lit(0xc0302a), p, x, y, 0.008).rotation.x = Math.PI / 2;
    const drip = group(p, 0, -0.075, 0.003), dh = key(drip); mesh(new THREE.CylinderGeometry(0.005, 0.007, 1, 6), lit(0xffcf4a), drip);
    let dropped = true;
    ctx.on(e => { if (e === 'hit') dropped = false; });
    ctx.tick(K => { ph.rot(0, 0, Math.sin(K.t * 1.8) * 0.12); const k = K.since('hit') / 1.4; const l = k < 1 ? 0.002 + 0.07 * Math.sin(Math.PI * Math.min(1, k * 1.4) / 2) : 0.002;
      if (k < 1) dh.size(1, l, 1).at(0, -0.075 - l / 2, 0.003); else dh.show(false);
      if (!dropped && K.since('hit') > 0.7) { dropped = true; ctx.spawn(ph, V(0, -0.16, 0.004), V(0, -0.2, 0), 0xffcf4a, 0.04, 0.6, 3); } }); } },
  schlangenschal: { slot: 'hals', build(ctx) {   // Schlange schnappt beim Zaubern
    const b = ctx.body, gr = lit(0x3fae4a), belly = lit(0xd8e86a);
    const loop = mesh(new THREE.TorusGeometry(0.095, 0.03, 7, 18), gr, b, 0, 1.5, 0); loop.rotation.x = Math.PI / 2; loop.scale.set(1, 0.85, 1);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; mesh(new THREE.SphereGeometry(0.012, 6, 4), lit(0x2a7a34), b, Math.sin(a) * 0.11, 1.53, Math.cos(a) * 0.095); }
    tube([V(-0.08, 1.5, 0.05), V(-0.11, 1.38, 0.13), V(-0.1, 1.22, 0.15), V(-0.08, 1.1, 0.14)], 0.024, gr, b);
    const neck = group(b, 0.08, 1.49, 0.07); key(neck);   // eigener Bone, damit der Kopf in Hals-Koordinaten liegt
    tube([V(0, 0, 0), V(0.03, -0.06, 0.06), V(0.04, -0.1, 0.11)], 0.022, gr, neck, false, 12);
    const hd = group(neck, 0.04, -0.1, 0.13), hh = key(hd);
    mesh(new THREE.SphereGeometry(1, 10, 7), gr, hd).scale.set(0.034, 0.024, 0.048);
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.008, 6, 4), lit(0xffe040), hd, s * 0.022, 0.014, 0.018);
    const tg = group(hd, 0, -0.006, 0.04), tgh = key(tg); plate([[-0.004, 0], [0.004, 0], [0.004, 0.03], [0.012, 0.045], [0, 0.035], [-0.012, 0.045], [-0.004, 0.03]], 0.002, lit(0xd02040), tg).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(1, 8, 5), belly, hd, 0, -0.01, 0.006).scale.set(0.024, 0.012, 0.036);
    ctx.tick(K => { const k = K.since('cast') / 0.45, l = k < 1 ? Math.sin(Math.PI * k) : 0; hh.at(0.04, -0.1, 0.13 + l * 0.1).rot(-l * 0.4); tgh.size(1, 1, Math.sin(K.t * 7) > 0.6 || l > 0.1 ? 1 : 0.01); }); } },

  // ---------------- Rücken ----------------
  killflagge: { slot: 'ruecken', build(ctx) {   // zeigt die Kills im Run als Zahl (Textur auf eigenem Mesh, strichMagier.ts)
    const b = ctx.body; seg(V(0.12, 0.95, -0.17), V(0.13, 2.28, -0.2), 0.011, 0.009, MAT.holz, b, false); mesh(new THREE.SphereGeometry(0.02, 8, 6), MAT.gold, b, 0.13, 2.29, -0.2);
    tube([V(-0.15, 1.42, 0.02), V(0, 1.3, -0.16), V(0.12, 1.1, -0.18)], 0.008, MAT.schwarz, b);
    const fg = group(b, 0.13, 2.15, -0.2), fh = key(fg); ctx.flag(fh);
    ctx.tick(K => fh.rot(0, K.sprint ? 0.9 : 0.35 + Math.sin(K.t) * 0.1, 0)); } },
  elementrucksack: { slot: 'ruecken', build(ctx) {   // Flüssigkeit in Elementfarbe, Füllstand = Mana
    const b = ctx.body, bag = lit(0x3a3a46);
    const pk = group(b, 0, 1.2, -0.2); key(pk);
    mesh(new THREE.BoxGeometry(0.28, 0.32, 0.1), bag, pk); mesh(new THREE.SphereGeometry(0.14, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), bag, pk, 0, 0.16, 0).scale.set(1, 0.4, 0.36);
    mesh(new THREE.BoxGeometry(0.2, 0.24, 0.02), MAT.stahl, pk, 0, -0.01, -0.052);
    const lq = group(pk, 0, 0, -0.064), lh = key(lq); mesh(new THREE.BoxGeometry(0.17, 1, 0.012), glowM(ctx.el), lq);
    mesh(new THREE.BoxGeometry(0.17, 0.21, 0.004), glassM(0xffffff, 0.2), pk, 0, -0.01, -0.072);
    for (const s of [-1, 1]) tube([V(s * 0.1, 1.36, -0.17), V(s * 0.13, 1.47, -0.02), V(s * 0.13, 1.4, 0.12), V(s * 0.1, 1.18, 0.13), V(s * 0.1, 1.05, -0.1)], 0.012, MAT.schwarz, b);
    let next = 0;
    ctx.tick(K => { const h = 0.21 * K.vals.mana + 0.001; lh.size(1, h, 1).at(0, -0.115 + h / 2, -0.064);
      if (K.t > next && K.vals.mana > 0.05) { next = K.t + 0.3; ctx.spawn('body', V(rnd(-0.07, 0.07), 1.09, -0.275), V(0, 0.12, 0), 0xffffff, 0.025, Math.max(0.1, h / 0.12)); } }); } },
  schriftrolle: { slot: 'ruecken', build(ctx) {   // rollt sich beim Level-Up auf
    const b = ctx.body, wood = lit(0x9a6a3a), Y = 1.47;
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.46, 12), lit(0xf1e2b8), b, 0, Y, -0.2).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.03, 8, 6), wood, b, s * 0.25, Y, -0.2);
    // Papier (Viewer: Textur mit Zeilen und Siegel): Fläche mit Zeilen und Siegel als Teile, die mit der Fläche gestaucht werden
    const paper = group(b, 0, Y, -0.24); paper.rotation.y = Math.PI; const ph = key(paper);
    mesh(new THREE.PlaneGeometry(0.38, 1), ds(lit(0xf1e2b8)), paper);
    for (let i = 0; i < 7; i++) mesh(new THREE.BoxGeometry(0.28 - (i % 3) * 0.04, 0.012, 0.002), lit(0x6a4a2a), paper, -(i % 3) * 0.02, 0.4 - i * 0.1, 0.003);
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.004, 12), lit(0xb0202a), paper, 0, -0.38, 0.004).rotation.x = Math.PI / 2;
    const bot = group(b, 0, Y, -0.235), bh = key(bot); mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12), lit(0xe8d6a8), bot).rotation.z = Math.PI / 2;
    tube([V(-0.17, 1.45, -0.18), V(-0.12, 1.4, 0.13), V(0.05, 1.2, 0.15), V(0.17, 1.02, 0.05), V(0.16, 1.0, -0.12)], 0.011, lit(0x6a4a2a), b);
    const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
    ctx.tick(K => { const k = K.since('level'), o = k < 0.4 ? ease(k / 0.4) : k < 2.6 ? 1 : k < 3 ? 1 - ease((k - 2.6) / 0.4) : 0, h = 0.02 + o * 0.72;
      ph.size(1, h, 1).at(0, Y - h / 2, -0.24); bh.at(0, Y - h - 0.01, o > 0.05 ? -0.245 : -0.235); }); } },
  gewitterwolke: { slot: 'ruecken', build(ctx) {   // nieselt im Stehen, blitzt bei Kill (Blitz und Regen als Partikel)
    const b = ctx.body, cl = group(b, 0, 2.08, -0.12), ch = key(cl), grey = lit(0x8a90a0), dk = lit(0x6a7080);
    for (const [x, y, z, r, m] of [[0, 0, 0, 0.11, grey], [0.12, -0.02, 0.02, 0.08, grey], [-0.12, -0.02, 0, 0.085, grey], [0.05, 0.06, -0.02, 0.085, grey], [-0.06, 0.05, 0.03, 0.07, grey], [0, -0.05, 0.05, 0.08, dk], [0.19, -0.04, -0.02, 0.05, dk], [-0.19, -0.04, 0.01, 0.05, dk]] as [number, number, number, number, Mat][]) mesh(new THREE.SphereGeometry(r, 10, 7), m, cl, x, y, z);
    let next = 0;
    ctx.on(e => { if (e !== 'kill') return;
      const tx = rnd(-0.6, 0.6), tz = rnd(0.3, 0.8);
      for (let i = 0; i <= KOS.boltPts; i++) { const k = i / KOS.boltPts; ctx.spawn(ch, V(tx * k + rnd(-0.06, 0.06), -0.06 - k * 1.95, tz * k + rnd(-0.06, 0.06)), V(0, 0, 0), 0xfff6a0, 0.07, 0.25); }
      ctx.spawn(ch, V(0, 0, 0), V(0, 0, 0), 0xfff6a0, 0.6, 0.3); });
    ctx.tick(K => { ch.at(Math.sin(K.t * 0.7) * 0.05, 2.08 + Math.sin(K.t * 1.3) * 0.03, -0.12);
      if (!K.sprint && K.t > next) { next = K.t + 1 / KOS.drizzle; ctx.spawn(ch, V(rnd(-0.18, 0.18), -0.08, rnd(-0.06, 0.08)), V(0, -2.2, 0), 0x8fc8ff, 0.025, 0.5); } }); } },
  limojetpack: { slot: 'ruecken', build(ctx) {   // sprudelt beim Sprint
    const b = ctx.body, bot: THREE.Vector3[] = [];
    tube([V(-0.13, 1.4, -0.13), V(0.13, 1.4, -0.13)], 0.012, MAT.schwarz, b, false, 4); tube([V(-0.13, 1.08, -0.16), V(0.13, 1.08, -0.16)], 0.012, MAT.schwarz, b, false, 4);
    for (const s of [-1, 1]) { const g = group(b, s * 0.075, 1.24, -0.22); g.rotation.z = s * 0.06;
      mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.22, 12), glassM(0x4ad86a, 0.55), g);
      mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.15, 12), lit(0xcff86a), g, 0, -0.025, 0);
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), lit(0xff8a2a), g, 0, 0.03, 0);
      mesh(new THREE.CylinderGeometry(0.048, 0.02, 0.06, 12), glassM(0x4ad86a, 0.55), g, 0, -0.14, 0); mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 8), lit(0xd8262a), g, 0, -0.18, 0); bot.push(g.position.clone()); }
    let acc = 0;
    ctx.tick(K => { if (!K.sprint) return; acc += K.dt * KOS.jet; for (; acc >= 1; acc--) for (const p of bot) for (let i = 0; i < 2; i++) ctx.spawn('body', p.clone().add(V(rnd(-0.01, 0.01), -0.2, 0)), V(rnd(-0.15, 0.15), rnd(-1.6, -1.0), rnd(-0.6, -0.2)), i ? 0xffffff : 0xcff86a, rnd(0.05, 0.09), 0.45, -1); }); } },

  // ---------------- Arme ----------------
  handschellen: { slot: 'arme', build(ctx) {   // Kette rasselt beim Zaubern
    const chains: Handle[] = [];
    for (const [arm, , el, wr, , s] of ctx.arms) { const g = group(arm); alongArm(g, el, wr, 0.86);
      mesh(new THREE.TorusGeometry(0.056, 0.018, 6, 14), MAT.stahl, g).rotation.x = Math.PI / 2; mesh(new THREE.BoxGeometry(0.03, 0.03, 0.025), MAT.stahl, g, s * 0.055, 0, 0);
      const ch = group(g, s * 0.07, 0, 0); chains.push(key(ch)); let y = 0;
      for (let i = 0; i < 4; i++) { const l = mesh(new THREE.TorusGeometry(0.024, 0.007, 5, 10, i === 3 ? Math.PI * 1.4 : Math.PI * 2), MAT.stahl, ch, 0, y - 0.024, 0); l.scale.y = 1.4; l.rotation.y = i % 2 ? Math.PI / 2 : 0; y -= 0.05; } }
    ctx.tick(K => { const k = K.since('cast'), a = k < 1.4 ? Math.sin(k * 16) * Math.exp(-k * 3) * 1.1 : Math.sin(K.t * 1.5) * 0.08; chains.forEach((c, i) => c.rot(a * (i ? 1 : -1), 0, a * 0.4)); }); } },
  krabbenscheren: { slot: 'arme', build(ctx) {   // schnappen bei Kill
    const red = lit(0xd8402e), lt = lit(0xf08a5a), jaws: [Handle, Handle][] = [];
    for (const [arm, , el, wr, ha, s] of ctx.arms) { seg(el.clone().lerp(wr, 0.5), wr, 0.05, 0.058, red, arm, false);
      const g = group(arm); g.position.copy(ha).add(V(0, -0.01, 0.01)); g.rotation.y = s * -0.4;
      mesh(new THREE.SphereGeometry(0.06, 10, 7), red, g, 0, 0.01, 0).scale.set(0.9, 1.1, 0.9);
      const up = group(g, 0, -0.03, 0.02), uh = key(up); plate([[0, 0], [0.025, -0.06], [0.01, -0.13], [-0.015, -0.1], [-0.02, -0.03]], 0.04, red, up).rotation.y = Math.PI / 2;
      const lo = group(g, 0, -0.03, -0.02), lh = key(lo); plate([[0, 0], [0.012, -0.05], [-0.004, -0.095], [-0.016, -0.04]], 0.034, lt, lo).rotation.y = Math.PI / 2;
      for (let i = 0; i < 3; i++) mesh(new THREE.ConeGeometry(0.006, 0.015, 5), MAT.weiss, up, 0, -0.04 - i * 0.025, -0.01).rotation.x = Math.PI / 2;
      jaws.push([uh, lh]); }
    ctx.tick(K => { const k = K.since('kill') / 0.35, open = k < 1 ? (k < 0.4 ? 0.7 * (1 - k / 0.4) : 0.7 * ((k - 0.4) / 0.6)) : 0.35 + Math.sin(K.t * 2) * 0.12, o = k < 1 && k >= 0.3 && k < 0.45 ? 0 : open;
      jaws.forEach(([u, l]) => { u.rot(o * 0.7); l.rot(-o * 0.5); }); }); } },
  nietenhandschuhe: { slot: 'arme', build(ctx) {   // Funken bei Crit
    const blk = lit(0x1c1a20), hands: Handle[] = [];
    for (const [arm, , el, wr, ha, s] of ctx.arms) { seg(el.clone().lerp(wr, 0.6), wr, 0.05, 0.053, blk, arm, false);
      const g = group(arm); g.position.copy(ha); hands.push(key(g)); mesh(new THREE.SphereGeometry(1, 10, 7), blk, g).scale.set(0.046, 0.06, 0.038);
      for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.01, 6, 4), lit(0xf1dcc6), g, s * 0.01, -0.06, (i - 1.5) * 0.017).scale.set(1, 1.2, 1);
      for (let i = 0; i < 6; i++) { const st = mesh(new THREE.ConeGeometry(0.008, 0.02, 5), MAT.stahl, g, s * 0.042, 0.03 - (i % 3) * 0.022, -0.012 + Math.floor(i / 3) * 0.024); st.rotation.z = -s * Math.PI / 2; }
      for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, st = mesh(new THREE.ConeGeometry(0.007, 0.018, 5), MAT.stahl, arm); st.position.copy(el.clone().lerp(wr, 0.75)).add(V(Math.sin(a) * 0.055, 0, Math.cos(a) * 0.055)); st.lookAt(st.position.clone().add(V(Math.sin(a), 0, Math.cos(a)))); st.rotateX(Math.PI / 2); } }
    ctx.on(e => { if (e === 'crit') hands.forEach(h => { for (let i = 0; i < 14; i++) ctx.spawn(h, V(0, 0, 0), V(rnd(-0.8, 0.8), rnd(0.2, 1.1), rnd(-0.8, 0.8)), i % 2 ? 0xffb04a : 0xfff0a0, 0.045, 0.55, 2.5); }); }); } },
  marionette: { slot: 'arme', build(ctx) {   // Fäden ziehen die Arme beim Zaubern (Arm-Bones, additiv auf die Pose; Fäden als Zylinder auf eigenen Bones)
    const b = ctx.body, cr = group(b, 0, 2.5, 0.02), crh = key(cr);
    mesh(new THREE.BoxGeometry(0.62, 0.035, 0.035), MAT.holz, cr); mesh(new THREE.BoxGeometry(0.035, 0.035, 0.3), MAT.holz, cr, 0, 0.01, 0);
    for (const [arm, , , wr] of ctx.arms) mesh(new THREE.TorusGeometry(0.048, 0.008, 5, 12), MAT.holz, arm).position.copy(wr);
    const strings = [0, 1, 2].map(() => { const g = group(b, 0, 1.8, 0); g.userData.free = true; const h = key(g); mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 4), lit(0x7a7468), g); return h; });
    const _a = V(), _b = V(), _m = V(), up = V(0, 1, 0), _d = V(), _qq = new THREE.Quaternion();
    const span = (h: Handle, a: THREE.Vector3, c: THREE.Vector3, root: THREE.Object3D) => {   // Faden von a nach c (Welt) → Bone im Raum der Figur
      root.worldToLocal(_a.copy(a)); root.worldToLocal(_b.copy(c)); _d.subVectors(_b, _a); const len = _d.length();
      h.bone?.position.copy(_m.addVectors(_a, _b).multiplyScalar(0.5)); h.bone?.quaternion.copy(_qq.setFromUnitVectors(up, _d.normalize())); h.bone?.scale.set(1, len, 1); };
    ctx.tick(K => { const k = K.since('cast') / 0.8, lift = k < 1 ? Math.sin(Math.PI * k) * 1.25 : 0.05 + Math.sin(K.t * 1.7) * 0.05, F = K.F;
      for (const a of [F.armL, F.armR]) a.ua.quaternion.premultiply(_qq.setFromAxisAngle(V(0, 0, 1), a.side * lift));
      crh.at(0, 2.5 + lift * 0.12, 0.02).rot(0, 0, Math.sin(K.t * 1.2) * 0.05);
      F.root.updateMatrixWorld(true);
      if (!crh.bone) return;
      const W = (o: THREE.Object3D, x: number, y: number, z: number) => o.localToWorld(V(x, y, z));
      [F.armL, F.armR].forEach((a, i) => span(strings[i], W(crh.bone, a.side * 0.3, 0, 0), a.hand.getWorldPosition(V()), F.root));
      span(strings[2], W(crh.bone, 0, 0, 0.13), W(F.head, 0, FIT.head.y + 0.14 * FIT.head.s, 0), F.root); }); } },
  schlangenarmreif: { slot: 'arme', build(ctx) {   // windet sich bei Treffer
    const gr = lit(0x3fae4a), inners: Handle[] = [];
    for (const [arm, , el, wr] of ctx.arms) { const g = group(arm); alongArm(g, el, wr, 0.5); const inn = group(g); inners.push(key(inn));
      const pts = helix(0.056, 0.17, 2.2, -0.085); tube(pts, 0.012, gr, inn, false, 40); const e = pts[pts.length - 1];
      const hd = mesh(new THREE.SphereGeometry(1, 8, 6), gr, inn); hd.position.copy(e).multiplyScalar(1.12); hd.scale.set(0.02, 0.016, 0.028);
      for (const q of [-1, 1]) mesh(new THREE.SphereGeometry(0.005, 5, 3), lit(0xffe040), inn, hd.position.x + q * 0.012, hd.position.y + 0.01, hd.position.z); }
    ctx.tick(K => { const k = K.since('hit'), w = k < 1.4 ? Math.sin(k * 18) * Math.exp(-k * 2.5) * 0.9 : 0; inners.forEach((n, i) => n.rot(0, w * (i ? 1 : -1) + K.t * 0.2, 0).size(1 + Math.abs(w) * 0.15)); }); } },

  // ---------------- Körper ----------------
  dreiteiler: { slot: 'koerper', build(ctx) {   // Krawatte weht beim Sprint
    const b = ctx.body, gry = lit(0x3a3f4a), vest = lit(0x2a2d36);
    suit(ctx, gry, { cuff: 0.052 });
    plate([[-0.085, 0.09], [0.085, 0.09], [0, -0.17]], 0.008, MAT.weiss, b, 0, 1.36, 0.135).rotation.x = -0.1;
    for (const s of [-1, 1]) { const l = plate([[0, 0.09], [0.03, 0.09], [0.06, -0.05], [0.0, -0.2]], 0.01, lit(0x30343e), b, s * 0.035, 1.36, 0.14); l.scale.x = s; l.rotation.x = -0.1; }
    plate([[-0.05, 0.02], [0.05, 0.02], [0.06, -0.12], [-0.06, -0.12]], 0.008, vest, b, 0, 1.2, 0.128);
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.008, 6, 4), MAT.schwarz, b, 0, 1.17 - i * 0.04, 0.138);
    plate([[0, 0], [0.03, 0.025], [0.035, 0], [0.02, -0.005]], 0.006, MAT.weiss, b, -0.12, 1.33, 0.12);
    for (const [arm, , el, wr] of ctx.arms) mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.025, 10), MAT.weiss, arm).position.copy(wr.clone().lerp(el, -0.05));
    for (const [leg, , , an] of ctx.legs) foot(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), MAT.schwarz, leg, an.x, 0.035, 0.05));   // Schuhe (Grundfigur des Viewers)
    const tie = group(b, 0, 1.42, 0.15), th = key(tie); mesh(new THREE.SphereGeometry(0.018, 8, 6), lit(0xb0203a), tie);
    plate([[0, 0], [0.026, -0.03], [0.034, -0.22], [0, -0.26], [-0.034, -0.22], [-0.026, -0.03]], 0.008, lit(0xb0203a), tie, 0, -0.01, 0.006);
    ctx.tick(K => { const s = K.sprint; th.rot(s ? -1.25 + Math.sin(K.t * 20) * 0.18 : Math.sin(K.t * 1.5) * 0.04, s ? Math.sin(K.t * 13) * 0.3 : 0, 0); }); } },
  schottenrock: { slot: 'koerper', build(ctx) {   // Karo, schwingt beim Laufen
    const b = ctx.body, g = group(b, 0, 0.9, 0), gh = key(g);
    mesh(new THREE.CylinderGeometry(KILT.rTop, KILT.rBot, KILT.h, KILT.around, KILT.rows, true), ds(lit(0x9c1c26, { fn: tartFn })), g, 0, -KILT.h / 2, 0).scale.z = KILT.sz;
    mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16), lit(0x3a2418), b, 0, 0.92, 0).scale.z = 0.8; mesh(new THREE.BoxGeometry(0.04, 0.035, 0.01), MAT.gold, b, 0, 0.92, 0.14);
    const sp = group(b, 0, 0.86, 0.17), sh = key(sp); mesh(new THREE.SphereGeometry(1, 10, 7), lit(0x6a4a2a), sp, 0, -0.06, 0).scale.set(0.055, 0.065, 0.025);
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.014, 6, 4), MAT.weiss, sp, (i - 1) * 0.022, -0.09, 0.02);
    for (const [leg, , , an] of ctx.legs) { seg(an.clone().add(V(0, 0.24, 0)), an.clone().add(V(0, 0.06, 0)), 0.064, 0.06, lit(0xece4d6), leg, false); foot(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), lit(0x3a2418), leg, an.x, 0.035, 0.05)); }
    ctx.tick(K => { const s = K.sprint ? 1 : 0.25; gh.rot(0, Math.sin(K.t * (K.sprint ? 11 : 2.4)) * 0.2 * s, 0).size(1 + s * 0.06 * Math.abs(Math.sin(K.t * 11)), 1, 1); sh.rot(-Math.abs(Math.sin(K.t * 11)) * 0.4 * s); }); } },
  bademantel: { slot: 'koerper', build(ctx) {   // Figur gähnt nach 10 s Idle (Kopf-Bone kippt, additiv)
    const b = ctx.body, terry = lit(0xbfe3f0), dk = lit(0x8ac0d6);
    suit(ctx, terry, { legs: false, cuff: 0.075, rb: 0.19 });
    mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.48, 18, 1, true), ds(terry), b, 0, 0.66, 0).scale.z = 0.78;
    for (const s of [-1, 1]) { const l = plate([[0, 0.12], [0.05, 0.12], [0.06, -0.08], [0, -0.2]], 0.014, dk, b, s * 0.02, 1.36, 0.135); l.scale.x = s; l.rotation.x = -0.12; }
    const belt = mesh(new THREE.TorusGeometry(0.19, 0.016, 5, 18), dk, b, 0, 1.0, 0); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.72, 1);
    const ends: Handle[] = []; for (const s of [-1, 1]) { const e = group(b, s * 0.04, 0.99, 0.15); ends.push(key(e)); plate([[-0.016, 0], [0.016, 0], [0.018, -0.2], [-0.018, -0.2]], 0.01, dk, e); }
    const duck = group(b, 0.12, 0.83, 0.16), dh = key(duck); mesh(new THREE.SphereGeometry(0.03, 8, 6), lit(0xffd820), duck); mesh(new THREE.SphereGeometry(0.02, 8, 6), lit(0xffd820), duck, 0, 0.035, 0.01); mesh(new THREE.ConeGeometry(0.008, 0.018, 5), lit(0xff8a2a), duck, 0, 0.033, 0.03).rotation.x = Math.PI / 2;
    plate([[-0.05, 0.03], [0.05, 0.03], [0.05, -0.06], [-0.05, -0.06]], 0.01, terry, b, 0.12, 0.8, 0.175);
    for (const [leg, , , an] of ctx.legs) { foot(mesh(new THREE.BoxGeometry(0.11, 0.06, 0.25), lit(0xffb6d0), leg, an.x, 0.04, 0.05)); foot(mesh(new THREE.SphereGeometry(0.045, 8, 6), lit(0xffd6e6), leg, an.x, 0.08, 0.14)); }
    const mouth = group(ctx.head, 0, -0.06, 0.104), mh = key(mouth); mesh(new THREE.SphereGeometry(1, 8, 6), lit(0x5a1a24), mouth).scale.set(0.02, 1, 0.008);
    let said = false;
    ctx.on(e => { if (e === 'idle') said = false; });
    ctx.tick(K => { ends.forEach((h, i) => h.rot(0, 0, Math.sin(K.t * 2 + i) * 0.12)); dh.rot(0, 0, Math.sin(K.t * 3) * 0.2);
      const k = K.since('idle') / 2.4;
      if (k < 1) { const y = Math.sin(Math.PI * k); K.F.head.rotation.x = -0.4 * y; mh.size(1, 0.001 + 0.03 * y, 1); if (!said && k > 0.2) { said = true; ctx.say('cos.say.yawn'); } }
      else { K.F.head.rotation.x = 0; mh.size(1, 0.001, 1); } }); } },
  schaf: { slot: 'koerper', build(ctx) {   // blökt beim Level-Up
    const b = ctx.body, w = lit(0xf4f1ea), dk = lit(0x3a3330);
    suit(ctx, w);
    for (let i = 0; i < 46; i++) { const y = rnd(0.95, 1.45), a = rnd(0, 6.28), r = 0.2 + (1.45 - y) * -0.06 + 0.02; mesh(new THREE.SphereGeometry(rnd(0.035, 0.055), 7, 5), w, b, Math.sin(a) * r, y, Math.cos(a) * r * 0.66); }
    for (const [arm, sh, el, , ha] of ctx.arms) { for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.04, 7, 5), w, arm).position.copy(sh.clone().lerp(el, i / 4)).add(V(rnd(-0.02, 0.02), 0, rnd(-0.03, 0.03)));
      const h = mesh(new THREE.SphereGeometry(1, 8, 6), dk, arm); h.position.copy(ha); h.scale.set(0.045, 0.05, 0.04); }
    for (const [leg, , , an] of ctx.legs) foot(mesh(new THREE.BoxGeometry(0.11, 0.08, 0.2), dk, leg, an.x, 0.04, 0.04));
    hood(ctx, w); for (let i = 0; i < 12; i++) { const a = rnd(-2.4, 2.4) + Math.PI, ph = rnd(0.1, 1.0); mesh(new THREE.SphereGeometry(rnd(0.035, 0.05), 7, 5), w, ctx.head, Math.sin(ph) * Math.sin(a) * 0.15, 0.03 + Math.cos(ph) * 0.15, Math.sin(ph) * Math.cos(a) * 0.15); }
    for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(1, 8, 6), dk, ctx.head, s * 0.16, 0.02, 0); e.scale.set(0.06, 0.022, 0.03); e.rotation.z = s * -0.4; }
    ctx.on(e => { if (e === 'level') ctx.say('cos.say.maeh'); });
    ctx.tick(K => { const k = K.since('level') / 0.6; ctx.hop(k < 1 ? Math.sin(Math.PI * k) * 0.12 : 0); }); } },
  kuh: { slot: 'koerper', build(ctx) {   // muht bei Kill-Serie (Flecken als Farbe je Dreieck)
    const b = ctx.body, m = lit(0xf6f3ec, { fn: cowFn }), pink = lit(0xffb6c6), horn = lit(0xf1e6cf);
    suit(ctx, m, { hs: COW.hs }); hood(ctx, m);
    for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(0.02, 0.08, 7), horn, ctx.head, s * 0.1, 0.14, -0.01).rotation.z = -s * 0.7;
      const e = mesh(new THREE.SphereGeometry(1, 8, 6), pink, ctx.head, s * 0.165, 0.04, 0); e.scale.set(0.055, 0.02, 0.03); e.rotation.z = s * -0.3; }
    mesh(new THREE.SphereGeometry(1, 10, 7), pink, b, 0, 1.0, 0.13).scale.set(0.06, 0.04, 0.03);
    const tail = group(b, 0, 0.95, -0.12), th = key(tail); tube([V(0, 0, 0), V(0, -0.1, -0.08), V(0, -0.3, -0.1)], 0.01, MAT.weiss, tail, false, 10); mesh(new THREE.SphereGeometry(0.03, 8, 6), MAT.schwarz, tail, 0, -0.31, -0.1);
    for (const [leg, , , an] of ctx.legs) foot(mesh(new THREE.BoxGeometry(0.11, 0.08, 0.2), MAT.schwarz, leg, an.x, 0.04, 0.04));
    ctx.on(e => { if (e === 'streak') ctx.say('cos.say.muh'); });
    ctx.tick(K => { th.rot(Math.sin(K.t * 2.5) * 0.3, 0, Math.sin(K.t * 1.7) * 0.4); const k = K.since('streak') / 0.5; ctx.hop(k < 1 ? Math.sin(Math.PI * k) * 0.08 : 0); }); } },
};
const KOS_IDS = Object.keys(COS);

// ---------------- Viewer-Raum → Bones der Figur ----------------
export interface KosPiece { bone: THREE.Bone; geo: THREE.BufferGeometry; color: any; m: THREE.Matrix4; glow: boolean; noShell: boolean }
export interface KosGlass { bone: THREE.Bone; geo: THREE.BufferGeometry; color: THREE.Color; alpha: number; m: THREE.Matrix4 }
function convert(tree: THREE.Object3D, frame: THREE.Matrix4, root: THREE.Bone, B, out: { pieces: KosPiece[]; glass: KosGlass[] }, pick: (o: THREE.Object3D) => boolean, figRoot: THREE.Object3D) {
  tree.updateMatrixWorld(true);
  const inv = frame.clone().invert();
  const walk = (o: THREE.Object3D, bone: THREE.Bone, base: THREE.Matrix4, moving: boolean) => {
    let b = bone, bs = base, mv = moving;
    const h = o.userData.kb as Handle | undefined;
    if (h) {   // eigener Bone: Lage relativ zum Eltern-Bone (free: im Raum der Figur, Reaktion setzt die Lage selbst)
      const local = bs.clone().multiply(o.matrixWorld), pos = V(), quat = new THREE.Quaternion(), scl = V();
      local.decompose(pos, quat, scl);
      if (o.userData.free) b = B(figRoot);
      else { b = B(bone, pos.x, pos.y, pos.z); b.quaternion.copy(quat); b.scale.copy(scl); }
      Object.assign(h, { bone: b, pos, quat, scl });
      bs = o.matrixWorld.clone().invert(); mv = true;
    }
    const mat = o.userData.mat as Mat;
    if (o.userData.geo && mat) {
      const m = bs.clone().multiply(o.matrixWorld);
      if (mat.glass != null) out.glass.push({ bone: b, geo: o.userData.geo, color: mat.c, alpha: mat.glass, m });
      else {
        const color = mat.g ? mat.c : mat.fn ? { fn: (p: THREE.Vector3) => litCol(mat.fn(p)) } : litCol(mat.c);
        out.pieces.push({ bone: b, geo: o.userData.geo, color, m, glow: !!mat.g, noShell: mv });
        if (mat.ds) out.pieces.push({ bone: b, geo: flip(o.userData.geo), color, m, glow: !!mat.g, noShell: mv });
      }
    }
    for (const c of o.children) walk(c, b, bs, mv);
  };
  for (const c of tree.children) if (pick(c)) walk(c, root, inv, false);
}

// Schul-Farbe, wenn die Waffe kein Element hat (Element-Rucksack)
// Skin → Element (ELEMENTS in baukasten.ts ist die Farbquelle); base und qm (?-Magier) haben kein Element
const SCHOOL_COL = { base: 0xd8d4e0, fire: ELEMENTS.feuer.color, ice: ELEMENTS.frost.color, arcane: ELEMENTS.arkan.color, qm: 0xffd23a, blitz: ELEMENTS.blitz.color, plague: ELEMENTS.seuche.color };
export interface KosBuilt {
  pieces: KosPiece[]; glass: KosGlass[]; flag: Handle | null; ids: string[];
  ticks: ((K: KosFrame) => void)[]; ons: ((e: KosEvent, K: KosFrame) => void)[];
  space: { head: THREE.Bone; body: THREE.Bone; neck?: THREE.Bone }; hop: number; says: string[];
  spawns: { space: Space; p: THREE.Vector3; v: THREE.Vector3; col: number; size: number; life: number; grav: number }[];
}
// F: Figur aus buildStrichMagier (Bones head, chest, hips, armL/armR mit ua/fa/hand, legL/legR mit th/sh/ft), B(parent, x, y, z) legt einen Bone an.
// sel: Look-ID je Slot. A1/A2 Arm-, L1/L2 Beinlängen, wel: Farbe des Waffen-Elements oder null, skin: Schul-Look (SKIN_OF)
export function kosmetikPieces(F, B, sel: Record<string, string>, A1: number, A2: number, L1: number, L2: number, wel: number | null, skin: string): KosBuilt {
  const out: KosBuilt = { pieces: [], glass: [], flag: null, ids: [], ticks: [], ons: [], space: null, hop: 0, says: [], spawns: [] };
  const body = new THREE.Group(), head = new THREE.Group(), neck = new THREE.Group();   // neck: Körper-Raum der Hals-Teile (KOS.neckUp)
  const arms: Arm[] = [[new THREE.Group(), P.shL, P.elL, P.wrL, P.haL, -1], [new THREE.Group(), P.shR, P.elR, P.wrR, P.haR, 1]];
  const legs: Leg[] = [[new THREE.Group(), P.hipL, P.knL, P.anL, -1], [new THREE.Group(), P.hipR, P.knR, P.anR, 1]];
  const ctx: Ctx = { body, head, arms, legs, el: wel ?? SCHOOL_COL[skin] ?? SCHOOL_COL.base,
    tick: fn => out.ticks.push(fn), on: fn => out.ons.push(fn),
    spawn: (space, p, v, col, size, life, grav = 0) => out.spawns.push({ space, p, v, col, size, life, grav }),
    say: k => out.says.push(t(k)), hop: h => { out.hop = Math.max(out.hop, h); }, flag: h => { out.flag = h; } };
  for (const id of Object.values(sel)) { if (!COS[id]) continue; SEED = 1 + KOS_IDS.indexOf(id) * 7; ctx.body = COS[id].slot === 'hals' ? neck : body; COS[id].build(ctx); out.ids.push(id); }
  if (!out.ids.length) return out;
  const { s, waist, hipSy } = FIT.body, ID = new THREE.Matrix4();
  const bodyRoot = B(F.chest, 0, -F.chest.position.y - waist * s, 0); bodyRoot.scale.setScalar(s);   // Viewer-Taille → Hüfte der Figur (wie gearParts)
  const headRoot = B(F.head, 0, FIT.head.y, 0); headRoot.scale.setScalar(FIT.head.s);
  out.space = { head: headRoot, body: bodyRoot };
  // Körper: unter der Taille (Rock, Bademantel-Saum, Ente) an der Hüfte, der Rest an der Brust
  const low = (o: THREE.Object3D) => o.position.y <= 1.0 && !o.userData.free;
  convert(body, ID, bodyRoot, B, out, o => !low(o), F.root);
  const hipRoot = B(F.hips, 0, -waist * hipSy, 0); hipRoot.scale.set(s, hipSy, s);
  convert(body, ID, hipRoot, B, out, low, F.root);
  convert(head, ID, headRoot, B, out, () => true, F.root);
  const neckRoot = B(F.chest, 0, -F.chest.position.y - waist * s + KOS.neckUp, 0); neckRoot.scale.setScalar(s);
  convert(neck, ID, neckRoot, B, out, () => true, F.root);
  if (neck.children.length) out.space.neck = neckRoot;
  const wp = (o: THREE.Object3D) => V().setFromMatrixPosition(o.matrixWorld);
  for (const [tree, sh, el, wr, , side] of arms) {   // Viewer-Arm −x (side −1) = armR der Figur (side −1)
    const arm = side > 0 ? F.armL : F.armR;
    tree.updateMatrixWorld(true);
    const ua = B(arm.ua), fa = B(arm.fa); ua.scale.setScalar(A1 / sh.distanceTo(el)); fa.scale.setScalar(A2 / el.distanceTo(wr));
    convert(tree, limbFrame(sh, el), ua, B, out, o => wp(o).distanceTo(sh) <= wp(o).distanceTo(el), F.root);
    convert(tree, limbFrame(el, wr), fa, B, out, o => wp(o).distanceTo(sh) > wp(o).distanceTo(el), F.root);
  }
  for (const [tree, hip, kn, an, side] of legs) {
    const leg = side > 0 ? F.legL : F.legR;
    tree.updateMatrixWorld(true);
    const th = B(leg.th), sh = B(leg.sh), ft = B(leg.ft); th.scale.setScalar(L1 / hip.distanceTo(kn)); sh.scale.setScalar(L2 / kn.distanceTo(an)); ft.scale.setScalar(s);
    convert(tree, limbFrame(hip, kn), th, B, out, o => !o.userData.foot && wp(o).distanceTo(hip) <= wp(o).distanceTo(kn), F.root);
    convert(tree, limbFrame(kn, an), sh, B, out, o => !o.userData.foot && wp(o).distanceTo(hip) > wp(o).distanceTo(kn), F.root);
    convert(tree, new THREE.Matrix4().makeTranslation(an.x, an.y, an.z), ft, B, out, o => !!o.userData.foot, F.root);
  }
  return out;
}

// Ein Teil allein im Viewer-Raum (Körper-Koordinaten, Boden = 0) fürs Vorschaubild (ui/itemThumb.ts): Kopf-Teile um P.head, Arme/Beine
// stehen schon in Körper-Koordinaten. Reaktionen laufen nicht (Ruhelage), freie Gruppen (Marionettenfäden) bleiben weg
export function kosmetikTree(id: string, el = SCHOOL_COL.arcane): THREE.Group | null {
  const c = COS[id];
  if (!c) return null;
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group();
  head.position.copy(P.head);
  const arms: Arm[] = [[new THREE.Group(), P.shL, P.elL, P.wrL, P.haL, -1], [new THREE.Group(), P.shR, P.elR, P.wrR, P.haR, 1]];
  const legs: Leg[] = [[new THREE.Group(), P.hipL, P.knL, P.anL, -1], [new THREE.Group(), P.hipR, P.knR, P.anR, 1]];
  const ticks: ((K: KosFrame) => void)[] = [], flags: Handle[] = [];
  const ctx: Ctx = { body, head, arms, legs, el, tick: fn => ticks.push(fn), on: () => {}, spawn: () => {}, say: () => {}, hop: () => {}, flag: h => flags.push(h) };
  SEED = 1 + KOS_IDS.indexOf(id) * 7;
  c.build(ctx);
  root.add(body, head, ...arms.map(a => a[0]), ...legs.map(l => l[0]));
  // Ruhelage wie an der Figur: die Reaktion setzt bewegte Gruppen direkt (statt eines Bones), z. B. Füllstand des Rucksacks, Lage der Flagge
  root.traverse(o => { const h = o.userData.kb as Handle | undefined; if (h && !o.userData.free) Object.assign(h, { bone: o, pos: o.position.clone(), quat: o.quaternion.clone(), scl: o.scale.clone() }); });
  const K: KosFrame = { t: 0, dt: 1 / 60, since: () => 1e9, sprint: false, vals: { mana: 0.7, kills: 1000 }, F: null };
  for (const fn of ticks) try { fn(K); } catch { /* Reaktion braucht die Figur (K.F): Ruhelage bleibt */ }
  for (const h of flags) if (h.bone) { const f = new THREE.PlaneGeometry(0.4, 0.25); f.translate(0.2, 0, 0); mesh(f, ds(lit(0xb0202a)), h.bone); }   // Fahne ohne Zahl (an der Figur Textur-Mesh)
  return root;
}

// Glas: ein Mesh für alle Glas-Teile der Figur, Deckkraft je Ecke (Farbe mit Alpha)
export function glassGeo(p: KosGlass, mw: THREE.Matrix4) {
  const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()); if (g.attributes.uv) g.deleteAttribute('uv');
  g.applyMatrix4(p.m).applyMatrix4(mw);
  const n = g.attributes.position.count, c = new Float32Array(n * 4), col = litCol(p.color);
  for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b, p.alpha], i * 4);
  g.setAttribute('color', new THREE.BufferAttribute(c, 4));
  return g;
}

// Kill-Flagge: Textur mit der Zahl, Fläche weht über die Ecken (Viewer)
export function makeKillFlag(ramp: THREE.Texture) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  // Vorder- und Rückseite in einer Geometrie (Rückseite mit gespiegelter Textur), damit die Zahl von beiden Seiten lesbar ist (die Spielkamera sieht die Rückseite)
  const front = new THREE.PlaneGeometry(0.4, 0.25, 12, 1); front.translate(0.2, 0, 0);
  const back = front.clone(), bi = back.index.array, bu = back.attributes.uv, bn = back.attributes.normal;
  for (let i = 0; i < bi.length; i += 3) { const x = bi[i + 1]; bi[i + 1] = bi[i + 2]; bi[i + 2] = x; }
  for (let i = 0; i < bu.count; i++) { bu.setX(i, 1 - bu.getX(i)); bn.setZ(i, -bn.getZ(i)); }
  const geo = mergeGeometries([front, back]);
  const mat = new THREE.MeshToonMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(KOS.flagDim), gradientMap: ramp });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.userData.noShadow = true; mesh.userData.ownMap = true;
  const base = (geo.attributes.position.array as Float32Array).slice();
  let shown = -1;
  const draw = (n: number) => { const g = cv.getContext('2d'); g.fillStyle = '#b0202a'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#18161c'; g.fillRect(0, 0, 256, 18); g.fillRect(0, 142, 256, 18);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 22px Inter, sans-serif'; g.fillText(t('cos.flag'), 128, 50); g.font = `900 ${n >= 10000 ? 56 : 72}px Inter, sans-serif`; g.fillText(String(n), 128, 122); tex.needsUpdate = true; };
  return { mesh, update(kills: number, tm: number, sprint: boolean) {
    if (shown !== kills) { shown = kills; draw(kills); }
    const a = geo.attributes.position; for (let i = 0; i < a.count; i++) { const x = base[i * 3]; a.setZ(i, Math.sin(x * 14 - tm * (sprint ? 12 : 5)) * 0.03 * (x / 0.4)); } a.needsUpdate = true;
  } };
}
