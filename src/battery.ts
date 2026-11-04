// Batterie des Blitzmagiers (Blitz only): steht in player.mana, player.rageMax meldet die Größe an maxMana und schaltet die Mana-Regeneration ab.
// Zahlen in BATTERY (config.ts). Ohne Import aus spells/: core.ts und formulas.ts lesen von hier.

import { state, player } from './state';
import { BATTERY as B } from './config';
import { modValue } from './modifiers';

export const batteryMode = () => !!modValue('battery');
export const overcharged = () => batteryMode() && !!player.overcharged;

export function resetBattery() {
  if (!batteryMode()) { player.overcharged = false; return; }
  player.rageMax = B.max;
  player.mana = B.start;
  player.overcharged = false;
}
function add(v) {
  player.mana = Math.min(B.max, player.mana + v);
  if (player.mana >= B.max) player.overcharged = true;
}
export function updateBattery(dt) {
  if (!batteryMode() || player.dead) return;
  if (!player.overcharged) add(B.regenPerS * dt / 1000);
  player.resLabel = `Batterie ${Math.floor(player.mana)} / ${B.max}${player.overcharged ? ' · Überladen!' : ''}`;
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
