// Real Men: Skelett-Krieger mit Wut statt Mana. Die vier Attacken liegen als Spells in den Slots, damit Leiste, Tasten, Pad und Karten mitlaufen.
// Wut steht in player.mana, player.rageMax meldet den Modus an maxMana und die Regeneration.

import { state, player } from './state';
import { $, rand } from './util';
import { SPELLS, SPELL_ACTIONS } from './config';
import { mage, onWarriorHit } from './models/mage';
import { WAR_TIMING } from './models/heroModels';
import { act } from './input';
import { pad, padBinds } from './gamepad';
import { showError } from './ui/hud';
import { slowSwing, applyRoot, pullMob } from './mobs';
import { groundAt, resolve, STEP } from './collision';
import { makeCtx, mobsInRadius, hasRune, applySlow } from './spells/core';
import { spellCd, maxHp } from './formulas';
import { shakeCamera } from './camera';
import { combatText } from './ui/hud';

// Alle Zahlen hier, auch die der Runen (RUNES). [Classic] = WoW Classic, Quellen in docs/handoff.md; alles andere ist // PH
export const REALMEN = {
  rage: { max: 100, start: 0, perMobHit: 8, perSwingMax: 15, perHitTaken: 3, decayPerS: 1, outOfCombatMs: 5000 },
  attack: { dmg: [28, 34], radius: 2.5 },
  whirlwind: { dmg: [18, 22], radius: 8 /* Classic */, tickMs: 500, ragePerS: 10, speedMul: 0.7, tapMs: 300 },   // trifft alle Mobs, Classic nur 4
  smash: { dmg: [110, 130], radius: 4, rage: 20, cd: 6000 },
  charge: { rage: 9 /* Classic Rang 1 */, range: 25 /* Classic */, cd: 15000 /* Classic */, stunMs: 1000 /* Classic */, speed: 30, hitRadius: 2.5, stunRadius: 3.5, dmg: [30, 40], stride: 7 },
  warcry: { rage: 10, cd: 30000, ms: 900, buffMs: 15000, dmgMul: 1.2 },
  thunderclap: { dmg: [10, 10] /* Classic */, radius: 8 /* Classic */, rage: 20 /* Classic */, cd: 6000 /* Classic-Client 3.x */, attackSlow: 0.1 /* Classic */, slowMs: 10000 /* Classic */ },
};

const R = REALMEN;
export const RUNES = {
  wide: 1.6, leechPct: 0.01, wrathMul: 1.5, wrathMax: 25,            // Hieb
  frenzyCost: 0.5, frenzyDmg: 0.8, maelstromPull: 4,                 // Wirbelwind
  quakeRadius: 1.5, stunMs: 2000, executeBelow: 0.3, executeMul: 2,  // Smash
  shockRadius: 1.5, frostSlow: 0.3, frostMs: 5000, stormRage: 5, stormMax: 30,   // Donnerknall
  longMs: 30000, fearMs: 2000, fearRadius: 8, angryRage: 20,         // Kampfschrei
  ragingRage: 20,                                                    // Ansturm
};
const avg = r => (r[0] + r[1]) / 2;
const spell = (name, desc, cd, mana, ranks, press, showDmg?) => ({ name, desc, showDmg, ranks, tags: ['Krieger'], cls: 'fire', school: 'warrior', fixed: true, cd, mana, press });
// fixed: nie als Karte in anderen Modi
Object.assign(SPELLS, {
  wAttack: spell('Hieb', 'Zweihandschlag, solange gehalten. Bringt Wut.', 0, 0, ['dmg', 'radius'], () => pressAttack(), avg(R.attack.dmg)),
  wWhirl: spell('Wirbelwind', 'Halten: trifft alles um dich, kostet Wut pro Sekunde.', 0, 0, ['dmg', 'radius'], () => pressWhirl(), avg(R.whirlwind.dmg)),
  wSmash: spell('Smash', 'Sprung und Hieb in den Boden vor dir.', R.smash.cd, R.smash.rage, ['dmg', 'radius'], () => pressOnce('wSmash'), avg(R.smash.dmg)),
  wClap: spell('Donnerknall', 'Stampfer: trifft alles um dich, Mobs schlagen langsamer.', R.thunderclap.cd, R.thunderclap.rage, ['dmg', 'radius'], () => pressOnce('wClap'), avg(R.thunderclap.dmg)),
  wCharge: spell('Ansturm', 'Stürmt nach vorn bis zum ersten Mob oder 25 yd, betäubt 1 s, bringt Wut.', R.charge.cd, 0, ['dmg'], () => pressCharge(), avg(R.charge.dmg)),
  wCry: spell('Kampfschrei', '+20 % Schaden für 15 s.', R.warcry.cd, R.warcry.rage, [], () => pressOnce('wCry')),
});

