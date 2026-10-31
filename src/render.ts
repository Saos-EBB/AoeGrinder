import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PERF } from './config';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, PERF.maxPixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
const fog = scene.fog = new THREE.Fog(0xffffff, 45, 185);

export const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 700);

// Hauptlicht und Fülllicht, Werte kommen aus der Zone (setEnv)
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
scene.add(sun);

// Bloom: nur sehr helle Farben (Zauber-Partikel, Kristall) leuchten
export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.4, 1.5);
if (PERF.bloom) composer.addPass(bloom);
// Vignette + leichte Farbtönung (warme Lichter, kühle Schatten)
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c *= mix(vec3(0.92, 0.97, 1.08), vec3(1.06, 1.0, 0.92), clamp(lum, 0.0, 1.0));
      float v = smoothstep(0.95, 0.35, distance(vUv, vec2(0.5)));
      gl_FragColor = vec4(c * mix(0.62, 1.0, v), 1.0);
    }`,
}));
composer.addPass(new OutputPass());

// Himmel als Farbverlauf-Kuppel
const skyUniforms = {
  top: { value: new THREE.Color() }, mid: { value: new THREE.Color() },
  horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunAmt: { value: 1 },
};
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(500, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: skyUniforms,
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform float sunAmt; varying vec3 vPos;
      void main() {
        vec3 d = normalize(vPos);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, top, smoothstep(0.25, 0.9, h));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.6, 0.3) * pow(s, 8.0) * 0.45 * sunAmt;      // Sonnenhof
        col += vec3(3.0, 2.2, 1.3) * pow(s, 900.0) * sunAmt;            // Sonnenscheibe (blüht)
        gl_FragColor = vec4(col, 1.0);
      }`,
  })));

export function setEnv(e) {
  fog.color.set(e.fog); fog.near = e.fogNear; fog.far = e.fogFar;
  hemi.color.set(e.sky); hemi.groundColor.set(e.ground); hemi.intensity = e.hemi;
  sun.color.set(e.sun); sun.intensity = e.sunPower; sun.position.set(...(e.sunPos as [number, number, number]));
  skyUniforms.top.value.set(e.top); skyUniforms.mid.value.set(e.mid); skyUniforms.horizon.value.set(e.fog);
  skyUniforms.sunDir.value.copy(sun.position).normalize(); skyUniforms.sunAmt.value = e.sunDisc;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
