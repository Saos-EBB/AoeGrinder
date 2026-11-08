// Klingenstrich: Nahkämpfer ohne Ressource, nur Abklingzeiten. Zwei Haltungen, 8 Slots. Die Moves liegen als Spells in den Slots wie bei Real Men,
// damit Leiste, Tasten, Pad und Karten mitlaufen. Modell und Treffer-Momente kommen aus models/klingeModel.ts.

import { kunaiLook, stormLook, stormBoom, parryLook, counterLook, iaidoLook, smokeLook } from './vfx/klingeLook';
import { state, player } from './state';
import { $, dist2d } from './util';
import { SPELLS, CFG, UNIT, mods } from './config';
import { pdRateMul } from './dodge';
import { combatText } from './ui/hud';
import { mage, onWarriorHit } from './models/mage';
import { hitstopActive } from './fx/impact';
import { DG, consumeCombo } from './dodge';
import { KLINGE_TIMING as TIMING, wirbelSpin, cloneKlinge } from './models/klingeModel';
import { scene } from './render';
import { useKlingeBinds, pickGround, mouse } from './input';
import { held } from './realMen';
import { groundAt, resolve } from './collision';
import { showError } from './ui/hud';
import { maxHp } from './formulas';
import { damageMob, knockbackMob, applyRoot, pullMob } from './mobs';
import { makeCtx, stat, cdEnd, startCd, damageMult, stopDrink, mobsInRadius, applySlow, supported, hasRune } from './spells/core';
import { after, updateMelee, clearMelee, moveInWindow, inWindow, mobsOnLine, forward } from './melee';
import { t } from './i18n';

// Alle Zahlen hier. Alles // PH
const KLINGE = {
  // Haltungen (v31): 1 Einhand ohne Boni und ohne Blutung. Leiste 0–100 füllt sich durch Schaden (ausgeteilt +1 pro Einheit, erlitten +1 pro 1 % Leben).
  // Voll: F wechselt in 2 (Zweihand, +30 %, Blutung). Nach 1,5 min in 2 kommt 3 (dazu Tempo +25 %, Angriffstempo ×2). 10 s ohne Kill leert sich die Leiste, leer → 1
  stance: {
    1: { name: t('klinge.stance.1.name'), move: 1, rate: 1, range: 1, dmg: 1, cdOnHit: 0, bleed: false, model: 1 },          // PH
    2: { name: t('klinge.stance.2.name'), move: 1, rate: 1, range: 1, dmg: 1.3, cdOnHit: 0, bleed: true, model: 2 },        // PH
    3: { name: t('klinge.stance.3.name'), move: 1.25, rate: 2, range: 1, dmg: 1.3, cdOnHit: 0, bleed: true, model: 2 }, // PH
  },
  bar: { max: 100, perUnit: 1, perPctTaken: 1, idleMs: 10000, drainPerS: 25, toThreeMs: 90000 },            // PH
  // Neu v31, Schaden in Einheiten (UNIT)
  storm: { ms: 6000, radius: 3, tickMs: 300, dmg: 0.5, blades: 4, boom: { radius: 2, dmg: 1 }, cd: 12000 },   // PH
  kunai: { n: 3, spread: 30 * Math.PI / 180, len: 15, width: 1, dmg: 0.8, cd: 3000 },                       // PH
  counter: { ms: 500, radius: 4, angle: Math.PI / 2, dmg: 3, cd: 8000 },                                    // PH
  iaido: { drawMs: 400, len: 10, width: 2, dmg: 3, cd: 6000 },                                              // PH
  smoke: { ms: 3000, cd: 25000 },                                                                            // PH
  flicker: { range: 10 },                                                                                    // PH: Talent Flicker
  deepWounds: 0.2,                                                                                           // PH: Blutung +20 % pro Rang
  bleed: { share: 0.33, ms: 5000, tickMs: 1000, max: 7 },                                                    // PH: 33 % des Treffers über 5 s, 7 Stapel pro Mob
  // Q-Kette: ein Schlag pro Druck, nächster Druck im Zeitfenster nach dem Schlag, sonst wieder Schlag 1. Dauern in KLINGE_TIMING.qChain.
  // Pro Schlag die Treffer-Ereignisse in Modell-Reihenfolge. Schaden vor dem Haltungs-Faktor. cone: Kegel in Grad, sonst rundum. line: Länge in yd. Alles PH
  q: {
    windowMs: 1000,
    chain: {
      1: [{ hits: [{ dmg: 25, cone: 115, radius: 3 }] },                         // Ziehschnitt
        { hits: [{ dmg: 30, cone: 150, radius: 3 }] },                           // Rückhand waagrecht
        { hits: [{ dmg: 55, line: 4, width: 1.2 }], rooted: true }],             // Stoß, Treffer beim Wegstecken; Reichweite ×1,4 macht 5,6 yd
      2: [{ hits: [{ dmg: 30, cone: 115, radius: 3 }] },                         // rechts diagonal
        { hits: [{ dmg: 30, cone: 115, radius: 3 }] },                           // links diagonal
        { hits: [{ dmg: 25, cone: 126, radius: 3 }, { dmg: 25, cone: 126, radius: 3 }] },   // X-Schnitt
        { hits: [{ dmg: 45, radius: 3.2, bleeds: 2 }], rooted: true }],          // Wirbelsprung, Landung mit Druckwelle, 2 Blutungs-Stapel
    },
  },
  e: { radius: 4, dmg: 15, slow: 0.4, slowMs: 3000, cd: 4000 },                                              // PH
  dash: { yd: { 1: 11, 2: 8 }, width: 1.2, dmg: 40, cd: 5000, charges: 2 },                                  // PH: Zweihand teilt den Schaden auf 2 Schnitte
  wirbel: { radius: 6, tick: 8, end: 20, throwYd: 8, throwMs: 500, cd: 25000, moveMul: 0.5, orbit: 2.5, pullMs: 450, spinK: 0.93, lift: 0.7 },   // PH
  ader: { radius: 15, mul: 1.5, cd: 6000 },                                                                  // PH
  clones: { cd: 60000, ms: 8000, side: 1.5, dmg: 0.5 },                                                      // PH
  eat: { ms: 18000 },                                                                                        // PH: 18 s bis 100 % Leben
  runes: {                                                                                                   // alles PH
    cone: [180, 360], echoMs: 300, echoMul: 0.5, reachYd: 1,                                                 // Schnitt
    freezeMs: 1000, pullYd: 2,                                                                               // Kreisschnitt
    trailRaw: 15, trailMs: 4000, trailTickMs: 1000, backMs: 150,                                             // Strichschnitt
    longMs: 1000, throwBehind: 50,                                                                           // Blutwirbel
    jumpYd: 5, killCdMs: 3000, heal: 0.1,                                                                    // Aderlass
    miniRadius: 3, miniDmg: 10, bonus: 0.6,                                                                  // Haltung
  },
  echo: { ms: 500, mul: 0.7, bigMs: [500, 1000], bigMul: [1.2, 1.4] },                                       // Supports Echo und Großes Echo wie in core.ts
};
const K = KLINGE;
// Waffenwahl vor dem Run (ui/mainMenu.ts): Standard oder die Legende Thunderfury (legends.ts), gleiches Kit
export const KLINGE_WEAPON_NAMES = { standard: t('weapon.katanas.name'), thunderfury: t('legend.thunderfury.name') };

