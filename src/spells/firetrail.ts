// Feuerspur: 10 s Brandspur hinter dir, kostet Mana pro Sekunde, Lauftempo steigt über die Dauer. Läuft als Fläche, die dem Spieler folgt.

import { state, player } from '../state';
import { UNIT } from '../config';
import { burnTex } from '../fx/spellFx';
import { mobsInRadius, addField } from './core';
import { fieldDecal, areaParticles, FIRE, EMBER } from './fx';

// PH: 10 s, Spur hält 10 s, 0,8 Einheiten pro Sekunde, alle 0,5 s ein Stück 1,6 yd, Tempo +5 % → +15 %
const T = { ms: 10000, segMs: 10000, dps: 0.8, dropMs: 500, segRadius: 1.6, manaPerS: 15, speed: [0.05, 0.15] };

function segment(c, pos) {
  addField(c, { pos, radius: T.segRadius, dur: T.segMs, visual: fieldDecal(burnTex, EMBER, 0.35, 0.05),
    onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, T.dps * UNIT); },
    onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 8, dt, [FIRE, EMBER], { up: 3, size: 0.3 }),
  });
}

export const firetrail = {
  name: 'Feuerspur', desc: '10 s Brandspur hinter dir, die Spur hält 10 s, 0,8 Einheiten pro Sekunde. Lauftempo +5 % → +15 % über die Dauer. 15 Mana pro Sekunde.', ranks: ['dmg', 'radius'], tags: ['Feuer', 'Fläche', 'Bewegung'], cls: 'fire',
  mana: 0, cd: 12000, showDmg: T.dps * UNIT,   // PH: Kosten laufen pro Sekunde
  canCast: () => player.mana < T.manaPerS ? 'Nicht genug Mana' : null,
  effect(c) {
    addField(c, { pos: player.pos, radius: 0.1, dur: T.ms, tickMs: T.dropMs, start: state.now,
      onTick: f => {
        const cost = T.manaPerS * T.dropMs / 1000;
        if (player.mana < cost) { f.end = state.now; return; }
        player.mana -= cost;
        segment(c, player.pos.clone());
      },
      onUpdate: f => {
        f.pos.copy(player.pos);
        const t = Math.min(1, (state.now - f.start) / T.ms);
        player.speedBuff = 1 + T.speed[0] + (T.speed[1] - T.speed[0]) * t;
      },
      onEnd: () => { player.speedBuff = 1; },
    });
  },
};
