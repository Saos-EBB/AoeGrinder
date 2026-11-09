// Layout „Hallen“ (Kathedrale): Langschiff 4 Zellen breit mit Säulenreihen, 2 Seitenschiffe, Querschiff, Apsis am Ende (Landmarke + Portal).
// Zufall: Länge, 2–6 Seitenkapellen, eingestürzte Stellen (Löcher in Wänden mit Schutt, Löcher im Boden), spiegelsymmetrisch ja/nein.
// Bänke und Kerzen wie in kathedrale.ts; Kerzen sind die Lichtinseln. Eingang unten (+z), Apsis oben (−z). Alle Zahlen // PH

import { Grid, CELL, FLOOR, WALL, HOLE, spaced, type Layout } from '../grid';
import type { Rng } from '../rng';
import type { Deco, PackSpot, Spot } from '../types';

const H = { nave: 4, aisle: 2, length: [14, 18], arm: [2, 4], chapels: [2, 6], apse: 3.6, collapse: [1, 3], holes: [0, 2], benchStep: 6 };

export function hallen(rng: Rng): Layout {
  const g = new Grid(), n = g.n, sym = rng.chance(0.5);
  const c0 = n / 2 - H.nave / 2, a0 = c0 - H.aisle, a1 = c0 + H.nave + H.aisle - 1;   // Langschiff c0 … c0+3, Seitenschiffe a0 … a1
  const top = rng.int(5, 6), len = rng.int(H.length[0], Math.min(H.length[1], n - 2 - top)), bottom = top + len - 1;
  g.rect(a0, top, a1, bottom);

  // Querschiff: 3 Zellen tief, im oberen Drittel, Arme 2–4 Zellen über die Seitenschiffe hinaus
  const tj = top + rng.int(2, Math.max(2, Math.floor(len / 3))), armL = rng.int(H.arm[0], H.arm[1]), armR = sym ? armL : rng.int(H.arm[0], H.arm[1]);
  g.rect(a0 - armL, tj, a1 + armR, tj + 2);

  // Apsis: Halbkreis über dem oberen Ende des Langschiffs
  const ax = 0, az = g.z0 + top * CELL, R = H.apse * CELL;
  for (let j = 1; j < top; j++) for (let i = a0; i <= a1; i++) if (Math.hypot(g.cx(i) - ax, g.cz(j) - az) < R) g.carve(i, j);

  // Seitenkapellen: 2 × 2 Zellen außen an den Seitenschiffen, nicht am Querschiff
  const rows: number[] = [];
  for (let j = top + 1; j <= bottom - 3; j++) if (j + 1 < tj - 1 || j > tj + 3) rows.push(j);
  const want = rng.int(H.chapels[0], H.chapels[1]), chapels: { i: number; j: number }[] = [];
  const free = (j: number) => !chapels.some(c => Math.abs(c.j - j) < 3);
  for (let tries = 0; chapels.length < want && tries < 60; tries++) {
    const j = rng.pick(rows);
    if (!free(j)) continue;
    const left = rng.chance(0.5);
    if (sym) { chapels.push({ i: a0 - 2, j }, { i: a1 + 1, j }); }
    else chapels.push({ i: left ? a0 - 2 : a1 + 1, j });
  }
  for (const c of chapels) g.rect(c.i, c.j, c.i + 1, c.j + 1);

  // Eingestürzt: Wandzellen zwischen zwei Räumen öffnen (Schutt), dazu Löcher im Boden der Querschiff-Arme
  const deco: Deco[] = [], lights: Spot[] = [];
  const holes = (i: number, j: number) => (g.walk(i - 1, j) && g.walk(i + 1, j)) || (g.walk(i, j - 1) && g.walk(i, j + 1));
  const cands: [number, number][] = [];
  for (let j = 2; j < n - 2; j++) for (let i = 2; i < n - 2; i++) if (g.get(i, j) === WALL && holes(i, j)) cands.push([i, j]);
  const mirror = (i: number) => n - 1 - i;
  for (let k = rng.int(H.collapse[0], H.collapse[1]); k > 0 && cands.length; k--) {
    const [i, j] = cands.splice(rng.int(0, cands.length - 1), 1)[0];
    for (const ii of sym ? [i, mirror(i)] : [i]) {
      if (g.get(ii, j) !== WALL) continue;
      g.carve(ii, j, FLOOR);
      deco.push({ kind: 'rubble', x: g.cx(ii) + rng.range(-2, 2), z: g.cz(j) + rng.range(-2, 2), ry: rng.range(0, 6.28) });
    }
  }
  for (let k = rng.int(H.holes[0], H.holes[1]); k > 0; k--) {
    const i = a0 - armL + rng.int(0, Math.max(0, armL - 1)), j = tj + 1;
    for (const ii of sym ? [i, mirror(i)] : [i]) if (g.walk(ii, j)) g.set(ii, j, HOLE);
  }

  // Säulenreihen zwischen Langschiff und Seitenschiffen, auf den Zellgrenzen (Lücke am Querschiff)
  const xl = g.x0 + c0 * CELL, xr = g.x0 + (c0 + H.nave) * CELL;
  for (let j = top; j <= bottom + 1; j++) {
    if (j >= tj && j <= tj + 3) continue;
    const z = g.z0 + j * CELL;
    for (const x of [xl, xr]) {
      deco.push({ kind: 'pillar', x, z });
      if (rng.chance(0.4)) { deco.push({ kind: 'candles', x: x + (x < 0 ? 1.4 : -1.4), z: z + 1, ry: rng.range(0, 6.28) }); lights.push({ x: x + (x < 0 ? 1.4 : -1.4), z: z + 1 }); }
    }
  }

  // Bänke: Reihen im Langschiff unterhalb des Querschiffs, Mittelgang frei, nahe dem Eingang frei
  const spawn = { x: 0, z: g.z0 + (bottom - 0.5) * CELL };
  for (let z = g.z0 + (tj + 3) * CELL + 5; z < spawn.z - 14; z += H.benchStep) {
    for (const x of [-11.5, -6.5, 6.5, 11.5]) if (rng.chance(0.85)) deco.push({ kind: 'bench', x, z, ry: rng.range(-0.05, 0.05) });
  }

  // Kapellen: Altarkerzen hinten
  for (const c of chapels) {
    const left = c.i < c0, x = g.x0 + (left ? c.i + 0.4 : c.i + 1.6) * CELL, z = g.z0 + (c.j + 1) * CELL;
    deco.push({ kind: 'candles', x, z, ry: rng.range(0, 6.28) });
    lights.push({ x, z });
  }
  // Apsis: Kerzenhalbkreis
  for (let k = 0; k < 7; k++) {
    const a = Math.PI + (k + 0.5) / 7 * Math.PI, x = ax + Math.cos(a) * (R - 6), z = az + Math.sin(a) * (R - 6);
    if (g.walkAt(x, z)) { deco.push({ kind: 'candles', x, z, ry: a }); lights.push({ x, z }); }
  }

  // Glockenturm hinter der Apsis, Rosenfenster zum Langschiff
  const landmark = { x: ax, z: az - R - 4, ry: 0 };
  const portalSpots: Spot[] = [{ x: ax, z: az - R * 0.4 }, { x: g.x0 + (a0 - armL + 1) * CELL, z: g.z0 + (tj + 1.5) * CELL }, { x: g.x0 + (a1 + armR) * CELL, z: g.z0 + (tj + 1.5) * CELL }];

  // Pack-Plätze: Langschiff in Abschnitten, Seitenschiffe, Querschiff-Arme, Apsis, Kapellen
  const spots: PackSpot[] = [{ x: ax, z: az - R * 0.45, r: 8 }];
  for (let j = bottom - 3; j >= top; j -= 3) {
    const z = g.z0 + (j + 0.5) * CELL;
    spots.push({ x: 0, z, r: 7 }, { x: g.x0 + (a0 + 1) * CELL, z, r: 4 }, { x: g.x0 + (a1) * CELL, z, r: 4 });
  }
  spots.push({ x: g.x0 + (a0 - armL + 1) * CELL, z: g.z0 + (tj + 1.5) * CELL, r: 7 }, { x: g.x0 + (a1 + armR) * CELL, z: g.z0 + (tj + 1.5) * CELL, r: 7 });
  for (const c of chapels) spots.push({ x: g.x0 + (c.i + 1) * CELL, z: g.z0 + (c.j + 1) * CELL, r: 4 });
  const packSpots = spaced(spots.filter(s => g.walkAt(s.x, s.z)), 16);

  return {
    grid: g, spawn, packSpots, objectSpots: chapels.map(c => ({ x: g.x0 + (c.i + 1) * CELL, z: g.z0 + (c.j + 1) * CELL })), portalSpots, landmark, bounds: g.bounds(), deco, lights,
  };
}
