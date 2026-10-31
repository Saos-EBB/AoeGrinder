import { state } from '../state';
import { hasRune } from './core';
import { runChain, nearestMob } from './chain';

const SHOCK = 5000;   // PH: Dauer

export const arc = {
  name: 'Bogenblitz', desc: 'Springt 5× in 10 yd.', ranks: ['dmg', 'mana'], tags: ['Blitz', 'Kette'], cls: 'lightning',
  mana: 90, cd: 3000, dmg: 30, jumps: 5, jumpRange: 10, range: 30,   // PH
  runes: [
    { id: 'more', name: 'Weiter Bogen', desc: '+3 Sprünge.' },
    { id: 'shock', name: 'Schock', desc: 'Ziele nehmen +10 % Schaden.' },
    { id: 'corpses', name: 'Totenleiter', desc: 'Springt über Leichen.' },
  ],
  canCast: () => nearestMob(arc.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const first = nearestMob(arc.range);
    if (!first) return;
    runChain(c, first, { jumps: arc.jumps + (hasRune('arc', 'more') ? 3 : 0), range: arc.jumpRange, dmg: arc.dmg, overCorpses: hasRune('arc', 'corpses'),
      onHit: hasRune('arc', 'shock') ? m => { m.shockUntil = state.now + SHOCK; } : null });
  },
};
