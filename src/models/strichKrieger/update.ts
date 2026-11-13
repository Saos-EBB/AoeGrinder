// Pro Frame des Strichkriegers (KOMP-03/04): update in Schritte geteilt wie beim Magier.
// startAction (neue Fähigkeit) → stepAction (laufender Move) oder locoPose (Laufen, Sitzen, Tod …) → applyPose (Blend, Bones, IK, Schwert, Keule) → tickFx (Wut-Aura, Stoffbahn, Skin, Effekte).
// Aus strichKrieger.ts herausgezogen, Werte und Reihenfolge der Math.random-Aufrufe unverändert.
import * as THREE from 'three';
import { clamp, lerpTo as lerp, inOut, V } from '../../util';
import { ik } from '../strichKit';
import { EASE, mix, KEYS, IDLE, SIT, DEAD, P, runPose } from './poses';
import { makeAction } from './actions';
import { L1, L2, A1, A2 } from './parts';
import { lookTick } from './looks';
import type { Fig } from './fig';

// Pose aus einer Schlüssel-Pose: Kopie, hL 'G' = linke Hand am Griff (letzte Griff-Lage)
export function resolve(F: Fig, p) {
  const o: any = {};
  for (const k of KEYS) { const v = p[k]; o[k] = Array.isArray(v) ? v.slice() : v; }
  if (p.hL === 'G') { o.hL = F.anim.lastGrip.slice(); o.g = 1; } else o.g = 0;
  return o;
}
function evalKeys(F: Fig, keys, u) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i], [t1, p1, e] = keys[i + 1];
  const k = (EASE[e] || inOut)(clamp((u - t0) / Math.max(1e-4, t1 - t0), 0, 1));
  return mix(resolve(F, p0), resolve(F, p1), k);
}
export function cancel(F: Fig) { F.anim.act?.def.end?.(); F.anim.act = null; }

// ---------- Rig: Beine, Arme, Schwert ----------
const _w = V(), _pw = V(), _rq = new THREE.Quaternion(), _sq = new THREE.Quaternion();
function legIK(F: Fig, l, f) {
  const { root } = F;
  root.localToWorld(_w.set(f[0], f[1], f[2]));
  root.localToWorld(_pw.set(f[0] + l.side * .25, .8, f[2] + 2));
  ik(l.th, l.sh, L1, L2, _w, _pw);
  l.sh.updateWorldMatrix(true, false);
  l.sh.getWorldQuaternion(_sq); root.getWorldQuaternion(_rq);
  l.ft.quaternion.copy(_sq.invert().multiply(_rq));
}
function armIK(F: Fig, a, h) {
  const { root } = F;
  root.localToWorld(_w.set(h[0], h[1], h[2]));
  root.localToWorld(_pw.set(a.side * 1.4, .7, -.6));
  ik(a.ua, a.fa, A1, A2, _w, _pw);
}
const _m = new THREE.Matrix4(), _x = V(), _y = V(), _z = V(), _hp = V();
// Klinge: y = Richtung, x = Schneide (Hinweis e)
function placeSword(F: Fig, dir, edge) {
  const { root, sword, armR } = F;
  _y.set(dir[0], dir[1], dir[2]).normalize();
  _x.set(edge[0], edge[1], edge[2]); _x.addScaledVector(_y, -_x.dot(_y));
  if (_x.lengthSq() < 1e-4) _x.set(0, 1, 0).addScaledVector(_y, -_y.y);
  if (_x.lengthSq() < 1e-4) _x.set(1, 0, 0);
  _x.normalize(); _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z); sword.quaternion.setFromRotationMatrix(_m);
  root.worldToLocal(armR.hand.getWorldPosition(_hp));
  sword.position.copy(_hp);
}
export const gripL = (F: Fig) => F.sword.position.clone().addScaledVector(V(0, 1, 0).applyQuaternion(F.sword.quaternion), -F.anim.gripLen);
export const tipPos = (F: Fig) => F.root.localToWorld(F.sword.position.clone().addScaledVector(V(0, 1, 0).applyQuaternion(F.sword.quaternion), F.anim.tipLen));

