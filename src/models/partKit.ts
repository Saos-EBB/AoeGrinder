// Bausatz der Gear- und Kosmetik-Teile (Audit E9, DUP-10): Material-Beschreibung, Geometrie-Helfer und Viewer-Maße aus den Viewern
// (Gear-Baukasten, Kosmetik-Viewer), dazu die Umwandlung eines Teilbaums in Teile fürs Körper-Mesh von strichMagier.ts (convert).
// Quelle ist gearParts.ts (älter, schon exportiert); kosmetikParts.ts und ui/itemThumb.ts nutzen dasselbe.
// Ein Teil ist ein Object3D in Viewer-Koordinaten ohne echtes Material: userData.geo (Geometrie) und userData.mat (Mat).
// Segmentzahlen bleiben je Aufrufer (seg/torso/tube haben sie als Parameter): gleiche Zahlen, gleiches Bild.

import * as THREE from 'three';
import { V } from '../util';

// c: Farbe, g = 1: leuchtet (Glüh-Teil), ds: beidseitig, glass: Deckkraft (Kosmetik-Glas), fn: Farbe je Dreieck (Muster), null: nicht bauen
export type Mat = { c: THREE.Color; g?: 0 | 1; ds?: boolean; glass?: number; fn?: (p: THREE.Vector3) => THREE.Color } | null;
export const lit = (c: number | THREE.Color, o: Partial<NonNullable<Mat>> = {}): Mat => ({ c: new THREE.Color(c as any), g: 0, ...o });
export const glow = (c: number | THREE.Color): Mat => ({ c: new THREE.Color(c as any), g: 1 });
export const ds = (m: Mat): Mat => (m ? { ...m, ds: true } : m);

// Beleuchtete Teile dunkler als im Viewer: die Lampe (dunkel.ts) und der Rand heben sie sonst über die Bloom-Schwelle // PH
export const PART_LIGHT = {
  lit: 0.45,        // Faktor auf die Viewer-Farbe
  cap: 0.36,        // hellster Kanal beleuchteter Teile (linear), sonst blüht Kristall/Gold weiß aus
};
export const litCol = (c: THREE.Color) => { const o = c.clone().multiplyScalar(PART_LIGHT.lit), k = Math.max(o.r, o.g, o.b); return k > PART_LIGHT.cap ? o.multiplyScalar(PART_LIGHT.cap / k) : o; };

// ---------------- Geometrie-Helfer (wie im Viewer, Teile ohne echtes Material) ----------------
export function mesh(geo: THREE.BufferGeometry, mat: Mat, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.userData.geo = geo; o.userData.mat = mat; parent.add(o); return o;
}
// Zylinder von a nach b (r1 bei a), joint: Kugel am Anfang. hs: Höhen-Segmente (Muster), segs: Segmente rundum
export function seg(a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: Mat, parent: THREE.Object3D, joint = true, hs = 1, segs = hs > 1 ? 12 : 8) {
  const d = b.clone().sub(a), len = d.length(); const m = mesh(new THREE.CylinderGeometry(r2, r1, len, segs, hs), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  if (joint) mesh(new THREE.SphereGeometry(r1, 8, 6), mat, parent).position.copy(a);
  return m;
}
// Rumpf: Zylinder mit flacher Kappe oben. segs/capSegs: Segmente rundum von Zylinder und Kappe
export function torso(parent: THREE.Object3D, mat: Mat, yTop: number, yBot: number, rTop: number, rBot: number, depth = 0.62, hs = 1, segs = hs > 1 ? 20 : 14, capSegs = 14) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, yTop - yBot, segs, hs), mat, parent, 0, (yTop + yBot) / 2, 0); m.scale.z = depth;
  const cap = mesh(new THREE.SphereGeometry(rTop, capSegs, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat, parent, 0, yTop, 0); cap.scale.set(1, 0.35, depth); return m;
}
export const tube = (pts: THREE.Vector3[], r: number, mat: Mat, parent: THREE.Object3D, closed = false, n = 24) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), n, r, 5, closed), mat, parent);
export const helix = (r: number, h: number, turns: number, y0 = 0) => { const p = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * turns * Math.PI * 2; p.push(V(Math.cos(a) * r, y0 + i / 40 * h, Math.sin(a) * r)); } return p; };
// Flache Platte aus einem 2D-Umriss (x, y), leicht abgeschrägt, depth dick, um z = 0 zentriert
export function plate(pts: number[][], depth: number, mat: Mat, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const sh = new THREE.Shape(); pts.forEach(([px, py], i) => (i ? sh.lineTo(px, py) : sh.moveTo(px, py))); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 4 }); g.translate(0, 0, -depth / 2);
  return mesh(g, mat, parent, x, y, z);
}
export const spike = (l: number, w: number) => [[-w / 2, 0], [w / 2, 0], [0, l]];
export const alongArm = (g: THREE.Object3D, el: THREE.Vector3, wr: THREE.Vector3, t = 0.55) => { g.position.copy(el).lerp(wr, t); g.quaternion.setFromUnitVectors(V(0, 1, 0), wr.clone().sub(el).normalize()); };