// Slots in Tastenreihenfolge: Q, E, R, Maus 4, Maus 5, 1, 2, 3
const move = (name, desc, tags, cd, press, extra = {}) => ({ name, desc, ranks: [], tags: ['Klinge', ...tags], cls: 'fire', school: 'warrior', fixed: true, cd, mana: 0, press, ...extra });
Object.assign(SPELLS, {
  kQ: move(t('spell.kQ.name'), t('spell.kQ.desc'), ['Nahkampf', 'Fläche', 'Schnitt'], 0, () => pressQ(), { showDmg: K.q.chain[1][0].hits[0].dmg }),
  kE: move(t('spell.kE.name'), t('spell.kE.desc'), ['Nahkampf', 'Fläche', 'Kontrolle'], K.e.cd, () => pressE(), { showDmg: K.e.dmg }),
  kR: move(t('spell.kR.name'), t('spell.kR.desc'), ['Nahkampf', 'Fläche', 'Kontrolle'], K.wirbel.cd, () => pressWirbel(), { showDmg: K.wirbel.tick }),
  kAder: move(t('spell.kAder.name'), t('spell.kAder.desc'), ['Blutung', 'Fläche'], K.ader.cd, () => pressAder()),
  kClones: { ...move(t('spell.kClones.name'), t('spell.kClones.desc'), [], K.clones.cd, () => pressClones()), figRelic: true },
  kDash: move(t('spell.kDash.name'), t('spell.kDash.desc'), ['Nahkampf', 'Bewegung', 'Linie'], K.dash.cd, () => pressDash(), { showDmg: K.dash.dmg, charges: K.dash.charges }),
  kStorm: move(t('spell.kStorm.name'), t('spell.kStorm.desc'), ['Nahkampf', 'Fläche'], K.storm.cd, () => pressStorm(), { showDmg: K.storm.dmg * UNIT }),
  kKunai: move(t('spell.kKunai.name'), t('spell.kKunai.desc'), ['Fernkampf', 'Geschoss'], K.kunai.cd, () => pressKunai(), { showDmg: K.kunai.dmg * UNIT }),
  kCounter: move(t('spell.kCounter.name'), t('spell.kCounter.desc'), ['Nahkampf', 'Kontrolle'], K.counter.cd, () => pressCounter(), { showDmg: K.counter.dmg * UNIT }),
  kIaido: move(t('spell.kIaido.name'), t('spell.kIaido.desc'), ['Nahkampf', 'Linie'], K.iaido.cd, () => pressIaido(), { showDmg: K.iaido.dmg * UNIT }),
  kSmoke: move(t('spell.kSmoke.name'), t('spell.kSmoke.desc'), ['Bewegung'], K.smoke.cd, () => pressSmoke()),
  kEat: move(t('spell.kEat.name'), t('spell.kEat.desc'), [], 0, () => pressEat()),
});
// Wie bei Real Men gilt pro Move eine Rune. stages: mehrere Stufen derselben Rune (Karte zählt in state.cardPicks).
const ranks = (ids, list) => { for (const id of ids) SPELLS[id].ranks = list; };
ranks(['kQ', 'kE', 'kR', 'kDash'], ['dmg', 'radius', 'tempo']);
ranks(['kAder'], ['dmg', 'radius']);
SPELLS.kQ.runes = [
  { id: 'cone', name: t('spell.kQ.runes.cone.name'), desc: t('spell.kQ.runes.cone.desc'), stages: 2 },
  { id: 'echo', name: t('spell.kQ.runes.echo.name'), desc: t('spell.kQ.runes.echo.desc') },
  { id: 'reach', name: t('spell.kQ.runes.reach.name'), desc: t('spell.kQ.runes.reach.desc'), stages: 3 },
];
SPELLS.kE.runes = [
  { id: 'freeze', name: t('spell.kE.runes.freeze.name'), desc: t('spell.kE.runes.freeze.desc') },
  { id: 'pull', name: t('spell.kE.runes.pull.name'), desc: t('spell.kE.runes.pull.desc') },
  { id: 'charges', name: t('spell.kE.runes.charges.name'), desc: t('spell.kE.runes.charges.desc'), charges: 2 },
];
SPELLS.kDash.runes = [
  { id: 'reset', name: t('spell.kDash.runes.reset.name'), desc: t('spell.kDash.runes.reset.desc') },
  { id: 'trail', name: t('spell.kDash.runes.trail.name'), desc: t('spell.kDash.runes.trail.desc') },
  { id: 'back', name: t('spell.kDash.runes.back.name'), desc: t('spell.kDash.runes.back.desc') },
];
SPELLS.kR.runes = [
  { id: 'follow', name: t('spell.kR.runes.follow.name'), desc: t('spell.kR.runes.follow.desc') },
  { id: 'direct', name: t('spell.kR.runes.direct.name'), desc: t('spell.kR.runes.direct.desc') },
  { id: 'long', name: t('spell.kR.runes.long.name'), desc: t('spell.kR.runes.long.desc') },
];
SPELLS.kAder.runes = [
  { id: 'jump', name: t('spell.kAder.runes.jump.name'), desc: t('spell.kAder.runes.jump.desc') },
  { id: 'killCd', name: t('spell.kAder.runes.killCd.name'), desc: t('spell.kAder.runes.killCd.desc') },
  { id: 'heal', name: t('spell.kAder.runes.heal.name'), desc: t('spell.kAder.runes.heal.desc') },
];

