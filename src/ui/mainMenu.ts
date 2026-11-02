// Hauptmenü fullscreen und Pause-Menü. Die Figur steht groß in der Hauptszene und dreht sich, drumherum die Auswahl.

import { state, player } from '../state';
import { $ } from '../util';
import { MODIFIERS, MODES, modeId, mobMode, setMode, setCustomMods, activeModIds, scoreMult } from '../modifiers';
import { WEAPONS } from '../models/weapons/index';
import { mage } from '../models/mage';
import { cam } from '../camera';
import { loadRuns, byScore } from '../leaderboard';
import { resetGame, die } from '../player';
import { resetSpells, stopChannel } from '../spells/core';
import { renderActionbar } from './hud';
import { startHudEdit, hudEditing, stopHudEdit } from './hudLayout';
import { toggleChar } from './charWindow';
import { openBinds, closeBinds, syncPause, ding } from './menus';
import { UI } from './uiConfig';

const CHARS = [
  { mod: null, name: 'Kapuzenmagier', sub: 'Alle' },
  { mod: 'frost', name: 'Eis-Skelett', sub: 'Frost' },
  { mod: 'fire', name: 'Feuer-Skelett', sub: 'Feuer' },
  { mod: 'arcane', name: 'Arkan-Skelett', sub: 'Arkan' },
  { mod: 'realmen', name: 'Skelett-Krieger', sub: 'Real Men' },
];
const CHAR_MODS = CHARS.map(c => c.mod).filter(Boolean);
const chips = MODIFIERS.filter(m => !CHAR_MODS.includes(m.id));
const fmtMult = v => `×${String(v).replace('.', ',')}`;
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

let charIdx = 0, picked = [];

// Figur und Mods ergeben den Modus: passt ein fester Modus, gilt der, sonst die eigene Mischung. Darauf baut die Rangliste auf.
function applySelection() {
  const ids = [...(CHARS[charIdx].mod ? [CHARS[charIdx].mod] : []), ...picked];
  const preset = MODES.find(m => m.mods && sameSet(m.mods, ids));
  if (preset) setMode(preset.id);
  else { setCustomMods(ids); setMode('custom'); }
  resetGame();
  renderMenu();
}
export function cycleChar(step) {
  charIdx = (charIdx + step + CHARS.length) % CHARS.length;
  applySelection();
}

function button(cls, text, onClick, title = '') {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  b.title = title;
  b.dataset.nav = text;
  b.addEventListener('click', onClick);
  return b;
}

function renderBoardPanel() {
  const ids = activeModIds();
  const rows = byScore(loadRuns().filter(r => Array.isArray(r.mods) && sameSet(r.mods, ids) && (r.mobMode ?? 'packs') === mobMode)).slice(0, UI.boardRows);
  const box = $('menuBoard');
  box.textContent = '';
  if (!rows.length) { box.textContent = 'Noch keine Runs mit dieser Kombination.'; return; }
  const table = document.createElement('table');
  rows.forEach((r, i) => {            // Importierte Einträge sind fremde Daten: nur textContent
    const tr = table.insertRow();
    for (const v of [i + 1, Math.round(r.score).toLocaleString('de-DE'), `Lv ${r.level}`]) tr.insertCell().textContent = String(v);
  });
  box.appendChild(table);
}

export function renderMenu() {
  const nav = document.querySelector<HTMLElement>('#startModal .navSel')?.dataset.nav;
  const chars = $('menuChars');
  chars.innerHTML = '';
  CHARS.forEach((c, i) => {
    const b = button('charTab' + (i === charIdx ? ' selected' : ''), c.name, () => { charIdx = i; applySelection(); });
    b.insertAdjacentHTML('beforeend', `<small>${c.sub}</small>`);
    chars.appendChild(b);
  });
  const ids = activeModIds(), mods = $('menuMods');
  mods.innerHTML = '';
  for (const m of chips) {
    const blocked = m.excludes.some(x => ids.includes(x));
    const b = button('chip' + (picked.includes(m.id) ? ' selected' : ''), `${m.name} ${fmtMult(m.scoreMult)}`, () => {
      picked = picked.includes(m.id) ? picked.filter(x => x !== m.id) : [...picked, m.id];
      applySelection();
    }, m.desc);
    b.disabled = blocked;
    mods.appendChild(b);
  }
  const weapons = $('menuWeapons');
  weapons.innerHTML = '';
  $('menuWeaponBox').hidden = !mage.weapon;
  if (mage.weapon) for (const w of WEAPONS) {
    weapons.appendChild(button('chip' + (w.id === mage.weapon.id ? ' selected' : ''), w.name, () => { mage.setWeapon(w.id); renderMenu(); }, w.arch));
  }
  $('menuTitle').textContent = CHARS[charIdx].name;
  const names = MODIFIERS.filter(m => ids.includes(m.id)).map(m => m.desc).join(' · ');
  $('menuInfo').textContent = `${names || 'Keine Modifikatoren'} · Punkte ${fmtMult(scoreMult())}`;
  renderBoardPanel();
  if (nav) document.querySelector(`#startModal [data-nav="${CSS.escape(nav)}"]`)?.classList.add('navSel');
}

