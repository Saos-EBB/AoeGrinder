// Laufzeit-Zustand von Run und Spieler. Ohne Laufzeit-Imports (nur Typen), damit state.ts ein Blatt im Import-Graphen bleibt.
// Die Interfaces beschreiben alle Felder, die der Code heute benutzt (per tsc erfasst, E8). Optional (?) = wird erst später gesetzt,
// nicht im Start-Objekt. Typ `any` mit „(unklar)“ = Form hängt am Aufrufer und ist noch nicht festgelegt.

import type { Vector3 } from 'three';

// Faktoren je Spell aus Karten und Gear (spells/stats.ts stat()): dmg, mana, radius, dazu cast, cd, dur …
export interface SpellStat { dmg: number; mana: number; radius: number; [k: string]: number }

export interface GameState {
  // --- Zeit und Pause ---
  now: number;                  // Spielzeit in ms (läuft nur, wenn nicht pausiert)
  paused: boolean;              // Pause (Fenster offen, Karten, tot); ui/menus.ts syncPause
  runNo?: number;               // zählt Runs hoch (player.ts resetGame), objects/ baut damit neu

  // --- Mobs und Packs ---
  mobs: any[];                  // alle Mobs der Zone (mobs.ts spawnMob), tote bleiben bis removeMob drin
  packCounter: number;          // letzte vergebene Pack-ID (++ beim Spawnen)
  packDeaths: Record<number, number>;   // Tote je Pack-ID (abilities.ts: Rest des Packs wird schneller)
  newMob?: { text: string; at: number } | null;   // Banner „Neuer Gegner“/Portal (ui/messages)
  packMul?: number;             // Mondsee-Ereignis: Faktor auf Pack-Größe (mondsee.ts)
  champChance?: number | null;  // Mondsee-Ereignis: Champion-Chance statt Standard (mondsee.ts)
  devMobSlow?: boolean;         // Dev: Mobs langsam (ui/devGame.ts)

  // --- Welt ---
  stormK: number;               // Sandsturm, 0..1
  fogExtra?: number;            // zusätzlicher Nebel (Zone/Mondsee), dunkel.ts

  // --- Karten und Level-ups ---
  pendingLevelUps: number;      // offene Kartenfenster
  nextCardAt: number;           // Level, ab dem die nächste Karte kommt (Kartentakt)
  cardRush: boolean;            // Dev: offene Karten ohne Lücke nacheinander
  cardRanks: Record<string, number>;   // Karten-ID → gewählte Stufe
  cardPicks: Record<string, number>;   // wie oft eine Karte gewählt wurde: Stufe und Build
  relicTaken?: boolean;         // Relikt-Karte in diesem Run schon gewählt (cards.ts)
  figRelicTaken?: boolean;      // Relikt der Figur, eins pro Run (cards.ts)

  // --- Eingabe ---
  autorun: boolean;             // Dauerlauf an
  jumpQueued: boolean;          // Sprung für den nächsten Frame vorgemerkt
  rebinding: string | null;     // Aktion, die gerade neu belegt wird
  lastInput: 'key' | 'pad';     // bestimmt die Tasten-Symbole
  padRebinding: string | null;  // dasselbe fürs Pad
  padAim: Vector3 | null;       // Blizzard-Zielpunkt am Pad, solange R1 gehalten ist

  // --- Spells (spells/core.ts resetSpells) ---
  slots?: (string | null)[];    // Spell-IDs je Slot (feste Rollen, hotbar.ts), null = leer
  randomNext?: Record<string, string>;   // ?-Magier: nächster Spell je Kategorie (spells/random.ts)
  spellStats?: Record<string, SpellStat>;   // Faktoren je Spell (spells/stats.ts stat())
  runes?: Record<string, string>;   // Spell-ID → gewählte Rune
  supports?: Record<string, boolean>;   // Support-ID → gewählt
  fields?: any[];               // Dauerflächen der Spells, Form je Spell (unklar)
  scheduled?: { at: number; fn: () => void }[];   // verzögerte Wirkungen (spells/core.ts schedule)
  poolExtra?: string[];         // Spells, die die Waffe für diesen Run in den Pool holt (weaponRolls.ts)
  keeper?: number;              // Sturmhüter: Rest der verstärkten Kettenblitze (spells/lightning2.ts, chain.ts)
  chainCount?: number;          // Kettenblitz-Zähler für Sturm (spells/chain.ts)
  shards?: number;              // Frost-Splitter der Figur (figures.ts)

  // --- Waffe und Gear (weaponRolls.ts applyRunWeapon, gear.ts applyRunGear) ---
  runWeapon?: string;           // Name der Waffe im Run (Rangliste)
  bonusCharges?: Record<string, number>;   // Buch: +Ladungen je Spell
  weaponAura?: { el: string; f: number; next: number; M: any } | null;   // Element-Aura der Waffe; M = Hersteller-Regel (unklar)
  weaponHit?: ((m: any, dmg: number, crit: boolean, api: any) => void) | null;   // Treffer-Hook der Waffe/des Gears (mobs.ts damageMob)
  gearSet?: string | null;      // angelegtes Set 5/5 (Figur-ID), sonst null
  finds?: { item: any; dust: number; over: any }[];   // aufgehobene Gear-Teile im Run (loot.ts), Form von item/over (unklar)

  // --- Krieger, Legenden, Boss ---
  heroWeapon?: string;          // Krieger: Name der Waffe (realMen.ts)
  qKills?: number;              // Krieger: Kills für Q-Stufen (realMen.ts)
  noxusUntil?: number;          // Legende Noxus aktiv bis (ms)
  leeroyUntil?: number;         // Legende Leeroy aktiv bis (ms), core.ts +50 % Schaden
  mirrorUntil?: number;         // Boss-Regel Spiegel aktiv bis (ms) (bosses/rules.ts)
  bossAim?: Vector3 | null;     // Boss: gesperrter Zielpunkt (boss.ts)
  bossLock?: boolean;           // Boss: Ziel gesperrt

