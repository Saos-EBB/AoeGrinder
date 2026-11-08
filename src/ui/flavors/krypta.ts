// Flavor 3 Kompakt-Krypta: WoW-Kompakt + Diablo-Stein/Gold + Doom-Combo (Mockups X3*, gen4.py M3/H3, gen5/gen6 m3*). Farben und Ornamente in krypta.css.

import type { Flavor } from '.';
import { pt, W, H, CX, MAP } from '../hud/presets';
import './krypta.css';

export const krypta: Flavor = {
  id: 'krypta',
  name: 'flavor.krypta.name',
  sub: 'flavor.krypta.sub',
  tokens: { bg: '#1c1915', frame: '#b8963e', hp: '#c0262d', mana: '#1f5bd6', bar: '#b8963e' },
  // gen4.py hud3: Spielerrahmen oben links (Portrait + Level-Abzeichen), Buffs darunter, Rundkarte mit Zonenname oben rechts, Zeit darunter,
  // Leiste 40 px im Steinpanel unten Mitte, XP darunter, Castbar + Kill-Anzeige darüber, Mikro-Menü + Taschen unten rechts, Doom-Combo rechts
  hud: {
    unitframe: pt('tl', 16, 16, 1, 'panel badge'),
    hp: pt('tl', 104, 104, 1, 'dotsonly'),
    mana: { ...pt('tl', 104, 116), hidden: true },
    buffs: pt('tl', 16, 116),
    minimap: pt('tr', W - 26, 40, 140 / MAP, 'circle nametop'),
    timer: pt('t', W - 96, 192, 20 / 26),
    runinfo: pt('t', W - 96, 216),
    relics: pt('tl', W - 256, 44, 34 / 40, 'diamond'),
    hotbar: pt('b', CX, H - 8, 1, 'panel'),
    xp: pt('t', CX, H - 7),
    cast: pt('t', CX, H - 110),
    killmeter: pt('l', CX - 88, H - 79),
    combo: pt('tr', W - 30, 270, 1, 'doom'),
    micro: pt('br', W - 16, H - 8),
    feats: pt('tr', W - 196, 16),
    tracker: pt('tl', 16, 156),
    compass: { ...pt('t', CX, 14, 520 / 600), hidden: true },
    splits: { ...pt('tr', W - 20, 290), hidden: true },
  },
  // gen8.py NUMS['3']: WoW-Art in Barlow, Crit groß weiß, Mega-Crit gelb, zusammengefasst „2.140 (6)“
  numbers: {
    text: (kind, n, count) => kind === 'merged' ? `${n} (${count})` : kind === 'heal' ? `+${n}` : kind === 'hurt' ? `-${n}` : n,
    size: { crit: 1.85, mega: 2.07 },   // PH: Verhältnis zur Trefferzahl im Mockup (28 px)
  },
  // gen8.py msg3: Erfolgs-Toast mit Stern-Medaillon, rechts oben, stapelt bis 3
  messages: (line, sub) => `<i class="fMedal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#2a1a08" stroke-width="2.4" stroke-linecap="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4 1.3 6L12 16.4 6.6 19.3l1.3-6-4.5-4 6-.7z"/></svg></i><span class="fText"><b>${line}</b>${sub ? `<small>${sub}</small>` : ''}</span>`,
  overlay: '<i class="fx-vig lite"></i><i class="fx-corner tl lite"></i><i class="fx-corner tr lite"></i><i class="fx-corner br lite"></i><i class="fx-corner bl lite"></i>',
};
