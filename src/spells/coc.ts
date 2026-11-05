import { rand } from '../util';
import { player } from '../state';
import { coneOfColdFx } from '../fx/spellFx';
import { applyRoot } from '../mobs';
import { mobsInRadius, applySlow, hasRune } from './core';
import { iceAge } from '../figures';
import { mobsOnLine, forward } from '../melee';
import { boltFx, ICE_WHITE } from './fx';

const CAPSULE = { len: 15, width: 3, freezeMs: 3000 };   // PH: Eiszeit

const FREEZE = 4000, CD_PER_KILL = 5000;   // PH

export const coc = {
  get name() { return iceAge() ? 'Ice Time Capsule' : 'Cone of Cold'; },
  get desc() { return iceAge() ? 'Eiswelle als Linie 15 × 3 yd, friert 3 s ein.' : 'Kegel vor dir, verlangsamt um 50 %.'; }, ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Fläche'], cls: 'frost',
  mana: 210, cd: 10000, min: 98, max: 108, range: 10, angle: Math.PI / 3, slow: 0.5, slowDur: 8000,   // Rang 1 Wowhead, Reichweite PH
  runes: [
    { id: 'round', name: 'Eisring', desc: '360°, halber Schaden.' },
    { id: 'freeze', name: 'Eiskegel', desc: 'Friert statt Slow.' },
    { id: 'reap', name: 'Kalte Ernte', desc: 'CD −5 s pro Kill.' },
  ],
  effect(c) {
    if (iceAge()) {
      const f = forward(), to = { x: player.pos.x + f.x * CAPSULE.len, y: player.pos.y, z: player.pos.z + f.z * CAPSULE.len };
      for (const m of mobsOnLine(player.pos, to, CAPSULE.width)) if (c.hit(m, rand(coc.min, coc.max)) && !m.dead) applyRoot(m, CAPSULE.freezeMs);
      boltFx({ x: player.pos.x, y: player.pos.y + 0.6, z: player.pos.z }, to, ICE_WHITE, 300);
      return;
    }
    const range = c.radius(coc.range), round = hasRune('coc', 'round'), angle = round ? Math.PI * 2 : coc.angle;
    for (const m of mobsInRadius(player.pos, range)) {
      const angleToMob = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      const diff = Math.abs(Math.atan2(Math.sin(angleToMob - player.facing), Math.cos(angleToMob - player.facing)));
      if (diff > angle / 2) continue;
      if (!c.hit(m, rand(coc.min, coc.max) * (round ? 0.5 : 1))) continue;
      if (m.dead) { if (hasRune('coc', 'reap')) player.cds.coc -= CD_PER_KILL; continue; }
      if (hasRune('coc', 'freeze')) applyRoot(m, FREEZE);
      else applySlow(m, coc.slow, coc.slowDur);
    }
    coneOfColdFx(range, angle);
  },
};
