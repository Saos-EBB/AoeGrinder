// Real Men: Strichkrieger mit Riesenschwert und Wut statt Mana. Die Moves liegen als Spells in den Slots, damit Leiste, Tasten, Pad und Karten mitlaufen.
// Wut steht in player.mana, player.rageMax meldet den Modus an maxMana und die Regeneration. Modell und Treffer-Momente: models/strichKrieger.ts.

import { chargeLook, chargeHit, clapLook, shoutLook, berserkLook, berserkOn } from './vfx/warLook';
import { state, player } from './state';
import { SPELLS, SPELL_ACTIONS } from './config';
import { mage, onWarriorHit } from './models/mage';
import { hitstopActive, hitstop } from './fx/impact';
import { W, addTrauma, decal } from './wucht';
import { DG, consumeCombo } from './dodge';
import { STRICH_TIMING as TIMING } from './models/strichKrieger';
import { act } from './input';
import { pad, padBinds } from './gamepad';
import { showError } from './ui/hud';
import { applyRoot, pullMob, knockbackMob } from './mobs';
import { makeCtx, mobsInRadius, hasRune, stat, cdEnd, startCd, stopDrink, supported, applySlow } from './spells/core';
import { UNIT, mods } from './config';
import { pdRateMul } from './dodge';
import { maxHp } from './formulas';
import { shakeCamera } from './camera';
import { $, rand, clamp } from './util';

import { after, updateMelee, clearMelee, moveInWindow, inWindow, mobsOnLine, forward } from './melee';

// Alle Zahlen hier, auch die der Runen. Wirbelwind [Classic]-Radius: docs/handoff.md; alles andere ist // PH
const REALMEN = {
  armor: 0.25,                                     // weniger Schaden: steht mitten im Pack, ohne Blink und Nova
  rage: { max: 100, perMobHit: 6, perSwingMax: 15, decayPerS: 4, idleMs: 3000, perHitTaken: 2 },
  mult: { rage: 0.6, hp: 1 },                      // Schaden ×(1 + 0,6 · Wut/100) · (1 + fehlendes Leben): volle Wut bei 10 % Leben ≈ ×3
  // Schlagfolge (v31): startet mit 4 Schlägen, alle 25 Kills mit der Folge einer mehr, höchstens 8. Der letzte ist ein Spin in Laufrichtung, 4 yd, rundum
  q: { dmg: [28, 24, 30], radius: [2.9, 3.2, 2.9], halfAngle: [0.9, 1.4, 0.9], comboMs: 1300, start: 4, max: 8, killsPerHit: 25, spin: { dmg: 45, radius: 3.4, yd: 4, knock: 4 }, masterRate: 0.1 },
  e: { dmg: 26, cd: 8000, rage: 15, waves: 5, stepYd: 1.6, stepMs: 70, width: 2.6, knock: 3.5 },
  whirl: { dmg: [18, 22], radius: 8 /* Classic */, tickMs: 500, ragePerS: 20, speedMul: 0.7, tapMs: 300, minStart: 10,
    suck: { start: 4, perS: 1, max: 12, close: 1.5, speed: 10 } },   // v31: Sog wächst mit der Wirbel-Dauer, zieht bis 1,5 yd heran
  leap: { dmg: 60, yd: 10, radius: 4, knock: 7, cd: 10000, rage: 15 },
  exec: { dmg: 90, radius: 4.2, halfAngle: 0.55, knock: 8, cd: 12000, rage: 35, stunnedMul: 0.3 },   // Viewer: 30 × 3; stunnedMul: Vernichter pro Rang
  last: { ms: 5000, cd: 60000 },
  cry: { rage: 40, cd: 20000, radius: 8, knock: 3 },
  // Neu v31, Schaden in Einheiten (UNIT)
  charge: { yd: 15, halfAngle: 0.8, dmg: 1.5, stunMs: 1000, rage: 15, cd: 10000, ms: 250 },
  clap: { radius: 6, dmg: 1.5, slow: 0.4, slowMs: 3000, rage: 10, cd: 6000 },
  shout: { radius: 8, fleeMs: 4000, cd: 30000 },
  berserk: { ms: 25000, dmg: 0.35, cd: 90000 },
  // Waffe vor dem Run (models/mage.ts, Hauptmenü). Axt und Kolben sind raus (v31), es bleibt das Riesenschwert
  weapons: {
    sword: { name: 'Riesenschwert', dmgMul: 1, rate: 1, ragePerHit: 6 },
    // Legenden (legends.ts): gleiches Kit wie das Riesenschwert, dazu die Combo Q → E → 1
    leeroy: { name: 'Leeroy Jenkins', dmgMul: 1, rate: 1, ragePerHit: 6 },
    freshmeat: { name: 'Fresh Meat', dmgMul: 1, rate: 1, ragePerHit: 6 },
  },
  eat: { ms: 18000 },
  echo: { ms: 500, mul: 0.7, bigMs: [500, 1000], bigMul: [1.2, 1.4] },
  runes: {
    wide: 1.5, leech: 0.01, wrath: 1.5,                     // Schlagfolge
    longWaves: 3, stunMs: 1000,                             // Bodenbrecher
    frenzyCost: 0.5, frenzyDmg: 0.8, pullPerS: 4,           // Wirbelwind
    leapRadius: 1.5, leapStunMs: 2000,                      // Sturzsprung
    lowBelow: 0.3, lowMul: 2, wideAngle: 1.5, killRage: 30, // Hinrichtung
    cryRage: 70, fearMs: 2000, shockDmg: 40,                // Kampfschrei
  },
};
const R = REALMEN, RU = R.runes;

