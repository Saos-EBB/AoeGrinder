import * as THREE from 'three';
import { player } from './state';
import { rand } from './util';
import { camera } from './render';
import { heightAt, obstacles } from './world';

// Kamera wie in WoW: Orbit um den Spieler
export const cam = { offset: 0, pitch: 0.45, dist: 16, shake: 0 };

// Kamera-Wackeln (z. B. bei Crits): klingt schnell ab
export function shakeCamera(amount) { cam.shake = Math.max(cam.shake || 0, amount); }

// Anteil t (0..1) auf der Strecke a→b (nur x/z), an dem sie den Kreis trifft; 1 = kein Treffer
function segmentHitsCircle(a, b, c, r) {
  const dx = b.x - a.x, dz = b.z - a.z, fx = a.x - c.x, fz = a.z - c.z;
  const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - r * r;
  if (C < 0) return 1;                                   // Spieler steht selbst unter dem Baum
  const disc = B * B - 4 * A * C;
  if (disc < 0) return 1;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : 1;
}

export function updateCamera() {
  const yaw = player.facing + cam.offset;
  const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.8, player.pos.z);
  const horiz = Math.cos(cam.pitch) * cam.dist;
  camera.position.set(
    target.x - Math.sin(yaw) * horiz,
    target.y + Math.sin(cam.pitch) * cam.dist,
    target.z - Math.cos(yaw) * horiz);
  // Kamera vor Baumkronen heranziehen (wie WoW-Kamerakollision)
  let nearest = 1;
  for (const o of obstacles) {
    if (o.canopy) nearest = Math.min(nearest, segmentHitsCircle(target, camera.position, o, o.canopy));
  }
  if (nearest < 1) camera.position.lerpVectors(target, camera.position, Math.max(0.15, nearest - 0.05));
  const minY = heightAt(camera.position.x, camera.position.z) + 0.5;   // nicht unter den Boden
  if (camera.position.y < minY) camera.position.y = minY;
  camera.lookAt(target);
  if (cam.shake > 0.001) {
    camera.position.x += rand(-1, 1) * cam.shake;
    camera.position.y += rand(-1, 1) * cam.shake;
    cam.shake *= 0.86;
  }

}
