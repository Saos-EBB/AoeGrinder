// Layout „Räume“ (Hölle): 8–12 Räume (3 × 3 bis 6 × 6 Zellen), verbunden per Minimal-Spannbaum + 2 Extra-Kanten (Schleifen), Gänge 2 Zellen.
// In ~30 % der Räume Lava-Ränder (Schaden wie BRD über genZone.hazard), nie im Spawn-Raum. Portal und Höllentor im entferntesten Raum. Alle Zahlen // PH

import { Grid, CELL, FINE, LAVA, spaced, type Layout } from '../grid';
import type { Rng } from '../rng';
import type { Deco, PackSpot, Spot } from '../types';

const RM = { rooms: [8, 12], size: [3, 6], gap: 2, extra: 2, lavaShare: 0.3, minRooms: 6 };

type Room = { i0: number; j0: number; i1: number; j1: number; cx: number; cz: number; lava?: boolean };

export function raeume(rng: Rng): Layout {
  const g = new Grid(), n = g.n, rooms: Room[] = [];
  const want = rng.int(RM.rooms[0], RM.rooms[1]);
  for (let tries = 0; rooms.length < want && tries < 800; tries++) {
    const w = rng.int(RM.size[0], RM.size[1]), h = rng.int(RM.size[0], RM.size[1]), i0 = rng.int(1, n - 1 - w), j0 = rng.int(1, n - 1 - h);
    const r = { i0, j0, i1: i0 + w - 1, j1: j0 + h - 1, cx: 0, cz: 0 };
    if (rooms.some(o => r.i0 <= o.i1 + RM.gap && r.i1 >= o.i0 - RM.gap && r.j0 <= o.j1 + RM.gap && r.j1 >= o.j0 - RM.gap)) continue;
    r.cx = g.x0 + (r.i0 + r.i1 + 1) / 2 * CELL; r.cz = g.z0 + (r.j0 + r.j1 + 1) / 2 * CELL;
    rooms.push(r);
  }
  for (const r of rooms) g.rect(r.i0, r.j0, r.i1, r.j1);
  const dist = (a: Room, b: Room) => Math.hypot(a.cx - b.cx, a.cz - b.cz);

  // Minimal-Spannbaum (Prim) + Extra-Kanten
  const edges: [number, number][] = [], inTree = [0];
  while (inTree.length < rooms.length) {
    let best: [number, number] = null, bd = 1e9;
    for (const a of inTree) for (let b = 0; b < rooms.length; b++) if (!inTree.includes(b) && dist(rooms[a], rooms[b]) < bd) { bd = dist(rooms[a], rooms[b]); best = [a, b]; }
    edges.push(best); inTree.push(best[1]);
  }
  const rest: [number, number][] = [];
  for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) if (!edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) rest.push([a, b]);
  rest.sort((p, q) => dist(rooms[p[0]], rooms[p[1]]) - dist(rooms[q[0]], rooms[q[1]]));
  edges.push(...rest.slice(0, RM.extra));

  // Gänge: L-Form, 2 Zellen breit, Knick zufällig zuerst waagrecht oder senkrecht
  const mid = (r: Room) => [Math.floor((r.i0 + r.i1) / 2), Math.floor((r.j0 + r.j1) / 2)];
  for (const [a, b] of edges) {
    const [ai, aj] = mid(rooms[a]), [bi, bj] = mid(rooms[b]);
    if (rng.chance(0.5)) { g.rect(ai, aj, bi, aj + 1); g.rect(bi, aj, bi + 1, bj); }
    else { g.rect(ai, aj, ai + 1, bj); g.rect(ai, bj, bi, bj + 1); }
  }

  // Spawn: Raum am nächsten an einer Ecke; Ziel: Raum mit den meisten Schritten
  const corner = rng.int(0, 3), cxs = corner & 1 ? 1 : -1, czs = corner & 2 ? 1 : -1;
  const start = rooms.reduce((best, r) => (r.cx * cxs + r.cz * czs > best.cx * cxs + best.cz * czs ? r : best), rooms[0]);
  const spawn = { x: start.cx, z: start.cz };
  const steps = g.steps(g.ci(spawn.x), g.cj(spawn.z));
  const stepsTo = (r: Room) => steps[g.cj(r.cz) * n + g.ci(r.cx)];
  const goal = rooms.filter(r => r !== start).reduce((best, r) => stepsTo(r) > stepsTo(best) ? r : best, rooms.find(r => r !== start) ?? start);

  // Lava-Ränder: ein Streifen (2 yd) an jeder Raumkante, hinter der Wand liegt; Durchgänge bleiben frei
  const s = CELL / FINE;
  for (const r of rooms) {
    if (r === start || r === goal || !rng.chance(RM.lavaShare)) continue;
    r.lava = true;
    for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) {
      const x0 = g.x0 + i * CELL, z0 = g.z0 + j * CELL;
      if (!g.walk(i - 1, j)) g.fineRect(x0, z0, x0 + s, z0 + CELL, LAVA);
      if (!g.walk(i + 1, j)) g.fineRect(x0 + CELL - s, z0, x0 + CELL, z0 + CELL, LAVA);
      if (!g.walk(i, j - 1)) g.fineRect(x0, z0, x0 + CELL, z0 + s, LAVA);
      if (!g.walk(i, j + 1)) g.fineRect(x0, z0 + CELL - s, x0 + CELL, z0 + CELL, LAVA);
    }
  }

  // Deko: Stacheln und Knochen an den Wänden, Glutschalen in Raum-Ecken, Säulen in großen Räumen
  const deco: Deco[] = [], lights: Spot[] = [];
  for (const r of rooms) {
    const w = (r.i1 - r.i0 + 1) * CELL, h = (r.j1 - r.j0 + 1) * CELL, x0 = g.x0 + r.i0 * CELL, z0 = g.z0 + r.j0 * CELL, in_ = r.lava ? 5 : 3.5;
    for (const [fx, fz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = x0 + (fx ? w - in_ : in_), z = z0 + (fz ? h - in_ : in_);
      if (g.walkAt(x, z) && rng.chance(0.7)) { deco.push({ kind: 'brazier', x, z }); lights.push({ x, z }); }
    }
    if (w >= 40 && h >= 40) for (const [fx, fz] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) deco.push({ kind: 'pillar', x: x0 + w * fx, z: z0 + h * fz });
    for (let k = rng.int(1, 3); k > 0; k--) {
      const x = x0 + rng.range(in_ + 1, w - in_ - 1), z = z0 + (rng.chance(0.5) ? in_ + 0.5 : h - in_ - 0.5);
      if (g.walkAt(x, z) && Math.hypot(x - spawn.x, z - spawn.z) > 10) deco.push({ kind: rng.chance(0.5) ? 'spikes' : 'bones', x, z, ry: rng.range(0, 6.28) });
    }
  }

  // Höllentor hinten im Zielraum (weg vom Spawn), Portal davor
  const back = Math.atan2(goal.cz - spawn.z, goal.cx - spawn.x), gw = (goal.i1 - goal.i0 + 1) * CELL, gh = (goal.j1 - goal.j0 + 1) * CELL;
  const reach = Math.min(gw, gh) / 2 - 7;
  const landmark = { x: goal.cx + Math.cos(back) * reach, z: goal.cz + Math.sin(back) * reach, ry: Math.atan2(-Math.cos(back), -Math.sin(back)) };
  const portalSpots: Spot[] = [{ x: goal.cx - Math.cos(back) * 3, z: goal.cz - Math.sin(back) * 3 }];
  const far = rooms.filter(r => r !== goal && r !== start).sort((a, b) => stepsTo(b) - stepsTo(a));
  portalSpots.push(...far.slice(0, 2).map(r => ({ x: r.cx, z: r.cz })));

  // Pack-Plätze: Raum-Mitten, große Räume zwei
  const spots: PackSpot[] = [];
  for (const r of rooms) {
    if (r === start) continue;
    const w = r.i1 - r.i0 + 1, h = r.j1 - r.j0 + 1, rad = Math.min(9, Math.min(w, h) * CELL / 2 - (r.lava ? 6 : 4));
    if (w >= 5 && w >= h) spots.push({ x: r.cx - w * CELL / 4, z: r.cz, r: rad / 1.5 }, { x: r.cx + w * CELL / 4, z: r.cz, r: rad / 1.5 });
    else if (h >= 5) spots.push({ x: r.cx, z: r.cz - h * CELL / 4, r: rad / 1.5 }, { x: r.cx, z: r.cz + h * CELL / 4, r: rad / 1.5 });
    else spots.push({ x: r.cx, z: r.cz, r: rad });
  }
  const packSpots = spaced(spots.filter(p => Math.hypot(p.x - landmark.x, p.z - landmark.z) > 10), 16);

  return {
    grid: g, spawn, packSpots, objectSpots: far.slice(-3).map(r => ({ x: r.cx + 4, z: r.cz })), portalSpots, landmark, bounds: g.bounds(), deco, lights,
  };
}
