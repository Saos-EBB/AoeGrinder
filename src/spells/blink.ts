import { rand } from '../util';
import { state, player } from '../state';
import { groundAt, resolve, walkTopAt } from '../collision';
import { CFG } from '../config';
import { blinkFx, novaFx, iceTex } from '../fx/spellFx';
import { applyRoot } from '../mobs';
import { mobsInRadius, applySlow, addField, hasRune, stat } from './core';
import { fieldDecal, areaParticles, ICE, ICE_WHITE } from './fx';

const COLD = { radius: 6, dur: 6000, slow: 0.3, min: 30, max: 36 };   // PH: Kalter Boden
const NOVA = { radius: 8, min: 19, max: 21, root: 6000 };              // PH

const BODY_RADIUS = 0.45, SWEEP_STEP = 0.25, SWEEP_MARGIN = 0.05;   // PH: Rand, damit Laufen an einer Wand entlang nicht sofort als Treffer zählt

// Läuft die Strecke ab und bleibt vor dem ersten Hindernis stehen. Über Stufen und Rampen geht es mit nach oben, die Höhe sinkt erst beim Landen.
// Liegt das Ziel auf einer begehbaren Fläche, zählt deren Seite nicht als Wand: Die Figur landet oben. Massive Objekte stoppen immer.
export function blinkTo(endX, endZ) {
  const start = player.pos, limit = Math.min(1, CFG.playRadius / (Math.hypot(endX, endZ) || 1));
  endX *= limit; endZ *= limit;
  const len = Math.hypot(endX - start.x, endZ - start.z), steps = Math.max(1, Math.ceil(len / SWEEP_STEP));
  const walkTop = walkTopAt(endX, endZ);
  const at = { x: start.x, y: start.y, z: start.z }, probe = { x: 0, y: 0, z: 0 };
  for (let i = 1; i <= steps; i++) {
    probe.x = start.x + (endX - start.x) * i / steps;
    probe.z = start.z + (endZ - start.z) * i / steps;
    probe.y = Math.max(at.y, groundAt(probe.x, probe.z, at.y));
    const hit = resolve(probe, BODY_RADIUS - SWEEP_MARGIN);
    if (hit) {
      if (hit.kind !== 'walk' || walkTop === null || walkTop <= at.y) break;
      at.y = walkTop;                       // über die Seite der Plattform, dieser Schritt wird in der Höhe wiederholt
      i--;
      continue;
    }
    at.x = probe.x; at.y = probe.y; at.z = probe.z;
  }
  player.pos.set(at.x, at.y, at.z);
  // Zweimal: Nach der Landung liegt die Figur tiefer, dort können Objekte stören, über die sie eben noch hinweg war
  for (let i = 0; i < 2; i++) {
    resolve(player.pos, BODY_RADIUS);
    player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y);
  }
}

function coldGround(c, pos) {
  const radius = c.radius(COLD.radius);
  for (const m of mobsInRadius(pos, radius)) c.hit(m, rand(COLD.min, COLD.max));
  addField(c, { pos, radius, dur: COLD.dur, visual: fieldDecal(iceTex, ICE, 0.45), tickMs: 500,
    onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) applySlow(m, COLD.slow, 700); },
    onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 14, dt, [ICE, ICE_WHITE], { up: 1.5, size: 0.25 }),
  });
}

export const blink = {
  name: 'Blink', desc: '20 yd vorwärts, löst Betäubung. Kein Schaden.', ranks: ['range', 'cd'], tags: ['Arkan', 'Bewegung'], cls: 'arcane',
  mana: 80, cd: 15000, dist: 20,   // Mana PH
  runes: [
    { id: 'target', name: 'Eisportal', desc: 'Teleport zum Bodenziel, Frostschaden + Kalter Boden an Start und Ziel.', ground: true, range: 30, radius: 6 },
    { id: 'nova', name: 'Frostabschied', desc: 'Nova am Start.' },
    { id: 'charges', name: 'Doppelsprung', desc: '2 Ladungen.', charges: 2 },
  ],
  effect(c, point) {
    const from = player.pos.clone();
    player.lastBlink = state.now;
    const dist = blink.dist + (stat('blink').range ?? 0);   // Rang-Karten Reichweite
    const end = point ?? { x: from.x + Math.sin(player.facing) * dist, z: from.z + Math.cos(player.facing) * dist };
    blinkTo(end.x, end.z);
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