const spell = (name, desc, tags, ranks, cd, mana, press, showDmg?, runes?) => ({ name, desc, showDmg, ranks, tags: ['Krieger', ...tags], cls: 'fire', school: 'warrior', fixed: true, cd, mana, press, runes });
// Slots in Tastenreihenfolge: Q, E, R, Maus 4, Maus 5, 1, 2, 3. fixed: nie als Karte in anderen Modi
Object.assign(SPELLS, {
  wQ: spell('Schlagfolge', 'Vier Schläge, alle 25 Kills mit der Folge einer mehr (höchstens 8). Der letzte ist ein schneller Spin in Laufrichtung. Bringt Wut.', ['Nahkampf', 'Fläche'], ['dmg', 'radius', 'tempo'], 0, 0, () => pressQ(), R.q.dmg[0], [
    { id: 'wide', name: 'Weiter Schwung', desc: '+50 % Radius.' }, { id: 'leech', name: 'Blutdurst', desc: 'Heilt 1 % Leben pro getroffenem Mob.' }, { id: 'wrath', name: 'Wutschlag', desc: '+50 % Wut pro Schlag.' }]),
  wE: spell('Bodenbrecher', 'Klinge in den Boden, Risse laufen 8 yd nach vorn und schleudern weg.', ['Nahkampf', 'Linie', 'Fläche'], ['dmg', 'tempo'], R.e.cd, R.e.rage, () => pressMove('wE', 'e', WT().e, SPELLS.wE.mana), R.e.dmg, [
    { id: 'long', name: 'Tiefe Risse', desc: 'Risse laufen 5 yd weiter.' }, { id: 'stun', name: 'Erdstoß', desc: 'Betäubt 1 s.' }, { id: 'charges', name: 'Zweiter Stoß', desc: '2 Ladungen.', charges: 2 }]),
  wR: spell('Wirbelwind', 'Halten: trifft alles um dich, kostet Wut pro Sekunde.', ['Nahkampf', 'Fläche'], ['dmg', 'radius'], 0, 0, () => pressWhirl(), (R.whirl.dmg[0] + R.whirl.dmg[1]) / 2, [
    { id: 'stride', name: 'Sturmschritt', desc: 'Volles Lauftempo im Wirbel.' }, { id: 'frenzy', name: 'Rasender Tanz', desc: 'Halbe Wutkosten, −20 % Schaden.' }, { id: 'maelstrom', name: 'Mahlstrom', desc: 'Zieht Mobs zu dir.' }]),
  wExec: spell('Hinrichtung', 'Langes Ausholen, ein gewaltiger Schlag im Kegel vor dir.', ['Nahkampf', 'Fläche'], ['dmg', 'tempo'], R.exec.cd, R.exec.rage, () => pressMove('wExec', 'exec', WT().exec, SPELLS.wExec.mana), R.exec.dmg, [
    { id: 'low', name: 'Gnadenstoß', desc: 'Doppelter Schaden unter 30 % Leben des Ziels.' }, { id: 'wide', name: 'Breite Klinge', desc: '+50 % Kegel.' }, { id: 'refund', name: 'Blutgier', desc: 'Ein Kill gibt 30 Wut.' }]),
  wLast: spell('Letzter Atem', 'Schwert in den Boden, Brüllen: 5 s nicht unter 1 Leben, Wut voll.', [], [], R.last.cd, 0, () => pressMove('wLast', 'last', TIMING.last, 0)),
  wCry: spell('Kampfschrei', '+40 Wut und eine Druckwelle, die Mobs wegstößt.', [], [], R.cry.cd, 0, () => pressMove('wCry', 'cry', TIMING.cry, 0), undefined, [
    { id: 'rage', name: 'Zorniger Schrei', desc: '+70 statt +40 Wut.' }, { id: 'fear', name: 'Schreckensschrei', desc: 'Betäubt Mobs in 8 yd für 2 s.' }, { id: 'shock', name: 'Schockwelle', desc: 'Die Druckwelle macht Schaden.' }]),
  wLeap: spell('Sturzsprung', '10 yd Sprung, in der Luft nicht angreifbar. Die Landung schleudert weg.', ['Nahkampf', 'Bewegung', 'Fläche'], ['dmg', 'radius', 'tempo'], R.leap.cd, R.leap.rage, () => pressMove('wLeap', 'leap', TIMING.leap.ms, R.leap.rage), R.leap.dmg, [
    { id: 'quake', name: 'Beben', desc: '+50 % Radius.' }, { id: 'stun', name: 'Einschlag', desc: 'Betäubt 2 s.' }, { id: 'haste', name: 'Hast', desc: 'Halbe Abklingzeit.', cdMul: 0.5 }]),
  wEat: spell('Essen', 'Sitzen und in 18 s alles Leben auffüllen. Bewegung oder Angriff bricht ab, Schaden nicht.', [], [], 0, 0, () => pressEat()),
  // v31
  wCharge: spell('Ansturm', 'Ansturm bis 15 yd aufs nächste Ziel in Blickrichtung, 1,5 Einheiten, betäubt 1 s, +15 Wut.', ['Nahkampf', 'Bewegung'], ['dmg', 'cd'], R.charge.cd, 0, () => pressCharge(), R.charge.dmg * UNIT),
  wClap: spell('Donnerknall', 'Ring 6 yd, 1,5 Einheiten, 40 % langsamer für 3 s.', ['Nahkampf', 'Fläche'], ['dmg', 'radius'], R.clap.cd, R.clap.rage, () => pressClap(), R.clap.dmg * UNIT),
  wShout: spell('Einschüchterungsruf', 'Mobs in 8 yd fliehen 4 s.', ['Kontrolle'], ['cd', 'radius'], R.shout.cd, 0, () => pressShout()),
  wBerserk: { ...spell('Berserker', '25 s +35 % Schaden, kann nicht verlangsamt werden.', [], [], R.berserk.cd, 0, () => pressBerserk()), figRelic: true },
});

