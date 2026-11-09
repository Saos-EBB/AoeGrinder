// Feuer-Optik aus dem Spell-Viewer (SPELLS.fire): Feuerball, Flammenstoß, Druckwelle, Höllenfeuer, Meteor, Brandmal-Detonation, Feuerspur, Feuersbrunst, Benzin, Phönix.
// Nur Optik: Treffer und Dauer bestimmen die Spells. Größen relativ zum Spiel-Radius, alle Zahlen // PH

import * as THREE from 'three';
import { groundAt } from '../collision';
import { mage } from '../models/mage';
import { particles } from '../fx/particles';
import { fx, em, uK, lay, field, boom, shot, blaze, blazeUp, ring, sparks, env, outC, rnd, TAU, PAL, EU, after, figureLook, type Pal } from './energy';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const gy = (p: THREE.Vector3) => groundAt(p.x, p.z, p.y + 1);
export const onGround = (p: THREE.Vector3) => V(p.x, gy(p), p.z);
// Ausgangspunkt der Zauber: Glüh-Punkt der Waffe, sonst Brusthöhe
export function castFrom() {
  const a = mage.anchors?.crystal;
  return a ? a.getWorldPosition(V()) : V();
}
const flight = (a: THREE.Vector3, b: THREE.Vector3, speed = 60, max = .35) => Math.min(max, Math.max(.06, a.distanceTo(b) / speed));

// Brandfläche: Glut-Scheibe und Flammenzungen, Anzahl nach Radius. tongues: 0 = nur Zungen-frei, pal wechselbar (Benzin)
export function fireField(o: { tongues?: number; disk?: boolean; h?: number; pal?: Pal } = {}) {
  const pal = { cur: o.pal ?? PAL.fire };
  const f = field(e => {
    const r = e.r, n = o.tongues ?? Math.round(Math.min(22, 5 + r * 1.4));
    if (o.disk !== false) em(e, 'gdisk', pal.cur, { sc: 1.5 / Math.max(1, r * .25), core: 0, edge: 1.3, flow: [.6, 0, .4] });
    for (let i = 0; i < n; i++) { const m = em(e, 'cone', pal.cur, { sc: 4, core: .35, tip: 1.1, puff: .05, flow: [0, 3.2, 0] }); const a = Math.random() * TAU, d = Math.sqrt(Math.random()); m.userData.o = [Math.cos(a) * d, Math.sin(a) * d]; m.userData.h = (o.h ?? 1.2) * rnd(.6, 1.2); m.userData.w = rnd(.22, .4); m.userData.ph = Math.random() * 9; }
  }, (e, fade) => {
    const T = EU.uTime.value, c = e.pos, r = e.r;
    let i = 0;
    for (const m of e.ms) {
      if (m.userData.o) {
        const x = c.x + m.userData.o[0] * r * .9, z = c.z + m.userData.o[1] * r * .9;
        m.position.set(x, groundAt(x, z, c.y + 1), z);
        m.scale.set(m.userData.w, m.userData.h * fade * (1 + .25 * Math.sin(T * 9 + m.userData.ph)), m.userData.w);
      } else { lay(m, c, r); uK(m, .85 * fade); }
      i++;
    }
  });
  return Object.assign(f, {
    // Palette aller Teile umschalten (Benzin: Öl → Feuer)
    setPal(p: Pal) { pal.cur = p; for (const m of f.e.ms) (m.material as any).userData.u.uC.value = p; },
  });
}

