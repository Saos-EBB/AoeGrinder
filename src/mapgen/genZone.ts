// Generierte Zone: hat dieselbe Schnittstelle wie die Zonen in zones.ts (height, ground, props, env, mobs, packs, spawn, spawnOk, …),
// dazu packSpots, theme, bounds, layout. prepare() würfelt das Layout mit einem neuen Seed (fest mit ?seed=, mapgen/rng.ts), bevor world.ts das Gelände baut.

import type * as THREE from 'three';
import { makeRng, mixSeed, nextMapSeed, type Rng } from './rng';
import { check, tidy, CELL, WATER, LAVA, type Layout } from './grid';
import { buildLayout, groundColor, type Look } from './build';
import type { ThemeInfo, PackSpot, Spot } from './types';
import { dist2d } from '../util';
import { state } from '../state';

export const GEN = { tries: 10, waterSlow: 0.8, lavaDps: 40, edgeMin: 30 };   // PH: Wasser bremst 20 %, Lava wie BRD (zones.ts)

export interface GenDef {
  id: string;                                     // Zonen-ID (ZONES), z. B. map-wald
  name: string;
  theme: ThemeInfo;
  layout: (rng: Rng) => Layout;
  look: Look;
  env: any;
  mobs: string[];
  packs: { count: number; initialMobs: number; sizeBonus: number };
  storm?: any;
  fogExtra?: number;                              // dichterer Nebel (dunkel.ts liest state.fogExtra)
}

const pathDistOf = (paths: [number, number][][] | undefined) => {
  if (!paths?.length) return undefined;
  return (x: number, z: number) => {
    let best = 1e9;
    for (const p of paths) for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  };
};

// Layout würfeln und prüfen, bis zu GEN.tries Versuche mit abgeleitetem Seed
export function generate(def: GenDef, seed: number): { layout: Layout; tries: number; problem: string | null } {
  let layout: Layout = null, problem: string | null = null, n = 0;
  for (n = 0; n < GEN.tries; n++) {
    layout = def.layout(makeRng(mixSeed(def.theme.id, seed, n)));
    tidy(layout);
    problem = check(layout);
    if (!problem) break;
  }
  if (problem) console.warn(`mapgen ${def.id} seed ${seed}: ${problem} nach ${GEN.tries} Versuchen`);
  return { layout, tries: Math.min(n + 1, GEN.tries), problem };
}

export function genZone(def: GenDef) {
  let pathDist: ((x: number, z: number) => number) | undefined, ground = null, edges: Spot[] = [];
  const zone: any = {
    gen: true, id: def.id, name: def.name, theme: def.theme, env: def.env, toon: true, mobs: def.mobs, packs: def.packs, storm: def.storm,
    seed: 0, tries: 0, layout: null as Layout, packSpots: [] as PackSpot[], spawn: { x: 0, z: 0 }, bounds: null, meshes: [] as THREE.Object3D[],
    prepare() {
      const seed = nextMapSeed(), r = generate(def, seed), l = r.layout;
      Object.assign(zone, { seed, tries: r.tries, problem: r.problem, layout: l, packSpots: l.packSpots, spawn: l.spawn, bounds: l.bounds });
      pathDist = pathDistOf(l.paths);
      ground = groundColor(l, def.look, pathDist);
      edges = [];
      for (let j = 0; j < l.grid.n; j++) for (let i = 0; i < l.grid.n; i++) if (l.grid.edgeFloor(i, j)) edges.push({ x: l.grid.cx(i), z: l.grid.cz(j) });
    },
    height(x: number, z: number) { return zone.layout?.height?.(x, z) ?? 0; },
    ground(c: THREE.Color, x: number, z: number) { ground?.(c, x, z); },
    props(ctx) {
      const rng = makeRng(mixSeed(def.theme.id, zone.seed, 'deko'));
      zone.meshes = buildLayout(ctx, zone.layout, def.look, rng, ctx.heightAt);
      state.fogExtra = def.fogExtra ?? 0;
    },
    // Boden, kein Wasser/Lava, nicht direkt an der Wand (halbe Zelle Abstand)
    spawnOk(x: number, z: number) {
      const g = zone.layout?.grid;
      if (!g || !g.walkAt(x, z) || g.fineAt(x, z) !== 0) return false;
      return g.walkAt(x + 2, z) && g.walkAt(x - 2, z) && g.walkAt(x, z + 2) && g.walkAt(x, z - 2);
    },
    // Wellen (waves.ts): Rand-Bodenzelle mit Abstand zum Spieler
    edgeSpot(from: Spot) {
      const far = edges.filter(e => dist2d(e, from) >= GEN.edgeMin);
      const list = far.length ? far : edges;
      const e = list[Math.floor(Math.random() * list.length)];
      return e ? { x: e.x + (Math.random() - 0.5) * CELL * 0.5, z: e.z + (Math.random() - 0.5) * CELL * 0.5 } : null;
    },
    leave() { state.fogExtra = 0; },
    moveMul(x: number, z: number) { return zone.layout?.grid.fineAt(x, z) === WATER ? GEN.waterSlow : 1; },
    hazard(x: number, z: number) { return zone.layout?.grid.fineAt(x, z) === LAVA ? GEN.lavaDps : 0; },
  };
  return zone;
}
