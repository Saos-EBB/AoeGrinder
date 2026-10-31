import * as THREE from 'three';
import { rand, clamp } from './util';
import { CFG } from './config';
import { scene } from './render';

export function heightAt(x, z) {
  let h = 2.2 * Math.sin(x * 0.035) * Math.cos(z * 0.03)
        + 1.2 * Math.sin(x * 0.08 + z * 0.06)
        + 0.6 * Math.sin(z * 0.13 - x * 0.05);
  const r = Math.hypot(x, z);
  if (r > 92) h += Math.pow(r - 92, 1.45) * 0.4;     // Berge am Rand
  return h;
}

// Terrain mit Vertex-Farben (Gras, Erdflecken, Fels an Hängen)
const terrain = (() => {
  const size = 340, segs = 150;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const grassA = new THREE.Color(0x3f6e22), grassB = new THREE.Color(0x86a83e),
        dirt = new THREE.Color(0x8a6a42), rock = new THREE.Color(0x7d766a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
    pos.setY(i, h);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) + Math.sin(x * 0.031 + z * 0.047);
    c.copy(grassA).lerp(grassB, clamp(0.5 + n * 0.3 + h * 0.05 + rand(-0.06, 0.06), 0, 1));
    if (n > 1.3) c.lerp(dirt, 0.65);
    if (h > 6) c.lerp(rock, clamp((h - 6) / 10, 0, 0.9));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(mesh);
  return mesh;
})();

// Hindernisse (Bäume, Steine) – Kreise für die Kollision
export const obstacles = [];

(() => {
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3, 7);
  const leafGeo = new THREE.ConeGeometry(2.6, 5, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3d22 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trees = [];
  for (let i = 0; i < 190; i++) {                       // Waldrand
    const a = rand(0, Math.PI * 2), r = rand(100, 160);
    trees.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: rand(1, 1.8) });
  }
  for (let i = 0; i < 40; i++) {                        // einzelne Bäume im Spielbereich
    const a = rand(0, Math.PI * 2), r = rand(18, 88);
    trees.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: rand(0.9, 1.4), inside: true });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, trees.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  trees.forEach((t, i) => {
    const y = heightAt(t.x, t.z);
    m.compose(new THREE.Vector3(t.x, y + 1.5 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    trunks.setMatrixAt(i, m);
    for (let k = 0; k < 2; k++) {
      const sc = t.s * (1 - k * 0.3);
      m.compose(new THREE.Vector3(t.x, y + (4 + k * 2.4) * t.s, t.z), q, new THREE.Vector3(sc, sc, sc));
      leaves.setMatrixAt(i * 2 + k, m);
      leaves.setColorAt(i * 2 + k, col.setHSL(0.28 + rand(-0.03, 0.03), 0.45, 0.22 + rand(0, 0.08)));
    }
    if (t.inside) obstacles.push({ x: t.x, z: t.z, r: 0.6 * t.s, canopy: 2.4 * t.s });
  });
  scene.add(trunks, leaves);

  const rockGeo = new THREE.DodecahedronGeometry(1);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a857a, flatShading: true });
  for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2), r = rand(12, 90);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, s = rand(0.8, 2);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, heightAt(x, z) + 0.2 * s, z);
    rock.scale.set(s, s * rand(0.5, 0.9), s * rand(0.8, 1.2));
    rock.rotation.y = rand(0, 6);
    scene.add(rock);
    obstacles.push({ x, z, r: s * 0.9 });
  }

  // Grasbüschel
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.7, 3);
  tuftGeo.translate(0, 0.35, 0);
  const grass = new THREE.InstancedMesh(tuftGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 6000);
  for (let i = 0; i < grass.count; i++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 105;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, s = rand(0.35, 0.8);
    q.setFromEuler(new THREE.Euler(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3)));
    m.compose(new THREE.Vector3(x, heightAt(x, z), z), q, new THREE.Vector3(s, s, s));
    grass.setMatrixAt(i, m);
    grass.setColorAt(i, col.setHSL(0.27 + rand(-0.03, 0.03), 0.5, 0.24 + rand(0, 0.08)));
  }
  scene.add(grass);
})();

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
