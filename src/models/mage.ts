// Spielermodell: dünne Hülle um die Figuren der Viewer (strichMagier.ts, strichKrieger.ts).
// Der Skin kommt beim Run-Start aus dem Modus; mage bleibt dasselbe Objekt, damit Aufrufer nichts merken.

import * as THREE from 'three';
import { PERF } from '../config';
import { scene } from '../render';
import { activeModIds } from '../modifiers';
import { buildStrichMagier } from './strichMagier';
import { buildStrichKrieger } from './strichKrieger';
import { buildWeapon } from './weapons/index';
import { buildWeaponOf, equipped, elementOf } from '../weaponRolls';
import { ELEMENTS } from './weapons/baukasten';
import { particles } from '../fx/particles';
import { warLegendary } from '../realMen';
import { skinOf } from '../meta';
import { figurOf, STANDARD } from '../skins';

// Nahkämpfer: Treffer-Moment geht an realMen.ts
// Strichkrieger: Waffe vor dem Run (Riesenschwert, Holzfälleraxt, Streitkolben), bleibt gespeichert
const WAR_WEAPON_STORE = 'frostgrind.warWeapon';
const WAR_WEAPONS = ['sword'];   // Axt und Kolben sind raus (v31); legendäre Waffen hängen am Feld legendary in realMen.ts
const warBase = w => (WAR_WEAPONS.includes(w) ? w : 'sword');
let warWeapon = (() => { try { const w = localStorage.getItem(WAR_WEAPON_STORE); return WAR_WEAPONS.includes(w) ? w : 'sword'; } catch { return 'sword'; } })();
const HEROES = { krieger: (look: string) => buildStrichKrieger({ bloom: PERF.bloom, weapon: warBase(warWeapon), look }) };
const STAFF_FOOT = 0.85;   // so weit reicht ein Stab unter die Hand, sonst steckt er im Boden (Maß des Viewer-Stabs)

const NO_FX = {};
// Liste an einer Funktions-Deklaration: existiert schon, wenn ein Import-Kreis realMen.ts vor dieser Datei auswertet (vfx.html)
function hitHandlers(): any[] { return (hitHandlers as any).list ??= []; }
// Treffer-Moment der Nahkampf-Animationen (realMen.ts)
export function onWarriorHit(fn) { hitHandlers().push(fn); }

// Feste Waffe der Nahkämpfer aus models/weapons. scale: Größe, tip/grip: Spitze und linke Hand ab dem Griff in Waffen-Maß // PH
const HERO_WEAPON = { krieger: { id: 'schlachtblech', scale: 1.25, tip: 1.9, grip: 0.2, glow: [0.1, 0.008, 0.005], rim: [0.55, 0.05, 0.03], rimPower: 2.4 } };
// Legendäre Waffe des Strichkriegers (realMen.ts, Feld legendary) ersetzt das Schlachtblech // PH
const LEGEND_WEAPON = {
  leeroy: { id: 'leeroyklinge', scale: 1.25, tip: 1.85, grip: 0.2, glow: [0.03, 0.03, 0.035], rim: [0.3, 0.12, 0.05], rimPower: 3 },   // Stahl soll Stahl bleiben: wenig Rot
  sion: { id: 'sionaxt', scale: 1.25, tip: 1.6, grip: 0.25, glow: [0.08, 0.005, 0.005], rim: [0.6, 0.04, 0.03], rimPower: 2.2 },
};
const heroWeaponOf = id => (id === 'krieger' && LEGEND_WEAPON[warLegendary()]) || HERO_WEAPON[id];
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
// look: Skin aus skins.ts (Standard, Hochspannung, Ausbrecher …), getrennt vom Schul-Look skin. Krieger-Skins hängen an der Waffe (legendär oder Basis)
let look = STANDARD;
const lookWeapon = id => (id === 'krieger' ? warLegendary() ?? warBase(warWeapon) : null);
const lookOf = id => skinOf(figurOf(id), lookWeapon(id));

// Funken des Waffen-Elements (strichMagier.ts): ins Partikel-System des Spiels, das zeichnet mit Waffe ohnehin (Glimmen am Stab, fx/spellFx.ts)
const SPARK = { vy: .5, life: [.42, .84], size: .14, grav: -.3, spread: .12, bright: 1.6 };   // Werte der Viewer-Partikel, bright wie die Relikt-Aura // PH
const sparkCol = new THREE.Color();
function spark(p, color) {
  sparkCol.setHex(color);
  const j = () => (Math.random() - .5) * SPARK.spread, life = SPARK.life[0] + Math.random() * (SPARK.life[1] - SPARK.life[0]);
  particles.spawn({ x: p.x + j(), y: p.y + j(), z: p.z + j(), vx: (Math.random() - .5) * .6, vy: SPARK.vy + (Math.random() - .5) * .4, vz: (Math.random() - .5) * .6, life, color: [sparkCol.r * SPARK.bright, sparkCol.g * SPARK.bright, sparkCol.b * SPARK.bright], size: SPARK.size, grav: SPARK.grav });
}

// Element der ausgerüsteten Waffe für die Farbe der Strichmagier. Nicht in ELEMENTS (alte Waffen, alte Elemente) = kein Element
// Waffenmenü: gewählte Waffe zur Probe in der Hand, ohne sie auszurüsten (null = ausgerüstete)
let preview = null;
const shownWeapon = () => preview ?? equipped();
function weaponElement() {
  const w = shownWeapon(), el = w ? elementOf(w) : 'none';
  return el !== 'none' && Object.hasOwn(ELEMENTS, el) ? el : null;
}

