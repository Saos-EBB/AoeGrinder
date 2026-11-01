import * as THREE from 'three';
import { scene, setEnv, blendFog } from './render';
import { state, player } from './state';
import { rand, clamp } from './util';
import { particles } from './fx/particles';
import { ZONES } from './zones';
import { makeCtx } from './props';
import { clearColliders, resolve } from './collision';

export let zone = ZONES.tirisfal;
export let zoneId = 'tirisfal';
let nextStorm = 0, stormEnd = 0;

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
}
buildWorld(zoneId);

// Sandsturm: alle paar Minuten Sicht zu, danach wieder klar
export function updateZoneEvent(dt) {
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
export function collide(pos, radius) { resolve(pos, radius); }

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
