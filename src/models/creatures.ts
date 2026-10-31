// Baukasten für Mob-Rigs: gleiche Schnittstelle wie boar.ts, { root, update(dt, anim) }.
// anim = { state: 'idle'|'run'|'dead', speed, frozen, slowed, attack, flash }

import * as THREE from 'three';
import { rand, lerpTo, part, joint, mergeByJoint } from '../util';

const cache = new Map();
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const Box = (w, h, d) => memo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const Cyl = (r1, r2, h) => memo(`c${r1},${r2},${h}`, () => new THREE.CylinderGeometry(r1, r2, h, 6));
const Cone = (r, h) => memo(`n${r},${h}`, () => new THREE.ConeGeometry(r, h, 5));
const Ball = r => memo(`s${r}`, () => new THREE.SphereGeometry(r, 8, 6));
const iceMat = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.5, emissive: 0x2a5070 });
export const glowMat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });   // > 1 → Bloom

const SLOW = new THREE.Color(0x6f7fa0), DEAD = new THREE.Color(0x5a5048);

// Gemeinsam: Materialien pro Mob, Eisblock, Treffer-Blitz, Slow- und Todesfarbe
function kit() {
  const mats = [];
  const M = c => { const m = new THREE.MeshLambertMaterial({ color: c }); (m as any).base = new THREE.Color(c); mats.push(m); return m; };
  return { M, mats };
}
function finish(root, mats, tick, level, scale, ice = [1.5, 2.2, 1.5], iceY = 1) {
  const iceMesh = new THREE.Mesh(Box(ice[0], ice[1], ice[2]), iceMat);
  iceMesh.position.y = iceY;
  iceMesh.visible = false;
  mergeByJoint(root, iceMesh);
  root.add(iceMesh);
  const lv = 0.9 + (level - 18) * 0.02;
  root.scale.set(scale[0] * lv, scale[1] * lv, scale[2] * lv);
  return {
    root,
    update(dt, a) {
      iceMesh.visible = !!a.frozen;
      for (const m of mats) {
        m.color.copy(a.state === 'dead' ? DEAD : a.slowed ? SLOW : m.base);
        m.emissive.setScalar(a.flash * 0.9);
      }
      if (!a.frozen) tick(dt, a);
    },
  };
}
const ease = (j, t, k) => { for (const key in j) j[key] = lerpTo(j[key], t[key] ?? j[key], k); };

function weapon(kind, parent, M, glow) {
  const g = joint(parent, 0, -0.42, 0.05);
  g.rotation.x = -1.3;
  const wood = M(0x4a3218), metal = M(0x8f9299);
  if (kind === 'sword') { g.add(part(Box(0.07, 0.95, 0.025), metal, 0, 0.55, 0)); g.add(part(Box(0.24, 0.05, 0.06), wood, 0, 0.08, 0)); }
  if (kind === 'axe') { g.add(part(Cyl(0.025, 0.025, 0.85), wood, 0, 0.3, 0)); g.add(part(Box(0.04, 0.3, 0.32), metal, 0, 0.62, 0.1)); }
  if (kind === 'pick') { g.add(part(Cyl(0.025, 0.025, 0.85), wood, 0, 0.3, 0)); const h = part(Cone(0.05, 0.6), metal, 0, 0.7, 0); h.rotation.x = Math.PI / 2; g.add(h); }
  if (kind === 'hammer') { g.add(part(Cyl(0.03, 0.03, 0.95), wood, 0, 0.35, 0)); g.add(part(Box(0.24, 0.24, 0.4), metal, 0, 0.8, 0)); }
  if (kind === 'club') { g.add(part(Cyl(0.13, 0.05, 1.1), wood, 0, 0.45, 0)); }
  if (kind === 'staff') { g.add(part(Cyl(0.025, 0.03, 1.8), wood, 0, 0.35, 0)); g.add(part(Ball(0.09), glow, 0, 1.3, 0)); }
}

