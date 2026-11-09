// Layout „Kanäle“: garantiert ein Haupt-Ring (Schleife zum Kiten) + 2–4 Querkanäle, Gänge 2 Zellen (16 yd) breit.
// Mittig im Gang eine 4-yd-Wasserrinne (bremst 20 %, genZone.moveMul), Stege darüber; Kreuzungen 3 × 3 Zellen trocken = Kampfplätze.
// 1–2 Sackgassen mit objectSpot am Ende (später Truhe), Schleusentor (Landmarke) in einer breiten Nische möglichst weit vom Spawn. Alle Zahlen // PH

import { Grid, CELL, WATER, DRY, spaced, type Layout } from '../grid';
import type { Rng } from '../rng';
import type { Deco, PackSpot, Spot } from '../types';

const K = { margin: [3, 6], cross: [2, 4], deadEnds: [1, 2], deadLen: [3, 5], water: 4, bridgeEvery: 4, bulge: 0.5 };

type Lane = { h: boolean; at: number; a: number; b: number };   // h: waagrecht in Zeilen at, at+1 von Spalte a bis b; sonst senkrecht

export function kanaele(rng: Rng): Layout {
  const g = new Grid(), n = g.n, lanes: Lane[] = [], joints: [number, number][] = [];   // joints: Zelle oben links einer Kreuzung
  const lane = (h: boolean, at: number, a: number, b: number) => {
    const l = { h, at, a: Math.min(a, b), b: Math.max(a, b) };
    lanes.push(l);
    if (h) g.rect(l.a, at, l.b, at + 1); else g.rect(at, l.a, at + 1, l.b);
    return l;
  };

  // Ring: Rechteck mit zufälligen Rändern, einzelne Seiten mit Ausbuchtung nach außen
  const L = rng.int(K.margin[0], K.margin[1]), R = n - 2 - rng.int(K.margin[0], K.margin[1]), T = rng.int(K.margin[0], K.margin[1]), B = n - 2 - rng.int(K.margin[0], K.margin[1]);
  // Gibt die Knickpunkte der Mittellinie zurück (Zellgrenzen-Einheiten, aufsteigend entlang der Seite)
  const side = (h: boolean, at: number, a: number, b: number, out: number, room: number): [number, number][] => {
    if (room >= 4 && b - a > 10 && rng.chance(K.bulge)) {
      const k1 = rng.int(a + 3, a + Math.floor((b - a) / 2) - 1), k2 = rng.int(k1 + 4, b - 3), o = at + out * 2;
      lane(h, at, a, k1 + 1); lane(!h, k1, Math.min(at, o), Math.max(at, o) + 1); lane(h, o, k1, k2 + 1); lane(!h, k2, Math.min(at, o), Math.max(at, o) + 1); lane(h, at, k2, b);
      joints.push(h ? [k1, Math.min(at, o)] : [Math.min(at, o), k1]);   // Ausbuchtung: eine Kreuzung am ersten Knick
      const pts: [number, number][] = [[k1 + 1, at + 1], [k1 + 1, o + 1], [k2 + 1, o + 1], [k2 + 1, at + 1]];
      return h ? pts : pts.map(([u, v]) => [v, u]);
    }
    lane(h, at, a, b);
    return [];
  };
  const top = side(true, T, L, R + 1, -1, T - 1), bottom = side(true, B, L, R + 1, 1, n - 2 - (B + 1));
  const left = side(false, L, T, B + 1, -1, L - 1), right = side(false, R, T, B + 1, 1, n - 2 - (R + 1));
  // Ring-Mittellinie im Uhrzeigersinn (für den Kite-Test)
  const loopCells: [number, number][] = [[L + 1, T + 1], ...top, [R + 1, T + 1], ...right, [R + 1, B + 1], ...bottom.reverse(), [L + 1, B + 1], ...left.reverse()];
  joints.push([L, T], [R, T], [L, B], [R, B]);

  // Querkanäle: von der Ring-Mitte nach beiden Seiten, bis sie auf Boden treffen
  const cut = (h: boolean, at: number) => {
    const mid = h ? Math.floor((L + R) / 2) : Math.floor((T + B) / 2), free = (k: number) => h ? g.walk(k, at) && g.walk(k, at + 1) : g.walk(at, k) && g.walk(at + 1, k);
    let a = mid, b = mid;
    while (a > 1 && !free(a - 1)) a--;
    while (b < n - 2 && !free(b + 1)) b++;
    if (a <= 1 || b >= n - 2) return false;
    // Schon gekreuzte Querkanäle: Kreuzung merken
    for (let k = a; k <= b; k++) if (h ? g.walk(k, at) : g.walk(at, k)) joints.push(h ? [k, at] : [at, k]);
    lane(h, at, a - 1, b + 1);
    joints.push(h ? [a - 1, at] : [at, a - 1], h ? [b, at] : [at, b]);
    return true;
  };
  const used: { h: boolean; at: number }[] = [];
  for (let k = rng.int(K.cross[0], K.cross[1]), tries = 0; k > 0 && tries < 40; tries++) {
    const h = rng.chance(0.5), lo = (h ? T : L) + 4, hi = (h ? B : R) - 4;
    if (hi < lo) continue;
    const at = rng.int(lo, hi);
    if (used.some(u => u.h === h && Math.abs(u.at - at) < 5)) continue;
    if (cut(h, at)) { used.push({ h, at }); k--; }
  }

  // Kreuzungen 3 × 3, je eine Kreuzung pro Stelle
  const plazas: [number, number][] = [];
  for (const [i, j] of joints) {
    const pi = Math.max(1, Math.min(n - 4, i)), pj = Math.max(1, Math.min(n - 4, j));
    if (plazas.some(([a, b]) => Math.abs(a - pi) < 3 && Math.abs(b - pj) < 3)) continue;
    plazas.push([pi, pj]);
  }
  for (const [i, j] of plazas) g.rect(i, j, i + 2, j + 2);
  const plazaMid = ([i, j]: [number, number]) => ({ x: g.x0 + (i + 1.5) * CELL, z: g.z0 + (j + 1.5) * CELL });

  // Sackgassen: senkrecht vom Ring weg, nur durch volle Wand (1 Zelle Abstand zu anderem Boden)
  const wallBlock = (i0: number, j0: number, i1: number, j1: number, ring: Lane) => {
    for (let j = j0 - 1; j <= j1 + 1; j++) for (let i = i0 - 1; i <= i1 + 1; i++) {
      if (ring.h ? j === ring.at || j === ring.at + 1 : i === ring.at || i === ring.at + 1) continue;   // Seite an der eigenen Spur
      if (i < 1 || j < 1 || i > n - 2 || j > n - 2 || g.walk(i, j)) return false;
    }
    return true;
  };
  type Dead = { end: Spot; dir: [number, number]; i0: number; j0: number; i1: number; j1: number; len: number };
  const close = (d: Dead) => g.rect(d.i0, d.j0, d.i1, d.j1, 1);
  const tryDead = (w: number, len: number): Dead | null => {
    for (let tries = 0; tries < 60; tries++) {
      const ring = lanes[rng.int(0, Math.min(lanes.length, 4 + 8) - 1)];
      if (ring.b - ring.a < 6) continue;
      const k = rng.int(ring.a + 2, ring.b - 2 - w + 2), dir = rng.chance(0.5) ? -1 : 1;
      // Rechteck neben der Spur, Breite w entlang der Spur, Länge len quer dazu
      const s0 = dir < 0 ? ring.at - len : ring.at + 2;
      const [i0, j0, i1, j1] = ring.h ? [k, s0, k + w - 1, s0 + len - 1] : [s0, k, s0 + len - 1, k + w - 1];
      if (!wallBlock(i0, j0, i1, j1, ring)) continue;
      if (plazas.some(([a, b]) => Math.abs(a + 1 - (i0 + i1) / 2) < 4 && Math.abs(b + 1 - (j0 + j1) / 2) < 4)) continue;
      g.rect(i0, j0, i1, j1);
      const endI = ring.h ? (i0 + i1 + 1) / 2 : dir < 0 ? i0 + 0.5 : i1 + 0.5, endJ = ring.h ? (dir < 0 ? j0 + 0.5 : j1 + 0.5) : (j0 + j1 + 1) / 2;
      return { end: { x: g.x0 + endI * CELL, z: g.z0 + endJ * CELL }, dir: ring.h ? [0, dir] : [dir, 0], i0, j0, i1, j1, len };
    }
    return null;
  };

  // Spawn: eine Ring-Ecke
  const spawnPlaza = plazas[rng.int(0, 3)], spawn = plazaMid(spawnPlaza);
  // Schleuse: breite Nische (4 Zellen), die am weitesten vom Spawn liegt
  let gate: Dead | null = null;
  for (let k = 0; k < 6; k++) {
    const cand = tryDead(4, 3);
    if (!cand) break;
    const d = Math.hypot(cand.end.x - spawn.x, cand.end.z - spawn.z);
    if (!gate || d > Math.hypot(gate.end.x - spawn.x, gate.end.z - spawn.z)) {
      if (gate) close(gate);   // alte wieder zu
      gate = cand;
    } else close(cand);
  }
  const deads: Dead[] = [];
  for (let k = rng.int(K.deadEnds[0], K.deadEnds[1]); k > 0; k--) { const d = tryDead(2, rng.int(K.deadLen[0], K.deadLen[1])); if (d) deads.push(d); }

  // Wasserrinne: Mitte jeder Spur, an den Enden bis zur Mitte der Quer-Spur; Kreuzungen und Nischen-Enden trocken
  const half = K.water / 2;
  for (const l of lanes) {
    const c = (l.at + 1) * CELL, a = (l.a + 1) * CELL - half, b = l.b * CELL + half;
    if (l.h) g.fineRect(g.x0 + a, g.z0 + c - half, g.x0 + b, g.z0 + c + half, WATER);
    else g.fineRect(g.x0 + c - half, g.z0 + a, g.x0 + c + half, g.z0 + b, WATER);
  }
  for (const d of deads) {
    const [dx, dz] = d.dir, len = d.len * CELL - CELL;   // Rinne läuft hinein, das letzte Stück bleibt trocken (Truhe)
    if (dz) { const x = d.end.x; g.fineRect(x - half, d.end.z - dz * (len + CELL), x + half, d.end.z - dz * CELL, WATER); }
    else { const z = d.end.z; g.fineRect(d.end.x - dx * (len + CELL), z - half, d.end.x - dx * CELL, z + half, WATER); }
  }
  for (const [i, j] of plazas) g.fineRect(g.x0 + i * CELL, g.z0 + j * CELL, g.x0 + (i + 3) * CELL, g.z0 + (j + 3) * CELL, DRY);

  // Stege: alle paar Zellen über die Rinne, dort trocken
  const deco: Deco[] = [];
  for (const l of lanes) for (let k = l.a + 2; k <= l.b - 2; k += K.bridgeEvery) {
    const c = g.x0 + (l.at + 1) * CELL, p = l.h ? { x: g.cx(k), z: c } : { x: c, z: g.cz(k) };   // x0 = z0: Mitte der Spur
    if (plazas.some(pl => { const m = plazaMid(pl); return Math.abs(m.x - p.x) < 16 && Math.abs(m.z - p.z) < 16; })) continue;
    deco.push({ kind: 'bridge', x: p.x, z: p.z, ry: l.h ? Math.PI / 2 : 0 });
    g.fineRect(p.x - (l.h ? 1.5 : 3), p.z - (l.h ? 3 : 1.5), p.x + (l.h ? 1.5 : 3), p.z + (l.h ? 3 : 1.5), DRY);
  }
  // Kleinkram an den Wänden: Fässer, Gitter, Schutt
  for (let k = 0, tries = 0; k < 18 && tries < 300; tries++) {
    const i = rng.int(1, n - 2), j = rng.int(1, n - 2);
    if (!g.edgeFloor(i, j)) continue;
    const x = g.cx(i) + rng.range(-2.5, 2.5), z = g.cz(j) + rng.range(-2.5, 2.5);
    if (g.fineAt(x, z) !== DRY || Math.hypot(x - spawn.x, z - spawn.z) < 14) continue;
    if (![[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]].some(([dx, dz]) => !g.walkAt(x + dx * 2, z + dz * 2))) continue;   // nur an der Wand
    deco.push({ kind: rng.pick(['barrel', 'barrel', 'grate', 'rubble']), x, z, ry: rng.range(0, 6.28) });
    k++;
  }

  // Landmarke: Schleusentor am Ende der breiten Nische, Blick in den Gang
  let landmark = { x: plazaMid(plazas[plazas.length - 1]).x, z: plazaMid(plazas[plazas.length - 1]).z, ry: 0 };
  const portalSpots: Spot[] = [];
  if (gate) {
    const [dx, dz] = gate.dir;
    landmark = { x: gate.end.x - dx * 2.5, z: gate.end.z - dz * 2.5, ry: Math.atan2(-dx, -dz) };
    portalSpots.push({ x: gate.end.x - dx * 12, z: gate.end.z - dz * 12 });
    g.fineRect(gate.end.x - 16, gate.end.z - 16, gate.end.x + 16, gate.end.z + 16, DRY);   // Becken vor dem Tor trocken
  }
  const far = plazas.map(plazaMid).sort((a, b) => Math.hypot(b.x - spawn.x, b.z - spawn.z) - Math.hypot(a.x - spawn.x, a.z - spawn.z));
  portalSpots.push(...far.slice(0, 2));

  // Pack-Plätze: Kreuzungen bevorzugt, dann Gang-Mitten
  const spots: PackSpot[] = plazas.filter(p => p !== spawnPlaza).map(p => ({ ...plazaMid(p), r: 9 }));
  for (const l of lanes) if (l.b - l.a >= 6) {
    const m = Math.floor((l.a + l.b) / 2), c = g.x0 + (l.at + 1) * CELL;
    spots.push(l.h ? { x: g.cx(m), z: g.z0 + (l.at + 1) * CELL, r: 5 } : { x: c, z: g.cz(m), r: 5 });
  }
  const packSpots = spaced(spots, 18);

  return {
    grid: g, spawn, packSpots, objectSpots: deads.map(d => d.end), portalSpots, landmark, bounds: g.bounds(), deco, lights: [],
    loop: loopCells.map(([u, v]) => ({ x: g.x0 + u * CELL, z: g.z0 + v * CELL })),
  };
}
