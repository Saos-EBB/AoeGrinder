// Phönix: passiver Slot. Stirbt der Spieler und der Phönix ist bereit, explodiert er stattdessen und steht wieder auf (player/damage.ts, damagePlayer).

import { rand } from '../util';
import { state, player } from '../state';
import { maxHp } from '../formulas';
import { hitstop, lightFlash, cameraKick } from '../fx/impact';
import { shakeCamera } from '../camera';
import { knockbackMob } from '../mobs';
import { combatText } from '../feedback';
import { mobsInRadius, addField, hasRune, hasSpell, cdEnd, startCd, makeCtx } from './core';
import { meteor } from './meteor';
import { phoenixLook, fireField } from '../vfx/fireLook';
import { t } from '../i18n';

// PH: Meteor-Schaden ×2,5, Radius wie Meteor ×1,5, Knockback in yd, Hitstop in ms, Leben nach dem Aufstehen, Schutz, Aufstehen, Wiedergeburt
const P = { dmgMul: 2.5, radiusMul: 1.5, knock: 16, knockMs: 800, hitstopMs: 320, shake: 1, hp: 0.5, ashHp: 1, invulnMs: 1500, riseMs: 900, rebornMs: 8000, rebornDmg: 0.5 };

export const phoenix = {
  name: t('spell.phoenix.name'), figRelic: true, desc: t('spell.phoenix.desc'), ranks: ['dmg', 'radius', 'cd'], tags: ['Feuer', 'Nova'], cls: 'fire',
  mana: 0, cd: 90000, min: meteor.min * P.dmgMul, max: meteor.max * P.dmgMul, radius: meteor.radius * P.radiusMul,   // PH
  runes: [
    { id: 'ash', name: t('spell.phoenix.runes.ash.name'), desc: t('spell.phoenix.runes.ash.desc') },
    { id: 'ember', name: t('spell.phoenix.runes.ember.name'), desc: t('spell.phoenix.runes.ember.desc'), cdMul: 60 / 90 },
    { id: 'reborn', name: t('spell.phoenix.runes.reborn.name'), desc: t('spell.phoenix.runes.reborn.desc') },
  ],
  canCast: () => 'Passiv: wirkt, wenn du stirbst',
  effect() {},
};

// Aufstehen 0 … 1 für die Figur (main.ts), 1 = steht
export const phoenixRise = () => Math.min(1, Math.max(0, (state.now - (player.riseAt ?? -1e9)) / P.riseMs));

// true: der Tod fällt aus
export function phoenixRevive() {
  if (!hasSpell('phoenix') || cdEnd('phoenix') > state.now) return false;
  startCd('phoenix');
  const pos = player.pos.clone(), c = makeCtx('phoenix'), r = c.radius(phoenix.radius);
  player.hp = maxHp() * (hasRune('phoenix', 'ash') ? P.ashHp : P.hp);
  player.invulnUntil = state.now + P.invulnMs;
  player.riseAt = state.now;
  if (hasRune('phoenix', 'reborn')) { player.rebornUntil = state.now + P.invulnMs + P.rebornMs; player.rebornMul = 1 + P.rebornDmg; }   // Faktor wirkt in core.ts (makeCtx)
  for (const m of mobsInRadius(pos, r)) if (c.hit(m, rand(phoenix.min, phoenix.max)) && !m.dead) knockbackMob(m, pos, P.knock, P.knockMs);
  addField(c, { pos, radius: r, dur: meteor.burnDur, visual: fireField({ h: 1.2 }),
    onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, meteor.burn); },
  });
  hitstop(P.hitstopMs);
  shakeCamera(P.shake);
  cameraKick(0.8);
  lightFlash(pos, 0xff8030, 900, r * 2.5, 700);
  phoenixLook(pos, r);
  combatText(pos, t('msg.phoenix'), 'heal', 3);
  return true;
}

// Feuersäule: dichter Strom nach oben
