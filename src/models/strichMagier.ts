// Strichmagier: Basis-Figur mit den Skins Feuer, Eis und Arkan aus dem Viewer „Frost Grind – Strichmagier“ (magier.html). Ersetzt die alten Skelett-Magier.
// Ein SkinnedMesh für den Körper, eins für alles, was leuchtet oder brennt, bei Arkan die Runen. Jeder Skin hat eigene Bewegungen.
// Gleiche Schnittstelle wie buildMage: anim = { state, speed, cast, channel, squat, frozen }, anchors.crystal hängt am Stabgelenk (dort sitzt die Waffe), trail und fx bleiben.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTrail, stepWatcher, SKIN_FX } from './trail';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const inOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const outC = t => 1 - Math.pow(1 - t, 3);
const outBack = t => { const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const sine = t => .5 - .5 * Math.cos(Math.PI * t);
const EASE = { io: inOut, out: outC, back: outBack, lin: t => t, sine };
const TAU = Math.PI * 2;
const bump = (t, a, b, f = .15) => clamp(Math.min((t - a) / f, (b - t) / f), 0, 1); // 0→1→0 im Fenster

// Im Spiel: Zaubern dauert höchstens so lang, sonst hinkt die Figur dem schnellen Zaubern hinterher. Der Viewer zeigt 1,0–2,2 s. // PH
const CAST_MS = 700;
const CAST_HOLD = 0.55;       // Hier wartet die Pose, solange ein längerer Zauber läuft
const RIM = { color: [0.5, 0.55, 0.65], power: 2.6 };   // wie Klingenstrich: bleibt im Dunkeln sichtbar // PH
// Skin-IDs im Spiel → Skins des Viewers
const SKIN_OF = { alle: 'base', feuer: 'fire', frost: 'ice', arkan: 'arcane' };

const grad = new THREE.DataTexture(new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;

function prep(geo, color, m?, flick = false) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (flick) { // 0 an der Basis, 1 an der Spitze (lokales y vor der Transformation)
    g.computeBoundingBox(); const b = g.boundingBox, f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = (g.attributes.position.getY(i) - b.min.y) / Math.max(1e-4, b.max.y - b.min.y);
    g.setAttribute('flick', new THREE.BufferAttribute(f, 1));
  }
  if (m) g.applyMatrix4(m);
  const col = new Float32Array(n * 3);
  const c2 = flick && color.tip ? color.tip : null;
  for (let i = 0; i < n; i++) {
    const c = c2 ? color.base.clone().lerp(c2, g.attributes.flick.array[i]) : (color.base || color);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.flick) g.setAttribute('flick', new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
}
const capDown = (r, len, rs = 6) => { const g = new THREE.CapsuleGeometry(r, len, 2, rs); g.translate(0, -len / 2, 0); return g; };
const col = h => new THREE.Color(h);

const L1 = .46, L2 = .46, A1 = .31, A2 = .29;
const SKINS = {
  base: { name: 'Basis', ink: col(0x2b2b33), accent: col(0x2a2622), orb: col(0xe2b13c) },
  fire: { name: 'Feuer', ink: col(0x2a1c18), accent: col(0x7a2a10), orb: col(0xffb02e) },
  ice: { name: 'Eis', ink: col(0x1f3550), accent: col(0x5d86a8), orb: col(0x9fe9ff), ice: col(0xe4f6ff) },
  arcane: { name: 'Arkan', ink: col(0x2a1f45), accent: col(0x5b3a8f), orb: col(0xc58bff) }
};
const FLAME = { base: col(0xff5a12), tip: col(0xffd84a) };

function glowMat(glowU) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = glowU.uTime;
    sh.vertexShader = 'attribute float flick; uniform float uTime;\n' + sh.vertexShader.replace('#include <skinning_vertex>',
      `#include <skinning_vertex>
       float sd = position.x * 31.0 + position.z * 17.0;
       transformed += vec3(sin(uTime * 17.0 + sd) * .03, (.55 + .45 * sin(uTime * 23.0 + sd * 1.7)) * .13, cos(uTime * 13.0 + sd) * .03) * flick * flick;`);
  };
  return m;
}

function makeRunes() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
  const c = cv.getContext('2d'); c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round';
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 8; i++) {
    const ox = i * 64 + 12, oy = 10;
    c.beginPath(); c.moveTo(ox + 20, oy); c.lineTo(ox + 20, oy + 44);
    for (let k = 0; k < 3; k++) { const y = oy + rnd() * 40; c.moveTo(ox + 20, y); c.lineTo(ox + (rnd() < .5 ? 2 : 38), y + (rnd() - .5) * 24); }
    if (rnd() < .5) { c.moveTo(ox + 6, oy + 22); c.arc(ox + 20, oy + 22, 14, Math.PI, TAU * rnd()); }
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  const geos = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.PlaneGeometry(.2, .2);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 8);
    const a = i / 8 * TAU; g.rotateY(a); g.translate(Math.sin(a) * .85, 0, Math.cos(a) * .85); geos.push(g);
  }
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex, color: 0x9a4dff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  m.position.y = 1.15; return m;
}

