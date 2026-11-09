// Flavor 2 Schlachtbank: Doom + WoW-Rundkarte + Diablo-Gold (Mockups X2*, gen4.py M2/H2, gen5/gen6 m2*). Farben und Ornamente in schlachtbank.css.

import type { Flavor } from '.';
import { pt, W, H, CX, MAP } from '../hud/presets';
import { t } from '../../i18n';
import './schlachtbank.css';

export const schlachtbank: Flavor = {
  id: 'schlachtbank',
  name: 'flavor.schlachtbank.name',
  sub: 'flavor.schlachtbank.sub',
  tokens: { bg: '#33070a', frame: '#ff3d1f', hp: '#e01e1e', mana: '#ff8a3c', bar: '#ff3d1f' },
  // gen4.py hud2: große Zahlen unten links/rechts mit dünnen Balken, Leiste 44 px unten Mitte, Rundkarte rot oben rechts, Relikte als Rauten daneben,
  // Zeit groß oben links, Combo als riesige Zahl rechts + MULTI
  hud: {
    hp: pt('bl', 28, H - 22, 1, 'bignum'),
    mana: pt('br', W - 28, H - 22, 1, 'bignum'),
    hotbar: pt('b', CX, H - 18),
    killmeter: pt('l', CX - 118, H - 80),
    xp: pt('t', CX, H - 15),
    cast: pt('t', CX, 440),
    minimap: pt('tr', W - 76, 20, 150 / MAP, 'circle name'),   // links der Zierrahmen-Ecke (--fg-safe), Relikte daneben
    relics: pt('tl', W - 282, 30, 1, 'diamond vertical'),
    timer: pt('tl', 24, 76, 40 / 26, 'big'),   // linke Spalte unter der Ecke
    runinfo: pt('tl', 26, 128, 15 / 14),
    combo: pt('tr', W - 30, 250, 1, 'doom'),
    buffs: pt('tl', 24, 158),
    tracker: pt('tl', 24, 198),
    unitframe: { ...pt('tl', 16, 16), hidden: true },
    micro: { ...pt('br', W - 16, H - 8), hidden: true },
    feats: pt('t', CX, 200),
    compass: { ...pt('t', CX, 14, 520 / 600), hidden: true },
    splits: { ...pt('tr', W - 20, 290), hidden: true },
  },
  // gen8.py NUMS['2']: Anton, Crit im roten Kasten schräg, Mega-Crit riesig „48.120!!“
  numbers: {
    text: (kind, n, count) => kind === 'mega' ? `${n}!!` : kind === 'merged' ? `${n} <span class="mx">×${count}</span>` : kind === 'heal' ? `+${n}` : kind === 'hurt' ? `−${n}` : n,
    size: { crit: 1.44, mega: 1.75 },   // PH: Verhältnis zur Trefferzahl im Mockup (32 px)
  },
  // gen8.py msg2: schräger roter Block + Zahl daneben, Mitte, leichtes Wackeln
  messages: (line, sub) => `<span class="fBlock">${line}</span>${sub ? `<span class="fSub">${sub}</span>` : ''}`,
  overlay: '<i class="fx-scan lite"></i><i class="fx-vig lite"></i><i class="fx-glitch"></i><i class="fx-hazard lite"></i>'
    + '<i class="fx-hazard bot lite hud"></i><i class="fx-corner tl lite"></i><i class="fx-corner tr lite"></i><i class="fx-corner br lite"></i><i class="fx-corner bl lite"></i>'
    + `<span class="fx-status a lite">${t('flavor.schlachtbank.status1')}</span><span class="fx-status b">${t('flavor.schlachtbank.status2')}</span><span class="fx-status c">${t('flavor.schlachtbank.status3')}</span>`,
};
