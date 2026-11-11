// Schatzdieb (wie der Goblin in Diablo 3): 30 % Chance pro Map. Steht still, bis du ihn bemerkst (Aggro), flieht dann,
// öffnet nach 15 s ein Portal und ist weg. Tot = großer Staub-Haufen + 1 Waffe. Körper: Kategorie Schnell des Themes, goldene Funken. Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from '../state';
import { zone } from '../world';
import { spawnKind } from '../mobKinds';
import { moveMob, faceMob, removeMob } from '../mobs';
import { dropDust, dropWeapon } from '../loot';
import { ringFx } from '../fx/spellFx';
import { particles } from '../fx/particles';
import { combatText } from '../feedback';
import { onMapObjects, addDevButton, devAhead } from './objects';
import { dist2d, rand } from '../util';
import { t } from '../i18n';
import { onMobDeath } from '../hooks';

export const THIEF = { chance: 0.3, escapeMs: 15000, speed: 0.95, dust: [60, 100], repickMs: 1500, sparkMs: 120 };
const GOLD = [2.6, 2.0, 0.6];

const thiefAbility = {
  onCombatStart(m) { m.thiefEnd ??= state.now + THIEF.escapeMs; combatText(m.pos, t('thief.spotted'), 'crit', 3); },
  onUpdate(m, dt) {
    if (state.now >= m.thiefEnd) { escape(m); return true; }
    // Ziel: Pack-Platz weit weg von dir, nicht zu weit vom Dieb; alle repickMs neu
    if (!m.fleeTo || state.now >= m.fleeAt) {
      const spots = zone.packSpots ?? [];
      m.fleeTo = spots.length ? spots.reduce((a, b) => score(m, a) >= score(m, b) ? a : b) : { x: m.pos.x * 2 - player.pos.x, z: m.pos.z * 2 - player.pos.z };
      m.fleeAt = state.now + THIEF.repickMs;
    }
    const to = new THREE.Vector3(m.fleeTo.x, 0, m.fleeTo.z);
    moveMob(m, to, dt, THIEF.speed);
    faceMob(m, to);
    return true;   // greift nie an
  },
};
const score = (m, s) => dist2d(s, player.pos) - 0.6 * dist2d(s, m.pos);

function escape(m) {
  ringFx(m.pos, 3, [1.9, 0.5, 2.6], 900);
  for (let i = 0; i < 30; i++) particles.spawn({ x: m.pos.x, y: m.pos.y + rand(0, 2), z: m.pos.z, vx: rand(-2, 2), vy: rand(1, 4), vz: rand(-2, 2), life: 0.8, color: [1.9, 0.5, 2.6], size: rand(0.3, 0.5) });
  combatText(m.pos, t('thief.gone'), 'miss', 3);
  m.dead = true;        // aus der Liste, ohne Tod (kein Drop, keine XP)
  m.deathAt = -1e9;     // main.ts räumt Leichen nach 4 s weg: sofort
  removeMob(m);
  state.mobs = state.mobs.filter(x => x !== m);
  stats.escaped++;
}

export function spawnThief(x: number, z: number) {
  if (!zone.theme) return null;
  const m: any = spawnKind(zone.theme.id, 'schnell', 'none', new THREE.Vector3(x, 0, z), player.level, ++state.packCounter);
  if (!m) return null;
  m.thief = true; m.keep = true;
  m.ability = thiefAbility;
  const txt = [...m.plate.childNodes].find((n: any) => n.nodeType === 3) as Text | undefined;
  if (txt) txt.textContent = ` ${t('thief.name')}`;
  m.plate.style.color = '#ffd34a';
  return m;
}
onMobDeath(m => {
  if (!m.thief) return;
  dropDust(m.pos, Math.round(rand(THIEF.dust[0], THIEF.dust[1])));
  dropWeapon(m.pos);
  stats.killed++;
});

// Goldene Funken, damit man ihn sieht (aus objects-Update)
let sparkAt = 0;
export function updateThief() {
  if (state.now < sparkAt) return;
  sparkAt = state.now + THIEF.sparkMs;
  for (const m of state.mobs) if (m.thief && !m.dead && m.model.root.visible) particles.spawn({ x: m.pos.x + rand(-0.4, 0.4), y: m.pos.y + rand(0.5, 1.6), z: m.pos.z + rand(-0.4, 0.4), vy: rand(0.5, 1.5), life: 0.6, color: GOLD, size: 0.3 });
}

const stats = { spawned: 0, escaped: 0, killed: 0 };
onMapObjects((rng, free) => {
  if (!rng.chance(THIEF.chance)) return;
  const at = free();
  if (at && spawnThief(at.x, at.z)) stats.spawned++;
});
addDevButton('Schatzdieb', () => { const p = devAhead(14); spawnThief(p.x, p.z); });
(window as any).__thief = { THIEF, spawn: spawnThief, stats };
