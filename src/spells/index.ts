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
import { recharge } from './recharge';
import { strike } from './strike';
import { ball } from './ball';
import { discharge } from './discharge';
import { storm } from './storm';
import { bwhip, bjump, siphon, bwave, glue, melt } from './blood';
import { arc } from './arc';
import { arcmark } from './arcmark';
import { surge } from './surge';
import { iceblock } from './iceblock';
import { randomSpells } from './random';
import { phoenix } from './phoenix';
import { detonate } from './detonate';
import { gasoline } from './gasoline';
import { firetrail } from './firetrail';
import { firestorm } from './firestorm';
import { frostbolt } from './frostbolt';
import { needle } from './needle';
import { icebarrier } from './icebarrier';
import { iceage } from './iceage';
import { barrage, beam, arcorb, arcstrike } from './arcane2';
import { archon, timewarp, archBeam, archNova, archPort } from './arcRelics';
import { ragnaros, desecrate, frostbreath, froststrike, firenova, bonecage } from './relics';

Object.assign(SPELLS, randomSpells, { iceblock, phoenix, detonate, gasoline, firetrail, firestorm, frostbolt, needle, icebarrier, iceage, barrage, beam, arcorb, arcstrike, archon, timewarp, archBeam, archNova, archPort, nova, ae, bliz, coc, blink, drink, flame, blast, hellfire, frostorb, voidorb, whirl, icelance, glacier, fireball, meteor, arcmissiles, arcmark, chain, arc, recharge, strike, ball, discharge, storm, bwhip, bjump, siphon, bwave, glue, melt, surge, ragnaros, desecrate, frostbreath, froststrike, firenova, bonecage });
// input.ts und gamepad.ts prüfen SPELLS[aktion]. Die neuen Tasten zählen dort als Zauber, ohne selbst einer zu sein.
for (const action of SPELL_ACTIONS) if (!SPELLS[action]) Object.defineProperty(SPELLS, action, { value: { alias: true }, enumerable: false });
resetSpells();

export * from './core';
