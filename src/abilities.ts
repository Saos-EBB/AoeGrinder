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
import { resolve, groundAt } from './collision';
import { addEffect } from './fx/spellFx';
import { shakeCamera } from './camera';
import { scene, camera } from './render';
import { damagePlayer } from './player/damage';
import { particles } from './fx/particles';
import { combatText } from './feedback';
import { moveMob, faceMob, hitPlayer, startLeap, spawnMob, enterCombat, burnMob } from './mobs';
import { stopChannel, stopDrink } from './spells';
import { maxMana } from './formulas';
import { CFG } from './config';
import { t } from './i18n';

const SHADOW = [1.1, 0.3, 2.0], AXE = [1.6, 0.9, 0.3], DUST = [0.5, 0.4, 0.25];
const HEAL = [0.4, 2, 0.6], GOLD = [2.2, 1.7, 0.5], EMBER = [2.4, 0.8, 0.15];

// Partikel rund um den Mob
function emit(mob, rate, dt, color) {
  for (let i = perFrame(rate, dt); i > 0; i--) {
    particles.spawn({ x: mob.pos.x + rand(-0.7, 0.7), y: mob.pos.y + rand(0.2, 1.8), z: mob.pos.z + rand(-0.7, 0.7), vy: rand(0.8, 2), life: rand(0.4, 0.8), color, size: rand(0.14, 0.3) });
  }
}

// Geschoss als Partikelspur: fliegt gerade auf die Stelle, an der der Spieler beim Abschuss stand.
// Trifft nur, wenn es unterwegs näher als SHOT.hitR am Spieler vorbeikommt, sonst verfällt es am Ziel (seitlich laufen weicht aus).
export const SHOT = { hitR: 1.2, size: 0.5, glow: 1.35, trail: 4 };   // PH
const projectiles = [];
export function shoot(mob, color, speed, onHit, size = SHOT.size) {
  mob.attackAt = state.now;
  const x = mob.pos.x, y = mob.pos.y + 1.6, z = mob.pos.z;
  const tx = player.pos.x, ty = player.pos.y + 1.2, tz = player.pos.z, len = Math.hypot(tx - x, ty - y, tz - z) || 1;
  projectiles.push({ x, y, z, dx: (tx - x) / len, dy: (ty - y) / len, dz: (tz - z) / len, left: len, color: color.map(c => c * SHOT.glow), size, speed, onHit });
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
    if (m.dead || m.leap || m.flies || m.state === 'evade') continue;   // flies: Zusatz „fliegt“ schwebt über der Lava
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
    const p = projectiles[i], step = Math.min(p.left, p.speed * s);
    p.x += p.dx * step; p.y += p.dy * step; p.z += p.dz * step; p.left -= step;
    if (!player.dead && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < SHOT.hitR && Math.abs(player.pos.y + 1.2 - p.y) < 2) { projectiles.splice(i, 1); p.onHit(); continue; }
    if (p.left <= 0) { projectiles.splice(i, 1); continue; }
    for (let k = 0; k < SHOT.trail; k++) particles.spawn({ x: p.x - p.dx * k * 0.15, y: p.y - p.dy * k * 0.15, z: p.z - p.dz * k * 0.15, life: 0.25, color: p.color, size: p.size * (1 - k * 0.15) });
  }
}
export function clearAbilities() {
  projectiles.length = 0;
  while (pools.length) removePool(0);
}

// Fernkämpfer: über max ranlaufen, sonst stehen bleiben und zum Spieler drehen. Kein Weglaufen mehr (Fairness, map-umbau Phase 0b)
export function holdRange(mob, dt, max) {
  const d = dist2d(mob.pos, player.pos);
  if (d > max) moveMob(mob, player.pos, dt);
  faceMob(mob, player.pos);
  return d;
}

