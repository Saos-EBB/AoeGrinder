// Werte aus docs/mechanics-spec.md (VMaNGOS-Code + Wowhead-Tooltips).
// "PH" = Platzhalter, nicht belegt.


// Kartengröße: Radius-Faktor, 2 = vierfache Fläche. Bauwerke bleiben in der Mitte, Gelände und Streu wachsen mit. // PH
export const WORLD_K = 2;

// Performance-Schalter (Rechner ohne dedizierte GPU). Standardwerte entsprechen Artifact v4.
export const PERF = {
  bloom: true,          // false: kein Bloom-Pass
  maxParticles: 5000,   // Obergrenze des Partikelsystems
  maxPixelRatio: 2,     // Obergrenze für devicePixelRatio
  vfxOld: false,        // true: alte Spell-Optik, Schalter im VFX-Labor
  vfx: 'mittel',        // Effektqualität: 'niedrig', 'mittel' oder 'hoch' (VFX_QUALITY)
  // Mobs nach Kamera-Abstand in yd: dahinter liegt der Nebel (FogExp2 0,035) bei über 99 % bzw. 92 %. shadowYd ab Spieler: Lichtkreis 13 yd + Rand
  mobHideYd: 62,        // weiter weg: nicht zeichnen, nicht animieren
  mobHalfYd: 45,        // weiter weg: Animation jeden 2. Frame
  mobShadowYd: 18,      // nur näher am Spieler werfen Mobs Schatten
};
// PH: particleRes Auflösung des Partikel-Puffers, soft Weichzeichnung in yd, lights Lichter im Pool, shock Verzerrung, particleMul Anteil der Partikel
export const VFX_QUALITY = {
  niedrig: { particleRes: 0.5, soft: 0.8, lights: 1, shock: false, particleMul: 0.5, shards: 60, puffs: 8 },
  mittel: { particleRes: 0.5, soft: 1.2, lights: 2, shock: true, particleMul: 0.8, shards: 110, puffs: 14 },
  hoch: { particleRes: 1, soft: 1.2, lights: 4, shock: true, particleMul: 1, shards: 180, puffs: 22 },
};

// SCORE_*: Punkte und Rangliste, alles PH (docs/score-spec.md)
export const SCORE_MULTI_WINDOW = 1200, SCORE_MULTI_STEP = 0.1, SCORE_MULTI_MAX = 5, SCORE_MULTI_BANNER = 10;
export const SCORE_COMBO_WINDOW = 4000, SCORE_COMBO_DIV = 50, SCORE_COMBO_MAX = 3;
export const SCORE_PULL_POINTS = 100, SCORE_MINUTE_POINTS = 50;
export const SCORE_VERSION = 'v31';

// LEVEL_*: Level 1–100, alles PH (docs/levels-spec.md)
export const LEVEL_START = 1, LEVEL_MAX = 100;
// Pacing: ein Run bis Level 100 dauert etwa so lange. Vorsprung bremst die XP, Rückstand hebt sie (formulas.ts, paceXpMul). // PH
export const LEVEL_PACE = { minutes: 15, halfLevels: 4, minMul: 0.15, maxMul: 2.5 };   // halfLevels: je so viele Level Vorsprung halbiert sich die XP
export const LEVEL_KILLS = { base: 8, perLevel: 0.4 };    // Kills pro Level ohne Pacing: 8 auf Level 1, 48 auf Level 100. AoE trifft später viel mehr Mobs // PH
export const LEVEL_UP_HEAL = 0.25;                        // Level-up heilt 25 % der maximalen Leben, Kevins Wunsch
export const LEVEL_MOB_DEF_STEP = 0.004, LEVEL_MOB_DEF_MAX = 0.4;   // Schadensreduktion der Mobs: 0,4 % pro Level über 1, höchstens 40 %
export const LEVEL_HP_AT_20 = 1040, LEVEL_HP_STEP = 39;   // Leben auf Level 20, plus pro Level
export const LEVEL_DMG_STEP = 0.05;                       // Schaden und Mob-Leben: +5 % des Level-1-Werts pro Level
export const LEVEL_MOB_HP = 200;                          // Start-Mob auf Level 1: 6 Arcane Explosions (34–38 Schaden), Kevins Wunsch: doppelt so viel Leben
export const LEVEL_UNLOCKS = [16, 31, 46, 61];            // Ab diesen Spielerleveln kommen Mob 2, 3, 4, 5 dazu
export const LEVEL_NEW_MOB_BANNER = 3000;                 // Anzeigedauer "Neuer Gegner"
export const LEVEL_MIN_MOBS = 40;                         // So viele Mobs leben mindestens auf der Karte
export const LEVEL_PACK_MIN = 4, LEVEL_PACK_MAX = 6;      // Kleinstes Pack ab Level 1
export const PACK_SIZE_MUL = 2;                           // PH: Grundfaktor auf jede Packgröße, „Große Packs“ kommt noch obendrauf
export const PACK_STALE_LEVELS = 4;                       // PH: unberührte Packs so viele Level unter dir werden durch aktuelle ersetzt
export const PACK_STALE_DIST = 30;                        // PH: aber nur außerhalb dieser Entfernung, damit nichts vor dir aufploppt
export const LEVEL_PACK_SPREAD = 3;                       // Mobs liegen bis zu so viele yd um die Pack-Mitte

