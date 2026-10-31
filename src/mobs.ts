import * as THREE from 'three';
import { state, player } from './state';
import { rand, randInt, pick, clamp, dist2d, lerpTo } from './util';
import { CFG, mods, LEVEL_MAX, LEVEL_UNLOCKS } from './config';
import { aggroRadius, hitChance, xpForKill, dmgMult, mobMaxHp, mobHitDmg } from './formulas';
import { scene } from './render';
import { heightAt, collide, zone } from './world';
import { MOB_TYPES } from './mobTypes';
import { ABILITIES } from './abilities';
import { reportKill } from './score';
import { modFactor } from './modifiers';
import { particles } from './fx/particles';
import { hitSparkFx } from './fx/spellFx';
import { shakeCamera } from './camera';
import { rumble } from './gamepad';
import { overlay, combatText } from './ui/hud';
import { damagePlayer, gainXp } from './player';

// Mobs der Zone, die auf diesem Spielerlevel spawnen. Der Start-Mob steht vorne.
const unlockedMobs = level => zone.mobs.slice(0, 1 + LEVEL_UNLOCKS.filter(l => level >= l).length);

// Einblendung, wenn der Sprung von fromLevel neue Mobs freigeschaltet hat. Die Anzeige steckt in ui/scoreHud.ts.
export function announceNewMobs(fromLevel) {
  const names = unlockedMobs(player.level).slice(unlockedMobs(fromLevel).length).map(id => MOB_TYPES[id].name);
  if (names.length) state.newMob = { text: `Neuer Gegner: ${names.join(', ')}`, at: state.now };
}

export function spawnPack() {
  let center;
  for (let tries = 0; tries < 40; tries++) {
    const a = rand(0, Math.PI * 2), r = rand(15, 85);
    center = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const farFromPlayer = dist2d(center, player.pos) > 40;
    const farFromPacks = state.mobs.every(m => m.dead || dist2d(m.home, center) > 18);
    if (farFromPlayer && farFromPacks && (zone.spawnOk?.(center.x, center.z) ?? true)) break;
  }
  const size = clamp(3 + Math.floor((player.level - 20) / 2) + randInt(-1, 1) + zone.packs.sizeBonus, 2, 10) * modFactor('packSize');
  const packId = ++state.packCounter;
  const unlocked = unlockedMobs(player.level), special = unlocked.slice(1);
  for (let i = 0; i < size; i++) {
    const typeId = i === 0 && size >= 3 && special.includes(zone.packAlways) && Math.random() < 0.5 ? zone.packAlways : special.length && Math.random() < 0.5 ? pick(special) : unlocked[0];
    const level = Math.max(1, player.level + [-1, 0, 0, 1, 1, 2][randInt(0, 5)]);
    const pos = center.clone().add(new THREE.Vector3(rand(-5, 5), 0, rand(-5, 5)));
    spawnMob(typeId, pos, level, packId);
  }
}

// Modelle sind pro Mob verschmolzen, Geometrie und Material müssen mit weg
export function removeMob(m) {
  scene.remove(m.model.root);
  m.plate.remove();
  m.model.root.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
}

export function spawnMob(typeId, pos, level, packId) {
  const type = MOB_TYPES[typeId];
  collide(pos, 0.7);
  pos.y = heightAt(pos.x, pos.z);
  const model = type.build(level);
  model.root.position.copy(pos);
  model.root.rotation.y = rand(0, Math.PI * 2);
  scene.add(model.root);
  const plate = document.createElement('div');
  plate.className = 'plate';
  plate.innerHTML = `<span class="lv"></span> ${type.name}<div class="hp"><div></div></div>`;
  overlay.appendChild(plate);
  const hp = Math.round(mobMaxHp(level) * (type.hpMul ?? 1));
  const mob = {
    type, ability: ABILITIES[type.ability] ?? null, model, plate, plateHp: plate.querySelector('.hp div'), plateLv: plate.querySelector('.lv'),
    pos: model.root.position, home: pos.clone(), combatStart: pos.clone(), packId,
    level, hp, maxHp: hp, speedMul: type.speedMul ?? 1,
    state: 'idle', assistAt: 0, nextSwing: 0, attackAt: -1e9, rootUntil: 0, slowUntil: 0, slowPct: 0,
    fleeRolled: false, fleeTarget: null, fleeUntil: 0, lastLeashExt: 0, dead: false, deathAt: 0, moving: false, leap: null, hidden: false,
  };
  if (type.stealth) { mob.hidden = true; model.root.visible = false; }
  state.mobs.push(mob);
  return mob;
}