const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), DOWN = V(0, -1, 0);
function ik(upper, lower, l1, l2, targetW, poleW) {
  const par = upper.parent;
  const T = par.worldToLocal(_a.copy(targetW)), pole = par.worldToLocal(_b.copy(poleW)), P = upper.position;
  const d = _c.subVectors(T, P); const L = clamp(d.length(), 1e-3, l1 + l2 - 1e-3); d.normalize();
  const al = Math.acos(clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1));
  const pp = _d.subVectors(pole, P); pp.addScaledVector(d, -pp.dot(d)); if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1); pp.normalize();
  const eDir = _e.copy(d).multiplyScalar(Math.cos(al)).addScaledVector(pp, Math.sin(al));
  upper.quaternion.setFromUnitVectors(DOWN, eDir);
  const E = _b.copy(P).addScaledVector(eDir, l1);
  const lDir = _a.copy(P).addScaledVector(d, L).sub(E).normalize();
  _q.setFromUnitVectors(DOWN, lDir); lower.quaternion.copy(_q2.copy(upper.quaternion).invert().multiply(_q));
}
const _w = V(), _pw = V(), _rq = new THREE.Quaternion(), _sq = new THREE.Quaternion(), _hp = V(), UP = V(0, 1, 0);
function applyPose(F, p) {
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
  for (const [a, h] of [[F.armL, p.hL], [F.armR, p.hR]]) {
    R.localToWorld(_w.set(h[0], h[1], h[2])); R.localToWorld(_pw.set(a.side * 1.3, .9, -.6));
    ik(a.ua, a.fa, A1, A2, _w, _pw);
  }
  R.updateMatrixWorld(true);
  // Stab: in der rechten Hand (Griff) oder schwebend (sf = 1)
  const dir = V(p.b[0], p.b[1], p.b[2]).normalize();
  F.staff.quaternion.setFromUnitVectors(UP, dir);
  R.worldToLocal(F.armR.hand.getWorldPosition(_hp));
  if (p.sf) _hp.lerp(V(p.sp[0], p.sp[1], p.sp[2]), p.sf);
  F.staff.position.copy(_hp);
  R.updateMatrixWorld(true);
}

const KEYS = ['y', 'h', 'c', 'n', 'hL', 'hR', 'b', 'fL', 'fR', 'kp', 'sf', 'sp', 'toe'];
const DEF = { kp: 0, sf: 0, sp: [-.7, 1, 0], toe: 0 };
const P = (base, o = {}): any => Object.assign({}, DEF, base, o);
const cp = p => { const o: any = {}; for (const k of KEYS) o[k] = Array.isArray(p[k]) ? p[k].slice() : p[k]; return o; };
function mix(a, b, u) { const o: any = {}; for (const k of KEYS) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u); return o; }
function kf(keys, u) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i], [t1, p1, e] = keys[i + 1];
  return mix(p0, p1, (EASE[e] || inOut)(clamp((u - t0) / Math.max(1e-4, t1 - t0), 0, 1)));
}
const add = (p, k, v) => { p[k] = p[k].map((x, i) => x + (v[i] || 0)); };

