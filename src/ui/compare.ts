// ▲/▼ gegenüber dem Ausgerüsteten: eine Regel für Waffen und Gear (Charakterfenster, Hover-Karte, Shop).
// Rechnet auf den Zahlen aus mainValue (weaponRolls.ts) / gearMainValue (gear/text.ts), nie auf dem Anzeigetext.

import type { MainValue } from '../weaponRolls';
import { COLORS } from './colors';
import { fmtNum } from '../i18n';

// Stärke des Hauptwerts: größer = besser, bei Abklingzeit (negativ) zählt die stärkere Reduktion
export const mainStrength = (m: MainValue | null) => !m ? 0 : m.key === 'cd' ? -m.v : m.v;
// Unterschied a gegenüber b in Prozentpunkten, > 0 = besser. null: anderes Wert-Wort, fehlender Wert oder gleich stark (kein „▼ −0 %“)
export function mainDelta(a: MainValue | null, b: MainValue | null): number | null {
  if (!a || !b || a.key !== b.key) return null;
  const d = Math.round((mainStrength(a) - mainStrength(b)) * 10) / 10;
  return d === 0 ? null : d;
}
// „▲ +1,5 %“ / „▼ −1,5 %“; unit false für die schmale Baum-Zeile
export const fmtDelta = (d: number, unit = true) => `${d > 0 ? '▲ +' : '▼ −'}${fmtNum(Math.abs(d))}${unit ? ' %' : ''}`;
export const deltaColor = (d: number) => d > 0 ? COLORS.up : COLORS.down;
// Großer Hauptwert auf der Hover-Karte („+6 %“, Abklingzeit „-6 %“ wie bisher)
export const fmtMain = (m: MainValue) => `${m.v > 0 ? '+' : ''}${fmtNum(m.v)} %`;
