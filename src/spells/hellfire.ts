import { player } from '../state';
import { spendMana } from '../player';
import { maxHp } from '../formulas';
import { burnTex } from '../fx/spellFx';
import { combatText } from '../ui/hud';
import { mobsInRadius, startChannel, stopChannel, hasRune } from './core';
import { fieldDecal, areaParticles, visuals, FIRE, SHADOW } from './fx';
import { vfxOld } from '../fx/shaders';
import { vortexVisual } from '../fx/prims';
import { hellfireOpen, hellfirePulse } from '../fx/fireFx';

const HEAL_PER_KILL = 0.05, GROW_PER_S = 1, HEAL_PER_TICK = 0.01;   // PH: 1 % max. Leben pro Tick

export const hellfire = {
  name: 'Höllenfeuer', desc: 'Kanal um dich, kostet 20 Mana pro Tick und heilt dich um 1 % pro Tick.', ranks: ['dmg', 'radius'], tags: ['Feuer', 'Kanal'], cls: 'fire',
  mana: 0, cd: 0, channel: 15000, tickDmg: 30, manaPerTick: 20, radius: 10,   // PH
  runes: [
    { id: 'heal', name: 'Seelenernte', desc: 'Heilt pro Kill.' },
    { id: 'walk', name: 'Brennender Gang', desc: 'Laufen erlaubt, halber Schaden.' },
    { id: 'grow', name: 'Ausbreitung', desc: 'Radius wächst pro Sekunde.' },
  ],
  canCast: () => player.mana < hellfire.manaPerTick ? 'Nicht genug Mana' : null,
  effect(c) {
    const ch = startChannel(c, player.pos, hellfire.channel);
    ch.mobile = hasRune('hellfire', 'walk');
    ch.radius = c.radius(hellfire.radius);
    const floor = fieldDecal(burnTex, FIRE, vfxOld() ? 0.3 : 0.14, -0.3);
    if (vfxOld()) { ch.visual = floor; return; }
    ch.visual = visuals(floor, vortexVisual([1.6, 0.6, 0.1], [0.7, 0.08, 0.9], 3.4, { top: 0.82, scroll: 1.7, peak: 0.55, spin: -0.5, dens: 0.34 }));
    ch.visual.update(player.pos, ch.radius);
    hellfireOpen(player.pos, ch.radius);
  },
  tick(ch) {
    if (player.mana < hellfire.manaPerTick) return stopChannel(true);
    spendMana(hellfire.manaPerTick);
    player.hp = Math.min(maxHp(), player.hp + maxHp() * HEAL_PER_TICK);
    if (!vfxOld()) hellfirePulse(player.pos, ch.radius);
    const dmg = hellfire.tickDmg * (ch.mobile ? 0.5 : 1);
    for (const m of mobsInRadius(player.pos, ch.radius)) {
      if (ch.c.hit(m, dmg) && m.dead && hasRune('hellfire', 'heal')) {
        const heal = Math.round(maxHp() * HEAL_PER_KILL);
        player.hp = Math.min(maxHp(), player.hp + heal);
        combatText(player.pos, `+${heal}`, 'heal', 2.6);
      }
    }
  },
  channelUpdate(ch, dt) {
    if (hasRune('hellfire', 'grow')) ch.radius += GROW_PER_S * dt / 1000;
    ch.visual.update(player.pos, ch.radius);
    areaParticles(player.pos, ch.radius, 70, dt, [FIRE, SHADOW], { up: 5, size: 0.45, swirl: 2 });
  },
  onChannelEnd(ch) { ch.visual.remove(); },
};
