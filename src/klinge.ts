// Klingenstrich: Nahkämpfer ohne Ressource, nur Abklingzeiten. Zwei Haltungen, 8 Slots. Die Moves liegen als Spells in den Slots wie bei Real Men,
// damit Leiste, Tasten, Pad und Karten mitlaufen. Modell und Treffer-Momente kommen aus models/klingeModel.ts.

import { state, player } from './state';
import { $, dist2d } from './util';
import { SPELLS, CFG } from './config';
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

// Alle Zahlen hier. Alles // PH
export const KLINGE = {
  stance: {
    1: { name: 'Einhand · Iai', move: 1.25, rate: 1.3, range: 1.4, dmg: 1, cdOnHit: 500, bleed: false },     // PH
    2: { name: 'Zweihand · Nitō', move: 1, rate: 1, range: 1, dmg: 2.5, cdOnHit: 0, bleed: true },           // PH
  },
  swap: { cd: 1000, bonus: 0.3 },                                                                            // PH
  bleed: { share: 0.33, ms: 5000, tickMs: 1000, max: 7 },                                                    // PH: 33 % des Treffers über 5 s, 7 Stapel pro Mob
  q: { angle: 120, radius: 3, dmg: 30 },                                                                     // PH: Zweihand teilt den Schaden auf 2 Schnitte
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

// Slots in Tastenreihenfolge: Q, E, R, Maus 4, Maus 5, 1, 2, 3
const move = (name, desc, tags, cd, press, extra = {}) => ({ name, desc, ranks: [], tags: ['Klinge', ...tags], cls: 'fire', school: 'warrior', fixed: true, cd, mana: 0, press, ...extra });
Object.assign(SPELLS, {
  kQ: move('Schnitt', 'Kegel vor dir, solange gehalten.', ['Nahkampf', 'Fläche', 'Schnitt'], 0, () => pressQ(), { showDmg: K.q.dmg }),
  kE: move('Kreisschnitt', 'Drehung um dich, verlangsamt 40 % für 3 s.', ['Nahkampf', 'Fläche', 'Kontrolle'], K.e.cd, () => pressE(), { showDmg: K.e.dmg }),
  kR: move('Blutwirbel', 'Zieht Mobs an, sie kreisen um dich, am Ende fliegen sie weg. Du gehst mit 50 % Tempo.', ['Nahkampf', 'Fläche', 'Kontrolle'], K.wirbel.cd, () => pressWirbel(), { showDmg: K.wirbel.tick }),
  kAder: move('Aderlass', 'Alle blutenden Mobs in 15 yd nehmen sofort ihre restliche Blutung ×1,5.', ['Blutung', 'Fläche'], K.ader.cd, () => pressAder()),
  kClones: move('Schattenklone', 'Zwei Klone neben dir machen 8 s jeden Move mit, 50 % Schaden.', [], K.clones.cd, () => pressClones()),
  kSwap: move('Haltung', 'Wechselt zwischen Einhand und Zweihand. Der erste Treffer danach macht +30 %.', [], K.swap.cd, () => pressSwap()),
  kDash: move('Strichschnitt', 'Sprint, dabei nicht angreifbar. Danach trifft es alles auf der Linie.', ['Nahkampf', 'Bewegung', 'Linie'], K.dash.cd, () => pressDash(), { showDmg: K.dash.dmg, charges: K.dash.charges }),
  kEat: move('Essen', 'Sitzen und in 18 s alles Leben auffüllen. Bewegung oder Angriff bricht ab, Schaden nicht.', [], 0, () => pressEat()),
});
// Wie bei Real Men gilt pro Move eine Rune. stages: mehrere Stufen derselben Rune (Karte zählt in state.cardPicks).
const ranks = (ids, list) => { for (const id of ids) SPELLS[id].ranks = list; };
ranks(['kQ', 'kE', 'kR', 'kDash'], ['dmg', 'radius', 'tempo']);
ranks(['kAder'], ['dmg', 'radius']);
SPELLS.kQ.runes = [
  { id: 'cone', name: 'Weiter Bogen', desc: 'Kegel 180°, zweite Stufe 360°.', stages: 2 },
  { id: 'echo', name: 'Nachhall', desc: 'Zweiter Schnitt nach 0,3 s mit 50 %.' },
  { id: 'reach', name: 'Lange Klinge', desc: '+1 yd Radius pro Stufe.', stages: 3 },
];
SPELLS.kE.runes = [
  { id: 'freeze', name: 'Eisschnitt', desc: 'Friert 1 s ein statt zu verlangsamen.' },
  { id: 'pull', name: 'Sog', desc: 'Zieht Mobs 2 yd zu dir.' },
  { id: 'charges', name: 'Doppelte Drehung', desc: '2 Ladungen.', charges: 2 },
];
SPELLS.kDash.runes = [
  { id: 'reset', name: 'Nachsetzen', desc: 'Ein Kill setzt eine Ladung zurück.' },
  { id: 'trail', name: 'Blutspur', desc: 'Zweihand: Wer über die Linie läuft, blutet.' },
  { id: 'back', name: 'Rückstrich', desc: 'Zurück zum Start, schneidet erneut.' },
];
SPELLS.kR.runes = [
  { id: 'follow', name: 'Jäger', desc: 'Folgt der Maus.' },
  { id: 'direct', name: 'Gerichteter Wurf', desc: 'Wirft alle nach vorn statt rundum.' },
  { id: 'long', name: 'Langer Wirbel', desc: '+1 s Dauer.' },
];
SPELLS.kAder.runes = [
  { id: 'jump', name: 'Übersprung', desc: 'Gezündete Stapel springen auf 1 Mob in 5 yd über.' },
  { id: 'killCd', name: 'Blutzoll', desc: 'Kill durch Aderlass: −3 s Blutwirbel-Abklingzeit.' },
  { id: 'heal', name: 'Lebenssaft', desc: 'Heilt 10 % des Schadens.' },
];
SPELLS.kSwap.runes = [
  { id: 'mini', name: 'Wechselschnitt', desc: 'Der Wechsel macht einen kleinen Kreisschnitt.' },
  { id: 'bonus', name: 'Überraschung', desc: 'Wechsel-Bonus +60 % statt +30 %.' },
  { id: 'nocd', name: 'Fließender Wechsel', desc: 'Wechsel ohne Abklingzeit.', cdMul: 0 },
];

// Nicht in Object.keys: keine Karte, nur Farbe für Funken und Schadenszahlen
Object.defineProperty(SPELLS, 'kBleed', { value: { name: 'Blutung', cls: 'fire', school: 'warrior', tags: [] }, enumerable: false });

const on = () => mage.skin === 'klinge';
const S = () => K.stance[stance];
const swapMul = () => swapBonus ? 1 + (hasRune('kSwap', 'bonus') ? K.runes.bonus : K.swap.bonus) : 1;
const runeStage = (id, r) => hasRune(id, r) ? state.cardPicks[`rune-${id}-${r}`] || 1 : 0;

let stance = 1;
let act = null;                 // laufender Move: { id, ability, start, ms, rate, ctx }
let seq = 0;                    // zählt jeden Start, damit das Modell zweimal denselben Move erkennt
let swapBonus = false;
let attackUntil = 0, attackCtx = null, attackRate = 1;   // Q läuft den Schnitt immer zu Ende, Halten startet den nächsten
const bleeding = new Set<any>();
let clones = [], clonesUntil = 0;
let trails = [];                // Blutspuren: { a, b, until, next }

const showStance = () => {
  player.resLabel = S().name;
  $('manaFill').style.background = stance === 1 ? 'linear-gradient(#c8ccd6, #6a7080)' : 'linear-gradient(#d8343c, #7a1016)';
};

// Nach dem Zurücksetzen von Leben und Mana im Run-Start, nach resetRealMen
export function resetKlinge() {
  player.resLabel = undefined;
  useKlingeBinds(on() || mage.skin === 'krieger');
  clearClones();
  if (!on()) return;
  player.rageMax = 1; player.mana = 1;             // Keine Ressource: Balken zeigt die Haltung
  stance = 1; act = null; swapBonus = false; attackUntil = 0; attackCtx = null;
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
const rateOf = id => S().rate * (stat(id).tempo ?? 1);
function startAct(id, ability, ms, rate = rateOf(id)) {
  attackUntil = 0;
  act = { id, ability, start: state.now, ms: ms / rate, rate, ctx: makeCtx(id, S().dmg, S().range), from: { x: player.pos.x, y: player.pos.y, z: player.pos.z } };
  seq++;
  return act;
}

function pressQ() {
  if (act || state.now < attackUntil) return;
  stopDrink();
  attackRate = rateOf('kQ');
  attackUntil = state.now + TIMING.qChain[stance][0] / attackRate;   // Kette folgt im nächsten Schritt
  attackCtx = makeCtx('kQ', S().dmg, S().range);
  attackCtx.combo = consumeCombo('klingeQ');            // Dodge-Kombo: +100 % und ein Blutungs-Stapel
  player.lastCombat = state.now;
  seq++;
}
function pressE() {
  if (!act && ready('kE')) startAct('kE', 'e', TIMING.e);
}
function pressDash() {
  if (act || !ready('kDash')) return;
  startAct('kDash', 'dash', TIMING.dash.ms).yd = K.dash.yd[stance];
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
  if (!player.grounded) return showError('Du kannst das nicht im Sprung tun');
  player.drink = { start: state.now, end: state.now + K.eat.ms, dur: K.eat.ms, hp: 1, label: 'Essen', keepOnHit: true };
}
// Fester Slot: Es gibt aktive Relikte, aber keins für Nahkämpfer. Klone zählen nicht für die Abklingzeit-Kürzung.
function pressClones() {
  if (!ready('kClones', false)) return;
  clearClones();
  clones = [cloneKlinge(mage.hero), cloneKlinge(mage.hero)];
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
    const d = i ? -1 : 1, x = player.pos.x + sx * d, z = player.pos.z + sz * d;
    c.sync();
    c.root.position.set(x, groundAt(x, z, player.pos.y), z);
  });
}
// Woher ein Treffer-Ereignis schlägt: Spieler und Klone, jeweils von der eigenen Position
function origins() {
  const list = [{ x: player.pos.x, y: player.pos.y, z: player.pos.z, ox: 0, oz: 0, mul: 1, self: true }];
  if (!clones.length) return list;
  const f = player.facing, sx = Math.cos(f) * K.clones.side, sz = -Math.sin(f) * K.clones.side;
  for (const d of [1, -1]) list.push({ x: list[0].x + sx * d, y: list[0].y, z: list[0].z + sz * d, ox: sx * d, oz: sz * d, mul: K.clones.dmg, self: false });
  return list;
}

