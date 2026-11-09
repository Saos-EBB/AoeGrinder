// Layout „Offen“ (Wald, Wüste): unregelmäßiger Rand (Radius mit Rauschen ± 15 %), 3–5 Lichtungen, Pfade dazwischen,
// dazwischen Baum-/Felsgruppen. Landmarke auf der Lichtung, die am weitesten vom Spawn liegt. Sanfte Höhe, auf Pfaden flach. Alle Zahlen // PH

import { Grid, CELL, spaced, type Layout } from '../grid';
import type { Rng } from '../rng';
import type { Deco, PackSpot, Spot } from '../types';

const O = {
  radius: 84, noise: 0.15,                      // Rand: Grundradius in yd, ± Anteil
  clearings: [3, 5], clearR: [10, 17.5],        // Lichtungen: Durchmesser 20–35 yd
  clusters: [16, 24], clusterR: [5, 9], perCluster: [4, 9],   // Baum-/Felsgruppen
  height: 1.6, flatPath: 7,                     // Höhe ± yd, Pfad flach bis so viele yd daneben
  spotSpace: 22,
};

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);
function segDist(x: number, z: number, [ax, az]: number[], [bx, bz]: number[]) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

export function offen(rng: Rng): Layout {
  const g = new Grid();
  // Rand: Summe von Sinus-Wellen um den Kreis, auf ± O.noise normiert
  const waves = [2, 3, 5].map(k => ({ k, p: rng.range(0, 6.28), a: rng.range(0.5, 1) })), sum = waves.reduce((s, w) => s + w.a, 0);
  const edge = (a: number) => O.radius * (1 + O.noise * waves.reduce((s, w) => s + w.a * Math.sin(w.k * a + w.p), 0) / sum);
  for (let j = 1; j < g.n - 1; j++) for (let i = 1; i < g.n - 1; i++) {
    const x = g.cx(i), z = g.cz(j);
    if (Math.hypot(x, z) < edge(Math.atan2(z, x)) - CELL * 0.5) g.carve(i, j);
  }

  // Lichtungen: die erste ist der Spawn (nahe der Mitte), die anderen im Ring außen
  const clear: (Spot & { r: number })[] = [];
  const nC = rng.int(O.clearings[0], O.clearings[1]);
  const a0 = rng.range(0, 6.28);
  const d0 = rng.range(18, 34);
  clear.push({ x: Math.cos(a0) * d0, z: Math.sin(a0) * d0, r: rng.range(12, O.clearR[1]) });
  for (let tries = 0; clear.length < nC && tries < 300; tries++) {
    // Die zweite Lichtung liegt gegenüber, damit es einen Portal-Platz ≥ 60 yd vom Spawn gibt
    const a = clear.length === 1 ? a0 + Math.PI + rng.range(-0.6, 0.6) : rng.range(0, 6.28), r = rng.range(O.clearR[0], O.clearR[1]);
    const d = clear.length === 1 ? rng.range(45, edge(a) - r - 6) : rng.range(35, edge(a) - r - 6);
    const c = { x: Math.cos(a) * d, z: Math.sin(a) * d, r };
    if (clear.every(o => dist(o, c) > o.r + c.r + 14)) clear.push(c);
  }
  const spawn = { x: clear[0].x, z: clear[0].z };

  // Pfade: Minimal-Spannbaum über die Lichtungen + eine Extra-Kante, mit Knick in der Mitte
  const edges: [number, number][] = [], inTree = [0];
  while (inTree.length < clear.length) {
    let best: [number, number] = null, bd = 1e9;
    for (const a of inTree) for (let b = 0; b < clear.length; b++) if (!inTree.includes(b) && dist(clear[a], clear[b]) < bd) { bd = dist(clear[a], clear[b]); best = [a, b]; }
    edges.push(best); inTree.push(best[1]);
  }
  if (clear.length > 3) {
    const extra = [];
    for (let a = 0; a < clear.length; a++) for (let b = a + 1; b < clear.length; b++) if (!edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) extra.push([a, b]);
    extra.sort((p, q) => dist(clear[p[0]], clear[p[1]]) - dist(clear[q[0]], clear[q[1]]));
    if (extra.length) edges.push(extra[0]);
  }
  const paths: [number, number][][] = edges.map(([a, b]) => {
    const A = clear[a], B = clear[b], mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, nx = -(B.z - A.z), nz = B.x - A.x, l = Math.hypot(nx, nz) || 1, k = rng.range(-0.25, 0.25) * dist(A, B);
    return [[A.x, A.z], [mx + nx / l * k, mz + nz / l * k], [B.x, B.z]];
  });
  const pathDist = (x: number, z: number) => Math.min(...paths.map(p => Math.min(segDist(x, z, p[0], p[1]), segDist(x, z, p[1], p[2]))));
  const inClearing = (x: number, z: number, pad = 0) => clear.some(c => Math.hypot(x - c.x, z - c.z) < c.r + pad);
  const floorAt = (x: number, z: number, pad: number) => [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]].every(([dx, dz]) => g.walkAt(x + dx, z + dz));

  // Landmarke: Lichtung am weitesten vom Spawn, hinten auf der Lichtung
  const far = clear.slice(1).sort((a, b) => dist(b, spawn) - dist(a, spawn))[0] ?? clear[0];
  const back = Math.atan2(far.z - spawn.z, far.x - spawn.x);
  const landmark = { x: far.x + Math.cos(back) * far.r * 0.45, z: far.z + Math.sin(back) * far.r * 0.45, ry: Math.atan2(-Math.cos(back), -Math.sin(back)) };   // Vorderseite zum Spawn

  // Baum- und Felsgruppen außerhalb von Lichtungen und Pfaden
  const deco: Deco[] = [], clusters: (Spot & { r: number })[] = [];
  for (let k = rng.int(O.clusters[0], O.clusters[1]), tries = 0; k > 0 && tries < 400; tries++) {
    const a = rng.range(0, 6.28), d = rng.range(0, O.radius), c = { x: Math.cos(a) * d, z: Math.sin(a) * d, r: rng.range(O.clusterR[0], O.clusterR[1]) };
    if (!floorAt(c.x, c.z, 4) || inClearing(c.x, c.z, c.r + 2) || pathDist(c.x, c.z) < c.r + 4 || clusters.some(o => dist(o, c) < o.r + c.r + 8)) continue;
    clusters.push(c); k--;
    for (let n = rng.int(O.perCluster[0], O.perCluster[1]); n > 0; n--) {
      const b = rng.range(0, 6.28), e = Math.sqrt(rng()) * c.r, x = c.x + Math.cos(b) * e, z = c.z + Math.sin(b) * e;
      if (!floorAt(x, z, 2) || pathDist(x, z) < 4) continue;
      deco.push({ kind: rng.chance(0.62) ? 'tree' : rng.chance(0.5) ? 'tree2' : rng.chance(0.6) ? 'rock' : 'boulder', x, z, ry: rng.range(0, 6.28), s: rng.range(0.85, 1.35) });
    }
  }
  // Einzelne Kleinteile (Knochen, Steine) verstreut, nur Optik-nah am Boden
  for (let n = 0, tries = 0; n < 14 && tries < 200; tries++) {
    const x = rng.range(-O.radius, O.radius), z = rng.range(-O.radius, O.radius);
    if (!floorAt(x, z, 3) || inClearing(x, z, 2) || pathDist(x, z) < 4 || dist({ x, z }, landmark) < 10) continue;
    deco.push({ kind: 'small', x, z, ry: rng.range(0, 6.28), s: rng.range(0.8, 1.2) }); n++;
  }
  const freeOfDeco = (p: Spot, r: number) => clusters.every(c => dist(c, p) > c.r + r) && dist(p, landmark) > 10;

  // Pack-Plätze: Lichtungen (außer Spawn), Pfad-Mitten, dann freie Stellen
  const spots: PackSpot[] = [];
  for (const c of clear.slice(1)) {
    const p = c === far ? { x: far.x - Math.cos(back) * far.r * 0.35, z: far.z - Math.sin(back) * far.r * 0.35 } : c;
    spots.push({ x: p.x, z: p.z, r: Math.min(9, c.r * 0.6) });
  }
  for (const p of paths) spots.push({ x: p[1][0], z: p[1][1], r: 6 });
  for (let tries = 0; spots.length < 22 && tries < 600; tries++) {
    const p = { x: rng.range(-O.radius, O.radius), z: rng.range(-O.radius, O.radius), r: 7 };
    if (floorAt(p.x, p.z, 8) && freeOfDeco(p, 6) && spots.every(s => dist(s, p) > O.spotSpace)) spots.push(p);
  }
  const packSpots = spaced(spots.filter(s => floorAt(s.x, s.z, 4) && freeOfDeco(s, 2)), 18);

  const byFar = (list: Spot[]) => list.slice().sort((a, b) => dist(b, spawn) - dist(a, spawn));
  const portalSpots = byFar([{ x: far.x - Math.cos(back) * 4, z: far.z - Math.sin(back) * 4 }, ...clear.slice(1).filter(c => c !== far)]);
  const objectSpots = byFar(packSpots).slice(0, 4).map(s => ({ x: s.x + 4, z: s.z }));

  // Höhe: sanftes Rauschen, auf Pfaden und Lichtungen flach
  const ph = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  const height = (x: number, z: number) => {
    const h = O.height * Math.sin(x * 0.035 + ph[0]) * Math.cos(z * 0.03 + ph[1]) + O.height * 0.5 * Math.sin(x * 0.08 + z * 0.06 + ph[2]);
    const p = Math.min(1, pathDist(x, z) / O.flatPath), c = clear.reduce((m, o) => Math.min(m, Math.max(0, (Math.hypot(x - o.x, z - o.z) - o.r * 0.5) / o.r)), 1);
    return h * Math.min(p, c);
  };

  return { grid: g, spawn, packSpots, objectSpots, portalSpots, landmark, bounds: g.bounds(), deco, lights: [], paths, height };
}
