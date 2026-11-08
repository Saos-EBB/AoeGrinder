// Geparkt am 2026-11-08 aus src/config.ts

// CARDS (Talente der Figuren)
  // Arkan (v31)
  { id: 'splinterswarm', name: t('card.splinterswarm.name'), only: ['Arkan'], needs: 'arcmissiles', max: 3,
    desc: (r, m) => t('card.splinterswarm.desc', { n: Math.round(10 * m) }), apply: (r, m) => { mods.splinterSwarm += 0.10 * m; } },
  { id: 'blinkbomb', name: t('card.blinkbomb.name'), only: ['Arkan'], max: 1,
    desc: () => t('card.blinkbomb.desc'), apply: () => { mods.blinkBomb = 1; } },
  { id: 'doublejump', name: t('card.doublejump.name'), only: ['Arkan'], max: 1,
    desc: () => t('card.doublejump.desc'), apply: () => { mods.blinkExtra += 1; } },
  // Klingenstrich (v31)
  { id: 'deepwounds', name: t('card.deepwounds.name'), only: ['Klinge'], max: 3,
    desc: () => t('card.deepwounds.desc'), apply: () => { mods.deepWounds += 1; } },
  { id: 'flicker', name: t('card.flicker.name'), only: ['Klinge'], needs: 'kDash', max: 1,
    desc: () => t('card.flicker.desc'), apply: () => { mods.flicker = 1; } },
  { id: 'shadowpact', name: t('card.shadowpact.name'), only: ['Klinge'], needs: 'kClones', max: 3,
    desc: () => t('card.shadowpact.desc'), apply: () => { mods.shadowPact += 1; } },

// SCHOOL_METER
  // Arkan (v31): Arkane Ladungen statt Fokus. Pro Ladung +15 % Schaden und +25 % Kosten auf Arkan-Spells, verfallen nach idleMs ohne Arkan-Zauber
  Arkan: { name: t('meter.Arkan.name'), color: '#c573ff', full: t('meter.Arkan.full'), max: 4, dmg: 0.15, cost: 0.25, idleMs: 10000, gain: ['ae', 'arcmissiles', 'arcstrike'] },

// mods in resetMods()
//   aeCost: 1,                                   // Arcane-Explosion-Kosten (formulas.ts manaCost)
//   splinterSwarm: 0, blinkBomb: 0, blinkExtra: 0,   // Arkan-Talente (v31); blinkBomb in spells/blink.ts effect: if (mods.blinkBomb) ae.effect(makeCtx('ae'));
//   deepWounds: 0, flicker: 0, shadowPact: 0      // Klingen-Talente (v31)
// blinkExtra: in spells/core.ts chargesOf: bonus += (id === 'blink' ? mods.blinkExtra : 0)   // Doppelsprung

// RANDOM_MAGE.cats (?-Magier): Arkan-Spells in den Pools
//   rOff: 'ae', 'surge', 'arcmissiles'
//   rUtil: 'voidorb', 'arcmark'
// CARDS wisdom: notOnly enthielt 'Klinge'
