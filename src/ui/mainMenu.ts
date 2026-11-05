// Hauptmenü fullscreen und Pause-Menü. Die Figur steht groß in der Hauptszene, drumherum die Auswahl.

import { state, player } from '../state';
import { $ } from '../util';
import { MODIFIERS, MODES, mobMode, setMode, setCustomMods, activeModIds, scoreMult, cardPaceId, setCardPace } from '../modifiers';
import { CARD_PACES } from '../config';
import { mage } from '../models/mage';
import { cam, autoCamOn, setAutoCam } from '../camera';
import { SHAKE_MODES, shakeModeNow, setShakeMode } from '../wucht';
import { byScore, byTime, comboRuns } from '../leaderboard';
import { meta } from '../meta';
import { WAR_WEAPON_NAMES } from '../realMen';
import { KLINGE_WEAPON_NAMES } from '../klinge';
import { equip, equipped, weaponName, rarityOf, applyRunWeapon, sortedInv } from '../weaponRolls';
import { attachWeaponCard } from './weaponCard';
import { fmtTime } from './hud';
import { resetGame, die } from '../player';
import { resetSpells, stopChannel } from '../spells/core';
import { renderActionbar } from './hud';
import { startHudEdit, hudEditing, stopHudEdit } from './hudLayout';
import { toggleChar } from './charWindow';
import { openBinds, syncPause, ding } from './menus';
import { UI } from './uiConfig';
import { renderKit, currentKit } from './spellCard';
import { startKit } from '../spells/core';

const CHARS = [
  { mod: null, name: '?-Magier', sub: 'Zufall aus allen Schulen' },
  { mod: 'frost', name: 'Eismagier', sub: 'Frost' },
  { mod: 'fire', name: 'Feuermagier', sub: 'Feuer' },
  { mod: 'arcane', name: 'Arkanmagier', sub: 'Arkan' },
  { mod: 'blitz', name: 'Blitzmagier', sub: 'Blitz und Batterie' },
  { mod: 'plague', name: 'Seuchenmagier', sub: 'Male und Gift, Leben als Kosten' },
  { mod: 'realmen', name: 'Strichkrieger', sub: 'Wut und Riesenschwert' },
  { mod: 'klinge', name: 'Klingenstrich', sub: 'Tempo und Blutung' },
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
  const runs = comboRuns();
  const fill = (box, rows, cells, empty) => {
    box.textContent = '';
    if (!rows.length) { box.textContent = empty; return; }
    const table = document.createElement('table');
    rows.forEach((r, i) => {          // Importierte Einträge sind fremde Daten: nur textContent
      const tr = table.insertRow();
      for (const v of [i + 1, ...cells(r)]) tr.insertCell().textContent = String(v);
    });
    box.appendChild(table);
  };
  fill($('menuBoard'), byScore(runs).slice(0, UI.boardRows), r => [Math.round(r.score).toLocaleString('de-DE'), `Lv ${r.level}`], 'Noch keine Runs mit dieser Kombination.');
  fill($('menuTimeBoard'), byTime(runs).slice(0, UI.boardRows), r => [fmtTime(r.timeTo100), `${r.kills} Kills`], mobMode === 'packs' ? 'Noch kein Run bis Level 100.' : 'Nur bei Packs.');
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
  const cardRow = $('menuCards');
  cardRow.innerHTML = '';
  for (const c of CARD_PACES) cardRow.appendChild(button('chip' + (c.id === cardPaceId ? ' selected' : ''), c.name, () => { setCardPace(c.id); renderMenu(); }, c.title));
  const weapons = $('menuWeapons');
  weapons.innerHTML = '';
  $('menuWeaponBox').hidden = !mage.weapon && mage.skin !== 'krieger' && mage.skin !== 'klinge';
  if (mage.skin === 'krieger') for (const [id, name] of Object.entries(WAR_WEAPON_NAMES))   // Strichkrieger: feste Waffe vor dem Run
    weapons.appendChild(button('chip' + (id === mage.warWeapon ? ' selected' : ''), name, () => { mage.setWarWeapon(id); applySelection(); }));
  if (mage.skin === 'klinge') for (const [id, name] of Object.entries(KLINGE_WEAPON_NAMES))   // Klingenstrich: Standard oder Thunderfury
    weapons.appendChild(button('chip' + (id === mage.klingeWeapon ? ' selected' : ''), name, () => { mage.setKlingeWeapon(id); renderMenu(); }));
  // Waffenwahl aus dem Inventar, nur Magier. Leer oder abgewählt: Pilgerast ohne Effekt
  if (mage.weapon) {
    const pickW = id => { equip(id); mage.refreshWeapon(); renderMenu(); };
    weapons.appendChild(button('chip' + (!equipped() ? ' selected' : ''), 'Pilgerast (ohne Effekt)', () => pickW(null)));
    let group = null;
    for (const w of sortedInv()) {                     // nach Seltenheit gruppiert, damit auch 50 Waffen lesbar bleiben
      if (rarityOf(w) !== group) {
        group = rarityOf(w);
        const n = meta.inv.filter(x => x.r === w.r).length;
        weapons.appendChild(Object.assign(document.createElement('div'), { className: 'invGroup', textContent: `${group.name} · ${n}` })).style.color = group.color;
      }
      const b = button('chip' + (equipped() === w ? ' selected' : ''), weaponName(w), () => pickW(w.id));   // Details zeigt die Info-Karte beim Hovern
      b.style.borderColor = rarityOf(w).color;
      b.style.color = rarityOf(w).color;
      attachWeaponCard(b, w);
      weapons.appendChild(b);
    }
  }
  $('menuTitle').textContent = CHARS[charIdx].name;
  renderKit($('menuKit'), startKit());   // Start-Kit mit Info-Karten
  const names = MODIFIERS.filter(m => ids.includes(m.id)).map(m => m.desc).join(' · ');
  $('menuInfo').textContent = `${names || 'Keine Modifikatoren'} · Punkte ${fmtMult(scoreMult())}`;
  $('menuDust').textContent = `Knochenstaub: ${meta.dust}`;
  renderBoardPanel();
  if (nav) document.querySelector(`#startModal [data-nav="${CSS.escape(nav)}"]`)?.classList.add('navSel');
}

