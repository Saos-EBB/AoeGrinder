// Gear neben der Waffe (Handoff docs/handoffs/items.md): 5 Slots mit Werten, nur Magier. Der Strichkrieger bekommt nichts davon.
// Kein zweites Roll-System: Seltenheit (rollTier), Werte (VALUE_KEY, ROLLS.values), Fokus (FOCUS_SPELLS), Element (ROLLS.elementChance) und der
// Treffer-Hook kommen aus weaponRolls.ts. Gear wirkt halb so stark wie die Waffe (GEAR.mul). Grundregel: nur erspielter Staub.
// Schichten je Teil (Gear-Baukasten v3, docs/ref/gear-baukasten.html): immer 1 Wert (→ Wertgruppe = Form am Modell), ab Blau mit focusShare ein Fokus (→ Emblem),
// immer ein Hersteller (→ Material, Trait halb so stark wie bei der Waffe), Element wie bei der Waffe, Seltenheit (→ Glühen, Extras).
// Gespeichert in meta: gear (Inventar je Slot), wear (angelegt je Slot), gearOver (Funde, die nicht mehr ins volle Inventar passten), nextGear (Zähler).
// Fehlt ein Feld (alter Stand), gilt der Standardwert; nichts crasht.

import { state } from './state';
import { SPELLS, CARD_RARITIES, mods } from './config';
import { meta, saveMeta, grantAch } from './meta';
import { setAch } from './skins';
import { ROLLS, VALUE_KEY, FOCUS_SPELLS, rollTier, factor, pct, applyValue, applyFocus, weaponHit } from './weaponRolls';
import { ELEMENTS, MAKERS, SHAFTS, elementColor } from './models/weapons/baukasten';
import { pick } from './util';
import { t } from './i18n';

export const SLOTS = ['kopf', 'hals', 'ruecken', 'arme', 'koerper'] as const;
export type Slot = typeof SLOTS[number];
export interface GearItem { id: number; v: 1; slot: Slot; r: number; s: { value: string; focus?: string; element: string; maker: string; setId?: string } }

// Alle Zahlen PH
export const GEAR = {
  invMax: 25,          // je Slot-Art, wie die Waffen (ROLLS.invMax)
  mul: 0.5,            // halb so stark wie die Waffe (Kevin: erst testen, dann tunen)
  focusShare: 0.5,     // ab focusFrom: Anteil der Teile mit Fokus zusätzlich zum Wert
  focusFrom: 3,        // Fokus erst ab Blau
  makerMul: 0.5,       // Hersteller-Trait halb so stark wie bei der Waffe (ROLLS.maker)
  keepFrom: 3,         // ab Blau ins Inventar; Grau wird Staub, Weiß/Grün gehen später in die Kosmetik-Sammlung (bis dahin Staub)
  baseNames: 3,        // Grundnamen je Slot (gear.base.<slot>.<n>)
  setChance: 0.15,     // Anteil der Set-Teile an den Drops ab Blau, nur für den gespielten Magier
};

