// Klingenstrich: Nahkämpfer ohne Ressource, nur Abklingzeiten. Zwei Haltungen, 8 Slots. Die Moves liegen als Spells in den Slots wie bei Real Men,
// damit Leiste, Tasten, Pad und Karten mitlaufen. Modell und Treffer-Momente kommen aus models/klingeModel.ts.

import { state, player } from './state';
import { $ } from './util';
import { SPELLS } from './config';
import { mage, onWarriorHit } from './models/mage';
import { KLINGE_TIMING as TIMING, wirbelSpin } from './models/klingeModel';
import { useKlingeBinds } from './input';
import { held } from './realMen';
import { groundAt } from './collision';
import { showError } from './ui/hud';
import { damageMob, knockbackMob } from './mobs';
import { makeCtx, stat, cdEnd, startCd, damageMult, stopDrink, mobsInRadius, applySlow, supported } from './spells/core';
import { after, updateMelee, clearMelee, moveInWindow, inWindow, mobsOnLine } from './melee';

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
  kClones: move('Schattenklone', '', [], 0, () => {}),
  kSwap: move('Haltung', 'Wechselt zwischen Einhand und Zweihand. Der erste Treffer danach macht +30 %.', [], K.swap.cd, () => pressSwap()),
  kDash: move('Strichschnitt', 'Sprint, dabei nicht angreifbar. Danach trifft es alles auf der Linie.', ['Nahkampf', 'Bewegung', 'Linie'], K.dash.cd, () => pressDash(), { showDmg: K.dash.dmg, charges: K.dash.charges }),
  kEat: move('Essen', '', [], 0, () => {}),
});
// Nicht in Object.keys: keine Karte, nur Farbe für Funken und Schadenszahlen
Object.defineProperty(SPELLS, 'kBleed', { value: { name: 'Blutung', cls: 'fire', school: 'warrior', tags: [] }, enumerable: false });

const on = () => mage.skin === 'klinge';
const S = () => K.stance[stance];

let stance = 1;
let act = null;                 // laufender Move: { id, ability, start, ms, rate, ctx }
let seq = 0;                    // zählt jeden Start, damit das Modell zweimal denselben Move erkennt
let swapBonus = false;
let attackUntil = 0, attackCtx = null, attackRate = 1;   // Q läuft den Schnitt immer zu Ende, Halten startet den nächsten
const bleeding = new Set<any>();

const showStance = () => {
  player.resLabel = S().name;
  $('manaFill').style.background = stance === 1 ? 'linear-gradient(#c8ccd6, #6a7080)' : 'linear-gradient(#d8343c, #7a1016)';
};

// Nach dem Zurücksetzen von Leben und Mana im Run-Start, nach resetRealMen und resetHeroes
export function resetKlinge() {
  player.resLabel = undefined;
  useKlingeBinds(on());
  if (!on()) return;
  player.rageMax = 1; player.mana = 1;             // Keine Ressource: Balken zeigt die Haltung
  stance = 1; act = null; swapBonus = false; attackUntil = 0; attackCtx = null;
  bleeding.clear();
  clearMelee();
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
  attackUntil = state.now + TIMING.q / attackRate;
  attackCtx = makeCtx('kQ', S().dmg, S().range);
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
  startAct('kR', 'wirbel', TIMING.wirbel).caught = [];
}
function pressAder() {
  if (!act && ready('kAder')) startAct('kAder', 'ader', TIMING.ader);
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
  const mul = swapBonus ? 1 + K.swap.bonus : 1;
  let landed = 0;
  for (const m of targets) {
    const dmg = amount * mul;
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
  const n = strike(id, ctx, amount, targets(), onMob);
  const E = K.echo;
  if (supported('bigEcho', id)) E.bigMs.forEach((ms, i) => after(ms, () => strike(id, ctx, amount * E.bigMul[i], targets(), onMob)));
  else if (supported('echo', id)) after(E.ms, () => strike(id, ctx, amount * E.mul, targets(), onMob));
  return n;
}

const angleTo = (m, o) => Math.atan2(Math.sin(Math.atan2(m.pos.x - o.x, m.pos.z - o.z) - player.facing), Math.cos(Math.atan2(m.pos.x - o.x, m.pos.z - o.z) - player.facing));

function hitQ(i) {
  const c = attackCtx, parts = stance === 2 ? 2 : 1;
  event('kQ', c, K.q.dmg / parts, () => mobsInRadius(player.pos, c.radius(K.q.radius)).filter(m => Math.abs(angleTo(m, player.pos)) <= K.q.angle * Math.PI / 360));
}
function hitE() {
  const c = act.ctx;
  event('kE', c, K.e.dmg, () => mobsInRadius(player.pos, c.radius(K.e.radius)), m => applySlow(m, K.e.slow, K.e.slowMs));
}
function hitDash(i) {
  const c = act.ctx, a = act.from, b = { x: player.pos.x, z: player.pos.z }, parts = stance === 2 ? 2 : 1;
  event('kDash', c, K.dash.dmg / parts, () => mobsOnLine(a, b, K.dash.width));
}
function pullWirbel() {
  const c = act.ctx;
  for (const m of mobsInRadius(player.pos, c.radius(K.wirbel.radius))) {
    if (m.leap || m.state === 'evade') continue;
    m.orbit = { a0: Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z), r0: Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z), at: state.now };
    act.caught.push(m);
  }
}
function tickWirbel() {
  event('kR', act.ctx, K.wirbel.tick, () => act.caught.filter(m => !m.dead));
}
function endWirbel() {
  const a = act, W = K.wirbel;
  strike('kR', a.ctx, W.end, a.caught.filter(m => !m.dead));
  for (const m of a.caught) { m.orbit = null; if (m.dead) continue; m.pos.y = groundAt(m.pos.x, m.pos.z, player.pos.y); knockbackMob(m, player.pos, W.throwYd, W.throwMs); }
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
  const mul = (swapBonus ? 1 + K.swap.bonus : 1) * A.mul * stat('kAder').dmg * damageMult('kAder');
  for (const m of list) {
    const rest = m.bleeds.reduce((sum, b) => sum + b.tick * b.left, 0);
    m.bleeds = [];
    showBleed(m);
    damageMob(m, rest * mul, 'kAder', c.castKey, true);
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

export function updateKlinge(dt) {
  if (!on() || player.dead) return;
  updateMelee(dt);
  updateBleeds();
  if (act) {
    if (act.id === 'kDash') moveInWindow({ ...TIMING.dash.move, yd: act.yd }, act.start, act.ms, dt);
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
  return { ability: act?.ability ?? null, attack: attack ? 'q' : null, seq, rate: act?.rate ?? attackRate, frozen: !!(state.paused && (act || attack)) };
}

// Für den Handtest
(window as any).__klinge = { get stance() { return stance; }, get act() { return act; }, addBleed, bleeding, get swapBonus() { return swapBonus; }, KLINGE };
