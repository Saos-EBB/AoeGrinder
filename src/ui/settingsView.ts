// Einstellungen (Mockups X1O/X2O/X3O, gen9.py settings): Tabs links, Inhalt rechts, im Look des aktiven UI-Flavors.
// Alles wirkt sofort und landet in frostgrind.ui.v1. Abbrechen stellt den Stand vom Öffnen wieder her, Übernehmen (= #settingsClose) schließt.

import { $ } from '../util';
import { uiSettings, setUi, UiSettings, UI_DEFAULTS, saveProfile, loadProfile } from './uiSettings';
import { askConfirm } from './confirm';
import { openBinds } from './menus';
import { editHud, menuOpen } from './mainMenu';
import { FLAVORS, flavorById } from './flavors';
import { t, locale, lang, LANGS, setLang, Lang } from '../i18n';

let tab = 'interface';
function showTab(id) {
  tab = id;
  for (const b of $('setTabs').querySelectorAll<HTMLElement>('button')) b.classList.toggle('active', b.dataset.tab === id);
  for (const s of $('settingsBox').querySelectorAll<HTMLElement>('section[data-tab]')) s.hidden = s.dataset.tab !== id;
  $('setFootLeft').hidden = id !== 'interface';
}
for (const b of $('setTabs').querySelectorAll<HTMLElement>('button')) b.addEventListener('click', () => showTab(b.dataset.tab));

// ---------- Bausteine: Zeile, Schalter, Slider, Segment-Knöpfe ----------
function row(label: string, control: HTMLElement) {
  const r = document.createElement('div');
  r.className = 'setRow';
  r.append(Object.assign(document.createElement('span'), { textContent: label }), control);
  return r;
}
function toggle(key: keyof UiSettings, label: string) {
  const c = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'fg-toggle', checked: !!uiSettings[key] });
  c.setAttribute('aria-label', label);
  c.addEventListener('change', () => setUi(key, c.checked as never));
  return row(label, c);
}
function slider(key: keyof UiSettings, label: string, min: number, max: number) {
  const box = document.createElement('div');
  box.className = 'setSlider';
  const r = Object.assign(document.createElement('input'), { type: 'range', className: 'fg-slider', min, max, step: 5, value: uiSettings[key] });
  r.setAttribute('aria-label', label);
  const v = document.createElement('b');
  const show = () => { v.textContent = `${r.value} %`; r.style.setProperty('--p', `${(+r.value - min) / (max - min) * 100}%`); };
  r.addEventListener('input', () => { show(); setUi(key, +r.value as never); });
  show();
  box.append(r, v);
  return row(label, box);
}
function segmented(key: keyof UiSettings, label: string, options: [string, string][]) {
  const box = document.createElement('div');
  box.className = 'fg-seg';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', label);
  const paint = () => { for (const b of box.children) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === uiSettings[key])); };
  for (const [v, name] of options) {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: name });
    b.dataset.v = v;
    b.addEventListener('click', () => { setUi(key, v as never); paint(); });
    box.append(b);
  }
  paint();
  return row(label, box);
}
function button(text: string, cls: string, onClick: () => void) {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: cls, textContent: text });
  b.addEventListener('click', onClick);
  return b;
}
const h2 = (text: string) => Object.assign(document.createElement('h2'), { textContent: text });

// ---------- UI-Flavor: 3 große Karten mit Mini-Vorschau (Kugeln + Leiste in Flavor-Farben) ----------
function flavorCards() {
  const box = document.createElement('div');
  box.className = 'setFlavors';
  for (const f of FLAVORS) {
    const on = f.id === uiSettings.flavor, k = f.tokens;
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'setFlavor' });
    b.setAttribute('aria-pressed', String(on));
    b.style.setProperty('--fc', k.frame);
    b.style.background = k.bg;
    b.innerHTML = `<span class="sfPrev" aria-hidden="true"><i style="background:${k.bar}"></i><b style="background:${k.hp}"></b><b style="background:${k.mana}"></b></span>
      <span class="sfText"><b>${t(f.name)}</b><small>${t(f.sub)}</small></span>${on ? '<span class="sfCheck" aria-hidden="true">✔</span>' : ''}`;
    b.addEventListener('click', () => { setUi('flavor', f.id); buildInterface(); });
    box.append(b);
  }
  return box;
}