// Kamera nah an der Figur, solange das Menü offen ist
let camSaved = null;
export const menuOpen = () => $('startModal').classList.contains('show');
// Im Menü schaut die Figur zur Kamera; Ziehen auf der freien Fläche dreht sie, das Mausrad zoomt
let menuTurn = 0, turning = null;
export const menuYaw = () => menuOpen() ? Math.PI + menuTurn : 0;
$('startModal').addEventListener('pointerdown', e => { if (e.target === $('startModal')) turning = e.clientX; });
addEventListener('pointermove', e => {
  if (turning === null) return;
  menuTurn += (e.clientX - turning) * UI.menuCam.turnPerPx;
  turning = e.clientX;
});
addEventListener('pointerup', () => { turning = null; });
$('startModal').addEventListener('wheel', e => {
  if (e.target !== $('startModal')) return;           // In den Listen scrollt das Rad weiter
  const { minDist, maxDist, zoomStep } = UI.menuCam;
  cam.dist = Math.min(maxDist, Math.max(minDist, cam.dist + Math.sign(e.deltaY) * zoomStep));
}, { passive: true });
export function enterMenu() {
  camSaved ??= { dist: cam.dist, pitch: cam.pitch, offset: cam.offset };
  Object.assign(cam, { dist: UI.menuCam.dist, pitch: UI.menuCam.pitch, offset: 0 });
  menuTurn = 0;
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

function startRun() {
  leaveMenu();
  resetSpells();                       // erst jetzt steht der Modus fest und damit das Start-Kit
  applyRunWeapon(!!mage.weapon);
  renderActionbar();
  syncPause();
  ding();
}
$('startBtn').addEventListener('click', startRun);
const openSettings = () => { $('settingsModal').classList.add('show'); };
$('menuSettings').addEventListener('click', openSettings);
$('pauseSettings').addEventListener('click', openSettings);
$('settingsClose').addEventListener('click', () => { $('settingsModal').classList.remove('show'); syncPause(); });
$('menuBinds').addEventListener('click', openBinds);
const showAutoCam = () => { $('setAutoCam').textContent = `Auto-Kamera: ${autoCamOn() ? 'an' : 'aus'}`; $('setAutoCam').title = 'Die Kamera dreht sich mit der Laufrichtung, auch beim Seitwärtslaufen'; };
$('setAutoCam').addEventListener('click', () => { setAutoCam(!autoCamOn()); showAutoCam(); });
// Bildschirmwackeln: an, aus, stark
const shakeBtn = document.createElement('button');
shakeBtn.className = 'bindBtn';
const showShake = () => { shakeBtn.textContent = `Bildschirmwackeln: ${shakeModeNow()}`; };
shakeBtn.addEventListener('click', () => { setShakeMode(SHAKE_MODES[(SHAKE_MODES.indexOf(shakeModeNow()) + 1) % SHAKE_MODES.length]); showShake(); });
$('setGrafik').append(shakeBtn);
showShake();
showAutoCam();
export function editHud(backdrop) {
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
  renderKit($('pauseKit'), currentKit());   // aktuelle Slots mit Runen und Rängen
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
  if (e.target instanceof HTMLTextAreaElement) return;   // Spielstand-Code tippen
  if (hudEditing()) { if (e.code === 'Escape') { e.stopImmediatePropagation(); stopHudEdit(); } return; }
  if (!menuOpen() || state.rebinding || ['bindModal', 'settingsModal', 'boardModal', 'shopModal'].some(id => $(id)?.classList.contains('show'))) return;
  if (e.code === 'KeyA') cycleChar(-1);
  if (e.code === 'KeyD') cycleChar(1);
}, true);

