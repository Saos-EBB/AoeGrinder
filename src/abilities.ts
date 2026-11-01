// Mob-Fähigkeiten. Hook-Punkte, alle optional:
//   onCombatStart(mob)               beim Eintritt in den Kampf
//   onUpdate(mob, dt)                jeden Frame im Kampf; true ersetzt Verfolgen und Nahkampf
//   onHit(mob, dmg)                  Mob hat den Spieler getroffen
//   onDamaged(mob, amount, source)   vor dem Schaden; gibt den neuen Betrag zurück, 0 = immun
// Alle Zahlen sind Design-Werte (PH).

import * as THREE from 'three';
import { state, player } from './state';
import { dist2d, rand, perFrame } from './util';
import { zone, terrainDecal, drape } from './world';
import { resolve } from './collision';
import { scene } from './render';
import { damagePlayer } from './player';
import { particles } from './fx/particles';
import { combatText } from './ui/hud';
import { moveMob, faceMob, hitPlayer, startLeap, spawnMob, enterCombat, burnMob } from './mobs';
import { stopChannel, stopDrink } from './spells';
import { maxMana } from './formulas';
import { CFG } from './config';

const SHADOW = [1.1, 0.3, 2.0], AXE = [1.6, 0.9, 0.3], DUST = [0.5, 0.4, 0.25];
const HEAL = [0.4, 2, 0.6], GOLD = [2.2, 1.7, 0.5], EMBER = [2.4, 0.8, 0.15];

// Partikel rund um den Mob
function emit(mob, rate, dt, color) {
  for (let i = perFrame(rate, dt); i > 0; i--) {
    particles.spawn({ x: mob.pos.x + rand(-0.7, 0.7), y: mob.pos.y + rand(0.2, 1.8), z: mob.pos.z + rand(-0.7, 0.7), vy: rand(0.8, 2), life: rand(0.4, 0.8), color, size: rand(0.14, 0.3) });
  }
}

// Geschoss als Partikelspur, fliegt auf den Spieler zu und trifft immer
const projectiles = [];
function shoot(mob, color, speed, onArrive) {
  mob.attackAt = state.now;
  projectiles.push({ x: mob.pos.x, y: mob.pos.y + 1.6, z: mob.pos.z, color, speed, onArrive });
}
// Schadenszonen: Lava der Zone und Lavaflächen, ticken einmal pro Sekunde
const pools = [];
let hazardClock = 0;
function updateHazards(dt) {
  for (let i = pools.length - 1; i >= 0; i--) {
    if (pools[i].until <= state.now) removePool(i);
  }
  hazardClock += dt;
  if (hazardClock < 1000) return;
  hazardClock -= 1000;
  // Lava trifft Mobs wie den Spieler (PH); Lavaflächen des Abgesandten nur den Spieler
  if (zone.hazard) for (const m of [...state.mobs]) {
    if (m.dead || m.leap || m.state === 'evade') continue;
    const lava = zone.hazard(m.pos.x, m.pos.z);
    if (lava > 0) burnMob(m, lava);
  }
  if (!player.grounded) return;
  let dmg = zone.hazard?.(player.pos.x, player.pos.z) ?? 0;
  for (const p of pools) if (dist2d(p, player.pos) <= p.r) dmg += p.dps;
  if (dmg > 0) damagePlayer(dmg);
}
function removePool(i) {
  const { mesh } = pools[i];
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  pools.splice(i, 1);
}

export function updateAbilities(dt) {
  updateHazards(dt);
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
export function clearAbilities() {
  projectiles.length = 0;
  while (pools.length) removePool(0);
}

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
        resolve(player.pos, 0.45);
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
  // Heilt das verletzteste Pack-Mitglied, flieht bei 15 % (fleeChance im Typ)
  medic: {
    onUpdate(mob) {
      if ((mob.nextHeal ?? 0) > state.now) return false;
      const hurt = state.mobs.filter(m => !m.dead && m.packId === mob.packId && m.hp < m.maxHp * 0.95 && dist2d(m.pos, mob.pos) < 30)   // PH
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!hurt) return false;
      mob.nextHeal = state.now + 3500;                          // PH
      mob.attackAt = state.now;
      const amount = Math.round(hurt.maxHp * 0.18);             // PH
      hurt.hp = Math.min(hurt.maxHp, hurt.hp + amount);
      combatText(hurt.pos, `+${amount}`, 'heal', 2.4);
      for (let i = 0; i < 16; i++) particles.spawn({ x: hurt.pos.x + rand(-0.6, 0.6), y: hurt.pos.y + rand(0, 1.6), z: hurt.pos.z + rand(-0.6, 0.6), vy: rand(1, 2.5), life: 0.6, color: HEAL, size: 0.3 });
      return false;
    },
  },
  // Gottesschild bei 30 %: 6 s immun
  divineShield: {
    onDamaged(mob, amount) {
      if (!mob.shieldUsed && mob.hp < mob.maxHp * 0.3) {        // PH
        mob.shieldUsed = true;
        mob.shieldUntil = state.now + 6000;                     // PH
        combatText(mob.pos, 'Gottesschild!', 'info', 2.6);
      }
      return mob.shieldUntil > state.now ? 0 : amount;
    },
    onUpdate(mob, dt) {
      if (mob.shieldUntil > state.now) emit(mob, 30, dt, GOLD);
      return false;
    },
  },
  // Hitzeaura: Frostschaden halbiert (Nova-Dauer über rootMax im Typ)
  heatAura: {
    onDamaged(mob, amount, source) { return source === 'ae' ? amount : amount * 0.5; },   // PH
    onUpdate(mob, dt) { emit(mob, 14, dt, EMBER); return false; },
  },
  // Alle 8 s Lavafläche unter dem Spieler
  lavaPool: {
    onUpdate(mob) {
      if (!ready(mob, 'nextPool', 8000)) return false;          // PH
      mob.attackAt = state.now;
      const mesh = terrainDecal(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.8, 0.12), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
      drape(mesh, player.pos, 4);                               // PH: Radius
      scene.add(mesh);
      pools.push({ x: player.pos.x, z: player.pos.z, r: 4, until: state.now + 6000, dps: 30, mesh });   // PH
      return false;
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
