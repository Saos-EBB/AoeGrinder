// Laufzeit-Zustand von Run und Spieler. Ohne Laufzeit-Imports (nur Typen), damit state.ts ein Blatt im Import-Graphen bleibt.
// Die Interfaces beschreiben alle Felder, die der Code heute benutzt (per tsc erfasst, E8). Optional (?) = wird erst später gesetzt,
// nicht im Start-Objekt. Typ `any` mit „(unklar)“ = Form hängt am Aufrufer und ist noch nicht festgelegt.

import type { Vector3 } from 'three';

// Faktoren je Spell aus Karten und Gear (spells/stats.ts stat()): dmg, mana, radius, dazu cast, cd, dur …
export interface SpellStat { dmg: number; mana: number; radius: number; [k: string]: number }

// ---------- Mob (mobs.ts spawnMob) ----------
// Aggro-Zustand eines Mobs: idle → combat (enterCombat), evade (zurück nach Hause), flee (Panik, mobs.ts startFlee / realMen.ts Schrei)
export type MobState = 'idle' | 'combat' | 'evade' | 'flee';

// Die häufigen Felder (KOMP-01/09). Mobs tragen gut 200 verschiedene Felder (Fähigkeiten, Bosse, Objekte, Spells setzen eigene),
// der Rest läuft über die Index-Signatur. …Until = aktiv bis Spielzeit in ms.
export interface Mob {
  // --- Grundwerte beim Spawn ---
  type: any;                    // Mob-Typ aus MOB_TYPES (mobTypes.ts) oder Ersatz-Typ (Boss, Kind) (unklar)
  ability: any;                 // Fähigkeit aus ABILITIES (abilities.ts) oder null (unklar)
  model: any;                   // Modell mit root (Object3D), update, setMood … (models/) (unklar)
  plate: HTMLDivElement;        // Namensschild im #overlay
  plateHp: HTMLElement;         // Lebensbalken im Namensschild
  plateLv: HTMLElement;         // Level im Namensschild
  plateInf?: HTMLElement;       // Zusatz im Namensschild (Champion-Affixe, Kind)
  pos: Vector3;                 // = model.root.position
  home: Vector3;                // Spawnpunkt (Evade läuft dorthin zurück)
  packId: number;
  level: number;
  hp: number;
  maxHp: number;
  speedMul: number;             // Tempo-Faktor des Typs (Pack-Tote erhöhen ihn, abilities.ts)
  dmgMulT: number;              // Schadensfaktor des Themes (mapgen/difficulty.ts)
  speed?: number;               // aktuelles Tempo (Eis-Gleiten, Winterquell)

  // --- Aggro und Bewegung ---
  state: MobState;
  assistAt: number;             // Social Aggro: hilft ab (ms), 0 = nicht gerufen
  nextSwing: number;            // nächster Nahkampfschlag (ms)
  attackAt: number;             // letzter Angriff (ms), player.ts liest die Todesursache daraus
  hitAt?: number;               // zuletzt getroffen (ms)
  moving: boolean;
  leap: any;                    // laufender Sprung { x0, y0, z0, x1 … } oder null (abilities.ts) (unklar)
  fleeRolled: boolean;          // Flucht-Wurf schon gemacht
  fleeTarget: Mob | null;       // Helfer, zu dem der Mob flieht
  fleeUntil: number;
  flies?: boolean;              // ignoriert Wände (mobs.ts, collision.ts)
  noKnock?: boolean;            // kein Rückstoß

  // --- Tod und Sichtbarkeit ---
  dead: boolean;
  deathAt: number;              // Todeszeit (ms), main.ts räumt Leichen nach 4 s weg
  hidden: boolean;              // getarnt (stealth), Modell unsichtbar
  keep?: boolean;               // wird beim Pack-Auffüllen nicht ersetzt (Dieb, Objekte)
  animDt?: number;              // gesammelte Zeit für die Modell-Animation (gedrosselt)

