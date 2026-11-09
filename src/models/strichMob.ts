// Mobs im Strich-Stil (Vorlage docs/ref/mob-viewer.html, Look wie strichMagier.ts): dunkler Körper (ink), eine Akzentfarbe (ac),
// Leuchten nur für Augen und Magie (gl). Builder: h Mensch, q Vierbeiner, b Flieger, k Käfer.
// Pro Mob 1 SkinnedMesh (Körper + Leuchtteile über aGlow) und nur bei Flügel-Häuten/Schatten ein zweites, durchsichtiges.
// Schnittstelle wie models/creatures.ts: { root, height, update(dt, anim) }, dazu pose = { windup, spin, still }, die Fähigkeiten setzen (abilities.ts).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lerpTo as lerp } from '../util';

// Alles // PH
const RIM = [0.5, 0.55, 0.65], RIM_POW = 2.6;       // Lichtrand wie strichMagier
const GLOW_K = 1.6;                                   // Leuchtfarben über die Bloom-Schwelle
const TINTS = { slow: new THREE.Color(0x5f86c8), dead: new THREE.Color(0x5a5048), poison: new THREE.Color(0x4a8a1a), fear: new THREE.Color(0x6a3a7a) };   // wie creatures.ts
const CHAMP_GLOW = new THREE.Color(0.16, 0.3, 0.55);
const ZUS_COLOR = { heal: 0x60ff70, shield: 0x6aa8ff, haste: 0xffd040, platzt: 0xff3020, teilt: 0xc070ff };

const grad = new THREE.DataTexture(new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const capDown = (r, len, rs = 6) => { const g = new THREE.CapsuleGeometry(r, len, 2, rs); g.translate(0, -len / 2, 0); return g; };
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const lathe = (pts, seg = 8) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
const cone = (r, h, seg = 5) => new THREE.ConeGeometry(r, h, seg);
const octa = r => new THREE.OctahedronGeometry(r, 0);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ring = r => new THREE.RingGeometry(r - .08, r, 40).rotateX(-Math.PI / 2);
const C = c => c instanceof THREE.Color ? c : new THREE.Color(c);

// Geteilt und nie freigegeben (removeMob ruft dispose auf)
const keep = o => { o.dispose = () => {}; return o; };
const iceMat = keep(new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.5, emissive: 0x2a5070 }));
const iceGeo = keep(box(1.5, 2.2, 1.5));

// ───────── Rig: Bones + Teile, am Ende zu einem SkinnedMesh verschmolzen
function rig() {
  const R: any = { root: new THREE.Group(), bones: [], parts: [], soft: [] };
  R.B = (p, x = 0, y = 0, z = 0) => { const b = new THREE.Bone(); b.position.set(x, y, z); p.add(b); R.bones.push(b); return b; };
  const M = (pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl));
  R.p = (bone, geo, c, pos?, rot?, scl?) => { R.parts.push({ bone, geo, c: C(c), m: M(pos, rot, scl), glow: 0 }); };
  R.g = (bone, geo, c, pos?, rot?, scl?) => { R.parts.push({ bone, geo, c: C(c).clone().multiplyScalar(GLOW_K), m: M(pos, rot, scl), glow: 1 }); };
  R.s = (bone, geo, c, pos?, rot?, scl?, glow = 0) => { R.soft.push({ bone, geo, c: C(c), m: M(pos, rot, scl), glow }); };   // durchsichtig, beidseitig
  R.joint = (parent, x, y, z, r1, l1, r2, l2, c) => {   // Zwei-Glied-Arm/Bein wie beim Strichmagier: oben, unten, Ende
    const up = R.B(parent, x, y, z); R.p(up, capDown(r1, l1), c);
    const lo = R.B(up, 0, -l1, 0); R.p(lo, capDown(r2, l2), c);
    const end = R.B(lo, 0, -l2, 0);
    return { up, lo, end };
  };
  R.base = R.B(R.root);     // Bodenring und Zusatz-Symbol, ohne Größe der Figur
  R.inner = R.B(R.base);    // Figur, trägt o.scale
  return R;
}

