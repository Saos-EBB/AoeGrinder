// Gear-Teile an der Figur (Gear-Baukasten v3, docs/ref/gear-baukasten.html, Handoff docs/handoffs/gear-modelle.md).
// Kanäle: Slot → Silhouette · Wertgruppe → Form (5 × 5) · Hersteller → Stoff in Hausfarbe + Ornamente im Material · Element → Leuchtkante/Funken
// · Fokus-Schule → Emblem · Seltenheit → grau/weiß matt, ab Blau Leuchtkante, ab Lila 2 Splitter, Orange Aura.
// Die Formen sind aus dem Viewer übernommen (BUILD), gebaut in Viewer-Koordinaten als Object3D-Baum ohne Material: jedes Teil trägt in userData
// Geometrie und Farbe (geo, mat = { c, g }). gearPieces wandelt den Baum in Teile für das Körper-Mesh von strichMagier.ts (wie buildLook):
// alles an Bones, Leuchtteile als Glühen (aGlow), 0 Draw Calls extra. Bewegte Gruppen (userData.sway, spinZ, orbit …) bekommen eigene Bones.
// Weniger Segmente als im Viewer (die Figur ist Low-Poly), keine Inverted-Hull-Outline (toon.ts-Rand), Kristall ohne Transparenz.

import * as THREE from 'three';
import { spellElement } from '../config';
import { FIGURE_LIST } from '../figureTable';
import { ELEMENTS } from './weapons/baukasten';
import { V } from '../util';

type Mat = { c: THREE.Color; g: 0 | 1; ds?: boolean } | null;   // g = 1: leuchtet (Glüh-Teil), ds: beidseitig, null: nicht bauen

// ---------------- Daten aus dem Viewer ----------------
export const GP = {   // Optik-Zahlen // PH
  lit: 0.45,        // beleuchtete Teile dunkler als im Viewer: die Lampe (dunkel.ts) und der Rand heben sie sonst über die Bloom-Schwelle
  cap: 0.36,        // hellster Kanal beleuchteter Teile (linear), sonst blüht Kristall/Gold weiß aus
  ghost: 0.6,       // Geisterklingen: im Viewer additiv mit 55 % Deckkraft, hier opakes Glühen in Elementfarbe × ghost
  line: 0.85,       // Linien des Runenkreises (Viewer 85 % Deckkraft)
};
const MAKER_COL = {   // Viewer MAKERS: main Ornament-Material, acc Akzent, trim Kante unter Blau, cloth Stoff in Hausfarbe
  stern: { main: 0xd9a63a, acc: 0xfff2c4, trim: 0x2a2030, cloth: 0x3a2f5c },
  morra: { main: 0x5a3420, acc: 0x8a5a36, trim: 0xb08a5a, cloth: 0x3a2a22 },
  grab: { main: 0xb06e38, acc: 0x4f8a6a, trim: 0x3f6e58, cloth: 0x2f4a40 },
  vey: { main: 0xc8ecff, acc: 0xffffff, trim: 0x4f7eb0, cloth: 0xdfe9f5 },   // Kristall: im Spiel ohne Transparenz, nur hell
  brandt: { main: 0x3e6490, acc: 0x1c2638, trim: 0x1c2232, cloth: 0x22324e },
};
// Elementfarben aus ELEMENTS (baukasten.ts, einzige Quelle); none = helles Grau statt Schwarz
const EL_COL = { none: 0xd8d4e0, ...Object.fromEntries(['frost', 'feuer', 'blitz', 'seuche', 'arkan'].map(k => [k, ELEMENTS[k].color])) };
// Fokus-Schulen = Elemente der Figuren (figureTable.ts), Arkan hat kein Emblem
const FOCUS_COL = Object.fromEntries(FIGURE_LIST.filter(f => f.element).map(f => [f.element, ELEMENTS[f.element].color]));

const lit = (c: number | THREE.Color): Mat => ({ c: new THREE.Color(c as any), g: 0 });
const glow = (c: number | THREE.Color): Mat => ({ c: new THREE.Color(c as any), g: 1 });
const ds = (m: Mat): Mat => (m ? { ...m, ds: true } : m);

export interface GearLookItem { r: number; s: { maker?: string; element?: string; focus?: string } }
// Materialien eines Teils wie matsOf im Viewer
function matsOf(item: GearLookItem) {
  const mk = MAKER_COL[item.s.maker] ?? MAKER_COL.stern, rar = item.r, el = item.s.element in EL_COL ? item.s.element : 'none', elCol = EL_COL[el];
  const fe = spellElement(item.s.focus), school = fe in FOCUS_COL ? fe : 'none';
  const dim = (c: number, k: number) => new THREE.Color(c).multiplyScalar(k).getHex();
  return {
    main: lit(rar <= 1 ? dim(mk.main, rar === 0 ? 0.55 : 0.8) : mk.main), acc: lit(mk.acc), trim: lit(mk.trim),
    cloth: lit(rar <= 1 ? dim(mk.cloth, 0.8) : mk.cloth),
    el: glow(rar >= 3 ? elCol : 0xb8b0c8), elCol, rar, focus: rar >= 3 ? school : 'none',
  };
}
type M = ReturnType<typeof matsOf>;
const edge = (M: M) => (M.rar >= 3 ? M.el : M.trim);   // Leuchtkante ab Blau

