// Mage-Waffen aus der Magischen Kiste: Effekt × Seltenheit, das Modell ist nur Optik. Inventar in meta (localStorage).
// Wirkung über vorhandene Wege: mods, stat(id), Pool. Nur Magier-Modi, Nahkämpfer haben keine Wahl. Grundregel: nur erspielter Staub.

import { state } from './state';
import { SPELLS, CARD_RARITIES, mods } from './config';
import { meta, saveMeta } from './meta';
import { stat, tagsAllowed } from './spells/core';
import { WEAPONS } from './models/weapons/defs';
import { pick } from './util';

// Alle Zahlen PH. Seltenheit: Index in CARD_RARITIES (grau 0 … orange 5), der Faktor kommt von dort (×0,5 … ×5)
export const ROLLS = {
  price: 120,                                  // Staub pro Zug
  invMax: 15,
  weights: [5, 20, 35, 25, 11, 4],             // grau, weiß, grün, blau, lila, orange
  refund: [5, 10, 15, 25, 40, 60],             // Staub beim Löschen
  focus: { dmg: 0.08, radius: 0.04 },          // Fokus <Spell>, bei weiß
  darkMinTier: 3,                              // Fokus Entweihen erst ab blau
  values: { dmg: 0.03, crit: 0.02, cd: 0.03, mana: 0.05, hp: 0.05, regen: 0.03, speed: 0.02, radius: 0.03, dur: 0.05 },   // bei weiß
  fallback: 'pilgerast',                       // leeres Inventar: Pilgerast ohne Effekt
};
// Die 20 Magier-Spells, dazu Entweihen (Dunkel)
export const FOCUS_SPELLS = ['nova', 'ae', 'bliz', 'coc', 'blink', 'flame', 'blast', 'hellfire', 'hurricane', 'frostorb', 'chain', 'voidorb', 'whirl', 'arc', 'icelance', 'glacier', 'fireball', 'meteor', 'barrage', 'surge'];
const DARK_FOCUS = 'desecrate';
const VALUE_TEXT = { dmg: 'Schaden', crit: 'Crit', cd: 'Abklingzeit', mana: 'Mana', hp: 'Leben', regen: 'Regen im Kampf', speed: 'Lauftempo', radius: 'Radius', dur: 'Dauereffekte' };
const SCHOOL = { Frost: 'Frost', Feuer: 'Feuer', Arkan: 'Arkan' };

const factor = tier => CARD_RARITIES[tier].mult;
const pct = v => `${String(Math.round(v * 1000) / 10).replace('.', ',')} %`;
const isFocus = e => e.startsWith('f:');
const focusSpell = e => e.slice(2);

function rollTier() {
  let r = Math.random() * ROLLS.weights.reduce((a, b) => a + b, 0);
  for (let t = 0; t < ROLLS.weights.length; t++) { r -= ROLLS.weights[t]; if (r < 0) return t; }
  return 0;
}
// Modell aus der Schule des Effekts; Wert-Effekte und Entweihen: beliebig
function rollModel(effect) {
  const school = isFocus(effect) ? SPELLS[focusSpell(effect)]?.tags.map(t => SCHOOL[t]).find(Boolean) : null;
  const list = school ? WEAPONS.filter(w => w.school === school) : WEAPONS;
  return pick(list.length ? list : WEAPONS).id;
}
export function rollWeapon() {
  const tier = rollTier();
  const effects = [...FOCUS_SPELLS.map(id => `f:${id}`), ...(tier >= ROLLS.darkMinTier ? [`f:${DARK_FOCUS}`] : []), ...Object.keys(ROLLS.values)];
  const e = pick(effects);
  return { id: ++meta.nextWeapon, e, r: tier, m: rollModel(e) };
}

export function effectText(w) {
  const f = factor(w.r);
  if (isFocus(w.e)) return `Fokus ${SPELLS[focusSpell(w.e)].name}: +${pct(ROLLS.focus.dmg * f)} Schaden, +${pct(ROLLS.focus.radius * f)} Radius`;
  return `${w.e === 'cd' ? '−' : '+'}${pct(ROLLS.values[w.e] * f)} ${VALUE_TEXT[w.e]}`;
}
export const modelName = w => WEAPONS.find(x => x.id === w.m)?.name ?? w.m;
export const weaponName = w => `${modelName(w)} · ${effectText(w)}`;
export const rarityOf = w => CARD_RARITIES[w.r];

export const equipped = () => meta.inv.find(w => w.id === meta.equipped) ?? null;
export const equippedModel = () => equipped()?.m ?? ROLLS.fallback;
export const inventoryFull = () => meta.inv.length >= ROLLS.invMax;

export function buyChest() {
  if (inventoryFull() || meta.dust < ROLLS.price) return null;
  meta.dust -= ROLLS.price;
  const w = rollWeapon();
  meta.inv.push(w);
  saveMeta();
  return w;
}
export function deleteWeapon(id) {
  const w = meta.inv.find(x => x.id === id);
  if (!w) return;
  meta.inv = meta.inv.filter(x => x !== w);
  meta.dust += ROLLS.refund[w.r];
  if (meta.equipped === id) meta.equipped = null;
  saveMeta();
}
export function equip(id) { meta.equipped = id; saveMeta(); }

// Run-Start, nach resetSpells: Effekt der gewählten Waffe anwenden. Nahkämpfer tragen keine.
export function applyRunWeapon(magier) {
  state.poolExtra = [];
  state.runWeapon = '';
  const w = magier ? equipped() : null;
  if (!w) return;
  const f = factor(w.r), V = ROLLS.values;
  state.runWeapon = `${effectText(w)} (${rarityOf(w).name})`;
  if (isFocus(w.e)) {
    const id = focusSpell(w.e), s = stat(id);
    s.dmg += ROLLS.focus.dmg * f;
    s.radius += ROLLS.focus.radius * f;
    if (!tagsAllowed(SPELLS[id].tags)) state.poolExtra.push(id);   // für diesen Run in den Pool
    return;
  }
  if (w.e === 'dmg') mods.dmg += V.dmg * f;
  if (w.e === 'crit') mods.crit += V.crit * f;
  if (w.e === 'cd') mods.cdMul = Math.max(0.1, mods.cdMul - V.cd * f);
  if (w.e === 'mana') mods.manaMult += V.mana * f;
  if (w.e === 'hp') mods.hpMult += V.hp * f;
  if (w.e === 'regen') mods.castRegen += V.regen * f;
  if (w.e === 'speed') mods.moveMul += V.speed * f;
  if (w.e === 'radius') mods.radius += V.radius * f;
  if (w.e === 'dur') mods.durMul += V.dur * f;
}
