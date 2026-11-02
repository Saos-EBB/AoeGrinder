import * as THREE from 'three';
import { state, player } from './state';
import { rand, randInt, pick, clamp, dist2d, lerpTo } from './util';
import { CFG, mods, WORLD_K, LEVEL_MAX, LEVEL_UNLOCKS, LEVEL_MIN_MOBS, LEVEL_PACK_MIN, LEVEL_PACK_MAX, LEVEL_PACK_SPREAD } from './config';
import { aggroRadius, hitChance, xpForKill, dmgMult, mobDmgTaken, mobMaxHp, mobHitDmg } from './formulas';
import { scene } from './render';
import { zone } from './world';
import { groundAt, resolve, settle, steer, climbTarget } from './collision';
import { MOB_TYPES } from './mobTypes';
import { ABILITIES } from './abilities';
import { reportKill , run } from './score';
import { mobMode, modFactor } from './modifiers';
import { particles } from './fx/particles';
import { hitSparkFx } from './fx/spellFx';
import { shakeCamera } from './camera';
import { rumble } from './gamepad';
import { overlay, combatText } from './ui/hud';
import { damagePlayer, gainXp } from './player';
import { damageNumber } from './ui/dmgNumbers';

// Mobs der Zone, die auf diesem Spielerlevel spawnen. Der Start-Mob steht vorne.
const unlockedMobs = level => zone.mobs.slice(0, 1 + LEVEL_UNLOCKS.filter(l => level >= l).length);

// Einblendung, wenn der Sprung von fromLevel neue Mobs freigeschaltet hat. Die Anzeige steckt in ui/scoreHud.ts.
export function announceNewMobs(fromLevel) {
  const names = unlockedMobs(player.level).slice(unlockedMobs(fromLevel).length).map(id => MOB_TYPES[id].name);
  if (names.length) state.newMob = { text: `Neuer Gegner: ${names.join(', ')}`, at: state.now };
}

// Packgröße aus dem Level, ohne Zufall und Modifikatoren. Unter LEVEL_PACK_MIN greift ab Level 1 der Startwert.
const levelPackSize = () => clamp(3 + Math.floor((player.level - 20) / 2) + zone.packs.sizeBonus, 2, 10);
const liveMobs = () => state.mobs.filter(m => !m.dead);
const livePackCount = () => new Set(liveMobs().map(m => m.packId)).size;
// Nie unter dem Startwert; ab dem Level, wo die Packs wachsen, skaliert die Dichte wie bisher mit Packanzahl × Packgröße
const mobTarget = () => Math.max(LEVEL_MIN_MOBS, zone.packs.count * levelPackSize()) * modFactor('packSize');

// Beim Aufbau der Welt: Karte füllen
export function fillPacks() {
  if (mobMode === 'siege') return;
  while (liveMobs().length < mobTarget()) spawnPack();
  respawn.pending = 0;
  respawn.packs = livePackCount();
}

// Jeder tote Pack bekommt sofort Ersatz, ein Pack pro Frame, weil der Modellbau Zeit kostet. Darunter hält mobTarget die Mindestdichte.
const respawn = { pending: 0, packs: 0 };
const PACK_NEAR = 40, PACK_FAR = 100, PACK_DROP = 150;   // PH: Packs entstehen im Ring um den Spieler, unberührte weit hinten verschwinden

function dropFarPack() {
  const far = liveMobs().find(m => m.state === 'idle' && dist2d(m.pos, player.pos) > PACK_DROP);
  if (!far) return;
  const pack = state.mobs.filter(m => m.packId === far.packId);
  if (!pack.every(m => !m.dead && m.state === 'idle')) return;
  for (const m of pack) removeMob(m);
  state.mobs = state.mobs.filter(m => m.packId !== far.packId);
}

export function updateRespawn() {
  if (mobMode === 'siege') return;
  dropFarPack();
  const packs = livePackCount();
  respawn.pending += Math.max(0, respawn.packs - packs);
  if (respawn.pending > 0 || liveMobs().length < mobTarget()) {
    respawn.pending = Math.max(0, respawn.pending - 1);
    spawnPack();
  }
  respawn.packs = livePackCount();
}

export function pickMobType() {
  const unlocked = unlockedMobs(player.level), special = unlocked.slice(1);
  return special.length && Math.random() < 0.5 ? pick(special) : unlocked[0];
}

