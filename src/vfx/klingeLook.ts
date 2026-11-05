// Klingenstrich-Optik aus dem Spell-Viewer (spell-viewer-klinge): Kunai, Klingensturm, Konter, Iaido, Rauchbombe.
// Sicheln, Linien, Ringe, Wirbel, Haltung-3-Hülle und Klone macht das Modell (models/klingeModel.ts). Nur Optik, alle Zahlen // PH

import * as THREE from 'three';
import { player, state } from '../state';
import { fx, em, uK, arc, boom, streak, sparks, outC, outBack, rnd, TAU, PAL, EU } from './energy';
import { gy } from './fireLook';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const palOf = (stance: number) => stance > 1 ? PAL.blut : PAL.stahl;

// Kunai: ein Messer (Kegel, Stahl) fliegt bis zum Ziel
export function kunaiLook(to: { x: number; z: number }) {
  const a = V(player.pos.x, player.pos.y + 1.2, player.pos.z), b = V(to.x, a.y, to.z), dir = b.clone().sub(a).normalize();
  fx(Math.min(.4, Math.max(.08, a.distanceTo(b) / 45)), (k, _dt, e) => {
    if (!e.ms.length) { const m = em(e, 'cone', PAL.stahl, { sc: 8, core: .8, local: true, flow: [0, 0, 0] }); m.scale.set(.07, .45, .07); m.quaternion.setFromUnitVectors(UP, dir); }
    e.ms[0].position.lerpVectors(a, b, k);
  }, () => sparks(b, 6, PAL.stahl, { v: [0, 1, 0], grav: 6, life: .3, spread: .2, band: 4 }));
}
// Klingensturm: kreisende Klingen an den Spiel-Positionen, solange er läuft; pos(i) liefert die Lage, isOn() die Dauer
export function stormLook(n: number, pos: (i: number) => { x: number; y: number; z: number }, isOn: () => boolean, stance: () => number) {
  fx(1e9, (k, _dt, e) => {
    if (!e.ms.length) for (let i = 0; i < n; i++) { const m = em(e, 'cone', palOf(stance()), { sc: 6, core: .8, local: true, flow: [0, 0, 0] }); m.userData.i = i; }
    const on = isOn(), g = on ? outBack(Math.min(1, e.a * 5)) : 0;
    for (const m of e.ms) {
      const p = pos(m.userData.i), dx = p.x - player.pos.x, dz = p.z - player.pos.z, a = Math.atan2(dx, dz);
      m.position.set(p.x, p.y + 1 + .15 * Math.sin(a * 3), p.z); m.quaternion.setFromUnitVectors(UP, V(Math.cos(a), 0, -Math.sin(a))); m.scale.set(.25 * g, 1.3 * g, .25 * g);
    }
    if (!on) e.dur = 0;
  });
}
// Aderlass zündet den Sturm: jede Klinge platzt als Blut-Explosion
export const stormBoom = (p: { x: number; y: number; z: number }, r: number) => boom(V(p.x, p.y + 1, p.z), r, PAL.blut, .45, { ground: p.y, n: 16 });
// Konter: Schild-Kugel (Stahl) während der Parade
export function parryLook(isOn: () => boolean) {
  fx(1e9, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'sph', PAL.stahl, { sc: 5, core: -1, flow: [0, 1, 0], side: THREE.DoubleSide });
    const m = e.ms[0]; m.position.copy(player.pos).add(V(0, 1.1, 0)); m.scale.setScalar(1.35 * outBack(Math.min(1, e.a * 6))); uK(m, .9);
    if (!isOn()) e.dur = 0;
  });
}
// Gegenschlag: Funke und Sichel im Kegel vor der Figur
export function counterLook(r: number, stance: number) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, player.facing, 0, 'YXZ'));
  boom(V(player.pos.x, player.pos.y + 1.2, player.pos.z), .8, PAL.stahl, .3, { ground: player.pos.y, n: 10 });
  arc(V(player.pos.x, player.pos.y + 1.2, player.pos.z), q, r, 2.2, palOf(stance), .45);
}
// Iaido: langer Doppelstrich nach vorn (breit Stahl, schmal Blut)
export function iaidoLook(from: THREE.Vector3, to: THREE.Vector3) {
  streak(from, to, .3, PAL.stahl, .6); streak(from.clone().setY(from.y + .05), to.clone().setY(to.y + .05), .12, PAL.blut, .6);
  fx(.2, (k, _dt, e) => { if (!e.ms.length) em(e, 'sph', PAL.stahl, { sc: 6, core: 1, flow: [0, 0, 0] }).position.copy(from); e.ms[0].scale.setScalar(.6 + .8 * k); uK(e.ms[0], 1 - k); });
}
// Rauchbombe: 12 Rauchkugeln, solange die Figur verborgen ist
export function smokeLook(ms: number) {
  const o = player.pos.clone(), dur = ms / 1000 + .3;
  fx(dur, (k, _dt, e) => {
    if (!e.ms.length) for (let i = 0; i < 12; i++) { const m = em(e, 'sph', PAL.rauch, { sc: 1.8, core: .5, puff: .06, flow: [0, .8, 0] }); const a = i / 12 * TAU, r = i ? rnd(1, 2.4) : 0; m.userData = { x: o.x + Math.cos(a) * r, z: o.z + Math.sin(a) * r, s: rnd(.8, 1.4) }; }
    for (const m of e.ms) { const u = m.userData; m.position.set(u.x, gy(o) + .6 + k * .8, u.z); m.scale.setScalar(u.s * outBack(Math.min(1, e.a * 6)) * (1 + .3 * k)); uK(m, (k > .8 ? (1 - k) / .2 : 1) * .9); }
  });
}