export const WAR_WEAPON_NAMES = Object.fromEntries(Object.entries(R.weapons).map(([id, w]) => [id, w.name]));
const weaponId = () => R.weapons[mage.warWeapon] ? mage.warWeapon : 'sword';
const WP = (): any => R.weapons[weaponId()];
const WT = () => TIMING.weapons[weaponId()] ?? TIMING.weapons.sword;
const runeStage = (id, r) => hasRune(id, r) ? state.cardPicks[`rune-${id}-${r}`] || 1 : 0;

const isWarrior = () => mage.skin === 'krieger';

// Taste oder Pad-Knopf des Slots, in dem die Attacke liegt
export function held(id) {
  const action = SPELL_ACTIONS[state.slots.indexOf(id)];
  return !!action && (act(action) || !!pad.down[padBinds[action]]);
}

let cur = null;                 // laufender Move: { id, ability, start, ms, rate, ctx, from }
let seq = 0, combo = 0, comboUntil = 0, lastRageAt = 0, undyingUntil = 0;
let whirlOn = false, whirlUntil = 0, whirlCtx = null, nextWhirlTick = 0, whirlStart = 0;
let charge = null;   // Ansturm: { from, target, start, ctx }

const gainRage = n => { player.mana = Math.min(R.rage.max, player.mana + n); };
export function rageOnHit() { if (isWarrior()) gainRage(R.rage.perHitTaken); }
// Mehr Wut und weniger Leben: mehr Schaden
const rageMul = () => (1 + R.mult.rage * player.mana / R.rage.max) * (1 + R.mult.hp * clamp(1 - player.hp / maxHp(), 0, 1));

