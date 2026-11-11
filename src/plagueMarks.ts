// Seuchen-Male und Gift am Mob (v31). Ohne Imports aus spells/, damit Waffen (weaponRolls.ts) und Mobs sie nutzen können.
// Male: 1 Stapel pro Treffer der markierenden Seuchen-Spells, höchstens 3, 10 s. Gift: fester Schaden pro Sekunde, getickt in plague.ts.

import { state } from './state';
import { PLAGUE } from './config';

const M = PLAGUE.mark;
export const markStacks = m => m.plague && m.plague.until > state.now ? m.plague.stacks : 0;
export function mark(m, n = 1) {
  if (m.dead) return;
  m.plague = { stacks: Math.min(M.max, markStacks(m) + n), until: state.now + M.ms };
}
export function clearMark(m) { m.plague = null; }
// Verbraucher (Zusammenziehen, Entziehen, Platzen): Mal weg. Pestbringer 5/5 (gear/, state.gearSet): jedes Mal hält 2 Verbraucher aus, erst der zweite löscht es
export function popMark(m) {
  if (state.gearSet === 'seuche' && m.plague && !m.plague.popped) { m.plague.popped = true; return; }
  clearMark(m);
}
// Gift: Gesamtschaden über ms verteilt, ein neues Gift ersetzt ein schwächeres
// step: ms zwischen zwei Ticks, Schaden pro Tick bleibt dps (Pestbringer: Platzen-Gift tickt schneller, also mehr Ticks in derselben Zeit)
export function poison(m, total, ms = PLAGUE.burst.ms, step = 1000) {
  if (m.dead || total <= 0) return;
  const dps = total / (ms / 1000);
  if (m.poison && m.poison.until > state.now && m.poison.dps >= dps) return;
  m.poison = { dps, until: state.now + ms, next: state.now + step, step };
}
export const poisoned = m => !!m.poison && m.poison.until > state.now;