// ---------------- Geometrie-Helfer (wie im Viewer, Teile ohne echtes Material) ----------------
function mesh(geo: THREE.BufferGeometry, mat: Mat, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.userData.geo = geo; o.userData.mat = mat; parent.add(o); return o;
}
function seg(a, b, r1, r2, mat, parent) { const d = b.clone().sub(a), len = d.length(); const m = mesh(new THREE.CylinderGeometry(r2, r1, len, 8), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return m; }
void seg;
function torso(parent, mat, yTop, yBot, rTop, rBot, depth = 0.62) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, yTop - yBot, 12), mat, parent, 0, (yTop + yBot) / 2, 0); m.scale.z = depth;
  const cap = mesh(new THREE.SphereGeometry(rTop, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat, parent, 0, yTop, 0); cap.scale.set(1, 0.35, depth); return m;
}
const tube = (pts, r, mat, parent, closed = false, n = 20) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), n, r, 5, closed), mat, parent);
const helix = (r, h, turns, y0 = 0) => { const p = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * turns * Math.PI * 2; p.push(V(Math.cos(a) * r, y0 + i / 40 * h, Math.sin(a) * r)); } return p; };
const alongArm = (g, el, wr, t = 0.55) => { g.position.copy(el).lerp(wr, t); g.quaternion.setFromUnitVectors(V(0, 1, 0), wr.clone().sub(el).normalize()); };
// Manga-Proportionen des Viewers; die Figur im Spiel ist größer, gearPieces bildet die Viewer-Maße auf die Bones ab
export const VP = { head: V(0, 1.67, 0), shL: V(-0.19, 1.44, 0), elL: V(-0.24, 1.14, -0.01), wrL: V(-0.26, 0.88, 0.02),
  shR: V(0.19, 1.44, 0), elR: V(0.24, 1.14, 0), wrR: V(0.26, 0.9, 0.06) };