export const CFG = {
  aggroBase: 18, aggroMin: 5, aggroLevelCap: 25,     // Creature::GetAttackDistance
  socialRadius: 10, socialDelay: 1500,              // CreatureFamilyAssistance*
  fleeAssistRadius: 30, fleeDuration: 7000,         // DoFleeToGetAssistance
  fleeHpPct: 0.15, fleeChance: 0.3,                 // PH: steht im DB-Script, nicht im Core
  regenTick: 2000, fiveSecRule: 5000,               // Player::Regenerate, SetLastManaUse
  critBonus: 0.5,                                   // SpellCriticalDamageBonus
  baseCrit: 0.05,                                   // PH
  novaBreakChance: 0.25,                            // PH
  runSpeed: 7, backSpeed: 4.5, turnSpeed: 3.141594, // baseMoveSpeed[] in Unit.cpp (yd/s, rad/s)
  walkSpeed: 2.5,                                   // VMaNGOS src/game/Objects/Unit.cpp, baseMoveSpeed[MOVE_WALK], Zeile 69
  jumpSpeed: 8, gravity: 20,                        // PH: Sprungphysik läuft im Client, nicht im Server
  mobSpeed: 6.2,                                    // PH: steht pro Mob in creature_template.speed_run (DB)
  meleeRange: 2.2, swingTime: 2000,
  playRadius: 98 * WORLD_K,
  packCount: 9,
  curseSlow: 0.3,                                   // PH: Kurzen-Fluch
  mageHunch: 0.65,                                  // PH: gebückte Haltung des Magiers, 0 = aufrecht, 1 = stark
  padDeadzone: 0.15, padWalkBelow: 0.5,             // PH: docs/gamepad-spec.md
  blizAimStart: 12, blizAimSpeed: 25,               // PH: Blizzard-Zielkreis am Pad (yd, yd/s)
  padYaw: 2.5, padPitch: 1.5,                       // PH: Kamera am Pad (rad/s bei vollem Ausschlag)
};

// SPELL_*: Die Werte pro Spell stehen in src/spells/<id>.ts, index.ts registriert sie hier.
export const SPELLS: any = {};
// Dunkel-Schaden (Tag Dunkel): trifft immer, ignoriert die Schadensreduktion der Mobs, heilt um diesen Anteil // PH
export const DARK_HEAL = 0.2;
export const SPELL_AOE_HEIGHT = 3;   // PH: yd Höhenunterschied zur Wirkfläche, ab dem Flächen-Spells nicht mehr treffen
export const SPELL_SLOTS = 8;
// Raster seit v31: Slots 0–4 Attacken, 5 Trinken/Essen/Aufladen, 6 Bewegung, 7 Relikt der Figur
export const SLOT = { attacks: 5, drink: 5, move: 6, relic: 7 };
export const SPELL_START = ['nova', 'ae', 'bliz', 'coc', null, 'drink', 'blink', null];
// Die Tasten-Aktionen heißen seit v1 wie das alte Start-Kit. Sie stehen für den Slot, nicht für den Spell: slot7 ist die 5. Attacke, blink die Bewegung, slot8 das Relikt.
export const SPELL_ACTIONS = ['nova', 'ae', 'bliz', 'coc', 'slot7', 'drink', 'blink', 'slot8'];
// Einheit für den Schaden neuer Spells: Arcane Explosion auf Level 1 (34–38). Alle neuen Spells rechnen in Vielfachen davon // PH
export const UNIT = 36;
// Relikt der Figur (modifiers.ts relics): Seltenheit blau, nur eins pro Run, ab diesem Level im Angebot // PH
export const FIG_RELIC = { tier: 3, level: 10 };