// Sprung aus 8 yd mit Biss und Rückstoß. keepDrink: Treffer bricht Trinken nicht (Kategorie Schnell)
function leap(mob, cd, keepDrink) {
  const d = dist2d(mob.pos, player.pos);
  if (d < 3 || d > 8 || mob.rootUntil > state.now || !ready(mob, 'nextLeap', cd)) return false;  // PH
  const dx = (player.pos.x - mob.pos.x) / d, dz = (player.pos.z - mob.pos.z) / d;
  startLeap(mob, { x: player.pos.x - dx * 1.3, z: player.pos.z - dz * 1.3 }, 420, () => {   // PH
    if (dist2d(mob.pos, player.pos) > 4) return;
    if (keepDrink) hitKeepDrink(mob, 1.5); else hitPlayer(mob, 1.5);   // PH
    player.pos.x += dx * 3.5; player.pos.z += dz * 3.5;     // PH: Rückstoß in yd
    resolve(player.pos, 0.45);
  });
  return true;
}
function hitKeepDrink(mob, mul) {
  const d = player.drink, keep = d?.keepOnHit;
  if (d) d.keepOnHit = true;
  hitPlayer(mob, mul);
  if (d && player.drink === d) d.keepOnHit = keep;
}

const ready = (mob, key, cd) => {
  if ((mob[key] ?? 0) > state.now) return false;
  mob[key] = state.now + cd;
  return true;
};

