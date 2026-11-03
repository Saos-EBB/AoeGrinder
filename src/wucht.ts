import * as THREE from 'three';
import { cameraKick } from './fx/impact';
import { scene } from './render';
import { groundAt } from './collision';
import { state } from './state';

// Wucht: Treffer fühlen sich über Timing und Wirkung auf die Umgebung an. Screenshake (Trauma), Hitstop-Anlässe, Kamera-Ruck,
// Boden-Spuren, Trümmer und Knockback. Alle Zahlen in W. Hitstop, Kamera-Ruck und Lichtblitz selbst liegen in fx/impact.ts.

// Alle Zahlen PH
export const W = {
  // Trauma 0..1 steigt mit Treffern, fällt pro Sekunde. Versatz = Trauma² × max. frameCap: so viel Trauma höchstens pro Frame (30 Blizzard-Ticks bleiben ruhig)
  shake: { max: 0.45, decay: 1.4, freq: 22, frameCap: 0.18, spellK: 0.5, hurtK: 1.4, strong: 1.8 },
  // Spielzeit läuft im Hitstop mit scale weiter; höchstens einer pro gap. Anlässe: Crit auf Einzelziel, Champion-Kill, Krieger-Smash, Spieler verliert ≥ hurtPct Leben
  hitstop: { scale: 0.05, gap: 200, critMs: 50, smashMs: 70, championMs: 90, hurtMs: 80, hurtPct: 0.15 },
  // Großer Treffer: ab diesem Anteil am Mob-Leben. Kamera-Ruck nach vorn (fx/impact.ts cameraKick), höchstens einmal pro gap
  big: { frac: 0.2, kick: 0.22, gap: 120 },
  // Boden-Spuren: ein InstancedMesh, älteste wird überschrieben. size: Durchmesser in yd, Krieger-Riss kleiner, Champion-Kill groß
  decal: { max: 40, lifeMs: 4000, fadeMs: 1500, size: 2.6, spellK: 0.7, minSize: 1.6, maxSize: 7, champion: 6, perFrame: 3, lift: 0.04 },
};

// Einstellung „Bildschirmwackeln“: an, aus, stark
const SHAKE_STORE = 'frostgrind.shake.v1';
export const SHAKE_MODES = ['an', 'aus', 'stark'];
let shakeMode = (() => { try { const v = localStorage.getItem(SHAKE_STORE); return SHAKE_MODES.includes(v) ? v : 'an'; } catch { return 'an'; } })();
export const shakeModeNow = () => shakeMode;
export function setShakeMode(m) {
  shakeMode = m;
  try { localStorage.setItem(SHAKE_STORE, m); } catch { /* egal */ }
}

let trauma = 0, frameAdd = 0, clock = 0;
// Treffer, Schaden, Einschläge: Trauma dazu, gedeckelt pro Frame
export function addTrauma(amount) {
  const room = W.shake.frameCap - frameAdd;
  if (room <= 0 || amount <= 0) return;
  const a = Math.min(room, amount);
  frameAdd += a;
  trauma = Math.min(1, trauma + a);
}
// Einmal pro Frame aus updateCamera: Versatz der Kamera aus zwei Sinus-Schwingungen, kein Zufall pro Frame
export function shakeOffset(dtMs) {
  const s = dtMs / 1000;
  clock += s;
  frameAdd = 0;
  trauma = Math.max(0, trauma - W.shake.decay * s);
  const k = shakeMode === 'aus' ? 0 : trauma * trauma * W.shake.max * (shakeMode === 'stark' ? W.shake.strong : 1);
  const f = W.shake.freq;
  return { x: k * (Math.sin(clock * f) + 0.5 * Math.sin(clock * f * 2.3 + 1.7)) / 1.5, y: k * (Math.sin(clock * f * 1.3 + 0.6) + 0.5 * Math.sin(clock * f * 2.9 + 3.1)) / 1.5 };
}

// Großer Treffer am Mob (mobs.ts damageMob): Kamera-Ruck. school: 0 Feuer, 1 Frost, 2 Arkan, 3 Krieger
let lastBig = -1e9;
export function bigHit(mob, school) {
  const now = performance.now();
  if (now - lastBig < W.big.gap) return;
  lastBig = now;
  cameraKick(W.big.kick);
  decal(mob.pos, school, W.decal.size);
}

