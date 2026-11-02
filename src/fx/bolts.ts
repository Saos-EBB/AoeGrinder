// Blitz-Baustein: heller Kern, Glühen, Verästelung, Flackern. Alle Blitze teilen einen Puffer und einen Draw Call;
// nach dem Schreiben läuft alles im Shader, ein 50er-Kettenblitz kostet pro Frame keine Rechenzeit.

import * as THREE from 'three';
import { rand } from '../util';
import { scene } from '../render';
import { fxClock, fxUniforms } from './shaders';

const MAX_SEGMENTS = 3000;   // PH: Ringpuffer, ältestes wird überschrieben
const STRIDE = 16;           // a(3) b(3) along+side(2) farbe(3) birth life width seed flare(5)
const data = new Float32Array(MAX_SEGMENTS * 4 * STRIDE);
const buffer = new THREE.InterleavedBuffer(data, STRIDE).setUsage(THREE.DynamicDrawUsage);
const geo = new THREE.BufferGeometry();
const attr = (name, size, offset) => geo.setAttribute(name, new THREE.InterleavedBufferAttribute(buffer, size, offset));
attr('position', 3, 0); attr('aB', 3, 3); attr('aQ', 2, 6); attr('aTint', 3, 8); attr('aT', 4, 11); attr('aFlare', 1, 15);
const index = new Uint16Array(MAX_SEGMENTS * 6);
for (let i = 0; i < MAX_SEGMENTS; i++) index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
geo.setIndex(new THREE.BufferAttribute(index, 1));

const mat = new THREE.ShaderMaterial({
  uniforms: { uTime: fxUniforms.uTime },
  vertexShader: /* glsl */`
    attribute vec3 aB; attribute vec2 aQ; attribute vec3 aTint; attribute vec4 aT; attribute float aFlare;
    uniform float uTime; varying float vSide; varying vec3 vTint; varying float vAlpha;
    void main() {
      float t = (uTime - aT.x) / aT.y;
      vec4 a = viewMatrix * vec4(position, 1.0), b = viewMatrix * vec4(aB, 1.0);
      vec2 dir = normalize(b.xy - a.xy + vec2(0.00001));
      vec4 p = mix(a, b, aQ.x);
      float width = aT.z * (0.85 + 0.15 * sin(uTime * 0.05 + aT.w * 40.0));
      p.xy += vec2(-dir.y, dir.x) * aQ.y * width + dir * (aQ.x * 2.0 - 1.0) * width * 0.4;   // Überlappung schließt die Knicke
      vSide = aQ.y; vTint = aTint;
      float flicker = 0.72 + 0.28 * sin(uTime * 0.11 + aT.w * 60.0) * sin(uTime * 0.037 + aT.w * 13.0);
      vAlpha = t < 0.0 || t > 1.0 ? 0.0 : pow(1.0 - t, 1.6) * flicker * aFlare;
      gl_Position = projectionMatrix * p;
    }`,
  fragmentShader: /* glsl */`
    varying float vSide; varying vec3 vTint; varying float vAlpha;
    void main() {
      if (vAlpha <= 0.0) discard;
      float x = abs(vSide);
      float core = 1.0 - smoothstep(0.04, 0.2, x);
      float glow = pow(1.0 - x, 2.6);
      gl_FragColor = vec4((vTint * glow * 0.55 + vec3(1.7) * core) * vAlpha, 1.0);
    }`,
  blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
});
const mesh = new THREE.Mesh(geo, mat);
mesh.frustumCulled = false;
scene.add(mesh);

let head = 0;
function pushSegment(a, b, color, life, width, seed, flare) {
  for (let v = 0; v < 4; v++) {
    const o = (head * 4 + v) * STRIDE;
    data[o] = a.x; data[o + 1] = a.y; data[o + 2] = a.z;
    data[o + 3] = b.x; data[o + 4] = b.y; data[o + 5] = b.z;
    data[o + 6] = v >> 1; data[o + 7] = v & 1 ? 1 : -1;
    data[o + 8] = color[0]; data[o + 9] = color[1]; data[o + 10] = color[2];
    data[o + 11] = fxClock.now; data[o + 12] = life; data[o + 13] = width; data[o + 14] = seed; data[o + 15] = flare;
  }
  buffer.addUpdateRange(head * 4 * STRIDE, 4 * STRIDE);
  head = (head + 1) % MAX_SEGMENTS;
  buffer.needsUpdate = true;
}

const tmpMid = new THREE.Vector3();
// Mittelpunkt-Versatz: halbiert die Strecke depth-mal und versetzt die Mitte quer
function fractal(a, b, depth, jitter, out) {
  if (depth === 0) { out.push(b.clone()); return; }
  const mid = tmpMid.lerpVectors(a, b, 0.5).clone();
  mid.x += rand(-jitter, jitter); mid.y += rand(-jitter, jitter) * 0.7; mid.z += rand(-jitter, jitter);
  fractal(a, mid, depth - 1, jitter * 0.55, out);
  fractal(mid, b, depth - 1, jitter * 0.55, out);
}

// from/to in Welt-Höhe. width in yd (ganze Breite des Glühens), branches: Anzahl Äste
export function bolt(from, to, color, { life = 260, width = 0.5, branches = 2, depth = 4, jitter = 0 } = {}) {   // PH
  const a = new THREE.Vector3(from.x, from.y, from.z), b = new THREE.Vector3(to.x, to.y, to.z);
  const pts = [a];
  fractal(a, b, depth, jitter || Math.min(1.6, a.distanceTo(b) * 0.14), pts);
  const seed = Math.random();
  for (let i = 1; i < pts.length; i++) pushSegment(pts[i - 1], pts[i], color, life, width, seed, 1);
  for (let k = 0; k < branches; k++) {
    const i = Math.floor(rand(1, pts.length - 1)), start = pts[i];
    const dir = tmpMid.subVectors(pts[i + 1] ?? b, start).normalize();
    const end = start.clone().addScaledVector(dir, a.distanceTo(b) * rand(0.2, 0.38));
    end.x += rand(-1.5, 1.5); end.y += rand(-1, 0.6); end.z += rand(-1.5, 1.5);
    const twig = [start];
    fractal(start, end, Math.max(1, depth - 2), 0.45, twig);
    for (let j = 1; j < twig.length; j++) pushSegment(twig[j - 1], twig[j], color, life * 0.7, width * 0.5, seed + 0.3, 0.75);
  }
}
