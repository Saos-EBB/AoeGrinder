// Kurze Buffs auf dem Spieler (Getränke des ?-Magiers). Ohne Import aus spells/: core.ts, formulas.ts, mobs.ts und player.ts lesen von hier.

import { state, player } from './state';

// buff: { id, name, until, speed?, crit?, dmg?, cd?, regen?, xp? } – Anteile, cd = −30 % als 0.3
export const buffs = () => (player.buffs ??= []).filter(b => b.until > state.now);
export function addBuff(b) { player.buffs = [...buffs().filter(x => x.id !== b.id), b]; }
export const resetBuffs = () => { player.buffs = []; };
const sum = key => buffs().reduce((s, b) => s + (b[key] ?? 0), 0);
export const buffSpeedMul = () => 1 + sum('speed');
export const buffCrit = () => sum('crit');
export const buffDmgMul = () => 1 + sum('dmg');
export const buffCdMul = () => Math.max(0.1, 1 - sum('cd'));
export const buffRegenMul = () => 1 + sum('regen');   // Schrein (objects/shrines.ts): Mana-Regen, regen 2 = ×3
export const buffXpMul = () => 1 + sum('xp');         // Schrein: Erfahrung, xp 1 = ×2 (xpBonus.ts)
