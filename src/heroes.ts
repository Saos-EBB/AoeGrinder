// Ronin (Gebeinsamurai, Wut) und Schatten (Ninja Aschenschatten, Energie). Die Moves liegen als Spells in den Slots wie bei Real Men,
// damit Leiste, Tasten, Pad und Karten mitlaufen. Modelle und Treffer-Momente kommen aus models/heroModels.ts.

import { state, player } from './state';
import { $ } from './util';
import { SPELLS } from './config';
import { mage, onWarriorHit } from './models/mage';
import { SAMURAI_TIMING, NINJA_TIMING } from './models/heroModels';
import { makeCtx, mobsInRadius, applySlow } from './spells/core';
import { REALMEN, held } from './realMen';
import { roll, forward, payMove, mobsOnLine, moveInWindow, inWindow, wave, updateMelee, clearMelee } from './melee';

// Alle Zahlen PH außer [Classic]. dmg mit zwei Bereichen: [erster Treffer, letzter Treffer].
export const RONIN = {
  armor: 0.2,                                                              // weniger Schaden, siehe REALMEN.armor
  attack: { dmg: [28, 34], radius: 3 },                                  // Kesagiri, Wut wie der Krieger-Grundangriff
  iai: { dmg: [90, 110], width: 2.5, rage: 25, cd: 8000 },                 // Fahlmond-Iai: Linie Start → Ende
  twoheavens: { dmg: [[50, 60], [40, 50]], radius: [3, 4], rage: 20, cd: 6000 },
  crescent: { dmg: [70, 85], rage: 25, cd: 10000, speed: 14, range: 10, width: 4 },   // Seoi-Sichel: Welle durchschlägt alles
  deathwatch: { dmg: [45, 55], radius: 6, rage: 35, cd: 20000 },           // Totenwacht: drei Wellen am Spieler
};
export const SCHATTEN = {
  armor: 0.1,                                                              // weicht lieber aus: unangreifbar in Schritt und Rauch
  energy: { max: 100 /* Classic */, tick: 20 /* Classic */, tickMs: 2000 /* Classic */ },   // Schurke: https://strategywiki.org/wiki/World_of_Warcraft/Classes/Rogue
  attack: { dmg: [18, 22], radius: 3 },                                    // Doppelschnitt, zwei Treffer
  shadowstep: { dmg: [70, 85], width: 2, energy: 30, cd: 8000 },         // im Sprint nicht angreifbar
  twinblades: { dmg: [[18, 22], [45, 55]], radius: [3, 4], energy: 35, cd: 6000 },
  smokebomb: { dmg: [40, 50], radius: 5, slowRadius: 6, slow: 0.5, slowMs: 3000, energy: 40, cd: 15000 },
  ghoststorm: { dmg: [40, 50], radius: 6, energy: 50, cd: 18000 },
};

