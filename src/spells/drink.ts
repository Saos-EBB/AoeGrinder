import { state, player } from '../state';
import { t } from '../i18n';

export const drink = {
  name: t('spell.drink.name'), cls: 'util', desc: t('spell.drink.desc'), tags: [],
  mana: 0, cd: 0, dur: 18000, fixed: true,   // Werte PH; fixed: nicht ersetzbar, sonst gibt es keine Mana-Quelle mehr
  effect() {
    player.drink = { start: state.now, end: state.now + drink.dur };
  },
};
