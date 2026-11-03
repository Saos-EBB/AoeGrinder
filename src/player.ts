import * as THREE from 'three';
import { state, player } from './state';
import { $, clamp } from './util';
import { CFG, SPELLS, mods, resetMods, LEVEL_START, LEVEL_MAX, CARD_CLASSIC_EVERY, CARD_PACES } from './config';
import { xpNeeded, maxHp, maxMana, spirit } from './formulas';
import { scene } from './render';
import { heightAt, zone, zoneId, buildWorld } from './world';
import { groundAt, resolve, STEP } from './collision';
import { blizCursor, levelUpFx } from './fx/spellFx';
import { cam, autoCamOn } from './camera';
import { combatText, fmtTime } from './ui/hud';
import { showCards, levelRefill } from './ui/menus';
import { rankAllSpells } from './cards';
import { mouseBtn, act } from './input';
import { fillPacks, removeMob, announceNewMobs } from './mobs';
import { clearAbilities } from './abilities';
import { resetScore } from './score';
import './ui/scoreHud';
import { showRunResult } from './ui/leaderboardView';
import { updateChannel, stopChannel, stopDrink, modRule } from './spells';
import { pad, rumble } from './gamepad';
import { mage, startMageRun, endMageRun } from './models/mage';
import { resetSiege } from './siege';
import { noteSplits, resetSplits } from './leaderboard';
import { mobMode, cardPaceId, modValue } from './modifiers';
import { iceBlocked, updateIceBlock } from './spells/iceblock';
import { W, addTrauma } from './wucht';
import { hitstop } from './fx/impact';
import { resetRealMen, rageOnHit, moveMul, rooted, takenMul, warriorUntouchable, warriorUndying } from './realMen';
import { resetKlinge, klingeMoveMul, klingeRooted, klingeUntouchable } from './klinge';

export function resetGame() {
  startMageRun();
  for (const m of state.mobs) removeMob(m);
  clearAbilities();
  state.mobs = [];
  resetMods();
  resetScore();
  state.cardRanks = {};
  state.cardPicks = {};
  state.now = 0;
  state.pendingLevelUps = 0;
  state.nextCardAt = 0;
  state.cardRush = false;
  state.newMob = null;
  state.autorun = false;
  Object.assign(player, {
    pos: new THREE.Vector3(zone.spawn.x, heightAt(zone.spawn.x, zone.spawn.z), zone.spawn.z), vel: new THREE.Vector3(), grounded: true,
    facing: Math.PI, slowUntil: 0, stunUntil: 0, iceUntil: 0, poison: null, moveState: 'idle', moveSpeed: CFG.runSpeed, landAt: -1e9, level: LEVEL_START, xp: 0,
    lastManaUse: -1e9, nextRegen: CFG.regenTick, gcdUntil: 0, cds: {}, castAnimUntil: 0,
    channel: null, drink: null, targeting: false, lastCombat: -1e9, dead: false, won: false, kills: 0,
  });
  cam.offset = 0;
  player.hp = maxHp();
  player.mana = maxMana();
  resetRealMen();
  resetKlinge();
  resetSiege();
  resetSplits();
  blizCursor.visible = false;
  stopChannel();
  fillPacks();
}

// Dev: Zone wechseln. Mobs weg, Welt neu, Spieler in die Mitte; Level und Karten bleiben
export function switchZone(id) {
  for (const m of state.mobs) removeMob(m);
  clearAbilities();
  state.mobs = [];
  state.autorun = false;
  stopChannel(); stopDrink();
  player.targeting = false;
  blizCursor.visible = false;
  buildWorld(id);
  player.pos.set(zone.spawn.x, heightAt(zone.spawn.x, zone.spawn.z), zone.spawn.z);
  player.vel.set(0, 0, 0);
  player.grounded = true;
  player.facing = Math.PI;
  player.slowUntil = player.stunUntil = 0;
  player.poison = null;
  cam.offset = 0;
  fillPacks();
}

// Dev: Level setzen. Mobs kommen neu, damit die Freischaltung sofort zu sehen ist. Im Run gibt es nach oben die Karten des Kartentakts, ohne Lücke; bisherige Karten bleiben
export function setLevel(level) {
  const fromLevel = player.level;
  player.level = level;
  player.xp = 0;
  player.hp = maxHp();
  player.mana = maxMana();
  switchZone(zoneId);
  announceNewMobs(fromLevel);
  if ($('startModal').classList.contains('show')) return;
  for (let lvl = fromLevel + 1; lvl <= level; lvl++) {
    if (!modRule('noCards')) state.pendingLevelUps += cardAtLevel(lvl) ? 1 : 0;
    else if (lvl % CARD_CLASSIC_EVERY === 0) rankAllSpells();
  }
  state.cardRush = state.pendingLevelUps > 0;
  updateCardQueue();
}