function emblem(parent, focus, x, y, z, s = 1) {   // Fokus-Schule als Emblem: Frost Kristall, Feuer Flamme, Blitz Zickzack, Seuche Phiole
  if (focus === 'none') return;
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10), lit(0x1a1622), g).rotation.x = Math.PI / 2;
  const c = glow(FOCUS_COL[focus]);
  if (focus === 'frost') mesh(new THREE.OctahedronGeometry(0.022), c, g, 0, 0, 0.012);
  if (focus === 'feuer') mesh(new THREE.ConeGeometry(0.016, 0.045, 6), c, g, 0, 0.004, 0.012);
  if (focus === 'blitz') tube([V(-0.01, 0.022, 0.012), V(0.008, 0.004, 0.012), V(-0.008, -0.002, 0.012), V(0.01, -0.022, 0.012)], 0.005, c, g, false, 8);
  if (focus === 'seuche') { mesh(new THREE.SphereGeometry(0.016, 6, 4), c, g, 0, -0.006, 0.012); mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 5), c, g, 0, 0.014, 0.012); }
}
function rarityExtras(parent, M: M, x, y, z, r = 0.12) {   // ab Lila: 2 schwebende Splitter; Orange: Aura (Partikel, Anker hier)
  if (M.rar >= 4) for (let k = 0; k < 2; k++) { const o = mesh(new THREE.OctahedronGeometry(0.02), M.el, parent, x, y, z); o.userData.orbit = { a: k * Math.PI, r, y }; }
  if (M.rar >= 5) { const a = new THREE.Object3D(); a.position.set(x, y, z); a.userData.aura = r * 4; parent.add(a); }
}
function plate(pts, depth, mat, parent, x = 0, y = 0, z = 0) {
  const sh = new THREE.Shape(); pts.forEach(([px, py], i) => (i ? sh.lineTo(px, py) : sh.moveTo(px, py))); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 4 }); g.translate(0, 0, -depth / 2);
  return mesh(g, mat, parent, x, y, z);
}
const leaf = (l, w) => [[0, 0], [w * 0.5, l * 0.25], [w * 0.35, l * 0.7], [0, l], [-w * 0.2, l * 0.6], [-w * 0.3, l * 0.2]];
const blade = (l, w) => [[-w / 2, 0], [w / 2, 0], [w * 0.3, l * 0.75], [0, l], [-w * 0.15, l * 0.7]];
const spike = (l, w) => [[-w / 2, 0], [w / 2, 0], [0, l]];
const spikeDown = (l, w) => [[-w / 2, 0], [0, -l], [w / 2, 0]];
const diamond = (h, w) => [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]];
const crescent = (r, t, n = 10) => { const a = [], b = []; for (let i = 0; i <= n; i++) { const u = Math.PI * (0.15 + 0.7 * i / n); a.push([Math.cos(u) * r, Math.sin(u) * r]); b.unshift([Math.cos(u) * (r - t), Math.sin(u) * (r - t) + t * 0.4]); } return a.concat(b); };
function taper(pts, r0, r1, mat, parent, flat = 1) {
  const curve = new THREE.CatmullRomCurve3(pts), N = 12, R = 6, pos = [], idx = [];
  const frames = curve.computeFrenetFrames(N, false);
  for (let i = 0; i <= N; i++) { const p = curve.getPointAt(i / N), r = r0 + (r1 - r0) * (i / N);
    for (let j = 0; j < R; j++) { const a = j / R * Math.PI * 2, n = frames.normals[i].clone().multiplyScalar(Math.cos(a) * r), bn = frames.binormals[i].clone().multiplyScalar(Math.sin(a) * r * flat); const v = p.clone().add(n).add(bn); pos.push(v.x, v.y, v.z); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) { const a = i * R + j, b = i * R + (j + 1) % R, c = (i + 1) * R + j, d = (i + 1) * R + (j + 1) % R; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return mesh(g, mat, parent);
}

// ---------------- Formen: Slot × Wertgruppe (Viewer BUILD, v3) ----------------
const BUILD = {
  kopf: {
    off(h, M: M) {   // Spitzhut: hoher, geknickter Zauberhut mit gezackter Krempe
      const brim = new THREE.Shape(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 0.2 : 0.24; i ? brim.lineTo(Math.cos(a) * r, Math.sin(a) * r) : brim.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const b = mesh(new THREE.ExtrudeGeometry(brim, { depth: 0.012, bevelEnabled: false }), M.cloth, h, 0, 0.07, 0); b.rotation.x = Math.PI / 2;
      taper([V(0, 0.07, 0), V(0, 0.22, -0.01), V(0.02, 0.36, -0.04), V(0.1, 0.44, -0.1)], 0.13, 0.008, M.cloth, h);
      mesh(new THREE.TorusGeometry(0.128, 0.014, 4, 16), M.main, h, 0, 0.09, 0).rotation.x = Math.PI / 2;
      plate(spike(0.07, 0.05), 0.016, edge(M), h, 0, 0.09, 0.13);
      emblem(h, M.focus, 0, 0.16, 0.1, 0.7); rarityExtras(h, M, 0.1, 0.45, -0.1, 0.12); },
    tempo(h, M: M) {   // Reisehut: breite, geschwungene Krempe, lange Feder nach hinten
      const b = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.012, 16), M.cloth, h, 0, 0.07, 0); b.rotation.set(-0.2, 0, 0.15);   // Krempe etwas stärker gekippt (Plan: offener Punkt) // PH
      mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), M.cloth, h, 0, 0.13, 0);
      mesh(new THREE.TorusGeometry(0.13, 0.012, 4, 16), M.main, h, 0, 0.09, 0).rotation.x = Math.PI / 2;
      const f = plate(leaf(0.42, 0.07), 0.01, edge(M), h, 0.1, 0.12, 0); f.rotation.set(0, Math.PI / 2, -0.96); f.userData.sway = true;   // Feder flacher: nach hinten, ~35° steigend (im Viewer stand sie beim Wehen senkrecht) // PH
      emblem(h, M.focus, 0, 0.1, 0.135, 0.6); rarityExtras(h, M, 0, 0.32, -0.1, 0.18); },
    leben(h, M: M) {   // Weite Kapuze: tiefer Stoff, Saum in Metall
      const hood = mesh(new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.7), ds(M.cloth), h, 0, 0.0, -0.03); hood.scale.set(1.05, 1.15, 1.15);
      taper([V(0, 0.15, -0.12), V(0, 0.05, -0.24), V(0, -0.1, -0.26)], 0.06, 0.02, M.cloth, h);
      const rim = mesh(new THREE.TorusGeometry(0.16, 0.012, 4, 16, Math.PI * 1.4), M.main, h, 0, -0.01, 0.06); rim.rotation.set(0.3, 0, -Math.PI * 0.2);
      mesh(new THREE.TorusGeometry(0.16, 0.005, 4, 16, Math.PI * 1.4), edge(M), h, 0, -0.01, 0.075).rotation.set(0.3, 0, -Math.PI * 0.2);
      emblem(h, M.focus, 0, 0.14, 0.14, 0.7); rarityExtras(h, M, 0, 0.32, 0, 0.2); },
    mana(h, M: M) {   // Segment-Diadem: feiner Reif, 5 schwebende Sicheln im Halbbogen
      mesh(new THREE.TorusGeometry(0.12, 0.009, 4, 16), M.main, h, 0, 0.06, 0).rotation.x = Math.PI / 2 - 0.15;
      plate(diamond(0.06, 0.04), 0.02, edge(M), h, 0, 0.07, 0.12);
      const arc = new THREE.Group(); arc.position.set(0, 0.12, -0.04); h.add(arc); arc.userData.spinY = 0.5;
      for (let k = 0; k < 5; k++) { const a = (k / 4 - 0.5) * Math.PI * 1.1; const sg = plate(crescent(0.05, 0.016, 6), 0.012, k === 2 ? edge(M) : M.main, arc, Math.sin(a) * 0.19, 0.12 + Math.cos(a) * 0.05, -Math.cos(a) * 0.04); sg.rotation.z = -a; }
      emblem(h, M.focus, 0, 0.0, 0.13, 0.6); rarityExtras(h, M, 0, 0.32, -0.05, 0.2); },
    radius(h, M: M) {   // Sonnenhalo: Ring hinter dem Kopf mit Strahlen, dreht langsam
      mesh(new THREE.TorusGeometry(0.118, 0.01, 4, 16), M.main, h, 0, 0.06, 0).rotation.x = Math.PI / 2;
      const halo = new THREE.Group(); halo.position.set(0, 0.16, -0.2); h.add(halo); halo.userData.spinZ = 0.3;
      mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 24), M.main, halo); mesh(new THREE.TorusGeometry(0.17, 0.005, 4, 24), edge(M), halo);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, sp = plate(spike(k % 2 ? 0.07 : 0.12, 0.03), 0.008, M.main, halo, Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0); sp.rotation.z = a - Math.PI / 2; }
      emblem(h, M.focus, 0, 0.0, 0.13, 0.6); rarityExtras(h, M, 0, 0.4, -0.2, 0.24); },
  },
  hals: {
    off(b, M: M) {   // Stehkragen: hoher, spitz auslaufender Magier-Kragen aus Stoff, Metallkante
      const col = mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.24, 14, 1, true, Math.PI * 0.42, Math.PI * 1.16), ds(M.cloth), b, 0, 1.58, -0.01); col.scale.z = 0.8;
      for (const s of [-1, 1]) { const tip = plate(spike(0.12, 0.08), 0.01, M.cloth, b, s * 0.17, 1.66, 0.04); tip.rotation.set(0.2, s * 0.6, -s * 0.5); }
      mesh(new THREE.TorusGeometry(0.2, 0.007, 4, 18, Math.PI * 1.16), edge(M), b, 0, 1.7, -0.01).rotation.set(Math.PI / 2, 0, Math.PI * 0.92);
      plate(diamond(0.05, 0.035), 0.016, M.main, b, 0, 1.45, 0.12);
      emblem(b, M.focus, 0, 1.38, 0.13, 0.8); rarityExtras(b, M, 0, 1.75, -0.05, 0.2); },
    tempo(b, M: M) {   // Windschal: um den Hals, zwei lange Enden wehen nach hinten
      const r = mesh(new THREE.TorusGeometry(0.1, 0.04, 6, 14), M.cloth, b, 0, 1.48, 0); r.rotation.x = Math.PI / 2; r.scale.set(1, 0.85, 1);
      const tails = new THREE.Group(); tails.position.set(0.04, 1.47, -0.08); b.add(tails); tails.userData.sway = true;
      taper([V(0, 0, 0), V(0.08, -0.08, -0.15), V(0.2, -0.05, -0.38), V(0.32, -0.12, -0.62)], 0.05, 0.02, M.cloth, tails, 0.3);
      taper([V(-0.04, 0, 0), V(0.0, -0.12, -0.14), V(0.08, -0.16, -0.34), V(0.14, -0.28, -0.5)], 0.045, 0.018, M.main, tails, 0.3);
      mesh(new THREE.TorusGeometry(0.1, 0.008, 4, 14), edge(M), b, 0, 1.45, 0.005).rotation.x = Math.PI / 2;
      emblem(b, M.focus, -0.05, 1.45, 0.12, 0.8); rarityExtras(b, M, 0, 1.6, -0.2, 0.2); },
    leben(b, M: M) {   // Stola: dicker Stoff über die Schultern, zwei breite Bahnen vorn, Quasten
      const st = mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 16), M.cloth, b, 0, 1.45, 0); st.rotation.x = Math.PI / 2; st.scale.set(1, 0.72, 1);
      for (const s of [-1, 1]) { const band = plate([[-0.04, 0], [0.04, 0], [0.045, -0.42], [-0.045, -0.42]], 0.015, M.cloth, b, s * 0.085, 1.43, 0.13); band.rotation.x = -0.12;
        plate([[-0.045, 0], [0.045, 0], [0.045, -0.04], [-0.045, -0.04]], 0.02, M.main, b, s * 0.085, 1.02, 0.18);
        mesh(new THREE.ConeGeometry(0.02, 0.07, 6), edge(M), b, s * 0.085, 0.95, 0.18); }
      emblem(b, M.focus, 0.085, 1.25, 0.15, 0.8); rarityExtras(b, M, 0, 1.6, 0, 0.24); },
    mana(b, M: M) {   // Fokus-Amulett: Kette als V, großer Rahmen mit Edelstein
      tube([V(-0.08, 1.48, 0.06), V(-0.04, 1.35, 0.12), V(0, 1.3, 0.135), V(0.04, 1.35, 0.12), V(0.08, 1.48, 0.06)], 0.007, M.main, b, false, 14);
      plate(diamond(0.13, 0.09), 0.02, M.main, b, 0, 1.24, 0.14); plate(diamond(0.08, 0.05), 0.03, edge(M), b, 0, 1.24, 0.145);
      for (const s of [-1, 1]) plate(spike(0.05, 0.025), 0.012, M.main, b, s * 0.05, 1.24, 0.14).rotation.z = -s * Math.PI / 2;
      emblem(b, M.focus, 0, 1.15, 0.15, 0.7); rarityExtras(b, M, 0, 1.24, 0.17, 0.12); },
    radius(b, M: M) {   // Gebetskette: große Perlen in weitem Bogen, Anhänger
      const c = new THREE.CatmullRomCurve3([V(-0.15, 1.46, 0.02), V(-0.16, 1.3, 0.12), V(0, 1.12, 0.15), V(0.16, 1.3, 0.12), V(0.15, 1.46, 0.02), V(0, 1.5, -0.1)], true);
      for (let k = 0; k < 22; k++) { const p = c.getPointAt(k / 22); mesh(new THREE.IcosahedronGeometry(k % 4 === 0 ? 0.026 : 0.018, 0), k % 4 === 0 ? edge(M) : M.main, b, p.x, p.y, p.z); }
      plate(crescent(0.05, 0.02, 8), 0.014, M.main, b, 0, 1.04, 0.15).rotation.z = Math.PI;
      emblem(b, M.focus, 0, 1.06, 0.16, 0.7); rarityExtras(b, M, 0, 1.2, 0.17, 0.16); },
  },
  ruecken: {
    off(b, M: M) {   // Geisterklingen: schwebende, leuchtende Klingen im Fächer hinter dem Rücken
      const fan = new THREE.Group(); fan.position.set(0, 1.35, -0.3); b.add(fan); fan.userData.bob = true;
      const ghost = glow(new THREE.Color(M.elCol).multiplyScalar(GP.ghost));
      for (let k = 0; k < 6; k++) { const a = (k / 5 - 0.5) * 2.1, bl = plate(blade(0.42 - Math.abs(k - 2.5) * 0.05, 0.06), 0.008, k % 2 ? M.main : ghost, fan, Math.sin(a) * 0.08, 0, 0); bl.rotation.z = -a; bl.translateY(0.05); }
      emblem(fan, M.focus, 0, -0.02, 0.01, 1); rarityExtras(b, M, 0, 1.75, -0.3, 0.3); },
    tempo(b, M: M) {   // Wehender Umhang: zweigeteilt, flattert
      for (const s of [-1, 1]) { const c = plate([[-0.13, 0], [0.13, 0], [0.18, -0.95], [0.02, -0.85], [-0.14, -0.95]], 0.012, M.cloth, b, s * 0.11, 1.45, -0.17); c.rotation.set(0.12, 0, s * 0.08); c.userData.tail = s * 0.5;
        mesh(new THREE.SphereGeometry(0.03, 6, 4), M.main, b, s * 0.13, 1.45, -0.06); }
      plate([[-0.006, 0], [0.006, 0], [0.006, -0.85], [-0.006, -0.85]], 0.02, edge(M), b, 0, 1.45, -0.17);
      rarityExtras(b, M, 0, 1.0, -0.35, 0.35); },
    leben(b, M: M) {   // Schutzsiegel: schwebendes Sechseck-Schild hinter dem Rücken (die durchsichtige Fläche des Viewers fällt weg)
      const g = new THREE.Group(); g.position.set(0, 1.2, -0.32); b.add(g); g.userData.spinZ = 0.15;
      const ring = []; for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2; ring.push(V(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0)); } tube(ring, 0.012, M.main, g, false, 24);
      mesh(new THREE.TorusGeometry(0.18, 0.006, 4, 24), edge(M), g);
      emblem(g, M.focus, 0, 0, 0.01, 1.4); rarityExtras(b, M, 0, 1.2, -0.34, 0.36); },
    mana(b, M: M) {   // Schwebende Bücher: drei offene Folianten kreisen hinter dem Rücken
      for (let k = 0; k < 3; k++) { const bk = new THREE.Group(); b.add(bk); bk.userData.orbit = { a: k / 3 * Math.PI * 2, r: 0.28, y: 1.35, back: -0.32, flat: true };
        for (const s of [-1, 1]) { const c = mesh(new THREE.BoxGeometry(0.11, 0.15, 0.012), M.cloth, bk, s * 0.055, 0, 0); c.rotation.y = s * 0.35; mesh(new THREE.BoxGeometry(0.1, 0.14, 0.008), lit(0xece0c0), bk, s * 0.052, 0, 0.01).rotation.y = s * 0.35; }
        mesh(new THREE.BoxGeometry(0.012, 0.15, 0.02), M.main, bk); mesh(new THREE.BoxGeometry(0.05, 0.006, 0.004), edge(M), bk, 0.05, 0.02, 0.02); }
      emblem(b, M.focus, 0, 1.35, -0.32, 1.1); rarityExtras(b, M, 0, 1.35, -0.32, 0.36); },
    radius(b, M: M) {   // Runenkreis: flacher Zauberkreis hinter dem Rücken, dreht sich
      const g = new THREE.Group(); g.position.set(0, 1.3, -0.3); b.add(g); g.userData.spinZ = 0.35;
      const lineM = M.rar >= 3 ? glow(new THREE.Color(M.elCol).multiplyScalar(GP.line)) : lit(0xd8d0e8);
      for (const r of [0.4, 0.33, 0.2]) mesh(new THREE.TorusGeometry(r, r === 0.33 ? 0.004 : 0.008, 3, 32), r === 0.4 ? M.main : lineM, g);
      const tri = []; for (let k = 0; k <= 3; k++) { const a = k / 3 * Math.PI * 2 + Math.PI / 2; tri.push(V(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0)); } tube(tri, 0.004, lineM, g, false, 12);
      tube(tri.map(p => V(-p.x, -p.y, 0)), 0.004, lineM, g, false, 12);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; plate(diamond(0.04, 0.025), 0.006, lineM, g, Math.cos(a) * 0.365, Math.sin(a) * 0.365, 0); }
      emblem(g, M.focus, 0, 0, 0.01, 1.3); rarityExtras(b, M, 0, 1.3, -0.32, 0.45); },
  },
  arme: {   // Schulter + Ärmel. a = Arm-Gruppe (Körper-Koordinaten des Viewers), sh/el/wr, s = Seite (+1 = +x)
    off(a, M: M, sh, el, wr, s) {   // Zackenmantel-Schulter + Zackenärmel: Stoffspitzen, die nach unten hängen
      const p = new THREE.Group(); p.position.copy(sh).add(V(s * 0.02, 0.02, 0)); a.add(p);
      for (let i = 0; i < 3; i++) { const t = plate(spikeDown(0.16 - i * 0.03, 0.09), 0.01, i === 1 ? M.main : M.cloth, p, s * (0.02 + i * 0.035), 0.03, -0.04 + i * 0.04); t.rotation.set(0, s * Math.PI / 2, -s * 0.25); }
      const g = new THREE.Group(); a.add(g); alongArm(g, el, wr, 0.75);
      const cuff = mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 6, 1, true), ds(M.cloth), g, 0, -0.06, 0); cuff.rotation.y = 0.5;
      for (let i = 0; i < 3; i++) { const t = plate(spikeDown(0.12, 0.06), 0.008, i === 1 ? edge(M) : M.cloth, g, Math.sin(i * 2.1) * 0.08, -0.12, Math.cos(i * 2.1) * 0.08); t.rotation.y = i * 2.1; }
      mesh(new THREE.TorusGeometry(0.062, 0.01, 4, 10), M.main, g, 0, 0.0, 0).rotation.x = Math.PI / 2;
      if (s > 0) { emblem(g, M.focus, 0, -0.02, 0.07, 0.6); rarityExtras(a, M, sh.x, sh.y + 0.18, 0, 0.12); } },
    tempo(a, M: M, sh, el, wr, s) {   // Flatterärmel: weiter Ärmel mit langem Band, das nachweht, Feder an der Schulter
      const g = new THREE.Group(); a.add(g); alongArm(g, el, wr, 0.6);
      mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.2, 10, 1, true), ds(M.cloth), g, 0, -0.04, 0);
      mesh(new THREE.TorusGeometry(0.11, 0.008, 4, 12), edge(M), g, 0, -0.14, 0).rotation.x = Math.PI / 2;
      const rib = new THREE.Group(); rib.position.set(0, -0.12, -0.08); g.add(rib); rib.userData.sway = true;
      taper([V(0, 0, 0), V(0, -0.1, -0.1), V(s * 0.04, -0.15, -0.28)], 0.03, 0.01, M.main, rib, 0.25);
      const f = plate(leaf(0.18, 0.05), 0.008, M.main, a, sh.x + s * 0.03, sh.y + 0.02, -0.03); f.rotation.set(0, s * Math.PI / 2, s > 0 ? 2.4 : -2.4);
      if (s > 0) { emblem(g, M.focus, 0, 0.04, 0.07, 0.6); rarityExtras(a, M, sh.x, sh.y + 0.18, 0, 0.12); } },
    leben(a, M: M, sh, el, wr, s) {   // Puffärmel: weich gepolsterte Schulter, gewickelter Unterarm
      const puff = mesh(new THREE.SphereGeometry(0.1, 10, 7), M.cloth, a); puff.position.copy(sh).add(V(s * 0.02, -0.02, 0)); puff.scale.set(1, 1.15, 1);
      mesh(new THREE.TorusGeometry(0.085, 0.012, 4, 12), M.main, a, sh.x + s * 0.02, sh.y - 0.12, 0).rotation.set(Math.PI / 2, 0, 0);
      const g = new THREE.Group(); a.add(g); alongArm(g, el, wr, 0.55);
      for (let i = 0; i < 5; i++) { const w = mesh(new THREE.TorusGeometry(0.05, 0.016, 5, 10), i === 2 ? edge(M) : M.cloth, g, 0, -0.08 + i * 0.04, 0); w.rotation.set(Math.PI / 2 + (i % 2 ? 0.25 : -0.25), 0, 0); }
      if (s > 0) { emblem(a, M.focus, sh.x + s * 0.1, sh.y, 0.05, 0.7); rarityExtras(a, M, sh.x, sh.y + 0.2, 0, 0.14); } },
    mana(a, M: M, sh, el, wr, s) {   // Schwebende Sicheln über der Schulter + Ringstapel
      const p = new THREE.Group(); p.position.copy(sh).add(V(s * 0.04, 0.1, 0)); a.add(p); p.userData.bob = true;
      for (let i = 0; i < 3; i++) { const c = plate(crescent(0.07 - i * 0.012, 0.018, 6), 0.012, i === 1 ? edge(M) : M.main, p, 0, i * 0.035, 0); c.rotation.set(Math.PI / 2, 0, s * 0.4); }
      const g = new THREE.Group(); a.add(g); alongArm(g, el, wr, 0.55);
      for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(0.058 + i * 0.006, 0.013, 4, 10), i === 1 ? edge(M) : M.main, g, 0, -0.06 + i * 0.06, 0); r.rotation.x = Math.PI / 2; r.userData.wobble = i; }
      if (s > 0) { emblem(g, M.focus, 0, 0, 0.07, 0.6); rarityExtras(a, M, sh.x, sh.y + 0.22, 0, 0.12); } },
    radius(a, M: M, sh, el, wr, s) {   // Bänder: lange Stoffbänder um den Arm, Perlen an den Enden
      const g = new THREE.Group(); a.add(g); alongArm(g, el, wr, 0.2);
      tube(helix(0.052, 0.3, 3.5), 0.011, M.cloth, g, false, 36); tube(helix(0.056, 0.3, 3.5, 0.008), 0.004, edge(M), g, false, 36);
      const rib = new THREE.Group(); rib.position.set(0, 0.0, 0); g.add(rib); rib.userData.sway = true;
      taper([V(0, 0, 0.04), V(s * 0.06, -0.12, 0.02), V(s * 0.04, -0.3, -0.04)], 0.012, 0.006, M.cloth, rib, 0.3);
      mesh(new THREE.SphereGeometry(0.02, 6, 4), M.main, rib, s * 0.04, -0.31, -0.04);
      mesh(new THREE.SphereGeometry(0.03, 8, 5), M.main, a, sh.x + s * 0.04, sh.y + 0.02, 0);
      if (s > 0) { emblem(g, M.focus, 0, 0.15, 0.07, 0.6); rarityExtras(a, M, sh.x, sh.y + 0.18, 0, 0.14); } },
  },
  koerper: {
    off(b, M: M) {   // Kampfrobe: schlanke Robe, Saum in Zacken, Schärpe quer
      torso(b, M.cloth, 1.46, 1.0, 0.208, 0.15, 0.64);
      const hem = new THREE.Group(); hem.position.set(0, 0.98, 0); b.add(hem);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, t = plate(spikeDown(0.5 + (k % 2) * 0.18, 0.12), 0.01, M.cloth, hem, Math.sin(a) * 0.16, 0, Math.cos(a) * 0.16 * 0.8); t.rotation.y = a; t.rotateX(0.18); }
      const sash = mesh(new THREE.BoxGeometry(0.07, 0.6, 0.014), M.main, b, 0, 1.2, 0.135); sash.rotation.z = 0.62;
      mesh(new THREE.BoxGeometry(0.012, 0.6, 0.016), edge(M), b, 0, 1.2, 0.14).rotation.z = 0.62;
      emblem(b, M.focus, -0.08, 1.3, 0.15, 1); rarityExtras(b, M, 0, 1.25, 0.2, 0.3); },
    tempo(b, M: M) {   // Schwingenmantel: schmaler Mantel, zwei lange Schöße fliegen nach hinten
      torso(b, M.cloth, 1.46, 1.0, 0.212, 0.15, 0.64);
      for (const s of [-1, 1]) { const t = plate(leaf(0.75, 0.2), 0.012, M.cloth, b, s * 0.07, 1.02, -0.1); t.rotation.set(Math.PI - 0.35, 0, s * 0.25); t.userData.tail = s; }
      for (const s of [-1, 1]) plate([[-0.006, 0], [0.006, 0], [0.006, 0.42], [-0.006, 0.42]], 0.02, edge(M), b, s * 0.07, 1.02, 0.13);
      mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 16), M.main, b, 0, 1.0, 0).rotation.x = Math.PI / 2;
      emblem(b, M.focus, 0, 1.32, 0.15, 1); rarityExtras(b, M, 0, 1.25, 0.2, 0.3); },
    leben(b, M: M) {   // Weite Robe: bodenlang, breiter Wappenrock, Kordelgürtel
      torso(b, M.cloth, 1.46, 0.95, 0.22, 0.18, 0.7);
      const sk = mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.88, 14, 1, true), ds(M.cloth), b, 0, 0.52, 0); sk.scale.z = 0.78;
      plate([[-0.08, 0.3], [0.08, 0.3], [0.08, -0.55], [0, -0.62], [-0.08, -0.55]], 0.014, M.main, b, 0, 0.88, 0.16);
      plate([[-0.006, 0.28], [0.006, 0.28], [0.006, -0.55], [-0.006, -0.55]], 0.02, edge(M), b, 0, 0.88, 0.165);
      const belt = mesh(new THREE.TorusGeometry(0.17, 0.018, 4, 16), M.main, b, 0, 0.99, 0); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.75;
      emblem(b, M.focus, 0, 1.05, 0.18, 1.2); rarityExtras(b, M, 0, 1.25, 0.2, 0.32); },
    mana(b, M: M) {   // Runenrobe: Robe mit leuchtendem Runenstreifen vorn und Saum aus Bahnen
      torso(b, M.cloth, 1.46, 1.0, 0.208, 0.15, 0.64);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, sl = plate([[-0.05, 0], [0.05, 0], [0.04, -0.62], [-0.04, -0.62]], 0.01, k % 2 ? M.cloth : M.main, b, Math.sin(a) * 0.16, 1.0, Math.cos(a) * 0.16 * 0.75); sl.rotation.y = a; sl.rotateX(0.14); }
      for (let k = 0; k < 6; k++) plate(diamond(0.035, 0.022), 0.012, edge(M), b, 0, 1.4 - k * 0.075, 0.14);
      emblem(b, M.focus, 0, 0.95, 0.16, 1); rarityExtras(b, M, 0, 1.25, 0.2, 0.3); },
    radius(b, M: M) {   // Weiter Saum: weit ausgestellte Robe, Ring am Saum, Mittelbahn
      torso(b, M.cloth, 1.46, 1.0, 0.208, 0.15, 0.64);
      const sk = mesh(new THREE.CylinderGeometry(0.16, 0.42, 0.62, 16, 1, true), ds(M.cloth), b, 0, 0.67, 0); sk.scale.z = 0.8;
      const ring = mesh(new THREE.TorusGeometry(0.42, 0.016, 4, 28), edge(M), b, 0, 0.36, 0); ring.rotation.x = Math.PI / 2; ring.scale.y = 0.8;
      plate([[-0.05, 0.3], [0.05, 0.3], [0.08, -0.3], [-0.08, -0.3]], 0.02, M.main, b, 0, 0.7, 0.26).rotation.x = -0.4;
      emblem(b, M.focus, 0, 1.3, 0.14, 1); rarityExtras(b, M, 0, 0.6, 0, 0.5); },
  },
};

