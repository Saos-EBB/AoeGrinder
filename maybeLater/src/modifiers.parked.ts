// Geparkt am 2026-11-08 aus src/modifiers.ts. Zurück: in MODIFIERS einsetzen, 'arcane' und 'klinge' wieder in die excludes der Figuren, Modi in MODES.
// castWhileMoving und blinkCharges (Arkan) werten player.ts und spells/core.ts weiter aus.

// MODIFIERS
  { id: 'arcane', name: t('mod.arcane.name'), desc: t('mod.arcane.desc'), scoreMult: 1.4, excludes: ['frost', 'fire', 'realmen', 'klinge', 'blitz', 'plague'], startKit: ['ae', 'arcmissiles', 'barrage', 'voidorb', 'surge', 'drink', 'blink', null], onlyTag: 'Arkan',
    pool: ['ae', 'arcmissiles', 'barrage', 'voidorb', 'arcmark', 'beam', 'arcorb', 'surge', 'arcstrike'], relics: ['archon', 'timewarp'],
    castWhileMoving: true, blinkCharges: 2, hp: 0.85, manaCost: 1.15 },   // PH: Zaubern und Kanäle im Laufen, Leben, Manakosten
  // Nahkämpfer aus klinge.ts: keine Ressource, nur Abklingzeiten
  { id: 'klinge', name: t('mod.klinge.name'), desc: t('mod.klinge.desc'), scoreMult: 1, excludes: ['frost', 'fire', 'arcane', 'realmen', 'blitz', 'plague'], startKit: ['kQ', 'kE', 'kAder', 'kR', 'kKunai', 'kEat', 'kDash', null], onlyTag: 'Klinge',
    pool: ['kQ', 'kE', 'kR', 'kAder', 'kStorm', 'kKunai', 'kCounter', 'kIaido', 'kSmoke'], relics: ['kClones'] },

// MODES
  { id: 'arcaneonly', name: t('mode.arcaneonly.name'), mods: ['arcane'] },
  { id: 'klinge', name: t('mode.klinge.name'), mods: ['klinge'] },