// Pro Mob ein Material (Tönung, Treffer-Blitz), Shader-Programm geteilt über customProgramCacheKey
function mobMat(soft: boolean, opacity = 1) {
  const U = { uTint: { value: new THREE.Vector4(0, 0, 0, 0) }, uGlowK: { value: 1 } };
  const m: any = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, transparent: soft || opacity < 1, opacity: soft ? .85 : opacity, side: soft ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !soft && opacity >= 1 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTint = U.uTint; sh.uniforms.uGlowK = U.uGlowK;
    sh.vertexShader = 'attribute float aGlow; varying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGlow = aGlow;');
    sh.fragmentShader = 'uniform vec4 uTint; uniform float uGlowK; varying float vGlow;\n' + sh.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint.rgb, uTint.a * (1. - vGlow));
        totalEmissiveRadiance += vGlow * uGlowK * diffuseColor.rgb; diffuseColor.rgb *= 1. - vGlow;`)
      .replace('#include <opaque_fragment>', soft ? '#include <opaque_fragment>' : `outgoingLight += (1. - vGlow) * vec3(${RIM.join(',')}) * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), ${RIM_POW.toFixed(1)});\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => soft ? 'strichMobSoft' : 'strichMob';   // Häute ohne Lichtrand: flach von der Seite gesehen wären sie sonst weiß
  m.U = U;
  return m;
}

function bake(R, list, mat, skel) {
  const geo = mergeGeometries(list.map(p => {
    const mw = p.bone.matrixWorld.clone().multiply(p.m);
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(mw);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), bi = R.bones.indexOf(p.bone);
    for (let i = 0; i < n; i++) { col[i * 3] = p.c.r; col[i * 3 + 1] = p.c.g; col[i * 3 + 2] = p.c.b; si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(p.glow), 1));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    p.geo.dispose();
    return g;
  }));
  const sm = new THREE.SkinnedMesh(geo, mat);
  R.root.add(sm);
  sm.bind(skel);
  // Feste, großzügige Hülle statt Neuberechnung aus der Pose (wie creatures.ts)
  geo.computeBoundingSphere();
  sm.boundingSphere = geo.boundingSphere.clone();
  sm.boundingSphere.radius *= 1.6;
  return sm;
}

// ───────── Waffen (schlank, Metall hell, Holz dunkel), an der Hand
function weapon(R, b, kind, o) {
  const wood = 0x4a3424, iron = 0xa8adb5, big = o.bigWeapon ? 1.7 : 1, gl = o.gl ?? 0xffffff;
  switch (kind) {
    case 'sword':   R.p(b, box(.05, 1.2 * big, .14 * big), iron, [0, -.65 * big, .08]); R.p(b, box(.28, .04, .07), wood, [0, -.05, .08]); break;
    case 'axe':     R.p(b, capDown(.025, 1.3 * big), wood, [0, .3, .05]); R.p(b, new THREE.CylinderGeometry(.32 * big, .32 * big, .04, 10, 1, false, 0, Math.PI), iron, [0, -.85 * big, .1], [0, 0, Math.PI / 2]); break;
    case 'club':    R.p(b, lathe([[0, 0], [.05, 0], [.07, -.5], [.14, -.9], [.1, -1.05], [0, -1.08]]), wood, [0, 0, .05]); break;
    case 'hammer':  R.p(b, capDown(.03, 1.2), wood, [0, .2, .05]); R.p(b, box(.5, .3, .3), iron, [0, -1, .05]); break;
    case 'cleaver': R.p(b, box(.04, .6 * big, .34 * big), iron, [0, -.4, .18]); break;
    case 'staff':   R.p(b, capDown(.025, 1.8), wood, [0, .8, .05]); R.g(b, ico(.09), gl, [0, .9, .05]); break;
    case 'spear':   R.p(b, capDown(.022, 2), wood, [0, .9, .05]); R.p(b, cone(.05, .3, 4), iron, [0, 1.0, .05]); break;
    case 'orb':     R.g(b, ico(.13, 1), gl, [0, -.05, .2]); break;
    case 'rock':    R.p(b, new THREE.DodecahedronGeometry(.17), 0x6a6458, [0, -.05, .15]); break;
    case 'blob':    R.p(b, ico(.15, 1), 0x6a7a24, [0, -.05, .15]); break;
    case 'bone':    R.p(b, capDown(.03, .6), 0xd8ceb0, [0, .2, .1], [1.2, 0, 0]); break;
    case 'ember':   R.g(b, ico(.12, 1), 0xff7020, [0, -.05, .15]); break;
    case 'lantern': R.p(b, capDown(.012, .4), iron, [0, 0, .05]); R.g(b, box(.14, .2, .14), gl, [0, -.5, .05]); break;
    case 'censer':  R.p(b, capDown(.008, .5), iron, [0, 0, .05]); R.p(b, ico(.1, 1), 0x7a6a3a, [0, -.58, .05]); R.g(b, ico(.05), gl, [0, -.5, .05]); break;
    case 'whip':    for (let i = -1; i <= 1; i++) R.p(b, capDown(.012, 1), 0x3a2a20, [i * .05, 0, .05], [0, 0, i * .25]); break;
    case 'blades':  R.p(b, box(.03, 1, .1), iron, [0, -.5, .05], [.25, 0, 0]); break;
    case 'hooks':   R.p(b, new THREE.TorusGeometry(.15, .022, 5, 12, Math.PI * 1.3), iron, [0, -.15, .1]); break;
    case 'flail':   R.p(b, capDown(.02, .6), wood, [0, 0, .05]); R.p(b, capDown(.008, .4), iron, [0, -.6, .05]); R.p(b, ico(.18, 0), iron, [0, -1.1, .05]); break;
  }
}

