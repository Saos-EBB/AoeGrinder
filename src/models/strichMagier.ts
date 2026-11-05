// Strichmagier aus dem Viewer „Frost Grind – Strichmagier“ (Stand optimiert): Basis, Feuer, Eis, Arkan, Blitz, Seuche und der ?-Magier (Spell-Viewer, skin qm).
// Ein SkinnedMesh trägt Körper, Glüh-Teile (aGlow), Eiszapfen (icT/icB) und Trink-Requisiten (eigene Bones, icT = -2): 1 Draw Call plus Schatten.
// Die Stufen-Effekte lesen nur einen Wert 0 … 1 (setMeter): Hitze, Kälte, Ladungen/4, Batterie. Die Spiellogik liest nichts aus dem Modell.
// Gleiche Schnittstelle wie buildMage: anim = { state, speed, cast, channel, squat, frozen, smoke, charge, over, drinkSkin }, anchors.crystal hängt am Stabgelenk (dort sitzt die Waffe).
// Effekte in Weltkoordinaten (Flammen, Blitze, Tropfen, Partikel) hängen in `scarf`, models/mage.ts legt die Gruppe in die Szene.

import * as THREE from 'three';
import { clamp, lerpTo as lerp, inOut, outC } from '../util';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTrail, stepWatcher, SKIN_FX } from './trail';
import { eMat, PAL } from '../vfx/energy';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const outBack = t => { const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const sine = t => .5 - .5 * Math.cos(Math.PI * t);
const EASE = { io: inOut, out: outC, back: outBack, lin: t => t, sine };
const TAU = Math.PI * 2;
const bump = (t, a, b, f = .15) => clamp(Math.min((t - a) / f, (b - t) / f), 0, 1); // 0→1→0 im Fenster
const rnd = (a, b) => a + Math.random() * (b - a);

// Im Spiel: Zaubern dauert höchstens so lang, sonst hinkt die Figur dem schnellen Zaubern hinterher. Der Viewer zeigt 1,0–2,2 s. // PH
const CAST_MS = 700;
const CAST_HOLD = 0.55;       // Hier wartet die Pose, solange ein längerer Zauber läuft
const RIM = { color: [0.5, 0.55, 0.65], power: 2.6 };   // wie Klingenstrich: bleibt im Dunkeln sichtbar // PH
// Skin-IDs im Spiel → Skins des Viewers
const SKIN_OF = { alle: 'base', feuer: 'fire', frost: 'ice', arkan: 'arcane', zufall: 'qm', blitz: 'blitz', blut: 'plague' };   // alle: Kevins Zuhälter-Look, im Menü nicht mehr wählbar

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
  arcane: { name: 'Arkan', ink: col(0x2a1f45), accent: col(0x5b3a8f), orb: col(0xc58bff) },
  blitz: { name: 'Blitz', ink: col(0x1b2336), accent: col(0x3a5f9e), orb: col(0xbff4ff) },
  plague: { name: 'Seuche', ink: col(0xffffff), accent: col(0xb9a3c9), orb: col(0x9cff5a) },
  qm: { name: '?-Magier', ink: col(0x141418), accent: col(0x2a2a32), orb: col(0xffd23a) },
};

// ───────────────────────── Körper-Shader: Glühen (aGlow), Eiszapfen wachsen nach uM (icT ≥ 0), Requisite (icT = -2), Rand-Licht
function bodyHook(U) {
  return sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uM = U.uM;
    sh.vertexShader = 'attribute float aGlow, flick, icT; attribute vec3 icB; uniform float uTime, uM; varying float vGlow, vIce;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float gr = icT < 0. ? 1. : clamp((uM - icT) / .1, 0., 1.); gr = gr * gr * (3. - 2. * gr);
        transformed = icB + (transformed - icB) * gr;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        float sd = position.x * 31.0 + position.z * 17.0;
        transformed += vec3(sin(uTime * 17.0 + sd) * .03, (.55 + .45 * sin(uTime * 23.0 + sd * 1.7)) * .13, cos(uTime * 13.0 + sd) * .03) * flick * flick * aGlow;
        vGlow = aGlow; vIce = step(0., icT);`);
    sh.fragmentShader = 'varying float vGlow, vIce;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance += vGlow * diffuseColor.rgb + vIce * vec3(.016, .04, .058); diffuseColor.rgb *= 1. - vGlow;`)
      .replace('#include <opaque_fragment>',
        `outgoingLight += (1. - vGlow) * (1. - vIce) * vec3(${RIM.color.join(',')}) * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), ${RIM.power.toFixed(1)});\n#include <opaque_fragment>`);
  };
}
// Schatten: Eiszapfen und versteckte Requisiten wachsen auch in der Schatten-Tiefe mit
function depthMat(U) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = sh => {
    sh.uniforms.uM = U.uM;
    sh.vertexShader = 'attribute float icT; attribute vec3 icB; uniform float uM;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nfloat gr = icT < 0. ? 1. : clamp((uM - icT) / .1, 0., 1.); transformed = icB + (transformed - icB) * gr;');
  };
  return m;
}
// Hüllen (Feuer, Eis) nutzen die Körper-Geometrie: die Requisite (icT = -2) bekommt keine Hülle
function shellNoProp(sh) {
  sh.vertexShader = (sh.vertexShader.includes('attribute float icT') ? '' : 'attribute float icT;\n') + 'varying float vPr;\n' + sh.vertexShader.replace('void main() {', 'void main() {\n  vPr = step(icT, -1.5);');
  sh.fragmentShader = 'varying float vPr;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (vPr > .5) discard;');
}

