// Blitz-Optik aus dem Spell-Viewer (SPELLS.blitz): Zickzack-Bänder wie makeBolts (Glow + Kern, alle Blitze in einem Mesh, ein Draw Call),
// Treffer-Funken im Energie-Look, dazu Tempest, Blitzschlag, Kugelblitz, Entladung, Gewitter, Erdbeben, Sturmhüter, Statikfeld, Sturmelementar.
// Nur Optik, alle Zahlen // PH

import * as THREE from 'three';
import { scene, camera } from '../render';
import { player, state } from '../state';
import { groundAt } from '../collision';
import { onClearEnergy, fx, em, uK, lay, field, boom, arc, spark, sparks, env, outC, outBack, rnd, clamp, TAU, PAL, EU, type Pal } from './energy';
import { gy, onGround, castFrom } from './fireLook';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ───────────────────────── Bänder
const MAX = 2400;   // Segmente (Glow + Kern)
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6 * 3), 3));
geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 6 * 4), 4));
const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3;
scene.add(mesh);
type Bolt = { pts: THREE.Vector3[]; life: number; max: number; w: number; glow: number[]; core: number[] };
let list: Bolt[] = [];
const PALS: Record<string, [number[], number[]]> = {
  blitz: [[...new THREE.Color(0x3d7bff).toArray(), .22], [...new THREE.Color(0x9ff3ff).toArray(), 1]],
  slime: [[...new THREE.Color(0x3f8f2a).toArray(), .25], [...new THREE.Color(0xc8ff8a).toArray(), 1]],
};
export function jag(a: THREE.Vector3, b: THREE.Vector3, depth = 4, amp = .22) {
  let pts = [a.clone(), b.clone()];
  for (let d = 0; d < depth; d++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], mid = p.clone().lerp(q, .5), len = p.distanceTo(q);
      mid.add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(len * amp));
      out.push(mid, q);
    }
    pts = out;
  }
  return pts;
}
// Ein Blitz von a nach b, mit 60 % ein Ast. life in s, w Breite
export function zap(a: THREE.Vector3, b: THREE.Vector3, life = rnd(.08, .16), w = 1, branch = true, pal: 'blitz' | 'slime' = 'blitz') {
  if (list.length > 300) list.shift();
  const pts = jag(a, b, a.distanceTo(b) > 6 ? 5 : 4), [glow, core] = PALS[pal];
  list.push({ pts, life, max: life, w, glow, core });
  if (branch && Math.random() < .6) { const k = pts[Math.floor(rnd(.3, .7) * pts.length)]; zap(k, k.clone().add(V(rnd(-1, 1), rnd(-.8, .4), rnd(-1, 1)).multiplyScalar(a.distanceTo(b) * .4)), life, w * .6, false, pal); }
}
const _cd = V(), _sd = V(), _bd = V();
export function updateBolts(dt: number) {
  if (dt > 0) list = list.filter(x => (x.life -= dt) > 0);
  mesh.visible = list.length > 0;
  if (!list.length) return;
  camera.getWorldDirection(_cd);
  const p = geo.attributes.position, cl = geo.attributes.color;
  let q = 0;
  const fill = (width: number, core: boolean) => {
    for (const x of list) {
      const c = core ? x.core : x.glow, fade = Math.min(1, x.life / x.max * 2);
      for (let i = 0; i < x.pts.length - 1 && q < MAX; i++, q++) {
        const a = x.pts[i], b = x.pts[i + 1];
        _sd.crossVectors(_bd.subVectors(b, a), _cd).normalize().multiplyScalar(width * x.w * (1 - i / x.pts.length * .6));
        for (let k = 0; k < 6; k++) cl.array.set([c[0], c[1], c[2], c[3] * fade], (q * 6 + k) * 4);
        (p.array as Float32Array).set([a.x - _sd.x, a.y - _sd.y, a.z - _sd.z, a.x + _sd.x, a.y + _sd.y, a.z + _sd.z, b.x + _sd.x, b.y + _sd.y, b.z + _sd.z,
          a.x - _sd.x, a.y - _sd.y, a.z - _sd.z, b.x + _sd.x, b.y + _sd.y, b.z + _sd.z, b.x - _sd.x, b.y - _sd.y, b.z - _sd.z], q * 18);
      }
    }
  };
  fill(.09, false); fill(.025, true);   // Spiel-Kamera ist weiter weg als im Viewer: Bänder etwas breiter // PH
  p.needsUpdate = cl.needsUpdate = true; geo.setDrawRange(0, q * 6);
}
onClearEnergy(() => { list = []; });

