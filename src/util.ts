import * as THREE from 'three';

export const $ = id => document.getElementById(id);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const lerpTo = (cur, target, k) => cur + (target - cur) * k;

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