// ───────────────────────── Eis: rund 90 Zapfen wachsen nach Kälte nacheinander heraus (Schwelle t), am Ende ganz bedeckt
let SEED = 11; const srnd = () => (SEED = (SEED * 9301 + 49297) % 233280) / 233280;   // fest, damit die Figur immer gleich aussieht
const UP = V(0, 1, 0);
function icicleGeo(len, r) {
  const prof = [[r, 0], [r * .82, len * .22], [r * .6, len * .5], [r * .32, len * .8], [0, len]].map(([a, b]) => new THREE.Vector2(a, b));
  const g = new THREE.LatheGeometry(prof, 6);
  const bend = (srnd() - .5) * .25 * len, p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = p.getY(i) / len; p.setX(i, p.getX(i) + bend * k * k); }
  g.computeVertexNormals();
  // Die Spitze hat Radius 0: entartete Normalen wären NaN und färben über den Bloom das ganze Bild schwarz
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) if (!(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) > 1e-4)) n.setXYZ(i, 0, 1, 0);
  return g;
}
function makeIcicles(F) {
  SEED = 11;
  const L = [], C = { base: col(0xeefaff).multiplyScalar(.36), tip: col(0x7fc8ff).multiplyScalar(.36) };   // dunkler als im Viewer: die Lampe über der Figur hebt Weiß sonst über die Bloom-Schwelle // PH
  const add = (bone, pos, dir, len, r, t) => {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, V(...dir).normalize());
    L.push({ bone, geo: icicleGeo(len * 1.45, r * 1.35), color: C, flick: true, t, m: new THREE.Matrix4().compose(V(...pos), q, V(1, 1, 1)) });
  };
  for (let i = 0; i < 7; i++) { const a = (i / 6 - .5) * 2.6; add(F.head, [Math.sin(a) * .11, .27, Math.cos(a) * .06 - .03], [Math.sin(a) * .6, 1, -.2], .16 + .08 * (1 - Math.abs(a) / 1.3), .03, .02 + i * .025); }
  for (const a of [F.armL, F.armR]) for (let i = 0; i < 4; i++) { const ang = i * 1.4 - 1; add(a.ua, [a.side * .04, .03, Math.sin(ang) * .05], [a.side * (.6 + .3 * i / 4), 1, Math.sin(ang) * .4], .14 + i * .03, .03, .05 + i * .05); }
  for (let i = 0; i < 3; i++) add(F.head, [(i - 1) * .05, .03, .13], [0, -1, .2], .08 + .04 * (i === 1 ? 1 : 0), .02, .25 + i * .03);
  for (const a of [F.armL, F.armR]) {
    for (let i = 0; i < 4; i++) { const ang = srnd() * TAU; add(a.ua, [Math.cos(ang) * .055, -.08 - i * .06, Math.sin(ang) * .055], [Math.cos(ang), -.25, Math.sin(ang)], .1 + srnd() * .07, .025, .3 + i * .05); }
    for (let i = 0; i < 4; i++) { const ang = srnd() * TAU; add(a.fa, [Math.cos(ang) * .05, -.05 - i * .06, Math.sin(ang) * .05], [Math.cos(ang), -.35, Math.sin(ang)], .1 + srnd() * .06, .022, .4 + i * .05); }
    for (let i = 0; i < 3; i++) add(a.hand, [(i - 1) * .03, -.04, .03], [(i - 1) * .3, -1, .4], .1, .016, .35 + i * .04);
  }
  for (let i = 0; i < 22; i++) { const ang = i / 22 * TAU * 3, h = .08 + (i % 4) * .13; add(F.chest, [Math.cos(ang) * .17, h, Math.sin(ang) * .11], [Math.cos(ang), .25 - (i % 3) * .2, Math.sin(ang)], .12 + srnd() * .1, .03, .5 + (i / 22) * .3); }
  for (let i = 0; i < 4; i++) add(F.chest, [(i - 1.5) * .06, .5, -.1], [(i - 1.5) * .2, .7, -1], .26, .04, .93 + i * .015);   // große Rückenzacken zuletzt
  for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU; add(F.hips, [Math.cos(ang) * .17, -.05, Math.sin(ang) * .12], [Math.cos(ang), -.4, Math.sin(ang)], .1 + srnd() * .06, .025, .62 + i * .03); }
  for (const l of [F.legL, F.legR]) {
    for (let i = 0; i < 4; i++) { const ang = srnd() * TAU; add(l.th, [Math.cos(ang) * .075, -.1 - i * .09, Math.sin(ang) * .075], [Math.cos(ang), -.15, Math.sin(ang)], .1 + srnd() * .05, .025, .72 + i * .03); }
    for (let i = 0; i < 4; i++) { const ang = srnd() * TAU; add(l.sh, [Math.cos(ang) * .06, -.08 - i * .09, Math.sin(ang) * .06], [Math.cos(ang), -.1, Math.sin(ang)], .08 + srnd() * .05, .02, .82 + i * .03); }
    add(l.ft, [0, .02, .1], [0, .6, 1], .1, .02, .95); add(l.ft, [0, .02, -.02], [0, .3, -1], .08, .018, .97);
  }
  return L;
}
// Eisschicht: dünne Hülle aus der Körper-Geometrie, halb durchsichtig, Kristall-Facetten. Wächst fleckig von unten nach oben
function makeIceShell(F, U) {
  const mat = new THREE.MeshToonMaterial({ color: new THREE.Color(0xdff6ff).multiplyScalar(.36), gradientMap: grad, emissive: 0x0c161c, transparent: true, opacity: .72, depthWrite: false });   // dunkler als im Viewer, siehe Zapfen // PH
  mat.onBeforeCompile = sh => {
    sh.uniforms.uM = U.uM;
    sh.vertexShader = 'attribute float icT; attribute vec3 icB;\nuniform float uM; varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      'float gr = icT < 0. ? 1. : clamp((uM - icT) / .1, 0., 1.); gr = gr * gr * (3. - 2. * gr); vec3 pos0 = icB + (position - icB) * gr; vec3 transformed = pos0 + normal * (.012 + .02 * uM); vP = position;');
    sh.fragmentShader = `uniform float uM; varying vec3 vP;
      float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      ` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float hgt = clamp(vP.y / 2.1, 0., 1.);                  // 0 Füße … 1 Kopf
        float cov = .55 * n3(vP * 9.) + .45 * hgt;              // fleckig, von unten nach oben
        if (cov > uM * 1.05) discard;
        float facet = floor(n3(vP * 22.) * 4.) / 4.;            // harte Kristall-Facetten
        vec3 c = mix(vec3(.78, .93, 1.), vec3(1.), facet * .7);
        vec4 diffuseColor = vec4(c * diffuse, opacity * (.6 + .4 * facet));`);
    shellNoProp(sh);
  };
  const m = new THREE.SkinnedMesh(F.body.geometry, mat); m.frustumCulled = false; F.root.add(m); m.bind(F.body.skeleton, F.body.bindMatrix);
  return m;
}

// ───────────────────────── Arkan: 62 Runen direkt auf dem Körper, 4 Leuchtstufen nach Ladungen
let runeTex = null;
const RUNE_TEX = () => runeTex ??= (() => {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
  const c = cv.getContext('2d'); c.strokeStyle = '#fff'; c.lineWidth = 9; c.lineCap = 'round';
  let sd = 7; const r = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 8; i++) {
    const ox = i * 64 + 12, oy = 10;
    c.beginPath(); c.moveTo(ox + 20, oy); c.lineTo(ox + 20, oy + 44);
    for (let k = 0; k < 3; k++) { const y = oy + r() * 40; c.moveTo(ox + 20, y); c.lineTo(ox + (r() < .5 ? 2 : 38), y + (r() - .5) * 24); }
    if (r() < .5) { c.moveTo(ox + 6, oy + 22); c.arc(ox + 20, oy + 22, 14, Math.PI, TAU * r()); }
    c.stroke();
  }
  return new THREE.CanvasTexture(cv);
})();
function runeMat(U) {
  const m = new THREE.MeshBasicMaterial({ map: RUNE_TEX(), color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uLvl = U.uLvl; sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'attribute float rT; varying float vRT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRT = rT;');
    sh.fragmentShader = 'uniform float uLvl; uniform float uTime; varying float vRT;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>
       float lit = step(vRT, uLvl + .001);                // uLvl = 0, .25, .5, .75, 1: so viele Runen leuchten
       diffuseColor.rgb = mix(vec3(.36, .2, .55), vec3(1., .72, 1.) * (1.15 + .15 * sin(uTime * 6. + vRT * 40.)), lit);
       diffuseColor.a *= mix(.3, 1., lit);`);
  };
  return m;
}
function bodyRunes(F) {
  SEED = 23;
  const L = [], spots = [];
  const ring = (bone, n, r, y0, y1, sx = 1, sz = 1) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU * 1.618 * 3 + i, y = lerp(y0, y1, (i + .5) / n); spots.push([bone, [Math.sin(a) * r * sx, y, Math.cos(a) * r * sz], [Math.sin(a) * sx, 0, Math.cos(a) * sz]]); } };
  ring(F.chest, 16, .165, .08, .54, 1.1, .66);
  ring(F.head, 6, .175, .1, .26, .95, 1);
  ring(F.hips, 4, .15, -.04, .04, 1.25, .9);
  for (const a of [F.armL, F.armR]) { ring(a.ua, 4, .06, -.05, -.28); ring(a.fa, 4, .054, -.04, -.26); ring(a.hand, 1, .072, 0, 0); }
  for (const l of [F.legL, F.legR]) { ring(l.th, 5, .082, -.06, -.42); ring(l.sh, 4, .066, -.06, -.4); }
  const order = spots.map((_, i) => i).sort(() => srnd() - .5);
  spots.forEach(([bone, pos, normal], k) => {
    const t = (Math.floor(order.indexOf(k) / spots.length * 4) + 1) / 4;   // .25, .5, .75, 1
    const s = .085 + srnd() * .025;
    const g = new THREE.PlaneGeometry(s, s), uv = g.attributes.uv, i = k % 8;
    for (let j = 0; j < uv.count; j++) uv.setX(j, (i + uv.getX(j)) / 8);
    g.rotateZ((srnd() - .5) * .8);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(...normal).normalize());
    const p0 = V(...pos).addScaledVector(V(...normal).normalize(), .006);
    L.push({ bone, m: new THREE.Matrix4().compose(p0, q, V(1, 1, 1)), raw: mw => { const c = g.clone(); c.applyMatrix4(mw); const n = c.attributes.position.count;
      c.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); c.setAttribute('flick', new THREE.BufferAttribute(new Float32Array(n), 1));
      c.setAttribute('rT', new THREE.BufferAttribute(new Float32Array(n).fill(t), 1)); return c; } });
  });
  return L;
}
// Arkane Ladungen: 4 Kugeln über dem Kopf, ein InstancedMesh im Energie-Look
function makeChargeOrbs() {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), eMat(PAL.arcane, { sc: 9, core: 1, flow: [0, 2, 0] }), 4);
  m.frustumCulled = false; m.visible = false;
  return m;
}

