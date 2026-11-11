// Gear-Sets (1 pro Magier, ARCH-06). Getrennt von data.ts, weil die Farbe aus baukasten.ts kommt (three).
// setId = Skin-ID des Set-Skins (skins.ts SKIN_LIST), Schule = Figur mit diesem Set (figureTable.ts FIGURES.set). Mit 1–4 Teilen gelten die eigenen Rolls, ohne Teilbonus.
// Mit 5/5 angelegt (und der passenden Schule): jeder Teil-Roll wird durch den Perfekt-Wert ersetzt, die Mechanik läuft (state.gearSet), der Set-Skin wird erzwungen.
// perfect: [Wirkung, Wert] je Slot, Wirkungen in apply.ts PERFECT. Alle Werte PH. color = Elementfarbe (ELEMENTS in baukasten.ts)

import { elementColor } from '../models/weapons/baukasten';
import type { Slot } from './data';

export const SETS: Record<string, { color: string; perfect: Record<Slot, [string, number]> }> = {
  glut: { color: elementColor('feuer'), perfect: { kopf: ['crit', 0.15], hals: ['fbExtra', 1], ruecken: ['fbCast', 0.1], arme: ['fbExtra', 1], koerper: ['fbCast', 0.1] } },
  blitz: { color: elementColor('blitz'), perfect: { kopf: ['chainJumps', 1], hals: ['chainKill', 0.005], ruecken: ['chainJumps', 1], arme: ['chainJumps', 1], koerper: ['chainCost', 0.15] } },
  seuche: { color: elementColor('seuche'), perfect: { kopf: ['burstDmg', 0.15], hals: ['contagion', 1], ruecken: ['contagion', 1], arme: ['burstTick', 0.25], koerper: ['burstDmg', 0.15] } },
  frost14: { color: elementColor('frost'), perfect: { kopf: ['shardMax', 5], hals: ['shardMax', 5], ruecken: ['needleShard', 0.1], arme: ['needleShard', 0.1], koerper: ['frozenDmg', 0.15] } },
};