// Roguelike-Modifikatoren (werden von Karten verändert)
export const mods: any = {};
export function resetMods() {
  Object.assign(mods, { dmg: 1, shatter: 0, novaCd: 0, aeCost: 1, blizSlow: 0, blizRadius: 0, castRegen: 0, manaMult: 1, hpMult: 1, crit: 0, cdMul: 1, moveMul: 1, radius: 1, durMul: 1, castMul: 1, manaCostMul: 1, dodgeCharges: 0, comboWindow: 1, chainJumps: 0, arcJumps: 0, jumpMul: 1, strikeExtra: 0, stormBolts: 0, ballZaps: 0,   // chainJumps …: Talente des Blitzmagiers
    fbExtra: 0, fbFreeEvery: 0, emberCore: 0, soulFire: 0, starfall: 0, wildfire: 0,   // Feuer-Talente (v31)
    iceAge: 0, permafrost: 0, coldBurn: 0, stormEye: 0, frostEye: 0, shardMax: 0,   // Frost-Talente (v31)
    splinterSwarm: 0, blinkBomb: 0, blinkExtra: 0,   // Arkan-Talente (v31)
    condenser: 0, boltLeap: 0,   // Blitz-Talente (v31)
    toughSlime: 0, leech: 0, contagion: 0, wreckingBall: 0 });   // Seuchen-Talente (v31)
}

// ?-Magier (Modus normal, spells/random.ts): 4 Tasten würfeln aus Kategorien. Der eigene CD der Spells zählt nicht, nur der der Kategorie. Alles PH
export const RANDOM_MAGE = {
  kit: ['rOff', 'rDef', 'rUtil', 'rDrink'],
  cats: {
    rOff: { name: 'Offensiv', cd: 1000, pool: ['ae', 'surge', 'arcmissiles', 'fireball', 'flame', 'meteor', 'detonate', 'frostorb', 'icelance', 'bliz', 'strike', 'ball', 'discharge', 'storm', 'chain', 'arc'] },   // „nur GCD“: einen GCD gibt es seit v22 nicht, 1 s
    rDef: { name: 'Defensiv', cd: 6000, pool: ['nova', 'iceblock', 'blast', 'coc', 'whirl', 'glacier', 'hellfire'] },
    rUtil: { name: 'Utility', cd: 5000, pool: ['blink', 'voidorb', 'arcmark'] },
    rDrink: { name: 'Drink Something', cd: 30000, pool: ['gold', 'schnaps', 'tasse', 'tee'] },
  },
  sitMs: 2000,
  drinks: {
    gold: { name: 'Goldbecher', short: 'Gold', skin: 'base', ms: 10000, speed: 0.3, crit: 0.15 },
    schnaps: { name: 'Feuerschnaps', short: 'Schnaps', skin: 'fire', ms: 10000, dmg: 0.25, mana: true, burp: { range: 6, halfAngle: 0.7 } },
    tasse: { name: 'Heiße Tasse', short: 'Tasse', skin: 'ice', ms: 6000, heal: true, slow: 0.5, slowYd: 8 },   // Slow, solange er sitzt; danach Leben voll über 6 s
    tee: { name: 'Tee-Schale', short: 'Tee', skin: 'arcane', ms: 10000, cd: 0.3, mana: true },
  },
};

// Blitz only (battery.ts): Batterie statt Mana in player.mana. Bei max überladen: der nächste Blitz-Zauber ×overMul und betäubt, danach 0. Alles PH
// costDiv: Spells ohne eigenes charge kosten mana / costDiv Ladung. stunMs: Betäubung über applyRoot (Mob ohne Laufen und Schlag)
export const BATTERY = { max: 100, start: 50, regenPerS: 8, perHitTarget: 3, overMul: 2, stunMs: 500, costDiv: 8, color: '#ffe14a', recharge: { ms: 2000, amount: 60 } };

