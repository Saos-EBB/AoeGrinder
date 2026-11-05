// Schadenszahlen: Größe nach Schaden, Look nach Zahlen-Stil (Einstellung numStyle, ui/numbers.css). Kleine Treffer am selben Mob
// werden kurz zusammengefasst (×N). Arten: Treffer, Crit, Mega-Crit, zusammengefasst, Tick, Heilung, Schaden an dir.

import { state } from '../state';
import { rand, clamp } from '../util';
import { SPELLS } from '../config';
import { onCrit } from '../fx/impact';
import { overlay, screenPos } from './hud';
import { COLORS } from './colors';
import { UI } from './uiConfig';
import { uiSettings } from './uiSettings';
import './numbers.css';

// Schulfarben für N01 (Frost, Feuer, Arkan aus dem Mockup; Blitz, Seuche, Krieger eigene Wahl)
const SCHOOL: Record<string, string> = {
  frost: '#7dd3fc', Frost: '#7dd3fc', fire: '#fb923c', Feuer: '#fb923c', arcane: '#c4b5fd', Arkan: '#c4b5fd',
  lightning: '#fde047', nature: '#a3e635', warrior: '#ffffff',
};
const MEGA = 10;   // Mega-Crit (N02) ab 10× Grundschaden des Spells // PH
const BASE_HIT = s => s?.tickDmg ?? (s?.min ? (s.min + s.max) / 2 : s?.dmg ?? s?.pulse ?? s?.showDmg);

const live = [];
const merging = new WeakMap();

const sizeOf = dmg => {
  const k = clamp(Math.log(Math.max(1, dmg) / UI.dmg.refLow) / Math.log(UI.dmg.refHigh / UI.dmg.refLow), 0, 1);
  return (UI.dmg.minPx + (UI.dmg.maxPx - UI.dmg.minPx) * k) * uiSettings.numSize / 100;
};
// Tausender: N01 und N02 mit schmalem Leerzeichen wie im Mockup
const fmt = (n: number) => ['N01', 'N02'].includes(uiSettings.numStyle) ? Math.round(n).toLocaleString('de-DE').replace(/\./g, ' ') : String(Math.round(n));
function label(kind: string, n: number, count = 1) {
  const s = uiSettings.numStyle, v = fmt(n);
  if (kind === 'merged') {
    if (s === 'N04') return `${v} (${count})`;
    if (s === 'N07') return `${v}x${count}`;
    if (s === 'N08') return `${v} <span class="mx">x${count}</span>`;
    if (s === 'N03' || s === 'N10') return `${v}<span class="mx"> ×${count}</span>`;
    return `<span class="mx">×${count} </span>${v}`;
  }
  if (kind === 'crit' || kind === 'mega') return s === 'N08' ? `[${v}]` : s === 'N01' || s === 'N03' ? `${v}!` : v;
  if (kind === 'heal') return `+${v}`;
  if (kind === 'hurt') return s === 'N02' ? v : ['N04', 'N07', 'N08'].includes(s) ? `-${v}` : `−${v}`;
  return v;
}

function spawn(pos, height, kind: string, html: string, px: number, color?: string) {
  const p = screenPos(pos, height);
  if (!p) return null;
  const el = document.createElement('div');
  el.className = `ct num n-${uiSettings.numStyle} k-${kind}${kind === 'crit' || kind === 'mega' ? ' crit' : ''}`;
  el.innerHTML = html;
  el.style.left = `${p.x + rand(-18, 18)}px`;
  el.style.top = `${p.y}px`;
  el.style.fontSize = `${px}px`;
  if (color) el.style.setProperty('--sc', color);
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
  const def = SPELLS[source], key = def?.school ?? def?.cls;
  const color = key === 'warrior' && crit ? '#ef4444' : SCHOOL[key] ?? COLORS.school[key] ?? '#ffffff';   // Krieger: weiß, Crit rot
  const base = BASE_HIT(def);
  const kind = crit ? (base && dmg >= base * MEGA ? 'mega' : 'crit') : tick ? 'tick' : 'hit';
  const px = sizeOf(dmg) * (crit ? UI.dmg.critMul : tick ? 0.65 : 1);
  const el = spawn(mob.pos, 2, kind, label(kind, dmg), px, color);
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
