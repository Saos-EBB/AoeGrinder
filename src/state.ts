
export const state: any = {
  now: 0,                 // Spielzeit in ms (läuft nur, wenn nicht pausiert)
  paused: true,
  mobs: [],
  packCounter: 0,
  pendingLevelUps: 0,
  cardRanks: {},
  autorun: false,
  jumpQueued: false,
  rebinding: null,      // Aktion, die gerade neu belegt wird
  padAim: null,         // Blizzard-Zielpunkt am Pad, solange R1 gehalten ist
};

export const player: any = {};
