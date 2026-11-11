// Strichkrieger: Figur, Schwert, Wut-Aura, Moves und Effekte aus dem Viewer „Frost Grind – Strichkrieger“ (https://claude.ai/artifact/CWAKpz96NVdZ2sQQWd8yXR, wie docs/handoff.md), dazu Rückwärts, Sprung, Tod und Rim-Licht.
// Vanilla-Technik: ein SkinnedMesh, Gewicht 1, Vertex-Farben, 3-Stufen-Toon. Das Modell bewegt den Spieler nicht: Sprung und Treffer macht realMen.ts über onHit.
// anim = { state, speed, ability: null|'q0'..'q3'|'fs'|'fm'|'e'|'whirl'|'leap'|'exec'|'cry'|'last', seq, rate, rage (0–100), frozen }. dt > 1 gilt als ms.
// Schlagfolge Version E (realMen.ts): 'fs' Finisher-Spin, 'fm' Sprung-Smash; anim.fin = { s: Größe, tor: Tornado }, anim.qPal = Hieb-Farbe ('staub' | 'wut' | 'donner')

import * as THREE from 'three';
import { clamp, lerpTo as lerp, inOut, outC, V } from '../util';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { eMat, PAL, fx as efx, em, uK as setK, arc as eArc, ring as eRing, lay } from '../vfx/energy';

// Dauern in ms. Die Spielregeln stehen in REALMEN (realMen.ts)
export const STRICH_TIMING = {
  q: [520, 480, 500, 820], e: 950, leap: { ms: 1300, move: { from: 0.22, to: 0.66 } }, exec: 1400, cry: 1000, last: 1500,   // PH
  // Pro Waffe: Dauer der Schläge, von E und Maus 4. pose: welche Schwert-Pose ein Schlag nutzt (Axt: der Spalthieb ist der Sprung-Smash ohne Sprung)
  weapons: {
    sword: { q: [520, 480, 500, 820], pose: [0, 1, 2, 3], e: 950, exec: 1400, spin: 420 },   // spin: letzter Schlag der Schlagfolge (v31), Pose des Querschlags
    axe: { q: [560, 520, 750], pose: [0, 1, 3], e: 700, exec: 1400 },
    mace: { q: [450, 450, 450, 450], pose: [0, 1, 2, 0], e: 950, exec: 1100 },   // Tempo +30 % gibt das Spiel über anim.rate
  },
};
// Form der Waffen: Spitze (Treffer) und linke Hand ab dem Griff. Das Schwert ersetzt im Spiel das Schlachtblech (models/mage.ts)
const WEAPON_SHAPE = { sword: { tip: 1.95, grip: .24 }, axe: { tip: 1.75, grip: .34 }, mace: { tip: 1.6, grip: .3 } };   // PH

const inC = t => t * t * t;
const EASE = { io: inOut, out: outC, in: inC, lin: t => t };
const TAU = Math.PI * 2;
const RIM = { color: [0.62, 0.62, 0.68], power: 2.6 };   // wie Klingenstrich: bleibt im Dunkeln sichtbar // PH
const FX_LIGHT = 0xf2efe6, FX_DARK = 0x0c0a08;          // Tusche des Viewers wäre auf dunklem Boden unsichtbar, nur die Risse bleiben dunkel

const grad = new THREE.DataTexture(new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const L1 = .5, L2 = .48, A1 = .35, A2 = .33;
const C = { ink: new THREE.Color(0x2b2b33), plate: new THREE.Color(0x5a1a14), cloth: new THREE.Color(0xa3151b),
  iron: new THREE.Color(0x4a4d54), edge: new THREE.Color(0xc4c8cd), wrap: new THREE.Color(0x7a1a14), guard: new THREE.Color(0x26231f) };
// flat: harte Kanten (Low-Poly-Look der Skins)
function prep(geo, color, m?, flat = false) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (flat && g.attributes.normal) g.deleteAttribute('normal');
  if (!g.attributes.normal) g.computeVertexNormals();
  if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function mix(a, b, u) {
  const o: any = {};
  for (const k of KEYS) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u);
  return o;
}
const P = (base, o = {}) => Object.assign({}, base, o);
const KEYS = ['y', 'h', 'c', 'n', 'hL', 'hR', 'b', 'e', 'fL', 'fR', 'g'];
const IDLE = { y: .93, h: [0, .2, 0], c: [.3, -.1, 0], n: [.05, .1, 0], hR: [-.36, 1.62, .22], hL: [.48, 1.05, .2],
  b: [-.12, .45, -.88], e: [0, 1, 0], fL: [.3, .07, .26], fR: [-.3, .07, -.28] };
const Q_END = [
  P(IDLE, { y: .78, h: [0, .7, 0], c: [.6, .55, 0], n: [-.3, -.3, 0], hR: [.3, .98, .7], hL: 'G', b: [.55, -.55, .62], e: [.7, -.7, 0], fL: [.32, .07, -.1], fR: [-.28, .07, .55] }),
  P(IDLE, { y: .8, h: [0, -.6, 0], c: [.35, -.75, 0], n: [-.2, .4, 0], hR: [-.78, 1.3, .38], hL: [.5, 1.25, -.2], b: [-.95, .05, .28], e: [0, 0, -1], fL: [.35, .07, .4], fR: [-.35, .07, -.2] }),
  P(IDLE, { y: 1.02, h: [0, -.2, 0], c: [-.2, -.2, 0], n: [-.35, .1, 0], hR: [-.1, 2.05, .35], hL: 'G', b: [0, .85, .5], e: [0, .3, -1], fL: [.28, .07, .1], fR: [-.3, .07, .35] }),
  P(IDLE, { y: .6, h: [0, 0, 0], c: [.75, 0, 0], n: [-.6, 0, 0], hR: [0, .82, .8], hL: 'G', b: [0, -.72, .7], e: [0, -1, 0], fL: [.4, .07, .3], fR: [-.4, .07, -.35] })
];
const SIT = { y: .32, h: [-.1, .15, 0], c: [.2, -.1, 0], n: [.1, 0, 0], hR: [-.55, 1.0, .25], b: [0, -1, .05], e: [0, 0, 1], hL: [.35, .75, .4], fL: [.42, .07, .75], fR: [-.3, .07, .45] };
const DEAD = { y: .24, h: [-1.45, 0, 0], c: [-.05, .1, 0], n: [-.1, .3, 0], hR: [-.75, .18, -.2], hL: [.7, .14, -.6], b: [-.5, -.02, .85], e: [0, 1, 0], fL: [.32, .07, .98], fR: [-.3, .07, 1.02] };

// look: Skin aus src/skins.ts (standard, klapse, classic, holz). Unbekannt oder noch nicht gebaut = Standard
export function buildStrichKrieger({ bloom = false, weapon = 'sword', look = 'standard' } = {}) {
  const W = STRICH_TIMING.weapons[weapon] ?? STRICH_TIMING.weapons.sword;
  const fxGroup = new THREE.Group();
  const VMAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  VMAT.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
      `outgoingLight += vec3(${RIM.color.join(',')}) * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), ${RIM.power.toFixed(1)});\n#include <opaque_fragment>`);
  };
  let lift = 0, spinAng = 0, rage = 0, flare = 0, qPal = null, fin = { s: 1, tor: 0 };
  const gy = () => root.position.y - lift;             // Boden unter der Figur
const bones = [], parts = [];
function B(p, x = 0, y = 0, z = 0) { const b = new THREE.Bone(); b.position.set(x, y, z); p.add(b); bones.push(b); return b; }
const M4 = (pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl));
// pm: Matrix einer Teile-Gruppe davor (Skins). Rückgabe: Eintrag, Skins färben ihn um (color), werfen ihn raus (drop) oder markieren ihn (tag)
function part(bone, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], pm = null) {
  const e: any = { bone, geo, color, m: pm ? pm.clone().multiply(M4(pos, rot, scl)) : M4(pos, rot, scl) };
  parts.push(e); return e;
}
const capDown = (r, len, rs = 6) => { const g = new THREE.CapsuleGeometry(r, len, 2, rs); g.translate(0, -len / 2, 0); return g; };
const root = new THREE.Group();
const hips = B(root, 0, 1.04, 0);
const pHips = part(hips, new THREE.SphereGeometry(.19, 7, 4), C.ink, [0, 0, 0], [0, 0, 0], [1.25, .8, .9]);
const chest = B(hips, 0, .06, 0);
const pChest = part(chest, new THREE.LatheGeometry([[0, -.04], [.13, -.02], [.14, .1], [.22, .32], [.29, .5], [.25, .6], [.12, .66], [0, .67]]
  .map(([x, y]) => new THREE.Vector2(x, y)), 8), C.ink, [0, 0, 0], [0, Math.PI / 8, 0], [1.15, 1, .66]);