export function enterCombat(mob, callForHelp) {
  if (mob.dead || mob.state === 'combat') return;
  mob.state = 'combat';
  mob.combatStart.copy(mob.pos);
  mob.lastLeashExt = state.now;
  mob.nextSwing = state.now + 500;
  mob.assistAt = 0;
  mob.ability?.onCombatStart?.(mob);
  if (!callForHelp) return;
  for (const other of state.mobs) {                 // Social Aggro: 10 yd, Helfer nach 1,5 s
    if (other === mob || other.dead || other.state !== 'idle' || other.assistAt) continue;
    if (dist2d(other.pos, mob.pos) <= CFG.socialRadius) other.assistAt = state.now + CFG.socialDelay;
  }
}

function startEvade(mob) {
  mob.state = 'evade';
  mob.rootUntil = 0;
  mob.slowUntil = 0;
}

function isOutOfThreatArea(mob) {
  const area = Math.max(aggroRadius(mob) * 1.5, CFG.leashRadius);
  const out = dist2d(mob.pos, mob.combatStart) > area && dist2d(player.pos, mob.combatStart) > area;
  return out && state.now - mob.lastLeashExt > CFG.leashGrace;
}

function startFlee(mob) {
  let helper = null, best = CFG.fleeAssistRadius;
  for (const other of state.mobs) {
    if (other === mob || other.dead || other.state !== 'idle') continue;
    const d = dist2d(other.pos, mob.pos);
    if (d < best) { best = d; helper = other; }
  }
  mob.state = 'flee';
  mob.fleeTarget = helper;
  mob.fleeUntil = state.now + CFG.fleeDuration;
  combatText(mob.pos, 'läuft in Panik davon!', 'info', 2.5);
}

export function moveMob(mob, target, dt, speedMul = 1, ignoreCC = false) {
  if (!ignoreCC && mob.rootUntil > state.now) return;
  let speed = CFG.mobSpeed * mob.speedMul * speedMul * modFactor('speed');
  if (!ignoreCC && mob.slowUntil > state.now) speed *= 1 - mob.slowPct;
  const dx = target.x - mob.pos.x, dz = target.z - mob.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return;
  const step = Math.min(d, speed * dt / 1000);
  mob.pos.x += dx / d * step;
  mob.pos.z += dz / d * step;
  mob.moving = true;
  mob.speed = speed;
}

export function faceMob(mob, target) {
  const want = Math.atan2(target.x - mob.pos.x, target.z - mob.pos.z);
  if (mob.rootUntil > state.now) return;
  mob.model.root.rotation.y = want;
}

// Mob trifft den Spieler, von Nahkampf und Fähigkeiten genutzt
export function hitPlayer(mob, mul = 1) {
  mob.attackAt = state.now;
  const dmg = Math.round(mobHitDmg(mob.level) * (mob.type.dmgMul ?? 1) * mul);
  damagePlayer(dmg);
  mob.ability?.onHit?.(mob, dmg);
}

// Sprung im Bogen auf ein Ziel, onLand läuft bei der Landung
export function startLeap(mob, target, dur, onLand) {
  mob.leap = { x0: mob.pos.x, z0: mob.pos.z, x1: target.x, z1: target.z, start: state.now, dur, onLand };
  mob.moving = true;
  mob.speed = CFG.mobSpeed;
}

function updateLeap(mob) {
  const l = mob.leap, t = clamp((state.now - l.start) / l.dur, 0, 1);
  mob.pos.x = lerpTo(l.x0, l.x1, t);
  mob.pos.z = lerpTo(l.z0, l.z1, t);
  mob.pos.y = heightAt(mob.pos.x, mob.pos.z) + Math.sin(t * Math.PI) * 2;
  faceMob(mob, { x: l.x1, z: l.z1 });
  if (t < 1) return;
  mob.leap = null;
  l.onLand();
}

