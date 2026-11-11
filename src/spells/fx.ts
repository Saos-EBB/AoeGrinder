// Bausteine für Dauerflächen, Blitze und Explosionen der neuen Spells, im Stil von fx/spellFx.ts

import * as THREE from 'three';
import { rand, pick, perFrame } from '../util';
import { scene } from '../render';
import { terrainDecal, drape } from '../world';
import { groundAt } from '../collision';
import { particles, glowSprite } from '../fx/particles';
import { flashFx, ringFx, addEffect, fxClock } from '../fx/spellFx';
import { fxMaterial, GLSL, FX_VERTEX, vfxOld } from '../fx/shaders';
import { bolt } from '../fx/bolts';
import { zapLook } from '../vfx/boltLook';
import { playSound } from '../fx/sound';
import { impact, lightFlash } from '../fx/impact';
import { waveFx, shellFx, flareFx, sparksFx, groundDisc } from '../fx/prims';

export const FIRE = [2.4, 0.9, 0.15], EMBER = [2.2, 0.45, 0.08], SHADOW = [0.8, 0.15, 1.5], VOID = [0.35, 0.05, 0.9];
export const BOLT = [1.3, 1.7, 2.8];
const BOLT_WHITE = [2.2, 2.4, 2.8];
export const ICE = [0.35, 1, 2.1], ICE_WHITE = [1.1, 1.5, 2.1];

