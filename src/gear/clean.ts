// Gespeichertes Gear säubern (localStorage, Spielstand-Code), ARCH-06: reine Migration ohne Imports außer data.ts, damit sie in Node testbar ist.
// Die Tabellen der anderen Module (Werte, Hersteller, Elemente, Spells, Seltenheiten, Sets) und das Würfeln kommen als Regeln herein (rules.ts gearRules).
// Unbekannte Slots, kaputte Teile und tote Verweise fallen weg.

import { SLOTS, KOSMETIK, KOSMETIK_SLOTS } from './data';

export interface CleanRules {
  values: Record<string, unknown>;      // VALUE_KEY (weaponRolls.ts)
  makers: Record<string, unknown>;      // MAKERS (baukasten.ts)
  elements: Record<string, unknown>;    // ELEMENTS (baukasten.ts)
  spells: Record<string, unknown>;      // SPELLS (spells/registry.ts, zur Laufzeit gefüllt)
  sets: Record<string, unknown>;        // SETS (sets.ts)
  rarities: number;                     // CARD_RARITIES.length
  pick: <T>(arr: T[]) => T;             // util.ts pick (Math.random)
}

const isValidGearItem = (g: any, slot: string, R: CleanRules) => g && typeof g === 'object' && Number.isInteger(g.r) && g.r >= 0 && g.r < R.rarities && g.s && typeof g.s === 'object'
  && (g.s.value in R.values || !!R.spells[g.s.focus]) && (g.slot ?? slot) === slot;
export function cleanGearWith(m: any, R: CleanRules) {
  const gear: any = {}, wear: any = {};
  let maxId = Number.isInteger(m.nextGear) ? m.nextGear : 0;
  for (const slot of SLOTS) {
    gear[slot] = (Array.isArray(m.gear?.[slot]) ? m.gear[slot] : []).filter((g: any) => isValidGearItem(g, slot, R)).map((g: any) => cleanGearItem({ ...g, slot }, R));
    for (const g of gear[slot]) maxId = Math.max(maxId, g.id);
    const id = m.wear?.[slot];
    wear[slot] = gear[slot].some((g: any) => g.id === id) ? id : null;
  }
  m.gear = gear;
  m.wear = wear;
  m.looks = (Array.isArray(m.looks) ? m.looks : []).filter((id: string) => KOSMETIK[id]);
  const owns = (id: string) => m.looks.includes(id) || !!KOSMETIK[id]?.ach && Array.isArray(m.achievements) && m.achievements.includes(KOSMETIK[id].ach);
  m.lookWear = Object.fromEntries(KOSMETIK_SLOTS.map(s => { const id = m.lookWear?.[s]; return [s, KOSMETIK[id]?.slot === s && owns(id) ? id : null]; }));
  m.gearOver = (Array.isArray(m.gearOver) ? m.gearOver : []).filter((g: any) => SLOTS.includes(g?.slot) && isValidGearItem(g, g.slot, R)).map((g: any) => cleanGearItem(g, R));
  for (const g of m.gearOver) maxId = Math.max(maxId, g.id);
  m.nextGear = maxId;
}
let migrated = 0;   // Teile, die beim Säubern einen Wert oder Hersteller bekamen (inventory.ts initGear speichert dann)
export const resetMigrated = () => { migrated = 0; };
export const migratedCount = () => migrated;
function cleanGearItem(g: any, R: CleanRules) {
  if (!Number.isInteger(g.id)) g.id = 0;
  // Alter Stand (vor v36): Teile mit nur Fokus bekommen einen zufälligen Wert, ohne Hersteller einen zufälligen Hersteller. Der Fokus bleibt
  if (!(g.s.value in R.values)) { g.s.value = R.pick(Object.keys(R.values)); migrated++; }
  if (!(g.s.maker in R.makers)) { g.s.maker = R.pick(Object.keys(R.makers)); migrated++; }
  if (g.s.focus != null && !R.spells[g.s.focus]) delete g.s.focus;
  if (g.s.setId != null && !R.sets[g.s.setId]) delete g.s.setId;
  g.v = 1;
  if (!(g.s.element in R.elements)) g.s.element = 'none';
  return g;
}
