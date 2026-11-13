// Strichkrieger: Figur, Schwert, Wut-Aura, Moves und Effekte aus dem Viewer „Frost Grind – Strichkrieger“ (https://claude.ai/artifact/CWAKpz96NVdZ2sQQWd8yXR, wie docs/handoff.md), dazu Rückwärts, Sprung, Tod und Rim-Licht.
// Vanilla-Technik: ein SkinnedMesh, Gewicht 1, Vertex-Farben, 3-Stufen-Toon. Das Modell bewegt den Spieler nicht: Sprung und Treffer macht realMen.ts über onHit.
// anim = { state, speed, ability: null|'q0'..'q3'|'fs'|'fm'|'e'|'whirl'|'leap'|'exec'|'cry'|'last', seq, rate, rage (0–100), frozen }. dt > 1 gilt als ms.
// Schlagfolge Version E (realMen.ts): 'fs' Finisher-Spin, 'fm' Sprung-Smash; anim.fin = { s: Größe, tor: Tornado }, anim.qPal = Hieb-Farbe ('staub' | 'wut' | 'donner')

import * as THREE from 'three';
import { clamp, lerpTo as lerp, inOut, outC, V } from '../util';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { eMat, PAL, fx as efx, em, uK as setK } from '../vfx/energy';
import { grad, capDown, RIM, rimChunk, ik } from './strichKit';
import type { Fig } from './strichKrieger/fig';
import { TAU, C, prep, partKit, mergeTagged, showTag, tintTag, col, HOLZ } from './strichKrieger/parts';
import { lookBody } from './strichKrieger/looks';
import { buildWarFx, FX_LIGHT, SN } from './strichKrieger/fx';
import { WEAPON_SHAPE, swordGeo, axeGeo, maceGeo, maceGlowGeo, lookWeapon } from './strichKrieger/weapons';
export type { Fig, WarAnim } from './strichKrieger/fig';

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
const inC = t => t * t * t;
const EASE = { io: inOut, out: outC, in: inC, lin: t => t };

const L1 = .5, L2 = .48, A1 = .35, A2 = .33;
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

// skinId: Skin aus src/skins.ts (standard, klapse, classic, holz). Unbekannt oder noch nicht gebaut = Standard. Intern heißt er look (Viewer-Code)
export function buildStrichKrieger({ bloom = false, weapon = 'sword', skinId: look = 'standard' } = {}) {
  const W = STRICH_TIMING.weapons[weapon] ?? STRICH_TIMING.weapons.sword;
  const fxGroup = new THREE.Group();
  const VMAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  VMAT.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
      `outgoingLight += ${rimChunk(RIM.color, RIM.power)};\n#include <opaque_fragment>`);
  };
  // Geteilter Animations-Zustand der Figur (vorher lose let im Builder)
  const bones = [], parts = [];
  const F = { bones, parts, anim: { lift: 0, spinAng: 0, rage: 0, flare: 0, qPal: null, fin: { s: 1, tor: 0 }, tipLen: 0, gripLen: 0, baseTip: 0, baseGrip: 0, lastGrip: null,
    eatK: { s: 0, k: 0 }, act: null, actKey: '', lastPose: null, blendFrom: null, blendT: 0, runPh: 0, T: 0, lastLoco: 'idle', ready: false, kills: -1 } } as Fig;
  const gy = () => root.position.y - F.anim.lift;             // Boden unter der Figur