// Zweibeiner. o: skin, body, trim, bones, robe, hood, helm, beard, tusks, mohawk, mask, shield, weapon, eye, scale
export const humanoid = o => level => {
  const { M, mats } = kit();
  const skin = M(o.skin), body = M(o.body ?? o.skin), trim = M(o.trim ?? 0x2a2622);
  const eye = o.eye ?? glowMat(1.6, 0.4, 0.2);
  const root = new THREE.Group();
  const hips = joint(root, 0, 0.95, 0);
  const torso = joint(hips, 0, 0.04, 0);
  const limb = o.bones ? 0.038 : 0.08;
  if (o.bones) {
    hips.add(part(Box(0.34, 0.1, 0.16), skin));
    torso.add(part(Cyl(0.035, 0.035, 0.62), skin, 0, 0.32, -0.05));
    for (let i = 0; i < 3; i++) torso.add(part(Box(0.42 - i * 0.04 * (i - 1), 0.04, 0.2), skin, 0, 0.3 + i * 0.13, 0));
    torso.add(part(Box(0.56, 0.05, 0.1), skin, 0, 0.62, 0));
  } else {
    hips.add(part(Box(0.42, 0.18, 0.26), trim));
    torso.add(part(Box(0.54, 0.64, 0.3), body, 0, 0.34, 0));
    torso.add(part(Box(0.6, 0.1, 0.34), trim, 0, 0.62, 0));
  }
  if (o.robe) hips.add(part(Cone(0.46, 1.0), body, 0, -0.42, 0));
  if (o.tabard) torso.add(part(Box(0.3, 0.8, 0.32), M(o.tabard), 0, 0.14, 0));

  const head = joint(torso, 0, 0.68, 0.02);
  head.add(part(Ball(o.bones ? 0.17 : 0.19), skin, 0, 0.15, 0));
  for (const sx of [-0.07, 0.07]) head.add(part(Ball(0.028), eye, sx, 0.17, 0.15));
  if (o.hood) { head.add(part(Cone(0.27, 0.5), body, 0, 0.27, -0.03)); head.add(part(Ball(0.23), body, 0, 0.14, -0.05)); }
  if (o.helm) { head.add(part(Ball(0.21), M(o.helm), 0, 0.2, -0.01)); head.add(part(Box(0.05, 0.24, 0.05), M(o.helm), 0, 0.12, 0.2)); }
  if (o.beard) head.add(part(Cone(0.17, 0.42), M(o.beard), 0, -0.1, 0.1)).rotation.x = Math.PI;
  if (o.tusks) for (const sx of [-0.09, 0.09]) head.add(part(Cone(0.03, 0.17), M(0xf2ecd8), sx, 0.08, 0.17));
  if (o.mohawk) head.add(part(Box(0.05, 0.2, 0.34), M(o.mohawk), 0, 0.36, -0.02));
  if (o.mask) head.add(part(Box(0.3, 0.36, 0.05), M(o.mask), 0, 0.14, 0.18));

  const arm = side => {
    const shoulder = joint(torso, side * 0.33, 0.58, 0);
    shoulder.add(part(Cyl(limb, limb * 0.85, 0.42), o.sleeve ? M(o.sleeve) : skin, 0, -0.2, 0));
    const elbow = joint(shoulder, 0, -0.42, 0);
    elbow.add(part(Cyl(limb * 0.85, limb * 0.7, 0.38), skin, 0, -0.19, 0));
    elbow.add(part(Ball(limb * 1.1), skin, 0, -0.4, 0));
    return { shoulder, elbow };
  };
  const armL = arm(1), armR = arm(-1);
  if (o.weapon) weapon(o.weapon, armR.elbow, M, o.glow ?? glowMat(0.8, 0.4, 1.8));
  if (o.shield) { const s = part(Cyl(0.3, 0.3, 0.05), M(o.shield), 0.05, -0.25, 0.04); s.rotation.z = Math.PI / 2; armL.elbow.add(s); }

  const leg = side => {
    const hip = joint(hips, side * 0.14, -0.02, 0);
    hip.add(part(Cyl(limb * 1.15, limb, 0.46), o.bones ? skin : trim, 0, -0.23, 0));
    const knee = joint(hip, 0, -0.46, 0);
    knee.add(part(Cyl(limb, limb * 0.8, 0.42), skin, 0, -0.21, 0));
    knee.add(part(Box(0.13, 0.06, 0.28), o.bones ? skin : trim, 0, -0.43, 0.07));
    return { hip, knee };
  };
  const legL = leg(1), legR = leg(-1);

  let phase = rand(0, 6);
  const j = { y: 0.95, bodyX: 0, lean: 0, lH: 0, rH: 0, lK: 0, rK: 0, lS: 0, rS: 0, lE: -0.2, rE: -0.5, head: 0 };
  return finish(root, mats, (dt, a) => {
    const s = dt / 1000;
    const t: any = { y: 0.95, bodyX: 0, lean: o.lean ?? 0.05, lH: 0, rH: 0, lK: 0, rK: 0, lS: 0.05, rS: -0.1, lE: -0.2, rE: -0.6, head: 0 };
    if (a.state === 'run') {
      phase += s * a.speed * 1.5;
      const sw = Math.sin(phase);
      t.lH = -sw * 0.8; t.rH = sw * 0.8;
      t.lK = Math.max(0, Math.cos(phase)) * 1.1; t.rK = Math.max(0, -Math.cos(phase)) * 1.1;
      t.lS = sw * 0.6; t.rS = -sw * 0.35 - 0.3; t.lean = (o.lean ?? 0.05) + 0.14;
      t.y = 0.93 + Math.abs(Math.cos(phase)) * 0.05;
    } else if (a.state === 'idle') {
      phase += s * 1.5;
      t.y = 0.95 + Math.sin(phase) * 0.01; t.head = Math.sin(phase * 0.5) * 0.1;
    } else if (a.state === 'dead') {
      t.bodyX = -Math.PI / 2; t.y = 0.22; t.lS = -0.3; t.rS = 0.3;
    }
    if (a.attack > 0) { const v = Math.sin(a.attack * Math.PI); t.rS = -2.3 * v; t.rE = -0.4; t.lean = 0.3 * v; }
    ease(j, t, Math.min(1, s * 14));
    hips.position.y = j.y; hips.rotation.x = j.bodyX; torso.rotation.x = j.lean; head.rotation.x = j.head - j.lean * 0.6;
    legL.hip.rotation.x = j.lH; legR.hip.rotation.x = j.rH; legL.knee.rotation.x = j.lK; legR.knee.rotation.x = j.rK;
    armL.shoulder.rotation.x = j.lS; armR.shoulder.rotation.x = j.rS; armL.elbow.rotation.x = j.lE; armR.elbow.rotation.x = j.rE;
    armL.shoulder.rotation.z = 0.1; armR.shoulder.rotation.z = -0.1;
  }, level, o.scale ?? [1, 1, 1]);
};

