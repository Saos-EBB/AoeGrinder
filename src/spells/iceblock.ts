// Eisblock (nur Frost-Pool): unverwundbar, keine Aktion, kein Laufen. Erneut drücken beendet ihn. Kein GCD, eigene Abklingzeit.

import * as THREE from 'three';
import { state, player } from '../state';
import { scene } from '../render';
import { iceTex, novaFx } from '../fx/spellFx';
import { showError } from '../ui/hud';
import { cdEnd, startCd, stopChannel, stopDrink, noteCastStart } from './core';

const ICEBLOCK = { ms: 6000, cd: 90000, size: [1.5, 2.4, 1.5], opacity: 0.55, novaRadius: 3 };   // PH

let block = null;
function makeBlock() {
  const [w, h, d] = ICEBLOCK.size;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ map: iceTex, color: 0xbfe8ff, transparent: true, opacity: ICEBLOCK.opacity, depthWrite: false }));
  m.renderOrder = 2;
  return m;
}

export function iceBlocked() { return player.iceUntil > state.now; }
function endIceBlock() {
  if (!block) return;
  player.iceUntil = 0;
  scene.remove(block);
  block.geometry.dispose(); block.material.dispose();
  block = null;
  novaFx(player.pos, ICEBLOCK.novaRadius);
}
// Läuft jeden Frame aus updatePlayer: Block folgt der Figur, endet nach der Zeit
export function updateIceBlock() {
  if (!block) return;
  if (!iceBlocked() || player.dead) return endIceBlock();
  block.position.set(player.pos.x, player.pos.y + ICEBLOCK.size[1] / 2, player.pos.z);
}

export const iceblock = {
  name: 'Eisblock', desc: '6 s unverwundbar, keine Aktion, kein Laufen. Erneut drücken beendet ihn.', ranks: [], tags: ['Frost'], onlyMode: 'Frost', cls: 'frost',
  mana: 0, cd: ICEBLOCK.cd,
  press() {
    if (block) return endIceBlock();
    if (cdEnd('iceblock') > state.now) return showError('Fähigkeit ist noch nicht bereit');
    startCd('iceblock');
    noteCastStart('iceblock');
    stopChannel(true); stopDrink();
    player.casting = null;
    player.iceUntil = state.now + ICEBLOCK.ms;
    block = makeBlock();
    scene.add(block);
    updateIceBlock();
    novaFx(player.pos, ICEBLOCK.novaRadius);
  },
};
