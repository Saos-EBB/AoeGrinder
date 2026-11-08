import { player } from '../state';
import { maxHp } from '../formulas';
import { mods } from '../config';
import { combatText } from '../ui/hud';
import { mobsInRadius, startChannel, stopChannel, hasRune } from './core';
import { hellfireLook } from '../vfx/fireLook';
import { t } from '../i18n';

const HEAL_PER_KILL = 0.05, GROW_PER_S = 1, HEAL_PER_TICK = 0.01, LIFE_PER_TICK = 0.03;   // PH: heilt 1 %, kostet 3 % max. Leben pro Tick (v31 statt Mana)

export const hellfire = {
  name: t('spell.hellfire.name'), desc: t('spell.hellfire.desc'), ranks: ['dmg', 'radius'], tags: ['Feuer', 'Kanal'], cls: 'fire',
  mana: 0, cd: 0, channel: 15000, tickDmg: 30, radius: 10,   // PH
  runes: [
    { id: 'heal', name: t('spell.hellfire.runes.heal.name'), desc: t('spell.hellfire.runes.heal.desc') },
    { id: 'walk', name: t('spell.hellfire.runes.walk.name'), desc: t('spell.hellfire.runes.walk.desc') },
    { id: 'grow', name: t('spell.hellfire.runes.grow.name'), desc: t('spell.hellfire.runes.grow.desc') },
  ],
  canCast: () => player.hp <= maxHp() * LIFE_PER_TICK ? 'Nicht genug Leben' : null,
  effect(c) {
    const ch = startChannel(c, player.pos, hellfire.channel);
    ch.mobile = hasRune('hellfire', 'walk');
    ch.radius = c.radius(hellfire.radius);
    ch.visual = hellfireLook();
    ch.visual.update(player.pos, ch.radius);
  },
  tick(ch) {
    if (player.hp <= maxHp() * LIFE_PER_TICK) return stopChannel(true);
    player.hp = Math.min(maxHp(), player.hp - maxHp() * LIFE_PER_TICK + maxHp() * HEAL_PER_TICK);
    const dmg = hellfire.tickDmg * (ch.mobile ? 0.5 : 1);
    for (const m of mobsInRadius(player.pos, ch.radius)) {
      if (ch.c.hit(m, dmg) && m.dead && (hasRune('hellfire', 'heal') || mods.soulFire)) {   // Seelenfeuer: Kills im Höllenfeuer heilen
        const heal = Math.round(maxHp() * ((hasRune('hellfire', 'heal') ? HEAL_PER_KILL : 0) + mods.soulFire));
        player.hp = Math.min(maxHp(), player.hp + heal);
        combatText(player.pos, `+${heal}`, 'heal', 2.6);
      }
    }
  },
  channelUpdate(ch, dt) {
    if (hasRune('hellfire', 'grow')) ch.radius += GROW_PER_S * dt / 1000;
    ch.visual.update(player.pos, ch.radius);
  },
  onChannelEnd(ch) { ch.visual.remove(); },
};
