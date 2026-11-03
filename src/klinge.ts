// Klingenstrich: Nahkämpfer ohne Ressource, nur Abklingzeiten. Zwei Haltungen, 8 Slots. Die Moves liegen als Spells in den Slots wie bei Real Men,
// damit Leiste, Tasten, Pad und Karten mitlaufen. Modell und Treffer-Momente kommen aus models/klingeModel.ts.

import { state, player } from './state';
import { $ } from './util';
import { SPELLS } from './config';
import { mage, onWarriorHit } from './models/mage';
import { KLINGE_TIMING as TIMING } from './models/klingeModel';
import { useKlingeBinds } from './input';
import { showError } from './ui/hud';
import { damageMob } from './mobs';
import { makeCtx, stat, cdEnd, startCd, damageMult, stopDrink } from './spells/core';
import { after, updateMelee, clearMelee } from './melee';

// Alle Zahlen hier. Alles // PH
export const KLINGE = {
  stance: {
    1: { name: 'Einhand · Iai', move: 1.25, rate: 1.3, range: 1.4, dmg: 1, cdOnHit: 500, bleed: false },     // PH
    2: { name: 'Zweihand · Nitō', move: 1, rate: 1, range: 1, dmg: 2.5, cdOnHit: 0, bleed: true },           // PH
  },
  swap: { cd: 1000, bonus: 0.3 },                                                                            // PH
  bleed: { share: 0.33, ms: 5000, tickMs: 1000, max: 7 },                                                    // PH: 33 % des Treffers über 5 s, 7 Stapel pro Mob
};
const K = KLINGE;

// Slots in Tastenreihenfolge: Q, E, R, Maus 4, Maus 5, 1, 2, 3
const move = (name, desc, tags, cd, press, extra = {}) => ({ name, desc, ranks: [], tags: ['Klinge', ...tags], cls: 'fire', school: 'warrior', fixed: true, cd, mana: 0, press, ...extra });
Object.assign(SPELLS, {
  kQ: move('Schnitt', '', ['Nahkampf', 'Fläche', 'Schnitt'], 0, () => {}),
  kE: move('Kreisschnitt', '', ['Nahkampf', 'Fläche', 'Kontrolle'], 0, () => {}),
  kR: move('Blutwirbel', '', ['Nahkampf', 'Fläche', 'Kontrolle'], 0, () => {}),
  kAder: move('Aderlass', '', ['Blutung', 'Fläche'], 0, () => {}),
  kClones: move('Schattenklone', '', [], 0, () => {}),
  kSwap: move('Haltung', 'Wechselt zwischen Einhand und Zweihand. Der erste Treffer danach macht +30 %.', [], K.swap.cd, () => pressSwap()),
  kDash: move('Strichschnitt', '', ['Nahkampf', 'Bewegung', 'Linie'], 0, () => {}),
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
  stance = 1; act = null; swapBonus = false;
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
function startAct(id, ability, ms, rate) {
  act = { id, ability, start: state.now, ms: ms / rate, rate, ctx: makeCtx(id, S().dmg, S().range) };
  seq++;
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
  if (act && state.now >= act.start + act.ms) act = null;
}

export const klingeMoveMul = () => on() ? S().move : 1;
export const klingeRooted = () => on() && !!act;

export function klingeAnim() {
  if (!on() || player.dead) return {};
  return { ability: act?.ability ?? null, attack: null, seq, rate: act?.rate ?? 1, frozen: !!(state.paused && act) };
}

// Für den Handtest
(window as any).__klinge = { get stance() { return stance; }, get act() { return act; }, get swapBonus() { return swapBonus; }, KLINGE };
onWarriorHit(() => {});
void after;
