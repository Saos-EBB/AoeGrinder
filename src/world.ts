import * as THREE from 'three';
import { scene, setEnv, blendFog } from './render';
import { state, player } from './state';
import { rand, clamp } from './util';
import { WORLD_K } from './config';
import { particles } from './fx/particles';
import { ZONES } from './zones';
import { makeCtx } from './props';
import { clearColliders, colliders, groundAt } from './collision';
import { TOON, toonMat } from './toon';

export let zone = ZONES.tirisfal;
const lambertGround = new THREE.MeshLambertMaterial({ vertexColors: true }), toonGround = toonMat({ vertexColors: true, rim: false });
export let zoneId = new URLSearchParams(location.search).get('zone') ?? 'tirisfal';   // ?zone=winterquell zum Testen
if (!ZONES[zoneId]) zoneId = 'tirisfal';
let nextStorm = 0, stormEnd = 0;

export function heightAt(x, z) {
  let h = zone.height(x, z);
  const r = Math.hypot(x, z);
  if (r > 92 * WORLD_K) h += Math.pow(r - 92 * WORLD_K, 1.45) * 0.4;     // Berge am Rand
  return h;
}

// Terrain mit Vertex-Farben aus der Zone
export const terrain = (() => {
  const size = 340 * WORLD_K, segs = 150 * WORLD_K;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(geo, lambertGround);
  scene.add(mesh);
  return mesh;
})();

// Hindernisse (Bäume, Steine) – Kreise für die Kollision
export const obstacles = [];
const props = new THREE.Group();
scene.add(props);

// Baut Himmel, Gelände und Dekoration der Zone neu auf
export function buildWorld(id) {
  zone.leave?.();   // Zonen mit eigenem Zustand (Mondsee: Phase) räumen auf
  zoneId = id;
  zone = ZONES[id];
  setEnv(zone.env);
  terrain.material = TOON || zone.toon ? toonGround : lambertGround;   // Anime-Maps (toon.ts)
  state.stormK = 0;
  nextStorm = state.now + (zone.storm?.every ?? 0);

  const geo = terrain.geometry, pos = geo.attributes.position, colors = [], c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
    pos.setY(i, h);
    zone.ground(c, x, z, h);
    colors.push(c.r, c.g, c.b);
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  props.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose?.(); o.dispose?.(); });
  props.clear();
  obstacles.length = 0;
  clearColliders(heightAt);
  zone.props(makeCtx(props, obstacles, heightAt));
  if (colliderView) showColliders(true);
}

// Dev: Collider als Drahtgitter. Massives rot, begehbare Flächen grün.
let colliderView = null;
export function showColliders(on) {
  if (colliderView) {
    scene.remove(colliderView);
    colliderView.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    colliderView = null;
  }
  if (!on) return;
  const solid = [], walk = [];
  const seg = (out, a, b) => out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const outline = (out, pts, y) => pts.forEach(([x, z], i) => {
    const [nx, nz] = pts[(i + 1) % pts.length], [cy, ny] = [y(x, z), y(nx, nz)];
    seg(out, [x, cy, z], [nx, ny, nz]);
  });
  for (const c of colliders) {
    const pts = [];
    if (c.kind === 'circle') for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([c.x + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r]); }
    else for (const [lx, lz] of [[-c.hw, -c.hd], [c.hw, -c.hd], [c.hw, c.hd], [-c.hw, c.hd]]) pts.push([c.x + lx * c.cos + lz * c.sin, c.z - lx * c.sin + lz * c.cos]);
    if (c.kind === 'walk') {
      outline(walk, pts, c.height);
      for (const [a, b] of [[0, 2], [1, 3]]) seg(walk, [pts[a][0], c.height(...pts[a]), pts[a][1]], [pts[b][0], c.height(...pts[b]), pts[b][1]]);
      continue;
    }
    const low = (x, z) => c.bottom > -Infinity ? c.bottom : heightAt(x, z);
    const high = (x, z) => Math.min(c.top, heightAt(x, z) + 8);   // Unendlich hohe Objekte enden im Bild bei 8 yd
    outline(solid, pts, low);
    outline(solid, pts, high);
    pts.forEach(([x, z], i) => { if (c.kind !== 'circle' || i % 3 === 0) seg(solid, [x, low(x, z), z], [x, high(x, z), z]); });
  }
  colliderView = new THREE.Group();
  for (const [lines, color] of [[solid, 0xff5050], [walk, 0x40ff80]] as any) {
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    colliderView.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, fog: false })));
  }
  scene.add(colliderView);
}
buildWorld(zoneId);

// Sandsturm: alle paar Minuten Sicht zu, danach wieder klar
export function updateZoneEvent(dt) {
  zone.update?.(dt);
  const st = zone.storm;
  if (!st) return;
  if (state.now >= nextStorm) { nextStorm = state.now + st.every; stormEnd = state.now + st.dur; }
  const want = state.now < stormEnd ? 1 : 0;
  const k = state.stormK = clamp(state.stormK + Math.sign(want - state.stormK) * dt / 3000, 0, 1);
  blendFog(zone.env, k, st.color, st.near, st.far);
  if (k < 0.05) return;
  for (let i = Math.round(dt * 0.12 * k); i > 0; i--) {
    particles.spawn({ x: player.pos.x + rand(-16, 16), y: player.pos.y + rand(0.2, 7), z: player.pos.z + rand(-16, 16),
      vx: rand(11, 18), vy: rand(-0.5, 0.5), vz: rand(3, 7), life: rand(0.4, 0.9), color: [0.34, 0.26, 0.14], size: rand(0.2, 0.55) });
  }
}

// Für spells/blink.ts, alles andere ruft collision.ts direkt

// Blizzard-Zielkreis
// Flache Kreise/Ringe, deren Vertices der Fläche unter der Mitte folgen: Gelände, Plattform oder Stufe darunter
export function terrainDecal(geo, mat) {
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.base = geo.attributes.position.array.slice();
  return mesh;
}
export function drape(mesh, center, radius) {
  const base = mesh.userData.base, arr = mesh.geometry.attributes.position.array;
  mesh.position.set(center.x, 0, center.z);
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i] * radius, z = base[i + 2] * radius;
    arr[i] = x; arr[i + 2] = z;
    arr[i + 1] = groundAt(center.x + x, center.z + z, center.y ?? 0) + 0.15;
  }
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}
