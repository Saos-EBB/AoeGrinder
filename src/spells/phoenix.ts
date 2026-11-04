// Phönix: passiver Slot. Stirbt der Spieler und der Phönix ist bereit, explodiert er stattdessen und steht wieder auf (player.ts, damagePlayer).

import { rand } from '../util';
import { state, player } from '../state';
import { maxHp } from '../formulas';
import { burnTex } from '../fx/spellFx';
import { particles } from '../fx/particles';
import { hitstop, lightFlash, cameraKick } from '../fx/impact';
import { shakeCamera } from '../camera';
import { knockbackMob } from '../mobs';
import { combatText } from '../ui/hud';
import { mobsInRadius, addField, hasRune, hasSpell, cdEnd, startCd, makeCtx } from './core';
import { meteor } from './meteor';
import { burstFx, fieldDecal, areaParticles, FIRE, EMBER } from './fx';

// PH: Meteor-Schaden ×2,5, Radius wie Meteor ×1,5, Knockback in yd, Hitstop in ms, Leben nach dem Aufstehen, Schutz, Aufstehen, Wiedergeburt
const P = { dmgMul: 2.5, radiusMul: 1.5, knock: 16, knockMs: 800, hitstopMs: 320, shake: 1, hp: 0.5, ashHp: 1, invulnMs: 1500, riseMs: 900, rebornMs: 8000, rebornDmg: 0.5 };

export const phoenix = {
  name: 'Phönix', desc: 'Passiv: Stirbst du, explodierst du stattdessen mit 2,5-fachem Meteor-Schaden und stehst mit 50 % Leben wieder auf. CD 90 s.', ranks: ['dmg', 'radius', 'cd'], tags: ['Feuer', 'Nova'], cls: 'fire',
  mana: 0, cd: 90000, min: meteor.min * P.dmgMul, max: meteor.max * P.dmgMul, radius: meteor.radius * P.radiusMul,   // PH
  runes: [
    { id: 'ash', name: 'Asche', desc: 'Aufstehen mit 100 % Leben.' },
    { id: 'ember', name: 'Ewige Glut', desc: 'CD 60 s.', cdMul: 60 / 90 },
    { id: 'reborn', name: 'Wiedergeburt', desc: 'Nach dem Aufstehen 8 s +50 % Schaden.' },
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
  addField(c, { pos, radius: r, dur: meteor.burnDur, visual: fieldDecal(burnTex, EMBER, 0.35, 0.05),
    onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) c.hit(m, meteor.burn); },
    onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 40, dt, [FIRE, EMBER], { up: 4, size: 0.4 }),
  });
  hitstop(P.hitstopMs);
  shakeCamera(P.shake);
  cameraKick(0.8);
  lightFlash(pos, 0xff8030, 900, r * 2.5, 700);
  burstFx(pos, r, [FIRE, EMBER], 0xff7a30);
  column(pos);
  wings(pos);
  combatText(pos, 'Phönix!', 'heal', 3);
  return true;
}

// Feuersäule: dichter Strom nach oben
function column(pos) {
  for (let i = 0; i < 220; i++) {
    const a = rand(0, Math.PI * 2), d = rand(0, 1.4);
    particles.spawn({ x: pos.x + Math.cos(a) * d, y: pos.y + rand(0, 2), z: pos.z + Math.sin(a) * d, vx: Math.cos(a) * 0.4, vy: rand(10, 22), vz: Math.sin(a) * 0.4,
      drag: 0.6, life: rand(0.6, 1.3), color: i % 3 ? FIRE : [2.6, 1.8, 0.6], size: rand(0.6, 1.4), grow: 0.6 });
  }
}
// Flügel: zwei Bögen aus Glut quer zur Blickrichtung, die nach außen schlagen
function wings(pos) {
  const side = { x: Math.cos(player.facing), z: -Math.sin(player.facing) };
  for (const s of [-1, 1]) for (let i = 0; i < 90; i++) {
    const t = i / 90, span = 1 + t * 6, h = 2.2 + Math.sin(t * Math.PI) * 2.6 - t * 1.2;
    particles.spawn({ x: pos.x + side.x * s * span, y: pos.y + h, z: pos.z + side.z * s * span,
      vx: side.x * s * rand(2, 5), vy: rand(1, 4), vz: side.z * s * rand(2, 5), drag: 1.2, life: rand(0.8, 1.6), color: t > 0.7 ? [2.6, 1.8, 0.6] : EMBER, size: rand(0.5, 1.1), grow: 0.4 });
  }
}
