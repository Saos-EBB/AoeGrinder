// gear/clean.ts: Säubern des gespeicherten Gears (alte Spielstände und Spielstand-Codes müssen weiter laden).
// Ohne Browser-Ersatz: clean.ts zieht weder three noch DOM (E10, ARCH-06). Die Regeln sind hier klein und fest, das Würfeln nimmt immer das erste.
import { describe, it, expect } from 'vitest';
import { cleanGearWith, resetMigrated, migratedCount, type CleanRules } from '../src/gear/clean';
import { SLOTS } from '../src/gear/data';

const R: CleanRules = {
  values: { Schaden: 'dmg', Leben: 'hp' }, makers: { grab: {}, stern: {} }, elements: { none: {}, frost: {}, feuer: {} },
  spells: { nova: {}, blink: {} }, sets: { glut: {} }, rarities: 6, pick: <T>(a: T[]) => a[0],
};
const item = (id: number, slot: string, s: Record<string, unknown> = {}, r = 3) => ({ id, v: 1, slot, r, s: { value: 'Schaden', maker: 'stern', element: 'frost', ...s } });
const clean = (m: any) => { cleanGearWith(m, R); return m; };

describe('cleanGearWith', () => {
  it('leerer Stand: alle Slots leer, nichts angelegt, Zähler 0', () => {
    const m = clean({});
    expect(m.gear).toEqual(Object.fromEntries(SLOTS.map(s => [s, []])));
    expect(m.wear).toEqual(Object.fromEntries(SLOTS.map(s => [s, null])));
    expect(m.gearOver).toEqual([]);
    expect(m.looks).toEqual([]);
    expect(m.lookWear).toEqual({ kopf: null, hals: null, ruecken: null, arme: null, koerper: null, waffe: null });
    expect(m.nextGear).toBe(0);
  });
  it('gültiges Teil bleibt gleich, angelegt bleibt angelegt', () => {
    const g = item(4, 'kopf', { focus: 'nova', setId: 'glut' });
    const m = clean({ gear: { kopf: [structuredClone(g)] }, wear: { kopf: 4 }, nextGear: 4 });
    expect(m.gear.kopf).toEqual([g]);
    expect(m.wear.kopf).toBe(4);
  });
  it('kaputte Teile fallen weg: Seltenheit, Slot, fehlende Schichten, weder Wert noch Fokus', () => {
    const m = clean({ gear: { kopf: [item(1, 'kopf', {}, 6), item(2, 'kopf', {}, -1), item(3, 'kopf', {}, 1.5), item(4, 'hals'), { id: 5, r: 3, slot: 'kopf' }, null, 'x',
      item(6, 'kopf', { value: 'quatsch', focus: 'weg' })] } });
    expect(m.gear.kopf).toEqual([]);
  });
  it('unbekannter Slot im Feld gear fällt weg, Slot ohne Feld wird gesetzt', () => {
    const g = item(1, 'arme'); delete (g as any).slot;
    const m = clean({ gear: { arme: [g], schuhe: [item(2, 'schuhe')] } });
    expect(m.gear.arme[0].slot).toBe('arme');
    expect(m.gear.schuhe).toBeUndefined();
  });
  it('alter Stand (vor v36): nur Fokus → Wert gewürfelt, ohne Hersteller → Hersteller gewürfelt, Zähler für initGear', () => {
    resetMigrated();
    const m = clean({ gear: { hals: [item(1, 'hals', { value: undefined, maker: 'niemand', focus: 'nova' })] } });
    expect(m.gear.hals[0].s).toEqual({ value: 'Schaden', maker: 'grab', element: 'frost', focus: 'nova' });
    expect(migratedCount()).toBe(2);
    resetMigrated();
    expect(migratedCount()).toBe(0);
  });
  it('tote Verweise: unbekannter Fokus, unbekanntes Set weg, unbekanntes Element → none, v → 1, Id fehlt → 0', () => {
    const g: any = item(1, 'ruecken', { focus: 'weg', setId: 'weg', element: 'gift' }); g.v = 2; delete g.id;
    const m = clean({ gear: { ruecken: [g] } });
    expect(m.gear.ruecken[0]).toEqual({ id: 0, v: 1, slot: 'ruecken', r: 3, s: { value: 'Schaden', maker: 'stern', element: 'none' } });
  });
  it('angelegt auf ein fehlendes Teil → null', () => {
    const m = clean({ gear: { kopf: [item(1, 'kopf')] }, wear: { kopf: 9, hals: 1 } });
    expect(m.wear).toMatchObject({ kopf: null, hals: null });
  });
  it('Kosmetik: nur bekannte Looks, getragen nur im eigenen Slot und nur mit Besitz (Box oder Meilenstein-Erfolg)', () => {
    const m = clean({ looks: ['fischglas', 'weg', 'kuh'], achievements: ['boss1'],
      lookWear: { kopf: 'pappkrone', hals: 'fischglas', koerper: 'kuh', arme: 'handschellen', waffe: 'haarspray' } });
    expect(m.looks).toEqual(['fischglas', 'kuh']);
    expect(m.lookWear).toEqual({ kopf: 'pappkrone', hals: null, ruecken: null, arme: null, koerper: 'kuh', waffe: null });
  });
  it('gearOver: nur bekannte Slots und gültige Teile, Zähler = größte Id aus allem', () => {
    const m = clean({ gear: { kopf: [item(3, 'kopf')] }, gearOver: [item(7, 'hals'), item(8, 'schuhe'), item(9, 'arme', {}, 9)], nextGear: 2 });
    expect(m.gearOver.map((g: any) => g.id)).toEqual([7]);
    expect(m.nextGear).toBe(7);
    expect(clean({ nextGear: 12 }).nextGear).toBe(12);
    expect(clean({ nextGear: 'x' }).nextGear).toBe(0);
  });
  it('zweimal säubern = einmal', () => {
    const m = clean({ gear: { kopf: [item(1, 'kopf', { element: 'quatsch' })], hals: 'x' }, wear: { kopf: 1 }, looks: ['kuh'], lookWear: { koerper: 'kuh' }, gearOver: [item(2, 'arme')] });
    const once = structuredClone(m);
    expect(clean(m)).toEqual(once);
  });
});
