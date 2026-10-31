// Formeln aus VMaNGOS, Abschnitte siehe docs/mechanics-spec.md

import { player } from './state';
import { rand, clamp } from './util';
import { CFG, SPELLS, mods } from './config';
import { stat } from './spells/core';

// Spec §1
export function aggroRadius(mob) {
  const diff = Math.max(player.level - mob.level, -CFG.aggroLevelCap);
  return Math.max(CFG.aggroBase - diff, Math.min(CFG.aggroBase, CFG.aggroMin));
}

// Spec §5
export function hitChance(mob) {                       // in Prozent
  const d = mob.level - player.level;
  const hit = d < 3 ? 96 - d : 94 - (d - 2) * 11;
  return clamp(Math.max(hit, 22), 1, 99);
}

// Spec §11
function grayLevel(pl) {
  if (pl <= 5) return 0;
  if (pl <= 39) return pl - 5 - Math.floor(pl / 10);
  return pl - 1 - Math.floor(pl / 5);
}
// Spec §11
function zeroDiff(pl) {
  const table = [[8, 5], [10, 6], [12, 7], [16, 8], [20, 9], [30, 11], [40, 12], [45, 13], [50, 14], [55, 15], [60, 16]];
  for (const [lvl, zd] of table) if (pl < lvl) return zd;
  return 17;
}
// Spec §11
export function xpForKill(mobLevel) {
  const pl = player.level;
  let factor;
  if (mobLevel >= pl) factor = 1 + 0.05 * Math.min(mobLevel - pl, 4);
  else if (mobLevel > grayLevel(pl)) factor = (zeroDiff(pl) + mobLevel - pl) / zeroDiff(pl);
  else factor = 0;
  return Math.round((pl * 5 + 45) * factor);
}
// Spec §11
export function xpColor(mobLevel) {
  const pl = player.level;
  if (mobLevel >= pl + 5) return '#ff2020';
  if (mobLevel >= pl + 3) return '#ff8040';
  if (mobLevel >= pl - 2) return '#ffff00';
  if (mobLevel > grayLevel(pl)) return '#40c040';
  return '#808080';
}

// PH: Werte für Level-Skalierung, Spielerstats und XP-Bedarf
export const xpNeeded = () => (player.level * 5 + 45) * 10;
const baseHp = () => (520 + 30 * (player.level - 20)) * 2;
const MANA_PER_HP = 4 / 3;                       // Mana = Leben + 1/3
export const maxHp = () => Math.round(baseHp() * mods.hpMult);
export const maxMana = () => Math.round(baseHp() * MANA_PER_HP * mods.manaMult);
export const spirit = () => 45 + 2 * (player.level - 20);
export const dmgMult = () => mods.dmg * (1 + 0.05 * (player.level - 20));
export const mobMaxHp = lvl => 8 * lvl + 60;
export const mobHitDmg = lvl => Math.round(lvl * rand(0.9, 1.3));

export function manaCost(id) {
  const base = SPELLS[id].mana * stat(id).mana;
  return Math.round(id === 'ae' ? base * mods.aeCost : base);
}
export function spellCd(id) {
  return id === 'nova' ? Math.max(1000, SPELLS.nova.cd - mods.novaCd) : SPELLS[id].cd;   // PH: Untergrenze
}
export const blizRadius = () => {          // auch Zielkreis: gilt für den Spell, der gerade zielt
  const id = typeof player.targeting === 'string' ? player.targeting : 'bliz';
  return (SPELLS[id].radius + (id === 'bliz' ? mods.blizRadius : 0)) * stat(id).radius;
};
