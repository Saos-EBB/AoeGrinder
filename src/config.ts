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
export const SCORE_VERSION = 'v26';

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
export const SPELL_START = ['nova', 'ae', 'bliz', 'coc', 'blink', 'drink'];
// Die Tasten-Aktionen heißen seit v1 wie das Start-Kit. Sie stehen für den Slot, nicht für den Spell.
export const SPELL_ACTIONS = ['nova', 'ae', 'bliz', 'coc', 'blink', 'drink', 'slot7', 'slot8'];

// Roguelike-Modifikatoren (werden von Karten verändert)
export const mods: any = {};
export function resetMods() {
  Object.assign(mods, { dmg: 1, shatter: 0, novaCd: 0, aeCost: 1, blizSlow: 0, blizRadius: 0, castRegen: 0, manaMult: 1, hpMult: 1, crit: 0, cdMul: 1, moveMul: 1, radius: 1, durMul: 1, castMul: 1, manaCostMul: 1, dodgeCharges: 0, comboWindow: 1 });
}

// ?-Magier (Modus normal, spells/random.ts): 4 Tasten würfeln aus Kategorien. Der eigene CD der Spells zählt nicht, nur der der Kategorie. Alles PH
export const RANDOM_MAGE = {
  kit: ['rOff', 'rDef', 'rUtil', 'rDrink'],
  cats: {
    rOff: { name: 'Offensiv', cd: 1000, pool: ['ae', 'surge', 'arcmissiles', 'fireball', 'flame', 'meteor', 'detonate', 'frostorb', 'icelance', 'bliz'] },   // „nur GCD“: einen GCD gibt es seit v22 nicht, 1 s
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

// Kill-Anzeige der Schul-Modi (schoolMeter.ts): Kills füllen 0 … 1, ohne Kill sinkt sie. Voll: Bonus der Schule. Alles PH
export const SCHOOL_METER = {
  perKill: 0.02, perChampion: 0.10, idleMs: 3000, decayPerS: 0.05,
  // Feuer: Hitze statt Kills. Treffer heizen, Hitze macht Schaden und Brand stärker, ab max brennt er selbst bis unter overheatUntil
  Feuer: { name: 'Hitze', color: '#ff7a1a', hot: '#ff2a12', hotFrom: 80, full: 'Überhitzt', max: 100, perHit: 1.5, coolDelayMs: 1500, coolPerS: 10,
    dmgPerHeat: 0.004, burnPerHeat: 0.008, overheatSelfPctPerS: 0.03, overheatUntil: 50, selfTickMs: 500 },
  Frost: { name: 'Kälte', color: '#7fd0ff', full: 'Kälte voll: +35 % Slow', slow: 0.35, slowMax: 0.8 },
  Arkan: { name: 'Fokus', color: '#c573ff', full: 'Fokus voll: −25 % Abklingzeit', cd: 0.25 },
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
  { id: 'ibliz', name: 'Improved Blizzard', tags: ['Frost'], needs: 'bliz', max: 2,   // Rang-Werte belegt (Wowhead) bei ×1
    desc: (r, m) => `Blizzard verlangsamt Gegner um ${Math.round(Math.min(0.9, [0.3, 0.5][r] * m) * 100)} % für 1,5 s.`,
    apply: (r, m) => { mods.blizSlow = Math.max(mods.blizSlow, Math.min(0.9, [0.3, 0.5][r] * m)); } },
  { id: 'ifn', name: 'Improved Frost Nova', tags: ['Frost'], needs: 'nova', max: 2,   // 2 s je Rang belegt (Wowhead) bei ×1
    desc: (r, m) => `Frost Nova Abklingzeit −${String(2 * m).replace('.', ',')} s.`,
    apply: (r, m) => { mods.novaCd += 2000 * m; } },
  { id: 'shatter', name: 'Shatter', tags: ['Frost'], max: 3,
    desc: (r, m) => `+${Math.round(10 * m)} % kritische Trefferchance gegen eingefrorene Ziele.`, apply: (r, m) => { mods.shatter += 0.10 * m; } },
  { id: 'power', name: 'Arkane Macht', tags: ['Arkan'], max: 5,
    desc: (r, m) => `+${Math.round(12 * m)} % Zauberschaden.`, apply: (r, m) => { mods.dmg += 0.12 * m; } },
  { id: 'amind', name: 'Arcane Mind', tags: ['Arkan'], max: 3,
    desc: (r, m) => `+${Math.round(10 * m)} % maximales Mana.`, apply: (r, m) => { mods.manaMult += 0.10 * m; } },
  { id: 'amed', name: 'Arcane Meditation', tags: ['Arkan'], max: 3,
    desc: (r, m) => `+${Math.round(5 * m)} % Mana-Regeneration während der 5-Sekunden-Regel.`, apply: (r, m) => { mods.castRegen += 0.05 * m; } },
  { id: 'storm', name: 'Weiter Sturm', tags: ['Frost'], needs: 'bliz', max: 2,
    desc: (r, m) => `Blizzard-Radius +${String(2 * m).replace('.', ',')} yd.`, apply: (r, m) => { mods.blizRadius += 2 * m; } },
  { id: 'aecost', name: 'Arkane Effizienz', tags: ['Arkan'], needs: 'ae', max: 2,
    desc: (r, m) => `Arcane Explosion kostet ${Math.round(15 * m)} % weniger Mana.`, apply: (r, m) => { mods.aeCost = Math.max(0.1, mods.aeCost - 0.15 * m); } },
  { id: 'armor', name: 'Frostrüstung', tags: ['Frost'], max: 3,
    desc: (r, m) => `+${Math.round(15 * m)} % maximale Gesundheit.`, apply: (r, m) => { mods.hpMult += 0.15 * m; } },
  // Dodge (dodge.ts), in allen Modi. always: unabhängig von der Schule. Tag Bewegung, ein Support dafür gibt es noch nicht
  { id: 'dodgeCharge', name: 'Ausweichrolle', always: true, tags: ['Bewegung'], max: 1,
    desc: () => '+1 Dodge-Ladung.', apply: () => { mods.dodgeCharges += 1; } },
  { id: 'comboWindow', name: 'Kombo-Meister', always: true, tags: ['Bewegung'], max: 2,
    desc: (r, m) => `Kombo-Fenster nach dem Dodge +${Math.round(50 * m)} %.`, apply: (r, m) => { mods.comboWindow += 0.5 * m; } },   // PH
  { id: 'martial', name: 'Kampfkunst', only: ['Krieger', 'Klinge'], max: 5,
    desc: (r, m) => `+${Math.round(12 * m)} % Schaden.`, apply: (r, m) => { mods.dmg += 0.12 * m; } },
  { id: 'bonearmor', name: 'Knochenpanzer', only: ['Krieger', 'Klinge'], max: 3,
    desc: (r, m) => `+${Math.round(15 * m)} % maximale Gesundheit.`, apply: (r, m) => { mods.hpMult += 0.15 * m; } },
  // Gegenstücke zu Arkane Macht und Arcane Mind, damit die Schul-Modi dieselben Grundwerte steigern können
  { id: 'iceheart', name: 'Eisherz', only: ['Frost'], max: 5,
    desc: (r, m) => `+${Math.round(12 * m)} % Zauberschaden.`, apply: (r, m) => { mods.dmg += 0.12 * m; } },
  { id: 'emberheart', name: 'Glutherz', only: ['Feuer'], max: 5,
    desc: (r, m) => `+${Math.round(12 * m)} % Zauberschaden.`, apply: (r, m) => { mods.dmg += 0.12 * m; } },
  { id: 'embersoul', name: 'Glutseele', only: ['Feuer'], max: 3,
    desc: (r, m) => `+${Math.round(10 * m)} % maximales Mana.`, apply: (r, m) => { mods.manaMult += 0.10 * m; } },
];
