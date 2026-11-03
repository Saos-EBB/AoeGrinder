// Spielermodell: dünne Hülle um die Figuren der Viewer (strichMagier.ts, strichKrieger.ts, klingeModel.ts).
// Der Skin kommt beim Run-Start aus dem Modus; mage bleibt dasselbe Objekt, damit Aufrufer nichts merken.

import * as THREE from 'three';
import { PERF } from '../config';
import { scene } from '../render';
import { activeModIds } from '../modifiers';
import { buildStrichMagier } from './strichMagier';
import { buildKlinge } from './klingeModel';
import { buildStrichKrieger } from './strichKrieger';
import { buildWeapon } from './weapons/index';
import { equippedModel } from '../weaponRolls';

// Nahkämpfer: Treffer-Moment geht an realMen.ts bzw. klinge.ts
const HEROES = { krieger: () => buildStrichKrieger({ bloom: PERF.bloom }), klinge: () => buildKlinge({ bloom: PERF.bloom }) };
const STAFF_FOOT = 0.85;   // so weit reicht ein Stab unter die Hand, sonst steckt er im Boden (Maß des Viewer-Stabs)

const NO_FX = {};
const hitHandlers = [];
// Treffer-Moment der Nahkampf-Animationen (realMen.ts, klinge.ts)
export function onWarriorHit(fn) { hitHandlers.push(fn); }

// Feste Waffe der Nahkämpfer aus models/weapons. scale: Größe, tip/grip: Spitze und linke Hand ab dem Griff in Waffen-Maß // PH
const HERO_WEAPON = { krieger: { id: 'schlachtblech', scale: 1.25, tip: 1.9, grip: 0.2 } };
let cur = null, skin = null, weapon = null, heroWeapon = null, mount = null, clock = 0;

function dispose(m) {
  weapon?.dispose();
  heroWeapon?.dispose();
  weapon = heroWeapon = null;
  if (m.fx.group) {                           // Krieger: Bodeneffekte und Wirbel haben eigene Texturen
    scene.remove(m.fx.group);
    m.fx.group.traverse(o => { if (o.isMesh) { o.material.map?.dispose(); o.material.dispose(); o.geometry.dispose(); } });
    m.root.traverse(o => { if (o.userData.keep) o.material.map?.dispose(); });
  }
  if (m.scarf) { scene.remove(m.scarf); m.scarf.geometry.dispose(); m.scarf.material.dispose(); }   // Klingenstrich: Band in Weltkoordinaten
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
  if (HEROES[id]) {
    cur = HEROES[id]();
    cur.onHit = (kind, x, z, i) => { for (const fn of hitHandlers) fn(kind, x, z, i); };
    scene.add(cur.root, cur.fx.group);
    if (cur.scarf) scene.add(cur.scarf);
    const hw = HERO_WEAPON[id];
    if (hw) { heroWeapon = buildWeapon(hw.id); cur.setWeapon(heroWeapon, hw.scale, hw.tip, hw.grip); }
    return;
  }
  cur = buildStrichMagier(id, { bloom: PERF.bloom });
  scene.add(cur.root, cur.scarf);
  if (cur.trail) scene.add(cur.trail.mesh);   // Spuren liegen in Weltkoordinaten
  mount = new THREE.Group();
  cur.anchors.crystal.parent.add(mount);
  wield(equippedModel());   // Waffe aus dem Inventar, leer: Pilgerast
}

function wield(id) {
  if (HEROES[skin]) return;                   // Nahkämpfer tragen ihre Waffen fest
  weapon?.dispose();
  weapon = buildWeapon(id);
  mount.add(weapon.root);
  mount.rotation.set(weapon.pitch, weapon.yaw, 0);
}

const skinForRun = () => { const ids = activeModIds(); return ids.includes('frost') ? 'frost' : ids.includes('fire') ? 'feuer' : ids.includes('arcane') ? 'arkan' : ids.includes('realmen') ? 'krieger' : ids.includes('klinge') ? 'klinge' : 'alle'; };

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
  get anchors() { return weapon ? { ...cur.anchors, crystal: weapon.glowAnchor } : cur.anchors; },
  get trail() { return cur.trail; },
  get fx() { return HEROES[skin] ? NO_FX : cur.fx; },   // bei Nahkämpfern ist cur.fx die Effektgruppe, keine Spielregeln
  get skin() { return skin; },
  get hero() { return cur; },                     // Klingenstrich: Effekte und Haltung des Modells
  get weapon() { return weapon; },
  setSkin,
  refreshWeapon() { wield(equippedModel()); },   // Wahl im Hauptmenü
  // Sekunden: das Modell hält Werte ≤ 1 dafür, ms unter 1 würden sonst falsch gelesen.
  // Der erste Frame kann ein negatives dt haben (rAF-Zeit liegt vor performance.now), das Modell verträgt das nicht.
  update(dt, anim) {
    const s = Math.max(0, dt) / 1000;
    cur.update(s, anim);
    clock += s;
    if (heroWeapon) { heroWeapon.combat = !!anim.ability; heroWeapon.update(s, clock); }
    if (!weapon) return;
    mount.position.y = weapon.cane ? weapon.gripY - STAFF_FOOT : 0;   // beim Sitzen legen die Strichmagier den Stab ab, das Gelenk trägt ihn
    weapon.combat = !!anim.channel || anim.cast > 0;
    weapon.update(s, clock);
  },
};

setSkin(skinForRun());
