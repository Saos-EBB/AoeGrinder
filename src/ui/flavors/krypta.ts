// Flavor 3 Kompakt-Krypta: WoW-Kompakt + Diablo-Stein/Gold + Doom-Combo (Mockups X3*, gen4.py M3/H3, gen5/gen6 m3*). Farben und Ornamente in krypta.css.

import type { Flavor } from '.';
import { DEFAULT_LAYOUT } from '../hud/presets';
import './krypta.css';

export const krypta: Flavor = {
  id: 'krypta',
  name: 'flavor.krypta.name',
  sub: 'flavor.krypta.sub',
  tokens: { bg: '#1c1915', frame: '#b8963e', hp: '#c0262d', mana: '#1f5bd6', bar: '#b8963e' },
  hud: DEFAULT_LAYOUT.elements,
  numbers: (kind, text) => text,
  messages: (line, sub) => `${line} ${sub}`,
  overlay: '<i class="fx-vig lite"></i><i class="fx-corner tl lite"></i><i class="fx-corner tr lite"></i><i class="fx-corner br lite"></i><i class="fx-corner bl lite"></i>',
};