// ───────────────────────── Feuer: Anime-Flammen als Billboards. Wo und wie groß sie brennen, zeigt die Hitze
const FLAME_SPOTS = F => [
  [F.armL.hand, [0, 0, 0], .22, 0], [F.armR.hand, [0, 0, 0], .22, 0], [F.head, [0, .28, 0], .38, 0], [F.staff, [0, .82, 0], .3, 0],
  [F.head, [.09, .24, -.02], .26, .25], [F.head, [-.09, .24, -.02], .26, .25], [F.armL.ua, [0, .04, 0], .26, .3], [F.armR.ua, [0, .04, 0], .26, .3],
  [F.chest, [0, .48, -.1], .38, .5], [F.chest, [.1, .3, -.12], .3, .55], [F.chest, [-.1, .3, -.12], .3, .55], [F.armL.fa, [0, 0, 0], .2, .55], [F.armR.fa, [0, 0, 0], .2, .55],
  [F.head, [0, .3, .06], .45, .7], [F.hips, [0, 0, -.12], .3, .75], [F.legL.sh, [0, 0, .05], .22, .8], [F.legR.sh, [0, 0, .05], .22, .8],
  [F.chest, [0, .3, .12], .32, .9], [F.legL.ft, [0, 0, .06], .2, .92], [F.legR.ft, [0, 0, .06], .2, .92], [F.chest, [.16, .15, 0], .3, .97], [F.chest, [-.16, .15, 0], .3, .97],
  [F.legL.th, [0, -.2, .07], .26, .97], [F.legR.th, [0, -.2, .07], .26, .97]
];
function makeFlames(F, U) {
  const spots = FLAME_SPOTS(F);
  const geo = new THREE.PlaneGeometry(1, 1.9); geo.translate(0, .95, 0);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(spots.length).map(() => Math.random() * 10), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uHot: { value: 0 } },
    vertexShader: `attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main() { vUv = uv; vSeed = aSeed;
        vec3 c = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz; float s = length(instanceMatrix[0].xyz);
        vec4 mv = viewMatrix * vec4(c, 1.); mv.xy += position.xy * s; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uHot; varying vec2 vUv; varying float vSeed;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { return .55 * n(p) + .3 * n(p * 2.1) + .15 * n(p * 4.3); }
      float band(float f, float e) { return smoothstep(e - .015, e + .015, f); }
      void main() {
        vec2 uv = vUv; float y = uv.y;
        float sp = 1.8 + uHot * 1.6;
        float q = fbm(vec2(uv.x * 2. + vSeed, y * 1.6 - uTime * sp + vSeed * 2.));
        float sway = ((fbm(vec2(y * 1.2 - uTime * 1.1, vSeed)) - .5) * .8 + .12 * sin(y * 7. - uTime * 6. + vSeed)) * y * y;
        float x = uv.x - .5 - sway;
        float tongues = .5 + .5 * cos(x * 19. + sin(uTime * 3. + vSeed) * 1.2);
        float top = mix(.62, 1., tongues) * (.85 + .25 * q);
        float w = 1. - abs(x * 2.) / max(.05, (1. - pow(y / top, 1.6)) * (.95 - .15 * y));
        float f = w * (.8 + .4 * q) - smoothstep(top - .25, top, y) * .5;
        f *= smoothstep(0., .1, y);
        float hole = smoothstep(.72, .76, n(vec2(x * 7. + vSeed, y * 5. - uTime * sp * 1.5)));
        f -= hole * .35 * smoothstep(.25, .6, y);
        if (f < .05) discard;
        vec3 c = vec3(.38, .04, .03);
        c = mix(c, vec3(.86, .12, .05), band(f, .13));
        c = mix(c, vec3(1., .47, .05), band(f, .32));
        c = mix(c, vec3(1., .82, .2), band(f, .55));
        c = mix(c, vec3(1., .98, .82), band(f, .78 - .2 * uHot) * (.3 + .7 * uHot));
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const im = new THREE.InstancedMesh(geo, mat, spots.length); im.frustumCulled = false;
  im.userData.spots = spots; return im;
}
// Flammen-Hülle: Körper-Geometrie entlang der Normalen aufgeblasen, Zungen nach oben, ab 50 % Hitze (uK = (m − .5) / .5)
function makeFireShell(F, U) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uK = U.uK;
    sh.vertexShader = 'uniform float uTime, uK; varying vec3 vW; varying float vUp;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `vec3 transformed = position + normal * (.03 + .1 * uK);`)
      .replace('#include <project_vertex>', `vec4 wp = modelMatrix * vec4(transformed, 1.);
        float tg = sin(wp.x * 9. + uTime * 5.) * sin(wp.z * 9. - uTime * 4.);
        vUp = max(0., normal.y);
        wp.y += uK * (.04 + .1 * max(0., tg)) * (.4 + .6 * max(0., dot(normalize(normal), vec3(0., 1., 0.)) + .4));
        vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = `uniform float uTime, uK; varying vec3 vW; varying float vUp;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float band(float f, float e) { return smoothstep(e - .015, e + .015, f); }
      ` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float sp = 2.6;
        float ax = vW.x * 11. + vW.z * 9.;
        float q = .65 * n(vec2(ax, vW.y * 2.2 - uTime * sp)) + .35 * n(vec2(ax * 2.3 + 5., vW.y * 4. - uTime * sp * 1.7));
        float f = q * 1.1 + .1 + .25 * vUp;
        float thr = mix(1.05, .3, uK);
        if (f < thr) discard;
        f = (f - thr) / max(.1, 1.35 - thr);
        vec3 c = vec3(.86, .12, .05);
        c = mix(c, vec3(1., .47, .05), band(f, .18));
        c = mix(c, vec3(1., .82, .2), band(f, .45));
        c = mix(c, vec3(1., .98, .82), band(f, .75));
        vec4 diffuseColor = vec4(c, 1.);`);
    shellNoProp(sh);
  };
  const m = new THREE.SkinnedMesh(F.body.geometry, mat); m.frustumCulled = false; F.root.add(m); m.bind(F.body.skeleton, F.body.bindMatrix);
  m.visible = false; return m;
}
const _fm = new THREE.Matrix4(), _fp = V(), _fq = new THREE.Quaternion(), _fs = V();
function updateFlames(F, m, t) {
  const im = F.flames, hot = m >= .98 ? 1 : 0;
  im.material.uniforms.uHot.value = lerp(im.material.uniforms.uHot.value, hot, .1);
  im.userData.spots.forEach(([bone, off, size, min], i) => {
    const grow = clamp((m - min) / .12, 0, 1);
    const merge = clamp((m - .5) / .3, 0, 1), keep = i === 2 || i === 8 || i === 13;   // Kopf, Rücken, Kopf vorn bleiben als kleine Spitzen, die Hülle macht den Rest
    const s = size * grow * (.5 + .9 * m) * (1 + .45 * hot) * (1 + .08 * Math.sin(t * 13 + i * 2.1)) * (keep ? 1 - .25 * merge : 1 - .9 * merge) * (1 - .3 * hot);
    bone.localToWorld(_fp.set(off[0], off[1] - s * .25, off[2]));
    im.setMatrixAt(i, _fm.compose(_fp, _fq, _fs.setScalar(Math.max(1e-4, s))));
  });
  im.instanceMatrix.needsUpdate = true;
}

// ───────────────────────── Blitz: Zickzack-Bänder zur Kamera, Glow und Kern in einem Mesh
function makeBolts() {
  const MAX = 900, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 12 * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 12 * 4), 4));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  const B = { mesh: m, list: [], MAX, camDir: V(0, 0, -1) };
  m.onBeforeRender = (_r, _s, cam) => cam.getWorldDirection(B.camDir);   // Bänder zeigen zur Kamera (ein Bild Verzug)
  return B;
}
export function jag(a, b, depth = 4, amp = .22) {
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
function bolt(B, a, b, life = rnd(.05, .12), w = 1, branch = true) {
  const pts = jag(a, b);
  B.list.push({ pts, life, w });
  if (branch && Math.random() < .6) { const k = pts[Math.floor(rnd(.3, .7) * pts.length)]; bolt(B, k, k.clone().add(V(rnd(-1, 1), rnd(-.8, .4), rnd(-1, 1)).multiplyScalar(a.distanceTo(b) * .5)), life, w * .6, false); }
}
const _sd = V(), _bd = V();
const GLOW_C = [...col(0x3d7bff).toArray(), .22], CORE_C = [...col(0x9ff3ff).toArray(), 1];
function updateBolts(F, m, dt) {
  const B = F.bolts;
  B.list = B.list.filter(x => (x.life -= dt) > 0);
  const src = [F.armL.hand, F.armR.hand, F.head, F.armL.ua, F.armR.ua].map(b => b.getWorldPosition(V()));
  src[2].y += .28; src.push(F.crystal.getWorldPosition(V()));
  const want = F.dead ? 0 : Math.round(1 + 14 * m + (m >= .98 ? 8 : 0));
  let live = B.list.filter(x => x.w >= .8).length;
  while (live < want) {
    const a = src[Math.floor(Math.random() * src.length)], r = Math.random();
    if (r < .18 && m > .4) bolt(B, src[0], src[1], rnd(.05, .1), .8);                                     // Bogen zwischen den Händen
    else if (r < .3 && m > .7) { const g = F.root.getWorldPosition(V()); bolt(B, a, g.add(V(rnd(-2, 2), 0, rnd(-2, 2))), rnd(.06, .12), 1.2); }   // Einschlag am Boden
    else bolt(B, a, a.clone().add(V(rnd(-1, 1), rnd(-.4, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(.25, .5 + 1.1 * m))), rnd(.04, .1), .8 + .5 * m);
    live++;
  }
  const p = B.mesh.geometry.attributes.position, cl = B.mesh.geometry.attributes.color;
  let q = 0;
  const fill = (width, rgba) => {
    for (const x of B.list) for (let i = 0; i < x.pts.length - 1 && q < B.MAX * 2; i++, q++) {
      const a = x.pts[i], b = x.pts[i + 1];
      _sd.crossVectors(_bd.subVectors(b, a), B.camDir).normalize().multiplyScalar(width * x.w * (1 - i / x.pts.length * .6));
      for (let k = 0; k < 6; k++) cl.array.set(rgba, (q * 6 + k) * 4);
      p.array.set([a.x - _sd.x, a.y - _sd.y, a.z - _sd.z, a.x + _sd.x, a.y + _sd.y, a.z + _sd.z, b.x + _sd.x, b.y + _sd.y, b.z + _sd.z,
        a.x - _sd.x, a.y - _sd.y, a.z - _sd.z, b.x + _sd.x, b.y + _sd.y, b.z + _sd.z, b.x - _sd.x, b.y - _sd.y, b.z - _sd.z], q * 18);
    }
  };
  fill(.035 + .025 * m, GLOW_C); fill(.009 + .004 * m, CORE_C);
  p.needsUpdate = cl.needsUpdate = true; B.mesh.geometry.setDrawRange(0, q * 6);
  B.mesh.visible = q > 0;
}

// ───────────────────────── Seuche: Tropfen, Fliegen und Pfütze in einem InstancedMesh, Schleimfäden an den Füßen in einem zweiten
const GOO = { drops: 40, flies: 10, pud: 50 };
function makeGoo(F) {
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.03, 6, 4), new THREE.MeshToonMaterial({ gradientMap: grad }), 51); drops.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const st = [];
  for (let i = 0; i < 51; i++) { drops.setMatrixAt(i, zero); drops.setColorAt(i, col(i < GOO.drops ? (i % 3 ? 0x5fae3a : 0x6b3a8f) : i < GOO.pud ? 0x111111 : 0x3f6b2a)); }
  for (let i = 0; i < GOO.drops; i++) st.push({ ph: 'wait', t: Math.random() * 2, p: V(), v: V() });
  const strands = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, .5, 0), new THREE.MeshToonMaterial({ color: 0x5fae3a, gradientMap: grad }), 2);
  strands.frustumCulled = false; strands.setMatrixAt(0, zero); strands.setMatrixAt(1, zero);
  const src = [F.armL.hand, F.armR.hand, F.armL.fa, F.armR.fa, F.head, F.chest, F.hips];
  return { drops, st, strands, src, rate: 1, stick: [null, null] };
}
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = V(), _gp = V();
function updateGoo(F, dt, t) {
  const G = F.goo;
  G.st.forEach((d, i) => {
    d.t -= dt * (d.ph === 'wait' ? G.rate : 1);
    if (d.ph === 'wait' && d.t <= 0 && !F.dead) { d.ph = 'hang'; d.t = rnd(.5, 1.2); d.dur = d.t; d.bone = G.src[Math.floor(Math.random() * G.src.length)]; d.off = V(rnd(-.06, .06), d.bone === F.head ? 0 : -.05, rnd(-.05, .05)); }
    let sy = 1, sxz = 1;
    if (d.ph === 'hang') {
      const k = 1 - d.t / d.dur; d.bone.localToWorld(d.p.copy(d.off)); d.p.y -= .05 * k; sy = .6 + 2.2 * k; sxz = .6 + .4 * k;
      if (d.t <= 0) { d.ph = 'fall'; d.v.set(0, 0, 0); }
    } else if (d.ph === 'fall') {
      d.v.y -= 9 * dt; d.p.addScaledVector(d.v, dt); sy = 1.8;
      if (d.p.y <= F.groundY + .01) { d.p.y = F.groundY + .01; d.ph = 'splat'; d.t = 2; }
    } else if (d.ph === 'splat') { sy = .15; sxz = 2.2 * clamp(d.t / 2, 0, 1); if (d.t <= 0) { d.ph = 'wait'; d.t = rnd(.1, 1.2); } }
    if (d.ph === 'wait') sxz = sy = 0;
    G.drops.setMatrixAt(i, _gm.compose(d.p, _gq, _gs.set(sxz, sy, sxz)));
  });
  const c = F.head.getWorldPosition(V()).add(V(0, .05, 0));
  for (let i = 0; i < GOO.flies; i++) {
    const a = t * (2.2 + i * .37) + i * 1.7, r = .28 + .12 * Math.sin(t * 1.3 + i);
    _gp.set(c.x + Math.cos(a) * r + .03 * Math.sin(t * 31 + i), c.y + .25 * Math.sin(t * (1.7 + i * .2) + i) - .15, c.z + Math.sin(a * 1.1) * r + .03 * Math.cos(t * 27 + i));
    G.drops.setMatrixAt(GOO.drops + i, _gm.compose(_gp, _gq, _gs.setScalar(F.dead ? 0 : .53)));
  }
  // Pfütze: platter Tropfen unter der Figur, atmet langsam
  const pr = (.5 / .03) * (1 + .08 * Math.sin(t * 1.4)) * (F.melt ?? 1);
  G.drops.setMatrixAt(GOO.pud, _gm.compose(_gp.set(F.groundPos.x, F.groundY + .004, F.groundPos.z), _gq, _gs.set(pr, .2, pr)));
  G.drops.instanceMatrix.needsUpdate = true;
}
// Schleimfaden zwischen Boden-Klebepunkt und Fuß, aus = Größe 0
function setStrand(G, i, a, b, r) {
  const d = a ? b.clone().sub(a) : null, L = d ? d.length() : 0;
  if (a && L >= .02) _gm.compose(a, _gq.setFromUnitVectors(UP, d.normalize()), _gs.set(r, L, r)); else _gm.makeScale(0, 0, 0);
  G.strands.setMatrixAt(i, _gm); G.strands.instanceMatrix.needsUpdate = true; _gq.identity();
}
// Seuche-Shader: Grün-Lila-Muster, das ständig verschwimmt und nach unten läuft; Körper wabert leicht
function plagueShader(mat, U) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.vertexShader = 'varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `vec3 transformed = position + normal * .012 * sin(uTime * 3. + position.y * 14. + position.x * 9.);
       transformed.y -= .012 * (.5 + .5 * sin(uTime * 1.7 + position.x * 11. + position.z * 7.));
       vP = position;`);
    sh.fragmentShader = `uniform float uTime; varying vec3 vP;
      float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      ` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec3 pp = vP * vec3(7., 5., 7.);
       float n1 = n3(pp + vec3(0., uTime * .9, 0.)), n2 = n3(pp * 2.2 + vec3(3.1, uTime * 1.7, 1.7));
       float drip = .5 + .5 * sin(vP.y * 34. + uTime * 4. + n1 * 6. + vP.x * 9.);
       float k = clamp(n1 * .6 + n2 * .28 + drip * .3 - .12, 0., 1.);
       vec3 c = mix(vec3(.33, .66, .2), vec3(.2, .48, .36), smoothstep(.0, .28, k));
       c = mix(c, vec3(.47, .52, .17), smoothstep(.22, .4, k) * (1. - smoothstep(.4, .55, k)));
       c = mix(c, vec3(.44, .22, .58), smoothstep(.42, .66, k));
       c = mix(c, vec3(.24, .1, .34), smoothstep(.7, .95, k));
       vec4 diffuseColor = vec4(c * diffuse * .6, opacity);`);   // .6: die Lampe über der Figur hellt sonst zu Pastell auf // PH
  };
  mat.customProgramCacheKey = () => 'plagueBody';
}

