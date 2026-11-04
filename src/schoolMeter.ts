// Kill-Anzeige der Schul-Modi (Frost only, Fire only, Arcane only). Zahlen in SCHOOL_METER (config.ts).
// Ohne Import aus spells/: core.ts und formulas.ts lesen die Boni von hier.

import { state } from './state';
import { SCHOOL_METER } from './config';
import { modValue } from './modifiers';

const M = SCHOOL_METER;
const meter = { value: 0, lastKill: -1e9 };

// Schule des Modus oder null (Normal-Modus und Nahkämpfer haben keine Anzeige)
export const meterSchool = (): 'Feuer' | 'Frost' | 'Arkan' | null => { const t = modValue('onlyTag'); return t === 'Feuer' || t === 'Frost' || t === 'Arkan' ? t : null; };
export const meterValue = () => meter.value;
const full = school => meter.value >= 1 && meterSchool() === school;

export function resetMeter() { meter.value = 0; meter.lastKill = -1e9; }
export function meterKill(champion) {
  if (!meterSchool()) return;
  meter.value = Math.min(1, meter.value + (champion ? M.perChampion : M.perKill));
  meter.lastKill = state.now;
}
export function updateMeter(dt) {
  if (state.now - meter.lastKill > M.idleMs) meter.value = Math.max(0, meter.value - M.decayPerS * dt / 1000);
}
// Dev und Tests: Anzeige setzen
export function setMeter(v) { meter.value = v; meter.lastKill = state.now; }

export const meterDmgMul = () => full('Feuer') ? 1 + M.Feuer.dmg : 1;
export const meterCdMul = () => full('Arkan') ? 1 - M.Arkan.cd : 1;
export const meterFrostFull = () => full('Frost');
// Frost: jeder Slow wird stärker, gesamt höchstens slowMax
export const meterSlow = pct => full('Frost') ? Math.max(pct, Math.min(M.Frost.slowMax, pct + M.Frost.slow)) : pct;
