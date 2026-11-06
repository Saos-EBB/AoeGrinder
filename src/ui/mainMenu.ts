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
import { startHudEdit, hudEditing, stopHudEdit } from './hud/layout';
import { toggleChar } from './charWindow';
import { openBinds, syncPause, ding } from './menus';
import { UI } from './uiConfig';
import { renderKit, currentKit } from './spellCard';
import { startKit } from '../spells/core';
import { showLoad } from './loadScreen';
import { openInventory } from './inventory';

// color: Name in Schulfarbe (Phase 8, Mockup CharDiablo). stats: Schaden, Kontrolle, Überleben als Wertung 1–5 (Einschätzung, keine Rechnung)
const CHARS = [
  { mod: null, name: '?-Magier', sub: 'Zufall aus allen Schulen', color: '#f2e9e4', stats: [3, 3, 3] },
  { mod: 'frost', name: 'Eismagier', sub: 'Frost', color: '#7dd3fc', stats: [3, 5, 3] },
  { mod: 'fire', name: 'Feuermagier', sub: 'Feuer', color: '#fb923c', stats: [5, 1, 2] },
  { mod: 'arcane', name: 'Arkanmagier', sub: 'Arkan', color: '#c4b5fd', stats: [4, 3, 2] },
  { mod: 'blitz', name: 'Blitzmagier', sub: 'Blitz und Batterie', color: '#fde047', stats: [4, 3, 2] },
  { mod: 'plague', name: 'Seuchenmagier', sub: 'Male und Gift, Leben als Kosten', color: '#a3e635', stats: [3, 4, 2] },
  { mod: 'realmen', name: 'Strichkrieger', sub: 'Wut und Riesenschwert', color: '#f87171', stats: [4, 2, 5] },
  { mod: 'klinge', name: 'Klingenstrich', sub: 'Tempo und Blutung', color: '#e5e7eb', stats: [4, 3, 3] },
];
const STAT_NAMES = ['Schaden', 'Kontrolle', 'Überleben'], STAT_MAX = 5;
let boardMode: 'time' | 'score' = 'time';
const CHAR_MODS = CHARS.map(c => c.mod).filter(Boolean);
const chips = MODIFIERS.filter(m => !CHAR_MODS.includes(m.id));
const fmtMult = v => `×${String(v).replace('.', ',')}`;
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

let charIdx = 0, picked = [];
export const currentFigure = () => CHARS[charIdx];   // Name und Untertitel der gewählten Figur (HUD, Spielerrahmen)

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
  fill($('menuBoard'), byScore(runs).slice(0, UI.boardRows), r => [`Lv ${r.level}`, Math.round(r.score).toLocaleString('de-DE')], 'Noch keine Runs mit dieser Kombination.');
  fill($('menuTimeBoard'), byTime(runs).slice(0, UI.boardRows), r => [`${r.kills} Kills`, fmtTime(r.timeTo100)], mobMode === 'packs' ? 'Noch kein Run bis Level 100.' : 'Nur bei Packs.');
  $('menuBoard').hidden = boardMode !== 'score';
  $('menuTimeBoard').hidden = boardMode !== 'time';
  for (const b of $('menuBoardTabs').querySelectorAll<HTMLElement>('button')) b.classList.toggle('on', b.dataset.b === boardMode);
}

export function renderMenu() {
  const nav = document.querySelector<HTMLElement>('#startModal .navSel')?.dataset.nav;
  const chars = $('menuChars');
  chars.innerHTML = '';
  CHARS.forEach((c, i) => {
    const b = button('charTab' + (i === charIdx ? ' selected' : ''), '', () => { charIdx = i; applySelection(); }, c.name);
    b.dataset.nav = c.name;
    b.style.setProperty('--fc', c.color);
    b.innerHTML = `<b>${c.name.charAt(0)}</b><small>${c.name}</small>`;
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
  const hasWeapons = !!mage.weapon || mage.skin === 'krieger' || mage.skin === 'klinge';
  $('menuWeaponsBtn').hidden = !hasWeapons;
  if (!hasWeapons) $('menuWeaponBox').hidden = true;
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
  const fig = CHARS[charIdx];
  $('menuTitle').textContent = fig.name;
  $('menuTitle').style.color = fig.color;
  $('menuRole').textContent = fig.sub;
  $('menuStats').innerHTML = STAT_NAMES.map((n, i) => `<div class="menuStat" title="${fig.stats[i]} von ${STAT_MAX}"><span>${n}</span><b>${Array.from({ length: STAT_MAX }, (_, k) => `<i${k < fig.stats[i] ? ` class="on" style="--fc:${fig.color}"` : ''}></i>`).join('')}</b></div>`).join('');
  renderKit($('menuKit'), startKit());   // Start-Kit mit Info-Karten
  const names = MODIFIERS.filter(m => ids.includes(m.id)).map(m => m.desc).join(' · ');
  $('menuInfo').textContent = `${names || 'Keine Modifikatoren'} · Punkte ${fmtMult(scoreMult())}`;
  $('menuDust').textContent = `Knochenstaub ${meta.dust}`;
  renderBoardPanel();
  if (nav) document.querySelector(`#startModal [data-nav="${CSS.escape(nav)}"]`)?.classList.add('navSel');
}

// Kamera nah an der Figur, solange das Menü offen ist
let camSaved = null;
export const menuOpen = () => $('startModal').classList.contains('show');
// Im Menü schaut die Figur zur Kamera; Ziehen auf der freien Fläche dreht sie, das Mausrad zoomt
let menuTurn = 0, turning = null;
export const menuYaw = () => menuOpen() ? Math.PI + menuTurn : 0;
// Im Menü läuft die Figur ihre Ladungsstufen durch (Magier: Anzeige 0 … voll, Krieger: Wut, Klinge: Haltung 3 bei voll)
const SHOWCASE = { stepMs: 1600, values: [0, 0.3, 0.6, 1] };   // PH
export function menuShowcase() {
  if (!menuOpen()) return null;
  const i = Math.floor(performance.now() / SHOWCASE.stepMs) % SHOWCASE.values.length;
  return { meter: SHOWCASE.values[i], stage: i };
}
$('menuBoardTabs').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (b) { boardMode = b.dataset.b as any; renderBoardPanel(); }
});
// Magier: Inventar (Truhe, ausrüsten, zerlegen). Strichkrieger und Klingenstrich: feste Waffenwahl als Liste
$('menuWeaponsBtn').addEventListener('click', () => {
  if (mage.weapon) openInventory(renderMenu);
  else $('menuWeaponBox').hidden = !$('menuWeaponBox').hidden;
});
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
  showLoad(() => { syncPause(); ding(); });
  syncPause();
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

