// mapgen/grid.ts: Raster, Prüfungen nach der Erzeugung (check), Aufräumen (tidy), Ausdünnen (spaced).
import { describe, it, expect } from 'vitest';
import { Grid, CELL, SIZE, FLOOR, WALL, check, tidy, spaced, RULES, type Layout } from '../src/mapgen/grid';

// Kleine Map: ein großer Raum in der Mitte, Spawn im Ursprung
function room(): Layout {
  const g = new Grid();
  g.rect(2, 2, SIZE - 3, SIZE - 3, FLOOR);
  return { grid: g, spawn: { x: 0, z: 0 }, packSpots: [{ x: 50, z: 0, r: 6 }], objectSpots: [{ x: 20, z: 20 }], portalSpots: [{ x: 70, z: 0 }],
    landmark: { x: 0, z: 30, ry: 0 }, bounds: g.bounds(), deco: [], lights: [] };
}

describe('Grid', () => {
  it('Zellen ↔ Welt-Koordinaten, Mitte im Ursprung', () => {
    const g = new Grid();
    expect(g.ci(0)).toBe(SIZE / 2);
    expect(g.cx(g.ci(13))).toBe(12);                       // Zellmitte (8-yd-Raster, Rand bei 8)
    expect(g.bounds()).toEqual({ minX: -SIZE * CELL / 2, maxX: SIZE * CELL / 2, minZ: -SIZE * CELL / 2, maxZ: SIZE * CELL / 2 });
  });
  it('Rand bleibt immer Wand (carve)', () => {
    const g = new Grid();
    g.rect(0, 0, SIZE - 1, SIZE - 1, FLOOR);
    expect(g.get(0, 5)).toBe(WALL);
    expect(g.get(SIZE - 1, 5)).toBe(WALL);
    expect(g.get(1, 1)).toBe(FLOOR);
    expect(g.get(-1, -1)).toBe(WALL);                     // außerhalb = Wand
  });
  it('flood zählt den zusammenhängenden Boden', () => {
    const l = room();
    const { out } = l.grid.flood(l.grid.ci(0), l.grid.cj(0));
    expect(out.length).toBe(l.grid.floorCount());
    expect(out.length).toBe((SIZE - 4) ** 2);
  });
});

describe('check', () => {
  it('passende Map → null', () => { expect(check(room())).toBe(null); });
  it('getrennter Boden wird erkannt', () => {
    const l = room();
    for (let j = 1; j < SIZE - 1; j++) l.grid.set(SIZE - 6, j, WALL);   // Trennwand
    expect(check(l)).toMatch(/Boden nicht verbunden/);
  });
  it('Spawn nicht frei, keine Packs, kein Portal', () => {
    const a = room(); a.grid.set(a.grid.ci(0) + 1, a.grid.cj(0), WALL); expect(check(a)).toMatch(/spawn/);
    const b = room(); b.packSpots = []; expect(check(b)).toBe('keine Pack-Plätze');
    const c = room(); c.portalSpots = []; expect(check(c)).toBe('kein Portal-Platz');
  });
});

describe('tidy', () => {
  it('Packs/Portale zu nah am Spawn oder in der Wand fallen weg', () => {
    const l = room();
    l.packSpots.push({ x: RULES.packFromSpawn - 1, z: 0, r: 5 }, { x: 0, z: 200, r: 5 });
    l.portalSpots.push({ x: RULES.portalFromSpawn - 1, z: 0 });
    l.objectSpots.push({ x: 999, z: 0 });
    tidy(l);
    expect(l.packSpots).toEqual([{ x: 50, z: 0, r: 6 }]);
    expect(l.portalSpots).toEqual([{ x: 70, z: 0 }]);
    expect(l.objectSpots).toEqual([{ x: 20, z: 20 }]);
  });
});

describe('spaced', () => {
  it('der erste gewinnt, Mindestabstand gilt', () => {
    const list = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 10, z: 0 }, { x: 12, z: 0 }];
    expect(spaced(list, 5)).toEqual([{ x: 0, z: 0 }, { x: 10, z: 0 }]);
  });
});
