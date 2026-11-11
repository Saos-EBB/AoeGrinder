// Theme-Objekte (map-umbau-2 Phase 4), je eins pro Map, auf dem Objekt-System aus Phase 3:
// Kanäle: Schleuse (Hebel) flutet den Platz daneben 10 s → Mobs darin langsam und nass (Blitz +50 %, spells/core.ts WET_BLITZ).
// Hölle: Lava-Rinne mit Hebel → Mobs darin brennen. Kathedrale: Glocke (läuten = alle Mobs in 60 yd greifen an), Kronleuchter (abschießen = fällt,
// Schaden + Brand). Wüste: Sandfalle (Grube zieht Mobs rein). Wald: Bienenstock (abschießen = Schwarm, schadet Mobs). Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from '../state';
import { mobMaxHp } from '../formulas';
import { hpMulOf } from '../mapgen/difficulty';
import { zone, heightAt } from '../world';
import { burnMob, pullMob, enterCombat } from '../mobs';
import { applySlow, schedule } from '../spells/core';
import { burstFx } from '../spells/fx';
import { ringFx, addEffect } from '../fx/spellFx';
import { particles } from '../fx/particles';
import { addTrauma } from '../wucht';
import { combatText } from '../feedback';
import { colored, plain } from '../mapgen/build';
import { registerKind, planObjects, redraw, removeObj, onMapObjects, type Obj } from './objects';
import { dist2d, rand } from '../util';
import { t } from '../i18n';

export const THEME_OBJ = {
  flood: { ms: 10000, r: 10, slow: 0.45, cdMs: 30000, color: 0x3a8ac8 },          // Schleuse
  lava: { ms: 10000, r: 9, dps: 0.12, cdMs: 30000, color: 0xff6a20 },             // Lava-Rinne: × Mob-Leben pro s
  bell: { r: 60, cdMs: 30000 },
  chandelier: { h: 6.5, fallMs: 450, r: 5, dmg: 0.9, burn: { ticks: 3, part: 0.15 } },
  sand: { r: 7, pull: 2.6, coreR: 1.6, dps: 0.05 },                                 // yd/s Zug, Schaden in der Mitte
  bees: { ms: 8000, r: 3, speed: 9, seek: 18, tickMs: 500, part: 0.12 },
};
const lifeOf = () => mobMaxHp(player.level) * hpMulOf(zone.theme);
const mobsNear = (p: { x: number; z: number }, r: number) => state.mobs.filter(m => !m.dead && dist2d(m.pos, p) <= r);
// Wirkfläche der Hebel: der Pack-Platz am nächsten zum Hebel (da kommen Mobs vorbei), sonst der Hebel selbst
const areaOf = (o: Obj) => {
  const s = (zone.packSpots ?? []).reduce((a, b) => !a || dist2d(b, o) < dist2d(a, o) ? b : a, null);
  return s && dist2d(s, o) < 25 ? { x: s.x, z: s.z } : { x: o.x, z: o.z };
};

