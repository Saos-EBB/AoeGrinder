// Strichkrieger-Optik aus dem Spell-Viewer (spell-viewer-krieger): Ansturm, Donnerknall, Einschüchterungsruf, Berserker.
// Hiebe, Ringe, Einschlag und Wut-Aura macht das Modell selbst (models/strichKrieger.ts). Nur Optik, alle Zahlen // PH

import * as THREE from 'three';
import { player, state } from '../state';
import { mage } from '../models/mage';
import { fx, em, uK, ring, spark, sparks, outC, TAU, PAL, EU, fwd } from './energy';
import { gy, onGround } from './fireLook';
import { V } from '../util';

const UP = V(0, 1, 0);

// Ansturm: Schweif-Kegel hinter der Figur und Nachbilder, solange sie rennt
export function chargeLook(ms: number) {
  let gi = -1;
  fx(ms / 1000 + .15, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'cone', PAL.wut, { sc: 4, core: .3, tip: 1.1, flow: [0, 4, 0] });
    const m = e.ms[0]; m.position.copy(player.pos).add(V(0, 1, 0)); m.quaternion.setFromUnitVectors(UP, fwd().negate()); m.scale.set(.6, 3 * Math.sin(Math.PI * Math.min(1, k * 1.1)), .6); uK(m, 1 - k * .6);
    const g = Math.floor(k * 6); if (g > gi && k < .95) { gi = g; mage.hero?.fx?.ghost?.(); sparks(onGround(player.pos).setY(gy(player.pos) + .1), 3, PAL.staub, { v: [0, 1, 0], grav: 6, life: .5, spread: .4, band: 2, glow: .6 }); }
  });
}
// Ansturm-Treffer: goldener Ring und Funken-Kugel am Ziel
export function chargeHit(at: THREE.Vector3) {
  ring(onGround(at), 2.5, PAL.donner, .45);
  sparks(V(at.x, at.y + 1, at.z), 20, PAL.donner, { v: [0, 3, 0], grav: 8, life: .6, spread: .5 });
  fx(.3, (k, _dt, e) => { if (!e.ms.length) em(e, 'sph', PAL.donner, { sc: 4, core: 1, flow: [0, 0, 0], local: true }); const m = e.ms[0]; m.position.set(at.x, at.y + 1.1, at.z); m.scale.setScalar(.6 + 1.1 * k); uK(m, 1 - k); });
}
// Donnerknall: goldene Ringe und Kuppel
export function clapLook(r: number) {
  const o = onGround(player.pos);
  ring(o, r, PAL.donner, .6); ring(o, r * .7, PAL.donner, .45);
  sparks(o.clone().setY(o.y + .1), 40, PAL.donner, { v: [0, 4, 0], grav: 12, life: .7, spread: r * .5 });
  fx(.55, (k, _dt, e) => { if (!e.ms.length) em(e, 'hemi', PAL.donner, { sc: 2 / Math.max(1, r * .3), core: -.8, flow: [0, 3, 0], side: THREE.DoubleSide }).position.copy(o); const m = e.ms[0], s = .5 + r * .75 * outC(k); m.scale.set(s, 1.4 * (1 - k), s); uK(m, 1 - k); });
}
// Einschüchterungsruf: dunkle Welle und Kegel aus dem Mund
export function shoutLook(r: number) {
  const o = onGround(player.pos);
  ring(o, r, PAL.furcht, .8);
  fx(.8, (k, _dt, e) => { if (!e.ms.length) em(e, 'sph', PAL.furcht, { sc: 1.6 / Math.max(1, r * .2), core: -1, flow: [0, 1, 0], side: THREE.DoubleSide }).position.copy(o).add(V(0, .6, 0)); const s = .5 + r * outC(k); e.ms[0].scale.set(s, s * .3, s); uK(e.ms[0], 1 - k); });
  fx(.7, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'cone', PAL.furcht, { sc: 4, core: .4, tip: 1, flow: [0, 0, 0], local: true });
    const m = e.ms[0], f = fwd(); m.position.copy(player.pos).add(V(0, 1.75, 0)).addScaledVector(f, .3); m.quaternion.setFromUnitVectors(UP, f); m.scale.set(.7 * outC(k), 2.6 * outC(k), .7 * outC(k)); uK(m, 1 - k);
  });
}
// Berserker: Explosion beim Start, 14 kreisende Flammenzungen für die ganze Dauer (die Hülle macht das Modell über anim.berserk)
export function berserkLook(isOn: () => boolean) {
  const o = player.pos.clone();
  ring(onGround(o), 9, PAL.wut, .8);
  fx(.5, (k, _dt, e) => { if (!e.ms.length) em(e, 'sph', PAL.wut, { sc: 2, core: .6, flow: [0, 3, 0], puff: .05 }); const m = e.ms[0]; m.position.copy(player.pos).add(V(0, 1, 0)); m.scale.setScalar(.6 + 2.8 * outC(k)); uK(m, 1 - k); });
  sparks(o.clone().setY(o.y + .3), 70, PAL.wut, { v: [0, 6, 0], grav: 2, life: 1.4, spread: 1 });
  fx(1e9, (k, _dt, e) => {
    if (!e.ms.length) for (let i = 0; i < 14; i++) { const m = em(e, 'cone', PAL.wut, { sc: 4, core: .35, tip: 1.1, puff: .05, flow: [0, 3.2, 0] }); m.userData.i = i; }
    const T = EU.uTime.value, on = isOn() && !player.dead, f = on ? Math.min(1, e.a * 5) : Math.max(0, 1 - (e.a - (e.off ??= e.a)) * 4);
    const g = onGround(player.pos);
    for (const m of e.ms) { const i = m.userData.i, a = i / 14 * TAU + T; m.position.set(g.x + Math.cos(a) * 1.3, g.y, g.z + Math.sin(a) * 1.3); m.scale.set(.25, (.9 + .3 * Math.sin(T * 9 + i)) * f, .25); }
    if (on) e.off = undefined; else if (f <= 0) e.dur = 0;
  });
}
export const berserkOn = () => (player.berserkUntil ?? 0) > state.now;
