// Grundform der Seuchen-Spells (spells/plague.ts), ohne Imports und damit in Node testbar (tests/plagueSpell.test.ts).
// tags steht NACH ...o: sonst überschreibt o.tags das Seuche-Tag (bis 2026-11-11 hatten 9 der 11 Seuchen-Spells deshalb kein Tag 'Seuche').
// Das Tag 'Seuche' ist die Schule: onlyTag des Seuchenmagiers (Karten), Fokus-Würfe (gear/roll.ts, weaponRolls.ts), spellElement (Fässer, Fokus-Emblem).
export const plagueSpell = <T extends { tags?: readonly string[]; [k: string]: unknown }>(o: T) =>
  ({ ranks: ['dmg', 'radius'], cls: 'plague', ...o, tags: ['Seuche', ...(o.tags ?? []).filter(x => x !== 'Seuche')] });
