// Batterie des Blitzmagiers (Blitz only): steht in player.mana, player.rageMax meldet die Größe an maxMana und schaltet die Mana-Regeneration ab.
// Zahlen in BATTERY (config.ts). Ohne Import aus spells/: core.ts und formulas.ts lesen von hier.

import { state, player } from './state';
import { BATTERY as B, mods } from './config';
import { modValue } from './modifiers';
import { t } from './i18n';

export const batteryMode = () => !!modValue('battery');
// Kondensator (v31): größere Batterie, Überladung erst bei vollem Wert
export const batteryMax = () => B.max + (mods.condenser ?? 0);
export const overcharged = () => batteryMode() && !!player.overcharged;

export function resetBattery() {
  if (!batteryMode()) { player.overcharged = false; return; }
  player.rageMax = batteryMax();
  player.mana = B.start;
  player.overcharged = false;
}
function add(v) {
  player.mana = Math.min(batteryMax(), player.mana + v);
  if (player.mana >= batteryMax()) player.overcharged = true;
}
export function updateBattery(dt) {
  if (!batteryMode() || player.dead) return;
  player.rageMax = batteryMax();
  if (!player.overcharged) add(B.regenPerS * dt / 1000);
  player.resLabel = t('bat.label', { a: Math.floor(player.mana), b: batteryMax() }) + (player.overcharged ? t('bat.over') : '');
}
// Pro getroffenem Gegner eines Blitz-Zaubers
export function batteryHit() { if (batteryMode() && !player.overcharged) add(B.perHitTarget); }
export const batteryCharge = v => { if (batteryMode()) add(v); };
// Ein Blitz-Zauber wird wirksam: war die Batterie voll, ist er überladen und sie danach leer
export function consumeOvercharge(tags) {
  if (!overcharged() || !tags?.includes('Blitz')) return false;
  player.overcharged = false;
  player.mana = 0;
  return true;
}
// Kosten in Ladung
export const batteryCost = s => s.charge ?? Math.round((s.mana ?? 0) / B.costDiv);
