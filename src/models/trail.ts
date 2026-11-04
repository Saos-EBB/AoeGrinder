// Fußspuren der Magier-Skins (Feuer, Eis) und ihre Spielregeln. Aus heroModels.ts übernommen, als die alten Figuren gelöscht wurden.
// trail.mesh gehört in die Szene (Weltkoordinaten). stepWatcher meldet jeden Schritt eines Rigs mit legL/legR.ankle.

import * as THREE from 'three';
import { rand } from '../util';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function canvas(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
function toTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// Spielregeln pro Skin. Die Spiellogik wendet sie an (skinFx.ts); das Modell liefert nur Spuren (trail.zones()) und Werte.
export const SKIN_FX = {
  alle: {},
  frost: { trail: 'frost', slow: 0.3, slowMs: 1500 },  // wie Improved Blizzard Rang 1 (mechanics-spec): 30 % für 1,5 s, solange der Mob auf einer Spur steht
  feuer: { trail: 'fire', dps: 5 },                     // PLATZHALTER „bissi dmg“: Schaden pro Sekunde pro Mob, Spuren stapeln nicht
  arkan: { speedMul: 1.1, float: true },                // schwebt, 10 % schneller, keine Spuren
};

const TRAIL = { max: 10, life: 5, r: 0.45 };                             // r = Wirkradius fürs Spiel
// Stufen der Kill-Anzeige (0 … 3): je Stufe größer, länger, mehr Abdrücke, höchstens +5. Wirkradius bleibt TRAIL.r // PH
const STAGE = { extra: 5, lifePer: 1, scalePer: 0.3 };
function footprintTex(kind) {                                            // Fußabdruck, additiv: Schwarz = unsichtbar
  return toTex(canvas(128, (g, s) => {
    const w = s / 2, foot = () => {                                      // Ferse, schmale Mitte, Ballen, 5 Zehen (Großzehe rechts)
      g.beginPath(); g.ellipse(w * 0.5, s * 0.82, w * 0.2, s * 0.12, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(w * 0.56, s * 0.62, w * 0.14, s * 0.16, 0.1, 0, 7); g.fill();
      g.beginPath(); g.ellipse(w * 0.52, s * 0.4, w * 0.28, s * 0.1, -0.1, 0, 7); g.fill();
      [[0.74, 0.2, 0.11], [0.56, 0.17, 0.08], [0.41, 0.19, 0.07], [0.29, 0.23, 0.065], [0.19, 0.28, 0.06]].forEach(([x, y, r]) => { g.beginPath(); g.arc(w * x, s * y, w * r, 0, 7); g.fill(); });
    };
    g.translate(w / 2, 0);
    if (kind === 'fire') {
      g.filter = 'blur(6px)'; g.fillStyle = '#c23a08'; foot(); g.filter = 'blur(2px)'; g.fillStyle = '#ff8a1e'; foot();
      g.filter = 'none'; g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,220,120,0.6)'; g.scale(0.92, 0.95); g.translate(w * 0.04, s * 0.02); foot();
    } else {
      g.filter = 'blur(5px)'; g.fillStyle = '#2a6aa8'; foot(); g.filter = 'none'; g.fillStyle = '#9fd8ff'; foot();
      g.strokeStyle = 'rgba(230,248,255,0.9)'; g.lineWidth = 1.5;                       // Eiskristalle am Rand
      for (let i = 0; i < 14; i++) { const x = rand(0.1, 0.9) * w, y = rand(0.15, 0.95) * s, a = rand(0, 7), l = rand(4, 10); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }
  }));
}
export function makeTrail(kind) {
  const mat = new THREE.MeshBasicMaterial({ map: footprintTex(kind), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const cap = TRAIL.max + STAGE.extra;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.62).rotateX(-Math.PI / 2).rotateY(Math.PI), mat, cap);
  mesh.frustumCulled = false;
  const prints = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  let next = 0, limit = TRAIL.max, life = TRAIL.life, scale = 1;
  const trail = {
    mesh, kind,
    add(x, y, z, ang, side) { if (next >= limit) next = 0; prints[next] = { x, y, z, ang, side, age: 0, life, k: scale }; next = (next + 1) % limit; },
    setStage(k) { limit = TRAIL.max + Math.round(STAGE.extra * k / 3); life = TRAIL.life + STAGE.lifePer * k; scale = 1 + STAGE.scalePer * k; },
    update(dt) {                                                         // dt in Sekunden
      for (let i = 0; i < cap; i++) {
        const p = prints[i];
        if (p) p.age += dt;
        if (!p || p.age >= p.life) { mesh.setMatrixAt(i, m.makeScale(0, 0, 0)); mesh.setColorAt(i, c.setScalar(0)); continue; }
        const fade = 1 - smooth(p.life - 1, p.life, p.age), flick = kind === 'fire' ? 0.75 + 0.25 * Math.sin(p.age * 18 + i * 2) : 1;
        mesh.setMatrixAt(i, m.compose(v.set(p.x, p.y + 0.012, p.z), q.setFromAxisAngle(up, p.ang), sc.set(p.side * p.k, 1, p.k)));
        mesh.setColorAt(i, c.setScalar(fade * flick));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
    zones: () => prints.filter(p => p && p.age < p.life).map(p => ({ x: p.x, z: p.z, r: TRAIL.r })),   // fürs Spiel: wo brennt/friert es gerade
  };
  trail.update(0);
  return trail;
}
// Schritt = tiefster Punkt des Sprunggelenks in einem Schrittzyklus (der Fuß setzt nicht immer genau auf Ruhehöhe auf).
// Ein Fuß gilt als „fällt“, sobald er 2 cm unter sein letztes Hoch sinkt; steigt er danach wieder, war das ein Schritt.
export function stepWatcher(R) {
  const foot = [{ hi: 0, lo: 0, falling: false }, { hi: 0, lo: 0, falling: false }], v = new THREE.Vector3(), base = new THREE.Vector3();
  return onStep => {
    R.root.getWorldPosition(base);
    const e = R.root.matrixWorld.elements, ang = Math.atan2(e[8], e[10]);
    [R.legL, R.legR].forEach((lg, i) => {
      const f = foot[i]; lg.ankle.getWorldPosition(v); const h = v.y - base.y;
      if (!f.falling) { f.hi = Math.max(f.hi, h); if (h < f.hi - 0.02) { f.falling = true; f.lo = h; } }
      else if (h > f.lo + 0.005) { f.falling = false; f.hi = h; if (f.lo < 0.2) onStep(v.x, base.y, v.z, ang, i ? -1 : 1); }
      else f.lo = Math.min(f.lo, h);
    });
  };
}