// ───────────────────────── Requisiten zum Trinken: Griffpunkt im Ursprung, Öffnung nach +y, als Geometrie für das Körper-Mesh
function propGeo(skin) {
  const L = [];
  const add = (g, c, pos = [0, 0, 0], rot = [0, 0, 0]) => L.push(prep(g, col(c), new THREE.Matrix4().compose(V(pos[0], pos[1], pos[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])), V(1, 1, 1))));
  if (skin === 'base') { // Zuhälter-Becher: Gold, Steine, lila Inhalt
    add(new THREE.CylinderGeometry(.045, .05, .012, 8), 0xe2b13c, [0, -.07, 0]);
    add(new THREE.CylinderGeometry(.012, .014, .07, 5), 0xe2b13c, [0, -.035, 0]);
    add(new THREE.CylinderGeometry(.06, .03, .09, 8), 0xe2b13c, [0, .045, 0]);
    add(new THREE.CylinderGeometry(.055, .055, .006, 8), 0x8a2be2, [0, .088, 0]);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; add(new THREE.OctahedronGeometry(.014, 0), i % 2 ? 0xe0142a : 0x22c06a, [Math.sin(a) * .047, .05, Math.cos(a) * .047]); }
  }
  if (skin === 'fire') { // Flasche mit kleiner Flamme
    add(new THREE.CylinderGeometry(.035, .035, .14, 6), 0x6b3a12, [0, 0, 0]);
    add(new THREE.CylinderGeometry(.013, .03, .06, 6), 0x6b3a12, [0, .1, 0]);
    add(new THREE.CylinderGeometry(.036, .036, .05, 6), 0xf2e6c8, [0, -.01, 0]);
    add(new THREE.ConeGeometry(.02, .07, 5), 0xffa31a, [0, .165, 0]);
  }
  if (skin === 'ice') { // heiße Tasse
    add(new THREE.CylinderGeometry(.045, .04, .09, 8), 0xc84b32, [0, .02, 0]);
    add(new THREE.CylinderGeometry(.041, .041, .006, 8), 0x5a2e1a, [0, .064, 0]);
    add(new THREE.TorusGeometry(.025, .008, 3, 8), 0xc84b32, [.05, .02, 0], [0, 0, 0]);
  }
  if (skin === 'arcane') { // Tee-Schale
    add(new THREE.LatheGeometry([[0, -.02], [.035, -.02], [.06, .02], [.075, .045]].map(([a, b]) => new THREE.Vector2(a, b)), 10), 0x9fc7a8);
    add(new THREE.CylinderGeometry(.062, .062, .004, 10), 0x7a8f3a, [0, .03, 0]);
  }
  if (skin === 'plague') { // Glaskolben mit Schleim
    add(new THREE.SphereGeometry(.05, 8, 6), 0x7fdc4a, [0, .01, 0]);
    add(new THREE.CylinderGeometry(.014, .018, .07, 6), 0xbfd8b0, [0, .08, 0]);
    add(new THREE.CylinderGeometry(.016, .016, .02, 6), 0x6b4a2a, [0, .12, 0]);
  }
  return L.length ? mergeGeometries(L) : null;
}
// ?-Form: Bogen + Stiel + Punkt in einer Geometrie (Spell-Viewer)
const qGeo = () => mergeGeometries([
  new THREE.TorusGeometry(.5, .14, 4, 10, Math.PI * 1.45).rotateZ(-Math.PI * .45).translate(0, .55, 0),
  new THREE.CylinderGeometry(.13, .13, .4, 5).translate(0, -.12, 0),
  new THREE.IcosahedronGeometry(.17, 0).translate(0, -.55, 0)
].map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));