// Baut ein Teil im Viewer-Raum. Kopf: Kopf-Mitte = Ursprung. Arme: { L: Arm −x, R: Arm +x } in Körper-Koordinaten. Sonst Körper-Koordinaten (Boden = 0)
export function buildGearTree(slot: string, group: string, item: GearLookItem): THREE.Object3D | { L: THREE.Object3D; R: THREE.Object3D } | null {
  const fn = BUILD[slot]?.[group];
  if (!fn) return null;
  const M = matsOf(item);
  if (slot === 'arme') {
    const L = new THREE.Group(), R = new THREE.Group();
    fn(L, M, VP.shL, VP.elL, VP.wrL, -1); fn(R, M, VP.shR, VP.elR, VP.wrR, 1); orbitStart(L); orbitStart(R);
    return { L, R };
  }
  const root = new THREE.Group(); fn(root, M); orbitStart(root); return root;
}
// Kreisende Teile (Splitter, Bücher) stehen in der Bind-Pose dort, wo die Bahn des Viewers bei t = 0 liegt
export const orbitPos = (u, t: number, out = V()) => { const a = u.a + t * 1.2;
  return u.flat ? out.set(Math.cos(a) * u.r, u.y + Math.sin(a) * u.r, u.back) : out.set(Math.cos(a) * u.r, u.y + Math.sin(t * 2 + u.a) * 0.02, Math.sin(a) * u.r); };
