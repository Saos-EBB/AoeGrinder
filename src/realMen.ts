// Real Men: Strichkrieger mit Riesenschwert und Wut statt Mana. Die Moves liegen als Spells in den Slots, damit Leiste, Tasten, Pad und Karten mitlaufen.
// Wut steht in player.mana, player.rageMax meldet den Modus an maxMana und die Regeneration. Modell und Treffer-Momente: models/strichKrieger.ts.

import { actionOfSpell } from './hotbar';
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
import { showError, combatText } from './ui/hud';
import { applyRoot, pullMob, knockbackMob, enterCombat } from './mobs';
import { makeCtx, mobsInRadius, hasRune, stat, cdEnd, startCd, stopDrink, supported, applySlow, setSpellSwap } from './spells/core';
import { activeModIds } from './modifiers';
import { UNIT, mods } from './config';
import { pdRateMul } from './dodge';
import { maxHp } from './formulas';
import { shakeCamera } from './camera';
import { $, rand, clamp } from './util';

import { after, updateMelee, clearMelee, moveInWindow, inWindow, mobsOnLine, forward } from './melee';
import { t } from './i18n';

// Alle Zahlen hier, auch die der Runen. Wirbelwind [Classic]-Radius: docs/handoff.md; alles andere ist // PH
const REALMEN = {
  armor: 0.25,                                     // weniger Schaden: steht mitten im Pack, ohne Blink und Nova
  rage: { max: 100, perMobHit: 6, perSwingMax: 15, decayPerS: 4, idleMs: 3000, perHitTaken: 2 },
  mult: { rage: 0.6, hp: 1 },                      // Schaden ×(1 + 0,6 · Wut/100) · (1 + fehlendes Leben): volle Wut bei 10 % Leben ≈ ×3
  // Schlagfolge Version E (08.11.): Diagonalhieb → Rückhand → Aufwärtsschnitt → Finisher. Stufe 4 bis 8, alle 25 Kills mit der Folge +1 (nur für den Run).
  // Finisher pro Stufe in FINISHER unten. Pro Stufe über 4 Schwert und Reichweite +6 %, Hieb-Farbe nach pal. masterRate: Talent Klingenmeister pro Rang
  q: { dmg: [28, 24, 30], radius: [2.9, 3.2, 2.9], halfAngle: [0.9, 1.4, 0.9], ms: [520, 480, 500], comboMs: 1300, start: 4, max: 8, killsPerHit: 25, masterRate: 0.1,
    spin: { dmg: 40, radius: 3.4, knock: 4, ms: 560, firstYd: 4, tornadoYd: 2.5 },   // firstYd: erster Spin in Laufrichtung (Tryndamere E), tornadoYd: jeder Tornado-Spin wandert nach vorn
    smash: { dmg: 55, radius: 3, knock: 6, ms: 820 },
    growPerStage: 0.06, pal: ['staub', 'wut', 'wut', 'donner', 'donner'],
    unlock: { slow: 0.25, ms: 900, chainDelayMs: 350 } },   // Stufen-Aufstieg: Zeitlupe, danach läuft die neue Kette einmal von selbst
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
  // Waffe vor dem Run (models/mage.ts, Hauptmenü). Axt und Kolben sind raus (v31), es bleibt das Riesenschwert. Legendäre Waffen: LEGENDARY unten
  weapons: {
    sword: { name: t('weapon.sword.name'), dmgMul: 1, rate: 1, ragePerHit: 6 },
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
// Legendäre Waffen (08.11.): ersetzen die Schlagfolge (eigene Kette, keine Stufen), einzelne Pool-Spells (swap) und geben Passiv + Combo (legends.ts). Alle Zahlen // PH
// chain: a = Animation, dmg, r = Radius, half = halber Kegelwinkel (fehlt: rundum), knock, jumpYd = Sprung ins nächste Pack
const LEGENDARY = {
  leeroy: {
    rate: 1.4, pal: 'wut', perMobDmg: 0.03, perMobYd: 10, armorMul: 0.8,   // Rücksichtslos: +3 % Schaden pro Mob in 10 yd, Rüstung −20 %
    chain: [{ a: 'q0', ms: 520, dmg: 22, r: 3, half: 1 }, { a: 'q1', ms: 480, dmg: 20, r: 3.2, half: 1.4 }, { a: 'q2', ms: 500, dmg: 22, r: 3, half: 1 },
      { a: 'q1', ms: 480, dmg: 20, r: 3.2, half: 1.4 }, { a: 'fm', ms: 820, dmg: 45, r: 3.5, knock: 5, jumpYd: 6, findYd: 12 }],
    swap: { wCharge: 'lLeeroy', wLast: 'lChicken' },
    leeroy: { yd: 15, pullYd: 20, stunImmuneMs: 4000, cd: 12000, ms: 350, dmg: 1 },   // LEEEROY!: rennt ins nächste Pack, Schaden in UNIT
    chicken: { heal: 0.3, ms: 3000, cd: 45000 },                                       // Hühnchen: Sofort-Essen
  },
};
// Finisher pro Stufe: Spins mit Radius-Faktor s, Tornado (tor) wandert nach vorn, am Ende Sprung-Smash // PH
const FINISHER = {
  4: [{ h: 'spin', s: 1 }],
  5: [{ h: 'spin', s: 1 }, { h: 'spin', s: 1.15 }],
  6: [{ h: 'spin', s: 1 }, { h: 'spin', s: 1.15 }, { h: 'smash', s: 1.1 }],
  7: [{ h: 'spin', s: 1 }, { h: 'spin', s: 1.15 }, { h: 'spin', s: 1.3 }, { h: 'smash', s: 1.2 }],
  8: [{ h: 'spin', s: 1, tor: 1 }, { h: 'spin', s: 1.15, tor: 1 }, { h: 'spin', s: 1.3, tor: 1 }, { h: 'spin', s: 1.45, tor: 1 }, { h: 'smash', s: 1.5 }],
};

const spell = (name, desc, tags, ranks, cd, mana, press, showDmg?, runes?) => ({ name, desc, showDmg, ranks, tags: ['Krieger', ...tags], cls: 'fire', school: 'warrior', fixed: true, cd, mana, press, runes });
// Slots in Tastenreihenfolge: Q, E, R, Maus 4, Maus 5, 1, 2, 3. fixed: nie als Karte in anderen Modi
Object.assign(SPELLS, {
  wQ: spell(t('spell.wQ.name'), t('spell.wQ.desc'), ['Nahkampf', 'Fläche'], ['dmg', 'radius', 'tempo'], 0, 0, () => pressQ(), R.q.dmg[0], [
    { id: 'wide', name: t('spell.wQ.runes.wide.name'), desc: t('spell.wQ.runes.wide.desc') }, { id: 'leech', name: t('spell.wQ.runes.leech.name'), desc: t('spell.wQ.runes.leech.desc') }, { id: 'wrath', name: t('spell.wQ.runes.wrath.name'), desc: t('spell.wQ.runes.wrath.desc') }]),
  wE: spell(t('spell.wE.name'), t('spell.wE.desc'), ['Nahkampf', 'Linie', 'Fläche'], ['dmg', 'tempo'], R.e.cd, R.e.rage, () => pressMove('wE', 'e', WT().e, SPELLS.wE.mana), R.e.dmg, [
    { id: 'long', name: t('spell.wE.runes.long.name'), desc: t('spell.wE.runes.long.desc') }, { id: 'stun', name: t('spell.wE.runes.stun.name'), desc: t('spell.wE.runes.stun.desc') }, { id: 'charges', name: t('spell.wE.runes.charges.name'), desc: t('spell.wE.runes.charges.desc'), charges: 2 }]),
  wR: spell(t('spell.wR.name'), t('spell.wR.desc'), ['Nahkampf', 'Fläche'], ['dmg', 'radius'], 0, 0, () => pressWhirl(), (R.whirl.dmg[0] + R.whirl.dmg[1]) / 2, [
    { id: 'stride', name: t('spell.wR.runes.stride.name'), desc: t('spell.wR.runes.stride.desc') }, { id: 'frenzy', name: t('spell.wR.runes.frenzy.name'), desc: t('spell.wR.runes.frenzy.desc') }, { id: 'maelstrom', name: t('spell.wR.runes.maelstrom.name'), desc: t('spell.wR.runes.maelstrom.desc') }]),
  wExec: spell(t('spell.wExec.name'), t('spell.wExec.desc'), ['Nahkampf', 'Fläche'], ['dmg', 'tempo'], R.exec.cd, R.exec.rage, () => pressMove('wExec', 'exec', WT().exec, SPELLS.wExec.mana), R.exec.dmg, [
    { id: 'low', name: t('spell.wExec.runes.low.name'), desc: t('spell.wExec.runes.low.desc') }, { id: 'wide', name: t('spell.wExec.runes.wide.name'), desc: t('spell.wExec.runes.wide.desc') }, { id: 'refund', name: t('spell.wExec.runes.refund.name'), desc: t('spell.wExec.runes.refund.desc') }]),
  wLast: spell(t('spell.wLast.name'), t('spell.wLast.desc'), [], [], R.last.cd, 0, () => pressMove('wLast', 'last', TIMING.last, 0)),
  wCry: spell(t('spell.wCry.name'), t('spell.wCry.desc'), [], [], R.cry.cd, 0, () => pressMove('wCry', 'cry', TIMING.cry, 0), undefined, [
    { id: 'rage', name: t('spell.wCry.runes.rage.name'), desc: t('spell.wCry.runes.rage.desc') }, { id: 'fear', name: t('spell.wCry.runes.fear.name'), desc: t('spell.wCry.runes.fear.desc') }, { id: 'shock', name: t('spell.wCry.runes.shock.name'), desc: t('spell.wCry.runes.shock.desc') }]),
  wLeap: spell(t('spell.wLeap.name'), t('spell.wLeap.desc'), ['Nahkampf', 'Bewegung', 'Fläche'], ['dmg', 'radius', 'tempo'], R.leap.cd, R.leap.rage, () => pressMove('wLeap', 'leap', TIMING.leap.ms, R.leap.rage), R.leap.dmg, [
    { id: 'quake', name: t('spell.wLeap.runes.quake.name'), desc: t('spell.wLeap.runes.quake.desc') }, { id: 'stun', name: t('spell.wLeap.runes.stun.name'), desc: t('spell.wLeap.runes.stun.desc') }, { id: 'haste', name: t('spell.wLeap.runes.haste.name'), desc: t('spell.wLeap.runes.haste.desc'), cdMul: 0.5 }]),
  wEat: spell(t('spell.wEat.name'), t('spell.wEat.desc'), [], [], 0, 0, () => pressEat()),
  // v31
  wCharge: spell(t('spell.wCharge.name'), t('spell.wCharge.desc'), ['Nahkampf', 'Bewegung'], ['dmg', 'cd'], R.charge.cd, 0, () => pressCharge(), R.charge.dmg * UNIT),
  wClap: spell(t('spell.wClap.name'), t('spell.wClap.desc'), ['Nahkampf', 'Fläche'], ['dmg', 'radius'], R.clap.cd, R.clap.rage, () => pressClap(), R.clap.dmg * UNIT),
  wShout: spell(t('spell.wShout.name'), t('spell.wShout.desc'), ['Kontrolle'], ['cd', 'radius'], R.shout.cd, 0, () => pressShout()),
  wBerserk: { ...spell(t('spell.wBerserk.name'), t('spell.wBerserk.desc'), [], [], R.berserk.cd, 0, () => pressBerserk()), figRelic: true },
  // Leeroys Klinge (LEGENDARY.leeroy): ersetzen Ansturm und Letzter Atem
  lLeeroy: spell(t('spell.lLeeroy.name'), t('spell.lLeeroy.desc'), ['Nahkampf', 'Bewegung'], ['cd'], LEGENDARY.leeroy.leeroy.cd, 0, () => pressLeeroy(), LEGENDARY.leeroy.leeroy.dmg * UNIT),
  lChicken: spell(t('spell.lChicken.name'), t('spell.lChicken.desc'), [], [], LEGENDARY.leeroy.chicken.cd, 0, () => pressChicken()),
});

export const WAR_WEAPON_NAMES = Object.fromEntries(Object.entries(R.weapons).map(([id, w]) => [id, w.name]));
const weaponId = () => R.weapons[mage.warWeapon] ? mage.warWeapon : 'sword';
const WP = (): any => R.weapons[weaponId()];
const WT = () => TIMING.weapons[weaponId()] ?? TIMING.weapons.sword;
const runeStage = (id, r) => hasRune(id, r) ? state.cardPicks[`rune-${id}-${r}`] || 1 : 0;

const isWarrior = () => mage.skin === 'krieger';

// Taste oder Pad-Knopf des Slots, in dem die Attacke liegt
export function held(id) {
  const action = actionOfSpell(id);   // Platz auf der Leiste (hotbar.ts)
  return !!action && (act(action) || !!pad.down[padBinds[action]]);
}

let cur = null;                 // laufender Move: { id, ability, start, ms, rate, ctx, from }
let seq = 0, combo = 0, comboUntil = 0, lastRageAt = 0, undyingUntil = 0;
let whirlOn = false, whirlUntil = 0, whirlCtx = null, nextWhirlTick = 0, whirlStart = 0;
let charge = null;   // Ansturm: { from, target, start, ctx }
const moveLog = [];
// Feld legendary: null oder Waffen-ID aus LEGENDARY. Zum Testen im Dev-Panel, gespeichert wie die Waffenwahl
const LEGENDARY_STORE = 'frostgrind.warLegendary';
let legendary: string | null = (() => { try { const v = localStorage.getItem(LEGENDARY_STORE); return LEGENDARY[v] ? v : null; } catch { return null; } })();
export const warLegendary = () => legendary;
export const WAR_LEGENDARIES = Object.keys(LEGENDARY);
export function setWarLegendary(id: string | null) {
  legendary = LEGENDARY[id] ? id : null;
  try { if (legendary) localStorage.setItem(LEGENDARY_STORE, legendary); else localStorage.removeItem(LEGENDARY_STORE); } catch { /* egal */ }
}
const LG = (): any => (legendary && activeModIds().includes('realmen') ? LEGENDARY[legendary] : null);
setSpellSwap(id => LG()?.swap[id] ?? id);
let stunImmuneUntil = 0, chickenUntil = 0;
let stage = R.q.start, autoQ = 0, autoAt = 0, slowUntil = 0;   // Schlagfolge Version E: Stufe, Auto-Kette nach dem Aufstieg, Zeitlupe (performance.now)

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
  state.qKills = 0; player.berserkUntil = 0; stage = R.q.start; autoQ = 0; slowUntil = 0; stunImmuneUntil = 0; chickenUntil = 0;
  whirlOn = false; whirlUntil = 0; whirlCtx = null; nextWhirlTick = 0;   // state.now startet pro Run bei 0
  state.heroWeapon = on ? WP().name : '';
  if (on) {
    player.mana = 0; clearMelee();
    mage.hero.setBladeScale?.(1);
  }
}

const rateOf = id => stat(id).tempo ?? 1;
function startMove(id, ability, ms) {
  whirlOn = false; whirlUntil = 0;
  const rate = rateOf(id) * WP().rate * pdRateMul() * (id === 'wQ' ? (1 + R.q.masterRate * mods.bladeMaster) * (LG()?.rate ?? 1) : 1);   // Perfekter Dodge, Klingenmeister, legendäre Kette
  cur = { id, ability, start: state.now, ms: ms / rate, rate, ctx: makeCtx(id), from: { x: player.pos.x, y: player.pos.y, z: player.pos.z } };
  seq++;
  moveLog.push(ability); if (moveLog.length > 60) moveLog.shift();   // Handtest (__krieger.log)
}
function pressQ() {
  if (cur) return;
  stopDrink();
  if (state.now > comboUntil) combo = 0;
  if (LG()) return pressLegendQ();
  const step = combo, n = qLength(), part = step >= 3 ? FINISHER[stage][step - 3] : null, Q = R.q;
  combo = (combo + 1) % n;
  player.lastCombat = state.now;
  if (step === 3 && Math.hypot(player.vel.x, player.vel.z) > 0.1) player.facing = Math.atan2(player.vel.x, player.vel.z);   // Finisher in Laufrichtung
  if (!part) startMove('wQ', `q${step}`, Q.ms[step]);
  else startMove('wQ', part.h === 'spin' ? 'fs' : 'fm', part.h === 'spin' ? Q.spin.ms : Q.smash.ms);
  cur.qStep = step; cur.part = part;
  cur.yd = part?.h === 'spin' ? (part.tor ? Q.spin.tornadoYd : step === 3 ? Q.spin.firstYd : 0) : 0;
  if (step === n - 1) cur.combo = consumeCombo('smash');   // Dodge-Kombo: auf den letzten Teil
  cur.walk = !part;
}
// Kette der legendären Waffe: feste Schläge, der letzte kann ins nächste Pack springen
function pressLegendQ() {
  const L = LG(), step = combo % L.chain.length, part = L.chain[step];
  combo = (combo + 1) % L.chain.length;
  player.lastCombat = state.now;
  let yd = 0;
  if (part.jumpYd) {
    const m = nearestMob(part.findYd);
    if (m) { player.facing = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z); yd = Math.min(part.jumpYd, Math.max(0, Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z) - 1.5)); }
  }
  startMove('wQ', part.a, part.ms);
  cur.lpart = part; cur.yd = yd; cur.walk = !part.jumpYd;
  if (step === L.chain.length - 1) cur.combo = consumeCombo('smash');
}
const nearestMob = yd => mobsInRadius(player.pos, yd, Infinity).filter(m => !m.dead).sort((a, b) => Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z) - Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z))[0];
// Länge der Schlagfolge = Stufe: 3 Grundschläge + Finisher-Teile
const qLength = () => 3 + FINISHER[stage].length;
const bladeScale = () => 1 + R.q.growPerStage * (stage - R.q.start);
// Stufen-Aufstieg: Zeitlupe, Text, Banner, Schwert flammt auf, danach die neue Kette einmal von selbst
function stageUp() {
  if (stage >= R.q.max) return;
  stage++;
  const U = R.q.unlock;
  slowUntil = performance.now() + U.ms;
  combatText(player.pos, t('war.kills', { n: R.q.killsPerHit }), 'info', 2.6);
  showBanner(t('war.finStage', { n: stage - 3 }), t(`war.fin.${stage}`));
  mage.hero.setBladeScale?.(bladeScale());
  mage.hero.flareTip?.();
  combo = 0; autoQ = qLength(); autoAt = state.now + U.chainDelayMs;
}
export const warTimeScale = () => performance.now() < slowUntil ? R.q.unlock.slow : 1;
const banner = document.createElement('div');
Object.assign(banner.style, { position: 'fixed', left: '50%', top: '22%', transform: 'translateX(-50%)', zIndex: '3', pointerEvents: 'none', textAlign: 'center', display: 'none',
  font: '700 30px Cinzel, Georgia, serif', color: '#ffd26a', textShadow: '0 2px 8px #000, 0 0 18px #ff8a1a88', letterSpacing: '.06em' });
