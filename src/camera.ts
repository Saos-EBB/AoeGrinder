import * as THREE from 'three';
import { state, player } from './state';
import { camera } from './render';
import { heightAt, obstacles } from './world';
import { addTrauma, shakeOffset } from './wucht';

// Kamera wie in WoW: Orbit um den Spieler
export const cam = { offset: 0, pitch: 0.45, dist: 16 };

// Kamera-Wackeln: Trauma-Modell in wucht.ts, amount wie bisher (0,1 klein … 1 stark)
export function shakeCamera(amount) { addTrauma(amount); }

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

// Auto-Kamera: Die Kamera dreht sich mit der Laufrichtung, auch beim Seitwärtslaufen. Ohne sie geht sie nur hinter die Blickrichtung (player.ts).
// Ziehen mit der linken Maustaste hat Vorrang, rückwärts bleibt sie hinter der Figur.
const AUTO_CAM_STORE = 'frostgrind.autocam.v1', AUTO_CAM_RATE = 3;   // PH: 1/s
let autoCam = false;
try { autoCam = localStorage.getItem(AUTO_CAM_STORE) === '1'; } catch { /* kein Storage */ }
export const autoCamOn = () => autoCam;
export function setAutoCam(on) {
  autoCam = on;
  try { localStorage.setItem(AUTO_CAM_STORE, on ? '1' : '0'); } catch { /* egal */ }
}
export function updateAutoCam(dt, dragging) {
  if (!autoCam || state.paused || player.moveState === 'idle' || dragging) return;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const target = player.moveState === 'back' || !player.grounded ? 0 : wrap(Math.atan2(player.vel.x, player.vel.z) - player.facing);
  const now = wrap(cam.offset);
  cam.offset = now + wrap(target - now) * (1 - Math.exp(-AUTO_CAM_RATE * dt / 1000));
}

let lastShake = performance.now();
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
  const sh = shakeOffset(performance.now() - lastShake);
  lastShake = performance.now();
  camera.position.x += sh.x;
  camera.position.y += sh.y;

}
