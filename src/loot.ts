// Gear-Drops im Run (Handoff docs/handoffs/items.md Schritt 2), nur Magier. Ziel: im Schnitt ~25 Drops pro vollem Run (Level 100).
// Boss: 2 Teile sicher (boss.ts endBoss), Champion-Pack: 1 Teil mit 50 % beim letzten Champion, normale Kills: DROP.kill pro Kill.
// Optik: Lichtsäule aus Partikeln in Seltenheitsfarbe (vorhandenes Partikel-System, kein Draw Call extra), Aufheben beim Drüberlaufen.
// Aufgehobene Teile landen sofort im Spielstand (gear.ts takeGear), bleiben also auch beim Tod. Liste der Funde: state.finds, gezeigt im Run-Ende.
// Map-Umbau Teil 2 (Phase 3) baut hierauf auf, kein zweites Drop-System: Staub-Haufen (Aufheben im Lauf-Radius DROP.dustR) und Waffen
// (weaponRolls.ts rollWeapon, Seltenheit nach Theme-Schwierigkeit, Aufheben per Taste „Benutzen“, Inventar wie heute ROLLS.invMax), beide mit Lichtsäule.
// Quellen: Truhen, Mimic, Schatzdieb (objects/), Champions (Staub sicher), Große (Staub sicher + 25 % Waffe). Normale Kills unverändert (DROP.dustKill 0).

import * as THREE from 'three';
import { state, player } from './state';
import { onMobDeath } from './mobs';
import { particles } from './fx/particles';
import { combatText } from './ui/hud';
import { mage } from './models/mage';
import { rollDrop, takeGear, gearName, gearRarity, isMagierSkin, type GearItem } from './gear';
import { dist2d, rand } from './util';
import { t } from './i18n';
import { meta, saveMeta } from './meta';
import { CARD_RARITIES } from './config';
import { rollWeapon, rollTier, weaponName, inventoryFull, ROLLS } from './weaponRolls';
import { zone } from './world';
import { addUseSource } from './useKey';

// Alle Zahlen PH. kill: gemessen per Skript (docs/handoffs/items.md, Test), Schnitt ~25 pro Run bis Level 100
export const DROP = {
  kill: 0.0005, champ: 0.5, boss: 2,   // kill: Boss (7 × 2) und Champions (~23 Packs × 50 %) geben schon ~26, Kills nur noch selten (Skript: ~1640 Kills/Run)
  pickR: 2.5,                         // yd: so nah drüberlaufen hebt auf
  spread: 1.5,                        // yd um den Mob
  beamMs: 70, beam: { vy: 3, life: 0.9, size: 0.45, bright: 1.8 },   // Lichtsäule: alle beamMs ein Partikel, steigt ~2,7 yd
  popN: 14,                           // Funken beim Erscheinen
  dustR: 2,                           // yd: Staub-Haufen hebt man im Lauf-Radius auf (Handoff map-umbau-2)
  dustKill: 0,                        // Handoff: 2 % Staub pro normalem Kill. Kevin: Drop-Raten normaler Kills bleiben, er balanciert später → 0
  champDust: [6, 12], bigDust: [8, 16], bigWeapon: 0.25,   // Champion-Pack (letzter Champion) und Große: Staub sicher, Große 25 % Waffe
  tierUp: 0.15,                       // Waffen: pro Theme-Schwierigkeit über 1 diese Chance auf eine Seltenheit höher
  dustColor: '#e8d8a8', dustBeam: { vy: 1.6, life: 0.6, size: 0.35, bright: 1.4 },
};
export interface Find { item: GearItem; dust: number; over: boolean }
type Drop = { kind: 'gear' | 'dust' | 'weapon'; item?: GearItem; dust?: number; weapon?: any; pos: THREE.Vector3; next: number; color: number[] };
let drops: Drop[] = [];

const rgb = (hex: string, k = 1) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k]; };
const canDrop = () => isMagierSkin(mage.skin) && !player.dead;

function place(at: THREE.Vector3, d: Omit<Drop, 'pos' | 'next'>) {
  const a = rand(0, Math.PI * 2), r = rand(0, DROP.spread);
  const pos = new THREE.Vector3(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r), color = d.color;
  drops.push({ ...d, pos, next: 0 });
  for (let i = 0; i < DROP.popN; i++) {
    const b = rand(0, Math.PI * 2), v = rand(1, 3);
    particles.spawn({ x: pos.x, y: pos.y + 0.3, z: pos.z, vx: Math.cos(b) * v, vy: rand(2, 4), vz: Math.sin(b) * v, grav: 8, life: 0.6, color, size: 0.3 });
  }
}
function spawnDrop(at: THREE.Vector3) {
  const item = rollDrop(mage.skin);
  place(at, { kind: 'gear', item, color: rgb(gearRarity(item).color, DROP.beam.bright) });
}
// Staub-Haufen: n Knochenstaub, kleine Säule in Knochenfarbe
export function dropDust(at: THREE.Vector3, n: number) {
  if (n > 0) place(at, { kind: 'dust', dust: Math.round(n), color: rgb(DROP.dustColor, DROP.dustBeam.bright) });
}
// Waffe: Seltenheit wie die Waffen-Kiste, je Theme-Schwierigkeit über 1 mit DROP.tierUp eine Stufe höher. Nur Magier (Waffen-Baukasten), sonst Staub
export function dropWeapon(at: THREE.Vector3) {
  if (!isMagierSkin(mage.skin)) return dropDust(at, ROLLS.refund[rollTier()]);
  let tier = rollTier();
  for (let d = 1; d < (zone.theme?.difficulty ?? 1); d++) if (Math.random() < DROP.tierUp) tier = Math.min(CARD_RARITIES.length - 1, tier + 1);
  const weapon = rollWeapon(tier);
  place(at, { kind: 'weapon', weapon, color: rgb(CARD_RARITIES[weapon.r].color, DROP.beam.bright) });
}
const between = ([a, b]: number[]) => Math.round(rand(a, b));