const chest = (p: { x: number; y: number; z: number }) => V(p.x, p.y + 1.2, p.z);
// Blitz zwischen zwei Spielpunkten (Füße) mit Funke am Ziel
export function zapLook(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, pal: 'blitz' | 'slime' = 'blitz') {
  const b = chest(to);
  zap(chest(from), b, .22, 1.2, true, pal);
  spark(b, .7, pal === 'slime' ? PAL.slime : PAL.blitz);
}
// Bildschirm-Blitz: kurz hell über allem
let flashEl: HTMLDivElement = null;
export function screenFlash(op = .35, ms = 90) {
  if (!flashEl) { flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#eef6ff;pointer-events:none;z-index:5;opacity:0;transition:opacity .12s'; document.body.appendChild(flashEl); }
  flashEl.style.transition = 'none'; flashEl.style.opacity = String(op);
  setTimeout(() => { flashEl.style.transition = 'opacity .15s'; flashEl.style.opacity = '0'; }, ms);
}
// Tempest: großer Spaltschlag-Ring vor der Figur
export function tempestLook(r: number, angle: number) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, player.facing, 0, 'YXZ'));
  arc(player.pos.clone().add(V(0, 1, 0)), q, r, angle, PAL.blitz, .45);
  for (let i = 0; i < 8; i++) { const a = player.facing + (i / 7 - .5) * angle; zap(chest(player.pos), V(player.pos.x + Math.sin(a) * r, player.pos.y + .5, player.pos.z + Math.cos(a) * r), .25, 1.4); }
}
// Blitzschlag: Blitz aus dem Himmel, Bildschirm-Blitz, Einschlag
export function strikeLook(point: THREE.Vector3, r: number) {
  const p = onGround(point);
  zap(p.clone().add(V(rnd(-1, 1), 16, rnd(-1, 1))), p.clone().setY(p.y + .1), .3, 4); zap(p.clone().add(V(rnd(-2, 2), 12, 0)), p.clone().setY(p.y + 1), .2, 2.2);
  screenFlash(); spark(p.clone().setY(p.y + .4), 1.6); boom(p.clone().setY(p.y + .3), Math.max(1.4, r * .9), PAL.blitz, .5, { ground: p.y, n: 30 });
}
// Kugelblitz: Kugel knistert; Zaps zu Mobs kommen aus dem Spell (zapLook)
export function ballField(k = 1) {
  return field(e => { em(e, 'sph', PAL.blitz, { sc: 5, core: 1, puff: .08, local: true, flow: [0, 3, 0] }); }, (e, fade, dt) => {
    const c = V(e.pos.x, gy(e.pos) + 1.4, e.pos.z), m = e.ms[0];
    m.position.copy(c); m.scale.setScalar(.6 * k * fade); m.rotation.y += dt * 9;
    if (Math.random() < dt * 25 * fade) zap(c, c.clone().add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(.5, 1.1))), .06, .5, false);
  });
}
// Entladung: 14 Blitze rundum, große Funken-Kugel
export function dischargeLook(r: number) {
  const o = chest(player.pos);
  spark(o, 2.4); screenFlash(.25);
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; zap(o, V(o.x + Math.cos(a) * r, o.y - 1, o.z + Math.sin(a) * r), .35, 1.2); }
}
// Gewitter: dunkle Wolke über dem Ziel, Einschläge kommen aus dem Spell (stormHit)
export function stormField() {
  return field(e => { em(e, 'sph', PAL.storm, { sc: 1.3 / Math.max(1, e.r * .2), core: .3, local: true, flow: [.5, 0, 0] }); }, (e, fade, dt) => {
    const cl = e.ms[0]; cl.position.set(e.pos.x, gy(e.pos) + 10, e.pos.z); cl.scale.set(e.r * 1.1, 1.8, e.r * 1.1); cl.rotation.y += dt * .5; uK(cl, fade);
  });
}
export function stormHit(at: { x: number; y: number; z: number }, cloudY: number) {
  const g = V(at.x, groundAt(at.x, at.z, at.y + 1), at.z);
  zap(V(g.x + rnd(-.6, .6), cloudY, g.z + rnd(-.6, .6)), g.clone().setY(g.y + .1), .2, 2.2);
  spark(g.clone().setY(g.y + .3), .9);
  if (Math.random() < .3) screenFlash(.12, 50);
}
// Erdbeben: Bodenfläche pulsiert, Ringe, Steine (Partikel)
export function quakeField() {
  return field(e => { em(e, 'gdisk', PAL.blitz, { sc: 2.2 / Math.max(1, e.r * .25), core: 0, edge: .9, flow: [0, 0, 0], local: true }); }, (e, fade, dt) => {
    const T = EU.uTime.value; lay(e.ms[0], e.pos, e.r); uK(e.ms[0], fade * (.55 + .3 * Math.sin(T * 20)));
    e.t = (e.t ?? 0) + dt;
    if (e.t > .6 && fade > .5) {
      e.t = 0;
      const g = onGround(e.pos);
      fx(.5, (k, _d, e2) => { if (!e2.ms.length) em(e2, 'gring', PAL.blitz, { sc: 3, core: 0, flow: [0, 0, 0] }); lay(e2.ms[0], g, .4 + e.r * outC(k)); uK(e2.ms[0], 1 - k); });
      sparks(g.clone().setY(g.y + .2), 24, PAL.staub, { v: [0, 6, 0], grav: 14, life: .8, spread: e.r, band: 1, glow: .6 });
      for (let i = 0; i < 3; i++) { const q = g.clone().add(V(rnd(-1, 1) * e.r * .8, .05, rnd(-1, 1) * e.r * .8)); zap(q, q.clone().add(V(rnd(-1.2, 1.2), .05, rnd(-1.2, 1.2))), .2, 1, false); }
    }
  });
}
// Sturmhüter: 3 Ringe kreisen um die Figur und knistern, solange Ladungen da sind
export function keeperLook() {
  fx(1e9, (k, dt, e) => {
    if (!e.ms.length) for (let i = 0; i < 3; i++) { const m = em(e, 'torus', PAL.blitz, { sc: 6, core: .4, local: true, flow: [3, 0, 0] }); m.userData.i = i; }
    const T = EU.uTime.value, on = (state.keeper ?? 0) > 0 && !player.dead, f = on ? Math.min(1, e.a * 5) : 0;
    for (const m of e.ms) { const i = m.userData.i; m.position.copy(player.pos).add(V(0, .4 + i * .6 + .2 * Math.sin(T * 5 + i), 0)); m.scale.setScalar((.8 - i * .14) * outBack(Math.min(1, e.a * 4))); m.rotation.y += dt * 6; m.rotation.x = .3 * Math.sin(T * 3 + i); uK(m, f); }
    if (on && Math.random() < dt * 14) { const o = chest(player.pos); zap(o, o.clone().add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(.9)), .06, .6, false); }
    if (!on) e.dur = 0;
  });
}
// Statikfeld: hohle Kuppel, Blitze zu jedem Mob im Feld
export function staticLook(r: number, targets: () => { x: number; y: number; z: number }[]) {
  const o = onGround(player.pos);
  fx(1.4, (k, dt, e) => {
    if (!e.ms.length) { em(e, 'hemi', PAL.blitz, { sc: 2.5 / Math.max(1, r * .3), core: -1.4, flow: [0, 1.5, 0], side: THREE.DoubleSide }).position.copy(o); for (const t of targets()) zapLook(player.pos, t); }
    const s = e.ms[0], g = outC(Math.min(1, k * 4)); s.position.copy(player.pos); s.scale.set(r * g, r * .3 * g, r * g); uK(s, env(k, .1, .25) * .55);   // flacher und durchlässiger als im Viewer: Spiel-Radius 10 yd
    if (Math.random() < dt * 10) { const ts = targets(); const t = ts[Math.floor(Math.random() * ts.length)]; if (t) zap(chest(player.pos), chest(t), .1, .8); }
  });
}
// Sturmelementar: schwebende Kugel mit Schweif und 2 Ärmchen neben der Figur
export function elementalField() {
  return field(e => {
    em(e, 'sph', PAL.blitz, { sc: 4, core: 1, puff: .06, flow: [0, 3, 0] });
    const t = em(e, 'cone', PAL.blitz, { sc: 5, core: .4, tip: 1, flow: [0, -3, 0], local: true }); t.rotation.x = Math.PI;
    for (const s of [1, -1]) { const a = em(e, 'sph', PAL.storm, { sc: 4, core: .6, flow: [0, 2, 0] }); a.userData.s = s; }
  }, (e, fade, dt) => {
    const T = EU.uTime.value, c = V(e.pos.x, e.pos.y + .4 + .15 * Math.sin(T * 2.5), e.pos.z), g = outBack(Math.min(1, e.a * 5)) * fade;
    const [b, t, ...arms] = e.ms;
    b.position.copy(c); b.scale.set(.45 * g, .55 * g, .45 * g);
    t.position.copy(c).add(V(0, -.3, 0)); t.rotation.y += dt * 8; t.scale.set(.32 * g, 1 * g, .32 * g);
    for (const a of arms) { a.position.copy(c).add(V(a.userData.s * .55, .1 * Math.sin(T * 6), 0)); a.rotation.z = a.userData.s * (.6 + .3 * Math.sin(T * 6)); a.scale.set(.13 * g, .33 * g, .13 * g); }
    if (Math.random() < dt * 10) zap(c, c.clone().add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(.7)), .05, .5, false);
  });
}
