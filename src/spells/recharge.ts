// Aufladen statt Trinken (Blitz only): 2 s stehen, Hand hoch, dann +60 Ladung. Bricht ab wie Trinken.

import { state, player } from '../state';
import { BATTERY } from '../config';
import { combatText } from '../ui/hud';
import { batteryCharge } from '../battery';
import { t } from '../i18n';

export const recharge = {
  name: t('spell.recharge.name'), cls: 'lightning', desc: t('spell.recharge.desc'), tags: [],
  mana: 0, charge: 0, cd: 0, fixed: true,   // PH
  canCast: () => player.grounded ? null : t('msg.notInAir'),
  effect() {
    player.drink = { start: state.now, end: state.now + BATTERY.recharge.ms, custom: true, kind: 'recharge', pose: 'charge', label: t('spell.recharge.name'),
      onDone: () => { batteryCharge(BATTERY.recharge.amount); combatText(player.pos, t('msg.charge', { n: BATTERY.recharge.amount }), 'heal', 2.6); } };
  },
};
