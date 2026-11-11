// Gear-Wirkung im Run (ARCH-06): Werte über mods/stat, Set 5/5 mit Perfekt-Werten, Element-Proc über den Treffer-Hook.

import { ROLLS, VALUE_KEY, factor } from '../rollTables';
import { applyValue, applyFocus, weaponHit, runTarget, type ModTarget } from '../weaponRolls';
import { pick } from '../util';
import { SLOTS, GEAR } from './data';
import { SETS } from './sets';
import { worn, isMageFigure, fullSet } from './inventory';
import { makerOf } from './shown';
import { valueKey } from './text';

// Wirkungen der Set-Perfektwerte (sets.ts SETS.perfect)
const PERFECT: Record<string, (v: number, to: ModTarget) => void> = {
  crit: (v, { mods }) => { mods.crit += v; },
  fbExtra: (v, { mods }) => { mods.fbExtra += v; },
  fbCast: (v, { stat }) => { const s = stat('fireball'); s.cast = (s.cast ?? 1) - v; },
  shardMax: (v, { mods }) => { mods.shardMax += v; },
  needleShard: (v, { mods }) => { mods.needleShard += v; },
  frozenDmg: (v, { mods }) => { mods.frozenDmg += v; },
  chainJumps: (v, { mods }) => { mods.chainJumps += v; },
  chainKill: (v, { mods }) => { mods.chainKill += v; },
  chainCost: (v, { stat }) => { stat('chain').mana -= v; },
  burstDmg: (v, { mods }) => { mods.burstDmg += v; },
  contagion: (v, { mods }) => { mods.contagion += v; },
  burstTick: (v, { mods }) => { mods.burstTick += v; },
};
// Hersteller-Trait mit makerMul (Werte aus ROLLS.maker, Wege wie applyRunWeapon)
const halfMaker = (id: string) => Object.fromEntries(Object.entries(ROLLS.maker[id] ?? {}).map(([k, v]) => [k, (v as number) * GEAR.makerMul])) as Record<string, number>;

// Run-Start nach applyRunWeapon (mods frisch aus resetMods, spellStats aus resetSpells): Werte über mods/stat, Element-Proc über den Treffer-Hook
export function applyRunGear(skin: string | null, to: ModTarget = runTarget()) {
  const mods = to.mods, st = to.state;
  st.gearSet = null;
  if (!isMageFigure(skin)) return;
  const procs: [string, number, Record<string, number>][] = [], set = fullSet(skin);
  st.gearSet = set;
  for (const slot of SLOTS) {
    const g = worn(slot);
    if (!g) continue;
    if (set) { const [k, v] = SETS[set].perfect[slot]; PERFECT[k](v, to); continue; }   // 5/5: Perfekt-Wert statt eigenem Roll
    const f = factor(g.r) * GEAR.mul;
    applyValue(valueKey(g), ROLLS.values[valueKey(g)] * f, to);
    if (g.s.focus) applyFocus(g.s.focus, f, { s: { fv: 1 } }, to);
    const M = makerOf(g) ? halfMaker(g.s.maker) : {};
    if (M.dmg) mods.dmg += M.dmg;
    if (M.cast) mods.castMul += M.cast;
    if (M.crit) mods.crit += M.crit;
    if (M.dur) mods.durMul += M.dur;
    if (M.random) applyValue(pick(Object.values(VALUE_KEY)), M.random, to);
    if (M.cd) applyValue('cd', -M.cd, to);
    if (M.mana) mods.manaMult += M.mana;
    if (M.hp) mods.hpMult += M.hp;
    const chance = g.s.element !== 'none' ? ROLLS.procChance * f : 0;
    if (chance || M.lifesteal || M.critMana) procs.push([g.s.element, chance, M]);
  }
  if (!procs.length) return;
  const prev = st.weaponHit;
  st.weaponHit = (m, dmg, crit, api) => {
    prev?.(m, dmg, crit, api);
    for (const [el, chance, M] of procs) weaponHit(m, dmg, crit, api, el, chance, M);
  };
}
