// Ausgerüstete Waffe und ihr Modell (ARCH-11, aus weaponRolls.ts): nur meta, Roll-Tabellen und Modell-Bau, keine Spiellogik.
// So kann models/heroModel.ts die Waffe bauen, ohne weaponRolls.ts (Import-Kreis über spells/legends/mobs) zu laden. weaponRolls.ts exportiert weiter.
import { meta } from './meta';
import { ROLLS } from './rollTables';
import { buildWeapon } from './models/weapons/index';
import { buildBaukastenWeapon } from './models/weapons/baukasten';

export const isNew = w => w.v === 2;
// Für Filter und Sortierung im Inventar: alte Waffen haben kein Element und keinen Baukasten-Typ
export const elementOf = w => isNew(w) ? w.s.element : 'none';
export const typeOf = w => isNew(w) ? w.s.type : 'alt';

export const equipped = () => meta.inv.find(w => w.id === meta.equipped) ?? null;
// Modell der gewählten Waffe: neue aus dem Baukasten, Unikate und alte Waffen aus models/weapons
export function buildWeaponOf(w) {
  if (!w) return buildWeapon(ROLLS.fallback);
  if (!isNew(w)) return buildWeapon(w.m);
  return w.s.unique ? buildWeapon(w.s.unique) : buildBaukastenWeapon(w.s);
}
export const buildEquipped = () => buildWeaponOf(equipped());
