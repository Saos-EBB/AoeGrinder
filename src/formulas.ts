// Formeln aus VMaNGOS, Abschnitte siehe docs/mechanics-spec.md

import { state, player } from './state';
import { rand, clamp } from './util';
import { CFG, SPELLS, mods, LEVEL_HP_AT_20, LEVEL_HP_STEP, LEVEL_DMG_STEP, LEVEL_MOB_HP, LEVEL_MOB_DEF_STEP, LEVEL_MOB_DEF_MAX, LEVEL_MAX, LEVEL_PACE, LEVEL_KILLS } from './config';
import { stat, rune, echoCost, radiusMult } from './spells/core';
import { modFactor, timeLimit } from './modifiers';
import { meterCdMul } from './schoolMeter';
import { buffCdMul } from './buffs';

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
export const xpNeeded = () => Math.round((player.level * 5 + 45) * (LEVEL_KILLS.base + LEVEL_KILLS.perLevel * player.level));
// Level, auf dem der Run nach dieser Zeit stehen soll. Mit Zeitlimit gilt dessen Länge.
const paceLevel = () => 1 + (LEVEL_MAX - 1) * state.now / (timeLimit() || LEVEL_PACE.minutes * 60000);
export const paceXpMul = () => clamp(2 ** ((paceLevel() - player.level) / LEVEL_PACE.halfLevels), LEVEL_PACE.minMul, LEVEL_PACE.maxMul);
const baseHp = () => LEVEL_HP_AT_20 + LEVEL_HP_STEP * (player.level - 20);
const MANA_PER_HP = 4 / 3;                       // Mana = Leben + 1/3
// Modi als eigener Faktor, damit Karten-Boni in jedem Modus relativ gleich wirken
export const maxHp = () => Math.round(baseHp() * mods.hpMult * modFactor('hp'));
export const maxMana = () => player.rageMax ?? Math.round(baseHp() * MANA_PER_HP * mods.manaMult * modFactor('mana'));
export const spirit = () => 45 + 2 * (player.level - 20);
// Schaden und Mob-Leben wachsen gleich; dazu kommt die Schadensreduktion der Mobs
const levelFactor = lvl => 1 + LEVEL_DMG_STEP * (lvl - 1);
export const dmgMult = () => mods.dmg * levelFactor(player.level);
export const mobMaxHp = lvl => Math.round(LEVEL_MOB_HP * levelFactor(lvl));
export const mobDmgTaken = lvl => 1 - Math.min(LEVEL_MOB_DEF_MAX, LEVEL_MOB_DEF_STEP * (lvl - 1));
export const mobHitDmg = lvl => Math.round(lvl * rand(0.9, 1.3));

export function manaCost(id) {
  const base = SPELLS[id].mana * stat(id).mana * (echoCost(id) ? 1.5 : 1) * modFactor('manaCost') * mods.manaCostMul;   // Arcane only: +15 %, Buch −10 %
  return Math.round(id === 'ae' ? base * mods.aeCost : base);
}
export function spellCd(id) {
  return (rune(id)?.cdMul ?? 1) * baseCd(id) * mods.cdMul * (stat(id).cd ?? 1) * meterCdMul() * buffCdMul();   // cdMul: Waffe, stat.cd: Rang-Karte, Kill-Anzeige Arkan voll, Tee-Schale
}
function baseCd(id) {
  return id === 'nova' ? Math.max(1000, SPELLS.nova.cd - mods.novaCd) : SPELLS[id].cd;   // PH: Untergrenze
}
export const blizRadius = () => {          // auch Zielkreis: gilt für den Spell, der gerade zielt
  const id = typeof player.targeting === 'string' ? player.targeting : 'bliz';
  return ((rune(id)?.radius ?? SPELLS[id].radius) + (id === 'bliz' ? mods.blizRadius : 0)) * radiusMult(id);
};
