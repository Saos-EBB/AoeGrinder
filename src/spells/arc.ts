import { state } from '../state';
import { hasRune } from './core';
import { mods } from '../config';
import { runChain, nearestMob } from './chain';

const SHOCK = 5000, SPARK = 4;   // PH: Dauer, Sprünge pro Stufe der Rune Funkenregen

export const arc = {
  name: 'Bogenblitz', desc: 'Springt 5× in 10 yd.', ranks: ['dmg', 'mana'], tags: ['Blitz', 'Kette'], cls: 'lightning',
  mana: 90, cd: 3000, dmg: 15, jumps: 5,   // v29: Schaden halbiert
  jumpRange: 10, range: 30,   // PH
  runes: [
    { id: 'more', name: 'Weiter Bogen', desc: '+3 Sprünge.' },
    { id: 'shock', name: 'Schock', desc: 'Ziele nehmen +10 % Schaden.' },
    { id: 'corpses', name: 'Totenleiter', desc: 'Springt über Leichen.' },
    { id: 'spark', name: 'Funkenregen', desc: '+4 Sprünge, zweimal wählbar.', stages: 2 },
  ],
  canCast: () => nearestMob(arc.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const first = nearestMob(arc.range);
    if (!first) return;
    runChain(c, first, { jumps: arc.jumps + (hasRune('arc', 'more') ? 3 : 0) + mods.arcJumps + (hasRune('arc', 'spark') ? SPARK * (state.cardPicks['rune-arc-spark'] || 1) : 0), range: arc.jumpRange, dmg: arc.dmg, overCorpses: hasRune('arc', 'corpses'),
      onHit: hasRune('arc', 'shock') ? m => { m.shockUntil = state.now + SHOCK; } : null });
  },
};
