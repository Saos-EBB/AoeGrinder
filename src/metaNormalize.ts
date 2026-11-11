// Eine Säuberung für den Spielstand, benutzt beim Start (gear.ts initGear, aus main.ts) und beim Spielstand-Code (ui/saveCode.ts importCode).
// Reihenfolge: Waffen → Skins/Erfolge → Zähler → Maps → Gear/Kosmetik → doppelte Gear-Ids. Jeder Schritt einzeln abgesichert: schlägt einer fehl,
// fällt nur sein Feld auf Standard, der Rest bleibt. Alle Schritte sind wiederholbar (zweimal säubern = einmal), deshalb darf meta.ts beim Laden
// die frühen Schritte schon vorziehen (andere Module lesen meta beim Import) und mapgen/progress.ts die Maps.
// Läuft erst, wenn alle Module geladen sind: cleanGear braucht weaponRolls.ts (Import-Zyklen, siehe gear.ts initGear).

import { cleanWeapon, cleanSkinState, cleanStats } from './meta';
import { cleanMaps } from './mapgen/progress';
import { cleanGear, SLOTS } from './gear';
import { cleanAch } from './skins';

function step(name: string, fn: () => void, reset: () => void) {
  try { fn(); } catch (e) { console.warn(`[meta] Säubern „${name}“ fehlgeschlagen, Feld auf Standard`, e); reset(); }
}

export function normalizeMeta(m: any) {
  if (!Array.isArray(m.inv)) m.inv = [];
  // Kaputte Waffe fällt raus; in place, die Liste selbst bleibt dieselbe
  for (let i = m.inv.length - 1; i >= 0; i--) step(`inv[${i}]`, () => cleanWeapon(m.inv[i]), () => m.inv.splice(i, 1));
  step('skins', () => cleanSkinState(m), () => { m.skins = {}; try { m.achievements = cleanAch(m.achievements); } catch { m.achievements = []; } });
  step('stats', () => { m.stats = cleanStats(m.stats); }, () => { m.stats = cleanStats(null); });
  step('maps', () => { m.maps = cleanMaps(m.maps); }, () => { m.maps = cleanMaps(null); });
  step('gear', () => cleanGear(m), () => {
    m.gear = Object.fromEntries(SLOTS.map(s => [s, []])); m.wear = Object.fromEntries(SLOTS.map(s => [s, null])); m.gearOver = []; m.looks = []; m.lookWear = {};
    if (!Number.isInteger(m.nextGear)) m.nextGear = 0;
  });
  // Ids doppelt oder fehlend (alter Stand ohne Zähler): neu vergeben
  const seen = new Set();
  for (const g of [...SLOTS.flatMap(s => m.gear[s]), ...m.gearOver]) { if (!g.id || seen.has(g.id)) g.id = ++m.nextGear; seen.add(g.id); }
  return m;
}