// Kamera nah an der Figur, solange das Menü offen ist
let camSaved = null;
export const menuOpen = () => $('startModal').classList.contains('show');
export function menuSpin(dt) {
  if (!menuOpen()) return 0;
  spin += dt / 1000 * UI.menuSpin;
  return spin;
}
let spin = Math.PI;
export function enterMenu() {
  camSaved ??= { dist: cam.dist, pitch: cam.pitch, offset: cam.offset };
  Object.assign(cam, { dist: UI.menuCam.dist, pitch: UI.menuCam.pitch, offset: 0 });
  document.body.classList.add('menu');
  $('startModal').classList.add('show');
  renderMenu();
  syncPause();
}
function leaveMenu() {
  if (camSaved) Object.assign(cam, camSaved);
  camSaved = null;
  document.body.classList.remove('menu');
  $('startModal').classList.remove('show');
}

export function startRun() {
  leaveMenu();
  resetSpells();                       // erst jetzt steht der Modus fest und damit das Start-Kit
  renderActionbar();
  syncPause();
  ding();
}
$('startBtn').addEventListener('click', startRun);
$('menuSettings').addEventListener('click', () => { $('settingsModal').classList.add('show'); });
$('settingsClose').addEventListener('click', () => { $('settingsModal').classList.remove('show'); syncPause(); });
$('menuBinds').addEventListener('click', openBinds);
function editHud(backdrop) {
  $(backdrop).classList.add('hudHide');
  document.body.classList.remove('menu');
  startHudEdit(() => {
    $(backdrop).classList.remove('hudHide');
    if (menuOpen()) document.body.classList.add('menu');
  });
}
$('menuEdit').addEventListener('click', () => editHud('startModal'));

// Zurück ins Hauptmenü, zum Beispiel nach dem Tod
export function toMainMenu() {
  $('deathModal').classList.remove('show');
  stopChannel(true);
  resetGame();
  enterMenu();
}
$('deathMenuBtn').addEventListener('click', toMainMenu);

// Pause-Menü
export const pauseOpen = () => $('pauseModal').classList.contains('show');
export function openPause() {
  if (state.paused || player.dead) return;
  $('pauseModal').classList.add('show');
  syncPause();
}
export function closePause() {
  $('pauseModal').classList.remove('show');
  syncPause();
}
$('pauseResume').addEventListener('click', closePause);
$('pauseChar').addEventListener('click', () => toggleChar());
$('pauseEdit').addEventListener('click', () => editHud('pauseModal'));
$('pauseBinds').addEventListener('click', openBinds);
$('pauseGiveUp').addEventListener('click', () => {
  $('pauseModal').classList.remove('show');
  player.lastHitBy = 'Aufgegeben';
  die();
});

// Tastatur: A/D wechselt die Figur, Enter löst den fokussierten Knopf aus, Esc beendet das Bearbeiten
addEventListener('keydown', e => {
  if (hudEditing()) { if (e.code === 'Escape') { e.stopImmediatePropagation(); stopHudEdit(); } return; }
  if (!menuOpen() || state.rebinding || ['bindModal', 'settingsModal', 'boardModal'].some(id => $(id)?.classList.contains('show'))) return;
  if (e.code === 'KeyA') cycleChar(-1);
  if (e.code === 'KeyD') cycleChar(1);
}, true);

