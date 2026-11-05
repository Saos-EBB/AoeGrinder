// Eisblock (nur Frost-Pool): unverwundbar, keine Aktion, kein Laufen. Erneut drücken beendet ihn. Kein GCD, eigene Abklingzeit.

import { state, player } from '../state';
import { novaFx } from '../fx/spellFx';
import { iceBlockLook } from '../vfx/frostLook';
import { showError } from '../ui/hud';
import { cdEnd, startCd, stopChannel, stopDrink, noteCastStart } from './core';

const ICEBLOCK = { ms: 6000, cd: 90000, novaRadius: 3 };   // PH, Optik in vfx/frostLook.ts

let block = false;

export function iceBlocked() { return player.iceUntil > state.now; }
function endIceBlock() {
  if (!block) return;
  player.iceUntil = 0;
  block = false;
  novaFx(player.pos, ICEBLOCK.novaRadius);
}
// Läuft jeden Frame aus updatePlayer: Block folgt der Figur, endet nach der Zeit
export function updateIceBlock() {
  if (!block) return;
  if (!iceBlocked() || player.dead) return endIceBlock();
}

export const iceblock = {
  name: 'Eisblock', figRelic: true, desc: '6 s unverwundbar, keine Aktion, kein Laufen. Erneut drücken beendet ihn.', ranks: [], tags: ['Frost'], onlyMode: 'Frost', cls: 'frost',
  mana: 0, cd: ICEBLOCK.cd,
  press() {
    if (block) return endIceBlock();
    if (cdEnd('iceblock') > state.now) return showError('Fähigkeit ist noch nicht bereit');
    startCd('iceblock');
    noteCastStart('iceblock');
    stopChannel(true); stopDrink();
    player.casting = null;
    player.iceUntil = state.now + ICEBLOCK.ms;
    block = true;
    iceBlockLook(() => block);   // Block folgt der Figur und zerspringt, wenn block endet
    updateIceBlock();
    novaFx(player.pos, ICEBLOCK.novaRadius);
  },
};
