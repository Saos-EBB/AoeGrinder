// Gemeinsamer Kern für Boss-Angriffe und -Regeln: Kampf-Zustand, Zeit (Tasks an der Spielzeit), Warnflächen, Geschosse, Treffer, Lücke, Posen.
// Kein Klassenbaum: ein Kampf ist das Objekt `fight`, ein Körper ist ein Objekt in fight.bodies. Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from '../state';
import { maxHp } from '../formulas';
import { groundAt, resolve } from '../collision';
import { damagePlayer } from '../player';
import { scene } from '../render';
import { addTrauma, decal, debris } from '../wucht';
import { hitstop } from '../fx/impact';
import { combatText } from '../feedback';
import { fx, em, killFx, boom, ring as eRing, sparks, PAL, gy as groundY } from '../vfx/energy';
import { V, clamp, outC as ease, rand as rnd, wrap, dist2d as dist2 } from '../util';

// V, clamp, ease (= outC), rnd, wrap, dist2 (= dist2d) aus util.ts, hier nur weitergereicht (bosses/* importieren von hier)
export { V, clamp, ease, rnd, wrap, dist2 };
export const TAU = Math.PI * 2;
export const easeIn = k => k * k;
export const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
// Boden für Boss-Effekte: Probe 2 über p (vfx/energy.ts gy mit up = 2)
export const gy = p => groundY(p, 2);
export const onGround = p => V(p.x, gy(p), p.z);

// Zahlen der Boss-Kämpfe, alle PH
export const BK = {
  hit: 0.25,          // Treffer = 25 % max. Leben (ohne Stufe; sonst fight.hit aus TIER, bosses/roster.ts)
  punish: 1.25,       // Lücke: Boss nimmt +25 % Schaden
  windP2: 0.8,        // Phase 2: Ausholzeiten × 0,8
  dot: 0.05,          // Pfützen, Feuerwand: Anteil max. Leben pro Sekunde, ignoriert Dodge
  teleColor: 0xff2a2a,
};

// ---------- Kampf-Zustand ----------
// fight: { def, bodies, phase, time (s, Boss-Zeit), scale (Zeitstopp 0), arena, center, windMul, dmgMul, hit, pause, tier, flags, hooks }
export let fight: any = null;
export const setFight = f => { fight = f; tasks.length = 0; objs.length = 0; };

// ---------- Zeit: Tasks laufen in Boss-Zeit (Hitstop und Zeitstopp halten sie an) ----------
// Ein Lauf (run) gehört zu einem Angriff oder einer Regel. Stirbt der Lauf, fallen seine Tasks weg: der Angriff endet still.
type Task = { el: number; dur: number; fn?: (k: number) => void; done?: () => void; run?: any; real?: boolean };
const tasks: Task[] = [];
export function tw(run, dur, fn?, real = false): Promise<void> {
  return new Promise(res => tasks.push({ el: 0, dur: Math.max(dur, 1e-4), fn, done: res, run, real }));
}
export const wait = (run, s) => tw(run, s);
export const newRun = () => ({ alive: true });
export function tickTasks(dt) {
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t.run && !t.run.alive) { tasks.splice(i--, 1); continue; }
    t.el += dt * (t.real ? 1 : fight?.scale ?? 1);
    const k = Math.min(1, t.el / t.dur);
    t.fn?.(k);
    if (k >= 1) { tasks.splice(i--, 1); t.done?.(); }
  }
}

// ---------- Lebende Objekte: Warnflächen, Geschosse, Pfützen. update(dt) → false = weg ----------
const objs: { update: (dt: number) => boolean; remove: () => void }[] = [];
export function addObj(o) { objs.push(o); return o; }
export function tickObjs(dt) { for (let i = 0; i < objs.length; i++) if (!objs[i].update(dt)) { objs[i].remove(); objs.splice(i--, 1); } }
export function clearObjs() { for (const o of objs) o.remove(); objs.length = 0; }

// ---------- Farben der Viewer-Effekte → Energie-Paletten ----------
export function palOf(hex = 0xff4a2a) {
  const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
  if (hsl.s < .2) return hsl.l > .5 ? PAL.stahl : PAL.rauch;
  const h = hsl.h * 360;
  if (h < 12 || h > 340) return hsl.l < .35 ? PAL.blut : PAL.wut;
  if (h < 45) return PAL.fire;
  if (h < 70) return PAL.donner;
  if (h < 160) return PAL.slime;
  if (h < 215) return PAL.ice;
  if (h < 250) return PAL.blitz;
  return PAL.arcane;
}