const neck = B(chest, 0, .64, .03);
const pNeck = part(neck, new THREE.CylinderGeometry(.07, .09, .12, 5), C.ink, [0, .04, 0]);
const head = B(neck, 0, .08, .02);
const pHead = part(head, new THREE.IcosahedronGeometry(.15, 1), C.ink, [0, .13, 0], [0, 0, 0], [1, 1.02, 1.05]);
// Gürtel mit Stoffbahn hinten
const pBelt = part(hips, new THREE.TorusGeometry(.2, .045, 3, 10), C.plate, [0, .06, 0], [Math.PI / 2, 0, 0], [1.2, .9, 1]);
const clothAnchor = (() => { const o = new THREE.Object3D(); o.position.set(0, .02, -.2); hips.add(o); return o; })();

function arm(side) {
  const ua = B(chest, side * .32, .52, 0);
  const pu = part(ua, capDown(.095, A1), C.ink);
  const fa = B(ua, 0, -A1, 0);
  const pf = part(fa, capDown(.085, A2), C.ink);
  const hand = B(fa, 0, -A2, 0);
  const ph = part(hand, new THREE.IcosahedronGeometry(.11, 0), C.ink);
  const plate = [];
  if (side === 1) {
    // eine schwere Schulterplatte links mit zwei Dornen: macht die Silhouette asymmetrisch
    plate.push(part(ua, new THREE.ConeGeometry(.22, .14, 6), C.plate, [.03, .05, 0], [0, 0, -.35]));
    plate.push(part(ua, new THREE.ConeGeometry(.045, .26, 4), C.plate, [.08, .2, .04], [0, 0, -.35]));
    plate.push(part(ua, new THREE.ConeGeometry(.04, .2, 4), C.plate, [.16, .14, -.08], [-.3, 0, -.8]));
  }
  return { ua, fa, hand, side, pu, pf, ph, plate };
}
function leg(side) {
  const th = B(hips, side * .14, -.06, 0);
  const pt = part(th, capDown(.115, L1), C.ink);
  const sh = B(th, 0, -L1, 0);
  const ps = part(sh, capDown(.095, L2), C.ink);
  const ft = B(sh, 0, -L2, 0);
  const pf = part(ft, new THREE.ConeGeometry(.095, .32, 5), C.ink, [0, -.02, .09], [Math.PI / 2, 0, 0], [1, 1, .7]);
  return { th, sh, ft, side, pt, ps, pf };
}
const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);
// Skins (src/skins.ts): Teile mit part(bone, …) wie oben, je Skin ein Block `if (look === …)`. Vorlage docs/ref/set-skins-krieger.html (SKINS).
// Alles landet im selben Körper-Mesh (0 Draw Calls extra). Kopf-Maße des Viewers mit hp() aufs Spiel umrechnen (Kopf hier r .15 statt .12)
// Viewer-Farben gedimmt: das Spiel-Licht ist auf die dunkle Tusche abgestimmt, helle Stoffe würden sonst ausbrennen (Bloom)
const LOOK_DIM = .5;   // PH
const col = (hex: number) => new THREE.Color(hex).multiplyScalar(LOOK_DIM);
const drop = (...es) => { for (const e of es.flat()) { const i = parts.indexOf(e); if (i >= 0) parts.splice(i, 1); } };
const paint = (c, ...es) => { for (const e of es.flat()) e.color = c; };
const hp = (x, y, z) => [x * 1.3, .13 + y * 1.3, z * 1.38];   // PH
// Stab von a nach b (Punkte im Bone-Raum)
function rod(bone, a, b, r, c, r2 = r, seg = 5) {
  const d = V(...b).sub(V(...a)), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  const e = part(bone, new THREE.CylinderGeometry(r2, r, d.length(), seg), c);
  e.m = new THREE.Matrix4().compose(V(...a).add(d.multiplyScalar(.5)), q, V(1, 1, 1)); return e;
}
const band = (bone, pos, r, t, c, scl = [1, 1, 1], seg = 12) => part(bone, new THREE.TorusGeometry(r, t, 4, seg), c, pos, [Math.PI / 2, 0, 0], scl);
const ext = (pts, depth) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
const tube = (pts, r, seg = 12, rs = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), seg, r, rs);
// Holzfäller-Gags: Kerben = Kills im Run (höchstens notches sichtbar), ab gold goldener Stiel, ab sprout ein Sprössling, alle perLog Kills ein Scheit
const HOLZ = { notches: 40, gold: 100, sprout: 500, perLog: 20, logs: 15 };   // PH
let cloth0 = { color: 0xa3151b, w: 1 };   // Stoffbahn hinten: Farbe, Breite
const TALK: any = {};                      // Sprechblasen (ui/skinTalk.ts): kind, keys, plate
if (look === 'klapse') {
  // Ausbrecher: Zwangsjacke, linker Ärmel aufgerissen, Gurte, Krankenhaus-Hose, Schlappen, wirre Haare, Pflaster, Glubschaugen
  const jacket = col(0xe8e4d8), pants = col(0xa8c0c8), strap = col(0x6a5a48), skin = col(0xe8ccb0), ink = col(0x15121a);
  drop(armL.plate);
  paint(jacket, pChest, armL.pu, armR.pu, armR.pf);
  paint(skin, pNeck, pHead, armL.pf, armL.ph, armR.ph);
  paint(pants, pHips, legL.pt, legL.ps, legR.pt, legR.ps);
  paint(col(0x8aa0b0), legL.pf, legR.pf);
  paint(strap, pBelt);
  // ausgefranster Saum am Ellbogen links
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; part(armL.fa, new THREE.ConeGeometry(.03, .1 + (i % 2) * .04, 4), jacket, [Math.cos(a) * .085, -.04, Math.sin(a) * .085], [Math.PI, 0, 0]); }
  // drei Gurte um die Brust mit Schnallen vorne (Radien am Brust-Profil)
  for (const [y, r] of [[.42, .28], [.26, .215], [.1, .16]]) {
    band(chest, [0, y, 0], r, .018, strap, [1.15, .7, 1], 16);
    part(chest, new THREE.BoxGeometry(.05, .045, .03), col(0xb0b0b8), [.06, y, r * .7 + .01]);
  }
  // baumelnde Gurte vorne (fest), der hinten ist die Stoffbahn
  part(chest, new THREE.BoxGeometry(.035, .34, .012), strap, [-.12, -.15, .13], [.1, 0, .12]);
  part(chest, new THREE.BoxGeometry(.035, .44, .012), strap, [.14, -.2, .12], [.08, 0, -.1]);
  cloth0 = { color: 0x6a5a48, w: .35 };
  // wirre Haare, Pflaster-Kreuz, Glubschaugen, schiefes Grinsen
  const hair = col(0x5a4a3a);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; part(head, new THREE.ConeGeometry(.05, .17, 5), hair, hp(Math.cos(a) * .07, .1 + Math.sin(i * 3) * .02, Math.sin(a) * .07 - .02), [Math.sin(a) * .9, 0, -Math.cos(a) * .9]); }
  for (const r of [.5, -.5]) part(head, new THREE.BoxGeometry(.08, .026, .015), col(0xf2ece0), hp(.04, .06, .108), [0, 0, r]);
  for (const [x, r] of [[-.042, .042], [.042, .034]]) { part(head, new THREE.SphereGeometry(r, 8, 6), col(0xffffff), [x * 1.3, .13, .145], [0, 0, 0], [1, 1, .45]); part(head, new THREE.SphereGeometry(.011, 5, 4), ink, [x * 1.3 + .005, .132, .163]); }
  part(head, new THREE.TorusGeometry(.055, .011, 3, 10, Math.PI), ink, [0, .065, .142], [0, 0, Math.PI + .15]);
  Object.assign(TALK, { kind: 'whisper', keys: [1, 2, 3, 4, 5, 6, 7].map(i => `look.krieger.klapse.say${i}`) });
}
if (look === 'classic') {
  // Classic-Krieger 55, „Clownsuit“: jedes Teil aus einem anderen Dungeon. Low-Poly mit harten Kanten (flat)
  const purple = col(0x5a3a8a), purple2 = col(0x7a5ab0), red = col(0xa8231c), gold = col(0xc9a640), steel = col(0x8a929c),
    green = col(0x5a7a3a), yel = col(0xd8e03a), pink = col(0xff5ab0), brown = col(0x6a4022), navy = col(0x2a3a6a), skin = col(0xe0b898), ink = col(0x15121a);
  const n0 = parts.length;
  drop(armL.plate, pHead);
  paint(purple, pChest); paint(skin, pNeck); paint(col(0x3a3a46), armL.pu, armR.pu);
  paint(yel, armL.pf, armR.pf, armL.ph, armR.ph); paint(green, pHips, legL.pt, legL.ps, legR.pt, legR.ps); paint(navy, legL.pf, legR.pf);
  paint(brown, pBelt);
  // Brustplatte: zwei Wölbungen, Goldgrat, Goldring unten
  for (const x of [-.11, .11]) part(chest, new THREE.SphereGeometry(.14, 7, 5), purple2, [x, .33, .1], [0, 0, 0], [1, .75, .55]);
  part(chest, new THREE.BoxGeometry(.06, .42, .06), gold, [0, .25, .17]);
  band(chest, [0, .06, 0], .155, .02, gold, [1.15, .7, 1], 8);
  // riesige rote Dorn-Schultern, zweilagig, Goldrand (beide Seiten, am Oberarm wie die Schulterplatte des Standards)
  for (const a of [armL, armR]) {
    const s = a.side, g = M4([s * .04, .05, 0], [0, 0, -s * .25]);
    part(a.ua, new THREE.SphereGeometry(.24, 8, 5, 0, TAU, 0, Math.PI / 2), red, [0, 0, 0], [0, 0, 0], [1.15, .8, 1], g);
    part(a.ua, new THREE.SphereGeometry(.2, 8, 4, 0, TAU, 0, Math.PI / 2), red, [s * .05, -.1, 0], [0, 0, 0], [1.2, .7, 1.05], g);
    part(a.ua, new THREE.TorusGeometry(.27, .02, 4, 10), gold, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 1], g);
    for (let i = 0; i < 3; i++) part(a.ua, new THREE.ConeGeometry(.05, .28 - i * .05, 5), steel, [s * (.02 + i * .07), .16 - i * .03, (i - 1) * .1], [0, 0, -s * (.25 + i * .25)], [1, 1, 1], g);
    // knallgelbe Stulpen mit pinkem Saum
    part(a.fa, new THREE.CylinderGeometry(.115, .095, .2, 6), yel, [0, -.23, 0]);
    part(a.fa, new THREE.TorusGeometry(.115, .024, 4, 8), pink, [0, -.13, 0], [Math.PI / 2, 0, 0]);
  }
  // Riesenschnalle mit grünem Stein (Stein im Körper-Mesh, leuchtet nicht: Körper hat kein Glüh-Mesh)
  part(hips, new THREE.BoxGeometry(.16, .13, .05), gold, [0, .06, .22]);
  part(hips, new THREE.OctahedronGeometry(.035), col(0xb4ff9a), [0, .06, .25]);
  // Kniebuckel mit Dorn, klobige blaue Stiefel mit hochgezogener Spitze
  for (const l of [legL, legR]) {
    part(l.sh, new THREE.SphereGeometry(.11, 6, 4), steel, [0, 0, .05], [0, 0, 0], [1, 1, .7]);
    part(l.sh, new THREE.ConeGeometry(.03, .12, 4), steel, [0, 0, .15], [Math.PI / 2, 0, 0]);
    part(l.ft, new THREE.CylinderGeometry(.1, .115, .2, 6), navy, [0, .05, .01]);
    part(l.ft, new THREE.ConeGeometry(.065, .14, 4), navy, [0, -.02, .26], [Math.PI / 2 - .5, 0, 0]);
  }
  // Helm: grauer Topf mit T-Schlitz, Goldkamm, Bronze-Stierhörner
  part(head, new THREE.IcosahedronGeometry(.15, 1), steel, [0, .13, 0], [0, 0, 0], [1.08, 1.14, 1.1]);
  part(head, new THREE.BoxGeometry(.22, .032, .03), ink, [0, .145, .16]);
  part(head, new THREE.BoxGeometry(.04, .13, .03), ink, [0, .08, .155]);
  part(head, new THREE.BoxGeometry(.04, .1, .34), gold, [0, .29, 0]);
  for (const s of [-1, 1]) {
    const pts = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => { const t = i / 8; return hp(s * (.1 + t * .2), .03 + Math.pow(t, 2.5) * .22, -t * .04); });
    part(head, tube(pts, .06, 10, 6), col(0xa8783a));
    const e = pts[8]; part(head, new THREE.ConeGeometry(.06, .13, 6), col(0xe8dcc0), [e[0], e[1] + .05, e[2]], [0, 0, -s * .2]);
  }
  for (let i = n0; i < parts.length; i++) parts[i].flat = true;
  for (const e of [pChest, pHips, armL.pu, armR.pu, armL.pf, armR.pf, legL.pt, legL.ps, legR.pt, legR.ps, legL.pf, legR.pf]) e.flat = true;
  // Umhang (passt natürlich auch nicht): türkis, ab den Schultern
  cloth0 = { color: 0x2a9a9a, w: 2.3 };
  chest.add(clothAnchor); clothAnchor.position.set(0, .52, -.28);
  Object.assign(TALK, { kind: 'shout', keys: [1, 2, 3, 4].map(i => `look.krieger.classic.say${i}`), plate: 'look.krieger.classic.plate' });
}
if (look === 'holz') {
  // Holzfäller: kariertes Hemd (Karo als dunkle Streifen, Vertex-Farben statt Textur), Ärmel hochgekrempelt, Hosenträger, Jeans mit Umschlag,
  // Arbeitsstiefel, Strickmütze mit Bommel, Vollbart, Kraxe mit Holzstapel auf dem Rücken
  const plaid = col(0xb8241c), dark = col(0x1a1214), jeans = col(0x3a5a8a), skin = col(0xe8bc98), boot = col(0x6a4022), beard = col(0x7a3a1a), wood = col(0x5a3a20);
  drop(armL.plate);
  paint(plaid, pChest, armL.pu, armR.pu); paint(skin, pNeck, pHead, armL.pf, armR.pf, armL.ph, armR.ph);
  paint(jeans, pHips, legL.pt, legL.ps, legR.pt, legR.ps); paint(boot, legL.pf, legR.pf); paint(col(0x3a2414), pBelt);
  for (const [y, r] of [[.48, .29], [.32, .23], [.16, .17]]) band(chest, [0, y, 0], r, .016, dark, [1.15, .68, 1], 16);   // Karo quer
  for (const a of [armL, armR]) {
    for (const y of [-.1, -.24]) band(a.ua, [0, y, 0], .1, .014, dark, [1, 1, 1], 8);
    band(a.fa, [0, -.03, 0], .1, .032, plaid, [1, 1, 1], 8);   // hochgekrempelt
  }
  for (const x of [-.11, .11]) { rod(chest, [x, -.02, .1], [x * 1.1, .55, .2], .016, col(0x8a2a1a)); rod(chest, [x, -.02, -.1], [x * 1.1, .55, -.19], .016, col(0x8a2a1a)); }   // Hosenträger
  for (const l of [legL, legR]) { band(l.sh, [0, -.4, 0], .1, .028, col(0x6a8ab0), [1, 1, 1], 10); part(l.ft, new THREE.CylinderGeometry(.1, .095, .14, 8), boot, [0, .03, .01]); }   // Umschlag, Stiefelschaft
  // Strickmütze mit Bommel
  const hat = col(0x2a4a3a);
  part(head, new THREE.SphereGeometry(.17, 10, 6, 0, TAU, 0, Math.PI * .55), hat, [0, .19, 0], [0, 0, 0], [1, 1.15, 1.04]);
  band(head, [0, .19, 0], .155, .033, hat, [1, 1.04, 1], 14);
  part(head, new THREE.SphereGeometry(.06, 7, 5), col(0xf2ece0), [0, .4, 0]);
  // Augen, Brauen, Vollbart, Schnauzer
  for (const x of [-.055, .055]) { part(head, new THREE.SphereGeometry(.018, 6, 4), col(0x15121a), [x, .135, .15], [0, 0, 0], [1, 1.1, .5]); part(head, new THREE.BoxGeometry(.065, .016, .014), col(0x6a3a1a), [x, .165, .152], [0, 0, x > 0 ? .35 : -.35]); }
  part(head, new THREE.SphereGeometry(.143, 9, 6), beard, [0, .0, .062], [0, 0, 0], [1, .7, .85]);
  part(head, new THREE.BoxGeometry(.13, .026, .026), beard, [0, .085, .152]);
  // Kraxe auf dem Rücken: Gestell fest, Scheite einzeln markiert (tag) und je nach Kills eingeblendet (lookTick)
  const kz = -.22, ky = .28;
  for (const x of [-.17, .17]) rod(chest, [x, ky - .3, kz - .02], [x, ky + .45, kz - .02], .014, wood);
  part(chest, new THREE.BoxGeometry(.38, .03, .18), wood, [0, ky - .3, kz - .1]);
  for (let i = 0; i < HOLZ.logs; i++) {
    const row = Math.floor(i / 3), c = i % 3, z = kz - .06 - c * .1 + (row % 2) * .03, y = ky - .24 + row * .1;
    part(chest, new THREE.CylinderGeometry(.055, .055, .4, 7), col(0x8a5a32), [0, y, z], [0, 0, Math.PI / 2]).tag = `log${i}`;
    for (const sx of [-1, 1]) part(chest, new THREE.CircleGeometry(.05, 7), col(0xe8c890), [sx * .201, y, z], [0, sx * Math.PI / 2, 0]).tag = `log${i}`;
  }
}
root.updateMatrixWorld(true);
// Ränge je tag (Vertex-Anfang, Anzahl) im gemergten Mesh: Skins blenden Teile aus (zusammenfallen lassen) oder färben sie um, ohne Draw Call
function mergeTagged(list) {
  const ranges = {}; let o = 0;
  for (const { g, tag } of list) { const n = g.attributes.position.count; if (tag) (ranges[tag] ??= []).push([o, n]); o += n; }
  const geo = mergeGeometries(list.map(x => x.g));
  return { geo, ranges, orig: geo.attributes.position.array.slice() };
}
function showTag(T, tag, on) {
  const a = T.geo.attributes.position.array;
  for (const [o, n] of T.ranges[tag] ?? []) {
    if (on) a.set(T.orig.subarray(o * 3, (o + n) * 3), o * 3);
    else for (let i = 0; i < n; i++) a.set(T.orig.subarray(o * 3, o * 3 + 3), (o + i) * 3);
  }
  T.geo.attributes.position.needsUpdate = true;
}
function tintTag(T, tag, c) {
  const a = T.geo.attributes.color.array;
  for (const [o, n] of T.ranges[tag] ?? []) for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], (o + i) * 3);
  T.geo.attributes.color.needsUpdate = true;
}
const bodyT = mergeTagged(parts.map(p => {
  const g = prep(p.geo, p.color, p.bone.matrixWorld.clone().multiply(p.m), p.flat);
  const n = g.attributes.position.count, bi = bones.indexOf(p.bone);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return { g, tag: p.tag };
}));
const bodyGeo = bodyT.geo;
const body = new THREE.SkinnedMesh(bodyGeo, VMAT);
body.frustumCulled = false; root.add(body); body.bind(new THREE.Skeleton(bones));
// Wut-Aura: zweite Hülle aus derselben Geometrie, entlang der Normalen aufgeblasen, Rückseiten, 1 Draw Call
// Spell-Viewer: dieselbe Hülle mit dem Energie-Shader (Palette Wut), wächst mit der Wut
const AURA_E = eMat(PAL.wut, { sc: 4, core: .2, inf: .04, puff: .02, flow: [0, 2.5, 0], k: 0 });
const aura = new THREE.SkinnedMesh(bodyGeo, AURA_E);
aura.frustumCulled = false; root.add(aura); aura.bind(body.skeleton, body.bindMatrix); aura.renderOrder = -1;
function swordGeo() {
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
const SWORD_GEO = swordGeo();
// Holzfälleraxt: langer Holzstiel, kurzer breiter Kopf ganz oben, Schneide auf +x, Spaltkeil hinten
function axeGeo() {
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
function maceGeo() {
  const shaft = new THREE.CylinderGeometry(.038, .044, 1.75, 6).translate(0, .6, 0);
  const bands = [-.15, .35, .85, 1.3].map(y => prep(new THREE.CylinderGeometry(.052, .052, .06, 6).translate(0, y, 0), C.edge));
  const core = prep(new THREE.IcosahedronGeometry(.15, 0).scale(1, 1.25, 1).translate(0, 1.6, 0), C.iron);
  const flanges = [0, 1, 2, 3, 4, 5].map(i => prep(new THREE.BoxGeometry(.035, .34, .15).translate(0, 1.6, .15).rotateY(i / 6 * Math.PI * 2 + Math.PI / 6), C.guard));
  const spike = prep(new THREE.ConeGeometry(.05, .16, 5).translate(0, 1.86, 0), C.edge);
  const pommel = prep(new THREE.IcosahedronGeometry(.06, 0).translate(0, -.27, 0), C.guard);
  return mergeGeometries([prep(shaft, C.wrap), ...bands, core, ...flanges, spike, pommel]);
}
function maceGlowGeo() {
  const blue = new THREE.Color(0x6fc8ff);
  return mergeGeometries([0, 1, 2, 3, 4, 5].map(i => prep(new THREE.BoxGeometry(.012, .26, .02).translate(0, 1.6, .2).rotateY(i / 6 * Math.PI * 2), blue)));
}
// Waffen-Look der Skins: reiner Look über dem Waffen-Modell (Treffer, Spitze, Griff bleiben die der Waffe). Viewer-Maße, Griff im Ursprung, Klinge +y, Schneide +x.
// top: oberes Ende, wird auf die Treffer-Spitze der Waffe skaliert. Teile mit tag blendet der Skin im Spiel ein und aus.
// Leuchtteile (wg): der Krieger hat ohne Kolben kein Glüh-Mesh, darum im Waffen-Mesh mit überhellen Farben, die Bloom aufgreift (0 Draw Calls extra)
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
const lookW = LW.list.length ? mergeTagged(LW.list) : null;
// Schwert-Rahmen: y = Klinge, x = Schneide, Griff im Ursprung. Darin das eigene Schwert oder eine Waffe aus models/weapons (setWeapon)
const sword = new THREE.Group(); root.add(sword);
const swordMesh = new THREE.Mesh(lookW ? lookW.geo : weapon === 'axe' ? axeGeo() : weapon === 'mace' ? maceGeo() : SWORD_GEO, VMAT); sword.add(swordMesh);
let tipLen = WEAPON_SHAPE[weapon]?.tip ?? 1.95, gripLen = WEAPON_SHAPE[weapon]?.grip ?? .24, baseTip = tipLen, baseGrip = gripLen;
// Kolben: Blitzrisse leuchten blau (+1 Draw Call), mit Bloom heller
let maceGlow = null;
if (weapon === 'mace' && !lookW) {
  maceGlow = new THREE.Mesh(maceGlowGeo(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (bloom) maceGlow.material.color.setScalar(2.2);
  sword.add(maceGlow);
}
// Look-Waffe auf die Spitze der Waffe skalieren (k = Waffen-Maß × Skalierung)
const fitLook = (tip) => { if (lookW) swordMesh.scale.setScalar(tip / LW.top); };
fitLook(tipLen);
  // Fleischkeule zum Essen: Knochen + Fleisch, Griff im Ursprung, Fleisch nach +y
  const meat = new THREE.Mesh(mergeGeometries([
    prep(new THREE.CylinderGeometry(.025, .025, .22, 5).translate(0, -.02, 0), new THREE.Color(0xeee6d0)),
    prep(new THREE.IcosahedronGeometry(.035, 0).translate(.02, -.14, 0), new THREE.Color(0xeee6d0)), prep(new THREE.IcosahedronGeometry(.035, 0).translate(-.02, -.14, 0), new THREE.Color(0xeee6d0)),
    prep(new THREE.IcosahedronGeometry(.11, 1).scale(1, 1.35, 1).translate(0, .17, 0), new THREE.Color(0x8a3b1c)),
    prep(new THREE.IcosahedronGeometry(.06, 0).translate(.06, .2, .05), new THREE.Color(0xa9552a))
  ]), VMAT); meat.visible = false; root.add(meat);
const auraRing = new THREE.Mesh(new THREE.RingGeometry(.7, 1.1, 40), new THREE.MeshBasicMaterial({ color: 0xe0141c, transparent: true, opacity: 0, depthWrite: false }));
auraRing.rotation.x = -Math.PI / 2; fxGroup.add(auraRing);
const SN = 8, SEG = .11;
const sP = [], sO = [];
const clothGeo = new THREE.BufferGeometry();
clothGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 2 * 3), 3));
{ const idx = []; for (let i = 0; i < SN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } clothGeo.setIndex(idx); }
const cloth = new THREE.Mesh(clothGeo, new THREE.MeshBasicMaterial({ color: cloth0.color, side: THREE.DoubleSide }));
cloth.frustumCulled = false;
function clothReset() { const p = clothAnchor.getWorldPosition(V()); for (let i = 0; i < SN; i++) { sP[i] = p.clone().add(V(0, -i * SEG, 0)); sO[i] = sP[i].clone(); } }
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const DOWN = V(0, -1, 0);
function ik(upper, lower, l1, l2, targetW, poleW) {
  const par = upper.parent;
  const T = par.worldToLocal(_a.copy(targetW));
  const pole = par.worldToLocal(_b.copy(poleW));
  const P = upper.position;
  const d = _c.subVectors(T, P); const L = clamp(d.length(), 1e-3, l1 + l2 - 1e-3); d.normalize();
  const al = Math.acos(clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1));
  const pp = _d.subVectors(pole, P); pp.addScaledVector(d, -pp.dot(d));
  if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1); pp.normalize();
  const eDir = _e.copy(d).multiplyScalar(Math.cos(al)).addScaledVector(pp, Math.sin(al));
  upper.quaternion.setFromUnitVectors(DOWN, eDir);
  const E = _b.copy(P).addScaledVector(eDir, l1);
  const lDir = _a.copy(P).addScaledVector(d, L).sub(E).normalize();
  _q.setFromUnitVectors(DOWN, lDir);
  lower.quaternion.copy(_q2.copy(upper.quaternion).invert().multiply(_q));
}
const _w = V(), _pw = V(), _rq = new THREE.Quaternion(), _sq = new THREE.Quaternion();
function legIK(l, f) {
  root.localToWorld(_w.set(f[0], f[1], f[2]));
  root.localToWorld(_pw.set(f[0] + l.side * .25, .8, f[2] + 2));
  ik(l.th, l.sh, L1, L2, _w, _pw);
  l.sh.updateWorldMatrix(true, false);
  l.sh.getWorldQuaternion(_sq); root.getWorldQuaternion(_rq);
  l.ft.quaternion.copy(_sq.invert().multiply(_rq));
}
function armIK(a, h) {
  root.localToWorld(_w.set(h[0], h[1], h[2]));
  root.localToWorld(_pw.set(a.side * 1.4, .7, -.6));
  ik(a.ua, a.fa, A1, A2, _w, _pw);
}
const _m = new THREE.Matrix4(), _x = V(), _y = V(), _z = V(), _hp = V();
// Klinge: y = Richtung, x = Schneide (Hinweis e)
function placeSword(dir, edge) {
  _y.set(dir[0], dir[1], dir[2]).normalize();
  _x.set(edge[0], edge[1], edge[2]); _x.addScaledVector(_y, -_x.dot(_y));
  if (_x.lengthSq() < 1e-4) _x.set(0, 1, 0).addScaledVector(_y, -_y.y);
  if (_x.lengthSq() < 1e-4) _x.set(1, 0, 0);
  _x.normalize(); _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z); sword.quaternion.setFromRotationMatrix(_m);
  root.worldToLocal(armR.hand.getWorldPosition(_hp));
  sword.position.copy(_hp);
}
const gripL = () => sword.position.clone().addScaledVector(V(0, 1, 0).applyQuaternion(sword.quaternion), -gripLen);
const tipPos = () => root.localToWorld(sword.position.clone().addScaledVector(V(0, 1, 0).applyQuaternion(sword.quaternion), tipLen));
  let lastGrip = [.2, 1.2, .3];
  function resolve(p) {
    const o: any = {};
    for (const k of KEYS) { const v = p[k]; o[k] = Array.isArray(v) ? v.slice() : v; }
    if (p.hL === 'G') { o.hL = lastGrip.slice(); o.g = 1; } else o.g = 0;
    return o;
  }
  function runPose(ph) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    y: .95 - .07 * Math.abs(c), h: [.15, .2 * s, 0], c: [.55, -.15 * s, 0], n: [-.25, .1 * s, 0],
    hR: [-.5, .98, -.32], b: [-.22, -.55, -.8], e: [0, 0, -1],
    hL: [.4, 1.25 + .1 * s, .35 * s], fL: [.15, .07 + .32 * Math.max(0, c), .65 * s], fR: [-.15, .07 + .32 * Math.max(0, -c), -.65 * s]
  };
  }
