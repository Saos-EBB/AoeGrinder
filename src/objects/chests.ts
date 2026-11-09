// Truhen: benutzen (Taste) öffnet in 1 s, ein Treffer oder Weglaufen bricht ab. Inhalt auf den Boden (loot.ts: Staub-Haufen, Waffe).
// 10 % sind ein Mimic: die Truhe wird zum Mob (Kategorie Stark des Themes, eine Stufe drüber) und droppt doppelt. Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from '../state';
import { combatText } from '../ui/hud';
import { particles } from '../fx/particles';
import { zone } from '../world';
import { spawnKind } from '../mobKinds';
import { enterCombat, onMobDeath } from '../mobs';
import { dropDust, dropWeapon } from '../loot';
import { colored } from '../mapgen/build';
import { registerKind, planObjects, redraw, removeObj, addDevButton, devAhead, spawnObj, OBJ, type Obj } from './objects';
import { dist2d, rand } from '../util';
import { t } from '../i18n';

export const CHEST = { perMap: 4, openMs: 1000, mimic: 0.1, dust: [15, 30], weapon: 0.35, mimicLevel: 1 };

function body() {
  const box = new THREE.BoxGeometry(1.4, 0.75, 0.9).translate(0, 0.375, 0);
  const lid = new THREE.CylinderGeometry(0.45, 0.45, 1.42, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(0).translate(0, 0.75, 0);
  const band1 = new THREE.BoxGeometry(0.1, 0.8, 0.94).translate(-0.45, 0.4, 0), band2 = new THREE.BoxGeometry(0.1, 0.8, 0.94).translate(0.45, 0.4, 0);
  const lock = new THREE.BoxGeometry(0.22, 0.26, 0.08).translate(0, 0.62, 0.48);
  return colored([[box, 0x6a4424], [lid, 0x7a5030], [band1, 0xc8a050], [band2, 0xc8a050], [lock, 0xe8c060]]);
}
const DONE = new THREE.Color(0.45, 0.42, 0.4);

const between = ([a, b]: number[]) => Math.round(rand(a, b));
function loot(at: THREE.Vector3, times = 1) {
  for (let i = 0; i < times; i++) {
    dropDust(at, between(CHEST.dust));
    if (Math.random() < CHEST.weapon) dropWeapon(at);
  }
}

function mimic(o: Obj) {
  removeObj(o);
  const pos = new THREE.Vector3(o.x, o.y, o.z);
  for (let i = 0; i < 24; i++) particles.spawn({ x: o.x, y: o.y + 0.6, z: o.z, vx: rand(-4, 4), vy: rand(2, 5), vz: rand(-4, 4), grav: 9, life: 0.7, color: [1.6, 0.4, 0.3], size: rand(0.3, 0.5) });
  const m: any = zone.theme ? spawnKind(zone.theme.id, 'stark', 'none', pos, player.level + CHEST.mimicLevel, ++state.packCounter) : null;
  combatText(pos, t('chest.mimic'), 'crit', 3.2);
  if (!m) return loot(pos, 2);
  m.mimic = true;
  m.keep = true;
  const txt = [...m.plate.childNodes].find((n: any) => n.nodeType === 3);
  if (txt) txt.textContent = ` ${t('chest.mimic')}`;
  m.plate.style.color = '#ff8a6a';
  enterCombat(m, false);
}
onMobDeath(m => { if (m.mimic) loot(m.pos.clone(), 2); });

function finish(o: Obj) {
  o.data.opening = null;
  if (o.data.mimic) return mimic(o);
  o.data.opened = true;
  o.tint = DONE; o.ry = o.data.ry; redraw(o);
  for (let i = 0; i < 20; i++) particles.spawn({ x: o.x, y: o.y + 0.8, z: o.z, vx: rand(-2, 2), vy: rand(2, 5), vz: rand(-2, 2), grav: 8, life: 0.7, color: [2.2, 1.8, 0.8], size: rand(0.25, 0.45) });
  loot(new THREE.Vector3(o.x, o.y, o.z));
}

registerKind({
  id: 'chest', name: 'Truhe', reserve: 8, radius: 1, body,
  init(o, rng) { o.data.mimic = o.data.mimic ?? rng.chance(CHEST.mimic); o.data.ry = o.ry; },
  onUse(o) {
    if (o.data.opened || o.data.opening) return;
    o.data.opening = { start: state.now, hp: player.hp };
  },
  useLabel: o => o.data.opened ? null : o.data.opening ? t('chest.opening', { p: Math.min(99, Math.round((state.now - o.data.opening.start) / CHEST.openMs * 100)) }) : t('chest.open'),
  update(o) {
    const op = o.data.opening;
    if (!op) return;
    if (player.dead || player.hp < op.hp - 0.5 || dist2d(player.pos, o) > OBJ.useR + 1.5) {   // Treffer oder weggelaufen
      o.data.opening = null; o.ry = o.data.ry; redraw(o);
      combatText(player.pos, t('chest.interrupted'), 'miss', 2.4);
      return;
    }
    o.ry = o.data.ry + Math.sin(state.now / 30) * 0.05;   // wackelt beim Öffnen
    redraw(o);
    if (state.now - op.start >= CHEST.openMs) finish(o);
  },
  devTrigger(o) { if (!o.data.opened) finish(o); },
});
planObjects({ kind: 'chest', n: CHEST.perMap, place: 'spots' });

addDevButton('Mimic', () => { const p = devAhead(4), o = spawnObj('chest', p.x, p.z); if (o) { o.data.mimic = true; finish(o); } });
