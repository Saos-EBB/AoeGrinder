// Seuche-Optik aus dem Spell-Viewer (SPELLS.plague): Schlammwurf, Schleimfalle, Schleimwelle, Schwarzes Loch, Giftwolke, Klebefaden,
// Zusammenziehen, Entziehen, Platzen, Zerfließen, Pestilenz. Nur Optik, alle Zahlen // PH

import * as THREE from 'three';
import { groundAt } from '../collision';
import { player, state } from '../state';
import { fx, em, uK, lay, field, boom, shot, sparks, env, outC, outBack, rnd, TAU, PAL, EU, after } from './energy';
import { gy, onGround, castFrom } from './fireLook';
import { surgeLook } from './arcaneLook';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const chest = (p: { x: number; y: number; z: number }) => V(p.x, p.y + 1.1, p.z);

// Schlammwurf: Schleimklumpen im Bogen, Platscher
export function sludgeLook(to: THREE.Vector3, r = 2) {
  const a = castFrom(), b = chest(to);
  shot(a, b, 0, PAL.slime, { r: .26, tail: 1.4, arc: 1.2, dur: Math.min(.4, Math.max(.12, a.distanceTo(b) / 35)), hit: p => { boom(p, Math.max(1, r * .6), PAL.slime, .35, { ground: gy(to), n: 12 }); sparks(p, 10, PAL.slime, { v: [0, 2, 0], grav: 9, life: .6, spread: .3 }); } });
}
// Schleimfalle: Fläche, Schleimzungen schnappen hoch
export function slimeTrapField() {
  return field(e => {
    em(e, 'gdisk', PAL.slime, { sc: 1.6 / Math.max(1, e.r * .25), core: 0, edge: 1.4, flow: [.2, 0, .1] });
    for (let i = 0; i < 14; i++) { const m = em(e, 'cone', PAL.slime, { sc: 5, core: .5, tip: .8, puff: .05, flow: [0, 1.5, 0] }); const a = i / 14 * TAU, d = rnd(.2, .95); m.userData = { o: [Math.cos(a) * d, Math.sin(a) * d], h: rnd(.8, 1.6), ph: i }; }
    sparks(V(e.pos.x, gy(e.pos) + .3, e.pos.z), 30, PAL.slime, { v: [0, 3, 0], grav: 8, life: .6, spread: e.r });
  }, (e, fade) => {
    const T = EU.uTime.value, snap = Math.min(1, Math.max(0, (e.a - .1) * 6));
    lay(e.ms[0], e.pos, e.r); uK(e.ms[0], .9 * fade);
    for (const m of e.ms.slice(1)) {
      const x = e.pos.x + m.userData.o[0] * e.r, z = e.pos.z + m.userData.o[1] * e.r;
      m.position.set(x, groundAt(x, z, e.pos.y + 1), z); m.rotation.z = .3 * Math.sin(T * 5 + m.userData.ph);
      m.scale.set(.2 * snap, m.userData.h * snap * fade * (1 + .2 * Math.sin(T * 8 + m.userData.ph)), .2 * snap);
    }
  });
}
// Schleimwelle: Wellen-Segment in Schleim
export function slimeWaveLook(from: THREE.Vector3, len: number, width: number) { surgeLook(from, len, width, PAL.slime); }
// Schwarzes Loch: dunkle Kugel + grüner Ring, Partikel werden hineingezogen; Aufprall: holeImpact
export function blackHoleField() {
  return field(e => {
    em(e, 'sph', PAL.void, { sc: 3, core: 1.2, local: true, flow: [0, 0, 0] });
    em(e, 'torus', PAL.slime, { sc: 5, core: .3, local: true, flow: [2, 0, 0] });
  }, (e, fade, dt) => {
    const c = V(e.pos.x, gy(e.pos) + 1.6, e.pos.z), g = outBack(Math.min(1, e.a * 4)) * fade;
    const [core, rg] = e.ms;
    core.position.copy(c); core.scale.setScalar(1 * g); core.rotation.y -= dt * 5;
    rg.position.copy(c); rg.scale.setScalar(1.7 * g); rg.rotation.x = 1.2; rg.rotation.z += dt * 6;
    if (Math.random() < dt * 50 * fade) { const q = c.clone().add(V(rnd(-1, 1), rnd(-.6, .6), rnd(-1, 1)).normalize().multiplyScalar(e.r * .6)); const v = c.clone().sub(q).multiplyScalar(2.5); sparks(q, 1, Math.random() < .5 ? PAL.void : PAL.slime, { v: [v.x, v.y, v.z], grav: 0, life: .4, spread: .05, band: 3 }); }
  });
}
export const holeImpact = (to: THREE.Vector3, r: number) => boom(chest(to).setY(gy(to) + .5), r, PAL.slime, .55, { ground: gy(to), n: 30 });
// Giftwolke: 9 aufgeblähte Kugeln am Boden
export function poisonCloudField() {
  return field(e => {
    for (let i = 0; i < 9; i++) { const m = em(e, 'sph', PAL.gift, { sc: 1.8 / Math.max(1, e.r * .2), core: .5, puff: .08, flow: [.3, .6, 0] }); const a = i / 9 * TAU, d = i ? rnd(.4, .8) : 0; m.userData = { o: [Math.cos(a) * d, Math.sin(a) * d], s: rnd(.8, 1.3), ph: i }; }
  }, (e, fade) => {
    const T = EU.uTime.value, s0 = e.r * .32;   // kleiner als im Viewer: von oben wird die Wolke sonst eine Masse
    for (const m of e.ms) {
      const x = e.pos.x + m.userData.o[0] * e.r, z = e.pos.z + m.userData.o[1] * e.r, s = m.userData.s * s0 * outBack(Math.min(1, e.a * 4)) * (1 + .06 * Math.sin(T * 3 + m.userData.ph));
      m.position.set(x, groundAt(x, z, e.pos.y + 1) + s * .35, z); m.scale.set(s * 1.1, s * .65, s * 1.1); uK(m, .7 * fade);
    }
  });
}
// Klebefaden: Fäden zwischen den Angeketteten, solange die Kette hält; pulsieren
export function webLook(all: [any, any][], ms: number) {
  const pairs = all.slice(0, 24);   // PH: höchstens so viele Fäden
  fx(ms / 1000, (k, _dt, e) => {
    if (!e.ms.length) for (const _ of pairs) em(e, 'cyl', PAL.slime, { sc: 6, core: .6, local: true, flow: [0, 1, 0] });
    const T = EU.uTime.value;
    pairs.forEach(([a, b], i) => {
      const m = e.ms[i], p = chest(a.pos), q = chest(b.pos), d = q.clone().sub(p), L = d.length();
      if (a.dead || b.dead || L < .1) { m.visible = false; return; }
      const w = .07 * (1 + .4 * Math.max(0, Math.sin(T * 6 + i)));
      m.visible = true; m.position.copy(p); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.scale.set(w, L * Math.min(1, e.a * 6), w); uK(m, env(k, .05, .1));
    });
  });
}
// Zusammenziehen: Fäden zu einem Punkt, Schleim-Fleck in der Mitte
export function contractLook(from: THREE.Vector3[], center: THREE.Vector3) {
  const c = chest(center);
  fx(.6, (k, _dt, e) => {
    if (!e.ms.length) for (const _ of from) em(e, 'cyl', PAL.slime, { sc: 6, core: .6, local: true, flow: [0, 2, 0] });
    from.forEach((p0, i) => { const p = chest(p0).lerp(c, outC(k)), d = c.clone().sub(p), L = d.length(), m = e.ms[i]; m.position.copy(p); if (L > .01) m.quaternion.setFromUnitVectors(UP, d.normalize()); m.scale.set(.08, Math.max(.01, L), .08); uK(m, 1 - k); });
  }, () => boom(c.setY(gy(center) + .4), 2.5, PAL.slime, .6, { ground: gy(center), n: 30 }));
}
// Entziehen: Lebens-Kugeln fliegen von den Mobs zu dir, grüne Säule an dir
export function drainLook(from: THREE.Vector3[], stacks: number[]) {
  from.forEach((p, i) => {
    const n = stacks[i];
    boom(chest(p), .5 + .2 * n, PAL.gift, .4, { ground: gy(p), n: 8 });
    for (let j = 0; j < 1 + n; j++) after(i * .04 + j * .07 + .001, () => {
      const a = chest(p), b = chest(player.pos);
      shot(a, b, 0, PAL.drain, { r: .1 + .03 * n, tail: 2, dur: Math.min(.5, a.distanceTo(b) / 22), curve: V(rnd(-1, 1), rnd(.3, 1.2), rnd(-1, 1)) });
    });
  });
  after(.35, () => fx(.8, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'cyl', PAL.slime, { sc: 3, core: -.5, flow: [0, 3, 0], side: THREE.DoubleSide, tip: 1 });
    const m = e.ms[0]; m.position.copy(onGround(player.pos)); m.scale.set(.9, 3 * outC(k), .9); uK(m, 1 - k);
  }));
}
// Platzen: Gift-Explosion pro markiertem Mob, Größe nach Stapeln
export function burstLook(p: THREE.Vector3, stacks: number, delay = 0) {
  after(delay + .001, () => boom(chest(p), .9 + .45 * stacks, PAL.gift, .55, { ground: gy(p), n: 20 }));
}
// Zerfließen: Schleim-Lache wächst mit dem Feld (die Figur wird flach, main.ts)
export function meltField() {
  return field(e => { em(e, 'gdisk', PAL.slime, { sc: 2.4 / Math.max(1, e.r * .25), core: 0, edge: 1.5, flow: [.3, 0, .2] }); }, (e, fade) => {
    lay(e.ms[0], e.pos, Math.max(.6, e.r)); uK(e.ms[0], .75 * fade);
    if (Math.random() < .3) sparks(V(e.pos.x, gy(e.pos) + .1, e.pos.z), 1, PAL.slime, { v: [0, .8, 0], grav: 3, life: .5, spread: Math.max(.6, e.r) });
  });
}
// Pestilenz: große hohle Gift-Kugel um die Figur
export function pestilenceLook(r: number) {
  const o = player.pos.clone();
  fx(1.2, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'sph', PAL.gift, { sc: 1.6 / Math.max(1, r * .2), core: -.8, flow: [0, 1, 0], side: THREE.DoubleSide });
    const m = e.ms[0]; m.position.copy(o); m.scale.setScalar(.5 + r * outC(k)); uK(m, (1 - k) * .9);
  });
}
