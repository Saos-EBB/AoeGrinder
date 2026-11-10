// Ereignis-Hub für die Figur (Kosmetik-Reaktionen, models/kosmetikParts.ts): Spiel-Stellen melden nur, was passiert ist, die Figur reagiert.
// Ereignisse: kill, crit, cast, hit (Spieler verliert Leben), level, streak (streak.n Kills in streak.ms), idle (idle.ms ohne Eingabe), sprint (an/aus).
// Dazu Werte, die die Figur pro Frame lesen darf (figVals): Mana 0 … 1, Kills im Run, Element der Waffe, Sprint.
// Nur Optik: nichts hier ändert Spiellogik. Dev/Tests: window.__fig.fire(name).

import { state, player } from './state';
import { maxMana } from './formulas';
import { run } from './score';

export type FigEvent = 'kill' | 'crit' | 'cast' | 'hit' | 'level' | 'streak' | 'idle' | 'sprint';
export const FIG_EV = {   // PH
  streak: { n: 10, ms: 2000 },   // Kill-Serie: so viele Kills in so vielen ms (Spielzeit)
  idle: { ms: 10000 },           // so lange ohne Eingabe und ohne Bewegung (echte Zeit, läuft auch im Hauptmenü)
  gap: { kill: 120, crit: 200, hit: 250, cast: 0, level: 0, streak: 0, idle: 0, sprint: 0 } as Record<FigEvent, number>,   // höchstens ein Ereignis je so viele ms (AoE-Crits, Gift-Ticks), echte Zeit
};
export const figVals = { mana: 0, kills: 0, element: null as string | null, sprint: false };

const subs: ((e: FigEvent, on?: boolean) => void)[] = [];
export const onFigEvent = (fn: (e: FigEvent, on?: boolean) => void) => { subs.push(fn); };
const lastAt: Partial<Record<FigEvent, number>> = {}, counts: Partial<Record<FigEvent, number>> = {};   // counts: Tests
export function figEvent(e: FigEvent, on?: boolean) {
  const now = performance.now();
  if (now - (lastAt[e] ?? -1e9) < FIG_EV.gap[e]) return;
  lastAt[e] = now;
  counts[e] = (counts[e] ?? 0) + 1;
  for (const fn of subs) fn(e, on);
}

// Kill: zählt für die Serie jeden Kill, meldet aber höchstens einen je gap.kill
let streakAt: number[] = [];
export function figKill() {
  figEvent('kill');
  streakAt.push(state.now);
  streakAt = streakAt.filter(t => state.now - t <= FIG_EV.streak.ms);
  if (streakAt.length >= FIG_EV.streak.n) { streakAt = []; figEvent('streak'); }
}

// Eingabe: setzt den Idle-Zähler zurück (eigene Listener, input.ts bleibt unberührt)
let inputAt = performance.now(), idleFired = false, forceSprint: boolean | null = null;   // forceSprint: Dev/Tests
const touch = () => { inputAt = performance.now(); idleFired = false; };
for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel']) addEventListener(ev, touch, { passive: true });

// Jeden Frame (main.ts updateVisuals). element: Element der Waffe, nach dem die Figur gebaut ist (models/mage.ts)
export function updateFigEvents(element: string | null) {
  const moving = forceSprint ?? (player.moveState === 'run' || player.moveState === 'back' || !player.grounded);
  figVals.mana = player.rageMax ? 0 : Math.max(0, Math.min(1, player.mana / Math.max(1, maxMana())));
  figVals.kills = run.kills ?? 0;
  figVals.element = element;
  if (moving !== figVals.sprint) { figVals.sprint = moving; figEvent('sprint', moving); }
  if (moving || player.castAnimUntil > state.now || player.channel) touch();
  if (!idleFired && performance.now() - inputAt >= FIG_EV.idle.ms) { idleFired = true; figEvent('idle'); }
}

(window as any).__fig = { fire: (e: FigEvent) => { lastAt[e] = -1e9; figEvent(e); }, sprint: (on: boolean | null) => { forceSprint = on; }, vals: figVals, counts, FIG_EV };