// Nach dem Zurücksetzen von Leben und Mana im Run-Start
export function resetRealMen() {
  const on = isWarrior();
  player.rageMax = on ? R.rage.max : undefined;
  $('manaFill').style.background = on ? 'linear-gradient(#e0503c, #8a1a10)' : '';
  player.resNote = '';
  cur = null; seq = 0; combo = 0; comboUntil = 0; lastRageAt = 0; undyingUntil = 0; charge = null;
  state.qKills = 0; player.berserkUntil = 0;
  whirlOn = false; whirlUntil = 0; whirlCtx = null; nextWhirlTick = 0;   // state.now startet pro Run bei 0
  state.heroWeapon = on ? WP().name : '';
  if (on) {
    player.mana = 0; clearMelee();
  }
}

const rateOf = id => stat(id).tempo ?? 1;
function startMove(id, ability, ms) {
  whirlOn = false; whirlUntil = 0;
  const rate = rateOf(id) * WP().rate * pdRateMul() * (id === 'wQ' ? 1 + R.q.masterRate * mods.bladeMaster : 1);   // Perfekter Dodge, Klingenmeister
  cur = { id, ability, start: state.now, ms: ms / rate, rate, ctx: makeCtx(id), from: { x: player.pos.x, y: player.pos.y, z: player.pos.z } };
  seq++;
}
function pressQ() {
  if (cur) return;
  stopDrink();
  if (state.now > comboUntil) combo = 0;
  const step = combo, n = qLength(), last = step === n - 1, k = step % 3, Q = WT().q;
  combo = (combo + 1) % n;
  player.lastCombat = state.now;
  if (last && Math.hypot(player.vel.x, player.vel.z) > 0.1) player.facing = Math.atan2(player.vel.x, player.vel.z);   // Spin in Laufrichtung
  startMove('wQ', last ? 'qs' : `q${k}`, last ? WT().spin : Q[k]);
  cur.qStep = step; cur.spin = last;
  if (last) cur.combo = consumeCombo('smash');   // Dodge-Kombo: auf den Spin
  cur.walk = true;
}
// Länge der Schlagfolge: 4, alle 25 Kills mit der Folge einer mehr, höchstens 8
const qLength = () => Math.min(R.q.max, R.q.start + Math.floor((state.qKills ?? 0) / R.q.killsPerHit));
function pressMove(id, ability, ms, cost) {
  if (cur) return;
  if (!player.grounded) return showError('Du kannst das nicht im Sprung tun');
  if (cdEnd(id) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  if (player.mana < cost) return showError('Nicht genug Wut');
  stopDrink();
  player.mana -= cost;
  startCd(id);
  player.lastCombat = state.now;
  startMove(id, ability, ms);
  if (id === 'wLeap' || id === 'wExec') cur.combo = consumeCombo('smash');
}
function pressWhirl() {
  if (!whirlOn && player.mana < R.whirl.minStart) return showError('Nicht genug Wut');
  stopDrink();
  whirlUntil = state.now + R.whirl.tapMs;
}
function pressEat() {
  if (cur || whirlOn) return;
  if (!player.grounded) return showError('Du kannst das nicht im Sprung tun');
  player.drink = { start: state.now, end: state.now + R.eat.ms, dur: R.eat.ms, hp: 1, label: 'Essen', keepOnHit: true };
}

// Ein Treffer-Ereignis: Wut kommt nur, wenn etwas getroffen wurde, und ist pro Schlag gedeckelt
function strike(ctx, amount, targets, onMob?, rageK = 1) {
  let landed = 0;
  const W = WP(), mul = rageMul() * W.dmgMul * (cur?.combo ? DG.combo.smashMul : 1);   // Dodge-Kombo: +50 % auf den Smash
  for (const m of targets()) {
    const dmg = amount(m) * mul;
    if (!ctx.hit(m, dmg)) continue;
    landed++;
    onMob?.(m);
    mage.hero.fx.blood(m.pos.x, m.pos.y + 1.1, m.pos.z);
  }
  if (landed) {
    gainRage(Math.min(R.rage.perSwingMax * rageK, landed * (W.ragePerHit ?? R.rage.perMobHit) * rageK));
    lastRageAt = state.now;
    shakeCamera(Math.min(0.35, 0.08 + 0.02 * landed));
  }
  return landed;
}
// Mit den Supports Echo und Großes Echo: dieselbe Wirkung später noch einmal
function event(id, ctx, amount, targets, onMob?, rageK = 1) {
  const n = strike(ctx, amount, targets, onMob, rageK), E = R.echo;
  if (supported('bigEcho', id)) E.bigMs.forEach((ms, i) => after(ms, () => strike(ctx, m => amount(m) * E.bigMul[i], targets, onMob, rageK)));
  else if (supported('echo', id)) after(E.ms, () => strike(ctx, m => amount(m) * E.mul, targets, onMob, rageK));
  return n;
}
const inCone = (o, r, half) => mobsInRadius(o, r).filter(m => {
  const a = Math.atan2(m.pos.x - o.x, m.pos.z - o.z) - player.facing;
  return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= half;
});

// Wucht: Smash-Treffer mit mindestens einem Mob stoppen kurz die Zeit
const smash = landed => {
  if (landed) hitstop(W.hitstop.smashMs);
  if (cur?.combo) { addTrauma(DG.combo.smashTrauma); decal(player.pos, 3, DG.combo.smashDecal); hitstop(W.hitstop.championMs); }   // großer Wucht-Treffer
  return landed;
};
function hitQ() {
  const c = cur.ctx, wide = hasRune('wQ', 'wide') ? RU.wide : 1, rageK = hasRune('wQ', 'wrath') ? RU.wrath : 1;
  const leech = m => { if (hasRune('wQ', 'leech')) player.hp = Math.min(maxHp(), player.hp + maxHp() * RU.leech); if (m.dead) state.qKills = (state.qKills ?? 0) + 1; return m; };
  if (cur.spin) {
    const S = R.q.spin, r = c.radius(S.radius) * wide;
    smash(event('wQ', c, () => S.dmg, () => mobsInRadius(player.pos, r), m => { leech(m); if (!m.dead) knockbackMob(m, player.pos, S.knock); }, rageK));
    mage.hero.fx.ring(player.pos, 0xd8121c, r, 0.35, 0.1);
  } else {
    const k = cur.qStep % 3, r = c.radius(R.q.radius[k]) * wide;
    event('wQ', c, () => R.q.dmg[k], () => inCone(player.pos, r, R.q.halfAngle[k]), leech, rageK);
  }
}
// Bodenbrecher: eine Welle pro Stück Strecke, jeder Mob nur einmal
function hitE(at) {
  const c = cur.ctx, f = forward(), E = R.e, seen = new Set(), waves = E.waves + (hasRune('wE', 'long') ? RU.longWaves : 0);
  let rage = 0;
  for (let i = 0; i < waves; i++) after(i * E.stepMs, () => {
    if (!isWarrior()) return;
    const a = { x: at.x + f.x * E.stepYd * i, z: at.z + f.z * E.stepYd * i }, b = { x: a.x + f.x * E.stepYd, z: a.z + f.z * E.stepYd };
    mage.hero.fx.crackAt(a.x, a.z, f.x, f.z);
    const list = mobsOnLine(a, b, E.width).filter(m => !seen.has(m));
    for (const m of list) seen.add(m);
    const landed = event('wE', c, () => E.dmg, () => list, eHit, 0);   // Wut gedeckelt pro Bodenbrecher, nicht pro Welle
    const gain = Math.min(R.rage.perSwingMax - rage, landed * R.rage.perMobHit);
    if (gain > 0) { rage += gain; gainRage(gain); }
  });
}
const eHit = m => { if (m.dead) return; knockbackMob(m, player.pos, R.e.knock); if (hasRune('wE', 'stun')) applyRoot(m, RU.stunMs); };
function hitLeap() {
  const c = cur.ctx, r = c.radius(R.leap.radius) * (hasRune('wLeap', 'quake') ? RU.leapRadius : 1);
  smash(event('wLeap', c, () => R.leap.dmg, () => mobsInRadius(player.pos, r), m => {
    if (m.dead) return;
    knockbackMob(m, player.pos, R.leap.knock);
    if (hasRune('wLeap', 'stun')) applyRoot(m, RU.leapStunMs);
  }));
}
function hitExec() {
  const c = cur.ctx, X = R.exec, half = X.halfAngle * (hasRune('wExec', 'wide') ? RU.wideAngle : 1);
  smash(event('wExec', c, m => X.dmg * (hasRune('wExec', 'low') && m.hp < m.maxHp * RU.lowBelow ? RU.lowMul : 1) * (m.rootUntil > state.now ? 1 + X.stunnedMul * mods.annihilator : 1), () => inCone(player.pos, c.radius(X.radius), half), m => {
    if (m.dead) { if (hasRune('wExec', 'refund')) gainRage(RU.killRage); return; }
    knockbackMob(m, player.pos, X.knock);
  }));
  shakeCamera(0.5);
}
function hitCry() {
  const C = R.cry, c = cur.ctx;
  gainRage(hasRune('wCry', 'rage') ? RU.cryRage : C.rage);
  lastRageAt = state.now;
  shakeCamera(0.3);
  const list = mobsInRadius(player.pos, C.radius);
  if (hasRune('wCry', 'shock')) strike(c, () => RU.shockDmg, () => list);
  for (const m of list) {
    if (m.dead) continue;
    knockbackMob(m, player.pos, C.knock);
    if (hasRune('wCry', 'fear')) applyRoot(m, RU.fearMs);
  }
}
function hitLast() {
  undyingUntil = state.now + R.last.ms;
  player.mana = R.rage.max;
  shakeCamera(0.5);
}

// Treffer-Moment aus der Animation; die Position ist die Schwertspitze oder der Spieler
onWarriorHit((kind, x, z, i) => {
  if (!isWarrior() || player.dead || !cur) return;
  const at = { x, y: player.pos.y, z };
  if (kind === 'q') hitQ();
  else if (kind === 'e') hitE(at);
  else if (kind === 'leap') hitLeap();
  else if (kind === 'exec') hitExec();
  else if (kind === 'cry') hitCry();
  else if (kind === 'last') hitLast();
});

// ---------- Neu v31: Ansturm, Donnerknall, Einschüchterungsruf, Berserker ----------
function pressCharge() {
  if (cur || charge) return;
  if (cdEnd('wCharge') > state.now) return showError('Fähigkeit ist noch nicht bereit');
  const C = R.charge, target = mobsInRadius(player.pos, C.yd, Infinity).filter(m => {
    const a = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z) - player.facing;
    return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= C.halfAngle;
  }).sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos))[0];
  if (!target) return showError('Kein Ziel in Blickrichtung');
  stopDrink();
  startCd('wCharge');
  player.lastCombat = state.now;
  charge = { from: player.pos.clone(), target, start: state.now, ctx: makeCtx('wCharge') };
  chargeLook(R.charge.ms);
}
function updateCharge() {
  const C = R.charge, t = Math.min(1, (state.now - charge.start) / C.ms), to = charge.target.pos;
  const d = Math.hypot(to.x - charge.from.x, to.z - charge.from.z) || 1, stop = Math.max(0, 1 - 1.2 / d);   // vor dem Ziel stehen bleiben
  player.pos.x = charge.from.x + (to.x - charge.from.x) * stop * t;
  player.pos.z = charge.from.z + (to.z - charge.from.z) * stop * t;
  player.facing = Math.atan2(to.x - charge.from.x, to.z - charge.from.z);
  if (t < 1) return;
  const m = charge.target, c = charge.ctx;
  charge = null;
  strike(c, () => C.dmg * UNIT, () => (m.dead ? [] : [m]), o => { if (!o.dead) applyRoot(o, C.stunMs); });
  chargeHit(m.pos);
  gainRage(C.rage);
  shakeCamera(0.3);
}
function pressClap() {
  if (cur) return;
  if (cdEnd('wClap') > state.now) return showError('Fähigkeit ist noch nicht bereit');
  if (player.mana < R.clap.rage) return showError('Nicht genug Wut');
  player.mana -= R.clap.rage;
  startCd('wClap');
  player.lastCombat = state.now;
  const C = R.clap, c = makeCtx('wClap'), r = c.radius(C.radius);
  strike(c, () => C.dmg * UNIT, () => mobsInRadius(player.pos, r), m => { if (!m.dead) applySlow(m, C.slow, C.slowMs); }, 0);
  clapLook(r);
  shakeCamera(0.35);
}
function pressShout() {
  if (cdEnd('wShout') > state.now) return showError('Fähigkeit ist noch nicht bereit');
  startCd('wShout');
  const r = makeCtx('wShout').radius(R.shout.radius);
  for (const m of mobsInRadius(player.pos, r)) {
    if (m.dead || m.boss) continue;
    m.state = 'flee'; m.fleeTarget = null; m.fleeUntil = state.now + R.shout.fleeMs;
  }
  shoutLook(r);
  shakeCamera(0.25);
}
function pressBerserk() {
  if (cdEnd('wBerserk') > state.now) return showError('Fähigkeit ist noch nicht bereit');
  startCd('wBerserk');
  player.berserkUntil = state.now + R.berserk.ms;
  berserkLook(berserkOn);
  player.slowUntil = 0;
  mage.hero.fx.ring(player.pos, 0xd8121c, 4, 0.6, 0.15);
}
// Berserker: Schaden obendrauf (core.ts), kein Slow (player.ts)
export const berserkMul = () => isWarrior() && player.berserkUntil > state.now ? 1 + R.berserk.dmg : 1;

