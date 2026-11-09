// Gear neben der Waffe (Handoff docs/handoffs/items.md): 5 Slots mit Werten, nur Magier. Der Strichkrieger bekommt nichts davon.
// Kein zweites Roll-System: Seltenheit (rollTier), Werte (VALUE_KEY, ROLLS.values), Fokus (FOCUS_SPELLS), Element (ROLLS.elementChance) und der
// Treffer-Hook kommen aus weaponRolls.ts. Gear wirkt halb so stark wie die Waffe (GEAR.mul). Grundregel: nur erspielter Staub.
// Gespeichert in meta: gear (Inventar je Slot), wear (angelegt je Slot), gearOver (Funde, die nicht mehr ins volle Inventar passten), nextGear (Zähler).
// Fehlt ein Feld (alter Stand), gilt der Standardwert; nichts crasht.

import { state } from './state';
import { SPELLS, CARD_RARITIES } from './config';
import { meta, saveMeta } from './meta';
import { ROLLS, VALUE_KEY, FOCUS_SPELLS, rollTier, factor, pct, applyValue, applyFocus, weaponHit } from './weaponRolls';
import { ELEMENTS, elementColor } from './models/weapons/baukasten';
import { pick } from './util';
import { t } from './i18n';

export const SLOTS = ['kopf', 'hals', 'ruecken', 'arme', 'koerper'] as const;
export type Slot = typeof SLOTS[number];
export interface GearItem { id: number; v: 1; slot: Slot; r: number; s: { value?: string; focus?: string; element: string; setId?: string } }

// Alle Zahlen PH
export const GEAR = {
  invMax: 25,          // je Slot-Art, wie die Waffen (ROLLS.invMax)
  mul: 0.5,            // halb so stark wie die Waffe (Kevin: erst testen, dann tunen)
  focusShare: 0.5,     // Hälfte der Teile mit Fokus, der Rest mit 1 Wert
  keepFrom: 3,         // ab Blau ins Inventar; Grau wird Staub, Weiß/Grün gehen später in die Kosmetik-Sammlung (bis dahin Staub)
  baseNames: 3,        // Grundnamen je Slot (gear.base.<slot>.<n>)
};
const NO_MAKER = {};   // weaponHit erwartet einen Hersteller; Gear hat keinen

// Schule des gespielten Magiers (mage.skin) → Tag der Spells für den Fokus. ?-Magier: alle Schulen
const SCHOOL_TAG = { frost: 'Frost', feuer: 'Feuer', blitz: 'Blitz', blut: 'Seuche' };
export const isMagierSkin = (skin: string | null) => !!skin && skin !== 'krieger';

// ---------- Inventar ----------
export const gearInv = (slot: Slot): GearItem[] => {
  if (!meta.gear || typeof meta.gear !== 'object') meta.gear = {};
  if (!Array.isArray(meta.gear[slot])) meta.gear[slot] = [];
  return meta.gear[slot];
};
const wearMap = () => { if (!meta.wear || typeof meta.wear !== 'object') meta.wear = {}; return meta.wear; };
export const overflow = (): GearItem[] => { if (!Array.isArray(meta.gearOver)) meta.gearOver = []; return meta.gearOver; };
export const worn = (slot: Slot): GearItem | null => gearInv(slot).find(g => g.id === wearMap()[slot]) ?? null;
export const slotFull = (slot: Slot) => gearInv(slot).length >= GEAR.invMax;
export const sortedGear = (slot: Slot) => [...gearInv(slot)].sort((a, b) => b.r - a.r || b.id - a.id);

// Gespeichertes Feld säubern (localStorage, Spielstand-Code): unbekannte Slots, kaputte Teile und tote Verweise fallen weg
const okItem = (g: any, slot: string) => g && typeof g === 'object' && Number.isInteger(g.r) && g.r >= 0 && g.r < CARD_RARITIES.length && g.s && typeof g.s === 'object'
  && (g.s.value in VALUE_KEY || !!SPELLS[g.s.focus]) && (g.slot ?? slot) === slot;
export function cleanGear(m: any) {
  const gear = {}, wear = {};
  let maxId = Number.isInteger(m.nextGear) ? m.nextGear : 0;
  for (const slot of SLOTS) {
    gear[slot] = (Array.isArray(m.gear?.[slot]) ? m.gear[slot] : []).filter(g => okItem(g, slot)).map(g => fixItem({ ...g, slot }));
    for (const g of gear[slot]) maxId = Math.max(maxId, g.id);
    const id = m.wear?.[slot];
    wear[slot] = gear[slot].some(g => g.id === id) ? id : null;
  }
  m.gear = gear;
  m.wear = wear;
  m.gearOver = (Array.isArray(m.gearOver) ? m.gearOver : []).filter(g => SLOTS.includes(g?.slot) && okItem(g, g.slot)).map(fixItem);
  for (const g of m.gearOver) maxId = Math.max(maxId, g.id);
  m.nextGear = maxId;
}
function fixItem(g) {
  if (!Number.isInteger(g.id)) g.id = 0;
  g.v = 1;
  if (!(g.s.element in ELEMENTS)) g.s.element = 'none';
  return g;
}
cleanGear(meta);
// Ids doppelt oder fehlend (alter Stand ohne Zähler): neu vergeben
{ const seen = new Set(); for (const g of [...SLOTS.flatMap(s => meta.gear[s]), ...meta.gearOver]) { if (!g.id || seen.has(g.id)) g.id = ++meta.nextGear; seen.add(g.id); } }

