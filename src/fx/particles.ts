import * as THREE from 'three';
import { PERF } from '../config';
import { camera } from '../render';
import { softScene, softPass, softUniforms, SOFT_GLSL, additiveBlend } from './softPass';
import { quality, vfxOld } from './shaders';

// Glow-Textur (weicher Kreis) für Partikel und Leuchteffekte
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
export function glowSprite(color, size) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(size);
  return sp;
}

export const particles = (() => {
  const MAX = PERF.maxParticles;
  const posArr = new Float32Array(MAX * 3), colArr = new Float32Array(MAX * 3), sizeArr = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('pcolor', new THREE.BufferAttribute(colArr, 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(sizeArr, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 1 }, ...softUniforms },
    vertexShader: `attribute float psize; attribute vec3 pcolor; uniform float scale; varying vec3 vColor; varying float vViewZ;
      void main() { vColor = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewZ = mv.z;
        gl_PointSize = psize * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vColor; varying float vViewZ; ${SOFT_GLSL}
      void main() { float d = 1.0 - length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vColor * softFade(vViewZ) * d * d * sign(max(d, 0.0)), 0.0); }`,
    depthTest: false, depthWrite: false, transparent: true, ...additiveBlend,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  softScene.add(points);
  softPass.active = () => list.length > 0 || softScene.children.length > 1;
  const list = [];

  // o: { x,y,z, vx,vy,vz, life, color:[r,g,b], size, grow, grav, drag }
  function spawn(o) {
    if (list.length >= MAX || (!vfxOld() && Math.random() > quality().particleMul)) return;
    list.push({ vx: 0, vy: 0, vz: 0, grow: 0, grav: 0, drag: 0, ...o, max: o.life });
  }
  function update(dt) {
    const s = dt / 1000;
    mat.uniforms.scale.value = softUniforms.uDepthRes.value.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= s;
      if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
      const d = Math.max(0, 1 - p.drag * s);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.grav * s;
      p.x += p.vx * s; p.y += p.vy * s; p.z += p.vz * s;
    }
    for (const p of list) {
      const f = p.life / p.max;                       // 1 → 0
      const fade = Math.min(1, f * 2.5) * Math.min(1, (1 - f) * 20 + 0.05);
      posArr[n * 3] = p.x; posArr[n * 3 + 1] = p.y; posArr[n * 3 + 2] = p.z;
      colArr[n * 3] = p.color[0] * fade; colArr[n * 3 + 1] = p.color[1] * fade; colArr[n * 3 + 2] = p.color[2] * fade;
      sizeArr[n] = p.size * (1 + (1 - f) * p.grow);
      n++;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = geo.attributes.pcolor.needsUpdate = geo.attributes.psize.needsUpdate = true;
  }
  return { spawn, update, count: () => list.length };
})();
