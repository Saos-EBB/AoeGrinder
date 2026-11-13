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
import { STRICH_TIMING } from './strichKrieger/timing';
import { EASE, mix, KEYS, IDLE, SIT, DEAD, P, runPose } from './strichKrieger/poses';
import { makeAction } from './strichKrieger/actions';
import { WEAPON_SHAPE, swordGeo, axeGeo, maceGeo, maceGlowGeo, lookWeapon } from './strichKrieger/weapons';
export type { Fig, WarAnim } from './strichKrieger/fig';

// Dauern: strichKrieger/timing.ts (realMen.ts liest sie hier)
export { STRICH_TIMING } from './strichKrieger/timing';

const L1 = .5, L2 = .48, A1 = .35, A2 = .33;

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
Object.assign(F, { weapon, fxGroup, gy, root, hips, chest, neck, head, armL, armR, legL, legR, clothAnchor, bp: { pHips, pChest, pNeck, pHead, pBelt } });
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
F.fx = buildWarFx(F, cloth0);
const { auraRing, cloth, clothStep, ring, crack, ghost, updateFx, emit, updateParts } = F.fx;
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
F.tipPos = tipPos;
  F.anim.lastGrip = [.2, 1.2, .3];
  function resolve(p) {
    const o: any = {};
    for (const k of KEYS) { const v = p[k]; o[k] = Array.isArray(v) ? v.slice() : v; }
    if (p.hL === 'G') { o.hL = F.anim.lastGrip.slice(); o.g = 1; } else o.g = 0;
    return o;
  }
  // Treffer-Moment an der Schwertspitze
  F.hitTip = (kind, i = 0) => { const p = tipPos(); model.onHit?.(kind, p.x, p.z, i); };
  F.hitRoot = (kind, i = 0) => model.onHit?.(kind, root.position.x, root.position.z, i);
  const doAction = ability => makeAction(F, W, ability);   // Moves: strichKrieger/actions.ts
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
      const def = key && loco !== 'dead' ? doAction(ability) : null;
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
