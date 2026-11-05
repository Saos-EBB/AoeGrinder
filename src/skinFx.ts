// Skin-Effekte auf Mobs: Spuren des Spielers (mage.trail) schaden oder verlangsamen. Werte kommen aus mage.fx.

import { state, player } from './state';
import { mage } from './models/mage';
import { damageMob } from './mobs';
import { applySlow } from './spells/core';
import { modValue } from './modifiers';
import { meterHeat } from './schoolMeter';

const FIRE_TICK = 1000;   // ms; mob.trailTickAt pro Mob, darum stapeln mehrere Spuren nicht

export function updateSkinFx() {
  const fx = mage.fx;
  if (!mage.trail || player.dead) return;
  const zones = mage.trail.zones();
  if (!zones.length) return;
  // Umriss aller Spuren: alles außerhalb ist schnell aussortiert
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of zones) { x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r); z0 = Math.min(z0, p.z - p.r); z1 = Math.max(z1, p.z + p.r); }
  for (const m of state.mobs) {
    if (m.dead || m.pos.x < x0 || m.pos.x > x1 || m.pos.z < z0 || m.pos.z > z1) continue;
    if (!zones.some(p => (m.pos.x - p.x) ** 2 + (m.pos.z - p.z) ** 2 < p.r * p.r)) continue;
    if (fx.slow) applySlow(m, fx.slow, fx.slowMs);
    if (fx.dps && state.now >= (m.trailTickAt ?? -Infinity)) {
      m.trailTickAt = state.now + FIRE_TICK;
      damageMob(m, fx.dps * (modValue('dotMul') ?? 1) * (1 + meterHeat() / 100), 'flame', 'env', true);   // Hitze: × (1 + Hitze/100)    // Funken wie Feuer; 'env' zählt als Multi nur im Zeitfenster
    }
  }
}
