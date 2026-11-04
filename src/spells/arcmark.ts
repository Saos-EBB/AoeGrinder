// Arkanes Mal: markiert Mobs, ein anderer Arkan-Treffer lässt das Mal platzen (Haken in core.ts, makeCtx).
// Alle Male zusammen sind ein InstancedMesh, also ein Draw Call.

import * as THREE from 'three';
import { dist2d } from '../util';
import { state } from '../state';
import { scene, camera } from '../render';
import { ringFx } from '../fx/spellFx';
import { mobsInRadius, applySlow, hasRune, makeCtx, onArcaneHit } from './core';
import { burstFx, SHADOW, VOID } from './fx';

const MARK = { dur: 8000, popMul: 0.8, height: 2.9, size: 0.7, max: 256 };   // PH
const LAME = { pct: 0.6, ms: 3000 }, CHAIN_RANGE = 5, BIG = 1.5;             // PH

export const arcmark = {
  name: 'Arkanes Mal', desc: 'Bodenziel: markiert alle Mobs in 6 yd für 8 s. Trifft ein anderer Arkan-Spell, platzt das Mal: +80 % des Treffers als Extra-Schaden.', ranks: ['dmg', 'mana', 'radius'], tags: ['Arkan', 'Fläche', 'Kontrolle'], cls: 'arcane',
  mana: 120, cd: 6000, range: 30, radius: 6, ground: true,   // PH
  runes: [
    { id: 'lame', name: 'Lähmendes Mal', desc: 'Platzen verlangsamt um 60 % für 3 s statt Extra-Schaden.' },
    { id: 'chain', name: 'Kettenmal', desc: 'Platzen markiert 1 Mob in 5 yd neu.' },
    { id: 'big', name: 'Großes Mal', desc: 'Radius ×1,5.', radius: 9 },
  ],
  effect(c, point) {
    const r = c.radius(arcmark.radius) * (hasRune('arcmark', 'big') ? BIG : 1);
    for (const m of mobsInRadius(point, r)) m.markUntil = state.now + MARK.dur;
    ringFx(point, r, SHADOW, 500);
  },
};

// dmg: Schaden des auslösenden Treffers vor Wurf und Rüstung
onArcaneHit((m, id, dmg) => {
  if (id === 'arcmark' || !(m.markUntil > state.now)) return;
  m.markUntil = 0;
  burstFx(m.pos, 1.2, [SHADOW, VOID], 0xb070ff);
  if (hasRune('arcmark', 'lame')) { if (!m.dead) applySlow(m, LAME.pct, LAME.ms); }
  else makeCtx('arcmark').hit(m, dmg * MARK.popMul);
  if (!hasRune('arcmark', 'chain')) return;
  const next = mobsInRadius(m.pos, CHAIN_RANGE).filter(o => o !== m && !(o.markUntil > state.now)).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos))[0];
  if (next) next.markUntil = state.now + MARK.dur;
});

// Runen-Symbol über jedem markierten Mob, zur Kamera gedreht
function glyphTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(32, 12); g.lineTo(32, 52); g.moveTo(32, 22); g.lineTo(18, 36); g.moveTo(32, 30); g.lineTo(46, 42); g.moveTo(20, 50); g.lineTo(44, 50); g.stroke();
  return new THREE.CanvasTexture(cv);
}
let marks: THREE.InstancedMesh = null;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function updateMarks() {
  if (!marks) {
    marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(MARK.size, MARK.size), new THREE.MeshBasicMaterial({ map: glyphTex(), color: new THREE.Color(1.6, 0.6, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), MARK.max);
    marks.frustumCulled = false;
    scene.add(marks);
  }
  let n = 0;
  for (const m of state.mobs) {
    if (n >= MARK.max) break;
    if (m.dead || m.hidden || !(m.markUntil > state.now)) continue;
    const left = (m.markUntil - state.now) / 1000, k = 1 + 0.12 * Math.sin(state.now / 120) * (left < 2 ? 1 : 0.3);   // pulsiert stärker kurz vor dem Ende
    marks.setMatrixAt(n++, _m.compose(_p.set(m.pos.x, m.pos.y + MARK.height, m.pos.z), camera.quaternion, _s.setScalar(k)));
  }
  marks.count = n;
  marks.visible = n > 0;
  marks.instanceMatrix.needsUpdate = true;
}
