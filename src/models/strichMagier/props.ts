// ───────────────────────── Requisiten zum Trinken: Griffpunkt im Ursprung, Öffnung nach +y, als Geometrie für das Körper-Mesh

import * as THREE from 'three';
import { V } from '../../util';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { col, prep, TAU } from './shared';

export function propGeo(skin) {
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
export const qGeo = () => mergeGeometries([
  new THREE.TorusGeometry(.5, .14, 4, 10, Math.PI * 1.45).rotateZ(-Math.PI * .45).translate(0, .55, 0),
  new THREE.CylinderGeometry(.13, .13, .4, 5).translate(0, -.12, 0),
  new THREE.IcosahedronGeometry(.17, 0).translate(0, -.55, 0)
].map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