function B(p, x = 0, y = 0, z = 0) { const b = new THREE.Bone(); b.position.set(x, y, z); p.add(b); bones.push(b); return b; }
const { part } = partKit(F);   // strichKrieger/parts.ts
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
Object.assign(F, { fxGroup, gy, root, hips, chest, neck, head, armL, armR, legL, legR, clothAnchor, bp: { pHips, pChest, pNeck, pHead, pBelt } });
// Skins (src/skins.ts) am Körper: strichKrieger/looks.ts. Stoffbahn (Farbe, Breite) und Sprechblasen kommen vom Skin
const { cloth0, TALK } = lookBody(F, look);
root.updateMatrixWorld(true);
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
// Das Schwert wird immer gebaut (auch unter Look oder Axt): jede Geometrie würfelt beim Bau ihre uuid mit Math.random, gleiche Zahl Aufrufe = gleiche Effekte bei festem Seed
const SWORD_GEO = swordGeo();
// Waffen-Look der Skins (strichKrieger/weapons.ts), top: oberes Ende, wird auf die Treffer-Spitze der Waffe skaliert
const LW = lookWeapon(look, bloom);
const lookW = LW.list.length ? mergeTagged(LW.list) : null;
// Schwert-Rahmen: y = Klinge, x = Schneide, Griff im Ursprung. Darin das eigene Schwert oder eine Waffe aus models/weapons (setWeapon)
const sword = new THREE.Group(); root.add(sword);
const swordMesh = new THREE.Mesh(lookW ? lookW.geo : weapon === 'axe' ? axeGeo() : weapon === 'mace' ? maceGeo() : SWORD_GEO, VMAT); sword.add(swordMesh);
F.anim.tipLen = WEAPON_SHAPE[weapon]?.tip ?? 1.95; F.anim.gripLen = WEAPON_SHAPE[weapon]?.grip ?? .24; F.anim.baseTip = F.anim.tipLen; F.anim.baseGrip = F.anim.gripLen;
// Kolben: Blitzrisse leuchten blau (+1 Draw Call), mit Bloom heller
let maceGlow = null;
if (weapon === 'mace' && !lookW) {
  maceGlow = new THREE.Mesh(maceGlowGeo(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (bloom) maceGlow.material.color.setScalar(2.2);
  sword.add(maceGlow);
}
// Look-Waffe auf die Spitze der Waffe skalieren (k = Waffen-Maß × Skalierung)
const fitLook = (tip) => { if (lookW) swordMesh.scale.setScalar(tip / LW.top); };
fitLook(F.anim.tipLen);
  // Fleischkeule zum Essen: Knochen + Fleisch, Griff im Ursprung, Fleisch nach +y
  const meat = new THREE.Mesh(mergeGeometries([
    prep(new THREE.CylinderGeometry(.025, .025, .22, 5).translate(0, -.02, 0), new THREE.Color(0xeee6d0)),
    prep(new THREE.IcosahedronGeometry(.035, 0).translate(.02, -.14, 0), new THREE.Color(0xeee6d0)), prep(new THREE.IcosahedronGeometry(.035, 0).translate(-.02, -.14, 0), new THREE.Color(0xeee6d0)),
    prep(new THREE.IcosahedronGeometry(.11, 1).scale(1, 1.35, 1).translate(0, .17, 0), new THREE.Color(0x8a3b1c)),
    prep(new THREE.IcosahedronGeometry(.06, 0).translate(.06, .2, .05), new THREE.Color(0xa9552a))
  ]), VMAT); meat.visible = false; root.add(meat);
// Effekte (strichKrieger/fx.ts): Wut-Ring und Stoffbahn hier gebaut wie vorher, der Rest ohne neue Objekte bis zum Pool
const { auraRing, cloth, clothStep, arc, ring, crack, cracksStar, ghost, updateFx, emit, updateParts, windG, windArcs, impact } = buildWarFx(F, cloth0);
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
const gripL = () => sword.position.clone().addScaledVector(V(0, 1, 0).applyQuaternion(sword.quaternion), -F.anim.gripLen);
const tipPos = () => root.localToWorld(sword.position.clone().addScaledVector(V(0, 1, 0).applyQuaternion(sword.quaternion), F.anim.tipLen));
  F.anim.lastGrip = [.2, 1.2, .3];
  function resolve(p) {
    const o: any = {};
    for (const k of KEYS) { const v = p[k]; o[k] = Array.isArray(v) ? v.slice() : v; }
    if (p.hL === 'G') { o.hL = F.anim.lastGrip.slice(); o.g = 1; } else o.g = 0;
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
    const pal = F.anim.qPal ? PAL[F.anim.qPal] : null;
    if (step === 0) arc([.0, 1.3, .9], [0, -.3, -.7], 2.1 * F.anim.fin.s, 2.4, .3, true, pal);
    if (step === 1) arc([0, 1.3, .3], [-Math.PI / 2, 0, 0], 2.3 * F.anim.fin.s, 2.8, .3, true, pal);
    if (step === 2) arc([-.1, 1.6, .8], [0, -Math.PI / 2, Math.PI], 1.9 * F.anim.fin.s, 2.2, .3, true, pal);
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
      tick(u) { F.anim.spinAng = TAU * inOut(clamp((u - .3) / .5, 0, 1)); },
      end() { F.anim.spinAng = 0; } };
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
        F.anim.spinAng += s * TAU * 2.5;
        windG.position.copy(root.position);
        windArcs.forEach((m, i) => { m.rotation.z = -(F.anim.spinAng + m.userData.off); m.material.userData.u.uK.value = .75 + .15 * Math.sin(performance.now() / 50 + i); });
        if (Math.random() < .5) emit(tipPos().setY(gy() + .1), 1, 2, 0x8f877a, 8, .5);
      }, end() { F.anim.spinAng = 0; windG.visible = false; } };
  }
  function defLeap() {
  const crouch = P(IDLE, { y: .6, c: [.8, 0, 0], n: [-.6, 0, 0], hR: [-.4, 1.0, -.45], hL: 'G', b: [-.1, .1, -1], e: [0, 1, 0], fL: [.32, .07, .3], fR: [-.32, .07, -.4] });
  const air = P(IDLE, { y: 1.1, h: [-.2, 0, 0], c: [-.35, 0, 0], n: [-.1, 0, 0], hR: [-.05, 2.3, -.2], hL: 'G', b: [0, .25, -.97], e: [0, 1, 0], fL: [.25, .45, .3], fR: [-.25, .35, -.2] });
  const land = P(Q_END[3], { y: .55 });
    let gi = -1;
    const { from: f0, to: f1 } = STRICH_TIMING.leap.move;
    return { dur: STRICH_TIMING.leap.ms, keys: [[0, IDLE], [.2, crouch], [.3, air, 'out'], [.6, P(air, { c: [-.15, 0, 0] })], [.66, land, 'in'], [.9, P(land, { y: .56 })], [1, IDLE]],
      ev: [[f1, () => { F.anim.lift = 0; impact(root.position, 7, 9); hitRoot('leap'); }]],
      tick(u) {
        const k = clamp((u - f0) / (f1 - f0), 0, 1);
        F.anim.lift = 3.8 * Math.sin(Math.PI * k);
        const g = Math.floor(k * 5); if (k > 0 && k < 1 && g > gi) { gi = g; ghost(); }
      }, end() { F.anim.lift = 0; } };
  }
  function defExec() {
  const wind = P(IDLE, { y: 1.04, h: [0, -.15, 0], c: [-.45, -.1, 0], n: [-.45, 0, 0], hR: [-.05, 2.3, -.35], hL: 'G', b: [0, -.1, -1], e: [0, 1, 0], fL: [.36, .07, .25], fR: [-.36, .07, -.35] });
  const strike = P(IDLE, { y: .52, h: [0, 0, 0], c: [.95, 0, 0], n: [-.75, 0, 0], hR: [0, .66, .95], hL: 'G', b: [0, -.62, .78], e: [0, -1, 0], fL: [.45, .07, .55], fR: [-.45, .07, -.45] });
    return { dur: STRICH_TIMING.exec, keys: [[0, IDLE], [.4, wind, 'out'], [.6, P(wind, { y: 1.06, c: [-.5, -.1, 0] })], [.67, strike, 'in'], [.92, P(strike, { y: .5 })], [1, IDLE]],
      ev: [[.15, () => { F.anim.flare = 1; }], [.63, () => arc([0, 1.4, 1.1], [0, Math.PI / 2, 0], 2.6, 2.6, .4)],
        [.67, () => { impact(tipPos(), 5, 8); hitTip('exec'); }]] };
  }
  function defCry() {
  const roar = P(IDLE, { y: .95, h: [0, 0, 0], c: [-.35, 0, 0], n: [-.6, 0, 0], hR: [-.85, 1.2, .1], b: [-.55, -.8, .1], e: [-1, 0, 0], hL: [.85, 1.6, .15], fL: [.38, .07, .1], fR: [-.38, .07, -.1] });
    return { dur: STRICH_TIMING.cry, keys: [[0, IDLE], [.2, P(IDLE, { y: .82, c: [.6, 0, 0], n: [.2, 0, 0] })], [.35, roar, 'out'], [.8, P(roar, { c: [-.4, 0, 0] })], [1, IDLE]],
      ev: [[.35, () => { F.anim.flare = 1; ring(root.position, 0xd8121c, 8, .6, .1); ring(root.position, FX_LIGHT, 6, .5, .08); emit(root.position.clone().setY(gy() + .2), 40, 5, 0x8f877a, 10, .7); hitRoot('cry'); }]] };
  }
  function defLast() {
  const plant = P(IDLE, { y: .66, h: [0, 0, 0], c: [.55, 0, 0], n: [.4, 0, 0], hR: [0, 1.3, .55], hL: 'G', b: [0, -1, .08], e: [0, 0, 1], fL: [.3, .07, .15], fR: [-.25, .19, -.5] });
  const rise = P(plant, { y: .98, c: [-.4, 0, 0], n: [-.7, 0, 0], hL: [.85, 1.55, .2], fR: [-.3, .07, -.3] });
    return { dur: STRICH_TIMING.last, keys: [[0, IDLE], [.25, plant, 'in'], [.55, P(plant, { y: .64 })], [.72, rise, 'out'], [.9, rise], [1, IDLE]],
      ev: [[.25, () => { const p = tipPos(); cracksStar(p, 6, 2.5); emit(p.setY(gy() + .1), 25, 3, 0x8f877a, 12, .7); }],
        [.72, () => { F.anim.flare = 1.5; ring(root.position, 0xd8121c, 12, .8, .12); emit(root.position.clone().setY(gy() + .3), 60, 6, 0xe0141c, 2, 1.4); hitRoot('last'); }]] };
  }
  // Finisher-Spin (Version E): einmal rundum, Treffer am Spieler. Größe fin.s, Tornado: Staub am Boden
  function defFinSpin() {
    const sp = P(IDLE, { y: .82, h: [0, 0, 0], c: [.35, 0, 0], n: [-.2, 0, 0], hR: [-.95, 1.15, .3], hL: [.6, 1.2, .2], b: [-1, .02, .15], e: [0, 0, 1], fL: [.36, .07, .2], fR: [-.36, .07, -.2] });
    const s = F.anim.fin.s, tor = F.anim.fin.tor, pal = F.anim.qPal ? PAL[F.anim.qPal] : null;
    return { dur: 560, keys: [[0, IDLE], [.2, sp, 'io'], [.8, sp], [1, P(sp, { y: .8 })]],
      ev: [[.46, () => { arc([0, 1.1, 0], [-Math.PI / 2, 0, 0], 3 * s, TAU, .35, true, pal); ring(root.position, 0, 3.6 * s, .4, .15, pal); hitRoot('q', 9); }]],
      tick(u) { F.anim.spinAng = TAU * inOut(clamp((u - .2) / .6, 0, 1)); if (tor && Math.random() < .6) emit(tipPos().setY(gy() + .1), 2, 3, 0x8f877a, 8, .6); },
      end() { F.anim.spinAng = 0; } };
  }
  // Sprung-Smash (Version E): Hieb von oben mit Sprung, Einschlag an der Spitze
  function defFinSmash() {
    const d: any = defQ(3, 10), s = F.anim.fin.s;
    d.ev = [[.52, () => { const p = tipPos(); impact(p, 4.5 * s, 7); hitTip('q', 10); }]];
    d.tick = u => { F.anim.lift = 1.6 * Math.sin(Math.PI * clamp((u - .1) / .42, 0, 1)); };
    d.end = () => { F.anim.lift = 0; };
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
  F.anim.lastPose = resolve(IDLE);
  function evalKeys(keys, u) {
    let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
    const [t0, p0] = keys[i], [t1, p1, e] = keys[i + 1];
    const k = (EASE[e] || inOut)(clamp((u - t0) / Math.max(1e-4, t1 - t0), 0, 1));
    return mix(resolve(p0), resolve(p1), k);
  }
  function cancel() { F.anim.act?.def.end?.(); F.anim.act = null; }
  function update(dt, anim: any = {}) {
    const s = dt > 1 ? dt / 1000 : dt;
    F.anim.T += s;
    const loco = anim.state || 'idle', ability = anim.ability || null;
    F.anim.qPal = anim.qPal ?? null; if (anim.fin) F.anim.fin = anim.fin;
    if (loco === 'dead' && F.anim.act) cancel();
    const key = ability ? `${ability}:${anim.seq ?? 0}` : '';
    if (key !== F.anim.actKey) {
      F.anim.actKey = key;
      if (F.anim.act?.def.hold) { cancel(); F.anim.blendFrom = F.anim.lastPose; F.anim.blendT = .15; }
      const def = key && loco !== 'dead' ? makeAction(ability) : null;
      if (def) {
        cancel();
        def.ev.sort((x, y) => x[0] - y[0]);
        F.anim.act = { def, t: 0, i: 0 };
        F.anim.blendFrom = F.anim.lastPose; F.anim.blendT = .1;
      }
    }
    if (loco !== F.anim.lastLoco) { F.anim.blendFrom = F.anim.lastPose; F.anim.blendT = .15; F.anim.lastLoco = loco; }
    let pose;
    if (F.anim.act) {
      const d = F.anim.act.def;
      if (!anim.frozen) F.anim.act.t += s * 1000 * (anim.rate ?? 1);
      const u = clamp(F.anim.act.t / d.dur, 0, 1);
      while (F.anim.act.i < d.ev.length && d.ev[F.anim.act.i][0] <= u) d.ev[F.anim.act.i++][1]();
      d.tick?.(u, anim.frozen ? 0 : s);
      pose = evalKeys(d.keys, u);
      if (d.walk && (loco === 'run' || loco === 'back')) {   // Schläge 1–3 gehen im Laufen
        F.anim.runPh += s * (anim.speed || 7) / .65 * (loco === 'back' ? -1 : 1);
        const r = runPose(F.anim.runPh);
        pose.y = r.y; pose.fL = r.fL; pose.fR = r.fR;
      }
      if (u >= 1 && !d.hold) { d.end?.(); F.anim.act = null; F.anim.blendFrom = pose; F.anim.blendT = .18; }
    } else if (loco === 'run' || loco === 'back') {
      if (!anim.frozen) F.anim.runPh += s * (anim.speed || 7) / .65 * (loco === 'back' ? -1 : 1);
      pose = resolve(runPose(F.anim.runPh));
      if (loco === 'run' && Math.random() < .5) emit(tipPos().setY(gy() + .05), 1, 1.5, 0x8f877a, 8, .5);
    } else if (loco === 'air') pose = resolve(P(IDLE, { y: .98, fL: [.25, .42, .2], fR: [-.25, .3, -.22] }));
    else if (loco === 'dead') pose = resolve(DEAD);
    else if (loco === 'sit') {
      pose = resolve(SIT);
      // Biss alle 2,4 s: Keule zum Mund, Kopf reißt zur Seite, dann kauen
      const k = (F.anim.T % 2.4) / 2.4, b = k < .4 ? Math.sin(Math.PI * k / .4) ** .7 : 0, tear = k > .22 && k < .4 ? Math.sin(Math.PI * (k - .22) / .18) : 0;
      const chew = k >= .4 ? Math.abs(Math.sin(F.anim.T * 14)) * .06 : 0;
      pose.hL = [lerp(.35, .08, b) + .12 * tear, lerp(.75, 1.25, b), lerp(.4, .28, b)];
      pose.n = [.1 + .2 * b + chew, -.5 * tear, .15 * tear];
      pose.c[0] = .2 + .2 * b;
      F.anim.eatK = { s: b, k };
    } else {
      pose = resolve(IDLE);
      // schweres Atmen: Brust hebt sich, Schultern mit
      const br = Math.sin(F.anim.T * 1.9);
      pose.y += .02 * br; pose.c[0] += .05 * br; pose.hR[1] += .03 * br; pose.n[0] -= .04 * br;
    }
    root.rotation.y += F.anim.spinAng;
    root.position.y += F.anim.lift;
    if (F.anim.blendT > 0 && F.anim.blendFrom) { F.anim.blendT -= s; pose = mix(F.anim.blendFrom, pose, 1 - clamp(F.anim.blendT / .15, 0, 1)); }
    F.anim.lastPose = pose;

    hips.position.y = pose.y; applyTuple(hips.rotation, pose.h); applyTuple(chest.rotation, pose.c); applyTuple(neck.rotation, pose.n);
    root.updateMatrixWorld(true);
    legIK(legL, pose.fL); legIK(legR, pose.fR);
    armIK(armR, pose.hR);
    root.updateMatrixWorld(true);
    placeSword(pose.b, pose.e);
    const g = gripL(); F.anim.lastGrip = g.toArray();
    armIK(armL, pose.hL.map((v, i) => lerp(v, F.anim.lastGrip[i], pose.g)));
    root.updateMatrixWorld(true);
    // Fleischkeule beim Essen, nur dann ein Draw Call mehr
    meat.visible = loco === 'sit' && !F.anim.act;
    if (meat.visible) {
      root.worldToLocal(armL.hand.getWorldPosition(meat.position));
      meat.quaternion.setFromUnitVectors(V(0, 1, 0), V(lerp(.3, -.7, F.anim.eatK.s), lerp(.85, .35, F.anim.eatK.s), lerp(.2, .1, F.anim.eatK.s)).normalize());
      if (F.anim.eatK.k > .3 && F.anim.eatK.k - s / 2.4 <= .3) emit(meat.getWorldPosition(V()).add(V(0, .1, 0)), 8, 1.5, 0x8a3b1c, 10, .5);
    }

    // Wut-Aura: Dicke und Deckkraft wachsen mit der Wut, ohne Wut kein Draw Call
    F.anim.rage = anim.rage ?? 0;
    F.anim.flare = Math.max(0, F.anim.flare - s * 1.2);
    const r = F.anim.rage / 100, I = clamp(r * r * .9 + F.anim.flare * .6, 0, 1.4);
    const IB = anim.berserk ? 1.4 : I;   // Berserker: Hülle voll
    AURA_E.userData.u.uInf.value = .025 + .07 * IB; AURA_E.userData.u.uK.value = clamp(IB * .45, 0, .62);
    aura.visible = auraRing.visible = (r > .05 || F.anim.flare > 0 || !!anim.berserk) && loco !== 'dead';
    auraRing.material.opacity = .45 * I; auraRing.position.set(root.position.x, gy() + .01, root.position.z); auraRing.scale.setScalar(1 + .6 * I + .05 * Math.sin(F.anim.T * 10));
    if (aura.visible && Math.random() < I * s * 40) emit(root.position.clone().add(V((Math.random() - .5) * .9, .3 + Math.random() * 1.6, (Math.random() - .5) * .9)), 1, .4, 0xe0141c, -2.5, .8);

    clothStep(s);
    lookTick(s, anim);
    updateFx(s); updateParts(s);
  }
  // Skin-Gags pro Frame (nur Optik)
  function lookTick(s, anim) {
    if (look === 'klapse') head.rotation.z = Math.sin(F.anim.T * 7) * .04 + (Math.sin(F.anim.T * .9) > .85 ? .25 : 0);   // ruckartiges Kopf-Zucken // PH
    // Holzfäller: Kerben, goldener Stiel, Sprössling, Scheite nach Kills im Run (anim.kills), nur bei Änderung
    if (look === 'holz' && (anim.kills ?? 0) !== F.anim.kills) {
      F.anim.kills = anim.kills ?? 0;
      for (let i = 0; i < HOLZ.notches; i++) showTag(lookW, `n${i}`, i < F.anim.kills);
      tintTag(lookW, 'wood', col(F.anim.kills >= HOLZ.gold ? 0xe8b23a : 0xd8a868));
      showTag(lookW, 'sprout', F.anim.kills >= HOLZ.sprout);
      const logs = Math.min(HOLZ.logs, Math.floor(F.anim.kills / HOLZ.perLog));
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
    talk: TALK.kind ? { ...TALK, anchor: head, get on() { return F.anim.lastLoco !== 'dead'; } } : null,
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
      F.anim.tipLen = tip * scale; F.anim.gripLen = grip * scale; F.anim.baseTip = F.anim.tipLen; F.anim.baseGrip = F.anim.gripLen;
      fitLook(F.anim.tipLen);
    },
    // Schlagfolge Version E: Schwert wächst pro Stufe (Größe und Treffer-Spitze)
    setBladeScale(k) { sword.scale.setScalar(k); F.anim.tipLen = F.anim.baseTip * k; F.anim.gripLen = F.anim.baseGrip * k; },
    // Neue Stufe: goldene Kugel an der Spitze + Ring, Aura flammt auf
    flareTip() {
      F.anim.flare = 1.5;
      efx(.7, (k, _d, e) => { if (!e.ms.length) em(e, 'sph', PAL.donner, { sc: 3, core: .8, flow: [0, 3, 0], puff: .05 }); e.ms[0].position.copy(tipPos()); e.ms[0].scale.setScalar(.3 + 1.6 * outC(k)); setK(e.ms[0], 1 - k); });
      ring(root.position, 0, 5, .7, .2, PAL.donner);
    },
  };
  return model;
}
