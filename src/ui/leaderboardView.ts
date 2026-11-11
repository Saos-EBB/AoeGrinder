// Modus-Auswahl, Run-Ergebnis und Ranglisten-Ansicht. Hängt sich selbst ein, damit menus.ts und index.html unberührt bleiben.

import { afterRun } from './shop';
import { charCard } from './mainMenu';
import { run } from '../score';
import { SPELLS } from '../config';
import { spellColor } from './colors';
import { META, meta } from '../meta';
import { MODES, MODIFIERS } from '../modifiers';
import { setLevel } from '../player';
import { stopChannel, clearSpellEffects } from '../spells/core';
import { player } from '../state';
import { showColliders } from '../world';
import { recordRun, setNote, loadRuns, byScore, exportRuns, importRuns, sameBoard, runZone } from '../leaderboard';
import { ZONES } from '../zones';
import { THEME_ZONES } from '../mapgen/registry';
import { zoneId } from '../world';
import { copySeed } from './worldMap';
import { t, locale } from '../i18n';
import { findsHtml, bindFinds } from './lootView';
import { fmtTime, fmtDiff, fmtInt, fmtMult } from './fmt';
import { esc, html } from './dom';

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
  #boardVersion, #boardMap { font: 13px system-ui, sans-serif; background: #000a; color: #fff; border: 1px solid #6b5426; }
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
</style>`);
// Tippen in Textfeldern darf nicht beim Spiel ankommen
function ownKeys(el) { el.addEventListener('keydown', e => e.stopPropagation()); }

const fmt = fmtInt;   // ganze Zahlen mit Tausenderpunkt (UI-Mix)


// Beim Tod: speichern und Aufschlüsselung zeigen
// Run-Ende (Mockups X?E, Look des UI-Flavors): Titel, Zeit groß mit Abstand zur Bestzeit und Rang, 5 Werte, Schaden nach Quelle (ganze Zahlen, Prozent klein), Staub-Rechnung
const fmtT = (ms: number) => fmtTime(ms, true);
export function showRunResult() {
  const { entry, rank } = recordRun(), b = entry.breakdown;
  const same = loadRuns().filter(r => sameBoard(r, entry));   // pro Map getrennt (leaderboard.ts)
  const best = same.filter(r => r !== entry && r.date !== entry.date && typeof r.timeTo100 === 'number').reduce((m, r) => Math.min(m, r.timeTo100), Infinity);
  $('endTitle').textContent = player.won && player.level >= 100 ? t('end.lv100') : player.won ? t('end.done') : player.lastHitBy === t('mod.time.name') ? t('end.timeUp', { n: player.level }) : t('end.fell', { n: player.level });
  const fig = charCard()?.name;
  $('endSub').textContent = [fig, entry.zone, entry.modeName !== fig ? entry.modeName : ''].filter(Boolean).join(' · ');
  const t100 = entry.timeTo100;
  const diff = typeof t100 === 'number' && Number.isFinite(best) ? t100 - best : null;
  const stat = (v, l) => `<div class="endStat"><b>${v}</b><span>${l}</span></div>`;
  const dmg = Object.entries<any>(run.dmgBySource ?? {}).sort((x, y) => y[1] - x[1]), total = dmg.reduce((s, [, v]) => s + v, 0);
  const top = dmg.slice(0, 6);
  const award = afterRun(!!player.won);
  $('runResult').innerHTML = `
    <div class="endTime">${fmtT(entry.time)}</div>
    <div class="endRank">${diff !== null ? `<span style="color:${diff <= 0 ? '#6ee7a0' : '#f87171'}">${t('end.best', { d: fmtDiff(diff) })}</span> · ` : typeof t100 === 'number' ? `<span style="color:#6ee7a0">${t('end.firstTime')}</span> · ` : ''}${t('end.rank', { a: rank, b: same.length })}${rank === 1 && entry.score > 0 ? ` · <b>${t('end.record')}</b>` : ''}</div>
    <div class="endStats">${stat(fmt(entry.kills), t('end.kills'))}${stat(fmt(b.total), t('end.points'))}${stat(fmt(entry.bestCombo), t('end.combo'))}${stat(`×${entry.bestMulti}`, t('end.multi'))}${stat(player.won ? 0 : 1, t('end.deaths'))}</div>
    <div class="endPoints">${t('end.breakdown', { kills: fmt(b.kills), mult: fmtMult(entry.mult), pull: fmt(entry.bestPull), pullPts: fmt(b.pull), time: fmt(b.time), cause: esc(entry.cause) })}</div>
    <div class="endCols">
      <div class="gPanel fg-panel endDmg"><div class="endDmgHead"><span class="fg-title">${t('end.dmgBySource')}</span><b>${total ? fmt(total) : '—'}</b></div>${top.length ? top.map(([id, v]) => {
        const s = SPELLS[id], c = spellColor(id, '#c4aea6'), p = Math.round(v / total * 100);
        return `<div class="endBar"><span>${esc(s?.name ?? t('hw.env'))}</span><i style="width:${Math.max(2, v / top[0][1] * 100)}%;background:${c}"></i><b>${fmt(v)}</b><small>${p} %</small></div>`;
      }).join('') : '<p>—</p>'}</div>
      <div class="gPanel fg-panel endDust"><div class="fg-title">${t('res.dust')}</div>
        <div class="endRow"><span>${t('end.dustLevel', { lv: entry.level, per: META.dust.perLevel, mult: fmtMult(entry.mult) })}</span><b>${award.base}</b></div>
        <div class="endRow"><span>${t('end.dustBonus')}${award.tier ? t('shop.tier', { n: award.tier }) : ''}</span><b>+${award.bonus}</b></div>
        <i class="tSep"></i>
        <div class="endRow sum"><span>${t('end.dustTotal', { n: meta.dust })}</span><b>+${award.dust}</b></div>
      </div>
    </div>
    <div id="runFinds">${findsHtml()}</div>
    ${entry.seed ? `<div class="seedLine"><span id="endSeed">${t(entry.seedFixed ? 'world.seedNowFixed' : 'world.seedNow', { n: entry.seed })}</span><button class="smallBtn" id="endSeedCopy">${t('world.seedCopy')}</button></div>` : ''}
    <input id="runNote" maxlength="120" placeholder="${t('end.note')}">`;
  $('endSeedCopy')?.addEventListener('click', () => copySeed($('endSeed')));
  const finds = () => bindFinds(() => { $('runFinds').innerHTML = findsHtml(); finds(); });   // Gear-Funde, Auswahl bei vollem Slot (lootView.ts)
  finds();
  const note = $('runNote') as HTMLInputElement;
  ownKeys(note);
  note.addEventListener('change', () => setNote(entry.date, note.value));
}

// ---------- Ranglisten-Ansicht ----------
const TABS = [...MODES.map(m => ({ id: m.id, name: m.id === 'custom' ? t('board.custom') : m.name })), { id: 'waves', name: t('board.waves') }, { id: 'all', name: t('board.all') }];
const TOP = 10;
let tab = 'normal', versionFilter = '', mapFilter: string | null = null, openDate = null;   // mapFilter: null = aktuelle Map, '' = alle

document.body.insertAdjacentHTML('beforeend', `<div id="boardModal" class="modal"><div class="frame panel">
  <h1 class="title" style="font-size:26px">${t('board.title')}</h1>
  <div id="boardTabs"></div>
  <div id="boardBar"><label for="boardMap">${t('board.map')}</label><select id="boardMap"></select><label for="boardVersion">${t('board.version')}</label><select id="boardVersion"></select></div>
  <div id="boardList"></div>
  <div id="boardDetailBox"></div>
  <textarea id="boardIo" placeholder="${t('board.io')}"></textarea>
  <div id="boardMsg" role="status"></div>
  <div class="row2">
    <button class="smallBtn" id="boardExport" style="width:auto;padding:6px 14px">${t('board.export')}</button>
    <button class="smallBtn" id="boardImport" style="width:auto;padding:6px 14px">${t('board.import')}</button>
    <button class="smallBtn" id="boardClose" style="width:auto;padding:6px 14px">${t('ui.close')}</button>
  </div>