document.body.appendChild(banner);
let bannerTimer = 0;
function showBanner(head, name) {
  banner.innerHTML = `<div>${head}</div><div style="font-size:20px;color:#f4efe4">${name}</div>`;
  banner.style.display = 'block';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { banner.style.display = 'none'; }, 2200) as any;
}
function pressMove(id, ability, ms, cost) {
  if (cur) return;
  if (!player.grounded) return showError(t('msg.notInAir'));
  if (cdEnd(id) > state.now) return showError(t('msg.notReady'));
  if (player.mana < cost) return showError(t('msg.noRage'));
  stopDrink();
  player.mana -= cost;
  startCd(id);
  player.lastCombat = state.now;
  startMove(id, ability, ms);
  if (id === 'wLeap' || id === 'wExec') cur.combo = consumeCombo('smash');
}
function pressWhirl() {
  if (!whirlOn && player.mana < R.whirl.minStart) return showError(t('msg.noRage'));
  stopDrink();
  whirlUntil = state.now + R.whirl.tapMs;
}
function pressEat() {
  if (cur || whirlOn) return;
  if (!player.grounded) return showError(t('msg.notInAir'));
  player.drink = { start: state.now, end: state.now + R.eat.ms, dur: R.eat.ms, hp: 1, label: t('spell.wEat.name'), keepOnHit: true };
}

