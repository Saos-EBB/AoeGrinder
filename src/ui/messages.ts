// Erfolgs-Meldungen (Mockups X?Z, gen8.py EVENTS / LINES / msg1–3): 16 Auslöser für alle Flavors, Text und Look kommen aus dem Zahlen-Flavor.
// Höllenfeste und Schlachtbank zeigen eine Meldung zur Zeit, Kompakt-Krypta stapelt bis 3 Toasts. Wichtige Meldungen (Boss, Combo 200, Multi 20+)
// überspringen die Schlange. Die Auslöser werden nur gezählt und gelesen, an Spielwerten ändert sich nichts. Einstellung: messages.

import { state, player } from '../state';
import { $ } from '../util';
import { maxHp } from '../formulas';
import { run } from '../score';
import { bestSplits } from '../leaderboard';
import { SCHOOL_METER } from '../config';
import { meterSchool, meterValue, meterOverheated } from '../schoolMeter';
import { uiSettings } from './uiSettings';
import { activeFlavor, flavorById } from './flavors';
import { t } from '../i18n';

export const FEATS = ['multi3', 'multi5', 'multi10', 'multi20', 'combo25', 'combo50', 'combo100', 'combo200',
  'untouched', 'elite', 'boss', 'meterFull', 'levelUp', 'split', 'megaCrit', 'closeCall'] as const;
export type FeatId = typeof FEATS[number];

const FEAT = {
  showMs: 1800,                       // Dauer einer Meldung // PH
  stack: 3,                           // Kompakt-Krypta: so viele Toasts gleichzeitig
  urgent: ['boss', 'combo200', 'multi20'] as FeatId[],
  big: ['multi20', 'combo200', 'boss'] as FeatId[],   // große Schrift (gen8: Index 3, 7, 10)
  multiWindowMs: 1500,                // Multi-Kill: Kills in so kurzer Zeit // PH
  multi: [3, 5, 10, 20],
  combo: [25, 50, 100, 200],
  untouchedMs: 30000,
  closeCallPct: 0.05, closeCallSafePct: 0.2,   // unter 5 % Leben, gezählt, sobald wieder 20 % erreicht sind // PH
  pollMs: 100,                        // Packs und Boss 10× pro Sekunde prüfen
};

