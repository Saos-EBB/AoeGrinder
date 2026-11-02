// Relikte: jeweils ein deutlich größerer Moment als die normalen Spells. Alle Werte PH.

import * as THREE from 'three';
import { rand, pick, perFrame } from '../util';
import { groundAt } from '../collision';
import { scene } from '../render';
import { particles } from './particles';
import { addEffect, burnTex, iceTex } from './spellFx';
import { fxClock, fxMaterial, GLSL } from './shaders';
import { impact, lightFlash, shockwave, cameraKick, hitstop } from './impact';
import { playSound } from './sound';
import { waveFx, markFx, shellFx, flareFx, sparksFx, columnFx, iceSpikesFx, columnMaterial, spikeGeometry, spikeRing, groundDisc } from './prims';

const FIRE = [1.5, 0.48, 0.06], EMBER = [1.1, 0.2, 0.03], HOT = [1.9, 0.95, 0.22], SPARK = [2.4, 0.9, 0.15];
const ICE = [0.35, 1, 2.1], ICE_W = [1.1, 1.5, 2.1], SHADOW = [0.8, 0.15, 1.5], VOID = [0.35, 0.05, 0.9];

// Ragnaros-Schlag: Feuerhammer aus dem Himmel, doppelte Welle, der Boden reißt auf
export function ragnarosNew(pos, radius) {
  hitstop();
  impact(pos, 0xff7020, { radius: radius * 1.5, power: 800, kickBy: 0.9, sound: 'fire', volume: 1.5 });
  shockwave(pos, radius * 1.3, 0.065, 620);
  flareFx(pos, 0xff6a18, radius * 0.9, 420);
  columnFx(pos, radius * 0.42, 42, FIRE, EMBER, { dur: 820, top: 1.5, grow: 0.08, scroll: 2.4, dens: 0.3 });
  waveFx(pos, radius, HOT, FIRE, { dur: 560, width: 0.24 });
  waveFx(pos, radius * 0.7, FIRE, EMBER, { dur: 760, width: 0.16, peak: 0.7 });
  shellFx(pos, radius, FIRE, { dur: 520, squash: 0.5 });
  shellFx(pos, radius * 1.25, EMBER, { dur: 640, squash: 0.4, delay: 110 });
  markFx(burnTex, pos, radius, [0.75, 0.2, 0.06], 5000, { additive: true, grow: 0.05, rim: HOT });
  sparksFx(pos, 220, [SPARK, HOT, EMBER], radius * 2.3, { up: 9, size: 0.55, grav: 7, drag: 1.6, life: 1.1 });
}

// Frostatem: 3 s Aufladen mit schließendem Ring und Sog, dann Säule und Eisfeld
export function frostChargeNew(pos, radius, delay) {
  const center = pos.clone();
  const mat = fxMaterial({ uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `${GLSL.common} uniform float uT; varying vec2 vUv;
      void main() {
        vec2 q = vUv - 0.5; float r = length(q) * 2.0;
        float ring = 1.0 - uT * uT;                 // beschleunigt nach innen
        float n = noise2(q * 1.5 + scrollUv(vec2(0.0), vec2(0.1, -0.3)));
        float line = 1.0 - smoothstep(0.0, 0.016 + n * 0.012, abs(r - ring));
        float field = smoothstep(ring + 0.01, ring - 0.01, 1.0 - r + ring * 0.0) * 0.0 + (1.0 - smoothstep(ring - 0.25, ring, r)) * 0.13 * n * (0.3 + uT);
        gl_FragColor = vec4(vec3(0.6, 1.25, 2.3) * (line * (0.7 + uT * 1.2) + field), 1.0);
      }` });
  const mesh = groundDisc(center, radius, mat, 128, 14);
  addEffect(mesh, delay, t => {
    mat.uniforms.uT.value = t;
    for (let i = perFrame(60 + t * 200, 16); i > 0; i--) {   // Sog, wird immer dichter
      const a = rand(0, 6.28), r = radius * rand(0.35, 1) * (1.05 - t * 0.6), x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      particles.spawn({ x, y: groundAt(x, z, center.y) + rand(0.2, 3 + t * 4), z, vy: rand(0, 1), cx: center.x, cz: center.z, spin: rand(4, 9), pull: r * 1.2, life: rand(0.5, 0.9), color: pick([ICE, ICE_W]), size: rand(0.16, 0.34) });
    }
  });
}
export function frostbreathNew(pos, radius) {
  hitstop();
  impact(pos, 0x9fdcff, { radius, power: 1000, kickBy: 1, volume: 1.5 });
  shockwave(pos, radius, 0.075, 720);
  playSound('frost', 1.4);
  flareFx(pos, 0x9fd8ff, 16, 480);
  columnFx(pos, 4.5, 60, [0.6, 1.1, 2], ICE, { dur: 900, top: 1.4, grow: 0.07, scroll: 2.6, dens: 0.28 });
  waveFx(pos, radius, [1.3, 1.8, 2.6], ICE, { dur: 760, width: 0.2 });
  shellFx(pos, radius * 0.55, ICE_W, { dur: 520, squash: 0.7 });
  shellFx(pos, radius, ICE, { dur: 760, squash: 0.45, delay: 90 });
  markFx(iceTex, pos, radius * 0.72, [0.72, 0.92, 1.15], 5000, { peak: 0.5, grow: 0.08, rim: [1.2, 1.9, 2.8] });
  iceSpikesFx(pos, radius * 0.7, 90, { dur: 2600, scale: 1.7 });
  sparksFx(pos, 260, [ICE, ICE_W], radius * 1.6, { up: 8, size: 0.55, life: 1.2, drag: 1.6 });
}

