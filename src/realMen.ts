// Real Men: Strichkrieger mit Riesenschwert und Wut statt Mana. Die Moves liegen als Spells in den Slots, damit Leiste, Tasten, Pad und Karten mitlaufen.
// Wut steht in player.mana, player.rageMax meldet den Modus an maxMana und die Regeneration. Modell und Treffer-Momente: models/strichKrieger.ts.

import { state, player } from './state';
import { SPELLS, SPELL_ACTIONS } from './config';
import { mage, onWarriorHit } from './models/mage';
import { STRICH_TIMING as TIMING } from './models/strichKrieger';
import { act } from './input';
import { pad, padBinds } from './gamepad';
import { showError } from './ui/hud';
import { applyRoot, pullMob, knockbackMob } from './mobs';
import { makeCtx, mobsInRadius, hasRune, stat, cdEnd, startCd, stopDrink, supported } from './spells/core';
import { maxHp } from './formulas';
import { shakeCamera } from './camera';
import { $, rand, clamp } from './util';
import { after, updateMelee, clearMelee, moveInWindow, inWindow, mobsOnLine, forward } from './melee';

// Alle Zahlen hier, auch die der Runen. Wirbelwind [Classic]-Radius: docs/handoff.md; alles andere ist // PH
export const REALMEN = {
  armor: 0.25,                                     // weniger Schaden: steht mitten im Pack, ohne Blink und Nova
  rage: { max: 100, perMobHit: 6, perSwingMax: 15, decayPerS: 4, idleMs: 3000, perHitTaken: 2 },
  mult: { rage: 0.6, hp: 1 },                      // Schaden ×(1 + 0,6 · Wut/100) · (1 + fehlendes Leben): volle Wut bei 10 % Leben ≈ ×3
  q: { dmg: [28, 24, 30, 55], radius: [2.9, 3.2, 2.9], halfAngle: [0.9, 1.4, 0.9], smashRadius: 3, knock: 6, comboMs: 1300 },
  e: { dmg: 26, cd: 8000, rage: 15, waves: 5, stepYd: 1.6, stepMs: 70, width: 2.6, knock: 3.5 },
  whirl: { dmg: [18, 22], radius: 8 /* Classic */, tickMs: 500, ragePerS: 20, speedMul: 0.7, tapMs: 300, minStart: 10 },
  leap: { dmg: 60, yd: 10, radius: 4, knock: 7, cd: 10000, rage: 15 },
  exec: { dmg: 90, radius: 4.2, halfAngle: 0.55, knock: 8, cd: 12000, rage: 35 },   // Viewer: 30 × 3
  last: { ms: 5000, cd: 60000 },
  cry: { rage: 40, cd: 20000, radius: 8, knock: 3 },
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
  wQ: spell('Schlagfolge', 'Vier Schläge, der vierte ein Sprung-Smash. Bringt Wut.', ['Nahkampf', 'Fläche'], ['dmg', 'radius', 'tempo'], 0, 0, () => pressQ(), R.q.dmg[0], [
    { id: 'wide', name: 'Weiter Schwung', desc: '+50 % Radius.' }, { id: 'leech', name: 'Blutdurst', desc: 'Heilt 1 % Leben pro getroffenem Mob.' }, { id: 'wrath', name: 'Wutschlag', desc: '+50 % Wut pro Schlag.' }]),
  wE: spell('Bodenbrecher', 'Klinge in den Boden, Risse laufen 8 yd nach vorn und schleudern weg.', ['Nahkampf', 'Linie', 'Fläche'], ['dmg', 'tempo'], R.e.cd, R.e.rage, () => pressMove('wE', 'e', TIMING.e, R.e.rage), R.e.dmg, [
    { id: 'long', name: 'Tiefe Risse', desc: 'Risse laufen 5 yd weiter.' }, { id: 'stun', name: 'Erdstoß', desc: 'Betäubt 1 s.' }, { id: 'charges', name: 'Zweiter Stoß', desc: '2 Ladungen.', charges: 2 }]),
  wR: spell('Wirbelwind', 'Halten: trifft alles um dich, kostet Wut pro Sekunde.', ['Nahkampf', 'Fläche'], ['dmg', 'radius'], 0, 0, () => pressWhirl(), (R.whirl.dmg[0] + R.whirl.dmg[1]) / 2, [
    { id: 'stride', name: 'Sturmschritt', desc: 'Volles Lauftempo im Wirbel.' }, { id: 'frenzy', name: 'Rasender Tanz', desc: 'Halbe Wutkosten, −20 % Schaden.' }, { id: 'maelstrom', name: 'Mahlstrom', desc: 'Zieht Mobs zu dir.' }]),
  wExec: spell('Hinrichtung', 'Langes Ausholen, ein gewaltiger Schlag im Kegel vor dir.', ['Nahkampf', 'Fläche'], ['dmg', 'tempo'], R.exec.cd, R.exec.rage, () => pressMove('wExec', 'exec', TIMING.exec, R.exec.rage), R.exec.dmg, [
    { id: 'low', name: 'Gnadenstoß', desc: 'Doppelter Schaden unter 30 % Leben des Ziels.' }, { id: 'wide', name: 'Breite Klinge', desc: '+50 % Kegel.' }, { id: 'refund', name: 'Blutgier', desc: 'Ein Kill gibt 30 Wut.' }]),
  wLast: spell('Letzter Atem', 'Schwert in den Boden, Brüllen: 5 s nicht unter 1 Leben, Wut voll.', [], [], R.last.cd, 0, () => pressMove('wLast', 'last', TIMING.last, 0)),
  wCry: spell('Kampfschrei', '+40 Wut und eine Druckwelle, die Mobs wegstößt.', [], [], R.cry.cd, 0, () => pressMove('wCry', 'cry', TIMING.cry, 0), undefined, [
    { id: 'rage', name: 'Zorniger Schrei', desc: '+70 statt +40 Wut.' }, { id: 'fear', name: 'Schreckensschrei', desc: 'Betäubt Mobs in 8 yd für 2 s.' }, { id: 'shock', name: 'Schockwelle', desc: 'Die Druckwelle macht Schaden.' }]),
  wLeap: spell('Sturzsprung', '10 yd Sprung, in der Luft nicht angreifbar. Die Landung schleudert weg.', ['Nahkampf', 'Bewegung', 'Fläche'], ['dmg', 'radius', 'tempo'], R.leap.cd, R.leap.rage, () => pressMove('wLeap', 'leap', TIMING.leap.ms, R.leap.rage), R.leap.dmg, [
    { id: 'quake', name: 'Beben', desc: '+50 % Radius.' }, { id: 'stun', name: 'Einschlag', desc: 'Betäubt 2 s.' }, { id: 'haste', name: 'Hast', desc: 'Halbe Abklingzeit.', cdMul: 0.5 }]),
  wEat: spell('Essen', 'Sitzen und in 18 s alles Leben auffüllen. Bewegung oder Angriff bricht ab, Schaden nicht.', [], [], 0, 0, () => pressEat()),
});

