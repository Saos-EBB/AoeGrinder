// Effekte der Waffen: Emitter und Arc aus dem Viewer (Abschnitt 4), angepasst ans Spiel.
// Alle Emitter einer Waffe teilen sich ein Points-Objekt (ein Draw Call, Atlas, additiv und normal gemischt).
// Partikel merken sich die Lage der Waffe beim Entstehen und bleiben so in der Welt stehen, wenn die Figur weiterläuft.

import * as THREE from 'three';
import { scene, camera, renderer } from '../../render';
import { PTILE, particleAtlas } from './textures';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function rndDir(R, v) { const u = R() * 2 - 1, a = R() * 6.2832, s = Math.sqrt(1 - u * u); return v.set(s * Math.cos(a), u, s * Math.sin(a)); }

const FX_IDLE = 0.5;       // Viewer-Rate halbiert, // PH
const FX_COMBAT = 1;              // im Kampf volle Viewer-Rate, // PH
const POINT_SCALE = 1.5;          // die Kamera steht weiter weg als im Viewer, // PH

const uH = { value: 500 };
const PVS = `attribute float size; attribute float alpha; attribute vec3 pcolor; attribute vec3 misc; varying vec3 vC; varying float vA; varying vec3 vM; uniform float uH;
void main(){ vC=pcolor; vA=alpha; vM=misc; vec4 mv=modelViewMatrix*vec4(position,1.0);
gl_PointSize=size*uH/max(-mv.z,0.001); gl_Position=projectionMatrix*mv; }`;
// misc = (Kachel, Drehung, 1 = normal gemischt). Vormultipliert: Alpha 0 im Ausgang wirkt additiv, Alpha a wie normales Blending.
const PFS = `uniform sampler2D map; varying vec3 vC; varying float vA; varying vec3 vM;
void main(){ vec2 q=gl_PointCoord-0.5; float c=cos(vM.y), s=sin(vM.y); q=vec2(c*q.x-s*q.y, s*q.x+c*q.y)+0.5;
if(q.x<0.0||q.x>1.0||q.y<0.0||q.y>1.0) discard;
float cell=floor(vM.x+0.5); vec2 uv=vec2((mod(cell,4.0)+q.x)/4.0, 1.0-(floor(cell/4.0)+q.y)/2.0);
vec4 t=texture2D(map,uv); float a=t.a*vA; if(a<0.003) discard;
gl_FragColor=vec4(vC*t.rgb*a, a*vM.z); }`;

class Batch {
  [k: string]: any;
  constructor(n) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.sz = new Float32Array(n); this.al = new Float32Array(n); this.misc = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    this.attrs = [['position', this.pos, 3], ['pcolor', this.col, 3], ['size', this.sz, 1], ['alpha', this.al, 1], ['misc', this.misc, 3]].map(([k, a, s]: any) => {
      const b = new THREE.BufferAttribute(a, s); b.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, b); return b;
    });
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: particleAtlas() }, uH }, vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 2;
    scene.add(this.points);
  }
  dispose() { scene.remove(this.points); this.points.geometry.dispose(); this.points.material.dispose(); }
}

