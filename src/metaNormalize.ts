// Eine Säuberung für den Spielstand, benutzt beim Start (gear/inventory.ts initGear, aus main.ts) und beim Spielstand-Code (ui/saveCode.ts importCode).
// Reihenfolge: Waffen → Skins/Erfolge → Zähler → Maps → Gear/Kosmetik → doppelte Gear-Ids → Schema-Version. Jeder Schritt einzeln abgesichert: schlägt einer fehl,
// fällt nur sein Feld auf Standard, der Rest bleibt. Alle Schritte sind wiederholbar (zweimal säubern = einmal), deshalb darf meta.ts beim Laden
// die frühen Schritte schon vorziehen (andere Module lesen meta beim Import) und mapgen/progress.ts die Maps.
// Läuft erst, wenn alle Module geladen sind (gear/inventory.ts initGear aus main.ts). Seit E10 ohne weaponRolls/world/render importierbar: Tests in tests/metaNormalize.test.ts.

import { cleanWeapon, cleanSkinState, cleanStats } from './meta';
import { cleanMaps } from './mapgen/mapOrder';
import { SLOTS } from './gear/data';
import { cleanGear } from './gear/rules';
import { cleanAch } from './skins';
import { META_SCHEMA, metaSchemaOf } from './storage';

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
    m.gear = Object.fromEntries(SLOTS.map((s): [string, unknown[]] => [s, []])); m.wear = Object.fromEntries(SLOTS.map((s): [string, null] => [s, null])); m.gearOver = []; m.looks = []; m.lookWear = {};
    if (!Number.isInteger(m.nextGear)) m.nextGear = 0;
  });
  // Ids doppelt oder fehlend (alter Stand ohne Zähler): neu vergeben
  const seen = new Set();
  for (const g of [...SLOTS.flatMap(s => m.gear[s]), ...m.gearOver]) { if (!g.id || seen.has(g.id)) g.id = ++m.nextGear; seen.add(g.id); }
  // Schema-Version (storage.ts): fehlt = 0, nach dem Säubern gilt der heutige Stand. Gespeichert wird sie mit dem nächsten saveMeta
  m.schema = Math.max(metaSchemaOf(m), META_SCHEMA);
  return m;
}
