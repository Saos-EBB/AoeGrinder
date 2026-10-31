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
import { moveMob, faceMob, hitPlayer, startLeap, spawnMob, enterCombat } from './mobs';
import { stopChannel, stopDrink } from './spells';
import { maxMana } from './formulas';
import { CFG } from './config';

const SHADOW = [1.1, 0.3, 2.0], AXE = [1.6, 0.9, 0.3], DUST = [0.5, 0.4, 0.25];

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
  // +15 % Tempo pro totem Pack-Mitglied
  packFury: {
    onUpdate(mob) {
      mob.speedMul = 1 + 0.15 * (state.packDeaths[mob.packId] || 0);   // PH
      return false;
    },
  },
  // Wirft aus 25 yd, weicht unter 10 yd zurück
  axeThrower: {
    onUpdate(mob, dt) {
      const d = holdRange(mob, dt, 10, 25);                     // PH
      if (d <= 26 && ready(mob, 'nextAxe', 2600)) shoot(mob, AXE, 26, () => hitPlayer(mob, 0.9));   // PH
      return true;
    },
  },
  // Fluch: Spieler 30 % langsamer für 10 s
  curse: {
    onUpdate(mob) {
      if (dist2d(mob.pos, player.pos) <= 30 && ready(mob, 'nextCurse', 14000)) {   // PH
        mob.attackAt = state.now;
        player.slowUntil = state.now + 10000;                   // PH, Stärke in CFG.curseSlow
        combatText(player.pos, 'Fluch!', 'hurt', 2.6);
      }
      return false;
    },
  },
  // Getarnt bis 6 yd (aggro im Typ), dann Ansprung
  pounce: {
    onCombatStart(mob) {
      mob.hidden = false;
      mob.model.root.visible = true;
    },
    onUpdate(mob) {
      const d = dist2d(mob.pos, player.pos);
      if (mob.pounced || d > 10 || mob.rootUntil > state.now) return false;   // PH
      mob.pounced = true;
      startLeap(mob, { x: player.pos.x, z: player.pos.z }, 380, () => { if (dist2d(mob.pos, player.pos) < 4) hitPlayer(mob, 1.6); });   // PH
      return true;
    },
  },
  // Jeder Treffer stiehlt 5 % max. Mana
  manaThief: {
    onHit(mob) {
      const stolen = Math.round(maxMana() * 0.05);              // PH
      player.mana = Math.max(0, player.mana - stolen);
      combatText(player.pos, `-${stolen} Mana`, 'info', 2.6);
    },
  },
  // Stampfer im Nahkampf: 3 s Betäubung, bricht Blizzard; Blink löst
  stomp: {
    onUpdate(mob) {
      if (dist2d(mob.pos, player.pos) > CFG.meleeRange + 1 || mob.rootUntil > state.now || !ready(mob, 'nextStomp', 12000)) return false;   // PH
      hitPlayer(mob, 1.2);                                      // PH
      player.stunUntil = state.now + 3000;                      // PH
      stopChannel();
      stopDrink();
      combatText(player.pos, 'Betäubt!', 'hurt', 2.6);
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2;
        particles.spawn({ x: mob.pos.x, y: mob.pos.y + 0.2, z: mob.pos.z, vx: Math.cos(a) * 12, vy: 0.5, vz: Math.sin(a) * 12, drag: 2.5, life: 0.5, color: DUST, size: 0.7 });
      }
      return true;
    },
  },
  // Ruft einmal 4 Schwärmlinge
  swarm: {
    onCombatStart(mob) {
      if (mob.swarmed) return;
      mob.swarmed = true;
      for (let i = 0; i < 4; i++) {                             // PH
        const a = i / 4 * Math.PI * 2;
        const pos = mob.pos.clone();
        pos.x += Math.cos(a) * 1.6; pos.z += Math.sin(a) * 1.6;
        enterCombat(spawnMob('schwaermling', pos, mob.level, mob.packId), false);
      }
    },
  },
  // Gift stapelt bis 5×, Ticks laufen in player.ts und brechen Trinken nicht
  poison: {
    onHit() {
      const stacks = Math.min(5, (player.poison?.stacks ?? 0) + 1);    // PH
      player.poison = { stacks, until: state.now + 12000, nextTick: player.poison?.nextTick ?? state.now + 2000 };   // PH
      combatText(player.pos, `Gift ×${stacks}`, 'info', 2.6);
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