function orbitStart(root: THREE.Object3D) { root.traverse(o => { if (o.userData.orbit) orbitPos(o.userData.orbit, 0, o.position); }); }

// ---------------- Viewer-Raum → Bones der Figur (strichMagier.ts) ----------------
// Maße der Figur im Spiel: Kopf-Mitte 0,16 über dem Kopf-Bone und etwa 1,5 × so groß wie im Viewer; Rumpf ab Hüfte (y 1,0) etwa 1,15 × höher;
// Arme über Rahmen je Ober-/Unterarm (Ursprung Schulter bzw. Ellbogen, y zum Gelenk darüber), Länge auf A1/A2 skaliert.
export const FIT = { head: { y: 0.16, s: 1.5 }, body: { waist: 0.98, s: 1.15, hipSy: 1.05 } };   // PH
const ANIM_KEYS = ['orbit', 'spinZ', 'spinY', 'sway', 'bob', 'tail', 'wobble'];
const isAnim = (o: THREE.Object3D) => ANIM_KEYS.some(k => o.userData[k] !== undefined);
export interface GearPiece { bone: THREE.Bone; geo: THREE.BufferGeometry; color: THREE.Color; m: THREE.Matrix4; glow: boolean; noShell?: boolean }
export interface GearAnim { bone: THREE.Bone; u: any; pos: THREE.Vector3; quat: THREE.Quaternion; slot: string; z0?: number }
export interface GearFx { bone: THREE.Bone; aura?: number; slot: string }
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
export const litCol = (c: THREE.Color) => { const o = c.clone().multiplyScalar(GP.lit), k = Math.max(o.r, o.g, o.b); return k > GP.cap ? o.multiplyScalar(GP.cap / k) : o; };
// Wandelt einen Teilbaum: frame = Viewer-Matrix des Rahmens, root = Bone, der den Rahmen im Spiel trägt (Lage + Größe)
function convert(tree: THREE.Object3D, frame: THREE.Matrix4, root: THREE.Bone, B, slot: string, out: { pieces: GearPiece[]; anim: GearAnim[]; fx: GearFx[] }, pick: (o: THREE.Object3D) => boolean = () => true) {
  tree.updateMatrixWorld(true);
  const inv = frame.clone().invert();
  const walk = (o: THREE.Object3D, bone: THREE.Bone, base: THREE.Matrix4, moving: boolean) => {   // base: Viewer-Matrix, an der bone hängt (invertiert)
    let b = bone, bs = base, mv = moving;
    if (isAnim(o) || o.userData.aura) {   // eigener Bone: Lage relativ zum Eltern-Bone
      const local = bs.clone().multiply(o.matrixWorld), pos = V(), quat = new THREE.Quaternion(), scl = V();
      local.decompose(pos, quat, scl);
      b = B(bone, pos.x, pos.y, pos.z); b.quaternion.copy(quat); b.scale.copy(scl);
      bs = o.matrixWorld.clone().invert(); mv = true;
      if (isAnim(o)) out.anim.push({ bone: b, u: o.userData, pos: pos.clone(), quat: quat.clone(), slot, z0: o.rotation.z });
      if (o.userData.aura) out.fx.push({ bone: b, aura: o.userData.aura, slot });
    }
    const mat = o.userData.mat as Mat;
    if (o.userData.geo && mat) {
      const m = bs.clone().multiply(o.matrixWorld);
      const color = mat.g ? mat.c : litCol(mat.c);
      out.pieces.push({ bone: b, geo: o.userData.geo, color, m, glow: !!mat.g, noShell: mv });
      if (mat.ds) out.pieces.push({ bone: b, geo: flip(o.userData.geo), color, m, glow: !!mat.g, noShell: mv });
    }
    for (const c of o.children) walk(c, b, bs, mv);
  };
  for (const c of tree.children) if (pick(c)) walk(c, root, inv, false);
}
// F: Figur aus buildStrichMagier (Bones head, chest, hips, armL/armR mit ua/fa), B(parent, x, y, z) legt einen Bone an. A1/A2: Längen Ober-/Unterarm
export function gearPieces(F, B, slot: string, group: string, item: GearLookItem, A1: number, A2: number) {
  const out = { pieces: [] as GearPiece[], anim: [] as GearAnim[], fx: [] as GearFx[] };
  const tree = buildGearTree(slot, group, item);
  if (!tree) return out;
  const { s, waist, hipSy } = FIT.body;
  const bodyRoot = (bone, sy = s, y0 = F.chest.position.y) => { const b = B(bone, 0, -y0 - waist * sy, 0); b.scale.set(s, sy, s); return b; };   // Viewer-Taille → Hüfte (y 1,0) der Figur
  const ID = new THREE.Matrix4();
  if (slot === 'kopf') { const r = B(F.head, 0, FIT.head.y, 0); r.scale.setScalar(FIT.head.s); convert(tree as THREE.Object3D, ID, r, B, slot, out); }
  else if (slot === 'arme') {
    const { L, R } = tree as { L: THREE.Object3D; R: THREE.Object3D };
    for (const [arm, t, sh, el, wr] of [[F.armL, R, VP.shR, VP.elR, VP.wrR], [F.armR, L, VP.shL, VP.elL, VP.wrL]] as const) {   // armL liegt bei +x (side 1) = rechter Arm des Viewers
      t.updateMatrixWorld(true);
      const ua = B(arm.ua), fa = B(arm.fa);
      ua.scale.setScalar(A1 / sh.distanceTo(el)); fa.scale.setScalar(A2 / el.distanceTo(wr));
      const wp = (o: THREE.Object3D) => V().setFromMatrixPosition(o.matrixWorld);
      convert(t, limbFrame(sh, el), ua, B, slot, out, o => !o.userData.orbit && wp(o).distanceTo(sh) <= wp(o).distanceTo(el));
      convert(t, limbFrame(el, wr), fa, B, slot, out, o => !o.userData.orbit && wp(o).distanceTo(sh) > wp(o).distanceTo(el));
      convert(t, ID, bodyRoot(F.chest), B, slot, out, o => !!o.userData.orbit);   // Splitter kreisen um den Körper wie im Viewer
    }
  } else {
    const t = tree as THREE.Object3D;
    t.updateMatrixWorld(true);
    // Körper: was unter der Taille hängt (Saum, Rock), sitzt an der Hüfte und geht mit den Beinen; der Rest an der Brust
    const low = (o: THREE.Object3D) => slot === 'koerper' && o.position.y <= 1.0 && !isAnim(o);
    convert(t, ID, bodyRoot(F.chest), B, slot, out, o => !low(o));
    if (slot === 'koerper') { const h = B(F.hips, 0, -waist * hipSy, 0); h.scale.set(s, hipSy, s); convert(t, ID, h, B, slot, out, low); }
  }
  return out;
}

