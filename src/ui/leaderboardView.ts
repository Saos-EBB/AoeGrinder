// Modus-Auswahl, Run-Ergebnis und Ranglisten-Ansicht. Hängt sich selbst ein, damit menus.ts und index.html unberührt bleiben.

import { MODES, MODIFIERS, modeId, setMode, toggleCustomMod, activeModIds, scoreMult } from '../modifiers';
import { resetGame, setLevel } from '../player';
import { stopChannel, clearSpellEffects } from '../spells/core';
import { player } from '../state';
import { showColliders } from '../world';
import { recordRun, setNote, loadRuns, byScore, exportRuns, importRuns } from '../leaderboard';

const fmtMult = v => `×${String(Math.round(v * 100) / 100).replace('.', ',')}`;
const $ = id => document.getElementById(id);

document.head.insertAdjacentHTML('beforeend', `<style>
  #startModal .panel { max-height: 96vh; overflow: auto; }
  #modePick { margin: 10px 0 14px; text-align: left; }
  #modeBtns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  #modeMods { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 12px; margin-top: 8px; font-size: 13px; }
  #modeMods label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
  #modeInfo { margin-top: 6px; font-size: 13px; color: #c9b88a; }
  #deathModal .panel { max-height: 96vh; overflow: auto; }
  #devLevels { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 4px; }
  #runResult { margin-bottom: 14px; }
  #runResult table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  #runResult td { padding: 2px 0; text-align: left; color: #ddd; }
  #runResult td:last-child { text-align: right; color: #fff; font-weight: 600; }
  #runResult .sum td { border-top: 1px solid #b8913f; color: #f2c94c; font-size: 18px; font-weight: 700; }
  #runRank { margin: 8px 0; color: #c9b88a; }
  #runRecord { font: 700 22px Cinzel, serif; color: #ffe27a; }
  #boardModal { z-index: 4; }
  #boardModal .panel { width: min(760px, 96vw); max-width: none; max-height: 94vh; overflow: auto; text-align: left; }
  #boardTabs { display: flex; flex-wrap: wrap; gap: 4px; margin: 10px 0; }
  #boardBar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 13px; color: #c9b88a; }
  #boardVersion { font: 13px system-ui, sans-serif; background: #000a; color: #fff; border: 1px solid #6b5426; }
  #boardTable { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  #boardTable th { text-align: right; color: #f2c94c; font-weight: 600; padding: 3px 6px; }
  #boardTable td { text-align: right; padding: 3px 6px; border-top: 1px solid #b8913f33; color: #eee; }
  #boardTable th:nth-child(-n+2), #boardTable td:nth-child(-n+2) { text-align: left; }
  #boardTable tbody tr { cursor: pointer; }
  #boardTable tbody tr:hover, #boardTable tr.open { background: #ffffff14; }
  #boardTable tr.best td { color: #ffe27a; font-weight: 700; }
  #boardEmpty { padding: 14px 0; color: #c9b88a; }
  #boardDetail { margin: 10px 0; padding: 8px 10px; border: 1px solid #6b5426; border-radius: 3px; font-size: 13px; color: #ddd; display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 2px 14px; }
  #boardDetail b { color: #f2c94c; font-weight: 600; }
  #boardIo { width: 100%; height: 70px; margin: 8px 0 4px; font: 12px monospace; background: #000a; color: #fff; border: 1px solid #6b5426; border-radius: 3px; }
  #boardMsg { min-height: 18px; font-size: 13px; color: #9cc4ff; }
  #runNote { width: 100%; font: 13px system-ui, sans-serif; padding: 4px; background: #000a; color: #fff; border: 1px solid #6b5426; border-radius: 3px; }
</style>`);
$('startBtn').insertAdjacentHTML('beforebegin', `<div id="modePick"><div class="title" style="margin-bottom:6px">Modus</div>
  <div id="modeBtns"></div><div id="modeMods"></div><div id="modeInfo"></div></div>`);

// Modifikatoren wirken beim Aufbau des Runs: Mobs und Werte neu
function changed() {
  resetGame();
  renderPick();
}

function renderPick() {
  const btns = $('modeBtns'), box = $('modeMods');
  btns.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button');
    b.className = 'bindBtn' + (m.id === modeId ? ' selected' : '');
    b.textContent = m.name;
    b.addEventListener('click', () => { setMode(m.id); changed(); });
    btns.appendChild(b);
  }
  box.innerHTML = '';
  if (modeId === 'custom') for (const mod of MODIFIERS) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = activeModIds().includes(mod.id);
    input.addEventListener('change', () => { toggleCustomMod(mod.id); changed(); });
    label.append(input, `${mod.name} (${fmtMult(mod.scoreMult)})`);
    label.title = mod.desc;
    box.appendChild(label);
  }
  const names = MODIFIERS.filter(m => activeModIds().includes(m.id)).map(m => m.desc).join(' · ');
  $('modeInfo').textContent = `${names || 'Keine Modifikatoren'} · Punkte ${fmtMult(scoreMult())}`;
}
renderPick();