// ---------- Warnflächen: Kreis, Kegel, Linie, Quadrat. Grundfläche + Füllung bis zum Treffer, auf den Boden gelegt ----------
const teleMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
function gridGeo(nu, nv, fn) {
  const base = [], idx = [];
  for (let v = 0; v <= nv; v++) for (let u = 0; u <= nu; u++) base.push(...fn(u / nu, v / nv));
  for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) { const a = v * (nu + 1) + u, b = a + nu + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.length / 2 * 3), 3));
  geo.setIndex(idx);
  geo.userData.base = base;
  return geo;
}
// Form in lokalen Koordinaten (x quer, z nach vorn), Einheit 1
const SHAPES = {
  circle: () => gridGeo(32, 4, (u, v) => [Math.sin(u * TAU) * v, Math.cos(u * TAU) * v]),
  cone: ang => gridGeo(16, 4, (u, v) => { const a = (u - .5) * ang; return [Math.sin(a) * v, Math.cos(a) * v]; }),
  line: () => gridGeo(1, 16, (u, v) => [u - .5, v]),
  square: () => gridGeo(4, 4, (u, v) => [u - .5, v - .5]),
};
function layGeo(geo, c, sx, sz, yaw, y0, lift) {
  const base = geo.userData.base, arr = geo.attributes.position.array, co = Math.cos(yaw), si = Math.sin(yaw);
  for (let i = 0, j = 0; i < base.length; i += 2, j += 3) {
    const lx = base[i] * sx, lz = base[i + 1] * sz, x = c.x + lx * co + lz * si, z = c.z - lx * si + lz * co;
    arr[j] = x; arr[j + 1] = groundAt(x, z, y0 + 2) + lift; arr[j + 2] = z;
  }
  geo.attributes.position.needsUpdate = true;
}
// o: { pos, yaw, r | len + w | size, ang (Bogenmaß, Kegel), fill: 'grow' | 'x' }. dur in s Boss-Zeit. run: stirbt der Angriff, verschwindet die Fläche
export function tele(shape: 'circle' | 'cone' | 'line' | 'square', o, dur, color = BK.teleColor, run = null) {
  const geoA = SHAPES[shape](o.ang), geoB = SHAPES[shape](o.ang);
  const a = new THREE.Mesh(geoA, teleMat(color, .2)), b = new THREE.Mesh(geoB, teleMat(color, .42));
  for (const m of [a, b]) { m.frustumCulled = false; m.renderOrder = 2; scene.add(m); }
  const h: any = { pos: o.pos.clone(), yaw: o.yaw ?? 0, t: 0, dur, gone: false };
  const sx = shape === 'line' ? o.w : shape === 'square' ? o.size : o.r, sz = shape === 'line' ? o.len : shape === 'square' ? o.size : o.r;
  const lay = k => {
    layGeo(geoA, h.pos, sx, sz, h.yaw, h.pos.y, .12);
    const kk = Math.max(.02, k);
    if (shape === 'line') layGeo(geoB, h.pos, sx, sz * kk, h.yaw, h.pos.y, .14);
    else layGeo(geoB, h.pos, sx * kk, sz * kk, h.yaw, h.pos.y, .14);
  };
  lay(0);
  h.move = (pos, yaw = h.yaw) => { h.pos.copy(pos); h.yaw = yaw; };
  h.remove = () => { h.gone = true; };
  addObj({ update: dt => { if (h.gone || (run && !run.alive)) return false; h.t += dt * (fight?.scale ?? 1); lay(clamp(h.t / dur, 0, 1)); return h.t < dur; },
    remove: () => { for (const m of [a, b]) { scene.remove(m); m.geometry.dispose(); (m.material as any).dispose(); } } });
  return h;
}

// ---------- Treffer am Spieler ----------
// i-Frames, Perfekter Dodge, Konter usw. greifen in damagePlayer. true, wenn Leben abging
export function hurt(mul = 1, from?, body?) {
  if (player.dead || !fight) return false;
  const hp = player.hp;
  if (body) body.mob.attackAt = state.now;
  const dmg = maxHp() * (fight.hit ?? BK.hit) * mul * (fight.dmgMul ?? 1) * (body?.grow ?? 1) * (body?.dmgMul ?? 1);
  fight.lastHitTry = state.now;
  damagePlayer(Math.round(dmg), false, fight.def.name);
  if (player.hp < hp) { fight.stats.hits++; for (const fn of fight.hooks.onPlayerHit) fn(body); return true; }
  for (const fn of fight.hooks.onDodged) fn(body);
  return false;
}
// Dauerschaden (Pfützen, Feuerwand, Arena-Rand): kein Dodge
export function burnPlayer(frac, source) { if (!player.dead && fight) damagePlayer(Math.max(1, Math.round(maxHp() * frac)), true, source ?? fight.def.name); }

