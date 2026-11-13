// ───────────────────────── Eis: rund 90 Zapfen wachsen nach Kälte nacheinander heraus (Schwelle t), am Ende ganz bedeckt

import * as THREE from 'three';
import { V } from '../../../util';
import { grad } from '../../strichKit';
import { col, seedRnd, srnd, TAU, UP } from '../shared';
import { LAMP_COMP } from '../palette';
import { shellNoProp } from '../shader';

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
// Splitterkönig (Skin frost14): Eis in Babyblau getönt statt Weiß, sonst brennt es unter der Lampe auf dem hellen Anzug aus // PH
export const ICE_TINT = { base: col(0x9fd2ff).multiply(LAMP_COMP), tip: col(0x4f9fff).multiply(LAMP_COMP), shell: col(0x8cc8ff).multiply(LAMP_COMP), emissive: [.01, .04, .12] };
export function makeIcicles(F, tint = false) {
  seedRnd(11);
  const L = [], C = tint ? { base: ICE_TINT.base, tip: ICE_TINT.tip } : { base: col(0xeefaff).multiplyScalar(.36), tip: col(0x7fc8ff).multiplyScalar(.36) };   // dunkler als im Viewer: die Lampe über der Figur hebt Weiß sonst über die Bloom-Schwelle // PH
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
export function makeIceShell(F, U, tint = false) {
  const mat = new THREE.MeshToonMaterial({ color: tint ? ICE_TINT.shell : new THREE.Color(0xdff6ff).multiplyScalar(.36), gradientMap: grad, emissive: tint ? 0x04101e : 0x0c161c, transparent: true, opacity: .72, depthWrite: false });   // dunkler als im Viewer, siehe Zapfen // PH
  const ICE_A = tint ? 'vec3(.55, .78, 1.)' : 'vec3(.78, .93, 1.)', ICE_B = tint ? 'vec3(.75, .9, 1.)' : 'vec3(1.)';   // Facetten-Farben der Hülle (getönt: kein Weiß)
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
        vec3 c = mix(${ICE_A}, ${ICE_B}, facet * .7);
        vec4 diffuseColor = vec4(c * diffuse, opacity * (.6 + .4 * facet));`);
    shellNoProp(sh);
  };
  const m = new THREE.SkinnedMesh(F.body.geometry, mat); m.frustumCulled = false; F.root.add(m); m.bind(F.body.skeleton, F.body.bindMatrix);
  return m;
}
