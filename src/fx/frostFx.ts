// Neue Frost-Optik. Alle Werte PH.

import * as THREE from 'three';
import { rand, perFrame } from '../util';
import { groundAt } from '../collision';
import { scene } from '../render';
import { particles } from './particles';
import { softScene, softUniforms, SOFT_GLSL, premultipliedBlend } from './softPass';
import { fxUniforms, fxMaterial, GLSL, quality } from './shaders';
import { playSound } from './sound';
import { iceTex, FROST_WHITE } from './spellFx';
import { groundDisc } from './prims';
import { blizRadius } from '../formulas';

// ---------- Blizzard: Wolke aus weichen Rausch-Bällen, Splitter mit Schweif, beide im Shader animiert ----------
const MAX_SHARDS = 180, MAX_PUFFS = 22;
const blizU = { uCenter: { value: new THREE.Vector3() }, uRadius: { value: 8 }, uAlpha: { value: 0 } };

const shardGeo = new THREE.InstancedBufferGeometry();
shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
shardGeo.setIndex([0, 1, 2, 2, 1, 3]);
shardGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: MAX_SHARDS * 4 }, (_, i) => (i % 4 === 0 || i % 4 === 1 ? rand(-1, 1) : Math.random())), 4));
const shards = new THREE.Mesh(shardGeo, fxMaterial({ side: THREE.DoubleSide, uniforms: blizU,
  vertexShader: /* glsl */`
    attribute vec4 aSeed; uniform float uTime, uRadius, uAlpha; uniform vec3 uCenter; varying float vK; varying float vX;
    void main() {
      // Gleichmäßig über den Kreis, aus der Wolke schräg nach unten
      vec2 d = aSeed.xy; float l = max(length(d), 0.001); d = d / max(l, 1.0) * sqrt(min(l, 1.0)) * uRadius;
      float speed = 19.0 + aSeed.z * 11.0, top = 11.0;
      float y = top - mod(uTime * 0.001 * speed + aSeed.w * top, top);
      vec3 fall = normalize(vec3(0.28, -1.0, 0.1));
      vec3 head = uCenter + vec3(d.x + (top - y) * 0.28 - 2.0, y, d.y + (top - y) * 0.1);
      vec3 tailDir = -fall * (1.0 + aSeed.z * 1.4);
      vec4 a = viewMatrix * vec4(head, 1.0), b = viewMatrix * vec4(head + tailDir, 1.0);
      vec2 dir = normalize(b.xy - a.xy + vec2(0.00001));
      vec4 p = mix(a, b, position.y);
      p.xy += vec2(-dir.y, dir.x) * position.x * (0.075 * (1.0 - position.y * 0.8));
      vK = (1.0 - position.y) * uAlpha * smoothstep(0.0, 0.6, y) * smoothstep(top, top - 2.0, y);
      vX = position.x;
      gl_Position = projectionMatrix * p;
    }`,
  fragmentShader: `varying float vK; varying float vX;
    void main() { float s = 1.0 - abs(vX); gl_FragColor = vec4(vec3(1.2, 1.8, 2.8) * vK * vK * s * s * 1.4, 1.0); }`,
}));
shards.frustumCulled = false;
shards.visible = false;
scene.add(shards);

