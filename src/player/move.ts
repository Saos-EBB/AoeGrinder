// Bewegung und Dodge des Spielers (ARCH-06, aus player.ts): je Frame updatePlayer (Steuerung, Sprung, Boden, Gift, Kanäle, Meter, Regeneration).
import { state, player } from '../state';
import { clamp } from '../util';
import { CFG, mods } from '../config';
import { maxHp } from '../formulas';
import { heightAt, zone } from '../world';
import { groundAt, resolve, STEP } from '../collision';
import { cam, autoCamOn, MOBILE_YAW } from '../camera';
import { device } from '../device';
import { mouseBtn, act } from '../input';
import { burnMob, pullMob, applyRoot } from '../mobs';
import { updateChannel, stopChannel, stopDrink } from '../spells';
import { pad } from '../gamepad';
import { heroModel } from '../models/heroModel';
import { modValue } from '../modifiers';
import { iceBlocked, updateIceBlock } from '../spells/iceblock';
import { tryDodge, dodgeMove, dodgeMode, DG } from '../dodge';
import { mobsInRadius } from '../spells/core';
import { novaFx } from '../fx/spellFx';
import { updateWeaponAura } from '../weaponRolls';
import { moveMul, rooted, cancelWarriorMove } from '../realMen';
import { updateMeter } from '../schoolMeter';
import { buffSpeedMul } from '../buffs';
import { updateBattery } from '../battery';
import { updatePlague, plagueRooted } from '../spells/plague';
import { updateRandomMage } from '../spells/random';
import { t } from '../i18n';
import { damagePlayer, regenerate } from './damage';

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
const dodgeTrail = d => heroModel.trail?.add(player.pos.x, player.pos.y, player.pos.z, Math.atan2(d.dx, d.dz), (d.side = -(d.side ?? 1)));

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
    const speed = (amount < CFG.padWalkBelow ? CFG.walkSpeed : fwd < 0 ? CFG.backSpeed : CFG.runSpeed) * (heroModel.fx.speedMul ?? 1) * moveMul() * mods.moveMul * buffSpeedMul() * (player.speedBuff ?? 1) * (player.iceGroundUntil > state.now ? 1.2 : 1);   // speedBuff: Feuerspur, iceGroundUntil: gefrorener Boden (figures.ts)
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
