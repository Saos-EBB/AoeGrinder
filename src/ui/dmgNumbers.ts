// Schadenszahlen: dicke Kontur, Größe nach Schaden, Farbe nach Schule. Kleine Treffer am selben Mob werden kurz zusammengefasst.

import { state } from '../state';
import { rand, clamp } from '../util';
import { SPELLS } from '../config';
import { onCrit } from '../fx/impact';
import { overlay, screenPos } from './hud';
import { COLORS } from './colors';
import { UI } from './uiConfig';

const live = [];
const merging = new WeakMap();

const sizeOf = dmg => {
  const k = clamp(Math.log(Math.max(1, dmg) / UI.dmg.refLow) / Math.log(UI.dmg.refHigh / UI.dmg.refLow), 0, 1);
  return UI.dmg.minPx + (UI.dmg.maxPx - UI.dmg.minPx) * k;
};

export function damageNumber(mob, dmg, crit, source) {
  if (crit) onCrit();
  const open = !crit && merging.get(mob);
  if (open && state.now - open.at < UI.dmg.mergeMs) {
    open.total += dmg;
    open.el.textContent = open.total;
    open.el.style.fontSize = `${sizeOf(open.total)}px`;
    return;
  }
  const p = screenPos(mob.pos, 2);
  if (!p) return;
  const el = document.createElement('div');
  const def = SPELLS[source];
  el.className = crit ? 'ct num crit' : 'ct num';
  el.textContent = crit ? `${dmg}!` : dmg;
  el.style.left = `${p.x + rand(-18, 18)}px`;
  el.style.top = `${p.y}px`;
  el.style.color = COLORS.school[def?.school ?? def?.cls] ?? '#fff';
  el.style.fontSize = `${sizeOf(dmg) * (crit ? UI.dmg.critMul : 1)}px`;
  overlay.appendChild(el);
  live.push(el);
  if (live.length > UI.dmg.maxLive) live.shift().remove();
  if (!crit) merging.set(mob, { el, total: dmg, at: state.now });
  setTimeout(() => { el.remove(); const i = live.indexOf(el); if (i >= 0) live.splice(i, 1); }, UI.dmg.lifeMs);
}
