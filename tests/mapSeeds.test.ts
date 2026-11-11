// Seed-Snapshot (KOMP-15, Schutz der Seed-Rangliste): gleicher Seed = gleiche Map.
// Für 12 feste Seeds × 5 Themes × 4 Layouts wird die Map wie in mapgen/genZone.ts generate() gewürfelt
// (bis GEN.tries Versuche, Seed mixSeed(theme, seed, n), danach tidy + check) und auf eine Signatur reduziert:
// Versuche, Problem, Hash über Raster (cells + fine), Spawn, Pack-, Objekt- und Portal-Plätze, Landmarke,
// Deko, Lichter, Pfade, Ring, Grenzen und Geländehöhe (Stichproben). Nur die reinen Teile (grid, layouts, rng);
// genZone/build/themes laden three, i18n und DOM und laufen deshalb nicht in Node. Nicht abgedeckt: Deko-Bau mit
// eigenem 'deko'-Rng (build.ts buildLayout) und Objekte (objects/objects.ts), beide brauchen den Browser.
//
// Schlägt der Test fehl, hat sich für einen Seed die Map geändert. Das ist nur dann in Ordnung, wenn es gewollt ist
// (neue Map-Version, Seed-Rangliste wird dafür neu begonnen). Snapshot dann bewusst erneuern:
//   npx vitest run -u tests/mapSeeds.test.ts
// und die Änderung an tests/snapshots/map-seeds.json im Commit begründen (CHANGELOG-Zeile, weil Spieler andere Maps sehen).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeRng, mixSeed, type Rng } from '../src/mapgen/rng';
import { check, tidy, type Layout } from '../src/mapgen/grid';
import { offen } from '../src/mapgen/layouts/offen';
import { kanaele } from '../src/mapgen/layouts/kanaele';
import { raeume } from '../src/mapgen/layouts/raeume';
import { hallen } from '../src/mapgen/layouts/hallen';

const SEEDS = [1, 2, 7, 42, 1337, 4242, 9999, 31337, 123456, 500000, 777777, 999999];
const LAYOUTS: Record<string, (rng: Rng) => Layout> = { offen, kanaele, raeume, hallen };
// So stehen die Themes heute in mapgen/themes.ts (Test unten prüft das gegen den Quelltext)
const THEME_LAYOUT: Record<string, string> = { wald: 'offen', wueste: 'offen', kanaele: 'kanaele', kathedrale: 'hallen', hoelle: 'raeume' };
const TRIES = 10;   // GEN.tries in genZone.ts

// Nachbau von genZone.ts generate() ohne three/DOM
function generate(theme: string, layout: (rng: Rng) => Layout, seed: number) {
  let l: Layout = null, problem: string | null = null, n = 0;
  for (n = 0; n < TRIES; n++) {
    l = layout(makeRng(mixSeed(theme, seed, n)));
    tidy(l);
    problem = check(l);
    if (!problem) break;
  }
  return { layout: l, tries: Math.min(n + 1, TRIES), problem };
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const round = (v: unknown): unknown => typeof v === 'number' ? r6(v) : Array.isArray(v) ? v.map(round)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v;
const hash = (v: unknown) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(round(v))).digest('hex').slice(0, 16);

function signature(theme: string, layoutId: string, seed: number) {
  const { layout: l, tries, problem } = generate(theme, LAYOUTS[layoutId], seed);
  const g = l.grid;
  const heights: number[] = [];
  if (l.height) for (let z = -100; z <= 100; z += 20) for (let x = -100; x <= 100; x += 20) heights.push(l.height(x, z));
  const parts = {
    cells: Buffer.from(g.cells).toString('base64'), fine: Buffer.from(g.fine).toString('base64'),
    spawn: l.spawn, packs: l.packSpots, objects: l.objectSpots, portals: l.portalSpots, landmark: l.landmark, bounds: l.bounds,
    deco: l.deco, lights: l.lights, paths: l.paths ?? null, loop: l.loop ?? null, heights,
  };
  return {
    tries, problem,
    floor: g.floorCount(), packs: l.packSpots.length, objects: l.objectSpots.length, portals: l.portalSpots.length, deco: l.deco.length,
    hash: hash(parts),
  };
}

describe('Seed-Snapshot der Maps', () => {
  it('Themes → Layouts wie in mapgen/themes.ts', () => {
    const src = readFileSync(new URL('../src/mapgen/themes.ts', import.meta.url), 'utf8');
    const found = Object.fromEntries([...src.matchAll(/\bid: '(\w+)', info:[^\n]*?\blayout: '(\w+)'/g)].map(m => [m[1], m[2]]));
    expect(found).toEqual(THEME_LAYOUT);
  });

  it('Nachbau entspricht genZone.ts generate()', () => {
    const src = readFileSync(new URL('../src/mapgen/genZone.ts', import.meta.url), 'utf8');
    expect(src).toContain(`tries: ${TRIES},`);
    expect(src).toContain('layout = def.layout(makeRng(mixSeed(def.theme.id, seed, n)));');
    expect(src).toMatch(/tidy\(layout\);\s*problem = check\(layout\);\s*if \(!problem\) break;/);
  });

  it('gleicher Seed → gleiche Signatur (zweimal gerechnet)', () => {
    expect(signature('wald', 'offen', 4242)).toEqual(signature('wald', 'offen', 4242));
  });

  it(`${SEEDS.length} Seeds × ${Object.keys(THEME_LAYOUT).length} Themes × ${Object.keys(LAYOUTS).length} Layouts unverändert`, async () => {
    const out: Record<string, unknown> = {};
    for (const theme of Object.keys(THEME_LAYOUT)) for (const layoutId of Object.keys(LAYOUTS)) {
      const key = `${theme}/${layoutId}${THEME_LAYOUT[theme] === layoutId ? '' : ' (nicht im Spiel)'}`;
      out[key] = Object.fromEntries(SEEDS.map(s => [s, signature(theme, layoutId, s)]));
    }
    await expect(JSON.stringify(out, null, 1) + '\n').toMatchFileSnapshot('./snapshots/map-seeds.json');
  });
});