export function updateMob(mob, dt) {
  if (mob.dead) return;
  mob.moving = false;
  if (mob.leap) return updateLeap(mob);
  const d = dist2d(mob.pos, player.pos);

  if (mob.state === 'idle') {
    if (!player.dead && d < (mob.type.aggro ?? aggroRadius(mob))) enterCombat(mob, true);
    else if (mob.assistAt && state.now >= mob.assistAt) enterCombat(mob, false);
  }
  else if (mob.state === 'combat') {
    if (player.dead || isOutOfThreatArea(mob)) { startEvade(mob); return; }
    if (mob.ability?.onUpdate?.(mob, dt)) { /* Fähigkeit steuert selbst */ }
    else if (d > CFG.meleeRange) moveMob(mob, player.pos, dt);
    else if (state.now >= mob.nextSwing && mob.rootUntil <= state.now) {
      mob.nextSwing = state.now + CFG.swingTime;
      hitPlayer(mob);
    }
    faceMob(mob, player.pos);
  }
  else if (mob.state === 'flee') {
    const helper = mob.fleeTarget;
    if (helper && !helper.dead) {
      moveMob(mob, helper.pos, dt);
      faceMob(mob, helper.pos);
      if (dist2d(mob.pos, helper.pos) < 3) { enterCombat(helper, true); mob.state = 'combat'; }
    } else {
      const away = mob.pos.clone().multiplyScalar(2).sub(player.pos);
      moveMob(mob, away, dt);
      faceMob(mob, away);
      if (state.now >= mob.fleeUntil) mob.state = 'combat';
    }
  }
  else if (mob.state === 'evade') {
    moveMob(mob, mob.home, dt, 1.6, true);
    faceMob(mob, mob.home);
    mob.hp = mob.maxHp;
    if (dist2d(mob.pos, mob.home) < 0.5) { mob.state = 'idle'; mob.fleeRolled = false; }
  }
  collide(mob.pos, 0.7);
  mob.pos.y = heightAt(mob.pos.x, mob.pos.z);
}

// Mobs im Kampf schieben sich leicht auseinander
export function separateMobs() {
  const active = state.mobs.filter(m => !m.dead && m.state !== 'idle');
  for (let i = 0; i < active.length; i++) {
    for (let k = i + 1; k < active.length; k++) {
      const a = active[i].pos, b = active[k].pos;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 1.3) {
        const push = (1.3 - d) / 2;
        if (active[i].rootUntil <= state.now) { a.x -= dx / d * push; a.z -= dz / d * push; }
        if (active[k].rootUntil <= state.now) { b.x += dx / d * push; b.z += dz / d * push; }
      }
    }
  }
}

// Root mit Typ-Regeln: manche Mobs sind immun, manche halten nur kurz
export function applyRoot(mob, dur) {
  if (mob.type.rootImmune) { combatText(mob.pos, 'Immun', 'miss'); return; }
  mob.rootUntil = state.now + Math.min(dur, mob.type.rootMax ?? dur);
}

