// Hauptmenü = Charakterwahl (Mockups X?M, gen4.py charsel + gen7.py) und Pause-Menü. Die Figur steht groß in der echten, gewählten Map;
// die Kamera schwenkt langsam, der Rand ist abgedunkelt. Map-Wechsler oben links (Q / E, Pad L2 / R2), die gewählte Map gilt für den Run.

import { state, player } from '../state';
import { $ } from '../util';
import { MODIFIERS, MODES, mobMode, setMode, setCustomMods, activeModIds, scoreMult, cardPaceId, setCardPace } from '../modifiers';
import { CARD_PACES } from '../config';
import { mage } from '../models/mage';
import { cam, autoCamOn, setAutoCam } from '../camera';
import { zone, zoneId } from '../world';
import { ZONES } from '../zones';
import { THEME_ZONES } from '../mapgen/registry';
import { switchZone } from '../player';
import { uiSettings, setUi } from './uiSettings';
import { fmtInt } from './dmgNumbers';
import { SHAKE_MODES, shakeModeNow, setShakeMode } from '../wucht';
import { byScore, byTime, comboRuns } from '../leaderboard';
import { meta, pickSkin } from '../meta';
import { figurOf, skinsFor } from '../skins';
import { WAR_WEAPON_NAMES, WAR_LEGENDARIES, warLegendary, setWarLegendary } from '../realMen';
import { LEGENDS } from '../legends';
import { equip, equipped, weaponName, rarityOf, applyRunWeapon, sortedInv } from '../weaponRolls';
import { applyRunGear } from '../gear';
import { clearSpellEffects } from '../spells/core';
import { attachWeaponCard } from './weaponCard';
import { fmtTime } from './hud';
import { resetGame, die } from '../player';
import { resetSpells, stopChannel } from '../spells/core';
import { renderActionbar } from './hud';
import { startHudEdit, hudEditing, stopHudEdit } from './hud/layout';
import { toggleChar } from './charWindow';
import { figureRules } from './charInfo';
import { openBinds, syncPause, ding } from './menus';
import { UI } from './uiConfig';
import { renderKit, currentKit } from './spellCard';
import { startKit } from '../spells/core';
import { showLoad } from './loadScreen';
import { openWeaponMenu } from './weaponMenu';
import { t, fmtNum, locale } from '../i18n';

