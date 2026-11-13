// ───────────────────────── IK und Posen: applyPose setzt eine Pose (Hüfte, Brust, Hals, Füße und Hände per IK, Stab, Requisite), P/cp/mix/kf bauen Posen

import * as THREE from 'three';
import { clamp, lerpTo as lerp, inOut, outC, V, outBack, sine } from '../../util';
import { ik } from '../strichKit';
import { A1, A2, L1, L2, UP } from './shared';

const EASE = { io: inOut, out: outC, back: outBack, lin: t => t, sine };
const _w = V(), _pw = V(), _rq = new THREE.Quaternion(), _sq = new THREE.Quaternion(), _hp = V();
export function applyPose(F, p) {
  const R = F.root;
  F.hips.position.y = p.y; F.hips.rotation.set(p.h[0], p.h[1], p.h[2]); F.chest.rotation.set(p.c[0], p.c[1], p.c[2]); F.neck.rotation.set(p.n[0], p.n[1], p.n[2]);
  R.updateMatrixWorld(true);
  for (const [l, f] of [[F.legL, p.fL], [F.legR, p.fR]]) {
    const kp = p.kp || 0;
    R.localToWorld(_w.set(f[0], f[1], f[2]));
    R.localToWorld(_pw.set(f[0] + l.side * (.15 + 1.6 * kp), .7 + .3 * kp, f[2] + 2 * (1 - kp)));
    ik(l.th, l.sh, L1, L2, _w, _pw);
    l.sh.updateWorldMatrix(true, false); l.sh.getWorldQuaternion(_sq); R.getWorldQuaternion(_rq);
    l.ft.quaternion.copy(_sq.invert().multiply(_rq));
    if (p.toe) l.ft.rotateX(p.toe);
  }
  const ep = p.ep || DEF.ep;
  for (const [a, h] of [[F.armL, p.hL], [F.armR, p.hR]]) {
    R.localToWorld(_w.set(h[0], h[1], h[2])); R.localToWorld(_pw.set(a.side * ep[0], ep[1], ep[2]));
    ik(a.ua, a.fa, A1, A2, _w, _pw);
  }
  R.updateMatrixWorld(true);
  // Stab-Gelenk: in der rechten Hand (Griff) oder schwebend (sf = 1). Die Waffe hängt daran
  const dir = V(p.b[0], p.b[1], p.b[2]).normalize();
  F.staff.quaternion.setFromUnitVectors(UP, dir);
  R.worldToLocal(F.armR.hand.getWorldPosition(_hp));
  if (p.sf) _hp.lerp(V(p.sp[0], p.sp[1], p.sp[2]), p.sf);
  F.staff.position.copy(_hp);
  // Requisite beim Trinken: eigener Bone im Körper-Mesh, versteckt = Größe 0, an der linken Hand 1,5-fach
  const show = p.ps > .02;
  for (const b of Object.values<any>(F.props)) b.scale.setScalar(1e-4);
  if (show && F.prop) {
    R.worldToLocal(F.armL.hand.getWorldPosition(_hp));
    F.prop.position.copy(_hp); F.prop.quaternion.setFromUnitVectors(UP, V(p.pd[0], p.pd[1], p.pd[2]).normalize()); F.prop.scale.setScalar(p.ps * 1.5);
  }
  R.updateMatrixWorld(true);
}
const KEYS = ['y', 'h', 'c', 'n', 'hL', 'hR', 'b', 'fL', 'fR', 'kp', 'sf', 'sp', 'toe', 'pd', 'ps', 'ep'];
const DEF = { kp: 0, sf: 0, sp: [-.7, 1, 0], toe: 0, pd: [0, 1, 0], ps: 0, ep: [1.3, .9, -.6] };   // pd/ps: Richtung und Größe der Requisite beim Trinken, ep: Ellbogen-Pol
export const P = (base, o = {}): any => Object.assign({}, DEF, base, o);
export const cp = p => { const o: any = {}; for (const k of KEYS) o[k] = Array.isArray(p[k]) ? p[k].slice() : p[k]; return o; };
export function mix(a, b, u) { const o: any = {}; for (const k of KEYS) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u); return o; }
export function kf(keys, u) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i], [t1, p1, e] = keys[i + 1];
  return mix(p0, p1, (EASE[e] || inOut)(clamp((u - t0) / Math.max(1e-4, t1 - t0), 0, 1)));
}