// ---------------- Bewegung (Viewer-Animation, über Bone-Rotation/-Lage) ----------------
// Wehen (sway: Schal, Bänder, Feder), Schöße/Umhang (tail), Ringe (wobble), Halo/Siegel/Runenkreis drehen (spinZ), Sicheln pendeln (spinY),
// Klingen/Sicheln schweben (bob), Splitter und Bücher kreisen (orbit). Wehen und Drehen relativ zur Ruhelage, tail/wobble setzen z wie im Viewer.
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function animateGear(list: GearAnim[], t: number) {
  for (const a of list) {
    const u = a.u, b = a.bone;
    if (u.orbit) { orbitPos(u.orbit, t, b.position); _e.set(0, t * 2, 0); b.quaternion.copy(a.quat).multiply(_q.setFromEuler(_e)); continue; }
    if (u.bob) b.position.y = a.pos.y + Math.sin(t * 1.8) * 0.02;
    if (u.spinZ) b.quaternion.copy(a.quat).multiply(_q.setFromEuler(_e.set(0, 0, t * u.spinZ)));
    if (u.spinY) b.quaternion.copy(a.quat).multiply(_q.setFromEuler(_e.set(0, Math.sin(t * u.spinY) * 0.3, 0)));
    if (u.sway) b.quaternion.copy(a.quat).multiply(_q.setFromEuler(_e.set(Math.sin(t * 2.2) * 0.12, Math.sin(t * 1.6) * 0.2, 0)));
    if (u.tail !== undefined || u.wobble !== undefined) {   // Viewer setzt rotation.z; hier als Drehung um die eigene z-Achse ab der Ruhelage (z0)
      const z = u.tail !== undefined ? u.tail * (0.25 + Math.sin(t * 2.5 + u.tail) * 0.08) : Math.sin(t * 2 + u.wobble) * 0.15;
      b.quaternion.copy(a.quat).multiply(_q.setFromEuler(_e.set(0, 0, z - (a.z0 ?? 0))));
    }
  }
}
