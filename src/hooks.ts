// Rückwege ohne Import-Kreis (ARCH-03). Eigenes Modul ohne Imports (Vorbild device.ts): Es wird immer vor jedem Modul
// ausgewertet, das es importiert, darum sind die Kanäle beim Laden schon da, egal in welcher Reihenfolge der Kreis läuft.
// Wer reagieren will, meldet sich hier an; wer etwas auslöst, ruft hier. Beide importieren nur dieses Modul, nicht einander.
//   Kanal (channel): beliebig viele Abonnenten, Aufruf in Anmelde-Reihenfolge (= Lade-Reihenfolge der Module).
//   Platz (slot): genau eine Umsetzung, die ein anderes Modul einsetzt; bis dahin gilt der Ersatz.
// Neue Rückwege kommen hierher, keine neuen Listen an Funktionen, Setter oder setTimeout-Tricks.

type Fn = (...a: any[]) => any;
export type Channel<F extends Fn> = { readonly fns: F[]; on(fn: F): void };
export type Slot<F> = { fn: F; set(fn: F): void };

function channel<F extends Fn>(): Channel<F> {
  const fns: F[] = [];
  return { fns, on: fn => { fns.push(fn); } };
}

export const hooks = {
  // Tod eines Mobs, vor allem anderen in killMob (mobs.ts): spells/plague, realMen, loot, mobKinds, legends, objects/chests, objects/thief
  mobDeath: channel<(mob: any) => void>(),
  // Jeder Treffer, der landet (spells/core.ts hitMobs): figures.ts (Eissplitter), spells/plague.ts (Netz)
  anyHit: channel<(mob: any, spellId: string, dmg: number, frozen: boolean) => void>(),
  // Feuer-Treffer, auch Brand-Ticks: spells/gasoline.ts (Benzin zündet)
  fireHit: channel<(mob: any, spellId: string, dmg: number) => void>(),
  // Jede Wirkfläche (spells/core.ts mobsInRadius) mit dem Spell, der gerade wirkt: objects/objects.ts
  spellArea: channel<(center: any, r: number, spellId: string | null) => void>(),
  // Ein Spell fängt an (Zauberzeit, Kanal oder sofort): spells/random.ts (?-Magier würfelt neu)
  castStart: channel<(id: string) => void>(),
  // Treffer-Moment der Nahkampf-Animation (models/mage.ts): realMen.ts
  warriorHit: channel<(kind: string, x: number, z: number, i: number) => void>(),
};

// Die bisherigen Namen, damit die Aufrufer gleich bleiben
export const onMobDeath = hooks.mobDeath.on;
export const onAnyHit = hooks.anyHit.on;
export const onFireHit = hooks.fireHit.on;
export const onSpellArea = hooks.spellArea.on;
export const onCastStart = hooks.castStart.on;
export const onWarriorHit = hooks.warriorHit.on;