function updateWhirl(s) {
  const W = R.whirl, frenzy = hasRune('wR', 'frenzy');
  // Einmal an, läuft er bis 0 Wut; neu starten braucht minStart, sonst stottert er bei jedem kassierten Treffer an
  const want = !cur && player.stunUntil <= state.now && player.mana >= (whirlOn ? 0.01 : W.minStart) && (held('wR') || state.now < whirlUntil);
  if (!want) { whirlOn = false; return; }
  if (!whirlOn) { whirlOn = true; whirlCtx = makeCtx('wR'); whirlStart = state.now; seq++; }
  const r = whirlCtx.radius(W.radius);
  if (state.now >= nextWhirlTick) {
    nextWhirlTick = state.now + W.tickMs;
    player.lastCombat = state.now;
    event('wR', whirlCtx, () => rand(W.dmg[0], W.dmg[1]) * (frenzy ? RU.frenzyDmg : 1), () => mobsInRadius(player.pos, r), undefined, 0);   // Wirbelwind kostet Wut, er bringt keine
  }
  if (hasRune('wR', 'maelstrom')) for (const m of mobsInRadius(player.pos, r)) pullMob(m, player.pos, RU.pullPerS * s);
  // Sog (v31): wächst mit der Wirbel-Dauer, zieht bis auf 1,5 yd heran, dort schlagen die Mobs normal
  const S = W.suck, suck = Math.min(S.max, S.start + S.perS * (state.now - whirlStart) / 1000);
  for (const m of mobsInRadius(player.pos, suck)) {
    const d = Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
    if (d > S.close) pullMob(m, player.pos, Math.min(d - S.close, S.speed * s));
  }
  player.mana = Math.max(0, player.mana - W.ragePerS * (frenzy ? RU.frenzyCost : 1) * s);
}

