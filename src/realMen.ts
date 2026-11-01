// Real Men: Skelett-Krieger mit Wut statt Mana. Die vier Attacken liegen als Spells in den Slots, damit Leiste, Tasten, Pad und Karten mitlaufen.
// Wut steht in player.mana, player.rageMax meldet den Modus an maxMana und die Regeneration.

import { state, player } from './state';
import { $, rand } from './util';
import { SPELLS, SPELL_ACTIONS } from './config';
import { mage, onWarriorHit } from './models/mage';
import { WAR_TIMING } from './models/mageModel';
import { act } from './input';
import { pad, padBinds } from './gamepad';
import { showError } from './ui/hud';
import { slowSwing } from './mobs';
import { makeCtx, mobsInRadius } from './spells/core';

// Alle Zahlen hier. [Classic] = WoW Classic, Quellen in docs/handoff.md; alles andere ist // PH
export const REALMEN = {
  rage: { max: 100, start: 0, perMobHit: 8, perSwingMax: 15, perHitTaken: 3, decayPerS: 1, outOfCombatMs: 5000 },
  attack: { dmg: [28, 34], radius: 2.5 },
  whirlwind: { dmg: [18, 22], radius: 8 /* Classic */, tickMs: 500, ragePerS: 10, speedMul: 0.7, tapMs: 300 },   // trifft alle Mobs, Classic nur 4
  smash: { dmg: [110, 130], radius: 4, rage: 20, cd: 6000 },
  thunderclap: { dmg: [10, 10] /* Classic */, radius: 8 /* Classic */, rage: 20 /* Classic */, cd: 6000 /* Classic-Client 3.x */, attackSlow: 0.1 /* Classic */, slowMs: 10000 /* Classic */ },
};

const R = REALMEN;
const spell = (name, desc, cd, mana, ranks, press) => ({ name, desc, ranks, tags: ['Krieger'], cls: 'fire', fixed: true, cd, mana, press });
// fixed: nie als Karte in anderen Modi
Object.assign(SPELLS, {
  wAttack: spell('Hieb', 'Zweihandschlag, solange gehalten. Bringt Wut.', 0, 0, ['dmg', 'radius'], () => pressAttack()),
  wWhirl: spell('Wirbelwind', 'Halten: trifft alles um dich, kostet Wut pro Sekunde.', 0, 0, ['dmg', 'radius'], () => pressWhirl()),
  wSmash: spell('Smash', 'Sprung und Hieb in den Boden vor dir.', R.smash.cd, R.smash.rage, ['dmg', 'radius'], () => pressOnce('wSmash')),
  wClap: spell('Donnerknall', 'Stampfer: trifft alles um dich, Mobs schlagen langsamer.', R.thunderclap.cd, R.thunderclap.rage, ['dmg', 'radius'], () => pressOnce('wClap')),
});

const isWarrior = () => mage.skin === 'krieger';

// Taste oder Pad-Knopf des Slots, in dem die Attacke liegt
function held(id) {
  const action = SPELL_ACTIONS[state.slots.indexOf(id)];
  return !!action && (act(action) || !!pad.down[padBinds[action]]);
}

export function rageOnHit() {
  if (isWarrior()) gainRage(R.rage.perHitTaken);
}
function gainRage(n) { player.mana = Math.min(R.rage.max, player.mana + n); }

// Nach dem Zurücksetzen von Leben und Mana im Run-Start
export function resetRealMen() {
  const on = isWarrior();
  player.rageMax = on ? R.rage.max : undefined;
  if (on) player.mana = R.rage.start;
  $('manaFill').style.background = on ? 'linear-gradient(#e0503c, #8a1a10)' : '';
  clearAttacks();
}

const ONCE = {
  wSmash: { def: R.smash, ability: 'smash', ms: WAR_TIMING.smash },
  wClap: { def: R.thunderclap, ability: 'thunderclap', ms: WAR_TIMING.thunderclap },
};
const roll = (r: number[]) => rand(r[0], r[1]);

let once = null;                                   // laufender Smash oder Donnerknall: { id, ability, until, ctx }
let attackUntil = 0, attackCtx = null;             // Grundangriff: läuft den Zyklus immer zu Ende, ein Tippen gibt einen ganzen
let whirlOn = false, whirlUntil = 0, whirlCtx = null, nextWhirlTick = 0;

