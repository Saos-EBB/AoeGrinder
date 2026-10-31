import * as THREE from 'three';
import { CFG } from './config';
import { scene, setEnv } from './render';
import { ZONES } from './zones';
import { makeCtx } from './props';

export let zone = ZONES.tirisfal;
export let zoneId = 'tirisfal';

export function heightAt(x, z) {
  let h = zone.height(x, z);
  const r = Math.hypot(x, z);
  if (r > 92) h += Math.pow(r - 92, 1.45) * 0.4;     // Berge am Rand
  return h;
}

// Terrain mit Vertex-Farben aus der Zone
const terrain = (() => {
  const size = 340, segs = 150;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(mesh);
  return mesh;
})();

// Hindernisse (Bäume, Steine) – Kreise für die Kollision
export const obstacles = [];
const props = new THREE.Group();
scene.add(props);

// Baut Himmel, Gelände und Dekoration der Zone neu auf
export function buildWorld(id) {
  zoneId = id;
  zone = ZONES[id];
  setEnv(zone.env);

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
  zone.props(makeCtx(props, obstacles, heightAt));
}
buildWorld(zoneId);

// Spieler/Mobs aus Hindernissen herausschieben
export function collide(pos, radius) {
  for (const o of obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + radius;
    if (d < min && d > 0.0001) { pos.x = o.x + dx / d * min; pos.z = o.z + dz / d * min; }
  }
  const r = Math.hypot(pos.x, pos.z);
  if (r > CFG.playRadius) { pos.x *= CFG.playRadius / r; pos.z *= CFG.playRadius / r; }
}

// Blizzard-Zielkreis
// Flache Kreise/Ringe, deren Vertices der Bodenhöhe folgen
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
    arr[i + 1] = heightAt(center.x + x, center.z + z) + 0.15;
  }
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}