// Passiv der legendären Waffe (Leeroy: Rücksichtslos, +x % pro Mob in der Nähe)
function legendPassiveMul() {
  const L = LG();
  return L?.perMobDmg ? 1 + L.perMobDmg * mobsInRadius(player.pos, L.perMobYd, Infinity).filter(m => !m.dead).length : 1;
}
// Ein Treffer-Ereignis: Wut kommt nur, wenn etwas getroffen wurde, und ist pro Schlag gedeckelt
function strike(ctx, amount, targets, onMob?, rageK = 1) {
  let landed = 0;
  const W = WP(), mul = rageMul() * W.dmgMul * (cur?.combo ? DG.combo.smashMul : 1) * legendPassiveMul();   // Dodge-Kombo: +50 % auf den Smash
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
  const leech = m => {
    if (hasRune('wQ', 'leech')) player.hp = Math.min(maxHp(), player.hp + maxHp() * RU.leech);
    if (m.dead && !m.qCounted && !LG()) { m.qCounted = true; state.qKills = (state.qKills ?? 0) + 1; if (state.qKills % R.q.killsPerHit === 0) stageUp(); }   // Kills mit der Folge, legendäre Waffe ohne Stufen
    return m;
  };
  const part = cur.part, reach = bladeScale() * wide, lp = cur.lpart;
  if (lp) {
    const r = c.radius(lp.r) * wide;
    const hit = event('wQ', c, () => lp.dmg, () => lp.half ? inCone(player.pos, r, lp.half) : mobsInRadius(player.pos, r), m => { leech(m); if (lp.knock && !m.dead) knockbackMob(m, player.pos, lp.knock); }, rageK);
    if (!lp.half) smash(hit);
  } else if (part) {
    const S = part.h === 'spin' ? R.q.spin : R.q.smash, r = c.radius(S.radius) * reach * part.s;
    smash(event('wQ', c, () => S.dmg * part.s, () => mobsInRadius(player.pos, r), m => { leech(m); if (!m.dead) knockbackMob(m, player.pos, S.knock); }, rageK));
  } else {
    const k = cur.qStep, r = c.radius(R.q.radius[k]) * reach;
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
  if (cdEnd('wCharge') > state.now) return showError(t('msg.notReady'));
  const C = R.charge, target = mobsInRadius(player.pos, C.yd, Infinity).filter(m => {
    const a = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z) - player.facing;
    return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= C.halfAngle;
  }).sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos))[0];
  if (!target) return showError(t('msg.noTargetAhead'));
  stopDrink();
  startCd('wCharge');
  player.lastCombat = state.now;
  charge = { from: player.pos.clone(), target, start: state.now, ctx: makeCtx('wCharge') };
  chargeLook(R.charge.ms);
}
// LEEEROY!: rennt ins nächste Pack, alle Mobs in 20 yd laufen auf dich zu, kurz immun gegen Betäubung
function pressLeeroy() {
  if (cur || charge) return;
  if (cdEnd('lLeeroy') > state.now) return showError(t('msg.notReady'));
  const L = LEGENDARY.leeroy.leeroy, target = nearestMob(L.yd);
  if (!target) return showError(t('msg.noTarget'));
  stopDrink();
  startCd('lLeeroy');
  player.lastCombat = state.now;
  charge = { from: player.pos.clone(), target, start: state.now, ctx: makeCtx('lLeeroy'), leeroy: true };
  stunImmuneUntil = state.now + L.stunImmuneMs;
  combatText(player.pos, t('war.leeroyShout'), 'info', 2.8);
  chargeLook(L.ms);
}
// Hühnchen: Sofort-Essen, Leben über ein paar Sekunden
function pressChicken() {
  if (cdEnd('lChicken') > state.now) return showError(t('msg.notReady'));
  startCd('lChicken');
  chickenUntil = state.now + LEGENDARY.leeroy.chicken.ms;
  mage.hero.fx.ring(player.pos, 0xe0141c, 2.5, 0.5, 0.1);
}
function updateCharge() {
  const C: any = charge.leeroy ? LEGENDARY.leeroy.leeroy : R.charge, t = Math.min(1, (state.now - charge.start) / C.ms), to = charge.target.pos;
  const d = Math.hypot(to.x - charge.from.x, to.z - charge.from.z) || 1, stop = Math.max(0, 1 - 1.2 / d);   // vor dem Ziel stehen bleiben
  player.pos.x = charge.from.x + (to.x - charge.from.x) * stop * t;
  player.pos.z = charge.from.z + (to.z - charge.from.z) * stop * t;
  player.facing = Math.atan2(to.x - charge.from.x, to.z - charge.from.z);
  if (t < 1) return;
  const m = charge.target, c = charge.ctx, leeroy = charge.leeroy;
  charge = null;
  if (leeroy) {
    const L = LEGENDARY.leeroy.leeroy;
    strike(c, () => L.dmg * UNIT, () => mobsInRadius(player.pos, 3));
    for (const o of mobsInRadius(player.pos, L.pullYd, Infinity)) if (!o.dead) { o.state = 'idle'; enterCombat(o, false); }
    chargeHit(m.pos);
    shakeCamera(0.4);
    return;
  }
  strike(c, () => C.dmg * UNIT, () => (m.dead ? [] : [m]), o => { if (!o.dead) applyRoot(o, C.stunMs); });
  chargeHit(m.pos);
  gainRage(C.rage);
  shakeCamera(0.3);
}
function pressClap() {
  if (cur) return;
  if (cdEnd('wClap') > state.now) return showError(t('msg.notReady'));
  if (player.mana < R.clap.rage) return showError(t('msg.noRage'));
  player.mana -= R.clap.rage;
  startCd('wClap');
  player.lastCombat = state.now;
  const C = R.clap, c = makeCtx('wClap'), r = c.radius(C.radius);
  strike(c, () => C.dmg * UNIT, () => mobsInRadius(player.pos, r), m => { if (!m.dead) applySlow(m, C.slow, C.slowMs); }, 0);
  clapLook(r);
  shakeCamera(0.35);
}
function pressShout() {
  if (cdEnd('wShout') > state.now) return showError(t('msg.notReady'));
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
  if (cdEnd('wBerserk') > state.now) return showError(t('msg.notReady'));
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
  if (stunImmuneUntil > now) player.stunUntil = 0;   // LEEEROY!
  if (chickenUntil > now) player.hp = Math.min(maxHp(), player.hp + maxHp() * LEGENDARY.leeroy.chicken.heal * dt / LEGENDARY.leeroy.chicken.ms);
  if (undyingUntil > now) player.mana = R.rage.max;
  else if (now - lastRageAt > R.rage.idleMs) player.mana = Math.max(0, player.mana - R.rage.decayPerS * s);
  if (cur) {
    if (cur.id === 'wLeap') moveInWindow({ ...TIMING.leap.move, yd: R.leap.yd }, cur.start, cur.ms, dt);
    if (cur.yd) moveInWindow({ from: 0.2, to: 0.8, yd: cur.yd }, cur.start, cur.ms, dt);   // Finisher-Spin wandert
    if (now >= cur.start + cur.ms) {
      if (cur.id === 'wQ') comboUntil = now + R.q.comboMs;
      cur = null;
    }
  }
  updateWhirl(s);
  if (!cur && !whirlOn && player.stunUntil <= now && autoQ > 0 && now >= autoAt) { autoQ--; pressQ(); }   // neue Kette nach dem Stufen-Aufstieg
  else if (!cur && !whirlOn && player.stunUntil <= now && held('wQ')) pressQ();   // Ein Druck, ein Schlag; Halten schlägt weiter
  player.resNote = t('war.note', { mul: +rageMul().toFixed(2), q: qLength() }) + (undyingUntil > now ? t('war.last') : '') + (player.berserkUntil > now ? t('war.berserk') : '');
}

