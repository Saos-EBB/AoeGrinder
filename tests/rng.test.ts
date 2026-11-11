// mapgen/rng.ts: Determinismus pro Seed (Seed-Rangliste) und ?seed= aus der Adresse.
import { describe, it, expect } from 'vitest';
import { makeRng, mixSeed, seedFromUrl } from '../src/mapgen/rng';

describe('makeRng', () => {
  it('gleicher Seed → gleiche Folge', () => {
    const a = makeRng(4242), b = makeRng(4242);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('andere Seeds → andere Folge', () => {
    const a = makeRng(1), b = makeRng(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });
  it('feste Werte (mulberry32, darf sich nie ändern)', () => {
    const r = makeRng(4242);
    expect([r(), r(), r()].map(x => Math.round(x * 1e9))).toMatchInlineSnapshot(`
      [
        546706134,
        278608789,
        931236917,
      ]
    `);
  });
  it('range/int/pick/chance in den Grenzen und deterministisch', () => {
    const r = makeRng(7), q = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const x = r.range(-3, 5); expect(x).toBeGreaterThanOrEqual(-3); expect(x).toBeLessThan(5); expect(q.range(-3, 5)).toBe(x);
      const n = r.int(2, 4); expect([2, 3, 4]).toContain(n); expect(q.int(2, 4)).toBe(n);
    }
    expect(r.pick(['a', 'b', 'c'])).toBe(q.pick(['a', 'b', 'c']));
    expect(r.chance(0.5)).toBe(q.chance(0.5));
  });
  it('werte in [0, 1)', () => {
    const r = makeRng(0);
    for (let i = 0; i < 1000; i++) { const x = r(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});

describe('mixSeed', () => {
  it('deterministisch, uint32', () => {
    expect(mixSeed('wald', 4242, 0)).toBe(mixSeed('wald', 4242, 0));
    const h = mixSeed('wald', 4242, 0);
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true);
  });
  it('Theme/Versuch ändern den Seed', () => {
    expect(mixSeed('wald', 4242, 0)).not.toBe(mixSeed('wueste', 4242, 0));
    expect(mixSeed('wald', 4242, 0)).not.toBe(mixSeed('wald', 4242, 1));
  });
  it('feste Werte (FNV-1a, darf sich nie ändern)', () => {
    expect([mixSeed('wald', 4242, 0), mixSeed(4242, 'portal', 1), mixSeed()]).toMatchInlineSnapshot(`
      [
        2037677191,
        3029907482,
        2166136261,
      ]
    `);
  });
});

describe('seedFromUrl', () => {
  it('liest ?seed= wie früher beim Laden', () => {
    expect(seedFromUrl('?seed=4242')).toBe(4242);
    expect(seedFromUrl('?x=1&seed=17')).toBe(17);
    expect(seedFromUrl('?seed=12.9')).toBe(12.9);          // abgerundet wird erst beim Setzen
    expect(seedFromUrl('')).toBe(0);
    expect(seedFromUrl('?seed=0')).toBe(0);
    expect(seedFromUrl('?seed=-5')).toBe(0);
    expect(seedFromUrl('?seed=abc')).toBe(0);
    expect(seedFromUrl('?seed=Infinity')).toBe(0);
  });
  it('ohne location (Node) kein fester Seed', () => {
    expect(seedFromUrl()).toBe(0);
  });
});
