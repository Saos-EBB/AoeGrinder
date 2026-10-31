// Punkte oben Mitte, Combo mit 4-s-Balken, MULTI-KILL. Bringt Markup und Stil selbst mit und läuft in eigener Schleife.

import { state, player } from '../state';
import { timeLimit } from '../modifiers';
import { die } from '../player';
import { run, tickScore } from '../score';
import { SCORE_COMBO_WINDOW, SCORE_MULTI_BANNER, LEVEL_NEW_MOB_BANNER } from '../config';

document.head.insertAdjacentHTML('beforeend', `<style>
  #scoreHud { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 2; pointer-events: none; text-align: center; text-shadow: 0 1px 3px #000; }
  #scorePts { font: 700 26px Cinzel, serif; color: #f2c94c; font-variant-numeric: tabular-nums; }
  #scoreCombo { font: 700 14px system-ui, sans-serif; color: #fff; min-height: 18px; }
  #scoreBar { width: 120px; height: 4px; margin: 2px auto 0; background: #000a; visibility: hidden; }
  #scoreBar div { height: 100%; background: #ffb347; transform-origin: left; }
  #scoreMulti { font: 700 40px Cinzel, serif; color: #ff5ae0; margin-top: 8px; opacity: 0; transition: opacity .4s; }
  #scoreNew { font: 700 24px Cinzel, serif; color: #ffb347; opacity: 0; transition: opacity .4s; }
</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="scoreHud"><div id="scorePts">0</div><div id="scoreCombo"></div>
  <div id="scoreBar"><div></div></div><div id="scoreMulti"></div><div id="scoreNew"></div></div>`);
const pts = document.getElementById('scorePts'), combo = document.getElementById('scoreCombo'), bar = document.getElementById('scoreBar'), multi = document.getElementById('scoreMulti'), newMob = document.getElementById('scoreNew');

function frame() {
  if (!state.paused) {
    tickScore();
    const limit = timeLimit();
    if (limit && state.now >= limit && !player.dead) {
      player.lastHitBy = 'Zeitlimit';
      die();
    }
  }
  pts.textContent = run.killPoints.toLocaleString('de-DE');
  const left = 1 - (state.now - run.lastKill) / SCORE_COMBO_WINDOW, live = run.combo > 0 && left > 0;
  combo.textContent = live ? `Combo ${run.combo}` : '';
  bar.style.visibility = live ? 'visible' : 'hidden';
  (bar.firstElementChild as HTMLElement).style.transform = `scaleX(${Math.max(0, left)})`;
  const showMulti = run.lastMulti >= SCORE_MULTI_BANNER && state.now - run.multiAt < 1500;   // PH: Anzeigedauer
  if (showMulti) multi.textContent = `MULTI-KILL ×${run.lastMulti}`;
  multi.style.opacity = showMulti ? '1' : '0';
  const showNew = state.newMob && state.now - state.newMob.at < LEVEL_NEW_MOB_BANNER;
  if (showNew) newMob.textContent = state.newMob.text;
  newMob.style.opacity = showNew ? '1' : '0';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
