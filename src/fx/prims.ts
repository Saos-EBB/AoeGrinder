// Grundformen der neuen Spell-Optik. Formen entstehen im Fragment-Shader oder auf hoch unterteilten Meshes, damit keine Polygonkanten zu sehen sind.
// Alle Dauern, Größen und Stärken hier sind PH.

import * as THREE from 'three';
import { rand, pick } from '../util';
import { heightAt, terrainDecal, drape } from '../world';
import { particles, glowSprite } from './particles';
import { addEffect } from './spellFx';
import { fxMaterial, fxClock, FX_VERTEX, GLSL } from './shaders';
import { scene } from '../render';

const vec3 = c => new THREE.Vector3(c[0], c[1], c[2]);
const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);

// Scheibe, die dem Gelände folgt. Einmal aufgelegt, Bewegung und Wachsen laufen im Shader.
export function groundDisc(center, radius, material, segments = 96, rings = 12) {
  const mesh = terrainDecal(new THREE.RingGeometry(0, 1, segments, rings), material);
  drape(mesh, center, radius);
  return mesh;
}

const DISC_VERTEX = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';

// Laufende Bodenwelle mit ausgefranster Vorderkante
export function waveFx(center, radius, colorA, colorB, { dur = 520, width = 0.28, peak = 1 } = {}) {
  const mat = fxMaterial({ uniforms: { uT: { value: 0 }, uA: { value: vec3(colorA) }, uB: { value: vec3(colorB) }, uWidth: { value: width }, uPeak: { value: peak } }, vertexShader: DISC_VERTEX,
    fragmentShader: `${GLSL.common} uniform float uT, uWidth, uPeak; uniform vec3 uA, uB; varying vec2 vUv;
      void main() {
        vec2 q = vUv - 0.5; float r = length(q) * 2.0;
        float n = noise2(q * 1.4 + scrollUv(vec2(0.0), vec2(0.0, 0.25)));
        float front = 1.0 - pow(1.0 - uT, 3.0);
        float rr = r + (n - 0.5) * 0.16;
        float band = smoothstep(front - uWidth, front, rr) * (1.0 - smoothstep(front, front + 0.025, rr));
        float edge = 1.0 - smoothstep(0.96, 1.0, r);
        float a = band * edge * pow(1.0 - uT, 1.3) * uPeak;
        gl_FragColor = vec4(mix(uB, uA, band * band) * a, 1.0);
      }` });
  const mesh = groundDisc(center, radius, mat);
  addEffect(mesh, dur, t => { mat.uniforms.uT.value = t; });
}

// Bodenzeichnung aus Textur, die am Ende mit Rauschen und hellem Saum wegbrennt
export function markFx(tex, center, radius, color, dur, { peak = 1, spin = 0, grow = 0.08, rim = color, additive = false, flow = 0 } = {}) {
  const mat = fxMaterial({ additive, uniforms: { map: { value: tex }, uT: { value: 0 }, uC: { value: vec3(color) }, uRim: { value: vec3(rim) }, uPeak: { value: peak }, uGrow: { value: 0 }, uSpin: { value: 0 }, uFlow: { value: flow } }, vertexShader: DISC_VERTEX,
    fragmentShader: `${GLSL.common} uniform sampler2D map; uniform float uT, uPeak, uGrow, uSpin, uFlow; uniform vec3 uC, uRim; varying vec2 vUv;
      void main() {
        vec2 q = vUv - 0.5; float r = length(q) * 2.0;
        float cs = cos(uSpin), sn = sin(uSpin);
        vec2 uv = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs) + 0.5;
        vec4 tex = texture2D(map, uv);
        float n = noise2(q * 1.3 + scrollUv(vec2(0.3), vec2(uFlow)));
        float out_ = smoothstep(0.65, 1.0, uT);
        float keep = dissolve(n, out_, 0.18);
        float rimGlow = burn(n, out_, 0.06) * step(0.001, out_);
        float reveal = 1.0 - smoothstep(uGrow - 0.06, uGrow, r);
        float a = tex.a * keep * reveal * uPeak * (1.0 - smoothstep(0.96, 1.0, r));
        vec3 col = tex.rgb * uC * (0.85 + 0.3 * n) + uRim * rimGlow * tex.a;
        gl_FragColor = vec4(col, a);
      }` });
  const mesh = groundDisc(center, radius, mat);
  addEffect(mesh, dur, t => {
    mat.uniforms.uT.value = t;
    mat.uniforms.uGrow.value = Math.min(1.1, t / grow * 1.1);
    mat.uniforms.uSpin.value = spin * t;
  });
}