// ---------- Würfeln ----------
// tier: feste Seltenheit (Dev, Tests), skin: gespielter Magier (Fokus aus seiner Schule)
export function rollGear(slot: Slot = pick([...SLOTS]), tier: number | null = null, skin: string | null = null): GearItem {
  const r = tier ?? rollTier(), tag = SCHOOL_TAG[skin];
  const els = Object.keys(ELEMENTS).filter(e => e !== 'none');
  const s: GearItem['s'] = { element: Math.random() < ROLLS.elementChance[r] ? pick(els) : 'none' };
  if (Math.random() < GEAR.focusShare) s.focus = pick(FOCUS_SPELLS.filter(id => SPELLS[id] && (!tag || SPELLS[id].tags.includes(tag))));
  else s.value = pick(Object.keys(VALUE_KEY));
  return { id: ++meta.nextGear, v: 1, slot, r, s };
}

// Drop im Run und Gear-Box: zufälliger Slot
export const rollDrop = (skin: string | null) => rollGear(pick([...SLOTS]), null, skin);

// Neues Teil (Drop, Gear-Box): Grau → Staub, Weiß/Grün → Staub bis es Kosmetik gibt, Blau und besser ins Inventar
// (Slot voll: in gearOver, das Run-Ende fragt, was bleibt). Gibt zurück, was passiert ist.
export function takeGear(g: GearItem): { kept: boolean; dust: number; over: boolean } {
  if (g.r < GEAR.keepFrom) {
    const dust = ROLLS.refund[g.r];   // TODO Kosmetik-Inhalte: Weiß und Grün in die Kosmetik-Sammlung
    meta.dust += dust;
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
  saveMeta();
}
// Löschen gibt Staub zurück wie bei der Waffe (deleteWeapon)
export function deleteGear(slot: Slot, id: number) {
  const g = gearInv(slot).find(x => x.id === id);
  if (!g) return;
  meta.gear[slot] = gearInv(slot).filter(x => x !== g);
  meta.dust += ROLLS.refund[g.r];
  if (wearMap()[slot] === id) wearMap()[slot] = null;
  saveMeta();
}

// ---------- Text ----------
const valueKey = (g: GearItem) => VALUE_KEY[g.s.value];
export const gearName = (g: GearItem) => t(`gear.base.${g.slot}.${g.id % GEAR.baseNames}`);
export const slotName = (slot: string) => t(`gear.slot.${slot}`);
export const gearRarity = (g: GearItem) => CARD_RARITIES[g.r];
// Werte-Zeilen wie effectLines bei der Waffe: Fokus oder Wert, dazu das Element
export function gearRows(g: GearItem): { kind: string; text: string; color?: string }[] {
  const f = factor(g.r) * GEAR.mul, rows = [];
  if (g.s.focus) rows.push({ kind: 'focus', text: t('wrow.focusText', { name: SPELLS[g.s.focus].name, dmg: pct(ROLLS.focus.dmg * f), radius: pct(ROLLS.focus.radius * f) }) });
  else { const k = valueKey(g); rows.push({ kind: 'value', text: `${pct((k === 'cd' ? -1 : 1) * ROLLS.values[k] * f)} ${t(`wval.${k}`)}` }); }
  if (g.s.element !== 'none') rows.push({ kind: 'element', text: t('wrow.perHit', { name: ELEMENTS[g.s.element].name, fx: ELEMENTS[g.s.element].fx, pct: pct(ROLLS.procChance * f).slice(1) }), color: elementColor(g.s.element) });
  return rows;
}
export const gearLines = (g: GearItem) => gearRows(g).map(r => r.text);

// ---------- Wirkung ----------
// Run-Start nach applyRunWeapon (mods frisch aus resetMods, spellStats aus resetSpells): Werte über mods/stat, Element-Proc über den Treffer-Hook
export function applyRunGear(skin: string | null) {
  if (!isMagierSkin(skin)) return;
  const procs: [string, number][] = [];
  for (const slot of SLOTS) {
    const g = worn(slot);
    if (!g) continue;
    const f = factor(g.r) * GEAR.mul;
    if (g.s.focus) applyFocus(g.s.focus, f, { s: { fv: 1 } });
    else applyValue(valueKey(g), ROLLS.values[valueKey(g)] * f);
    if (g.s.element !== 'none') procs.push([g.s.element, ROLLS.procChance * f]);
  }
  if (!procs.length) return;
  const prev = state.weaponHit;
  state.weaponHit = (m, dmg, crit, api) => {
    prev?.(m, dmg, crit, api);
    for (const [el, chance] of procs) weaponHit(m, dmg, crit, api, el, chance, NO_MAKER);
  };
}

// Dev / Tests
(window as any).__gear = { SLOTS, GEAR, rollGear, takeGear, wearGear, deleteGear, gearRows, gearName, applyRunGear, cleanGear, worn, gearInv, overflow };
