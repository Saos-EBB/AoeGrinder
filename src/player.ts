import * as THREE from 'three';
import { state, player } from './state';
import { $, clamp } from './util';
import { CFG, SPELLS, mods, resetMods, LEVEL_START, LEVEL_MAX, CARD_CLASSIC_EVERY, CARD_PACES } from './config';
import { xpNeeded, maxHp, maxMana, spirit } from './formulas';
import { heightAt, zone, zoneId, buildWorld } from './world';
import { groundAt, resolve, STEP } from './collision';
import { blizCursor, levelUpFx } from './fx/spellFx';
import { cam, autoCamOn, MOBILE_YAW } from './camera';
import { device } from './device';
import { combatText, fmtTime } from './ui/hud';
import { showCards, levelRefill } from './ui/menus';
import { rankAllSpells } from './cards';
import { mouseBtn, act, useMeleeBinds } from './input';
import { fillPacks, removeMob, announceNewMobs, burnMob, pullMob } from './mobs';
import { clearAbilities } from './abilities';
import { resetScore } from './score';
import './ui/scoreHud';
import { showRunResult } from './ui/leaderboardView';
import { hurtNumber } from './ui/dmgNumbers';
import { updateChannel, stopChannel, stopDrink, modRule } from './spells';
import { pad, rumble } from './gamepad';
import { mage, startMageRun, endMageRun } from './models/mage';
import { resetWaves } from './waves';
import { noteSplits, resetSplits } from './leaderboard';
import { mobMode, cardPaceId, modValue } from './modifiers';
import { iceBlocked, updateIceBlock } from './spells/iceblock';
import { resetDodge, tryDodge, dodgeMove, dodgeIframes, perfectDodge, dodgeMode, DG } from './dodge';
import { mobsInRadius } from './spells/core';
import { applyRoot } from './mobs';
import { novaFx } from './fx/spellFx';
import { updateWeaponAura } from './weaponRolls';
import { W, addTrauma } from './wucht';
import { hitstop } from './fx/impact';
import { resetRealMen, warriorRevive, rageOnHit, moveMul, rooted, takenMul, warriorUntouchable, warriorUndying, cancelWarriorMove } from './realMen';
import { phoenixRevive } from './spells/phoenix';
import { resetMeter, updateMeter } from './schoolMeter';
import { resetFigures } from './figures';
import { resetLegends, eggRevive } from './legends';
import { resetBuffs, buffSpeedMul } from './buffs';
import { resetBattery, updateBattery } from './battery';
import { resetPlague, updatePlague, plagueRooted } from './spells/plague';
import { updateRandomMage } from './spells/random';
import { t } from './i18n';
import { resetLoot } from './loot';

// Neuer Run auf einer generierten Map: Map mit neuem Seed neu bauen (vor resetGame, das den Spieler auf zone.spawn setzt)
export function newRunMap() { if (zone.gen) buildWorld(zoneId); }

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
  heldXp = 0;
  state.nextCardAt = 0;
  state.cardRush = false;
  state.newMob = null;
  state.autorun = false;
  Object.assign(player, {
    pos: new THREE.Vector3(zone.spawn.x, heightAt(zone.spawn.x, zone.spawn.z), zone.spawn.z), vel: new THREE.Vector3(), grounded: true,
    facing: Math.PI, slowUntil: 0, stunUntil: 0, iceUntil: 0, poison: null, moveState: 'idle', moveSpeed: CFG.runSpeed, landAt: -1e9, level: LEVEL_START, xp: 0,
    lastManaUse: -1e9, nextRegen: CFG.regenTick, cds: {}, castAnimUntil: 0,
    channel: null, drink: null, targeting: false, lastCombat: -1e9, dead: false, won: false, kills: 0, invulnUntil: 0, rebornUntil: 0, riseAt: -1e9,
  });
  cam.offset = 0;
  player.hp = maxHp();
  player.mana = maxMana();
  resetRealMen();
  resetDodge();
  resetMeter();
  resetFigures();
  resetLegends();
  player.shield = 0;
  resetBuffs();
  useMeleeBinds(mage.skin === 'krieger');
  resetBattery();
  resetPlague();
  resetLoot();
  resetWaves();
  resetSplits();
  state.devUsed = false;   // Dev-Panel markiert den Run (ui/devPanel.ts)
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

