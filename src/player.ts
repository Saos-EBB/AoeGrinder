import * as THREE from 'three';
import { state, player } from './state';
import { $, clamp } from './util';
import { CFG, SPELLS, mods, resetMods } from './config';
import { xpNeeded, maxHp, maxMana, spirit } from './formulas';
import { scene } from './render';
import { heightAt, collide, zone, buildWorld } from './world';
import { blizCursor, levelUpFx } from './fx/spellFx';
import { cam } from './camera';
import { combatText, fmtTime } from './ui/hud';
import { showCards } from './ui/menus';
import { mouseBtn, act } from './input';
import { spawnPack, removeMob } from './mobs';
import { clearAbilities } from './abilities';
import { updateChannel, stopChannel, stopDrink } from './spells';
import { pad, rumble } from './gamepad';

export function resetGame() {
  for (const m of state.mobs) removeMob(m);
  clearAbilities();
  state.mobs = [];
  resetMods();
  state.cardRanks = {};
  state.now = 0;
  state.pendingLevelUps = 0;
  state.autorun = false;
  Object.assign(player, {
    pos: new THREE.Vector3(zone.spawn.x, heightAt(zone.spawn.x, zone.spawn.z), zone.spawn.z), vel: new THREE.Vector3(), grounded: true,
    facing: Math.PI, slowUntil: 0, moveState: 'idle', moveSpeed: CFG.runSpeed, landAt: -1e9, level: CFG.startLevel, xp: 0,
    lastManaUse: -1e9, nextRegen: CFG.regenTick, gcdUntil: 0, cds: {}, castAnimUntil: 0,
    channel: null, drink: null, targeting: false, lastCombat: -1e9, dead: false, kills: 0,
  });
  cam.offset = 0;
  player.hp = maxHp();
  player.mana = maxMana();
  blizCursor.visible = false;
  stopChannel();
  while (state.mobs.length < zone.packs.initialMobs) spawnPack();
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
  player.slowUntil = 0;
  cam.offset = 0;
  while (state.mobs.length < zone.packs.initialMobs) spawnPack();
}

export function damagePlayer(amount) {
  if (player.dead) return;
  player.hp -= amount;
  player.lastCombat = state.now;
  combatText(player.pos, amount, 'hurt', 2.6);
  if (amount > maxHp() * 0.05) rumble(0.7, 0.4, 180);   // PH: Rumble-Werte
  if (player.drink) stopDrink();
  pushbackChannel();
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
    player.mana = Math.min(maxMana(), player.mana + mana);
    if (state.now - player.lastCombat > 5000) player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.03);  // PH
  }
  if (player.drink) {                    // PH: 90 % Mana + 50 % HP über 18 s
    player.mana = Math.min(maxMana(), player.mana + maxMana() * 0.9 * dt / SPELLS.drink.dur);
    player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.5 * dt / SPELLS.drink.dur);
    const full = player.mana >= maxMana() && player.hp >= maxHp();
    if (state.now >= player.drink.end || full) stopDrink();
  }
}

export function gainXp(xp) {
  player.xp += xp;
  while (player.xp >= xpNeeded()) {
    player.xp -= xpNeeded();
    player.level++;
    state.pendingLevelUps++;
  }
  if (state.pendingLevelUps > 0 && !$('cardModal').classList.contains('show')) { levelUpFx(); showCards(); }
}

function die() {
  player.dead = true;
  player.hp = 0;
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

  let fwd = (act('forward') || state.autorun || (mouseBtn.left && mouseBtn.right)) ? 1 : 0;
  if (act('back')) fwd -= 1;
  let strafe = (act('strafeRight') ? 1 : 0) - (act('strafeLeft') ? 1 : 0);
  if (mouseBtn.right) strafe -= turn;
  strafe = clamp(strafe, -1, 1);
  fwd += pad.move.y;
  strafe += pad.move.x;

  if (player.grounded) {
    const f = player.facing;
    let vx = Math.sin(f) * fwd - Math.cos(f) * strafe;
    let vz = Math.cos(f) * fwd + Math.sin(f) * strafe;
    const len = Math.hypot(vx, vz);
    // Tastatur und Stick zusammen höchstens Länge 1: W plus Stick vorne ist nicht schneller
    const amount = Math.min(1, Math.hypot(fwd, strafe));
    const speed = amount < CFG.padWalkBelow ? CFG.walkSpeed : fwd < 0 ? CFG.backSpeed : CFG.runSpeed;
    const slowed = player.slowUntil > state.now ? speed * (1 - CFG.curseSlow) : speed;
    player.vel.x = len ? vx / len * slowed : 0;
    player.vel.z = len ? vz / len * slowed : 0;
    player.moveState = len ? (fwd < 0 ? 'back' : 'run') : 'idle';
    player.moveSpeed = len ? slowed : CFG.runSpeed;
    if (state.jumpQueued) {
      player.vel.y = CFG.jumpSpeed;
      player.grounded = false;
    }
  }
  state.jumpQueued = false;

  const moved = Math.hypot(player.vel.x, player.vel.z) > 0 || !player.grounded;
  player.pos.x += player.vel.x * s;
  player.pos.z += player.vel.z * s;
  collide(player.pos, 0.45);

  const ground = heightAt(player.pos.x, player.pos.z);
  if (player.grounded) {
    player.pos.y = ground;               // klebt am Boden (auch bergab)
  } else {
    player.vel.y -= CFG.gravity * s;
    player.pos.y += player.vel.y * s;
    if (player.pos.y <= ground) { player.pos.y = ground; player.vel.y = 0; player.grounded = true; player.landAt = state.now; }
  }

  if (moved) {
    if (player.channel) stopChannel();   // Bewegung bricht Channel und Trinken ab
    if (player.drink) stopDrink();
    if (!mouseBtn.left) cam.offset -= cam.offset * Math.min(1, s * 3);   // Kamera dreht sich langsam hinter den Spieler
  }
  updateChannel();
  regenerate(dt);
}