// Glatte Halbkugel mit Fresnel-Rand, die sich ausdehnt und auflöst
const shellGeo = new THREE.SphereGeometry(1, 64, 40);
export function shellFx(pos, radius, color, { dur = 480, power = 3.2, peak = 0.75, squash = 0.65, y = 0.1, delay = 0 } = {}) {
  const mat = fxMaterial({ side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uC: { value: vec3(color) }, uPow: { value: power }, uPeak: { value: peak } }, vertexShader: FX_VERTEX,
    fragmentShader: `${GLSL.common} uniform float uT, uPow, uPeak; uniform vec3 uC; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = fresnel(vN, vV, uPow);
        float n = noise2(vUv * vec2(4.0, 2.0) + scrollUv(vec2(0.0), vec2(0.1, -0.5)));
        float keep = dissolve(n, uT * uT, 0.3);
        gl_FragColor = vec4(uC * f * 1.2 * keep * (1.0 - uT) * uPeak, 1.0);
      }` });
  const mesh = new THREE.Mesh(shellGeo, mat);
  mesh.position.set(pos.x, pos.y + y, pos.z);
  mesh.visible = !delay;
  addEffect(mesh, dur + delay, t0 => {
    const t = Math.max(0, (t0 * (dur + delay) - delay) / dur);
    mesh.visible = t > 0;
    const s = Math.max(0.01, radius * easeOut(t));
    mesh.scale.set(s, s * squash, s);
    mat.uniforms.uT.value = t;
  });
  (mesh as any).sharedGeometry = true;
}

// Heller Blitz mit weichem Ein- und Ausklingen
export function flareFx(pos, color, size, dur = 300, y = 1) {
  const sp = glowSprite(color, 0.1);
  sp.position.set(pos.x, pos.y + y, pos.z);
  addEffect(sp, dur, t => {
    sp.scale.setScalar(size * (0.35 + 0.65 * easeOut(t)));
    sp.material.opacity = (t < 0.12 ? t / 0.12 : Math.pow(1 - (t - 0.12) / 0.88, 2)) * 0.9;
  });
}

// Säule oder Trichter mit aufsteigendem Rauschen
const COLUMN_FRAG = `${GLSL.common} uniform float uAlpha, uScrollV, uDens, uTwist; uniform vec3 uA, uB; uniform float uDis; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    vec2 uv = vec2(vUv.x + vUv.y * uTwist, vUv.y);   // Schrägstellung ergibt Schraubenlinien
    float n = noise2(uv * vec2(3.0, 1.0) + scrollUv(vec2(0.0), vec2(0.05, -uScrollV)));
    float n2 = noise2(uv * vec2(6.0, 2.0) + scrollUv(vec2(0.4), vec2(-0.08, -uScrollV * 1.7)));
    float body = smoothstep(uDens, uDens + 0.3, n * 0.6 + n2 * 0.5);
    float h = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    float keep = dissolve(n2, uDis, 0.25);
    float f = 0.45 + 0.55 * fresnel(vN, vV, 1.3);
    gl_FragColor = vec4(mix(uB, uA, body) * body * h * keep * f * uAlpha, 1.0);
  }`;
export function columnMaterial(colorA, colorB, { scroll = 1.1, dens = 0.25, twist = 0 } = {}) {
  return fxMaterial({ side: THREE.DoubleSide, vertexShader: FX_VERTEX, fragmentShader: COLUMN_FRAG,
    uniforms: { uTwist: { value: twist }, uAlpha: { value: 1 }, uScrollV: { value: scroll }, uDens: { value: dens }, uA: { value: vec3(colorA) }, uB: { value: vec3(colorB) }, uDis: { value: 0 } } });
}
export function columnFx(pos, radius, height, colorA, colorB, { dur = 650, top = 1, grow = 0.2, scroll = 1.1, dens = 0.25 } = {}) {
  const geo = new THREE.CylinderGeometry(radius * top, radius, 1, 64, 8, true).translate(0, 0.5, 0);
  const mat = columnMaterial(colorA, colorB, { scroll, dens });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, pos.y, pos.z);
  addEffect(mesh, dur, t => {
    mesh.scale.y = Math.max(0.01, height * easeOut(Math.min(1, t / grow)));
    const w = 0.6 + 0.4 * easeOut(Math.min(1, t / grow));
    mesh.scale.x = mesh.scale.z = w;
    mat.uniforms.uDis.value = Math.max(0, (t - 0.4) / 0.6);
    mat.uniforms.uAlpha.value = Math.min(1, t / 0.08);
  });
}

