// Schadenszahlen: Größe nach Schaden, Look in ui/numbers.css. Kleine Treffer am selben Mob
// werden kurz zusammengefasst (×N). Arten: Treffer, Crit, Mega-Crit, zusammengefasst, Tick, Heilung, Schaden an dir.

import { state } from '../state';
import { rand, clamp } from '../util';
import { SPELLS } from '../config';
import { onCrit } from '../fx/impact';
import { overlay, screenPos } from './hud';
import { UI } from './uiConfig';
import { uiSettings } from './uiSettings';
import './numbers.css';

const MEGA = 10;   // Mega-Crit ab 10× Grundschaden des Spells // PH
const BASE_HIT = s => s?.tickDmg ?? (s?.min ? (s.min + s.max) / 2 : s?.dmg ?? s?.pulse ?? s?.showDmg);

const live = [];
const merging = new WeakMap();

const sizeOf = dmg => {
  const k = clamp(Math.log(Math.max(1, dmg) / UI.dmg.refLow) / Math.log(UI.dmg.refHigh / UI.dmg.refLow), 0, 1);
  return (UI.dmg.minPx + (UI.dmg.maxPx - UI.dmg.minPx) * k) * uiSettings.numSize / 100;
};
// Ganze Zahl mit Tausenderpunkt
const fmt = (n: number) => Math.round(n).toLocaleString('de-DE');
function label(kind: string, n: number, count = 1) {
  const v = fmt(n);
  if (kind === 'merged') return `${v}<span class="mx"> ×${count}</span>`;
  if (kind === 'heal') return `+${v}`;
  return v;
}

function spawn(pos, height, kind: string, html: string, px: number) {
  const p = screenPos(pos, height);
  if (!p) return null;
  const el = document.createElement('div');
  el.className = `ct num k-${kind}${kind === 'crit' || kind === 'mega' ? ' crit' : ''}`;
  el.innerHTML = html;
  el.style.left = `${p.x + rand(-18, 18)}px`;
  el.style.top = `${p.y}px`;
  el.style.fontSize = `${px}px`;
  overlay.appendChild(el);
  live.push(el);
  if (live.length > UI.dmg.maxLive) live.shift().remove();
  setTimeout(() => { el.remove(); const i = live.indexOf(el); if (i >= 0) live.splice(i, 1); }, UI.dmg.lifeMs);
  return el;
}

export function damageNumber(mob, dmg, crit, source, tick = false) {
  if (crit) onCrit();
  const open = !crit && uiSettings.numMerge && merging.get(mob);
  if (open && state.now - open.at < UI.dmg.mergeMs) {
    open.total += dmg;
    open.n++;
    open.el.innerHTML = label('merged', open.total, open.n);
    open.el.className = open.el.className.replace(/k-\w+/, 'k-merged');
    open.el.style.fontSize = `${sizeOf(open.total)}px`;
    return;
  }
  const base = BASE_HIT(SPELLS[source]);
  const kind = crit ? (base && dmg >= base * MEGA ? 'mega' : 'crit') : tick ? 'tick' : 'hit';
  const px = sizeOf(dmg) * (crit ? UI.dmg.critMul : tick ? 0.65 : 1);
  const el = spawn(mob.pos, 2, kind, label(kind, dmg), px);
  if (el && !crit) merging.set(mob, { el, total: dmg, n: 1, at: state.now });
}

// Heilzahl (+N) im Stil; Texte wie „Phönix!“ laufen weiter über combatText
export function healNumber(pos, amount, height = 2.4) {
  if (!uiSettings.healNums) return;
  spawn(pos, height, 'heal', label('heal', amount), sizeOf(amount) * 0.9);
}
// Schaden an dir: Treffer innerhalb von mergeMs werden zu einer Zahl
let hurt = null;
export function hurtNumber(pos, amount) {
  if (hurt && state.now - hurt.at < UI.dmg.mergeMs && hurt.el.isConnected) {
    hurt.total += amount;
    hurt.el.innerHTML = label('hurt', hurt.total);
    return;
  }
  const el = spawn(pos, 2.6, 'hurt', label('hurt', amount), sizeOf(amount) * 0.9);
  if (el) hurt = { el, total: amount, at: state.now };
}