// ---------- Sets (1 pro Magier) ----------
// setId = Skin-ID des Set-Skins (skins.ts SKIN_LIST), school = mage.skin. Mit 1–4 Teilen gelten die eigenen Rolls, ohne Teilbonus.
// Mit 5/5 angelegt (und der passenden Schule): jeder Teil-Roll wird durch den Perfekt-Wert ersetzt, die Mechanik läuft (state.gearSet), der Set-Skin wird erzwungen.
// perfect: [Wirkung, Wert] je Slot, Wirkungen in PERFECT unten. Alle Werte PH
export const SETS: Record<string, { school: string; color: string; perfect: Record<Slot, [string, number]> }> = {
  glut: { school: 'feuer', color: '#ff7a22', perfect: { kopf: ['crit', 0.15], hals: ['fbExtra', 1], ruecken: ['fbCast', 0.1], arme: ['fbExtra', 1], koerper: ['fbCast', 0.1] } },
  blitz: { school: 'blitz', color: '#ffe866', perfect: { kopf: ['chainJumps', 1], hals: ['chainKill', 0.005], ruecken: ['chainJumps', 1], arme: ['chainJumps', 1], koerper: ['chainCost', 0.15] } },
  seuche: { school: 'blut', color: '#7dff3a', perfect: { kopf: ['burstDmg', 0.15], hals: ['contagion', 1], ruecken: ['contagion', 1], arme: ['burstTick', 0.25], koerper: ['burstDmg', 0.15] } },
  frost14: { school: 'frost', color: '#9fe4ff', perfect: { kopf: ['shardMax', 5], hals: ['shardMax', 5], ruecken: ['needleShard', 0.1], arme: ['needleShard', 0.1], koerper: ['frozenDmg', 0.15] } },
};
// Riesen-Feuerball (Glutprophet): jeder every-te Feuerball, size × Größe und Radius, dmg × Schaden
export const GIANT_FB = { every: 10, size: 3, dmg: 3 };
// Splitterkönig: Gletschernadel länger, am Endpunkt eine Frost Nova (spells/needle.ts)
export const SHARD_NEEDLE = { len: 1.5 };
// Hochspannung: jeder Sprung des Kettenblitzes gabelt sich mit fork in 2 Ketten; cap: höchstens so viele Sprünge pro Wurf, alle Äste zusammen (spells/chain.ts)
export const HV_FORK = { fork: 0.2, cap: 400 };
const stat = (id: string) => state.spellStats[id] ??= { dmg: 1, mana: 1, radius: 1 };   // wie spells/core.ts stat, ohne Import-Kreis
const PERFECT: Record<string, (v: number) => void> = {
  crit: v => { mods.crit += v; },
  fbExtra: v => { mods.fbExtra += v; },
  fbCast: v => { const s = stat('fireball'); s.cast = (s.cast ?? 1) - v; },
  shardMax: v => { mods.shardMax += v; },
  needleShard: v => { mods.needleShard += v; },
  frozenDmg: v => { mods.frozenDmg += v; },
  chainJumps: v => { mods.chainJumps += v; },
  chainKill: v => { mods.chainKill += v; },
  chainCost: v => { stat('chain').mana -= v; },
  burstDmg: v => { mods.burstDmg += v; },
  contagion: v => { mods.contagion += v; },
  burstTick: v => { mods.burstTick += v; },
};
export const setOfSchool = (skin: string | null) => Object.keys(SETS).find(id => SETS[id].school === skin) ?? null;
export const setCount = (setId: string) => SLOTS.filter(s => worn(s)?.s.setId === setId).length;
// Aktives Set des gespielten Magiers: alle 5 Teile angelegt und die Schule passt
export const fullSet = (skin: string | null) => { const id = setOfSchool(skin); return id && setCount(id) === SLOTS.length ? id : null; };
// Set-Skin, solange 5/5 angelegt ist (mage.ts). Die gespeicherte Skin-Wahl bleibt
export const forcedLook = (skin: string | null) => fullSet(skin);
export const perfectText = (setId: string, slot: Slot) => { const [k, v] = SETS[setId].perfect[slot]; return t(`gear.perfect.${k}`, { n: Math.round(v * (v < 1 ? 1000 : 10)) / 10 }); };

// Wertgruppe = Schaft-Gruppe des Werts (SHAFTS, wie rollWeapon) → Form am Modell (Gruppen des Viewers, models/gearParts.ts)
export const GROUP_OF_SHAFT = { gerade: 'off', gedreht: 'tempo', geknotet: 'leben', segmentiert: 'mana', umwickelt: 'radius' } as const;
export type GearGroup = typeof GROUP_OF_SHAFT[keyof typeof GROUP_OF_SHAFT];
export const GEAR_GROUPS = Object.values(GROUP_OF_SHAFT);
const shaftOf = (value: string) => Object.keys(SHAFTS).find(k => SHAFTS[k].values.includes(value)) ?? null;
// Für Fenster und Modell: fehlt der Wert oder der Hersteller (sollte nach cleanGear nicht vorkommen) → null
export const groupOf = (g: GearItem | null): GearGroup | null => { const sh = g?.s?.value != null ? shaftOf(g.s.value) : null; return sh ? GROUP_OF_SHAFT[sh] : null; };
export const makerOf = (g: GearItem | null): string | null => (g?.s?.maker && g.s.maker in MAKERS ? g.s.maker : null);
// Hersteller-Trait mit makerMul (Werte aus ROLLS.maker, Wege wie applyRunWeapon)
const halfMaker = (id: string) => Object.fromEntries(Object.entries(ROLLS.maker[id] ?? {}).map(([k, v]) => [k, (v as number) * GEAR.makerMul])) as Record<string, number>;

