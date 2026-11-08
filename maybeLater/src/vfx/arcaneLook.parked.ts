// Geparkt am 2026-11-08 aus src/vfx/arcaneLook.ts: Optik, die nur die Arkan-Figur nutzt.
// Zurückholen: unten an src/vfx/arcaneLook.ts anhängen (Imports und Helfer V, UP, flight, chestOf stehen dort).

// Arcane Explosion: Kugel um die Figur + Bodenring
export function aeLook(pos: THREE.Vector3, r: number) {
  boom(chestOf(pos), r * .9, PAL.arcane, .55, { ground: gy(pos), n: 50 });
}
// Arkane Geschosse: ein Geschoss im Bogen (abwechselnd links, rechts)
let side = 1;
export function missileLook(to: THREE.Vector3, pal = PAL.arcane, r = .13) {
  const a = castFrom(), b = chestOf(to);
  side = -side;
  shot(a, b, 0, pal, { r, tail: 3, dur: flight(a, b, 35), curve: V(side * rnd(.6, 1.4), rnd(.3, 1), 0).applyAxisAngle(UP, player.facing), hit: p => boom(p, .7, pal, .35, { ground: gy(to), n: 8 }) });
}
export const missileBoom = (pos: THREE.Vector3, r: number) => boom(chestOf(pos), r, PAL.arcane, .45, { ground: gy(pos), n: 20 });
// Arkanbeschuss: Ladungen + 1 Geschosse, größer je Ladung
export function barrageLook(to: THREE.Vector3, charges: number) {
  const big = 1 + charges * .3;
  for (let i = 0; i <= charges; i++) after(i * .07 + .001, () => {
    const a = castFrom(), b = chestOf(to);
    shot(a, b, 0, PAL.arcane, { r: .18 * big, tail: 3.5, dur: flight(a, b, 60), hit: p => boom(p, .9 * big, PAL.arcane, .45, { ground: gy(to), n: 10 }) });
  });
}
// Leerenkugel: dunkle Kugel + Hülle, Sog-Ring am Boden, Partikel fliegen hinein
export function voidOrbField(k = 1) {
  return field(e => {
    em(e, 'sph', PAL.void, { sc: 3, core: 1.1, local: true, flow: [0, 0, 0] });
    em(e, 'sph', PAL.arcane, { sc: 2.4, core: -1, local: true, flow: [0, 1, 0], side: THREE.DoubleSide });
    em(e, 'gring', PAL.void, { sc: 2 / Math.max(1, e.r * .3), core: 0, flow: [0, 0, 0] });
  }, (e, fade, dt) => {
    const p = e.pos, g = gy(p), c = V(p.x, g + 1.6, p.z), s = (1 + k) * .5;
    const [core, hull, rg] = e.ms;
    core.position.copy(c); core.scale.setScalar(.9 * s * fade); core.rotation.y -= dt * 4; uK(core, fade);
    hull.position.copy(c); hull.scale.setScalar(1.4 * s * fade); hull.rotation.y += dt * 2; hull.rotation.z += dt; uK(hull, fade);
    const rk = (e.a * 1.1) % 1; lay(rg, p, Math.max(.3, e.r * (1 - rk))); uK(rg, rk * fade);
    if (Math.random() < dt * 40 * fade) { const q = c.clone().add(V(rnd(-1, 1), rnd(-.6, .6), rnd(-1, 1)).normalize().multiplyScalar(e.r * .4)); const v = c.clone().sub(q).multiplyScalar(2.5); sparks(q, 1, PAL.arcane, { v: [v.x, v.y, v.z], grav: 0, life: .4, spread: .05, band: 3 }); }
  });
}
// Arkanes Mal: Runenkreis am Boden, 2 Ringe gegenläufig + Scheibe
export function markLook(point: THREE.Vector3, r: number) {
  const p = onGround(point);
  fx(1.1, (k, dt, e) => {
    if (!e.ms.length) {
      em(e, 'gring', PAL.arcane, { sc: 3 / Math.max(1, r * .3), core: 0, flow: [0, 0, 0] });
      const d = em(e, 'disk', PAL.arcane, { sc: 4 / Math.max(1, r * .3), core: 0, edge: -.6, flow: [0, 0, 0], local: true }); d.position.set(p.x, p.y + .08, p.z); d.scale.setScalar(r);
      const t = em(e, 'ring', PAL.arcane, { sc: 3, core: 0, flow: [0, 0, 0], local: true }); t.position.set(p.x, p.y + .1, p.z); t.scale.setScalar(r * .57);
    }
    lay(e.ms[0], p, r); e.ms[1].rotation.y += dt; e.ms[2].rotation.y -= dt * 2;
    for (const m of e.ms) uK(m, env(k, .15, .4));
  });
}
export const markPop = (pos: THREE.Vector3) => boom(chestOf(pos), 1.4, PAL.arcane, .4, { ground: gy(pos), n: 10 });
// Arkanstrahl: Kern + Hülle als Linie; trifft er die Leerenkugel, große Doppel-Explosion (beamBoom)
export function beamLook(from: THREE.Vector3, to: THREE.Vector3, dur = .6, thick = 1) {
  const a = castFrom(), b = V(to.x, a.y, to.z), d = b.clone().sub(a), L = d.length();
  boom(a, .6, PAL.arcane, .3, { ground: gy(from), n: 10 });
  fx(dur, (k, _dt, e) => {
    if (!e.ms.length) for (const [r, c] of [[.16, 1], [.42, -.6]]) { const m = em(e, 'cyl', PAL.arcane, { sc: 3, core: c, flow: [0, -8, 0], side: THREE.DoubleSide }); m.position.copy(a); m.quaternion.setFromUnitVectors(UP, d.clone().normalize()); m.userData.r = r * thick; }
    e.ms.forEach(m => { const w = m.userData.r * (1 - k * .5) * (1 + .15 * Math.sin(EU.uTime.value * 40)); m.scale.set(w, L, w); uK(m, 1 - k); });
  });
}
export function beamBoom(pos: THREE.Vector3, r: number) {
  after(.1, () => { boom(chestOf(pos), r * .8, PAL.arcane, 1, { ground: gy(pos), n: 90 }); boom(chestOf(pos), r * .5, PAL.void, .7, { ground: gy(pos), n: 20 }); });
}
// Arkane Kugel: rollt über den Boden
export function arcOrbField() {
  return field(e => { em(e, 'sph', PAL.arcane, { sc: 3.5, core: 1, local: true, flow: [0, 0, 0] }); }, (e, fade, dt) => {
    const m = e.ms[0]; m.position.set(e.pos.x, gy(e.pos) + .9, e.pos.z); m.scale.setScalar(.9 * fade); m.rotation.x += dt * 12; m.rotation.y = player.facing;
    if (Math.random() < dt * 30) sparks(V(e.pos.x, gy(e.pos) + .1, e.pos.z), 1, PAL.arcane, { v: [0, .5, 0], grav: 0, life: .5, spread: .6, band: 2 });
  });
}
// Archon: Energie-Hülle auf der Körper-Geometrie, Ring über dem Kopf, Figur auf 4 Ladungen. Läuft, solange isOn() stimmt
export function archonLook(isOn: () => boolean) {
  const body = (mage.hero as any)?.body as THREE.SkinnedMesh;
  figureLook.meter = 1;
  fx(1e9, (k, dt, e) => {
    if (!e.ms.length) {
      if (body) {
        const sh = new THREE.SkinnedMesh(body.geometry, eMat(PAL.arcane, { sc: 4, core: .2, inf: .05, puff: .02, flow: [0, 2, 0] }));
        sh.frustumCulled = false; body.parent.add(sh); sh.bind(body.skeleton, body.bindMatrix);
        own(e, sh, () => (sh.material as THREE.Material).dispose());
      }
      em(e, 'torus', PAL.arcane, { sc: 6, core: .5, local: true, flow: [2, 0, 0] });
    }
    const on = isOn(), f = on ? Math.min(1, e.a * 5) : 0;
    const cr = e.ms[e.ms.length - 1]; cr.position.copy(player.pos).add(V(0, 2.75, 0)); cr.scale.setScalar(.45); cr.rotation.y += dt * 2;
    for (const m of e.ms) uK(m, f);
    if (!on) { e.dur = 0; figureLook.meter = null; }
  });
}
// Zeitkrümmung: Uhr-Ring mit 12 Strichen am Startpunkt; kurz vor dem Rücksprung dreht er schnell. warpBack: Spur zurück
export function warpLook(pos: THREE.Vector3, ms: number) {
  const p = onGround(pos), dur = ms / 1000;
  fx(dur, (k, dt, e) => {
    if (!e.ms.length) {
      const r = em(e, 'ring', PAL.arcane, { sc: 3, core: 0, flow: [0, 0, 0] }); r.position.set(p.x, p.y + .1, p.z); r.scale.setScalar(1.6);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, m = em(e, 'cone', PAL.arcane, { sc: 6, core: .6, local: true, flow: [0, 0, 0] }); const x = p.x + Math.cos(a) * 1.4, z = p.z + Math.sin(a) * 1.4; m.position.set(x, groundAt(x, z, p.y + 1) + .02, z); m.scale.set(.06, .3, .06); }
      em(e, 'cone', PAL.arcane, { sc: 6, core: .8, local: true, flow: [0, 0, 0] }).position.set(p.x, p.y + .1, p.z);   // Zeiger
    }
    e.ms[0].rotation.y -= dt * (k > .8 ? 12 : 1);
    const hand = e.ms[e.ms.length - 1]; hand.rotation.set(Math.PI / 2, 0, -k * TAU * (k > .8 ? 4 : 1)); hand.scale.set(.07, 1.2, .07);
    for (const m of e.ms) uK(m, env(k, .1, .1));
  });
}
export function warpBack(from: THREE.Vector3, to: THREE.Vector3) {
  const n = Math.min(30, Math.ceil(from.distanceTo(to) * 2));
  for (let i = 0; i <= n; i++) { const q = from.clone().lerp(to, i / n); sparks(q.setY(q.y + 1), 3, PAL.arcane, { v: [0, 0, 0], grav: 0, life: .5, spread: .5, band: 3 }); }
  boom(chestOf(to), 1.6, PAL.arcane, .45, { ground: gy(to), n: 20 });
}
// Dafür brauchte die Datei zusätzlich:
// import { groundAt } from '../collision';
// import { state } from '../state';
// import { mage } from '../models/mage';
// import { shot, field, own, eMat, TAU, figureLook } from './energy';
// import { castFrom } from './fireLook';
// const UP = V(0, 1, 0);
// const flight = (a: THREE.Vector3, b: THREE.Vector3, speed = 50, max = .4) => Math.min(max, Math.max(.06, a.distanceTo(b) / speed));
