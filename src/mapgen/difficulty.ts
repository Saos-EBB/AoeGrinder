// Theme-Schwierigkeit 1–5 (themes.ts) als Faktoren auf Mob-Leben und -Schaden. Angewendet an EINER Stelle: spawnMob / hitPlayer in mobs.ts,
// gilt damit für alte und neue Mob-Typen. Alte Zonen ohne theme: Faktor 1.

import type { ThemeInfo } from './types';

export const DIFFICULTY = { hp: 0.25, dmg: 0.15 };   // PH: Leben ×(1 + 0,25 × (d − 1)), Schaden ×(1 + 0,15 × (d − 1))

export const hpMulOf = (theme?: ThemeInfo) => 1 + DIFFICULTY.hp * ((theme?.difficulty ?? 1) - 1);
export const dmgMulOf = (theme?: ThemeInfo) => 1 + DIFFICULTY.dmg * ((theme?.difficulty ?? 1) - 1);
