import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const $ = id => document.getElementById(id);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const lerpTo = (cur, target, k) => cur + (target - cur) * k;
// Easing für Posen-Keyframes der Figuren
export const inOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const outC = t => 1 - Math.pow(1 - t, 3);

export function part(geo, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  return mesh;
}
export function joint(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// Anzahl Partikel pro Frame für eine Rate (pro Sekunde)
export const perFrame = (rate, dt) => { const n = rate * dt / 1000; return Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); };

// Fasst alle Meshes eines Gelenks pro Material zu einem zusammen, spart Draw Calls
export function mergeByJoint(root, keep) {
  const joints = [];
  root.traverse(o => { if (o.isGroup) joints.push(o); });
  for (const g of joints) {
    const byMat = new Map();
    for (const m of g.children) {
      if (!m.isMesh || m === keep) continue;
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(m);
    }
    for (const [mat, meshes] of byMat) {
      if (meshes.length < 2) continue;
      const geos = meshes.map(m => {
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        return g.applyMatrix4(m.matrix);
      });
      g.remove(...meshes);
      g.add(new THREE.Mesh(mergeGeometries(geos), mat));
    }
  }
}
