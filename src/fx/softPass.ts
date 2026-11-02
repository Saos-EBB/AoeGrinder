// Soft Particles: Partikel laufen in einen eigenen, kleineren Puffer und blenden dort gegen den Tiefenpuffer der Szene aus.
// Der Puffer kommt danach über das Bild. Das spart auf schwachen Grafikchips viel Füllrate.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { camera, composer } from '../render';
import { quality, vfxOld } from './shaders';

export const softScene = new THREE.Scene();
export const softUniforms = {
  tDepth: { value: null }, uDepthRes: { value: new THREE.Vector2(1, 1) }, uSoft: { value: 1 },
  uNear: { value: camera.near }, uFar: { value: camera.far },
};
export const SOFT_GLSL = /* glsl */`
  #include <packing>
  uniform sampler2D tDepth; uniform vec2 uDepthRes; uniform float uSoft; uniform float uNear; uniform float uFar;
  float softFade(float viewZ) {
    float scene = perspectiveDepthToViewZ(texture2D(tDepth, gl_FragCoord.xy / uDepthRes).x, uNear, uFar);
    return clamp((viewZ - scene) / max(uSoft, 0.01), 0.0, 1.0);
  }`;

// Additiv ins Farbbild, Alpha bleibt für deckende Wolken frei. Vormultiplizierte Stoffe nutzen premultipliedBlend.
export const additiveBlend = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
export const premultipliedBlend = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };

const clearColor = new THREE.Color();

class SoftPass extends Pass {
  rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  quad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { map: { value: this.rt.texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = texture2D(map, vUv); }',
    depthTest: false, depthWrite: false, transparent: true, ...premultipliedBlend,
  }));
  active = () => true;
  constructor() { super(); this.needsSwap = false; }
  render(renderer, _write, read) {
    if (!this.active()) return;
    const res = vfxOld() ? 1 : quality().particleRes, w = Math.max(1, Math.round(read.width * res)), h = Math.max(1, Math.round(read.height * res));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    softUniforms.tDepth.value = read.depthTexture;
    softUniforms.uDepthRes.value.set(w, h);
    softUniforms.uSoft.value = vfxOld() ? 0 : quality().soft;
    softUniforms.uNear.value = camera.near;
    softUniforms.uFar.value = camera.far;
    const autoClear = renderer.autoClear, alpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    renderer.autoClear = false;
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(softScene, camera);
    renderer.setClearColor(clearColor, alpha);
    renderer.setRenderTarget(read);
    this.quad.render(renderer);
    renderer.autoClear = autoClear;
  }
}

export const softPass = new SoftPass();
composer.insertPass(softPass, 1);   // direkt nach dem Szenen-Pass, dort ist die Tiefe frisch
