// ?-Magier (Modus normal): 4 Tasten, jede würfelt aus ihrer Kategorie. Der Wurf steht vorher fest (Vorschau im Slot),
// wird mit seinen normalen Werten, Kosten und Zielen gewirkt, danach kommt der nächste. Zahlen in RANDOM_MAGE (config.ts).

import { pick, rand } from '../util';
import { state, player } from '../state';
import { SPELLS, RANDOM_MAGE } from '../config';
import { maxHp, maxMana } from '../formulas';
import { particles } from '../fx/particles';
import { showError, combatText } from '../ui/hud';
import { addBuff, buffs } from '../buffs';
import { castSpell, cdEnd, startCd, stat, isGround, mobsInRadius, applySlow, makeCtx, schedule, onCastStart } from './core';
import { flame } from './flame';
import { FIRE, EMBER } from './fx';

const R = RANDOM_MAGE, CATS = R.cats;

// Nächster Wurf je Kategorie; resetSpells leert state.randomNext
export const nextOf = cat => (state.randomNext ??= {})[cat] ??= pick(CATS[cat].pool);
const reroll = cat => { state.randomNext[cat] = pick(CATS[cat].pool); };
const catOf = id => Object.keys(CATS).find(cat => state.randomNext?.[cat] === id && cat !== 'rDrink');

// Ein Spell dieser Kategorie hat angefangen (Zauber, Kanal oder sofort): Kategorie-CD, neuer Wurf
onCastStart(id => {
  const cat = catOf(id);
  if (!cat) return;
  startCd(cat);
  reroll(cat);
});

function pressCat(cat, point) {
  if (cdEnd(cat) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  const id = nextOf(cat), s = SPELLS[id];
  // Kann der Wurf gerade gar nicht (kein Ziel, nichts brennt): neu würfeln, ohne CD, damit die Taste nicht festhängt
  const fail = s.canCast?.();
  if (fail) { reroll(cat); return showError(`${fail} – neu gewürfelt`); }
  player.cds[id] = 0;            // der eigene CD des Spells zählt hier nicht
  delete player.charges[id];
  castSpell(id, point);
}

const category = cat => ({
  name: CATS[cat].name, cls: 'util', tags: [], fixed: true, random: true, cd: CATS[cat].cd,
  desc: `Würfelt einen Spell: ${CATS[cat].pool.map(id => SPELLS[id]?.name ?? id).join(', ')}.`,
  ranks: cat === 'rOff' ? ['dmg'] : cat === 'rDef' ? ['dur'] : ['cd'],
  // Rang-Karten wirken auf alle Spells der Kategorie, die Abklingzeit auf die Kategorie selbst
  rankTargets: key => key === 'cd' ? [cat] : CATS[cat].pool,
  get ground() { return isGround(nextOf(cat)); },
  get mana() { const id = nextOf(cat); return SPELLS[id].mana * stat(id).mana; },
  get range() { return SPELLS[nextOf(cat)].range; },
  preview: () => nextOf(cat),
  press: point => pressCat(cat, point),
});

// Drink Something: 2 s sitzen mit dem gewürfelten Getränk, bricht ab wie Trinken. Wirkung erst am Ende des Sitzens
const drinkSpell = {
  name: CATS.rDrink.name, cls: 'util', tags: [], fixed: true, random: true, cd: CATS.rDrink.cd, mana: 0, ranks: [],
  desc: 'Würfelt eins der 4 Magier-Getränke: Goldbecher, Feuerschnaps, Heiße Tasse, Tee-Schale.',
  preview: () => nextOf('rDrink'),
  press() {
    if (cdEnd('rDrink') > state.now) return showError('Fähigkeit ist noch nicht bereit');
    if (!player.grounded) return showError('Du kannst das nicht im Sprung tun');
    const kind = nextOf('rDrink'), D = R.drinks[kind];
    startCd('rDrink');
    reroll('rDrink');
    player.channel = null; player.casting = null; player.targeting = false;
    player.drink = { start: state.now, end: state.now + R.sitMs, custom: true, kind, skin: D.skin, label: D.name, onDone: () => finishDrink(kind) };
  },
};

function finishDrink(kind) {
  const D = R.drinks[kind];
  combatText(player.pos, D.name, 'heal', 2.8);
  if (D.mana && !player.rageMax) player.mana = maxMana();
  if (kind === 'tasse') { addBuff({ id: kind, name: D.name, until: state.now + D.ms, heal: maxHp() / (D.ms / 1000) }); return; }
  addBuff({ id: kind, name: D.name, until: state.now + D.ms, speed: D.speed, crit: D.crit, dmg: D.dmg, cd: D.cd });
  if (kind === 'schnaps') schedule(D.ms, burp);
}

// Feuerrülpser: Kegel vor dir, Schaden wie ein Flammenstoß-Treffer
function burp() {
  if (player.dead) return;
  const B = R.drinks.schnaps.burp, f = player.facing, c = makeCtx('flame');
  for (const m of mobsInRadius(player.pos, B.range)) {
    const a = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z), d = Math.abs(Math.atan2(Math.sin(a - f), Math.cos(a - f)));
    if (d <= B.halfAngle) c.hit(m, rand(flame.min, flame.max));
  }
  for (let i = 0; i < 120; i++) {
    const a = f + rand(-B.halfAngle, B.halfAngle), v = rand(6, 14);
    particles.spawn({ x: player.pos.x, y: player.pos.y + 1.5, z: player.pos.z, vx: Math.sin(a) * v, vy: rand(-0.5, 1.5), vz: Math.cos(a) * v, drag: 2, life: rand(0.4, 0.8), color: i % 2 ? FIRE : EMBER, size: rand(0.5, 1), grow: 0.8 });
  }
  combatText(player.pos, 'Rülps!', 'heal', 2.8);
}

// Jeden Frame aus updatePlayer: Heiße Tasse verlangsamt beim Sitzen und heilt danach
export function updateRandomMage(dt) {
  const T = R.drinks.tasse;
  if (player.drink?.kind === 'tasse') for (const m of mobsInRadius(player.pos, T.slowYd, Infinity)) applySlow(m, T.slow, 300);
  for (const b of buffs()) if (b.heal) player.hp = Math.min(maxHp(), player.hp + b.heal * dt / 1000);
}

export const randomSpells = { rOff: category('rOff'), rDef: category('rDef'), rUtil: category('rUtil'), rDrink: drinkSpell };
