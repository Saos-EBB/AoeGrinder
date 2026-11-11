// meta.ts: Reparieren beim Laden (alte Spielstände und Spielstand-Codes müssen weiter laden).
// meta.ts lädt über baukasten.ts Canvas-Texturen und über config → i18n das document, deshalb der Browser-Ersatz zuerst.
import './setup/browserStub';
import { describe, it, expect } from 'vitest';
import { fixWeapon, cleanStats } from '../src/meta';
import { TYPES, MAKERS } from '../src/models/weapons/baukasten';

const weapon = (s: Record<string, unknown>) => ({ id: 1, r: 2, s: { type: 'staff', maker: 'grab', element: 'frost', head: 'frostorb', ...s } });

describe('fixWeapon', () => {
  it('gültige Waffe bleibt gleich', () => {
    const w = weapon({});
    expect(fixWeapon(structuredClone(w))).toEqual(w);
  });
  it('gibt dasselbe Objekt zurück (repariert an Ort und Stelle)', () => {
    const w = weapon({ element: 'gift' });
    expect(fixWeapon(w)).toBe(w);
  });
  it('alte Elemente: Gift/Blut → Seuche, Void/Dunkel → Arkan, Unbekanntes → none', () => {
    const el = (e: string) => fixWeapon(weapon({ element: e })).s.element;
    expect(el('gift')).toBe('seuche');
    expect(el('blut')).toBe('seuche');
    expect(el('void')).toBe('arkan');
    expect(el('dunkel')).toBe('arkan');
    expect(el('quatsch')).toBe('none');
    expect(el(undefined as any)).toBe('none');
  });
  it('unbekannter Typ → staff, unbekannter Hersteller → erster Hersteller', () => {
    const w = fixWeapon(weapon({ type: 'axt', maker: 'niemand' }));
    expect(w.s.type).toBe('staff');
    expect(w.s.maker).toBe(Object.keys(MAKERS)[0]);
  });
  it('alte Köpfe nach Schule, unbekannte → erster Kopf des Typs', () => {
    const head = (h: string) => fixWeapon(weapon({ head: h })).s.head;
    expect(head('kristall')).toBe('frostorb');
    expect(head('laterne')).toBe('glutschaedel');
    expect(head('klaue')).toBe('dreizack');
    expect(head('gabel')).toBe('spulen');
    expect(head('schaedel')).toBe('auge');
    expect(head('quatsch')).toBe(TYPES.staff.heads[0]);
  });
  it('ohne s oder null: nie crashen, unverändert zurück', () => {
    expect(fixWeapon(null)).toBe(null);
    expect(fixWeapon(undefined)).toBe(undefined);
    const w = { id: 3 };
    expect(fixWeapon(w)).toBe(w);
  });
});

describe('cleanStats', () => {
  it('fehlt → Nullen', () => {
    expect(cleanStats(null)).toEqual({ kills: 0, dust: 0 });
    expect(cleanStats(undefined)).toEqual({ kills: 0, dust: 0 });
    expect(cleanStats({})).toEqual({ kills: 0, dust: 0 });
  });
  it('ganzzahlig, nicht negativ, Text-Zahlen gehen', () => {
    expect(cleanStats({ kills: 12.9, dust: '40' })).toEqual({ kills: 12, dust: 40 });
    expect(cleanStats({ kills: -5, dust: 'abc' })).toEqual({ kills: 0, dust: 0 });
    expect(cleanStats({ kills: NaN, dust: null })).toEqual({ kills: 0, dust: 0 });
  });
  it('Infinity bleibt heute Infinity (Ist-Stand; in JSON wird daraus null, beim nächsten Laden 0)', () => {
    expect(cleanStats({ dust: Infinity }).dust).toBe(Infinity);
  });
  it('nur kills und dust, Fremdes fällt weg', () => {
    expect(cleanStats({ kills: 3, dust: 4, extra: 1 })).toEqual({ kills: 3, dust: 4 });
  });
});