// ---------- Hebel (Schleuse, Lava-Rinne) ----------
function lever(stick: number, base: number) {
  return () => colored([[new THREE.BoxGeometry(1, 0.5, 0.7).translate(0, 0.25, 0), base], [new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6).rotateZ(0.5).translate(0.3, 0.95, 0), stick], [new THREE.SphereGeometry(0.16, 8, 6).translate(0.62, 1.52, 0), 0xc03020]]);
}
function surface(o: Obj, color: number, r: number, ms: number, k = 0.55) {
  const a = areaOf(o), y = heightAt(a.x, a.z) + 0.12;
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(color === THEME_OBJ.lava.color ? 2.2 : 1), transparent: true, opacity: 0, depthWrite: false }));
  mesh.position.set(a.x, y, a.z);
  addEffect(mesh, ms, f => { mesh.material.opacity = k * Math.min(1, f * 8, (1 - f) * 8); mesh.scale.setScalar(Math.min(1, 0.3 + f * 6)); });
  return a;
}
function leverUse(o: Obj, kind: 'flood' | 'lava') {
  if (state.now < (o.data.readyAt ?? 0)) return;
  const C = THEME_OBJ[kind];
  o.data.readyAt = state.now + C.cdMs;
  o.data.until = state.now + C.ms;
  o.data.area = surface(o, C.color, C.r, C.ms);
  o.tint = new THREE.Color(0.6, 0.6, 0.6); o.ry += Math.PI; redraw(o);
  combatText(player.pos, t(kind === 'flood' ? 'tobj.flood' : 'tobj.lava'), 'info', 2.6);
}
function leverTick(o: Obj, kind: 'flood' | 'lava', dt: number) {
  if (o.data.readyAt && state.now >= o.data.readyAt && o.tint) { o.tint = null; o.ry -= Math.PI; redraw(o); }
  if (!(o.data.until > state.now)) return;
  const C = THEME_OBJ[kind], a = o.data.area;
  for (const m of mobsNear(a, C.r)) {
    if (kind === 'flood') { applySlow(m, THEME_OBJ.flood.slow, 600); m.wetUntil = state.now + 3000; }
    else { m.lavaAcc = (m.lavaAcc ?? 0) + lifeOf() * THEME_OBJ.lava.dps * dt / 1000; if (m.lavaAcc >= 1) { const n = Math.floor(m.lavaAcc); m.lavaAcc -= n; burnMob(m, n); } }
  }
  if (Math.random() < dt / 60) {
    const ang = rand(0, 6.28), rr = rand(0, C.r);
    particles.spawn({ x: a.x + Math.cos(ang) * rr, y: heightAt(a.x, a.z) + 0.2, z: a.z + Math.sin(ang) * rr, vy: rand(1, 3), life: 0.6, color: kind === 'flood' ? [0.6, 1.4, 2.4] : [2.6, 1.0, 0.2], size: 0.35 });
  }
}
registerKind({
  id: 'schleuse', name: 'Schleuse (Hebel)', reserve: 3, radius: 0.9, themes: ['kanaele'], body: lever(0x8a8a8a, 0x3a4a52),
  onUse: o => leverUse(o, 'flood'), useLabel: o => state.now < (o.data.readyAt ?? 0) ? null : t('tobj.useFlood'),
  update: (o, dt) => leverTick(o, 'flood', dt),
});
registerKind({
  id: 'lavahebel', name: 'Lava-Rinne (Hebel)', reserve: 3, radius: 0.9, themes: ['hoelle'], body: lever(0x6a5a50, 0x2a1a14),
  onUse: o => leverUse(o, 'lava'), useLabel: o => state.now < (o.data.readyAt ?? 0) ? null : t('tobj.useLava'),
  update: (o, dt) => leverTick(o, 'lava', dt),
});

// ---------- Glocke ----------
registerKind({
  id: 'glocke', name: 'Glocke', reserve: 3, radius: 1.3, themes: ['kathedrale'],
  body: () => colored([
    [new THREE.BoxGeometry(0.25, 3.4, 0.25).translate(-1.1, 1.7, 0), 0x4a3a2a], [new THREE.BoxGeometry(0.25, 3.4, 0.25).translate(1.1, 1.7, 0), 0x4a3a2a],
    [new THREE.BoxGeometry(2.6, 0.25, 0.3).translate(0, 3.4, 0), 0x4a3a2a],
    [new THREE.CylinderGeometry(0.35, 0.95, 1.4, 14, 1, true).translate(0, 2.4, 0), 0xb08a40], [new THREE.SphereGeometry(0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 3.1, 0), 0xb08a40],
  ]),
  onUse(o) {
    if (state.now < (o.data.readyAt ?? 0)) return;
    o.data.readyAt = state.now + THEME_OBJ.bell.cdMs;
    o.data.swingAt = state.now;
    const pos = new THREE.Vector3(o.x, o.y + 2, o.z);
    for (let i = 0; i < 3; i++) schedule(i * 250, () => ringFx(pos, 12 + i * 10, [2.2, 1.8, 0.8], 900));
    addTrauma(0.3);
    let n = 0;
    for (const m of mobsNear(o, THEME_OBJ.bell.r)) if (m.state === 'idle') { enterCombat(m, false); n++; }
    combatText(player.pos, t('tobj.bell', { n }), 'crit', 3);
  },
  useLabel: o => state.now < (o.data.readyAt ?? 0) ? null : t('tobj.useBell'),
  update(o) { if (o.data.swingAt && state.now - o.data.swingAt < 1500) { o.ry = Math.sin((state.now - o.data.swingAt) / 90) * 0.25 * (1 - (state.now - o.data.swingAt) / 1500); redraw(o); } },
});