const isWarrior = () => mage.skin === 'krieger';

// Taste oder Pad-Knopf des Slots, in dem die Attacke liegt
export function held(id) {
  const action = SPELL_ACTIONS[state.slots.indexOf(id)];
  return !!action && (act(action) || !!pad.down[padBinds[action]]);
}

let cur = null;                 // laufender Move: { id, ability, start, ms, rate, ctx, from }
let seq = 0, combo = 0, comboUntil = 0, lastRageAt = 0, undyingUntil = 0;
let whirlOn = false, whirlUntil = 0, whirlCtx = null, nextWhirlTick = 0;

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
  cur = null; seq = 0; combo = 0; comboUntil = 0; lastRageAt = 0; undyingUntil = 0;
  whirlOn = false; whirlUntil = 0; whirlCtx = null; nextWhirlTick = 0;   // state.now startet pro Run bei 0
  if (on) { player.mana = 0; clearMelee(); }
}

const rateOf = id => stat(id).tempo ?? 1;
function startMove(id, ability, ms) {
  whirlOn = false; whirlUntil = 0;
  const rate = rateOf(id);
  cur = { id, ability, start: state.now, ms: ms / rate, rate, ctx: makeCtx(id), from: { x: player.pos.x, y: player.pos.y, z: player.pos.z } };
  seq++;
}
function pressQ() {
  if (cur) return;
  stopDrink();
  if (state.now > comboUntil) combo = 0;
  const step = combo;
  combo = (combo + 1) % TIMING.q.length;
  player.lastCombat = state.now;
  startMove('wQ', `q${step}`, TIMING.q[step]);
  cur.walk = step < TIMING.q.length - 1;           // der Sprung-Smash steht, die anderen Schläge gehen im Laufen
}
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
  const mul = rageMul();
  for (const m of targets()) {
    if (!ctx.hit(m, amount(m) * mul)) continue;
    landed++;
    onMob?.(m);
    mage.hero.fx.blood(m.pos.x, m.pos.y + 1.1, m.pos.z);
  }
  if (landed) {
    gainRage(Math.min(R.rage.perSwingMax * rageK, landed * R.rage.perMobHit * rageK));
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

function hitQ(step, at) {
  const c = cur.ctx, wide = hasRune('wQ', 'wide') ? RU.wide : 1, rageK = hasRune('wQ', 'wrath') ? RU.wrath : 1;
  const leech = m => { if (hasRune('wQ', 'leech')) player.hp = Math.min(maxHp(), player.hp + maxHp() * RU.leech); return m; };
  if (step === R.q.dmg.length - 1) {
    const r = c.radius(R.q.smashRadius) * wide;
    event('wQ', c, () => R.q.dmg[step], () => mobsInRadius(at, r), m => { leech(m); if (!m.dead) knockbackMob(m, player.pos, R.q.knock); }, rageK);
  } else {
    const r = c.radius(R.q.radius[step]) * wide;
    event('wQ', c, () => R.q.dmg[step], () => inCone(player.pos, r, R.q.halfAngle[step]), leech, rageK);
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
  event('wLeap', c, () => R.leap.dmg, () => mobsInRadius(player.pos, r), m => {
    if (m.dead) return;
    knockbackMob(m, player.pos, R.leap.knock);
    if (hasRune('wLeap', 'stun')) applyRoot(m, RU.leapStunMs);
  });
}
function hitExec() {
  const c = cur.ctx, X = R.exec, half = X.halfAngle * (hasRune('wExec', 'wide') ? RU.wideAngle : 1);
  event('wExec', c, m => X.dmg * (hasRune('wExec', 'low') && m.hp < m.maxHp * RU.lowBelow ? RU.lowMul : 1), () => inCone(player.pos, c.radius(X.radius), half), m => {
    if (m.dead) { if (hasRune('wExec', 'refund')) gainRage(RU.killRage); return; }
    knockbackMob(m, player.pos, X.knock);
  });
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
  if (kind === 'q') hitQ(i, at);
  else if (kind === 'e') hitE(at);
  else if (kind === 'leap') hitLeap();
  else if (kind === 'exec') hitExec();
  else if (kind === 'cry') hitCry();
  else if (kind === 'last') hitLast();
});

function updateWhirl(s) {
  const W = R.whirl, frenzy = hasRune('wR', 'frenzy');
  // Einmal an, läuft er bis 0 Wut; neu starten braucht minStart, sonst stottert er bei jedem kassierten Treffer an
  const want = !cur && player.stunUntil <= state.now && player.mana >= (whirlOn ? 0.01 : W.minStart) && (held('wR') || state.now < whirlUntil);
  if (!want) { whirlOn = false; return; }
  if (!whirlOn) { whirlOn = true; whirlCtx = makeCtx('wR'); seq++; }
  const r = whirlCtx.radius(W.radius);
  if (state.now >= nextWhirlTick) {
    nextWhirlTick = state.now + W.tickMs;
    player.lastCombat = state.now;
    event('wR', whirlCtx, () => rand(W.dmg[0], W.dmg[1]) * (frenzy ? RU.frenzyDmg : 1), () => mobsInRadius(player.pos, r), undefined, 0);   // Wirbelwind kostet Wut, er bringt keine
  }
  if (hasRune('wR', 'maelstrom')) for (const m of mobsInRadius(player.pos, r)) pullMob(m, player.pos, RU.pullPerS * s);
  player.mana = Math.max(0, player.mana - W.ragePerS * (frenzy ? RU.frenzyCost : 1) * s);
}

export function updateRealMen(dt) {
  if (!isWarrior() || player.dead) return;
  const now = state.now, s = dt / 1000;
  updateMelee(dt);
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
  player.resNote = `Schaden ×${rageMul().toFixed(2).replace('.', ',')}${undyingUntil > now ? ' · Letzter Atem' : ''}`;
}

const leapWindow = [TIMING.leap.move.from, TIMING.leap.move.to];
export const warriorUntouchable = () => isWarrior() && cur?.id === 'wLeap' && inWindow(leapWindow, cur.start, cur.ms);
export const warriorUndying = () => isWarrior() && undyingUntil > state.now;
// Schadensfaktor: nur der Krieger hat Rüstung
export const takenMul = () => isWarrior() ? 1 - R.armor : 1;
export const moveMul = () => whirlOn && !hasRune('wR', 'stride') ? R.whirl.speedMul : 1;
export const rooted = () => isWarrior() && !!cur && !cur.walk;   // eigene Bewegung oder keine

// Pause mitten in einer Attacke: Pose anhalten, sonst geht der Treffer der laufenden Animation verloren
export function realMenAnim() {
  if (!isWarrior() || player.dead) return {};
  return { ability: cur?.ability ?? (whirlOn ? 'whirl' : null), seq, rate: cur?.rate ?? 1, rage: player.mana, frozen: !!(state.paused && (cur || whirlOn)) };
}

// Für den Handtest
(window as any).__krieger = { get cur() { return cur; }, get combo() { return combo; }, rageMul, get undying() { return undyingUntil; }, REALMEN };
