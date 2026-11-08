// Testseite im Dev-Server unter /klinge.html: zeigt alle Aktionen der Figur nacheinander, in beiden Haltungen. Ohne Spielregeln.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildKlinge, cloneKlinge, KLINGE_TIMING as K } from './models/klingeModel';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x181a20);
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
cam.position.set(4.5, 3, 6);
const ctl = new OrbitControls(cam, renderer.domElement);
ctl.target.set(0, 1, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x555a66, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(4, 10, 6); scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshLambertMaterial({ color: 0x3a3d46 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

const model = buildKlinge();
scene.add(model.root, model.fx.group, model.scarf);
const clone = cloneKlinge(model);
clone.root.position.set(-2.5, 0, 0);
scene.add(clone.root);
model.onHit = (kind, x, z) => { model.fx.blood(new THREE.Vector3(x, 1, z + 1), 12); };

// [Name, Dauer, anim]; Haltung 1 und 2 laufen dieselbe Liste, nur die Q-Kette hängt an der Haltung
const Q_NAMES = { 1: ['Ziehschnitt', 'Rückhand', 'Stoß + Wegstecken'], 2: ['rechts diagonal', 'links diagonal', 'X-Schnitt', 'Wirbelsprung'] };
const HOLD = 600;   // Endpose zwischen zwei Schlägen sichtbar halten
const qSteps = (s, run = false): any[] => K.qChain[s].map((ms, n, all) => [`Q ${n + 1}/${all.length} ${Q_NAMES[s][n]}${run ? ' im Lauf' : ''}`, ms + (n < all.length - 1 ? HOLD : 300),
  { attack: 'q', step: n, hold: n < all.length - 1, ...(run ? { state: 'run', speed: 7 } : {}) }]);
const stepsFor = (s): any[] => [
  ['Idle', 1500, { state: 'idle' }], ['Laufen', 1500, { state: 'run', speed: 7 }], ['Rückwärts', 1200, { state: 'back', speed: 4.5 }], ['Sprung', 800, { state: 'air' }],
  ...qSteps(s), ...(s === 1 ? [['Q 1 und Fenster abgelaufen: Wegstecken', K.qChain[1][0] + 400, { attack: 'q', step: 0, hold: true }], ['Wegstecken', K.sheathe + 400, { attack: 'sheathe' }]] : []),
  ...qSteps(s, true).slice(0, 2),
  ['E Kreisschnitt', K.e + 200, { ability: 'e' }], ['Strichschnitt', K.dash.ms + 200, { ability: 'dash' }],
  ['Blutwirbel', K.wirbel + 200, { ability: 'wirbel' }], ['Aderlass', K.ader + 200, { ability: 'ader' }], ['Essen', 2500, { state: 'sit' }], ['Tot', 1500, { state: 'dead' }],
];
let STEPS = stepsFor(1);
let stance = 1, i = -1, left = 0, seq = 0, anim: any = {}, T = 0;
const nameEl = document.getElementById('name');
let swap = 0;
function next() {
  i++;
  if (i >= STEPS.length) {
    i = -1; stance = stance === 1 ? 2 : 1; STEPS = stepsFor(stance);
    model.setStance(stance);
    swap = K.swap + 100; anim = { ability: 'swap', seq: ++seq }; nameEl.textContent = `Haltung wechseln → ${stance}`;
    return;
  }
  const [name, ms, a] = STEPS[i];
  left = ms; anim = { state: 'idle', ...a, seq: ++seq };
  nameEl.textContent = `Haltung ${stance}: ${name}`;
}
function frame(dt) {
  const ms = dt * 1000;
  if (swap > 0) { swap -= ms; if (swap <= 0) next(); } else { left -= ms; if (left <= 0) next(); }
  T += dt;
  const dashK = anim.ability === 'dash' ? 1 : 0;
  model.root.rotation.y = 0;
  model.root.position.z = dashK ? model.root.position.z : 0;
  model.update(dt, anim);
  clone.sync();
  ctl.update();
  renderer.render(scene, cam);
}
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let prev = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - prev) / 1000); prev = now; frame(Math.max(0, dt)); requestAnimationFrame(loop); }
const manual = location.hash === '#manual';   // Skript steuert die Zeit selbst
if (!manual) requestAnimationFrame(loop);
(window as any).__lab = { model, cam, ctl, renderer, frame, set(a, s) { if (s) { stance = s; STEPS = stepsFor(s); model.setStance(s, true); } anim = { state: 'idle', ...a, seq: ++seq }; left = 1e9; i = 0; }, info: () => renderer.info.render };