// Seuchenmagier (Seuche only, spells/plague.ts, v31). Alles PH. Schaden in Einheiten (UNIT), Kosten in Anteil der max. Leben (lifePct an den Spells)
export const PLAGUE = {
  mark: { max: 3, ms: 10000 },
  sludge: { dmg: 1, range: 30, radius: 2 },
  trap: { radius: 4, ms: 8000, rootMs: 2000, range: 30 },
  wave: { length: 12, width: 6, push: 5, dmg: 1.5, rootMs: 1000 },
  hole: { radius: 8, ms: 1500, pull: 14, fling: 20, impact: 4, dmg: 3, flightMs: 500, range: 30 },
  cloud: { radius: 6, ms: 6000, dps: 0.3, range: 30 },
  web: { radius: 8, links: 2, ms: 6000, share: 0.5, range: 30 },
  contract: { radius: 15, rootMs: 4000 },
  drain: { radius: 15, dmg: 2, heal: 0.005 },
  burst: { radius: 15, ms: 12000 },
  pestilence: { radius: 40, cd: 90000 },
  melt: { ms: 3000, radius: 15, rootMs: 2000, tickMs: 500 },
};

// Kill-Anzeige der Schul-Modi (schoolMeter.ts): Kills füllen 0 … 1, ohne Kill sinkt sie. Voll: Bonus der Schule. Alles PH
export const SCHOOL_METER = {
  perKill: 0.02, perChampion: 0.10, idleMs: 3000, decayPerS: 0.05,
  // Feuer: Hitze statt Kills. Treffer heizen, Hitze macht Schaden und Brand stärker, ab max brennt er selbst bis unter overheatUntil
  Feuer: { name: 'Hitze', color: '#ff7a1a', hot: '#ff2a12', hotFrom: 80, full: 'Überhitzt', max: 100, perHit: 1.5, coolDelayMs: 1500, coolPerS: 10,
    dmgPerHeat: 0.004, burnPerHeat: 0.008, overheatSelfPctPerS: 0.03, overheatUntil: 50, selfTickMs: 500,
    overDmg: 0.25, killHeal: 0.005 },   // v31: überhitzt +25 % Schaden, jeder Kill heilt 0,5 % Leben (Feuer-Figur)
  Frost: { name: 'Kälte', color: '#7fd0ff', full: 'Kälte voll: +35 % Slow', slow: 0.35, slowMax: 0.8 },
  // Arkan (v31): Arkane Ladungen statt Fokus. Pro Ladung +15 % Schaden und +25 % Kosten auf Arkan-Spells, verfallen nach idleMs ohne Arkan-Zauber
  Arkan: { name: 'Ladungen', color: '#c573ff', full: 'Ladungen voll', max: 4, dmg: 0.15, cost: 0.25, idleMs: 10000, gain: ['ae', 'arcmissiles', 'arcstrike'] },
};

// CARD_*: Zahlen fürs Kartensystem, alles PH (docs/spells-spec.md)
export const CARD_RARITIES = [
  { name: 'grau',   color: '#b0b0b0', mult: 0.5, weight: 30 },
  { name: 'weiß',   color: '#ffffff', mult: 1,   weight: 35 },
  { name: 'grün',   color: '#3fe05a', mult: 2,   weight: 20 },
  { name: 'blau',   color: '#4aa3ff', mult: 3,   weight: 10 },
  { name: 'lila',   color: '#c573ff', mult: 4,   weight: 4 },
  { name: 'orange', color: '#ff9a2e', mult: 5,   weight: 1 },
];
export const CARD_KIND_WEIGHTS = { rang: 35, spell: 20, rune: 15, support: 10, relic: 5, talent: 10, luck: 5 };   // PH: Spec nennt keine Verteilung
export const CARD_RANK = { dmg: 0.15, mana: 0.10, radius: 0.10, tempo: 0.10, cd: 0.10, range: 3, dur: 0.10 };   // PH: tempo nur Nahkampf (Dauer der Aktion), cd = Abklingzeit, range in yd (nur Blink), dur = Dauer und Radius (?-Magier Defensiv)
export const CARD_SPELL_DMG = 0.10;                                 // Neuer Spell, Rune, Support, Relikt
export const CARD_LUCK = 5;
export const CARD_COUNT = { base: 4, luckPerCard: 25, max: 8 };
export const CARD_RELIC_LEVEL = 30;
// Kartentakt, Reihe im Hauptmenü. levels: bis Level "to" alle "every" Level. gap: ms Spielzeit zwischen zwei Kartenfenstern, der Rest wartet.
// Gestaffelt: 31 Karten, anfangs Build aufbauen, am Ende spielen. gap liegt unter dem Abstand der Karten (etwa 9 s pro Level), sonst staut es sich. // PH
export const CARD_PACES = [
  { id: 'staffel', name: 'Gestaffelt', title: 'Jedes Level bis 10, jedes 3. bis 40, dann jedes 5. Zusammen 31 Karten', levels: [{ to: 10, every: 1 }, { to: 40, every: 3 }, { to: 100, every: 5 }], gap: 15000 },
  { id: 'every1', name: '1 pro Level', title: '99 Karten', levels: [{ to: 100, every: 1 }], gap: 5000 },
  { id: 'every2', name: '1 pro 2 Level', title: '50 Karten', levels: [{ to: 100, every: 2 }], gap: 10000 },
  { id: 'every3', name: '1 pro 3 Level', title: '33 Karten', levels: [{ to: 100, every: 3 }], gap: 15000 },
];
export const CARD_CLASSIC_EVERY = 2;   // Classic pur: alle 2 Level ein Rang