// Normale Kills und Champions. Boss-Körper und Spiegelbilder (xpMul 0) droppen hier nicht
onMobDeath(m => {
  if (player.dead || m.boss || m.xpMul === 0 || m.type?.noXp) return;
  const lastChamp = m.champion && !state.mobs.some(o => o !== m && !o.dead && o.champion && o.packId === m.packId);
  if (lastChamp) dropDust(m.pos, between(DROP.champDust));
  if (m.kind?.cat === 'gross') { dropDust(m.pos, between(DROP.bigDust)); if (Math.random() < DROP.bigWeapon) dropWeapon(m.pos); }
  if (Math.random() < DROP.dustKill) dropDust(m.pos, 1);
  if (!canDrop()) return;
  if (Math.random() < DROP.kill) spawnDrop(m.pos);
  if (lastChamp && Math.random() < DROP.champ) spawnDrop(m.pos);
});
// boss.ts endBoss
export function bossDrops(pos: THREE.Vector3) {
  if (!canDrop()) return;
  for (let i = 0; i < DROP.boss; i++) spawnDrop(pos);
}

// Jeden Frame aus main.ts: Lichtsäulen, Aufheben
export function updateLoot() {
  if (!drops.length) return;
  const B = DROP.beam;
  drops = drops.filter(d => {
    if (state.now >= d.next) {
      const b = d.kind === 'dust' ? DROP.dustBeam : B;
      d.next = state.now + DROP.beamMs;
      particles.spawn({ x: d.pos.x + rand(-0.08, 0.08), y: d.pos.y + 0.1, z: d.pos.z + rand(-0.08, 0.08), vy: b.vy, life: b.life, color: d.color, size: b.size });
    }
    if (d.kind === 'weapon' || player.dead || dist2d(player.pos, d.pos) > (d.kind === 'dust' ? DROP.dustR : DROP.pickR)) return true;   // Waffe: per Taste
    pickUp(d);
    return false;
  });
}
function pickUp(d: Drop, auto = false) {
  if (d.kind === 'dust') {
    meta.dust += d.dust;
    saveMeta();
    combatText(player.pos, t('msg.dust', { n: d.dust }), 'xp', 2.4);
    return true;
  }
  if (d.kind === 'weapon') {
    if (inventoryFull()) {
      if (!auto) { combatText(player.pos, t('loot.invFull', { n: ROLLS.invMax }), 'miss', 2.6); return false; }
      const n = ROLLS.refund[d.weapon.r];   // Portal: kein Platz → Staub statt Verlust
      meta.dust += n; saveMeta();
      combatText(player.pos, t('loot.dust', { name: weaponName(d.weapon), n }), 'info', 2.6, CARD_RARITIES[d.weapon.r].color);
      return true;
    }
    meta.inv.push(d.weapon);
    saveMeta();
    combatText(player.pos, weaponName(d.weapon), 'info', 2.8, CARD_RARITIES[d.weapon.r].color);
    return true;
  }
  const res = takeGear(d.item);
  (state.finds ??= []).push({ item: d.item, dust: res.dust, over: res.over });
  combatText(player.pos, res.kept ? gearName(d.item) : t('loot.dust', { name: gearName(d.item), n: res.dust }), 'info', 2.6, gearRarity(d.item).color);
  return true;
}
// Waffe am Boden: Taste „Benutzen“
addUseSource(() => {
  let best: Drop | null = null, bd = DROP.pickR;
  for (const d of drops) if (d.kind === 'weapon') { const k = dist2d(player.pos, d.pos); if (k <= bd) { bd = k; best = d; } }
  if (!best) return null;
  const d = best;
  return { dist: bd, label: t('loot.takeWeapon', { name: weaponName(d.weapon) }), act: () => { if (pickUp(d)) drops = drops.filter(x => x !== d); } };
});
// Portal (portal.ts): liegengebliebene Drops kommen mit, statt auf der alten Map zu verfallen
export function collectAll() {
  for (const d of drops) pickUp(d, true);
  drops = [];
}

// Run-Start (resetGame): Boden leer, Fundliste leer
export function resetLoot() {
  drops = [];
  state.finds = [];
}
export const groundDrops = () => drops.length;
(window as any).__loot = { DROP, drops: () => drops, bossDrops, spawnDrop, dropDust, dropWeapon };
