// Shader-Bausteine der Spell-Optik: Rauschen, Fresnel-Rand, Auflösen, scrollende UVs.
// Rauschen kommt aus einer vorberechneten Textur, das kostet pro Pixel nur einen Zugriff.

import * as THREE from 'three';
import { PERF, VFX_QUALITY } from '../config';

// Uhr aller Effekte. scale ist die Zeitlupe im VFX-Labor.
export const fxClock = { now: 0, last: performance.now(), scale: 1 };
export const vfxOld = () => PERF.vfxOld;
export const quality = () => VFX_QUALITY[PERF.vfx];

// Nahtlos kachelndes Rauschen: pro Oktave ein periodisches Gitter
function bakeNoise(size) {
  const data = new Uint8Array(size * size * 4);
  const octaves = [[4, 0.5], [8, 0.27], [16, 0.15], [32, 0.08]];   // PH: Gitter, Gewicht
  const layers = octaves.map(([cells]) => Float32Array.from({ length: cells * cells }, () => Math.random()));
  const smooth = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    octaves.forEach(([cells, weight], o) => {
      const fx = x / size * cells, fy = y / size * cells, ix = Math.floor(fx), iy = Math.floor(fy);
      const at = (a, b) => layers[o][(a % cells) + (b % cells) * cells];
      const u = smooth(fx - ix), w = smooth(fy - iy);
      v += weight * ((at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - w) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * w);
    });
    const i = (x + y * size) * 4;
    data[i] = data[i + 1] = data[i + 2] = v * 255;
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export const fxUniforms = { uTime: { value: 0 }, uNoise: { value: bakeNoise(256) } };   // PH: Größe

export const GLSL = {
  common: /* glsl */`
    uniform float uTime; uniform sampler2D uNoise;
    float noise2(vec2 p) { return texture2D(uNoise, p).r; }
    vec2 scrollUv(vec2 uv, vec2 speed) { return uv + speed * uTime * 0.001; }
    float fresnel(vec3 n, vec3 v, float power) { return pow(1.0 - abs(dot(normalize(n), normalize(v))), power); }
    // t 0..1: wie weit aufgelöst. Liefert Deckkraft, burn ist der helle Saum an der Kante.
    float dissolve(float n, float t, float edge) { return smoothstep(t * (1.0 + edge) - edge, t * (1.0 + edge), n); }
    float burn(float n, float t, float edge) { float e = t * (1.0 + edge); return smoothstep(e - edge, e, n) * (1.0 - smoothstep(e, e + edge, n)); }
  `,
};

// Material mit gemeinsamer Uhr und Rauschen. additive oder Vormultipliziert (für softScene).
export function fxMaterial({ uniforms = {}, vertexShader, fragmentShader, additive = true, side = THREE.FrontSide as THREE.Side, depthTest = true }: any) {
  return new THREE.ShaderMaterial({
    uniforms: { ...fxUniforms, ...uniforms }, vertexShader, fragmentShader, side, depthTest,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// Weiche Standard-Vertex-Shader: Normalen und Blickrichtung für Fresnel, uv für alles andere
export const FX_VERTEX = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    vUv = uv; vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalMatrix * normal; vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;
