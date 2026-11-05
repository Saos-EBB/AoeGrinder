// Neue Arkan-Spells (v31): Arkanbeschuss, Arkanstrahl, Arkane Kugel, Arkanschlag. Ladungen in schoolMeter.ts.

import * as THREE from 'three';
import { state, player } from '../state';
import { UNIT } from '../config';
import { applyRoot } from '../mobs';
import { mobsOnLine, forward } from '../melee';
import { mouse, pickGround } from '../input';
import { takeArcCharges, addArcCharge } from '../schoolMeter';
import { mobsInRadius, addField, bounceShot } from './core';
import { nearestTarget } from './target';
import { barrageLook, beamLook, beamBoom, arcOrbField } from '../vfx/arcaneLook';
import { coneLook } from '../vfx/frostLook';
import { PAL } from '../vfx/energy';

// Alle Werte PH, Schaden in Einheiten (UNIT)
const BARRAGE = { dmg: 2, perCharge: 0.5, range: 30 };
const BEAM = { len: 25, width: 2, dmg: 1.5, boom: { radius: 15, dmg: 6, marked: 1.8 }, hitOrb: 3 };
const ORB = { len: 20, speed: 10, width: 4, dmg: 1.5 };
const STRIKE = { range: 6, angle: Math.PI / 2, dmg: 1.2, stunMs: 500 };   // Kegel-Winkel nicht vorgegeben

export const barrage = {
  name: 'Arkanbeschuss', desc: 'Geschoss aufs nächste Ziel, 2 Einheiten, +50 % pro verbrauchter Ladung. Verbraucht alle Ladungen.', ranks: ['dmg', 'mana'], tags: ['Arkan', 'Geschoss'], cls: 'arcane',
  mana: 80, cd: 3000, range: BARRAGE.range, showDmg: BARRAGE.dmg * UNIT,
  canCast: () => nearestTarget(BARRAGE.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const t0 = nearestTarget(BARRAGE.range);
    if (!t0) return;
    const n = takeArcCharges();
    const t = bounceShot(t0);   // Kristallhöhlen
    if (!t) return;                    // vor dem Treffer, sonst zählt der allgemeine Ladungs-Bonus mit
    barrageLook(t.pos, n);
    c.hitProjectile(t, BARRAGE.dmg * UNIT * (1 + BARRAGE.perCharge * n));
  },
};

// Richtung zur Maus am Boden, am Pad die Blickrichtung
function aimDir() {
  if (state.lastInput !== 'pad') {
    pickGround();
    const dx = mouse.ground.x - player.pos.x, dz = mouse.ground.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.5) return { x: dx / d, z: dz / d };
  }
  return forward();
}

export const beam = {
  name: 'Arkanstrahl', desc: 'Linie 25 × 2 yd in Mausrichtung, 1,5 Einheiten. Trifft er eine Leerenkugel: Explosion 15 yd, 6 Einheiten, Markierte ×1,8.', ranks: ['dmg', 'mana'], tags: ['Arkan', 'Linie'], cls: 'arcane',
  mana: 150, cd: 8000, showDmg: BEAM.dmg * UNIT,
  effect(c) {
    const f = aimDir(), from = player.pos, to = { x: from.x + f.x * BEAM.len, y: from.y, z: from.z + f.z * BEAM.len };
    for (const m of mobsOnLine(from, to, BEAM.width)) c.hit(m, BEAM.dmg * UNIT);
    beamLook(from, to as any);
    // Leerenkugel auf der Linie: explodiert
    const lx = to.x - from.x, lz = to.z - from.z, len2 = lx * lx + lz * lz;
    for (const orb of state.fields.filter(o => o.void)) {
      const t = Math.max(0, Math.min(1, ((orb.pos.x - from.x) * lx + (orb.pos.z - from.z) * lz) / len2));
      if (Math.hypot(orb.pos.x - from.x - lx * t, orb.pos.z - from.z - lz * t) > BEAM.hitOrb) continue;
      const r = c.radius(BEAM.boom.radius);
      for (const m of mobsInRadius(orb.pos, r)) c.hit(m, BEAM.boom.dmg * UNIT * (m.markUntil > state.now ? BEAM.boom.marked : 1));
      beamBoom(orb.pos, r);
    }
  },
};

export const arcorb = {
  name: 'Arkane Kugel', desc: 'Rollt 20 yd, 4 yd breit, 1,5 Einheiten auf alles auf dem Weg. Gibt höchstens 1 Ladung.', ranks: ['dmg', 'mana'], tags: ['Arkan', 'Geschoss', 'Fläche'], cls: 'arcane',
  mana: 110, cd: 6000, showDmg: ORB.dmg * UNIT,
  effect(c) {
    const dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)), seen = new Set();
    let charged = false;
    addField(c, { pos: player.pos, radius: ORB.width / 2, dur: ORB.len / ORB.speed * 1000, tickMs: 1e9, visual: arcOrbField(),
      onUpdate(f, dt) {
        f.pos.addScaledVector(dir, ORB.speed * dt / 1000);
        for (const m of mobsInRadius(f.pos, f.radius)) {
          if (seen.has(m)) continue;
          seen.add(m);
          if (c.hit(m, ORB.dmg * UNIT) && !charged) { charged = true; addArcCharge(); }
        }
      },
    });
  },
};

export const arcstrike = {
  name: 'Arkanschlag', desc: 'Kegel 6 yd, 1,2 Einheiten, betäubt 0,5 s.', ranks: ['dmg', 'mana', 'radius'], tags: ['Arkan', 'Fläche', 'Kontrolle'], cls: 'arcane',
  mana: 50, cd: 4000, showDmg: STRIKE.dmg * UNIT,
  effect(c) {
    const r = c.radius(STRIKE.range);
    for (const m of mobsInRadius(player.pos, r)) {
      const a = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z) - player.facing;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > STRIKE.angle / 2) continue;
      if (c.hit(m, STRIKE.dmg * UNIT) && !m.dead) applyRoot(m, STRIKE.stunMs);
    }
    coneLook(r, STRIKE.angle, PAL.arcane, .5);
  },
};
