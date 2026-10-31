import { rand } from '../util';
import { state, player } from '../state';
import { heightAt, collide } from '../world';
import { blinkFx, novaFx } from '../fx/spellFx';
import { applyRoot } from '../mobs';
import { mobsInRadius, applySlow, addField, hasRune } from './core';
import { fieldDecal, areaParticles, ICE, ICE_WHITE } from './fx';

const COLD = { radius: 6, dur: 6000, slow: 0.3, min: 30, max: 36 };   // PH: Kalter Boden
const NOVA = { radius: 8, min: 19, max: 21, root: 6000 };              // PH

function coldGround(c, pos) {
  const radius = c.radius(COLD.radius);
  for (const m of mobsInRadius(pos, radius)) c.hit(m, rand(COLD.min, COLD.max));
  addField(c, { pos, radius, dur: COLD.dur, visual: fieldDecal(ICE, 0.25), tickMs: 500,
    onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) applySlow(m, COLD.slow, 700); },
    onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 14, dt, [ICE, ICE_WHITE], { up: 1.5, size: 0.25 }),
  });
}

export const blink = {
  name: 'Blink', desc: '20 yd vorwärts, löst Betäubung.', ranks: ['mana'], tags: ['Arkan', 'Bewegung'], cls: 'arcane',
  mana: 80, cd: 15000, dist: 20,   // Mana PH
  runes: [
    { id: 'target', name: 'Eisportal', desc: 'Teleport zum Bodenziel, Frostschaden + Kalter Boden an Start und Ziel.', ground: true, range: 30, radius: 6 },
    { id: 'nova', name: 'Frostabschied', desc: 'Nova am Start.' },
    { id: 'charges', name: 'Doppelsprung', desc: '2 Ladungen.', charges: 2 },
  ],
  effect(c, point) {
    const from = player.pos.clone();
    player.lastBlink = state.now;
    if (point) {
      player.pos.x = point.x;
      player.pos.z = point.z;
    } else {
      player.pos.x += Math.sin(player.facing) * blink.dist;
      player.pos.z += Math.cos(player.facing) * blink.dist;
    }
    collide(player.pos, 0.45);
    player.pos.y = heightAt(player.pos.x, player.pos.z);
    player.grounded = true;
    player.vel.set(0, 0, 0);
    blinkFx(from, player.pos);
    if (hasRune('blink', 'target')) { coldGround(c, from); coldGround(c, player.pos.clone()); }
    if (hasRune('blink', 'nova')) {
      const r = c.radius(NOVA.radius);
      for (const m of mobsInRadius(from, r)) if (c.hit(m, rand(NOVA.min, NOVA.max)) && !m.dead) applyRoot(m, NOVA.root);
      novaFx(from, r);
    }
  },
};