  // --- Dodge ---
  dodgeStats?: { n: number; perfect: number };   // Dodges im Run (dodge.ts)
  pdBuff?: { stacks: number; until: number } | null;   // Perfekt-Dodge-Buff

  // --- Dev ---
  devUsed?: boolean;            // Dev-Panel im Run benutzt (Rangliste markiert den Run)
}

// Gift auf dem Spieler (abilities.ts)
export interface PlayerPoison { stacks: number; until: number; nextTick: number; [k: string]: any }
// Trinken/Essen/Aufladen: läuft von start bis end (spells/drink.ts, recharge.ts, random.ts, realMen.ts)
export interface PlayerDrink { start: number; end: number; [k: string]: any }
// Wirken mit Wirkzeit (spells/core.ts)
export interface PlayerCasting { id: string; point: any; start: number; end: number; total: number; delays: number; hp: number; opts: any }
// Kanal-Spell (spells/core.ts startChannel); c = Spell-Definition, weitere Felder setzt der Spell selbst (mobile, radius, visual …) (unklar)
export interface PlayerChannel { id: string; c: any; point: any; start: number; end: number; nextTick: number; delays: number; [k: string]: any }
// Kurzer Buff (buffs.ts): Anteile, cd = −30 % als 0.3
export interface PlayerBuff { id: string; name?: string; until: number; speed?: number; crit?: number; dmg?: number; cd?: number; regen?: number; xp?: number; [k: string]: any }

export interface PlayerState {
  // --- Ort und Bewegung (player.ts) ---
  pos: Vector3;                 // Position in der Welt
  vel: Vector3;                 // Geschwindigkeit (Sprung, Fall)
  grounded: boolean;            // steht auf dem Boden
  facing: number;               // Blickrichtung (rad)
  moveState: 'idle' | 'run' | 'back';   // für die Animation
  moveSpeed: number;            // aktuelles Lauftempo
  landAt: number;               // Zeit der letzten Landung (ms)
  speedBuff?: number;           // Lauftempo aus Spells (Feuerspur), 1 = normal

  // --- Leben, Mana, Fortschritt ---
  hp: number;
  mana: number;                 // beim Krieger: Wut
  level: number;
  xp: number;
  kills: number;
  dead: boolean;
  won: boolean;                 // Run gewonnen (finaler Boss)
  lastHitBy?: string;           // Todesursache (Rangliste)
  lastManaUse: number;          // Zeit des letzten Manaverbrauchs (Regeneration)
  nextRegen: number;            // nächster Regenerations-Tick (ms)
  lastCombat: number;           // letzter Kampf (ms)
  luck?: number;                // Glück aus Karten
  hpCut?: number;               // Boss-Regel: Anteil des Max-Lebens weg (bosses/rules.ts)
  bonusHp?: number;             // Krieger-Legende: zusätzliches Leben pro Kill (realMen.ts)
  rageMax?: number;             // Krieger/Batterie: Obergrenze von mana, undefined = normales Mana

  // --- Zustände (…Until = aktiv bis ms) ---
  slowUntil: number;
  stunUntil: number;
  iceUntil: number;
  poison: PlayerPoison | null;
  invulnUntil: number;          // Phönix
  rebornUntil: number;          // Phönix: wiedergeboren bis
  rebornMul?: number;           // Phönix: Schadensfaktor nach Wiedergeburt (core.ts makeCtx)
  riseAt: number;               // Aufstehen nach Wiedergeburt (ms)
  berserkUntil?: number;        // Krieger: Berserker
  meltUntil?: number;           // Seuche: verflüssigt (spells/plague.ts)
  iceGroundUntil?: number;      // Frost-Figur: Eisboden (figures.ts)
  shield?: number;              // Schild-Punkte (Eisbarriere, Krieger-Schild)
  shieldUntil?: number;
  onShieldBreak?: (() => void) | null;   // Eisbarriere: Wirkung beim Brechen
  buffs?: PlayerBuff[];         // kurze Buffs (buffs.ts)

  // --- Zaubern ---
  cds: Record<string, number>;  // Spell-ID → bereit ab (ms)
  charges?: Record<string, number[]>;   // Spell-ID → Ladungen (je bereit ab ms)
  spellCounts?: Record<string, number>;   // wie oft ein Spell gewirkt wurde
  casting?: PlayerCasting | null;
  castAnimUntil: number;        // Wirk-Animation bis (ms)
  channel: PlayerChannel | null;
  drink: PlayerDrink | null;
  targeting: string | false;    // Spell-ID, deren Bodenziel gerade gewählt wird (Blizzard), sonst false
  lastBlink?: number;           // Zeit des letzten Blinks (ms)
  overcharged?: boolean;        // Batterie: überladen (battery.ts)

  // --- Anzeige der Ressource ---
  resLabel?: string;            // Text im Ressourcen-Balken (Batterie, Seuche)
  resNote?: string;             // Zusatz unter dem Balken (Krieger, Splitter)
}

export const state: GameState = {
  now: 0,
  paused: true,
  mobs: [],
  stormK: 0,
  packCounter: 0,
  packDeaths: {},
  pendingLevelUps: 0,
  nextCardAt: 0,
  cardRush: false,
  cardRanks: {},
  cardPicks: {},
  autorun: false,
  jumpQueued: false,
  rebinding: null,
  lastInput: 'key',
  padRebinding: null,
  padAim: null,
};

// Leer bis zum ersten resetGame (player.ts), das die Pflichtfelder setzt
export const player = {} as PlayerState;
