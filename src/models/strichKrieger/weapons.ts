// Waffen des Strichkriegers (KOMP-04): eigene Modelle (Schwert, Axt, Kolben) und der Waffen-Look der Skins. Aus strichKrieger.ts herausgezogen, Werte unverändert.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, prep, M4, col, ext, tube, HOLZ } from './parts';

// Form der Waffen: Spitze (Treffer) und linke Hand ab dem Griff. Das Schwert ersetzt im Spiel das Schlachtblech (models/heroModel.ts)
export const WEAPON_SHAPE = { sword: { tip: 1.95, grip: .24 }, axe: { tip: 1.75, grip: .34 }, mace: { tip: 1.6, grip: .3 } };   // PH
export function swordGeo() {
  // ca. 1,2× Körperhöhe gesamt: Klinge 1,9 m, 0,36 m breit, 7 cm dick, kurzer Griff
  const W = .36, L0 = .12, L = 1.9, X0 = -.15, X1 = X0 + W;
  const s = new THREE.Shape();
  s.moveTo(X0, L0);
  s.lineTo(X0 - .01, L0 + .62); s.lineTo(X0 - .09, L0 + .7); s.lineTo(X0 - .01, L0 + .8); // Haken am Rücken
  s.lineTo(X0 - .01, L0 + L - .14);
  s.lineTo(X0 + .08, L0 + L);                 // Spitze, schräg
  s.lineTo(X1, L0 + L - .34);
  for (const y of [1.35, .95, .55]) { s.lineTo(X1, L0 + y + .06); s.lineTo(X1 - .06, L0 + y); s.lineTo(X1, L0 + y - .06); } // Kerben
  s.lineTo(X1 - .02, L0);
  s.lineTo(X0, L0);
  const blade = new THREE.ExtrudeGeometry(s, { depth: .07, bevelEnabled: false }); blade.translate(0, 0, -.035);
  const edge = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(X1 - .035, L0 + .02), new THREE.Vector2(X1 + .005, L0 + .02), new THREE.Vector2(X1 + .005, L0 + L - .36), new THREE.Vector2(X1 - .035, L0 + L - .36)]), { depth: .076, bevelEnabled: false });
  edge.translate(0, 0, -.038);
  const guard = new THREE.BoxGeometry(.56, .08, .12).translate(.03, .08, 0);
  const grip = new THREE.CylinderGeometry(.038, .042, .44, 5).translate(0, -.15, 0);
  const pommel = new THREE.IcosahedronGeometry(.07, 0).translate(0, -.4, 0);
  return mergeGeometries([prep(blade, C.iron), prep(edge, C.edge), prep(guard, C.guard), prep(grip, C.wrap), prep(pommel, C.guard)]);
}
// Holzfälleraxt: langer Holzstiel, kurzer breiter Kopf ganz oben, Schneide auf +x, Spaltkeil hinten
export function axeGeo() {
  const wood = new THREE.Color(0x6b4a2a), leather = new THREE.Color(0x3a2a1c);
  const shaft = new THREE.CylinderGeometry(.034, .04, 2.1, 6).translate(0, .75, 0);
  const wraps = [-.18, -.05, .08].map(y => prep(new THREE.CylinderGeometry(.046, .046, .07, 6).translate(0, y, 0), leather));
  const notch = [.5, .62, .74].map(y => prep(new THREE.BoxGeometry(.075, .012, .075).translate(0, y, 0), leather));
  const s = new THREE.Shape([[.03, 1.36], [.34, 1.18], [.6, 1.34], [.68, 1.6], [.6, 1.88], [.34, 2.0], [.03, 1.84]].map(([x, y]) => new THREE.Vector2(x, y)));
  const head = new THREE.ExtrudeGeometry(s, { depth: .05, bevelEnabled: false }).translate(0, 0, -.025);
  const edge = new THREE.ExtrudeGeometry(new THREE.Shape([[.58, 1.32], [.68, 1.6], [.58, 1.9], [.54, 1.87], [.63, 1.6], [.54, 1.35]].map(([x, y]) => new THREE.Vector2(x, y))), { depth: .056, bevelEnabled: false }).translate(0, 0, -.028);
  const wedge = new THREE.ConeGeometry(.1, .28, 4).rotateZ(Math.PI / 2).translate(-.16, 1.6, 0);
  const cap = new THREE.BoxGeometry(.12, .56, .08).translate(0, 1.6, 0);
  return mergeGeometries([prep(shaft, wood), ...wraps, ...notch, prep(head, C.iron), prep(edge, C.edge), prep(wedge, C.iron), prep(cap, C.guard)]);
}
// Streitkolben: beschlagener Stiel, Kopf mit 6 Flanschen. Die blauen Risse liegen im Glüh-Mesh
export function maceGeo() {
  const shaft = new THREE.CylinderGeometry(.038, .044, 1.75, 6).translate(0, .6, 0);
  const bands = [-.15, .35, .85, 1.3].map(y => prep(new THREE.CylinderGeometry(.052, .052, .06, 6).translate(0, y, 0), C.edge));
  const core = prep(new THREE.IcosahedronGeometry(.15, 0).scale(1, 1.25, 1).translate(0, 1.6, 0), C.iron);
  const flanges = [0, 1, 2, 3, 4, 5].map(i => prep(new THREE.BoxGeometry(.035, .34, .15).translate(0, 1.6, .15).rotateY(i / 6 * Math.PI * 2 + Math.PI / 6), C.guard));
  const spike = prep(new THREE.ConeGeometry(.05, .16, 5).translate(0, 1.86, 0), C.edge);
  const pommel = prep(new THREE.IcosahedronGeometry(.06, 0).translate(0, -.27, 0), C.guard);
  return mergeGeometries([prep(shaft, C.wrap), ...bands, core, ...flanges, spike, pommel]);
}
export function maceGlowGeo() {
  const blue = new THREE.Color(0x6fc8ff);
  return mergeGeometries([0, 1, 2, 3, 4, 5].map(i => prep(new THREE.BoxGeometry(.012, .26, .02).translate(0, 1.6, .2).rotateY(i / 6 * Math.PI * 2), blue)));
}
// Waffen-Look der Skins: reiner Look über dem Waffen-Modell (Treffer, Spitze, Griff bleiben die der Waffe). Viewer-Maße, Griff im Ursprung, Klinge +y, Schneide +x.
// top: oberes Ende, wird auf die Treffer-Spitze der Waffe skaliert. Teile mit tag blendet der Skin im Spiel ein und aus.
// Leuchtteile (wg): der Krieger hat ohne Kolben kein Glüh-Mesh, darum im Waffen-Mesh mit überhellen Farben, die Bloom aufgreift (0 Draw Calls extra)
export function lookWeapon(look: string, bloom: boolean) {
  const LW: any = { list: [], top: 0 };
  const GLOW_K = bloom ? 3 : 1.6;   // PH
  const wp = (geo, c, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], tag = null, flat = false) => LW.list.push({ g: prep(geo, c, M4(pos, rot, scl), flat), tag });
  const wg = (geo, c, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => LW.list.push({ g: prep(geo, c.clone().multiplyScalar(GLOW_K), M4(pos, rot, scl)) });
  if (look === 'klapse') {
    // Brechstange statt Schwert: so lang wie die Klinge (Viewer 0,84 m wäre neben den Treffern zu kurz), Haken oben, Rost, Tape am Griff
    const steel = col(0x3a3e46);
    wp(new THREE.CylinderGeometry(.034, .034, 2.15, 6), steel, [0, .675, 0]);
    wp(tube([0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => { const a = i / 8 * Math.PI * 1.1; return [-.12 + Math.cos(a) * .12, 1.75 + Math.sin(a) * .12, 0]; }), .034, 12), steel);
    wp(new THREE.BoxGeometry(.08, .065, .04), steel, [-.25, 1.69, 0], [0, 0, -.5]);
    wp(new THREE.BoxGeometry(.09, .05, .035), steel, [.03, -.44, 0], [0, 0, .4]);
    for (const y of [.45, 1.25]) wp(new THREE.BoxGeometry(.076, .11, .076), col(0x8a4a2a), [0, y, 0]);
    wp(new THREE.BoxGeometry(.078, .26, .078), col(0xf2ece0), [0, .02, 0]);
    LW.top = 1.87;
  }
  if (look === 'classic') {
    // klobiger Zweihänder, Low-Poly, rotes Verzauberungs-Glühen: Stein und Runenstrich im Glüh-Mesh, der rote Schein als Partikel (lookTick)
    const lo = (geo, c, pos?, rot?, scl?) => wp(geo, col(c), pos, rot, scl, null, true);
    lo(new THREE.CylinderGeometry(.04, .04, .5, 6), 0x4a2a1a, [0, -.05, 0]);
    for (let i = 0; i < 4; i++) lo(new THREE.CylinderGeometry(.046, .046, .025, 6), 0xb08a3a, [0, -.25 + i * .13, 0]);
    lo(new THREE.OctahedronGeometry(.085), 0xb08a3a, [0, -.34, 0]);
    lo(ext([[-.34, .2], [-.24, .32], [0, .26], [.24, .32], [.34, .2], [0, .17]], .1), 0x6a6e78);
    lo(ext([[.13, .28], [.15, .7], [.12, .75], [.14, 1.35], [.1, 1.42], [.11, 1.75], [0, 1.98], [-.11, 1.75], [-.1, 1.42], [-.14, 1.35], [-.12, .75], [-.15, .7], [-.13, .28]], .06), 0xa8b0bc);
    lo(new THREE.BoxGeometry(.035, 1.45, .066), 0x6a7280, [0, 1.0, 0]);
    const glowRed = new THREE.Color(0xd9372b);
    for (const z of [.06, -.06]) wg(new THREE.OctahedronGeometry(.06), glowRed, [0, .25, z]);
    for (const z of [.04, -.04]) wg(new THREE.BoxGeometry(.016, 1.3, .006), new THREE.Color(0xff3a2a), [0, 1.0, z]);
    LW.top = 1.98;
  }
  if (look === 'holz') {
    // saubere Fällaxt: heller Holzstiel, Stahl-Keilkopf, polierte Schneide, roter Nacken-Streifen. Kerben, Gold und Sprössling sind markiert (tag)
    const wood = col(0xd8a868);
    wp(tube([[0, -.45, 0], [.03, .2, 0], [-.02, .9, 0], [.02, 1.3, 0]], .036, 16, 7), wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'wood');
    wp(new THREE.SphereGeometry(.05, 8, 6), wood, [0, -.46, 0], [0, 0, 0], [1, .6, 1], 'wood');
    wp(ext([[-.12, 1.18], [.08, 1.2], [.36, 1.08], [.38, 1.4], [.08, 1.33], [-.12, 1.34]], .08), col(0x8a929c));
    wp(ext([[.33, 1.08], [.38, 1.06], [.4, 1.42], [.35, 1.4]], .084), col(0xf2f6fa));
    wp(new THREE.BoxGeometry(.06, .04, .085), col(0xd9372b), [-.1, 1.26, 0]);
    for (let i = 0; i < HOLZ.notches; i++) wp(new THREE.TorusGeometry(.038, .007, 3, 8), col(0x3a2414), [.008, -.34 + i * .026, 0], [Math.PI / 2, 0, 0], [1, 1, 1], `n${i}`);
    wp(new THREE.CylinderGeometry(.006, .008, .17, 4), col(0x3a7a2a), [.01, 1.4, 0], [0, 0, .12], [1, 1, 1], 'sprout');
    for (const sx of [-1, 1]) wp(new THREE.SphereGeometry(.04, 6, 4), col(0x5ab83a), [sx * .04, 1.46, 0], [0, 0, sx * .4], [1, .4, .6], 'sprout');
    LW.top = 1.42;
  }
  return LW;
}
