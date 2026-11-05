// Baukasten für Mob-Rigs: Schnittstelle { root, update(dt, anim) }.
// anim = { state: 'idle'|'run'|'dead', speed, frozen, slowed, attack, flash }

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand, lerpTo, part, joint, mergeByJoint } from '../util';

const cache = new Map();
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const Box = (w, h, d) => memo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const Cyl = (r1, r2, h) => memo(`c${r1},${r2},${h}`, () => new THREE.CylinderGeometry(r1, r2, h, 6));
const Cone = (r, h) => memo(`n${r},${h}`, () => new THREE.ConeGeometry(r, h, 5));
const Ball = r => memo(`s${r}`, () => new THREE.SphereGeometry(r, 8, 6));
const SLOW = new THREE.Color(0x6f7fa0), DEAD = new THREE.Color(0x5a5048);
const TINTS = [null, SLOW, DEAD], FLASH_STEPS = 4;
const CHAMP_GLOW = new THREE.Color(0.16, 0.3, 0.55);   // PH
const GLOW = { true: CHAMP_GLOW, boss: new THREE.Color(0.45, 0.06, 0.03), boss2: new THREE.Color(0.8, 0.16, 0.06) };   // PH: Boss rot, Phase 2 heller (boss.ts)

// Materialien sind geteilt, removeMob darf sie nicht freigeben
const shared = (key, make) => memo(`m${key}`, () => { const m = make(); m.dispose = () => {}; return m; });
const iceMat = shared('ice', () => new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.5, emissive: 0x2a5070 }));
export const glowMat = (r, g, b) => shared(`g${r},${g},${b}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) }));   // > 1 → Bloom
const darkEye = shared('eye', () => new THREE.MeshBasicMaterial({ color: 0x0a0806 }));

// Normal zeigt Vertex-Farben; Slow und Tod färben den ganzen Mob einheitlich. Der Treffer-Blitz läuft in FLASH_STEPS Stufen
// champ: blau-weißes Leuchten der Champion-Packs (champions.ts), 'boss' und 'boss2' rot (boss.ts)
function litMat(tint, flash, side, champ = false) {
  return shared(`l${tint},${flash},${side},${champ}`, () => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: tint === 0, side });
    if (tint) m.color.copy(TINTS[tint]);
    m.emissive.setScalar(flash / FLASH_STEPS * 0.9);
    if (champ) m.emissive.add(GLOW[String(champ)]);
    return m;
  });
}

// Bauteil-Farbe: nur Träger für Farbe und Seite, wird in bake() zur Vertex-Farbe und nie gerendert
export const M = c => { const m = new THREE.MeshLambertMaterial({ color: c }); (m as any).partColor = true; return m; };

// Pro Gelenk alle farbigen Teile zu einem Mesh verschmelzen
function bake(root) {
  const joints = [], lit = [];
  root.traverse(o => { if (o.isGroup) joints.push(o); });
  for (const g of joints) {
    const bySide = new Map();
    for (const m of g.children) {
      if (!m.isMesh || !m.material.partColor) continue;
      if (!bySide.has(m.material.side)) bySide.set(m.material.side, []);
      bySide.get(m.material.side).push(m);
    }
    for (const [side, meshes] of bySide) {
      const geos = meshes.map(m => {
        m.updateMatrix();
        const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
        const n = geo.attributes.position.count, col = new Float32Array(n * 3), { r, g: gr, b } = m.material.color;
        for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gr; col[i * 3 + 2] = b; }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return geo;
      });
      g.remove(...meshes);
      const merged = new THREE.Mesh(mergeGeometries(geos), litMat(0, 0, side));
      g.add(merged);
      lit.push(merged);
    }
  }
  mergeByJoint(root, null);   // Leuchtteile (geteiltes Material) pro Gelenk
  return lit;
}

// Ein Mob = wenige Draw Calls: alle Gelenk-Meshes werden zu einem SkinnedMesh pro Material (Vertex-Farben, Leuchtteile, doppelseitige Flügel).
// Die Gelenk-Gruppen bleiben und dienen als Knochen: der Animations-Code dreht sie wie bisher, die GPU verformt das Mesh.
const SKIN_KEEP = ['position', 'normal', 'color'];
function skin(root, lit) {
  root.updateMatrixWorld(true);
  const bones = [];
  root.traverse(o => { if (o.isGroup) bones.push(o); });
  const groups = new Map();                          // Material-Schlüssel → { mat, lit, meshes }
  for (const g of bones) for (const m of g.children) {
    if (!m.isMesh) continue;
    const isLit = lit.includes(m), key = isLit ? `lit${m.material.side}` : m.material;
    if (!groups.has(key)) groups.set(key, { mat: m.material, lit: isLit, meshes: [] });
    groups.get(key).meshes.push(m);
  }
  const skeleton = new THREE.Skeleton(bones as any), out = [];
  for (const { mat, lit: isLit, meshes } of groups.values()) {
    const geos = meshes.map(m => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!SKIN_KEEP.includes(name)) g.deleteAttribute(name);
      if (!isLit) g.deleteAttribute('color');
      g = g.applyMatrix4(m.matrixWorld);
      const n = g.attributes.position.count, bi = bones.indexOf(m.parent);
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      return g;
    });
    const cached = new Set(cache.values());          // Grundformen aus memo() sind geteilt und bleiben
    for (const m of meshes) { m.parent.remove(m); if (!cached.has(m.geometry)) m.geometry.dispose(); }
    const sm = new THREE.SkinnedMesh(mergeGeometries(geos), mat);
    root.add(sm);
    sm.bind(skeleton, sm.matrixWorld);
    // Feste, großzügige Hülle statt Neuberechnung aus der Pose (Tod, Sprung, Angriff bleiben drin)
    sm.geometry.computeBoundingSphere();
    sm.boundingSphere = sm.geometry.boundingSphere.clone();
    sm.boundingSphere.radius *= 1.6;
    if (isLit) out.push(sm);
  }
  return out;
}

// Gemeinsam: Eisblock, Treffer-Blitz, Slow- und Todesfarbe
export function finish(root, tick, level, scale, ice = [1.5, 2.2, 1.5], iceY = 1) {
  const lit = skin(root, bake(root));
  const iceMesh = new THREE.Mesh(Box(ice[0], ice[1], ice[2]), iceMat);
  iceMesh.position.y = iceY;
  iceMesh.visible = false;
  root.add(iceMesh);
  const lv = 0.9 + (level - 18) * 0.02;
  root.scale.set(scale[0] * lv, scale[1] * lv, scale[2] * lv);
  let shown = '0,0';
  return {
    root,
    update(dt, a) {
      iceMesh.visible = !!a.frozen;
      const tint = a.state === 'dead' ? 2 : a.slowed ? 1 : 0, flash = Math.ceil(a.flash * FLASH_STEPS), key = `${tint},${flash},${a.champion || false}`;
      if (key !== shown) {
        shown = key;
        for (const m of lit) m.material = litMat(tint, flash, m.material.side, a.champion || false);
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
  return finish(root, (dt, a) => {
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
  const coat = M(o.coat), dark = M(o.dark ?? 0x1a1612), tooth = M(0xe8e2cc);
  const eye = o.eye ?? darkEye;
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
  return finish(root, (dt, a) => {
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
  return finish(root, (dt, a) => {
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

// Raptor: Körper waagerecht, Kopf mit Kiefer, Schwanz in Gliedern. o: skin, stripe, tail (Anzahl Glieder), scale
export const raptor = o => level => {
  const skin = M(o.skin), stripe = M(o.stripe), belly = M(o.belly ?? 0xc8b98a), tooth = M(0xe8e2cc);
  const eye = glowMat(1.8, 1.2, 0.2);
  const root = new THREE.Group();
  const body = joint(root, 0, 1.02, 0);
  body.add(part(Box(0.46, 0.5, 1.15), skin));
  body.add(part(Box(0.4, 0.14, 0.95), belly, 0, -0.26, 0));
  for (const z of [-0.35, 0, 0.35]) body.add(part(Box(0.48, 0.3, 0.1), stripe, 0, 0.13, z));
  const neck = joint(body, 0, 0.12, 0.55);
  const neckMesh = part(Box(0.26, 0.26, 0.55), skin, 0, 0.14, 0.2);
  neckMesh.rotation.x = -0.6;
  neck.add(neckMesh);
  const head = joint(neck, 0, 0.32, 0.42);
  head.add(part(Box(0.27, 0.22, 0.56), skin, 0, 0.02, 0.22));
  for (const sx of [-0.13, 0.13]) head.add(part(Ball(0.04), eye, sx, 0.1, 0.18));
  head.add(part(Box(0.05, 0.14, 0.4), stripe, 0, 0.17, 0.05));
  const jaw = joint(head, 0, -0.09, 0.05);
  jaw.add(part(Box(0.22, 0.07, 0.48), belly, 0, 0, 0.22));
  for (const sx of [-0.08, 0.08]) { const t = part(Cone(0.025, 0.09), tooth, sx, 0.06, 0.38); jaw.add(t); }
  const tail = [];
  let parent = body, off = -0.55;
  const n = o.tail ?? 3;
  for (let i = 0; i < n; i++) {
    const g = joint(parent, 0, i ? 0 : 0.08, off);
    const w = 0.3 * (1 - i / (n + 0.5));
    g.add(part(Box(w, w * 0.9, 0.5), i % 2 ? stripe : skin, 0, 0, -0.25));
    tail.push(g);
    parent = g; off = -0.48;
  }
  for (const side of [1, -1]) { const a = part(Box(0.06, 0.28, 0.06), skin, side * 0.25, -0.2, 0.42); a.rotation.x = -0.8; body.add(a); }
  const leg = side => {
    const hip = joint(body, side * 0.27, -0.05, -0.1);
    hip.add(part(Box(0.2, 0.52, 0.28), skin, 0, -0.22, 0.02));
    const knee = joint(hip, 0, -0.45, 0.06);
    knee.add(part(Box(0.1, 0.42, 0.11), stripe, 0, -0.2, 0));
    const foot = joint(knee, 0, -0.43, 0);
    foot.add(part(Box(0.16, 0.05, 0.34), belly, 0, -0.1, 0.1));
    return { hip, knee, foot };
  };
  const lL = leg(1), lR = leg(-1);
  let phase = rand(0, 6);
  const j = { y: 1.02, lH: 0.35, rH: 0.35, lK: -0.75, rK: -0.75, neck: 0, jaw: 0.05, roll: 0, tail: 0, pitch: 0 };
  return finish(root, (dt, a) => {
    const s = dt / 1000;
    const t: any = { y: 1.02, lH: 0.35, rH: 0.35, lK: -0.75, rK: -0.75, neck: 0, jaw: 0.05, roll: 0, pitch: 0, tail: Math.sin(performance.now() / 500) * 0.2 };
    if (a.state === 'run') {
      phase += s * a.speed * 2.1;
      const sw = Math.sin(phase);
      t.lH = 0.35 - sw * 0.75; t.rH = 0.35 + sw * 0.75;
      t.lK = -0.75 - Math.max(0, Math.cos(phase)) * 0.7; t.rK = -0.75 - Math.max(0, -Math.cos(phase)) * 0.7;
      t.y = 1.0 + Math.abs(Math.cos(phase)) * 0.09; t.pitch = 0.08; t.tail = sw * 0.3; t.neck = Math.sin(phase * 2) * 0.07;
    } else if (a.state === 'idle') {
      phase += s * 1.3;
      t.neck = Math.sin(phase) * 0.1; t.y = 1.02 + Math.sin(phase * 2) * 0.01;
    } else if (a.state === 'dead') {
      t.roll = Math.PI / 2; t.y = 0.3; t.tail = 0;
    }
    if (a.attack > 0) { const v = Math.sin(a.attack * Math.PI); t.neck = 0.55 * v; t.jaw = 0.8 * v; t.pitch = 0.2 * v; }
    ease(j, t, Math.min(1, s * 14));
    body.position.y = j.y; body.rotation.z = j.roll; body.rotation.x = j.pitch;
    neck.rotation.x = j.neck; jaw.rotation.x = j.jaw;
    for (const g of tail) g.rotation.y = j.tail;
    lL.hip.rotation.x = j.lH; lR.hip.rotation.x = j.rH; lL.knee.rotation.x = -j.lK; lR.knee.rotation.x = -j.rK;
    lL.hip.rotation.x -= 0.0;
    lL.foot.rotation.x = j.lK * 0.5 - j.lH * 0.4; lR.foot.rotation.x = j.rK * 0.5 - j.rH * 0.4;
  }, level, o.scale ?? [1, 1, 1], [1.2, 2.1, 2.6], 1);
};

// Insekt: Segmente, sechs Beine, Beißzangen. o: shell, dark, tail (Skorpion-Stachel), pincers, scale
export const bug = o => level => {
  const shell = M(o.shell), dark = M(o.dark);
  const eye = glowMat(2, 0.5, 0.3);
  const root = new THREE.Group();
  const body = joint(root, 0, 0.55, 0);
  const seg = (r, z, sy = 0.65, sz = 1.15) => { const m = part(Ball(r), shell, 0, 0, z); m.scale.set(1, sy, sz); body.add(m); };
  seg(0.36, 0.05); seg(0.32, -0.45); seg(0.25, -0.82);
  for (const z of [-0.25, 0.25]) body.add(part(Box(0.5, 0.04, 0.07), dark, 0, 0.21, z - 0.05));
  const head = joint(body, 0, 0.03, 0.42);
  const hm = part(Ball(0.22), dark, 0, 0, 0.12); hm.scale.set(1.1, 0.75, 1); head.add(hm);
  for (const sx of [-0.11, 0.11]) {
    head.add(part(Ball(0.04), eye, sx, 0.07, 0.25));
    const man = part(Cone(0.04, 0.28), dark, sx * 0.7, -0.04, 0.38); man.rotation.x = Math.PI / 2; man.rotation.z = -sx * 2; head.add(man);
  }
  const legs = [];
  for (const side of [1, -1]) for (const z of [0.25, -0.1, -0.45]) {
    const hip = joint(body, side * 0.26, -0.03, z);
    hip.rotation.z = side * 1.1;
    hip.add(part(Cyl(0.035, 0.03, 0.45), dark, 0, -0.2, 0));
    const knee = joint(hip, 0, -0.42, 0);
    knee.rotation.z = -side * 1.15;
    knee.add(part(Cone(0.03, 0.42), dark, 0, -0.2, 0)).rotation.x = Math.PI;
    legs.push(hip);
  }
  const claws = [];
  if (o.pincers) for (const side of [1, -1]) {
    const arm = joint(body, side * 0.28, 0, 0.3);
    arm.rotation.y = side * 0.45;
    const a = part(Box(0.08, 0.08, 0.55), dark, 0, 0, 0.27); arm.add(a);
    arm.add(part(Box(0.2, 0.13, 0.28), shell, 0, 0, 0.6));
    arm.add(part(Cone(0.05, 0.28), shell, side * 0.07, 0, 0.82)).rotation.x = Math.PI / 2;
    arm.add(part(Cone(0.05, 0.28), shell, -side * 0.07, 0, 0.82)).rotation.x = Math.PI / 2;
    claws.push(arm);
  }
  const tail = [];
  if (o.tail) {
    let parent = body, y = 0.04, z = -1;
    for (let i = 0; i < 4; i++) {
      const g = joint(parent, 0, y, z);
      g.rotation.x = -0.55;
      g.add(part(Ball(0.14 - i * 0.015), i % 2 ? dark : shell, 0, 0.12, 0));
      tail.push(g);
      parent = g; y = 0.22; z = 0;
    }
    const stinger = joint(parent, 0, 0.22, 0);
    stinger.add(part(Cone(0.06, 0.28), glowMat(1.5, 1.8, 0.3), 0, 0.1, 0.05));
    tail.push(stinger);
  }
  let phase = rand(0, 6);
  const j = { y: 0.55, roll: 0, head: 0, strike: 0, leg: 0 };
  return finish(root, (dt, a) => {
    const s = dt / 1000;
    const t: any = { y: 0.55, roll: 0, head: 0, strike: 0, leg: 0 };
    if (a.state === 'run') { phase += s * a.speed * 4; t.leg = 1; t.y = 0.56; }
    else if (a.state === 'idle') { phase += s * 1.2; t.head = Math.sin(phase) * 0.12; }
    else if (a.state === 'dead') { t.roll = Math.PI; t.y = 0.32; }
    if (a.attack > 0) { const v = Math.sin(a.attack * Math.PI); t.head = 0.35 * v; t.strike = v; }
    ease(j, t, Math.min(1, s * 14));
    body.position.y = j.y; body.rotation.z = j.roll; head.rotation.x = j.head;
    legs.forEach((l, i) => { l.rotation.x = Math.sin(phase + i * 2.1) * 0.5 * j.leg; });
    claws.forEach((c, i) => { c.rotation.x = -0.15 - j.strike * 0.3 + Math.sin(phase * 0.5 + i) * 0.06; });
    tail.forEach((g, i) => { if (i < 4) g.rotation.x = -0.55 + j.strike * (i === 0 ? 0.9 : 0.25); });
  }, level, o.scale ?? [1, 1, 1], [1.3, 1.3, 2.3], 0.6);
};