// Die bisherigen Upgrades laufen als Art "Talent" weiter. m = Multiplikator der Seltenheit.
// tags: Schule, im Schul-Modus zählt nur die eigene. only: nur in diesen Modi (onlyTag), sonst nie. needs: nur mit diesem Spell im Slot.
export const CARDS = [
  // Grundwerte für alle Figuren (v31): ersetzen Arkane Macht, Eisherz, Glutherz, Sturmherz, Kampfkunst, Frostrüstung, Knochenpanzer, Arcane Mind, Glutseele
  // notOnly: nicht in diesen Modi (onlyTag). Weisheit nur für Magier mit Mana
  { id: 'might', name: 'Macht', always: true, max: 5,
    desc: (r, m) => `+${Math.round(12 * m)} % Schaden.`, apply: (r, m) => { mods.dmg += 0.12 * m; } },
  { id: 'tough', name: 'Zähigkeit', always: true, max: 3,
    desc: (r, m) => `+${Math.round(15 * m)} % maximale Gesundheit.`, apply: (r, m) => { mods.hpMult += 0.15 * m; } },
  { id: 'wisdom', name: 'Weisheit', always: true, notOnly: ['Krieger', 'Klinge', 'Blitz', 'Seuche'], max: 3,
    desc: (r, m) => `+${Math.round(10 * m)} % maximales Mana.`, apply: (r, m) => { mods.manaMult += 0.10 * m; } },
  { id: 'ibliz', name: 'Improved Blizzard', tags: ['Frost'], needs: 'bliz', max: 2,   // Rang-Werte belegt (Wowhead) bei ×1
    desc: (r, m) => `Blizzard verlangsamt Gegner um ${Math.round(Math.min(0.9, [0.3, 0.5][r] * m) * 100)} % für 1,5 s.`,
    apply: (r, m) => { mods.blizSlow = Math.max(mods.blizSlow, Math.min(0.9, [0.3, 0.5][r] * m)); } },
  { id: 'ifn', name: 'Improved Frost Nova', tags: ['Frost'], needs: 'nova', max: 2,   // 2 s je Rang belegt (Wowhead) bei ×1
    desc: (r, m) => `Frost Nova Abklingzeit −${String(2 * m).replace('.', ',')} s.`,
    apply: (r, m) => { mods.novaCd += 2000 * m; } },
  { id: 'shatter', name: 'Shatter', tags: ['Frost'], max: 3,
    desc: (r, m) => `+${Math.round(10 * m)} % kritische Trefferchance gegen eingefrorene Ziele.`, apply: (r, m) => { mods.shatter += 0.10 * m; } },
  { id: 'storm', name: 'Weiter Sturm', tags: ['Frost'], needs: 'bliz', max: 2,
    desc: (r, m) => `Blizzard-Radius +${String(2 * m).replace('.', ',')} yd.`, apply: (r, m) => { mods.blizRadius += 2 * m; } },
  // Feuer (v31). Ränge zählen ganz, nur Prozente wachsen mit der Seltenheit
  { id: 'madness', name: 'Wahnsinn', only: ['Feuer'], needs: 'fireball', max: 3,
    desc: () => 'Feuerball +1 Projektil.', apply: () => { mods.fbExtra += 1; } },
  { id: 'rapidfire', name: 'Dauerfeuer', only: ['Feuer'], needs: 'fireball', max: 2,
    desc: r => `Jeder ${r ? 3 : 4}. Feuerball kostet nichts.`, apply: r => { mods.fbFreeEvery = r ? 3 : 4; } },
  { id: 'embercore', name: 'Glutkern', only: ['Feuer'], max: 3,
    desc: (r, m) => `Überhitzt +${Math.round(15 * m)} % Schaden.`, apply: (r, m) => { mods.emberCore += 0.15 * m; } },
  { id: 'soulfire', name: 'Seelenfeuer', only: ['Feuer'], needs: 'hellfire', max: 2,
    desc: (r, m) => `Kills im Höllenfeuer heilen +${String(Math.round(5 * m) / 10).replace('.', ',')} % Leben.`, apply: (r, m) => { mods.soulFire += 0.005 * m; } },
  { id: 'starfall', name: 'Sternenfall', only: ['Feuer'], needs: 'meteor', max: 3,
    desc: () => 'Meteor-Abklingzeit −2 s pro 25 Hitze (mindestens 5 s).', apply: () => { mods.starfall += 1; } },
  { id: 'wildfire', name: 'Lauffeuer', only: ['Feuer'], needs: 'firestorm', max: 5,
    desc: () => 'Feuersbrunst springt auf 2 Mobs mehr.', apply: () => { mods.wildfire += 2; } },
  // Frost (v31). Eiszeit ist immer orange und einmal pro Run, sie legt sich auf die Bewegungs-Taste (figures.ts)
  { id: 'iceage', name: 'Eiszeit', only: ['Frost'], max: 1, minTier: 5,
    desc: () => 'Liegt passiv auf der Bewegungs-Taste statt Blink und baut die Frost-Spells um: Ice Age, Ice Time Capsule, Partisan, Pheasant Beak, Ice Saber, Eisfeld. Auf gefrorenem Boden +20 % Tempo, Gegner −40 %.',
    apply: () => { mods.iceAge = 1; } },
  { id: 'permafrost', name: 'Permafrost', only: ['Frost'], max: 2,
    desc: (r, m) => `Kälte sinkt ${Math.round(25 * m)} % langsamer.`, apply: (r, m) => { mods.permafrost += 0.25 * m; } },
  { id: 'coldburn', name: 'Kältebrand', only: ['Frost'], max: 3,
    desc: (r, m) => `Eingefrorene nehmen +${Math.round(10 * m)} % Schaden.`, apply: (r, m) => { mods.coldBurn += 0.10 * m; } },
  { id: 'stormeye', name: 'Sturmauge', only: ['Frost'], needs: 'bliz', max: 3,
    desc: () => 'Jeder Blizzard-Tick senkt die Frostkugel-Abklingzeit um 0,3 s.', apply: () => { mods.stormEye += 1; } },
  { id: 'frosteye', name: 'Frostauge', only: ['Frost'], needs: 'frostorb', max: 1,
    desc: () => 'Solange die Frostkugel fliegt, ist Blizzard sofort, ohne Kanal, und läuft 8 s von selbst.', apply: () => { mods.frostEye = 1; } },
  { id: 'shardhail', name: 'Splitterhagel', only: ['Frost'], max: 5,
    desc: (r, m) => `+${Math.max(1, Math.round(m))} maximale Eissplitter (höchstens 50).`, apply: (r, m) => { mods.shardMax += Math.max(1, Math.round(m)); } },
  // Arkan (v31)
  { id: 'splinterswarm', name: 'Splitterschwarm', only: ['Arkan'], needs: 'arcmissiles', max: 3,
    desc: (r, m) => `+${Math.round(10 * m)} % Splitter-Chance bei Arkanen Geschossen.`, apply: (r, m) => { mods.splinterSwarm += 0.10 * m; } },
  { id: 'blinkbomb', name: 'Blinkbombe', only: ['Arkan'], max: 1,
    desc: () => 'Jeder Blink löst am Ziel eine Arcane Explosion aus.', apply: () => { mods.blinkBomb = 1; } },
  { id: 'doublejump', name: 'Doppelsprung', only: ['Arkan'], max: 1,
    desc: () => '+1 Blink-Ladung.', apply: () => { mods.blinkExtra += 1; } },
  // Blitz (v31)
  { id: 'condenser', name: 'Kondensator', only: ['Blitz'], max: 1,
    desc: () => 'Batterie bis 130, Überladung erst bei 130.', apply: () => { mods.condenser = 30; } },
  { id: 'boltleap', name: 'Blitzsprung', only: ['Blitz'], max: 1,
    desc: () => 'Blink gibt +15 Ladung, statt 10 zu kosten.', apply: () => { mods.boltLeap = 25; } },   // 10 Kosten zurück + 15
  // Seuche (v31)
  { id: 'toughslime', name: 'Zäher Schleim', only: ['Seuche'], max: 3,
    desc: () => 'Festkleben und Zusammenziehen halten 1 s länger.', apply: () => { mods.toughSlime += 1; } },
  { id: 'leech', name: 'Blutegel', only: ['Seuche'], max: 3,
    desc: (r, m) => `Entziehen heilt +${String(Math.round(25 * m) / 100).replace('.', ',')} % pro Treffer.`, apply: (r, m) => { mods.leech += 0.0025 * m; } },
  { id: 'contagion', name: 'Ansteckung', only: ['Seuche'], max: 3,
    desc: () => 'Stirbt ein vergifteter Mob, springt das Gift auf 1 Mob mehr über.', apply: () => { mods.contagion += 1; } },
  { id: 'wreckingball', name: 'Abrissbirne', only: ['Seuche'], needs: 'blackhole', max: 3,
    desc: (r, m) => `Schwarzes Loch: +${Math.round(25 * m)} % Aufprallschaden.`, apply: (r, m) => { mods.wreckingBall += 0.25 * m; } },
  // Dodge (dodge.ts), in allen Modi. always: unabhängig von der Schule. Tag Bewegung, ein Support dafür gibt es noch nicht
  { id: 'dodgeCharge', name: 'Ausweichrolle', always: true, tags: ['Bewegung'], max: 1,
    desc: () => '+1 Dodge-Ladung.', apply: () => { mods.dodgeCharges += 1; } },
  { id: 'comboWindow', name: 'Kombo-Meister', always: true, tags: ['Bewegung'], max: 2,
    desc: (r, m) => `Kombo-Fenster nach dem Dodge +${Math.round(50 * m)} %.`, apply: (r, m) => { mods.comboWindow += 0.5 * m; } },   // PH
  // Blitzmagier: mehr Sprünge und Schläge statt mehr Grundschaden (v29) // PH
  { id: 'conduct', name: 'Leitfähigkeit', only: ['Blitz'], max: 3,
    desc: (r, m) => `Kettenblitz +${Math.max(1, Math.round(20 * m))} Sprünge, Bogenblitz +${Math.max(1, Math.round(4 * m))} Sprünge.`, apply: (r, m) => { mods.chainJumps += Math.max(1, Math.round(20 * m)); mods.arcJumps += Math.max(1, Math.round(4 * m)); } },   // v30 verdoppelt
  // Immer orange, selten im Angebot (offerChance), einmal pro Run
  { id: 'jumps2', name: 'Gewitterkaskade', only: ['Blitz'], max: 1, minTier: 5, offerChance: 0.15,
    desc: () => 'Alle Sprünge von Kettenblitz und Bogenblitz ×2.', apply: () => { mods.jumpMul *= 2; } },
  { id: 'thunder', name: 'Donnerhall', only: ['Blitz'], needs: 'strike', max: 2,
    desc: () => 'Blitzschlag schlägt 1 Mal mehr nach (50 %).', apply: () => { mods.strikeExtra += 1; } },
  { id: 'front', name: 'Sturmfront', only: ['Blitz'], needs: 'storm', max: 2,
    desc: () => 'Gewitter: +1 Blitz pro Takt.', apply: () => { mods.stormBolts += 1; } },
  { id: 'net', name: 'Kugelnetz', only: ['Blitz'], needs: 'ball', max: 2,
    desc: () => 'Kugelblitz zappt doppelt so oft.', apply: () => { mods.ballZaps += 1; } },
];