export function spawnPack() {
  let center;
  for (let tries = 0; tries < 40; tries++) {
    // Rund um den Spieler, sonst verdünnt die große Karte die Dichte. // PH
    const a = rand(0, Math.PI * 2), r = rand(PACK_NEAR, PACK_FAR);
    center = new THREE.Vector3(player.pos.x + Math.cos(a) * r, 0, player.pos.z + Math.sin(a) * r);
    const inMap = Math.hypot(center.x, center.z) < 85 * WORLD_K;
    const farFromPacks = state.mobs.every(m => m.dead || dist2d(m.home, center) > 18);
    if (inMap && farFromPacks && (zone.spawnOk?.(center.x, center.z) ?? true)) break;
  }
  const base = Math.max(randInt(LEVEL_PACK_MIN, LEVEL_PACK_MAX), clamp(levelPackSize() + randInt(-1, 1), 2, 10));
  const size = base * modFactor('packSize');
  const spread = Math.max(LEVEL_PACK_SPREAD, base / 2);   // große Packs brauchen wieder mehr Platz
  const packId = ++state.packCounter;
  const unlocked = unlockedMobs(player.level), special = unlocked.slice(1);
  for (let i = 0; i < size; i++) {
    const typeId = i === 0 && size >= 3 && special.includes(zone.packAlways) && Math.random() < 0.5 ? zone.packAlways : special.length && Math.random() < 0.5 ? pick(special) : unlocked[0];
    const level = Math.max(1, player.level + [-1, 0, 0, 1, 1, 2][randInt(0, 5)]);
    const pos = center.clone().add(new THREE.Vector3(rand(-spread, spread), 0, rand(-spread, spread)));
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
  pos.y = groundAt(pos.x, pos.z, pos.y);
  resolve(pos, 0.7);
  pos.y = groundAt(pos.x, pos.z, pos.y);
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
    pos: model.root.position, home: pos.clone(), packId,
    level, hp, maxHp: hp, speedMul: type.speedMul ?? 1,
    state: 'idle', assistAt: 0, nextSwing: 0, attackAt: -1e9, rootUntil: 0, slowUntil: 0, slowPct: 0,
    fleeRolled: false, fleeTarget: null, fleeUntil: 0, dead: false, deathAt: 0, moving: false, leap: null, hidden: false,
  };
  if (type.stealth) { mob.hidden = true; model.root.visible = false; }
  state.mobs.push(mob);
  return mob;
}

export function enterCombat(mob, callForHelp) {
  if (mob.dead || mob.state === 'combat') return;
  mob.state = 'combat';
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
  target = climbTarget(mob.pos, target);
  const dx = target.x - mob.pos.x, dz = target.z - mob.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return;
  const step = Math.min(d, speed * dt / 1000);
  const dir = steer(mob, dx / d, dz / d, 0.7);
  mob.pos.x += dir.x * step;
  mob.pos.z += dir.z * step;
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
  mob.leap = { x0: mob.pos.x, y0: mob.pos.y, z0: mob.pos.z, x1: target.x, y1: groundAt(target.x, target.z, Math.max(mob.pos.y, player.pos.y)), z1: target.z, start: state.now, dur, onLand };
  mob.moving = true;
  mob.speed = CFG.mobSpeed;
}

function updateLeap(mob) {
  const l = mob.leap, t = clamp((state.now - l.start) / l.dur, 0, 1);
  mob.pos.x = lerpTo(l.x0, l.x1, t);
  mob.pos.z = lerpTo(l.z0, l.z1, t);
  mob.pos.y = lerpTo(l.y0, l.y1, t) + Math.sin(t * Math.PI) * 2;
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
    if (player.dead) { startEvade(mob); return; }   // Kein Leash: Mobs verlieren die Aggro nur, wenn die Figur stirbt
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
  settle(mob, 0.7, dt);
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
// noRoll: fester Schaden ohne Treffer- und Crit-Wurf (Feuerspur), sonst wie jeder Spielerschaden
export function damageMob(mob, amount, source, castKey?, noRoll = false) {
  if (mob.dead) return false;
  if (mob.state === 'evade') { combatText(mob.pos, 'Entkommen', 'miss'); return false; }
  if (mob.state === 'idle') enterCombat(mob, true);
  player.lastCombat = state.now;

  if (!noRoll && Math.random() * 100 >= hitChance(mob)) { combatText(mob.pos, 'Widerstanden', 'miss'); return false; }

  mob.castKey = castKey ?? source;
  amount *= modFactor('dmg');
  if (mob.markUntil > state.now) amount *= mob.markMul;   // Seelenfang (realMen.ts)
  if (mob.ability?.onDamaged) {
    amount = mob.ability.onDamaged(mob, amount, source);
    if (amount <= 0) { combatText(mob.pos, 'Immun', 'miss'); return true; }
  }

  const frozen = mob.rootUntil > state.now;
  const crit = !noRoll && Math.random() < CFG.baseCrit + (frozen ? mods.shatter : 0);
  const dmg = Math.round(amount * dmgMult() * mobDmgTaken(mob.level) * (crit ? 1 + CFG.critBonus : 1));
  mob.hp -= dmg;
  mob.hitAt = state.now;
  if (crit) { shakeCamera(0.18); rumble(0.3, 0.6, 120); }   // PH: Rumble-Werte
  damageNumber(mob, dmg, crit, source);
  run.dmgBySource[source] = (run.dmgBySource[source] || 0) + dmg;
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
  mob.corpseY ??= groundAt(mob.pos.x, mob.pos.z, mob.pos.y);
  mob.pos.y = mob.corpseY - t * 1.4;
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
  target.y = mob.pos.y;
  resolve(target, 0.7);
  startLeap(mob, target, dur, () => {});
}

// Status: Mob schlägt langsamer. Pro Frame aufgerufen, schiebt den nächsten Schlag so, als liefe die Uhr pct langsamer.
export function slowSwing(mob, pct, dt) {
  mob.nextSwing += dt * (1 / (1 - pct) - 1);
}
