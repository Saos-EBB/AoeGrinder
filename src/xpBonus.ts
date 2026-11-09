// Zusätzliche XP-Faktoren pro Kill (mobs.ts killMob), z. B. Portal-Druck (portal.ts) oder Schrein der Erfahrung (objects/).
// Wirkt nur auf die XP, nicht auf die Punkte der Rangliste.

const muls: (() => number)[] = [];
export const addXpMul = (fn: () => number) => { muls.push(fn); };
export const xpBonusMul = () => muls.reduce((k, fn) => k * fn(), 1);
