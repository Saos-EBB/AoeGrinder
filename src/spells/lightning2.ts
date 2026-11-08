// Neue Blitz-Spells (v31): Erdbeben, Sturmhüter, Statikfeld und das Relikt Sturmelementar.

import { state, player } from '../state';
import { UNIT } from '../config';
import { burnMob, enterCombat } from '../mobs';
import { showError, combatText } from '../ui/hud';
import { mobsInRadius, applySlow, addField, cdEnd, startCd, noteCastStart, makeCtx } from './core';
import { runChain, nearestMob, chain } from './chain';
import { quakeField, keeperLook, staticLook, elementalField } from '../vfx/boltLook';
import { t } from '../i18n';

// Alle Werte PH
const QUAKE = { radius: 8, ms: 8000, tickMs: 500, dmg: 0.8, slow: 0.2 };
const STATIC = { radius: 10, pct: 0.15, championPct: 0.075 };
const ELEM = { ms: 15000, cd: 90000, everyMs: 1000, jumps: 20, range: 30, side: 2 };

export const quake = {
  name: t('spell.quake.name'), desc: t('spell.quake.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Blitz', 'Fläche'], cls: 'lightning',
  mana: 320, charge: 40, cd: 10000, range: 30, radius: QUAKE.radius, ground: true, showDmg: QUAKE.dmg * UNIT,
  effect(c, point) {
    addField(c, { pos: point, radius: c.radius(QUAKE.radius), dur: QUAKE.ms, tickMs: QUAKE.tickMs, visual: quakeField(),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) { if (c.hit(m, QUAKE.dmg * UNIT) && !m.dead) applySlow(m, QUAKE.slow, 700); } },
    });
  },
};

// Sturmhüter: die nächsten 2 Kettenblitze sofort und mit doppeltem Schaden (chain.ts liest state.keeper)
export const keeper = {
  name: t('spell.keeper.name'), desc: t('spell.keeper.desc'), ranks: ['cd'], tags: ['Blitz'], cls: 'lightning',
  mana: 0, charge: 0, cd: 20000,
  effect() { state.keeper = 2; keeperLook(); combatText(player.pos, t('spell.keeper.name'), 'info', 2.6); },
};

// Statikfeld: fester Anteil am aktuellen Leben jedes Gegners, ohne Trefferwurf und Spieler-Boni
export const staticfield = {
  name: t('spell.staticfield.name'), desc: t('spell.staticfield.desc'), ranks: ['mana', 'radius'], tags: ['Blitz', 'Nova'], cls: 'lightning',
  mana: 160, charge: 20, cd: 6000,
  effect(c) {
    const r = c.radius(STATIC.radius);
    for (const m of mobsInRadius(player.pos, r)) {
      enterCombat(m, true);
      burnMob(m, Math.max(1, Math.round(m.hp * (m.champion ? STATIC.championPct : STATIC.pct))));
    }
    staticLook(r, () => mobsInRadius(player.pos, r).map(m => m.pos));
  },
};

// Relikt: Sturmelementar schwebt 15 s neben dir und wirft jede Sekunde einen Kettenblitz mit 20 Sprüngen
export const stormelem = {
  name: t('spell.stormelem.name'), figRelic: true, desc: t('spell.stormelem.desc'), ranks: [], tags: ['Blitz'], cls: 'lightning',
  mana: 0, cd: ELEM.cd,
  press() {
    if (cdEnd('stormelem') > state.now) return showError(t('msg.notReady'));
    startCd('stormelem');
    noteCastStart('stormelem');
    const c = makeCtx('stormelem');
    addField(c, { pos: player.pos, radius: 0.5, dur: ELEM.ms, tickMs: ELEM.everyMs, visual: elementalField(),
      onUpdate: f => { f.pos.set(player.pos.x + Math.cos(player.facing) * ELEM.side, player.pos.y + 1.5, player.pos.z - Math.sin(player.facing) * ELEM.side); },
      onTick: f => { const first = nearestMob(ELEM.range); if (first) runChain(c, first, { jumps: ELEM.jumps, range: chain.jumpRange, dmg: chain.dmg, from: f.pos }); },
    });
  },
};