// ───────── Mensch (Strichfigur)
function humanoid(R, o) {
  const ink = C(o.ink), ac = C(o.ac ?? o.ink), gl = o.gl;
  const fat = o.fat ?? 1, thin = o.thin ?? 1, W = fat * thin, aL = o.armLen ?? 1, lL = o.legLen ?? 1;
  const L1 = .46 * lL, L2 = .46 * lL, A1 = .31 * aL, A2 = .29 * aL, rk = Math.sqrt(fat) * thin;
  const P: any = { kind: 'h' };
  const hipY = o.float ? 1.0 : L1 + L2;
  const hips = P.hips = R.B(R.inner, 0, hipY, 0); P.hipY = hipY;
  R.p(hips, new THREE.SphereGeometry(.14, 7, 4), ink, [0, 0, 0], [0, 0, 0], [1.25 * W, .8, .9 * W]);
  if (!o.float) for (const s of [1, -1]) {
    const l = R.joint(hips, s * .11 * W, -.05, 0, .08 * rk, L1, .064 * rk, L2, ink);
    R.p(l.end, cone(.065 * rk, .26), ink, [0, -.02, .08], [Math.PI / 2, 0, 0], [1, 1, .7]);
    if (s === 1) P.legL = l; else P.legR = l;
  }
  if (o.robe) {
    const h = o.float ? 1.0 : hipY - .02;
    R.p(hips, lathe(o.float ? [[0, -h - .1], [.08 * W, -h * .6], [.2 * W, -.2], [.16 * W, .1]] : [[.32 * W, -h], [.27 * W, -h * .6], [.2 * W, -.15], [.15 * W, .1]]), ac);
  }
  const chest = P.spine = R.B(hips, 0, .05, 0); chest.rotation.x = o.hunch ?? 0;
  R.p(chest, lathe([[0, -.04], [.1, -.02], [.11, .1], [.15, .33], [.18, .47], [.15, .56], [.08, .61], [0, .62]]), ink, [0, 0, 0], [0, Math.PI / 8, 0], [1.1 * W, 1, .64 * W]);
  if (!o.hood && !o.bones) R.p(chest, new THREE.TorusGeometry(.13, .04, 3, 10), ac, [0, .56, 0], [Math.PI / 2, 0, 0], [W, W, .8]);
  if (o.bones) for (let i = 0; i < 4; i++) R.p(chest, new THREE.TorusGeometry(.13 * W, .018, 3, 10), ac, [0, .18 + i * .1, 0], [Math.PI / 2, 0, 0], [1.05, .75, 1]);
  if (o.bandage) for (let i = 0; i < 5; i++) R.p(chest, new THREE.TorusGeometry(.15 * W, .022, 3, 10), ac, [0, .08 + i * .11, 0], [Math.PI / 2 + (i % 2 - .5) * .25, 0, 0], [1.05, .7, 1]);
  if (o.cracks) for (let i = -1; i <= 1; i++) R.g(chest, box(.02, .26, .02), o.crackC ?? 0xff6020, [i * .07 * W, .32, .1 * W], [0, 0, i * .45]);
  if (o.drip) for (let i = 0; i < 5; i++) R.p(chest, cone(.035, .2), ac, [Math.cos(i * 1.3) * .14 * W, .02, Math.sin(i * 1.3) * .09 * W], [Math.PI, 0, 0]);
  if (o.wings) {
    P.wings = [];
    for (const s of [-1, 1]) {
      const wg = R.B(chest, s * .08, .45, -.08);
      R.p(wg, capDown(.025, .9), ink, [0, 0, 0], [0, 0, -s * 2.1]);
      R.p(wg, capDown(.018, .7), ink, [s * .78, .42, 0], [0, 0, -s * 2.8]);
      const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(.8, .45), new THREE.Vector2(1.3, .25), new THREE.Vector2(1.0, -.25), new THREE.Vector2(.5, -.35)]);
      R.s(wg, new THREE.ShapeGeometry(sh), ac, [0, 0, 0], [0, 0, 0], [s, 1, 1]);
      P.wings.push(wg);
    }
  }
  const arms = [];
  for (const s of [1, -1]) {
    const a = R.joint(chest, s * .23 * W, .49, 0, .058 * rk, A1, .052 * rk, A2, ink);
    a.up.rotation.z = s * .1;
    R.p(a.end, ico(.07 * rk), ink);
    if (o.claws) for (let i = -1; i <= 1; i++) R.p(a.end, cone(.02, .25, 4), ac, [i * .04, -.12, .03], [Math.PI, 0, 0]);
    arms.push(a);
  }
  P.armL = arms[0]; P.armR = arms[1];
  if (o.fourArms) for (const s of [1, -1]) {
    const a = R.joint(chest, s * .2 * W, .32, 0, .045, A1 * .9, .04, A2 * .9, ink); a.up.rotation.z = s * .55;
    weapon(R, a.end, 'blades', o);
    if (s === 1) P.armL2 = a.up; else P.armR2 = a.up;
  }
  if (o.weapon) { weapon(R, arms[1].end, o.weapon, o); if (o.weapon === 'blades') weapon(R, arms[0].end, 'blades', o); }
  if (o.tufts) for (const s of [-1, 1]) R.p(chest, ico(.09), ac, [s * .23 * W, .55, 0]);
  const neck = R.B(chest, 0, .6, 0); R.p(neck, new THREE.CylinderGeometry(.04, .05, .12, 5), ink, [0, .05, 0]);
  const head = P.head = R.B(neck, 0, .1, 0);
  const hs = o.head ?? 1, hm = o.paleHead ? ac : ink;
  if (o.bell) {
    R.p(head, lathe([[0, .42], [.06, .42], [.12, .36], [.15, .18], [.2, .02], [.26, -.04], [0, -.04]], 12), ac);
    R.p(head, ico(.05), ac, [0, .45, 0]);
  } else {
    R.p(head, ico(.18 * hs, 1), hm, [0, .16 * hs, 0], [0, 0, 0], [.95, 1.05, 1]);
    if (o.snout) R.p(head, cone(.08, .3, 5), hm, [0, .14, .22], [Math.PI / 2, 0, 0]);
    if (o.ears) for (const s of [-1, 1]) R.p(head, cone(.045, .28, 4), hm, [s * .09, .42, -.02]);
    if (gl && !o.faceless) for (const s of [-1, 1]) R.g(head, octa(.028 * hs), gl, [s * .065 * hs, .19 * hs, .16 * hs], [0, 0, 0], [1, .8, .5]);
    if (o.mouth) R.p(head, new THREE.CircleGeometry(.055 * hs, 10), 0x050202, [0, .1 * hs, .175 * hs]);
    if (o.wrap) R.p(head, new THREE.TorusGeometry(.17, .045, 3, 10), ac, [0, .12, 0], [Math.PI / 2 + .1, 0, 0], [1, 1, 1.3]);
    if (o.hood === 'point') R.p(head, cone(.24, .7, 4), ac, [0, .3, -.02], [0, Math.PI / 4, 0]);
    else if (o.hood) R.p(head, lathe([[0, .38], [.15, .34], [.23, .18], [.23, -.02], [.18, -.1]]), ac, [0, .02, -.03], [-.15, 0, 0]);
    if (o.hat === 'point') { R.p(head, cone(.18, .65, 6), ac, [0, .55, -.03], [-.25, 0, 0]); R.p(head, new THREE.CylinderGeometry(.34, .34, .02, 10), ac, [0, .3, 0]); }
    if (o.hat === 'tall') R.p(head, new THREE.CylinderGeometry(.16, .13, .4, 8), o.hatC, [0, .45, 0]);
    if (o.horns) { const hr = o.bigHorns ? 2 : 1; for (const s of [-1, 1]) R.p(head, cone(.035 * hr, .26 * hr, 5), ac, [s * .12, .32 + .05 * hr, 0], [0, 0, -s * .45]); }
    if (o.leaves) for (let i = 0; i < 6; i++) R.p(head, cone(.06, .25, 4), ac, [Math.cos(i) * .1, .36, Math.sin(i) * .1], [Math.cos(i) * .5, 0, Math.sin(i) * .5]);
    if (o.tufts) R.p(head, ico(.1), ac, [0, .32 * hs, 0]);
  }
  if (o.tail) { const t = R.joint(hips, 0, 0, -.12, .03, .4, .022, .35, ink); t.up.rotation.x = -2.1; t.lo.rotation.x = .5; R.p(t.end, cone(.06, .12, 4), ink, [0, -.04, 0], [Math.PI, 0, 0]); P.tail = t.up; }
  P.height = hipY + .82 + .36 * hs;
  P.width = Math.max(1.2, (.5 * W + A1 * .6 + (o.weapon ? .5 : 0)) * 1.7);
  return P;
}