// Frostschlag: harter Treffer auf dem ersten Ziel, Eis auf jedem weiteren
export function froststrikeOpen(pos) {
  hitstop();
  impact(pos, 0x9fdcff, { radius: 9, power: 520, kickBy: 0.5, sound: 'frost', volume: 1.2 });
  flareFx(pos, 0xc8ecff, 9, 340);
  shellFx(pos, 5, ICE_W, { dur: 340, squash: 1, y: 1 });
}
export function frostHit(pos) {
  iceSpikesFx(pos, 1.5, 8, { dur: 1400, scale: 0.8 });
  sparksFx(pos, 12, [ICE, ICE_W], 6, { up: 4, size: 0.26, y: 1.5, life: 0.4 });
}

// Entweihen: dunkler Einsturz, danach steigt Schatten aus dem Siegel
export function desecrateOpen(pos, radius) {
  impact(pos, 0x7a2fd0, { radius: radius * 2, power: 520, kickBy: 0.5 });
  shockwave(pos, radius * 2, -0.05, 520);
  flareFx(pos, 0x7a2fd0, radius * 2.2, 420);
  shellFx(pos, radius * 1.6, SHADOW, { dur: 460, squash: 0.5 });
  columnFx(pos, radius * 0.7, 18, SHADOW, VOID, { dur: 760, top: 0.3, grow: 0.15, scroll: 1.7 });
  sparksFx(pos, 110, [SHADOW, VOID], radius * 2.2, { up: 6, size: 0.42, life: 1, drag: 1.8 });
}

// Feuernova: wandernde Flammenwand als Visual der Fläche, wächst mit f.radius
export function firenovaOpen(pos) {
  hitstop();
  impact(pos, 0xff7020, { radius: 24, power: 780, kickBy: 0.7, sound: 'fire', volume: 1.4 });
  shockwave(pos, 26, 0.06, 900);
  flareFx(pos, 0xff7a20, 24, 480);
}
export function fireWallVisual() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 128, 6, true).translate(0, 0.5, 0);
  const mat = columnMaterial(HOT, EMBER, { scroll: 2.1, dens: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  let lastLight = 0;
  return {
    update(pos, radius) {
      mesh.position.set(pos.x, groundAt(pos.x, pos.z, pos.y) - 0.2, pos.z);
      const r = Math.max(0.1, radius);
      mesh.scale.set(r, 4.5, r);
      if (fxClock.now - lastLight > 160) {   // Der Feuerring erhellt den Boden in Blickrichtung
        lastLight = fxClock.now;
        cameraKick(0.05);
        lightFlash(pos, 0xff7020, 220, r * 1.6 + 8, 200);
      }
    },
    remove() { addEffect(mesh, 320, t => { mat.uniforms.uAlpha.value = 1 - t; mat.uniforms.uDis.value = t; }); },
  };
}

// Knochengefängnis: runde Knochen brechen nacheinander aus dem Boden, nach innen geneigt
const boneGeo = spikeGeometry(0.34, 3.6);
export function boneRingNew(pos, radius) {
  const n = Math.ceil(radius * 3.4);
  const { mesh, mat } = spikeRing(i => {
    const a = i / n * 6.283, x = pos.x + Math.cos(a) * radius, z = pos.z + Math.sin(a) * radius;
    return { x, y: groundAt(x, z, pos.y) - 0.2, z, tiltX: Math.sin(a) * 0.34, tiltZ: -Math.cos(a) * 0.34, scale: rand(0.85, 1.25) };
  }, n, boneGeo, { deep: [0.52, 0.47, 0.36], light: [1.25, 1.17, 0.95], rimPow: 2.2 });
  scene.add(mesh);
  impact(pos, 0xe0d0a0, { radius: radius * 1.3, power: 420, kickBy: 0.5 });
  waveFx(pos, radius, [1.5, 1.35, 1], [0.7, 0.6, 0.4], { dur: 420, width: 0.3 });
  sparksFx(pos, 90, [[0.55, 0.5, 0.4]], radius * 1.5, { up: 4, size: 1.1, life: 0.9, drag: 2.2, grow: 1 });
  const born = fxClock.now;
  let done = false;
  const tick = () => {
    if (done) return;
    const k = Math.min(1, (fxClock.now - born) / 260);
    mat.uniforms.uGrow.value = Math.max(0.001, 1 - (1 - k) * (1 - k) * (1 - k));
  };
  return {
    update: tick,
    remove() {
      done = true;
      scene.remove(mesh);
      (mesh as any).sharedGeometry = true;
      addEffect(mesh, 420, t => { mat.uniforms.uDis.value = t; });
    },
  };
}
