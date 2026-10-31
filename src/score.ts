// Punkte eines Runs. Liest vom Kill nur xp und mob.castKey: eine echte Cast-ID oder, als Fallback, die Spell-ID.

import { state, player } from './state';
import { scoreMult } from './modifiers';
import { SPELLS, SCORE_MULTI_WINDOW, SCORE_MULTI_STEP, SCORE_MULTI_MAX, SCORE_COMBO_WINDOW, SCORE_COMBO_DIV, SCORE_COMBO_MAX, SCORE_PULL_POINTS, SCORE_MINUTE_POINTS } from './config';

export const run: any = {};

export function resetScore() {
  Object.assign(run, { killPoints: 0, kills: 0, combo: 0, bestCombo: 0, lastKill: -1e9, casts: {}, lastMulti: 0, multiAt: -1e9, bestMulti: 0, bestPull: 0 });
}
resetScore();

export function reportKill(mob, xp) {
  const now = state.now, key = mob.castKey ?? 'env', cast = run.casts[key] ?? (run.casts[key] = { n: 0, last: -1e9 });
  // Eine echte Cast-ID zählt ohne Zeitfenster, Spell-ID und 'env' nur innerhalb des Fensters
  const realCast = key !== 'env' && !(key in SPELLS);
  cast.n = realCast || now - cast.last <= SCORE_MULTI_WINDOW ? cast.n + 1 : 1;
  cast.last = now;
  run.combo = now - run.lastKill <= SCORE_COMBO_WINDOW ? run.combo + 1 : 0;
  run.lastKill = now;
  run.kills++;
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  run.bestMulti = Math.max(run.bestMulti, cast.n);
  run.lastMulti = cast.n;
  run.multiAt = now;
  const mMulti = Math.min(SCORE_MULTI_MAX, 1 + SCORE_MULTI_STEP * (cast.n - 1));
  const mCombo = Math.min(SCORE_COMBO_MAX, 1 + run.combo / SCORE_COMBO_DIV);
  run.killPoints += Math.round(xp * mMulti * mCombo * scoreMult());
}

// Jeden Frame: Combo verfällt, größter Pull wächst
export function tickScore() {
  if (player.drink || state.now - run.lastKill > SCORE_COMBO_WINDOW) run.combo = 0;
  run.bestPull = Math.max(run.bestPull, state.mobs.filter(m => !m.dead && m.state === 'combat').length);
}

export function scoreBreakdown() {
  const pull = run.bestPull * SCORE_PULL_POINTS, time = Math.floor(state.now / 60000) * SCORE_MINUTE_POINTS;
  return { kills: run.killPoints, pull, time, total: run.killPoints + pull + time };
}