// Nicht in Object.keys: keine Karte, nur Farbe für Funken und Schadenszahlen
Object.defineProperty(SPELLS, 'kBleed', { value: { name: t('spell.kBleed.name'), cls: 'fire', school: 'warrior', tags: [] }, enumerable: false });

const on = () => mage.skin === 'klinge';
const S = () => K.stance[stance];
const swapMul = () => 1;   // Wechsel-Bonus ist seit v31 raus
const runeStage = (id, r) => hasRune(id, r) ? state.cardPicks[`rune-${id}-${r}`] || 1 : 0;

let stance = 1, bar = 0, lastKill = -1e9, stanceAt = 0;   // Leiste 0–100, letzter Kill, seit wann Haltung 2
let act = null;                 // laufender Move: { id, ability, start, ms, rate, ctx }
let seq = 0;                    // zählt jeden Start, damit das Modell zweimal denselben Move erkennt
let swapBonus = false;
let attackUntil = 0, attackCtx = null, attackRate = 1;   // Q läuft den Schlag immer zu Ende, Halten oder Puffer startet den nächsten
const chain = { step: 0, until: 0, buffered: false };     // nächster Schlag der Kette, Ende des Zeitfensters, 1 gepufferter Druck
let sheatheUntil = 0;                                     // Einhand: Fenster abgelaufen, Klinge wird weggesteckt (nur Optik)
const resetChain = () => { chain.step = 0; chain.until = 0; chain.buffered = false; sheatheUntil = 0; };
const bleeding = new Set<any>();
let clones = [], clonesUntil = 0;
let trails = [];                // Blutspuren: { a, b, until, next }

const showStance = () => {
  player.resLabel = `${S().name} · ${Math.floor(bar)}${stance === 1 && bar >= K.bar.max ? ' · F: Zweihand' : ''}`;
  player.mana = bar;
  $('manaFill').style.background = stance === 1 ? 'linear-gradient(#c8ccd6, #6a7080)' : 'linear-gradient(#d8343c, #7a1016)';
};
// Leiste: Schaden ausgeteilt (in Einheiten) und erlitten (in Prozent der Leben)
const fillBar = v => { if (bar <= 0 && v > 0) lastKill = state.now; bar = Math.min(K.bar.max, bar + v); };   // die 10 s ohne Kill zählen ab dem ersten Punkt
function setStance(n) {
  stance = n;
  stanceAt = state.now;
  mage.hero.setStance(K.stance[n].model);
  showStance();
}
// Taste F: mit voller Leiste in Zweihand
function pressStance() {
  if (!on() || player.dead) return;
  if (stance !== 1) return;
  if (bar < K.bar.max) return showError('Haltung: Leiste noch nicht voll');
  setStance(2);
  mage.hero.fx.ring(player.pos, mage.hero.fx.RED, 2.5, 0.5);
}
state.stanceKey = pressStance;
// Erlittener Schaden (player.ts damagePlayer) füllt die Leiste
export function klingeHurt(pct) { if (on()) fillBar(pct * 100 * K.bar.perPctTaken); }