</div></div>`);
ownKeys($('boardIo'));

function cell(row, text) { const td = document.createElement('td'); td.textContent = text; row.appendChild(td); }
const fmtDate = d => new Date(d).toLocaleDateString(locale);
// Importierte Einträge sind fremde Daten: nur über textContent ausgeben und fehlende Felder abfangen
const num = v => (typeof v === 'number' ? fmt(v) : '–');
const modNames = r => (Array.isArray(r.mods) ? r.mods.map(id => MODIFIERS.find(m => m.id === id)?.name ?? String(id)).join(', ') : '') || t('board.none');

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
  for (const v of ['', ...versions]) sel.add(new Option(v || t('board.all'), v));
  if (!versions.includes(versionFilter)) versionFilter = '';
  sel.value = versionFilter;

  // Map: Rangliste pro Theme getrennt, Standard = die gewählte Map; „Alle“ zeigt alles wie früher
  const maps = [...new Set([...THEME_ZONES.filter(id => ZONES[id]), ...all.map(runZone)])];
  const mapSel = $('boardMap') as HTMLSelectElement;
  mapSel.innerHTML = '';
  for (const id of ['', ...maps]) mapSel.add(new Option(id ? ZONES[id]?.name ?? id : t('board.all'), id));
  mapSel.value = mapFilter ?? (maps.includes(zoneId) ? zoneId : '');
  const mapNow = mapSel.value;
  const rows = byScore(all.filter(r => (tab === 'all' || (tab === 'waves' ? r.mobMode === 'waves' : r.mode === tab && (r.mobMode ?? 'packs') === 'packs')) && (!versionFilter || r.version === versionFilter) && (!mapNow || runZone(r) === mapNow))).slice(0, TOP);
  const list = $('boardList');
  list.innerHTML = '';
  if (!rows.length) { list.innerHTML = `<div id="boardEmpty">${t('board.empty')}</div>`; $('boardDetailBox').innerHTML = ''; return; }
  const table = document.createElement('table');
  table.id = 'boardTable';
  table.innerHTML = t('board.head');
  const body = table.createTBody();
  rows.forEach((r, i) => {
    const tr = body.insertRow();
    tr.className = (i === 0 ? 'best ' : '') + (r.date === openDate ? 'open' : '');
    cell(tr, i === 0 ? '★' : String(i + 1));
    cell(tr, MODES.find(m => m.id === r.mode) ? MODES.find(m => m.id === r.mode).name + (r.mobMode === 'waves' ? ` · ${t('board.waves')}` : '') : r.modeName ?? r.mode);   // Name aus der aktuellen Sprache, alte Einträge tragen ihn als Text
    if (r.seedFixed) tr.cells[1].textContent += ` · ${t('board.fixedSeed')}`;   // fester Seed (Speedrun), sonst zufällig
    cell(tr, num(r.score)); cell(tr, num(r.level)); cell(tr, num(r.kills));
    cell(tr, typeof r.time === 'number' ? fmtTime(r.time) : '–');
    cell(tr, fmtDate(r.date));
    tr.addEventListener('click', () => { openDate = openDate === r.date ? null : r.date; renderBoard(); });
  });
  list.appendChild(table);
  list.insertAdjacentHTML('beforeend', `<div style="opacity:.7;font-size:12px;margin-top:4px">${t('board.clickHint')}</div>`);
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
  add(t('board.d.mods'), modNames(r));
  add(t('board.d.mult'), typeof r.mult === 'number' ? fmtMult(r.mult) : '–');
  add(t('board.d.pull'), r.bestPull);
  add(t('board.d.combo'), r.bestCombo);
  add(t('board.d.multi'), r.bestMulti);
  add(t('board.d.zone'), r.zone);
  add(t('board.d.seed'), typeof r.seed === 'number' ? `${r.seed}${r.seedFixed ? ` (${t('board.fixedSeed')})` : ''}` : '–');
  add(t('board.d.cause'), r.cause);
  add(t('board.d.version'), r.version);
  add(t('board.d.build'), r.build || '–');   // Spells, Runen, Supports, Relikt und Waffe des Runs
  if (r.note) add(t('board.d.note'), r.note);
  box.appendChild(grid);
}

const boardOpen = () => $('boardModal').classList.contains('show');
function openBoard() { $('boardMsg').textContent = ''; renderBoard(); $('boardModal').classList.add('show'); }
function closeBoard() { $('boardModal').classList.remove('show'); }

$('boardClose').addEventListener('click', closeBoard);
$('boardMap').addEventListener('change', e => { mapFilter = (e.target as HTMLSelectElement).value; openDate = null; renderBoard(); });
$('boardVersion').addEventListener('change', e => { versionFilter = (e.target as HTMLSelectElement).value; openDate = null; renderBoard(); });
$('boardExport').addEventListener('click', async () => {
  const json = exportRuns();
  try {
    await navigator.clipboard.writeText(json);
    $('boardMsg').textContent = t('board.copied', { n: loadRuns().length });
  } catch {
    const io = $('boardIo') as HTMLTextAreaElement;
    io.value = json;
    io.select();
    $('boardMsg').textContent = t('board.copyFail');
  }
});
$('boardImport').addEventListener('click', () => {
  const io = $('boardIo') as HTMLTextAreaElement;
  try {
    const added = importRuns(io.value);
    $('boardMsg').textContent = t('board.imported', { n: added });
    io.value = '';
    renderBoard();
  } catch {
    $('boardMsg').textContent = t('board.badJson');
  }
});

// Aufruf aus Start-, Esc- und Todesbildschirm
const boardButton = (cls, style) => {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = t('board.title');
  b.setAttribute('style', style);
  b.addEventListener('click', openBoard);
  return b;
};
$('menuBoardBtn').append(boardButton('smallBtn', 'display:block;width:auto;margin:10px auto 0;padding:6px 14px'));
$('restartBtn').after(boardButton('smallBtn', 'display:block;width:auto;margin:10px auto 0;padding:6px 14px'));
document.querySelector('#bindModal .row2').prepend(boardButton('smallBtn', 'width:auto;padding:6px 14px'));

// Dev: Level setzen (Block für ui/devGame.ts)
export function devLevelsBlock() {
  const box = html('<div id="devLevels"></div>');
  for (const level of [1, 15, 16, 30, 31, 45, 46, 60, 61, 100]) {
    const b = document.createElement('button');
    b.className = 'bindBtn';
    b.textContent = String(level);
    b.addEventListener('click', () => { stopChannel(true); clearSpellEffects(); setLevel(level); $('settingsClose').click(); });
    box.appendChild(b);
  }
  return box;
}

// Dev: Collider anzeigen (Block für ui/devGame.ts)
let collidersOn = false;
export function devCollidersBlock() {
  const btn = html(`<button class="bindBtn" id="devColliders" style="width:100%;margin-bottom:4px">Collider anzeigen: aus</button>`);
  btn.addEventListener('click', () => {
    collidersOn = !collidersOn;
    showColliders(collidersOn);
    btn.textContent = `Collider anzeigen: ${collidersOn ? 'an' : 'aus'}`;
  });
  return btn;
}

// Fenster-Listener (E10): main.ts ruft mount() in der Reihenfolge von früher (Escape-Kette der Capture-Listener)
export function mount() {
  // Esc schließt nur die Rangliste, nicht das Menü darunter
  addEventListener('keydown', e => {
    if (e.code !== 'Escape' || !boardOpen()) return;
    e.stopImmediatePropagation();
    closeBoard();
  }, true);
}
