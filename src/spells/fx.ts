// Bausteine für Dauerflächen, Blitze und Explosionen der neuen Spells, im Stil von fx/spellFx.ts

import * as THREE from 'three';
import { rand, pick, perFrame } from '../util';
import { scene } from '../render';
import { terrainDecal, drape } from '../world';
import { groundAt } from '../collision';
import { particles, glowSprite } from '../fx/particles';
import { flashFx, ringFx, addEffect } from '../fx/spellFx';

export const FIRE = [2.4, 0.9, 0.15], EMBER = [2.2, 0.45, 0.08], SHADOW = [0.8, 0.15, 1.5], VOID = [0.35, 0.05, 0.9];
export const NATURE = [0.5, 2, 0.8], BOLT = [1.3, 1.7, 2.8], BOLT_WHITE = [2.2, 2.4, 2.8], BONE = [1.9, 1.75, 1.3];
export const ICE = [0.35, 1, 2.1], ICE_WHITE = [1.1, 1.5, 2.1];

// Bodenfläche, die dem Gelände folgt. Bleibt, bis remove() läuft.
// Gedreht wird die Textur, nicht das Mesh, sonst passt die Höhe der Ecken nicht mehr zum Gelände.
export function fieldDecal(tex, color, opacity = 0.5, spin = 0) {
  const map = tex.clone();
  map.center.set(0.5, 0.5);
  map.needsUpdate = true;
  const mesh = terrainDecal(new THREE.RingGeometry(0, 1, 40, 5), new THREE.MeshBasicMaterial({
    map, color: new THREE.Color(...color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(mesh);
  return {
    update(pos, radius) {
      drape(mesh, pos, radius);
      map.rotation = performance.now() / 1000 * spin;
    },
    remove() { scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as any).dispose(); map.dispose(); },
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

// Mehrere Visuals als eins
export const visuals = (...list) => ({
  update: (pos, r) => list.forEach(v => v.update(pos, r)),
  remove: () => list.forEach(v => v.remove()),
});
