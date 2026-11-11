// Bausatz der Strich-Figuren (Audit E9, DUP-08/DUP-15): was strichMagier.ts, strichKrieger.ts, strichMob.ts und creatures.ts gleich brauchen.
// Toon-Verlauf, Status-Tönungen, Kapsel nach unten, Geometrie vorbereiten (Vertex-Farben), Lichtrand und Zwei-Knochen-IK.
// Die Zahlen sind die der Viewer; ändern heißt: alle Figuren sehen anders aus.

import * as THREE from 'three';
import { clamp, V } from '../util';

// 3-Stufen-Toon (dunkel, mittel, hell), geteilt von allen Strich-Materialien
export const grad = new THREE.DataTexture(new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;

// Status-Tönungen der Mobs (Spell-Viewer): verlangsamt blau, tot, Gift grün, Fliehen lila. Nur lesen, nie ändern (geteilt)
export const TINTS = { slow: new THREE.Color(0x5f86c8), dead: new THREE.Color(0x5a5048), poison: new THREE.Color(0x4a8a1a), fear: new THREE.Color(0x6a3a7a) };

// Kapsel, die vom Gelenk nach unten hängt (Ober-/Unterarm, Bein)
export const capDown = (r: number, len: number, rs = 6) => { const g = new THREE.CapsuleGeometry(r, len, 2, rs); g.translate(0, -len / 2, 0); return g; };

// Lichtrand: bleibt im Dunkeln sichtbar (wie Klingenstrich). Eine Farbe für Magier, Krieger und Mobs (der Krieger hatte bis E9 [0.62, 0.62, 0.68], keine Absicht) // PH
export const RIM = { color: [0.5, 0.55, 0.65], power: 2.6 };
// GLSL-Ausdruck für outgoingLight (MeshToonMaterial, onBeforeCompile); Faktoren davor (Glühen, Eis) setzt der Aufrufer
export const rimChunk = (color: number[], power: number) =>
  `vec3(${color.join(',')}) * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), ${power.toFixed(1)})`;

// Geometrie für ein verschmolzenes Mesh: ohne Index und UV, Normalen, Lage (m), Vertex-Farbe.
// color: THREE.Color, { base, tip } (mit flick: Verlauf Basis → Spitze), { fn(p) } (Farbe je Dreieck, Mitte in Bind-Lage) oder { pal } (mit facet: Farbe je Dreieck aus der Palette).
// o.flat: harte Kanten (Normalen neu); o.flick: Attribut flick 0 an der Basis, 1 an der Spitze (lokales y vor der Lage); o.flickAttr: flick immer anlegen (0, wenn nicht flick)
export interface PrepOpts { flat?: boolean; flick?: boolean; flickAttr?: boolean; facet?: (tri: number, salt: number) => number }
const _tc = new THREE.Vector3(), _tv = new THREE.Vector3();
export function prep(geo, color, m?, o: PrepOpts = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (o.flat && g.attributes.normal) g.deleteAttribute('normal');
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (o.flick) { // 0 an der Basis, 1 an der Spitze (lokales y vor der Transformation)
    g.computeBoundingBox(); const b = g.boundingBox, f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = (g.attributes.position.getY(i) - b.min.y) / Math.max(1e-4, b.max.y - b.min.y);
    g.setAttribute('flick', new THREE.BufferAttribute(f, 1));
  }
  if (m) g.applyMatrix4(m);
  const col = new Float32Array(n * 3);
  // Muster (Kosmetik: Kuh-Flecken, Karo): color.fn(Mitte des Dreiecks in Bind-Lage) → Farbe je Dreieck
  const tri = color.fn ? Array.from({ length: n / 3 | 0 }, (_, k) => { const p = g.attributes.position; _tc.set(0, 0, 0); for (let j = 0; j < 3; j++) _tc.add(_tv.fromBufferAttribute(p, k * 3 + j)); return color.fn(_tc.multiplyScalar(1 / 3)); }) : null;
  const c2 = o.flick && color.tip ? color.tip : null;
  for (let i = 0; i < n; i++) {
    const c = tri ? tri[i / 3 | 0] : c2 ? color.base.clone().lerp(c2, g.attributes.flick.array[i]) : color.pal && o.facet ? color.pal[Math.floor(o.facet(i / 3 | 0, n) * color.pal.length)] : (color.base || color);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (o.flickAttr && !g.attributes.flick) g.setAttribute('flick', new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
}

// Zwei-Knochen-IK: upper/lower hängen nach unten (−y), l1/l2 Längen, Ziel und Pol in Weltkoordinaten
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), DOWN = V(0, -1, 0);
export function ik(upper, lower, l1, l2, targetW, poleW) {
  const par = upper.parent;
  const T = par.worldToLocal(_a.copy(targetW)), pole = par.worldToLocal(_b.copy(poleW)), P = upper.position;
  const d = _c.subVectors(T, P); const L = clamp(d.length(), 1e-3, l1 + l2 - 1e-3); d.normalize();
  const al = Math.acos(clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1));
  const pp = _d.subVectors(pole, P); pp.addScaledVector(d, -pp.dot(d)); if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1); pp.normalize();
  const eDir = _e.copy(d).multiplyScalar(Math.cos(al)).addScaledVector(pp, Math.sin(al));
  upper.quaternion.setFromUnitVectors(DOWN, eDir);
  const E = _b.copy(P).addScaledVector(eDir, l1);
  const lDir = _a.copy(P).addScaledVector(d, L).sub(E).normalize();
  _q.setFromUnitVectors(DOWN, lDir); lower.quaternion.copy(_q2.copy(upper.quaternion).invert().multiply(_q));
}