export function damagePlayer(amount, dot = false, source = '') {
  if (player.dead || warriorUntouchable() || iceBlocked() || player.invulnUntil > state.now) return;   // invulnUntil: Phönix
  if (!dot && dodgeIframes()) { perfectDodge(); return; }   // Dodge: Angriffe und Geschosse gehen durch (perfekt), Gift und Lava nicht
  amount = Math.max(1, Math.round(amount * takenMul()));
  if (player.shield > 0 && player.shieldUntil > state.now) {   // Eisbarriere (spells/icebarrier.ts)
    const a = Math.min(player.shield, amount);
    player.shield -= a; amount -= a;
    if (player.shield <= 0) player.onShieldBreak?.();
    if (amount <= 0) { combatText(player.pos, t('msg.absorbed'), 'miss', 2.6); return; }
  }
  player.hp -= amount;
  hurtNumber(player.pos, amount);   // Anzeige im Zahlen-Stil (ui/dmgNumbers.ts)
  if (player.hp < 1 && warriorUndying()) player.hp = 1;   // Letzter Atem
  // Todesursache: hitPlayer setzt attackAt direkt vor dem Schaden
  player.lastHitBy = source || (dot ? t('fx.poison') : state.mobs.find(m => m.attackAt === state.now)?.type.name ?? t('cause.lava'));
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
  if (player.hp <= 0 && !phoenixRevive() && !eggRevive() && !warriorRevive()) die();   // Phönix zuerst, dann Murky-Ei (legends.ts), dann Ruhm im Tod (Sions Axt)
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
    if (state.now - player.lastCombat > 5000 && !modValue('lifeCost')) player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.03);  // PH; Blutmagier heilt nur über Infekt, Saugen, Lachen
  }
  if (player.drink?.custom) {            // Getränk des ?-Magiers: wirkt erst, wenn er sitzen bleibt (random.ts)
    if (state.now >= player.drink.end) { const done = player.drink.onDone; stopDrink(); done(); }
  } else if (player.drink) {             // PH: 90 % Mana + 50 % HP über 18 s
    player.mana = Math.min(maxMana(), player.mana + maxMana() * 0.9 * dt / SPELLS.drink.dur);
    player.hp = Math.min(maxHp(), player.hp + maxHp() * (player.drink.hp ?? 0.5) * dt / (player.drink.dur ?? SPELLS.drink.dur));   // Essen: eigene Werte
    const full = player.mana >= maxMana() && player.hp >= maxHp();
    if (state.now >= player.drink.end || full) stopDrink();
  }
}

// boss.ts: true = Level 100 startet erst den finalen Boss, das Ergebnis kommt nach seinem Tod
let runEndHook = () => false;
export const setRunEndHook = fn => { runEndHook = fn; };
// boss.ts: im Bosskampf wird XP gesammelt und erst nach dem Kampf gutgeschrieben (kein Level-up mitten im Kampf)
let xpHold = () => false, heldXp = 0;
export const setXpHold = fn => { xpHold = fn; };
export function releaseXp() { const xp = heldXp; heldXp = 0; if (xp > 0) gainXp(xp); }
export function gainXp(xp) {
  if (xpHold()) { heldXp += xp; return; }
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
  if (mobMode === 'packs' && player.level >= LEVEL_MAX && fromLevel < LEVEL_MAX) return runEndHook() ? undefined : completeRun(t('cause.lv100'));   // #boss: erst der finale Boss (boss.ts)
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
    $('deathStats').innerHTML = t('end.deathStats', { lv: player.level, kills: player.kills, time: fmtTime(state.now) });
    $('deathModal').classList.add('show');
  }, 900);
}

// Dodge (Taste Ausweichen): Sitzen, Kanal und Zauber brechen ab; Zauber laufen in Arcane only weiter. Krieger: bricht seinen Move ab
export function startDodge() {
  const from = player.pos.clone();
  const ok = tryDodge(() => {
    stopDrink();
    stopChannel(true);
    if (!modValue('castWhileMoving')) player.casting = null;
    cancelWarriorMove();
  });
  if (!ok || dodgeMode() !== 'frost') return;
  const N = DG.combo.miniNova;                             // Frost only: Mini-Nova am Startpunkt, ohne Mana und Abklingzeit
  for (const m of mobsInRadius(from, N.radius)) applyRoot(m, N.rootMs, 'ice');
  novaFx(from, N.radius);
}
// Fire only: Der Dodge legt Feuerspur wie die Schritte der Figur
const dodgeTrail = d => mage.trail?.add(player.pos.x, player.pos.y, player.pos.z, Math.atan2(d.dx, d.dz), (d.side = -(d.side ?? 1)));

