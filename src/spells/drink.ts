import { state, player } from '../state';

export const drink = {
  name: 'Trinken', cls: 'util', tags: [],
  mana: 0, cd: 0, dur: 18000, fixed: true,   // Werte PH; fixed: nicht ersetzbar, sonst gibt es keine Mana-Quelle mehr
  effect() {
    player.drink = { start: state.now, end: state.now + drink.dur };
  },
};
