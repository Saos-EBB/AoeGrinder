// Spielermodell: dünne Hülle um heroModels.ts (Magier und Nahkämpfer) (Quelle ist der Viewer, dort ändern und neu ziehen).
// Der Skin kommt beim Run-Start aus dem Modus; mage bleibt dasselbe Objekt, damit Aufrufer nichts merken.

import * as THREE from 'three';
import { PERF } from '../config';
import { scene } from '../render';
import { activeModIds } from '../modifiers';
import { buildMage, SKINS, buildWarrior, buildSamurai, buildNinja, WEAPONS as WAR_WEAPONS } from './heroModels';
import { buildWeapon } from './weapons/index';
import { weaponUnlocked } from '../meta';

// Standardwaffe pro Skin
const SKIN_WEAPON = { alle: 'pilgerast', frost: 'grenzwaechter', feuer: 'glutrute', arkan: 'zirkelstab' };
const SIT_LIFT = 0.35;     // Figur sackt beim Sitzen und im Tod ab, die Waffe bleibt so über dem Boden, // PH
const WEAPON_STORE = 'frostgrind.weapon.v2';
const chosen = (() => { try { return JSON.parse(localStorage.getItem(WEAPON_STORE) || '{}'); } catch { return {}; } })();
const WAR_WEAPON_STORE = 'frostgrind.warWeapon';
let warWeapon = (() => { try { const w = localStorage.getItem(WAR_WEAPON_STORE); return WAR_WEAPONS.includes(w) ? w : 'sword'; } catch { return 'sword'; } })();
// Nahkämpfer aus heroModels.ts: Treffer-Moment geht an realMen.ts bzw. heroes.ts
const HEROES = { krieger: () => buildWarrior({ bloom: PERF.bloom, weapon: warWeapon }), samurai: () => buildSamurai({ bloom: PERF.bloom }), ninja: () => buildNinja({ bloom: PERF.bloom }) };
const STAFF_FOOT = 0.85;   // so weit reicht ein Stab unter die Hand, sonst steckt er im Boden (Maß des Viewer-Stabs)

// Der eingebaute Stab weicht der Waffe. Sein Gelenk bleibt: Das Modell hält es in jeder Pose aufrecht.
for (const [id, C] of Object.entries<any>(SKINS)) SKINS[id] = { ...C, addons(R, M, CC) {
  C.addons?.(R, M, CC);
  for (const o of [...R.staff.children]) if (o !== R.crystal && o !== R.crystalGlow) R.staff.remove(o);
  R.crystal.visible = R.crystalGlow.visible = false;
} };

const NO_FX = {};
const hitHandlers = [];
// Treffer-Moment der Nahkampf-Animationen (realMen.ts, heroes.ts)
export function onWarriorHit(fn) { hitHandlers.push(fn); }

let cur = null, skin = null, weapon = null, mount = null, clock = 0, lift = 0;

function dispose(m) {
  weapon?.dispose();
  weapon = null;
  if (m.fx.group) {                           // Krieger: Bodeneffekte und Wirbel haben eigene Texturen
    scene.remove(m.fx.group);
    m.fx.group.traverse(o => { if (o.isMesh) { o.material.map.dispose(); o.material.dispose(); o.geometry.dispose(); } });
    m.root.traverse(o => { if (o.userData.keep) o.material.map?.dispose(); });
  }
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
    return;
  }
  cur = buildMage(id, { bloom: PERF.bloom });
  scene.add(cur.root);
  if (cur.trail) scene.add(cur.trail.mesh);   // Spuren liegen in Weltkoordinaten
  mount = new THREE.Group();
  cur.anchors.crystal.parent.add(mount);
  wield(chosen[id] && weaponUnlocked(chosen[id]) ? chosen[id] : SKIN_WEAPON[id]);
}

function wield(id) {
  if (HEROES[skin]) return;                   // Nahkämpfer tragen ihre Waffen fest
  weapon?.dispose();
  weapon = buildWeapon(id);
  mount.add(weapon.root);
  mount.rotation.set(weapon.pitch, weapon.yaw, 0);
}

const skinForRun = () => { const ids = activeModIds(); return ids.includes('frost') ? 'frost' : ids.includes('fire') ? 'feuer' : ids.includes('arcane') ? 'arkan' : ids.includes('realmen') ? 'krieger' : ids.includes('ronin') ? 'samurai' : ids.includes('schatten') ? 'ninja' : 'alle'; };

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
  get weapon() { return weapon; },
  get warWeapon() { return warWeapon; },
  rate: 1,                                        // Animationstempo der Nahkämpfer (Blutrausch)
  setWarWeapon(id) {                              // Real Men: Waffenwahl vor dem Run, bleibt gespeichert
    warWeapon = id;
    try { localStorage.setItem(WAR_WEAPON_STORE, id); } catch { /* egal */ }
    if (skin === 'krieger') setSkin('krieger');
  },
  setSkin,
  setWeapon(id) {                                 // Wahl im Hauptmenü, gilt pro Skin und bleibt gespeichert
    chosen[skin] = id;
    try { localStorage.setItem(WEAPON_STORE, JSON.stringify(chosen)); } catch { /* egal */ }
    wield(id);
  },
  // Sekunden: das Modell hält Werte ≤ 1 dafür, ms unter 1 würden sonst falsch gelesen.
  // Der erste Frame kann ein negatives dt haben (rAF-Zeit liegt vor performance.now), das Modell verträgt das nicht.
  update(dt, anim) {
    const s = Math.max(0, dt) / 1000;
    cur.update(HEROES[skin] ? s * mage.rate : s, anim);
    if (!weapon) return;
    clock += s;
    lift += ((anim.state === 'sit' || anim.state === 'dead' ? SIT_LIFT : 0) - lift) * Math.min(1, s * 6);
    mount.position.y = (weapon.cane ? weapon.gripY - STAFF_FOOT : 0) + lift;
    weapon.combat = !!anim.channel || anim.cast > 0;
    weapon.update(s, clock);
  },
};

setSkin(skinForRun());