// Kosmetik (meta.looks: freigeschaltet, meta.lookWear: getragen je Slot oder 'waffe'). Regel: Look vor Gear. Nur Aussehen, keine Werte.
// Einziger Inhalt bisher: Waffen-Look Haarspray + Feuerzeug (models/weapons/defs.ts), frei bei Glutprophet 5/5 (unlock: Set, dessen 5 Teile angelegt sein müssen)
export const LOOK_SLOTS = ['kopf', 'hals', 'ruecken', 'arme', 'koerper', 'waffe'] as const;
export const LOOKS: Record<string, { slot: typeof LOOK_SLOTS[number]; name: string; unlock?: string }> = {
  haarspray: { slot: 'waffe', name: 'wmodel.haarspray.name', unlock: 'glut' },
};

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
  m.looks = (Array.isArray(m.looks) ? m.looks : []).filter(id => LOOKS[id]);
  m.lookWear = Object.fromEntries(LOOK_SLOTS.map(s => { const id = m.lookWear?.[s]; return [s, LOOKS[id]?.slot === s && m.looks.includes(id) ? id : null]; }));
  m.gearOver = (Array.isArray(m.gearOver) ? m.gearOver : []).filter(g => SLOTS.includes(g?.slot) && okItem(g, g.slot)).map(fixItem);
  for (const g of m.gearOver) maxId = Math.max(maxId, g.id);
  m.nextGear = maxId;
}
let migrated = 0;   // Teile, die beim Säubern einen Wert oder Hersteller bekamen (initGear speichert dann)
function fixItem(g) {
  if (!Number.isInteger(g.id)) g.id = 0;
  // Alter Stand (vor v36): Teile mit nur Fokus bekommen einen zufälligen Wert, ohne Hersteller einen zufälligen Hersteller. Der Fokus bleibt
  if (!(g.s.value in VALUE_KEY)) { g.s.value = pick(Object.keys(VALUE_KEY)); migrated++; }
  if (!(g.s.maker in MAKERS)) { g.s.maker = pick(Object.keys(MAKERS)); migrated++; }
  if (g.s.focus != null && !SPELLS[g.s.focus]) delete g.s.focus;
  if (g.s.setId != null && !SETS[g.s.setId]) delete g.s.setId;
  g.v = 1;
  if (!(g.s.element in ELEMENTS)) g.s.element = 'none';
  return g;
}
// Beim Start aus main.ts, nicht beim Laden des Moduls: gear.ts hängt über Import-Zyklen (weaponRolls ↔ spells ↔ gear) und würde sonst
// VALUE_KEY lesen, bevor weaponRolls.ts fertig ist (ReferenceError, sobald gespeichertes Gear da ist)
export function initGear() {
  migrated = 0;
  cleanGear(meta);
  // Ids doppelt oder fehlend (alter Stand ohne Zähler): neu vergeben
  const seen = new Set();
  for (const g of [...SLOTS.flatMap(s => meta.gear[s]), ...meta.gearOver]) { if (!g.id || seen.has(g.id)) g.id = ++meta.nextGear; seen.add(g.id); }
  checkUnlocks(true);   // alter Stand mit schon angelegtem 5/5: Erfolg nachtragen, ohne Einblendung
  if (migrated) saveMeta();   // gewürfelte Werte/Hersteller festhalten, sonst würfelt jeder Reload neu
}

// ---------- Würfeln ----------
// tier: feste Seltenheit (Dev, Tests), skin: gespielter Magier (Fokus aus seiner Schule)
export function rollGear(slot: Slot = pick([...SLOTS]), tier: number | null = null, skin: string | null = null): GearItem {
  const r = tier ?? rollTier(), tag = SCHOOL_TAG[skin];
  const els = Object.keys(ELEMENTS).filter(e => e !== 'none');
  const s: GearItem['s'] = { value: pick(Object.keys(VALUE_KEY)), maker: pick(Object.keys(MAKERS)), element: Math.random() < ROLLS.elementChance[r] ? pick(els) : 'none' };
  if (r >= GEAR.focusFrom && Math.random() < GEAR.focusShare) s.focus = pick(FOCUS_SPELLS.filter(id => SPELLS[id] && (!tag || SPELLS[id].tags.includes(tag))));
  return { id: ++meta.nextGear, v: 1, slot, r, s };
}

