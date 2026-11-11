// Rückwege ohne Import-Kreis (ARCH-03). Eigenes Modul ohne Imports (Vorbild device.ts): Es wird immer vor jedem Modul
// ausgewertet, das es importiert, darum sind die Kanäle beim Laden schon da, egal in welcher Reihenfolge der Kreis läuft.
// Wer reagieren will, meldet sich hier an; wer etwas auslöst, ruft hier. Beide importieren nur dieses Modul, nicht einander.
//   Kanal (channel): beliebig viele Abonnenten. Mit rank feste Reihenfolge (kleiner zuerst), unabhängig davon, in welcher
//   Reihenfolge die Module laden; ohne rank hinten an, in Anmelde-Reihenfolge. Zählt die Reihenfolge, immer rank geben.
//   Platz (slot): genau eine Umsetzung, die ein anderes Modul einsetzt; bis dahin gilt der Ersatz.
// Neue Rückwege kommen hierher, keine neuen Listen an Funktionen, Setter oder setTimeout-Tricks.

type Fn = (...a: any[]) => any;
// Fenster und Menüs, die Spiel und Eingabe öffnen oder fragen (ARCH-02 Rest, E10). ui/connect.ts setzt die Umsetzung aus ui/* ein (main.ts, vor allem anderen).
export type UiApi = {
  showCards(): void; showRunResult(): void;                              // ui/menus.ts, ui/leaderboardView.ts (run.ts)
  renderMenu(): void; openPause(): void; closePause(): void; pauseOpen(): boolean; menuOpen(): boolean;
  cycleChar(step: number): void; cycleMap(step: number): void;             // ui/mainMenu.ts (input, gamepad, mobile, waves)
  heroOpen(): boolean; toggleHero(): void; closeHero(): void; heroCommand(cmd: string): void;   // ui/heroWindow.ts (input, gamepad)
  closeBinds(): void; closeResetConfirm(): void; renderBinds(): void; setBind(id: string, e: { code: string; key: string }): void;   // ui/menus.ts (input, gamepad)
};
const no = () => {}, nein = () => false;
const UI_NONE: UiApi = { showCards: no, showRunResult: no, renderMenu: no, openPause: no, closePause: no, pauseOpen: nein, menuOpen: nein, cycleChar: no, cycleMap: no,
  heroOpen: nein, toggleHero: no, closeHero: no, heroCommand: no, closeBinds: no, closeResetConfirm: no, renderBinds: no, setBind: no };
export type Channel<F extends Fn> = { readonly fns: F[]; on(fn: F, rank?: number): void };
export type Slot<F> = { fn: F; set(fn: F): void };

function channel<F extends Fn>(): Channel<F> {
  const fns: F[] = [], ranks: number[] = [];
  return { fns, on: (fn, rank = Infinity) => {
    let i = ranks.length;
    while (i > 0 && ranks[i - 1] > rank) i--;   // stabil: gleicher rank bleibt in Anmelde-Reihenfolge
    fns.splice(i, 0, fn); ranks.splice(i, 0, rank);
  } };
}
function slot<F>(fallback: F): Slot<F> {
  const s: Slot<F> = { fn: fallback, set: fn => { s.fn = fn; } };
  return s;
}

