// Werte aus docs/mechanics-spec.md (VMaNGOS-Code + Wowhead-Tooltips).
// "PH" = Platzhalter, nicht belegt.


// Performance-Schalter (Rechner ohne dedizierte GPU). Standardwerte entsprechen Artifact v4.
export const PERF = {
  bloom: true,          // false: kein Bloom-Pass
  maxParticles: 5000,   // Obergrenze des Partikelsystems
  maxPixelRatio: 2,     // Obergrenze für devicePixelRatio
};

export const CFG = {
  startLevel: 20,
  aggroBase: 18, aggroMin: 5, aggroLevelCap: 25,     // Creature::GetAttackDistance
  socialRadius: 10, socialDelay: 1500,              // CreatureFamilyAssistance*
  fleeAssistRadius: 30, fleeDuration: 7000,         // DoFleeToGetAssistance
  fleeHpPct: 0.15, fleeChance: 0.3,                 // PH: steht im DB-Script, nicht im Core
  leashRadius: 50, leashGrace: 12000,               // IsOutOfThreatArea
  regenTick: 2000, fiveSecRule: 5000,               // Player::Regenerate, SetLastManaUse
  critBonus: 0.5,                                   // SpellCriticalDamageBonus
  baseCrit: 0.05,                                   // PH
  gcd: 1500,                                        // PH (StartRecoveryTime aus Spelldaten)
  novaBreakChance: 0.25,                            // PH
  runSpeed: 7, backSpeed: 4.5, turnSpeed: 3.141594, // baseMoveSpeed[] in Unit.cpp (yd/s, rad/s)
  walkSpeed: 2.5,                                   // VMaNGOS src/game/Objects/Unit.cpp, baseMoveSpeed[MOVE_WALK], Zeile 69
  jumpSpeed: 8, gravity: 20,                        // PH: Sprungphysik läuft im Client, nicht im Server
  mobSpeed: 6.2,                                    // PH: steht pro Mob in creature_template.speed_run (DB)
  meleeRange: 2.2, swingTime: 2000,
  playRadius: 98,
  packCount: 9,
  curseSlow: 0.3,                                   // PH: Kurzen-Fluch
  mageHunch: 0.65,                                  // PH: gebückte Haltung des Magiers, 0 = aufrecht, 1 = stark
  padDeadzone: 0.15, padWalkBelow: 0.5,             // PH: docs/gamepad-spec.md
  blizAimStart: 12, blizAimSpeed: 25,               // PH: Blizzard-Zielkreis am Pad (yd, yd/s)
  padYaw: 2.5, padPitch: 1.5,                       // PH: Kamera am Pad (rad/s bei vollem Ausschlag)
};

// SPELL_*: Die Werte pro Spell stehen in src/spells/<id>.ts, index.ts registriert sie hier.
export const SPELLS: any = {};
export const SPELL_SLOTS = 8;
export const SPELL_START = ['nova', 'ae', 'bliz', 'coc', 'blink', 'drink'];
// Die Tasten-Aktionen heißen seit v1 wie das Start-Kit. Sie stehen für den Slot, nicht für den Spell.
export const SPELL_ACTIONS = ['nova', 'ae', 'bliz', 'coc', 'blink', 'drink', 'slot7', 'slot8'];

// Roguelike-Modifikatoren (werden von Karten verändert)
export const mods: any = {};
export function resetMods() {
  Object.assign(mods, { dmg: 1, shatter: 0, novaCd: 0, aeCost: 1, blizSlow: 0, blizRadius: 0, castRegen: 0, manaMult: 1, hpMult: 1 });
}

// "verified: true" = Wert belegt (Wowhead-Tooltip). Sonst Prototyp-Erfindung.
export const CARDS = [
  { id: 'ibliz', name: 'Improved Blizzard', verified: true, max: 2,
    desc: r => `Blizzard verlangsamt Gegner um ${[30, 50][r]} % für 1,5 s.`, apply: r => mods.blizSlow = [0.3, 0.5][r] },
  { id: 'ifn', name: 'Improved Frost Nova', verified: true, max: 2,
    desc: r => `Frost Nova Abklingzeit ${[23, 21][r]} s statt ${[25, 23][r]} s.`, apply: r => mods.novaCd = [2000, 4000][r] },
  { id: 'shatter', name: 'Shatter', max: 3,
    desc: () => '+10 % kritische Trefferchance gegen eingefrorene Ziele.', apply: () => mods.shatter += 0.10 },
  { id: 'power', name: 'Arkane Macht', max: 5,
    desc: () => '+12 % Zauberschaden.', apply: () => mods.dmg += 0.12 },
  { id: 'amind', name: 'Arcane Mind', max: 3,
    desc: () => '+10 % maximales Mana.', apply: () => mods.manaMult += 0.10 },
  { id: 'amed', name: 'Arcane Meditation', max: 3,
    desc: () => '+5 % Mana-Regeneration während der 5-Sekunden-Regel.', apply: () => mods.castRegen += 0.05 },
  { id: 'storm', name: 'Weiter Sturm', max: 2,
    desc: () => 'Blizzard-Radius +2 yd.', apply: () => mods.blizRadius += 2 },
  { id: 'aecost', name: 'Arkane Effizienz', max: 2,
    desc: () => 'Arcane Explosion kostet 15 % weniger Mana.', apply: () => mods.aeCost -= 0.15 },
  { id: 'armor', name: 'Frostrüstung', max: 3,
    desc: () => '+15 % maximale Gesundheit.', apply: () => mods.hpMult += 0.15 },
];
