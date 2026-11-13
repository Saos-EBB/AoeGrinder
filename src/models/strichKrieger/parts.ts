// Bau-Helfer des Strichkriegers (KOMP-04): Farben, Matrizen, Teile-Liste, getaggte Merges. Aus strichKrieger.ts herausgezogen, Werte unverändert.
import * as THREE from 'three';
import { V } from '../../util';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prep as kitPrep } from '../strichKit';
import type { Fig } from './fig';

export const TAU = Math.PI * 2;
export const L1 = .5, L2 = .48, A1 = .35, A2 = .33;   // Ober-/Unterschenkel, Ober-/Unterarm
export const C = { ink: new THREE.Color(0x2b2b33), plate: new THREE.Color(0x5a1a14), cloth: new THREE.Color(0xa3151b),
  iron: new THREE.Color(0x4a4d54), edge: new THREE.Color(0xc4c8cd), wrap: new THREE.Color(0x7a1a14), guard: new THREE.Color(0x26231f) };
// flat: harte Kanten (Low-Poly-Look der Skins), strichKit.ts prep
export const prep = (geo, color, m?, flat = false) => kitPrep(geo, color, m, { flat });
export const M4 = (pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl));
export const LOOK_DIM = .5;   // PH
export const col = (hex: number) => new THREE.Color(hex).multiplyScalar(LOOK_DIM);
export const hp = (x, y, z) => [x * 1.3, .13 + y * 1.3, z * 1.38];   // PH
export const ext = (pts, depth) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
export const tube = (pts, r, seg = 12, rs = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), seg, r, rs);
// Holzfäller-Gags: Kerben = Kills im Run (höchstens notches sichtbar), ab gold goldener Stiel, ab sprout ein Sprössling, alle perLog Kills ein Scheit
export const HOLZ = { notches: 40, gold: 100, sprout: 500, perLog: 20, logs: 15 };   // PH
// Teile-Liste der Figur: part() hängt ein Teil an einen Bone, alles landet in einem Körper-Mesh. pm: Matrix einer Teile-Gruppe davor (Skins). Rückgabe: Eintrag, Skins färben ihn um (color), werfen ihn raus (drop) oder markieren ihn (tag)
export function partKit(F: Pick<Fig, 'parts'>) {
  const parts = F.parts;
  function part(bone, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], pm = null) {
    const e: any = { bone, geo, color, m: pm ? pm.clone().multiply(M4(pos, rot, scl)) : M4(pos, rot, scl) };
    parts.push(e); return e;
  }
  const drop = (...es) => { for (const e of es.flat()) { const i = parts.indexOf(e); if (i >= 0) parts.splice(i, 1); } };
  const paint = (c, ...es) => { for (const e of es.flat()) e.color = c; };
  // Stab von a nach b (Punkte im Bone-Raum)
  function rod(bone, a, b, r, c, r2 = r, seg = 5) {
    const d = V(...b).sub(V(...a)), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    const e = part(bone, new THREE.CylinderGeometry(r2, r, d.length(), seg), c);
    e.m = new THREE.Matrix4().compose(V(...a).add(d.multiplyScalar(.5)), q, V(1, 1, 1)); return e;
  }
  const band = (bone, pos, r, t, c, scl = [1, 1, 1], seg = 12) => part(bone, new THREE.TorusGeometry(r, t, 4, seg), c, pos, [Math.PI / 2, 0, 0], scl);
  return { part, drop, paint, rod, band };
}
// Ränge je tag (Vertex-Anfang, Anzahl) im gemergten Mesh: Skins blenden Teile aus (zusammenfallen lassen) oder färben sie um, ohne Draw Call
export function mergeTagged(list) {
  const ranges = {}; let o = 0;
  for (const { g, tag } of list) { const n = g.attributes.position.count; if (tag) (ranges[tag] ??= []).push([o, n]); o += n; }
  const geo = mergeGeometries(list.map(x => x.g));
  return { geo, ranges, orig: geo.attributes.position.array.slice() };
}
export function showTag(tg, tag, on) {
  const a = tg.geo.attributes.position.array;
  for (const [o, n] of tg.ranges[tag] ?? []) {
    if (on) a.set(tg.orig.subarray(o * 3, (o + n) * 3), o * 3);
    else for (let i = 0; i < n; i++) a.set(tg.orig.subarray(o * 3, o * 3 + 3), (o + i) * 3);
  }
  tg.geo.attributes.position.needsUpdate = true;
}
export function tintTag(tg, tag, c) {
  const a = tg.geo.attributes.color.array;
  for (const [o, n] of tg.ranges[tag] ?? []) for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], (o + i) * 3);
  tg.geo.attributes.color.needsUpdate = true;
}
