// Flavor 1 Höllenfeste: Diablo + Doom-Rot + WoW-Kompaktleiste (Mockups X1*, gen4.py M1/H1, gen5/gen6 m1*). Farben und Ornamente in hoellenfeste.css.

import type { Flavor } from '.';
import { pt, W, H, CX, MAP } from '../hud/presets';
import './hoellenfeste.css';

export const hoellenfeste: Flavor = {
  id: 'hoellenfeste',
  name: 'flavor.hoellenfeste.name',
  sub: 'flavor.hoellenfeste.sub',
  tokens: { bg: '#2e140d', frame: '#c9a24a', hp: '#a3140e', mana: '#1f4fbf', bar: '#c9a24a' },
  // gen4.py hud1: Kugeln links/rechts eines Panels unten, Kill-Anzeige darüber, XP unten, Rundkarte oben rechts + Zeit darunter, Combo oben Mitte
  hud: {
    hotbar: pt('b', CX, H, 1, 'panel'),
    hp: pt('tl', CX - 440, H - 150, 1, 'orb'),
    mana: pt('tl', CX + 300, H - 150, 1, 'orb'),
    killmeter: pt('l', CX - 208, H - 79),
    xp: pt('tl', CX - 270, H - 10),
    cast: pt('t', CX, 440),
    minimap: pt('tr', W - 26, 24, 150 / MAP, 'circle name'),
    timer: pt('t', W - 101, 206, 22 / 26, 'title'),
    runinfo: pt('t', W - 101, 232),
    combo: pt('t', CX, 60, 1, 'massaker'),
    buffs: pt('tl', 20, 20),
    relics: pt('tl', 24, 64, 38 / 40, 'diamond'),
    tracker: pt('tl', 20, 120),
    unitframe: { ...pt('tl', 16, 16), hidden: true },
    micro: { ...pt('br', W - 16, H - 8), hidden: true },
    compass: { ...pt('t', CX, 120, 520 / 600), hidden: true },
    splits: { ...pt('tr', W - 20, 290), hidden: true },
  },
  numbers: (kind, text) => text,
  messages: (line, sub) => `${line} ${sub}`,
  overlay: '<i class="fx-corner tl lite"></i><i class="fx-corner tr lite"></i><i class="fx-corner br lite"></i><i class="fx-corner bl lite"></i>'
    + '<i class="fx-smoke"></i><i class="fx-sparks lite"></i><i class="fx-chain a"></i><i class="fx-chain b"></i><i class="fx-chain c"></i>',
};
