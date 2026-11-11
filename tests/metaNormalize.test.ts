// metaNormalize.ts: die ganze Säuberung beim Start und beim Spielstand-Code, mit den echten Tabellen (gear/rules.ts).
// Seit E10 ohne weaponRolls/world/render ladbar; meta.ts und baukasten.ts brauchen den Browser-Ersatz.
import './setup/browserStub';
import { describe, it, expect, beforeAll } from 'vitest';
import { normalizeMeta } from '../src/metaNormalize';
import { META_SCHEMA } from '../src/storage';
import { SPELLS } from '../src/spells/registry';
import { SLOTS } from '../src/gear/data';

beforeAll(() => { SPELLS.nova ??= { name: 'Frost Nova', tags: ['Frost'] }; });   // die Registry füllt im Spiel spells/index.ts
const gear = (id: number, slot: string, s: Record<string, unknown> = {}) => ({ id, v: 1, slot, r: 4, s: { value: 'Schaden', maker: 'stern', element: 'feuer', ...s } });
// Stand wie aus einem alten Browser: alte Elemente, kaputte Zähler, unbekannte Skins/Erfolge/Maps, doppelte Gear-Ids
const old = () => ({
  dust: 500, unlocked: ['frostNova'], bought: { a: 1 }, equipped: 1,
  inv: [{ id: 1, v: 2, r: 3, s: { seed: 1, rarity: 3, type: 'relic', maker: 'xx', head: 'kristall', shaft: 'gerade', value: 'Schaden', focus: 'discharge', element: 'gift', extra: 'none', value2: 'Leben', fv: 1 } }],
  skins: { magier: 'glut', zzz: 'a' }, achievements: ['set:glut', 'boss1', 'quatsch'], stats: { kills: 12.7, dust: '40' }, maps: ['wueste', 'xyz'],
  gear: { kopf: [gear(1, 'kopf', { focus: 'nova' })], hals: [gear(1, 'hals')], arme: [gear(0, 'arme', { element: 'gift' })] }, wear: { kopf: 1, hals: 1, ruecken: 5 },
  gearOver: [], nextGear: 3, looks: ['pappkrone', 'weg'], lookWear: { kopf: 'pappkrone' },
});

describe('normalizeMeta', () => {
  it('alter Stand: Waffen, Skins, Zähler, Maps, Gear, Ids und Schema in einem Durchgang', () => {
    const m: any = normalizeMeta(old());
    expect(m.inv[0].s.element).toBe('seuche');
    expect(m.inv[0].s.maker).not.toBe('xx');
    expect(m.achievements).not.toContain('quatsch');
    expect(m.skins).not.toHaveProperty('zzz');
    expect(m.maps).toEqual(['wald', 'wueste']);
    expect(m.gear.kopf[0].s.focus).toBe('nova');
    expect(m.gear.arme[0].s.element).toBe('none');
    expect(SLOTS.flatMap(s => m.gear[s]).map((g: any) => g.id)).toEqual([1, 4, 5]);   // doppelte Id 1 und Id 0 neu vergeben
    expect(m.nextGear).toBe(5);
    expect(m.wear).toEqual({ kopf: 1, hals: 1, ruecken: null, arme: null, koerper: null });   // hals zeigt noch auf Id 1 (vor dem Neu-Vergeben gesäubert)
    expect(m.looks).toEqual(['pappkrone']);
    expect(m.lookWear.kopf).toBe('pappkrone');
    expect(m.schema).toBe(META_SCHEMA);
  });
  it('gibt dasselbe Objekt zurück, zweimal säubern = einmal (ohne doppelte Ids)', () => {
    const a: any = old(); a.gear.hals[0].id = 2;
    const m = normalizeMeta(a);
    expect(m).toBe(a);
    const once = structuredClone(m);
    expect(normalizeMeta(m)).toEqual(once);
  });
  it('Ist-Stand, kein Fix (E10-Fund): doppelte Id über Slots, angelegtes Teil bekommt neue Id, wear zeigt noch auf die alte', () => {
    const m: any = normalizeMeta(old());
    expect(m.gear.hals[0].id).toBe(4);
    expect(m.wear.hals).toBe(1);                          // zeigt ins Leere: worn('hals') findet nichts, das Teil gilt als abgelegt
    expect(normalizeMeta(m).wear.hals).toBe(null);        // erst die zweite Säuberung räumt den Verweis weg
  });
  it('leerer Stand lädt', () => {
    const m: any = normalizeMeta({});
    expect(m.inv).toEqual([]);
    expect(m.maps).toEqual(['wald']);
    expect(m.gear).toEqual(Object.fromEntries(SLOTS.map(s => [s, []])));
    expect(m.schema).toBe(META_SCHEMA);
  });
  it('kaputtes Gear-Feld fällt nur selbst auf Standard, der Rest bleibt', () => {
    const a: any = old(); a.gear = { get kopf() { throw new Error('kaputt'); } };
    const warn = console.warn; console.warn = () => {};
    const m: any = normalizeMeta(a);
    console.warn = warn;
    expect(m.gear).toEqual(Object.fromEntries(SLOTS.map(s => [s, []])));
    expect(m.wear).toEqual(Object.fromEntries(SLOTS.map(s => [s, null])));
    expect(m.looks).toEqual([]);
    expect(m.nextGear).toBe(3);
    expect(m.maps).toEqual(['wald', 'wueste']);
    expect(m.inv[0].s.element).toBe('seuche');
  });
  it('neueres Schema bleibt stehen', () => {
    expect(normalizeMeta({ schema: META_SCHEMA + 3 }).schema).toBe(META_SCHEMA + 3);
  });
});