const avg = r => (r[0] + r[1]) / 2;
const move = (tag, name, desc, cd, cost, press, showDmg) => ({ name, desc, showDmg, ranks: ['dmg', 'radius'], tags: [tag], cls: 'fire', school: 'warrior', fixed: true, cd, mana: cost, press });
const Ro = RONIN, Sc = SCHATTEN;
Object.assign(SPELLS, {
  rAttack: move('Ronin', 'Kesagiri', 'Diagonaler Schnitt, solange gehalten. Bringt Wut.', 0, 0, () => pressAttack(), avg(Ro.attack.dmg)),
  rIai: move('Ronin', 'Fahlmond-Iai', 'Zieht im Sprint 6 yd nach vorn, schneidet alles auf dem Weg.', Ro.iai.cd, Ro.iai.rage, () => pressMove('rIai'), avg(Ro.iai.dmg)),
  rTwo: move('Ronin', 'Zwei Himmel', 'Kreuzschnitt vor dir, dann eine Drehung mit beiden Klingen.', Ro.twoheavens.cd, Ro.twoheavens.rage, () => pressMove('rTwo'), avg(Ro.twoheavens.dmg[0])),
  rCrescent: move('Ronin', 'Seoi-Sichel', 'Ōdachi-Schlag, eine Sichelwelle fliegt 10 yd geradeaus.', Ro.crescent.cd, Ro.crescent.rage, () => pressMove('rCrescent'), avg(Ro.crescent.dmg)),
  rDeath: move('Ronin', 'Totenwacht', 'Drei Wellen um dich, 6 yd. Du bleibst stehen.', Ro.deathwatch.cd, Ro.deathwatch.rage, () => pressMove('rDeath'), avg(Ro.deathwatch.dmg)),
  nAttack: move('Schatten', 'Doppelschnitt', 'Zwei schnelle Schnitte, solange gehalten.', 0, 0, () => pressAttack(), avg(Sc.attack.dmg)),
  nStep: move('Schatten', 'Schattenschritt', 'Springt 7 yd nach vorn, im Sprung nicht angreifbar.', Sc.shadowstep.cd, Sc.shadowstep.energy, () => pressMove('nStep'), avg(Sc.shadowstep.dmg)),
  nTwin: move('Schatten', 'Zwielichtkreuz', 'Drei Wechselschnitte mit zwei Klingen, dann ein Kreuzschnitt.', Sc.twinblades.cd, Sc.twinblades.energy, () => pressMove('nTwin'), avg(Sc.twinblades.dmg[0])),
  nSmoke: move('Schatten', 'Rauchbombe', 'Verschwindet im Rauch, Mobs in 6 yd 50 % langsamer, Drehschnitt beim Auftauchen.', Sc.smokebomb.cd, Sc.smokebomb.energy, () => pressMove('nSmoke'), avg(Sc.smokebomb.dmg)),
  nStorm: move('Schatten', 'Geisterklingensturm', 'Die Geisterklinge kreist dreimal um dich, 6 yd. Du bleibst stehen.', Sc.ghoststorm.cd, Sc.ghoststorm.energy, () => pressMove('nStorm'), avg(Sc.ghoststorm.dmg)),
});

// Slot-ID → Ability des Modells und Kosten
const HERO = {
  samurai: { attackId: 'rAttack', timing: SAMURAI_TIMING, res: 'Wut', moves: { rIai: ['iai', Ro.iai.rage], rTwo: ['twoheavens', Ro.twoheavens.rage], rCrescent: ['crescent', Ro.crescent.rage], rDeath: ['deathwatch', Ro.deathwatch.rage] } },
  ninja: { attackId: 'nAttack', timing: NINJA_TIMING, res: 'Energie', moves: { nStep: ['shadowstep', Sc.shadowstep.energy], nTwin: ['twinblades', Sc.twinblades.energy], nSmoke: ['smokebomb', Sc.smokebomb.energy], nStorm: ['ghoststorm', Sc.ghoststorm.energy] } },
};
const hero = () => HERO[mage.skin];

let act = null;                                    // laufender Move: { id, ability, start, ms, ctx, from }
let attackUntil = 0, attackCtx = null, nextEnergy = 0;

export function resetHeroes() {
  act = null; attackUntil = 0; attackCtx = null; nextEnergy = 0;
  clearMelee();
  if (mage.skin === 'samurai') { player.rageMax = REALMEN.rage.max; player.mana = REALMEN.rage.start; }
  if (mage.skin === 'ninja') {
    player.rageMax = Sc.energy.max; player.mana = Sc.energy.max; player.resName = 'Energie';
    $('manaFill').style.background = 'linear-gradient(#f2d04c, #a88a10)';
  } else player.resName = undefined;
}

function pressAttack() {
  const h = hero();
  if (!h || act || state.now < attackUntil) return;
  attackUntil = state.now + h.timing.attack;
  attackCtx = makeCtx(h.attackId);
}
function pressMove(id) {
  const h = hero();
  if (!h || act) return;
  const [ability, cost] = h.moves[id];
  if (!payMove(id, cost, h.res)) return;
  attackUntil = 0;
  act = { id, ability, start: state.now, ms: h.timing[ability], ctx: makeCtx(id), from: { x: player.pos.x, z: player.pos.z } };
}

