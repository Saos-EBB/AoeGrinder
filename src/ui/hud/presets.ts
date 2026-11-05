// HUD-Presets: Lage jedes Elements in % vom Bildschirm (Mockups H01 … H19, gen.py). Elemente ohne Eintrag sind im Preset aus.
// Phase 4: nur H01 als heutiges Standard-Layout; die 8 Presets aus den Mockups folgen in Phase 6.

import type { HudPreset, HudElementId, Placement } from './layout';

export const PRESETS: HudPreset[] = [
  { id: 'H01', name: 'Klar', theme: 'clean', elements: {
    runinfo: { anchor: 't', x: 0, y: 0, scale: 1 },
    hp: { anchor: 'c', x: -10, y: 24, scale: 1 },
    mana: { anchor: 'c', x: 10, y: 24, scale: 1 },
    cast: { anchor: 'c', x: 0, y: 28, scale: 1 },
    hotbar: { anchor: 'b', x: 0, y: -1, scale: 1 },
    buffs: { anchor: 'tl', x: 1, y: 8, scale: 1 },
    relics: { anchor: 'r', x: -1, y: -10, scale: 1 },
    minimap: { anchor: 'tr', x: -1, y: 6, scale: 1 },
  } },
];

// Handy: Sticks und Tasten liegen unten in den Ecken, das HUD oben. Gilt über jedem Preset // PH
export const MOBILE: Partial<Record<HudElementId, Placement>> = {
  runinfo: { anchor: 't', x: 0, y: 0, scale: 0.8 },
  hp: { anchor: 'tl', x: 1, y: 11, scale: 0.9 },
  mana: { anchor: 'tl', x: 1, y: 19, scale: 0.9 },
  cast: { anchor: 'c', x: 0, y: 12, scale: 1 },
  hotbar: { anchor: 'b', x: 0, y: -1, scale: 0.6 },
  buffs: { anchor: 'tl', x: 1, y: 28, scale: 1 },
  relics: { anchor: 'tr', x: -9, y: 11, scale: 0.7 },
  minimap: { anchor: 'tr', x: -1, y: 11, scale: 0.6 },
};
