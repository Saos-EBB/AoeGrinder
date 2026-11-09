// Dunkel: das Licht des Spiels, wie im Horror-Spiel „Hinter dir“. Gleiche Mechanik, Lichtkegel an der Figur, schwarzer Nebel.

import * as THREE from 'three';
import { state, player } from './state';
import { rand, clamp } from './util';
import { PERF } from './config';
import { device } from './device';
import { scene, camera, renderer, hemi, sun, skyUniforms, setEnv, setEnvHook } from './render';
import { cam } from './camera';
import { zone, terrain } from './world';
import { mage } from './models/mage';
import { blizCursor } from './fx/spellFx';

// Alle Zahlen des Modus. Alles // PH
const D = {
  fogColor: 0x050505, fogDensity: 0.035, fogStorm: 0.05,    // FogExp2, fogStorm kommt im Sandsturm dazu
  hemiMul: 0.18, sunMul: 0.12, skyTop: 0x020203, skyMid: 0x040405,
  // Lichtkreis: Spot senkrecht über der Figur, radius = Lichtkreis am Boden in yd
  lamp: { color: 0xffc48a, power: 60, range: 40, radius: 22, penumbra: 0.85, decay: 0.8, height: 10, shadow: 1024, shadowLow: 512, bias: -0.0006, near: 0.5 },
  // Hellt Figur und Mobs neben dir auf, mittig über der Figur (rundum gleich). Nah wird es neutraler und schwächer, damit das Modell seine Farben behält.
  fill: { color: 0xffc48a, closeColor: 0xfff1e2, power: 9, closePower: 6, range: 12, decay: 1.6, height: 2.4, closeFrom: 9, closeTo: 3 },
  flicker: true, flickerEvery: [3000, 10000], flickerFor: [100, 500], flickerLow: 0.15, flickerHigh: 0.9, flickerCalm: 0.7, flickerRate: 30,   // wie Hinter dir, ohne Blackouts
  cam: { dist: 7, pitch: 0.2, fov: 68, maxDist: 14 },
};

let lamp = null, fill = null;
const tmpColor = new THREE.Color();
let flick = 1, nextFlick = 0, flickUntil = 0;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // Bewegung reduziert: kein hartes Wechseln
const fog = new THREE.FogExp2(D.fogColor, D.fogDensity);

function darken() {
  fog.density = D.fogDensity + D.fogStorm * state.stormK + (state.fogExtra ?? 0);   // fogExtra: Mondphase
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
  lamp = new THREE.SpotLight(L.color, L.power, L.range, Math.atan(L.radius / L.height), L.penumbra, L.decay);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(size, size);
  lamp.shadow.bias = L.bias;
  lamp.shadow.camera.near = L.near;
  scene.add(lamp, lamp.target);
  fill = new THREE.PointLight(D.fill.color, D.fill.power, D.fill.range, D.fill.decay);
  scene.add(fill);

  // Zielkreis liegt auch weit draußen sichtbar im Dunkeln
  blizCursor.material.fog = false;
  blizCursor.material.needsUpdate = true;
  Object.assign(cam, { dist: D.cam.dist, pitch: D.cam.pitch });
  camera.fov = D.cam.fov;
  camera.updateProjectionMatrix();
}

// Nur Spieler und Mobs werfen Schatten. Selbstleuchtendes bleibt draußen. Die Liste wird einmal pro Modell gesammelt,
// Mobs schalten nur um, wenn sie über PERF.mobShadowYd wechseln: außerhalb des Lichtkreises sieht man keinen Schatten.
function castShadows(root, on = true) {
  if (!root) return;
  const list = root.userData.shadowMeshes ??= (() => { const l = []; root.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial && !o.material.transparent) l.push(o); }); return l; })();
  if (root.userData.shadowOn === on) return;
  root.userData.shadowOn = on;
  for (const o of list) o.castShadow = on;
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
  const L = D.lamp, p = player.pos;
  lamp.position.set(p.x, p.y + L.height, p.z);   // senkrecht darüber: Lichtkreis rundum statt Kegel nach vorn
  lamp.target.position.set(p.x, p.y, p.z);
  const F = D.fill;
  fill.position.set(p.x, p.y + F.height, p.z);
  const close = clamp((F.closeFrom - cam.dist) / (F.closeFrom - F.closeTo), 0, 1);
  fill.color.setHex(F.color).lerp(tmpColor.setHex(F.closeColor), close);
  fill.intensity = F.power + (F.closePower - F.power) * close;
  cam.dist = Math.min(cam.dist, D.cam.maxDist);
  castShadows(mage.root);
  for (const m of state.mobs) castShadows(m.model.root, Math.hypot(m.pos.x - p.x, m.pos.z - p.z) < PERF.mobShadowYd);
  if (D.flicker) updateFlicker(dt);
  fog.density = D.fogDensity + D.fogStorm * state.stormK + (state.fogExtra ?? 0);
}