export const hooks = {
  // Tod eines Mobs, vor allem anderen in killMob (mobs.ts). rank: 10 spells/plague (Ansteckung), 20 realMen (Sions Axt),
  // 30 loot (Drops), 40 mobKinds (Platzt, Teilt), 50 legends (Kuh), 60 objects/chests (Mimic), 70 objects/thief (Schatzdieb)
  mobDeath: channel<(mob: any) => void>(),
  // Jeder Treffer, der landet (spells/core.ts hitMobs). rank: 10 figures.ts (Eissplitter), 20 spells/plague.ts (Netz)
  anyHit: channel<(mob: any, spellId: string, dmg: number, frozen: boolean) => void>(),
  // Feuer-Treffer, auch Brand-Ticks: spells/gasoline.ts (Benzin zündet)
  fireHit: channel<(mob: any, spellId: string, dmg: number) => void>(),
  // Jede Wirkfläche (spells/core.ts mobsInRadius) mit dem Spell, der gerade wirkt: objects/objects.ts
  spellArea: channel<(center: any, r: number, spellId: string | null) => void>(),
  // Ein Spell fängt an (Zauberzeit, Kanal oder sofort): spells/random.ts (?-Magier würfelt neu)
  castStart: channel<(id: string) => void>(),
  // Treffer-Moment der Nahkampf-Animation (models/heroModel.ts): realMen.ts
  warriorHit: channel<(kind: string, x: number, z: number, i: number) => void>(),
  // Run-Reset (run.ts resetGame ruft alle in rank-Reihenfolge, ARCH-05). Wer pro Run Zustand hat, meldet sich hier an.
  // rank (Reihenfolge wie vor E8 in resetGame): 10 run.ts (Held-Modell, Mobs weg), 20 run.ts (resetMods), 30 score.ts,
  // 40 run.ts (Run-Felder in state, Spieler neu, Kamera, Leben/Mana), 50 realMen.ts, 60 dodge.ts, 70 schoolMeter.ts, 80 figures.ts,
  // 90 legends.ts, 100 run.ts (Schild 0), 110 buffs.ts, 120 run.ts (Nahkampf-Belegung), 130 battery.ts, 140 spells/plague.ts,
  // 150 loot.ts, 160 portal.ts, 170 waves.ts, 180 leaderboard.ts (Split-Anzeige), 190 run.ts (Dev-Marke, Zielkreis, Kanal, Packs füllen)
  runReset: channel<() => void>(),

  // Plätze: genau eine Umsetzung
  // Fenster und Menüs für Spiel und Eingabe (ui/connect.ts setzt, run.ts, player/xp.ts, input.ts/gamepad.ts/mobile.ts/waves.ts rufen). Logik importiert so kein ui/-Fenster
  ui: slot<UiApi>(UI_NONE),
  // Legendäre Krieger-Waffe ersetzt Spells in Start-Kit und Pool (realMen.ts setzt, spells/core.ts fragt)
  spellSwap: slot<(id: string) => string | undefined>(id => id),
  // Legendäre Krieger-Waffe, Feld legendary (realMen.ts setzt beim Laden, models/heroModel.ts fragt: Waffe und Skin des Kriegers; ARCH-11)
  warLegendary: slot<() => string | null>(() => null),
  // true = Level 100 startet erst den finalen Boss, das Ergebnis kommt nach seinem Tod (boss.ts setzt, player/xp.ts gainXp fragt)
  runEnd: slot<() => boolean>(() => false),
  // true = XP wird gesammelt und erst nach dem Bosskampf gutgeschrieben (boss.ts setzt, player/xp.ts gainXp fragt)
  xpHold: slot<() => boolean>(() => false),
  // Boss-Anbindung für Wellen, Portal und die Arena (#boss) (boss.ts setzt; waves.ts, portal.ts, mapgen/arena.ts fragen)
  boss: slot<{ start: () => boolean; active: () => boolean; busy: () => boolean }>({ start: () => false, active: () => false, busy: () => false }),
  // Zonenwechsel durchs Portal (main.ts setzt run.ts switchZone ein, portal.ts ruft)
  switchZone: slot<(id: string) => void>(() => {}),
  // Sprechblasen der Kosmetik (main.ts setzt die schwebende Schrift ein, figEvents.ts figSay ruft)
  figSay: slot<(text: string) => void>(() => {}),
  // Läuft nach jeder Änderung an Nebel und Himmel (dunkel.ts setzt, render.ts ruft; das VFX-Labor läuft ohne)
  envHook: slot<(() => void) | null>(null),
  // Fremde Kamera: bekommt die fertige normale Position und das Ziel, setzt Position und Blick selbst (boss.ts setzt/löscht, camera.ts ruft)
  camOverride: slot<((camera: any, target: any) => void) | null>(null),
};

// Bus für Optik, UI und Erfolge (ARCH-07): emit(name, …) meldet, on(name, fn) reagiert, Aufruf sofort und in Anmelde-Reihenfolge.
// Spielrelevante Folgen (XP, Punkte, Staub, Loot) laufen NICHT hierüber, sondern als direkte Aufrufe in fester Reihenfolge.
export type BusEvents = {
  kill: [mob: any];        // mobs.ts killMob → figEvents.ts (Figur: Kill, Kill-Serie)
  crit: [mob: any];        // mobs.ts damageMob → figEvents.ts
  cast: [id: string];      // spells/core.ts release (ohne Trinken) → figEvents.ts
  hit: [];                 // player/damage.ts damagePlayer (Leben verloren) → figEvents.ts
  level: [level: number];  // player/xp.ts gainXp (neues Level) → figEvents.ts
  ach: [id: string];       // neuer Erfolg: meta.ts milestone, gear/inventory.ts checkUnlocks (Set 5/5) → ui/achievements.ts (Einblendung)
};
type Listener<K extends keyof BusEvents> = (...a: BusEvents[K]) => void;
const subs: { [K in keyof BusEvents]: Listener<K>[] } = { kill: [], crit: [], cast: [], hit: [], level: [], ach: [] };
export function on<K extends keyof BusEvents>(e: K, fn: Listener<K>) { subs[e].push(fn); }
export function emit<K extends keyof BusEvents>(e: K, ...a: BusEvents[K]) { for (const fn of subs[e]) (fn as (...x: BusEvents[K]) => void)(...a); }

// Die bisherigen Namen, damit die Aufrufer gleich bleiben
export const onMobDeath = hooks.mobDeath.on;
export const onAnyHit = hooks.anyHit.on;
export const onFireHit = hooks.fireHit.on;
export const onSpellArea = hooks.spellArea.on;
export const onCastStart = hooks.castStart.on;
export const onWarriorHit = hooks.warriorHit.on;
export const onRunReset = hooks.runReset.on;
