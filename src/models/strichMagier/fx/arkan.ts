// ───────────────────────── Arkan: 62 Runen direkt auf dem Körper, 4 Leuchtstufen nach Ladungen

import * as THREE from 'three';
import { lerpTo as lerp, V } from '../../../util';
import { eMat, PAL } from '../../../vfx/energy';
import { seedRnd, srnd, TAU } from '../shared';

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
export function runeMat(U) {
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
export function bodyRunes(F) {
  seedRnd(23);
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
export function makeChargeOrbs() {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), eMat(PAL.arcane, { sc: 9, core: 1, flow: [0, 2, 0] }), 4);
  m.frustumCulled = false; m.visible = false;
  return m;
}