// Eiskristalle und Knochen: runde Lathe-Spitzen, ein Draw Call pro Ring
export function spikeGeometry(radius, height) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector2(radius * Math.pow(1 - k, 0.75) * (k < 0.08 ? 0.75 + k * 3 : 1), k * height)); }
  return new THREE.LatheGeometry(pts, 14);
}
const SPIKE_VERTEX = /* glsl */`
  uniform float uGrow; varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    vP = position;
    vec3 p = position * vec3(1.0, uGrow, 1.0);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vN = normalMatrix * mat3(instanceMatrix) * normal; vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;
// bone = true: matt und undurchsichtig statt eisig
export function spikeRing(place, n, geo, { deep = [0.1, 0.36, 0.85], light = [0.95, 1.5, 2.2], rimPow = 1.8 } = {}) {
  const mat = fxMaterial({ additive: false, vertexShader: SPIKE_VERTEX,
    uniforms: { uGrow: { value: 0.001 }, uDis: { value: 0 }, uDeep: { value: vec3(deep) }, uLight: { value: vec3(light) }, uRimPow: { value: rimPow } },
    fragmentShader: `${GLSL.common} uniform float uDis, uRimPow; uniform vec3 uDeep, uLight; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float n = noise2(vP.xy * 0.4 + vP.zy * 0.3);
        if (n < uDis * 1.05) discard;
        float f = fresnel(vN, vV, uRimPow);
        vec3 col = mix(uDeep, uLight, f) + uLight * burn(n, uDis, 0.05) * step(0.001, uDis);
        gl_FragColor = vec4(col, 1.0);
      }` });
  mat.transparent = false;
  mat.depthWrite = true;
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const o = place(i);
    e.set(o.tiltX ?? 0, o.yaw ?? rand(0, 6.28), o.tiltZ ?? 0);
    p.set(o.x, o.y, o.z);
    s.setScalar(o.scale ?? 1);
    m.compose(p, q.setFromEuler(e), s);
    mesh.setMatrixAt(i, m);
  }
  mesh.frustumCulled = false;
  return { mesh, mat };
}
const iceSpike = spikeGeometry(0.28, 1.8);
export function iceSpikesFx(pos, radius, n, { dur = 1300, scale = 1 } = {}) {
  const { mesh, mat } = spikeRing(() => {
    const a = rand(0, 6.28), r = radius * rand(0.4, 0.98), x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    return { x, y: heightAt(x, z) - 0.25, z, tiltX: Math.sin(a) * rand(0.08, 0.3), tiltZ: -Math.cos(a) * rand(0.08, 0.3), scale: scale * rand(0.7, 1.5) };
  }, n, iceSpike);
  (mesh as any).sharedGeometry = true;
  addEffect(mesh, dur, t => {
    mat.uniforms.uGrow.value = Math.max(0.001, easeOut(Math.min(1, t / 0.11)));
    mat.uniforms.uDis.value = Math.max(0, (t - 0.55) / 0.45);
  });
}

// Partikel-Salve in alle Richtungen am Boden
export function sparksFx(pos, n, colors, speed, { up = 3, life = 0.7, size = 0.4, grav = 0, drag = 2.6, y = 0.6, grow = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), sp = rand(speed * 0.5, speed);
    particles.spawn({ x: pos.x, y: pos.y + rand(0.1, y), z: pos.z, vx: Math.cos(a) * sp, vy: rand(up * 0.2, up), vz: Math.sin(a) * sp,
      grav, drag, life: rand(life * 0.6, life), color: pick(colors), size: rand(size * 0.5, size), grow });
  }
}

// Dauerhafter Wirbel oder Trichter als Flächen-Visual, blendet ein und aus
export function vortexVisual(colorA, colorB, height, { top = 1.25, bottom = 1, scroll = 0.9, dens = 0.32, peak = 1, spin = 1.2, twist = 0 } = {}) {
  const geo = new THREE.CylinderGeometry(top, bottom, 1, 64, 8, true).translate(0, 0.5, 0);
  const mat = columnMaterial(colorA, colorB, { scroll, dens, twist });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  const born = fxClock.now;
  return {
    update(pos, radius) {
      mesh.position.set(pos.x, heightAt(pos.x, pos.z), pos.z);
      mesh.scale.set(radius, height, radius);
      mesh.rotation.y = fxClock.now / 1000 * spin;
      mat.uniforms.uAlpha.value = peak * Math.min(1, (fxClock.now - born) / 300);
    },
    remove() {
      addEffect(mesh, 350, t => { mat.uniforms.uAlpha.value = peak * (1 - t); mat.uniforms.uDis.value = t; });
    },
  };
}