// Karten bieten sie an wie bei den Magiern, pro Attacke gilt eine Rune
Object.assign(SPELLS.wAttack, { runes: [{ id: 'wide', name: 'Weiter Schwung', desc: '+60 % Radius.' }, { id: 'leech', name: 'Blutdurst', desc: 'Heilt 1 % Leben pro getroffenem Mob.' }, { id: 'wrath', name: 'Wutschlag', desc: '+50 % Wut pro Schlag, bis 25.' }] });
Object.assign(SPELLS.wWhirl, { runes: [{ id: 'stride', name: 'Sturmschritt', desc: 'Volles Lauftempo im Wirbel.' }, { id: 'frenzy', name: 'Rasender Tanz', desc: 'Halbe Wutkosten, −20 % Schaden.' }, { id: 'maelstrom', name: 'Mahlstrom', desc: 'Zieht Mobs zu dir.' }] });
Object.assign(SPELLS.wSmash, { runes: [{ id: 'quake', name: 'Beben', desc: '+50 % Radius.' }, { id: 'stun', name: 'Schmetterschlag', desc: 'Betäubt 2 s.' }, { id: 'execute', name: 'Hinrichten', desc: 'Doppelter Schaden unter 30 % Leben.' }] });
Object.assign(SPELLS.wClap, { runes: [{ id: 'shock', name: 'Schockwelle', desc: '+50 % Radius.' }, { id: 'frost', name: 'Erschütterung', desc: 'Zusätzlich 30 % Slow für 5 s.' }, { id: 'storm', name: 'Gewitterzorn', desc: '+5 Wut pro Mob, bis 30.' }] });
Object.assign(SPELLS.wCry, { runes: [{ id: 'long', name: 'Langer Atem', desc: 'Hält 30 s.' }, { id: 'fear', name: 'Schreckensschrei', desc: 'Betäubt Mobs in 8 yd für 2 s.' }, { id: 'angry', name: 'Zorniger Schrei', desc: 'Gibt 20 Wut, statt 10 zu kosten.' }] });
Object.assign(SPELLS.wCharge, { runes: [{ id: 'raging', name: 'Wütender Ansturm', desc: 'Gibt 20 statt 9 Wut.' }, { id: 'haste', name: 'Hast', desc: 'Halbe Abklingzeit.', cdMul: 0.5 }, { id: 'break', name: 'Durchbruch', desc: 'Stoppt nicht am ersten Mob, trifft alle auf dem Weg.' }] });

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
  wSmash: { def: R.smash, ability: 'smash', ms: WAR_TIMING.sword.smash },
  wClap: { def: R.thunderclap, ability: 'thunderclap', ms: WAR_TIMING.sword.thunderclap },
  wCry: { def: R.warcry, ability: 'warcry', ms: R.warcry.ms },
};
const roll = (r: number[]) => rand(r[0], r[1]);

let once = null;                                   // laufender Smash oder Donnerknall: { id, ability, until, ctx }
let attackUntil = 0, attackCtx = null;             // Grundangriff: läuft den Zyklus immer zu Ende, ein Tippen gibt einen ganzen
let cryUntil = 0;
let charge = null;                                 // { left, ctx, seen, paid }
let whirlOn = false, whirlUntil = 0, whirlCtx = null, nextWhirlTick = 0;

function clearAttacks() {
  once = null; cryUntil = 0; charge = null;
  attackUntil = 0; attackCtx = null;
  whirlOn = false; whirlUntil = 0; whirlCtx = null;
}