// ───────── Vierbeiner
function quadruped(R, o) {
  const ink = C(o.ink), ac = C(o.ac ?? o.ink), gl = o.gl;
  const len = o.long ? 1.0 : .7, legH = o.low ? .22 : .32, h = o.heavy ? 1.5 : 1;
  const r = o.lean ? .13 : o.heavy ? .26 : .16, by = legH * 2 + r;
  const P: any = { kind: 'q', legs: [] };
  const body = P.body = R.B(R.inner, 0, by, 0); P.by = by;
  R.p(body, new THREE.CapsuleGeometry(r, len, 2, 8), ink, [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const l = R.joint(body, x * r * .7, -r * .3, z * len * .45, .045 * h, legH, .038 * h, legH, ink);
    l.lo.rotation.x = z > 0 ? .25 : -.25; l.up.rotation.x = z > 0 ? -.15 : .15;
    R.p(l.end, ico(.045), ink, [0, 0, .02]);
    P.legs.push({ ...l, rest: l.up.rotation.x });
  }
  const neck = P.head = R.B(body, 0, r * .3, len * .55 + r * .6);
  R.p(neck, capDown(.06, .25), ink, [0, 0, 0], [-2.3, 0, 0]);
  R.p(neck, ico(.14, 1), ink, [0, .14, .16], [0, 0, 0], [.9, .85, 1.25]);
  R.p(neck, cone(.07, .2, 5), ink, [0, .12, .34], [Math.PI / 2, 0, 0]);
  for (const sx of [-1, 1]) R.p(neck, cone(.035, .14, 4), ink, [sx * .07, .28, .1], [-.2, 0, 0]);
  if (gl) for (const sx of [-1, 1]) R.g(neck, octa(.025), gl, [sx * .07, .19, .27]);
  if (o.tusks) for (const sx of [-1, 1]) R.p(neck, cone(.025, .2, 4), ac, [sx * .07, .08, .38], [-1.1, 0, 0]);
  if (o.spikes) for (let i = 0; i < 5; i++) R.p(body, cone(.035, .2, 4), ac, [0, r * .95, len * (.4 - i * .2)], [-.4, 0, 0]);
  if (o.cracks) for (let i = 0; i < 4; i++) R.g(body, box(r * 2.05, .02, .03), 0xff6020, [0, (i % 2) * .05, len * (.35 - i * .22)], [0, 0, (i % 2 - .5) * .5]);
  const tail = R.joint(body, 0, .02, -len * .5 - r * .6, .025, o.small ? .5 : .3, .018, o.small ? .4 : .25, o.small ? ac : ink);
  tail.up.rotation.x = -2.0; P.tail = tail.up;
  R.inner.scale.setScalar(o.small ? .55 : o.heavy ? 1.35 : 1);
  P.height = by + .55; P.width = Math.max(1.2, (len + .9) * 1.3);
  return P;
}

// ───────── Flieger (Wasserspeier)
function bat(R, o) {
  const ink = C(o.ink), ac = C(o.ac ?? o.ink), gl = o.gl;
  const P: any = { kind: 'b', wings: [] };
  const body = P.body = R.B(R.inner, 0, 2.0, 0);
  R.p(body, new THREE.CapsuleGeometry(.14, .3, 2, 8), ink);
  const head = P.head = R.B(body, 0, .35, .04);
  R.p(head, ico(.15, 1), ink);
  if (o.horns) for (const s of [-1, 1]) R.p(head, cone(.03, .24, 4), ac, [s * .09, .15, -.04], [-.4, 0, -s * .4]);
  if (gl) for (const s of [-1, 1]) R.g(head, octa(.025), gl, [s * .055, .02, .13]);
  for (const s of [-1, 1]) {
    const pv = R.B(body, s * .1, .15, 0);
    R.p(pv, capDown(.022, .7), ink, [0, 0, 0], [0, 0, -s * 2.0]);
    R.p(pv, capDown(.016, .6), ink, [s * .63, .3, 0], [0, 0, -s * 2.7]);
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(.65, .3), new THREE.Vector2(1.15, .1), new THREE.Vector2(.85, -.2), new THREE.Vector2(.5, -.12), new THREE.Vector2(.25, -.3)]);
    R.s(pv, new THREE.ShapeGeometry(sh), ac, [0, 0, 0], [0, 0, 0], [s, 1, 1]);
    P.wings.push(pv);
  }
  for (const s of [-1, 1]) { const l = R.joint(body, s * .07, -.25, 0, .03, .25, .025, .22, ink); l.lo.rotation.x = .6; }
  P.height = 2.6; P.width = 2.8;
  return P;
}