// ---------- Körper: Blick, Posen, Lücke ----------
export function face(b, target = player.pos) { b.yaw = yawTo(b.mob.pos, target); return V(Math.sin(b.yaw), 0, Math.cos(b.yaw)); }
export const dirOf = b => V(Math.sin(b.yaw), 0, Math.cos(b.yaw));
export const arms = (b, a) => { b.mob.model.ctl.arms = a; };
export const lean = (b, a) => { b.mob.model.ctl.lean = a; };
export const R = (b, r) => r * (b.grow ?? 1);
export const windMul = b => (fight.phase === 2 ? BK.windP2 : 1) * (fight.windMul ?? 1) * (b.windMul ?? 1);
// Ausholen: Arme hoch, dreht bis track des Ausholens mit
export async function windup(run, b, dur, track = .7) {
  await tw(run, dur * windMul(b), k => { if (k < track) face(b); const e = ease(Math.min(1, k * 1.4)); arms(b, -2.6 * e); lean(b, -.2 * e); });
}
export function strike(run, b) {
  tw(run, .09, k => { arms(b, -2.6 + 2.0 * k); lean(b, -.2 + .48 * k); }).then(() => tw(run, .4, k => { arms(b, -.6 * (1 - k)); lean(b, .28 * (1 - k)); }));
}
// Lücke: Boss leuchtet weiß, nimmt BK.punish mehr Schaden
export async function gap(run, b, s) {
  if (!s) return;
  b.gapUntil = fight.time + s;
  b.mob.bossTint = 'gap';
  b.mob.hitAt = state.now;
  await wait(run, s);
  b.mob.bossTint = fight.phase === 2 ? 'boss2' : 'boss';
}
// Boss bewegen: nie aus der Arena, nie in den Spieler
export function moveBody(b, p) {
  b.mob.pos.x = p.x; b.mob.pos.z = p.z;
  resolve(b.mob.pos, .7);
  b.mob.pos.y = p.y ?? gy(b.mob.pos);
}

// ---------- Effekte ----------
export const textAt = (p, txt, cls = 'info', s = 2.6) => combatText(p, txt, cls, s);
export function impactFx(pos, r, color, trauma = .4) {
  const g = onGround(pos);
  eRing(g, r * 1.1, palOf(color), .45);
  sparks(g.clone().setY(g.y + .3), 20, palOf(color), { v: [0, 4, 0], grav: 12, life: .7, spread: r * .5 });
  decal(g, 3, Math.min(8, r));
  debris(g);
  addTrauma(trauma);
}
export function bigImpact(pos, r, color) { impactFx(pos, r, color, .9); boom(onGround(pos).add(V(0, 1, 0)), r * .6, palOf(color), .6, { ground: gy(pos), n: 30 }); hitstop(90); }

// Geschoss: fliegt von from in Richtung dir, trifft einmal, verschwindet am Arena-Rand oder nach dist
export function shoot(from, dir, speed, dist, size, color, onHit: () => unknown = () => hurt(1, from)) {
  const e = fx(1e9); const m = em(e, 'sph', palOf(color), { sc: 5, core: 1, puff: .06, flow: [0, 2, 0] });
  m.scale.setScalar(size * 1.3);
  const p = from.clone(); let flown = 0;
  addObj({
    update: dt => {
      const s = speed * dt * (fight?.scale ?? 1);
      p.addScaledVector(dir, s); flown += s;
      p.y = Math.max(gy(p) + .9, p.y - s * .3);
      m.position.copy(p);
      if (dist2(p, player.pos) < size + .45 && Math.abs(p.y - (player.pos.y + 1)) < 1.6) { onHit(); sparks(p, 8, palOf(color), { life: .4 }); return false; }
      return flown < dist && (!fight || dist2(p, fight.center) < fight.arena + 2);
    },
    remove: () => killFx(e),
  });
}
// Energie-Mesh, das mit seinem Lauf verschwindet (oder mit h.kill())
export function liveMesh(run, name, pal, o = {}) {
  const e = fx(1e9), m = em(e, name, pal, o), h = { m, done: false, kill() { h.done = true; } };
  addObj({ update: () => !h.done && (!run || run.alive) && !!fight, remove: () => killFx(e) });
  return h;
}
// Bogenwurf zu t, Promise löst bei der Landung auf. Stirbt der Lauf, verschwindet der Brocken
export function lob(run, from, t, color, dur) {
  const e = fx(1e9); const m = em(e, 'sph', palOf(color), { sc: 5, core: 1, flow: [0, 2, 0] }); m.scale.setScalar(.45);
  const o = from.clone(), to = onGround(t); let el = 0;
  return new Promise<void>(res => addObj({
    update: dt => {
      if (run && !run.alive) return false;
      el += dt * (fight?.scale ?? 1); const k = Math.min(1, el / dur);
      m.position.lerpVectors(o, to, k); m.position.y += Math.sin(Math.PI * k) * 4;
      if (k >= 1) { res(); return false; }
      return true;
    },
    remove: () => killFx(e),
  }));
}