// Vierbeiner. o: coat, mane, ribs, eye, scale, snout, tailLen, ears, hump
export const quadruped = o => level => {
  const { M, mats } = kit();
  const coat = M(o.coat), dark = M(o.dark ?? 0x1a1612), tooth = M(0xe8e2cc);
  const eye = o.eye ?? new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const root = new THREE.Group();
  const body = joint(root, 0, 0.72, 0);
  body.add(part(Box(0.56, 0.5, 1.25), coat));
  body.add(part(Box(0.6, 0.56, 0.5), o.hump ? dark : coat, 0, o.hump ? 0.12 : 0.03, 0.42));
  if (o.ribs) for (const z of [-0.2, 0, 0.2]) body.add(part(Box(0.6, 0.06, 0.06), tooth, 0, 0.05, z));
  if (o.stripes) for (const z of [-0.4, -0.15, 0.1, 0.35]) body.add(part(Box(0.58, 0.52, 0.07), dark, 0, 0, z));
  const neck = joint(body, 0, 0.12, 0.6);
  neck.add(part(Box(0.36, 0.34, 0.45), coat, 0, 0.08, 0.2));
  neck.add(part(Box(0.22, 0.16, o.snout ?? 0.34), dark, 0, 0.02, 0.5));
  for (const sx of [-0.13, 0.13]) {
    neck.add(part(Ball(0.04), eye, sx, 0.17, 0.38));
    neck.add(part(Cone(0.07, o.ears ?? 0.2), coat, sx, 0.34, 0.08));
  }
  const jaw = joint(neck, 0, -0.08, 0.3);
  jaw.add(part(Box(0.18, 0.06, 0.32), tooth, 0, 0, 0.14));
  const tail = joint(body, 0, 0.14, -0.62);
  const tailMesh = part(Cyl(0.05, 0.02, o.tailLen ?? 0.65), dark, 0, 0, -(o.tailLen ?? 0.65) / 2);
  tailMesh.rotation.x = Math.PI / 2;
  tail.add(tailMesh);
  const legs = [[-0.21, 0.42], [0.21, 0.42], [-0.21, -0.45], [0.21, -0.45]].map(([x, z]) => {
    const hip = joint(body, x, -0.2, z);
    hip.add(part(Box(0.15, 0.32, 0.17), coat, 0, -0.13, 0));
    const knee = joint(hip, 0, -0.28, 0);
    knee.add(part(Box(0.09, 0.27, 0.1), dark, 0, -0.12, 0));
    return { hip, knee };
  });
  let phase = rand(0, 6);
  const j = { y: 0.72, legs: 0, knee: 0, neck: 0, jaw: 0.05, roll: 0, tail: 0 };
  return finish(root, mats, (dt, a) => {
    const s = dt / 1000;
    const t: any = { y: 0.72, legs: 0, knee: 0, neck: 0, jaw: 0.05, roll: 0, tail: Math.sin(performance.now() / 300) * 0.3 };
    if (a.state === 'run') {
      phase += s * a.speed * 2.1;
      t.legs = Math.sin(phase) * 0.8; t.knee = Math.cos(phase) * 0.6;
      t.y = 0.72 + Math.abs(Math.cos(phase)) * 0.07; t.neck = Math.sin(phase * 2) * 0.06;
    } else if (a.state === 'idle') {
      phase += s * 1.1;
      t.neck = 0.18 + Math.sin(phase) * 0.08;
    } else if (a.state === 'dead') {
      t.roll = Math.PI / 2; t.y = 0.36; t.tail = 0;
    }
    if (a.attack > 0) { const v = Math.sin(a.attack * Math.PI); t.neck = 0.45 * v; t.jaw = 0.8 * v; }
    ease(j, t, Math.min(1, s * 14));
    legs[0].hip.rotation.x = legs[3].hip.rotation.x = j.legs;
    legs[1].hip.rotation.x = legs[2].hip.rotation.x = -j.legs;
    legs[0].knee.rotation.x = legs[3].knee.rotation.x = Math.max(0, j.knee);
    legs[1].knee.rotation.x = legs[2].knee.rotation.x = Math.max(0, -j.knee);
    neck.rotation.x = j.neck; jaw.rotation.x = j.jaw; body.position.y = j.y; body.rotation.z = j.roll; tail.rotation.y = j.tail;
  }, level, o.scale ?? [1, 1, 1], [1.2, 1.5, 2.2], 0.75);
};