// ---------- Schritte ----------
// Neue Fähigkeit (ability + seq), Halte-Moves (Wirbel) enden beim Wechsel. Kein Move im Tod
function startAction(F: Fig, W, anim, loco: string, ability) {
  const A = F.anim;
  const key = ability ? `${ability}:${anim.seq ?? 0}` : '';
  if (key === A.actKey) return;
  A.actKey = key;
  if (A.act?.def.hold) { cancel(F); A.blendFrom = A.lastPose; A.blendT = .15; }
  const def = key && loco !== 'dead' ? makeAction(F, W, ability) : null;
  if (def) {
    cancel(F);
    def.ev.sort((x, y) => x[0] - y[0]);
    A.act = { def, t: 0, i: 0 };
    A.blendFrom = A.lastPose; A.blendT = .1;
  }
}
const runStep = (F: Fig, anim, loco: string, s: number) => { F.anim.runPh += s * (anim.speed || 7) / .65 * (loco === 'back' ? -1 : 1); };
// Laufender Move: Zeit, Ereignisse, tick, Pose aus den Schlüsseln. Schläge 1–3 gehen im Laufen
export function stepAction(F: Fig, anim, loco: string, s: number) {
  const A = F.anim, d = A.act.def;
  if (!anim.frozen) A.act.t += s * 1000 * (anim.rate ?? 1);
  const u = clamp(A.act.t / d.dur, 0, 1);
  while (A.act.i < d.ev.length && d.ev[A.act.i][0] <= u) d.ev[A.act.i++][1]();
  d.tick?.(u, anim.frozen ? 0 : s);
  const pose = evalKeys(F, d.keys, u);
  if (d.walk && (loco === 'run' || loco === 'back')) {
    runStep(F, anim, loco, s);
    const r = runPose(A.runPh);
    pose.y = r.y; pose.fL = r.fL; pose.fR = r.fR;
  }
  if (u >= 1 && !d.hold) { d.end?.(); A.act = null; A.blendFrom = pose; A.blendT = .18; }
  return pose;
}
// Ohne Move: Laufen/Rückwärts (Staub an der Spitze), Sprung, Tod, Sitzen mit Keule, sonst schweres Atmen
export function locoPose(F: Fig, anim, loco: string, s: number) {
  const A = F.anim;
  if (loco === 'run' || loco === 'back') {
    if (!anim.frozen) runStep(F, anim, loco, s);
    const pose = resolve(F, runPose(A.runPh));
    if (loco === 'run' && Math.random() < .5) F.fx.emit(F.tipPos().setY(F.gy() + .05), 1, 1.5, 0x8f877a, 8, .5);
    return pose;
  }
  if (loco === 'air') return resolve(F, P(IDLE, { y: .98, fL: [.25, .42, .2], fR: [-.25, .3, -.22] }));
  if (loco === 'dead') return resolve(F, DEAD);
  if (loco === 'sit') {
    const pose = resolve(F, SIT);
    // Biss alle 2,4 s: Keule zum Mund, Kopf reißt zur Seite, dann kauen
    const k = (A.T % 2.4) / 2.4, b = k < .4 ? Math.sin(Math.PI * k / .4) ** .7 : 0, tear = k > .22 && k < .4 ? Math.sin(Math.PI * (k - .22) / .18) : 0;
    const chew = k >= .4 ? Math.abs(Math.sin(A.T * 14)) * .06 : 0;
    pose.hL = [lerp(.35, .08, b) + .12 * tear, lerp(.75, 1.25, b), lerp(.4, .28, b)];
    pose.n = [.1 + .2 * b + chew, -.5 * tear, .15 * tear];
    pose.c[0] = .2 + .2 * b;
    A.eatK = { s: b, k };
    return pose;
  }
  const pose = resolve(F, IDLE);
  // schweres Atmen: Brust hebt sich, Schultern mit
  const br = Math.sin(A.T * 1.9);
  pose.y += .02 * br; pose.c[0] += .05 * br; pose.hR[1] += .03 * br; pose.n[0] -= .04 * br;
  return pose;
}
const applyTuple = (e, v) => e.set(v[0], v[1], v[2]);
// Drehung (Spin) und Sprunghöhe, Blend, Bones, IK, Schwert, linke Hand am Griff, Fleischkeule beim Essen
export function applyPose(F: Fig, pose, loco: string, s: number) {
  const A = F.anim, { root, hips, chest, neck, armL, armR, legL, legR, meat } = F;
  root.rotation.y += A.spinAng;
  root.position.y += A.lift;
  if (A.blendT > 0 && A.blendFrom) { A.blendT -= s; pose = mix(A.blendFrom, pose, 1 - clamp(A.blendT / .15, 0, 1)); }
  A.lastPose = pose;

  hips.position.y = pose.y; applyTuple(hips.rotation, pose.h); applyTuple(chest.rotation, pose.c); applyTuple(neck.rotation, pose.n);
  root.updateMatrixWorld(true);
  legIK(F, legL, pose.fL); legIK(F, legR, pose.fR);
  armIK(F, armR, pose.hR);
  root.updateMatrixWorld(true);
  placeSword(F, pose.b, pose.e);
  const g = gripL(F); A.lastGrip = g.toArray();
  armIK(F, armL, pose.hL.map((v, i) => lerp(v, A.lastGrip[i], pose.g)));
  root.updateMatrixWorld(true);
  // Fleischkeule beim Essen, nur dann ein Draw Call mehr
  meat.visible = loco === 'sit' && !A.act;
  if (meat.visible) {
    root.worldToLocal(armL.hand.getWorldPosition(meat.position));
    meat.quaternion.setFromUnitVectors(V(0, 1, 0), V(lerp(.3, -.7, A.eatK.s), lerp(.85, .35, A.eatK.s), lerp(.2, .1, A.eatK.s)).normalize());
    if (A.eatK.k > .3 && A.eatK.k - s / 2.4 <= .3) F.fx.emit(meat.getWorldPosition(V()).add(V(0, .1, 0)), 8, 1.5, 0x8a3b1c, 10, .5);
  }
}
// Wut-Aura (Dicke und Deckkraft wachsen mit der Wut, ohne Wut kein Draw Call), Stoffbahn, Skin-Gags, Effekte, Partikel
export function tickFx(F: Fig, anim, loco: string, s: number) {
  const A = F.anim, { root, aura, auraMat } = F, { auraRing, emit } = F.fx;
  A.rage = anim.rage ?? 0;
  A.flare = Math.max(0, A.flare - s * 1.2);
  const r = A.rage / 100, I = clamp(r * r * .9 + A.flare * .6, 0, 1.4);
  const IB = anim.berserk ? 1.4 : I;   // Berserker: Hülle voll
  auraMat.userData.u.uInf.value = .025 + .07 * IB; auraMat.userData.u.uK.value = clamp(IB * .45, 0, .62);
  aura.visible = auraRing.visible = (r > .05 || A.flare > 0 || !!anim.berserk) && loco !== 'dead';
  auraRing.material.opacity = .45 * I; auraRing.position.set(root.position.x, F.gy() + .01, root.position.z); auraRing.scale.setScalar(1 + .6 * I + .05 * Math.sin(A.T * 10));
  if (aura.visible && Math.random() < I * s * 40) emit(root.position.clone().add(V((Math.random() - .5) * .9, .3 + Math.random() * 1.6, (Math.random() - .5) * .9)), 1, .4, 0xe0141c, -2.5, .8);

  F.fx.clothStep(s);
  lookTick(F, s, anim);
  F.fx.updateFx(s); F.fx.updateParts(s);
}

// anim = { state, speed, ability, seq, rate, rage, frozen, qPal, fin, berserk, kills }. dt > 1 gilt als ms. W: Waffe aus STRICH_TIMING.weapons
export function updateWar(F: Fig, W, dt: number, anim: any = {}) {
  const A = F.anim, s = dt > 1 ? dt / 1000 : dt;
  A.T += s;
  const loco = anim.state || 'idle', ability = anim.ability || null;
  A.qPal = anim.qPal ?? null; if (anim.fin) A.fin = anim.fin;
  if (loco === 'dead' && A.act) cancel(F);
  startAction(F, W, anim, loco, ability);
  if (loco !== A.lastLoco) { A.blendFrom = A.lastPose; A.blendT = .15; A.lastLoco = loco; }
  const pose = A.act ? stepAction(F, anim, loco, s) : locoPose(F, anim, loco, s);
  applyPose(F, pose, loco, s);
  tickFx(F, anim, loco, s);
}
