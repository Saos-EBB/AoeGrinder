// Eiszeit: orange Karte nur für Frost (config.ts CARDS iceage). Liegt dauerhaft passiv auf der Bewegungs-Taste und baut die Frost-Spells um (figures.ts iceAge).
import { t } from '../i18n';

export const iceage = {
  name: t('spell.iceage.name'), desc: t('spell.iceage.desc'),
  ranks: [], tags: ['Frost'], cls: 'frost', fixed: true, mana: 0, cd: 0,
  canCast: () => 'Passiv',
  effect() {},
};