export function updateRealMen(dt) {
  if (!isWarrior() || player.dead) return;
  const now = state.now, s = dt / 1000;
  updateMelee();
  if (charge) updateCharge();
  if (undyingUntil > now) player.mana = R.rage.max;
  else if (now - lastRageAt > R.rage.idleMs) player.mana = Math.max(0, player.mana - R.rage.decayPerS * s);
  if (cur) {
    if (cur.id === 'wLeap') moveInWindow({ ...TIMING.leap.move, yd: R.leap.yd }, cur.start, cur.ms, dt);
    if (now >= cur.start + cur.ms) {
      if (cur.id === 'wQ') comboUntil = now + R.q.comboMs;
      cur = null;
    }
  }
  updateWhirl(s);
  if (!cur && !whirlOn && player.stunUntil <= now && held('wQ')) pressQ();   // Ein Druck, ein Schlag; Halten schlägt weiter
  player.resNote = `Schaden ×${rageMul().toFixed(2).replace('.', ',')} · Schlagfolge ${qLength()}${undyingUntil > now ? ' · Letzter Atem' : ''}${player.berserkUntil > now ? ' · Berserker' : ''}`;
}

const leapWindow = [TIMING.leap.move.from, TIMING.leap.move.to];
export const warriorUntouchable = () => isWarrior() && cur?.id === 'wLeap' && inWindow(leapWindow, cur.start, cur.ms);
// Dodge bricht den laufenden Move ab (Animation-Cancel), auch mitten im Schlag
export function cancelWarriorMove() { if (!isWarrior() || !cur) return; cur = null; seq++; }
export const warriorUndying = () => isWarrior() && undyingUntil > state.now;
// Schadensfaktor: nur der Krieger hat Rüstung
export const takenMul = () => isWarrior() ? 1 - R.armor : 1;
export const moveMul = () => whirlOn && !hasRune('wR', 'stride') ? R.whirl.speedMul : 1;
export const rooted = () => isWarrior() && !!cur && !cur.walk;   // eigene Bewegung oder keine

// Pause mitten in einer Attacke: Pose anhalten, sonst geht der Treffer der laufenden Animation verloren
export function realMenAnim() {
  if (!isWarrior() || player.dead) return {};
  return { ability: cur?.ability ?? (whirlOn ? 'whirl' : null), seq, rate: cur?.rate ?? 1, rage: player.mana, berserk: berserkOn(), frozen: !!((state.paused || hitstopActive()) && (cur || whirlOn)) };
}

// Für den Handtest
(window as any).__krieger = { get cur() { return cur; }, get combo() { return combo; }, rageMul, get undying() { return undyingUntil; }, REALMEN };
