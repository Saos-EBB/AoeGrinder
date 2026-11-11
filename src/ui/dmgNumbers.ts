// Schadenszahlen: Größe nach Schaden, Text und Look aus dem Zahlen-Flavor (Einstellung numFlavor: wie UI-Flavor oder fest, ui/flavors/<id>.ts + .css).
// Kleine Treffer am selben Mob werden kurz zusammengefasst (×N). Arten: Treffer, Crit, Mega-Crit, zusammengefasst, Tick, Heilung, Schaden an dir.
// Alle Zahlen ganz mit Tausenderpunkt (48.120), keine Abkürzungen.

import { state } from '../state';
import { rand, clamp } from '../util';
import { SPELLS } from '../config';
import { baseHit } from '../formulas';
import { onCrit } from '../fx/impact';
import { overlay, screenPos } from './hud';
import { UI } from './uiConfig';
import { uiSettings } from './uiSettings';
import { activeFlavor, flavorById } from './flavors';
import { feat, noteHurt } from './messages';
import './numbers.css';

const MEGA = 10;   // Mega-Crit ab 10× Grundschaden des Spells // PH

const live = [];
const merging = new WeakMap();

// Flavor der Zahlen und Meldungen: wie der UI-Flavor oder fest gewählt
export const numberFlavor = () => uiSettings.numFlavor === 'flavor' ? activeFlavor() : flavorById(uiSettings.numFlavor);

const sizeOf = dmg => {
  const k = clamp(Math.log(Math.max(1, dmg) / UI.dmg.refLow) / Math.log(UI.dmg.refHigh / UI.dmg.refLow), 0, 1);
  return (UI.dmg.minPx + (UI.dmg.maxPx - UI.dmg.minPx) * k) * uiSettings.numSize / 100;
};
export const fmtInt = (n: number) => Math.round(n).toLocaleString('de-DE', { maximumFractionDigits: 0 });
const label = (kind: string, n: number, count = 1) => numberFlavor().numbers.text(kind, fmtInt(n), count);

function spawn(pos, height, kind: string, n: number, px: number, count = 1) {
  const p = screenPos(pos, height);
  if (!p) return null;
  const f = numberFlavor();
  const el = document.createElement('div');
  el.className = `ct num nf-${f.id} k-${kind}${kind === 'crit' || kind === 'mega' ? ' crit' : ''}`;
  el.innerHTML = f.numbers.text(kind, fmtInt(n), count);
  el.style.left = `${p.x + rand(-18, 18)}px`;
  el.style.top = `${p.y}px`;
  el.style.fontSize = `${px * (f.numbers.size[kind] ?? 1)}px`;
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
    open.el.style.fontSize = `${sizeOf(open.total) * (numberFlavor().numbers.size.merged ?? 1)}px`;
    return;
  }
  const base = baseHit(SPELLS[source]);
  const kind = crit ? (base && dmg >= base * MEGA ? 'mega' : 'crit') : tick ? 'tick' : 'hit';
  if (kind === 'mega') feat('megaCrit', fmtInt(dmg));
  const el = spawn(mob.pos, 2, kind, dmg, sizeOf(dmg) * (tick ? 0.65 : 1));
  if (el && !crit) merging.set(mob, { el, total: dmg, n: 1, at: state.now });
}

// Heilzahl (+N); Texte wie „Phönix!“ laufen weiter über combatText
export function healNumber(pos, amount, height = 2.4) {
  if (!uiSettings.healNums) return;
  spawn(pos, height, 'heal', amount, sizeOf(amount) * 0.9);
}
// Schaden an dir: Treffer innerhalb von mergeMs werden zu einer Zahl
let hurt = null;
export function hurtNumber(pos, amount) {
  noteHurt();   // Meldung „30 s ungetroffen“
  if (hurt && state.now - hurt.at < UI.dmg.mergeMs && hurt.el.isConnected) {
    hurt.total += amount;
    hurt.el.innerHTML = label('hurt', hurt.total);
    return;
  }
  const el = spawn(pos, 2.6, 'hurt', amount, sizeOf(amount) * 0.9);
  if (el) hurt = { el, total: amount, at: state.now };
}