// Nach dem Zurücksetzen von Leben und Mana im Run-Start, nach resetRealMen
export function resetKlinge() {
  player.resLabel = undefined;
  useKlingeBinds(on() || mage.skin === 'krieger');
  clearClones();
  if (!on()) return;
  player.rageMax = K.bar.max; player.mana = 0;     // Keine Ressource: Balken zeigt die Haltungs-Leiste
  stance = 1; bar = 0; lastKill = -1e9; act = null; swapBonus = false; attackUntil = 0; attackCtx = null; stormUntil = 0; player.parryUntil = 0; player.smokeUntil = 0;
  resetChain();
  bleeding.clear();
  trails = [];
  clearMelee();
  clearClones();
  mage.hero.setStance(1, true);
  showStance();
}

// Prüft Abklingzeit und startet sie. Jeder Move bricht das Essen ab.
function ready(id, grounded = true) {
  if (grounded && !player.grounded) { showError('Du kannst das nicht im Sprung tun'); return false; }
  if (cdEnd(id) > state.now) { showError('Fähigkeit ist noch nicht bereit'); return false; }
  stopDrink();
  startCd(id);
  player.lastCombat = state.now;
  return true;
}
const rateOf = id => S().rate * (stat(id).tempo ?? 1) * pdRateMul();   // Perfekter Dodge
function startAct(id, ability, ms, rate = rateOf(id)) {
  attackUntil = 0;
  resetChain();                                    // jeder andere Move bricht die Q-Kette ab
  act = { id, ability, start: state.now, ms: ms / rate, rate, ctx: makeCtx(id, S().dmg, S().range), from: { x: player.pos.x, y: player.pos.y, z: player.pos.z } };
  seq++;
  return act;
}

function pressQ() {
  if (act) return;
  if (state.now < attackUntil) { chain.buffered = true; return; }
  stopDrink();
  if (state.now > chain.until) chain.step = 0;
  const n = chain.step, len = K.q.chain[Math.min(stance, 2)].length;
  attackRate = rateOf('kQ');
  attackUntil = state.now + TIMING.qChain[Math.min(stance, 2)][n] / attackRate;
  attackCtx = makeCtx('kQ', S().dmg, S().range);
  Object.assign(attackCtx, { step: n, stance: Math.min(stance, 2), combo: consumeCombo('klingeQ') });   // Dodge-Kombo: +100 % und ein Blutungs-Stapel, für den ganzen Schlag
  chain.step = (n + 1) % len;
  chain.until = chain.step ? attackUntil + K.q.windowMs : 0;
  chain.buffered = false; sheatheUntil = 0;
  player.lastCombat = state.now;
  seq++;
}
// Fenster abgelaufen: Kette auf Schlag 1. Einhand nach Schlag 1 oder 2 steckt die Klinge kurz weg, ohne Treffer.
function updateChain() {
  if (!chain.step || state.now < attackUntil || state.now <= chain.until) return;
  const out = stance === 1;
  resetChain();
  if (out) { sheatheUntil = state.now + TIMING.sheathe / rateOf('kQ'); seq++; }
}
function pressE() {
  if (!act && ready('kE')) startAct('kE', 'e', TIMING.e);
}
function pressDash() {
  if (act || !ready('kDash')) return;
  // Flicker: springt zum nächsten Ziel in 10 yd
  const target = mods.flicker ? mobsInRadius(player.pos, K.flicker.range, Infinity).sort((a, b) => dist2d(a.pos, player.pos) - dist2d(b.pos, player.pos))[0] : null;
  if (target) player.facing = Math.atan2(target.pos.x - player.pos.x, target.pos.z - player.pos.z);
  const a = startAct('kDash', 'dash', TIMING.dash.ms);
  a.yd = target ? Math.max(1, dist2d(target.pos, player.pos) + 0.5) : K.dash.yd[Math.min(stance, 2)];
  a.flicker = !!target;
}
function pressWirbel() {
  if (act || !ready('kR')) return;
  const dur = TIMING.wirbel + (hasRune('kR', 'long') ? K.runes.longMs : 0);
  Object.assign(startAct('kR', 'wirbel', dur), { caught: [], dur });
}
function pressAder() {
  if (!act && ready('kAder')) startAct('kAder', 'ader', TIMING.ader);
}

function pressEat() {
  if (act || state.now < attackUntil) return;
  resetChain();
  if (!player.grounded) return showError('Du kannst das nicht im Sprung tun');
  player.drink = { start: state.now, end: state.now + K.eat.ms, dur: K.eat.ms, hp: 1, label: 'Essen', keepOnHit: true };
}
// Fester Slot: Es gibt aktive Relikte, aber keins für Nahkämpfer. Klone zählen nicht für die Abklingzeit-Kürzung.
function pressClones() {
  if (!ready('kClones', false)) return;
  clearClones();
  clones = Array.from({ length: 2 + mods.shadowPact }, () => cloneKlinge(mage.hero));   // Schattenpakt: +1 Klon pro Rang
  for (const c of clones) scene.add(c.root);
  clonesUntil = state.now + K.clones.ms;
  updateKlingeVisuals();
  for (const c of clones) mage.hero.fx.ring(c.root.position, mage.hero.fx.LIGHT, 1.5, 0.4);
}
function clearClones() {
  for (const c of clones) { scene.remove(c.root); c.dispose(); }
  clones = [];
}
// Klone laufen mit, links und rechts vom Spieler. Nach mage.update: sie kopieren dessen Pose.
export function updateKlingeVisuals() {
  if (!clones.length) return;
  const f = player.facing, sx = Math.cos(f) * K.clones.side, sz = -Math.sin(f) * K.clones.side;
  clones.forEach((c, i) => {
    const d = (i % 2 ? -1 : 1) * (1 + Math.floor(i / 2)), x = player.pos.x + sx * d, z = player.pos.z + sz * d;
    c.sync();
    c.root.position.set(x, groundAt(x, z, player.pos.y), z);
  });
}
// Woher ein Treffer-Ereignis schlägt: Spieler und Klone, jeweils von der eigenen Position
function origins() {
  const list = [{ x: player.pos.x, y: player.pos.y, z: player.pos.z, ox: 0, oz: 0, mul: 1, self: true }];
  if (!clones.length) return list;
  const f = player.facing, sx = Math.cos(f) * K.clones.side, sz = -Math.sin(f) * K.clones.side;
  for (let i = 0; i < clones.length; i++) { const d = (i % 2 ? -1 : 1) * (1 + Math.floor(i / 2)); list.push({ x: list[0].x + sx * d, y: list[0].y, z: list[0].z + sz * d, ox: sx * d, oz: sz * d, mul: K.clones.dmg, self: false }); }
  return list;
}


