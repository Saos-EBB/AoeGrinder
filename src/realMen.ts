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

function clearAttacks() {}
function pressAttack() { showError('Noch nicht bereit'); }
const pressWhirl = pressAttack;
function pressOnce(id) { pressAttack(); }
export function updateRealMen(dt) {}
export const moveMul = () => 1;
export const rooted = () => false;
export const realMenAnim = () => ({});
