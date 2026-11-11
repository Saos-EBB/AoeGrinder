// Punkte, Combo mit 4-s-Balken, Ansage neuer Mobs. Multi-Kills zeigen die Erfolgs-Meldungen (ui/messages.ts). Bringt Markup und Stil selbst mit und läuft in eigener Schleife.

import { state, player } from '../state';
import { timeLimit } from '../modifiers';
import { die } from '../player';
import { run, tickScore } from '../score';
import { put } from './hud';
import { SCORE_COMBO_WINDOW, LEVEL_NEW_MOB_BANNER } from '../config';
import { t } from '../i18n';
import { fmtInt } from './fmt';

document.head.insertAdjacentHTML('beforeend', `<style>
  #scoreHud { position: fixed; top: 78px; left: 50%; transform: translateX(-50%); z-index: 2; pointer-events: none; text-align: center; text-shadow: 0 1px 3px #000; }
  #scoreNew { font: 700 24px Cinzel, serif; color: #ffb347; opacity: 0; transition: opacity .4s; }
</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="scoreHud"><div id="scoreNew"></div></div>`);
const pts = document.getElementById('scorePts'), combo = document.getElementById('scoreCombo'), bar = document.getElementById('scoreBar'), newMob = document.getElementById('scoreNew');

function frame() {
  if (!state.paused) {
    tickScore();
    const limit = timeLimit();
    if (limit && state.now >= limit && !player.dead) {
      player.lastHitBy = t('mod.time.name');
      die();
    }
  }
  put(pts, fmtInt(run.killPoints));
  const left = 1 - (state.now - run.lastKill) / SCORE_COMBO_WINDOW, live = run.combo > 0 && left > 0;
  put(combo, live ? String(run.combo) : '0');
  combo.classList.toggle('idle', !live);
  bar.style.visibility = live ? 'visible' : 'hidden';
  (bar.firstElementChild as HTMLElement).style.transform = `scaleX(${Math.max(0, left)})`;
  const showNew = state.newMob && state.now - state.newMob.at < LEVEL_NEW_MOB_BANNER;
  if (showNew) newMob.textContent = state.newMob.text;
  newMob.style.opacity = showNew ? '1' : '0';
  requestAnimationFrame(frame);
}

// Bild-Schleife (E10): main.ts ruft mount() in der rAF-Reihenfolge von früher
export function mount() {
  requestAnimationFrame(frame);
}