// Feuerball: Kugel mit Schweif, am Ziel Explosion in Spielgröße
export function fireballLook(to: THREE.Vector3, r: number, big = 1) {
  const a = castFrom(), b = to.clone().setY(to.y + 1.1);
  shot(a, b, 0, PAL.fire, { r: .3 * big, tail: 3.2, dur: flight(a, b), hit: p => boom(p, r * .85, PAL.fire, .55, { ground: gy(p), n: 20 }) });
}
// Waffen-Look Haarspray + Feuerzeug (gear.ts): beim Feuerball faucht ein Flammenstoß aus der Düse Richtung Ziel. Nur Partikel, kein Draw Call extra // PH
const JET = { n: 18, speed: [9, 15], spread: .22, life: [.16, .3], size: [.25, .5] };
export function sprayJet(to: THREE.Vector3) {
  const a = castFrom(), d = to.clone().setY(to.y + 1.1).sub(a).normalize();
  for (let i = 0; i < JET.n; i++) {
    const v = JET.speed[0] + Math.random() * (JET.speed[1] - JET.speed[0]), k = i / JET.n;
    particles.spawn({ x: a.x, y: a.y, z: a.z, vx: (d.x + (Math.random() - .5) * JET.spread) * v, vy: (d.y + (Math.random() - .5) * JET.spread) * v, vz: (d.z + (Math.random() - .5) * JET.spread) * v,
      drag: 3, life: JET.life[0] + Math.random() * (JET.life[1] - JET.life[0]), color: k < .3 ? [1.6, 1.2, .6] : k < .7 ? [1.5, .55, .1] : [.8, .18, .03], size: JET.size[0] + Math.random() * (JET.size[1] - JET.size[0]), grow: 1.5 });
  }
}
// Flammenstoß: Glutkreis, dann Feuersäule mit Zungen
export function flameStrikeLook(point: THREE.Vector3, r: number) {
  const p = onGround(point);
  ring(p, r, PAL.fire, .35, { r0: r * .9 });
  fx(1.4, (k, _dt, e) => {
    if (!e.ms.length) { em(e, 'cyl', PAL.fire, { sc: 2.2 / Math.max(1, r * .3), core: .6, tip: 1, flow: [0, 4, 0], side: THREE.DoubleSide, puff: .06 }).position.copy(p); blaze(e, p, r * .8, 14, 2); sparks(p.clone().setY(p.y + .5), 40, PAL.fire, { v: [0, 6, 0], grav: 2, life: 1, spread: r * .6 }); }
    const c = e.ms[0]; c.scale.set(r * .3 * (1 - .2 * k), r * .9 * outC(Math.min(1, k * 5)), r * .3 * (1 - .2 * k)); uK(c, env(k, .1, .4)); blazeUp(e, k, 1);
  });
}
// Druckwelle: Bodenring und Kuppel laufen nach außen (Sog: nach innen)
export function blastLook(center: THREE.Vector3, r: number, suck = false) {
  const o = onGround(center);
  fx(.8, (k, _dt, e) => {
    if (!e.ms.length) { em(e, 'gring', PAL.fire, { sc: 2 / Math.max(1, r * .3), core: 0, flow: [0, 0, 0] }); em(e, 'hemi', PAL.fire, { sc: 2.5 / Math.max(1, r * .3), core: -.6, flow: [0, 3, 0], side: THREE.DoubleSide }).position.copy(o); }
    const u = suck ? 1 - outC(k) : outC(k), rr = .4 + r * u;
    lay(e.ms[0], o, rr); uK(e.ms[0], 1 - k * .8);
    e.ms[1].scale.set(rr * .9, r * .18 * (1 - k * .6), rr * .9); uK(e.ms[1], .7 * (1 - k));   // flacher und fransiger als im Viewer: die Spielkamera schaut von oben drauf
  });
}
// Feuerring der Druckwelle (Rune): Zungen auf dem Kreis
export function fireRingField() {
  return field(e => { for (let i = 0; i < 24; i++) { const m = em(e, 'cone', PAL.fire, { sc: 4, core: .35, tip: 1.1, puff: .05, flow: [0, 3.2, 0] }); m.userData.a = i / 24 * TAU; m.userData.ph = i; } }, (e, fade) => {
    const T = EU.uTime.value;
    for (const m of e.ms) { const x = e.pos.x + Math.cos(m.userData.a) * e.r, z = e.pos.z + Math.sin(m.userData.a) * e.r; m.position.set(x, groundAt(x, z, e.pos.y + 1), z); m.scale.set(.4, 1.3 * fade * (1 + .25 * Math.sin(T * 9 + m.userData.ph)), .4); }
  });
}
// Höllenfeuer: Bodenfläche und 18 kreisende Zungen um die Figur, Figur auf Hitze 100
export function hellfireLook() {
  figureLook.meter = 1;
  const f = field(e => {
    em(e, 'gdisk', PAL.fire, { sc: 1.6 / Math.max(1, e.r * .25), core: 0, edge: 1.3, flow: [.6, 0, .4] });
    for (let i = 0; i < 18; i++) { const m = em(e, 'cone', PAL.fire, { sc: 4, core: .35, tip: 1.1, puff: .05, flow: [0, 3.2, 0] }); m.userData = { h: rnd(1.6, 2.6), w: rnd(.35, .55), ph: i, a: i / 18 * TAU }; }
  }, (e, fade, dt) => {
    const T = EU.uTime.value, c = e.pos, r = e.r;
    lay(e.ms[0], c, r); uK(e.ms[0], .9 * fade);
    for (const m of e.ms.slice(1)) { m.userData.a += dt * .8; const x = c.x + Math.cos(m.userData.a) * r * .85, z = c.z + Math.sin(m.userData.a) * r * .85; m.position.set(x, groundAt(x, z, c.y + 1), z); m.scale.set(m.userData.w, m.userData.h * fade * (1 + .25 * Math.sin(T * 9 + m.userData.ph)), m.userData.w); }
  });
  return { update: f.update, remove() { f.remove(); figureLook.meter = null; } };
}
// Meteor: Warnkreis, Meteor mit langem Schweif schräg aus dem Himmel, großer Einschlag. delay in s
export function meteorLook(point: THREE.Vector3, r: number, delay: number) {
  const p = onGround(point), fall = Math.min(.45, delay * .4);
  fx(delay, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'gring', PAL.fire, { sc: 3 / Math.max(1, r * .3), core: 0, flow: [0, 0, 0] });
    lay(e.ms[0], p, r * (1 - .15 * Math.sin(k * 30) * (1 - k))); uK(e.ms[0], .5 + .5 * k);
  });
  const from = p.clone().add(V(-r * .6, 18, -r * .45));
  after(delay - fall, () => shot(from, p.clone().setY(p.y + .3), 0, PAL.fire, { r: Math.max(.6, r * .14), tail: 5, dur: fall, hit: q => boom(q, r * 1.05, PAL.fire, .9, { ground: p.y, n: 60 }) }));
}
// Brandmal-Detonation: jeder brennende Mob platzt, leicht versetzt
export function detonateLook(list: THREE.Vector3[], r: number) {
  list.forEach((pos, i) => after(i * .06 + .001, () => boom(pos.clone().setY(pos.y + 1), r, PAL.fire, .6, { ground: gy(pos), n: 14 })));
}
// Feuerspur: Zungen an den Füßen, die liegen bleiben
export const trailField = () => fireField({ tongues: 3, disk: false, h: .9 });
// Feuersbrunst: Lanze aufs Ziel, dann springen Glutbälle im Bogen zu den Nachbarn
export function firestormLance(to: THREE.Vector3) {
  const a = castFrom(), b = to.clone().setY(to.y + 1);
  shot(a, b, 0, PAL.fire, { r: .2, tail: 4, dur: flight(a, b), hit: q => boom(q, 1.4, PAL.fire, .45, { ground: gy(to), n: 10 }) });
}
export function firestormJump(from: THREE.Vector3, to: THREE.Vector3, delay: number) {
  after(delay + .001, () => shot(from.clone().setY(from.y + 1), to.clone().setY(to.y + 1), 0, PAL.fire, { r: .16, tail: 2, arc: 1.2, dur: .3, hit: q => boom(q, 1.1, PAL.fire, .4, { ground: gy(to), n: 6 }) }));
}
// Benzin: Kanister im Bogen; die Lache selbst ist ein fireField mit Öl-Palette, beim Zünden Feuer
export function canisterLook(to: THREE.Vector3) {
  const a = castFrom(), b = onGround(to);
  fx(.45, (k, _dt, e) => {
    if (!e.ms.length) em(e, 'box', PAL.oil, { sc: 6, core: .2, local: true, flow: [0, 0, 0] }).scale.set(.3, .42, .18);
    const m = e.ms[0]; m.position.lerpVectors(a, b, k); m.position.y += 3 * Math.sin(Math.PI * k); m.rotation.set(k * 9, k * 5, 0);
  }, () => sparks(b.clone().setY(b.y + .3), 30, PAL.oil, { v: [0, 3, 0], grav: 8, life: .8, spread: 1.5, band: 2, glow: 1 }));
}
export const oilField = () => fireField({ pal: PAL.oil, tongues: 0, h: 1.4 });
export function igniteLook(f: ReturnType<typeof fireField>) {
  f.setPal(PAL.fire);
  const e = f.e, r = e.r ?? 6;
  for (let i = 0; i < Math.round(Math.min(22, 5 + r * 1.4)); i++) { const m = em(e, 'cone', PAL.fire, { sc: 4, core: .35, tip: 1.1, puff: .05, flow: [0, 3.2, 0] }); const a = Math.random() * TAU, d = Math.sqrt(Math.random()); m.userData.o = [Math.cos(a) * d, Math.sin(a) * d]; m.userData.h = 1.6 * rnd(.6, 1.2); m.userData.w = rnd(.22, .4); m.userData.ph = Math.random() * 9; }
  if (e.pos) boom(e.pos.clone().setY(gy(e.pos) + .5), r * .7, PAL.fire, .5, { ground: gy(e.pos), n: 30 });
}
// Phönix: Feuervogel steigt auf, stürzt herab, große Explosion
export function phoenixLook(pos: THREE.Vector3, r: number) {
  const o = onGround(pos), bird = new THREE.Group();
  const scene = mage.root.parent;
  scene?.add(bird);
  fx(1.4, (k, dt, e) => {
    if (!e.ms.length) {
      const o2 = { sc: 3.5, core: .8, puff: .05, flow: [0, 3, 0], parent: bird };
      em(e, 'sph', PAL.fire, o2).scale.set(.5, .5, 1.1);
      const hd = em(e, 'sph', PAL.fire, o2); hd.scale.setScalar(.3); hd.position.set(0, .3, 1);
      for (const s of [1, -1]) { const w = em(e, 'sph', PAL.fire, { ...o2, core: .4, puff: .08 }); w.scale.set(2.1, .1, .75); w.position.set(s * 2, 0, -.15); w.userData.s = s; }
      const tl = em(e, 'cone', PAL.fire, { ...o2, tip: 1, core: .3 }); tl.rotation.x = -Math.PI / 2; tl.scale.set(.5, 2.4, .3); tl.position.z = -.75;
    }
    const T = EU.uTime.value, up = k < .6 ? outC(k / .6) : 1 - Math.pow((k - .6) / .4, 2);
    bird.position.set(o.x, o.y + 1.5 + 6 * up, o.z + .7); bird.rotation.x = k < .6 ? -.6 : .9;
    for (const m of e.ms) { if (m.userData.s) m.rotation.z = m.userData.s * .6 * Math.sin(T * 12); uK(m, env(k, .15, .05)); }
    if (Math.random() < dt * 50) sparks(bird.position, 2, PAL.fire, { v: [0, -1, 0], grav: -1, life: .6, spread: 1 });
  }, () => { scene?.remove(bird); boom(o.clone().setY(o.y + .8), r, PAL.fire, 1, { ground: o.y, n: 80 }); });
}
