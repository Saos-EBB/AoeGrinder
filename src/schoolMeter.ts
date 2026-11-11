// Anzeige der Schul-Modi. Frost only: Kills füllen sie. Fire only: Hitze aus Feuer-Treffern.
// Zahlen in SCHOOL_METER (config.ts). Ohne Import aus spells/: core.ts und formulas.ts lesen die Boni von hier.

import { state } from './state';
import { SCHOOL_METER, mods } from './config';
import { modValue } from './modifiers';
import { onRunReset } from './hooks';

const M = SCHOOL_METER, H = M.Feuer;
const meter = { value: 0, lastKill: -1e9, heat: 0, lastHeat: -1e9, over: false, nextSelf: 0 };

// Schule des Modus oder null (?-Magier und Nahkämpfer haben keine Anzeige)
export const meterSchool = (): 'Feuer' | 'Frost' | null => { const t = modValue('onlyTag'); return t === 'Feuer' || t === 'Frost' ? t : null; };
const fire = () => meterSchool() === 'Feuer';
// Füllung 0 … 1 für HUD und Modell
export const meterValue = () => fire() ? meter.heat / H.max : meter.value;
export const meterHeat = () => fire() ? meter.heat : 0;
export const meterOverheated = () => fire() && meter.over;
// Stufe fürs Modell (models/strichMagier.ts): 0–24 %, 25–49 %, 50–99 %, voll; -1 ohne Anzeige. Überhitzt zählt als voll
export const meterStage = () => { if (!meterSchool()) return -1; const v = meterValue(); return v >= 1 || meterOverheated() ? 3 : v >= 0.5 ? 2 : v >= 0.25 ? 1 : 0; };
const full = school => meter.value >= 1 && meterSchool() === school;

export function resetMeter() { Object.assign(meter, { value: 0, lastKill: -1e9, heat: 0, lastHeat: -1e9, over: false, nextSelf: 0 }); }
onRunReset(resetMeter, 70);   // Run-Reset (hooks.ts runReset)
export function meterKill(champion) {
  if (!meterSchool() || fire()) return;
  meter.value = Math.min(1, meter.value + (champion ? M.perChampion : M.perKill));
  meter.lastKill = state.now;
}
// Feuer-Treffer (kein Brand-Tick) auf einen Gegner
export function meterHeatHit() {
  if (!fire()) return;
  meter.heat = Math.min(H.max, meter.heat + H.perHit);
  meter.lastHeat = state.now;
  if (meter.heat >= H.max && !meter.over) { meter.over = true; meter.nextSelf = state.now + H.selfTickMs; }
}
// Ein Zauber fängt an: Frost kühlt (kommt im Fire-Modus nur über einen Waffen-Fokus in den Pool)
export function meterCast(tags) {
  if (fire() && tags?.includes('Frost')) meter.heat /= 2;
}
// Pro Frame; gibt den Anteil der max. Leben zurück, den das Überhitzen gerade kostet (sonst 0)
export function updateMeter(dt) {
  if (!fire()) { if (state.now - meter.lastKill > M.idleMs) meter.value = Math.max(0, meter.value - M.decayPerS * (meterSchool() === 'Frost' ? Math.max(0, 1 - mods.permafrost) : 1) * dt / 1000); return 0; }   // Permafrost
  if (state.now - meter.lastHeat > H.coolDelayMs) meter.heat = Math.max(0, meter.heat - H.coolPerS * dt / 1000);
  if (meter.over && meter.heat < H.overheatUntil) meter.over = false;
  if (!meter.over || state.now < meter.nextSelf) return 0;
  meter.nextSelf += H.selfTickMs;
  return H.overheatSelfPctPerS * H.selfTickMs / 1000;
}
// Dev und Tests: Anzeige setzen (0 … 1)
export function setMeter(v) {
  if (fire()) { meter.heat = v * H.max; meter.lastHeat = state.now; if (meter.heat >= H.max) { meter.over = true; meter.nextSelf = state.now + H.selfTickMs; } return; }
  meter.value = v; meter.lastKill = state.now;
}

// Feuer: Treffer +0,4 % pro Hitze, Brand-Ticks +0,8 % pro Hitze (tick = Dauerschaden)
// Überhitzt (v31): +25 % obendrauf, Glutkern mehr; der Selbstschaden bleibt
export const meterDmgMul = (tick = false) => fire() ? (1 + (tick ? H.burnPerHeat : H.dmgPerHeat) * meter.heat) * (meter.over ? 1 + H.overDmg + mods.emberCore : 1) : 1;
// Feuer-Figur: Anteil der max. Leben, den jeder Kill heilt (mobs.ts)
export const meterKillHeal = () => fire() ? H.killHeal : 0;
export const meterCdMul = () => 1;   // Fokus voll gab −25 % Abklingzeit; seit v31 Ladungen statt Fokus
export const meterFrostFull = () => full('Frost');
// Frost: jeder Slow wird stärker, gesamt höchstens slowMax
export const meterSlow = pct => full('Frost') ? Math.max(pct, Math.min(M.Frost.slowMax, pct + M.Frost.slow)) : pct;
