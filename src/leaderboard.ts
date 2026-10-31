// Lokale Rangliste. Nur im Browser des Spielers, Lesen und Schreiben dürfen fehlschlagen.

import { state, player } from './state';
import { SCORE_VERSION } from './config';
import { MODES, modeId, activeModIds, scoreMult } from './modifiers';
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
    date: new Date().toISOString(), mode: modeId, modeName: MODES.find(m => m.id === modeId).name, mods: [...activeModIds()], mult: scoreMult(),
    score: b.total, breakdown: b, level: player.level, kills: run.kills, time: state.now, bestPull: run.bestPull, bestCombo: run.bestCombo, bestMulti: run.bestMulti,
    zone: zone.name, cause: player.lastHitBy ?? 'Unbekannt', version: SCORE_VERSION, note: '', build: '',
  };
  const list = [...loadRuns(), entry];
  saveRuns(list);
  const rank = byScore(list.filter(r => r.mode === entry.mode)).indexOf(entry) + 1;
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
