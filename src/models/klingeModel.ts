// Klingenstrich: Figur, IK, Posen, Aktionen und Effekte aus dem Viewer klingenstrich-viewer.html, dazu Kreisschnitt, Sitzen, Rückwärts, Sprung, Tod und Klone.
// Vanilla-Technik: ein SkinnedMesh, Gewicht 1, Vertex-Farben, 3-Stufen-Toon. Das Modell bewegt den Spieler nicht: Sprint und Treffer macht klinge.ts über onHit.
// Schnittstelle wie die anderen Figuren: update(dt, anim), Aktion startet bei Phase 0, sobald sie wechselt; dt > 1 gilt als ms.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Dauern in ms bei Tempo 1. Die Spielregeln (Tempo, Reichweite) stehen in KLINGE (klinge.ts)
export const KLINGE_TIMING = {
  e: 500, swap: 450, wirbel: 3400, ader: 1000,          // PH
  // Q-Kette pro Haltung, ein Schlag pro Druck. Einhand: Ziehschnitt, Rückhand, Stoß mit Wegstecken. Zweihand: rechts, links, X-Schnitt, Wirbelsprung. PH aus dem Viewer
  qChain: { 1: [420, 380, 1050], 2: [380, 380, 520, 900] },
  sheathe: 420,                                          // Zeitfenster abgelaufen, Klinge draußen: kurz wegstecken, PH
  dash: { ms: 1000, move: { from: 0.2, to: 0.34 } },                     // Spiel bewegt den Spieler in diesem Fenster, PH
  wirbelFrom: 0.08, wirbelTo: 0.9,                                       // Drehung und Griff der Mobs, PH
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const inOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const outC = t => 1 - Math.pow(1 - t, 3);
const EASE = { io: inOut, out: outC, lin: t => t };
const TAU = Math.PI * 2;
// Drehwinkel des Blutwirbels bei Fortschritt s (0–1). Das Spiel kreist die Mobs damit um die Figur.
export const wirbelSpin = s => TAU * 9 * (s - Math.sin(TAU * s) / TAU);

// Die Figur ist für hellen Grund gebaut. Rim statt Kontur: kostet keinen Draw Call und bleibt im Dunkeln sichtbar. // PH
const RIM = { color: [0.62, 0.68, 0.78], power: 2.6 };
const FX_LIGHT = 0xf2efe6;       // im Viewer Tusche; auf dunklem Boden wäre das unsichtbar
const FX_RED = 0xd8121c;

const grad = new THREE.DataTexture(new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;

const L1 = .46, L2 = .46, A1 = .31, A2 = .29;
const C = { ink: new THREE.Color(0x2b2b33), red: new THREE.Color(0xc0161e), saya: new THREE.Color(0x5c0f14),
  guard: new THREE.Color(0x3b3020), steel: new THREE.Color(0xe9eef0), wrap: new THREE.Color(0x8f1218) };

function prep(geo, color, m?) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv'); if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const capDown = (r, len, rs = 6) => { const g = new THREE.CapsuleGeometry(r, len, 2, rs); g.translate(0, -len / 2, 0); return g; };

// Katana low-poly: Klinge 6 Segmente, Krümmung und Spitze bleiben (Silhouette)
function bladeGeo() {
  const g = new THREE.BoxGeometry(.012, .95, .045, 1, 6, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + .475; let z = p.getZ(i); const t = y / .95;
    if (t > .99 && z > 0) z = -.015;
    z -= .08 * t * t;
    p.setXYZ(i, p.getX(i), y + .19, z);
  }
  return g;
}

// y Hüfthöhe · h/c/n Euler Hüfte/Brust/Kopf · hL/hR Handziel (Wurzel-Raum) oder 'H1'/'H2' (Griff) / 'S1' (Scheide)
// bL/bR Klingenrichtung · fL/fR Fußziel (y .06 = Boden)
const KEYS = ['y', 'h', 'c', 'n', 'hL', 'hR', 'bL', 'bR', 'fL', 'fR'];
const P = (base, o = {}) => Object.assign({}, base, o);
function mix(a, b, u) {
  const o: any = {};
  for (const k of KEYS) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u);
  return o;
}
const SAYA_DIR = [.35, -.25, .9];
const IDLE1 = { y: .9, h: [0, .35, 0], c: [.22, -.3, 0], n: [-.15, -.05, 0], hL: 'S1', hR: 'H1', bL: SAYA_DIR, bR: SAYA_DIR,
  fL: [.22, .06, -.22], fR: [-.14, .06, .32] };
const IDLE2 = { y: .84, h: [0, -.25, 0], c: [.35, .2, 0], n: [-.35, .05, 0], hL: [.38, 1.02, .42], hR: [-.42, 1.32, .48],
  bL: [.45, -.25, .85], bR: [-.25, .62, .75], fL: [.3, .06, .3], fR: [-.28, .06, -.28] };
const DEAD = { y: .2, h: [-1.45, 0, 0], c: [-.05, .1, 0], n: [-.1, .3, 0], hL: [.62, .12, -.55], hR: [-.6, .12, -.3], bL: [.8, -.02, -.5], bR: [-.7, -.02, .6],
  fL: [.3, .06, .9], fR: [-.28, .06, .96] };

export function buildKlinge({ bloom = false } = {}) {
  const VMAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  VMAT.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
      `outgoingLight += vec3(${RIM.color.join(',')}) * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), ${RIM.power.toFixed(1)});\n#include <opaque_fragment>`);
  };
  const bones = [], parts = [];
  const B = (p, x = 0, y = 0, z = 0) => { const b = new THREE.Bone(); b.position.set(x, y, z); p.add(b); bones.push(b); return b; };
  const part = (bone, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => {
    parts.push({ bone, geo, color, m: new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl)) });
  };

  const root = new THREE.Group();
  const hips = B(root, 0, 1, 0);
  part(hips, new THREE.SphereGeometry(.15, 7, 4), C.ink, [0, 0, 0], [0, 0, 0], [1.25, .8, .9]);
  const chest = B(hips, 0, .05, 0);
  // Keil: breite Schultern, schmale Taille – das trägt die Silhouette
  part(chest, new THREE.LatheGeometry([[0, -.04], [.1, -.02], [.11, .1], [.17, .33], [.21, .47], [.17, .57], [.08, .62], [0, .63]]
    .map(([x, y]) => new THREE.Vector2(x, y)), 8), C.ink, [0, 0, 0], [0, Math.PI / 8, 0], [1.12, 1, .62]);
  const neck = B(chest, 0, .6, 0);
  part(neck, new THREE.CylinderGeometry(.04, .05, .12, 5), C.ink, [0, .05, 0]);
  const head = B(neck, 0, .1, 0);
  part(head, new THREE.IcosahedronGeometry(.18, 1), C.ink, [0, .16, 0], [0, 0, 0], [.95, 1.05, 1]);
  part(head, new THREE.TorusGeometry(.178, .03, 3, 10), C.red, [0, .2, 0], [Math.PI / 2 - .12, 0, 0]);
  part(head, new THREE.IcosahedronGeometry(.045, 0), C.red, [0, .21, -.18]);
  const scarfAnchor = new THREE.Object3D(); scarfAnchor.position.set(0, .21, -.2); head.add(scarfAnchor);

  const arm = side => {
    const ua = B(chest, side * .24, .49, 0);
    part(ua, capDown(.066, A1), C.ink);
    const fa = B(ua, 0, -A1, 0);
    part(fa, capDown(.058, A2), C.ink);
    const hand = B(fa, 0, -A2, 0);
    part(hand, new THREE.IcosahedronGeometry(.082, 0), C.ink);
    return { ua, fa, hand, side };
  };
  const leg = side => {
    const th = B(hips, side * .11, -.05, 0);
    part(th, capDown(.088, L1), C.ink);
    const sh = B(th, 0, -L1, 0);
    part(sh, capDown(.07, L2), C.ink);
    const ft = B(sh, 0, -L2, 0);
    // spitzer Fuß: Kegel nach vorn, liest sich klarer als eine Kapsel
    part(ft, new THREE.ConeGeometry(.07, .26, 5), C.ink, [0, -.02, .08], [Math.PI / 2, 0, 0], [1, 1, .7]);
    return { th, sh, ft, side };
  };
  const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);

  const GRIP = new THREE.CylinderGeometry(.022, .024, .27, 5).translate(0, .045, 0);
  const GUARD = new THREE.CylinderGeometry(.06, .06, .016, 8).translate(0, .186, 0);
  const KATANA_GEO = mergeGeometries([prep(bladeGeo(), C.steel), prep(GRIP, C.wrap), prep(GUARD, C.guard)]);
  const katana = p => { const m = new THREE.Mesh(KATANA_GEO, VMAT); p.add(m); return m; };

  // zwei Scheiden an der linken Hüfte; die Griffe darin hängen an eigenen Bones und werden beim Ziehen auf 0 skaliert
  const saya = (pos, dir) => {
    const s = B(hips, ...pos);
    s.quaternion.setFromUnitVectors(V(0, 1, 0), V(...dir).normalize());
    part(s, new THREE.BoxGeometry(.03, .98, .05), C.saya, [0, .68, 0]);
    const hilt = B(s);
    part(hilt, GRIP, C.wrap); part(hilt, GUARD, C.guard);
    return { s, hilt };
  };
  const saya1 = saya([.19, -.02, .07], [.08, -.42, -.9]);
  const saya2 = saya([.215, .03, .02], [.12, -.3, -.95]);

  root.updateMatrixWorld(true);
  const body = new THREE.SkinnedMesh(mergeGeometries(parts.map(p => {
    const g = prep(p.geo, p.color, p.bone.matrixWorld.clone().multiply(p.m));
    const n = g.attributes.position.count, bi = bones.indexOf(p.bone);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return g;
  })), VMAT);
  body.frustumCulled = false; root.add(body); body.bind(new THREE.Skeleton(bones));
  const swordR = katana(root), swordL = katana(root);
  // Yakitori-Spieß zum Essen: Griff unten im Ursprung, Spitze nach +y
  const skewer = new THREE.Mesh(mergeGeometries([
    prep(new THREE.CylinderGeometry(.007, .007, .36, 4).translate(0, .14, 0), new THREE.Color(0xd9c39a)),
    ...[0, 1, 2, 3].map(i => prep(new THREE.BoxGeometry(.05, .045, .05).rotateY(i * .6).translate(0, .14 + i * .055, 0), new THREE.Color(i % 2 ? 0x8a4a22 : 0x6b3416)))
  ]), VMAT); skewer.visible = false; root.add(skewer);

  // Stirnband-Enden (Verlet-Kette, eigenes Band-Mesh in Weltkoordinaten)
  const SN = 11, SEG = .12;
  const sP = [], sO = [];
  const scarfGeo = new THREE.BufferGeometry();
  scarfGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 2 * 3), 3));
  { const idx = []; for (let i = 0; i < SN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } scarfGeo.setIndex(idx); }
  const scarf = new THREE.Mesh(scarfGeo, new THREE.MeshBasicMaterial({ color: 0xc0161e, side: THREE.DoubleSide }));
  scarf.frustumCulled = false;
  const scarfReset = () => { const p = scarfAnchor.getWorldPosition(V()); for (let i = 0; i < SN; i++) { sP[i] = p.clone().add(V(0, -i * SEG, 0)); sO[i] = sP[i].clone(); } };

  // ───────────────────────── IK
  const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const DOWN = V(0, -1, 0);
  function ik(upper, lower, l1, l2, targetW, poleW) {
    const par = upper.parent;
    const T = par.worldToLocal(_a.copy(targetW));
    const pole = par.worldToLocal(_b.copy(poleW));
    const Pp = upper.position;
    const d = _c.subVectors(T, Pp); const L = clamp(d.length(), 1e-3, l1 + l2 - 1e-3); d.normalize();
    const al = Math.acos(clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1));
    const pp = _d.subVectors(pole, Pp); pp.addScaledVector(d, -pp.dot(d));
    if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1); pp.normalize();
    const eDir = _e.copy(d).multiplyScalar(Math.cos(al)).addScaledVector(pp, Math.sin(al));
    upper.quaternion.setFromUnitVectors(DOWN, eDir);
    const E = _b.copy(Pp).addScaledVector(eDir, l1);
    const lDir = _a.copy(Pp).addScaledVector(d, L).sub(E).normalize();
    _q.setFromUnitVectors(DOWN, lDir);
    lower.quaternion.copy(_q2.copy(upper.quaternion).invert().multiply(_q));
  }
  const _w = V(), _pw = V(), _rq = new THREE.Quaternion(), _sq = new THREE.Quaternion();
  function legIK(l, f) {
    root.localToWorld(_w.set(f[0], f[1], f[2]));
    root.localToWorld(_pw.set(f[0] + l.side * .15, .7, f[2] + 2));
    ik(l.th, l.sh, L1, L2, _w, _pw);
    l.sh.updateWorldMatrix(true, false);
    l.sh.getWorldQuaternion(_sq); root.getWorldQuaternion(_rq);
    l.ft.quaternion.copy(_sq.invert().multiply(_rq));
  }
  function armIK(a, h) {
    root.localToWorld(_w.set(h[0], h[1], h[2]));
    root.localToWorld(_pw.set(a.side * 1.3, .8, -.7));
    ik(a.ua, a.fa, A1, A2, _w, _pw);
  }
  const _m = new THREE.Matrix4(), _x = V(), _y = V(), _z = V(), _hp = V();
  function placeSword(sw, hand, dir) {
    _y.set(dir[0], dir[1], dir[2]).normalize();
    _z.set(0, 1, 0); if (Math.abs(_y.y) > .8) _z.set(0, 0, 1);
    _z.addScaledVector(_y, -_z.dot(_y)).normalize();
    _x.crossVectors(_y, _z);
    _m.makeBasis(_x, _y, _z); sw.quaternion.setFromRotationMatrix(_m);
    root.worldToLocal(hand.getWorldPosition(_hp));
    sw.position.copy(_hp).addScaledVector(_y, -.04);
  }

  // ───────────────────────── Posen
  let stance = 1, wanted = 1, drawnR = false, drawnL = false, spinAng = 0;
  function anchor(s) {
    const sa = s === 'H2' ? saya2 : saya1;
    const local = s[0] === 'S' ? V(0, .32, 0) : V(0, .07, 0);
    return root.worldToLocal(sa.s.localToWorld(local)).toArray();
  }
  function resolve(p) { const o: any = {}; for (const k of KEYS) { const v = p[k]; o[k] = typeof v === 'string' ? anchor(v) : Array.isArray(v) ? v.slice() : v; } return o; }
  const IDLE = () => stance === 1 ? IDLE1 : IDLE2;
  function runPose(ph, lean = .62) {
    const s = Math.sin(ph), c = Math.cos(ph);
    const base = {
      y: .9 - .05 * Math.abs(c), h: [.1, .18 * s, 0], c: [lean, -.12 * s, 0], n: [-lean + .07, .1 * s, 0],
      fL: [.12, .06 + .3 * Math.max(0, c), .55 * s], fR: [-.12, .06 + .3 * Math.max(0, -c), -.55 * s],
    };
    if (stance === 1) return Object.assign(base, { hL: 'S1', hR: 'H1', bL: SAYA_DIR, bR: SAYA_DIR });
    return Object.assign(base, { hL: [.32, 1.2, -.52], hR: [-.32, 1.2, -.52], bL: [.25, .35, -1], bR: [-.25, .35, -1] });
  }
  const airPose = () => P(stance === 1 ? IDLE1 : IDLE2, { y: .92, fL: [.18, .34, .2], fR: [-.18, .24, -.22] });

  // ───────────────────────── Effekte (Weltkoordinaten, fx.group liegt in der Szene)
  const fxGroup = new THREE.Group();
  const fxList = [];
  const fxMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });
  // Sichel im Wurzel-Raum: Mitte, Euler der Ebene (XY-Ebene, offen Richtung +y), Radius, Bogen
  function arc(center, euler, r, th, color = FX_LIGHT, life = .32) {
    const holder = new THREE.Object3D(); holder.position.copy(root.position); holder.rotation.y = root.rotation.y; fxGroup.add(holder);
    const add = (r0, r1, c, op) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40, 1, Math.PI / 2 - th / 2, th), fxMat(c, op)); m.position.fromArray(center); m.rotation.fromArray(euler); holder.add(m); return m; };
    const outer = add(r * .8, r, color, .9), inner = add(r * .86, r * .96, FX_RED, .9);
    if (bloom) inner.material.color.multiplyScalar(1.8);
    fxList.push({ obj: holder, t: 0, life, upd: k => { holder.scale.setScalar(1 + .25 * k); outer.material.opacity = inner.material.opacity = .9 * (1 - k); } });
  }
  function streak(a, b, color, w, life, y = 1.15) {
    const len = a.distanceTo(b);
    if (len < .01) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, w * .4, len), fxMat(color, .95));
    m.position.copy(a).lerp(b, .5); m.position.y += y; m.lookAt(b.x, m.position.y, b.z); fxGroup.add(m);
    fxList.push({ obj: m, t: 0, life, upd: k => { m.material.opacity = .95 * (1 - k); m.scale.x = m.scale.y = 1 - .6 * k; } });
  }
  function ring(pos, color, r, life) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 48), fxMat(color, .8));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += .05; fxGroup.add(m);
    fxList.push({ obj: m, t: 0, life, upd: k => { m.scale.setScalar(.2 + r * outC(k)); m.material.opacity = .8 * (1 - k); } });
  }
  function ghost() {
    root.updateMatrixWorld(true);
    const g = SkeletonUtils.clone(root) as THREE.Object3D, mat = new THREE.MeshBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: .35, depthWrite: false });
    g.traverse((o: any) => { if (o.isMesh) o.material = mat; });
    fxGroup.add(g);
    fxList.push({ obj: g, t: 0, life: .45, shared: true, upd: k => { mat.opacity = .35 * (1 - k); } });
  }
  function updateFx(s) {
    for (let i = fxList.length - 1; i >= 0; i--) {
      const f = fxList[i]; f.t += s; const k = f.t / f.life;
      if (k >= 1) {
        fxGroup.remove(f.obj);
        f.obj.traverse(o => {
          if (o.isSkinnedMesh) o.skeleton.dispose();   // Nachbild: Geometrie gehört der Figur
          else if (o.isMesh && !f.shared) o.geometry.dispose();
          if (o.isMesh) o.material.dispose();
        });
        fxList.splice(i, 1); continue;
      }
      f.upd(k);
    }
  }
  // Blut als Points, ohne Blut kein Draw Call
  const BN = 500;
  const bGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(BN * 3).fill(-1000), bVel = new Float32Array(BN * 3), bLife = new Float32Array(BN), bFloor = new Float32Array(BN);
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const blood = new THREE.Points(bGeo, new THREE.PointsMaterial({ color: 0xa50c12, size: .11 }));
  blood.frustumCulled = false; blood.visible = false; fxGroup.add(blood);
  let bNext = 0, bLive = 0;
  function bleedFx(p, n, spd = 2.5, floor = p.y - .8) {
    for (let i = 0; i < n; i++) {
      const j = bNext++ % BN;
      if (bLife[j] <= 0) bLive++;
      bPos[j * 3] = p.x; bPos[j * 3 + 1] = p.y; bPos[j * 3 + 2] = p.z; bFloor[j] = floor;
      bVel[j * 3] = (Math.random() - .5) * spd; bVel[j * 3 + 1] = Math.random() * spd * .8; bVel[j * 3 + 2] = (Math.random() - .5) * spd;
      bLife[j] = 1.5 + Math.random();
    }
  }
  function updateBlood(s) {
    blood.visible = bLive > 0;
    if (!bLive) return;
    for (let j = 0; j < BN; j++) {
      if (bLife[j] <= 0) continue;
      bLife[j] -= s;
      if (bLife[j] <= 0) { bPos[j * 3 + 1] = -1000; bLive--; continue; }
      if (bPos[j * 3 + 1] > bFloor[j]) {
        bVel[j * 3 + 1] -= 12 * s;
        bPos[j * 3] += bVel[j * 3] * s; bPos[j * 3 + 1] += bVel[j * 3 + 1] * s; bPos[j * 3 + 2] += bVel[j * 3 + 2] * s;
        if (bPos[j * 3 + 1] < bFloor[j]) bPos[j * 3 + 1] = bFloor[j];
      }
    }
    bGeo.attributes.position.needsUpdate = true;
  }
  // Wirbel-Sicheln
  const windG = new THREE.Group(); fxGroup.add(windG); windG.visible = false;
  const windArcs = [];
  for (let i = 0; i < 4; i++) {
    const r = 1.7 + i * .35;
    const m = new THREE.Mesh(new THREE.RingGeometry(r - .06, r, 48, 1, 0, 1.6), fxMat(i % 2 ? FX_RED : FX_LIGHT, .6));
    m.rotation.x = -Math.PI / 2; m.position.y = .9 + i * .22; m.userData.off = i * 1.7; windG.add(m); windArcs.push(m);
  }

  // ───────────────────────── Aktionen
  // keys: [t, pose, ease] · ev: [t, fn] · tick(u)
  const hit = (kind, i = 0) => () => model.onHit?.(kind, root.position.x, root.position.z, i);

  // ── Q-Kette aus dem Viewer (defQ): ein Schlag pro Druck. Zwischen den Schlägen hält die Figur die Endpose (hold), solange das Spiel anim.hold setzt.
  const E_END = [
    P(IDLE1, { y: .82, h: [0, -.55, 0], c: [.12, .45, 0], n: [-.1, -.25, 0], hR: [-.8, 1.58, .5], bR: [-.6, .62, .5], hL: [.36, 1.0, -.05], fR: [-.2, .06, .72], fL: [.24, .06, -.36] }),
    P(IDLE1, { y: .8, h: [0, .45, 0], c: [.3, -.55, 0], n: [-.15, .35, 0], hR: [.55, 1.25, .55], bR: [.88, .05, .45], hL: [.4, .95, -.2], fR: [-.18, .06, .75], fL: [.3, .06, .05] }),
  ];
  const N_END = [
    P(IDLE2, { y: .78, h: [0, .45, 0], c: [.45, .5, 0], n: [-.3, -.3, 0], hR: [.28, .95, .62], bR: [.6, -.5, .6], fL: [.3, .06, .1], fR: [-.28, .06, .5] }),
    P(IDLE2, { y: .78, h: [0, -.45, 0], c: [.45, -.5, 0], n: [-.3, .3, 0], hL: [-.28, .95, .62], bL: [-.6, -.5, .6], hR: [-.45, 1.15, .25], bR: [-.4, .6, .65], fL: [.28, .06, .5], fR: [-.3, .06, .1] }),
    P(IDLE2, { y: .76, h: [0, 0, 0], c: [.6, 0, 0], n: [-.45, 0, 0], hR: [-.48, .86, .68], bR: [-.62, -.42, .66], hL: [.48, .86, .68], bL: [.62, -.42, .66], fL: [.3, .06, .55], fR: [-.3, .06, -.3] }),
  ];
  const fwdW = () => V(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
  function defQ(step) {
    const D = KLINGE_TIMING.qChain[stance];
    step = clamp(step | 0, 0, D.length - 1);
    const dur = D[step];
    if (stance === 1) {
      if (step === 0) {   // Ziehschnitt: diagonal von unten links nach oben rechts
        const k1 = P(IDLE1, { y: .8, h: [0, .6, 0], c: [.38, -.62, 0], n: [-.25, .25, 0], fR: [-.14, .06, .5], bR: [.45, -.35, .82] });
        return { dur, walk: true, hold: E_END[0], keys: [[0, IDLE1], [.35, k1], [.65, E_END[0], 'out'], [1, E_END[0]]],
          ev: [[.4, () => drawnR = true], [.5, () => arc([-.1, 1.3, .9], [-.3, .25, 2.3], 1.5, 2.6)], [.6, hit('q', 0)]] };
      }
      if (step === 1) {   // Rückhand waagrecht nach links
        const w = P(E_END[0], { hR: [-.75, 1.3, .3], bR: [-.9, .1, .2], c: [.2, .55, 0] });
        return { dur, walk: true, hold: E_END[1], keys: [[0, E_END[0]], [.3, w], [.62, E_END[1], 'out'], [1, E_END[1]]],
          ev: [[.4, () => drawnR = true], [.42, () => arc([0, 1.25, .5], [-Math.PI / 2, 0, 0], 2.2, 2.6)], [.55, hit('q', 0)]] };
      }
      // Stoß, dann Nōtō: der Treffer fällt beim Klick des Wegsteckens
      const pull = P(E_END[1], { y: .82, h: [0, -.2, 0], c: [.15, .25, 0], hR: [-.28, 1.28, -.2], bR: [0, .08, 1], hL: [.35, 1.05, .35], fR: [-.18, .06, .3], fL: [.22, .06, -.25] });
      const thrust = P(IDLE1, { y: .68, h: [0, -.15, 0], c: [.55, 0, 0], n: [-.45, 0, 0], hR: [-.06, 1.3, 1.05], bR: [0, .03, 1], hL: [.45, 1.15, -.35], fR: [-.15, .06, 1.0], fL: [.22, .06, -.55] });
      const noto = P(IDLE1, { y: .74, c: [.4, -.3, 0], n: [.25, 0, 0], hR: 'H1', bR: SAYA_DIR, fR: [-.15, .06, .7], fL: [.22, .06, -.45] });
      const a: any = {};
      return { dur, keys: [[0, E_END[1]], [.2, pull], [.32, thrust, 'out'], [.55, P(thrust, { y: .67 })], [.75, noto, 'out'], [.9, noto], [1, IDLE1]],
        ev: [[0, () => drawnR = true],
          [.32, () => { a.from = root.position.clone(); a.to = a.from.clone().addScaledVector(fwdW(), 5.6); streak(a.from, a.to, FX_LIGHT, .06, .7); }],
          [.74, () => drawnR = false],
          [.75, () => { streak(a.from, a.to, FX_RED, .14, .35); hit('q', 0)(); }]] };
    }
    const from = step === 0 ? IDLE2 : N_END[step - 1];
    if (step === 0 || step === 1) {   // rechts diagonal, links diagonal
      const w = step === 0 ? P(IDLE2, { y: .9, c: [-.05, -.4, 0], hR: [-.45, 1.88, .05], bR: [-.3, .7, -.62] })
        : P(N_END[0], { y: .9, c: [-.05, .4, 0], hL: [.45, 1.88, .05], bL: [.3, .7, -.62] });
      return { dur, walk: true, hold: N_END[step], keys: [[0, from], [.35, w], [.65, N_END[step], 'out'], [1, N_END[step]]],
        ev: [[.5, () => arc([0, 1.3, .9], [0, step ? .3 : -.3, step ? .75 : -.75], 1.5, 2.4)], [.6, hit('q', 0)]] };
    }
    if (step === 2) {   // X-Schnitt
      const k1 = P(IDLE2, { y: .92, c: [-.12, 0, 0], n: [-.05, 0, 0], hR: [.16, 1.88, .12], bR: [.55, .55, -.62], hL: [-.16, 1.88, .12], bL: [-.55, .55, -.62] });
      return { dur, walk: true, hold: N_END[2], keys: [[0, from], [.35, k1], [.62, N_END[2], 'out'], [1, N_END[2]]],
        ev: [[.5, () => arc([0, 1.25, .9], [0, 0, .75], 1.35, 2.2)], [.54, () => arc([0, 1.25, .95], [0, 0, -.75], 1.35, 2.2)], [.56, hit('q', 0)], [.62, hit('q', 1)]] };
    }
    // Wirbelsprung: hoch, eine volle Drehung mit beiden Klingen, Landung mit Druckwelle
    const crouch = P(IDLE2, { y: .62, c: [.6, 0, 0], n: [-.5, 0, 0], hR: [-.35, 1.0, -.2], bR: [-.6, .3, -.75], hL: [.35, 1.0, -.2], bL: [.6, .3, -.75], fL: [.3, .06, .1], fR: [-.3, .06, -.1] });
    const air = P(IDLE2, { y: 1.35, h: [0, 0, 0], c: [-.1, 0, 0], n: [-.1, 0, 0], hR: [-.85, 1.5, .05], bR: [-1, .05, .1], hL: [.85, 1.5, .05], bL: [1, .05, .1], fL: [.2, .5, .15], fR: [-.2, .42, -.1] });
    const land = P(IDLE2, { y: .6, c: [.7, 0, 0], n: [-.55, 0, 0], hR: [-.7, .9, .4], bR: [-.7, -.4, .6], hL: [.7, .9, .4], bL: [.7, -.4, .6], fL: [.4, .06, .3], fR: [-.4, .06, -.3] });
    return { dur, keys: [[0, from], [.2, crouch], [.32, air, 'out'], [.58, air], [.66, land, 'in'], [.85, land], [1, IDLE2]],
      ev: [[.36, () => windG.visible = true], [.6, () => windG.visible = false],
        [.66, () => { ring(root.position, FX_LIGHT, 4, .45); ring(root.position, FX_RED, 3, .35); hit('q', 0)(); }]],
      tick(u) {
        spinAng = TAU * clamp((u - .3) / .3, 0, 1);
        windG.position.copy(root.position);
        windArcs.forEach(m => { m.rotation.z = -(spinAng * 1.1 + m.userData.off); });
      },
      end() { spinAng = 0; windG.visible = false; } };
  }
  // Zeitfenster abgelaufen, Klinge noch draußen: kurz wegstecken, ohne Treffer
  function defSheathe() {
    const from = holdPose ?? lastPose;
    return { dur: KLINGE_TIMING.sheathe, walk: true, keys: [[0, from], [.6, P(IDLE1, { hR: 'H1', bR: SAYA_DIR, y: .86 }), 'out'], [1, IDLE1]], ev: [[.58, () => drawnR = false]] };
  }
  // Neu: schnelle Drehung mit ausgestreckter Klinge. Einhand zieht und steckt weg, Zweihand schwingt beide.
  function defKreis() {
    const one = stance === 1, base = IDLE();
    const ext = one
      ? P(IDLE1, { y: .82, h: [0, 0, 0], c: [.25, .1, 0], n: [-.2, 0, 0], hR: [-.92, 1.22, .12], bR: [-1, .04, .2], hL: [.3, 1.0, .1], fL: [.32, .06, -.1], fR: [-.32, .06, .15] })
      : P(IDLE2, { y: .8, h: [0, 0, 0], c: [.25, 0, 0], n: [-.2, 0, 0], hR: [-.9, 1.22, .1], bR: [-1, .04, .2], hL: [.9, 1.22, .1], bL: [1, .04, .2], fL: [.32, .06, .05], fR: [-.32, .06, .05] });
    return {
      dur: KLINGE_TIMING.e,
      keys: [[0, base], [.18, ext, 'out'], [.8, ext], [1, base]],
      ev: [...(one ? [[.1, () => drawnR = true], [.9, () => drawnR = false]] : []),
        [.44, () => arc([0, 1.05, 0], [-Math.PI / 2, 0, 0], 2.5, 5.8, FX_LIGHT, .25)], [.5, hit('e')]],
      tick(u) { spinAng = TAU * inOut(clamp((u - .15) / .67, 0, 1)); },
      end() { spinAng = 0; },
    };
  }
  function defDash() {
    const crouch1 = P(IDLE1, { y: .6, h: [.15, .45, 0], c: [.95, -.35, 0], n: [-.85, .25, 0], fL: [.26, .06, -.5], fR: [-.2, .06, .48] });
    const crouch2 = P(IDLE2, { y: .6, h: [.15, 0, 0], c: [.95, 0, 0], n: [-.85, 0, 0], hL: [.34, 1.0, -.55], hR: [-.34, 1.0, -.55], bL: [.3, .2, -1], bR: [-.3, .2, -1], fL: [.24, .06, .45], fR: [-.22, .06, -.5] });
    const end1 = P(IDLE1, { y: .68, h: [0, -.65, 0], c: [.5, .62, 0], n: [-.3, -.45, 0], hR: [-.98, 1.25, -.15], bR: [-.92, .22, -.32], hL: [.32, 1.0, .25],
      fL: [.36, .06, .45], fR: [-.3, .06, -.55] });
    const end2 = P(IDLE2, { y: .68, h: [0, 0, 0], c: [.5, 0, 0], n: [-.3, 0, 0], hR: [-.95, 1.18, -.3], bR: [-.7, .02, -.72], hL: [.95, 1.18, -.3], bL: [.7, .02, -.72],
      fL: [.4, .06, .4], fR: [-.4, .06, -.4] });
    const one = stance === 1, c = one ? crouch1 : crouch2, e = one ? end1 : end2;
    const keys = one
      ? [[0, IDLE1], [.18, c], [.22, c, 'lin'], [.34, e, 'out'], [.62, P(e, { y: .66 })], [.74, P(IDLE1, { hR: 'H1', bR: SAYA_DIR, y: .78, c: [.4, -.2, 0], n: [.2, 0, 0] }), 'out'], [.86, P(IDLE1, { y: .8, n: [.2, 0, 0] })], [1, IDLE1]]
      : [[0, IDLE2], [.18, c], [.22, c, 'lin'], [.34, e, 'out'], [.56, P(e, { y: .66 })], [.64, P(e, { hR: [-.7, .9, .2], bR: [-.3, -.8, .4], hL: [.7, .9, .2], bL: [.3, -.8, .4] }), 'out'], [1, IDLE2]];
    const from = root.position.clone();
    const cut = () => streak(from, root.position, FX_RED, .16, .35);
    let lastG = -1;
    const { from: mf, to: mt } = KLINGE_TIMING.dash.move;
    return {
      dur: KLINGE_TIMING.dash.ms, keys,
      ev: [[.22, () => { if (one) drawnR = true; }], [mt - .01, () => streak(from, root.position, FX_LIGHT, .07, .9)],
        ...(one ? [[.73, () => drawnR = false], [.74, () => { cut(); hit('dash', 0)(); }]]
          : [[.6, () => { cut(); hit('dash', 0)(); }], [.66, () => { cut(); hit('dash', 1)(); }]])],
      tick(u) {
        if (u < mf || u > mt) return;
        const gi = Math.floor((u - mf) / (mt - mf) * 6);
        if (gi > lastG && gi < 6) { lastG = gi; ghost(); }
      },
    };
  }
  function defWirbel(dur = KLINGE_TIMING.wirbel) {
    const one = stance === 1, base = IDLE();
    const wind = P(IDLE2, { y: .95, h: [0, 0, 0], c: [-.12, 0, 0], n: [0, 0, 0], hR: [-.86, 1.5, .05], bR: [-1, .05, .12], hL: [.86, 1.5, .05], bL: [1, .05, .12], fL: [.3, .06, 0], fR: [-.3, .06, 0] });
    const air = P(wind, { y: 1.35, c: [-.05, 0, .06], fL: [.18, .55, .12], fR: [-.2, .42, -.1] });
    const thr = P(IDLE2, { y: .76, h: [0, 0, 0], c: [.55, 0, 0], n: [-.35, 0, 0], hR: [.5, 1.02, .52], bR: [.72, -.3, .6], hL: [-.5, 1.02, .52], bL: [-.72, -.3, .6], fL: [.35, .06, .4], fR: [-.35, .06, -.35] });
    const { wirbelFrom: a, wirbelTo: b } = KLINGE_TIMING;
    const ev = [[a, () => { windG.visible = true; hit('wirbelPull')(); }]];
    if (one) ev.push([.02, () => drawnR = true], [.97, () => drawnR = false]);
    let i = 0;
    for (let ms = 600; ms <= dur - 400; ms += 500) { const n = i++; ev.push([ms / dur, hit('wirbelTick', n)]); }
    ev.push([b, () => {
      windG.visible = false;
      arc([0, 1.0, .6], [-Math.PI / 2, 0, 0], 2.4, 5.5, FX_LIGHT, .4);
      ring(root.position, FX_LIGHT, 6, .5);
      hit('wirbelEnd')();
    }]);
    return {
      dur,
      keys: [[0, base], [.06, wind], [.12, air], [.88, P(air, { y: 1.3 })], [.92, thr, 'out'], [.97, P(thr, { y: .74 })], [1, base]],
      ev,
      tick(u) {
        spinAng = wirbelSpin(clamp((u - a) / (b - a), 0, 1)) * (dur === KLINGE_TIMING.wirbel ? 1 : dur / KLINGE_TIMING.wirbel);
        if (u > a && u < b) {
          const t = performance.now() / 1000;
          windG.position.copy(root.position);
          windArcs.forEach((m, n) => { m.rotation.z = -(spinAng * 1.05 + m.userData.off); m.material.opacity = .45 + .25 * Math.sin(t * 20 + n); });
        }
      },
      end() { spinAng = 0; windG.visible = false; },
    };
  }
  // In Zweihand steckt er zuerst die linke Klinge weg, am Ende zieht er beide wieder
  function defAder() {
    const two = stance === 2, base = IDLE();
    const up = P(IDLE1, { y: .95, h: [0, 0, 0], c: [-.15, 0, 0], n: [-.25, 0, 0], hR: [-.12, 1.98, .32], bR: [-.05, 1, .12], hL: [.28, 1.1, .3], fL: [.2, .06, -.1], fR: [-.2, .06, .15] });
    const slam = P(IDLE1, { y: .78, c: [.5, -.25, 0], n: [.5, 0, 0], hR: 'H1', bR: SAYA_DIR });
    return {
      dur: KLINGE_TIMING.ader,
      keys: [[0, base], [.22, up, 'out'], [.45, P(up, { y: .97 })], [.6, slam, 'out'], [.85, P(slam, { y: .79 })], [1, base]],
      ev: [[.08, () => { drawnR = true; drawnL = false; }], [.24, () => ring(root.position, FX_RED, 15, .6)], [.58, () => drawnR = false], [.6, hit('ader')],
        ...(two ? [[.9, () => { drawnR = drawnL = true; }]] : [])],
    };
  }
  function defSwap(to) {
    if (to === 2) {
      const grab = P(IDLE1, { y: .86, c: [.3, -.45, 0], hR: 'H1', hL: 'H2', bL: SAYA_DIR, bR: SAYA_DIR });
      const flo = P(IDLE2, { y: .9, c: [-.05, 0, 0], n: [-.1, 0, 0], hR: [-.72, 1.62, .3], bR: [-.6, .72, .3], hL: [.72, 1.62, .3], bL: [.6, .72, .3] });
      return { dur: KLINGE_TIMING.swap, keys: [[0, IDLE1], [.4, grab], [.7, flo, 'out'], [1, IDLE2]],
        ev: [[.45, () => { drawnR = drawnL = true; stance = 2; }], [.6, () => arc([0, 1.5, .3], [0, 0, 0], 1, 2.4, FX_LIGHT, .25)], [.7, hit('swap')]] };
    }
    const flick = P(IDLE2, { hR: [-.62, 1.38, .4], bR: [-.3, -.62, .7], hL: [.62, 1.38, .4], bL: [.3, -.62, .7] });
    const put = P(IDLE1, { y: .86, c: [.3, -.45, 0], hR: 'H1', hL: 'H2', bL: SAYA_DIR, bR: SAYA_DIR });
    return { dur: KLINGE_TIMING.swap, keys: [[0, IDLE2], [.35, flick, 'out'], [.7, put], [1, IDLE1]],
      ev: [[.68, () => { drawnR = drawnL = false; stance = 1; }], [.7, hit('swap')]] };
  }
  const makeAction = (ability, attack, anim): any => {
    if (ability === 'e') return defKreis();
    if (ability === 'dash') return defDash();
    if (ability === 'wirbel') return defWirbel(anim.dur);
    if (ability === 'ader') return defAder();
    if (ability === 'swap') return defSwap(wanted);
    if (attack === 'q') return defQ(anim.step);
    if (attack === 'sheathe') return stance === 1 ? defSheathe() : null;
    return null;                                     // 'clones' und 'eat' haben keine eigene Aktion
  };

  // ───────────────────────── Hauptschleife
  let eatK = 0;
  let holdPose = null;           // Endpose des letzten Q-Schlags, steht bis zum nächsten Druck oder bis das Zeitfenster abläuft
  let act = null, actKey = '', lastPose = resolve(IDLE1), blendFrom = null, blendT = 0, runPh = 0, T = 0, lastLoco = 'idle', ready = false;
  function evalKeys(keys, u) {
    let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
    const [t0, p0] = keys[i], [t1, p1, e] = keys[i + 1];
    const k = (EASE[e] || inOut)(clamp((u - t0) / Math.max(1e-4, t1 - t0), 0, 1));
    return mix(resolve(p0), resolve(p1), k);
  }
  function cancel() {
    act?.def.end?.();
    act = null; holdPose = null; spinAng = 0; windG.visible = false;
  }
  function setStance(s, snap = false) {
    wanted = s;
    if (snap) { cancel(); actKey = ''; }
  }
  const snapStance = () => { stance = wanted; drawnR = drawnL = stance === 2; };

  function update(dt, anim: any = {}) {
    const s = dt > 1 ? dt / 1000 : dt;
    T += s;
    const loco = anim.state || 'idle', ability = anim.ability || null, attack = anim.attack || null;
    if (!act && stance !== wanted && ability !== 'swap') snapStance();
    if (loco === 'dead') { if (act) cancel(); drawnR = drawnL = stance === 2; }

    const key = ability || attack ? `${ability}:${attack}:${anim.seq ?? 0}` : '';
    if (key !== actKey) {
      actKey = key;
      const def = key && loco !== 'dead' ? makeAction(ability, attack, anim) : null;
      if (def) {
        if (act) cancel();
        const keepBlend = attack === 'q' && holdPose;   // Kette: Schlag beginnt genau in der gehaltenen Endpose
        holdPose = null;
        def.ev.sort((x, y) => x[0] - y[0]);
        act = { def, t: 0, i: 0 };
        blendFrom = lastPose; blendT = keepBlend ? 0 : .12;
      }
    }
    if (holdPose && (!anim.hold || loco === 'dead' || loco === 'air')) { holdPose = null; blendFrom = lastPose; blendT = .2; }
    // Einhand ohne Schlag und ohne gehaltene Pose: Klinge steckt (z. B. nach Abbruch durch Laufen in den Sprung)
    if (!act && !holdPose && stance === 1 && wanted === 1 && loco !== 'dead') drawnR = false;
    if (loco !== lastLoco) { blendFrom = lastPose; blendT = .15; lastLoco = loco; }

    let pose;
    const sit = loco === 'sit';
    if (act) {
      const d = act.def;
      if (!anim.frozen) act.t += s * 1000 * (anim.rate ?? 1);
      const u = clamp(act.t / d.dur, 0, 1);
      while (act.i < d.ev.length && d.ev[act.i][0] <= u) d.ev[act.i++][1]();
      d.tick?.(u);
      pose = evalKeys(d.keys, u);
      if (d.walk && (loco === 'run' || loco === 'back')) {   // Q geht im Laufen: Beine aus der Laufpose
        runPh += s * (anim.speed || 7) / .55 * (loco === 'back' ? -1 : 1);
        const r = runPose(runPh);
        pose.y = r.y; pose.fL = r.fL; pose.fR = r.fR;
      }
      if (u >= 1) {
        d.end?.(); act = null;
        if (d.hold && anim.hold) { holdPose = d.hold; blendT = 0; } else { blendFrom = pose; blendT = .1; }
      }
    } else if (holdPose) {
      pose = resolve(holdPose);
      pose.y += .01 * Math.sin(T * 6);
      if (loco === 'run' || loco === 'back') {   // Halten im Laufen: Oberkörper bleibt, Beine laufen
        if (!anim.frozen) runPh += s * (anim.speed || 7) / .55 * (loco === 'back' ? -1 : 1);
        const r = runPose(runPh);
        pose.y = r.y; pose.fL = r.fL; pose.fR = r.fR;
      }
    } else if (loco === 'run' || loco === 'back') {
      if (!anim.frozen) runPh += s * (anim.speed || 7) / .55 * (loco === 'back' ? -1 : 1);
      pose = resolve(runPose(runPh, loco === 'back' ? .25 : .62));
    } else if (loco === 'air') pose = resolve(airPose());
    else if (loco === 'dead') pose = resolve(DEAD);
    else if (sit) {
      // Seiza: kniet auf den Fersen, rechte Hand auf dem Oberschenkel, Spieß in der linken; alle 2,8 s ein Bissen, Fleisch seitlich abziehen, kauen
      const k = (T % 2.8) / 2.8, b = k < .45 ? Math.sin(Math.PI * k / .45) ** .7 : 0;
      const sl = k > .2 && k < .4 ? (k - .2) / .2 : k >= .4 && k < .45 ? 1 : 0;
      const chew = k >= .45 ? Math.abs(Math.sin(T * 13)) * .05 : 0;
      pose = resolve(P(IDLE1, { y: .36, h: [0, 0, 0], c: [.08 + .1 * b, 0, 0], n: [.05 + .1 * b + chew, -.15 * sl, .2 * b], hR: [-.16, .44, .26],
        hL: [lerp(.22, .02, b) + .16 * sl, lerp(.56, 1.04, b), lerp(.36, .27, b)], fL: [.12, .05, -.3], fR: [-.12, .05, -.3] }));
      eatK = b;
    } else {
      pose = resolve(IDLE());
      pose.y += .012 * Math.sin(T * 2.3); pose.c[0] += .03 * Math.sin(T * 2.3);
    }
    root.rotation.y += spinAng;

    if (blendT > 0 && blendFrom) { blendT -= s; pose = mix(blendFrom, pose, 1 - clamp(blendT / .12, 0, 1)); }
    lastPose = pose;

    // Pose anwenden
    hips.position.y = pose.y; hips.rotation.set(...pose.h as [number, number, number]); chest.rotation.set(...pose.c as [number, number, number]); neck.rotation.set(...pose.n as [number, number, number]);
    root.updateMatrixWorld(true);
    legIK(legL, pose.fL); legIK(legR, pose.fR);
    armIK(armL, pose.hL); armIK(armR, pose.hR);
    root.updateMatrixWorld(true);
    placeSword(swordR, armR.hand, pose.bR); placeSword(swordL, armL.hand, pose.bL);
    // Beim Essen stecken beide Klingen in der Scheide, der Spieß liegt in der linken Hand (+1 Draw Call nur dann)
    swordR.visible = drawnR && !sit; swordL.visible = drawnL && !sit;
    skewer.visible = sit && !act;
    if (skewer.visible) {
      root.worldToLocal(armL.hand.getWorldPosition(skewer.position));
      skewer.quaternion.setFromUnitVectors(V(0, 1, 0), V(lerp(.25, -1, eatK), lerp(.9, .12, eatK), lerp(.35, .15, eatK)).normalize());
    }
    saya1.hilt.scale.setScalar(swordR.visible ? 1e-4 : 1); saya2.hilt.scale.setScalar(swordL.visible ? 1e-4 : 1);

    // Stirnband
    const an = scarfAnchor.getWorldPosition(V());
    if (!ready || an.distanceTo(sP[0]) > 5) { scarfReset(); ready = true; }   // erster Frame oder Teleport
    const side = V().setFromMatrixColumn(head.matrixWorld, 0).normalize();
    const back = V().setFromMatrixColumn(head.matrixWorld, 2).normalize().negate();
    sP[0].copy(an); sO[0].copy(an);
    for (let i = 1; i < SN; i++) {
      const v = sP[i].clone().sub(sO[i]).multiplyScalar(.9);
      sO[i].copy(sP[i]);
      sP[i].add(v).add(V(0, -5 * s * s, 0)).addScaledVector(back, .6 * s * s).add(V(Math.sin(T * 3 + i) * .002, 0, 0));
    }
    for (let i = 1; i < SN; i++) {
      const d = sP[i].clone().sub(sP[i - 1]); const L = d.length() || 1;
      sP[i].copy(sP[i - 1]).addScaledVector(d, SEG / L);
    }
    const pa = scarfGeo.attributes.position;
    for (let i = 0; i < SN; i++) {
      const w = .07 * (1 - i / SN * .5);
      for (const n of [0, 1]) { const p = sP[i].clone().addScaledVector(side, (n ? 1 : -1) * w + (i % 2 ? .012 : -.012)); pa.setXYZ(i * 2 + n, p.x, p.y, p.z); }
    }
    pa.needsUpdate = true;

    updateFx(s); updateBlood(s);
  }

  const model: any = {
    root, update, setStance, scarf, onHit: null,
    get stance() { return stance; },
    anchors: { crystal: armR.hand, handL: armL.hand, handR: armR.hand },
    fx: { group: fxGroup, blood: bleedFx, ring, streak, RED: FX_RED, LIGHT: FX_LIGHT },
    get tris() { let n = (SN - 1) * 2; for (const m of [body, swordR, swordL]) n += m.geometry.attributes.position.count / 3; return n; },
  };
  return model;
}

// Schattenklon: Kopie mit eigenem Skelett, spielt jede Pose des Originals mit. sync() kopiert alle Gelenke, die Lage setzt der Aufrufer.
export function cloneKlinge(model, color = 0x14141c, opacity = .55) {
  const root = SkeletonUtils.clone(model.root) as THREE.Object3D;
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
  const src = [], dst = [];
  model.root.traverse(o => src.push(o));
  root.traverse((o: any) => { dst.push(o); if (o.isMesh) o.material = material; });
  return {
    root,
    sync() {
      for (let i = 1; i < src.length; i++) {
        dst[i].position.copy(src[i].position); dst[i].quaternion.copy(src[i].quaternion); dst[i].scale.copy(src[i].scale); dst[i].visible = src[i].visible;
      }
      root.rotation.y = model.root.rotation.y;
    },
    dispose() {
      root.traverse((o: any) => { if (o.isSkinnedMesh) o.skeleton.dispose(); });
      material.dispose();
    },
  };
}