// ---------- Eigene UI-Stände (4 Plätze) ----------
const fmtAt = iso => { const d = new Date(iso); return `${d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`; };
function profileRows() {
  const box = document.createElement('div');
  box.className = 'setProfiles';
  uiSettings.profiles.forEach((p, i) => {
    const r = document.createElement('div');
    r.className = 'setProfile';
    const name = p ? t('set.slot', { n: i + 1, at: fmtAt(p.at) }) + ` · ${t(flavorById(p.data.flavor ?? '').name)}` : t('set.slotEmpty', { n: i + 1 });
    const save = button(t('set.save'), 'fg-btn alt', async () => {
      if (p && !await askConfirm(t('set.overTitle'), t('set.overText', { n: i + 1 }), t('set.over'))) return;
      saveProfile(i); buildInterface();
    });
    const load = button(t('set.load'), 'fg-btn alt', () => { if (loadProfile(i)) buildInterface(); });
    (load as HTMLButtonElement).disabled = !p;
    r.append(Object.assign(document.createElement('span'), { textContent: name }), save, load);
    box.append(r);
  });
  return box;
}

// ---------- Tab Interface; wird nach jedem Flavor-Wechsel und Laden eines UI-Stands neu gebaut ----------
const NUM_CHOICES = (): [string, string][] => [['flavor', t('set.likeFlavor')], ...FLAVORS.map(f => [f.id, t(f.name)] as [string, string])];
function buildInterface() {
  const ui = $('setInterface');
  ui.textContent = '';
  const langSel = document.createElement('select');
  langSel.className = 'setSelect';
  for (const [v, name] of LANGS) langSel.add(new Option(name, v));
  langSel.value = lang;
  langSel.setAttribute('aria-label', t('settings.lang'));
  langSel.addEventListener('change', async () => {
    if (!await askConfirm(t('settings.lang'), t('settings.langNote'), LANGS.find(([v]) => v === langSel.value)![1])) { langSel.value = lang; return; }
    setLang(langSel.value as Lang);
  });
  ui.append(
    h2(t('set.flavor')),
    flavorCards(),
    segmented('numFlavor', t('set.numFlavor'), NUM_CHOICES()),
    slider('numSize', t('set.numSize'), 50, 200),
    toggle('numMerge', t('set.merge')),
    toggle('healNums', t('set.heal')),
    toggle('messages', t('set.messages')),
    segmented('font', t('set.font'), [['standard', t('set.standard')], ['fraktur', t('set.fraktur')]]),
    toggle('tooltipsExt', t('set.extTips')),
    toggle('screenFx', t('set.screenFx')),
    slider('hudScale', t('set.hudSize'), 70, 150),
    h2(t('settings.lang')),
    row(t('settings.lang'), langSel),
    h2(t('set.ownUi')),
    profileRows(),
  );
}

// ---------- Tab Grafik: Helligkeit (dunkel.ts), 0 % = dunkelster Look; wird beim Öffnen neu gebaut, damit Abbrechen den Regler mitnimmt ----------
const brightBox = document.createElement('div');
$('setGrafik').querySelector('h2').after(brightBox);
const buildGrafik = () => brightBox.replaceChildren(slider('brightness', t('set.brightness'), 0, 100));

// Knöpfe unten links (nur im Tab Interface)
$('setFootLeft').append(
  button(t('set.editUi'), 'fg-btn alt', () => {
    const backdrop = menuOpen() ? 'startModal' : 'pauseModal';
    $('settingsClose').click();
    editHud(backdrop);
  }),
  button(t('set.resetLayout'), 'fg-btn alt', () => $('hudEditReset').click()),
);

// Abbrechen: Stand vom Öffnen zurück. Der Stand wird gemerkt, sobald das Fenster aufgeht
let opened: Partial<UiSettings> | null = null;
new MutationObserver(() => {
  const show = $('settingsModal').classList.contains('show');
  if (show && !opened) { opened = structuredClone(uiSettings); buildInterface(); buildGrafik(); showTab(tab); }
  if (!show) opened = null;
}).observe($('settingsModal'), { attributes: true, attributeFilter: ['class'] });
$('settingsCancel').addEventListener('click', () => {
  const back = opened;
  if (back) for (const k of Object.keys(UI_DEFAULTS) as (keyof UiSettings)[]) if (k !== 'devPanel' && k !== 'profiles' && JSON.stringify(uiSettings[k]) !== JSON.stringify(back[k])) setUi(k, back[k] as never);
  $('settingsClose').click();
});

buildInterface();
buildGrafik();
showTab(tab);
$('setBinds').addEventListener('click', openBinds);