export const ABILITIES: any = {
  // Sprungbiss aus 8 yd: Schaden + Rückstoß, bricht Trinken (über damagePlayer)
  leapBite: {
    onUpdate(mob) { return leap(mob, 9000, false); },   // PH
  },
  // Kommt auf 12 yd ran und schießt Schattenblitze
  shadowCaster: {
    onUpdate(mob, dt) {
      const d = holdRange(mob, dt, 12);                         // PH
      if (d <= 14 && ready(mob, 'nextBolt', 2800)) shoot(mob, SHADOW, 22, () => hitPlayer(mob, 0.8));  // PH
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
  // Kommt auf 15 yd ran und wirft
  axeThrower: {
    onUpdate(mob, dt) {
      const d = holdRange(mob, dt, 15);                         // PH
      if (d <= 17 && ready(mob, 'nextAxe', 2600)) shoot(mob, AXE, 26, () => hitPlayer(mob, 0.9));   // PH
      return true;
    },
  },
  // Fluch: Spieler 30 % langsamer für 10 s
  curse: {
    onUpdate(mob) {
      if (dist2d(mob.pos, player.pos) <= 30 && ready(mob, 'nextCurse', 14000)) {   // PH
        mob.attackAt = state.now;
        player.slowUntil = state.now + 10000;                   // PH, Stärke in CFG.curseSlow
        combatText(player.pos, t('msg.curse'), 'hurt', 2.6);
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
      combatText(player.pos, t('msg.manaStolen', { n: stolen }), 'info', 2.6);
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
      combatText(player.pos, t('msg.stunned'), 'hurt', 2.6);
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
  // Gift stapelt bis 5×, Ticks laufen in player/move.ts und brechen Trinken nicht
  poison: {
    onHit() {
      const stacks = Math.min(5, (player.poison?.stacks ?? 0) + 1);    // PH
      player.poison = { stacks, until: state.now + 12000, nextTick: player.poison?.nextTick ?? state.now + 2000 };   // PH
      combatText(player.pos, t('status.poison', { n: stacks }), 'info', 2.6);
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
        combatText(mob.pos, t('msg.divineShield'), 'info', 2.6);
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
      combatText(mob.pos, t('msg.alarm'), 'info', 2.6);
      for (const other of state.mobs) {
        if (other === mob || other.dead || other.state !== 'idle') continue;
        if (dist2d(other.pos, mob.pos) <= 20) other.assistAt = state.now + 400;   // PH
      }
    },
  },
};


// ───────── Mob-Kategorien (mobKinds.ts, map-umbau Phase 7). Alle Zahlen PH
// Bodenring als Ansage: Rand steht sofort, die Fläche füllt sich bis zum Auslösen
export function telegraph(pos, r, color, dur) {
  const mat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), transparent: true, depthWrite: false, fog: false });
  const edge = terrainDecal(new THREE.RingGeometry(0.92, 1, 48), mat()), fill = terrainDecal(new THREE.CircleGeometry(1, 40), mat());
  drape(edge, pos, r); drape(fill, pos, r);
  addEffect(edge, dur, k => { edge.material.opacity = 0.9; });
  addEffect(fill, dur, k => { fill.material.opacity = 0.12 + 0.3 * k; fill.scale.set(Math.max(0.01, k), 1, Math.max(0.01, k)); });
}
const K = {
  stark: { windMs: 800 },
  aoe: { r: 5, warnMs: 700, cd: 5500, start: 4 },
  caster: { zauberer: [12, 2800, 20, 1, 500], werfer: [15, 2200, 30, 1, 0], hexer: [12, 3200, 20, 1, 500] },   // Abstand, Abklingzeit, Geschoss-Tempo, Schaden, Cast ms
  hexer: { near: 6, portCd: 6000, port: 8, run: 0.6 },   // Flucht (flee), gilt für alle Kategorien mit KINDS.flee
  gross: { r: 6, warnMs: 1000, cd: 8000, start: 5, push: 3 },
  lurk: { cos: Math.cos(75 * Math.PI / 180) },   // Blick: vor dir (von der Kamera aus) und auf dem Bild
};
const ORANGE = [2.2, 0.9, 0.2], RED = [2.4, 0.3, 0.15];
const poseOf = mob => mob.model.pose ?? {};

// Läuft auf Abstand ran, bleibt stehen, castet (sichtbar) und schießt wie in Phase 0b
function caster(mob, dt, kind) {
  const [range, cd, speed, mul, castMs] = K.caster[kind], color = mob.kindColor ?? SHADOW;
  const d = holdRange(mob, dt, range);
  if (mob.castAt) {
    emit(mob, 30, dt, color);
    if (state.now - mob.castAt >= castMs) { mob.castAt = 0; shoot(mob, color, speed, () => hitPlayer(mob, mul)); }
    return d;
  }
  if (d <= range + 2 && mob.rootUntil <= state.now && ready(mob, 'nextBolt', cd)) {
    if (castMs) { mob.castAt = state.now; mob.attackAt = state.now; } else shoot(mob, color, speed, () => hitPlayer(mob, mul));
  }
  return d;
}
function dust(mob, r, n = 40) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    particles.spawn({ x: mob.pos.x, y: mob.pos.y + 0.2, z: mob.pos.z, vx: Math.cos(a) * r * 2.2, vy: 0.5, vz: Math.sin(a) * r * 2.2, drag: 2.5, life: 0.5, color: DUST, size: 0.7 });
  }
}
// Lauerer: im Blick, wenn er (von der Kamera aus) vor dir steht und auf dem Bild ist
const vv = new THREE.Vector3();
export function inView(mob) {
  const fx = player.pos.x - camera.position.x, fz = player.pos.z - camera.position.z, fl = Math.hypot(fx, fz) || 1;
  const mx = mob.pos.x - player.pos.x, mz = mob.pos.z - player.pos.z, ml = Math.hypot(mx, mz);
  if (ml > 0.5 && (fx * mx + fz * mz) / (fl * ml) < K.lurk.cos) return false;
  vv.set(mob.pos.x, mob.pos.y + 1, mob.pos.z).project(camera);
  return Math.abs(vv.x) < 1 && Math.abs(vv.y) < 1 && vv.z < 1;
}

// Flucht (Kategorien mit KINDS.flee, mob.kindFlee aus mobKinds.ts): Teleport 8 yd weg höchstens alle 6 s, sonst Weglaufen mit 60 % Tempo (einholbar)
function flee(mob, dt) {
  if (!mob.kindFlee || mob.castAt || mob.rootUntil > state.now || dist2d(mob.pos, player.pos) >= K.hexer.near) return false;
  if (ready(mob, 'nextPort', K.hexer.portCd)) {
    const a = Math.atan2(mob.pos.z - player.pos.z, mob.pos.x - player.pos.x) + rand(-0.6, 0.6);
    const to = new THREE.Vector3(mob.pos.x + Math.cos(a) * K.hexer.port, mob.pos.y, mob.pos.z + Math.sin(a) * K.hexer.port);
    resolve(to, 0.7);
    to.y = groundAt(to.x, to.z, mob.pos.y);
    emit(mob, 2000, 16, mob.kindColor ?? SHADOW);
    mob.pos.copy(to);
    emit(mob, 2000, 16, mob.kindColor ?? SHADOW);
    mob.portedAt = state.now;
    return true;
  }
  const away = mob.pos.clone().multiplyScalar(2).sub(player.pos);
  moveMob(mob, away, dt, K.hexer.run);
  faceMob(mob, away);
  return true;
}