function pressAttack() {
  if (once || charge) return;
  startAttackCycle();
}
function startAttackCycle() {
  if (state.now >= attackUntil) { attackUntil = state.now + WAR_TIMING.sword.attack; attackCtx = makeCtx('wAttack'); }
}
function pressWhirl() {
  if (player.mana <= 0) return showError('Nicht genug Wut');
  whirlUntil = state.now + R.whirlwind.tapMs;
}
function pressOnce(id) {
  const o = ONCE[id];
  if (once || charge) return;
  if (!player.grounded) return showError('Du kannst das nicht im Sprung tun');
  if ((player.cds[id] || 0) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  if (player.mana < o.def.rage && !(id === 'wCry' && hasRune('wCry', 'angry'))) return showError('Nicht genug Wut');
  if (!(id === 'wCry' && hasRune('wCry', 'angry'))) player.mana -= o.def.rage;
  player.cds[id] = state.now + spellCd(id);
  player.lastCombat = state.now;
  attackUntil = 0; whirlOn = false; whirlUntil = 0;
  once = { id, ability: o.ability, until: state.now + o.ms, ctx: makeCtx(id) };
  if (id === 'wCry') shout();
}

function pressCharge() {
  if (once || charge) return;
  if (!player.grounded) return showError('Du kannst das nicht im Sprung tun');
  if ((player.cds.wCharge || 0) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  player.cds.wCharge = state.now + spellCd('wCharge');
  attackUntil = 0; whirlOn = false; whirlUntil = 0;
  charge = { left: R.charge.range, ctx: makeCtx('wCharge'), seen: new Set(), paid: false };
}

// Läuft nach updatePlayer: Eingaben sind gesperrt, Wände und Stufen stoppen wie beim Laufen
function updateCharge(s) {
  const step = Math.min(charge.left, R.charge.speed * s), pos = player.pos, x = pos.x + Math.sin(player.facing) * step, z = pos.z + Math.cos(player.facing) * step;
  const y0 = pos.y;
  pos.x = x; pos.z = z;
  resolve(pos, 0.45);
  const moved = Math.hypot(pos.x - x, pos.z - z) < step * 0.5;
  const g = groundAt(pos.x, pos.z, y0);
  if (Math.abs(g - y0) <= STEP) pos.y = g;
  else { pos.x -= Math.sin(player.facing) * step; pos.z -= Math.cos(player.facing) * step; charge.left = 0; }
  charge.left = moved ? charge.left - step : 0;
  const hit = mobsInRadius(pos, R.charge.hitRadius).length > 0;
  const through = hasRune('wCharge', 'break');
  if (hit) {
    for (const m of mobsInRadius(pos, R.charge.stunRadius)) {
      if (charge.seen.has(m)) continue;
      charge.seen.add(m);
      if (strike(charge.ctx, m, R.charge.dmg)) applyRoot(m, R.charge.stunMs);
    }
    if (!charge.paid) { charge.paid = true; gainRage(hasRune('wCharge', 'raging') ? RUNES.ragingRage : R.charge.rage); shakeCamera(0.2); }
  }
  if ((hit && !through) || charge.left <= 0) charge = null;
}

function shout() {
  cryUntil = state.now + (hasRune('wCry', 'long') ? RUNES.longMs : R.warcry.buffMs);
  if (hasRune('wCry', 'angry')) gainRage(RUNES.angryRage);
  if (hasRune('wCry', 'fear')) for (const m of mobsInRadius(player.pos, RUNES.fearRadius)) applyRoot(m, RUNES.fearMs);
  combatText(player.pos, 'Kampfschrei!', 'info', 2.6);
  shakeCamera(0.2);
}
const strike = (c, m, dmg, mul = 1) => c.hit(m, roll(dmg) * mul * (state.now < cryUntil ? R.warcry.dmgMul : 1));

// Treffer-Moment aus der Animation; die Position ist Schwertspitze oder Spieler
onWarriorHit((kind, x, z) => {
  if (!isWarrior() || player.dead) return;
  const at = { x, y: player.pos.y, z };
  if (kind === 'cast' && attackCtx) {
    let landed = 0;
    const wide = hasRune('wAttack', 'wide') ? RUNES.wide : 1, wrath = hasRune('wAttack', 'wrath');
    for (const m of mobsInRadius(at, attackCtx.radius(R.attack.radius) * wide)) if (strike(attackCtx, m, R.attack.dmg)) landed++;
    gainRage(Math.min(wrath ? RUNES.wrathMax : R.rage.perSwingMax, landed * R.rage.perMobHit * (wrath ? RUNES.wrathMul : 1)));
    if (hasRune('wAttack', 'leech')) player.hp = Math.min(maxHp(), player.hp + maxHp() * RUNES.leechPct * landed);
  } else if (kind === 'smash' && once?.id === 'wSmash') {
    for (const m of mobsInRadius(at, once.ctx.radius(R.smash.radius) * (hasRune('wSmash', 'quake') ? RUNES.quakeRadius : 1))) {
      const low = hasRune('wSmash', 'execute') && m.hp < m.maxHp * RUNES.executeBelow;
      if (strike(once.ctx, m, R.smash.dmg, low ? RUNES.executeMul : 1) && hasRune('wSmash', 'stun')) applyRoot(m, RUNES.stunMs);
    }
  } else if (kind === 'thunderclap' && once?.id === 'wClap') {
    let landed = 0;
    for (const m of mobsInRadius(player.pos, once.ctx.radius(R.thunderclap.radius) * (hasRune('wClap', 'shock') ? RUNES.shockRadius : 1))) {
      if (!strike(once.ctx, m, R.thunderclap.dmg)) continue;
      landed++;
      m.clapUntil = state.now + R.thunderclap.slowMs;
      if (hasRune('wClap', 'frost')) applySlow(m, RUNES.frostSlow, RUNES.frostMs);
    }
    if (hasRune('wClap', 'storm')) gainRage(Math.min(RUNES.stormMax, landed * RUNES.stormRage));
  }
});

export function updateRealMen(dt) {
  if (!isWarrior() || player.dead) return;
  const now = state.now, s = dt / 1000;
  for (const m of state.mobs) if (m.clapUntil > now) slowSwing(m, R.thunderclap.attackSlow, dt);
  if (now - player.lastCombat > R.rage.outOfCombatMs) player.mana = Math.max(0, player.mana - R.rage.decayPerS * s);
  if (once && now >= once.until) once = null;
  if (charge) updateCharge(s);

  const stunned = player.stunUntil > now;
  const wantWhirl = !once && !charge && !stunned && player.mana > 0 && (held('wWhirl') || now < whirlUntil);
  if (wantWhirl) {
    if (!whirlOn) { whirlOn = true; whirlCtx = makeCtx('wWhirl'); attackUntil = 0; }
    if (now >= nextWhirlTick) {
      nextWhirlTick = now + R.whirlwind.tickMs;
      player.lastCombat = now;
      for (const m of mobsInRadius(player.pos, whirlCtx.radius(R.whirlwind.radius))) strike(whirlCtx, m, R.whirlwind.dmg, hasRune('wWhirl', 'frenzy') ? RUNES.frenzyDmg : 1);
    }
    if (hasRune('wWhirl', 'maelstrom')) for (const m of mobsInRadius(player.pos, whirlCtx.radius(R.whirlwind.radius))) pullMob(m, player.pos, RUNES.maelstromPull * s);
    player.mana = Math.max(0, player.mana - R.whirlwind.ragePerS * (hasRune('wWhirl', 'frenzy') ? RUNES.frenzyCost : 1) * s);
  } else whirlOn = false;

  if (!once && !charge && !whirlOn && !stunned && held('wAttack')) startAttackCycle();
}

export const moveMul = () => whirlOn && !hasRune('wWhirl', 'stride') ? R.whirlwind.speedMul : 1;
export const rooted = () => !!once || !!charge;    // eigene Bewegung oder keine

// Pause mitten in einer Attacke: Pose anhalten, sonst geht der Treffer der laufenden Animation verloren
export function realMenAnim() {
  if (!isWarrior() || player.dead) return {};
  const attack = state.now < attackUntil;
  const busy = once || charge || whirlOn || attack;
  if (charge && !state.paused) return { state: 'run', speed: R.charge.stride };
  return { ability: once?.ability ?? (whirlOn ? 'whirlwind' : null), attack, frozen: !!(state.paused && busy) };
}
