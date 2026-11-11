// Spell-Werte, die Formeln und Gear brauchen (ARCH-01): Faktoren je Spell, Runen, Supports, Radius.
// Ohne Rückimporte in spells/core.ts oder formulas.ts, damit formulas.ts nicht im Import-Kreis mit core hängt. core.ts reicht alles weiter.

import { state } from '../state';
import { mods, SPELLS } from '../config';
import { modValue } from '../modifiers';
import { SUPPORTS } from './supports';
import { t } from '../i18n';

export const hasTag = (id, tag) => SPELLS[id].tags.includes(tag);
// Faktoren je Spell aus Karten und Gear (dmg, mana, radius, cast …)
export const stat = id => state.spellStats[id] ??= { dmg: 1, mana: 1, radius: 1 };
// Arcane only läuft ohnehin beim Zaubern: Runen „Laufen erlaubt, halber Schaden“ werden dort zu +1 Ladung
const WALK_CHARGE = { name: t('rune.walkCharge.name'), desc: t('rune.walkCharge.desc') };
export const baseCharges = id => SPELLS[id].charges ?? (id === 'blink' ? modValue('blinkCharges') : undefined);   // Arcane only: Blink mit 2 Ladungen
export const runesOf = id => modValue('castWhileMoving') ? SPELLS[id].runes?.map(r => r.id === 'walk' ? { ...WALK_CHARGE, id: 'walk', charges: (baseCharges(id) ?? 1) + 1 } : r) : SPELLS[id].runes;
export const rune = id => runesOf(id)?.find(r => r.id === state.runes[id]);
export const hasRune = (id, runeId) => state.runes[id] === runeId;

export const supported = (key, id) => !!state.supports[key] && SUPPORTS.find(x => x.id === key).tags.some(t => hasTag(id, t));
export const echoCost = id => supported('echo', id) && !SPELLS[id].channel;
export const radiusMult = id => stat(id).radius * mods.radius * (supported('focus', id) ? 0.7 : 1) * (supported('wide', id) ? 1.3 : 1);
