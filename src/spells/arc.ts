import { state } from '../state';
import { hasRune } from './core';
import { mods } from '../config';
import { runChain, nearestMob } from './chain';
import { t } from '../i18n';

const SHOCK = 5000, SPARK = 8, MORE = 6;   // v30: Sprünge verdoppelt   // PH: Dauer, Sprünge pro Stufe der Rune Funkenregen

export const arc = {
  name: t('spell.arc.name'), desc: t('spell.arc.desc'), ranks: ['dmg', 'mana'], tags: ['Blitz', 'Kette'], cls: 'lightning',
  mana: 90, cd: 3000, dmg: 15, jumps: 10,   // v29: Schaden halbiert; v30: doppelte Sprünge
  jumpRange: 10, range: 30,   // PH
  runes: [
    { id: 'more', name: t('spell.arc.runes.more.name'), desc: t('spell.arc.runes.more.desc') },
    { id: 'shock', name: t('spell.arc.runes.shock.name'), desc: t('spell.arc.runes.shock.desc') },
    { id: 'corpses', name: t('spell.arc.runes.corpses.name'), desc: t('spell.arc.runes.corpses.desc') },
    { id: 'spark', name: t('spell.arc.runes.spark.name'), desc: t('spell.arc.runes.spark.desc'), stages: 2 },
  ],
  canCast: () => nearestMob(arc.range) ? null : t('msg.noTarget'),
  effect(c) {
    const first = nearestMob(arc.range);
    if (!first) return;
    runChain(c, first, { jumps: (arc.jumps + (hasRune('arc', 'more') ? MORE : 0) + mods.arcJumps + (hasRune('arc', 'spark') ? SPARK * (state.cardPicks['rune-arc-spark'] || 1) : 0)) * mods.jumpMul, range: arc.jumpRange, dmg: arc.dmg, overCorpses: hasRune('arc', 'corpses'),
      onHit: hasRune('arc', 'shock') ? m => { m.shockUntil = state.now + SHOCK; } : null });
  },
};