// ---------- Haltung: Verfall und Stufe 3 ----------
function updateStance(dt) {
  if (state.now - lastKill > K.bar.idleMs) bar = Math.max(0, bar - K.bar.drainPerS * dt / 1000);
  if (stance !== 1 && bar <= 0) setStance(1);
  else if (stance === 2 && state.now - stanceAt >= K.bar.toThreeMs) setStance(3);
  showStance();
}

// ---------- Neu v31 ----------
let stormUntil = 0, stormCtx = null, nextStorm = 0;
function pressStorm() {
  if (!ready('kStorm', false)) return;
  stormUntil = state.now + K.storm.ms;
  stormCtx = makeCtx('kStorm', S().dmg, S().range);
  nextStorm = state.now;
  stormLook(K.storm.blades, bladePos, () => stormUntil > state.now, () => stance);
}
const bladePos = i => { const a = state.now / 300 + i / K.storm.blades * Math.PI * 2; return { x: player.pos.x + Math.sin(a) * K.storm.radius, y: player.pos.y, z: player.pos.z + Math.cos(a) * K.storm.radius }; };
function updateStorm() {
  if (stormUntil <= state.now) return;
  if (state.now < nextStorm) return;
  nextStorm += K.storm.tickMs;
  strike('kStorm', stormCtx, K.storm.dmg * UNIT, o => mobsInRadius(o, stormCtx.radius(K.storm.radius)));
}
// Aderlass: jede Klinge explodiert, der Sturm ist danach vorbei
function detonateStorm(c) {
  for (let i = 0; i < K.storm.blades; i++) {
    const p = bladePos(i);
    strike('kStorm', c, K.storm.boom.dmg * UNIT, o => o.self ? mobsInRadius(p, K.storm.boom.radius) : []);
    stormBoom(p, K.storm.boom.radius);
  }
  stormUntil = 0;
}
function pressKunai() {
  if (!ready('kKunai', false)) return;
  const c = makeCtx('kKunai', S().dmg, S().range), Kn = K.kunai;
  for (let i = 0; i < Kn.n; i++) {
    const yaw = player.facing + (i / (Kn.n - 1) - 0.5) * Kn.spread;
    const to = { x: player.pos.x + Math.sin(yaw) * Kn.len, z: player.pos.z + Math.cos(yaw) * Kn.len };
    const first = mobsOnLine(player.pos, to, Kn.width).sort((a, b) => dist2d(a.pos, player.pos) - dist2d(b.pos, player.pos))[0];
    kunaiLook(first ? first.pos : to);
    if (first) strike('kKunai', c, Kn.dmg * UNIT, o => o.self ? [first] : []);
  }
}
function pressCounter() {
  if (act || !ready('kCounter')) return;
  player.parryUntil = state.now + K.counter.ms;
  parryLook(() => player.parryUntil > state.now);
  const c = makeCtx('kCounter', S().dmg, S().range);
  // Treffer in der Parade (player.ts damagePlayer): kein Schaden, Gegenschlag im Kegel
  player.onParry = () => {
    player.parryUntil = 0;
    strike('kCounter', c, K.counter.dmg * UNIT, o => mobsInRadius(o, c.radius(K.counter.radius)).filter(m => Math.abs(angleTo(m, o)) <= K.counter.angle / 2));
    counterLook(c.radius(K.counter.radius), stance);
    combatText(player.pos, 'Konter', 'info', 2.6);
  };
}
function pressIaido() {
  if (act || !ready('kIaido')) return;
  const c = makeCtx('kIaido', S().dmg, S().range), I = K.iaido;
  after(I.drawMs / pdRateMul(), () => {
    if (!on() || player.dead) return;
    const f = forward(), len = c.radius(I.len);
    strike('kIaido', c, I.dmg * UNIT, o => mobsOnLine(o, { x: o.x + f.x * len, z: o.z + f.z * len }, I.width));
    const V = mage.hero.root.position.constructor;
    iaidoLook(new V(player.pos.x, player.pos.y + 1.1, player.pos.z), new V(player.pos.x + f.x * len, player.pos.y + 1.1, player.pos.z + f.z * len));
  });
}
function pressSmoke() {
  if (!ready('kSmoke', false)) return;
  player.smokeUntil = state.now + K.smoke.ms;
  for (const m of state.mobs) if (!m.dead && m.state === 'combat' && !m.boss) { m.state = 'idle'; m.assistAt = 0; }   // verlieren das Ziel
  mage.hero.fx.ring(player.pos, 0x606060, 4, 0.6);
  smokeLook(K.smoke.ms);
}

