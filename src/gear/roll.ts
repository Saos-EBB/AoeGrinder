// Gear würfeln (ARCH-06): Teil, Drop im Run, Boxen im Shop (Grundregel: nur erspielter Staub).

import { SPELLS } from '../config';
import { meta, saveMeta } from '../meta';
import { ROLLS, VALUE_KEY, FOCUS_SPELLS, rollRarity } from '../rollTables';
import { ELEMENTS, MAKERS } from '../models/weapons/baukasten';
import { pick } from '../util';
import { FIGURES } from '../figureTable';
import { SLOTS, GEAR, BOX, type Slot, type GearItem } from './data';
import { setOfFigure, anySlotFull, takeGear, kosmetikBoxLeft, kosmetikOwned } from './inventory';

// Schule des gespielten Magiers (heroModel.figureId) → Tag der Spells für den Fokus (figureTable.ts). ?-Magier und Krieger: alle Schulen
const schoolTag = (skin: string | null) => (FIGURES[skin]?.element ? FIGURES[skin].tag : undefined);

// rarity: feste Seltenheit (Dev, Tests), skin: gespielter Magier (Fokus aus seiner Schule)
export function rollGear(slot: Slot = pick([...SLOTS]), rarity: number | null = null, skin: string | null = null): GearItem {
  const r = rarity ?? rollRarity(), tag = schoolTag(skin);
  const els = Object.keys(ELEMENTS).filter(e => e !== 'none');
  const s: GearItem['s'] = { value: pick(Object.keys(VALUE_KEY)), maker: pick(Object.keys(MAKERS)), element: Math.random() < ROLLS.elementChance[r] ? pick(els) : 'none' };
  if (r >= GEAR.focusFrom && Math.random() < GEAR.focusShare) s.focus = pick(FOCUS_SPELLS.filter(id => SPELLS[id] && (!tag || SPELLS[id].tags.includes(tag))));
  return { id: ++meta.nextGear, v: 1, slot, r, s };
}

// Drop im Run und Gear-Box: zufälliger Slot
export function rollDrop(skin: string | null) {
  const g = rollGear(pick([...SLOTS]), null, skin), set = setOfFigure(skin);
  if (set && g.r >= GEAR.keepFrom && Math.random() < GEAR.setChance) g.s.setId = set;
  return g;
}

// ---------- Boxen im Shop ----------
// Gear-Box: zufälliger Slot, gleiche Regeln wie ein Drop. Gesperrt, solange ein Slot-Tab voll ist (sonst müsste der Shop nach dem Behalten fragen)
export function buyGearBox(skin: string | null) {
  if (anySlotFull() || meta.dust < BOX.gear) return null;
  meta.dust -= BOX.gear;
  const g = rollDrop(skin);
  return { g, res: takeGear(g, false) };
}
// Kosmetik-Box: nie Duplikate
export function buyKosmetikBox() {
  const left = kosmetikBoxLeft();
  if (!left.length || meta.dust < BOX.kosmetik) return null;
  meta.dust -= BOX.kosmetik;
  const id = pick(left);
  kosmetikOwned().push(id);
  saveMeta();
  return id;
}
