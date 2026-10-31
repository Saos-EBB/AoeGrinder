import { pick } from '../util';
import { player } from '../state';
import { slowSwing, pullMob } from '../mobs';
import { mobsInRadius, startChannel, hasRune } from './core';
import { fieldDecal, areaParticles, boltFx, NATURE, BOLT } from './fx';

const SWING_SLOW = 0.25, PULL_PER_S = 2, BOLT_DMG = 40;   // PH

export const hurricane = {
  name: 'Hurrikan', desc: 'Kanal aufs Bodenziel, Gegner schlagen 25 % langsamer.', ranks: ['dmg', 'mana', 'radius'], tags: ['Natur', 'Fläche', 'Kanal'], cls: 'nature',
  mana: 300, cd: 0, channel: 10000, tickDmg: 22, range: 30, radius: 10, ground: true,   // PH
  runes: [
    { id: 'pull', name: 'Auge des Sturms', desc: 'Zieht zur Mitte.' },
    { id: 'follow', name: 'Sturmläufer', desc: 'Folgt dir.' },
    { id: 'bolt', name: 'Gewitter', desc: '1 Blitz/s auf ein Ziel.' },
  ],
  effect(c, point) {
    const ch = startChannel(c, point.clone(), hurricane.channel);
    ch.mobile = hasRune('hurricane', 'follow');   // Folgen hieße sonst: stehen bleiben
    ch.radius = c.radius(hurricane.radius);
    ch.visual = fieldDecal(NATURE, 0.16);
  },
  tick(ch) {
    const targets = mobsInRadius(ch.point, ch.radius);
    for (const m of targets) ch.c.hit(m, hurricane.tickDmg);
    if (!hasRune('hurricane', 'bolt') || !targets.length) return;
    const m = pick(targets);
    boltFx({ x: m.pos.x, y: m.pos.y + 12, z: m.pos.z }, m.pos, BOLT, 220);
    ch.c.hit(m, BOLT_DMG);
  },
  channelUpdate(ch, dt) {
    if (hasRune('hurricane', 'follow')) ch.point.copy(player.pos);
    for (const m of mobsInRadius(ch.point, ch.radius)) {
      slowSwing(m, SWING_SLOW, dt);
      if (hasRune('hurricane', 'pull')) pullMob(m, ch.point, PULL_PER_S * dt / 1000);
    }
    ch.visual.update(ch.point, ch.radius);
    areaParticles(ch.point, ch.radius, 70, dt, [NATURE, [1.4, 2, 1.4]], { up: 7, size: 0.3, swirl: 9, life: 1 });
  },
  onChannelEnd(ch) { ch.visual.remove(); },
};