// ---------- Boden-Spuren ----------
// Atlas 2×2: Brandfleck (Feuer), Eisfleck (Frost), Lila-Riss (Arkan), Riss (Krieger). Farbe und Form im Bild, Alpha pro Instanz
function decalAtlas() {
  const c = document.createElement('canvas'), S = 256, h = S / 2;
  c.width = c.height = S;
  const g = c.getContext('2d');
  const blot = (ox, oy, inner, outer) => {
    const gr = g.createRadialGradient(ox + h / 2, oy + h / 2, 4, ox + h / 2, oy + h / 2, h / 2 - 4);
    gr.addColorStop(0, inner); gr.addColorStop(0.7, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath();
    for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2, r = (h / 2 - 6) * (0.75 + 0.25 * Math.sin(i * 2.7)); g.lineTo(ox + h / 2 + Math.cos(a) * r, oy + h / 2 + Math.sin(a) * r); }
    g.fill();
  };
  const cracks = (ox, oy, color, width) => {
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      let x = ox + h / 2, y = oy + h / 2;
      const a0 = i / 6 * Math.PI * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 1; k <= 5; k++) { const a = a0 + Math.sin(k * 1.9 + i) * 0.5; x += Math.cos(a) * h / 11; y += Math.sin(a) * h / 11; g.lineTo(x, y); }
      g.stroke();
    }
  };
  blot(0, 0, 'rgba(20,10,4,0.95)', 'rgba(60,24,8,0.6)');
  blot(h, 0, 'rgba(200,235,255,0.8)', 'rgba(120,190,240,0.35)'); cracks(h, 0, 'rgba(255,255,255,0.8)', 2);
  cracks(0, h, 'rgba(200,110,255,0.95)', 5);
  cracks(h, h, 'rgba(10,8,6,0.95)', 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TILE = [[0, 0.5], [0.5, 0.5], [0, 0], [0.5, 0]];   // UV-Ecke je Schule (Canvas oben = v 1)
let decals = null, nextDecal = 0, decalFrame = -1, decalsThisFrame = 0;
const born = new Float32Array(W.decal.max).fill(-1e9);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function makeDecals() {
  const N = W.decal.max;
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const tile = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2), alpha = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  geo.setAttribute('aTile', tile); geo.setAttribute('aAlpha', alpha);
  const mat = new THREE.MeshBasicMaterial({ map: decalAtlas(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  mat.onBeforeCompile = s => {
    s.vertexShader = 'attribute vec2 aTile; attribute float aAlpha; varying float vAlpha;\n' + s.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = vMapUv * 0.5 + aTile; vAlpha = aAlpha;');
    s.fragmentShader = 'varying float vAlpha;\n' + s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vAlpha;');
  };
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  for (let i = 0; i < N; i++) mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
  scene.add(mesh);
  return { mesh, tile, alpha };
}
// Spur am Boden. Pro Frame höchstens perFrame, damit ein AoE-Treffer auf 30 Mobs nicht den ganzen Pool belegt
export function decal(pos, school, size) {
  if (decalFrame !== state.now) { decalFrame = state.now; decalsThisFrame = 0; }
  if (++decalsThisFrame > W.decal.perFrame) return;
  decals ??= makeDecals();
  const i = nextDecal++ % W.decal.max, D = W.decal, d = Math.min(D.maxSize, Math.max(D.minSize, size));
  _p.set(pos.x, groundAt(pos.x, pos.z, pos.y) + D.lift, pos.z);
  _q.setFromAxisAngle(_up, Math.random() * Math.PI * 2);
  decals.mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(d, 1, d)));
  decals.mesh.instanceMatrix.needsUpdate = true;
  decals.tile.setXY(i, TILE[school][0], TILE[school][1]); decals.tile.needsUpdate = true;
  born[i] = state.now;
}
// Einmal pro Frame: ausblenden über die letzten fadeMs
export function updateWucht() {
  if (!decals) return;
  const D = W.decal;
  for (let i = 0; i < D.max; i++) decals.alpha.setX(i, Math.max(0, Math.min(1, (born[i] + D.lifeMs - state.now) / D.fadeMs)));
  decals.alpha.needsUpdate = true;
}
// Spell-Einschläge aus fx/impact.ts: Schule nach der Farbe des Lichts
export function impactDecal(pos, color, radius) {
  const c = new THREE.Color(color), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const school = hsl.s < 0.3 ? 3 : hsl.h < 0.12 || hsl.h > 0.95 ? 0 : hsl.h > 0.45 && hsl.h < 0.68 ? 1 : hsl.h >= 0.68 ? 2 : 0;
  decal(pos, school, radius * W.decal.spellK);
}
