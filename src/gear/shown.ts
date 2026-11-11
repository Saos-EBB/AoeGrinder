// Gear und Kosmetik an der Figur (ARCH-06): was heroModel.ts an buildStrichMagier gibt (Form je Slot, Schichten, getragene Looks).

import { SHAFTS, MAKERS } from '../models/weapons/baukasten';
import { SLOTS, GROUP_OF_SHAFT, type Slot, type GearItem, type GearGroup } from './data';
import { worn, isMageFigure, forcedSkin, kosmetikIn } from './inventory';

const shaftOf = (value: string) => Object.keys(SHAFTS).find(k => SHAFTS[k].values.includes(value)) ?? null;
// Für Fenster und Modell: fehlt der Wert oder der Hersteller (sollte nach cleanGear nicht vorkommen) → null
export const groupOf = (g: GearItem | null): GearGroup | null => { const sh = g?.s?.value != null ? shaftOf(g.s.value) : null; return sh ? GROUP_OF_SHAFT[sh] : null; };
export const makerOf = (g: GearItem | null): string | null => (g?.s?.maker && g.s.maker in MAKERS ? g.s.maker : null);

// Gear an der Figur (models/gearParts.ts über heroModel.ts → buildStrichMagier opts.gear): je Slot Form (Wertgruppe) und Schichten des angelegten Teils.
// Regel look[slot] ?? gear[slot]: ein getragener Kosmetik-Look ersetzt das Teil (Modell: models/kosmetikParts.ts).
// Set 5/5 (forcedSkin) hat Vorrang: der Set-Skin wird erzwungen, keine Gear-Teile darüber. Nicht-Magier: nichts
export type GearShown = Partial<Record<Slot, { group: GearGroup; r: number; s: { maker: string; element: string; focus?: string } }>>;
export function gearShown(skin: string | null): GearShown | null {
  if (!isMageFigure(skin) || forcedSkin(skin)) return null;
  const out: GearShown = {};
  for (const slot of SLOTS) {
    const g = worn(slot), group = groupOf(g);
    if (!g || !group || kosmetikIn(slot)) continue;
    out[slot] = { group, r: g.r, s: { maker: makerOf(g) ?? 'stern', element: g.s.element, ...(g.s.focus ? { focus: g.s.focus } : {}) } };
  }
  return out;
}
// Kosmetik an der Figur (models/kosmetikParts.ts über heroModel.ts → buildStrichMagier opts.kosmetik): getragener Look je Slot (ohne Waffe).
// Set 5/5 hat Vorrang wie beim Gear (keine Kosmetik über dem Set-Skin). Nicht-Magier: nichts
export function kosmetikShown(skin: string | null): Partial<Record<Slot, string>> | null {
  if (!isMageFigure(skin) || forcedSkin(skin)) return null;
  const out: Partial<Record<Slot, string>> = {};
  for (const slot of SLOTS) { const id = kosmetikIn(slot); if (id) out[slot] = id; }
  return out;
}
export const gearKey = (skin: string | null) => JSON.stringify([gearShown(skin), kosmetikShown(skin)]);   // heroModel.ts baut neu, wenn sich das ändert