// Einhand: jedes Treffer-Ereignis kürzt alle Abklingzeiten, nur das Relikt nicht
function reduceCds(ms) {
  for (const id in player.cds) if (id !== 'kClones') player.cds[id] -= ms;
  for (const id in player.charges) if (id !== 'kClones') player.charges[id] = player.charges[id].map(t => t - ms);
}

// Ein Treffer-Ereignis: gibt die Zahl der Treffer zurück. Der Haltungs-Schaden steckt im Kontext.
function strike(id, ctx, amount, targets, onMob?) {
  const mul = swapMul();
  let landed = 0;
  player.smokeUntil = 0;                           // Rauchbombe endet mit dem Angriff
  for (const o of origins()) for (const m of targets(o)) {
    const dmg = amount * mul * o.mul;
    if (!ctx.hit(m, dmg)) continue;
    landed++;
    fillBar(dmg * S().dmg / UNIT * K.bar.perUnit);
    if (m.dead) lastKill = state.now;
    if (S().bleed) addBleed(m, dmg * stat(id).dmg * S().dmg * damageMult(id));
    onMob?.(m);
    mage.hero.fx.blood({ x: m.pos.x, y: m.pos.y + 1.1, z: m.pos.z }, 6);
  }
  if (landed) {
    swapBonus = false;
    if (S().cdOnHit) reduceCds(S().cdOnHit);
  }
  return landed;
}

// Mit den Supports Echo und Großes Echo: dieselbe Wirkung später noch einmal
function event(id, ctx, amount, targets, onMob?) {
  const n = strike(id, ctx, amount, targets, onMob);
  const E = K.echo;
  if (supported('bigEcho', id)) E.bigMs.forEach((ms, i) => after(ms, () => strike(id, ctx, amount * E.bigMul[i], targets, onMob)));
  else if (supported('echo', id)) after(E.ms, () => strike(id, ctx, amount * E.mul, targets, onMob));
  return n;
}

const angleTo = (m, o) => Math.atan2(Math.sin(Math.atan2(m.pos.x - o.x, m.pos.z - o.z) - player.facing), Math.cos(Math.atan2(m.pos.x - o.x, m.pos.z - o.z) - player.facing));

