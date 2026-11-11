// Regeln fürs Säubern (clean.ts): die echten Tabellen aus den anderen Modulen. Zieht weder weaponRolls.ts noch render.ts,
// lädt in Node mit tests/setup/browserStub.ts (baukasten.ts: Canvas, i18n: document).

import { VALUE_KEY } from '../rollTables';
import { MAKERS, ELEMENTS } from '../models/weapons/baukasten';
import { SPELLS } from '../spells/registry';
import { CARD_RARITIES } from '../config';
import { pick } from '../util';
import { SETS } from './sets';
import { cleanGearWith, type CleanRules } from './clean';

export const gearRules = (): CleanRules => ({ values: VALUE_KEY, makers: MAKERS, elements: ELEMENTS, spells: SPELLS, sets: SETS, rarities: CARD_RARITIES.length, pick });
// Säubern mit den echten Tabellen (metaNormalize.ts)
export const cleanGear = (m: any) => cleanGearWith(m, gearRules());