// Flavor der Meldungen = Flavor der Zahlen (wie UI-Flavor oder fest)
const msgFlavor = () => uiSettings.numFlavor === 'flavor' ? activeFlavor() : flavorById(uiSettings.numFlavor);
const fmtTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor(ms / 100) % 10}`;

// ---------- Anzeige und Warteschlange ----------
const box = $('hudFeats');
let queue: { id: FeatId; sub: string }[] = [], showing: { el: HTMLElement; until: number }[] = [];

function render(id: FeatId, sub: string) {
  const f = msgFlavor(), el = document.createElement('div');
  let line = t(`feat.${id}.${f.id}`);
  if (id === 'meterFull') line = line.replace('{name}', (SCHOOL_METER[meterSchool() ?? 'Frost'] as any).name);
  if (f.id === 'schlachtbank') line = line.toUpperCase();
  el.className = `feat ff-${f.id}${FEAT.big.includes(id) ? ' big' : ''}`;
  el.innerHTML = f.messages(line, sub, FEAT.big.includes(id));
  return el;
}
function show(id: FeatId, sub: string) {
  const el = render(id, sub);
  box.dataset.flavor = msgFlavor().id;
  if (msgFlavor().id === 'krypta') box.prepend(el); else { box.textContent = ''; box.append(el); }
  showing.push({ el, until: performance.now() + FEAT.showMs });
  while (showing.length > (msgFlavor().id === 'krypta' ? FEAT.stack : 1)) showing.shift().el.remove();
}
// Meldung auslösen. Auch für Module außerhalb (Mega-Crit aus dmgNumbers.ts) und den Dev-Knopf
export function feat(id: FeatId, sub = '') {
  if (!uiSettings.messages) return;
  if (FEAT.urgent.includes(id)) { for (const s of showing) s.el.remove(); showing = []; queue.unshift({ id, sub }); }
  else if (!queue.some(q => q.id === id)) queue.push({ id, sub });
}
function tickQueue(now: number) {
  showing = showing.filter(s => { if (s.until > now) return true; s.el.remove(); return false; });
  const room = msgFlavor().id === 'krypta' ? FEAT.stack : 1;
  while (queue.length && showing.length < room) { const q = queue.shift(); show(q.id, q.sub); }
}

// ---------- Auslöser ----------
let kills = 0, burst: number[] = [], multiDone = 0, combo = 0, level = 0, hurtAt = 0, streakKills = 0, untouchedDone = false;
let meterFull = false, splitsSeen = 0, bestAtStart: Record<number, number> = {}, lowest = 1, armed = false, pollAt = 0, runSplits = null;
const packs = new Map<number, number>(), bossDone = new WeakSet();

// Treffer am Spieler (dmgNumbers.ts hurtNumber)
export function noteHurt() { hurtAt = state.now; streakKills = 0; untouchedDone = false; }

function resetRun() {
  kills = 0; burst = []; multiDone = 0; combo = 0; level = player.level; hurtAt = state.now; streakKills = 0; untouchedDone = false;
  meterFull = false; splitsSeen = 0; bestAtStart = { ...bestSplits() }; lowest = 1; armed = false; packs.clear();
  queue = []; for (const s of showing) s.el.remove(); showing = [];
}
const crossed = (list: number[], from: number, to: number) => list.filter(v => from < v && to >= v).pop();

function check() {
  const now = state.now;
  if (run.splits !== runSplits) { runSplits = run.splits; resetRun(); }   // resetScore legt für jeden Run neue Splits an
  // Multi-Kill: Kills in kurzer Zeit
  const fresh = run.kills - kills;
  kills = run.kills;
  for (let i = 0; i < fresh; i++) burst.push(now);
  streakKills += fresh;
  burst = burst.filter(at => now - at <= FEAT.multiWindowMs);
  if (!burst.length) multiDone = 0;
  const m = crossed(FEAT.multi, multiDone, burst.length);
  if (m) { multiDone = burst.length; feat(`multi${m}` as FeatId, `×${burst.length}`); }
  // Combo
  const c = crossed(FEAT.combo, combo, run.combo);
  if (c) feat(`combo${c}` as FeatId, String(run.combo));
  combo = run.combo;
  // 30 s ungetroffen, mit mindestens einem Kill in der Zeit
  if (!untouchedDone && streakKills > 0 && now - hurtAt >= FEAT.untouchedMs) { untouchedDone = true; feat('untouched', t('feat.sub.untouched', { n: FEAT.untouchedMs / 1000 })); }
  // Level-up
  if (player.level > level && level) feat('levelUp', t('feat.sub.level', { n: player.level }));
  level = player.level;
  // Kill-Anzeige voll (Frost: Kälte, Feuer: überhitzt)
  const school = meterSchool(), full = !!school && (meterValue() >= 1 || meterOverheated());
  if (full && !meterFull) feat('meterFull', (SCHOOL_METER[school] as any).full);
  meterFull = full;
  // Split vor Bestzeit
  const splits = Object.keys(run.splits ?? {}).map(Number).sort((a, b) => a - b);
  for (const lvl of splits.slice(splitsSeen)) {
    const mine = run.splits[lvl], best = bestAtStart[lvl];
    if (typeof best === 'number' && mine < best) feat('split', `−${fmtTime(best - mine)}`);
  }
  splitsSeen = splits.length;
  // Knapp überlebt
  if (!player.dead) {
    const pct = player.hp / Math.max(1, maxHp());
    if (pct < FEAT.closeCallPct && pct > 0) { armed = true; lowest = Math.min(lowest, pct); }
    if (armed && pct >= FEAT.closeCallSafePct) { feat('closeCall', t('feat.sub.life', { n: Math.max(1, Math.round(lowest * 100)) })); armed = false; lowest = 1; }
  } else { armed = false; lowest = 1; }
  // Packs mit Champion und Boss, 10× pro Sekunde
  if (performance.now() - pollAt < FEAT.pollMs) return;
  pollAt = performance.now();
  const alive = new Map<number, number>();
  for (const mob of state.mobs) {
    if (mob.boss && mob.dead && !bossDone.has(mob)) { bossDone.add(mob); feat('boss', mob.type?.name ?? 'Boss'); }
    if (!mob.champion && !packs.has(mob.packId)) continue;
    alive.set(mob.packId, (alive.get(mob.packId) ?? 0) + (mob.dead ? 0 : 1));
  }
  for (const [id, n] of packs) if (!alive.get(id) && n > 0) feat('elite', t('feat.sub.elite'));
  packs.clear();
  for (const [id, n] of alive) if (n > 0) packs.set(id, n);
}

function frame() {
  const now = performance.now();
  const inRun = !document.body.classList.contains('menu') && !player.dead;
  if (inRun && !state.paused) check();
  tickQueue(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Dev: jede Meldung einmal auslösen (F10 → Anzeige)
const dev = document.createElement('div');
dev.id = 'devFeat';
dev.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px';
const pick = document.createElement('select');
pick.className = 'bindBtn';
for (const id of FEATS) pick.add(new Option(t(`feat.${id}.hoellenfeste`) + ` (${id})`, id));
const fire = Object.assign(document.createElement('button'), { className: 'bindBtn', textContent: t('feat.dev') });
fire.addEventListener('click', () => { const id = pick.value as FeatId; feat(id, id === 'boss' ? 'Boss' : id.startsWith('multi') ? `×${id.slice(5)}` : id.startsWith('combo') ? id.slice(5) : ''); });
dev.append(pick, fire);
$('devPerf').before(dev);