Object.assign(ABILITIES, {
  // Schnell: Sprung aus 8 yd, bricht Trinken nicht
  k_schnell: { onUpdate(mob) { return leap(mob, 6000, true); } },
  // Stark: holt 0,8 s sichtbar aus, dann harter Schlag
  k_stark: {
    onUpdate(mob, dt) {
      const pose = poseOf(mob);
      if (mob.windAt) {
        if (mob.rootUntil > state.now) { mob.windAt += dt; return true; }
        const k = (state.now - mob.windAt) / K.stark.windMs;
        faceMob(mob, player.pos);
        if (k < 1) { pose.windup = k; return true; }
        mob.windAt = 0; pose.windup = 0;
        if (dist2d(mob.pos, player.pos) <= CFG.meleeRange + 1) hitPlayer(mob); else mob.attackAt = state.now;
        mob.nextSwing = state.now + CFG.swingTime;
        return true;
      }
      if (dist2d(mob.pos, player.pos) <= CFG.meleeRange && state.now >= mob.nextSwing && mob.rootUntil <= state.now) { mob.windAt = state.now; return true; }
      return false;
    },
  },
  // AoE: Wirbel 5 yd, Ring 0,7 s vorher am Boden
  k_aoe: {
    onUpdate(mob) {
      const pose = poseOf(mob);
      if (mob.aoeAt) {
        if (mob.rootUntil > state.now) { mob.aoeAt = 0; pose.spin = 0; return false; }
        const k = (state.now - mob.aoeAt) / K.aoe.warnMs;
        pose.spin = Math.min(1, k) * 2;
        if (k < 1) return true;
        mob.aoeAt = 0; pose.spin = 0; dust(mob, K.aoe.r, 30);
        if (dist2d(mob.pos, player.pos) <= K.aoe.r) hitPlayer(mob); else mob.attackAt = state.now;
        return true;
      }
      if (dist2d(mob.pos, player.pos) <= K.aoe.start && mob.rootUntil <= state.now && ready(mob, 'nextAoe', K.aoe.cd)) {
        mob.aoeAt = state.now; telegraph(mob.pos, K.aoe.r, ORANGE, K.aoe.warnMs); return true;
      }
      return false;
    },
  },
  k_zauberer: { onUpdate(mob, dt) { if (!flee(mob, dt)) caster(mob, dt, 'zauberer'); return true; } },
  k_werfer: { onUpdate(mob, dt) { caster(mob, dt, 'werfer'); return true; } },
  // Hexer: wie Zauberer, mit eigenem Geschoss-Takt; flieht wie der Zauberer (KINDS.flee in mobKinds.ts)
  k_hexer: { onUpdate(mob, dt) { if (!flee(mob, dt)) caster(mob, dt, 'hexer'); return true; } },
  // Groß: Stampfen 6 yd mit 1 s Ansage (Rückstoß auf ihn halb: mob.knockMul in mobKinds.ts)
  k_gross: {
    onUpdate(mob) {
      const pose = poseOf(mob);
      if (mob.stompAt) {
        if (mob.rootUntil > state.now) { mob.stompAt += 16; return true; }
        const k = (state.now - mob.stompAt) / K.gross.warnMs;
        pose.windup = Math.min(1, k * 1.4);
        if (k < 1) return true;
        mob.stompAt = 0; pose.windup = 0; mob.attackAt = state.now;
        dust(mob, K.gross.r); shakeCamera(0.25);
        const d = dist2d(mob.pos, player.pos);
        if (d <= K.gross.r) {
          hitPlayer(mob);
          const l = d || 1;
          player.pos.x += (player.pos.x - mob.pos.x) / l * K.gross.push; player.pos.z += (player.pos.z - mob.pos.z) / l * K.gross.push;
          resolve(player.pos, 0.45);
        }
        return true;
      }
      if (dist2d(mob.pos, player.pos) <= K.gross.start && mob.rootUntil <= state.now && ready(mob, 'nextStomp', K.gross.cd)) {
        mob.stompAt = state.now; telegraph(mob.pos, K.gross.r, RED, K.gross.warnMs); return true;
      }
      return false;
    },
  },
  // Lauerer: erstarrt, solange er im Blick ist
  k_lauerer: {
    onUpdate(mob) {
      const seen = inView(mob);
      poseOf(mob).still = seen;
      return seen;
    },
  },
});

