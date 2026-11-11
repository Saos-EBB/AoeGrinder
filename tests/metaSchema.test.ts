// Schema-Version des Spielstands (storage.ts, ARCH-08 Schritt 4): fehlt = 0, nur ganze Zahlen ≥ 0 zählen.
// normalizeMeta selbst (m.schema = Math.max(metaSchemaOf(m), META_SCHEMA)) prüft tests/metaNormalize.test.ts (seit E10 in Node ladbar).
import { describe, it, expect } from 'vitest';
import { META_SCHEMA, metaSchemaOf } from '../src/storage';

describe('metaSchemaOf', () => {
  it('heutiges Schema ist 1', () => { expect(META_SCHEMA).toBe(1); });
  it('alter Stand ohne Feld → 0', () => {
    expect(metaSchemaOf({ dust: 5 })).toBe(0);
    expect(metaSchemaOf({})).toBe(0);
    expect(metaSchemaOf(null)).toBe(0);
    expect(metaSchemaOf(undefined)).toBe(0);
  });
  it('kaputte Werte → 0', () => {
    for (const v of ['1', 1.5, -1, NaN, Infinity, null, true, {}, []]) expect(metaSchemaOf({ schema: v })).toBe(0);
  });
  it('gültige Zahl bleibt', () => {
    expect(metaSchemaOf({ schema: 0 })).toBe(0);
    expect(metaSchemaOf({ schema: 1 })).toBe(1);
    expect(metaSchemaOf({ schema: 7 })).toBe(7);   // Stand einer neueren Version behält seine Zahl
  });
});