// Bodenfläche, die dem Gelände folgt. Bleibt, bis remove() läuft.
// Gedreht wird die Textur, nicht das Mesh, sonst passt die Höhe der Ecken nicht mehr zum Gelände.
export function fieldDecal(tex, color, opacity = 0.5, spin = 0) {
  if (!vfxOld()) return fieldDecalNew(tex, color, opacity, spin);
  const map = tex.clone();
  map.center.set(0.5, 0.5);
  map.needsUpdate = true;
  const mesh = terrainDecal(new THREE.RingGeometry(0, 1, 40, 5), new THREE.MeshBasicMaterial({
    map, color: new THREE.Color(...color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(mesh);
  return {
    update(pos, radius) {
      drape(mesh, pos, radius);
      map.rotation = fxClock.now / 1000 * spin;
    },
    remove() { scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as any).dispose(); map.dispose(); },
  };
}

// Fläche mit Textur und ziehendem Rauschen, blendet ein und aus. Aufgelegt wird nur, wenn sie sich bewegt.
function fieldDecalNew(tex, color, opacity, spin) {
  const mat = fxMaterial({ uniforms: { map: { value: tex }, uC: { value: new THREE.Vector3(...color) }, uAlpha: { value: 0 }, uSpin: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `${GLSL.common} uniform sampler2D map; uniform vec3 uC; uniform float uAlpha, uSpin; varying vec2 vUv;
      void main() {
        vec2 q = vUv - 0.5; float r = length(q) * 2.0, cs = cos(uSpin), sn = sin(uSpin);
        float tx = texture2D(map, vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs) + 0.5).a;
        float n = noise2(q * 1.2 + scrollUv(vec2(0.1), vec2(0.04, -0.07)));
        gl_FragColor = vec4(uC * tx * (0.45 + n * 1.1) * uAlpha * (1.0 - smoothstep(0.9, 1.0, r)), 1.0);
      }` });
  let mesh = null, lx = NaN, lz = NaN, lr = 0;
  const born = fxClock.now;
  return {
    update(pos, radius) {
      if (!mesh) { mesh = groundDisc(pos, radius, mat, 64, 8); scene.add(mesh); lx = pos.x; lz = pos.z; lr = radius; }
      else if (Math.abs(pos.x - lx) + Math.abs(pos.z - lz) + Math.abs(radius - lr) > 0.02) { drape(mesh, pos, radius); lx = pos.x; lz = pos.z; lr = radius; }
      mat.uniforms.uSpin.value = fxClock.now / 1000 * spin;
      mat.uniforms.uAlpha.value = opacity * Math.min(1, (fxClock.now - born) / 280);
    },
    remove() {
      if (!mesh) return mat.dispose();
      addEffect(mesh, 380, t => { mat.uniforms.uAlpha.value = opacity * (1 - t); });
    },
  };
}

// Partikel gleichmäßig über eine Fläche, Rate pro Sekunde
export function areaParticles(pos, radius, rate, dt, colors, { up = 3, size = 0.3, life = 0.9, swirl = 0 } = {}) {
  for (let i = perFrame(rate, dt); i > 0; i--) {
    const a = rand(0, Math.PI * 2), d = radius * Math.sqrt(Math.random());
    const x = pos.x + Math.cos(a) * d, z = pos.z + Math.sin(a) * d;
    particles.spawn({ x, y: groundAt(x, z, pos.y) + rand(0.1, 0.8), z, vx: -Math.sin(a) * swirl, vy: rand(up * 0.4, up), vz: Math.cos(a) * swirl,
      life: rand(life * 0.6, life), color: pick(colors), size: rand(size * 0.5, size) });
  }
}

export function burstFx(pos, radius, colors, flash) {
  if (!vfxOld()) {
    const c = new THREE.Color(flash);
    impact(pos, flash, { radius, power: 220 + radius * 18, kickBy: Math.min(0.4, 0.08 + radius * 0.02), sound: c.b > c.r ? (c.g > 0.5 ? 'frost' : 'impact') : 'fire' });
    flareFx(pos, flash, Math.min(16, radius * 1.1), 320);
    waveFx(pos, radius, colors[0], colors[1] ?? colors[0], { dur: 460, width: 0.32 });
    shellFx(pos, radius, colors[0], { dur: 440, squash: 0.6 });
    sparksFx(pos, Math.min(170, 50 + radius * 10), colors, radius * 2.1, { up: 3.5, size: 0.5 });
    return;
  }
  flashFx(new THREE.Vector3(pos.x, pos.y + 1, pos.z), flash, Math.min(12, radius * 0.7), 260);
  ringFx(pos, radius, colors[0], 400);
  for (let i = 0; i < Math.min(220, 60 + radius * 12); i++) {
    const a = rand(0, Math.PI * 2), sp = rand(radius * 1.1, radius * 2.1);
    particles.spawn({ x: pos.x, y: pos.y + rand(0.2, 1.2), z: pos.z, vx: Math.cos(a) * sp, vy: rand(0, 3), vz: Math.sin(a) * sp,
      drag: 2.6, life: rand(0.45, 0.8), color: pick(colors), size: rand(0.25, 0.6) });
  }
}

// Gezackter Blitz zwischen zwei Punkten
export function boltFx(from, to, color = BOLT_WHITE, dur = 180) {
  if (!vfxOld() && (color === BOLT_WHITE || color === BOLT)) { zapLook(from, to); playSound('zap'); return; }   // Blitz-Look aus dem Spell-Viewer (vfx/boltLook.ts)
  if (!vfxOld()) {
    const end = { x: to.x, y: to.y + 1.2, z: to.z };
    bolt({ x: from.x, y: from.y + 1.2, z: from.z }, end, color === BOLT_WHITE ? BOLT : color, { life: dur + 90 });
    lightFlash(end, 0xbfd8ff, 90, 14, 130);
    playSound('zap');
    for (let i = 0; i < 6; i++) particles.spawn({ x: end.x, y: end.y, z: end.z, vx: rand(-5, 5), vy: rand(-1, 5), vz: rand(-5, 5), grav: 9, drag: 1.5, life: rand(0.15, 0.32), color: BOLT_WHITE, size: rand(0.1, 0.22) });
    return;
  }
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n, jitter = i === 0 || i === n ? 0 : 0.6;
    pts.push(new THREE.Vector3(from.x + (to.x - from.x) * t + rand(-jitter, jitter), from.y + 1.2 + (to.y - from.y) * t + rand(-jitter, jitter), from.z + (to.z - from.z) * t + rand(-jitter, jitter)));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: new THREE.Color(...color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  addEffect(line, dur, t => { (line.material as any).opacity = 1 - t; });
}

// Leuchtkugel als Dauerflächen-Visual
export function orbVisual(spriteColor, size, darkCore = false) {
  if (!vfxOld()) return orbNew(spriteColor, size, darkCore);
  const sp = glowSprite(spriteColor, size);
  scene.add(sp);
  const core = darkCore ? new THREE.Mesh(new THREE.SphereGeometry(size * 0.22, 16, 12), new THREE.MeshBasicMaterial({ color: 0x050008 })) : null;
  if (core) scene.add(core);
  const set = pos => {
    sp.position.set(pos.x, groundAt(pos.x, pos.z, pos.y) + 1.6, pos.z);
    core?.position.copy(sp.position);
  };
  return {
    update: set,
    remove() {
      scene.remove(sp); sp.material.dispose();
      if (core) { scene.remove(core); core.geometry.dispose(); (core.material as any).dispose(); }
    },
  };
}

// Glatte Kugel: Fresnel-Rand, ziehendes Rauschen im Innern, darum ein Glühen. Mit dunklem Kern für die Leere.
const orbGeo = new THREE.SphereGeometry(1, 64, 40);
function orbNew(spriteColor, size, darkCore) {
  const c = new THREE.Color(spriteColor), tint = new THREE.Vector3(c.r * 3, c.g * 3, c.b * 3), body = size * 0.27;
  const mat = fxMaterial({ uniforms: { uC: { value: tint }, uDark: { value: darkCore ? 1 : 0 } }, vertexShader: FX_VERTEX, additive: !darkCore,
    fragmentShader: `${GLSL.common} uniform vec3 uC; uniform float uDark; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = fresnel(vN, vV, uDark > 0.5 ? 2.6 : 1.8);
        float n = noise2(vUv * vec2(3.0, 2.0) + scrollUv(vec2(0.0), vec2(0.25, -0.4)));
        vec3 inner = uDark > 0.5 ? vec3(0.008, 0.0, 0.016) + uC * 0.1 * pow(n, 4.0) : uC * (0.2 + n * 0.6);
        gl_FragColor = vec4(inner + uC * f * 1.1, 1.0);
      }` });
  if (darkCore) mat.transparent = false;
  const mesh = new THREE.Mesh(orbGeo, mat), glow = glowSprite(spriteColor, size * 1.2);
  (glow.material as any).opacity = 0.75;
  scene.add(mesh, glow);
  const born = fxClock.now;
  return {
    update(pos) {
      const k = Math.min(1, (fxClock.now - born) / 240), bob = Math.sin(fxClock.now * 0.003) * 0.08;
      mesh.position.set(pos.x, groundAt(pos.x, pos.z, pos.y) + 1.6 + bob, pos.z);
      mesh.scale.setScalar(Math.max(0.01, body * k));
      glow.position.copy(mesh.position);
      glow.scale.setScalar(size * 1.2 * k);
    },
    remove() {
      scene.remove(glow);
      glow.material.dispose();
      (mesh as any).sharedGeometry = true;
      const s0 = mesh.scale.x;
      addEffect(mesh, 220, t => { mesh.scale.setScalar(Math.max(0.01, s0 * (1 - t * t))); });
    },
  };
}

// Mehrere Visuals als eins
export const visuals = (...list) => ({
  update: (pos, r) => list.forEach(v => v.update(pos, r)),
  remove: () => list.forEach(v => v.remove()),
});
