import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PERF } from './config';
import { viewW, viewH } from './device';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, PERF.maxPixelRatio));
renderer.setSize(viewW(), viewH());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.info.autoReset = false;   // der Composer rendert mehrmals pro Frame, gezählt und zurückgesetzt wird in ui/hud.ts
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
const fog = scene.fog = new THREE.Fog(0xffffff, 45, 185);

export const camera = new THREE.PerspectiveCamera(55, viewW() / viewH(), 0.3, 700);

// Hauptlicht und Fülllicht, Werte kommen aus der Zone (setEnv)
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
scene.add(sun);

// Bloom: nur sehr helle Farben (Zauber-Partikel, Kristall) leuchten
// Eigener Puffer mit Tiefentextur: Soft Particles lesen sie (fx/softPass.ts). Der Composer klont sie für den zweiten Puffer.
export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(viewW(), viewH(), {
  type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(viewW(), viewH()) }));
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(viewW(), viewH()), 0.55, 0.4, 1.5);
if (PERF.bloom) composer.addPass(bloom);
// Vignette + leichte Farbtönung (warme Lichter, kühle Schatten)
const post = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, heat: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float heat; uniform float time; varying vec2 vUv;
    void main() {
      // Hitzeflirren, nur in Zonen mit heat > 0, stärker unten im Bild
      vec2 uv = vUv + vec2(sin(vUv.y * 90.0 + time * 3.0) * 0.0016 * heat * smoothstep(0.75, 0.3, vUv.y), 0.0);
      vec3 c = texture2D(tDiffuse, uv).rgb;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c *= mix(vec3(0.92, 0.97, 1.08), vec3(1.06, 1.0, 0.92), clamp(lum, 0.0, 1.0));
      float v = smoothstep(0.95, 0.35, distance(vUv, vec2(0.5)));
      gl_FragColor = vec4(c * mix(0.62, 1.0, v), 1.0);
    }`,
});
const postUniforms = post.uniforms;
composer.addPass(post);
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

// Blendet Nebel und Himmel zur Sturmfarbe, k = 0..1
export function blendFog(e, k, color, near, far) {
  fog.color.set(e.fog).lerp(tmpColor.set(color), k);
  fog.near = e.fogNear + (near - e.fogNear) * k; fog.far = e.fogFar + (far - e.fogFar) * k;
  skyUniforms.horizon.value.copy(fog.color);
  skyUniforms.top.value.set(e.top).lerp(tmpColor, k);
  skyUniforms.mid.value.set(e.mid).lerp(tmpColor, k);
}
const tmpColor = new THREE.Color();

export function tickHeat(t) { postUniforms.time.value = t / 1000; }

export function setEnv(e) {
  postUniforms.heat.value = e.heat ?? 0;
  fog.color.set(e.fog); fog.near = e.fogNear; fog.far = e.fogFar;
  hemi.color.set(e.sky); hemi.groundColor.set(e.ground); hemi.intensity = e.hemi;
  sun.color.set(e.sun); sun.intensity = e.sunPower; sun.position.set(...(e.sunPos as [number, number, number]));
  skyUniforms.top.value.set(e.top); skyUniforms.mid.value.set(e.mid); skyUniforms.horizon.value.set(e.fog);
  skyUniforms.sunDir.value.copy(sun.position).normalize(); skyUniforms.sunAmt.value = e.sunDisc;
}

addEventListener('resize', () => {
  camera.aspect = viewW() / viewH();
  camera.updateProjectionMatrix();
  renderer.setSize(viewW(), viewH());
  composer.setSize(viewW(), viewH());
});
