// Gear-Drops im Run (Handoff docs/handoffs/items.md Schritt 2), nur Magier. Ziel: im Schnitt ~25 Drops pro vollem Run (Level 100).
// Boss: 2 Teile sicher (boss.ts endBoss), Champion-Pack: 1 Teil mit 50 % beim letzten Champion, normale Kills: DROP.kill pro Kill.
// Optik: Lichtsäule aus Partikeln in Seltenheitsfarbe (vorhandenes Partikel-System, kein Draw Call extra), Aufheben beim Drüberlaufen.
// Aufgehobene Teile landen sofort im Spielstand (gear.ts takeGear), bleiben also auch beim Tod. Liste der Funde: state.finds, gezeigt im Run-Ende.

import * as THREE from 'three';
import { state, player } from './state';
import { onMobDeath } from './mobs';
import { particles } from './fx/particles';
import { combatText } from './ui/hud';
import { mage } from './models/mage';
import { rollDrop, takeGear, gearName, gearRarity, isMagierSkin, type GearItem } from './gear';
import { dist2d, rand } from './util';
import { t } from './i18n';

// Alle Zahlen PH. kill: gemessen per Skript (docs/handoffs/items.md, Test), Schnitt ~25 pro Run bis Level 100
export const DROP = {
  kill: 0.0005, champ: 0.5, boss: 2,   // kill: Boss (7 × 2) und Champions (~23 Packs × 50 %) geben schon ~26, Kills nur noch selten (Skript: ~1640 Kills/Run)
  pickR: 2.5,                         // yd: so nah drüberlaufen hebt auf
  spread: 1.5,                        // yd um den Mob
  beamMs: 70, beam: { vy: 3, life: 0.9, size: 0.45, bright: 1.8 },   // Lichtsäule: alle beamMs ein Partikel, steigt ~2,7 yd
  popN: 14,                           // Funken beim Erscheinen
};
export interface Find { item: GearItem; dust: number; over: boolean }
type Drop = { item: GearItem; pos: THREE.Vector3; next: number; color: number[] };
let drops: Drop[] = [];

const rgb = (hex: string, k = 1) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k]; };
const canDrop = () => isMagierSkin(mage.skin) && !player.dead;

function spawnDrop(at: THREE.Vector3) {
  const item = rollDrop(mage.skin), a = rand(0, Math.PI * 2), r = rand(0, DROP.spread);
  const pos = new THREE.Vector3(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r);
  const color = rgb(gearRarity(item).color, DROP.beam.bright);
  drops.push({ item, pos, next: 0, color });
  for (let i = 0; i < DROP.popN; i++) {
    const b = rand(0, Math.PI * 2), v = rand(1, 3);
    particles.spawn({ x: pos.x, y: pos.y + 0.3, z: pos.z, vx: Math.cos(b) * v, vy: rand(2, 4), vz: Math.sin(b) * v, grav: 8, life: 0.6, color, size: 0.3 });
  }
}

// Normale Kills und Champions. Boss-Körper und Spiegelbilder (xpMul 0) droppen hier nicht
onMobDeath(m => {
  if (!canDrop() || m.boss || m.xpMul === 0 || m.type?.noXp) return;
  if (Math.random() < DROP.kill) spawnDrop(m.pos);
  if (m.champion && !state.mobs.some(o => o !== m && !o.dead && o.champion && o.packId === m.packId) && Math.random() < DROP.champ) spawnDrop(m.pos);
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
      d.next = state.now + DROP.beamMs;
      particles.spawn({ x: d.pos.x + rand(-0.08, 0.08), y: d.pos.y + 0.1, z: d.pos.z + rand(-0.08, 0.08), vy: B.vy, life: B.life, color: d.color, size: B.size });
    }
    if (player.dead || dist2d(player.pos, d.pos) > DROP.pickR) return true;
    pickUp(d);
    return false;
  });
}
function pickUp(d: Drop) {
  const res = takeGear(d.item);
  (state.finds ??= []).push({ item: d.item, dust: res.dust, over: res.over });
  combatText(player.pos, res.kept ? gearName(d.item) : t('loot.dust', { name: gearName(d.item), n: res.dust }), 'info', 2.6, gearRarity(d.item).color);
}
// Portal (portal.ts): liegengebliebene Drops kommen mit, statt auf der alten Map zu verfallen
export function collectAll() {
  for (const d of drops) pickUp(d);
  drops = [];
}

// Run-Start (resetGame): Boden leer, Fundliste leer
export function resetLoot() {
  drops = [];
  state.finds = [];
}
export const groundDrops = () => drops.length;
(window as any).__loot = { DROP, drops: () => drops, bossDrops, spawnDrop };
