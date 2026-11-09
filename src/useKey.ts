// Taste „Benutzen“ (input.ts, Standard G; F ist Spell-Slot 5): Truhen, Schreine, Hebel (objects/), Waffen am Boden (loot.ts).
// Jede Quelle meldet ihr nächstes Ziel in Reichweite; das nächste gewinnt. Darüber ein Hinweis „[G] Truhe öffnen“ unten in der Mitte.

import { state, player } from './state';

export type UseTarget = { dist: number; label: string; act: () => void };
const sources: (() => UseTarget | null)[] = [];
export const addUseSource = (fn: () => UseTarget | null) => { sources.push(fn); };

export function nearestUse(): UseTarget | null {
  if (player.dead || state.paused) return null;
  let best: UseTarget | null = null;
  for (const fn of sources) { const u = fn(); if (u && (!best || u.dist < best.dist)) best = u; }
  return best;
}
export function doUse() { nearestUse()?.act(); }

// Hinweis: Text und Taste kommen von außen (objects.ts setzt keyLabel aus binds)
const hint = document.createElement('div');
hint.id = 'useHint';
hint.style.cssText = 'position: fixed; left: 50%; bottom: 150px; transform: translateX(-50%); z-index: 2; pointer-events: none; font: 700 15px system-ui, sans-serif; color: #f2e6c8; text-shadow: 0 1px 3px #000, 0 0 8px #000; display: none; white-space: nowrap;';
document.body.appendChild(hint);
let shown = '';
export function updateUseHint(keyLabel: string) {
  const u = document.body.classList.contains('menu') ? null : nearestUse();
  const text = u ? `[${keyLabel}] ${u.label}` : '';
  if (text === shown) return;
  shown = text;
  hint.textContent = text;
  hint.style.display = text ? 'block' : 'none';
}