// ───────── Käfer
function bug(R, o) {
  const ink = C(o.ink), ac = C(o.ac ?? o.ink), gl = o.gl;
  const P: any = { kind: 'k', legs: [] };
  const body = P.body = R.B(R.inner, 0, 0, 0);
  R.p(body, ico(.34, 1), ac, [0, .42, -.35], [0, 0, 0], [1, .6, 1.25]);
  R.p(body, ico(.17, 1), ink, [0, .42, .08]);
  R.p(body, ico(.15, 1), ink, [0, .44, .32], [0, 0, 0], [1, .85, 1.1]);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const l = R.joint(body, s * .14, .42, -.1 + i * .15, .025, .3, .02, .38, ink);
    l.up.rotation.z = s * 1.9; l.lo.rotation.z = -s * 1.5; P.legs.push(l.up);
  }
  for (const s of [-1, 1]) R.p(body, cone(.025, .2, 4), ink, [s * .06, .38, .5], [Math.PI / 2, 0, s * .4]);
  if (gl) for (const s of [-1, 1]) R.g(body, octa(.025), gl, [s * .07, .5, .44]);
  R.inner.scale.setScalar(1.3);
  P.height = 1.0; P.width = 1.6;
  return P;
}
const BUILD = { h: humanoid, q: quadruped, b: bat, k: bug };