// Drop im Run und Gear-Box: zufälliger Slot
export function rollDrop(skin: string | null) {
  const g = rollGear(pick([...SLOTS]), null, skin), set = setOfSchool(skin);
  if (set && g.r >= GEAR.keepFrom && Math.random() < GEAR.setChance) g.s.setId = set;
  return g;
}

// ---------- Boxen im Shop (Grundregel: nur erspielter Staub) ----------
export const BOX = { gear: 120, look: 120 };   // PH
// Kosmetik-Pool der Kosmetik-Box: leer, bis es Inhalte gibt (TODO Kosmetik-Inhalte, Plan Nr. 21). Haarspray + Feuerzeug kommt nur über Glutprophet 5/5
export const KOSMETIK_POOL: string[] = [];
export const anySlotFull = () => SLOTS.some(slotFull);
// Gear-Box: zufälliger Slot, gleiche Regeln wie ein Drop. Gesperrt, solange ein Slot-Tab voll ist (sonst müsste der Shop nach dem Behalten fragen)
export function buyGearBox(skin: string | null) {
  if (anySlotFull() || meta.dust < BOX.gear) return null;
  meta.dust -= BOX.gear;
  const g = rollDrop(skin);
  return { g, res: takeGear(g) };
}
function looksOwned(): string[] { if (!Array.isArray(meta.looks)) meta.looks = []; return meta.looks; }
export const lookBoxLeft = () => KOSMETIK_POOL.filter(id => !looksOwned().includes(id));
// Kosmetik-Box: nie Duplikate
export function buyLookBox() {
  const left = lookBoxLeft();
  if (!left.length || meta.dust < BOX.look) return null;
  meta.dust -= BOX.look;
  const id = pick(left);
  looksOwned().push(id);
  saveMeta();
  return id;
}

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
  checkUnlocks();
  saveMeta();
}
// Freischalten, sobald ein Set mit allen 5 Teilen angelegt ist (unabhängig von der Schule, die gerade gespielt wird): Kosmetik und der Erfolg
// „Set <Name> 5/5“, der den Set-Skin dauerhaft frei macht (skins.ts skinLock). Neuer Erfolg → Ereignis fg:ach (ui/achievements.ts blendet ein). quiet: ohne Einblendung
export function checkUnlocks(quiet = false) {
  for (const [id, L] of Object.entries(LOOKS)) if (L.unlock && setCount(L.unlock) === SLOTS.length && !looksOwned().includes(id)) looksOwned().push(id);
  for (const id of Object.keys(SETS)) if (setCount(id) === SLOTS.length && grantAch(setAch(id)) && !quiet) dispatchEvent(new CustomEvent('fg:ach', { detail: setAch(id) }));
}
const lookWearMap = () => { if (!meta.lookWear || typeof meta.lookWear !== 'object') meta.lookWear = {}; return meta.lookWear; };
export const hasLook = (id: string) => looksOwned().includes(id);
// Getragener Look im Slot (nur wenn freigeschaltet), sonst null = die Figur zeigt das Gear
export const lookIn = (slot: string) => { const id = lookWearMap()[slot]; return id && LOOKS[id]?.slot === slot && hasLook(id) ? id : null; };
export function wearLook(slot: string, id: string | null) {
  lookWearMap()[slot] = id && LOOKS[id]?.slot === slot && hasLook(id) ? id : null;
  saveMeta();
}
// Waffen-Look der Magier (mage.ts baut dann dieses Modell statt der Waffe, fireball.ts den Flammenstoß)
export const weaponLook = () => lookIn('waffe');
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
export const gearName = (g: GearItem) => g.s.setId ? t(`gear.set.${g.s.setId}.${g.slot}`) : t(`gear.base.${g.slot}.${g.id % GEAR.baseNames}`);
export const slotName = (slot: string) => t(`gear.slot.${slot}`);
export const gearRarity = (g: GearItem) => CARD_RARITIES[g.r];
// Werte-Zeilen wie effectLines bei der Waffe: Wert, ggf. Fokus, Element, Hersteller
export function gearRows(g: GearItem): { kind: string; text: string; color?: string }[] {
  const f = factor(g.r) * GEAR.mul, rows = [];
  const k = valueKey(g); rows.push({ kind: 'value', text: `${pct((k === 'cd' ? -1 : 1) * ROLLS.values[k] * f)} ${t(`wval.${k}`)}` });
  if (g.s.focus) rows.push({ kind: 'focus', text: t('wrow.focusText', { name: SPELLS[g.s.focus].name, dmg: pct(ROLLS.focus.dmg * f), radius: pct(ROLLS.focus.radius * f) }) });
  if (g.s.element !== 'none') rows.push({ kind: 'element', text: t('wrow.perHit', { name: ELEMENTS[g.s.element].name, fx: ELEMENTS[g.s.element].fx, pct: pct(ROLLS.procChance * f).slice(1) }), color: elementColor(g.s.element) });
  if (makerOf(g)) rows.push({ kind: 'maker', text: t('gear.makerHalf', { name: MAKERS[g.s.maker].name, trait: MAKERS[g.s.maker].trait }) });
  return rows;
}
export const gearLines = (g: GearItem) => gearRows(g).map(r => r.text);

