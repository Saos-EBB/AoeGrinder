// Spielermodell: dünne Hülle um mageModel.ts (Quelle ist der Viewer, dort ändern und neu ziehen).
// Der Skin kommt beim Run-Start aus dem Modus; mage bleibt dasselbe Objekt, damit Aufrufer nichts merken.

import * as THREE from 'three';
import { PERF } from '../config';
import { scene } from '../render';
import { activeModIds } from '../modifiers';
import { buildMage, SKINS } from './mageModel';
import { buildWeapon } from './weapons/index';
import { initWeaponMenu } from './weapons/menu';

// Standardwaffe pro Skin
const SKIN_WEAPON = { alle: 'pilgerast', frost: 'grenzwaechter', feuer: 'glutrute', arkan: 'zirkelstab' };
const STAFF_FOOT = 0.85;   // so weit reicht ein Stab unter die Hand, sonst steckt er im Boden (Maß des Viewer-Stabs)

// Der eingebaute Stab weicht der Waffe. Sein Gelenk bleibt: Das Modell hält es in jeder Pose aufrecht.
for (const [id, C] of Object.entries<any>(SKINS)) SKINS[id] = { ...C, addons(R, M, CC) {
  C.addons?.(R, M, CC);
  for (const o of [...R.staff.children]) if (o !== R.crystal && o !== R.crystalGlow) R.staff.remove(o);
  R.crystal.visible = R.crystalGlow.visible = false;
} };

let cur = null, skin = null, weapon = null, mount = null, clock = 0, refreshMenu = () => {};

function dispose(m) {
  weapon.dispose();
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
  mount = new THREE.Group();
  cur.anchors.crystal.parent.add(mount);
  wield(SKIN_WEAPON[id]);
  refreshMenu();
}

function wield(id) {
  weapon?.dispose();
  weapon = buildWeapon(id);
  mount.add(weapon.root);
  mount.position.y = weapon.cane ? weapon.gripY - STAFF_FOOT : 0;
  mount.rotation.set(weapon.pitch, weapon.yaw, 0);
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
  get anchors() { return { ...cur.anchors, crystal: weapon.glowAnchor }; },
  get trail() { return cur.trail; },
  get fx() { return cur.fx; },
  get skin() { return skin; },
  get weapon() { return weapon; },
  setSkin,
  setWeapon: wield,
  // Sekunden: das Modell hält Werte ≤ 1 dafür, ms unter 1 würden sonst falsch gelesen.
  // Der erste Frame kann ein negatives dt haben (rAF-Zeit liegt vor performance.now), das Modell verträgt das nicht.
  update(dt, anim) {
    const s = Math.max(0, dt) / 1000;
    cur.update(s, anim);
    clock += s;
    weapon.combat = !!anim.channel || anim.cast > 0;
    weapon.update(s, clock);
  },
};

setSkin(skinForRun());
refreshMenu = initWeaponMenu(mage);