// rebuild: Neubau bei Waffenwechsel, Waffe und Spur bleiben
function dispose(m, rebuild = false) {
  if (!rebuild) {
    weapon?.dispose();
    heroWeapon?.dispose();
    weapon = heroWeapon = null;
  }
  if (m.fx.group) {                           // Krieger: Bodeneffekte und Wirbel haben eigene Texturen
    scene.remove(m.fx.group);
    m.fx.group.traverse(o => { if (o.isMesh) { o.material.map?.dispose(); o.material.dispose(); o.geometry.dispose(); } });
    m.root.traverse(o => { if (o.userData.keep) o.material.map?.dispose(); });
  }
  if (m.scarf) { scene.remove(m.scarf); m.scarf.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry.dispose(); o.material.dispose(); } }); }   // Band (Klingenstrich) oder Effekt-Gruppe (Strichmagier) in Weltkoordinaten
  scene.remove(m.root);
  m.root.traverse(o => {
    if (o.isSkinnedMesh) o.skeleton.dispose();
    if (o.isMesh) o.geometry.dispose();
    if (o.material) o.material.dispose();     // Atlanten sind im Modell gecacht und bleiben
  });
  if (m.trail && !rebuild) {
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
  look = lookOf(id);
  if (HEROES[id]) {
    cur = HEROES[id](look);
    cur.onHit = (kind, x, z, i) => { for (const fn of hitHandlers()) fn(kind, x, z, i); };
    scene.add(cur.root, cur.fx.group);
    if (cur.scarf) scene.add(cur.scarf);
    const hw = id === 'krieger' && warBase(warWeapon) !== 'sword' ? null : heroWeaponOf(id);
    if (hw) { heroWeapon = buildWeapon(hw.id); tintWeapon(heroWeapon, hw); cur.setWeapon(heroWeapon, hw.scale, hw.tip, hw.grip); }
    return;
  }
  cur = buildStrichMagier(id, weaponElement(), { spark, look });
  scene.add(cur.root, cur.scarf);
  if (cur.trail) scene.add(cur.trail.mesh);   // Spuren liegen in Weltkoordinaten
  mount = new THREE.Group();
  cur.anchors.crystal.parent.add(mount);
  wield();   // Waffe aus dem Inventar, leer: Pilgerast
}

// Waffenwechsel mit anderem Element: Strichmagier neu bauen (selten), Spur, Animation, Anzeige, Lage und Waffen-Halter übernehmen
function recolor() {
  const el = weaponElement();
  if (HEROES[skin] || cur.element === el) return;
  const old = cur, st = old.animState;
  cur = buildStrichMagier(skin, el, { trail: old.trail, spark, look });
  cur.adoptAnim(st);
  cur.root.position.copy(old.root.position); cur.root.quaternion.copy(old.root.quaternion); cur.root.scale.copy(old.root.scale);
  cur.anchors.crystal.parent.add(mount);
  dispose(old, true);
  scene.add(cur.root, cur.scarf);
}

function wield() {
  if (HEROES[skin]) return;                   // Nahkämpfer tragen ihre Waffen fest
  recolor();
  weapon?.dispose();
  weapon = buildWeaponOf(shownWeapon());
  mount.add(weapon.root);
  mount.rotation.set(weapon.pitch, weapon.yaw, 0);
}

const skinForRun = () => { const ids = activeModIds(); return ids.includes('frost') ? 'frost' : ids.includes('fire') ? 'feuer' : ids.includes('blitz') ? 'blitz' : ids.includes('plague') ? 'blut' : ids.includes('realmen') ? 'krieger' : 'zufall'; };   // Zuhälter-Look 'alle' bleibt im Code, Kevins Skin

// Run-Start: gleicher Skin ohne Spuren bleibt stehen, sonst neu bauen (leert auch alte Spuren)
export function startMageRun() {
  const id = skinForRun();
  if (id !== skin || cur.trail || lookOf(id) !== look || (HEROES[id] && heroWeapon?.id !== heroWeaponOf(id)?.id)) setSkin(id);   // auch, wenn die legendäre Waffe oder der Skin gewechselt hat
  else recolor();                             // Waffe mit anderem Element seit dem letzten Bau
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
  get look() { return look; },
  get lookWeapon() { return lookWeapon(skin); },   // Waffe, an der die Krieger-Skins hängen (Magier: null)
  refreshLook() { if (lookOf(skin) !== look) setSkin(skin); },   // Skin-Wahl im Hauptmenü, Spielstand-Code
  get hero() { return cur; },
  get warWeapon() { return warWeapon; },
  setWarWeapon(id) {
    warWeapon = id;
    try { localStorage.setItem(WAR_WEAPON_STORE, id); } catch { /* egal */ }
    if (skin === 'krieger') setSkin('krieger');
  },
  get weapon() { return weapon; },
  setSkin,
  refreshWeapon() { wield(); },   // Wahl im Hauptmenü
  previewWeapon(w) { if (preview === w) return; preview = w; wield(); },   // Waffenmenü: Probe tragen, null = zurück zur ausgerüsteten
  // Anzeige 0 … 1 für die Stufen-Effekte der Strichmagier (Hitze, Kälte, Ladungen, Batterie)
  setMeter(v) { cur.setMeter?.(v); },
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
