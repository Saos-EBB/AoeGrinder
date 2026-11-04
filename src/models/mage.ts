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
import { buildEquipped } from '../weaponRolls';

// Nahkämpfer: Treffer-Moment geht an realMen.ts bzw. klinge.ts
// Strichkrieger: Waffe vor dem Run (Riesenschwert, Holzfälleraxt, Streitkolben), bleibt gespeichert
const WAR_WEAPON_STORE = 'frostgrind.warWeapon';
const WAR_WEAPONS = ['sword', 'axe', 'mace'];
let warWeapon = (() => { try { const w = localStorage.getItem(WAR_WEAPON_STORE); return WAR_WEAPONS.includes(w) ? w : 'sword'; } catch { return 'sword'; } })();
const HEROES = { krieger: () => buildStrichKrieger({ bloom: PERF.bloom, weapon: warWeapon }), klinge: () => buildKlinge({ bloom: PERF.bloom }) };
const STAFF_FOOT = 0.85;   // so weit reicht ein Stab unter die Hand, sonst steckt er im Boden (Maß des Viewer-Stabs)

const NO_FX = {};
// Liste an einer Funktions-Deklaration: existiert schon, wenn ein Import-Kreis klinge.ts/realMen.ts vor dieser Datei auswertet (vfx.html)
function hitHandlers(): any[] { return (hitHandlers as any).list ??= []; }
// Treffer-Moment der Nahkampf-Animationen (realMen.ts, klinge.ts)
export function onWarriorHit(fn) { hitHandlers().push(fn); }

// Feste Waffe der Nahkämpfer aus models/weapons. scale: Größe, tip/grip: Spitze und linke Hand ab dem Griff in Waffen-Maß // PH
const HERO_WEAPON = { krieger: { id: 'schlachtblech', scale: 1.25, tip: 1.9, grip: 0.2, glow: [0.1, 0.008, 0.005], rim: [0.55, 0.05, 0.03], rimPower: 2.4 } };
// Leichter roter Schein auf der Klinge, damit sie im Dunkeln lesbar bleibt: Grundglühen plus roter Rand
function tintWeapon(w, hw) {
  w.root.traverse(o => {
    const m = o.material;
    if (!o.isMesh || !m?.isMeshLambertMaterial || m.userData.tinted) return;
    m.userData.tinted = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (s, r) => {
      prev?.call(m, s, r);
      s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
        `outgoingLight += vec3(${hw.glow.join(',')}) + vec3(${hw.rim.join(',')}) * pow(1.0 - saturate(abs(dot(normalize(normal), normalize(vViewPosition)))), ${hw.rimPower.toFixed(1)});\n#include <opaque_fragment>`);
    };
    const key = m.customProgramCacheKey?.() ?? '';
    m.customProgramCacheKey = () => `${key}|redGlow`;
    m.needsUpdate = true;
  });
}
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
    cur.onHit = (kind, x, z, i) => { for (const fn of hitHandlers()) fn(kind, x, z, i); };
    scene.add(cur.root, cur.fx.group);
    if (cur.scarf) scene.add(cur.scarf);
    const hw = id === 'krieger' && warWeapon !== 'sword' ? null : HERO_WEAPON[id];   // Axt und Kolben baut das Modell selbst
    if (hw) { heroWeapon = buildWeapon(hw.id); tintWeapon(heroWeapon, hw); cur.setWeapon(heroWeapon, hw.scale, hw.tip, hw.grip); }
    return;
  }
  cur = buildStrichMagier(id);
  scene.add(cur.root, cur.scarf);
  if (cur.trail) scene.add(cur.trail.mesh);   // Spuren liegen in Weltkoordinaten
  mount = new THREE.Group();
  cur.anchors.crystal.parent.add(mount);
  wield();   // Waffe aus dem Inventar, leer: Pilgerast
}

function wield() {
  if (HEROES[skin]) return;                   // Nahkämpfer tragen ihre Waffen fest
  weapon?.dispose();
  weapon = buildEquipped();
  mount.add(weapon.root);
  mount.rotation.set(weapon.pitch, weapon.yaw, 0);
}

const skinForRun = () => { const ids = activeModIds(); return ids.includes('frost') ? 'frost' : ids.includes('fire') ? 'feuer' : ids.includes('arcane') ? 'arkan' : ids.includes('blitz') ? 'blitz' : ids.includes('blood') ? 'blut' : ids.includes('realmen') ? 'krieger' : ids.includes('klinge') ? 'klinge' : 'zufall'; };   // Zuhälter-Look 'alle' bleibt im Code, Kevins Skin

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
  get hero() { return cur; },
  get warWeapon() { return warWeapon; },
  setWarWeapon(id) {
    warWeapon = id;
    try { localStorage.setItem(WAR_WEAPON_STORE, id); } catch { /* egal */ }
    if (skin === 'krieger') setSkin('krieger');
  },                     // Klingenstrich: Effekte und Haltung des Modells
  get weapon() { return weapon; },
  setSkin,
  refreshWeapon() { wield(); },   // Wahl im Hauptmenü
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
