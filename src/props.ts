// Bausteine für die Zonen-Dekoration. Wiederholte Dinge laufen als InstancedMesh, damit die Draw Calls klein bleiben.

import { WORLD_K } from './config';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from './util';
import { addCircle, addBox, addWalk } from './collision';
import { TOON, toonMat } from './toon';

// ?toon=1: Anime-Basis zum Ausprobieren (toon.ts)
const lambert = (color, opts = {}) => TOON ? toonMat({ color, ...opts }) : new THREE.MeshLambertMaterial({ color, ...opts });
export { lambert };

function baked(geo, x, y, z, rx, ry, rz) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}
export const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => baked(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
export const cyl = (r1, r2, h, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 7) => baked(new THREE.CylinderGeometry(r1, r2, h, seg), x, y, z, rx, ry, rz);
export const cone = (r, h, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 6) => baked(new THREE.ConeGeometry(r, h, seg), x, y, z, rx, ry, rz);
export const ball = (r, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };

// [[Material, [Geometrien]], ...] -> ein Fertigteil
export const prefab = groups => groups.map(([mat, geos]) => ({ mat, geo: mergeGeometries(geos) }));

const SIGHT_HEIGHT = 2;   // PH: ab dieser Höhe versperrt ein Objekt die Sichtlinie

export function makeCtx(group, obstacles, heightAt) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  return {
    heightAt,
    // Massive Objekte: h ist die Höhe der Oberkante über dem Boden. Hohes zählt für die Sichtlinie in spells/relics.ts.
    obstacle(x, z, r, canopy?) { this.circle(x, z, r, Infinity, canopy); },
    circle(x, z, r, h = Infinity, canopy?) {
      addCircle(x, z, r, heightAt(x, z) + h);
      if (h >= SIGHT_HEIGHT) obstacles.push(canopy ? { x, z, r, canopy } : { x, z, r });
    },
    solid(x, z, w, d, ry = 0, h = Infinity) {
      addBox(x, z, w, d, ry, heightAt(x, z) + h);
      if (h >= SIGHT_HEIGHT) obstacles.push({ x, z, r: Math.max(w, d) / 2 });
    },
    // height(x, z): absolute Höhe der Lauffläche
    walk(x, z, w, d, ry, height, solid = true) {
      addWalk(x, z, w, d, ry, height, solid);
      if (solid) obstacles.push({ x, z, r: Math.min(w, d) / 2 });
    },
    add(mesh) { group.add(mesh); return mesh; },
    // list: [{ x, z, y?, s?, ry?, tilt?, color? }]; y ist die Höhe über dem Boden
    place(pre, list) {
      for (const { mat, geo } of pre) {
        const inst = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((p, i) => {
          const s = p.s ?? 1;
          e.set(p.tilt ?? 0, p.ry ?? 0, p.tiltZ ?? 0);
          q.setFromEuler(e);
          m.compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) + (p.y ?? 0), p.z), q, new THREE.Vector3(s, s * (p.sy ?? 1), s));
          inst.setMatrixAt(i, m);
          if (p.color) inst.setColorAt(i, p.color);
        });
        inst.frustumCulled = false;
        group.add(inst);
      }
    },
  };
}

// Punkte im Kreisring, optional gefiltert
// Karten-Streu (rMax ab 85 yd) wächst mit der Karte bei gleicher Dichte; kleinere Kreise gehören zu einem Bauwerk und bleiben.
export function scatter(n, rMin, rMax, ok = (x, z) => true) {
  if (rMax >= 85) { n = Math.round(n * WORLD_K * WORLD_K); rMax *= WORLD_K; if (rMin >= 90) rMin *= WORLD_K; }
  const out = [];
  for (let tries = 0; out.length < n && tries < n * 30; tries++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(rand(rMin * rMin, rMax * rMax));
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (ok(x, z)) out.push({ x, z });
  }
  return out;
}

// Grasbüschel in Zonenfarbe
export function grass(ctx, n, hue, sat, light, ok?) {
  const geo = new THREE.ConeGeometry(0.12, 0.7, 3);
  geo.translate(0, 0.35, 0);
  const col = new THREE.Color();
  const list = scatter(n / WORLD_K, 0, 105, ok).map(p => ({ ...p, s: rand(0.35, 0.8), ry: rand(0, 6), tilt: rand(-0.3, 0.3), tiltZ: rand(-0.3, 0.3),
    color: col.setHSL(hue + rand(-0.03, 0.03), sat, light + rand(0, 0.08)).clone() }));
  ctx.place([{ geo, mat: lambert(0xffffff) }], list);
}

// Findlinge als Hindernisse
export function rocks(ctx, n, color, rMin = 12, rMax = 90, ok?) {
  const geo = new THREE.DodecahedronGeometry(1).toNonIndexed();
  const list = scatter(n, rMin, rMax, ok).map(p => {
    const s = rand(0.8, 2), sy = rand(0.5, 0.9);
    ctx.circle(p.x, p.z, s * 0.9, s * (0.2 + sy));
    return { ...p, y: 0.2 * s, s, sy, ry: rand(0, 6) };
  });
  ctx.place([{ geo, mat: lambert(color, { flatShading: true }) }], list);
}

// Elvyn: Nadelwald, Steine, Gras
export function forestProps(ctx) {
  const pine = prefab([
    [lambert(0x5a3d22), [cyl(0.35, 0.55, 3, 0, 1.5, 0)]],
    [lambert(0x2f5a2c), [cone(2.6, 5, 0, 4, 0, 0, 0, 0, 8), cone(1.8, 3.5, 0, 6.4, 0, 0, 0, 0, 8)]],
  ]);
  const inside = scatter(40, 18, 88).map(p => ({ ...p, s: rand(0.9, 1.4) }));
  for (const t of inside) ctx.obstacle(t.x, t.z, 0.6 * t.s, 2.4 * t.s);
  ctx.place(pine, [...inside, ...scatter(190, 100, 160).map(p => ({ ...p, s: rand(1, 1.8) }))]);
  rocks(ctx, 30, 0x8a857a);
  grass(ctx, 6000, 0.27, 0.5, 0.24);
}