class Emitter {
  [k: string]: any;
  constructor(parent, c) {
    this.parent = parent;
    // local: Partikel bleiben an der Waffe hängen, etwa die Flamme hinter Glas
    this.c = Object.assign({ max: 120, rate: 10, life: [1, 2], size: [.02, 0], c0: [1, 1, 1], c1: [1, 1, 1], alpha: 1, gravity: 0, drag: 0, tex: 'dot', normal: false, local: false }, c);
    const n = this.n = this.c.max;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.age = new Float32Array(n); this.life = new Float32Array(n).fill(-1);
    this.m = new Float32Array(n * 16);
    this.acc = 0; this.burstT = .5; this.tp = V(); this.tv = V(); this.alive = 0;
  }
  attach(batch, off) {
    this.b = batch; this.off = off;
    const tile = PTILE[this.c.tex], nrm = this.c.normal ? 1 : 0;
    for (let k = 0; k < this.n; k++) { const i = (off + k) * 3; batch.misc[i] = tile; batch.misc[i + 2] = nrm; }
  }
  spawn(k) {
    const c = this.c, i = k * 3; this.tp.set(0, 0, 0); this.tv.set(0, 0, 0);
    c.spawn(Math.random, this.tp, this.tv);
    this.p[i] = this.tp.x; this.p[i + 1] = this.tp.y; this.p[i + 2] = this.tp.z;
    this.v[i] = this.tv.x; this.v[i + 1] = this.tv.y; this.v[i + 2] = this.tv.z;
    this.age[k] = 0; this.life[k] = c.life[0] + Math.random() * (c.life[1] - c.life[0]);
    if (!c.local) this.m.set(this.parent.matrixWorld.elements, k * 16);
  }
  update(dt, level) {
    const c = this.c, b = this.b; let want = 0;
    if (c.burst) { if ((this.burstT -= dt) <= 0) { want = Math.round(c.burst.count * level); this.burstT = c.burst.every[0] + Math.random() * (c.burst.every[1] - c.burst.every[0]); } }
    else { this.acc += c.rate * level * dt; want = Math.floor(this.acc); this.acc -= want; }
    for (let k = 0; k < this.n && want > 0; k++) if (this.life[k] < 0) { this.spawn(k); want--; }
    const dr = Math.max(0, 1 - c.drag * dt); let alive = 0;
    const cur = this.parent.matrixWorld.elements;
    for (let k = 0; k < this.n; k++) {
      const o = this.off + k;
      if (this.life[k] < 0) { b.al[o] = 0; b.sz[o] = 0; continue; }
      const a = (this.age[k] += dt), t = a / this.life[k], i = k * 3;
      if (t >= 1) { this.life[k] = -1; b.al[o] = 0; b.sz[o] = 0; continue; }
      alive++;
      this.v[i + 1] += c.gravity * dt; this.v[i] *= dr; this.v[i + 1] *= dr; this.v[i + 2] *= dr;
      if (c.force) c.force(this.p, this.v, i, dt, a, k);
      this.p[i] += this.v[i] * dt; this.p[i + 1] += this.v[i + 1] * dt; this.p[i + 2] += this.v[i + 2] * dt;
      // Simuliert wird in Waffen-Koordinaten wie im Viewer, gezeichnet in Welt-Koordinaten
      const m = c.local ? cur : this.m, s = c.local ? 0 : k * 16, x = this.p[i], y = this.p[i + 1], z = this.p[i + 2], w = o * 3;
      b.pos[w] = m[s] * x + m[s + 4] * y + m[s + 8] * z + m[s + 12];
      b.pos[w + 1] = m[s + 1] * x + m[s + 5] * y + m[s + 9] * z + m[s + 13];
      b.pos[w + 2] = m[s + 2] * x + m[s + 6] * y + m[s + 10] * z + m[s + 14];
      b.sz[o] = (c.size[0] + (c.size[1] - c.size[0]) * t) * POINT_SCALE;
      for (let j = 0; j < 3; j++) b.col[w + j] = c.c0[j] + (c.c1[j] - c.c0[j]) * t;
      b.al[o] = c.alpha * Math.min(1, t * 6) * (1 - t) * (c.flicker ? .55 + .45 * Math.sin(a * 9 + k * 1.7) : 1);
    }
    this.alive = alive;
  }
}

class Arc {
  [k: string]: any;
  constructor(parent, c) {
    this.c = Object.assign({ seg: 10, amp: .25, on: [.05, .12], off: [.15, .8], color: [2, 2, 4], branch: true }, c);
    const mk = n => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(...(this.c.color as [number, number, number])) }));
      l.frustumCulled = false; l.visible = false; l.renderOrder = 3; parent.add(l); return l;
    };
    this.main = mk(this.c.seg + 1); this.glow = mk(this.c.seg + 1); this.br = mk(6);
    this.glow.material = new THREE.LineBasicMaterial({ color: new THREE.Color(...(this.c.color as [number, number, number])).multiplyScalar(.35) });
    this.t = Math.random() * .5; this.on = false; this.regen = 0; this.d = V(); this.n1 = V(); this.n2 = V(); this.s = V(); this.e = V();
  }
  bolt(line, a, b, seg, amp, jitter = 1) {
    const pos = line.geometry.attributes.position, d = this.d.subVectors(b, a), len = d.length();
    this.n1.set(0, 1, 0).cross(d); if (this.n1.lengthSq() < 1e-8) this.n1.set(1, 0, 0); this.n1.normalize(); this.n2.crossVectors(d, this.n1).normalize();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, e = Math.sin(Math.PI * t) * amp * len * 2 * jitter, r1 = Math.random() - .5, r2 = Math.random() - .5;
      pos.setXYZ(i, a.x + d.x * t + (this.n1.x * r1 + this.n2.x * r2) * e, a.y + d.y * t + (this.n1.y * r1 + this.n2.y * r2) * e, a.z + d.z * t + (this.n1.z * r1 + this.n2.z * r2) * e);
    }
    pos.needsUpdate = true;
  }
  update(dt, level) {
    if ((this.t -= dt) <= 0) {
      this.on = !this.on; const rr = this.on ? this.c.on : this.c.off; this.t = (rr[0] + Math.random() * (rr[1] - rr[0])) / (this.on ? 1 : level);
      this.main.visible = this.glow.visible = this.on; this.br.visible = this.on && this.c.branch && Math.random() < .6; this.regen = 0;
    }
    if (this.on && (this.regen -= dt) <= 0) {
      this.regen = .045; const a = this.c.a(), b = this.c.b();
      this.bolt(this.main, a, b, this.c.seg, this.c.amp);
      const gp = this.glow.geometry.attributes.position; gp.array.set(this.main.geometry.attributes.position.array); gp.needsUpdate = true;
      this.glow.position.set(.002, .002, 0);
      const k = 2 + Math.floor(Math.random() * (this.c.seg - 3));
      this.s.fromBufferAttribute(this.main.geometry.attributes.position, k);
      rndDir(Math.random, this.e).multiplyScalar(a.distanceTo(b) * .45).add(this.s);
      this.bolt(this.br, this.s, this.e, 5, this.c.amp);
    }
  }
  dispose() { for (const l of [this.main, this.glow, this.br]) { l.geometry.dispose(); l.material.dispose(); } }
}

