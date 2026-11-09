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
  wald: {
    normal:   ['h', { scale: .7, ink: 0x2c3a22, ac: 0x5f9a30, gl: 0xffe060, head: 1.4, tufts: true }],                       // Moosling
    schnell:  ['q', { ink: 0x2e2a22, ac: 0x4f8a2a, gl: 0x9cff60, lean: true, spikes: true }],                               // Dornwolf
    stark:    ['q', { ink: 0x33241a, ac: 0xeee2c8, gl: 0xff5030, heavy: true, tusks: true }],                               // Hauerbulle
    aoe:      ['h', { ink: 0x3a2c1e, ac: 0x4f8a2a, gl: 0xb0ff60, armLen: 1.5, legLen: 1.1, claws: true, leaves: true }],     // Wirbelschrat
    zauberer: ['h', { ink: 0x22302a, ac: 0x3f6a52, gl: 0x60fff0, robe: true, hood: true, weapon: 'orb' }],                  // Irrlichtrufer
    werfer:   ['h', { ink: 0x3a2c1e, ac: 0x6a5236, gl: 0xd0ff60, weapon: 'rock' }],                                         // Wurzelschleuderer
    hexer:    ['h', { ink: 0x2a2230, ac: 0x5a3f72, gl: 0xc070ff, robe: true, hat: 'point', hunch: .35, weapon: 'staff' }],   // Waldhexe
    gross:    ['h', { scale: 2.3, ink: 0x2f3a24, ac: 0x5f9a30, gl: 0xffd040, fat: 1.7, weapon: 'club', tufts: true }],       // Moos-Oger
    lauerer:  null,
  },
  wueste: {
    normal:   ['k', { ink: 0x4a3820, ac: 0xc8a060, gl: 0xffd080 }],                                                         // Sandschlurfer
    schnell:  ['h', { ink: 0x3a2a1c, ac: 0xe2d4b0, gl: 0xffd080, thin: .85, wrap: true, weapon: 'sword' }],                 // Wüstenräuber
    stark:    ['h', { ink: 0x5a5040, ac: 0xe2d8b8, gl: 0x60a0ff, bandage: true, weapon: 'axe', legLen: 1.1 }],              // Grabwächter
    aoe:      ['h', { ink: 0x3a2a1c, ac: 0xc87a4a, gl: 0xffc040, robe: true, wrap: true, armLen: 1.3, weapon: 'blades' }],  // Sandwirbler
    zauberer: ['h', { ink: 0x3a2418, ac: 0x9a3b2a, gl: 0xffa030, robe: true, hat: 'tall', hatC: 0xe2b13c, weapon: 'staff' }],   // Sandpriester
    werfer:   ['h', { ink: 0x3a2a1c, ac: 0xd8c090, gl: 0xffd080, thin: .9, wrap: true, weapon: 'spear' }],                  // Speerwerfer
    hexer:    ['h', { ink: 0x1e1a14, ac: 0xe2b13c, gl: 0x60ffb0, robe: true, snout: true, ears: true, weapon: 'staff' }],    // Grabhexer
    gross:    ['h', { scale: 2.5, ink: 0x5a4630, ac: 0xc8a060, gl: 0xffe0a0, fat: 1.4, weapon: 'club', cracks: true, crackC: 0xffd080 }],   // Sandriese
    lauerer:  null,
  },
  kanaele: {
    normal:   ['q', { ink: 0x2a2622, ac: 0xc08a80, gl: 0xff3030, small: true }],                                           // Kanalratte
    schnell:  ['q', { ink: 0x1e2a24, ac: 0x4a7a5e, gl: 0xe0ff60, low: true, long: true, spikes: true }],                    // Rohrkriecher
    stark:    ['h', { ink: 0x2a301a, ac: 0x6a7a24, gl: 0xd0ff40, fat: 1.6, drip: true, weapon: 'cleaver' }],                // Schlammschlurfer
    aoe:      ['h', { scale: 1.25, ink: 0x262a1a, ac: 0x6a7a24, gl: 0xd0ff40, fat: 1.5, drip: true, weapon: 'flail' }],     // Kloakenkoloss
    zauberer: ['h', { ink: 0x1e2a1e, ac: 0x3e5a34, gl: 0x80ff40, robe: true, hood: true, weapon: 'orb' }],                  // Kloakenhexer
    werfer:   ['h', { ink: 0x2a2a1c, ac: 0x6a7a24, gl: 0xd0ff40, hunch: .4, weapon: 'blob' }],                             // Unratwerfer
    hexer:    ['h', { ink: 0x1a2622, ac: 0x34524a, gl: 0x80ff60, robe: true, hood: true, hunch: .45, weapon: 'lantern' }],  // Brackhexer
    gross:    ['h', { scale: 2.3, ink: 0x2a2c1a, ac: 0x6a7a24, gl: 0xffd040, fat: 1.8, drip: true, weapon: 'cleaver' }],    // Kloakenoger
    lauerer:  ['h', { ink: 0x8a9488, ac: 0x5a6458, thin: .6, armLen: 1.8, legLen: 1.35, faceless: true, hunch: .25, jerky: true }],   // Schachtlauerer
  },
  // Horror-Look (Berserk/Silent Hill): zu lange Glieder, Gesichter ohne Augen, ruckartig
  kathedrale: {
    normal:   ['h', { ink: 0xd8ceb0, ac: 0x2e2628, gl: 0xff3020, bones: true, robe: true, hood: true }],                    // Knochen-Novize
    schnell:  ['b', { ink: 0x55524e, ac: 0x3a3836, gl: 0xff6030, horns: true }],                                            // Wasserspeier
    stark:    ['h', { scale: 1.3, ink: 0x2a2224, ac: 0x1a1214, fat: 1.3, hood: 'point', faceless: true, weapon: 'axe', bigWeapon: true }],   // Henker
    aoe:      ['h', { ink: 0xc8b8a8, ac: 0x4a3a34, thin: .75, hunch: .3, armLen: 1.25, faceless: true, jerky: true, weapon: 'whip' }],     // Geißler
    zauberer: ['h', { ink: 0xd8dcf0, ac: 0xb8bce0, gl: 0x9fb0ff, robe: true, float: true, ghost: true, mouth: true, faceless: true }],   // Chorgeist
    werfer:   ['h', { ink: 0xd8ceb0, ac: 0x8a7e64, gl: 0xff3020, bones: true, weapon: 'bone' }],                            // Knochenwerfer
    hexer:    ['h', { ink: 0x1e1e2a, ac: 0x3a3a52, gl: 0x9fb0ff, robe: true, hood: true, weapon: 'censer' }],               // Bußhexer
    gross:    ['h', { scale: 2.5, ink: 0x2a2220, ac: 0x9a7a3a, armLen: 1.35, bell: true, jerky: true, weapon: 'hammer' }],  // Glockenriese
    lauerer:  ['h', { ink: 0x141416, ac: 0xe8e0d8, thin: .6, armLen: 1.7, legLen: 1.4, faceless: true, paleHead: true, robe: true, jerky: true }],   // Ohnegesicht
  },
};
