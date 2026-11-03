// Prototyp „Dunkel“: gleiche Mechanik, Licht und Stimmung wie im Horror-Spiel „Hinter dir“. Nur aktiv mit #dunkel in der URL, gelesen beim Laden.
// Ohne Hash läuft hier nichts: keine zusätzlichen Lichter, keine zusätzlichen Draw Calls.

import * as THREE from 'three';
import { player } from './state';
import { scene, camera, hemi, sun, skyUniforms, setEnv, setEnvHook } from './render';
import { cam } from './camera';
import { zone } from './world';

export const dunkelOn = location.hash === '#dunkel';

// Alle Zahlen des Modus. Alles // PH
export const D = {
  fogColor: 0x050505, fogNear: 6, fogFar: 38,
  hemiMul: 0.18, sunMul: 0.12, skyTop: 0x020203, skyMid: 0x040405,
  lamp: { color: 0xffc48a, power: 60, range: 30, decay: 1.6, height: 2.5 },
  cam: { dist: 7, pitch: 0.2, fov: 68 },
};

let lamp = null;

function darken() {
  const f = scene.fog as THREE.Fog;
  f.color.set(D.fogColor); f.near = D.fogNear; f.far = D.fogFar;
  hemi.intensity = zone.env.hemi * D.hemiMul;       // absolut: blendFog ruft das im Sandsturm jeden Frame
  sun.intensity = zone.env.sunPower * D.sunMul;
  skyUniforms.top.value.set(D.skyTop); skyUniforms.mid.value.set(D.skyMid); skyUniforms.horizon.value.set(D.fogColor);
  skyUniforms.sunAmt.value = 0;
}

export function initDunkel() {
  setEnvHook(darken);
  setEnv(zone.env);
  lamp = new THREE.PointLight(D.lamp.color, D.lamp.power, D.lamp.range, D.lamp.decay);
  scene.add(lamp);
  Object.assign(cam, { dist: D.cam.dist, pitch: D.cam.pitch });
  camera.fov = D.cam.fov;
  camera.updateProjectionMatrix();
}

export function updateDunkel() {
  lamp.position.set(player.pos.x, player.pos.y + D.lamp.height, player.pos.z);
}
