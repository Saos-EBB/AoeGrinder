import { rand } from '../util';
import { player } from '../state';
import { groundAt } from '../collision';
import { pullMob } from '../mobs';
import { mobsOnLine, forward } from '../melee';
import { hasRune, schedule } from './core';
import { burstFx, SHADOW, VOID } from './fx';

const WIDE = 1.5, PULL = 8, TWICE = { ms: 400, mul: 0.6 }, BURSTS = 3;   // PH

export const surge = {
  name: 'Arkane Woge', desc: 'Welle 16 yd nach vorn, 6 yd breit.', ranks: ['dmg', 'mana', 'radius'], tags: ['Arkan', 'Fläche'], cls: 'arcane',
  mana: 130, cd: 6000, min: 60, max: 72, length: 16, radius: 6,   // PH: radius ist die Breite
  runes: [
    { id: 'wide', name: 'Breite Woge', desc: '+50 % Breite.' },
    { id: 'pull', name: 'Rücksog', desc: 'Zieht Getroffene 8 yd zu dir.' },
    { id: 'twice', name: 'Doppelwoge', desc: 'Zweite Welle nach 0,4 s mit 60 % Schaden.' },
  ],
  effect(c) {
    const f = forward(), from = player.pos.clone(), to = { x: from.x + f.x * surge.length, y: from.y, z: from.z + f.z * surge.length };
    const width = c.radius(surge.radius) * (hasRune('surge', 'wide') ? WIDE : 1);
    const wave = k => {
      for (const m of mobsOnLine(from, to, width)) if (c.hit(m, rand(surge.min, surge.max) * k) && !m.dead && hasRune('surge', 'pull')) pullMob(m, from, PULL);
      for (let i = 1; i <= BURSTS; i++) {
        const x = from.x + f.x * surge.length * i / BURSTS, z = from.z + f.z * surge.length * i / BURSTS;
        burstFx({ x, y: groundAt(x, z, from.y), z }, width / 2, [SHADOW, VOID], 0x9a4fe0);
      }
    };
    wave(1);
    if (hasRune('surge', 'twice')) schedule(TWICE.ms, () => wave(TWICE.mul));
  },
};
