// Mob-Fähigkeiten. Hook-Punkte, alle optional:
//   onCombatStart(mob)               beim Eintritt in den Kampf
//   onUpdate(mob, dt)                jeden Frame im Kampf; true ersetzt Verfolgen und Nahkampf
//   onHit(mob, dmg)                  Mob hat den Spieler getroffen
//   onDamaged(mob, amount, source)   vor dem Schaden; gibt den neuen Betrag zurück, 0 = immun
// Alle Zahlen sind Design-Werte (PH).

import { state, player } from './state';
import { dist2d } from './util';
import { collide } from './world';
import { particles } from './fx/particles';
import { combatText } from './ui/hud';
import { moveMob, faceMob, hitPlayer, startLeap } from './mobs';

const SHADOW = [1.1, 0.3, 2.0];

// Geschoss als Partikelspur, fliegt auf den Spieler zu und trifft immer
const projectiles = [];
function shoot(mob, color, speed, onArrive) {
  mob.attackAt = state.now;
  projectiles.push({ x: mob.pos.x, y: mob.pos.y + 1.6, z: mob.pos.z, color, speed, onArrive });
}
export function updateAbilities(dt) {
  const s = dt / 1000;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    const dx = player.pos.x - p.x, dy = player.pos.y + 1.2 - p.y, dz = player.pos.z - p.z, d = Math.hypot(dx, dy, dz);
    const step = p.speed * s;
    if (d <= step) { projectiles.splice(i, 1); p.onArrive(); continue; }
    p.x += dx / d * step; p.y += dy / d * step; p.z += dz / d * step;
    for (let k = 0; k < 3; k++) particles.spawn({ x: p.x, y: p.y, z: p.z, life: 0.25, color: p.color, size: 0.35 });
  }
}
export function clearAbilities() { projectiles.length = 0; }

// Hält Abstand: näher ran über max, zurück unter min
function holdRange(mob, dt, min, max) {
  const d = dist2d(mob.pos, player.pos);
  if (d > max) moveMob(mob, player.pos, dt);
  else if (d < min) moveMob(mob, mob.pos.clone().multiplyScalar(2).sub(player.pos), dt);
  faceMob(mob, player.pos);
  return d;
}

const ready = (mob, key, cd) => {
  if ((mob[key] ?? 0) > state.now) return false;
  mob[key] = state.now + cd;
  return true;
};

export const ABILITIES: any = {
  // Sprungbiss aus 8 yd: Schaden + Rückstoß, bricht Trinken (über damagePlayer)
  leapBite: {
    onUpdate(mob) {
      const d = dist2d(mob.pos, player.pos);
      if (d < 3 || d > 8 || mob.rootUntil > state.now || !ready(mob, 'nextLeap', 9000)) return false;  // PH
      const dx = (player.pos.x - mob.pos.x) / d, dz = (player.pos.z - mob.pos.z) / d;
      startLeap(mob, { x: player.pos.x - dx * 1.3, z: player.pos.z - dz * 1.3 }, 420, () => {   // PH
        if (dist2d(mob.pos, player.pos) > 4) return;
        hitPlayer(mob, 1.5);                                    // PH
        player.pos.x += dx * 3.5; player.pos.z += dz * 3.5;     // PH: Rückstoß in yd
        collide(player.pos, 0.45);
      });
      return true;
    },
  },
  // Bleibt auf 20 yd und schießt Schattenblitze
  shadowCaster: {
    onUpdate(mob, dt) {
      const d = holdRange(mob, dt, 18, 20);                     // PH
      if (d <= 24 && ready(mob, 'nextBolt', 2800)) shoot(mob, SHADOW, 22, () => hitPlayer(mob, 0.8));  // PH
      return true;
    },
  },
  // Jeder Biss heilt
  drainBite: {
    onHit(mob, dmg) {
      mob.hp = Math.min(mob.maxHp, mob.hp + dmg);
      combatText(mob.pos, `+${dmg}`, 'heal', 2.4);
    },
  },
  // Ruft alle Mobs in 20 yd statt 10
  alarm: {
    onCombatStart(mob) {
      combatText(mob.pos, 'Alarm!', 'info', 2.6);
      for (const other of state.mobs) {
        if (other === mob || other.dead || other.state !== 'idle') continue;
        if (dist2d(other.pos, mob.pos) <= 20) other.assistAt = state.now + 400;   // PH
      }
    },
  },
};
