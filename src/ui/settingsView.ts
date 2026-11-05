// Einstellungen (Mockup Settings.dc.html, Look Glut): Tabs links, Inhalt rechts. Alles wirkt sofort und landet in frostgrind.ui.v1.

import { $ } from '../util';
import { uiSettings, setUi, HUD_PRESETS, NUM_STYLES, UiSettings, saveProfile, loadProfile } from './uiSettings';
import { askConfirm } from './confirm';
import { openBinds } from './menus';
import { editHud, menuOpen } from './mainMenu';

let tab = 'interface';
function showTab(id) {
  tab = id;
  for (const b of $('setTabs').querySelectorAll<HTMLElement>('button')) b.classList.toggle('active', b.dataset.tab === id);
  for (const s of $('settingsBox').querySelectorAll<HTMLElement>('section[data-tab]')) s.hidden = s.dataset.tab !== id;
}
for (const b of $('setTabs').querySelectorAll<HTMLElement>('button')) b.addEventListener('click', () => showTab(b.dataset.tab));
showTab(tab);

// Bausteine einer Zeile: Beschriftung links, Steuerung rechts
function row(label, control: HTMLElement) {
  const r = document.createElement('label');
  r.className = 'setRow';
  r.append(Object.assign(document.createElement('span'), { textContent: label }), control);
  return r;
}
function select(key: keyof UiSettings, options: [string, string][]) {
  const s = document.createElement('select');
  s.className = 'setSelect';
  for (const [v, name] of options) s.add(new Option(`${v} · ${name}`, v));
  s.value = uiSettings[key] as string;
  s.addEventListener('change', () => setUi(key, s.value as never));
  return s;
}
function check(key: keyof UiSettings) {
  const c = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!uiSettings[key] });
  c.addEventListener('change', () => setUi(key, c.checked as never));
  return c;
}
function slider(key: keyof UiSettings, min, max) {
  const box = document.createElement('div');
  box.className = 'setSlider';
  const r = Object.assign(document.createElement('input'), { type: 'range', min, max, step: 5, value: uiSettings[key] });
  const v = document.createElement('span');
  const show = () => { v.textContent = `${r.value} %`; };
  r.addEventListener('input', () => { show(); setUi(key, +r.value as never); });
  show();
  box.append(r, v);
  return box;
}
function segmented(key: keyof UiSettings, options: [string, string][]) {
  const box = document.createElement('div');
  box.className = 'setSeg';
  const paint = () => { for (const b of box.children) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === uiSettings[key])); };
  for (const [v, name] of options) {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: name });
    b.dataset.v = v;
    b.addEventListener('click', () => { setUi(key, v as never); paint(); });
    box.append(b);
  }
  paint();
  return box;
}
const h2 = text => Object.assign(document.createElement('h2'), { textContent: text });
function button(text, cls, onClick) {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: cls, textContent: text });
  b.addEventListener('click', onClick);
  return b;
}

// Interface-Tab; wird nach dem Laden eines eigenen UI-Stands neu gebaut, damit alle Regler den Stand zeigen
const fmtAt = iso => { const d = new Date(iso); return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`; };
function profileRows() {
  const box = document.createElement('div');
  box.className = 'setProfiles';
  uiSettings.profiles.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'setProfile';
    const info = Object.assign(document.createElement('span'), { textContent: p ? `Platz ${i + 1} · ${p.data.hudPreset} · ${p.data.numStyle} · ${fmtAt(p.at)}` : `Platz ${i + 1} · leer` });
    const save = button('Speichern', 'smallBtn', async () => {
      if (p && !await askConfirm('Platz überschreiben?', `Platz ${i + 1} enthält schon einen UI-Stand. Mit dem aktuellen überschreiben?`, 'Überschreiben')) return;
      saveProfile(i); buildInterface();
    });
    const load = button('Laden', 'smallBtn', () => { if (loadProfile(i)) buildInterface(); });
    (load as HTMLButtonElement).disabled = !p;
    row.append(info, save, load);
    box.append(row);
  });
  return box;
}
function buildInterface() {
  const ui = $('setInterface');
  ui.textContent = '';
  const btnRow = document.createElement('div');
  btnRow.className = 'setBtns';
  btnRow.append(
    button('UI bearbeiten (verschieben)', 'smallBtn', () => {
      const backdrop = menuOpen() ? 'startModal' : 'pauseModal';
      $('settingsClose').click();
      editHud(backdrop);
    }),
    button('Layout zurücksetzen', 'smallBtn', () => $('hudEditReset').click()),
  );
  ui.append(
    h2('Eigene UI'),
    profileRows(),
    h2('HUD'),
    row('HUD-Layout', select('hudPreset', HUD_PRESETS)),
    row('HUD-Größe', slider('hudScale', 70, 150)),
    row('Combo- und Kill-Anzeige', check('showCombo')),
    btnRow,
    h2('Schadenszahlen'),
    row('Zahlen-Stil', select('numStyle', NUM_STYLES)),
    row('Größe', slider('numSize', 50, 200)),
    row('Kleine Treffer zusammenfassen', check('numMerge')),
    row('Heilzahlen', check('healNums')),
    h2('Schrift und Tooltips'),
    row('Schrift für Titel und Namen', segmented('font', [['standard', 'Standard'], ['fraktur', 'Fraktur']])),
    row('Erweiterte Tooltips', check('tooltipsExt')),
  );
}
buildInterface();

$('setBinds').addEventListener('click', openBinds);