// ---------- Wirkung ----------
// Run-Start nach applyRunWeapon (mods frisch aus resetMods, spellStats aus resetSpells): Werte über mods/stat, Element-Proc über den Treffer-Hook
export function applyRunGear(skin: string | null) {
  state.gearSet = null;
  if (!isMagierSkin(skin)) return;
  const procs: [string, number, Record<string, number>][] = [], set = fullSet(skin);
  state.gearSet = set;
  for (const slot of SLOTS) {
    const g = worn(slot);
    if (!g) continue;
    if (set) { const [k, v] = SETS[set].perfect[slot]; PERFECT[k](v); continue; }   // 5/5: Perfekt-Wert statt eigenem Roll
    const f = factor(g.r) * GEAR.mul;
    applyValue(valueKey(g), ROLLS.values[valueKey(g)] * f);
    if (g.s.focus) applyFocus(g.s.focus, f, { s: { fv: 1 } });
    const M = makerOf(g) ? halfMaker(g.s.maker) : {};
    if (M.dmg) mods.dmg += M.dmg;
    if (M.cast) mods.castMul += M.cast;
    if (M.crit) mods.crit += M.crit;
    if (M.dur) mods.durMul += M.dur;
    if (M.random) applyValue(pick(Object.values(VALUE_KEY)), M.random);
    if (M.cd) applyValue('cd', -M.cd);
    if (M.mana) mods.manaMult += M.mana;
    if (M.hp) mods.hpMult += M.hp;
    const chance = g.s.element !== 'none' ? ROLLS.procChance * f : 0;
    if (chance || M.lifesteal || M.critMana) procs.push([g.s.element, chance, M]);
  }
  if (!procs.length) return;
  const prev = state.weaponHit;
  state.weaponHit = (m, dmg, crit, api) => {
    prev?.(m, dmg, crit, api);
    for (const [el, chance, M] of procs) weaponHit(m, dmg, crit, api, el, chance, M);
  };
}

// Dev: Set des Schul-Magiers anlegen (n Teile, Rest leer), ohne Staub und Limit. Seltenheit lila
export function devWearSet(setId: string, n: number = SLOTS.length) {
  SLOTS.forEach((slot, i) => {
    if (i >= n) { wearMap()[slot] = null; return; }
    const g = rollGear(slot, 4, SETS[setId].school);
    g.s.setId = setId;
    gearInv(slot).push(g);
    wearMap()[slot] = g.id;
  });
  checkUnlocks();
  saveMeta();
}

// Dev: Set-Erfolg (= Set-Skin frei) setzen oder entfernen, ohne Gear
export function devSetAch(setId: string, on: boolean) {
  const a = setAch(setId);
  meta.achievements = meta.achievements.filter(x => x !== a);
  if (on) meta.achievements.push(a);
  saveMeta();
}

// Dev / Tests
(window as any).__gear = { groupOf, makerOf, devSetAch, checkUnlocks, wearLook, lookIn, devWearSet, SETS, fullSet, setCount, SLOTS, GEAR, rollGear, takeGear, wearGear, deleteGear, gearRows, gearName, applyRunGear, cleanGear, worn, gearInv, overflow };
