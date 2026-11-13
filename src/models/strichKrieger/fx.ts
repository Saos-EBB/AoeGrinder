// Effekte des Strichkriegers (KOMP-04): Wut-Ring, Stoffbahn, Sicheln, Bodenringe, Risse, Geister, Partikel, Wirbel-Sicheln, Einschlag.
// Aus strichKrieger.ts herausgezogen, Werte und Reihenfolge der Math.random-Aufrufe unverändert.
import * as THREE from 'three';
import { outC, V } from '../../util';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { eMat, PAL, fx as efx, em, uK as setK, arc as eArc, ring as eRing } from '../../vfx/energy';
import { makePointPool } from '../../fx/pointPool';
import { TAU } from './parts';
import type { Fig } from './fig';

export const FX_LIGHT = 0xf2efe6, FX_DARK = 0x0c0a08;          // Tusche des Viewers wäre auf dunklem Boden unsichtbar, nur die Risse bleiben dunkel
export const SN = 8;   // Glieder der Stoffbahn
const SEG = .11;

// cloth0: Stoffbahn des Skins (Farbe, Breite). Baut in derselben Reihenfolge wie vorher im Builder (Objekt-IDs, Sortierung beim Rendern)
export function buildWarFx(F: Fig, cloth0: { color: number; w: number }) {
  const { root, fxGroup, gy, clothAnchor, hips } = F;
  const auraRing = new THREE.Mesh(new THREE.RingGeometry(.7, 1.1, 40), new THREE.MeshBasicMaterial({ color: 0xe0141c, transparent: true, opacity: 0, depthWrite: false }));
  auraRing.rotation.x = -Math.PI / 2; fxGroup.add(auraRing);
  const sP = [], sO = [];
  const clothGeo = new THREE.BufferGeometry();
  clothGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 2 * 3), 3));
  { const idx = []; for (let i = 0; i < SN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } clothGeo.setIndex(idx); }
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshBasicMaterial({ color: cloth0.color, side: THREE.DoubleSide }));
  cloth.frustumCulled = false;
  function clothReset() { const p = clothAnchor.getWorldPosition(V()); for (let i = 0; i < SN; i++) { sP[i] = p.clone().add(V(0, -i * SEG, 0)); sO[i] = sP[i].clone(); } }
  const fxList = [];
  const fxMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });
  // Sichel im Wurzel-Raum (Spell-Viewer: Energie-Look, Wut bei viel Wut, sonst Staub)
  const _hq = new THREE.Quaternion(), _he = new THREE.Euler();
  function arc(center, euler, r, th, life = .3, red = true, pal = null) {
    const yq = _hq.setFromAxisAngle(V(0, 1, 0), root.rotation.y).clone();
    const c = V(center[0], center[1], center[2]).applyQuaternion(yq).add(V(root.position.x, gy(), root.position.z));
    const q = yq.multiply(new THREE.Quaternion().setFromEuler(_he.set(euler[0], euler[1], euler[2])));
    eArc(c, q, r, th, pal ?? (red && F.anim.rage > 30 ? PAL.wut : PAL.staub), life * 1.3);
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
  const pool = makePointPool(600, .08, { floor: () => gy() + .03 });   // fx/pointPool.ts, Punkte bleiben auf dem Boden liegen
  fxGroup.add(pool.points);
  function emit(p, n, spd, col, grav = 9, life = 1) {
    const c = new THREE.Color(col);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, h = Math.random();
      pool.put(p.x, p.y, p.z, c, Math.cos(a) * spd * (1 - h * .5), spd * (.3 + h), Math.sin(a) * spd * (1 - h * .5), life * (.6 + Math.random() * .6), grav);
    }
  }
  const updateParts = pool.update;
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
    const o = V(p.x, gy(), p.z), pal = F.anim.rage > 30 ? PAL.wut : PAL.staub;   // Einschlag-Kuppel
    efx(.45, (k, _d, e) => { if (!e.ms.length) em(e, 'hemi', pal, { sc: 2.2, core: -.3, flow: [0, 2.5, 0], side: THREE.DoubleSide }).position.copy(o); e.ms[0].scale.set(r * .35 * outC(k), r * .25 * (1 - k * .5), r * .35 * outC(k)); setK(e.ms[0], 1 - k); });
    cracksStar(p, nCr, r * .6);
    emit(V(p.x, gy() + .1, p.z), 30, 4, 0x8f877a, 14, .9);
    if (F.anim.rage > 30) emit(V(p.x, gy() + .1, p.z), Math.round(F.anim.rage / 5), 5, 0xe0141c, 10, .8);
  }
  // Stoffbahn pro Frame: Verlet mit Schwerkraft und Zug nach hinten, Länge je Glied fest
  function clothStep(s) {
      const an = clothAnchor.getWorldPosition(V());
      if (!F.anim.ready || an.distanceTo(sP[0]) > 6) { clothReset(); F.anim.ready = true; }
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
  }
  return { auraRing, cloth, clothStep, arc, ring, crack, cracksStar, ghost, updateFx, emit, updateParts, windG, windArcs, impact };
}
