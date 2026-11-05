// Eiszeit: orange Karte nur für Frost (config.ts CARDS iceage). Liegt dauerhaft passiv auf der Bewegungs-Taste und baut die Frost-Spells um (figures.ts iceAge).

export const iceage = {
  name: 'Eiszeit', desc: 'Passiv: Frost Nova → Ice Age, Cone of Cold → Ice Time Capsule, Eislanze → Partisan, Frostkugel → Pheasant Beak, Wirbel → Ice Saber, Blizzard → Eisfeld. Auf gefrorenem Boden +20 % Tempo, Gegner −40 %.',
  ranks: [], tags: ['Frost'], cls: 'frost', fixed: true, mana: 0, cd: 0,
  canCast: () => 'Passiv',
  effect() {},
};