const N = P({ y: .98, h: [0, 0, 0], c: [.05, 0, 0], n: [0, 0, 0], hL: [.3, .95, .06], hR: [-.3, 1.08, .14], b: [0, 1, .04], fL: [.13, .06, 0], fR: [-.13, .06, 0] });
function runBase(ph, A = .5, lift = .28) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return { fL: [.12, .06 + lift * Math.max(0, c), A * s], fR: [-.12, .06 + lift * Math.max(0, -c), -A * s], s, c };
}
const ANIM = {
  // ── Basis: ruhig, neutral
  base: {
    idle: t => { const p = cp(N); const br = Math.sin(t * 1.8); p.y += .01 * br; p.c[0] += .025 * br; return p; },
    run: t => {
      const ph = t * 11, r = runBase(ph);
      return P(N, { y: .95 - .04 * Math.abs(r.c), c: [.3, -.1 * r.s, 0], n: [-.25, 0, 0], h: [0, .15 * r.s, 0], fL: r.fL, fR: r.fR,
        hL: [.28, 1.08, -.3 * r.s], hR: [-.3, 1.12, .3 * r.s], b: [0, .75, .65] });
    },
    cast: { dur: 1000, keys: () => {
      const w = P(N, { c: [-.08, .35, 0], hL: [.38, 1.32, -.25] });
      const push = P(N, { y: .92, c: [.25, -.3, 0], n: [-.1, .2, 0], hL: [.12, 1.45, .62], fL: [.15, .06, .3], fR: [-.13, .06, -.15] });
      return [[0, N], [.35, w], [.55, push, 'out'], [.8, push], [1, N]];
    } },
    chan: t => P(N, { y: .96, c: [-.05, 0, 0], n: [-.15, 0, 0], hL: [.26, 1.62, .45], hR: [-.24, 1.6, .4], b: [0, .9, .45],
      fL: [.16, .06, .12], fR: [-.16, .06, -.12] })
  },

  // ── Feuer: chaotisch, Theater, Cartoon
  fire: {
    idle: t => {
      const bounce = Math.abs(Math.sin(t * Math.PI * 2.2));
      const p = P(N, {
        y: .93 + .06 * bounce, h: [0, .22 * Math.sin(t * 3.1), .05 * Math.sin(t * 6.9)],
        c: [.12, .15 * Math.sin(t * 2.2), .14 * Math.sin(t * 13.8)],
        n: [-.05, .25 * Math.tanh(4 * Math.sin(t * 1.3)), .38 * Math.tanh(5 * Math.sin(t * 1.7))],
        hL: [.42 + .16 * Math.sin(t * 3), 1.3 + .22 * Math.sin(t * 4.3), .3 + .1 * Math.cos(t * 2.4)],
        hR: [-.36, 1.12, .24], b: [Math.sin(t * 9), .35, Math.cos(t * 9)],
        fL: [.19, .06 + .07 * Math.max(0, Math.sin(t * 13.8)), .06], fR: [-.19, .06 + .07 * Math.max(0, -Math.sin(t * 13.8)), -.04]
      });
      // alle 5 s: „Ta-da!“, danach Lachanfall
      const k = t % 5;
      const tada = P(N, { y: 1.0, c: [-.25, 0, .15], n: [-.35, .2, .35], hL: [.78, 1.9, .2], hR: [-.75, 1.85, .25], b: [-.4, 1, .2], fL: [.2, .06, .25], fR: [-.15, .2, -.2], toe: -.6 });
      const laugh = P(N, { y: .9, c: [-.35 + .07 * Math.sin(t * 34), 0, .05 * Math.sin(t * 17)], n: [-.6 + .1 * Math.sin(t * 34), 0, .2], hL: [.25, 1.12, .32], hR: [-.3, 1.05, .2], b: [0, 1, .1], fL: [.16, .06, .05], fR: [-.16, .06, -.05] });
      let q = mix(p, tada, bump(k, 3.0, 3.9, .12));
      q = mix(q, laugh, bump(k, 3.9, 4.9, .15));
      return q;
    },
    run: t => {
      const ph = t * 8.5, r = runBase(ph, .9, .45);
      const s2 = Math.sin(ph * 2);
      return P(N, {
        y: .84 - .12 * Math.abs(r.c), h: [.1, .45 * r.s, .1 * r.s], c: [.35 + .18 * s2, -.35 * r.s, .1 * Math.sin(ph * 1.5)],
        n: [-.25 + .3 * s2, .35 * r.s, .25 * Math.sin(ph * 1.5)], fL: r.fL, fR: r.fR,
        hL: [.48 + .28 * Math.cos(ph * 2), 1.4 + .45 * Math.sin(ph * 2), .3 * r.s],
        hR: [-.48 - .28 * Math.cos(ph * 2 + 1), 1.4 + .45 * Math.sin(ph * 2 + 1.6), -.35 * r.s],
        b: [Math.sin(ph * 2), .5, Math.cos(ph * 2)]
      });
    },
    cast: { dur: 1600, keys: () => {
      const wind = P(N, { y: 1.02, h: [0, .5, 0], c: [-.5, .55, 0], n: [-.45, .4, .2], hL: [.62, 1.95, -.42], hR: [-.5, 1.3, .3], b: [-.6, .6, .5], fL: [.15, .06, .05], fR: [-.15, .5, .32], toe: -.5 });
      const hurl = P(N, { y: .74, h: [0, -.4, 0], c: [.65, -.65, 0], n: [-.45, -.35, -.2], hL: [.0, 1.35, .9], hR: [-.6, 1.25, -.3], b: [-.5, .3, -.8], fL: [.22, .06, .78], fR: [-.2, .06, -.55] });
      const bow = P(N, { y: .8, h: [0, .2, 0], c: [.85, .1, 0], n: [.45, 0, 0], hL: [.82, 1.15, .15], hR: [-.4, 1.05, -.4], b: [-.6, .35, -.7], fL: [.15, .06, .25], fR: [-.1, .06, -.62], toe: .3 });
      return [[0, N], [.3, wind, 'back'], [.42, hurl, 'out'], [.55, hurl], [.72, bow, 'back'], [.9, bow], [1, N]];
    } },
    chan: t => P(N, {
      y: .9 + .03 * Math.sin(t * 9), h: [0, .3 * Math.sin(t * 2.5), 0], c: [.1 + .12 * Math.sin(t * 5), -.2 * Math.sin(t * 2.5), .1 * Math.sin(t * 3.3)],
      n: [-.2 + .15 * Math.sin(t * 9), .2 * Math.sin(t * 2.5), .4],
      hL: [.4 + .3 * Math.sin(t * 7), 1.6 + .28 * Math.cos(t * 9.1), .45 + .1 * Math.sin(t * 5)], hR: [-.3, 1.45, .5],
      b: [.35 * Math.sin(t * 4), .45, .85], fL: [.22, .06, .2], fR: [-.22, .06 + .08 * Math.max(0, Math.sin(t * 9)), -.18]
    })
  },

  // ── Eis: steif, zittert, gleitet
  ice: {
    idle: t => {
      const shud = bump(t % 3.4, 2.6, 2.95, .05);
      const j = (Math.sin(t * 57) * .6 + Math.sin(t * 39) * .4) * (1 + 3 * shud);
      return P(N, {
        y: .95 - .02 * shud, h: [0, 0, 0], c: [.32 + .03 * shud, .01 * j, .018 * j], n: [.18, .02 * j, .03 * j],
        hL: [-.13 + .008 * j, 1.33, .19], hR: [.13 - .008 * j, 1.3, .21], b: [-.15, 1, .12],
        fL: [.08, .06, .03], fR: [-.08, .06, -.01]
      });
    },
    run: t => {
      const ph = t * 6.5;
      const leg = (s, side) => s > 0
        ? [side * (.12 + .5 * s), .06, -.38 * s]
        : [side * .12, .06 + .14 * (-s), .12 * (-s)];
      const s = Math.sin(ph);
      return P(N, {
        y: .8, h: [0, .12 * s, .12 * s], c: [.8, -.1 * s, .18 * s], n: [-.7, 0, -.1 * s],
        hL: [.12, 1.22, -.32], hR: [-.12, 1.2, -.32], b: [1, 0, .05],
        fL: leg(s, 1), fR: leg(-s, -1)
      });
    },
    cast: { dur: 1900, keys: () => {
      const I = ANIM.ice.idle(0);
      const up = P(N, { y: .97, c: [.05, 0, 0], n: [0, 0, 0], hL: [.22, 1.48, .66], hR: [-.3, 1.1, .2], b: [0, 1, .05] });
      const push = P(N, { y: .95, c: [.12, -.15, 0], n: [-.05, .1, 0], hL: [.12, 1.42, .74], hR: [-.12, 1.4, .72], b: [0, .3, 1], fL: [.13, .06, .2], fR: [-.13, .06, -.15] });
      return [[0, I], [.12, mix(I, up, .33), 'lin'], [.2, mix(I, up, .66), 'lin'], [.28, up, 'lin'], [.4, push, 'lin'], [.88, push, 'lin'], [1, I]];
    }, freeze: [.4, .86] },
    chan: t => {
      const j = Math.sin(t * 45) * .5 + Math.sin(t * 31) * .5;
      return P(N, { y: .96, c: [.12, 0, .01 * j], n: [-.08, 0, .015 * j], hL: [.27, 1.24 + .01 * j, .62], hR: [-.25, 1.3, .55], b: [0, 1, .08], fL: [.15, .06, .1], fR: [-.15, .06, -.1] });
    }
  },

  // ── Arkan: schwebt, Yoga, ganz bei sich
  arcane: {
    idle: t => {
      const br = Math.sin(t * 1.05);
      return P(N, {
        y: .52 + .015 * br, h: [0, 0, 0], c: [-.02 - .04 * br, 0, 0], n: [.08 + .03 * br, 0, .06 * Math.sin(t * .4)],
        hL: [.36, .66, .26], hR: [-.36, .66, .26], fL: [-.17, .34, .2], fR: [.17, .32, .22], kp: 1, toe: .4,
        sf: 1, sp: [-.75, .95 + .06 * Math.sin(t * 1.3), .05], b: [.08 * Math.sin(t * .7), 1, 0]
      });
    },
    run: t => P(N, {
      y: .98, c: [.12, 0, 0], n: [-.1, 0, 0], hL: [.04, 1.32, .28], hR: [-.04, 1.32, .28],
      fL: [.06, -.06, -.14], fR: [-.06, -.1, -.18], toe: .9, sf: 1, sp: [-.65, .95 + .05 * Math.sin(t * 2), -.45], b: [0, .9, -.4]
    }),
    cast: { dur: 2200, keys: () => {
      const I = ANIM.arcane.idle(0);
      const pray = P(I, { hL: [.04, 1.15, .3], hR: [-.04, 1.15, .3] });
      const up = P(I, { y: .56, c: [-.18, 0, 0], n: [-.35, 0, 0], hL: [.12, 2.02, .08], hR: [-.12, 2.02, .08] });
      const open = P(I, { y: .54, c: [.06, 0, 0], n: [-.05, 0, 0], hL: [.48, 1.38, .5], hR: [-.48, 1.38, .5], b: [0, .55, .8] });
      return [[0, I], [.2, pray, 'sine'], [.45, up, 'sine'], [.7, open, 'sine'], [.85, open], [1, I, 'sine']];
    } },
    chan: t => {
      const br = Math.sin(t * 1.2);
      return P(N, {
        y: .8 + .01 * br, h: [0, 0, 0], c: [-.04 * br, 0, 0], n: [0, .7, 0],
        hL: [.86, 1.52, .02], hR: [-.86, 1.52, .02], fL: [.62, .02, .05], fR: [-.58, .06, -.02], kp: .3,
        sf: 1, sp: [-.5, 1.1, -.45], b: [0, 1, 0]
      });
    }
  }
};
const FLOAT = { arcane: .42 };
// Sitzen (Trinken) und Tod gibt es im Viewer nicht
const SIT = P(N, { y: .3, c: [.1, 0, 0], n: [.1, 0, 0], hL: [.26, .55, .3], hR: [-.3, .62, .32], b: [0, 1, .08], fL: [-.2, .06, .24], fR: [.2, .06, .3], kp: 1 });
const DEAD = P(N, { y: .2, h: [-1.45, 0, 0], c: [-.05, .1, 0], n: [-.1, .3, 0], hL: [.62, .12, -.55], hR: [-.6, .12, -.3], b: [-.2, .05, 1], fL: [.3, .06, .9], fR: [-.28, .06, .96], sf: 0 });
const airOf = (A, t) => P(A.run(0.3), { fL: [.16, .36, .18], fR: [-.16, .26, -.2] });

