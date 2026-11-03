// Prototyp „Dunkel“: gleiche Mechanik, Licht und Stimmung wie im Horror-Spiel „Hinter dir“. Nur aktiv mit #dunkel in der URL, gelesen beim Laden.
// Ohne Hash läuft hier nichts: keine zusätzlichen Lichter, keine zusätzlichen Draw Calls.

import * as THREE from 'three';
import { state, player } from './state';
import { rand } from './util';
import { PERF } from './config';
import { device } from './device';
import { scene, camera, renderer, hemi, sun, skyUniforms, setEnv, setEnvHook } from './render';
import { cam } from './camera';
import { zone, terrain } from './world';
import { mage } from './models/mage';

export const dunkelOn = location.hash === '#dunkel';

// Alle Zahlen des Modus. Alles // PH
export const D = {
  fogColor: 0x050505, fogDensity: 0.035, fogStorm: 0.05,    // FogExp2, fogStorm kommt im Sandsturm dazu
  hemiMul: 0.18, sunMul: 0.12, skyTop: 0x020203, skyMid: 0x040405,
  lamp: { color: 0xffc48a, power: 18, range: 34, angle: 0.62, penumbra: 0.6, decay: 0.8, height: 2.5, ahead: 0.5, aim: 14, shadow: 1024, shadowLow: 512, bias: -0.0006, near: 0.5 },
  fill: { color: 0xffc48a, power: 14, range: 10, decay: 1.6, height: 1.8 },   // zeigt Figur und Mobs direkt neben dir
  flicker: true, flickerEvery: [3000, 10000], flickerFor: [100, 500], flickerLow: 0.15, flickerHigh: 0.9, flickerCalm: 0.7, flickerRate: 30,   // wie Hinter dir, ohne Blackouts
  cam: { dist: 7, pitch: 0.2, fov: 68 },
};

let lamp = null, fill = null;
let flick = 1, nextFlick = 0, flickUntil = 0;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // Bewegung reduziert: kein hartes Wechseln
const fog = new THREE.FogExp2(D.fogColor, D.fogDensity);

function darken() {
  fog.density = D.fogDensity + D.fogStorm * state.stormK;
  hemi.intensity = zone.env.hemi * D.hemiMul;       // absolut: blendFog ruft das im Sandsturm jeden Frame
  sun.intensity = zone.env.sunPower * D.sunMul;
  skyUniforms.top.value.set(D.skyTop); skyUniforms.mid.value.set(D.skyMid); skyUniforms.horizon.value.set(D.fogColor);
  skyUniforms.sunAmt.value = 0;
}

export function initDunkel() {
  scene.fog = fog;
  setEnvHook(darken);
  setEnv(zone.env);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  terrain.receiveShadow = true;

  const L = D.lamp, size = PERF.vfx === 'niedrig' || device.mobile ? L.shadowLow : L.shadow;
  lamp = new THREE.SpotLight(L.color, L.power, L.range, L.angle, L.penumbra, L.decay);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(size, size);
  lamp.shadow.bias = L.bias;
  lamp.shadow.camera.near = L.near;
  scene.add(lamp, lamp.target);
  fill = new THREE.PointLight(D.fill.color, D.fill.power, D.fill.range, D.fill.decay);
  scene.add(fill);

  Object.assign(cam, { dist: D.cam.dist, pitch: D.cam.pitch });
  camera.fov = D.cam.fov;
  camera.updateProjectionMatrix();
}

// Nur Spieler und Mobs werfen Schatten. Selbstleuchtendes bleibt draußen, einmal pro Modell.
function castShadows(root) {
  if (!root || root.userData.dunkelShadow) return;
  root.userData.dunkelShadow = true;
  root.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial && !o.material.transparent) o.castShadow = true; });
}

// Echte Zeit, damit es auch in Pause und Menü weiterläuft
function updateFlicker(dt) {
  const now = performance.now();
  if (now > nextFlick) { nextFlick = now + rand(D.flickerEvery[0], D.flickerEvery[1]); flickUntil = now + rand(D.flickerFor[0], D.flickerFor[1]); }
  const wild = Math.random() < 0.5 ? D.flickerLow : D.flickerHigh;
  const target = now < flickUntil ? (calm ? D.flickerCalm : wild) : 1;
  flick += (target - flick) * Math.min(1, dt / 1000 * D.flickerRate);
  lamp.intensity = D.lamp.power * flick;
}

export function updateDunkel(dt) {
  const L = D.lamp, p = player.pos, fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  lamp.position.set(p.x + fx * L.ahead, p.y + L.height, p.z + fz * L.ahead);
  lamp.target.position.set(p.x + fx * L.aim, p.y, p.z + fz * L.aim);
  fill.position.set(p.x, p.y + D.fill.height, p.z);
  castShadows(mage.root);
  for (const m of state.mobs) castShadows(m.model.root);
  if (D.flicker) updateFlicker(dt);
}