// Gibt true zurück, wenn der Zauber getroffen hat
export function damageMob(mob, amount, source, castKey?) {
  if (mob.dead) return false;
  if (mob.state === 'evade') { combatText(mob.pos, 'Entkommen', 'miss'); return false; }
  if (mob.state === 'idle') enterCombat(mob, true);
  player.lastCombat = state.now;
  mob.lastLeashExt = state.now;

  if (Math.random() * 100 >= hitChance(mob)) { combatText(mob.pos, 'Widerstanden', 'miss'); return false; }

  mob.castKey = castKey ?? source;
  amount *= modFactor('dmg');
  if (mob.ability?.onDamaged) {
    amount = mob.ability.onDamaged(mob, amount, source);
    if (amount <= 0) { combatText(mob.pos, 'Immun', 'miss'); return true; }
  }

  const frozen = mob.rootUntil > state.now;
  const crit = Math.random() < CFG.baseCrit + (frozen ? mods.shatter : 0);
  const dmg = Math.round(amount * dmgMult() * (crit ? 1 + CFG.critBonus : 1));
  mob.hp -= dmg;
  mob.hitAt = state.now;
  if (crit) { shakeCamera(0.18); rumble(0.3, 0.6, 120); }   // PH: Rumble-Werte
  combatText(mob.pos, dmg, crit ? 'crit' : 'dmg');
  hitSparkFx(mob.pos, source);

  if (frozen && source !== 'nova' && Math.random() < CFG.novaBreakChance) mob.rootUntil = 0;

  if (mob.hp <= 0) { killMob(mob); return true; }
  if (!mob.fleeRolled && mob.hp < mob.maxHp * CFG.fleeHpPct) {
    mob.fleeRolled = true;
    if (Math.random() < (mob.type.fleeChance ?? CFG.fleeChance)) startFlee(mob);
  }
  return true;
}

// Fester Umgebungsschaden: kein Trefferwurf, keine Spieler-Boni, zieht keine Aggro
export function burnMob(mob, amount) {
  mob.hp -= amount;
  mob.hitAt = state.now;
  combatText(mob.pos, amount, 'dmg');
  if (mob.hp <= 0) killMob(mob);
}

function killMob(mob) {
  mob.dead = true;
  mob.deathAt = state.now;
  mob.hp = 0;
  mob.rootUntil = 0;
  mob.plate.style.display = 'none';
  player.kills++;
  reportKill(mob, mob.type.noXp ? 0 : xpForKill(mob.level));
  state.packDeaths[mob.packId] = (state.packDeaths[mob.packId] || 0) + 1;
  if (mob.type.noXp) return;
  const xp = xpForKill(mob.level);
  if (xp > 0 && player.level < LEVEL_MAX) { combatText(mob.pos, `+${xp} XP`, 'xp', 2); gainXp(xp); }
}

// Leiche versinkt nach 1,5 s im Boden, mit Staubwolke
export function sinkCorpse(mob) {
  const t = clamp((state.now - mob.deathAt - 1500) / 2000, 0, 1);
  if (t > 0 && !mob.dusted) {
    mob.dusted = true;
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      particles.spawn({ x: mob.pos.x + Math.cos(a) * 0.6, y: mob.pos.y + 0.3, z: mob.pos.z + Math.sin(a) * 0.6,
        vx: Math.cos(a) * rand(0.5, 1.5), vy: rand(0.3, 1), vz: Math.sin(a) * rand(0.5, 1.5), drag: 1.5,
        life: rand(0.8, 1.4), color: [0.09, 0.07, 0.05], size: rand(1, 1.8), grow: 0.8 });
    }
  }
  mob.pos.y = heightAt(mob.pos.x, mob.pos.z) - t * 1.4;
}

// Zug zu einem Punkt. Eingefrorene bleiben stehen.
export function pullMob(mob, center, amount) {
  if (mob.rootUntil > state.now || mob.state === 'evade') return;
  const dx = center.x - mob.pos.x, dz = center.z - mob.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.5) return;
  const step = Math.min(amount, d - 0.5);
  mob.pos.x += dx / d * step;
  mob.pos.z += dz / d * step;
}

// Rückschlag im Bogen, weg vom Punkt
export function knockbackMob(mob, center, dist, dur = 450) {
  if (mob.dead || mob.leap) return;
  const dx = mob.pos.x - center.x, dz = mob.pos.z - center.z, d = Math.hypot(dx, dz) || 1;
  const target = new THREE.Vector3(mob.pos.x + dx / d * dist, 0, mob.pos.z + dz / d * dist);
  collide(target, 0.7);
  startLeap(mob, target, dur, () => {});
}

// Status: Mob schlägt langsamer. Pro Frame aufgerufen, schiebt den nächsten Schlag so, als liefe die Uhr pct langsamer.
export function slowSwing(mob, pct, dt) {
  mob.nextSwing += dt * (1 / (1 - pct) - 1);
}
