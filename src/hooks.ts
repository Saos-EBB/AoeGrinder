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
function slot<F>(fallback: F): Slot<F> {
  const s: Slot<F> = { fn: fallback, set: fn => { s.fn = fn; } };
  return s;
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

  // Plätze: genau eine Umsetzung
  // Legendäre Krieger-Waffe ersetzt Spells in Start-Kit und Pool (realMen.ts setzt, spells/core.ts fragt)
  spellSwap: slot<(id: string) => string | undefined>(id => id),
  // true = Level 100 startet erst den finalen Boss, das Ergebnis kommt nach seinem Tod (boss.ts setzt, player.ts gainXp fragt)
  runEnd: slot<() => boolean>(() => false),
  // true = XP wird gesammelt und erst nach dem Bosskampf gutgeschrieben (boss.ts setzt, player.ts gainXp fragt)
  xpHold: slot<() => boolean>(() => false),
  // Boss-Anbindung für Wellen und Portal (boss.ts setzt, waves.ts und portal.ts fragen)
  boss: slot<{ start: () => boolean; active: () => boolean }>({ start: () => false, active: () => false }),
  // Zonenwechsel durchs Portal (main.ts setzt player.ts switchZone ein, portal.ts ruft)
  switchZone: slot<(id: string) => void>(() => {}),
  // Sprechblasen der Kosmetik (main.ts setzt die schwebende Schrift ein, figEvents.ts figSay ruft)
  figSay: slot<(text: string) => void>(() => {}),
  // Läuft nach jeder Änderung an Nebel und Himmel (dunkel.ts setzt, render.ts ruft; das VFX-Labor läuft ohne)
  envHook: slot<(() => void) | null>(null),
  // Fremde Kamera: bekommt die fertige normale Position und das Ziel, setzt Position und Blick selbst (boss.ts setzt/löscht, camera.ts ruft)
  camOverride: slot<((camera: any, target: any) => void) | null>(null),
};

// Die bisherigen Namen, damit die Aufrufer gleich bleiben
export const onMobDeath = hooks.mobDeath.on;
export const onAnyHit = hooks.anyHit.on;
export const onFireHit = hooks.fireHit.on;
export const onSpellArea = hooks.spellArea.on;
export const onCastStart = hooks.castStart.on;
export const onWarriorHit = hooks.warriorHit.on;
