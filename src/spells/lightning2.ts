// Neue Blitz-Spells (v31): Erdbeben, Sturmhüter, Statikfeld und das Relikt Sturmelementar.

import { state, player } from '../state';
import { UNIT } from '../config';
import { burnMob, enterCombat } from '../mobs';
import { blightTex } from '../fx/spellFx';
import { showError, combatText } from '../ui/hud';
import { mobsInRadius, applySlow, addField, cdEnd, startCd, noteCastStart, makeCtx } from './core';
import { runChain, nearestMob, chain } from './chain';
import { fieldDecal, areaParticles, burstFx, orbVisual, BOLT } from './fx';

// Alle Werte PH
const QUAKE = { radius: 8, ms: 8000, tickMs: 500, dmg: 0.8, slow: 0.2 };
const STATIC = { radius: 10, pct: 0.15, championPct: 0.075 };
const ELEM = { ms: 15000, cd: 90000, everyMs: 1000, jumps: 20, range: 30, side: 2 };
const EARTH = [0.9, 0.6, 0.3];

export const quake = {
  name: 'Erdbeben', desc: 'Bodenfläche 8 yd für 8 s, 0,8 Einheiten pro 0,5 s, 20 % langsamer.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Fläche'], cls: 'lightning',
  mana: 320, charge: 40, cd: 10000, range: 30, radius: QUAKE.radius, ground: true, showDmg: QUAKE.dmg * UNIT,
  effect(c, point) {
    addField(c, { pos: point, radius: c.radius(QUAKE.radius), dur: QUAKE.ms, tickMs: QUAKE.tickMs, visual: fieldDecal(blightTex, EARTH, 0.5, 0.1),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) { if (c.hit(m, QUAKE.dmg * UNIT) && !m.dead) applySlow(m, QUAKE.slow, 700); } },
      onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 30, dt, [EARTH, BOLT], { up: 2, size: 0.4 }),
    });
  },
};

// Sturmhüter: die nächsten 2 Kettenblitze sofort und mit doppeltem Schaden (chain.ts liest state.keeper)
export const keeper = {
  name: 'Sturmhüter', desc: 'Die nächsten 2 Kettenblitze sind sofort und machen +100 % Schaden.', ranks: ['cd'], tags: ['Blitz'], cls: 'lightning',
  mana: 0, charge: 0, cd: 20000,
  effect() { state.keeper = 2; combatText(player.pos, 'Sturmhüter', 'info', 2.6); },
};

// Statikfeld: fester Anteil am aktuellen Leben jedes Gegners, ohne Trefferwurf und Spieler-Boni
export const staticfield = {
  name: 'Statikfeld', desc: 'Nova 10 yd: Schaden = 15 % des aktuellen Lebens jedes Gegners (Champions 7,5 %).', ranks: ['mana', 'radius'], tags: ['Blitz', 'Nova'], cls: 'lightning',
  mana: 160, charge: 20, cd: 6000,
  effect(c) {
    const r = c.radius(STATIC.radius);
    for (const m of mobsInRadius(player.pos, r)) {
      enterCombat(m, true);
      burnMob(m, Math.max(1, Math.round(m.hp * (m.champion ? STATIC.championPct : STATIC.pct))));
    }
    burstFx(player.pos, r, [BOLT, [2.2, 2.4, 2.8]], 0xbfd8ff);
  },
};

// Relikt: Sturmelementar schwebt 15 s neben dir und wirft jede Sekunde einen Kettenblitz mit 20 Sprüngen
export const stormelem = {
  name: 'Sturmelementar', figRelic: true, desc: 'Ein Begleiter wirft 15 s lang jede Sekunde einen Kettenblitz mit 20 Sprüngen.', ranks: [], tags: ['Blitz'], cls: 'lightning',
  mana: 0, cd: ELEM.cd,
  press() {
    if (cdEnd('stormelem') > state.now) return showError('Fähigkeit ist noch nicht bereit');
    startCd('stormelem');
    noteCastStart('stormelem');
    const c = makeCtx('stormelem');
    addField(c, { pos: player.pos, radius: 0.5, dur: ELEM.ms, tickMs: ELEM.everyMs, visual: orbVisual(0xbfe0ff, 2),
      onUpdate: f => { f.pos.set(player.pos.x + Math.cos(player.facing) * ELEM.side, player.pos.y + 1.5, player.pos.z - Math.sin(player.facing) * ELEM.side); },
      onTick: f => { const first = nearestMob(ELEM.range); if (first) runChain(c, first, { jumps: ELEM.jumps, range: chain.jumpRange, dmg: chain.dmg, from: f.pos }); },
    });
  },
};
