// Eisbarriere: Schild über einen Teil der max. Leben (player.shield, abgezogen in damagePlayer). Bricht er: Mini-Nova friert ein.

import { state, player } from '../state';
import { maxHp } from '../formulas';
import { novaFx } from '../fx/spellFx';
import { barrierLook } from '../vfx/frostLook';
import { applyRoot } from '../mobs';
import { combatText } from '../ui/hud';
import { mobsInRadius } from './core';
import { t } from '../i18n';

const B = { pct: 0.2, ms: 10000, nova: 6, freezeMs: 2000 };   // PH

export const icebarrier = {
  name: t('spell.icebarrier.name'), desc: t('spell.icebarrier.desc'), ranks: ['mana', 'cd'], tags: ['Frost', 'Schutz'], cls: 'frost',
  mana: 150, cd: 25000,   // PH
  effect() {
    player.shield = Math.round(maxHp() * B.pct);
    player.shieldUntil = state.now + B.ms;
    barrierLook();
    combatText(player.pos, t('spell.icebarrier.name'), 'info', 2.6);
    player.onShieldBreak = () => {
      player.shield = 0;
      for (const m of mobsInRadius(player.pos, B.nova)) applyRoot(m, B.freezeMs, 'ice');
      novaFx(player.pos, B.nova);
    };
  },
};