// Bewegung wie in WoW: A/D drehen, Q/E (oder A/D mit rechter Maus) seitwärts,
// kein Lenken in der Luft, Rückwärts langsamer.
export function updatePlayer(dt) {
  const s = dt / 1000;
  const mirror = state.mirrorUntil > state.now ? -1 : 1;   // Wahnsinn (Yogg-Saron, bosses/rules.ts): links und rechts vertauscht
  const turn = ((act('turnLeft') ? 1 : 0) - (act('turnRight') ? 1 : 0)) * mirror;
  const locked = !!state.bossLock;                 // Boss-Lock-on (boss.ts): Blick hält boss.ts, A/D laufen seitwärts
  if (!mouseBtn.right && !locked) player.facing += turn * CFG.turnSpeed * s;

  const stunned = player.stunUntil > state.now || rooted() || iceBlocked() || plagueRooted();
  if (stunned) state.jumpQueued = false;
  let fwd = (act('forward') || state.autorun || (mouseBtn.left && mouseBtn.right)) ? 1 : 0;
  if (act('back')) fwd -= 1;
  let strafe = ((act('strafeRight') ? 1 : 0) - (act('strafeLeft') ? 1 : 0)) * mirror;
  if (mouseBtn.right || locked) strafe -= turn;
  strafe = clamp(strafe, -1, 1);
  if (device.mobile && (pad.move.x || pad.move.y)) {      // Handy, feste Kamera: Stick zeigt die Richtung auf dem Bildschirm, die Figur dreht sich dorthin
    const y = MOBILE_YAW, mx = pad.move.x * mirror, my = pad.move.y;
    player.facing = Math.atan2(Math.sin(y) * my - Math.cos(y) * mx, Math.cos(y) * my + Math.sin(y) * mx);
    fwd = Math.min(1, Math.hypot(mx, my)); strafe = 0;
  } else {
    fwd += pad.move.y;
    strafe += pad.move.x * mirror;
  }
  if (stunned) fwd = strafe = 0;

  const dodging = dodgeMove(player.pos, player.vel, dodgeMode() === 'feuer' ? dodgeTrail : null);   // Dodge setzt die Position selbst
  if (player.grounded && !dodging) {
    const f = player.facing;
    let vx = Math.sin(f) * fwd - Math.cos(f) * strafe;
    let vz = Math.cos(f) * fwd + Math.sin(f) * strafe;
    const len = Math.hypot(vx, vz);
    // Tastatur und Stick zusammen höchstens Länge 1: W plus Stick vorne ist nicht schneller
    const amount = Math.min(1, Math.hypot(fwd, strafe));
    const speed = (amount < CFG.padWalkBelow ? CFG.walkSpeed : fwd < 0 ? CFG.backSpeed : CFG.runSpeed) * (mage.fx.speedMul ?? 1) * moveMul() * mods.moveMul * buffSpeedMul() * (player.speedBuff ?? 1) * (player.iceGroundUntil > state.now ? 1.2 : 1);   // speedBuff: Feuerspur, iceGroundUntil: gefrorener Boden (figures.ts)
    const slowed = (player.slowUntil > state.now && !(player.berserkUntil > state.now) ? speed * (1 - CFG.curseSlow) : speed) * (zone.moveMul?.(player.pos.x, player.pos.z) ?? 1);   // Berserker: kein Slow; moveMul: Wasserrinne (mapgen)
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
  updateWeaponAura({ burnMob, pullMob });
  const overheat = updateMeter(dt);                         // Hitze: überhitzt brennt er selbst
  if (overheat) damagePlayer(maxHp() * overheat, true, t('meter.Feuer.full'));
  updateRandomMage(dt);
  updateBattery(dt);
  updatePlague();
  regenerate(dt);
}
