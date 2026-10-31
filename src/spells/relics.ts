// Relikte: Boss-Spells, max. 1 pro Run, ab Level 30. Alle Werte außer CD und Spec-Radien sind PH.

import * as THREE from 'three';
import { rand, dist2d } from '../util';
import { state, player } from '../state';
import { scene } from '../render';
import { heightAt, obstacles } from '../world';
import { particles } from '../fx/particles';
import { ringFx } from '../fx/spellFx';
import { shakeCamera } from '../camera';
import { applyRoot, knockbackMob } from '../mobs';
import { mobsInRadius, addField, schedule } from './core';
import { runChain, nearestMob } from './chain';
import { fieldDecal, areaParticles, burstFx, FIRE, EMBER, SHADOW, VOID, ICE, ICE_WHITE, BONE } from './fx';

export const ragnaros = {
  name: 'Zorn des Ragnaros', relic: true, desc: 'Feuerschlag 15 yd, alle fliegen weg.', ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Nova'], cls: 'fire',
  mana: 200, cd: 25000, dmg: 150, radius: 15, knock: 15,
  effect(c) {
    const r = c.radius(ragnaros.radius);
    for (const m of mobsInRadius(player.pos, r)) if (c.hit(m, ragnaros.dmg)) knockbackMob(m, player.pos, ragnaros.knock, 800);
    burstFx(player.pos, r, [FIRE, EMBER], 0xffa040);
    shakeCamera(0.4);
  },
};

export const desecrate = {
  name: 'Entweihen', relic: true, desc: 'Schattenfläche aufs Bodenziel 10 s, wächst mit jedem Tick, der trifft.', ranks: ['dmg', 'mana', 'radius'], tags: ['Schatten', 'Fläche'], cls: 'shadow',
  mana: 250, cd: 40000, dur: 10000, tickDmg: 20, range: 30, radius: 6, grow: 0.6, ground: true,
  effect(c, point) {
    addField(c, { pos: point, radius: c.radius(desecrate.radius), dur: desecrate.dur, visual: fieldDecal(SHADOW, 0.3),
      onTick(f) {
        const hits = mobsInRadius(f.pos, f.radius).filter(m => c.hit(m, desecrate.tickDmg));
        if (hits.length) f.radius += desecrate.grow;
      },
      onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 50, dt, [SHADOW, VOID], { up: 2.5, size: 0.4 }),
    });
  },
};

// Sichtlinie: Strecke darf kein Hindernis schneiden
function lineOfSight(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
  return obstacles.every(o => {
    const t = Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / len2));
    return Math.hypot(a.x + dx * t - o.x, a.z + dz * t - o.z) > o.r;
  });
}

export const frostbreath = {
  name: 'Frostatem', relic: true, desc: 'Nach 3 s Einschlag, trifft alle in 30 yd mit Sichtlinie, Eingefrorene ×2.', ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Fläche'], cls: 'frost',
  mana: 300, cd: 60000, dmg: 200, delay: 3000, radius: 30,
  effect(c) {
    const r = c.radius(frostbreath.radius);
    ringFx(player.pos, r, ICE_WHITE, frostbreath.delay);
    schedule(frostbreath.delay, () => {
      for (const m of mobsInRadius(player.pos, r)) {
        if (lineOfSight(player.pos, m.pos)) c.hit(m, frostbreath.dmg * (m.rootUntil > state.now ? 2 : 1));
      }
      burstFx(player.pos, r, [ICE, ICE_WHITE], 0xc8ecff);
      shakeCamera(0.5);
    });
  },
};

export const froststrike = {
  name: 'Frostschlag', relic: true, desc: 'Friert Ziel 4 s ein, springt als Kette auf jeden in 10 yd.', ranks: ['dmg', 'mana'], tags: ['Frost', 'Kette'], cls: 'frost',
  mana: 200, cd: 45000, dmg: 60, root: 4000, jumpRange: 10, range: 30,
  canCast: () => nearestMob(froststrike.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const first = nearestMob(froststrike.range);
    if (!first) return;
    runChain(c, first, { jumps: Infinity, range: froststrike.jumpRange, dmg: froststrike.dmg, onHit: m => { if (!m.dead) applyRoot(m, froststrike.root); } });
  },
};

export const firenova = {
  name: 'Feuernova', relic: true, desc: 'Feuerring breitet sich auf 40 yd aus.', ranks: ['dmg', 'mana', 'radius'], tags: ['Feuer', 'Nova'], cls: 'fire',
  mana: 280, cd: 30000, dmg: 120, radius: 40, speed: 20,
  effect(c) {
    const maxR = c.radius(firenova.radius), done = new Set();
    addField(c, { pos: player.pos, radius: 0, dur: maxR / firenova.speed * 1000,
      onUpdate(f, dt) {
        f.radius = Math.min(maxR, f.radius + firenova.speed * dt / 1000);
        for (const m of mobsInRadius(f.pos, f.radius)) if (!done.has(m)) { done.add(m); c.hit(m, firenova.dmg); }
        for (let i = 0; i < 40; i++) {
          const a = rand(0, Math.PI * 2), x = f.pos.x + Math.cos(a) * f.radius, z = f.pos.z + Math.sin(a) * f.radius;
          particles.spawn({ x, y: heightAt(x, z) + 0.3, z, vy: rand(1, 4), life: rand(0.3, 0.6), color: i % 2 ? FIRE : EMBER, size: rand(0.3, 0.6) });
        }
      },
    });
  },
};

const boneGeo = new THREE.ConeGeometry(0.35, 3.2, 5);
function boneRing(pos, radius) {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...BONE) }), n = Math.ceil(radius * 3);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = pos.x + Math.cos(a) * radius, z = pos.z + Math.sin(a) * radius;
    const bone = new THREE.Mesh(boneGeo, mat);
    bone.position.set(x, heightAt(x, z) + 1.2, z);
    bone.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);   // nach innen gebogen
    g.add(bone);
  }
  scene.add(g);
  return { update() {}, remove() { scene.remove(g); mat.dispose(); } };
}

export const bonecage = {
  name: 'Knochengefängnis', relic: true, desc: 'Knochenring um ein Pack, 6 s gefangen, Kettenblitz + Leerenkugel +50 % darin.', ranks: ['mana', 'radius'], tags: ['Knochen', 'Fläche'], cls: 'bone',
  mana: 150, cd: 35000, dur: 6000, range: 30, radius: 8, ground: true,
  effect(c, point) {
    const radius = c.radius(bonecage.radius), caught = mobsInRadius(point, radius);
    const f = addField(c, { pos: point, radius, dur: bonecage.dur, visual: boneRing(point, radius),
      onUpdate(field) {
        for (const m of caught) {
          const d = dist2d(m.pos, field.pos);
          if (m.dead || d <= radius - 0.5) continue;
          m.pos.x = field.pos.x + (m.pos.x - field.pos.x) / d * (radius - 0.5);
          m.pos.z = field.pos.z + (m.pos.z - field.pos.z) / d * (radius - 0.5);
        }
      },
    });
    for (const m of caught) m.cagedUntil = f.end;
  },
};