// ---------- Kronleuchter: hängt in der Luft, jeder Treffer lässt ihn fallen ----------
registerKind({
  id: 'kronleuchter', name: 'Kronleuchter', reserve: 3, radius: 2, themes: ['kathedrale'],
  body: () => colored([[new THREE.TorusGeometry(1.4, 0.1, 6, 24).rotateX(Math.PI / 2), 0x6a5428], [new THREE.CylinderGeometry(0.05, 0.05, 9, 4).translate(0, 4.5, 0), 0x2a2420],
    ...[0, 1, 2, 3, 4, 5].map(i => [new THREE.CylinderGeometry(0.08, 0.08, 0.35, 6).translate(Math.cos(i * Math.PI / 3) * 1.4, 0.2, Math.sin(i * Math.PI / 3) * 1.4), 0xe8dcc0] as [THREE.BufferGeometry, number])]),
  glow: () => plain([0, 1, 2, 3, 4, 5].map(i => new THREE.SphereGeometry(0.11, 6, 4).translate(Math.cos(i * Math.PI / 3) * 1.4, 0.45, Math.sin(i * Math.PI / 3) * 1.4))),
  init(o) { o.y += THEME_OBJ.chandelier.h; o.data.top = o.y; o.glow = new THREE.Color(2.6, 1.6, 0.6); },
  onHit(o) {
    if (o.data.fallAt) return;
    o.data.fallAt = state.now;
  },
  update(o) {
    if (!o.data.fallAt) return;
    const C = THEME_OBJ.chandelier, k = Math.min(1, (state.now - o.data.fallAt) / C.fallMs), ground = heightAt(o.x, o.z);
    o.y = o.data.top - (o.data.top - ground) * k * k;
    redraw(o);
    if (k < 1) return;
    removeObj(o);
    const pos = new THREE.Vector3(o.x, ground, o.z);
    burstFx(pos, C.r, [[2.6, 1.2, 0.3], [2.0, 0.5, 0.1]], 0xffa040);
    addTrauma(0.35);
    for (const m of mobsNear(o, C.r)) burnMob(m, Math.round(lifeOf() * C.dmg));
    for (let n = 1; n <= C.burn.ticks; n++) schedule(n * 1000, () => { for (const m of mobsNear(o, C.r)) burnMob(m, Math.max(1, Math.round(lifeOf() * C.burn.part))); });
  },
  devTrigger(o) { o.data.fallAt ??= state.now; },
});

// ---------- Sandfalle: Grube, zieht Mobs rein, in der Mitte nagt sie ----------
registerKind({
  id: 'sandfalle', name: 'Sandfalle', reserve: 3, radius: THEME_OBJ.sand.r, themes: ['wueste'],
  body: () => colored([[new THREE.CircleGeometry(THEME_OBJ.sand.r, 32).rotateX(-Math.PI / 2).translate(0, 0.06, 0), 0xb89058], [new THREE.RingGeometry(1.5, 4, 32).rotateX(-Math.PI / 2).translate(0, 0.08, 0), 0x8a6a3a], [new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2).translate(0, 0.1, 0), 0x2a1c0c]]),
  update(o, dt) {
    const S = THEME_OBJ.sand;
    for (const m of mobsNear(o, S.r)) {
      if (m.flies) continue;
      pullMob(m, o, S.pull * dt / 1000);
      if (dist2d(m.pos, o) < S.coreR) { m.sandAcc = (m.sandAcc ?? 0) + lifeOf() * S.dps * dt / 1000; if (m.sandAcc >= 1) { const n = Math.floor(m.sandAcc); m.sandAcc -= n; burnMob(m, n); } }
    }
    if (Math.random() < dt / 80) { const a = rand(0, 6.28), r = rand(1.5, S.r); particles.spawn({ x: o.x + Math.cos(a) * r, y: o.y + 0.2, z: o.z + Math.sin(a) * r, vx: -Math.cos(a) * 1.5, vz: -Math.sin(a) * 1.5, life: 0.8, color: [1.4, 1.1, 0.6], size: 0.3 }); }
  },
});