// Ein Treffer-Ereignis des laufenden Kettenschlags. Runen gelten pro Schlag: Weiter Bogen weitet Kegel, Lange Klinge verlängert Kegel, Linie und Radius, Nachhall wiederholt.
function hitQ(i) {
  const c = attackCtx, h = K.q.chain[c.stance][c.step]?.hits[i], R = K.runes;
  if (!h) return;
  const reach = runeStage('kQ', 'reach') * R.reachYd;
  let targets;
  if (h.line) {
    const f = forward(), len = c.radius(h.line + reach);
    targets = o => mobsOnLine(o, { x: o.x + f.x * len, z: o.z + f.z * len }, h.width);
  } else {
    const cone = runeStage('kQ', 'cone'), angle = h.cone ? Math.max(h.cone, cone ? R.cone[Math.min(cone, R.cone.length) - 1] : 0) : 360;
    targets = o => mobsInRadius(o, c.radius(h.radius + reach)).filter(m => angle >= 360 || Math.abs(angleTo(m, o)) <= angle * Math.PI / 360);
  }
  const k = c.combo ? DG.combo.klingeQMul : 1, amount = h.dmg * k;
  const extra = (h.bleeds ?? 1) - 1;
  const onMob = m => {
    if (c.combo && c.stance === 1) addBleed(m, amount * stat('kQ').dmg);           // Zweihand blutet ohnehin
    for (let n = 0; n < extra && S().bleed; n++) addBleed(m, amount * stat('kQ').dmg * S().dmg * damageMult('kQ'));   // Wirbelsprung: zweiter Stapel
  };
  event('kQ', c, amount, targets, onMob);
  if (hasRune('kQ', 'echo')) after(R.echoMs, () => strike('kQ', c, amount * R.echoMul, targets));
}
function hitE() {
  const c = act.ctx;
  event('kE', c, K.e.dmg, o => mobsInRadius(o, c.radius(K.e.radius)), m => {
    if (hasRune('kE', 'freeze')) applyRoot(m, K.runes.freezeMs, 'ice'); else applySlow(m, K.e.slow, K.e.slowMs);
    if (hasRune('kE', 'pull')) pullMob(m, player.pos, K.runes.pullYd);
  });
}
function hitDash(i) {
  const c = act.ctx, a = act.from, b = { x: player.pos.x, y: player.pos.y, z: player.pos.z }, parts = stance === 2 ? 2 : 1, R = K.runes;
  const targets = o => mobsOnLine({ x: a.x + o.ox, z: a.z + o.oz }, { x: b.x + o.ox, z: b.z + o.oz }, K.dash.width);
  let killed = false;
  const onMob = m => { killed ||= m.dead; };
  event('kDash', c, K.dash.dmg / parts, targets, onMob);
  if (killed && (hasRune('kDash', 'reset') || act.flicker)) {   // Flicker: ein Kill gibt die Ladung zurück
    const ch = player.charges.kDash;
    ch[ch.indexOf(Math.max(...ch))] = 0;
  }
  if (i !== parts - 1) return;                      // Der Rest gilt einmal pro Sprint
  if (hasRune('kDash', 'trail') && stance === 2) {
    trails.push({ a, b, until: state.now + R.trailMs, next: state.now + R.trailTickMs });
    const V = mage.hero.root.position.constructor;
    mage.hero.fx.streak(new V(a.x, a.y, a.z), new V(b.x, b.y, b.z), mage.hero.fx.RED, 0.3, R.trailMs / 1000, 0.1);
  }
  if (hasRune('kDash', 'back')) after(R.backMs, () => {
    player.pos.set(a.x, a.y, a.z);
    strike('kDash', c, K.dash.dmg / parts, targets);
  });
}
function pullWirbel() {
  const c = act.ctx;
  for (const m of mobsInRadius(player.pos, c.radius(K.wirbel.radius))) {
    if (m.leap || m.state === 'evade') continue;
    m.orbit = { a0: Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z), r0: Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z), at: state.now };
    act.caught.push(m);
  }
}
// Der Spieler trifft, was im Griff ist; Klone ziehen nicht und treffen, was um sie steht
const wirbelTargets = a => o => o.self ? a.caught.filter(m => !m.dead) : mobsInRadius(o, a.ctx.radius(K.wirbel.radius));
function tickWirbel() {
  const a = act;
  event('kR', a.ctx, K.wirbel.tick, wirbelTargets(a));
}
function endWirbel() {
  const a = act, W = K.wirbel;
  strike('kR', a.ctx, W.end, wirbelTargets(a));
  // Gerichteter Wurf: Mitte weit hinter dem Spieler, damit alle nach vorn fliegen
  const f = forward(), R = K.runes.throwBehind, from = hasRune('kR', 'direct') ? { x: player.pos.x - f.x * R, z: player.pos.z - f.z * R } : player.pos;
  for (const m of a.caught) { m.orbit = null; if (m.dead) continue; m.pos.y = groundAt(m.pos.x, m.pos.z, player.pos.y); knockbackMob(m, from, W.throwYd, W.throwMs); }
  a.caught = [];
}
// Mobs im Griff des Wirbels: Position setzen, sie laufen nach ihrer KI, darum nach updateMob
function updateWirbel() {
  if (act?.id !== 'kR') return;
  const W = K.wirbel, u = (state.now - act.start) / act.ms;
  const s = Math.max(0, Math.min(1, (u - TIMING.wirbelFrom) / (TIMING.wirbelTo - TIMING.wirbelFrom))), spin = wirbelSpin(s) * W.spinK;
  for (const m of act.caught) {
    if (m.dead) continue;
    const k = Math.min(1, (state.now - m.orbit.at) / W.pullMs), e = 1 - (1 - k) ** 3;
    const r = m.orbit.r0 + (W.orbit - m.orbit.r0) * e, ang = m.orbit.a0 + spin;
    m.pos.x = player.pos.x + Math.sin(ang) * r;
    m.pos.z = player.pos.z + Math.cos(ang) * r;
    m.pos.y = groundAt(m.pos.x, m.pos.z, player.pos.y) + W.lift * e;
    m.moving = false;
  }
}
// Aderlass trifft ohne Wurf: die Blutung sitzt schon. Kein Haltungs-Schaden, der steckt schon in den Stapeln.
function hitAder() {
  const c = act.ctx, A = K.ader;
  if (stormUntil > state.now) detonateStorm(c);
  const list = mobsInRadius(player.pos, c.radius(A.radius), Infinity).filter(m => m.bleeds?.length);
  if (!list.length) return;
  lastKill = state.now;   // Aderlass hält die Leiste
  // Die Stapel gibt es nur einmal: Klone zünden nicht selbst, sie geben je 50 % dazu
  const mul = swapMul() * A.mul * stat('kAder').dmg * damageMult('kAder') * (1 + clones.length * K.clones.dmg);
  for (const m of list) {
    const rest = m.bleeds.reduce((sum, b) => sum + b.tick * b.left, 0), stacks = m.bleeds, hpBefore = m.hp, R = K.runes;
    m.bleeds = [];
    showBleed(m);
    damageMob(m, rest * mul, 'kAder', c.castKey, true);
    if (hasRune('kAder', 'heal')) player.hp = Math.min(maxHp(), player.hp + (hpBefore - m.hp) * R.heal);
    if (hasRune('kAder', 'killCd') && m.dead && player.cds.kR) player.cds.kR -= R.killCdMs;
    if (hasRune('kAder', 'jump')) {
      const near = mobsInRadius(m.pos, R.jumpYd, Infinity).filter(o => o !== m && !list.includes(o)).sort((p, q) => dist2d(p.pos, m.pos) - dist2d(q.pos, m.pos))[0];
      if (near) { near.bleeds = [...(near.bleeds ?? []), ...stacks].slice(-K.bleed.max); bleeding.add(near); }
    }
    mage.hero.fx.blood({ x: m.pos.x, y: m.pos.y + 1.2, z: m.pos.z }, 30, 5);
    mage.hero.fx.ring(m.pos, mage.hero.fx.RED, 2.2, 0.5);
  }
  swapBonus = false;
  if (S().cdOnHit) reduceCds(S().cdOnHit);
}

onWarriorHit((kind, x, z, i) => {
  if (!on() || player.dead) return;
  if (kind === 'q' && attackCtx) hitQ(i);
  else if (!act) return;
  else if (kind === 'e') hitE();
  else if (kind === 'dash') hitDash(i);
  else if (kind === 'wirbelPull') pullWirbel();
  else if (kind === 'wirbelTick') tickWirbel();
  else if (kind === 'wirbelEnd') endWirbel();
  else if (kind === 'ader') hitAder();
});

