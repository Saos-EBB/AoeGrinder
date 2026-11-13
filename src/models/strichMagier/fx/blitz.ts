// ───────────────────────── Blitz: Zickzack-Bänder zur Kamera, Glow und Kern in einem Mesh

import * as THREE from 'three';
import { V, rand as rnd, jag } from '../../../util';
import { col } from '../shared';

export function makeBolts() {
  const MAX = 900, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 12 * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 12 * 4), 4));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  const B = { mesh: m, list: [], MAX, camDir: V(0, 0, -1) };
  m.onBeforeRender = (_r, _s, cam) => cam.getWorldDirection(B.camDir);   // Bänder zeigen zur Kamera (ein Bild Verzug)
  return B;
}
export function bolt(B, a, b, life = rnd(.05, .12), w = 1, branch = true) {
  const pts = jag(a, b);
  B.list.push({ pts, life, w });
  if (branch && Math.random() < .6) { const k = pts[Math.floor(rnd(.3, .7) * pts.length)]; bolt(B, k, k.clone().add(V(rnd(-1, 1), rnd(-.8, .4), rnd(-1, 1)).multiplyScalar(a.distanceTo(b) * .5)), life, w * .6, false); }
}
const _sd = V(), _bd = V();
const GLOW_C = [...col(0x3d7bff).toArray(), .22], CORE_C = [...col(0x9ff3ff).toArray(), 1];
export function updateBolts(F, m, dt) {
  const B = F.bolts;
  for (const x of B.list) x.life -= dt;
  B.list = B.list.filter(x => x.life > 0);
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