export function buildStrichMagier(gameSkin = 'alle', { bloom = false } = {}) {
  const skin = SKIN_OF[gameSkin] ?? 'base', A = ANIM[skin], glowU = { uTime: { value: 0 } };
  const S = SKINS[skin];
  const F: any = { skin, S, bones: [], parts: [], glow: [], t: 0, last: null, blendFrom: null, blendT: 0, freeze: 0 };
  F.root = new THREE.Group();
  const B = (p, x = 0, y = 0, z = 0) => { const b = new THREE.Bone(); b.position.set(x, y, z); p.add(b); F.bones.push(b); return b; };
  const M = (pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl));
  const part = (bone, geo, color, pos?, rot?, scl?) => F.parts.push({ bone, geo, color, m: M(pos, rot, scl) });
  const glow = (bone, geo, color, pos?, rot?, scl?, flick = false) => F.glow.push({ bone, geo, color, m: M(pos, rot, scl), flick });
  const flame = (bone, pos, h, r, rot = [0, 0, 0]) => glow(bone, new THREE.ConeGeometry(r, h, 5, 2), FLAME, [pos[0], pos[1] + h / 2, pos[2]], rot, [1, 1, 1], true);
  const icicle = (bone, pos, h, r, rot) => part(bone, new THREE.ConeGeometry(r, h, 4), S.ice, pos, rot);

  const hips = F.hips = B(F.root, 0, 1, 0);
  part(hips, new THREE.SphereGeometry(.14, 7, 4), S.ink, [0, 0, 0], [0, 0, 0], [1.25, .8, .9]);
  const chest = F.chest = B(hips, 0, .05, 0);
  part(chest, new THREE.LatheGeometry([[0, -.04], [.1, -.02], [.11, .1], [.15, .33], [.18, .47], [.15, .56], [.08, .61], [0, .62]]
    .map(([a, b]) => new THREE.Vector2(a, b)), 8), S.ink, [0, 0, 0], [0, Math.PI / 8, 0], [1.1, 1, .64]);
  // Kragen-Schal in Akzentfarbe: kleines Merkmal, liest sich auch klein
  part(chest, new THREE.TorusGeometry(.13, .04, 3, 10), S.accent, [0, .56, 0], [Math.PI / 2, 0, 0], [1, 1, .8]);
  const neck = F.neck = B(chest, 0, .6, 0);
  part(neck, new THREE.CylinderGeometry(.04, .05, .12, 5), S.ink, [0, .05, 0]);
  const head = F.head = B(neck, 0, .1, 0);
  part(head, new THREE.IcosahedronGeometry(.18, 1), S.ink, [0, .16, 0], [0, 0, 0], [.95, 1.05, 1]);
  const arm = side => {
    const ua = B(chest, side * .23, .49, 0); part(ua, capDown(.058, A1), S.ink);
    const fa = B(ua, 0, -A1, 0); part(fa, capDown(.052, A2), S.ink);
    const hand = B(fa, 0, -A2, 0); part(hand, new THREE.IcosahedronGeometry(.07, 0), S.ink);
    return { ua, fa, hand, side };
  };
  const leg = side => {
    const th = B(hips, side * .11, -.05, 0); part(th, capDown(.08, L1), S.ink);
    const sh = B(th, 0, -L1, 0); part(sh, capDown(.064, L2), S.ink);
    const ft = B(sh, 0, -L2, 0); part(ft, new THREE.ConeGeometry(.065, .26, 5), S.ink, [0, -.02, .08], [Math.PI / 2, 0, 0], [1, 1, .7]);
    return { th, sh, ft, side };
  };
  F.armL = arm(1); F.armR = arm(-1); F.legL = leg(1); F.legR = leg(-1);
  const staff = F.staff = B(F.root);
  // Der eingebaute Stab des Viewers weicht den 15 Waffen: nur das Gelenk bleibt, models/mage.ts hängt die Waffe daran
  F.crystal = new THREE.Object3D(); F.crystal.position.set(0, .79, 0); staff.add(F.crystal);

  if (skin === 'base') {
    // 90er-Zuhälter-Look: pinker Pelzmantel, weißer Fedora, dicke Goldkette, den Stab ersetzt die gewählte Waffe
    const PINK = col(0xff5fb0), FUR = col(0xffa8d4), GOLD = col(0xe2b13c), HAT = col(0xf2ede4), BAND = col(0x1d1b18);
    part(chest, new THREE.LatheGeometry([[0, -.06], [.12, -.04], [.13, .1], [.17, .33], [.2, .47], [.17, .57], [0, .6]]
      .map(([a, b]) => new THREE.Vector2(a, b)), 8), PINK, [0, 0, 0], [0, Math.PI / 8, 0], [1.12, 1, .7]);
    part(hips, new THREE.LatheGeometry([[.28, -.58], [.24, -.35], [.19, -.1], [.15, .08]].map(([a, b]) => new THREE.Vector2(a, b)), 8), PINK, [0, 0, 0], [0, Math.PI / 8, 0], [1.05, 1, .8]);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; part(chest, new THREE.IcosahedronGeometry(.075, 0), FUR, [Math.sin(a) * .15, .55 + .03 * Math.cos(a * 2), Math.cos(a) * .11]); }
    for (let i = 0; i < 6; i++) part(hips, new THREE.IcosahedronGeometry(.06, 0), FUR, [Math.sin(i / 6 * TAU) * .27, -.56, Math.cos(i / 6 * TAU) * .22]);
    for (const a of [F.armL, F.armR]) {
      part(a.ua, capDown(.074, A1), PINK);
      part(a.fa, capDown(.068, A2 * .8), PINK);
      for (let i = 0; i < 5; i++) { const q = i / 5 * TAU; part(a.fa, new THREE.IcosahedronGeometry(.045, 0), FUR, [Math.sin(q) * .07, -A2 * .8, Math.cos(q) * .07]); }
    }
    for (let i = 0; i <= 12; i++) {
      const t = i / 12 * 2 - 1;
      part(chest, new THREE.TorusGeometry(.028, .011, 3, 6), GOLD, [.13 * t, .3 + .26 * t * t, .13 - .02 * t * t], [i % 2 ? Math.PI / 2 : 0, 0, .3 * t]);
    }
    part(chest, new THREE.CylinderGeometry(.06, .06, .018, 8), GOLD, [0, .25, .135], [Math.PI / 2, 0, 0]);
    part(head, new THREE.CylinderGeometry(.29, .29, .022, 10), HAT, [0, .3, 0], [-.08, 0, .1], [1, 1, .9]);
    part(head, new THREE.CylinderGeometry(.14, .17, .17, 8), HAT, [.008, .39, 0], [-.08, 0, .1], [1, 1, .85]);
    part(head, new THREE.CylinderGeometry(.172, .172, .04, 8), BAND, [.004, .33, 0], [-.08, 0, .1], [1, 1, .85]);
    glow(chest, new THREE.OctahedronGeometry(.03, 0), col(0xfff3b0), [0, .25, .15]);
  }
  if (skin === 'fire') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; flame(head, [Math.sin(a) * .1, .22, Math.cos(a) * .1], .3 + (i % 2) * .12, .07, [Math.cos(a) * .25, 0, -Math.sin(a) * .25]); }
    flame(head, [0, .28, 0], .45, .09);
    for (const a of [F.armL, F.armR]) { flame(a.hand, [0, 0, 0], .22, .06); flame(a.hand, [.04, 0, .03], .16, .045); flame(a.ua, [0, .02, 0], .2, .06); }
    part(head, new THREE.IcosahedronGeometry(.185, 1), S.ink, [0, .14, 0], [0, 0, 0], [.9, .7, .95]); // verkohlter Kiefer
  }
  if (skin === 'ice') {
    for (const [a, s] of [[F.armL, 1], [F.armR, -1]]) {
      icicle(a.ua, [s * .03, .06, 0], .22, .045, [0, 0, -s * .5]); icicle(a.ua, [s * .06, .03, -.04], .16, .035, [-.4, 0, -s * 1.0]);
      icicle(a.fa, [0, .0, -.05], .18, .035, [-1.9, 0, 0]);
    }
    for (let i = 0; i < 5; i++) { const a = (i - 2) * .45; icicle(head, [Math.sin(a) * .1, .3, Math.cos(a) * .05 - .02], .18 + (i === 2 ? .1 : 0), .035, [-.15, 0, -a * .5]); }
    icicle(head, [0, .03, .12], .1, .03, [Math.PI, 0, 0]); icicle(head, [.05, .04, .11], .07, .022, [Math.PI, 0, 0]); icicle(head, [-.05, .04, .11], .07, .022, [Math.PI, 0, 0]);
    glow(chest, new THREE.OctahedronGeometry(.05, 0), S.orb, [0, .35, .1], [0, 0, 0], [.7, 1.4, .7]);
  }
  if (skin === 'arcane') {
    glow(head, new THREE.OctahedronGeometry(.035, 0), S.orb, [0, .2, .17], [0, 0, 0], [1, 1.5, .5]);
    for (const a of [F.armL, F.armR]) glow(a.hand, new THREE.IcosahedronGeometry(.05, 0), S.orb, [0, -.02, 0]);
  }
  F.root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(F.bones);
  const build = (list, mat) => {
    const geo = mergeGeometries(list.map(p => {
      const g = prep(p.geo, p.color, p.bone.matrixWorld.clone().multiply(p.m), p.flick);
      const n = g.attributes.position.count, bi = F.bones.indexOf(p.bone);
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      return g;
    }));
    const m = new THREE.SkinnedMesh(geo, mat); m.frustumCulled = false; F.root.add(m); m.bind(skel); return m;
  };
  F.mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, emissive: 0x000000 });
  F.mat.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
      `outgoingLight += vec3(${RIM.color.join(',')}) * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), ${RIM.power.toFixed(1)});\n#include <opaque_fragment>`);
  };
  F.body = build(F.parts, F.mat);
  F.glowMesh = F.glow.length ? build(F.glow, glowMat(glowU)) : null;
  if (skin === 'arcane') { F.runes = makeRunes(); F.root.add(F.runes); }

  // Partikel in Weltkoordinaten
