import { rand } from '../util';
import { player } from '../state';
import { novaFx, ringFx, FROST_WHITE } from '../fx/spellFx';
import { applyRoot, enterCombat } from '../mobs';
import { mobsInRadius, hasRune, schedule, addField } from './core';
import { iceAge, frozenGroundTick } from '../figures';
import { iceGroundField } from '../vfx/frostLook';
import { t } from '../i18n';

const AGE = { radius: 1.5, groundMs: 6000 };   // PH: Eiszeit

export const nova = {
  get name() { return t(iceAge() ? 'iceage.nova.name' : 'spell.nova.name'); },
  get desc() { return t(iceAge() ? 'iceage.nova.desc' : 'spell.nova.desc'); }, ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Nova'], cls: 'frost',
  mana: 55, cd: 25000, min: 19, max: 21, radius: 10, root: 8000,   // Rang 1 Wowhead, Radius PH
  runes: [
    { id: 'repeat', name: t('spell.nova.runes.repeat.name'), desc: t('spell.nova.runes.repeat.desc') },
    { id: 'deep', name: t('spell.nova.runes.deep.name'), desc: t('spell.nova.runes.deep.desc') },
    { id: 'charges', name: t('spell.nova.runes.charges.name'), desc: t('spell.nova.runes.charges.desc'), charges: 2 },
  ],
  effect(c) {
    const at = c.at ?? player.pos;   // c.at: Nova an anderer Stelle (Set Splitterkönig, needle.ts)
    const r = c.radius(nova.radius) * (iceAge() ? AGE.radius : 1), targets = mobsInRadius(at, r);
    if (iceAge()) addField(c, { pos: at, radius: r, dur: AGE.groundMs, tickMs: 250, visual: iceGroundField(), onTick: frozenGroundTick });
    const burst = (m, dmg, root) => { if (dmg ? c.hit(m, dmg) && !m.dead : true) applyRoot(m, root, 'ice'); };
    if (hasRune('nova', 'deep')) {
      for (const m of targets) { enterCombat(m, true); burst(m, 0, nova.root * 2); }
    } else {
      const hits = targets.filter(m => c.hit(m, rand(nova.min, nova.max)));
      for (const m of hits) if (!m.dead) applyRoot(m, nova.root, 'ice');
      if (hasRune('nova', 'repeat')) schedule(250, () => {   // nur eine Generation, sonst läuft es nie aus
        for (const from of hits) {
          ringFx(from.pos, r, FROST_WHITE, 400);
          for (const m of mobsInRadius(from.pos, r)) burst(m, rand(nova.min, nova.max), nova.root);
        }
      });
    }
    novaFx(at, r);
  },
};
