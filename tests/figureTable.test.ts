// Die Figuren-Tabelle (src/figureTable.ts) ergibt dieselben Werte wie die Übersetzungstabellen vor E7 (hier als Literale festgehalten).
import { describe, it, expect } from 'vitest';
import { FIGURES, FIGURE_LIST, figureOfMods, figureOfSet, paletteOf, elementOfTag, elementOfTags } from '../src/figureTable';

// Stand vor E7 (6378962)
const OLD = {
  SKIN_OF: { alle: 'base', feuer: 'fire', frost: 'ice', arkan: 'arcane', zufall: 'qm', blitz: 'blitz', blut: 'plague' },   // strichMagier.ts
  SCHOOL_TAG: { frost: 'Frost', feuer: 'Feuer', blitz: 'Blitz', blut: 'Seuche' },   // gear.ts
  SCHOOL_OF_TAG: { Frost: 'frost', Feuer: 'feuer', Blitz: 'blitz', Seuche: 'seuche' },   // gearParts.ts
  TAG_EL: [['Feuer', 'feuer'], ['Frost', 'frost'], ['Blitz', 'blitz'], ['Seuche', 'seuche']],   // objects.ts
  SCHOOL_COL_KEYS: ['base', 'fire', 'ice', 'arcane', 'qm', 'blitz', 'plague'],   // kosmetikParts.ts
  SCHOOL_COL_EL: { fire: 'feuer', ice: 'frost', blitz: 'blitz', plague: 'seuche' },
  FOCUS_COL_KEYS: ['frost', 'feuer', 'blitz', 'seuche'],   // gearParts.ts
  SETS_SCHOOL: { glut: 'feuer', blitz: 'blitz', seuche: 'blut', frost14: 'frost' },   // gear.ts SETS[*].school
  skinForRun: (ids: string[]) => ids.includes('frost') ? 'frost' : ids.includes('fire') ? 'feuer' : ids.includes('blitz') ? 'blitz' : ids.includes('plague') ? 'blut' : ids.includes('realmen') ? 'krieger' : 'zufall',
  dodgeMode: (ids: string[]) => ids.includes('fire') ? 'feuer' : ids.includes('frost') ? 'frost' : ids.includes('realmen') ? 'krieger' : 'normal',
  onlyTag: { frost: 'Frost', fire: 'Feuer', blitz: 'Blitz', plague: 'Seuche', realmen: 'Krieger' },   // modifiers.ts
  heads: ['Frost', 'Feuer', 'Blitz', 'Seuche', 'Arkan'],   // HEADS-Schulen, heroWindow schoolKey = toLowerCase
};
const MOD_SETS = [[], ['frost'], ['fire'], ['blitz'], ['plague'], ['realmen'], ['half'], ['fire', 'half'], ['plague', 'time', 'big'], ['realmen', 'classic'], ['nodrink', 'frost']];

describe('figureTable', () => {
  it('Viewer-Skin (SKIN_OF)', () => {
    for (const [id, pal] of Object.entries(OLD.SKIN_OF)) expect(paletteOf(id)).toBe(pal);
    expect(paletteOf('krieger')).toBe('base');
    expect(paletteOf('xyz')).toBe('base');
  });
  it('Schul-Tag des Magiers (SCHOOL_TAG)', () => {
    for (const f of FIGURE_LIST) expect(f.element ? f.tag : undefined).toBe(OLD.SCHOOL_TAG[f.id]);
  });
  it('Tag → Element (SCHOOL_OF_TAG, TAG_EL, HEADS)', () => {
    for (const [tag, el] of Object.entries(OLD.SCHOOL_OF_TAG)) expect(elementOfTag(tag)).toBe(el);
    for (const [tag, el] of OLD.TAG_EL) expect(elementOfTags([tag, 'Fläche'])).toBe(el);
    for (const h of OLD.heads) expect(elementOfTag(h)).toBe(h.toLowerCase());
    expect(elementOfTags(['Krieger', 'Nahkampf'])).toBe(null);
    expect(elementOfTags(undefined)).toBe(null);
  });
  it('Farb-Keys (SCHOOL_COL, FOCUS_COL)', () => {
    const pal = Object.fromEntries(FIGURE_LIST.filter(f => f.element && f.palette).map(f => [f.palette, f.element]));
    expect(pal).toEqual(OLD.SCHOOL_COL_EL);
    expect([...new Set(['base', 'qm', 'arcane', ...Object.keys(pal)])].sort()).toEqual([...OLD.SCHOOL_COL_KEYS].sort());
    expect(FIGURE_LIST.filter(f => f.element).map(f => f.element).sort()).toEqual([...OLD.FOCUS_COL_KEYS].sort());
  });
  it('Sets (SETS.school, setOfSchool)', () => {
    for (const [set, school] of Object.entries(OLD.SETS_SCHOOL)) { expect(figureOfSet(set)).toBe(school); expect(FIGURES[school].set).toBe(set); }
    expect(FIGURES.zufall.set).toBe(null); expect(FIGURES.krieger.set).toBe(null);
  });
  it('Figur aus Mods (skinForRun), Dodge-Modus, onlyTag, Hotbar-Key', () => {
    for (const ids of MOD_SETS) {
      const f = figureOfMods(ids);
      expect(f.id).toBe(OLD.skinForRun(ids));
      expect(f.dodge).toBe(OLD.dodgeMode(ids));
      expect(f.tag ?? undefined).toBe(ids.map(i => OLD.onlyTag[i]).find(Boolean));
      expect(f.heroClass === 'krieger').toBe(ids.includes('realmen'));
      if (ids.length === 1 && f.mod) expect(f.hotbarKey).toBe(ids[0]);
    }
    expect(FIGURES.zufall.hotbarKey).toBe('normal');
  });
});
