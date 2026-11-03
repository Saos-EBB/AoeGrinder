// Testseite im Dev-Server unter /strich.html: Strichkrieger und die 4 Strichmagier nebeneinander, alle Zustände nacheinander. Ohne Spielregeln.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildStrichKrieger, STRICH_TIMING as K } from './models/strichKrieger';
import { buildStrichMagier } from './models/strichMagier';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x181a20);
const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
cam.position.set(0, 3, 11);
const ctl = new OrbitControls(cam, renderer.domElement);
ctl.target.set(0, 1, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x555a66, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(4, 10, 6); scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshLambertMaterial({ color: 0x3a3d46 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

const krieger = buildStrichKrieger();
scene.add(krieger.root, krieger.fx.group, krieger.scarf);
krieger.onHit = () => {};
const mages = ['alle', 'feuer', 'frost', 'arkan'].map(id => buildStrichMagier(id));
for (const m of mages) scene.add(m.root, m.scarf);
const X = { k: -5.2, m: [-2.2, 0, 2.2, 4.4] };

const KSTEPS: any[] = [['Idle', 1500, {}], ['Q1', K.q[0] + 300, { ability: 'q0' }], ['Q2', K.q[1] + 300, { ability: 'q1' }], ['Q3', K.q[2] + 300, { ability: 'q2' }], ['Q4', K.q[3] + 300, { ability: 'q3' }], ['Bodenbrecher', K.e + 300, { ability: 'e' }],
  ['Wirbelwind', 1500, { ability: 'whirl' }], ['Sturzsprung', K.leap.ms + 300, { ability: 'leap' }], ['Hinrichtung', K.exec + 300, { ability: 'exec' }], ['Kampfschrei', K.cry + 300, { ability: 'cry' }], ['Letzter Atem', K.last + 300, { ability: 'last' }],
  ['Laufen', 1200, { state: 'run', speed: 7 }], ['Rückwärts', 1000, { state: 'back', speed: 4.5 }], ['Sprung', 700, { state: 'air' }], ['Essen', 2000, { state: 'sit' }], ['Tot', 1200, { state: 'dead' }]];
const MSTEPS: any[] = [['Idle', 5000, {}], ['Laufen', 2000, { state: 'run', speed: 7 }], ['Rückwärts', 1200, { state: 'back', speed: 4.5 }], ['Zaubern', 900, { cast: 1 }], ['Kanal', 2000, { channel: true }], ['Sprung', 700, { state: 'air' }], ['Sitzen', 1500, { state: 'sit' }], ['Tot', 1200, { state: 'dead' }]];
let ki = -1, kLeft = 0, mi = -1, mLeft = 0, kAnim: any = {}, mAnim: any = {}, seq = 0, mCastLeft = 0;
const nameEl = document.getElementById('name');
function frame(dt) {
  const ms = dt * 1000;
  kLeft -= ms; mLeft -= ms; mCastLeft -= ms;
  if (kLeft <= 0) { ki = (ki + 1) % KSTEPS.length; kLeft = KSTEPS[ki][1]; kAnim = { ...KSTEPS[ki][2], seq: ++seq }; }
  if (mLeft <= 0) { mi = (mi + 1) % MSTEPS.length; mLeft = MSTEPS[mi][1]; mAnim = MSTEPS[mi][2]; mCastLeft = 450; }
  nameEl.textContent = `Krieger: ${KSTEPS[ki][0]} · Magier: ${MSTEPS[mi][0]}`;
  place(dt);
}
const rage = () => 70;
function place(dt) {
  krieger.root.position.set(X.k, 0, 0); krieger.root.rotation.y = 0;
  krieger.update(dt, { ...kAnim, rage: rage() });
  mages.forEach((m, i) => {
    m.root.position.set(X.m[i], 0, 0); m.root.rotation.y = 0;
    m.update(dt, { ...mAnim, cast: mAnim.cast && mCastLeft > 0 ? 1 : 0 });
  });
  ctl.update();
  renderer.render(scene, cam);
}
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let prev = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - prev) / 1000); prev = now; frame(Math.max(0, dt)); requestAnimationFrame(loop); }
const manual = location.hash === '#manual';   // Skript steuert die Zeit selbst
if (!manual) requestAnimationFrame(loop);
(window as any).__lab = { krieger, mages, cam, ctl, frame, set(k, m) { kAnim = { ...k, seq: ++seq }; mAnim = m; kLeft = mLeft = 1e9; mCastLeft = 450; ki = mi = 0; }, step(n, dt = .016) { for (let i = 0; i < n; i++) { mCastLeft -= dt * 1000; place(dt); } } };
