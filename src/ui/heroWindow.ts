// Ein Fenster für Waffen, Charakter und Ausrüstung (Handoff docs/handoffs/fenster.md, Vorlage docs/ref/charakterfenster/, Layout A).
// Links Figur mit Slots und Werten, rechts das Inventar. X und I öffnen und schließen es (input.ts charWin/gearWin), Esc schließt.
// Pausiert (menus.ts BLOCKING), geht auch während der Kartenwahl und aus dem Pause-Menü. Im Run nur ansehen, im Hauptmenü voll.
// Gear-Teile können Hersteller und Gruppe tragen (gear.ts makerOf/groupOf, sobald es die gibt): gelesen nur über optionale Aufrufe, sonst „—“.

import { $ } from '../util';
import { player } from '../state';
import { meta, hasAch } from '../meta';
import { ACHIEVEMENTS, setAch } from '../skins';
import { mage } from '../models/mage';
import { ROLLS, equipped, equip, weaponName, rarityOf, typeOf } from '../weaponRolls';
import * as GEARMOD from '../gear';
import { SLOTS, LOOK_SLOTS, LOOKS, SETS, worn, wearGear, gearName, gearRows, gearRarity, slotName, setOfSchool, setCount, fullSet, perfectText, isMagierSkin,
  hasLook, lookIn, wearLook, type Slot, type GearItem } from '../gear';
import { MAKERS } from '../models/weapons/baukasten';
import { mountFigPreview, setFigPreview } from './figPreview';
import { currentFigure } from './mainMenu';
import { attachWeaponCard } from './weaponCard';
import { weaponThumb } from './weaponThumb';
import { attachTip, hideTip, type TipData } from './tooltip';
import { heroStats, type StatRow } from './heroStats';
import { syncPause } from './menus';
import { uiSettings, setUi } from './uiSettings';
import { t, fmtNum } from '../i18n';
import './heroWindow.css';

export type Tab = 'waffen' | Slot | 'kosmetik';
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });

document.body.insertAdjacentHTML('beforeend', `<div id="heroModal" class="modal" role="dialog" aria-labelledby="hwName">
  <div id="hwBox">
    <div class="fg-panel hwLeft" data-sektor="SEKTOR 07 · ${t('hw.sekFig')}">
      <div class="hwHead"><h1 class="fg-title l" id="hwName"></h1><span class="hwLabel" id="hwLevel"></span></div>
      <div class="hwDoll"><div class="hwCol" id="hwSlotsL"></div><div class="hwFig" id="hwFig"></div><div class="hwCol" id="hwSlotsR"></div><span class="hwFigHint">${t('gear.figHint')}</span></div>
      <div id="hwSet"></div>
      <div class="hwStats" id="hwStats"></div>
    </div>
    <div class="fg-panel hwInv" data-sektor="SEKTOR 12 · ${t('hw.sekInv')}">
      <div class="hwInvHead"><h2 class="fg-title l">${t('hw.inv')}</h2><span id="hwWait"></span><button type="button" class="fg-btn alt" id="hwClose">${t('ui.close')}</button></div>
      <div class="hwBody" id="hwBody"></div>
    </div>
  </div>
</div>`);

let onClose: (() => void) | null = null, tab: Tab = 'waffen';
export const heroOpen = () => $('heroModal').classList.contains('show');
export const inRun = () => !$('startModal').classList.contains('show');
const viewOnly = inRun;
const mageGear = () => isMagierSkin(mage.skin);

// ---------- Gear: Hersteller und Gruppe (optional, gear.ts makerOf/groupOf) ----------
const optCall = (name: string, g: GearItem): string | null => { try { const f = (GEARMOD as any)[name]; return typeof f === 'function' ? f(g) ?? null : null; } catch { return null; } };
export const gearMaker = (g: GearItem) => optCall('makerOf', g);
export const gearGroup = (g: GearItem) => optCall('groupOf', g);
const makerName = (id: string | null) => id ? MAKERS[id]?.name ?? id : '—';
const groupName = (id: string | null) => id ? t(`hw.group.${id}`) : '—';