// Fledermaus: schwebt, zwei Flügel mit Gelenk
export const bat = o => level => {
  const { M, mats } = kit();
  const fur = M(o.fur), wingMat = M(o.wing);
  wingMat.side = THREE.DoubleSide;
  const eye = glowMat(2.4, 0.3, 0.3);
  const root = new THREE.Group();
  const body = joint(root, 0, 1.6, 0);
  body.add(part(Ball(0.3), fur));
  body.add(part(Box(0.3, 0.3, 0.3), fur, 0, 0.24, 0.16));
  for (const sx of [-0.1, 0.1]) { body.add(part(Cone(0.08, 0.3), fur, sx, 0.5, 0.14)); body.add(part(Ball(0.035), eye, sx, 0.28, 0.32)); }
  const wing = side => {
    const inner = joint(body, side * 0.22, 0.05, 0);
    inner.add(part(Box(0.62, 0.03, 0.55), wingMat, side * 0.32, 0, 0));
    const outer = joint(inner, side * 0.62, 0, 0);
    outer.add(part(Box(0.6, 0.03, 0.42), wingMat, side * 0.3, 0, -0.03));
    return { inner, outer };
  };
  const wL = wing(1), wR = wing(-1);
  let phase = rand(0, 6);
  const j = { y: 1.6, roll: 0, pitch: 0.2 };
  return finish(root, mats, (dt, a) => {
    const s = dt / 1000;
    const dead = a.state === 'dead';
    if (!dead) phase += s * (a.state === 'run' ? 22 : 15);
    const flap = dead ? -0.3 : Math.sin(phase) * 0.75;
    const t = { y: dead ? 0.3 : 1.6 + Math.sin(phase * 0.2) * 0.12, roll: dead ? 1.3 : 0, pitch: a.attack > 0 ? 0.2 + Math.sin(a.attack * Math.PI) * 0.8 : 0.2 };
    ease(j, t, Math.min(1, s * 10));
    body.position.y = j.y; body.rotation.z = j.roll; body.rotation.x = j.pitch;
    wL.inner.rotation.z = flap; wR.inner.rotation.z = -flap;
    wL.outer.rotation.z = flap * 0.6; wR.outer.rotation.z = -flap * 0.6;
  }, level, o.scale ?? [1, 1, 1], [1.6, 1.2, 1.2], 1.6);
};
