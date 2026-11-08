// Brandmal-Detonation: zündet brennende Mobs. Brennend heißt: ein Feuer-Dauerschaden hat den Mob getroffen (mob.burn, gesetzt in core.ts).

import { player } from '../state';
import { maxHp } from '../formulas';
import { combatText } from '../ui/hud';
import { mobsInRadius, addField, hasRune, burnLeft } from './core';
import { detonateLook, fireField } from '../vfx/fireLook';
import { t } from '../i18n';

const BOOM = { mul: 1.5, radius: 3, big: 5 }, CHAIN = { dmg: 10, dur: 4000 }, HEAL = 0.01;   // PH

export const detonate = {
  name: t('spell.detonate.name'), desc: t('spell.detonate.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Fläche'], cls: 'fire',
  mana: 160, cd: 8000, radius: 20,   // PH
  runes: [
    { id: 'chain', name: t('spell.detonate.runes.chain.name'), desc: t('spell.detonate.runes.chain.desc') },
    { id: 'big', name: t('spell.detonate.runes.big.name'), desc: t('spell.detonate.runes.big.desc') },
    { id: 'glow', name: t('spell.detonate.runes.glow.name'), desc: t('spell.detonate.runes.glow.desc') },
  ],
  canCast: () => mobsInRadius(player.pos, detonate.radius, Infinity).some(m => burnLeft(m) > 0) ? null : t('msg.noBurning'),
  effect(c) {
    const burning = mobsInRadius(player.pos, c.radius(detonate.radius), Infinity).filter(m => burnLeft(m) > 0);
    const r = c.radius(hasRune('detonate', 'big') ? BOOM.big : BOOM.radius);
    // Erst alle Brände löschen, dann zünden: sonst zählt eine Explosion den Brand des Nachbarn mit
    const blasts = burning.map(m => ({ pos: m.pos.clone(), dmg: burnLeft(m) * BOOM.mul }));
    for (const m of burning) m.burn = null;
    for (const b of blasts) {
      for (const m of mobsInRadius(b.pos, r)) c.hit(m, b.dmg);
      if (hasRune('detonate', 'chain')) addField(c, { pos: b.pos, radius: r, dur: CHAIN.dur, visual: fireField({ h: .8 }),
        onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, CHAIN.dmg); },
      });
    }
    detonateLook(blasts.map(b => b.pos), r);
    if (hasRune('detonate', 'glow') && blasts.length) {
      const heal = Math.round(maxHp() * HEAL * blasts.length);
      player.hp = Math.min(maxHp(), player.hp + heal);
      combatText(player.pos, `+${heal}`, 'heal', 2.6);
    }
  },
};
