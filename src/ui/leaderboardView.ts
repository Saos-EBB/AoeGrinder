// Modus-Auswahl und Run-Ergebnis. Hängt sich selbst ein, damit menus.ts und index.html unberührt bleiben.

import { MODES, MODIFIERS, modeId, setMode, toggleCustomMod, activeModIds, scoreMult } from '../modifiers';
import { resetGame } from '../player';
import { player } from '../state';
import { recordRun, setNote } from '../leaderboard';

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
  #runResult { margin-bottom: 14px; }
  #runResult table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  #runResult td { padding: 2px 0; text-align: left; color: #ddd; }
  #runResult td:last-child { text-align: right; color: #fff; font-weight: 600; }
  #runResult .sum td { border-top: 1px solid #b8913f; color: #f2c94c; font-size: 18px; font-weight: 700; }
  #runRank { margin: 8px 0; color: #c9b88a; }
  #runRecord { font: 700 22px Cinzel, serif; color: #ffe27a; }
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
