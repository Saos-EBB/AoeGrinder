// Registrierung aller Spells. Die anderen Module importieren weiter aus './spells'.

import { SPELLS, SPELL_ACTIONS } from '../config';
import '../modifiers';   // resetSpells unten liest den Modus; über core.ts käme der Import im Kreis zu spät
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
import { frostorb } from './frostorb';
import { voidorb } from './voidorb';
import { whirl } from './whirl';
import { icelance } from './icelance';
import { glacier } from './glacier';
import { fireball } from './fireball';
import { meteor } from './meteor';
import { arcmissiles } from './arcmissiles';
import { chain } from './chain';
import { arc } from './arc';
import { arcmark } from './arcmark';
import { surge } from './surge';
import { iceblock } from './iceblock';
import { randomSpells } from './random';
import { phoenix } from './phoenix';
import { detonate } from './detonate';
import { ragnaros, desecrate, frostbreath, froststrike, firenova, bonecage } from './relics';

Object.assign(SPELLS, randomSpells, { iceblock, phoenix, detonate, nova, ae, bliz, coc, blink, drink, flame, blast, hellfire, frostorb, voidorb, whirl, icelance, glacier, fireball, meteor, arcmissiles, arcmark, chain, arc, surge, ragnaros, desecrate, frostbreath, froststrike, firenova, bonecage });
// input.ts und gamepad.ts prüfen SPELLS[aktion]. Die neuen Tasten zählen dort als Zauber, ohne selbst einer zu sein.
for (const action of SPELL_ACTIONS) if (!SPELLS[action]) Object.defineProperty(SPELLS, action, { value: { alias: true }, enumerable: false });
resetSpells();

export * from './core';
