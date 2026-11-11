// Gear-Inventar und Kosmetik-Besitz (ARCH-06): Inventar je Slot, Anlegen, Löschen, neue Teile, Sets 5/5, Freischalten, Start-Säuberung.

import { meta, saveMeta, grantAch, hasAch, earnDust } from '../meta';
import { setAch } from '../skins';
import { ROLLS } from '../rollTables';
import { emit } from '../hooks';
import { FIGURES } from '../figureTable';
import { SLOTS, GEAR, KOSMETIK, KOSMETIK_POOL, type Slot, type GearItem } from './data';
import { SETS } from './sets';
import { resetMigrated, migratedCount } from './clean';

export const isMageFigure = (skin: string | null) => !!skin && skin !== 'krieger';

// ---------- Inventar ----------
export const gearInv = (slot: Slot): GearItem[] => {
  if (!meta.gear || typeof meta.gear !== 'object') meta.gear = {};
  if (!Array.isArray(meta.gear[slot])) meta.gear[slot] = [];
  return meta.gear[slot];
};
export const wearMap = () => { if (!meta.wear || typeof meta.wear !== 'object') meta.wear = {}; return meta.wear; };
export const overflow = (): GearItem[] => { if (!Array.isArray(meta.gearOver)) meta.gearOver = []; return meta.gearOver; };
export const worn = (slot: Slot): GearItem | null => gearInv(slot).find(g => g.id === wearMap()[slot]) ?? null;
export const slotFull = (slot: Slot) => gearInv(slot).length >= GEAR.invMax;
export const anySlotFull = () => SLOTS.some(slotFull);

// ---------- Sets ----------
export const setOfFigure = (skin: string | null) => FIGURES[skin]?.set ?? null;
export const setCount = (setId: string) => SLOTS.filter(s => worn(s)?.s.setId === setId).length;
// Aktives Set des gespielten Magiers: alle 5 Teile angelegt und die Schule passt
export const fullSet = (skin: string | null) => { const id = setOfFigure(skin); return id && setCount(id) === SLOTS.length ? id : null; };
// Set-Skin, solange 5/5 angelegt ist (heroModel.ts). Die gespeicherte Skin-Wahl bleibt
export const forcedSkin = (skin: string | null) => fullSet(skin);

// Beim Start aus main.ts, nicht beim Laden des Moduls: gear hängt über Import-Zyklen (weaponRolls ↔ spells ↔ gear)
// normalize = normalizeMeta aus metaNormalize.ts, von main.ts übergeben (kein Import hier, sonst Import-Kreis gear ↔ metaNormalize)
export function initGear(normalize: (m: any) => void) {
  resetMigrated();
  normalize(meta);   // ganze Säuberung (metaNormalize.ts), dieselbe wie beim Spielstand-Code
  checkUnlocks(true);   // alter Stand mit schon angelegtem 5/5: Erfolg nachtragen, ohne Einblendung
  if (migratedCount()) saveMeta();   // gewürfelte Werte/Hersteller festhalten, sonst würfelt jeder Reload neu
}

// ---------- Kosmetik-Besitz ----------
export function kosmetikOwned(): string[] { if (!Array.isArray(meta.looks)) meta.looks = []; return meta.looks; }
export const kosmetikBoxLeft = () => KOSMETIK_POOL.filter(id => !kosmetikOwned().includes(id));

// Neues Teil (Drop, Gear-Box): Grau, Weiß und Grün → Staub (so entschieden: Kosmetik kommt aus Box und Meilensteinen), Blau und besser ins Inventar
// (Slot voll: in gearOver, das Run-Ende fragt, was bleibt). Gibt zurück, was passiert ist.
// earned: Drop aus dem Spiel (zählt für den Meilenstein Staub gesamt), false bei der Gear-Box (gekauft)
export function takeGear(g: GearItem, earned = true): { kept: boolean; dust: number; over: boolean } {
  if (g.r < GEAR.keepFrom) {
    const dust = ROLLS.refund[g.r];
    if (earned) earnDust(dust); else meta.dust += dust;
    saveMeta();
    return { kept: false, dust, over: false };
  }
  const over = slotFull(g.slot);
  (over ? overflow() : gearInv(g.slot)).push(g);
  saveMeta();
  return { kept: true, dust: 0, over };
}

export function wearGear(slot: Slot, id: number | null) {
  wearMap()[slot] = id != null && gearInv(slot).some(g => g.id === id) ? id : null;
  checkUnlocks();
  saveMeta();
}
// Meilenstein-Teile (ach): frei, sobald der Erfolg da ist (meta.ts checkMilestones vergibt ihn).
// Freischalten, sobald ein Set mit allen 5 Teilen angelegt ist (unabhängig von der Schule, die gerade gespielt wird): Kosmetik und der Erfolg
// „Set <Name> 5/5“, der den Set-Skin dauerhaft frei macht (skins.ts skinLock). Neuer Erfolg → Bus ach (hooks.ts, ui/achievements.ts blendet ein). quiet: ohne Einblendung
export function checkUnlocks(quiet = false) {
  for (const [id, L] of Object.entries(KOSMETIK)) if ((L.unlock && setCount(L.unlock) === SLOTS.length || L.ach && hasAch(L.ach)) && !kosmetikOwned().includes(id)) kosmetikOwned().push(id);
  for (const id of Object.keys(SETS)) if (setCount(id) === SLOTS.length && grantAch(setAch(id)) && !quiet) emit('ach', setAch(id));
}
const kosmetikWearMap = () => { if (!meta.lookWear || typeof meta.lookWear !== 'object') meta.lookWear = {}; return meta.lookWear; };
export const hasKosmetik = (id: string) => kosmetikOwned().includes(id) || !!KOSMETIK[id]?.ach && hasAch(KOSMETIK[id].ach);   // Meilenstein-Teile: frei mit dem Erfolg
// Getragener Look im Slot (nur wenn freigeschaltet), sonst null = die Figur zeigt das Gear
export const kosmetikIn = (slot: string) => { const id = kosmetikWearMap()[slot]; return id && KOSMETIK[id]?.slot === slot && hasKosmetik(id) ? id : null; };
export function wearKosmetik(slot: string, id: string | null) {
  kosmetikWearMap()[slot] = id && KOSMETIK[id]?.slot === slot && hasKosmetik(id) ? id : null;
  saveMeta();
}
// Waffen-Look der Magier (heroModel.ts baut dann dieses Modell statt der Waffe, fireball.ts den Flammenstoß)
export const kosmetikWeapon = () => kosmetikIn('waffe');
// Löschen gibt Staub zurück wie bei der Waffe (deleteWeapon)
export function deleteGear(slot: Slot, id: number) {
  const g = gearInv(slot).find(x => x.id === id);
  if (!g) return;
  meta.gear[slot] = gearInv(slot).filter(x => x !== g);
  meta.dust += ROLLS.refund[g.r];
  if (wearMap()[slot] === id) wearMap()[slot] = null;
  saveMeta();
}