const leapWindow = [TIMING.leap.move.from, TIMING.leap.move.to];
export const warriorUntouchable = () => isWarrior() && cur?.id === 'wLeap' && inWindow(leapWindow, cur.start, cur.ms);
// Dodge bricht den laufenden Move ab (Animation-Cancel), auch mitten im Schlag
export function cancelWarriorMove() { if (!isWarrior() || !cur) return; cur = null; seq++; }
export const warriorUndying = () => isWarrior() && undyingUntil > state.now;
// Schadensfaktor: nur der Krieger hat Rüstung
// Charakterfenster (ui/charInfo.ts)
export const warriorInfo = () => ({ rageMul: rageMul(), qLength: qLength(), R });
export const takenMul = () => isWarrior() ? 1 - R.armor * (LG()?.armorMul ?? 1) : 1;
export const moveMul = () => whirlOn && !hasRune('wR', 'stride') ? R.whirl.speedMul : 1;
export const rooted = () => isWarrior() && !!cur && !cur.walk;   // eigene Bewegung oder keine

// Pause mitten in einer Attacke: Pose anhalten, sonst geht der Treffer der laufenden Animation verloren
export function realMenAnim() {
  if (!isWarrior() || player.dead) return {};
  return { ability: cur?.ability ?? (whirlOn ? 'whirl' : null), seq, rate: cur?.rate ?? 1, rage: player.mana, qPal: LG()?.pal ?? R.q.pal[stage - R.q.start], fin: { s: LG() ? 1 : bladeScale() * (cur?.part?.s ?? 1), tor: cur?.part?.tor ?? 0 }, berserk: berserkOn(), frozen: !!((state.paused || hitstopActive()) && (cur || whirlOn)) };
}

// Für den Handtest
(window as any).__krieger = { get cur() { return cur; }, get combo() { return combo; }, get stage() { return stage; }, stageUp, log: moveLog, rageMul, get undying() { return undyingUntil; }, REALMEN };
