import * as THREE from 'three';
import { KEYS, readRaw, writeRaw } from './storage';
import { state, player } from './state';
import { camera } from './render';
import { heightAt, obstacles } from './world';
import { addTrauma, shakeOffset } from './wucht';
import { device } from './device';

// Kamera wie in WoW: Orbit um den Spieler
export const cam = { offset: 0, pitch: 0.45, dist: 16 };
// Handy: feste Kamera von schräg oben, dreht nie mit (mobile.ts). Bildschirm-oben ist Welt-Richtung MOBILE_YAW, Zoom über cam.dist
export const MOBILE_YAW = Math.PI, MOBILE_PITCH = 0.95;   // PH

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
const AUTO_CAM_RATE = 3;   // PH: 1/s
let autoCam = readRaw(KEYS.autoCam) === '1';
export const autoCamOn = () => autoCam;
export function setAutoCam(on) {
  autoCam = on;
  writeRaw(KEYS.autoCam, on ? '1' : '0');
}
export function updateAutoCam(dt, dragging) {
  if (!autoCam || state.paused || player.moveState === 'idle' || dragging) return;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const target = player.moveState === 'back' || !player.grounded ? 0 : wrap(Math.atan2(player.vel.x, player.vel.z) - player.facing);
  const now = wrap(cam.offset);
  cam.offset = now + wrap(target - now) * (1 - Math.exp(-AUTO_CAM_RATE * dt / 1000));
}

// Fremde Kamera (boss.ts): bekommt die fertige normale Position und das Ziel, setzt Position und Blick selbst
let override = null;
export function setCamOverride(fn) { override = fn; }

let lastShake = performance.now();
export function updateCamera() {
  const fixed = device.mobile && !document.body.classList.contains('menu');   // im Hauptmenü dreht die Figur vor der Kamera wie am PC
  const yaw = fixed ? MOBILE_YAW : player.facing + cam.offset, pitch = fixed ? MOBILE_PITCH : cam.pitch;
  const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.8, player.pos.z);
  const horiz = Math.cos(pitch) * cam.dist;
  camera.position.set(
    target.x - Math.sin(yaw) * horiz,
    target.y + Math.sin(pitch) * cam.dist,
    target.z - Math.cos(yaw) * horiz);
  // Kamera vor Baumkronen heranziehen (wie WoW-Kamerakollision)
  let nearest = 1;
  for (const o of obstacles) {
    if (o.canopy) nearest = Math.min(nearest, segmentHitsCircle(target, camera.position, o, o.canopy));
  }
  if (nearest < 1) camera.position.lerpVectors(target, camera.position, Math.max(0.15, nearest - 0.05));
  const minY = heightAt(camera.position.x, camera.position.z) + 0.5;   // nicht unter den Boden
  if (camera.position.y < minY) camera.position.y = minY;
  if (override) override(camera, target); else camera.lookAt(target);
  const sh = shakeOffset(performance.now() - lastShake);
  lastShake = performance.now();
  camera.position.x += sh.x;
  camera.position.y += sh.y;

}