// Manga-Proportionen des Viewers (Körper-Koordinaten, Boden = 0); die Figur im Spiel ist größer, FIT bildet die Viewer-Maße auf die Bones ab.
// Nur lesen (geteilt von Gear und Kosmetik)
export const VP = { head: V(0, 1.67, 0), shL: V(-0.19, 1.44, 0), elL: V(-0.24, 1.14, -0.01), wrL: V(-0.26, 0.88, 0.02), haL: V(-0.265, 0.83, 0.02),
  shR: V(0.19, 1.44, 0), elR: V(0.24, 1.14, 0), wrR: V(0.26, 0.9, 0.06), haR: V(0.265, 0.85, 0.07),
  hipL: V(-0.09, 0.9, 0), knL: V(-0.1, 0.49, 0.01), anL: V(-0.105, 0.08, 0), hipR: V(0.09, 0.9, 0), knR: V(0.1, 0.49, 0.01), anR: V(0.105, 0.08, 0) };
// Maße der Figur im Spiel: Kopf-Mitte 0,16 über dem Kopf-Bone und etwa 1,5 × so groß wie im Viewer; Rumpf ab Hüfte (y 1,0) etwa 1,15 × höher
export const FIT = { head: { y: 0.16, s: 1.5 }, body: { waist: 0.98, s: 1.15, hipSy: 1.05 } };   // PH

// Rahmen eines Arm-Segments im Viewer: Ursprung a, y zeigt von b nach a (zum Gelenk darüber), z möglichst nach vorn
export function limbFrame(a: THREE.Vector3, b: THREE.Vector3) {
  const y = a.clone().sub(b).normalize(), z0 = V(0, 0, 1), z = z0.sub(y.clone().multiplyScalar(y.dot(z0))).normalize(), x = y.clone().cross(z);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(a);
}
export const flip = (g: THREE.BufferGeometry) => {   // Rückseite für offene Flächen (Viewer DoubleSide): Dreiecke umdrehen, Normalen umkehren
  const f = (g.index ? g.toNonIndexed() : g.clone()), p = f.attributes.position, n = f.attributes.normal;
  for (let i = 0; i < p.count; i += 3) for (const a of [p, n]) { if (!a) continue; const t = [a.getX(i + 1), a.getY(i + 1), a.getZ(i + 1)]; a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, t[0], t[1], t[2]); }
  if (n) for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return f;
};

// ---------------- Viewer-Raum → Bones der Figur ----------------
export interface PartPiece { bone: THREE.Bone; geo: THREE.BufferGeometry; color: any; m: THREE.Matrix4; glow: boolean; noShell: boolean }
export interface PartGlass { bone: THREE.Bone; geo: THREE.BufferGeometry; color: THREE.Color; alpha: number; m: THREE.Matrix4 }
// Eigene Bones für bewegte Gruppen: own(o) sagt, ob o einen bekommt; bone() legt ihn an (Lage pos/quat/scl relativ zum Eltern-Bone) und merkt ihn sich
// (gear: Animation/Aura, Kosmetik: Handle, frei im Raum der Figur)
export interface BoneHook {
  own: (o: THREE.Object3D) => boolean;
  bone: (o: THREE.Object3D, parent: THREE.Bone, pos: THREE.Vector3, quat: THREE.Quaternion, scl: THREE.Vector3) => THREE.Bone;
}
// Wandelt einen Teilbaum: frame = Viewer-Matrix des Rahmens, root = Bone, der den Rahmen im Spiel trägt (Lage + Größe), pick: welche Kinder der Wurzel.
// Beleuchtete Teile bekommen litCol, Muster (fn) je Dreieck, beidseitige Teile eine gespiegelte Rückseite, Glas geht nach out.glass. noShell: auf eigenem Bone
export function convert(tree: THREE.Object3D, frame: THREE.Matrix4, root: THREE.Bone, out: { pieces: PartPiece[]; glass?: PartGlass[] }, pick: (o: THREE.Object3D) => boolean, hook: BoneHook) {
  tree.updateMatrixWorld(true);
  const inv = frame.clone().invert();
  const walk = (o: THREE.Object3D, bone: THREE.Bone, base: THREE.Matrix4, moving: boolean) => {   // base: Viewer-Matrix, an der bone hängt (invertiert)
    let b = bone, bs = base, mv = moving;
    if (hook.own(o)) {   // eigener Bone: Lage relativ zum Eltern-Bone
      const local = bs.clone().multiply(o.matrixWorld), pos = V(), quat = new THREE.Quaternion(), scl = V();
      local.decompose(pos, quat, scl);
      b = hook.bone(o, bone, pos, quat, scl);
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
