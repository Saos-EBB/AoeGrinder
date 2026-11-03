// Klingenstrich: Nahkämpfer ohne Ressource, nur Abklingzeiten. Zwei Haltungen, 8 Slots. Die Moves liegen als Spells in den Slots wie bei Real Men,
// damit Leiste, Tasten, Pad und Karten mitlaufen. Modell und Treffer-Momente kommen aus models/klingeModel.ts.

import { player } from './state';
import { $ } from './util';
import { SPELLS } from './config';
import { mage } from './models/mage';

// Slots in Tastenreihenfolge: Q, E, R, Maus 4, Maus 5, 1, 2, 3. Die Moves folgen in den nächsten Schritten.
const move = (name, desc) => ({ name, desc, ranks: [], tags: ['Klinge'], cls: 'fire', school: 'warrior', fixed: true, cd: 0, mana: 0, press() {} });
Object.assign(SPELLS, {
  kQ: move('Schnitt', ''), kE: move('Kreisschnitt', ''), kR: move('Blutwirbel', ''), kAder: move('Aderlass', ''),
  kClones: move('Schattenklone', ''), kSwap: move('Haltung', ''), kDash: move('Strichschnitt', ''), kEat: move('Essen', ''),
});

const on = () => mage.skin === 'klinge';
let stance = 1;

const showStance = () => {
  player.resLabel = stance === 1 ? 'Einhand · Iai' : 'Zweihand · Nitō';
  $('manaFill').style.background = stance === 1 ? 'linear-gradient(#c8ccd6, #6a7080)' : 'linear-gradient(#d8343c, #7a1016)';
};

// Nach dem Zurücksetzen von Leben und Mana im Run-Start, nach resetRealMen und resetHeroes
export function resetKlinge() {
  player.resLabel = undefined;
  if (!on()) return;
  player.rageMax = 1; player.mana = 1;             // Keine Ressource: Balken zeigt die Haltung
  stance = 1;
  mage.hero.setStance(1, true);
  showStance();
}

export function klingeAnim() {
  return {};
}
