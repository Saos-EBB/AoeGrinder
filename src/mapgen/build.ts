// Aus dem Raster wird Welt: Kollision (Wandzellen zu Boxen zusammengefasst), Bodenfarben, Wände als InstancedMesh pro Wandart,
// Wasser/Lava als je ein Mesh, Deko pro Art ein InstancedMesh, Landmarke (Körper + Glühen). Budget ≤ ~12 Draw Calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addBox, addCircle, setBounds } from '../collision';
import { toonMat } from '../toon';
import { CELL, FINE, FLOOR, WALL, HOLE, WATER, LAVA, type Grid, type Layout } from './grid';
import type { Rng } from './rng';
import type { Deco } from './types';

// ---------- Geometrie-Helfer: Teile mit Vertex-Farbe, zu einer Geometrie verschmolzen ----------
export function paint(geo: THREE.BufferGeometry, hex: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export const colored = (parts: [THREE.BufferGeometry, number][]) => mergeGeometries(parts.map(([g, hex]) => paint(g, hex)));
// Ohne Farbe (Glüh-Teile mit eigenem Material)
export const plain = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts.map(g => { const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv'); return n; }));

// Prop: Modell (Vertex-Farben), optional Glüh-Teil, Collider (r: Kreis, w/d: Box; h: Oberkante über Boden, sonst massiv)
export interface Prop { geo: THREE.BufferGeometry; glow?: THREE.BufferGeometry; r?: number; w?: number; d?: number; h?: number }
export interface Landmark { body: THREE.BufferGeometry; glow?: THREE.BufferGeometry; r: number }

// Was build braucht, kommt aus dem Theme (themes.ts)
export interface Look {
  ground: { a: number; b: number; path: number; wall: number; hole?: number };
  wall?: () => Prop;                        // Block pro Rand-Wandzelle (Kanäle, Räume, Hallen)
  rim?: { kinds: string[]; perCell: number };   // Offen: Rand aus Bäumen/Felsen
  water?: number; lava?: number;
  glow: THREE.Color;                        // Farbe der Glüh-Teile (> 1 = Bloom)
  props: Record<string, () => Prop>;
  landmark: () => Landmark;
}

type Ctx = { add: (m: THREE.Object3D) => THREE.Object3D };
const glowMat = (c: THREE.Color) => new THREE.MeshBasicMaterial({ color: c, fog: false });
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();

function instanced(ctx: Ctx, geo: THREE.BufferGeometry, mat: THREE.Material, list: { x: number; z: number; y?: number; ry?: number; s?: number; sy?: number; color?: THREE.Color }[], heightAt) {
  if (!list.length) return null;
  const inst = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((p, i) => {
    e.set(0, p.ry ?? 0, 0); q.setFromEuler(e);
    const s = p.s ?? 1;
    m4.compose(v.set(p.x, heightAt(p.x, p.z) + (p.y ?? 0), p.z), q, sc.set(s, s * (p.sy ?? 1), s));
    inst.setMatrixAt(i, m4);
    if (p.color) inst.setColorAt(i, p.color);
  });
  inst.frustumCulled = false;
  ctx.add(inst);
  return inst;
}

// Wandzellen (und Löcher) zeilenweise zu Rechtecken zusammenfassen: wenige große Boxen statt hunderter kleiner
export function wallBoxes(g: Grid) {
  const used = new Uint8Array(g.n * g.n), out: { i: number; j: number; w: number; h: number }[] = [];
  const solid = (i, j) => g.get(i, j) !== FLOOR;
  for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
    if (used[j * g.n + i] || !solid(i, j)) continue;
    let w = 1;
    while (i + w < g.n && solid(i + w, j) && !used[j * g.n + i + w]) w++;
    let h = 1;
    grow: while (j + h < g.n) {
      for (let k = 0; k < w; k++) if (!solid(i + k, j + h) || used[(j + h) * g.n + i + k]) break grow;
      h++;
    }
    for (let dj = 0; dj < h; dj++) for (let k = 0; k < w; k++) used[(j + dj) * g.n + i + k] = 1;
    out.push({ i, j, w, h });
  }
  return out;
}

// Wasser/Lava: Läufe im feinen Raster zu Streifen, ein Mesh pro Art
function fineMesh(g: Grid, kind: number, y: number) {
  const s = CELL / FINE, m = g.n * FINE, pos: number[] = [];
  for (let fj = 0; fj < m; fj++) {
    let fi = 0;
    while (fi < m) {
      if (g.fine[fj * m + fi] !== kind) { fi++; continue; }
      const a = fi;
      while (fi < m && g.fine[fj * m + fi] === kind) fi++;
      const xa = g.x0 + a * s, xb = g.x0 + fi * s, za = g.z0 + fj * s, zb = za + s;
      pos.push(xa, y, za, xa, y, zb, xb, y, za, xb, y, za, xa, y, zb, xb, y, zb);
    }
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Baut alles. Gibt die Meshes zurück (Zählung der Draw Calls im Test).
export function buildLayout(ctx: Ctx, l: Layout, look: Look, rng: Rng, heightAt) {
  const g = l.grid, out: THREE.Object3D[] = [];
  const keep = (o: THREE.Object3D | null) => { if (o) out.push(o); };
  const mat = toonMat({ vertexColors: true });

  // Kollision: Wände und Löcher massiv, außerhalb der Bounds blockiert collision.ts
  setBounds(l.bounds);
  for (const b of wallBoxes(g)) addBox(g.x0 + (b.i + b.w / 2) * CELL, g.z0 + (b.j + b.h / 2) * CELL, b.w * CELL, b.h * CELL, 0);

  const byKind = new Map<string, { x: number; z: number; y?: number; ry?: number; s?: number; color?: THREE.Color }[]>();
  const put = (kind: string, p) => { if (!byKind.has(kind)) byKind.set(kind, []); byKind.get(kind)!.push(p); };
  const tint = () => new THREE.Color().setScalar(rng.range(0.82, 1.08));

  // Wände: Block pro Rand-Wandzelle, oder (Offen) Bäume/Felsen dicht gestreut
  for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
    if (g.get(i, j) !== WALL || !g.edgeWall(i, j)) continue;
    if (look.wall) put('#wall', { x: g.cx(i), z: g.cz(j), ry: rng.int(0, 3) * Math.PI / 2, color: tint() });
    if (look.rim) for (let k = 0; k < look.rim.perCell; k++)
      put(rng.pick(look.rim.kinds), { x: g.cx(i) + rng.range(-3.5, 3.5), z: g.cz(j) + rng.range(-3.5, 3.5), ry: rng.range(0, 6.28), s: rng.range(1.1, 1.8), color: tint() });
  }
  if (look.wall) {
    const w = look.wall();
    keep(instanced(ctx, w.geo, mat, byKind.get('#wall') ?? [], heightAt));
    if (w.glow) keep(instanced(ctx, w.glow, glowMat(look.glow), byKind.get('#wall') ?? [], heightAt));
    byKind.delete('#wall');
  }

  // Deko aus dem Layout, Collider nach Prop
  const props = new Map<string, Prop>();
  const prop = (k: string) => { if (!props.has(k)) props.set(k, look.props[k]?.() ?? look.props.rock()); return props.get(k)!; };
  for (const d of l.deco as Deco[]) {
    const p = prop(d.kind), s = d.s ?? 1;
    if (p.r) addCircle(d.x, d.z, p.r * s, p.h ? heightAt(d.x, d.z) + p.h * s : Infinity);
    else if (p.w) addBox(d.x, d.z, p.w * s, p.d! * s, d.ry ?? 0, p.h ? heightAt(d.x, d.z) + p.h * s : Infinity);
    put(d.kind, { x: d.x, z: d.z, ry: d.ry ?? 0, s, color: tint() });
  }
  for (const [kind, list] of byKind) {
    const p = prop(kind);
    keep(instanced(ctx, p.geo, mat, list, heightAt));
    if (p.glow) keep(instanced(ctx, p.glow, glowMat(look.glow), list, heightAt));
  }

  // Wasser und Lava
  const water = look.water !== undefined ? fineMesh(g, WATER, 0.06) : null;
  if (water) keep(ctx.add(new THREE.Mesh(water, new THREE.MeshLambertMaterial({ color: look.water, emissive: look.water, emissiveIntensity: 0.35 }))));
  const lava = look.lava !== undefined ? fineMesh(g, LAVA, 0.05) : null;
  if (lava) keep(ctx.add(new THREE.Mesh(lava, new THREE.MeshBasicMaterial({ color: new THREE.Color(look.lava).multiplyScalar(2.6), fog: false }))));

  // Landmarke: Körper im Toon-Look, Glühen ohne Nebel (ragt aus dem Dunkel)
  const lm = look.landmark();
  addCircle(l.landmark.x, l.landmark.z, lm.r);
  const at = [{ x: l.landmark.x, z: l.landmark.z, ry: l.landmark.ry }];
  keep(instanced(ctx, lm.body, toonMat({ vertexColors: true, fog: false } as any), at, heightAt));
  if (lm.glow) keep(instanced(ctx, lm.glow, glowMat(look.glow), at, heightAt));
  return out;
}

// Bodenfarbe aus dem Raster: Boden mit Rauschen, Wege, unter Wänden dunkel, Löcher schwarz
export function groundColor(l: Layout, look: Look, pathDist?: (x: number, z: number) => number) {
  const a = new THREE.Color(look.ground.a), b = new THREE.Color(look.ground.b), path = new THREE.Color(look.ground.path),
    wall = new THREE.Color(look.ground.wall), hole = new THREE.Color(look.ground.hole ?? 0x020202);
  return (c: THREE.Color, x: number, z: number) => {
    const cell = l.grid.at(x, z);
    if (cell === HOLE) { c.copy(hole); return; }
    const n = Math.sin(x * 0.13) * Math.cos(z * 0.11) + Math.sin(x * 0.041 + z * 0.053);
    c.copy(a).lerp(b, Math.min(1, Math.max(0, 0.5 + n * 0.3)));
    if (cell === WALL) { c.lerp(wall, 0.85); return; }
    const p = pathDist?.(x, z) ?? 99;
    if (p < 3.6) c.lerp(path, Math.min(1, (3.6 - p) / 1.6) * 0.85);
  };
}
