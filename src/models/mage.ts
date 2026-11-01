// Spielermodell: dünne Hülle um mageModel.ts (Quelle ist der Viewer, dort ändern und neu ziehen).
// Der Skin kommt beim Run-Start aus dem Modus; mage bleibt dasselbe Objekt, damit Aufrufer nichts merken.

import { PERF } from '../config';
import { scene } from '../render';
import { activeModIds } from '../modifiers';
import { buildMage } from './mageModel';

let cur = null, skin = null;

function dispose(m) {
  scene.remove(m.root);
  m.root.traverse(o => {
    if (o.isSkinnedMesh) o.skeleton.dispose();
    if (o.isMesh) o.geometry.dispose();
    if (o.material) o.material.dispose();     // Atlanten sind im Modell gecacht und bleiben
  });
  if (m.trail) {
    scene.remove(m.trail.mesh);
    m.trail.mesh.material.map.dispose();
    m.trail.mesh.material.dispose();
    m.trail.mesh.geometry.dispose();
    m.trail.mesh.dispose();
  }
}

function setSkin(id) {
  if (cur) dispose(cur);
  skin = id;
  cur = buildMage(id, { bloom: PERF.bloom });
  scene.add(cur.root);
  if (cur.trail) scene.add(cur.trail.mesh);   // Spuren liegen in Weltkoordinaten
}

// Noch kein Arkan-Modus: 'arkan' ist nur über __game.mage.setSkin erreichbar
const skinForRun = () => { const ids = activeModIds(); return ids.includes('frost') ? 'frost' : ids.includes('fire') ? 'feuer' : 'alle'; };

// Run-Start: gleicher Skin ohne Spuren bleibt stehen, sonst neu bauen (leert auch alte Spuren)
export function startMageRun() {
  const id = skinForRun();
  if (id !== skin || cur.trail) setSkin(id);
}
// Run-Ende: Spuren raus aus der Szene
export function endMageRun() {
  if (cur.trail) scene.remove(cur.trail.mesh);
}

export const mage = {
  get root() { return cur.root; },
  get anchors() { return cur.anchors; },
  get trail() { return cur.trail; },
  get fx() { return cur.fx; },
  get skin() { return skin; },
  setSkin,
  // Sekunden: das Modell hält Werte ≤ 1 dafür, ms unter 1 würden sonst falsch gelesen.
  // Der erste Frame kann ein negatives dt haben (rAF-Zeit liegt vor performance.now), das Modell verträgt das nicht.
  update(dt, anim) { cur.update(Math.max(0, dt) / 1000, anim); },
};

setSkin(skinForRun());
