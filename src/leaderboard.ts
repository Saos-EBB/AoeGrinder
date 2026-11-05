// Lokale Rangliste. Nur im Browser des Spielers, Lesen und Schreiben dürfen fehlschlagen.

import { state, player } from './state';
import { SCORE_VERSION } from './config';
import { MODES, modeId, mobMode, siegeGoal, activeModIds, scoreMult } from './modifiers';
import { META } from './meta';
import { $ } from './util';
import { COLORS } from './ui/colors';
import { run, scoreBreakdown } from './score';
import { zone } from './world';

const STORE = 'frostgrind.runs.v1';

export function loadRuns() {
  try {
    const list = JSON.parse(localStorage.getItem(STORE) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function saveRuns(list) {
  try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { /* kein Storage */ }
}

export const byScore = list => [...list].sort((a, b) => b.score - a.score);

// Platz im eigenen Modus, 1 = Rekord
export function recordRun() {
  const b = scoreBreakdown();
  const entry = {
    date: new Date().toISOString(), mode: modeId, modeName: MODES.find(m => m.id === modeId).name + (mobMode === 'siege' ? ` · Belagerung ${siegeGoal ? `${siegeGoal} min` : 'endlos'}` : mobMode === 'hunt' ? ' · Boss-Jagd' : ''), mobMode, siegeGoal, completed: !!player.won, splits: { ...run.splits }, timeTo100: run.splits[100] ?? null, peakMobs: run.peakMobs ?? 0, peakFps: run.peakFps ?? 0, mods: [...activeModIds()], mult: scoreMult(),
    score: b.total, breakdown: b, level: player.level, kills: run.kills, time: state.now, bestPull: run.bestPull, bestCombo: run.bestCombo, bestMulti: run.bestMulti,
    zone: zone.name, cause: player.lastHitBy ?? 'Unbekannt', version: SCORE_VERSION, note: '', build: '',
  };
  const list = [...loadRuns(), entry];
  saveRuns(list);
  const rank = byScore(list.filter(r => r.mode === entry.mode && (r.mobMode ?? 'packs') === entry.mobMode && (r.siegeGoal ?? 0) === entry.siegeGoal)).indexOf(entry) + 1;
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

// Gleiche Kombination aus Figur, Mods und Mob-Modus: Darauf beziehen sich beide Ranglisten und die Splits
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
export function comboRuns() {
  const ids = activeModIds();
  return loadRuns().filter(r => Array.isArray(r.mods) && sameSet(r.mods, ids) && (r.mobMode ?? 'packs') === mobMode && (r.siegeGoal ?? 0) === siegeGoal);
}
export const byTime = list => list.filter(r => typeof r.timeTo100 === 'number').sort((a, b) => a.timeTo100 - b.timeTo100);

// Splits gegen den schnellsten Run derselben Kombination, grün heißt schneller
const fmtDiff = ms => { const t = Math.abs(ms) / 1000; return `${ms < 0 ? '−' : '+'}${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
export function noteSplits(fromLevel) {
  for (const lvl of META.splits) {
    if (fromLevel >= lvl || player.level < lvl) continue;
    run.splits[lvl] = state.now;
    const best = byTime(comboRuns())[0]?.splits?.[lvl];
    const el = $('hSplit');
    el.textContent = typeof best === 'number' ? `L${lvl} ${fmtDiff(state.now - best)}` : `L${lvl}`;
    el.style.color = typeof best !== 'number' ? '' : state.now <= best ? COLORS.good : COLORS.bad;
  }
}
export function resetSplits() { const el = $('hSplit'); el.textContent = '–'; el.style.color = ''; }