const puffGeo = new THREE.InstancedBufferGeometry();
puffGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
puffGeo.setIndex([0, 1, 2, 2, 1, 3]);
puffGeo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(Float32Array.from({ length: MAX_PUFFS * 4 }, (_, i) => {
  const k = Math.floor(i / 4), a = k * 2.39996, r = Math.sqrt((k + 0.5) / MAX_PUFFS);   // Sonnenblumen-Muster: gleichmäßig verteilt
  return [Math.cos(a) * r, Math.sin(a) * r, Math.random(), Math.random()][i % 4];
}), 4));
const puffs = new THREE.Mesh(puffGeo, new THREE.ShaderMaterial({
  uniforms: { ...fxUniforms, ...blizU, ...softUniforms }, transparent: true, depthTest: false, depthWrite: false, ...premultipliedBlend,
  vertexShader: /* glsl */`
    attribute vec4 aPuff; uniform float uTime, uRadius; uniform vec3 uCenter; varying vec2 vQ; varying vec2 vSeed; varying float vViewZ; varying float vUnder;
    void main() {
      float spin = uTime * 0.00012;
      vec2 o = aPuff.xy * uRadius * 0.9, c = vec2(cos(spin), sin(spin));
      vec3 world = uCenter + vec3(o.x * c.x - o.y * c.y, 11.5 + (aPuff.z - 0.5) * 1.6, o.x * c.y + o.y * c.x);
      float size = uRadius * (0.42 + aPuff.w * 0.34);
      vec4 mv = viewMatrix * vec4(world, 1.0);
      mv.xy += position.xy * vec2(size, size * 0.62);
      vQ = position.xy; vSeed = aPuff.zw; vViewZ = mv.z; vUnder = position.y;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`uniform float uTime, uAlpha; uniform sampler2D uNoise; varying vec2 vQ; varying vec2 vSeed; varying float vViewZ; varying float vUnder; ${SOFT_GLSL}
    void main() {
      float r = length(vQ);
      if (r >= 1.0) discard;
      vec2 uv = vQ * 0.22 + vSeed + vec2(uTime * 0.000035, -uTime * 0.00002);
      float n = texture2D(uNoise, uv).r * 0.65 + texture2D(uNoise, uv * 2.3).r * 0.35;
      float dens = smoothstep(0.1, 0.65, n - r * r * 0.55) * (1.0 - r * r);
      float a = dens * uAlpha * 0.8 * softFade(vViewZ);
      vec3 col = mix(vec3(0.34, 0.44, 0.62), vec3(0.08, 0.13, 0.24), smoothstep(-0.6, 0.7, vUnder));   // unten vom Eis erhellt
      col += vec3(0.25, 0.5, 0.9) * pow(n, 3.0) * 0.7;
      gl_FragColor = vec4(col * a, a);
    }`,
}));
puffs.frustumCulled = false;
puffs.visible = false;
softScene.add(puffs);

let blizActive = false, blizMark = null;
function blizMarkMaterial() {
  return fxMaterial({ additive: true, uniforms: { ...blizU, map: { value: iceTex } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `${GLSL.common} uniform float uAlpha; varying vec2 vUv;
      void main() {
        vec2 q = vUv - 0.5; float r = length(q) * 2.0;
        float n = noise2(q * 1.1 + scrollUv(vec2(0.2), vec2(0.05, -0.09)));
        float a = (0.05 + 0.2 * smoothstep(0.35, 0.8, n)) * (1.0 - smoothstep(0.8, 1.0, r)) + (1.0 - smoothstep(0.0, 0.012, abs(r - 0.975))) * 0.28;
        gl_FragColor = vec4(vec3(0.55, 0.95, 1.7) * a * uAlpha, 1.0);
      }` });
}
export function blizStartNew(point, radius) {
  blizU.uCenter.value.copy(point);
  blizU.uRadius.value = radius;
  blizActive = shards.visible = puffs.visible = true;
  playSound('frost', 0.8);
  shardGeo.instanceCount = quality().shards;
  puffGeo.instanceCount = quality().puffs;
  if (blizMark) { scene.remove(blizMark); blizMark.geometry.dispose(); blizMark.material.dispose(); }
  blizMark = groundDisc(point, radius, blizMarkMaterial());
  scene.add(blizMark);
}
export function blizMoveNew(point, radius) {
  blizU.uCenter.value.copy(point);
  if (blizMark) { scene.remove(blizMark); blizMark.geometry.dispose(); blizMark.material.dispose(); }
  blizMark = groundDisc(point, radius, blizMarkMaterial());
  scene.add(blizMark);
}
export function blizStopNew() { blizActive = false; }
export function blizUpdateNew(dt) {
  const u = blizU.uAlpha;
  u.value += ((blizActive ? 1 : 0) - u.value) * Math.min(1, dt / (blizActive ? 350 : 500));   // weich rein und raus
  if (!blizActive && u.value < 0.01) {
    u.value = 0;
    shards.visible = puffs.visible = false;
    if (blizMark) { scene.remove(blizMark); blizMark.geometry.dispose(); blizMark.material.dispose(); blizMark = null; }
    return;
  }
  if (!blizActive) return;
  const c = blizU.uCenter.value, r = blizRadius();
  for (let i = perFrame(38, dt); i > 0; i--) {                // Einschläge am Boden
    const a = rand(0, 6.28), d = r * Math.sqrt(Math.random()), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, y = groundAt(x, z, c.y) + 0.1;
    particles.spawn({ x, y, z, vx: rand(-2, 2), vy: rand(1, 3.2), vz: rand(-2, 2), grav: 7, life: rand(0.2, 0.42), color: FROST_WHITE, size: rand(0.12, 0.26) });
  }
}