// ---------- Bienenstock: abschießen = Schwarm jagt Mobs ----------
type Swarm = { x: number; z: number; until: number; next: number };
const swarms: Swarm[] = [];
registerKind({
  id: 'bienenstock', name: 'Bienenstock', reserve: 3, radius: 1, themes: ['wald'],
  body: () => colored([[new THREE.CylinderGeometry(0.12, 0.14, 2.4, 6).translate(0, 1.2, 0), 0x4a3420], [new THREE.SphereGeometry(0.6, 10, 8).scale(1, 1.3, 1).translate(0, 2.9, 0), 0xc8902a],
    [new THREE.TorusGeometry(0.58, 0.07, 6, 16).rotateX(Math.PI / 2).translate(0, 2.7, 0), 0x6a4a18], [new THREE.TorusGeometry(0.5, 0.07, 6, 16).rotateX(Math.PI / 2).translate(0, 3.15, 0), 0x6a4a18]]),
  onHit(o) {
    removeObj(o);
    lastSwarm = state.now;
    swarms.push({ x: o.x, z: o.z, until: state.now + THEME_OBJ.bees.ms, next: 0 });
    combatText(new THREE.Vector3(o.x, o.y + 3, o.z), t('tobj.bees'), 'crit', 3);
  },
});
let lastSwarm = 0;
function updateSwarms() {
  if (lastSwarm === state.now) return;   // einmal pro Frame, egal wie viele Stöcke
  const dt = Math.min(50, state.now - lastSwarm); lastSwarm = state.now;
  const B = THEME_OBJ.bees;
  for (let i = swarms.length - 1; i >= 0; i--) {
    const s = swarms[i];
    if (state.now > s.until) { swarms.splice(i, 1); continue; }
    const target = mobsNear(s, B.seek).sort((a, b) => dist2d(a.pos, s) - dist2d(b.pos, s))[0];
    if (target) { const dx = target.pos.x - s.x, dz = target.pos.z - s.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, B.speed * dt / 1000); s.x += dx / d * st; s.z += dz / d * st; }
    const y = heightAt(s.x, s.z) + 1.2;
    for (let n = 0; n < 3; n++) particles.spawn({ x: s.x + rand(-1.2, 1.2), y: y + rand(-0.5, 0.8), z: s.z + rand(-1.2, 1.2), vx: rand(-2, 2), vy: rand(-1, 1), vz: rand(-2, 2), life: 0.25, color: [2.4, 1.9, 0.3], size: 0.18 });
    if (state.now >= s.next) { s.next = state.now + B.tickMs; for (const m of mobsNear(s, B.r)) burnMob(m, Math.max(1, Math.round(lifeOf() * B.part))); }
  }
}
// Der Stock ist nach dem Treffer weg (objects.ts ruft update nur für lebende Objekte), der Schwarm läuft über objects/index.ts weiter
export function updateThemeObjects() { if (swarms.length) updateSwarms(); }
onMapObjects(() => { swarms.length = 0; });   // neue Map / neuer Run

planObjects({ kind: 'schleuse', n: 1, place: 'nearPacks' });
planObjects({ kind: 'lavahebel', n: 1, place: 'nearPacks' });
planObjects({ kind: 'glocke', n: 1, place: 'free' });
planObjects({ kind: 'kronleuchter', n: 1, place: 'nearPacks' });
planObjects({ kind: 'sandfalle', n: 1, place: 'nearPacks' });
planObjects({ kind: 'bienenstock', n: 1, place: 'free' });
(window as any).__themeObj = { THEME_OBJ, swarms };