// color: Name in Schulfarbe (Phase 8, Mockup CharDiablo). stats: Schaden, Kontrolle, Überleben als Wertung 1–5 (Einschätzung, keine Rechnung)
const CHARS = [
  { mod: null, name: t('char.normal.name'), sub: t('char.normal.sub'), color: '#f2e9e4', stats: [3, 3, 3] },
  { mod: 'frost', name: t('char.frost.name'), sub: t('char.frost.sub'), color: '#7dd3fc', stats: [3, 5, 3] },
  { mod: 'fire', name: t('char.fire.name'), sub: t('char.fire.sub'), color: '#fb923c', stats: [5, 1, 2] },
  { mod: 'blitz', name: t('char.blitz.name'), sub: t('char.blitz.sub'), color: '#fde047', stats: [4, 3, 2] },
  { mod: 'plague', name: t('char.plague.name'), sub: t('char.plague.sub'), color: '#a3e635', stats: [3, 4, 2] },
  { mod: 'realmen', name: t('char.realmen.name'), sub: t('char.realmen.sub'), color: '#f87171', stats: [4, 2, 5] },
];
const STAT_NAMES = [t('stat.dmg'), t('stat.control'), t('stat.survive')], STAT_MAX = 5;
// Strichfigur für die Figurenleiste (gen4.py charsel), Farbe über --fc
const STICK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="var(--fc)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="6" r="3"/><path d="M12 9v7M12 11l-5 4M12 11l5 3M12 16l-3 6M12 16l3 6"/></svg>';
let boardMode: 'time' | 'score' = 'time';
const CHAR_MODS = CHARS.map(c => c.mod).filter(Boolean);
const chips = MODIFIERS.filter(m => !CHAR_MODS.includes(m.id));
const fmtMult = v => `×${fmtNum(v)}`;
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
  fill($('menuBoard'), byScore(runs).slice(0, UI.boardRows), r => [t('menu.lv', { n: r.level }), fmtInt(r.score)], t('menu.noRuns'));
  fill($('menuTimeBoard'), byTime(runs).slice(0, UI.boardRows), r => [t('menu.kills', { n: r.kills }), fmtTime(r.timeTo100)], mobMode === 'packs' ? t('menu.noTime') : t('menu.packsOnly'));
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
    b.setAttribute('aria-label', c.name);
    b.innerHTML = STICK;
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
  const hasWeapons = !!mage.weapon || mage.skin === 'krieger';
  $('menuWeaponsBtn').hidden = !hasWeapons;
  if (!hasWeapons) $('menuWeaponBox').hidden = true;
  if (mage.skin === 'krieger') {   // Strichkrieger: feste Waffe vor dem Run, dazu die legendären (realMen.ts LEGENDARY, frei wählbar, kein Shop)
    const pickWar = (id, leg) => { setWarLegendary(leg); mage.setWarWeapon(id); applySelection(); };
    for (const [id, name] of Object.entries(WAR_WEAPON_NAMES))
      weapons.appendChild(button('chip' + (id === mage.warWeapon && !warLegendary() ? ' selected' : ''), name, () => pickWar(id, null)));
    for (const id of WAR_LEGENDARIES)
      weapons.appendChild(button('chip' + (id === warLegendary() ? ' selected' : ''), LEGENDS[id]?.name ?? id, () => pickWar(mage.warWeapon, id), LEGENDS[id]?.desc ?? ''));
  }
  // Waffenwahl aus dem Inventar, nur Magier. Leer oder abgewählt: Pilgerast ohne Effekt
  if (mage.weapon) {
    const pickW = id => { equip(id); mage.refreshWeapon(); renderMenu(); };
    weapons.appendChild(button('chip' + (!equipped() ? ' selected' : ''), t('menu.noWeapon'), () => pickW(null)));
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
  $('menuTitle').style.textShadow = `0 0 14px ${fig.color}66`;
  $('menuRole').textContent = fig.sub;
  $('menuStats').innerHTML = STAT_NAMES.map((n, i) => `<div class="menuStat" title="${t('menu.statOf', { a: fig.stats[i], b: STAT_MAX })}"><span>${n}</span><b><i style="width:${fig.stats[i] / STAT_MAX * 100}%;background:${fig.color}"></i></b></div>`).join('');
  const w = equipped(), wn = $('menuWeaponName');   // Waffe der Figur: Magier aus dem Inventar, Strichkrieger feste Wahl
  wn.textContent = mage.skin === 'krieger' ? (warLegendary() ? LEGENDS[warLegendary()]?.name : WAR_WEAPON_NAMES[mage.warWeapon]) ?? '—' : mage.weapon ? (w ? weaponName(w) : t('menu.noWeapon')) : '—';
  wn.style.color = mage.skin !== 'krieger' && w ? rarityOf(w).color : '';
  $('startModal').style.setProperty('--fc', fig.color);
  renderMap();
  renderSkin();
  const rules = figureRules();   // Besonderheit der Figur, gleicher Text wie im Charakterfenster
  $('menuRules').innerHTML = rules ? `<div class="menuHead" style="color:${rules.color}">${rules.name}</div><p>${rules.rules}</p>` : '';
  renderKit($('menuKit'), startKit());   // Start-Kit mit Info-Karten
  const names = MODIFIERS.filter(m => ids.includes(m.id)).map(m => m.desc).join(' · ');
  $('menuInfo').textContent = t('menu.info', { mods: names || t('menu.noMods'), mult: fmtMult(scoreMult()) });
  $('menuDust').textContent = t('menu.dust', { n: meta.dust });
  renderBoardPanel();
  if (nav) document.querySelector(`#startModal [data-nav="${CSS.escape(nav)}"]`)?.classList.add('navSel');
}

// ---------- Skin-Wechsler unter der Figur (skins.ts): nur Skins, die zur Waffe passen; Vorschau ist die Menü-Figur selbst ----------
const skinChoice = () => { const list = skinsFor(figurOf(mage.skin), mage.lookWeapon); return { list, i: Math.max(0, list.findIndex(s => s.id === mage.look)) }; };
function renderSkin() {
  const { list, i } = skinChoice();
  $('skinName').textContent = t(list[i].name);
  for (const id of ['skinPrev', 'skinNext']) ($(id) as HTMLButtonElement).disabled = list.length < 2;
}
function cycleSkin(step: number) {
  const { list, i } = skinChoice();
  pickSkin(figurOf(mage.skin), list[(i + step + list.length) % list.length].id);
  mage.refreshLook();
  renderMenu();
}
$('skinPrev').addEventListener('click', () => cycleSkin(-1));
$('skinNext').addEventListener('click', () => cycleSkin(1));

