// Impact-Paket: Lichtblitz aus dem Licht-Pool, Schockwellen-Verzerrung, Kamera-Ruck, Hitstop.

import * as THREE from 'three';
import { viewW, viewH } from '../device';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { scene, camera, composer } from '../render';
import { softPass } from './softPass';
import { fxClock, quality, vfxOld } from './shaders';
import { playSound } from './sound';
import { W, impactDecal, debris } from '../wucht';

// ---------- Licht-Pool: Die Anzahl ändert sich nur mit der Qualität, sonst würden alle Materialien neu kompiliert ----------
const MAX_LIGHTS = 2;   // Wucht: höchstens 2 Lichtblitze gleichzeitig
const lights = [];
function syncLights() {
  const want = vfxOld() ? 0 : Math.min(MAX_LIGHTS, quality().lights);
  while (lights.length < want) {
    const l = new THREE.PointLight(0xffffff, 0, 30, 2);
    scene.add(l);
    lights.push({ light: l, start: -1e9, dur: 1, power: 0 });
  }
  while (lights.length > want) scene.remove(lights.pop().light);
}
export function lightFlash(pos, color, power = 300, range = 30, dur = 220) {   // PH
  syncLights();
  if (!lights.length) return;
  const slot = lights.reduce((a, b) => (a.start + a.dur < b.start + b.dur ? a : b));   // das am ehesten fertige
  slot.start = fxClock.now; slot.dur = dur; slot.power = power;
  slot.light.color.set(color);
  slot.light.distance = range;
  slot.light.position.set(pos.x, pos.y + 1.5, pos.z);
}

// ---------- Schockwelle als Post-Pass, bis zu 4 gleichzeitig ----------
const WAVES = 4;
const shock = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uWave: { value: Array.from({ length: WAVES }, () => new THREE.Vector4()) }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec4 uWave[${WAVES}]; uniform float uAspect; varying vec2 vUv;
    void main() {
      vec2 off = vec2(0.0);
      for (int i = 0; i < ${WAVES}; i++) {
        vec4 w = uWave[i];              // xy Mitte in UV, z Radius, w Stärke
        if (w.w == 0.0) continue;             // negativ: nach innen
        vec2 d = (vUv - w.xy) * vec2(uAspect, 1.0);
        float l = length(d), width = max(0.03, w.z * 0.35);
        float k = 1.0 - smoothstep(0.0, width, abs(l - w.z));
        off += (l > 0.0001 ? d / l : d) * k * k * w.w;
      }
      gl_FragColor = texture2D(tDiffuse, vUv - off * vec2(1.0 / uAspect, 1.0));
    }`,
});
shock.enabled = false;
composer.insertPass(shock, composer.passes.indexOf(softPass) + 1);
const waves = [];
export function shockwave(pos, radius, strength = 0.03, dur = 450) {   // PH
  if (vfxOld() || !quality().shock) return;
  if (waves.length >= WAVES) waves.shift();
  waves.push({ pos: new THREE.Vector3(pos.x, pos.y + 0.5, pos.z), radius, strength, dur, start: fxClock.now });
}

// ---------- Kamera-Ruck: kurzer Stoß entlang der Blickachse ----------
let kick = 0;
export function cameraKick(amount) { if (!vfxOld()) kick = Math.max(kick, amount); }
const tmp = new THREE.Vector3();

// ---------- Hitstop: Spielzeit steht kurz, Effekte laufen weiter ----------
// Werte in W.hitstop (wucht.ts): Spielzeit läuft mit scale weiter, höchstens ein Hitstop pro gap
let stopLeft = 0, lastStop = -1e9;
export function hitstop(ms = W.hitstop.critMs) {
  if (vfxOld() || performance.now() - lastStop < W.hitstop.gap) return;
  lastStop = performance.now();
  stopLeft = ms;
}
// Läuft gerade ein Hitstop? Die Nahkampf-Figuren frieren dann mit ein (klinge.ts, realMen.ts)
export const hitstopActive = () => stopLeft > 0;
// Crits lösen Hitstop nur aus, wenn im Frame genau ein Treffer fiel (Einzelziel). Beim AoE-Grinden mit vielen Treffern stockt es so nicht.
let frameHits = 0, frameCrit = false;
export function noteHit(crit) { frameHits++; if (crit) frameCrit = true; }
// Liefert die Spielzeit dieses Frames
export function hitstopDt(dt) {
  if (stopLeft <= 0) return dt;
  const used = Math.min(stopLeft, dt);
  stopLeft -= used;
  return dt - used + used * W.hitstop.scale;
}

// Einmal pro Frame aus updateEffects, nach der Kamera
const proj = new THREE.Vector3();
export function updateImpact(dt) {
  if (frameCrit && frameHits === 1) hitstop(W.hitstop.critMs);
  frameHits = 0; frameCrit = false;
  syncLights();
  for (const s of lights) {
    const t = (fxClock.now - s.start) / s.dur;
    s.light.intensity = t < 1 ? s.power * (1 - t) * (1 - t) : 0;
  }
  if (kick > 0.002) {
    camera.getWorldDirection(tmp);
    camera.position.addScaledVector(tmp, kick);
    kick *= Math.pow(0.0012, dt / 1000);   // PH: nach rund 150 ms abgeklungen
  } else kick = 0;

  camera.updateMatrixWorld();
  shock.uniforms.uAspect.value = viewW() / viewH();
  const us = shock.uniforms.uWave.value;
  for (let i = waves.length - 1; i >= 0; i--) if ((fxClock.now - waves[i].start) >= waves[i].dur) waves.splice(i, 1);
  shock.enabled = waves.length > 0;
  for (let i = 0; i < WAVES; i++) {
    const w = waves[i];
    if (!w) { us[i].w = 0; continue; }
    const t = (fxClock.now - w.start) / w.dur;
    proj.copy(w.pos).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(1, -proj.z);
    proj.copy(w.pos).project(camera);
    const r = w.radius * (1 - (1 - t) * (1 - t)) * (camera.projectionMatrix.elements[5] * 0.5) / depth;   // Welt-Radius in Bildhöhen
    us[i].set(proj.x * 0.5 + 0.5, proj.y * 0.5 + 0.5, r, w.strength * (1 - t) * (proj.z < 1 ? 1 : 0));
  }
}

// Alles zusammen für einen Einschlag
export function impact(pos, color, { radius = 10, power = 300, kickBy = 0.25, sound = 'impact', volume = Math.min(1.4, 0.55 + radius * 0.035) } = {}) {   // PH
  playSound(sound, volume);
  impactDecal(pos, color, radius);   // Wucht: Spur am Boden und Trümmer
  debris(pos);
  lightFlash(pos, color, power, radius * 3);
  shockwave(pos, radius);
  cameraKick(kickBy);
}

// Crit (ui/hud.ts) und Multi-Kill ab 10 (score.ts)
export function onCrit() { cameraKick(0.12); }   // Hitstop für Crits kommt über noteHit (nur Einzelziel)
export function onMultiKill() { hitstop(); cameraKick(0.6); }
