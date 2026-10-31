import { rand } from '../util';
import { player } from '../state';
import { novaFx, ringFx, FROST_WHITE } from '../fx/spellFx';
import { applyRoot, enterCombat } from '../mobs';
import { mobsInRadius, hasRune, schedule } from './core';

export const nova = {
  name: 'Frost Nova', desc: 'Friert Gegner um dich bis zu 8 s ein.', ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Nova'], cls: 'frost',
  mana: 55, cd: 25000, min: 19, max: 21, radius: 10, root: 8000,   // Rang 1 Wowhead, Radius PH
  runes: [
    { id: 'repeat', name: 'Kaltes Echo', desc: 'Wiederholt sich von jedem getroffenen Gegner.' },
    { id: 'deep', name: 'Tiefes Eis', desc: 'Doppelte Eisdauer, kein Schaden.' },
    { id: 'charges', name: 'Zweiter Frost', desc: '2 Ladungen.', charges: 2 },
  ],
  effect(c) {
    const r = c.radius(nova.radius), targets = mobsInRadius(player.pos, r);
    const burst = (m, dmg, root) => { if (dmg ? c.hit(m, dmg) && !m.dead : true) applyRoot(m, root); };
    if (hasRune('nova', 'deep')) {
      for (const m of targets) { enterCombat(m, true); burst(m, 0, nova.root * 2); }
    } else {
      const hits = targets.filter(m => c.hit(m, rand(nova.min, nova.max)));
      for (const m of hits) if (!m.dead) applyRoot(m, nova.root);
      if (hasRune('nova', 'repeat')) schedule(250, () => {   // nur eine Generation, sonst läuft es nie aus
        for (const from of hits) {
          ringFx(from.pos, r, FROST_WHITE, 400);
          for (const m of mobsInRadius(from.pos, r)) burst(m, rand(nova.min, nova.max), nova.root);
        }
      });
    }
    novaFx(player.pos, r);
  },
};
