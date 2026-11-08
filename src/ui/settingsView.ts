// Einstellungen (Mockup Settings.dc.html, Look Glut): Tabs links, Inhalt rechts. Alles wirkt sofort und landet in frostgrind.ui.v1.

import { $ } from '../util';
import { uiSettings, setUi, UiSettings, saveProfile, loadProfile } from './uiSettings';
import { askConfirm } from './confirm';
import { openBinds } from './menus';
import { editHud, menuOpen } from './mainMenu';
import { t, locale, lang, LANGS, setLang, Lang } from '../i18n';

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
const fmtAt = iso => { const d = new Date(iso); return `${d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`; };
function profileRows() {
  const box = document.createElement('div');
  box.className = 'setProfiles';
  uiSettings.profiles.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'setProfile';
    const info = Object.assign(document.createElement('span'), { textContent: p ? t('set.slot', { n: i + 1, at: fmtAt(p.at) }) : t('set.slotEmpty', { n: i + 1 }) });
    const save = button(t('set.save'), 'smallBtn', async () => {
      if (p && !await askConfirm(t('set.overTitle'), t('set.overText', { n: i + 1 }), t('set.over'))) return;
      saveProfile(i); buildInterface();
    });
    const load = button(t('set.load'), 'smallBtn', () => { if (loadProfile(i)) buildInterface(); });
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
    button(t('set.editUi'), 'smallBtn', () => {
      const backdrop = menuOpen() ? 'startModal' : 'pauseModal';
      $('settingsClose').click();
      editHud(backdrop);
    }),
    button(t('set.resetLayout'), 'smallBtn', () => $('hudEditReset').click()),
  );
  const langSel = document.createElement('select');
  langSel.className = 'setSelect';
  for (const [v, name] of LANGS) langSel.add(new Option(name, v));
  langSel.value = lang;
  langSel.addEventListener('change', async () => {
    if (!await askConfirm(t('settings.lang'), t('settings.langNote'), LANGS.find(([v]) => v === langSel.value)![1])) { langSel.value = lang; return; }
    setLang(langSel.value as Lang);
  });
  ui.append(
    h2(t('settings.lang')),
    row(t('settings.lang'), langSel),
    h2(t('set.ownUi')),
    profileRows(),
    h2('HUD'),
    row(t('set.hudSize'), slider('hudScale', 70, 150)),
    btnRow,
    h2(t('set.dmgNums')),
    row(t('set.size'), slider('numSize', 50, 200)),
    row(t('set.merge'), check('numMerge')),
    row(t('set.heal'), check('healNums')),
    h2(t('set.fontTips')),
    row(t('set.titleFont'), segmented('font', [['standard', t('set.standard')], ['fraktur', t('set.fraktur')]])),
    row(t('set.extTips'), check('tooltipsExt')),
  );
}
buildInterface();

$('setBinds').addEventListener('click', openBinds);
