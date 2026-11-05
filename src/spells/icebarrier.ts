// Eisbarriere: Schild über einen Teil der max. Leben (player.shield, abgezogen in damagePlayer). Bricht er: Mini-Nova friert ein.

import { state, player } from '../state';
import { maxHp } from '../formulas';
import { novaFx, ringFx, FROST_WHITE } from '../fx/spellFx';
import { applyRoot } from '../mobs';
import { combatText } from '../ui/hud';
import { mobsInRadius } from './core';

const B = { pct: 0.2, ms: 10000, nova: 6, freezeMs: 2000 };   // PH

export const icebarrier = {
  name: 'Eisbarriere', desc: 'Schild über 20 % der max. Leben, 10 s. Bricht er: Mini-Nova 6 yd, friert 2 s ein.', ranks: ['mana', 'cd'], tags: ['Frost', 'Schutz'], cls: 'frost',
  mana: 150, cd: 25000,   // PH
  effect() {
    player.shield = Math.round(maxHp() * B.pct);
    player.shieldUntil = state.now + B.ms;
    ringFx(player.pos, 2, FROST_WHITE, 400);
    combatText(player.pos, 'Eisbarriere', 'info', 2.6);
    player.onShieldBreak = () => {
      player.shield = 0;
      for (const m of mobsInRadius(player.pos, B.nova)) applyRoot(m, B.freezeMs);
      novaFx(player.pos, B.nova);
    };
  },
};