// Tippen in Textfeldern darf nicht beim Spiel ankommen
export function ownKeys(el) { el.addEventListener('keydown', e => e.stopPropagation()); }

const fmt = n => Math.round(n).toLocaleString('de-DE');

$('deathStats').insertAdjacentHTML('afterend', `<div id="runResult"></div>`);

// Beim Tod: speichern und Aufschlüsselung zeigen
export function showRunResult() {
  const { entry, rank } = recordRun(), b = entry.breakdown;
  const box = $('runResult');
  box.innerHTML = `<div id="runRecord"></div><table>
    <tr><td>Kills (${fmt(entry.kills)}), Modus ${fmtMult(entry.mult)}</td><td>${fmt(b.kills)}</td></tr>
    <tr><td>Größter Pull (${fmt(entry.bestPull)} Mobs)</td><td>+${fmt(b.pull)}</td></tr>
    <tr><td>Überlebenszeit</td><td>+${fmt(b.time)}</td></tr>
    <tr class="sum"><td>Punkte</td><td>${fmt(b.total)}</td></tr></table>
    <div id="runRank"></div>
    <input id="runNote" maxlength="120" placeholder="Notiz zum Run (optional)">`;
  $('runRecord').textContent = rank === 1 && entry.score > 0 ? 'Neuer Rekord!' : '';
  $('runRank').textContent = `Platz ${rank} in ${entry.modeName} · Ursache: ${entry.cause} · Längste Combo ${entry.bestCombo} · Bester Multi-Kill ×${entry.bestMulti}`;
  const note = $('runNote') as HTMLInputElement;
  ownKeys(note);
  note.addEventListener('change', () => setNote(entry.date, note.value));
  document.querySelector('#deathModal h1').textContent = player.lastHitBy === 'Zeitlimit' ? 'Zeit abgelaufen' : 'Du bist gestorben';
}

// ---------- Ranglisten-Ansicht ----------
const TABS = [...MODES.map(m => ({ id: m.id, name: m.id === 'custom' ? 'Eigene Mischungen' : m.name })), { id: 'all', name: 'Alle' }];
const TOP = 10;
let tab = 'normal', versionFilter = '', openDate = null;

document.body.insertAdjacentHTML('beforeend', `<div id="boardModal" class="modal"><div class="frame panel">
  <h1 class="title" style="font-size:26px">Rangliste</h1>
  <div id="boardTabs"></div>
  <div id="boardBar"><label for="boardVersion">Spielversion</label><select id="boardVersion"></select></div>
  <div id="boardList"></div>
  <div id="boardDetailBox"></div>
  <textarea id="boardIo" placeholder="Export landet hier, falls das Kopieren nicht klappt. Zum Import JSON einfügen."></textarea>
  <div id="boardMsg" role="status"></div>
  <div class="row2">
    <button class="smallBtn" id="boardExport" style="width:auto;padding:6px 14px">Export kopieren</button>
    <button class="smallBtn" id="boardImport" style="width:auto;padding:6px 14px">Importieren</button>
    <button class="smallBtn" id="boardClose" style="width:auto;padding:6px 14px">Schließen</button>
  </div>
</div></div>`);
ownKeys($('boardIo'));

function cell(row, text) { const td = document.createElement('td'); td.textContent = text; row.appendChild(td); }
const fmtTime = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const fmtDate = d => new Date(d).toLocaleDateString('de-DE');
// Importierte Einträge sind fremde Daten: nur über textContent ausgeben und fehlende Felder abfangen
const num = v => (typeof v === 'number' ? fmt(v) : '–');
const modNames = r => (Array.isArray(r.mods) ? r.mods.map(id => MODIFIERS.find(m => m.id === id)?.name ?? String(id)).join(', ') : '') || 'keine';

function renderBoard() {
  const tabs = $('boardTabs');
  tabs.innerHTML = '';
  for (const t of TABS) {
    const b = document.createElement('button');
    b.className = 'bindBtn' + (t.id === tab ? ' selected' : '');
    b.textContent = t.name;
    b.addEventListener('click', () => { tab = t.id; openDate = null; renderBoard(); });
    tabs.appendChild(b);
  }
  const all = loadRuns();
  const versions = [...new Set(all.map(r => r.version).filter(v => typeof v === 'string'))];
  const sel = $('boardVersion') as HTMLSelectElement;
  sel.innerHTML = '';
  for (const v of ['', ...versions]) sel.add(new Option(v || 'Alle', v));
  if (!versions.includes(versionFilter)) versionFilter = '';
  sel.value = versionFilter;

  const rows = byScore(all.filter(r => (tab === 'all' || r.mode === tab) && (!versionFilter || r.version === versionFilter))).slice(0, TOP);
  const list = $('boardList');
  list.innerHTML = '';
  if (!rows.length) { list.innerHTML = '<div id="boardEmpty">Noch keine Runs in dieser Auswahl.</div>'; $('boardDetailBox').innerHTML = ''; return; }
  const table = document.createElement('table');
  table.id = 'boardTable';
  table.innerHTML = '<thead><tr><th>#</th><th>Modus</th><th>Punkte</th><th>Level</th><th>Kills</th><th>Zeit</th><th>Datum</th></tr></thead>';
  const body = table.createTBody();
  rows.forEach((r, i) => {
    const tr = body.insertRow();
    tr.className = (i === 0 ? 'best ' : '') + (r.date === openDate ? 'open' : '');
    cell(tr, i === 0 ? '★' : String(i + 1));
    cell(tr, r.modeName ?? r.mode);
    cell(tr, num(r.score)); cell(tr, num(r.level)); cell(tr, num(r.kills));
    cell(tr, typeof r.time === 'number' ? fmtTime(r.time) : '–');
    cell(tr, fmtDate(r.date));
    tr.addEventListener('click', () => { openDate = openDate === r.date ? null : r.date; renderBoard(); });
  });
  list.appendChild(table);
  renderDetail(rows.find(r => r.date === openDate));
}

