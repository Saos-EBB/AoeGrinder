// ───────────────────────── Feuer: Anime-Flammen als Billboards. Wo und wie groß sie brennen, zeigt die Hitze

import * as THREE from 'three';
import { clamp, lerpTo as lerp, V } from '../../../util';
import { shellNoProp } from '../shader';

const FLAME_SPOTS = F => [
  [F.armL.hand, [0, 0, 0], .22, 0], [F.armR.hand, [0, 0, 0], .22, 0], [F.head, [0, .28, 0], .38, 0], [F.staff, [0, .82, 0], .3, 0],
  [F.head, [.09, .24, -.02], .26, .25], [F.head, [-.09, .24, -.02], .26, .25], [F.armL.ua, [0, .04, 0], .26, .3], [F.armR.ua, [0, .04, 0], .26, .3],
  [F.chest, [0, .48, -.1], .38, .5], [F.chest, [.1, .3, -.12], .3, .55], [F.chest, [-.1, .3, -.12], .3, .55], [F.armL.fa, [0, 0, 0], .2, .55], [F.armR.fa, [0, 0, 0], .2, .55],
  [F.head, [0, .3, .06], .45, .7], [F.hips, [0, 0, -.12], .3, .75], [F.legL.sh, [0, 0, .05], .22, .8], [F.legR.sh, [0, 0, .05], .22, .8],
  [F.chest, [0, .3, .12], .32, .9], [F.legL.ft, [0, 0, .06], .2, .92], [F.legR.ft, [0, 0, .06], .2, .92], [F.chest, [.16, .15, 0], .3, .97], [F.chest, [-.16, .15, 0], .3, .97],
  [F.legL.th, [0, -.2, .07], .26, .97], [F.legR.th, [0, -.2, .07], .26, .97]
];
export function makeFlames(F, U) {
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
export function makeFireShell(F, U) {
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
export function updateFlames(F, m, t) {
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
