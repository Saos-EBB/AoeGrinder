// Flavor 2 Schlachtbank: Doom + WoW-Rundkarte + Diablo-Gold (Mockups X2*, gen4.py M2/H2, gen5/gen6 m2*). Farben und Ornamente in schlachtbank.css.

import type { Flavor } from '.';
import { DEFAULT_LAYOUT } from '../hud/presets';
import { t } from '../../i18n';
import './schlachtbank.css';

export const schlachtbank: Flavor = {
  id: 'schlachtbank',
  name: 'flavor.schlachtbank.name',
  sub: 'flavor.schlachtbank.sub',
  tokens: { bg: '#33070a', frame: '#ff3d1f', hp: '#e01e1e', mana: '#ff8a3c', bar: '#ff3d1f' },
  hud: DEFAULT_LAYOUT.elements,
  numbers: (kind, text) => text,
  messages: (line, sub) => `${line} ${sub}`,
  overlay: '<i class="fx-scan lite"></i><i class="fx-vig lite"></i><i class="fx-glitch"></i><i class="fx-hazard lite"></i>'
    + '<i class="fx-corner tl lite"></i><i class="fx-corner tr lite"></i><i class="fx-corner br lite"></i><i class="fx-corner bl lite"></i>'
    + `<span class="fx-status a lite">${t('flavor.schlachtbank.status1')}</span><span class="fx-status b">${t('flavor.schlachtbank.status2')}</span><span class="fx-status c">${t('flavor.schlachtbank.status3')}</span>`,
};
