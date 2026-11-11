// Lokale Rangliste. Nur im Browser des Spielers, Lesen und Schreiben dürfen fehlschlagen.

import { state, player } from './state';
import { KEYS, read, write } from './storage';
import { SCORE_VERSION } from './config';
import { MODES, modeId, mobMode, siegeGoal, activeModIds, scoreMult } from './modifiers';
import { META } from './meta';
import { $ } from './util';
import { COLORS } from './ui/colors';
import { run, scoreBreakdown } from './score';
import { zone, zoneId } from './world';
import { ZONES } from './zones';
import { t } from './i18n';
import { mapSeed, seedPinned } from './mapgen/rng';
import { fmtDiff } from './ui/fmt';

// Einzige Stelle für KEYS.runs (auch spells/core.ts saveRunBuild und ui/saveCode.ts gehen hierüber)
export function loadRuns() {
  const list = read(KEYS.runs, []);
  return Array.isArray(list) ? list : [];
}
export function saveRuns(list) {
  write(KEYS.runs, list);
}

export const byScore = list => [...list].sort((a, b) => b.score - a.score);

// Gleiche Rangliste: Modus, Mob-Modus, Belagerungsziel und Map (pro Theme getrennt; das Layout zählt nicht, jeder Seed gilt)
export const sameBoard = (r, e) => r.mode === e.mode && (r.mobMode ?? 'packs') === e.mobMode && (r.siegeGoal ?? 0) === e.siegeGoal && runZone(r) === e.zoneId;

// Platz im eigenen Modus, 1 = Rekord
export function recordRun() {
  const b = scoreBreakdown();
  const entry = {
    date: new Date().toISOString(), mode: modeId, modeName: MODES.find(m => m.id === modeId).name + (mobMode === 'waves' ? ` · ${t('board.waves')}` : ''), mobMode, siegeGoal, completed: !!player.won, splits: { ...run.splits }, timeTo100: run.splits[100] ?? null, peakMobs: run.peakMobs ?? 0, peakFps: run.peakFps ?? 0, mods: [...activeModIds()], mult: scoreMult(), wave: run.wave ?? 0,
    score: b.total, breakdown: b, level: player.level, kills: run.kills, time: state.now, bestPull: run.bestPull, bestCombo: run.bestCombo, bestMulti: run.bestMulti,
    zone: zone.name, zoneId, seed: zone.gen ? mapSeed() : null, seedFixed: zone.gen ? seedPinned() : false, cause: player.lastHitBy ?? t('cause.unknown'), version: SCORE_VERSION, note: '', build: state.gearSet ? t('gear.buildSet', { name: t(`look.magier.${state.gearSet}.name`) }) : '',   // build: angelegtes Set 5/5 (gear.ts)
  };
  const list = [...loadRuns(), entry];
  saveRuns(list);
  const rank = byScore(list.filter(r => sameBoard(r, entry))).indexOf(entry) + 1;
  return { entry, rank };
}

export function setNote(date, note) {
  const list = loadRuns(), entry = list.find(r => r.date === date);
  if (!entry) return;
  entry.note = note;
  saveRuns(list);
}

export const exportRuns = () => JSON.stringify(loadRuns());

// Mischt gültige Einträge dazu, Dubletten über Datum + Punkte. Gibt die Zahl neuer Einträge zurück, wirft bei kaputtem JSON
export function importRuns(text) {
  const incoming = JSON.parse(text);
  if (!Array.isArray(incoming)) throw new Error('Kein Array');
  const list = loadRuns();
  let added = 0;
  for (const r of incoming) {
    if (!r || typeof r.date !== 'string' || typeof r.score !== 'number' || typeof r.mode !== 'string') continue;
    if (list.some(o => o.date === r.date && o.score === r.score)) continue;
    list.push(r);
    added++;
  }
  saveRuns(list);
  return added;
}

// Gleiche Kombination aus Figur, Mods, Mob-Modus und Map: Darauf beziehen sich beide Ranglisten und die Splits
export const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
// Map eines Runs: neue Einträge haben zoneId, alte nur den Anzeigenamen (ohne Namen = Tirisfal)
export const runZone = r => r.zoneId ?? Object.keys(ZONES).find(id => ZONES[id].name === r.zone) ?? 'tirisfal';
export function comboRuns(map = zoneId) {
  const ids = activeModIds();
  return loadRuns().filter(r => Array.isArray(r.mods) && sameSet(r.mods, ids) && (r.mobMode ?? 'packs') === mobMode && (r.siegeGoal ?? 0) === siegeGoal && runZone(r) === map);
}
export const byTime = list => list.filter(r => typeof r.timeTo100 === 'number').sort((a, b) => a.timeTo100 - b.timeTo100);

// Splits gegen den schnellsten Run derselben Kombination, grün heißt schneller
// Bestwert pro Split, auch aus Runs, die Level 100 nicht erreicht haben. Schlüssel wie comboRuns: Figur + Mods + Mob-Modus + Map
const oldSplitKey = () => `${[...activeModIds()].sort().join(',')}|${mobMode}|${siegeGoal ?? 0}`;   // bis ui-mix ohne Map, gilt als Tirisfal
const splitKey = () => `${oldSplitKey()}|${zoneId}`;
function loadSplitBests() {
  const all = read(KEYS.splits, {}); return all && typeof all === 'object' ? all : {};
}
export const bestSplits = (): Record<number, number> => { const all = loadSplitBests(); return all[splitKey()] ?? (zoneId === 'tirisfal' ? all[oldSplitKey()] : null) ?? {}; };
function saveSplitBest(lvl, ms) {
  if (state.devUsed) return;   // Dev-Läufe (Level setzen usw.) schreiben keine Bestzeiten
  const all = loadSplitBests(), mine = all[splitKey()] ?? (all[splitKey()] = {});
  if (typeof mine[lvl] === 'number' && mine[lvl] <= ms) return;
  mine[lvl] = ms;
  write(KEYS.splits, all);
}

export function noteSplits(fromLevel) {
  for (const lvl of META.splits) {
    if (fromLevel >= lvl || player.level < lvl) continue;
    run.splits[lvl] = state.now;
    saveSplitBest(lvl, state.now);
    const best = byTime(comboRuns())[0]?.splits?.[lvl];
    const el = $('hSplit');
    el.textContent = typeof best === 'number' ? `L${lvl} ${fmtDiff(state.now - best)}` : `L${lvl}`;
    el.style.color = typeof best !== 'number' ? '' : state.now <= best ? COLORS.good : COLORS.bad;
  }
}
export function resetSplits() { const el = $('hSplit'); el.textContent = '–'; el.style.color = ''; }