const PN = 500, pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3).fill(-1000), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pG = new Float32Array(PN);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .06, vertexColors: true })); pts.frustumCulled = false;
  let pNext = 0, pLive = 0;
  function emit(p, n, v, color, g = 0, life = 1, spread = .3) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const j = pNext++ % PN;
      if (pLife[j] <= 0) pLive++;
      pPos.set([p.x + (Math.random() - .5) * spread, p.y + (Math.random() - .5) * spread, p.z + (Math.random() - .5) * spread], j * 3); pCol.set([c.r, c.g, c.b], j * 3);
      pVel.set([v.x + (Math.random() - .5) * .6, v.y + (Math.random() - .5) * .4, v.z + (Math.random() - .5) * .6], j * 3);
      pLife[j] = life * (.6 + Math.random() * .6); pG[j] = g;
    }
  }
  function updateParts(dt) {
    pts.visible = pLive > 0;
    if (!pLive) return;
    for (let j = 0; j < PN; j++) {
      if (pLife[j] <= 0) continue;
      pLife[j] -= dt; if (pLife[j] <= 0) { pPos[j * 3 + 1] = -1000; pLive--; continue; }
      pVel[j * 3 + 1] -= pG[j] * dt;
      for (let k = 0; k < 3; k++) pPos[j * 3 + k] += pVel[j * 3 + k] * dt;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  }

  const trail = SKIN_FX[gameSkin]?.trail ? makeTrail(SKIN_FX[gameSkin].trail) : null;
  const watch = stepWatcher({ root: F.root, legL: { ankle: F.legL.ft }, legR: { ankle: F.legR.ft } });
  const fl = FLOAT[skin] || 0;
  let loco = 'idle', mode = 'idle', castT = -1, castKeys = null, runT = 0, wasCast = false;
  return {
    root: F.root,
    anchors: { crystal: F.crystal, handL: F.armL.hand, handR: F.armR.hand },
    trail,
    scarf: pts,                                   // liegt in Weltkoordinaten, models/mage.ts legt es in die Szene
    fx: SKIN_FX[gameSkin] || SKIN_FX.alle,
    get tris() { return Math.round((F.body.geometry.attributes.position.count + (F.glowMesh ? F.glowMesh.geometry.attributes.position.count : 0)) / 3) + (F.runes ? 16 : 0); },
    update(dt, anim: any = {}) {
      const s = Math.min(.1, dt > 1 ? dt / 1000 : dt);
      if (trail) trail.update(s);
      if (anim.frozen) return;
      glowU.uTime.value += s;
      F.t += s;
      loco = anim.state || 'idle';
      const moving = loco === 'run' || loco === 'back';
      // Zaubern: startet, sobald anim.cast steigt. Im Laufen läuft die Laufpose weiter, die Bewegung wird nie gesperrt.
      const casting = (anim.cast || 0) > 0;
      if (casting && !wasCast && !moving) { castT = 0; castKeys = A.cast.keys(); }
      wasCast = casting;
      if (moving || loco === 'sit' || loco === 'dead' || loco === 'air') castT = -1;
      let castU = -1;
      const dur = A.cast.dur;
      if (castT >= 0) {
        castU = castT / Math.min(dur, CAST_MS);
        if (!(castU >= CAST_HOLD && casting)) castT += s * 1000;
        if (castU >= 1) { castT = -1; castU = -1; F.blendFrom = F.last; F.blendT = .2; }
      }
      const next = loco === 'sit' ? 'sit' : loco === 'dead' ? 'dead' : loco === 'air' ? 'air' : moving ? 'run' : anim.channel ? 'chan' : castU >= 0 ? 'cast' : 'idle';
      if (next !== mode) { F.blendFrom = F.last; F.blendT = .25; mode = next; }
      if (moving) runT += s * (anim.speed || 7) / 7 * (loco === 'back' ? -1 : 1);
      let p;
      if (mode === 'cast') p = kf(castKeys, castU);
      else if (mode === 'run') p = A.run(runT);
      else if (mode === 'chan') p = A.chan(F.t);
      else if (mode === 'sit') p = skin === 'arcane' ? A.idle(F.t) : cp(SIT);
      else if (mode === 'dead') p = cp(DEAD);
      else if (mode === 'air') p = airOf(A, F.t);
      else p = A.idle(F.t);
      if (anim.squat) p.y -= anim.squat * .15;
      if (F.blendT > 0 && F.blendFrom) { F.blendT -= s; p = mix(F.blendFrom, p, 1 - clamp(F.blendT / .25, 0, 1)); }
      F.last = p;

      // Schweben: die Füße bleiben im Pose-Raum, die ganze Figur hebt sich (im Tod nicht)
      if (fl && mode !== 'dead') F.root.position.y += fl + .07 * Math.sin(F.t * 1.3);
      applyPose(F, p);

      // Skin-Effekte
      if (skin === 'ice') {
        const fr = A.cast.freeze;
        let target = mode === 'chan' ? .35 : 0;
        if (castU > fr[0] && castU < fr[1]) target = 1;
        F.freeze = lerp(F.freeze, target, Math.min(1, s * (target > F.freeze ? 10 : 4)));
        F.mat.emissive.setRGB(.35 * F.freeze, .55 * F.freeze, .7 * F.freeze);
        if (castU > fr[1] && castU < fr[1] + .05) emit(F.chest.getWorldPosition(V()).add(V(0, .3, 0)), 25, V(0, 1, 0), 0xdff6ff, 4, .6, .6);
        if (F.freeze > .5 && Math.random() < s * 30) emit(F.chest.getWorldPosition(V()).add(V(0, .2, .1)), 1, V(0, .3, 0), 0xe8f8ff, -.2, .9, .8);
        if (mode === 'idle' && (F.t % 2.6) < s) emit(F.head.getWorldPosition(V()).add(V(0, .12, .2)), 10, V(0, .15, .5), 0xffffff, -.1, 1, .08);
      }
      if (skin === 'fire' && Math.random() < s * 14) emit(F.head.getWorldPosition(V()).add(V(0, .4, 0)), 1, V(0, 1.4, 0), Math.random() < .5 ? 0xff7a1a : 0xffd04a, -.5, .7, .2);
      if (F.runes) {
        const sp = mode === 'chan' ? 1.6 : mode === 'run' ? .9 : .45;
        F.runes.rotation.y += s * sp;
        const pulse = castU > .65 && castU < .9 ? Math.sin((castU - .65) / .25 * Math.PI) : 0;
        F.runes.scale.setScalar(1 + .35 * pulse + (mode === 'chan' ? .25 : 0));
        F.runes.position.y = (mode === 'idle' || mode === 'sit' ? .75 : 1.15) + .05 * Math.sin(F.t * 1.7);
        F.runes.material.opacity = .75 + .25 * Math.sin(F.t * 3);
        F.runes.visible = mode !== 'dead';
        if (Math.random() < s * 4) emit(F.root.position.clone().add(V((Math.random() - .5) * 1.4, .2, (Math.random() - .5) * 1.4)), 1, V(0, .5, 0), 0xc58bff, -.1, 1.4, .1);
      }
      updateParts(s);
      if (trail && moving) { F.root.updateMatrixWorld(true); watch((x, y, z, a, side) => trail.add(x, y, z, a, side)); }
    },
  };
}