// Hauptwert eines Gear-Teils („+4 % Schaden“) für ▲/▼: nur gegen dasselbe Wert-Wort
const pctOf = (s: string) => { const m = s?.match(/^([+−-]?\d+(?:[,.]\d+)?) %\s*(.*)$/); return m ? { v: parseFloat(m[1].replace('−', '-').replace(',', '.')), label: m[2] } : null; };
export const gearMain = (g: GearItem) => pctOf(gearRows(g).find(r => r.kind === 'value')?.text ?? '');
export function gearDelta(g: GearItem): number | null {
  const on = worn(g.slot);
  if (!on || on === g) return null;
  const a = gearMain(g), b = gearMain(on);
  if (a && b && a.label === b.label) return Math.round((a.v - b.v) * 10) / 10;
  return null;
}
// Hover-Karte eines Gear-Teils wie die Waffen-Karte (weaponCard.ts): Hauptwert groß, ▲/▼ gegenüber dem angelegten, Zeilen, Set, Hersteller, Gruppe
export function gearTip(g: GearItem, compare = true): TipData {
  const rar = gearRarity(g), rows = gearRows(g), main = gearMain(g), on = worn(g.slot), d = gearDelta(g);
  const lines = rows.filter(r => r.kind !== 'value').map(r => `<span class="tAffix"${r.color ? ` style="color:${r.color}"` : ''}>◆ ${r.text}</span>`);
  lines.push(`<span class="tAffix">◆ ${t('wm.maker')}: ${makerName(gearMaker(g))} · ${t('hw.group')}: ${groupName(gearGroup(g))}</span>`);
  if (g.s.setId) lines.push(`<span class="tLegend">◆ SET ${t(`look.magier.${g.s.setId}.name`)} · 5/5: ${perfectText(g.s.setId, g.slot)}</span>`);
  const tip: TipData = {
    title: gearName(g), color: rar.color, border: rar.color, sub: `${rar.name} · ${slotName(g.slot)}`,
    big: main ? { value: `${main.v > 0 ? '+' : ''}${fmtNum(main.v)} %`, label: main.label, delta: on === g ? t('wcard.equippedLow') : d === null ? undefined : `${d > 0 ? '▲ +' : '▼ −'}${fmtNum(Math.abs(d))} %`,
      deltaColor: on === g ? '#f87171' : d > 0 ? '#6ee7a0' : '#f87171' } : undefined,
    short: main ? lines.shift() ?? '' : lines.shift() ?? '', rows: lines,
    footer: [t('wcard.salvage'), t('shop.refund', { n: ROLLS.refund[g.r] })],
  };
  if (compare && on && on !== g) Object.assign(tip, { compare: gearTip(on, false), compareLabels: [t('wcard.this'), t('shop.equipped')] });
  else tip.label = on === g ? t('shop.equipped') : slotName(g.slot);
  return tip;
}