// Blutung: jeder Treffer ein eigener Stapel, der 8. ersetzt den ältesten. raw ist der Schaden vor den Spielerfaktoren, damit damageMob sie nur einmal rechnet.
function addBleed(m, raw) {
  const B = K.bleed, ticks = Math.round(B.ms / B.tickMs);
  m.bleeds ??= [];
  m.bleeds.push({ tick: raw * B.share * (1 + K.deepWounds * mods.deepWounds) / ticks, left: ticks, next: state.now + B.tickMs });   // Tiefe Wunden
  if (m.bleeds.length > B.max) m.bleeds.shift();
  bleeding.add(m);
}
function updateBleeds() {
  for (const m of bleeding) {
    let sum = 0;
    if (!m.dead) for (const b of m.bleeds) while (b.left > 0 && b.next <= state.now) { sum += b.tick; b.left--; b.next += K.bleed.tickMs; }
    if (sum) damageMob(m, sum, 'kBleed', 'env', true);   // wie die Feuer-Spur: kein Treffer- und Crit-Wurf
    m.bleeds = m.bleeds.filter(b => b.left > 0);
    if (m.dead) m.bleeds = [];
    showBleed(m);
    if (!m.bleeds.length) bleeding.delete(m);
  }
}
// Kleine Zahl im Nameplate, nur wenn sie sich ändert
function showBleed(m) {
  const n = m.bleeds.length;
  if (m.bleedShown === n) return;
  m.bleedShown = n;
  m.plateBleed ??= m.plate.appendChild(Object.assign(document.createElement('b'), { className: 'plateBleed' }));
  m.plateBleed.textContent = n ? ` ▼${n}` : '';
  m.plateBleed.style.color = '#ff4048';
}

// Blutspur: pro Tick ein Stapel für alle auf der Linie
function updateTrails() {
  const R = K.runes;
  trails = trails.filter(t => state.now < t.until);
  for (const t of trails) {
    if (state.now < t.next) continue;
    t.next += R.trailTickMs;
    for (const m of mobsOnLine(t.a, t.b, K.dash.width)) addBleed(m, R.trailRaw * stat('kDash').dmg);
  }
}
// Rune Jäger: Der Wirbel zieht zum Mauszeiger, mit dem Wirbel-Tempo
function followMouse(dt) {
  pickGround();
  const dx = mouse.ground.x - player.pos.x, dz = mouse.ground.z - player.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.5) return;
  const step = Math.min(d, CFG.runSpeed * klingeMoveMul() * dt / 1000), y0 = player.pos.y;
  player.pos.x += dx / d * step; player.pos.z += dz / d * step;
  resolve(player.pos, 0.45);
  player.pos.y = groundAt(player.pos.x, player.pos.z, y0);
}

export function updateKlinge(dt) {
  if (!on() || player.dead) return;
  updateMelee();
  updateStance(dt);
  updateStorm();
  updateBleeds();
  if (clones.length && state.now >= clonesUntil) clearClones();
  updateTrails();
  if (act) {
    if (act.id === 'kDash') moveInWindow({ ...TIMING.dash.move, yd: act.yd }, act.start, act.ms, dt);
    if (act.id === 'kR' && hasRune('kR', 'follow')) followMouse(dt);
    updateWirbel();
    if (state.now >= act.start + act.ms) act = null;
  }
  updateChain();
  if (!act && player.stunUntil <= state.now && (held('kQ') || chain.buffered) && state.now >= attackUntil) pressQ();
}

const dashWindow = [TIMING.dash.move.from, TIMING.dash.move.to];
// Charakterfenster (ui/charInfo.ts)
export const klingeInfo = () => ({ stance, name: S().name, bar, inStanceMs: state.now - stanceAt, K });
export const klingeUntouchable = () => on() && act?.id === 'kDash' && inWindow(dashWindow, act.start, act.ms);
export const klingeMoveMul = () => !on() ? 1 : S().move * (act?.id === 'kR' ? K.wirbel.moveMul : 1);
export const klingeHidden = () => on() && player.smokeUntil > state.now;
// Eigene Bewegung oder keine; im Wirbel geht er langsam weiter. Die Abschluss-Schläge der Q-Kette (Stoß, Wirbelsprung) stehen.
export const klingeRooted = () => on() && (!!act && act.id !== 'kR' || state.now < attackUntil && !!K.q.chain[attackCtx?.stance]?.[attackCtx.step]?.rooted);

export function klingeAnim() {
  if (!on() || player.dead) return {};
  const attack = state.now < attackUntil ? 'q' : state.now < sheatheUntil ? 'sheathe' : null;
  return { ability: act?.ability ?? null, attack: act ? null : attack, step: attackCtx?.step ?? 0, hold: chain.step > 0 && state.now <= chain.until,
    seq, rate: act?.rate ?? attackRate, dur: act?.dur, h3: stance === 3, smoke: player.smokeUntil > state.now, frozen: !!((state.paused || hitstopActive()) && (act || attack)) };
}

// Für den Handtest
(window as any).__klinge = { get stance() { return stance; }, get act() { return act; }, chain, get attackUntil() { return attackUntil; }, get sheatheUntil() { return sheatheUntil; }, addBleed, bleeding, get swapBonus() { return swapBonus; }, get clones() { return clones.length; }, KLINGE };
