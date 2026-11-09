// Seed-RNG (mulberry32). Ein Seed pro Map: ?seed=<n> setzt ihn, sonst Zufall beim Laden; Dev-Fenster würfelt neu (devMap.ts).

export type Rng = {
  (): number;                                   // 0 … 1
  range(a: number, b: number): number;
  int(a: number, b: number): number;           // a … b inklusive
  pick<T>(arr: T[]): T;
  chance(p: number): boolean;
};

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (() => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.range = (a, b) => a + next() * (b - a);
  next.int = (a, b) => Math.floor(a + next() * (b - a + 1));
  next.pick = arr => arr[Math.floor(next() * arr.length)];
  next.chance = p => next() < p;
  return next;
}

// Seed aus Text mischen (Theme + Seed + Versuch), damit jedes Theme mit demselben Seed eine eigene Map bekommt
export function mixSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
let seed = Number.isFinite(fromUrl) && fromUrl > 0 ? Math.floor(fromUrl) : 1 + Math.floor(Math.random() * 999999);
export const mapSeed = () => seed;
export function setMapSeed(n: number) { seed = Math.max(1, Math.floor(n) || 1); }
export function rerollSeed() { seed = 1 + Math.floor(Math.random() * 999999); return seed; }