export function damagePlayer(amount, dot = false) {
  if (player.dead || klingeUntouchable() || warriorUntouchable() || iceBlocked()) return;
  amount = Math.max(1, Math.round(amount * takenMul()));
  player.hp -= amount;
  if (player.hp < 1 && warriorUndying()) player.hp = 1;   // Letzter Atem
  // Todesursache: hitPlayer setzt attackAt direkt vor dem Schaden
  player.lastHitBy = dot ? 'Gift' : state.mobs.find(m => m.attackAt === state.now)?.type.name ?? 'Lava';
  player.lastCombat = state.now;
  combatText(player.pos, amount, 'hurt', 2.6);
  addTrauma(amount / maxHp() * W.shake.hurtK);   // Wucht: eigener Schaden wackelt
  if (amount >= maxHp() * W.hitstop.hurtPct) hitstop(W.hitstop.hurtMs);
  if (amount > maxHp() * 0.05) rumble(0.7, 0.4, 180);   // PH: Rumble-Werte
  if (!dot) rageOnHit();
  if (!dot) {                            // Gift-Ticks brechen weder Trinken noch Channel
    if (player.drink && !player.drink.keepOnHit) stopDrink();
    pushbackChannel();
  }
  if (player.hp <= 0) die();
}

// Channel-Pushback: 1000, 800, 600, 400, 200, 200 ... ms (Spell::DelayedChannel)
function pushbackChannel() {
  const ch = player.channel;
  if (!ch) return;
  const delay = ch.delays < 5 ? 1000 - ch.delays * 200 : 200;
  ch.delays++;
  ch.end -= delay;
  if (ch.end <= state.now) stopChannel();
}

export function spendMana(cost) {
  if (cost <= 0) return;
  player.mana -= cost;
  player.lastManaUse = state.now;              // startet die 5-Sekunden-Regel
}

function regenerate(dt) {
  if (state.now >= player.nextRegen) {         // Tick alle 2 s
    player.nextRegen += CFG.regenTick;
    let mana = spirit() / 4 + 12.5;
    if (state.now - player.lastManaUse < CFG.fiveSecRule) mana *= mods.castRegen;
    if (!player.rageMax) player.mana = Math.min(maxMana(), player.mana + mana);   // Wut regeneriert nicht
    if (state.now - player.lastCombat > 5000) player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.03);  // PH
  }
  if (player.drink) {                    // PH: 90 % Mana + 50 % HP über 18 s
    player.mana = Math.min(maxMana(), player.mana + maxMana() * 0.9 * dt / SPELLS.drink.dur);
    player.hp = Math.min(maxHp(), player.hp + maxHp() * (player.drink.hp ?? 0.5) * dt / (player.drink.dur ?? SPELLS.drink.dur));   // Essen: eigene Werte
    const full = player.mana >= maxMana() && player.hp >= maxHp();
    if (state.now >= player.drink.end || full) stopDrink();
  }
}

export function gainXp(xp) {
  const fromLevel = player.level;
  player.xp += xp;
  while (player.level < LEVEL_MAX && player.xp >= xpNeeded()) {
    player.xp -= xpNeeded();
    player.level++;
    levelRefill();
    if (!modRule('noCards')) state.pendingLevelUps += cardAtLevel(player.level) ? 1 : 0;
    else if (player.level % CARD_CLASSIC_EVERY === 0) rankAllSpells();   // Classic pur: statt Karten ein Rang, das Spiel läuft weiter
  }
  if (player.level >= LEVEL_MAX) player.xp = 0;
  announceNewMobs(fromLevel);
  noteSplits(fromLevel);
  if (mobMode === 'packs' && player.level >= LEVEL_MAX && fromLevel < LEVEL_MAX) return completeRun('Level 100');
  if (player.level > fromLevel) levelUpFx();
  updateCardQueue();
}

const cardPace = () => CARD_PACES.find(p => p.id === cardPaceId);
function cardAtLevel(level) {
  return level % cardPace().levels.find(b => level <= b.to).every === 0;
}

// Auch mehrere Level auf einmal öffnen nur ein Fenster, die übrigen kommen frühestens nach der Lücke des Kartentakts
export function updateCardQueue() {
  if (state.pendingLevelUps <= 0) { state.cardRush = false; return; }
  if ((state.now < state.nextCardAt && !state.cardRush) || player.dead || $('cardModal').classList.contains('show')) return;
  state.nextCardAt = state.now + cardPace().gap;
  showCards();
}