// ---------- Map-Wechsler (gen7.py map_selector): alle Maps aus zones.ts, Vorschau aus den Farben der Map, Bestzeit für Figur + Mods + Map ----------
const MAPS = THEME_ZONES.filter(id => ZONES[id]);   // generierte Maps (mapgen); alte Zonen nur noch über Dev → Zone und ?zone=
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
function mapThumb(id: string) {
  const e = ZONES[id].env ?? {};
  const ground = hex(e.ground ?? 0x333333), path = hex(e.fog ?? 0x666666), hi = hex(e.mid ?? e.top ?? 0x444444), sky = hex(e.sky ?? 0x888888);
  return `<svg viewBox="0 0 64 44" width="64" height="44"><rect width="64" height="44" fill="${ground}"/><rect width="64" height="44" fill="#000" opacity=".35"/>`
    + `<path d="M0 37 C19 31 38 22 64 7" stroke="${path}" stroke-width="6" fill="none"/><circle cx="13" cy="13" r="5" fill="${hi}"/><circle cx="48" cy="31" r="6" fill="${hi}"/>`
    + `<ellipse cx="51" cy="33" rx="9" ry="5" fill="${sky}" opacity=".5"/></svg>`;
}
function renderMap() {
  const i = Math.max(0, MAPS.indexOf(zoneId)), best = byTime(comboRuns(zoneId))[0]?.timeTo100;
  $('mapThumb').innerHTML = mapThumb(zoneId);
  $('mapName').textContent = zone.name;
  $('mapInfo').textContent = t('menux.mapInfo', { i: i + 1, n: MAPS.length, best: typeof best === 'number' ? fmtTime(best) : '—' });
}
function showMap(id: string) {
  stopChannel(true);
  clearSpellEffects();
  switchZone(id);
  setUi('menuZone', id);
}
export function cycleMap(step: number) {
  showMap(MAPS[(Math.max(0, MAPS.indexOf(zoneId)) + step + MAPS.length) % MAPS.length]);
  renderMenu();
}
// Beim ersten Öffnen die zuletzt gewählte Map aufbauen (?zone=… zum Testen hat Vorrang)
let savedMapShown = /[?&](zone|theme)=/.test(location.search);
$('mapPrev').addEventListener('click', () => cycleMap(-1));
$('mapNext').addEventListener('click', () => cycleMap(1));

// Langsamer Kameraschwenk um die Figur, solange das Menü offen ist; die Figur dreht mit und schaut weiter zur Kamera
const MENU_PAN = 0.06;   // rad/s // PH
let panAt = performance.now();
function pan() {
  const now = performance.now();
  if (menuOpen() && turning === null && uiSettings.menuPan) cam.offset += (now - panAt) / 1000 * MENU_PAN;
  panAt = now;
  requestAnimationFrame(pan);
}
requestAnimationFrame(pan);
// Knopf oben rechts schaltet den Schwenk an und aus (gemerkt)
function paintPanBtn() {
  const b = $('menuPanBtn');
  b.textContent = t(uiSettings.menuPan ? 'menux.panOn' : 'menux.panOff');
  b.setAttribute('aria-pressed', String(uiSettings.menuPan));
}
$('menuPanBtn').addEventListener('click', () => { setUi('menuPan', !uiSettings.menuPan); paintPanBtn(); });
paintPanBtn();

// Kamera nah an der Figur, solange das Menü offen ist
let camSaved = null;
export const menuOpen = () => $('startModal').classList.contains('show');
// Im Menü schaut die Figur zur Kamera; Ziehen auf der freien Fläche dreht sie, das Mausrad zoomt
let menuTurn = 0, turning = null;
export const menuYaw = () => menuOpen() ? Math.PI + menuTurn + cam.offset : 0;
// Im Menü läuft die Figur ihre Ladungsstufen durch (Magier: Anzeige 0 … voll, Krieger: Wut)
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
// Magier: Inventar (Truhe, ausrüsten, zerlegen). Strichkrieger: feste Waffenwahl als Liste
$('menuWeaponsBtn').addEventListener('click', () => {
  if (mage.weapon) openWeaponMenu(renderMenu);
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
  if (!savedMapShown) { savedMapShown = true; if (MAPS.includes(uiSettings.menuZone) && uiSettings.menuZone !== zoneId) showMap(uiSettings.menuZone); }
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
  applyRunGear(mage.skin);   // Gear nach der Waffe: hängt seinen Element-Proc an deren Treffer-Hook
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
const showAutoCam = () => { $('setAutoCam').textContent = t('settings.autoCam', { v: t(autoCamOn() ? 'ui.on' : 'ui.off') }); $('setAutoCam').title = t('settings.autoCamTip'); };
$('setAutoCam').addEventListener('click', () => { setAutoCam(!autoCamOn()); showAutoCam(); });
// Bildschirmwackeln: an, aus, stark
const shakeBtn = document.createElement('button');
shakeBtn.className = 'bindBtn';
const showShake = () => { shakeBtn.textContent = t('settings.shake', { v: t(`shake.${shakeModeNow()}`) }); };
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
  player.lastHitBy = t('end.gaveUp');
  die();
});

// Tastatur: A/D wechselt die Figur, Q/E die Map, Enter startet (oder löst den fokussierten Knopf aus), Esc beendet das Bearbeiten
addEventListener('keydown', e => {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;   // Spielstand-Code, Suche im Waffenmenü tippen
  if (hudEditing()) { if (e.code === 'Escape') { e.stopImmediatePropagation(); stopHudEdit(); } return; }
  if (!menuOpen() || state.rebinding || ['bindModal', 'settingsModal', 'boardModal', 'shopModal', 'invModal'].some(id => $(id)?.classList.contains('show'))) return;
  if (e.code === 'KeyA') cycleChar(-1);
  if (e.code === 'KeyD') cycleChar(1);
  if (e.code === 'KeyQ') cycleMap(-1);
  if (e.code === 'KeyE') cycleMap(1);
  if (e.code === 'Enter' && !(document.activeElement instanceof HTMLButtonElement) && !document.querySelector('#startModal .navSel')) { e.preventDefault(); startRun(); }
}, true);