function pressSwap() {
  if (act || !ready('kSwap')) return;
  stance = stance === 1 ? 2 : 1;
  mage.hero.setStance(stance);
  swapBonus = true;
  startAct('kSwap', 'swap', TIMING.swap, 1);       // Wechsel dauert immer gleich lang
  showStance();
}

// Einhand: jedes Treffer-Ereignis kürzt alle Abklingzeiten, nur das Relikt nicht
function reduceCds(ms) {
  for (const id in player.cds) if (id !== 'kClones') player.cds[id] -= ms;
  for (const id in player.charges) if (id !== 'kClones') player.charges[id] = player.charges[id].map(t => t - ms);
}

// Ein Treffer-Ereignis: gibt die Zahl der Treffer zurück. Der Haltungs-Schaden steckt im Kontext.
export function strike(id, ctx, amount, targets, onMob?) {
  const mul = swapMul();
  let landed = 0;
  for (const o of origins()) for (const m of targets(o)) {
    const dmg = amount * mul * o.mul;
    if (!ctx.hit(m, dmg)) continue;
    landed++;
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

function hitQ() {
  const c = attackCtx, parts = stance === 2 ? 2 : 1, R = K.runes;
  const cone = runeStage('kQ', 'cone'), angle = cone ? R.cone[Math.min(cone, R.cone.length) - 1] : K.q.angle;
  const radius = K.q.radius + runeStage('kQ', 'reach') * R.reachYd;
  const targets = o => mobsInRadius(o, c.radius(radius)).filter(m => Math.abs(angleTo(m, o)) <= angle * Math.PI / 360);
  const k = c.combo ? DG.combo.klingeQMul : 1;
  event('kQ', c, K.q.dmg / parts * k, targets, c.combo && stance === 1 ? m => addBleed(m, K.q.dmg * k * stat('kQ').dmg) : undefined);   // Zweihand blutet ohnehin
  if (hasRune('kQ', 'echo')) after(R.echoMs, () => strike('kQ', c, K.q.dmg / parts * R.echoMul, targets));
}
function hitE() {
  const c = act.ctx;
  event('kE', c, K.e.dmg, o => mobsInRadius(o, c.radius(K.e.radius)), m => {
    if (hasRune('kE', 'freeze')) applyRoot(m, K.runes.freezeMs); else applySlow(m, K.e.slow, K.e.slowMs);
    if (hasRune('kE', 'pull')) pullMob(m, player.pos, K.runes.pullYd);
  });
}
function hitDash(i) {
  const c = act.ctx, a = act.from, b = { x: player.pos.x, y: player.pos.y, z: player.pos.z }, parts = stance === 2 ? 2 : 1, R = K.runes;
  const targets = o => mobsOnLine({ x: a.x + o.ox, z: a.z + o.oz }, { x: b.x + o.ox, z: b.z + o.oz }, K.dash.width);
  let killed = false;
  const onMob = m => { killed ||= m.dead; };
  event('kDash', c, K.dash.dmg / parts, targets, onMob);
  if (killed && hasRune('kDash', 'reset')) {
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
  const list = mobsInRadius(player.pos, c.radius(A.radius), Infinity).filter(m => m.bleeds?.length);
  if (!list.length) return;
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
  if (kind === 'q' && attackCtx) hitQ();
  else if (!act) return;
  else if (kind === 'e') hitE();
  else if (kind === 'dash') hitDash(i);
  else if (kind === 'wirbelPull') pullWirbel();
  else if (kind === 'wirbelTick') tickWirbel();
  else if (kind === 'wirbelEnd') endWirbel();
  else if (kind === 'ader') hitAder();
  else if (kind === 'swap' && hasRune('kSwap', 'mini')) strike('kSwap', act.ctx, K.runes.miniDmg, o => mobsInRadius(o, act.ctx.radius(K.runes.miniRadius)));
});

// Blutung: jeder Treffer ein eigener Stapel, der 8. ersetzt den ältesten. raw ist der Schaden vor den Spielerfaktoren, damit damageMob sie nur einmal rechnet.
export function addBleed(m, raw) {
  const B = K.bleed, ticks = Math.round(B.ms / B.tickMs);
  m.bleeds ??= [];
  m.bleeds.push({ tick: raw * B.share / ticks, left: ticks, next: state.now + B.tickMs });
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
  updateMelee(dt);
  updateBleeds();
  if (clones.length && state.now >= clonesUntil) clearClones();
  updateTrails();
  if (act) {
    if (act.id === 'kDash') moveInWindow({ ...TIMING.dash.move, yd: act.yd }, act.start, act.ms, dt);
    if (act.id === 'kR' && hasRune('kR', 'follow')) followMouse(dt);
    updateWirbel();
    if (state.now >= act.start + act.ms) act = null;
  }
  if (!act && player.stunUntil <= state.now && held('kQ')) pressQ();
}

const dashWindow = [TIMING.dash.move.from, TIMING.dash.move.to];
export const klingeUntouchable = () => on() && act?.id === 'kDash' && inWindow(dashWindow, act.start, act.ms);
export const klingeMoveMul = () => !on() ? 1 : S().move * (act?.id === 'kR' ? K.wirbel.moveMul : 1);
export const klingeRooted = () => on() && !!act && act.id !== 'kR';   // eigene Bewegung oder keine; im Wirbel geht er langsam weiter

export function klingeAnim() {
  if (!on() || player.dead) return {};
  const attack = state.now < attackUntil;
  return { ability: act?.ability ?? null, attack: attack ? 'q' : null, seq, rate: act?.rate ?? attackRate, dur: act?.dur, frozen: !!((state.paused || hitstopActive()) && (act || attack)) };
}

// Für den Handtest
(window as any).__klinge = { get stance() { return stance; }, get act() { return act; }, addBleed, bleeding, get swapBonus() { return swapBonus; }, get clones() { return clones.length; }, KLINGE };
