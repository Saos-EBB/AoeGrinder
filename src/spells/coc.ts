import { rand } from '../util';
import { player } from '../state';
import { coneOfColdFx } from '../fx/spellFx';
import { applyRoot } from '../mobs';
import { mobsInRadius, applySlow, hasRune } from './core';
import { iceAge } from '../figures';
import { mobsOnLine, forward } from '../melee';
import { capsuleLook } from '../vfx/frostLook';
import { t } from '../i18n';

const CAPSULE = { len: 15, width: 3, freezeMs: 3000 };   // PH: Eiszeit

const FREEZE = 4000, CD_PER_KILL = 5000;   // PH

export const coc = {
  get name() { return t(iceAge() ? 'iceage.coc.name' : 'spell.coc.name'); },
  get desc() { return t(iceAge() ? 'iceage.coc.desc' : 'spell.coc.desc'); }, ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Fläche'], cls: 'frost',
  mana: 210, cd: 10000, min: 98, max: 108, range: 10, angle: Math.PI / 3, slow: 0.5, slowDur: 8000,   // Rang 1 Wowhead, Reichweite PH
  runes: [
    { id: 'round', name: t('spell.coc.runes.round.name'), desc: t('spell.coc.runes.round.desc') },
    { id: 'freeze', name: t('spell.coc.runes.freeze.name'), desc: t('spell.coc.runes.freeze.desc') },
    { id: 'reap', name: t('spell.coc.runes.reap.name'), desc: t('spell.coc.runes.reap.desc') },
  ],
  effect(c) {
    if (iceAge()) {
      const f = forward(), to = { x: player.pos.x + f.x * CAPSULE.len, y: player.pos.y, z: player.pos.z + f.z * CAPSULE.len };
      for (const m of mobsOnLine(player.pos, to, CAPSULE.width)) if (c.hit(m, rand(coc.min, coc.max)) && !m.dead) applyRoot(m, CAPSULE.freezeMs, 'ice');
      capsuleLook(player.pos, to as any, CAPSULE.width);   // Eiszeit: Eiszacken laufen die Linie entlang
      return;
    }
    const range = c.radius(coc.range), round = hasRune('coc', 'round'), angle = round ? Math.PI * 2 : coc.angle;
    for (const m of mobsInRadius(player.pos, range)) {
      const angleToMob = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      const diff = Math.abs(Math.atan2(Math.sin(angleToMob - player.facing), Math.cos(angleToMob - player.facing)));
      if (diff > angle / 2) continue;
      if (!c.hit(m, rand(coc.min, coc.max) * (round ? 0.5 : 1))) continue;
      if (m.dead) { if (hasRune('coc', 'reap')) player.cds.coc -= CD_PER_KILL; continue; }
      if (hasRune('coc', 'freeze')) applyRoot(m, FREEZE, 'ice');
      else applySlow(m, coc.slow, coc.slowDur);
    }
    coneOfColdFx(range, angle);
  },
};
