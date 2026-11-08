// Geparkt am 2026-11-08 aus src/schoolMeter.ts: Arkane Ladungen der Arkan-Figur (v31). Zahlen in SCHOOL_METER.Arkan (maybeLater/src/config.parked.ts).
// meter bekam dafür charges: 0, lastArc: -1e9; meterSchool() kannte 'Arkan'; meterValue: arcane() ? meter.charges / A.max; meterKill brach bei arcane() ab.

const A = M.Arkan;
const arcane = () => meterSchool() === 'Arkan';

// in meterCast(tags, id?):
  if (!arcane() || !tags?.includes('Arkan')) return;
  meter.lastArc = state.now;                                  // jeder Arkan-Zauber hält die Ladungen
  if (A.gain.includes(id)) addArcCharge();

// Arkane Ladungen (v31)
export const arcCharges = () => arcane() ? meter.charges : 0;
export function addArcCharge() { if (arcane()) { meter.charges = Math.min(A.max, meter.charges + 1); meter.lastArc = state.now; } }
export function takeArcCharges() { const n = arcCharges(); meter.charges = 0; return n; }
export const arcDmgMul = () => 1 + A.dmg * arcCharges();
export const arcCostMul = () => 1 + A.cost * arcCharges();

// in updateMeter(dt), erste Zeile:
  if (arcane()) { if (state.now - meter.lastArc > A.idleMs) meter.charges = 0; return 0; }
// in setMeter(v):
  if (arcane()) { meter.charges = Math.round(v * A.max); meter.lastArc = state.now; return; }

// Nutzer: spells/core.ts (if (hasTag(id, 'Arkan')) dmg *= arcDmgMul();), formulas.ts manaCost (s.tags?.includes('Arkan') ? arcCostMul() : 1),
// ui/charInfo.ts arcane(), ui/hud.ts (if (school === 'Arkan') …), arcane2.ts, arcRelics.ts
