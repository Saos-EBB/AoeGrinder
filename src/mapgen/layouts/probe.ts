// Test-Layout für den Generator-Kern (Phase 1): ein großer Raum mit zufälligen Wandblöcken und Säulen. Wird von den echten Layouts abgelöst.

import { Grid, spaced, type Layout } from '../grid';
import type { Rng } from '../rng';

export function probe(rng: Rng): Layout {
  const g = new Grid();
  g.rect(2, 2, g.n - 3, g.n - 3);
  for (let k = rng.int(6, 10); k > 0; k--) {               // Wandblöcke, nie an der Mitte
    const i = rng.int(3, g.n - 6), j = rng.int(3, g.n - 6);
    if (Math.abs(i - g.n / 2) < 4 && Math.abs(j - g.n / 2) < 4) continue;
    g.rect(i, j, i + rng.int(0, 2), j + rng.int(0, 2), 1);
  }
  const spawn = { x: g.cx(g.n / 2), z: g.cz(g.n / 2) };
  const free: { x: number; z: number; r: number }[] = [];
  for (let j = 3; j < g.n - 3; j += 2) for (let i = 3; i < g.n - 3; i += 2) if (g.walk(i, j) && g.walk(i + 1, j) && g.walk(i, j + 1)) free.push({ x: g.cx(i) + 4, z: g.cz(j) + 4, r: 6 });
  free.sort(() => rng() - 0.5);
  const far = free.slice().sort((a, b) => Math.hypot(b.x - spawn.x, b.z - spawn.z) - Math.hypot(a.x - spawn.x, a.z - spawn.z));
  return {
    grid: g, spawn, packSpots: spaced(free, 22), objectSpots: [], portalSpots: far.slice(0, 2),
    landmark: { ...far[0], ry: 0 }, bounds: g.bounds(), lights: [],
    deco: free.slice(0, 12).map(p => ({ kind: 'pillar', x: p.x - 5, z: p.z - 5 })),
  };
}
