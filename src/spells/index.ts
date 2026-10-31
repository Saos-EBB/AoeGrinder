// Registrierung aller Spells. Die anderen Module importieren weiter aus './spells'.

import { SPELLS, SPELL_ACTIONS } from '../config';
import { resetSpells } from './core';
import { nova } from './nova';
import { ae } from './ae';
import { bliz } from './bliz';
import { coc } from './coc';
import { blink } from './blink';
import { drink } from './drink';
import { flame } from './flame';
import { blast } from './blast';
import { hellfire } from './hellfire';
import { hurricane } from './hurricane';
import { frostorb } from './frostorb';
import { chain } from './chain';
import { voidorb } from './voidorb';
import { whirl } from './whirl';
import { arc } from './arc';

Object.assign(SPELLS, { nova, ae, bliz, coc, blink, drink, flame, blast, hellfire, hurricane, frostorb, chain, voidorb, whirl, arc });
// input.ts und gamepad.ts prüfen SPELLS[aktion]. Die neuen Tasten zählen dort als Zauber, ohne selbst einer zu sein.
for (const action of SPELL_ACTIONS) if (!SPELLS[action]) Object.defineProperty(SPELLS, action, { value: { alias: true }, enumerable: false });
resetSpells();

export * from './core';
