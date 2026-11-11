// Hotbar: Die Tasten belegen Plätze auf der Leiste, nicht Spells. Jeder Platz zeigt auf einen Slot (state.slots, feste Rollen:
// 5 Attacken, Trinken, Bewegung, Relikt – Karten und Eiszeit rechnen damit). Drag & Drop tauscht nur die Plätze.
// Dazu pro Platz ein Auslöse-Modus: sofort (beim Drücken, Bodenziele unter der Maus), bei Loslassen (Zielkreis solange gehalten), klicken (Zielkreis, dann Klick).
// Reihenfolge und Modi bleiben pro Figur im localStorage.

import { state } from './state';
import { KEYS, read, write } from './storage';
import { SPELL_ACTIONS } from './config';
import { activeModIds } from './modifiers';
import { t } from './i18n';

export type CastMode = 'instant' | 'release' | 'click';
export const MODE_NAMES: Record<CastMode, string> = { instant: t('cast.mode.instant'), release: t('cast.mode.release'), click: t('cast.mode.click') };
const N = SPELL_ACTIONS.length;

let store: Record<string, { order: number[]; mode: (CastMode | null)[] }> = read(KEYS.hotbar, {});
const save = () => { write(KEYS.hotbar, store); };
const figKey = () => activeModIds().slice().sort().join('+') || 'normal';
function bar() {
  const b = store[figKey()] ??= { order: [...Array(N).keys()], mode: Array(N).fill(null) };
  if (b.order.length !== N || [...b.order].sort((x, y) => x - y).some((v, i) => v !== i)) b.order = [...Array(N).keys()];   // kaputt oder altes Format
  return b;
}

// Slot auf Platz pos, Platz eines Slots
export const slotAt = (pos: number) => bar().order[pos] ?? pos;
export const posOf = (slot: number) => bar().order.indexOf(slot);
// Spell auf der Taste (Aktion) und Taste (Aktion) eines Spells
export function spellAtAction(action: string) {
  const pos = SPELL_ACTIONS.indexOf(action);
  return pos < 0 ? null : state.slots[slotAt(pos)] ?? null;
}
export function actionOfSpell(id: string) {
  const slot = state.slots.indexOf(id);
  return slot < 0 ? undefined : SPELL_ACTIONS[posOf(slot)];
}
// Zwei Plätze tauschen (Drag & Drop)
export function swapPos(a: number, b: number) {
  const o = bar().order;
  if (a === b || a < 0 || b < 0 || a >= N || b >= N) return;
  [o[a], o[b]] = [o[b], o[a]];
  save();
}
// Auslöse-Modus eines Platzes; ohne Wahl: Bodenziele klicken (wie bisher), alles andere sofort
export const modeAt = (pos: number, ground: boolean): CastMode => bar().mode[pos] ?? (ground ? 'click' : 'instant');
export function setModeAt(pos: number, m: CastMode) { bar().mode[pos] = m; save(); }