// ───────── Zusatz sichtbar: Bodenring + Symbol über dem Kopf, im selben Mesh
function zusatzMark(R, P, z, H) {
  const c = ZUS_COLOR[z], zb = P.zb = R.B(R.base), mark = P.mark = R.B(zb, 0, H + .5, 0);
  if (z === 'heal') { R.g(zb, ring(P.width * .5), c, [0, .05, 0]); R.g(mark, box(.12, .45, .12), c); R.g(mark, box(.45, .12, .12), c); }
  if (z === 'shield') { R.g(zb, ring(P.width * .5), c, [0, .05, 0]); R.g(mark, octa(.2), c, [0, 0, 0], [0, 0, 0], [1, 1.4, 1]); }
  if (z === 'haste') { R.g(zb, ring(3.5), c, [0, .05, 0]); R.g(mark, cone(.18, .4, 3), c, [0, 0, 0], [Math.PI, 0, 0]); }
  if (z === 'platzt') { R.g(zb, ring(4), c, [0, .05, 0]); R.g(mark, ico(.14, 1), c); }
  if (z === 'teilt') R.g(mark, cone(.14, .35, 4), c, [0, 0, 0], [Math.PI, 0, 0]);
  if (z === 'fliegt') R.s(zb, new THREE.CircleGeometry(P.width * .35, 24).rotateX(-Math.PI / 2), 0x000000, [0, .05, 0]);
}