// Abschluss: Level 100 bei Packs, Zeitziel in der Belagerung. Läuft durch den normalen Ergebnis-Screen.
export function completeRun(reason) {
  if (player.dead) return;
  player.won = true;
  player.lastHitBy = reason;
  state.pendingLevelUps = 0;
  $('cardModal').classList.remove('show');
  die();
}

export function die() {
  player.dead = true;
  player.hp = 0;
  endMageRun();
  showRunResult();
  stopChannel(); stopDrink();
  state.paused = true;
  setTimeout(() => {
    $('deathStats').innerHTML = `Level <b>${player.level}</b> · <b>${player.kills}</b> Kills · Zeit <b>${fmtTime(state.now)}</b>`;
    $('deathModal').classList.add('show');
  }, 900);
}

// Bewegung wie in WoW: A/D drehen, Q/E (oder A/D mit rechter Maus) seitwärts,
// kein Lenken in der Luft, Rückwärts langsamer.
export function updatePlayer(dt) {
  const s = dt / 1000;
  const turn = (act('turnLeft') ? 1 : 0) - (act('turnRight') ? 1 : 0);
  if (!mouseBtn.right) player.facing += turn * CFG.turnSpeed * s;

  const stunned = player.stunUntil > state.now || rooted() || klingeRooted() || iceBlocked();
  if (stunned) state.jumpQueued = false;
  let fwd = (act('forward') || state.autorun || (mouseBtn.left && mouseBtn.right)) ? 1 : 0;
  if (act('back')) fwd -= 1;
  let strafe = (act('strafeRight') ? 1 : 0) - (act('strafeLeft') ? 1 : 0);
  if (mouseBtn.right) strafe -= turn;
  strafe = clamp(strafe, -1, 1);
  fwd += pad.move.y;
  strafe += pad.move.x;
  if (stunned) fwd = strafe = 0;

  if (player.grounded) {
    const f = player.facing;
    let vx = Math.sin(f) * fwd - Math.cos(f) * strafe;
    let vz = Math.cos(f) * fwd + Math.sin(f) * strafe;
    const len = Math.hypot(vx, vz);
    // Tastatur und Stick zusammen höchstens Länge 1: W plus Stick vorne ist nicht schneller
    const amount = Math.min(1, Math.hypot(fwd, strafe));
    const speed = (amount < CFG.padWalkBelow ? CFG.walkSpeed : fwd < 0 ? CFG.backSpeed : CFG.runSpeed) * (mage.fx.speedMul ?? 1) * moveMul() * klingeMoveMul() * mods.moveMul;
    const slowed = player.slowUntil > state.now ? speed * (1 - CFG.curseSlow) : speed;
    player.vel.x = len ? vx / len * slowed : 0;
    player.vel.z = len ? vz / len * slowed : 0;
    player.moveState = len ? (fwd < 0 ? 'back' : 'run') : 'idle';
    player.moveSpeed = len ? slowed : CFG.runSpeed;   // anim.speed: echtes Tempo
    if (state.jumpQueued) {
      player.vel.y = CFG.jumpSpeed;
      player.grounded = false;
    }
  }
  state.jumpQueued = false;

  const moved = Math.hypot(player.vel.x, player.vel.z) > 0 || !player.grounded;
  player.pos.x += player.vel.x * s;
  player.pos.z += player.vel.z * s;
  resolve(player.pos, 0.45);

  const ground = groundAt(player.pos.x, player.pos.z, player.pos.y);
  if (player.grounded) {
    if (player.pos.y - ground > STEP) { player.grounded = false; player.vel.y = 0; }   // von der Kante gefallen
    else player.pos.y = ground;          // klebt am Boden (auch bergab)
  }
  if (!player.grounded) {
    player.vel.y -= CFG.gravity * s;
    player.pos.y += player.vel.y * s;
    // Im Aufstieg nur am Gelände landen, sonst bliebe der Sprung an jeder Kante hängen
    if (player.pos.y <= ground && (player.vel.y <= 0 || ground <= heightAt(player.pos.x, player.pos.z))) { player.pos.y = ground; player.vel.y = 0; player.grounded = true; player.landAt = state.now; }
  }

  if (moved) {
    if (player.channel && !modValue('castWhileMoving')) stopChannel();   // Bewegung bricht Channel und Trinken ab, außer in Arcane only
    if (player.drink) stopDrink();
    if (!mouseBtn.left && !autoCamOn()) cam.offset -= cam.offset * Math.min(1, s * 3);   // Kamera dreht sich langsam hinter den Spieler
  }
  if (player.poison) {
    const pz = player.poison;
    if (state.now >= pz.until) player.poison = null;
    else if (state.now >= pz.nextTick) {
      pz.nextTick += 2000;
      damagePlayer(4 * pz.stacks, true);   // PH
    }
  }
  updateChannel();
  updateIceBlock();
  regenerate(dt);
}
