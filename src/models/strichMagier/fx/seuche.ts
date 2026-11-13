// ───────────────────────── Seuche: Tropfen, Fliegen und Pfütze in einem InstancedMesh, Schleimfäden an den Füßen in einem zweiten

import * as THREE from 'three';
import { clamp, V, rand as rnd } from '../../../util';
import { grad } from '../../strichKit';
import { col, UP } from '../shared';

const GOO = { drops: 40, flies: 10, pud: 50 };
export function makeGoo(F) {
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
export function updateGoo(F, dt, t) {
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
export function setStrand(G, i, a, b, r) {
  const d = a ? b.clone().sub(a) : null, L = d ? d.length() : 0;
  if (a && L >= .02) _gm.compose(a, _gq.setFromUnitVectors(UP, d.normalize()), _gs.set(r, L, r)); else _gm.makeScale(0, 0, 0);
  G.strands.setMatrixAt(i, _gm); G.strands.instanceMatrix.needsUpdate = true; _gq.identity();
}
// Seuche-Shader: Grün-Lila-Muster, das ständig verschwimmt und nach unten läuft; Körper wabert leicht
export function plagueShader(mat, U) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.vertexShader = 'attribute float aGear; varying vec3 vP; varying float vGear;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `vec3 transformed = position + normal * .012 * sin(uTime * 3. + position.y * 14. + position.x * 9.);
       transformed.y -= .012 * (.5 + .5 * sin(uTime * 1.7 + position.x * 11. + position.z * 7.));
       vP = position; vGear = aGear;`);
    sh.fragmentShader = `uniform float uTime; varying vec3 vP; varying float vGear;
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
       vec4 diffuseColor = vec4(mix(c * diffuse * .6, diffuse, vGear), opacity);`);   // .6: die Lampe über der Figur hellt sonst zu Pastell auf // PH
  };
  mat.customProgramCacheKey = () => 'plagueBody';
}