// skin = [Name-Key, Bauart, Optionen]; zusatz = Schlüssel oder 'none'; size: Faktor (kleine Kopien bei „teilt“)
export const strichMob = (kind: string, o: any, zusatz = 'none', size = 1) => (level: number) => {
  const R = rig();
  const P = BUILD[kind](R, o);
  const sc = (o.scale ?? 1) * size;
  R.inner.scale.multiplyScalar(sc);
  const H = P.height * R.inner.scale.y;
  P.lift = zusatz === 'fliegt' && kind !== 'b' ? 1.4 : 0;
  if (zusatz !== 'none') zusatzMark(R, P, zusatz, H + P.lift);

  R.root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(R.bones);
  const mat = mobMat(false, o.ghost ? .6 : 1);
  const mats = [mat];
  bake(R, R.parts, mat, skel);
  if (R.soft.length) { const sm = mobMat(true); mats.push(sm); bake(R, R.soft, sm, skel); }
  const ice = new THREE.Mesh(iceGeo, iceMat);
  ice.position.y = 1; ice.scale.set(Math.max(.8, P.width * .6), Math.max(.6, H / 2.2), Math.max(.8, P.width * .6)); ice.visible = false;
  R.root.add(ice);
  const lv = 0.9 + (level - 18) * 0.02;   // wie creatures.ts: Mobs wachsen mit dem Level
  R.root.scale.setScalar(lv);

  const pose = { windup: 0, spin: 0, still: false };
  const j: any = {};
  const ease = (k, v, f) => { j[k] = lerp(j[k] ?? v, v, f); return j[k]; };
  let t = Math.random() * 10, phase = Math.random() * 6, shown = '';
  const ph = Math.random() * 6;
  const jerk = o.jerky ? x => Math.round(x * 3) / 3 : x => x;
  const anim = (s, a) => {
    const dead = a.state === 'dead', run = a.state === 'run', f = Math.min(1, s * 12);
    t += s;
    if (run) phase += s * (a.speed || 6) * (P.kind === 'q' ? 2.1 : P.kind === 'k' ? 4 : 1.5);
    const ph2 = o.jerky ? Math.round(phase * 2.5) / 2.5 : phase;   // ruckartig: Schritte springen
    const atk = a.attack > 0 ? Math.sin(a.attack * Math.PI) : 0, w = pose.windup;
    const lift = P.lift ? P.lift + Math.sin(t * 1.6) * .15 : 0;
    R.inner.rotation.y = pose.spin * Math.PI * 2;
    if (P.mark) { P.mark.rotation.y = t * 2; P.zb.scale.setScalar(dead ? 1e-4 : 1); }
    if (P.kind === 'h') {
      const sw = run ? Math.sin(ph2) : jerk(Math.sin(t * 2 + ph)) * .12;
      if (P.legL) {
        P.legL.up.rotation.x = ease('lL', dead ? 0 : run ? -sw * .8 : -sw * .4, f); P.legR.up.rotation.x = ease('lR', dead ? 0 : run ? sw * .8 : sw * .4, f);
        P.legL.lo.rotation.x = ease('kL', run ? Math.max(0, Math.cos(ph2)) * 1.1 : 0, f); P.legR.lo.rotation.x = ease('kR', run ? Math.max(0, -Math.cos(ph2)) * 1.1 : 0, f);
      }
      P.armL.up.rotation.x = ease('aL', dead ? -.3 : (run ? sw * .6 : sw) - w * 2.2 * (o.scale > 1.5 ? 1 : 0), f);
      P.armR.up.rotation.x = ease('aR', dead ? .3 : (run ? -sw * .5 - .2 : -sw) - atk * 2.4 - w * 2.8, f);
      P.armR.lo.rotation.x = ease('fR', -.25 - atk * .6 - w * .5, f);
      if (P.armL2) { P.armL2.rotation.x = -sw * 2 - atk * 1.6; P.armR2.rotation.x = sw * 2 - atk * 1.6; }
      P.spine.rotation.x = ease('sp', (o.hunch ?? 0) + (run ? .14 : jerk(Math.sin(t * 1.3 + ph)) * .03) + atk * .25 - w * .3, f);
      P.head.rotation.z = o.jerky ? (Math.sin(t * 7 + ph) > .85 ? .45 : Math.sin(t * .8) * .1) : 0;
      if (P.wings) P.wings.forEach((g, i) => { g.rotation.y = (i ? -1 : 1) * (Math.sin(t * 3 + ph) * .15); });
      if (P.tail) P.tail.rotation.z = Math.sin(t * 3 + ph) * .3;
      const fl = o.float ? Math.sin(t * 1.5 + ph) * .2 + .3 : 0;
      R.inner.position.y = ease('y', dead ? .15 : fl + lift + (run ? Math.abs(Math.cos(ph2)) * .05 : 0), f);
      R.inner.rotation.x = ease('dx', dead ? -Math.PI / 2 : 0, Math.min(1, s * 6));
    } else if (P.kind === 'q') {
      P.legs.forEach((l, i) => { l.up.rotation.x = l.rest + (run ? Math.sin(ph2 + (i === 0 || i === 3 ? 0 : Math.PI)) * .8 : Math.sin(t * 2 + i * 1.6 + ph) * .08); });
      P.tail.rotation.z = Math.sin(t * 3 + ph) * .3;
      P.head.rotation.x = ease('hd', -atk * .5 + (run ? Math.sin(ph2 * 2) * .06 : Math.sin(t * 1.5 + ph) * .06), f);
      P.body.position.z = atk * .6 + w * -.3;
      R.inner.position.y = ease('y', dead ? .05 : lift + (run ? Math.abs(Math.cos(ph2)) * .07 : 0) + atk * .3, f);
      R.inner.rotation.z = ease('dz', dead ? Math.PI / 2 : 0, Math.min(1, s * 6));
    } else if (P.kind === 'b') {
      const fl = dead ? -.3 : Math.sin(t * (run ? 11 : 8) + ph) * .6;
      P.wings[0].rotation.y = -.3 - fl; P.wings[1].rotation.y = .3 + fl;
      P.body.position.y = ease('y', dead ? .3 : 2.2 + Math.sin(t * 2 + ph) * .2 - atk * 1.0, f);
      R.inner.rotation.z = ease('dz', dead ? 1.3 : 0, Math.min(1, s * 6));
    } else {
      P.legs.forEach((l, i) => { l.rotation.y = Math.sin(t * (run ? 14 : 2) + i) * (run ? .35 : .08); });
      P.body.position.z = atk * .6;
      R.inner.position.y = ease('y', dead ? .8 : lift, f);
      R.inner.rotation.z = ease('dz', dead ? Math.PI : 0, Math.min(1, s * 6));
    }
  };
  return {
    root: R.root, height: (H + P.lift) * lv, pose, mats,
    update(dt, a) {
      ice.visible = !!a.iced;
      const tint = a.state === 'dead' ? 'dead' : a.feared ? 'fear' : a.poisoned ? 'poison' : a.slowed ? 'slow' : '', fl = Math.ceil((a.flash ?? 0) * 4), key = `${tint},${fl},${a.champion || false}`;
      if (key !== shown) {
        shown = key;
        for (const m of mats) {
          const c = TINTS[tint];
          m.U.uTint.value.set(c?.r ?? 0, c?.g ?? 0, c?.b ?? 0, c ? (tint === 'dead' ? 1 : .55) : 0);
          m.U.uGlowK.value = tint === 'dead' ? .15 : 1;
          m.emissive.setScalar(fl / 4 * .9);
          if (a.champion === true) m.emissive.add(CHAMP_GLOW);
        }
      }
      if (a.frozen || (pose.still && a.state !== 'dead')) return;   // Eis/Root und Lauerer im Blick: Pose bleibt stehen
      anim(dt / 1000, a);
    },
  };
};