// ───────────────────────── IK
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
const _w = V(), _pw = V(), _rq = new THREE.Quaternion(), _sq = new THREE.Quaternion(), _hp = V();
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
const P = (base, o = {}): any => Object.assign({}, DEF, base, o);
const cp = p => { const o: any = {}; for (const k of KEYS) o[k] = Array.isArray(p[k]) ? p[k].slice() : p[k]; return o; };
function mix(a, b, u) { const o: any = {}; for (const k of KEYS) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u); return o; }
function kf(keys, u) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i], [t1, p1, e] = keys[i + 1];
  return mix(p0, p1, (EASE[e] || inOut)(clamp((u - t0) / Math.max(1e-4, t1 - t0), 0, 1)));
}

const N = P({ y: .98, h: [0, 0, 0], c: [.05, 0, 0], n: [0, 0, 0], hL: [.3, .95, .06], hR: [-.3, 1.08, .14], b: [0, 1, .04], fL: [.13, .06, 0], fR: [-.13, .06, 0] });
function runBase(ph, A = .5, lift = .28) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return { fL: [.12, .06 + lift * Math.max(0, c), A * s], fR: [-.12, .06 + lift * Math.max(0, -c), -A * s], s, c };
}
const ANIM: any = {
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
// Schluck-Rhythmus: 0 = Ruhe, 1 = am Mund. Periode in s, Anteil am Mund
function sip(t, per, frac = .35) { const k = (t % per) / per; return k < frac ? Math.sin(Math.PI * k / frac) ** .6 : 0; }
const STAFF_DOWN = { sf: 1, sp: [-.62, .04, .05], b: [.05, .03, 1] };
ANIM.base.sit = t => { // lümmelt, zurückgelehnt, Becher mit Stil
  const s = sip(t, 3.2);
  return P(N, { ...STAFF_DOWN, sp: [.62, .04, .05], y: .26, h: [-.12, .25, 0], c: [-.32 + .1 * s, -.15, 0], n: [.12 - .3 * s, -.2, -.12 + .1 * s],
    fL: [.14, .06, .72], fR: [-.22, .06, .3], hR: [-.36, .22, -.32],
    hL: [lerp(.32, .03, s), lerp(.62, .98, s), lerp(.38, .14, s)], pd: [lerp(0, -.1, s), lerp(1, .55, s), lerp(.05, -.8, s)], ps: 1 });
};
ANIM.fire.sit = t => { // wippt, Beine weit, trommelt, ext die Flasche
  const s = sip(t, 3.6, .45), sw = Math.sin(t * 3);
  return P(N, { ...STAFF_DOWN, y: .28, h: [-.05, .15 * sw, .1 * sw], c: [.15 - .65 * s, .2 * sw, .08 * Math.sin(t * 7)], n: [-.1 - .55 * s, .3 * Math.tanh(4 * Math.sin(t * 1.9)), .3 * (1 - s)],
    fL: [.38, .06 + .05 * Math.max(0, Math.sin(t * 6)), .42], fR: [-.38, .06 + .05 * Math.max(0, -Math.sin(t * 6)), .4],
    hR: [-.32, .52 + .06 * Math.abs(Math.sin(t * 12)), .48],
    hL: [lerp(.48 + .12 * sw, .04, s), lerp(.85 + .15 * Math.sin(t * 4), 1.12, s), lerp(.35, .12, s)], pd: [lerp(.4 * sw, 0, s), lerp(1, -.55, s), lerp(0, -.85, s)], ps: 1 });
};
ANIM.ice.sit = t => { // Knie angezogen, Tasse mit beiden Händen, zittert. Nur die Unterarme heben die Tasse, Oberarme bleiben ruhig
  const s = sip(t, 3.0), j = Math.sin(t * 57) * .6 + Math.sin(t * 39) * .4;
  const c0 = .36, hipY = .25;
  // Schulter im Wurzel-Raum aus Hüfte + Brust (Rumpf steht still), Ellbogen fest davor-unten
  const sh = side => V(side * .23, hipY + .05 + .49 * Math.cos(c0), .49 * Math.sin(c0));
  const el = side => sh(side).add(V(side * .05, -.8, .6).normalize().multiplyScalar(A1));
  const tgt = V(0, .66, .58).lerp(V(0, .95, .34), s);           // Tasse vorn → am Mund
  const hand = side => { const e = el(side); return e.clone().add(tgt.clone().add(V(side * .055, 0, 0)).sub(e).normalize().multiplyScalar(A2 - .002)).toArray(); };
  return P(N, { ...STAFF_DOWN, y: hipY, h: [0, 0, 0], c: [c0, .004 * j, .008 * j], n: [-.05 + .42 * s, .02 * j, .02 * j],
    fL: [.1, .06, .28], fR: [-.1, .06, .28], hL: hand(1), hR: hand(-1), ep: [.9, -.4, 1.4], pd: [0, lerp(1, .7, s), lerp(0, -.7, s)], ps: 1 });
};
ANIM.arcane.sit = t => { // Lotus, Tee-Schale mit beiden Händen, langsam
  const p = ANIM.arcane.idle(t), s = sip(t, 6, .45);
  return P(p, { hL: [.08, lerp(.82, 1.06, s), lerp(.34, .26, s)], hR: [-.08, lerp(.82, 1.06, s), lerp(.34, .26, s)], n: [lerp(.15, .32, s), 0, 0], c: [lerp(.04, -.06, s), 0, 0],
    pd: [0, lerp(1, .85, s), lerp(0, -.5, s)], ps: 1, ep: [1.1, .25, .35] });
};
// ── Blitz: aufgedrehtes Kind. Viel Batterie = zappelig, sprungbereit; wenig = schlapp und langsam. curM = Anzeige der Figur
let curM = .5;
const snap = (x, k = 5) => Math.tanh(k * x);
ANIM.blitz = {
  idle: t => {
    const m = curM, f = 1.5 + 3.5 * m, b = Math.abs(Math.sin(t * Math.PI * f));
    const hi = P(N, {
      y: .9 + .06 * b, h: [0, .2 * snap(Math.sin(t * 2.3)), 0], c: [.18, .15 * Math.sin(t * 5.1), .06 * Math.sin(t * 9)],
      n: [-.12, .45 * snap(Math.sin(t * 1.9 + 1), 8), .15 * snap(Math.sin(t * 3.1), 6)],
      hL: [.34, 1.18 + .08 * Math.sin(t * f * 2), .3], hR: [-.34, 1.12 + .05 * Math.sin(t * f * 2 + 1), .25], b: [.1 * Math.sin(t * 4), 1, .1],
      fL: [.17, .06 + .08 * Math.max(0, Math.sin(t * f * 2)), .08], fR: [-.17, .06 + .08 * Math.max(0, -Math.sin(t * f * 2)), -.06]
    });
    const lo = P(N, { y: .95, c: [.32 + .03 * Math.sin(t), 0, .04 * Math.sin(t * .6)], n: [.28, .1 * Math.sin(t * .4), 0], hL: [.26, .82, .1], hR: [-.3, .95, .12], b: [0, 1, .08], fL: [.12, .06, 0], fR: [-.12, .06, 0] });
    return mix(lo, hi, m);
  },
  run: t => {
    const m = curM, ph = t * (7 + 5 * m), r = runBase(ph, .35 + .4 * m, .15 + .25 * m);
    return P(N, { y: .93 - .06 * Math.abs(r.c), h: [0, .2 * r.s, 0], c: [.15 + .35 * m, -.15 * r.s, 0], n: [-.1 - .3 * m, .1 * r.s, 0], fL: r.fL, fR: r.fR,
      hL: [.3, 1.05 + .2 * m * Math.max(0, r.s), -.1 + .45 * m * r.s], hR: [-.32, 1.1, .1 - .3 * m * r.s], b: [0, .8, .5] });
  },
  cast: { dur: 900, keys: () => {
    const I = ANIM.blitz.idle(0);
    const pull = P(I, { y: .88, c: [-.05, .45, 0], hL: [.42, 1.45, -.3], n: [-.1, -.2, 0] });
    const zap = P(I, { y: .86, c: [.3, -.4, 0], n: [-.15, .3, 0], hL: [.12, 1.42, .75], fL: [.2, .06, .35], fR: [-.15, .06, -.25] });
    return [[0, I], [.25, pull, 'out'], [.35, zap, 'out'], [.65, zap], [1, I]];
  } },
  chan: t => P(N, { y: .86 + .01 * Math.sin(t * 40), c: [.25, 0, .02 * Math.sin(t * 37)], n: [-.2, 0, 0], hL: [.15, 1.32, .62], hR: [-.15, 1.3, .6], b: [0, .3, 1], fL: [.24, .06, .25], fR: [-.24, .06, -.2] }),
  // Aufladen: Hand in den Himmel, nach 3 s schlägt ein Blitz ein
  sit: t => {
    const k = t % 4.4;
    const up = P(N, { y: .88, h: [0, -.1, 0], c: [-.15, -.1, .05], n: [-.6, 0, 0], hR: [-.12, 2.2, .05], b: [0, 1, 0], hL: [.4, .95, .15], fL: [.28, .06, .1], fR: [-.28, .06, -.08] });
    const jolt = P(up, { y: .78, c: [.1, -.1, 0], n: [-.3, 0, 0], hL: [.7, 1.6, .1] });
    const w = clamp(k / .5, 0, 1), vib = .012 * clamp(k / 3, 0, 1) * Math.sin(t * 60);
    let p = mix(ANIM.blitz.idle(t), up, inOut(w));
    if (k > 3) p = mix(jolt, up, clamp((k - 3.15) / .8, 0, 1));
    p.c[2] += vib; p.hR[0] += vib;
    return p;
  }
};
// ── Seuche: klebt, zerrinnt, Füße kleben bei jedem Schritt fest
ANIM.plague = {
  idle: t => {
    const buck = bump(t % 5.5, 3.6, 4.6, .4);
    return P(N, { y: .9 - .04 * (.5 + .5 * Math.sin(t * .8)) - .1 * buck, h: [0, 0, .04 * Math.sin(t * .7)], c: [.38 + .05 * Math.sin(t * .9), .1 * Math.sin(t * .5), .08 * Math.sin(t * .7)],
      n: [.35 + .12 * Math.sin(t * .9), .25 * Math.sin(t * .5), .28 * Math.sin(t * .6)], hL: [.3, .72 + .03 * Math.sin(t * 1.1), .16], hR: [-.3, .85, .2], b: [-.15, 1, .15],
      fL: [.15, .06, .02], fR: [-.15, .06, -.02] });
  },
  run: t => {
    const ph = t * 5, s = Math.sin(ph), c = Math.cos(ph), A = .32;
    // Schwungbein: hebt erst zäh ab (Faden), dann schnell
    const leg = (s, c, x) => {
      if (c > 0) { const u = (Math.atan2(s, c) + Math.PI / 2) / Math.PI;   // 0 … 1 über die Schwungphase
        return [x, .06 + .24 * Math.sin(Math.PI * u) * clamp((u - .12) / .25, 0, 1), A * s]; }
      return [x, .06, A * s];
    };
    return P(N, { y: .88 - .05 * Math.abs(c), h: [0, .12 * s, .1 * s], c: [.42, -.08 * s, .1 * s], n: [.25 + .1 * Math.sin(ph * 2 + .7), .15 * s, .15 * Math.sin(ph + .9)],
      hL: [.3, .78, .1 - .12 * s], hR: [-.3, .85, .15 + .1 * s], b: [-.1, .9, .4], fL: leg(s, c, .13), fR: leg(-s, -c, -.13) });
  },
  cast: { dur: 1200, keys: () => {
    const I = ANIM.plague.idle(0);
    const wind = P(I, { y: .92, c: [.05, .5, 0], hL: [.45, 1.6, -.3], n: [-.1, -.2, 0] });
    const fling = P(I, { y: .82, c: [.55, -.45, 0], n: [.1, .3, 0], hL: [.1, 1.1, .75], fL: [.18, .06, .35] });
    return [[0, I], [.35, wind, 'io'], [.5, fling, 'out'], [.75, fling], [1, I]];
  }, fling: .5 },
  chan: t => P(N, { y: .86, c: [.3, 0, .04 * Math.sin(t * 2)], n: [.1, 0, 0], hL: [.16, 1.2, .6], hR: [-.16, 1.2, .58], b: [0, .4, 1], fL: [.2, .06, .2], fR: [-.2, .06, -.15] }),
  sit: t => {
    const s = sip(t, 3.4, .4);
    return P(N, { ...STAFF_DOWN, y: .24, h: [-.08, 0, .06], c: [.4 - .45 * s, 0, .1], n: [.35 - .7 * s, .2, .2], fL: [.3, .06, .62], fR: [-.32, .06, .55],
      hR: [-.34, .3, .25], hL: [lerp(.3, .04, s), lerp(.55, 1.0, s), lerp(.4, .2, s)], pd: [0, lerp(1, -.4, s), lerp(0, -.9, s)], ps: 1 });
  }
};
ANIM.qm = ANIM.base;   // ?-Magier: Basis-Bewegungen, beim Trinken die des gewürfelten Getränks (anim.drinkSkin)
// Tod gibt es im Viewer nicht
const DEAD = P(N, { y: .2, h: [-1.45, 0, 0], c: [-.05, .1, 0], n: [-.1, .3, 0], hL: [.62, .12, -.55], hR: [-.6, .12, -.3], b: [-.2, .05, 1], fL: [.3, .06, .9], fR: [-.28, .06, .96], sf: 0 });
const airOf = (A, t) => P(A.run(0.3), { fL: [.16, .36, .18], fR: [-.16, .26, -.2] });


// Partikel pro Sekunde: Rauch beim Überhitzen, Reif bei Kälte // PH
const STAGE_FX = { smoke: 25, frost: 30 };
const rate = x => Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);   // Bruchteile über die Frames verteilt