function renderDetail(r) {
  const box = $('boardDetailBox');
  box.innerHTML = '';
  if (!r) return;
  const grid = document.createElement('div');
  grid.id = 'boardDetail';
  const add = (label, value) => {
    const d = document.createElement('div'), b = document.createElement('b');
    b.textContent = `${label}: `;
    d.append(b, String(value ?? '–'));
    grid.appendChild(d);
  };
  add('Modifikatoren', modNames(r));
  add('Multiplikator', typeof r.mult === 'number' ? fmtMult(r.mult) : '–');
  add('Größter Pull', r.bestPull);
  add('Längste Combo', r.bestCombo);
  add('Bester Multi-Kill', r.bestMulti);
  add('Zone', r.zone);
  add('Todesursache', r.cause);
  add('Spielversion', r.version);
  if (r.note) add('Notiz', r.note);
  box.appendChild(grid);
}

const boardOpen = () => $('boardModal').classList.contains('show');
function openBoard() { $('boardMsg').textContent = ''; renderBoard(); $('boardModal').classList.add('show'); }
function closeBoard() { $('boardModal').classList.remove('show'); }

$('boardClose').addEventListener('click', closeBoard);
$('boardVersion').addEventListener('change', e => { versionFilter = (e.target as HTMLSelectElement).value; openDate = null; renderBoard(); });
$('boardExport').addEventListener('click', async () => {
  const json = exportRuns();
  try {
    await navigator.clipboard.writeText(json);
    $('boardMsg').textContent = `${loadRuns().length} Runs in die Zwischenablage kopiert.`;
  } catch {
    const io = $('boardIo') as HTMLTextAreaElement;
    io.value = json;
    io.select();
    $('boardMsg').textContent = 'Kopieren nicht möglich. Das JSON steht markiert im Textfeld.';
  }
});
$('boardImport').addEventListener('click', () => {
  const io = $('boardIo') as HTMLTextAreaElement;
  try {
    const added = importRuns(io.value);
    $('boardMsg').textContent = `${added} neue Runs importiert.`;
    io.value = '';
    renderBoard();
  } catch {
    $('boardMsg').textContent = 'Das ist kein gültiges Ranglisten-JSON. Bitte den kompletten Export einfügen.';
  }
});
// Esc schließt nur die Rangliste, nicht das Menü darunter
addEventListener('keydown', e => {
  if (e.code !== 'Escape' || !boardOpen()) return;
  e.stopImmediatePropagation();
  closeBoard();
}, true);

// Aufruf aus Start-, Esc- und Todesbildschirm
const boardButton = (cls, style) => {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = 'Rangliste';
  b.setAttribute('style', style);
  b.addEventListener('click', openBoard);
  return b;
};
$('startBtn').after(boardButton('smallBtn', 'display:block;width:auto;margin:10px auto 0;padding:6px 14px'));
$('restartBtn').after(boardButton('smallBtn', 'display:block;width:auto;margin:10px auto 0;padding:6px 14px'));
document.querySelector('#bindModal .row2').prepend(boardButton('smallBtn', 'width:auto;padding:6px 14px'));

// Dev: Level setzen
$('devZones').insertAdjacentHTML('afterend', `<div class="title" style="text-align:left;margin-bottom:6px">Dev: Level setzen</div><div id="devLevels"></div>`);
for (const level of [1, 15, 16, 30, 31, 45, 46, 60, 61, 100]) {
  const b = document.createElement('button');
  b.className = 'bindBtn';
  b.textContent = String(level);
  b.addEventListener('click', () => { stopChannel(true); clearSpellEffects(); setLevel(level); $('bindsClose').click(); });
  $('devLevels').appendChild(b);
}

// Dev: Collider anzeigen
$('devLevels').insertAdjacentHTML('afterend', `<button class="bindBtn" id="devColliders" style="width:100%;margin-bottom:4px">Collider anzeigen: aus</button>`);
let collidersOn = false;
$('devColliders').addEventListener('click', () => {
  collidersOn = !collidersOn;
  showColliders(collidersOn);
  $('devColliders').textContent = `Collider anzeigen: ${collidersOn ? 'an' : 'aus'}`;
});
