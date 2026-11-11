// Frost-Optik aus dem Spell-Viewer (SPELLS.ice): Frost Nova, Wirbel, Cone of Cold, Blizzard, Frostkugel, Eislanze, Frostblitz, Gletschernadel, Eisbarriere, Eisblock.
// Eiszeit hat keine Vorlage im Viewer: ihre Umbauten nutzen dieselben Bausteine (siehe Kommentare). Nur Optik, alle Zahlen // PH

import * as THREE from 'three';
import { groundAt } from '../collision';
import { player, state } from '../state';
import { fx, em, uK, lay, field, boom, shot, ring, sparks, env, outC, outBack, rnd, clamp, TAU, PAL, EU, after, fwd, flight, type Pal } from './energy';
import { gy, onGround, castFrom } from './fireLook';
import { V } from '../util';

const UP = V(0, 1, 0);

// Frost Nova: Eisring und Bodenfläche, Eiszacken wachsen nach außen
export function novaLook(pos: THREE.Vector3, r: number) {
  const o = onGround(pos), n = Math.round(clamp(10 + r * 1.6, 12, 30));
  sparks(o.clone().setY(o.y + .4), 40, PAL.ice, { v: [0, 1, 0], grav: 2, life: .8, spread: r * .8 });
  fx(1.6, (k, _dt, e) => {
    if (!e.ms.length) {
      em(e, 'gring', PAL.ice, { sc: 2.5 / Math.max(1, r * .3), core: 0, flow: [0, 0, 0] });
      em(e, 'gdisk', PAL.ice, { sc: 1.3 / Math.max(1, r * .25), core: 0, edge: 1.2, flow: [0, 0, 0] });
      for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd(-.1, .1), m = em(e, 'cone', PAL.ice, { sc: 6, core: .7, flow: [0, .3, 0], local: true }); m.userData = { a, h: rnd(.6, 1.4), t: rnd(.35, .95) }; const x = o.x + Math.cos(a) * r * m.userData.t, z = o.z + Math.sin(a) * r * m.userData.t; m.position.set(x, groundAt(x, z, o.y + 1), z); m.rotation.set(Math.sin(a) * .35, 0, -Math.cos(a) * .35); }
    }
    const rr = .3 + r * outC(Math.min(1, k * 3));
    lay(e.ms[0], o, rr, .08); uK(e.ms[0], 1 - k);
    lay(e.ms[1], o, rr); uK(e.ms[1], env(k, .05, .4) * .85);
    for (const m of e.ms.slice(2)) { const g = clamp((rr - r * m.userData.t) * 3 / Math.max(1, r * .2), 0, 1) * env(k, .01, .25); m.scale.set(.18, m.userData.h * g, .18); }
  });
}
// Kegel nach vorn (Cone of Cold; Arkanschlag mit Arkan-Palette; Ice Saber der Eiszeit als breiter Kegel)
export function coneLook(range: number, angle: number, pal: Pal = PAL.ice, dur = .9) {
  const o = player.pos.clone().add(V(0, 1, 0)).addScaledVector(fwd(), .4), w = Math.tan(Math.min(1.3, angle / 2));
  sparks(o.clone().addScaledVector(fwd(), range * .4), 40, pal, { v: [fwd().x * 10, 0, fwd().z * 10], grav: 0, life: .5, spread: range * .3 });
  fx(dur, (k, _dt, e) => {
    if (!e.ms.length) { const c = em(e, 'coneF', pal, { sc: 2.5 / Math.max(1, range * .2), core: .1, tip: -.8, flow: [0, 0, -5], side: THREE.DoubleSide }); c.position.copy(o); c.rotation.y = player.facing; }
    const c = e.ms[0], L = range * outC(Math.min(1, k * 3.5)); c.scale.set(L * w, L * w * .45, L); uK(c, 1 - k * k);
  });
}
// Ice Time Capsule (Eiszeit): Eiswelle als Linie, Eiszacken laufen nach vorn
export function capsuleLook(from: THREE.Vector3, to: THREE.Vector3, width: number) {
  const d = V(to.x - from.x, 0, to.z - from.z), L = d.length(), n = Math.round(L / 1.2);
  d.normalize();
  fx(1.2, (k, _dt, e) => {
    if (!e.ms.length) for (let i = 0; i < n; i++) { const m = em(e, 'cone', PAL.ice, { sc: 6, core: .7, flow: [0, .3, 0], local: true }); const s = rnd(-1, 1) * width * .4, x = from.x + d.x * (i + .5) * 1.2 - d.z * s, z = from.z + d.z * (i + .5) * 1.2 + d.x * s; m.position.set(x, groundAt(x, z, from.y + 1), z); m.userData = { t: i / n, h: rnd(.8, 1.6) }; m.rotation.set(rnd(-.3, .3), 0, rnd(-.3, .3)); }
    for (const m of e.ms) { const g = clamp((k * 2.5 - m.userData.t) * 4, 0, 1) * env(k, .01, .3); m.scale.set(.25, m.userData.h * g, .25); }
  });
}
// Blizzard: flache Wolke über dem Ziel, fallende Eissplitter, Frost am Boden. Ein Lauf zur Zeit
let bliz: any = null;
export function blizLook(point: THREE.Vector3, r: number) {
  blizStopLook();
  const st = { p: onGround(point), r, out: -1 };
  const e = fx(1e9, (k, dt, e) => {
    if (!e.ms.length) {
      const cl = em(e, 'sph', PAL.ice, { sc: 1.4 / Math.max(1, r * .2), core: .3, flow: [.6, 0, 0], local: true }); cl.userData.cloud = 1;
      em(e, 'gdisk', PAL.ice, { sc: 1.2 / Math.max(1, r * .25), core: 0, edge: 1.2, flow: [0, 0, 0] });
    }
    const fade = st.out >= 0 ? clamp(1 - (e.a - st.out) / .4, 0, 1) : clamp(e.a / .3, 0, 1), p = st.p;
    const [cl, fl] = e.ms; cl.position.set(p.x, p.y + 9, p.z); cl.scale.set(st.r * 1.05, 1.3, st.r * 1.05); cl.rotation.y += dt * .8; uK(cl, fade);
    lay(fl, p, st.r); uK(fl, Math.min(.85, e.a * 1.5) * fade);
    if (st.out < 0 && Math.random() < dt * (12 + st.r * 3)) {   // Splitter regnen
      const a = Math.random() * TAU, rr = st.r * Math.sqrt(Math.random()), x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, g = groundAt(x, z, p.y + 1);
      fx(.45, (kk, _d, e2) => { if (!e2.ms.length) { const m = em(e2, 'cone', PAL.ice, { sc: 8, core: .8, flow: [0, 0, 0], local: true }); m.rotation.x = Math.PI; m.scale.set(.1, .9, .1); } e2.ms[0].position.set(x + 1.5 * (1 - kk), g + 8.5 * (1 - kk) + .9, z); }, () => sparks(V(x, g + .1, z), 3, PAL.ice, { v: [0, 1.5, 0], grav: 4, life: .4, spread: .3 }));
    }
    if (st.out >= 0 && fade <= 0) e.dur = 0;
  });
  bliz = { e, st };
}
export function blizMoveLook(point: THREE.Vector3, r: number) { if (bliz) { bliz.st.p = onGround(point); bliz.st.r = r; } }
export function blizStopLook() { if (bliz && bliz.st.out < 0) bliz.st.out = bliz.e.a; bliz = null; }
// Gefrorener Boden (Eiszeit: Ice Age, Eisfeld; Frostauge-Blizzard): Eisfläche mit kleinen Zacken
export function iceGroundField() {
  return field(e => {
    em(e, 'gdisk', PAL.ice, { sc: 1.2 / Math.max(1, e.r * .25), core: 0, edge: 1.2, flow: [0, 0, 0] });
    for (let i = 0; i < Math.round(clamp(e.r * 1.2, 4, 16)); i++) { const m = em(e, 'cone', PAL.ice, { sc: 6, core: .7, flow: [0, .3, 0], local: true }); const a = Math.random() * TAU, d = Math.sqrt(Math.random()); m.userData.o = [Math.cos(a) * d, Math.sin(a) * d]; m.userData.h = rnd(.3, .7); m.rotation.set(rnd(-.4, .4), 0, rnd(-.4, .4)); }
  }, (e, fade) => {
    for (const m of e.ms) {
      if (!m.userData.o) { lay(m, e.pos, e.r); uK(m, .8 * fade); continue; }
      const x = e.pos.x + m.userData.o[0] * e.r * .9, z = e.pos.z + m.userData.o[1] * e.r * .9;
      m.position.set(x, groundAt(x, z, e.pos.y + 1), z); m.scale.set(.16, m.userData.h * fade, .16);
    }
  });
}
// Wirbel: 3 gegenläufig drehende Zylinder, Schnee kreist
export function whirlField(k = 1) {
  return field(e => {
    // Verhältnis wie im Viewer (Feld 3, Zylinder 1,6 / 2,2 / 1,1)
    for (const [r, h, s] of [[.53, 1.8, 1], [.73, 1.2, -1], [.37, 2.4, 1]]) { const m = em(e, 'cyl', PAL.ice, { sc: 2.2, core: .2, tip: .9, local: true, flow: [0, 0, 0], side: THREE.DoubleSide }); m.userData = { r, h: h * k, s }; }
  }, (e, fade, dt) => {
    const p = e.pos, g = gy(p);
    for (const m of e.ms) { m.position.set(p.x, g, p.z); m.scale.set(e.r * m.userData.r, m.userData.h, e.r * m.userData.r); m.rotation.y += dt * 7 * m.userData.s; uK(m, .9 * fade); }
    if (Math.random() < dt * 40 * fade) { const a = Math.random() * TAU; sparks(V(p.x + Math.cos(a) * e.r * .8, g + rnd(.2, 2.4), p.z + Math.sin(a) * e.r * .8), 1, PAL.ice, { v: [-Math.sin(a) * 6, .3, Math.cos(a) * 6], grav: 0, life: .5, spread: .1, band: 4 }); }
  });
}
// Frostkugel: große Kugel + Hülle, rollt langsam; Splitter fliegen zu den Mobs (frostSplinter); Explosion am Ende (boom)
export function frostOrbField(size = 1, pal: Pal = PAL.ice) {
  return field(e => {
    em(e, 'sph', pal, { sc: 3, core: .9, puff: .05, local: true, flow: [0, 0, 0] });
    em(e, 'sph', pal, { sc: 2, core: -.7, local: true, flow: [0, 0, 0], side: THREE.DoubleSide });
  }, (e, fade, dt) => {
    e.ms.forEach((m, i) => { m.position.set(e.pos.x, e.pos.y + 1.1, e.pos.z); m.scale.setScalar((i ? 1.15 : .75) * size * fade); m.rotation.y += dt * (i ? -3 : 2); m.rotation.x += dt * 1.3; });
  });
}
export const frostSplinter = (from: THREE.Vector3, to: THREE.Vector3) => shot(from.clone().setY(from.y + 1.1), to.clone().setY(to.y + 1), 0, PAL.ice, { r: .1, tail: 2.5, dur: flight(from, to, 40) });
export const frostBoom = (pos: THREE.Vector3, r: number) => boom(pos.clone().setY(gy(pos) + 1), r, PAL.ice, .55, { ground: gy(pos), n: 30 });
// Eislanze: langer Eisspeer, zersplittert am Ende. Partisan (Eiszeit): 5 Speere im Fächer
export function lanceLook(to: THREE.Vector3, len = 1.6, thick = .1) {
  const a = castFrom(), b = V(to.x, a.y, to.z), dir = b.clone().sub(a).normalize(), dur = flight(a, b, 70);
  fx(dur, (k, dt, e) => {
    if (!e.ms.length) { const s = em(e, 'cone', PAL.ice, { sc: 5, core: .9, flow: [0, 0, 0], local: true }); s.scale.set(thick, len, thick); s.quaternion.setFromUnitVectors(UP, dir); }
    e.ms[0].position.lerpVectors(a, b, k);
    if (Math.random() < dt * 60) sparks(e.ms[0].position, 1, PAL.ice, { v: [0, 0, 0], grav: 0, life: .3, spread: .05, band: 4 });
  }, () => { boom(b, .9, PAL.ice, .4, { ground: gy(b), n: 10 }); sparks(b, 24, PAL.ice, { v: [0, 2, 0], grav: 6, life: .6, spread: .3, band: 4 }); });
}
// Frostblitz: kleiner Eisball mit Schweif
export function frostboltLook(to: THREE.Vector3, r: number) {
  const a = castFrom(), b = to.clone().setY(to.y + 1.1);
  shot(a, b, 0, PAL.ice, { r: .2, tail: 2.5, dur: flight(a, b), hit: p => boom(p, Math.max(.8, r * .8), PAL.ice, .4, { ground: gy(to), n: 12 }) });
}
// Gletschernadel: gesammelte Splitter kreisen, verschmelzen an der Hand, Riesennadel fliegt
export function needleLook(to: THREE.Vector3, shards: number) {
  const n = clamp(shards, 3, 15), gather = .35;
  fx(gather, (k, _dt, e) => {
    if (!e.ms.length) for (let i = 0; i < n; i++) { const m = em(e, 'cone', PAL.ice, { sc: 7, core: .8, flow: [0, 0, 0], local: true }); m.userData.a = i / n * TAU; }
    const c = player.pos.clone().add(V(0, 1.2, 0)), h = castFrom(), T = EU.uTime.value;
    e.ms.forEach(m => { const a = m.userData.a + T * 6, r = 1.2 * (1 - k), p = V(Math.cos(a) * r, Math.sin(a * 2) * .15, Math.sin(a) * r).add(c.lerp(h, k)); m.position.copy(p); m.scale.set(.06, .4, .06); m.lookAt(p.clone().add(V(-Math.sin(a), 0, Math.cos(a)))); m.rotateX(Math.PI / 2); });
  }, () => lanceLook(to, 3.2, .3));
}
// Eisbarriere: Schild-Kugel mit hellem Rand, solange der Schild hält; bricht er, Funken und Mini-Nova (novaLook)
export function barrierLook() {
  fx(1e9, (k, dt, e) => {
    if (!e.ms.length) em(e, 'sph', PAL.ice, { sc: 2.6, core: -1.1, local: true, flow: [0, .4, 0], side: THREE.DoubleSide });
    const s = e.ms[0], on = player.shield > 0 && player.shieldUntil > state.now && !player.dead;
    s.position.copy(player.pos).add(V(0, 1.1, 0)); s.scale.setScalar(1.35 * (1 + .04 * Math.sin(EU.uTime.value * 6)) * outBack(Math.min(1, e.a * 4)));
    uK(s, .95);
    if (!on) { e.dur = 0; sparks(s.position, 50, PAL.ice, { v: [0, 1, 0], grav: 4, life: .7, spread: 1.6, band: 4 }); }
  });
}
// Eisblock: halbdurchsichtiger Block um die Figur; zerspringt in Scherben, wenn er endet
export function iceBlockLook(isOn: () => boolean) {
  fx(1e9, (k, _dt, e) => {
    if (!e.ms.length) { const b = em(e, 'box', PAL.ice, { sc: 2.2, core: .6, local: true, flow: [0, .2, 0], alpha: .6, side: THREE.DoubleSide }); b.rotation.y = .3; b.renderOrder = 2; }
    const b = e.ms[0], p = player.pos;
    b.position.set(p.x, p.y + 1.2, p.z); b.scale.set(1.6, 2.5 * outBack(Math.min(1, e.a * 5)), 1.6); uK(b, Math.min(1, e.a * 5));
    if (!isOn()) {
      e.dur = 0;
      const c = p.clone().add(V(0, 1.2, 0));
      for (let i = 0; i < 12; i++) { const d = V(rnd(-1, 1), rnd(.5, 1.5), rnd(-1, 1)).normalize(), s0 = rnd(.12, .24);
        fx(.6, (kk, d2, e2) => { if (!e2.ms.length) em(e2, 'oct', PAL.ice, { sc: 6, core: .8, local: true, flow: [0, 0, 0] }).scale.setScalar(s0); const m = e2.ms[0]; m.position.copy(c).addScaledVector(d, 3 * kk); m.position.y -= 2.5 * kk * kk; m.rotation.x += d2 * 9; uK(m, 1 - kk); }); }
      sparks(c, 40, PAL.ice, { v: [0, 2, 0], grav: 5, life: .7, spread: 1, band: 4 });
    }
  });
}
// Pheasant Beak (Eiszeit): schneller Eisvogel; Körper = Frostkugel, dazu Flügel aus Splittern
export function beakField() {
  return field(e => {
    em(e, 'sph', PAL.ice, { sc: 3, core: .9, local: true, flow: [0, 0, 0] });
    for (const s of [1, -1]) { const w = em(e, 'cone', PAL.ice, { sc: 6, core: .7, local: true, flow: [0, 0, 0] }); w.userData.s = s; }
  }, (e, fade) => {
    const p = e.pos, f = fwd(), T = EU.uTime.value;
    e.ms.forEach(m => {
      if (!m.userData.s) { m.position.set(p.x, p.y + 1.1, p.z); m.scale.set(.45 * fade, .4 * fade, .8 * fade); m.rotation.y = player.facing; return; }
      const side = V(f.z, 0, -f.x).multiplyScalar(m.userData.s);
      m.position.set(p.x, p.y + 1.15, p.z); m.quaternion.setFromUnitVectors(UP, side.add(V(0, .3 * Math.sin(T * 14), 0)).normalize()); m.scale.set(.25 * fade, 1.6 * fade, .08);
    });
  });
}
