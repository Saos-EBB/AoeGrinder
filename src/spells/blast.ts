import { rand, dist2d } from '../util';
import { player } from '../state';
import { blastLook, fireRingField } from '../vfx/fireLook';
import { knockbackMob, pullMob } from '../mobs';
import { mobsInRadius, applySlow, addField, hasRune } from './core';
import { t } from '../i18n';

const RING = { dur: 5000, width: 1.5, dmg: 14 };   // PH

export const blast = {
  name: t('spell.blast.name'), desc: t('spell.blast.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Nova'], cls: 'fire',
  mana: 150, cd: 12000, min: 40, max: 48, radius: 10, knock: 8, slow: 0.5, slowDur: 6000,   // PH
  runes: [
    { id: 'suck', name: t('spell.blast.runes.suck.name'), desc: t('spell.blast.runes.suck.desc') },
    { id: 'ring', name: t('spell.blast.runes.ring.name'), desc: t('spell.blast.runes.ring.desc') },
    { id: 'quick', name: t('spell.blast.runes.quick.name'), desc: t('spell.blast.runes.quick.desc'), cdMul: 0.5 },
  ],
  effect(c) {
    const r = c.radius(blast.radius), center = player.pos.clone();
    for (const m of mobsInRadius(center, r)) {
      if (!c.hit(m, rand(blast.min, blast.max)) || m.dead) continue;
      applySlow(m, blast.slow, blast.slowDur);
      if (hasRune('blast', 'suck')) pullMob(m, center, blast.knock);
      else if (!hasRune('blast', 'quick')) knockbackMob(m, center, blast.knock);
    }
    blastLook(center, r, hasRune('blast', 'suck'));
    if (!hasRune('blast', 'ring')) return;
    addField(c, { pos: center, radius: r, dur: RING.dur, visual: fireRingField(),
      onTick: f => {
        for (const m of mobsInRadius(f.pos, f.radius + RING.width)) if (dist2d(m.pos, f.pos) >= f.radius - RING.width) c.hit(m, RING.dmg);
      },
    });
  },
};
