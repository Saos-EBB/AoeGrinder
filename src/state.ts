
export const state: any = {
  now: 0,                 // Spielzeit in ms (läuft nur, wenn nicht pausiert)
  paused: true,
  mobs: [],
  stormK: 0,            // Sandsturm, 0..1
  packCounter: 0,
  packDeaths: {},
  pendingLevelUps: 0,
  cardRanks: {},
  cardPicks: {},         // wie oft eine Karte gewählt wurde: Stufe und Build
  autorun: false,
  jumpQueued: false,
  rebinding: null,      // Aktion, die gerade neu belegt wird
  lastInput: 'key',     // 'key' oder 'pad', bestimmt die Tasten-Symbole
  padRebinding: null,   // dasselbe fürs Pad
  padAim: null,         // Blizzard-Zielpunkt am Pad, solange R1 gehalten ist
};

export const player: any = {};