const fxList = [];
const fxMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });
function holder() { const h = new THREE.Object3D(); h.position.copy(root.position); h.position.y = gy(); h.rotation.y = root.rotation.y; fxGroup.add(h); return h; }
// Sichel im Wurzel-Raum (Spell-Viewer: Energie-Look, Wut bei viel Wut, sonst Staub)
const _hq = new THREE.Quaternion(), _he = new THREE.Euler();
function arc(center, euler, r, th, life = .3, red = true, pal = null) {
  const yq = _hq.setFromAxisAngle(V(0, 1, 0), root.rotation.y).clone();
  const c = V(center[0], center[1], center[2]).applyQuaternion(yq).add(V(root.position.x, gy(), root.position.z));
  const q = yq.multiply(new THREE.Quaternion().setFromEuler(_he.set(euler[0], euler[1], euler[2])));
  eArc(c, q, r, th, pal ?? (red && rage > 30 ? PAL.wut : PAL.staub), life * 1.3);
}
// Bodenring: helle Ringe Staub, rote Wut, eigene Palette (Donner, Furcht) über pal
function ring(pos, color, r, life, w = .15, pal = null) {
  eRing(V(pos.x, gy(), pos.z), r, pal ?? (color === 0xd8121c || color === 0xe0141c ? PAL.wut : PAL.staub), life * 1.2);
}
// Bodenriss: gezackte schwarze Linie, die sich ausbreitet
function crack(from, dir, len, life = 1.6) {
  const pts = []; const side = V(-dir.z, 0, dir.x); let p = from.clone();
  for (let i = 0; i <= 8; i++) { pts.push(p.clone().addScaledVector(side, (Math.random() - .5) * .35)); p.addScaledVector(dir, len / 8); }
  const g = new THREE.BufferGeometry(); const arr = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], w = .09 * (1 - i / pts.length) + .02;
    const n = V(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(w);
    arr.push(a.x + n.x, .02, a.z + n.z, a.x - n.x, .02, a.z - n.z, b.x + n.x, .02, b.z + n.z, a.x - n.x, .02, a.z - n.z, b.x - n.x, .02, b.z - n.z, b.x + n.x, .02, b.z + n.z);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  const m = new THREE.Mesh(g, fxMat(FX_DARK, .9)); m.position.y = gy(); fxGroup.add(m);
  g.setDrawRange(0, 0);
  const tot = arr.length / 3;
  fxList.push({ obj: m, t: 0, life, upd: k => { g.setDrawRange(0, Math.ceil(tot * Math.min(1, k * 6) / 6) * 6); m.material.opacity = .9 * (k > .6 ? (1 - k) / .4 : 1); } });
}
function cracksStar(pos, n, len) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU; crack(pos, V(Math.sin(a), 0, Math.cos(a)), len * (.6 + Math.random() * .5)); } }
const ghostBase = new THREE.MeshBasicMaterial({ color: FX_LIGHT, transparent: true, opacity: .3, depthWrite: false });
function ghost() {
  root.updateMatrixWorld(true);
  const g = SkeletonUtils.clone(root); const mat = ghostBase.clone();
  g.traverse((o: any) => { if (o.isMesh) o.material = mat; });
  fxGroup.add(g);
  fxList.push({ obj: g, t: 0, life: .4, shared: true, upd: k => { mat.opacity = .3 * (1 - k); } });
}
function updateFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i]; f.t += dt; const k = f.t / f.life;
    if (k >= 1) { fxGroup.remove(f.obj); f.obj.traverse((o: any) => { if (o.isSkinnedMesh) o.skeleton.dispose(); else if (o.isMesh && !f.shared) o.geometry.dispose(); if (o.isMesh) o.material.dispose(); }); fxList.splice(i, 1); continue; }
    f.upd(k);
  }
}
// Partikel: Staub (grau) und Glut (rot) in einem Pool, Farbe pro Punkt
const PN = 600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3).fill(-1000), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pGrav = new Float32Array(PN);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .08, vertexColors: true }));
pts.frustumCulled = false; fxGroup.add(pts);
let pNext = 0;
function emit(p, n, spd, col, grav = 9, life = 1) {
  const c = new THREE.Color(col);
  for (let i = 0; i < n; i++) {
    const j = pNext++ % PN;
    pPos.set([p.x, p.y, p.z], j * 3); pCol.set([c.r, c.g, c.b], j * 3);
    const a = Math.random() * TAU, h = Math.random();
    pVel.set([Math.cos(a) * spd * (1 - h * .5), spd * (.3 + h), Math.sin(a) * spd * (1 - h * .5)], j * 3);
    pLife[j] = life * (.6 + Math.random() * .6); pGrav[j] = grav;
  }
}
function updateParts(dt) {
  const floor = gy() + .03;
  for (let j = 0; j < PN; j++) {
    if (pLife[j] <= 0) continue;
    pLife[j] -= dt; if (pLife[j] <= 0) { pPos[j * 3 + 1] = -1000; continue; }
    pVel[j * 3 + 1] -= pGrav[j] * dt;
    for (let k = 0; k < 3; k++) pPos[j * 3 + k] += pVel[j * 3 + k] * dt;
    if (pPos[j * 3 + 1] < floor) { pPos[j * 3 + 1] = floor; pVel[j * 3] *= .5; pVel[j * 3 + 2] *= .5; pVel[j * 3 + 1] = 0; }
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
// Wirbel-Sicheln
const windG = new THREE.Group(); fxGroup.add(windG); windG.visible = false;
const windArcs = [];
for (let i = 0; i < 3; i++) {
  const r = 1.9 + i * .35;
  const m = new THREE.Mesh(new THREE.RingGeometry(r - .3, r, 48, 2, 0, 1.8), eMat(i % 2 ? PAL.wut : PAL.staub, { sc: 2.5, core: 0, local: true, flow: [0, 0, 0], side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 1.0 + i * .2; m.userData.off = i * 2.1; windG.add(m); windArcs.push(m);
}
function impact(p, r, nCr = 6) {
  ring(p, FX_LIGHT, r, .45, .12); ring(p, 0xd8121c, r * .7, .35, .2);
  const o = V(p.x, gy(), p.z), pal = rage > 30 ? PAL.wut : PAL.staub;   // Einschlag-Kuppel
  efx(.45, (k, _d, e) => { if (!e.ms.length) em(e, 'hemi', pal, { sc: 2.2, core: -.3, flow: [0, 2.5, 0], side: THREE.DoubleSide }).position.copy(o); e.ms[0].scale.set(r * .35 * outC(k), r * .25 * (1 - k * .5), r * .35 * outC(k)); setK(e.ms[0], 1 - k); });
  cracksStar(p, nCr, r * .6);
  emit(V(p.x, gy() + .1, p.z), 30, 4, 0x8f877a, 14, .9);
  if (rage > 30) emit(V(p.x, gy() + .1, p.z), Math.round(rage / 5), 5, 0xe0141c, 10, .8);
}
  // Treffer-Moment an der Schwertspitze
  const hitTip = (kind, i = 0) => { const p = tipPos(); model.onHit?.(kind, p.x, p.z, i); };
  const hitRoot = (kind, i = 0) => model.onHit?.(kind, root.position.x, root.position.z, i);
function defQ(step, hitI = step) {
  const from = step === 0 ? IDLE : Q_END[step - 1];
  const W = [
    P(IDLE, { y: .9, h: [0, -.3, 0], c: [.15, -.45, 0], hR: [-.3, 1.95, -.05], hL: 'G', b: [.15, .6, -.8], e: [0, 1, 0], fR: [-.3, .07, -.15] }),
    P(Q_END[0], { hR: [.55, 1.32, .35], hL: [.3, 1.1, .4], b: [.92, .15, .3], e: [0, 0, 1], c: [.45, .75, 0] }),
    P(IDLE, { y: .72, h: [0, .4, 0], c: [.55, .45, 0], n: [-.4, -.2, 0], hR: [-.5, .7, -.1], hL: 'G', b: [-.35, -.6, -.72], e: [0, -.2, 1], fL: [.32, .07, .2], fR: [-.32, .07, -.2] }),
    P(IDLE, { y: 1.35, h: [0, 0, 0], c: [-.3, 0, 0], n: [-.1, 0, 0], hR: [-.05, 2.25, -.15], hL: 'G', b: [0, .3, -.95], e: [0, 1, 0], fL: [.25, .5, .15], fR: [-.25, .42, -.1] })
  ][step];
  const dur = STRICH_TIMING.q[step];
  const tHit = [.42, .42, .42, .52][step];
  const keys = [[0, from], [step === 3 ? .32 : .28, W, 'io'], [tHit, Q_END[step], 'in'], [step === 3 ? .78 : .7, P(Q_END[step], { y: Q_END[step].y - .02 })], [1, Q_END[step]]];
  const ev = [[tHit - .06, () => {
    const pal = qPal ? PAL[qPal] : null;
    if (step === 0) arc([.0, 1.3, .9], [0, -.3, -.7], 2.1 * fin.s, 2.4, .3, true, pal);
    if (step === 1) arc([0, 1.3, .3], [-Math.PI / 2, 0, 0], 2.3 * fin.s, 2.8, .3, true, pal);
    if (step === 2) arc([-.1, 1.6, .8], [0, -Math.PI / 2, Math.PI], 1.9 * fin.s, 2.2, .3, true, pal);
  }], [tHit, () => {
    if (step === 3) { const p = tipPos(); impact(p, 4.5, 7); }
    else emit(tipPos(), 8, 3, 0x8f877a, 12, .5);
    hitTip('q', hitI);
  }]];
  return { dur, keys, ev, walk: step < 3 };
}
  // Kahlschlag (Axt): einmal rundum mit ausgestreckter Axt, Treffer am Spieler
  function defSpin() {
    const wind = P(IDLE, { y: .9, h: [0, .5, 0], c: [.3, .6, 0], n: [-.2, -.3, 0], hR: [.55, 1.3, -.3], hL: 'G', b: [.9, .2, -.4], e: [0, 0, 1], fL: [.32, .07, .1], fR: [-.32, .07, -.2] });
    const out = P(IDLE, { y: .82, h: [0, 0, 0], c: [.3, 0, .1], n: [-.15, 0, 0], hR: [-.7, 1.15, .25], hL: 'G', b: [-1, -.05, .15], e: [0, 0, 1], fL: [.36, .07, .05], fR: [-.36, .07, -.05] });
    return { dur: W.e, keys: [[0, IDLE], [.25, wind, 'out'], [.4, out], [.8, out], [1, IDLE]],
      ev: [[.5, () => { arc([0, 1.0, 0], [-Math.PI / 2, 0, 0], 2.8, 5.8, .35); hitRoot('e'); }]],
      tick(u) { spinAng = TAU * inOut(clamp((u - .3) / .5, 0, 1)); },
      end() { spinAng = 0; } };
  }
  function defE() {
  const up = P(IDLE, { y: 1.0, c: [-.25, 0, 0], n: [-.2, 0, 0], hR: [-.05, 2.2, -.1], hL: 'G', b: [0, .35, -.94], e: [0, 1, 0], fL: [.32, .07, .1], fR: [-.32, .07, -.15] });
  const slam = P(IDLE, { y: .62, h: [0, 0, 0], c: [.85, 0, 0], n: [-.7, 0, 0], hR: [0, .75, .82], hL: 'G', b: [0, -.8, .6], e: [0, -1, 0], fL: [.42, .07, .28], fR: [-.42, .07, -.35] });
  return { dur: STRICH_TIMING.e, keys: [[0, IDLE], [.35, up], [.48, slam, 'in'], [.85, P(slam, { y: .6 })], [1, IDLE]],
    ev: [[.48, () => { impact(tipPos(), 2.5, 3); hitTip('e'); }]] };
}
  // Wirbelwind hält, solange das Spiel ihn meldet. Treffer tickt das Spiel selbst.
  function defWhirl() {
  const sp = P(IDLE, { y: .97, h: [0, 0, 0], c: [.1, 0, .1], n: [-.1, 0, 0], hR: [-.62, 1.3, .2], hL: 'G', b: [-1, .02, .1], e: [0, 0, 1], fL: [.32, .07, .05], fR: [-.32, .07, -.05] });
    return { hold: true, dur: 200, keys: [[0, IDLE], [1, sp]],
      ev: [[.3, () => windG.visible = true]],
      tick(u, s) {
        spinAng += s * TAU * 2.5;
        windG.position.copy(root.position);
        windArcs.forEach((m, i) => { m.rotation.z = -(spinAng + m.userData.off); m.material.userData.u.uK.value = .75 + .15 * Math.sin(performance.now() / 50 + i); });
        if (Math.random() < .5) emit(tipPos().setY(gy() + .1), 1, 2, 0x8f877a, 8, .5);
      }, end() { spinAng = 0; windG.visible = false; } };
  }
  function defLeap() {
  const crouch = P(IDLE, { y: .6, c: [.8, 0, 0], n: [-.6, 0, 0], hR: [-.4, 1.0, -.45], hL: 'G', b: [-.1, .1, -1], e: [0, 1, 0], fL: [.32, .07, .3], fR: [-.32, .07, -.4] });
  const air = P(IDLE, { y: 1.1, h: [-.2, 0, 0], c: [-.35, 0, 0], n: [-.1, 0, 0], hR: [-.05, 2.3, -.2], hL: 'G', b: [0, .25, -.97], e: [0, 1, 0], fL: [.25, .45, .3], fR: [-.25, .35, -.2] });
  const land = P(Q_END[3], { y: .55 });
    let gi = -1;
    const { from: f0, to: f1 } = STRICH_TIMING.leap.move;
    return { dur: STRICH_TIMING.leap.ms, keys: [[0, IDLE], [.2, crouch], [.3, air, 'out'], [.6, P(air, { c: [-.15, 0, 0] })], [.66, land, 'in'], [.9, P(land, { y: .56 })], [1, IDLE]],
      ev: [[f1, () => { lift = 0; impact(root.position, 7, 9); hitRoot('leap'); }]],
      tick(u) {
        const k = clamp((u - f0) / (f1 - f0), 0, 1);
        lift = 3.8 * Math.sin(Math.PI * k);
        const g = Math.floor(k * 5); if (k > 0 && k < 1 && g > gi) { gi = g; ghost(); }
      }, end() { lift = 0; } };
  }
  function defExec() {
  const wind = P(IDLE, { y: 1.04, h: [0, -.15, 0], c: [-.45, -.1, 0], n: [-.45, 0, 0], hR: [-.05, 2.3, -.35], hL: 'G', b: [0, -.1, -1], e: [0, 1, 0], fL: [.36, .07, .25], fR: [-.36, .07, -.35] });
  const strike = P(IDLE, { y: .52, h: [0, 0, 0], c: [.95, 0, 0], n: [-.75, 0, 0], hR: [0, .66, .95], hL: 'G', b: [0, -.62, .78], e: [0, -1, 0], fL: [.45, .07, .55], fR: [-.45, .07, -.45] });
    return { dur: STRICH_TIMING.exec, keys: [[0, IDLE], [.4, wind, 'out'], [.6, P(wind, { y: 1.06, c: [-.5, -.1, 0] })], [.67, strike, 'in'], [.92, P(strike, { y: .5 })], [1, IDLE]],
      ev: [[.15, () => { flare = 1; }], [.63, () => arc([0, 1.4, 1.1], [0, Math.PI / 2, 0], 2.6, 2.6, .4)],
        [.67, () => { impact(tipPos(), 5, 8); hitTip('exec'); }]] };
  }
  function defCry() {
  const roar = P(IDLE, { y: .95, h: [0, 0, 0], c: [-.35, 0, 0], n: [-.6, 0, 0], hR: [-.85, 1.2, .1], b: [-.55, -.8, .1], e: [-1, 0, 0], hL: [.85, 1.6, .15], fL: [.38, .07, .1], fR: [-.38, .07, -.1] });
    return { dur: STRICH_TIMING.cry, keys: [[0, IDLE], [.2, P(IDLE, { y: .82, c: [.6, 0, 0], n: [.2, 0, 0] })], [.35, roar, 'out'], [.8, P(roar, { c: [-.4, 0, 0] })], [1, IDLE]],
      ev: [[.35, () => { flare = 1; ring(root.position, 0xd8121c, 8, .6, .1); ring(root.position, FX_LIGHT, 6, .5, .08); emit(root.position.clone().setY(gy() + .2), 40, 5, 0x8f877a, 10, .7); hitRoot('cry'); }]] };
  }
  function defLast() {
  const plant = P(IDLE, { y: .66, h: [0, 0, 0], c: [.55, 0, 0], n: [.4, 0, 0], hR: [0, 1.3, .55], hL: 'G', b: [0, -1, .08], e: [0, 0, 1], fL: [.3, .07, .15], fR: [-.25, .19, -.5] });
  const rise = P(plant, { y: .98, c: [-.4, 0, 0], n: [-.7, 0, 0], hL: [.85, 1.55, .2], fR: [-.3, .07, -.3] });
    return { dur: STRICH_TIMING.last, keys: [[0, IDLE], [.25, plant, 'in'], [.55, P(plant, { y: .64 })], [.72, rise, 'out'], [.9, rise], [1, IDLE]],
      ev: [[.25, () => { const p = tipPos(); cracksStar(p, 6, 2.5); emit(p.setY(gy() + .1), 25, 3, 0x8f877a, 12, .7); }],
        [.72, () => { flare = 1.5; ring(root.position, 0xd8121c, 12, .8, .12); emit(root.position.clone().setY(gy() + .3), 60, 6, 0xe0141c, 2, 1.4); hitRoot('last'); }]] };
  }
  // Finisher-Spin (Version E): einmal rundum, Treffer am Spieler. Größe fin.s, Tornado: Staub am Boden
  function defFinSpin() {
    const sp = P(IDLE, { y: .82, h: [0, 0, 0], c: [.35, 0, 0], n: [-.2, 0, 0], hR: [-.95, 1.15, .3], hL: [.6, 1.2, .2], b: [-1, .02, .15], e: [0, 0, 1], fL: [.36, .07, .2], fR: [-.36, .07, -.2] });
    const s = fin.s, tor = fin.tor, pal = qPal ? PAL[qPal] : null;
    return { dur: 560, keys: [[0, IDLE], [.2, sp, 'io'], [.8, sp], [1, P(sp, { y: .8 })]],
      ev: [[.46, () => { arc([0, 1.1, 0], [-Math.PI / 2, 0, 0], 3 * s, TAU, .35, true, pal); ring(root.position, 0, 3.6 * s, .4, .15, pal); hitRoot('q', 9); }]],
      tick(u) { spinAng = TAU * inOut(clamp((u - .2) / .6, 0, 1)); if (tor && Math.random() < .6) emit(tipPos().setY(gy() + .1), 2, 3, 0x8f877a, 8, .6); },
      end() { spinAng = 0; } };
  }
  // Sprung-Smash (Version E): Hieb von oben mit Sprung, Einschlag an der Spitze
  function defFinSmash() {
    const d: any = defQ(3, 10), s = fin.s;
    d.ev = [[.52, () => { const p = tipPos(); impact(p, 4.5 * s, 7); hitTip('q', 10); }]];
    d.tick = u => { lift = 1.6 * Math.sin(Math.PI * clamp((u - .1) / .42, 0, 1)); };
    d.end = () => { lift = 0; };
    d.walk = false;
    return d;
  }
  const makeAction = ability => {
    if (ability === 'fs') return defFinSpin();
    if (ability === 'fm') return defFinSmash();
    if (ability === 'qs') { const d = defQ(1, 9); d.dur = W.spin ?? 420; return d; }   // Spin: Treffer-Index 9
    if (ability?.[0] === 'q') {
      const i = +ability[1], d = defQ(W.pose[i] ?? i, i);
      d.dur = W.q[i] ?? d.dur;
      return d;
    }
    const d = { e: weapon === 'axe' ? defSpin : defE, whirl: defWhirl, leap: defLeap, exec: defExec, cry: defCry, last: defLast }[ability]?.();
    if (ability === 'e' || ability === 'exec') d.dur = W[ability];
    return d;
  };
  const applyTuple = (e, v) => e.set(v[0], v[1], v[2]);
  let eatK = { s: 0, k: 0 };
  let act = null, actKey = '', lastPose = resolve(IDLE), blendFrom = null, blendT = 0, runPh = 0, T = 0, lastLoco = 'idle', ready = false;
  function evalKeys(keys, u) {
    let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
    const [t0, p0] = keys[i], [t1, p1, e] = keys[i + 1];
    const k = (EASE[e] || inOut)(clamp((u - t0) / Math.max(1e-4, t1 - t0), 0, 1));
    return mix(resolve(p0), resolve(p1), k);
  }
  function cancel() { act?.def.end?.(); act = null; }
  function update(dt, anim: any = {}) {
    const s = dt > 1 ? dt / 1000 : dt;
    T += s;
    const loco = anim.state || 'idle', ability = anim.ability || null;
    qPal = anim.qPal ?? null; if (anim.fin) fin = anim.fin;
    if (loco === 'dead' && act) cancel();
    const key = ability ? `${ability}:${anim.seq ?? 0}` : '';
    if (key !== actKey) {
      actKey = key;
      if (act?.def.hold) { cancel(); blendFrom = lastPose; blendT = .15; }
      const def = key && loco !== 'dead' ? makeAction(ability) : null;
      if (def) {
        cancel();
        def.ev.sort((x, y) => x[0] - y[0]);
        act = { def, t: 0, i: 0 };
        blendFrom = lastPose; blendT = .1;
      }
    }
    if (loco !== lastLoco) { blendFrom = lastPose; blendT = .15; lastLoco = loco; }
    let pose;
    if (act) {
      const d = act.def;
      if (!anim.frozen) act.t += s * 1000 * (anim.rate ?? 1);
      const u = clamp(act.t / d.dur, 0, 1);
      while (act.i < d.ev.length && d.ev[act.i][0] <= u) d.ev[act.i++][1]();
      d.tick?.(u, anim.frozen ? 0 : s);
      pose = evalKeys(d.keys, u);
      if (d.walk && (loco === 'run' || loco === 'back')) {   // Schläge 1–3 gehen im Laufen
        runPh += s * (anim.speed || 7) / .65 * (loco === 'back' ? -1 : 1);
        const r = runPose(runPh);
        pose.y = r.y; pose.fL = r.fL; pose.fR = r.fR;
      }
      if (u >= 1 && !d.hold) { d.end?.(); act = null; blendFrom = pose; blendT = .18; }
    } else if (loco === 'run' || loco === 'back') {
      if (!anim.frozen) runPh += s * (anim.speed || 7) / .65 * (loco === 'back' ? -1 : 1);
      pose = resolve(runPose(runPh));
      if (loco === 'run' && Math.random() < .5) emit(tipPos().setY(gy() + .05), 1, 1.5, 0x8f877a, 8, .5);
    } else if (loco === 'air') pose = resolve(P(IDLE, { y: .98, fL: [.25, .42, .2], fR: [-.25, .3, -.22] }));
    else if (loco === 'dead') pose = resolve(DEAD);
    else if (loco === 'sit') {
      pose = resolve(SIT);
      // Biss alle 2,4 s: Keule zum Mund, Kopf reißt zur Seite, dann kauen
      const k = (T % 2.4) / 2.4, b = k < .4 ? Math.sin(Math.PI * k / .4) ** .7 : 0, tear = k > .22 && k < .4 ? Math.sin(Math.PI * (k - .22) / .18) : 0;
      const chew = k >= .4 ? Math.abs(Math.sin(T * 14)) * .06 : 0;
      pose.hL = [lerp(.35, .08, b) + .12 * tear, lerp(.75, 1.25, b), lerp(.4, .28, b)];
      pose.n = [.1 + .2 * b + chew, -.5 * tear, .15 * tear];
      pose.c[0] = .2 + .2 * b;
      eatK = { s: b, k };
    } else {
      pose = resolve(IDLE);
      // schweres Atmen: Brust hebt sich, Schultern mit
      const br = Math.sin(T * 1.9);
      pose.y += .02 * br; pose.c[0] += .05 * br; pose.hR[1] += .03 * br; pose.n[0] -= .04 * br;
    }
    root.rotation.y += spinAng;
    root.position.y += lift;
    if (blendT > 0 && blendFrom) { blendT -= s; pose = mix(blendFrom, pose, 1 - clamp(blendT / .15, 0, 1)); }
    lastPose = pose;

    hips.position.y = pose.y; applyTuple(hips.rotation, pose.h); applyTuple(chest.rotation, pose.c); applyTuple(neck.rotation, pose.n);
    root.updateMatrixWorld(true);
    legIK(legL, pose.fL); legIK(legR, pose.fR);
    armIK(armR, pose.hR);
    root.updateMatrixWorld(true);
    placeSword(pose.b, pose.e);
    const g = gripL(); lastGrip = g.toArray();
    armIK(armL, pose.hL.map((v, i) => lerp(v, lastGrip[i], pose.g)));
    root.updateMatrixWorld(true);
    // Fleischkeule beim Essen, nur dann ein Draw Call mehr
    meat.visible = loco === 'sit' && !act;
    if (meat.visible) {
      root.worldToLocal(armL.hand.getWorldPosition(meat.position));
      meat.quaternion.setFromUnitVectors(V(0, 1, 0), V(lerp(.3, -.7, eatK.s), lerp(.85, .35, eatK.s), lerp(.2, .1, eatK.s)).normalize());
      if (eatK.k > .3 && eatK.k - s / 2.4 <= .3) emit(meat.getWorldPosition(V()).add(V(0, .1, 0)), 8, 1.5, 0x8a3b1c, 10, .5);
    }

    // Wut-Aura: Dicke und Deckkraft wachsen mit der Wut, ohne Wut kein Draw Call
    rage = anim.rage ?? 0;
    flare = Math.max(0, flare - s * 1.2);
    const r = rage / 100, I = clamp(r * r * .9 + flare * .6, 0, 1.4);
    const IB = anim.berserk ? 1.4 : I;   // Berserker: Hülle voll
    AURA_E.userData.u.uInf.value = .025 + .07 * IB; AURA_E.userData.u.uK.value = clamp(IB * .45, 0, .62);
    aura.visible = auraRing.visible = (r > .05 || flare > 0 || !!anim.berserk) && loco !== 'dead';
    auraRing.material.opacity = .45 * I; auraRing.position.set(root.position.x, gy() + .01, root.position.z); auraRing.scale.setScalar(1 + .6 * I + .05 * Math.sin(T * 10));
    if (aura.visible && Math.random() < I * s * 40) emit(root.position.clone().add(V((Math.random() - .5) * .9, .3 + Math.random() * 1.6, (Math.random() - .5) * .9)), 1, .4, 0xe0141c, -2.5, .8);

    // Stoffbahn
    const an = clothAnchor.getWorldPosition(V());
    if (!ready || an.distanceTo(sP[0]) > 6) { clothReset(); ready = true; }
    const side = V().setFromMatrixColumn(hips.matrixWorld, 0).normalize();
    const back = V().setFromMatrixColumn(hips.matrixWorld, 2).normalize().negate();
    sP[0].copy(an); sO[0].copy(an);
    for (let i = 1; i < SN; i++) {
      const v = sP[i].clone().sub(sO[i]).multiplyScalar(.9);
      sO[i].copy(sP[i]);
      sP[i].add(v).add(V(0, -6 * s * s, 0)).addScaledVector(back, .5 * s * s);
    }
    for (let i = 1; i < SN; i++) { const d = sP[i].clone().sub(sP[i - 1]); const L = d.length() || 1; sP[i].copy(sP[i - 1]).addScaledVector(d, SEG / L); }
    const pa = clothGeo.attributes.position;
    for (let i = 0; i < SN; i++) {
      const w = .11 * cloth0.w * (1 - i / SN * .35);
      for (const n of [0, 1]) { const p = sP[i].clone().addScaledVector(side, (n ? 1 : -1) * w + (i % 2 ? .015 : -.015)); pa.setXYZ(i * 2 + n, p.x, p.y, p.z); }
    }
    pa.needsUpdate = true;
    lookTick(s, anim);
    updateFx(s); updateParts(s);
  }
  // Skin-Gags pro Frame (nur Optik)
  let kills = -1;
  function lookTick(s, anim) {
    if (look === 'klapse') head.rotation.z = Math.sin(T * 7) * .04 + (Math.sin(T * .9) > .85 ? .25 : 0);   // ruckartiges Kopf-Zucken // PH
    // Holzfäller: Kerben, goldener Stiel, Sprössling, Scheite nach Kills im Run (anim.kills), nur bei Änderung
    if (look === 'holz' && (anim.kills ?? 0) !== kills) {
      kills = anim.kills ?? 0;
      for (let i = 0; i < HOLZ.notches; i++) showTag(lookW, `n${i}`, i < kills);
      tintTag(lookW, 'wood', col(kills >= HOLZ.gold ? 0xe8b23a : 0xd8a868));
      showTag(lookW, 'sprout', kills >= HOLZ.sprout);
      const logs = Math.min(HOLZ.logs, Math.floor(kills / HOLZ.perLog));
      for (let i = 0; i < HOLZ.logs; i++) showTag(bodyT, `log${i}`, i < logs);
    }
    // Classic: roter Verzauberungs-Schein an der Klinge, über die Partikel der Figur (0 Draw Calls extra)
    if (look === 'classic' && swordMesh.visible && Math.random() < s * 18) emit(swordMesh.localToWorld(V((Math.random() - .5) * .22, .35 + Math.random() * 1.5, 0)), 1, .15, 0xff3a2a, -.6, .55);   // PH
  }
  // Risse von Bodenbrecher: das Spiel meldet jede Welle
  const crackAt = (x, z, dx, dz) => { const q = V(x, 0, z); crack(q, V(dx, 0, dz).applyAxisAngle(V(0, 1, 0), (Math.random() - .5) * .5), 1.9, 1.4); emit(V(x, gy() + .1, z), 8, 3, 0x8f877a, 12, .7); };
  const model: any = {
    root, update, scarf: cloth, onHit: null, weapon, look,
    // Sprechblasen und Namensschild des Skins (ui/skinTalk.ts): null = keine
    talk: TALK.kind ? { ...TALK, anchor: head, get on() { return lastLoco !== 'dead'; } } : null,
    anchors: { crystal: armR.hand, handL: armL.hand, handR: armR.hand },
    fx: { group: fxGroup, crackAt, ring, ghost, gy, blood: (x, y, z, n = 6) => emit(V(x, y, z), n, 2.5, 0x9e0b0f, 12, .8) },
    get tris() { return Math.round((body.geometry.attributes.position.count + swordMesh.geometry.attributes.position.count + (maceGlow ? maceGlow.geometry.attributes.position.count : 0)) / 3 + (SN - 1) * 2); },
    get bloom() { return bloom; },
    // Waffe aus models/weapons statt des eigenen Schwerts: Griff in der rechten Hand, Länge für Treffer und linke Hand aus der Waffe
    // Skin mit eigenem Waffen-Look: Waffe bleibt im Rahmen, aber unsichtbar; der Look übernimmt ihre Länge
    setWeapon(w, scale = 1, tip = 1.95, grip = .24) {
      swordMesh.visible = !!lookW;
      w.root.scale.setScalar(scale);
      w.root.visible = !lookW;
      sword.add(w.root);
      tipLen = tip * scale; gripLen = grip * scale; baseTip = tipLen; baseGrip = gripLen;
      fitLook(tipLen);
    },
    // Schlagfolge Version E: Schwert wächst pro Stufe (Größe und Treffer-Spitze)
    setBladeScale(k) { sword.scale.setScalar(k); tipLen = baseTip * k; gripLen = baseGrip * k; },
    // Neue Stufe: goldene Kugel an der Spitze + Ring, Aura flammt auf
    flareTip() {
      flare = 1.5;
      efx(.7, (k, _d, e) => { if (!e.ms.length) em(e, 'sph', PAL.donner, { sc: 3, core: .8, flow: [0, 3, 0], puff: .05 }); e.ms[0].position.copy(tipPos()); e.ms[0].scale.setScalar(.3 + 1.6 * outC(k)); setK(e.ms[0], 1 - k); });
      ring(root.position, 0, 5, .7, .2, PAL.donner);
    },
  };
  return model;
}