export function buildStrichMagier(gameSkin = 'alle') {
  const skin = SKIN_OF[gameSkin] ?? 'base', A = ANIM[skin];
  const S = SKINS[skin];
  const U = { uTime: { value: 0 }, uM: { value: 0 }, uK: { value: 0 }, uLvl: { value: 0 } };   // pro Figur
  const F: any = { skin, S, bones: [], parts: [], glow: [], t: 0, last: null, blendFrom: null, blendT: 0, freeze: 0, m: 0, props: {}, groundY: 0, groundPos: V() };
  F.root = new THREE.Group();
  const world = new THREE.Group();   // Effekte in Weltkoordinaten
  const B = (p, x = 0, y = 0, z = 0) => { const b = new THREE.Bone(); b.position.set(x, y, z); p.add(b); F.bones.push(b); return b; };
  const M = (pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl));
  const part = (bone, geo, color, pos?, rot?, scl?) => F.parts.push({ bone, geo, color, m: M(pos, rot, scl) });
  const glow = (bone, geo, color, pos?, rot?, scl?) => F.glow.push({ bone, geo, color, m: M(pos, rot, scl) });

  const hips = F.hips = B(F.root, 0, 1, 0);
  part(hips, new THREE.SphereGeometry(.14, 7, 4), S.ink, [0, 0, 0], [0, 0, 0], [1.25, .8, .9]);
  const chest = F.chest = B(hips, 0, .05, 0);
  part(chest, new THREE.LatheGeometry([[0, -.04], [.1, -.02], [.11, .1], [.15, .33], [.18, .47], [.15, .56], [.08, .61], [0, .62]]
    .map(([a, b]) => new THREE.Vector2(a, b)), 8), S.ink, [0, 0, 0], [0, Math.PI / 8, 0], [1.1, 1, .64]);
  part(chest, new THREE.TorusGeometry(.13, .04, 3, 10), S.accent, [0, .56, 0], [Math.PI / 2, 0, 0], [1, 1, .8]);   // Kragen-Schal
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
  F.burnBones = [F.chest, F.chest, head, hips, F.armL.ua, F.armR.ua, F.armL.fa, F.armR.fa, F.legL.th, F.legR.th, F.legL.sh, F.legR.sh];
  const staff = F.staff = B(F.root);
  // Der eingebaute Stab des Viewers weicht den Waffen: nur das Gelenk bleibt, models/mage.ts hängt die Waffe daran
  F.crystal = new THREE.Object3D(); F.crystal.position.set(0, .79, 0); staff.add(F.crystal);

  if (skin === 'base') {
    // 90er-Zuhälter-Look: pinker Pelzmantel, weißer Fedora, dicke Goldkette
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
  if (skin === 'fire') part(head, new THREE.IcosahedronGeometry(.185, 1), S.ink, [0, .14, 0], [0, 0, 0], [.9, .7, .95]);   // verkohlter Kiefer
  if (skin === 'ice') F.ice = makeIcicles(F);
  if (skin === 'arcane') { glow(head, new THREE.OctahedronGeometry(.035, 0), S.orb, [0, .2, .17], [0, 0, 0], [1, 1.5, .5]); F.runeParts = bodyRunes(F); }   // drittes Auge
  if (skin === 'blitz') for (let i = 0; i < 7; i++) { const a = (i / 7 - .5) * 2.4; part(head, new THREE.ConeGeometry(.04, .17, 4), S.ink, [Math.sin(a) * .12, .3 - Math.abs(a) * .03, Math.cos(a) * .05 - .06], [-.5 + Math.abs(a) * .1, 0, -a * .55]); }   // Haar-Zacken
  if (skin === 'plague') {
    // Kapuzen-Klumpen und hängende Fäden: zerläuft nach unten
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; part(head, new THREE.ConeGeometry(.035, .14, 5), S.ink, [Math.sin(a) * .12, .02, Math.cos(a) * .1], [Math.PI, 0, 0]); }
    for (const a of [F.armL, F.armR]) part(a.hand, new THREE.ConeGeometry(.04, .16, 5), S.ink, [0, -.06, 0], [Math.PI, 0, 0]);
    part(chest, new THREE.ConeGeometry(.12, .2, 7), S.ink, [0, -.06, 0], [Math.PI, 0, 0], [1.2, 1, .8]);
  }
  if (skin === 'qm') {
    // Gelbe und weiße Fragezeichen auf Brust, Rücken, Hüfte, Armen, Beinen und Kopf, 3 schwebende über dem Kopf
    const Y = col(0xffd23a), W = col(0xf4efe4);
    const deco: any[] = [[chest, [0, .32, .15], .1, Y], [chest, [-.1, .18, .14], .06, W], [chest, [.11, .45, .12], .05, W], [chest, [0, .32, -.15], .1, Y], [chest, [.08, .12, -.14], .06, W],
      [hips, [.1, -.02, .12], .06, W], [hips, [-.09, -.05, -.12], .06, Y], [F.armL.ua, [0, -.12, .06], .05, Y], [F.armR.ua, [0, -.14, .06], .05, W], [F.armL.fa, [0, -.1, .05], .045, W], [F.armR.fa, [0, -.1, .05], .045, Y],
      [F.legL.th, [0, -.2, .08], .055, W], [F.legR.th, [0, -.15, .08], .055, Y], [head, [0, .2, .17], .05, Y]];
    for (const [b, p, sc, c] of deco) part(b, qGeo(), c, p, [0, 0, 0], [sc * 1.5, sc * 1.5, sc * .7]);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; glow(head, qGeo(), Y, [Math.sin(a) * .36, .52 + .06 * i, Math.cos(a) * .36], [0, a, 0], [.14, .14, .07]); }
  }
  // Trink-Requisiten: je ein Bone, der ?-Magier hat alle 4 Getränke (anim.drinkSkin wählt)
  for (const k of skin === 'qm' ? ['base', 'fire', 'ice', 'arcane'] : [skin]) {
    const pg = propGeo(k);
    if (!pg) continue;
    const bone = F.props[k] = B(F.root);
    F.parts.push({ bone, m: new THREE.Matrix4(), raw: mw => pg.clone().applyMatrix4(mw), prop: true });
  }
  F.prop = F.props[skin === 'qm' ? 'base' : skin] ?? null;

  F.root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(F.bones);
  const build = (list, mat, extra?) => {
    const geo = mergeGeometries(list.map(p => {
      const mw = p.bone.matrixWorld.clone().multiply(p.m);
      const g = p.raw ? p.raw(mw) : prep(p.geo, p.color, mw, p.flick);
      if (extra) extra(p, g, mw);
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
  F.mat.onBeforeCompile = bodyHook(U);
  F.mat.customProgramCacheKey = () => 'strichBody';
  if (skin === 'plague') plagueShader(F.mat, U);
  // alles in einem Mesh: Körper + Glühen + Eiszapfen + Requisite → 1 Draw Call
  F.body = build([...F.parts, ...F.glow.map(g => ({ ...g, glow: 1 })), ...(F.ice || [])], F.mat, (p, g, mw) => {
    const n = g.attributes.position.count, b = V().applyMatrix4(mw), base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) base.set([b.x, b.y, b.z], i * 3);
    g.setAttribute('icB', new THREE.BufferAttribute(base, 3));
    g.setAttribute('icT', new THREE.BufferAttribute(new Float32Array(n).fill(p.prop ? -2 : p.t ?? -1), 1));
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(p.glow || 0), 1));
  });
  F.body.customDepthMaterial = depthMat(U);
  if (F.runeParts) F.runeMesh = build(F.runeParts, runeMat(U));
  if (skin === 'ice') F.iceShell = makeIceShell(F, U);
  if (skin === 'fire') { F.flames = makeFlames(F, U); world.add(F.flames); F.shell = makeFireShell(F, U); }
  if (skin === 'arcane') { F.orbs = makeChargeOrbs(); world.add(F.orbs); }
  if (skin === 'blitz') { F.bolts = makeBolts(); world.add(F.bolts.mesh); }
  if (skin === 'plague') { F.goo = makeGoo(F); world.add(F.goo.drops, F.goo.strands); }

  // Partikel in Weltkoordinaten
  const PN = 400, pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PN * 3).fill(-1000), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pG = new Float32Array(PN);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .06, vertexColors: true })); pts.frustumCulled = false;
  world.add(pts);
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
  let loco = 'idle', mode = 'idle', castT = -1, castKeys = null, runT = 0, wasCast = false, chargeT = -1;
  const _o = new THREE.Object3D(), _om = new THREE.Matrix4();
  return {
    root: F.root,
    anchors: { crystal: F.crystal, handL: F.armL.hand, handR: F.armR.hand },
    trail,
    scarf: world,                                 // liegt in Weltkoordinaten, models/mage.ts legt es in die Szene
    fx: SKIN_FX[gameSkin] || SKIN_FX.alle,
    get tris() { return Math.round(F.body.geometry.attributes.position.count / 3); },
    // Anzeige der Figur 0 … 1: Hitze, Kälte, Ladungen/4, Batterie
    setMeter(v) { F.m = clamp(v || 0, 0, 1); },
    get meter() { return F.m; },
    update(dt, anim: any = {}) {
      const s = Math.min(.1, dt > 1 ? dt / 1000 : dt);
      if (trail) trail.update(s);
      if (anim.frozen) return;
      U.uTime.value += s;
      F.t += s;
      loco = anim.state || 'idle';
      F.dead = loco === 'dead';
      const moving = loco === 'run' || loco === 'back';
      const charging = skin === 'blitz' && !!anim.charge && !moving;
      // Zaubern: startet, sobald anim.cast steigt. Im Laufen läuft die Laufpose weiter, die Bewegung wird nie gesperrt.
      const casting = (anim.cast || 0) > 0;
      if (casting && !wasCast && !moving) { castT = 0; castKeys = A.cast.keys(); }
      wasCast = casting;
      if (moving || loco === 'sit' || loco === 'dead' || loco === 'air' || charging) castT = -1;
      let castU = -1;
      const dur = A.cast.dur;
      if (castT >= 0) {
        castU = castT / Math.min(dur, CAST_MS);
        if (!(castU >= CAST_HOLD && casting)) castT += s * 1000;
        if (castU >= 1) { castT = -1; castU = -1; F.blendFrom = F.last; F.blendT = .2; }
      }
      const next = loco === 'sit' ? 'sit' : loco === 'dead' ? 'dead' : loco === 'air' ? 'air' : moving ? 'run' : charging ? 'charge' : anim.channel ? 'chan' : castU >= 0 ? 'cast' : 'idle';
      if (next !== mode) { F.blendFrom = F.last; F.blendT = .25; mode = next; if (mode === 'charge') chargeT = 0; }
      if (moving) runT += s * (anim.speed || 7) / 7 * (loco === 'back' ? -1 : 1);
      curM = skin === 'blitz' ? F.m : .5;
      let p;
      if (mode === 'cast') p = kf(castKeys, castU);
      else if (mode === 'run') p = A.run(runT);
      else if (mode === 'chan') p = A.chan(F.t);
      else if (mode === 'charge') { chargeT += s; p = A.sit(chargeT); }
      else if (mode === 'sit') {
        const drinkA = skin === 'qm' && ANIM[anim.drinkSkin] ? ANIM[anim.drinkSkin] : A;
        if (skin === 'qm') F.prop = F.props[anim.drinkSkin] ?? F.props.base;
        p = drinkA.sit ? drinkA.sit(F.t) : ANIM.base.sit(F.t);
      }
      else if (mode === 'dead') p = cp(DEAD);
      else if (mode === 'air') p = airOf(A, F.t);
      else p = A.idle(F.t);
      if (anim.squat) p.y -= anim.squat * .15;
      if (F.blendT > 0 && F.blendFrom) { F.blendT -= s; p = mix(F.blendFrom, p, 1 - clamp(F.blendT / .25, 0, 1)); }
      F.last = p;

      // Schweben: die Füße bleiben im Pose-Raum, die ganze Figur hebt sich (im Tod nicht)
      if (fl && mode !== 'dead') F.root.position.y += fl + .07 * Math.sin(F.t * 1.3);
      applyPose(F, p);
      F.root.getWorldPosition(F.groundPos); F.groundY = F.groundPos.y - (fl && mode !== 'dead' ? fl + .07 * Math.sin(F.t * 1.3) : 0);

      // Stufen-Effekte nach der Anzeige m
      const m = F.dead ? 0 : F.m;
      if (F.flames) {
        updateFlames(F, m, F.t);
        U.uK.value = clamp((m - .5) / .5, 0, 1); F.shell.visible = m > .5;
        F.mat.emissive.setRGB(.5 * Math.max(0, m - .6), .12 * Math.max(0, m - .6), 0);
        if ((m >= .98 || anim.smoke) && !F.dead) { const n = rate(STAGE_FX.smoke * s); for (let i = 0; i < n; i++) emit(F.chest.getWorldPosition(V()).add(V(0, .7, 0)), 1, V(rnd(-.2, .2), 1.2, rnd(-.2, .2)), Math.random() < .5 ? 0x3a3330 : 0x5a504a, -.3, 1.4, .4); }
        if (Math.random() < s * 14 && !F.dead) emit(F.head.getWorldPosition(V()).add(V(0, .4, 0)), 1, V(0, 1.4, 0), Math.random() < .5 ? 0xff7a1a : 0xffd04a, -.5, .7, .2);
      }
      if (skin === 'ice') {
        U.uM.value = m;
        const fr = A.cast.freeze;
        let target = mode === 'chan' ? .35 : 0;
        if (castU > fr[0] && castU < fr[1]) target = 1;
        F.freeze = lerp(F.freeze, target, Math.min(1, s * (target > F.freeze ? 10 : 4)));
        F.mat.emissive.setRGB(.35 * F.freeze, .55 * F.freeze, .7 * F.freeze);
        if (castU > fr[1] && castU < fr[1] + .05) emit(F.chest.getWorldPosition(V()).add(V(0, .3, 0)), 25, V(0, 1, 0), 0xdff6ff, 4, .6, .6);
        if (F.freeze > .5 && Math.random() < s * 30) emit(F.chest.getWorldPosition(V()).add(V(0, .2, .1)), 1, V(0, .3, 0), 0xe8f8ff, -.2, .9, .8);
        if (m > .5) { const n = rate(STAGE_FX.frost * (m - .5) * s); for (let i = 0; i < n; i++) emit(pickBone(F).getWorldPosition(V()), 1, V(0, -.2, 0), Math.random() < .5 ? 0xe8f8ff : 0x9fd8ff, .4, .9, .18); }
        if (mode === 'idle' && (F.t % 2.6) < s) emit(F.head.getWorldPosition(V()).add(V(0, .12, .2)), 10, V(0, .15, .5), 0xffffff, -.1, 1, .08);
      }
      if (F.runeMesh) {
        U.uLvl.value = Math.floor(m * 4 + 1e-6) / 4;
        const g = m >= .999 ? .1 + .04 * Math.sin(F.t * 8) : 0; F.mat.emissive.setRGB(g * .8, g * .3, g);   // Körper glüht nur bei 4 Ladungen
        // Ladungs-Kugeln über dem Kopf
        const n = Math.round(m * 4), h = F.head.getWorldPosition(V());
        F.orbs.visible = n > 0 && !F.dead;
        if (F.orbs.visible) {
          for (let i = 0; i < 4; i++) {
            const a = F.t * 1.5 + i / 4 * TAU;
            _o.position.set(h.x + Math.cos(a) * .42, h.y + .55 + .04 * Math.sin(F.t * 3 + i), h.z + Math.sin(a) * .42); _o.scale.setScalar(i < n ? .09 : .035); _o.updateMatrix();
            F.orbs.setMatrixAt(i, _om.copy(_o.matrix));
          }
          F.orbs.instanceMatrix.needsUpdate = true;
        }
      }
      if (F.bolts) {
        const mm = mode === 'chan' ? Math.max(m, .6) : anim.over ? 1 : m;
        if (mode === 'charge') {   // Aufladen: nach 3 s schlägt ein Blitz aus dem Himmel in die Hand
          const k = chargeT % 4.4;
          if (k >= 3 && k - s < 3) {
            const hp = F.armR.hand.getWorldPosition(V());
            bolt(F.bolts, hp.clone().add(V(rnd(-1.5, 1.5), 12, rnd(-1, 1))), hp, .3, 3.5); bolt(F.bolts, hp.clone().add(V(rnd(-1, 1), 9, 0)), hp, .2, 2.2);
            emit(hp, 40, V(0, 0, 0), 0x8ff1ff, 3, .6, .2);
          }
        }
        updateBolts(F, mm, s);
        const k = m * m, f = m >= .98 ? .08 * Math.random() : 0; F.mat.emissive.setRGB(.12 * k + f, .42 * k + f, .75 * k + f);
      }
      if (F.goo) {
        F.melt = F.root.scale.y < .9 ? 1 + (1 - F.root.scale.y) : 1;   // Zerfließen (main.ts skaliert die Figur): Pfütze wächst
        F.goo.rate = mode === 'chan' ? 5 : mode === 'cast' ? 2 : 1;
        if (mode === 'cast' && castU >= A.cast.fling && castU - s * 1000 / Math.min(A.cast.dur, CAST_MS) < A.cast.fling) {
          const hp = F.armL.hand.getWorldPosition(V()), fw = V(0, 0, 1).transformDirection(F.root.matrixWorld);
          F.goo.st.filter(d => d.ph === 'wait').slice(0, 8).forEach(d => { d.ph = 'fall'; d.p.copy(hp); d.v.copy(fw).multiplyScalar(rnd(3, 6)).add(V(rnd(-1, 1), rnd(1, 3), rnd(-1, 1))); });
        }
        updateGoo(F, s, F.t);
        // Füße kleben: Faden vom Boden-Klebepunkt zum Fuß, solange der Fuß in der ersten Schwungphase ist
        [F.legL, F.legR].forEach((l, si) => {
          const fp = l.ft.getWorldPosition(V()), G = F.goo;
          if (mode === 'run' && fp.y > F.groundY + .075) { if (G.stick[si] == null) G.stick[si] = fp.clone().setY(F.groundY + .02); }
          else G.stick[si] = null;
          const a = G.stick[si];
          if (a && fp.distanceTo(a) > .32) { const d = G.st.find(x => x.ph === 'wait'); if (d) Object.assign(d, { ph: 'splat', t: 1.5, p: a.clone() }); G.stick[si] = false; }
          setStrand(G, si, G.stick[si] || null, fp, .018);
        });
      }
      updateParts(s);
      if (trail && moving) { F.root.updateMatrixWorld(true); watch((x, y, z, a, side) => trail.add(x, y, z, a, side)); }
    },
  };
}
const pickBone = F => F.burnBones[Math.floor(Math.random() * F.burnBones.length)];
