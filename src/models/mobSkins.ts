// Skins der Mob-Kategorien pro Theme (Vorlage docs/ref/mob-viewer.html, Block SKINS). Bauart: h Mensch, q Vierbeiner, b Flieger, k Käfer.
// ink = Körper (dunkel), ac = Kleidung/Merkmal, gl = Leuchten (Augen, Magie). Name kommt aus i18n: mob.<theme>_<kategorie>.name
// Fehlt ein Eintrag (null), gibt es die Kategorie im Theme nicht (Lauerer erst ab Kanäle). Alles // PH

export type SkinDef = [kind: 'h' | 'q' | 'b' | 'k', opts: any] | null;

// Test-Skin: ein Strichmensch pro Kategorie, Akzentfarbe zeigt die Kategorie. Für Dev und Themes ohne eigene Skins
export const TEST_SKINS: Record<string, SkinDef> = {
  normal:   ['h', { ink: 0x2b2b33, ac: 0x8a8a8a, gl: 0xffe060 }],
  schnell:  ['h', { ink: 0x2b2b33, ac: 0x40c0ff, gl: 0x9cff60, thin: .85, weapon: 'sword' }],
  stark:    ['h', { ink: 0x2b2b33, ac: 0xc04030, gl: 0xff5030, fat: 1.5, weapon: 'club' }],
  aoe:      ['h', { ink: 0x2b2b33, ac: 0xe08a20, gl: 0xffc040, armLen: 1.3, weapon: 'blades' }],
  zauberer: ['h', { ink: 0x2b2b33, ac: 0x3f6aa2, gl: 0x60c0ff, robe: true, hood: true, weapon: 'orb' }],
  werfer:   ['h', { ink: 0x2b2b33, ac: 0x6a5236, gl: 0xd0ff60, weapon: 'rock' }],
  hexer:    ['h', { ink: 0x2b2b33, ac: 0x5a3f72, gl: 0xc070ff, robe: true, hat: 'point', hunch: .35, weapon: 'staff' }],
  gross:    ['h', { ink: 0x2b2b33, ac: 0x8a8a8a, gl: 0xffd040, scale: 2.3, fat: 1.6, weapon: 'club' }],
  lauerer:  ['h', { ink: 0x8a9488, ac: 0x5a6458, thin: .6, armLen: 1.8, legLen: 1.35, faceless: true, hunch: .25, jerky: true }],
};

export const SKINS: Record<string, Record<string, SkinDef>> = {
};