const gain = n => { player.mana = Math.min(player.rageMax, player.mana + n); };
const area = (ctx, at, r, dmg) => mobsInRadius(at, ctx.radius(r)).filter(m => ctx.hit(m, roll(dmg)));
const line = (ctx, a, b, width, dmg) => mobsOnLine(a, b, width).filter(m => ctx.hit(m, roll(dmg)));

onWarriorHit((kind, x, z, i) => {
  if (!hero() || player.dead) return;
  const at = { x, y: player.pos.y, z }, a = act?.ability, c = act?.ctx;
  if (mage.skin === 'samurai') {
    if (kind === 'cast' && attackCtx) {
      const n = area(attackCtx, at, Ro.attack.radius, Ro.attack.dmg).length;
      gain(Math.min(REALMEN.rage.perSwingMax, n * REALMEN.rage.perMobHit));
    } else if (kind === 'atk1' && a === 'iai') line(c, act.from, at, Ro.iai.width, Ro.iai.dmg);
    else if (kind === 'atk2' && a === 'twoheavens') area(c, at, Ro.twoheavens.radius[i ? 1 : 0], Ro.twoheavens.dmg[i ? 1 : 0]);
    else if (kind === 'atk3' && a === 'crescent') wave(at, forward(), Ro.crescent, m => c.hit(m, roll(Ro.crescent.dmg)));
    else if (kind === 'atk4' && a === 'deathwatch') area(c, at, Ro.deathwatch.radius, Ro.deathwatch.dmg);
  } else {
    if (kind === 'cast' && attackCtx) area(attackCtx, at, Sc.attack.radius, Sc.attack.dmg);
    else if (kind === 'atk1' && a === 'shadowstep') line(c, act.from, at, Sc.shadowstep.width, Sc.shadowstep.dmg);
    else if (kind === 'atk2' && a === 'twinblades') area(c, at, Sc.twinblades.radius[i === 3 ? 1 : 0], Sc.twinblades.dmg[i === 3 ? 1 : 0]);
    else if (kind === 'rauch' && a === 'smokebomb') for (const m of mobsInRadius(at, Sc.smokebomb.slowRadius)) applySlow(m, Sc.smokebomb.slow, Sc.smokebomb.slowMs);
    else if (kind === 'atk3' && a === 'smokebomb') area(c, at, Sc.smokebomb.radius, Sc.smokebomb.dmg);
    else if (kind === 'atk4' && a === 'ghoststorm') area(c, at, Sc.ghoststorm.radius, Sc.ghoststorm.dmg);
  }
});

export function updateHeroes(dt) {
  const h = hero();
  if (!h || player.dead) return;
  const now = state.now;
  if (mage.skin === 'ninja' && now >= nextEnergy) {                       // Energie tickt im und außerhalb des Kampfes
    if (nextEnergy) gain(Sc.energy.tick);
    nextEnergy = now + Sc.energy.tickMs;
  }
  if (mage.skin === 'samurai' && now - player.lastCombat > REALMEN.rage.outOfCombatMs) player.mana = Math.max(0, player.mana - REALMEN.rage.decayPerS * dt / 1000);
  updateMelee(dt);
  if (act) {
    moveInWindow(h.timing.move?.[act.ability], act.start, act.ms, dt);   // Iai und Schattenschritt: das Spiel bewegt den Spieler
    if (now >= act.start + act.ms) act = null;
  }
  if (!act && player.stunUntil <= now && held(h.attackId)) pressAttack();
}

// Schadensfaktor der Nahkämpfer, Magier 1
export const takenMul = () => 1 - ({ krieger: REALMEN.armor, samurai: Ro.armor, ninja: Sc.armor }[mage.skin] ?? 0);

export const heroRooted = () => !!act;             // eigene Bewegung oder keine
// Rauchbombe und Schattenschritt: nicht angreifbar
export const untouchable = () => !!act && mage.skin === 'ninja' && inWindow(NINJA_TIMING.hidden[act.ability], act.start, act.ms);

export function heroAnim() {
  if (!hero() || player.dead) return {};
  const attack = state.now < attackUntil;
  return { ability: act?.ability ?? null, attack, frozen: !!(state.paused && (act || attack)) };
}