// Wird in build(g, fx) befüllt. finish() legt danach das gemeinsame Points-Objekt an.
export class FX {
  [k: string]: any;
  constructor() { this.items = []; this.emitters = []; this.arcs = []; this.sprites = []; this.pivots = []; this.glowAnchor = null; this.combat = false; this.level = FX_IDLE; this.batch = null; }
  emit(parent, c) { const e = new Emitter(parent, c); this.emitters.push(e); return e; }
  arc(parent, c) { const a = new Arc(parent, c); this.arcs.push(a); return a; }
  // Halo und Strahlen sind dauerhafte Punkte im selben Batch, kein Sprite pro Waffe (Budget: ein Points-Draw-Call)
  halo(parent, pos, col, size) { return this.addSprite(parent, pos, new THREE.Color(col).multiplyScalar(.8), size, 'halo', 0); }
  rays(parent, pos, col, size, speed = .2) { return this.addSprite(parent, pos, new THREE.Color(col), size, 'rays', speed); }
  addSprite(parent, pos, color, size, tex, speed) { const s = { parent, position: pos.clone(), color, size, tex, speed }; this.sprites.push(s); return s; }
  every(fn) { this.items.push({ update: fn }); }
  // Bewegliche Teile bleiben als Knoten erhalten und werden im gemergten Mesh zu Knochen
  pivot(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); this.pivots.push(g); return g; }
  dyn(mesh) { this.pivots.push(mesh); return mesh; }
  // Leuchtpunkt der Waffe, wird anchors.crystal
  anchor(parent, x = 0, y = 0, z = 0) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); this.glowAnchor = o; return o; }
  finish() {
    const n = this.emitters.reduce((s, e) => s + e.n, 0) + this.sprites.length;
    if (!n) return;
    const b = this.batch = new Batch(n);
    let off = 0;
    for (const e of this.emitters) { e.attach(b, off); off += e.n; }
    for (const s of this.sprites) { s.off = off++; b.misc[s.off * 3] = PTILE[s.tex]; }
  }
  update(dt, t) {
    this.level += ((this.combat ? FX_COMBAT : FX_IDLE) - this.level) * Math.min(1, dt * 4);
    for (const i of this.items) i.update(dt, t);
    for (const a of this.arcs) a.update(dt, this.level);
    const b = this.batch;
    if (!b) return;
    uH.value = renderer.getDrawingBufferSize(tmp2).y / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const e of this.emitters) e.update(dt, this.level);
    for (const s of this.sprites) {
      const o = s.off, w = o * 3; tmpV.copy(s.position).applyMatrix4(s.parent.matrixWorld);
      b.pos[w] = tmpV.x; b.pos[w + 1] = tmpV.y; b.pos[w + 2] = tmpV.z;
      b.col[w] = s.color.r; b.col[w + 1] = s.color.g; b.col[w + 2] = s.color.b;
      b.sz[o] = s.size * (s.speed ? 1 + Math.sin(t * 1.7) * .06 : 1); b.al[o] = 1; b.misc[w + 1] = t * s.speed;
    }
    for (const a of b.attrs) a.needsUpdate = true;
  }
  get alive() { return this.emitters.reduce((s, e) => s + e.alive, 0); }
  dispose() { this.batch?.dispose(); for (const a of this.arcs) a.dispose(); }
}
const tmpV = V(), tmp2 = new THREE.Vector2();
