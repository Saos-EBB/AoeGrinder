// Flavor 1 Höllenfeste: Diablo + Doom-Rot + WoW-Kompaktleiste (Mockups X1*, gen4.py M1/H1, gen5/gen6 m1*). Farben und Ornamente in hoellenfeste.css.

import type { Flavor } from '.';
import { DEFAULT_LAYOUT } from '../hud/presets';
import './hoellenfeste.css';

export const hoellenfeste: Flavor = {
  id: 'hoellenfeste',
  name: 'flavor.hoellenfeste.name',
  sub: 'flavor.hoellenfeste.sub',
  tokens: { bg: '#2e140d', frame: '#c9a24a', hp: '#a3140e', mana: '#1f4fbf', bar: '#c9a24a' },
  hud: DEFAULT_LAYOUT.elements,
  numbers: (kind, text) => text,
  messages: (line, sub) => `${line} ${sub}`,
  overlay: '<i class="fx-corner tl lite"></i><i class="fx-corner tr lite"></i><i class="fx-corner br lite"></i><i class="fx-corner bl lite"></i>'
    + '<i class="fx-smoke"></i><i class="fx-sparks lite"></i><i class="fx-chain a"></i><i class="fx-chain b"></i><i class="fx-chain c"></i>',
};