  // --- Kontrolle und Dauereffekte ---
  rootUntil: number;
  rootLook?: any;               // Optik der Wurzel/des Eises (unklar)
  slowUntil: number;
  slowPct: number;
  shockUntil?: number;          // Blitz: Rüstung runter
  wetUntil?: number;
  sheepUntil?: number;          // Legende: Schaf
  cagedUntil?: number;          // Käfig-Fläche
  hasteUntil?: number;          // Zone: Eile
  shieldUntil?: number;         // Fähigkeit: Schild
  markUntil?: number;
  absorbed?: boolean;           // Kind-Schild hat einen Treffer gehalten
  kindShield?: any;             // Schild des Kinds (mobKinds.ts) oder null (unklar)
  poison?: { dps: number; until: number; next: number; step: number } | null;
  burn?: { dps: number; until: number } | null;
  plague?: { stacks: number; until: number; popped?: boolean; [k: string]: any } | null;   // Seuche-Mal (plagueMarks.ts)
  web?: { links: any; until: number; [k: string]: any } | null;   // Netz (abilities.ts), Form von links (unklar)
  sandAcc?: number;             // Sandsturm-Schaden, gesammelt bis ganze Punkte
  lavaAcc?: number;             // Lava-Schaden, gesammelt
  trailTickAt?: number;         // Feuerspur: nächster Tick

  // --- Sonderrollen ---
  boss?: boolean;
  bossTint?: string;            // Färbung des Boss-Namens ('boss', 'boss2' …)
  champion?: { affixes: any } | null;   // Champion mit Affixen (champions.ts)
  kind?: { theme: string; cat: string; zus: any };   // Mob-Kind (mobKinds.ts) (zus unklar)
  thief?: boolean;              // Schatzdieb (objects/thief.ts)
  mimic?: boolean;              // Mimic (objects/)
  cow?: boolean;
  wave?: number;                // Welle, aus der der Mob stammt (waves.ts)
  xpMul?: number;               // Faktor auf XP, 0 = keine
  qCounted?: boolean;           // Krieger: Kill für Q schon gezählt

  [k: string]: any;             // übrige Felder (Fähigkeiten, Bosse, Spells)
}

export interface GameState {
  // --- Zeit und Pause ---
  now: number;                  // Spielzeit in ms (läuft nur, wenn nicht pausiert)
  paused: boolean;              // Pause (Fenster offen, Karten, tot); ui/menus.ts syncPause
  runNo?: number;               // zählt Runs hoch (player.ts resetGame), objects/ baut damit neu

  // --- Mobs und Packs ---
  mobs: Mob[];                  // alle Mobs der Zone (mobs.ts spawnMob), tote bleiben bis removeMob drin
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

// ---------- Roguelike-Modifikatoren (Karten, Waffe, Gear verändern sie im Run) ----------
// Seit E8 hier statt in config.ts (ARCH-05). Startwerte für jeden Run: resetMods() (player.ts resetGame)
const MODS_START = {
    dmg: 1, shatter: 0, novaCd: 0, blizSlow: 0, blizRadius: 0, castRegen: 0, manaMult: 1, hpMult: 1, crit: 0, cdMul: 1, moveMul: 1, radius: 1, durMul: 1, castMul: 1, manaCostMul: 1, dodgeCharges: 0, comboWindow: 1, chainJumps: 0, arcJumps: 0, jumpMul: 1, strikeExtra: 0, stormBolts: 0, ballZaps: 0,   // chainJumps …: Talente des Blitzmagiers
    fbExtra: 0, fbFreeEvery: 0, emberCore: 0, soulFire: 0, starfall: 0, wildfire: 0,   // Feuer-Talente (v31)
    iceAge: 0, permafrost: 0, coldBurn: 0, stormEye: 0, frostEye: 0, shardMax: 0,   // Frost-Talente (v31)
    needleShard: 0, frozenDmg: 0,   // Set Splitterkönig (gear.ts)
    chainKill: 0,   // Set Hochspannung (gear.ts)
    burstDmg: 0, burstTick: 0,   // Set Pestbringer (gear.ts)
    condenser: 0, boltLeap: 0,   // Blitz-Talente (v31)
    toughSlime: 0, leech: 0, contagion: 0, wreckingBall: 0,   // Seuchen-Talente (v31)
    annihilator: 0, bladeMaster: 0 };   // Krieger-Talente (v31)
export type Mods = typeof MODS_START;
export const mods = {} as Mods;
export function resetMods() {
  Object.assign(mods, MODS_START);
}
// Frische Kopie der Startwerte, ohne die echten mods anzufassen (ui/heroStats.ts computeModLayers)
export const freshMods = (): Mods => ({ ...MODS_START });

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