// ───────── Zusätze (mobKinds.ts): laufen vor der Kategorie, steuern nicht selbst. Alle Zahlen PH
const Z = { r: 10, healPct: 0.05, healCd: 3000, castMs: 1000, shieldCd: 6000, hasteMs: 250 };
const near = (mob, f) => state.mobs.filter(m => !m.dead && m.kind && dist2d(m.pos, mob.pos) <= Z.r && f(m));
const bubbleGeo = (() => { const g = new THREE.SphereGeometry(1, 16, 12); g.dispose = () => {}; return g; })();
const bubbleMat = (() => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.9, 2.2), transparent: true, opacity: 0.22, depthWrite: false }); m.dispose = () => {}; return m; })();
export function giveShield(m) {
  if (m.kindShield) return;
  const s = m.model.root.scale.y || 1, h = m.model.height / s;
  const b = new THREE.Mesh(bubbleGeo, bubbleMat);
  b.position.y = h * 0.5; b.scale.setScalar(Math.max(h, 1.2) * 0.6);
  m.model.root.add(b);
  m.kindShield = b;
}
export function breakShield(m) {
  if (!m.kindShield) return;
  m.model.root.remove(m.kindShield);
  m.kindShield = null;
  emit(m, 2000, 16, [0.5, 0.9, 2.2]);
}
export const ZUSATZ: any = {
  // Heilt einen Mob in 10 yd um 5 % alle 3 s; Cast 1 s sichtbar, Treffer unterbricht
  heal: {
    onUpdate(mob, dt) {
      const c = mob.healCast;
      if (c) {
        emit(mob, 40, dt, HEAL);
        if (state.now < c.end) return;
        mob.healCast = null;
        if (c.target.dead) return;
        const amount = Math.round(c.target.maxHp * Z.healPct);
        c.target.hp = Math.min(c.target.maxHp, c.target.hp + amount);
        combatText(c.target.pos, `+${amount}`, 'heal', 2.4);
        emit(c.target, 2000, 16, HEAL);
        return;
      }
      if ((mob.nextZHeal ?? 0) > state.now) return;
      const tg = near(mob, m => m.hp < m.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!tg) { mob.nextZHeal = state.now + 500; return; }
      mob.nextZHeal = state.now + Z.healCd;
      mob.healCast = { target: tg, end: state.now + Z.castMs };
      mob.attackAt = state.now;
    },
    onDamaged(mob, amount) {
      if (mob.healCast) { mob.healCast = null; combatText(mob.pos, t('msg.interrupted'), 'info', 2.4); }
      return amount;
    },
  },
  // Schild auf einen Mob in 10 yd, hält 1 Treffer, alle 6 s
  shield: {
    onUpdate(mob) {
      if ((mob.nextZShield ?? 0) > state.now) return;
      const list = near(mob, m => !m.kindShield), tg = list.filter(m => m !== mob).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? list[0];
      if (!tg) { mob.nextZShield = state.now + 500; return; }
      mob.nextZShield = state.now + Z.shieldCd;
      mob.attackAt = state.now;
      giveShield(tg);
    },
  },
  // Aura: Mobs in 10 yd +20 % Tempo, stapelt nicht (mobs.ts moveMob liest hasteUntil)
  haste: {
    onUpdate(mob) { for (const m of near(mob, () => true)) m.hasteUntil = state.now + Z.hasteMs; },
  },
};
