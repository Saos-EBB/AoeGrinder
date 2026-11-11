// Eine Tabelle für die 6 spielbaren Figuren (Audit E7, NAME-01/33, DUP-05/06, KOMP-05). Ohne Spiel-Imports: Modelle, UI und Logik lesen hier.
// Gespeichert sind nur: Mod-ID (Runs, Rangliste, Splits, Hotbar-Store), Hotbar-Key 'normal' und die meta.skins-Keys magier/krieger (heroClass).
// Alle anderen IDs sind reiner Code und werden hier abgebildet, nicht an mehreren Stellen von Hand übersetzt.
// Farbe einer Figur: ELEMENTS[element].color (models/weapons/baukasten.ts, einzige Farbquelle). Zufall und Krieger haben kein Element.

export type FigureId = 'frost' | 'feuer' | 'blitz' | 'blut' | 'zufall' | 'krieger';
export type ElementId = 'frost' | 'feuer' | 'blitz' | 'seuche' | 'arkan';   // Keys von ELEMENTS (ohne none)
export type HeroClass = 'magier' | 'krieger';
export type DodgeMode = 'normal' | 'frost' | 'feuer' | 'krieger';

export interface Figure {
  id: FigureId;            // Spielmodell (mage.skin), nicht gespeichert
  mod: string | null;      // Mod-ID in MODIFIERS (gespeichert in Runs/Rangliste), null = ?-Magier (Modus normal)
  element: ElementId | null;
  tag: string | null;      // Spell-Tag = onlyTag der Mod ('Frost' …), Krieger 'Krieger'
  palette: string | null;  // Viewer-Skin der Strichmagier (strichMagier.ts ANIM/PAL), Krieger: eigenes Modell
  cls: string | null;      // Spell-Feld cls der Schule (spellCard SCHOOL_NAME, COLORS.school)
  set: string | null;      // Set-ID in gear.ts SETS = Skin-ID des Set-Skins
  heroClass: HeroClass;    // Klasse = Präfix der Skin-IDs (look.<klasse>.<id>.name) und Key in meta.skins
  hotbarKey: string;       // Key im Hotbar-Store, wenn nur die Figur gewählt ist (hotbar.ts figKey)
  dodge: DodgeMode;        // Kombo-Variante nach dem Dodge (dodge.ts)
}

const fig = (f: Figure) => f;
export const FIGURES: Record<FigureId, Figure> = {
  frost: fig({ id: 'frost', mod: 'frost', element: 'frost', tag: 'Frost', palette: 'ice', cls: 'frost', set: 'frost14', heroClass: 'magier', hotbarKey: 'frost', dodge: 'frost' }),
  feuer: fig({ id: 'feuer', mod: 'fire', element: 'feuer', tag: 'Feuer', palette: 'fire', cls: 'fire', set: 'glut', heroClass: 'magier', hotbarKey: 'fire', dodge: 'feuer' }),
  blitz: fig({ id: 'blitz', mod: 'blitz', element: 'blitz', tag: 'Blitz', palette: 'blitz', cls: 'lightning', set: 'blitz', heroClass: 'magier', hotbarKey: 'blitz', dodge: 'normal' }),
  blut: fig({ id: 'blut', mod: 'plague', element: 'seuche', tag: 'Seuche', palette: 'plague', cls: 'nature', set: 'seuche', heroClass: 'magier', hotbarKey: 'plague', dodge: 'normal' }),
  krieger: fig({ id: 'krieger', mod: 'realmen', element: null, tag: 'Krieger', palette: null, cls: null, set: null, heroClass: 'krieger', hotbarKey: 'realmen', dodge: 'krieger' }),
  zufall: fig({ id: 'zufall', mod: null, element: null, tag: null, palette: 'qm', cls: null, set: null, heroClass: 'magier', hotbarKey: 'normal', dodge: 'normal' }),   // ?-Magier „Der Leere“ (spells/random.ts)
};
// Reihenfolge beim Suchen über Mods (die Figuren-Mods schließen sich gegenseitig aus), ?-Magier zuletzt als Rückfall
export const FIGURE_LIST: Figure[] = [FIGURES.frost, FIGURES.feuer, FIGURES.blitz, FIGURES.blut, FIGURES.krieger, FIGURES.zufall];

// Nur im Modell/Viewer, nicht spielbar: 'alle' (Kevins Zuhälter-Look, im Menü nicht mehr wählbar), 'arkan' (Schule geparkt)
const MODEL_ONLY_PALETTE: Record<string, string> = { alle: 'base', arkan: 'arcane' };
// Spielmodell-ID → Viewer-Skin der Strichmagier, unbekannt = 'base'
export const paletteOf = (id: string): string => FIGURES[id as FigureId]?.palette ?? MODEL_ONLY_PALETTE[id] ?? 'base';

// Figur zu den aktiven Mod-IDs: die erste passende, sonst der ?-Magier
export const figureOfMods = (ids: readonly string[]): Figure => FIGURE_LIST.find(f => f.mod && ids.includes(f.mod)) ?? FIGURES.zufall;
export const figureOfSet = (setId: string): FigureId | null => FIGURE_LIST.find(f => f.set === setId)?.id ?? null;
export const elementOfFigure = (id: string | null): ElementId | null => FIGURES[id as FigureId]?.element ?? null;

// Spell-Tag bzw. Schule eines Waffenkopfs (HEADS) → Element. Arkan ist keine Figur, aber Element (Gegenstände)
const TAG_ELEMENT: Record<string, ElementId> = { ...Object.fromEntries(FIGURE_LIST.filter(f => f.element).map(f => [f.tag, f.element])), Arkan: 'arkan' };
export const elementOfTag = (tag: string | null | undefined): ElementId | null => (tag && TAG_ELEMENT[tag]) || null;
// Erstes Schul-Tag der Liste (Reihenfolge der Tags am Spell). Heute hat kein Spell zwei Schul-Tags
export const elementOfTags = (tags: readonly string[] | null | undefined): ElementId | null => {
  for (const tg of tags ?? []) { const e = elementOfTag(tg); if (e) return e; }
  return null;
};
