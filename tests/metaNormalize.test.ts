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
    expect(m.wear).toEqual({ kopf: 1, hals: 4, ruecken: null, arme: null, koerper: null });   // hals folgt seinem Teil auf die neue Id 4
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
  it('doppelte Id über Slots: beide angelegten Teile bleiben angelegt, eine Säuberung reicht (E10-Fund behoben)', () => {
    const m: any = normalizeMeta(old());
    expect(m.gear.kopf[0].id).toBe(1);
    expect(m.gear.hals[0].id).toBe(4);
    expect(m.wear.kopf).toBe(1);
    expect(m.wear.hals).toBe(4);                          // wear folgt dem Teil auf die neue Id
    const once = structuredClone(m);
    expect(normalizeMeta(m)).toEqual(once);
  });
  it('doppelte Id im selben Slot und Id 0 angelegt: das angelegte Teil (erstes mit der Id, wie worn()) bleibt angelegt', () => {
    const a: any = old();
    a.gear = { kopf: [gear(2, 'kopf'), gear(2, 'kopf', { value: 'Leben' })], arme: [gear(0, 'arme')], hals: [gear(2, 'hals')] };
    a.wear = { kopf: 2, arme: 0, hals: 2 }; a.nextGear = 2;
    const m: any = normalizeMeta(a);
    expect(m.gear.kopf.map((g: any) => g.id)).toEqual([2, 3]);
    expect(m.wear.kopf).toBe(2);
    expect(m.gear.kopf.find((g: any) => g.id === m.wear.kopf).s.value).toBe('Schaden');
    expect(m.wear.arme).toBe(m.gear.arme[0].id);
    expect(m.wear.hals).toBe(m.gear.hals[0].id);
    expect(new Set(SLOTS.flatMap(s => m.gear[s]).map((g: any) => g.id)).size).toBe(4);
  });
  it('wiederholbar: normalize(normalize(x)) == normalize(x) für 300 zufällige kaputte Stände', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const of = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const IDS = [0, 1, 2, 3, 3, 7, -1, 2.5, 'x', null, undefined];
    const item = () => ({ id: of(IDS), v: of([1, 1, 2]), slot: of([...SLOTS, 'bein']), r: of([0, 3, 4, 5, 9]),
      s: { value: of(['Schaden', 'Leben', 'Quatsch', undefined]), maker: of(['stern', 'xx', undefined]), element: of(['feuer', 'gift', 'none', undefined]), ...(rnd() < 0.4 ? { focus: of(['nova', 'weg']) } : {}) } });
    const list = () => Array.from({ length: Math.floor(rnd() * 4) }, item);
    for (let k = 0; k < 300; k++) {
      const x: any = { ...old(), gear: Object.fromEntries(SLOTS.filter(() => rnd() < 0.8).map(s => [s, list()])),
        wear: Object.fromEntries(SLOTS.map(s => [s, of(IDS)])), gearOver: list(), nextGear: of([0, 2, 5, undefined, 'a']) };
      const once = structuredClone(normalizeMeta(x));
      expect(normalizeMeta(structuredClone(once))).toEqual(once);
      for (const s of SLOTS) if (once.wear[s] != null) expect(once.gear[s].filter((g: any) => g.id === once.wear[s])).toHaveLength(1);
      const ids = [...SLOTS.flatMap(s => once.gear[s]), ...once.gearOver].map((g: any) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
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