// ---------- Bilder ----------
// Typ-Silhouetten der Waffen (gen10.py type_svg), viewBox 28 × 70; alte Waffen zeigen den Stab
const TYPE_SVG = {
  staff: '<path d="M14 66V14"/><circle cx="14" cy="9" r="6"/><path d="M8 20h12"/>',
  wand: '<path d="M14 62V30"/><path d="M14 18l3 6 6 1-4.5 4 1 6L14 32l-5.5 3 1-6L5 25l6-1z"/>',
  book: '<rect x="3" y="26" width="22" height="30" rx="2"/><path d="M3 30h22M14 26v30"/><circle cx="14" cy="14" r="5"/>',
  relic: '<circle cx="14" cy="36" r="10"/><circle cx="14" cy="36" r="4"/><path d="M14 22v-8M14 50v8M4 36H0M28 36h-4"/>',
};
export const typeSvg = (type: string, color: string) => `<svg aria-hidden="true" viewBox="0 0 28 70" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TYPE_SVG[type] ?? TYPE_SVG.staff}</svg>`;
// Gear-Slots als einfache Umrisse, viewBox 24 // PH
const SLOT_SVG: Record<string, string> = {
  kopf: '<path d="M4 20c0-8 3-14 8-16 5 2 8 8 8 16z"/><path d="M8 20c1-4 2-6 4-7 2 1 3 3 4 7"/>',
  hals: '<path d="M6 3c0 6 3 9 6 9s6-3 6-9"/><circle cx="12" cy="16" r="4"/>',
  ruecken: '<path d="M7 3h10l3 18H4z"/><path d="M12 3v18"/>',
  arme: '<path d="M7 3h8l2 8v10H7z"/><path d="M7 11h10"/>',
  koerper: '<path d="M8 3 4 7l2 3 2-1v12h8V9l2 1 2-3-4-4-2 2h-4z"/>',
  kosmetik: '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9L9.5 8z"/>',
};
export const slotSvg = (slot: string, color: string) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SLOT_SVG[slot] ?? SLOT_SVG.kosmetik}</svg>`;

// ---------- Links: Kopf, Figur mit Slots, Set, Werte ----------
const LEFT: (Slot | 'waffe')[] = ['kopf', 'hals', 'ruecken'], RIGHT: (Slot | 'waffe')[] = ['arme', 'koerper', 'waffe'];
// Nach jeder Änderung: Figur (Set-Skin, Waffen-Look) und Fenster neu
function changed() { mage.refreshLook(); mage.refreshWeapon(); render(); }

function slotEl(slot: Slot | 'waffe') {
  const wrap = el('div', 'hwSlotWrap'), b = el('button', 'hwSlot'), isW = slot === 'waffe';
  b.type = 'button';
  b.dataset.slot = slot;
  const w = isW && mage.weapon ? equipped() : null, g = !isW && mageGear() ? worn(slot as Slot) : null;
  const color = w ? rarityOf(w).color : g ? gearRarity(g).color : '';
  if (color) b.style.setProperty('--rc', color);
  if (w) { const src = weaponThumb(w); b.innerHTML = src ? `<img src="${src}" alt="">` : typeSvg(typeOf(w), color); }
  else if (g) b.innerHTML = slotSvg(slot, color);
  else b.innerHTML = `<span class="hwSlotEmpty">${isW && mage.skin === 'krieger' ? '' : '—'}</span>`;
  b.append(el('small', '', isW ? t('cw.weapon') : slotName(slot)));
  if (g?.s.setId) b.append(el('b', 'hwSetMark', 'SET'));
  if (w) attachWeaponCard(b, w);
  else if (g) attachTip(b, () => gearTip(g));
  else b.title = isW ? t('menu.noWeapon') : t('gear.empty');
  b.classList.toggle('sel', tab === (isW ? 'waffen' : slot));
  b.addEventListener('click', () => { setTab(isW ? 'waffen' : slot as Slot); });
  b.addEventListener('contextmenu', e => {   // Rechtsklick legt ab (nur Hauptmenü)
    e.preventDefault();
    if (viewOnly()) return;
    if (w) { equip(null); changed(); } else if (g) { wearGear(slot as Slot, null); changed(); }
  });
  wrap.append(b, lookEl(slot));
  return wrap;
}
// Look-Feld oben rechts am Slot (Kosmetik). Regel: look[slot] ?? gear[slot]. Belegt: Klick leert; leer mit freiem Look: Klick legt ihn an
function lookEl(slot: Slot | 'waffe') {
  const on = lookIn(slot), free = Object.keys(LOOKS).filter(id => LOOKS[id].slot === slot && hasLook(id));
  const b = el('button', `hwLook${on ? ' on' : ''}`);
  b.type = 'button';
  b.title = on ? `${t(LOOKS[on].name)} · ${t('hw.lookClear')}` : free.length ? t('hw.lookSet', { name: t(LOOKS[free[0]].name) }) : t('hw.lookNone');
  b.setAttribute('aria-label', `${t('hw.look')} ${slot === 'waffe' ? t('cw.weapon') : slotName(slot)}: ${b.title}`);
  if (on) b.innerHTML = slotSvg('kosmetik', 'currentColor');
  b.disabled = viewOnly() || (!on && !free.length) || !mageGear();
  b.addEventListener('click', () => { wearLook(slot, on ? null : free[0]); changed(); });
  return b;
}

// Set-Fortschritt des gespielten Magiers: „Glutprophet 3/5“, Mechanik, Look; inaktiv ausgegraut. Darunter die Erfolge
function renderSet() {
  const box = $('hwSet'), id = setOfSchool(mage.skin);
  box.textContent = '';
  if (!mageGear()) { box.append(el('p', 'hwMuted', t('gear.mageOnly'))); return; }
  if (!id) { box.append(el('p', 'hwMuted', t('gear.noSet')), achRow(null)); return; }
  const n = setCount(id), on = n === SLOTS.length, S = SETS[id];
  const p = el('div', `hwSetBox${on ? '' : ' off'}`);
  if (on) p.style.borderColor = S.color;
  const head = el('div', 'hwSetHead'), name = el('b', 'fg-title', `${t(`look.magier.${id}.name`)} ${n}/${SLOTS.length}`), bar = el('i', 'hwBar'), fill = el('i');
  name.style.color = S.color;
  fill.style.cssText = `width:${n / SLOTS.length * 100}%;background:${S.color}`;
  bar.append(fill);
  head.append(name, bar, el('span', 'hwMuted', t(on ? 'hw.setOn' : 'hw.setOff')));
  const line = (label: string, text: string) => { const d = el('div', 'hwSetLine'); d.append(el('strong', '', `${label} `), text); d.title = `${label} ${text}`; return d; };
  p.append(head, line(t('gear.mech'), t(`gear.set.${id}.mech`)), line(t('gear.look'), t(`gear.set.${id}.look`)));
  p.title = t(on ? 'gear.setOn' : 'gear.setOff');
  box.append(p, achRow(id));
}
// Erfolge: links der Erfolg dieses Sets (★ erreicht bzw. 🔒 Bedingung), rechts „Erfolge n/m“ mit einer Marke je Set (Name und Bedingung im Tooltip)
function achRow(id: string | null) {
  const row = el('div', 'hwAch');
  if (id) {
    const done = hasAch(setAch(id)), name = t(`look.magier.${id}.name`);
    const cur = el('span', done ? 'hwAchCur done' : 'hwAchCur', t(done ? 'gear.achDone' : 'gear.achNeed'));
    cur.title = done ? `${t('ach.setName', { set: name })} – ${t('ach.skinFree', { skin: name })}` : t('ach.need', { set: name });
    row.append(cur);
  }
  const all = el('span', 'hwAchAll', t('ach.title', { n: ACHIEVEMENTS.filter(hasAch).length, m: ACHIEVEMENTS.length }));
  for (const a of ACHIEVEMENTS) {
    const sid = a.slice(4), done = hasAch(a), name = t(`look.magier.${sid}.name`);
    const m = el('i', done ? 'done' : '', done ? '★' : '🔒');
    if (done) m.style.color = SETS[sid]?.color ?? '';
    m.title = done ? `★ ${t('ach.setName', { set: name })} – ${t('ach.skinFree', { skin: name })}` : `🔒 ${t('ach.need', { set: name })}`;
    m.setAttribute('aria-label', m.title);
    all.append(m);
  }
  row.append(all);
  return row;
}

// Werte: 6 Hauptwerte, darunter aufklappbar „Alle Werte“ in Gruppen. Hover: Aufschlüsselung
function statEl(r: StatRow) {
  const row = el('div', 'hwRow'), v = el('b', '', r.value);
  const label = el('span', '', r.label);
  if (r.color) label.style.color = r.color;
  if (r.small) v.append(el('small', '', ` ${r.small}`));
  row.append(label, v);
  if (r.parts) attachTip(row, () => ({ title: r.label, color: r.color ?? 'var(--fg-title)', sub: t('hw.br.title'),
    short: `${r.parts.map(([a, b]) => `${a}: <b>${b}</b>`).join('<br>')}<br>${t('hw.br.sum')}: <b>${r.value}</b>` }));
  return row;
}
function renderStats() {
  const box = $('hwStats'), live = inRun(), { main, groups } = heroStats(live), open = uiSettings.heroAll;
  box.textContent = '';
  const mainBox = el('div', 'hwMain');
  for (const r of main) mainBox.append(statEl(r));
  const tgl = el('button', 'hwAllBtn', `${open ? '▾' : '▸'} ${t('hw.allStats')}`);
  tgl.type = 'button';
  tgl.setAttribute('aria-expanded', String(open));
  tgl.addEventListener('click', () => { setUi('heroAll', !uiSettings.heroAll); renderStats(); });
  box.append(mainBox, tgl);
  box.classList.toggle('open', open);
  if (!open) return;
  const all = el('div', 'hwAll');
  for (const g of groups) {
    all.append(el('div', 'hwGroup', g.name));
    for (const r of g.rows) all.append(statEl(r));
  }
  box.append(all);
}

function renderLeft() {
  const fig = currentFigure();
  $('hwName').textContent = fig?.name ?? '';
  $('hwLevel').textContent = inRun() ? t('hw.level', { n: player.level ?? 1 }) : t('hw.level', { n: '—' });
  const L = $('hwSlotsL'), R = $('hwSlotsR');
  L.textContent = R.textContent = '';
  for (const s of LEFT) L.append(slotEl(s));
  for (const s of RIGHT) R.append(slotEl(s));
  renderSet();
  renderStats();
}

// ---------- Rechts: Inventar (Schritt 3) ----------
function setTab(next: Tab) { tab = next; render(); }
function renderInv() { /* Schritt 3 */ }

function render() {
  hideTip();
  $('heroModal').classList.toggle('viewOnly', viewOnly());
  renderLeft();
  renderInv();
}

export function openHero(opts: { tab?: Tab; done?: () => void } = {}) {
  onClose = opts.done ?? null;
  if (opts.tab) tab = opts.tab;
  mountFigPreview($('hwFig'));   // 3D-Ansicht der Figur, gezeichnet in main.ts (renderFigPreview)
  setFigPreview(true);
  $('heroModal').classList.add('show');
  render();
  syncPause();
}
export function closeHero() {
  hideTip();
  $('heroModal').classList.remove('show');
  setFigPreview(false);
  mage.previewWeapon(null);
  setUi('weaponSeen', Math.max(uiSettings.weaponSeen, ...meta.inv.map(w => w.id)));   // ab jetzt nicht mehr NEU
  syncPause();
  const done = onClose;
  onClose = null;
  done?.();
}
// Taste X oder I (gleiche Aktion), Pad-Knopf Charakter, HUD-Mikromenü, Pause-Menü: offen → zu, sonst auf.
// Nicht über anderen Fenstern außer Hauptmenü, Pause und Kartenwahl (Tod, Shop, Einstellungen, Laden …); zu nicht, solange eine Rückfrage darüber liegt.
const BELOW = ['startModal', 'pauseModal', 'cardModal', 'heroModal'];
const askOpen = () => !!document.querySelector('.modal.show:has(#askTitle), #gearKeepModal.show');
export function toggleHero() {
  if (heroOpen()) { if (!askOpen()) closeHero(); return; }
  if ([...document.querySelectorAll<HTMLElement>('.modal.show')].some(m => !BELOW.includes(m.id))) return;
  openHero();
}

$('hwClose').addEventListener('click', closeHero);
addEventListener('keydown', e => {
  if (!heroOpen() || askOpen()) return;
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeHero(); }
}, true);