function clearAttacks() {
  once = null;
  attackUntil = 0; attackCtx = null;
  whirlOn = false; whirlUntil = 0; whirlCtx = null;
}

function pressAttack() {
  if (once) return;
  startAttackCycle();
}
function startAttackCycle() {
  if (state.now >= attackUntil) { attackUntil = state.now + WAR_TIMING.cast; attackCtx = makeCtx('wAttack'); }
}
function pressWhirl() {
  if (player.mana <= 0) return showError('Nicht genug Wut');
  whirlUntil = state.now + R.whirlwind.tapMs;
}
function pressOnce(id) {
  const o = ONCE[id];
  if (once) return;
  if (!player.grounded) return showError('Du kannst das nicht im Sprung tun');
  if ((player.cds[id] || 0) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  if (player.mana < o.def.rage) return showError('Nicht genug Wut');
  player.mana -= o.def.rage;
  player.cds[id] = state.now + o.def.cd;
  player.lastCombat = state.now;
  attackUntil = 0; whirlOn = false; whirlUntil = 0;
  once = { id, ability: o.ability, until: state.now + o.ms, ctx: makeCtx(id) };
}

// Treffer-Moment aus der Animation; die Position ist Schwertspitze oder Spieler
onWarriorHit((kind, x, z) => {
  if (!isWarrior() || player.dead) return;
  const at = { x, y: player.pos.y, z };
  if (kind === 'cast' && attackCtx) {
    let landed = 0;
    for (const m of mobsInRadius(at, attackCtx.radius(R.attack.radius))) if (attackCtx.hit(m, roll(R.attack.dmg))) landed++;
    gainRage(Math.min(R.rage.perSwingMax, landed * R.rage.perMobHit));
  } else if (kind === 'smash' && once?.id === 'wSmash') {
    for (const m of mobsInRadius(at, once.ctx.radius(R.smash.radius))) once.ctx.hit(m, roll(R.smash.dmg));
  } else if (kind === 'thunderclap' && once?.id === 'wClap') {
    for (const m of mobsInRadius(player.pos, once.ctx.radius(R.thunderclap.radius))) {
      if (once.ctx.hit(m, roll(R.thunderclap.dmg))) m.clapUntil = state.now + R.thunderclap.slowMs;
    }
  }
});

export function updateRealMen(dt) {
  if (!isWarrior() || player.dead) return;
  const now = state.now, s = dt / 1000;
  for (const m of state.mobs) if (m.clapUntil > now) slowSwing(m, R.thunderclap.attackSlow, dt);
  if (now - player.lastCombat > R.rage.outOfCombatMs) player.mana = Math.max(0, player.mana - R.rage.decayPerS * s);
  if (once && now >= once.until) once = null;

  const stunned = player.stunUntil > now;
  const wantWhirl = !once && !stunned && player.mana > 0 && (held('wWhirl') || now < whirlUntil);
  if (wantWhirl) {
    if (!whirlOn) { whirlOn = true; whirlCtx = makeCtx('wWhirl'); attackUntil = 0; }
    if (now >= nextWhirlTick) {
      nextWhirlTick = now + R.whirlwind.tickMs;
      player.lastCombat = now;
      for (const m of mobsInRadius(player.pos, whirlCtx.radius(R.whirlwind.radius))) whirlCtx.hit(m, roll(R.whirlwind.dmg));
    }
    player.mana = Math.max(0, player.mana - R.whirlwind.ragePerS * s);
  } else whirlOn = false;

  if (!once && !whirlOn && !stunned && held('wAttack')) startAttackCycle();
}

export const moveMul = () => whirlOn ? R.whirlwind.speedMul : 1;
export const rooted = () => !!once;                // Smash und Donnerknall: keine Bewegung

// Pause mitten in einer Attacke: Pose anhalten, sonst geht der Treffer der laufenden Animation verloren
export function realMenAnim() {
  if (!isWarrior() || player.dead) return {};
  const attack = state.now < attackUntil;
  const busy = once || whirlOn || attack;
  return { ability: once?.ability ?? (whirlOn ? 'whirlwind' : null), attack, frozen: !!(state.paused && busy) };
}
