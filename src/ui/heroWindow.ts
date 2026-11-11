// Ein Fenster für Waffen, Charakter und Ausrüstung (Handoff docs/handoffs/fenster.md, Vorlage docs/ref/charakterfenster/, Layout A).
// Links Figur mit Slots und Werten, rechts das Inventar. X und I öffnen und schließen es (Bind-IDs charWin/gearWin in input.ts), Esc schließt.
// Pausiert (menus.ts BLOCKING), geht auch während der Kartenwahl und aus dem Pause-Menü. Im Run nur ansehen, im Hauptmenü voll.
// Gear-Teile tragen Hersteller und Gruppe (gear.ts makerOf/groupOf), fehlt eins → „—“.

import { $ } from '../util';
import { state, player } from '../state';
import { SPELLS, CARD_RARITIES } from '../config';
import type { Find } from '../loot';
import { meta, hasAch } from '../meta';
import { ACHIEVEMENTS, setAch } from '../skins';
import { mage } from '../models/mage';
import { ROLLS, VALUE_KEY, equipped, equip, deleteWeapon, weaponName, rarityOf, typeOf, elementOf, effectRows, mainValue, valueText } from '../weaponRolls';
import { makerOf, groupOf, SLOTS, LOOK_SLOTS, LOOKS, SETS, worn, wearGear, gearName, gearRows, gearRarity, slotName, setOfSchool, setCount, fullSet, perfectText, isMagierSkin,
  hasLook, lookIn, wearLook, gearInv, deleteGear, overflow, GEAR, lookSource, lookHint, gearMainValue, type Slot, type GearItem } from '../gear';
import { MAKERS, TYPES, HEADS, SHAFTS, ELEMENTS, elementColor } from '../models/weapons/baukasten';
import { askConfirm } from './confirm';
import { openKeepChooser } from './lootView';
import { fmtInt } from './fmt';
import { mountFigPreview, setFigPreview } from './figPreview';
import { currentFigure } from './mainMenu';
import { attachWeaponCard, weaponCardData } from './weaponCard';
import { mainDelta, mainStrength, fmtDelta, deltaColor, fmtMain } from './compare';
import { COLORS } from './colors';
import { weaponThumb } from './weaponThumb';
import { gearThumbHtml, lookThumbHtml, weaponThumbHtml, warmThumbs } from './itemThumb';
import { attachTip, hideTip, tipAt, type TipData } from './tooltip';
import { heroStats, type StatRow } from './heroStats';
import { figureInfo } from './charInfo';
import { syncPause } from './menus';
import { uiSettings, setUi } from './uiSettings';
import { t } from '../i18n';
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
      <div class="hwInvHead"><h2 class="fg-title l">${t('hw.inv')}</h2><span id="hwWait"></span>
        <div class="hwToggle" role="group" aria-label="${t('hw.view')}"><button type="button" data-v="grid">${t('hw.grid')}</button><button type="button" data-v="tree">${t('hw.tree')}</button></div><button type="button" class="fg-btn alt" id="hwClose">${t('ui.close')}</button></div>
      <div class="hwTabs" id="hwTabs" role="tablist"></div>
      <div class="hwBar" id="hwBar"></div>
      <div class="hwActive"><span id="hwChips"></span><small id="hwCount"></small></div>
      <div class="hwFinds" id="hwFinds"></div>
      <div class="hwBody" id="hwBody"><div class="hwGrid" id="hwGrid"></div><div class="hwTree" id="hwTree" role="tree"></div></div>
      <div class="hwSel" id="hwSel"></div>
      <div class="hwFoot"><span id="hwDust"></span><button type="button" class="fg-btn alt" id="hwChest">${t('wm.toChest')}</button><button type="button" class="fg-btn alt" id="hwFuse" disabled title="${t('shop.soon')}"></button></div>
      <p class="hwHint" id="hwHint"></p>
    </div>
  </div>
</div>`);

let onClose: (() => void) | null = null, tab: Tab = (uiSettings.heroTab as Tab) || 'waffen';
export const heroOpen = () => $('heroModal').classList.contains('show');
export const inRun = () => !$('startModal').classList.contains('show');
const viewOnly = inRun;
warmThumbs(() => !inRun());   // Bild-Renderer im Hauptmenü vorab anlegen
const mageGear = () => isMagierSkin(mage.skin);

// ---------- Gear: Hersteller und Gruppe (gear.ts makerOf/groupOf) ----------
const gearMaker = (g: GearItem) => makerOf(g);
const gearGroup = (g: GearItem) => groupOf(g);
const makerName = (id: string | null) => id ? MAKERS[id]?.name ?? id : '—';
const groupName = (id: string | null) => id ? t(`hw.group.${id}`) : '—';

// ▲/▼ eines Gear-Teils gegenüber dem angelegten im selben Slot (Regel in compare.ts)
export function gearDelta(g: GearItem): number | null {
  const on = worn(g.slot);
  return !on || on === g ? null : mainDelta(gearMainValue(g), gearMainValue(on));
}
// Hover-Karte eines Gear-Teils wie die Waffen-Karte (weaponCard.ts): Hauptwert groß, ▲/▼ gegenüber dem angelegten, Zeilen, Set, Hersteller, Gruppe
export function gearTip(g: GearItem, compare = true): TipData {
  const rar = gearRarity(g), rows = gearRows(g), main = gearMainValue(g), on = worn(g.slot), d = gearDelta(g);
  const lines = rows.filter(r => r.kind !== 'value').map(r => `<span class="tAffix"${r.color ? ` style="color:${r.color}"` : ''}>◆ ${r.text}</span>`);
  lines.push(`<span class="tAffix">◆ ${t('wm.maker')}: ${makerName(gearMaker(g))} · ${t('hw.group')}: ${groupName(gearGroup(g))}</span>`);
  if (g.s.setId) lines.push(`<span class="tLegend">◆ SET ${t(`look.magier.${g.s.setId}.name`)} · 5/5: ${perfectText(g.s.setId, g.slot)}</span>`);
  const tip: TipData = {
    title: gearName(g), color: rar.color, border: rar.color, sub: `${rar.name} · ${slotName(g.slot)}`,
    big: main ? { value: fmtMain(main), label: valueText(main.key), delta: on === g ? t('wcard.equippedLow') : d === null ? undefined : fmtDelta(d),
      deltaColor: on === g ? COLORS.down : d === null ? undefined : deltaColor(d) } : undefined,
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
// Gear-Slots als Umrisse passend zu den Gear-Formen (models/gearParts.ts), auf ~24 px erkennbar, viewBox 24 // PH
const SLOT_SVG: Record<string, string> = {
  kopf: '<path d="M2.5 19.5c3 1.6 16 1.6 19 0"/><path d="M6 19 10.5 7.5C11.5 5 13.5 3.5 17 4.5l2 .8-3.3.4L18 19"/><path d="M7.4 15.5h9.4"/>',   // Spitzhut
  hals: '<path d="M5 3c.5 5 3.5 8.5 7 9.5 3.5-1 6.5-4.5 7-9.5"/><path d="M12 13.5l3 3.5-3 4-3-4z"/>',   // Kette mit Amulett
  ruecken: '<path d="M8 4c1.5 1.5 6.5 1.5 8 0"/><path d="M8 4 4 20.5c1.5.8 3 .3 4-.4 1.3.8 2.7.8 4 0 1.3.8 2.7.8 4 0 1 .7 2.5 1.2 4 .4L16 4"/><circle cx="12" cy="6.5" r="1"/>',   // Umhang mit Spange
  arme: '<path d="M7 21v-4.5L4.6 11.7c-.6-1.2.8-2.2 1.8-1.2L8.5 13V5c0-1.6 2.4-1.6 2.4 0v6V3.8c0-1.6 2.4-1.6 2.4 0V11V5c0-1.6 2.4-1.6 2.4 0V15l-1.2 6z"/><path d="M7 18h9"/>',   // Handschuh mit Stulpe
  koerper: '<path d="M10 3 7.5 4 3 9l2.2 2L7.5 9 5 21h14L16.5 9l2.3 2L21 9l-4.5-5L14 3l-2 2.5z"/><path d="M7 12.5h10"/><path d="M12 5.5v15"/>',   // Robe mit Gürtel
  kosmetik: '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9L9.5 8z"/>',
};
export const slotSvg = (slot: string, color: string) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SLOT_SVG[slot] ?? SLOT_SVG.kosmetik}</svg>`;
// Icon eines Tabs bzw. Baum-Ordners: Waffen der Stab, sonst der Slot (Kosmetik der Stern)
const tabSvg = (x: string, color = 'currentColor') => x === 'waffen' || x === 'waffe' ? typeSvg('staff', color) : slotSvg(x, color);

// ---------- Links: Kopf, Figur mit Slots, Set, Werte ----------
const LEFT: (Slot | 'waffe')[] = ['kopf', 'hals', 'ruecken'], RIGHT: (Slot | 'waffe')[] = ['arme', 'koerper', 'waffe'];
// Nach jeder Änderung: Figur (Set-Skin, Waffen-Look) und Fenster neu
function changed() { mage.refreshLook(); mage.refreshWeapon(); render(); }

// Leeres Waffen-Inventar: die Figur trägt ROLLS.fallback (Pilgerast ohne Effekt). Als alte Waffe (ohne v: 2) baut buildWeaponOf das Modell m
const pilger = () => ({ id: 'pilger', m: ROLLS.fallback, r: 0 });   // erst beim Zeichnen: ROLLS ist beim Laden des Moduls evtl. noch nicht da (Import-Zyklus)
function slotEl(slot: Slot | 'waffe') {
  const wrap = el('div', 'hwSlotWrap'), b = el('button', 'hwSlot'), isW = slot === 'waffe';
  b.type = 'button';
  b.dataset.slot = slot;
  const w = isW && mage.weapon ? equipped() : null, g = !isW && mageGear() ? worn(slot as Slot) : null;
  const color = w ? rarityOf(w).color : g ? gearRarity(g).color : '';
  if (color) b.style.setProperty('--rc', color);
  if (w) { const src = weaponThumb(w); b.innerHTML = src ? `<img src="${src}" alt="">` : typeSvg(typeOf(w), color); }
  else if (g) b.innerHTML = gearThumbHtml(g, slotSvg(slot, color));
  else if (isW && mage.skin === 'krieger') b.innerHTML = '<span class="hwSlotEmpty"></span>';
  else if (isW) { const src = weaponThumb(pilger()); b.innerHTML = `<span class="hwSlotEmpty pilger">${src ? `<img src="${src}" alt="">` : tabSvg(slot)}</span>`; }   // kein Stab: die Figur trägt den Pilgerast, gedimmt
  else b.innerHTML = `<span class="hwSlotEmpty">${tabSvg(slot)}</span>`;   // leer: Umriss gedimmt
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
  if (on) b.innerHTML = lookThumbHtml(on, slotSvg('kosmetik', 'currentColor'));
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
  const head = el('div', 'hwSetHead'), name = el('b', 'fg-title', `${t(`look.magier.${id}.name`)} ${n}/${SLOTS.length}`), bar = el('i', 'hwProg'), fill = el('i');
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
  const fig = live ? figureInfo() : '';   // Besonderheit der Figur (Kill-Anzeige, Batterie, Wut …), Stand jetzt und Regeln
  if (fig) { const f = el('div', 'hwFigInfo'); f.innerHTML = fig; all.append(f); }
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

// ---------- Rechts: Inventar ----------
// Tabs Waffen, 5 Gear-Slots, Kosmetik. Filterleiste wie im früheren Waffenmenü (Listen mit Häkchen, Seltenheits-Rauten, Sortieren, Suche), für Gear mit
// Element, Hersteller, Fokus, Set. Nicht passende Teile werden abgedunkelt, nicht ausgeblendet. Filter in frostgrind.ui.v1 (weaponFilter, gearFilter).
export const TABS: Tab[] = ['waffen', ...SLOTS, 'kosmetik'];
type Kind = 'w' | 'g' | 'k';
const kindOf = (x: Tab): Kind => x === 'waffen' ? 'w' : x === 'kosmetik' ? 'k' : 'g';
type Opt = { id: string; name: string; color?: string; sub?: string };
// Material-Farbe des Herstellers (gen10.py MAKERS) // PH
const MAT_COLOR = { bronze: '#b07a3a', gold: '#e3c27a', darkwood: '#6b4a2a', crystal: '#9fd8ff', blueiron: '#5a7aa8' };
const isNewW = w => w.v === 2;
const schoolKey = (school: string) => school?.toLowerCase();
const W_ATTR: Record<string, (w) => string | null> = {
  type: w => typeOf(w),
  school: w => isNewW(w) ? schoolKey(HEADS[w.s.head]?.[1]) ?? null : null,
  el: w => elementOf(w),
  maker: w => isNewW(w) ? w.s.maker : null,
  val: w => isNewW(w) ? w.s.shaft : null,
};
const G_ATTR: Record<string, (g: GearItem) => string | null> = {
  el: g => g.s.element ?? 'none',
  maker: g => gearMaker(g) ?? 'none',
  focus: g => g.s.focus ?? 'none',
  set: g => g.s.setId ?? 'none',
};
const attrs = (k: Kind) => k === 'w' ? W_ATTR : k === 'g' ? G_ATTR : {};
const valName = (k: string) => t(`wval.${VALUE_KEY[k]}`);
const NONE: Opt = { id: 'none', name: '—' };
// Erst beim ersten Gebrauch gebaut: weaponRolls/baukasten sind beim Import dieses Moduls noch nicht fertig (Import-Kreis über mainMenu)
function options(k: Kind, g: string): Opt[] {
  if (g === 'type') return [...Object.keys(TYPES).map(x => ({ id: x, name: TYPES[x].name })), { id: 'alt', name: t('inv.oldWeapon') }];
  if (g === 'school') return [...new Set(Object.values(HEADS).map(h => schoolKey(h[1])))].map(x => ({ id: x, name: ELEMENTS[x]?.name ?? x, color: ELEMENTS[x] ? elementColor(x) : '' }));
  if (g === 'el') return Object.keys(ELEMENTS).map(x => ({ id: x, name: ELEMENTS[x].name, color: x === 'none' ? '#777777' : elementColor(x) }));
  if (g === 'maker') return [...Object.keys(MAKERS).map(x => ({ id: x, name: MAKERS[x].name, color: MAT_COLOR[MAKERS[x].main], sub: t(`wmat.${MAKERS[x].main}`) })), ...(k === 'g' ? [NONE] : [])];
  if (g === 'val') return Object.keys(SHAFTS).map(x => ({ id: x, name: SHAFTS[x].values.map(valName).join(' / ') }));
  if (g === 'focus') return [...new Set(SLOTS.flatMap(s => gearInv(s).map(x => x.s.focus)).filter(Boolean))].sort().map(x => ({ id: x, name: SPELLS[x]?.name ?? x })).concat(NONE);
  if (g === 'set') return [...Object.keys(SETS).map(x => ({ id: x, name: t(`look.magier.${x}.name`), color: SETS[x].color })), NONE];
  return [];
}
const GROUP_NAME = (g: string) => ({ type: t('inv.type'), school: t('wm.school'), el: t('inv.element'), maker: t('wm.maker'), val: t('wm.values'), focus: t('hw.focus'), set: t('hw.set') })[g] ?? g;
const mainW = w => mainStrength(mainValue(w));
const mainG = (g: GearItem) => mainStrength(gearMainValue(g));
const SORTS: Record<string, [() => string, (k: Kind) => (a, b) => number]> = {
  rar: [() => t('inv.sort.rar'), () => (a, b) => b.r - a.r || b.id - a.id],
  neu: [() => t('inv.sort.neu'), () => (a, b) => b.id - a.id],
  main: [() => t('wm.sort.main'), k => (a, b) => (k === 'w' ? mainW(b) - mainW(a) : mainG(b) - mainG(a)) || b.r - a.r],
  maker: [() => t('wm.maker'), k => (a, b) => String(attrs(k).maker(a)).localeCompare(String(attrs(k).maker(b))) || b.r - a.r],
};
const DEF = { type: null, school: null, el: null, maker: null, val: null, focus: null, set: null, rar: [0, 1, 2, 3, 4, 5], sort: 'rar', q: '' };
const fKey = (k: Kind) => k === 'g' ? 'gearFilter' : 'weaponFilter';
const F = (k: Kind) => ({ ...DEF, ...(uiSettings[fKey(k)] ?? {}) });
const setF = (k: Kind, patch: Record<string, any>) => setUi(fKey(k), { ...F(k), ...patch });
const nameOf = (k: Kind, x) => k === 'w' ? weaponName(x) : gearName(x);
function matches(k: Kind, x) {
  const f = F(k), A = attrs(k);
  for (const g of Object.keys(A)) if (f[g] && !f[g].includes(A[g](x))) return false;
  if (!f.rar.includes(x.r)) return false;
  return !f.q || nameOf(k, x).toLowerCase().includes(f.q.toLowerCase());
}

// Inhalt eines Tabs: Waffen, Gear eines Slots, Kosmetik (alle Looks, gesperrte abgedunkelt)
type Entry = { key: string; kind: Kind; item: any; dim: boolean };
const LOOK_IDS = () => Object.keys(LOOKS);
export const tabCount = (x: Tab) => x === 'waffen' ? meta.inv.length : x === 'kosmetik' ? LOOK_IDS().filter(hasLook).length : gearInv(x).length;
export function entries(x: Tab): Entry[] {
  const k = kindOf(x);
  if (k === 'k') return LOOK_IDS().sort((a, b) => Number(hasLook(b)) - Number(hasLook(a))).map(id => ({ key: `k${id}`, kind: k, item: id, dim: !hasLook(id) }));
  if (k === 'g' && !mageGear()) return [];
  const all = [...(k === 'w' ? meta.inv : gearInv(x as Slot))].sort(SORTS[F(k).sort]?.[1](k) ?? SORTS.rar[1](k));
  const hit = all.filter(i => matches(k, i)), miss = all.filter(i => !matches(k, i));
  return [...hit, ...miss].map(i => ({ key: `${k}${i.id}`, kind: k, item: i, dim: miss.includes(i) }));
}
const isOn = (e: Entry) => e.kind === 'w' ? equipped() === e.item : e.kind === 'g' ? worn(e.item.slot) === e.item : Object.values(LOOK_SLOTS).some(s => lookIn(s) === e.item);
const rarColor = (e: Entry) => e.kind === 'w' ? rarityOf(e.item).color : e.kind === 'g' ? gearRarity(e.item).color : 'var(--fg-title)';
const entryName = (e: Entry) => e.kind === 'k' ? t(LOOKS[e.item].name) : nameOf(e.kind, e.item);
let seenW = 0, seenG = 0;
const isNewEntry = (e: Entry) => e.kind === 'w' ? e.item.id > seenW : e.kind === 'g' ? e.item.id > seenG : false;
// ▲/▼ gegenüber dem Ausgerüsteten (Hauptwert, nur bei gleichem Wert-Wort, Regel in compare.ts)
export function deltaOf(e: Entry): number | null {
  if (e.kind === 'g') return gearDelta(e.item);
  if (e.kind !== 'w') return null;
  const eq = equipped();
  return !eq || eq === e.item ? null : mainDelta(mainValue(e.item), mainValue(eq));
}

let sel: string | null = null;   // gewählter Eintrag im aktiven Tab (Tastatur/Pad, Klick)
function setTab(next: Tab) { tab = next; sel = null; setUi('heroTab', next); render(); }

// Aktionen: Ausrüsten (Klick, Enter, A) und Zerlegen mit Rückfrage (Entf, X). Im Run aus
function wearEntry(e: Entry) {
  sel = e.key;
  if (viewOnly() || e.dim && e.kind === 'k') { render(); return; }
  if (e.kind === 'w') { if (equipped() !== e.item) equip(e.item.id); }
  else if (e.kind === 'g') { if (mageGear() && worn(e.item.slot) !== e.item) wearGear(e.item.slot, e.item.id); }
  else wearLook(LOOKS[e.item].slot, lookIn(LOOKS[e.item].slot) === e.item ? null : e.item);   // Kosmetik: an/aus
  changed();
}
async function salvageEntry(e: Entry) {
  if (viewOnly() || e.kind === 'k') return;
  const name = entryName(e), n = ROLLS.refund[e.item.r];
  const ok = e.kind === 'w' ? await askConfirm(t('shop.salvageTitle'), t('shop.salvageText', { name, n }), t('shop.salvage'))
    : await askConfirm(t('gear.deleteTitle'), t('gear.deleteText', { name, n }), t('shop.salvage'));
  if (!ok) return;
  const list = treeView() ? treeRows() : entries(tab), i = list.findIndex(x => x.key === e.key);
  if (e.kind === 'w') deleteWeapon(e.item.id); else deleteGear(e.item.slot, e.item.id);
  sel = list[i + 1]?.key ?? list[i - 1]?.key ?? null;   // Auswahl rückt weiter (im Baum zur nächsten sichtbaren Zeile)
  changed();
}

// ---------- Filterleiste ----------
let barKind: Kind | null = null;
const RAR_DIA = () => CARD_RARITIES.map((r, i) => `<button type="button" class="hwRar" data-r="${i}" style="--rc:${r.color}" aria-label="${t('inv.rarity')} ${r.name}" title="${r.name}"></button>`).join('');
function buildBar(k: Kind) {
  barKind = k;
  const bar = $('hwBar');
  bar.hidden = k === 'k';
  if (k === 'k') { bar.textContent = ''; return; }
  bar.innerHTML = `${Object.keys(attrs(k)).map(g => `<div class="hwDrop" data-g="${g}"><button type="button" class="hwChip" aria-haspopup="listbox" aria-expanded="false"><small>${GROUP_NAME(g)}</small><b></b></button><div class="hwList fg-panel" role="listbox" hidden></div></div>`).join('')}
    <div class="hwRars"><small>${t('inv.rarity')}</small><span>${RAR_DIA()}</span></div>
    <div class="hwDrop" data-g="sort"><button type="button" class="hwChip" aria-haspopup="listbox" aria-expanded="false"><small>${t('inv.sort')}</small><b></b></button><div class="hwList fg-panel" role="listbox" hidden></div></div>
    <label class="hwSearch"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="hwQ" placeholder="${t('wm.search')}" aria-label="${t('wm.search')}"></label>`;
  for (const drop of bar.querySelectorAll<HTMLElement>('.hwDrop')) {
    const g = drop.dataset.g, list = drop.querySelector<HTMLElement>('.hwList'), btn = drop.querySelector('.hwChip');
    btn.addEventListener('click', () => {
      closeLists(drop);
      list.hidden = !list.hidden;
      btn.setAttribute('aria-expanded', String(!list.hidden));
      if (!list.hidden) renderList(drop);
    });
    list.addEventListener('change', () => {
      const on = [...list.querySelectorAll<HTMLInputElement>('input:checked')].map(i => i.dataset.v);
      setF(k, { [g]: on.length === options(k, g).length ? null : on });
      renderInv();
    });
    list.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (g === 'sort') { setF(k, { sort: b.dataset.v }); closeLists(); }
      else setF(k, { [g]: b.dataset.all === '1' ? null : [] });
      renderList(drop);
      renderInv();
    });
  }
  for (const b of bar.querySelectorAll<HTMLElement>('.hwRar')) b.addEventListener('click', () => {
    const r = +b.dataset.r, rar = F(k).rar;
    setF(k, { rar: rar.includes(r) ? rar.filter(x => x !== r) : [...rar, r].sort() });
    renderInv();
  });
  const q = $('hwQ') as HTMLInputElement;
  q.addEventListener('input', () => { setF(k, { q: q.value.trim() }); renderInv(); });
  q.addEventListener('keydown', e => {   // Tippen löst keine Spieltasten aus; Esc/Enter/↓ zurück ins Raster
    e.stopPropagation();
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'ArrowDown') { e.preventDefault(); q.blur(); }
  });
}
function chipValue(k: Kind, g: string) {
  const f = F(k);
  if (g === 'sort') return (SORTS[f.sort] ?? SORTS.rar)[0]();
  const s = f[g];
  if (!s) return t('inv.all');
  if (!s.length) return t('wm.none');
  return s.length === 1 ? options(k, g).find(o => o.id === s[0])?.name ?? s[0] : t('wm.picked', { n: s.length });
}
function renderList(drop: HTMLElement) {
  const k = barKind, g = drop.dataset.g, list = drop.querySelector<HTMLElement>('.hwList'), f = F(k);
  if (g === 'sort') {
    list.innerHTML = Object.entries(SORTS).map(([id, [n]]) => `<button type="button" role="option" class="hwOpt${f.sort === id ? ' on' : ''}" data-v="${id}" aria-selected="${f.sort === id}">${n()}</button>`).join('');
    return;
  }
  const s = f[g];
  list.innerHTML = options(k, g).map(o => `<label class="hwOpt"><input type="checkbox" data-v="${o.id}"${!s || s.includes(o.id) ? ' checked' : ''}>`
    + `${o.color ? `<i style="background:${o.color}"></i>` : ''}<span>${o.name}</span>${o.sub ? `<small>${o.sub}</small>` : ''}</label>`).join('')
    + `<div class="hwAllNone"><button type="button" data-all="1">${t('inv.all')}</button><button type="button" data-all="0">${t('wm.none')}</button></div>`;
}
function closeLists(except?: HTMLElement) {
  for (const d of document.querySelectorAll<HTMLElement>('#heroModal .hwDrop')) if (d !== except) {
    d.querySelector<HTMLElement>('.hwList').hidden = true;
    d.querySelector('.hwChip').setAttribute('aria-expanded', 'false');
  }
}
const listsOpen = () => !!document.querySelector('#heroModal .hwList:not([hidden])');
$('heroModal').addEventListener('pointerdown', e => { if (!(e.target as HTMLElement).closest('.hwDrop')) closeLists(); });
// Aktive Filter als Chips mit ✕
function activeChips(k: Kind) {
  const f = F(k), out: [string, Record<string, any>][] = [];
  for (const g of Object.keys(attrs(k))) if (f[g]) out.push([`${GROUP_NAME(g)}: ${f[g].length ? f[g].map(v => options(k, g).find(o => o.id === v)?.name ?? v).join(', ') : t('wm.none')}`, { [g]: null }]);
  if (f.rar.length < CARD_RARITIES.length) out.push([`${t('inv.rarity')}: ${f.rar.map(i => CARD_RARITIES[i].name).join(', ') || t('wm.none')}`, { rar: DEF.rar }]);
  if (f.q) out.push([`„${f.q}“`, { q: '' }]);
  const box = $('hwChips');
  box.textContent = '';
  for (const [label, reset] of out) {
    const b = el('button', 'hwActiveChip', `${label} ✕`);
    b.type = 'button';
    b.addEventListener('click', () => { setF(k, reset); if ('q' in reset) ($('hwQ') as HTMLInputElement).value = ''; renderInv(); });
    box.append(b);
  }
}

// ---------- Raster ----------
const GRID = 25;   // wie ROLLS.invMax / GEAR.invMax; im Dev-Inventar (50) wachsen Reihen dazu
function cellInner(e: Entry) {
  const c = rarColor(e);
  if (e.kind === 'k') return lookThumbHtml(e.item, e.dim ? LOCK : slotSvg('kosmetik', c)) + (e.dim ? `<i class="hwLock">${LOCK}</i>` : '')   // gesperrt: Bild grau mit Schloss
    + (isOn(e) ? `<b class="hwE" title="${t('shop.equipped')}">E</b>` : '');
  const i = e.item, elm = e.kind === 'w' ? elementOf(i) : i.s.element, mk = e.kind === 'w' ? W_ATTR.maker(i) : gearMaker(i);
  return (e.kind === 'w' ? weaponThumbHtml(i, typeSvg(typeOf(i), c)) : gearThumbHtml(i, slotSvg(i.slot, c)))
    + (elm && elm !== 'none' ? `<i class="hwEl" style="--ec:${elementColor(elm)}" title="${ELEMENTS[elm]?.name ?? elm}"></i>` : '')
    + (mk && MAKERS[mk] ? `<i class="hwMk" style="background:${MAT_COLOR[MAKERS[mk].main]}" title="${MAKERS[mk].name}"></i>` : '')
    + (e.kind === 'g' && i.s.setId ? '<b class="hwSetMark">SET</b>' : '')
    + (isOn(e) ? `<b class="hwE" title="${t('shop.equipped')}">E</b>` : '')
    + (isNewEntry(e) ? `<b class="hwNew">${t('shop.new')}</b>` : '');
}
const LOCK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
export function tipOf(e: Entry): TipData | null {
  if (e.kind === 'g') return gearTip(e.item);
  if (e.kind === 'k') {
    const L = LOOKS[e.item];
    return { title: t(L.name), color: 'var(--fg-title)', sub: `${t('hw.cosmetic')} · ${L.slot === 'waffe' ? t('cw.weapon') : slotName(L.slot)}`,
      short: [lookHint(e.item), hasLook(e.item) ? t(isOn(e) ? 'hw.lookOnTip' : 'hw.lookOffTip') : `🔒 ${lookSource(e.item)}`].filter(Boolean).join('<br>') };   // Reaktion, dann Zustand bzw. Quelle (Box, Set, ⭐ Meilenstein mit Fortschritt)
  }
  return null;
}
function attachEntryTip(node: HTMLElement, e: Entry) {
  if (e.kind === 'w') attachWeaponCard(node, e.item);
  else attachTip(node, () => tipOf(e));
}
function renderGrid(list: Entry[]) {
  const grid = $('hwGrid');
  grid.textContent = '';
  const cols = 10, n = Math.max(tab === 'kosmetik' ? cols : GRID, list.length);
  for (let i = 0; i < n; i++) {
    const e = list[i], cell = el('button', 'hwCell' + (e ? '' : ' empty') + (e?.dim ? e.kind === 'k' ? ' locked' : ' dim' : '') + (e && e.key === sel ? ' sel' : ''));
    cell.type = 'button';
    if (e) {
      cell.dataset.key = e.key;
      cell.style.setProperty('--rc', rarColor(e));
      cell.innerHTML = cellInner(e);
      cell.setAttribute('aria-label', `${entryName(e)}${e.kind !== 'k' ? ` · ${CARD_RARITIES[e.item.r].name}` : ''}`);
      attachEntryTip(cell, e);
      cell.addEventListener('click', () => wearEntry(e));
      cell.addEventListener('contextmenu', ev => { ev.preventDefault(); sel = e.key; render(); });
    } else cell.disabled = true;
    grid.append(cell);
  }
}

// ---------- Baum: statt des Rasters, die Tabs werden Ordner (auf/zu und Ansicht in frostgrind.ui.v1) ----------
const treeView = () => uiSettings.heroView === 'tree';
// Ordner: oben was es ist (Tab), darin nach Schule = Element (Kosmetik: nach Slot). Offen-Schlüssel in heroOpen: „waffen“ bzw. „waffen/frost“
const isOpenF = (f: string) => (uiSettings.heroOpen ?? []).includes(f);
function setFolder(f: string, open: boolean) {
  const cur = uiSettings.heroOpen ?? [];
  setUi('heroOpen', open ? [...new Set([...cur, f])] : cur.filter(x => x !== f));
}
const tabName = (x: Tab) => x === 'waffen' ? t('wm.title') : x === 'kosmetik' ? t('hw.cosmetic') : slotName(x);
const tabFill = (x: Tab) => x === 'kosmetik' ? `${tabCount(x)}` : `${tabCount(x)}/${x === 'waffen' ? ROLLS.invMax : GEAR.invMax}`;
const tabLabel = (x: Tab) => `${tabName(x)} ${tabFill(x)}`;
const subOf = (e: Entry): string => {
  if (e.kind === 'k') return LOOKS[e.item].slot;
  const elm = e.kind === 'w' ? elementOf(e.item) : e.item.s.element;
  return elm in ELEMENTS ? elm : 'none';
};
const SUBS = (x: Tab): string[] => x === 'kosmetik' ? [...LOOK_SLOTS] : [...Object.keys(ELEMENTS).filter(k => k !== 'none'), 'none'];   // „Ohne Element“ zuletzt
const subName = (x: Tab, sub: string) => x === 'kosmetik' ? (sub === 'waffe' ? t('cw.weapon') : slotName(sub as Slot)) : sub === 'none' ? t('hw.noElement') : ELEMENTS[sub]?.name ?? sub;
const subColor = (x: Tab, sub: string) => x === 'kosmetik' || sub === 'none' ? '' : elementColor(sub);
type TreeRow = { key: string; tab: Tab; depth: 0 | 1 | 2; parent?: string; folder?: string; sub?: string; n?: [number, number]; entry?: Entry };
// Sichtbare Zeilen von oben nach unten (auch für die Pfeiltasten). Unterordner nur, wenn sie Einträge haben
export function treeRows(): TreeRow[] {
  const out: TreeRow[] = [];
  for (const x of TABS) {
    const top = `f:${x}`;
    out.push({ key: top, tab: x, depth: 0, folder: x });
    if (!isOpenF(x)) continue;
    const list = entries(x);
    for (const sub of SUBS(x)) {
      const in_ = list.filter(e => subOf(e) === sub);
      if (!in_.length) continue;
      const f = `${x}/${sub}`, key = `f:${f}`;
      out.push({ key, tab: x, depth: 1, parent: top, folder: f, sub, n: [in_.filter(e => !e.dim).length, in_.length] });
      if (isOpenF(f)) for (const e of in_) out.push({ key: e.key, tab: x, depth: 2, parent: key, entry: e });
    }
  }
  return out;
}
// Icon einer Zeile in Seltenheitsfarbe: Waffen ihr Typ, Gear der Slot, Kosmetik Stern bzw. Schloss
const entryIcon = (e: Entry) => e.kind === 'w' ? typeSvg(typeOf(e.item), rarColor(e)) : e.kind === 'g' ? slotSvg(e.item.slot, rarColor(e)) : e.dim ? LOCK : slotSvg('kosmetik', rarColor(e));
const icon = (svg: string) => { const i = el('i', 'hwTIcon'); i.innerHTML = svg; return i; };
function renderTree() {
  const box = $('hwTree');
  box.textContent = '';
  for (const r of treeRows()) {
    const row = el('button', 'hwTRow' + (r.key === sel ? ' sel' : '') + (r.depth ? ` d${r.depth}` : ''));
    row.type = 'button';
    row.dataset.key = r.key;
    if (!r.entry) {
      const open = isOpenF(r.folder);
      row.classList.add('folder');
      row.setAttribute('aria-expanded', String(open));
      row.setAttribute('aria-level', String(r.depth + 1));
      row.append(el('span', 'hwCaret', open ? '▾' : '▸'));
      if (r.depth === 0) row.append(icon(tabSvg(r.tab)), el('span', 'hwTName', tabLabel(r.tab)));
      else {   // Unterordner: Schule (Element) in ihrer Farbe bzw. Kosmetik-Slot, mit Anzahl (gefiltert: „passend/alle“)
        const c = subColor(r.tab, r.sub), name = el('span', 'hwTName', `${subName(r.tab, r.sub)} ${r.n[0] === r.n[1] ? r.n[1] : `${r.n[0]}/${r.n[1]}`}`);
        if (r.tab === 'kosmetik') row.append(icon(tabSvg(r.sub)));
        else { const dot = el('i', 'hwElDot'); if (c) dot.style.setProperty('--ec', c); row.append(dot); }
        if (c) name.style.color = c;
        row.append(name);
      }
      row.addEventListener('click', () => { sel = r.key; tab = r.tab; setUi('heroTab', r.tab); setFolder(r.folder, !open); render(); });
    } else {
      const e = r.entry, c = rarColor(e), d = deltaOf(e);
      if (e.dim) row.classList.add('dim');
      const name = el('span', 'hwTName', entryName(e));
      name.style.color = c;
      const ic = icon(e.kind === 'g' ? gearThumbHtml(e.item, entryIcon(e)) : e.kind === 'k' && !e.dim ? lookThumbHtml(e.item, entryIcon(e)) : entryIcon(e));   // Gear und freie Kosmetik mit Bild, Waffen (hochkant, zu dünn) und Gesperrtes mit Umriss
      if (e.kind === 'g' || e.kind === 'k' && !e.dim) ic.classList.add('hwTThumb');
      row.append(ic, name);
      if (e.kind === 'g' && e.item.s.setId) row.append(el('b', 'hwSetMark', 'SET'));
      if (d !== null) row.append(el('span', d > 0 ? 'hwUp' : 'hwDown', fmtDelta(d, false)));
      if (isOn(e)) row.append(el('b', 'hwE', 'E'));
      if (isNewEntry(e)) row.append(el('b', 'hwNew', t('shop.new')));
      row.setAttribute('role', 'treeitem');
      attachEntryTip(row, e);
      row.addEventListener('click', () => { tab = r.tab; setUi('heroTab', r.tab); wearEntry(e); });
    }
    box.append(row);
  }
}

// Gewählter Eintrag unten: Name, Hauptwert mit ▲/▼, Ausrüsten und Zerlegen (+Staub). Shift: das Ausgerüstete zum Vergleich
let shift = false;
function renderSel(list: Entry[]) {
  const box = $('hwSel'), e = list.find(x => x.key === sel);
  box.textContent = '';
  if (!e) { box.append(el('span', 'hwMuted', list.length ? t('hw.selHint') : tab === 'waffen' ? t('wm.empty') : t('gear.invEmpty'))); return; }
  const other = e.kind === 'w' ? equipped() : e.kind === 'g' ? worn(e.item.slot) : null;
  const show = shift && other && other !== e.item ? { ...e, item: other } as Entry : e;
  const name = el('b', 'hwSelName', entryName(show));
  name.style.color = rarColor(show);
  const info = el('div', 'hwSelInfo');
  info.append(name);
  const sub = shift && show !== e ? t('wm.compare') : e.kind === 'k' ? t('hw.cosmetic') : (e.kind === 'w' ? effectRows(e.item) : gearRows(e.item)).find(r => r.kind === 'value')?.text ?? '';
  const d = show === e ? deltaOf(e) : null;
  const subEl = el('small', '', sub);
  if (d !== null) subEl.append(el('span', d > 0 ? 'up' : 'down', ` ${fmtDelta(d)}`));
  if (isOn(e)) subEl.append(el('span', 'hwOn', ` · ${t('shop.equipped')}`));
  info.append(subEl);
  box.append(info);
  if (viewOnly()) { box.append(el('span', 'hwMuted', t('gear.menuOnly'))); return; }
  const eq = el('button', 'fg-btn', e.kind === 'k' ? t(isOn(e) ? 'gear.unwear' : 'gear.wear') : t(isOn(e) ? 'shop.equipped' : 'shop.equip'));
  eq.type = 'button';
  eq.disabled = e.kind === 'k' ? e.dim : isOn(e);
  eq.addEventListener('click', () => wearEntry(e));
  box.append(eq);
  if (e.kind !== 'k') {
    const del = el('button', 'fg-btn alt', `${t('shop.salvage')} +${ROLLS.refund[e.item.r]}`);
    del.type = 'button';
    del.addEventListener('click', () => salvageEntry(e));
    box.append(del);
  }
}

// Im Run: Funde dieses Runs (loot.ts state.finds), behaltene in Seltenheitsfarbe, Staub-Funde gezählt. Hauptmenü: wartende Funde (volles Inventar)
function renderFinds() {
  const box = $('hwFinds'), wait = $('hwWait');
  box.textContent = wait.textContent = '';
  if (viewOnly()) {
    const finds: Find[] = state.finds ?? [], kept = finds.filter(f => !f.dust), dust = finds.length - kept.length;
    box.append(el('b', '', `${t('loot.title', { n: finds.length })} `));
    if (!finds.length) box.append(el('span', 'hwMuted', t('gear.noFinds')));
    for (const f of kept) { const c = el('span', 'hwFind', `${gearName(f.item)}${f.item.s.setId ? ' · SET' : ''} (${slotName(f.item.slot)})`); c.style.color = gearRarity(f.item).color; box.append(c); }
    if (dust) box.append(el('span', 'hwMuted', t('gear.findsDust', { n: dust })));
    box.title = box.textContent;
  } else if (overflow().length) {
    const b = el('button', 'fg-btn', t('gear.waiting', { n: overflow().length }));
    b.type = 'button';
    b.addEventListener('click', () => openKeepChooser(render));
    wait.append(b);
  }
}

// Zu wenig Platz (kleines Fenster, Ersatzschrift ohne Webfonts): Tabs nur mit Icon + Zahl, der Name steht im title/aria-label.
// Gemessen: erst voll zeigen, wird ein Name gekürzt → .compact. Neu bei Größenänderung und sobald Schriften nachladen.
function fitTabs() {
  const tabs = $('hwTabs');
  if (!tabs.offsetParent) return;   // zu oder Baum-Ansicht: der ResizeObserver misst, sobald sichtbar
  tabs.classList.remove('compact');
  const cut = [...tabs.querySelectorAll<HTMLElement>('.hwTab span')].some(s => s.scrollWidth > s.clientWidth + 0.5);
  tabs.classList.toggle('compact', cut);
}
new ResizeObserver(fitTabs).observe($('hwTabs'));
document.fonts?.addEventListener?.('loadingdone', fitTabs);

function renderInv() {
  const k = kindOf(tab);
  // Tabs mit Belegung (x/25, Kosmetik nur Anzahl)
  const tabs = $('hwTabs');
  tabs.textContent = '';
  for (const x of TABS) {
    const b = el('button', 'hwTab' + (x === tab ? ' on' : ''));
    b.innerHTML = tabSvg(x);
    b.append(el('span', '', tabName(x)), el('small', '', tabFill(x)));
    b.title = tabLabel(x);
    b.setAttribute('aria-label', tabLabel(x));
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(x === tab));
    b.addEventListener('click', () => setTab(x));
    tabs.append(b);
  }
  fitTabs();
  if (barKind !== k) buildBar(k);
  if (k !== 'k') {
    const f = F(k);
    for (const d of document.querySelectorAll<HTMLElement>('#hwBar .hwDrop')) {
      d.querySelector('.hwChip b').textContent = `${chipValue(k, d.dataset.g)} ▾`;
      d.querySelector('.hwChip').classList.toggle('on', d.dataset.g !== 'sort' && f[d.dataset.g] !== null);
    }
    for (const b of document.querySelectorAll<HTMLElement>('#hwBar .hwRar')) b.setAttribute('aria-pressed', String(f.rar.includes(+b.dataset.r)));
    const q = $('hwQ') as HTMLInputElement;
    if (document.activeElement !== q) q.value = f.q;
    activeChips(k);
  } else $('hwChips').textContent = '';
  const list = entries(tab), tree = treeView();
  $('heroModal').classList.toggle('tree', tree);
  for (const b of document.querySelectorAll<HTMLElement>('.hwToggle button')) { b.classList.toggle('on', (b.dataset.v === 'tree') === tree); b.setAttribute('aria-pressed', String((b.dataset.v === 'tree') === tree)); }
  if (tree ? !treeRows().some(r => r.key === sel) : !list.some(e => e.key === sel)) sel = list.find(isOn)?.key ?? list[0]?.key ?? null;
  if (tree && !treeRows().some(r => r.key === sel)) sel = `f:${tab}`;
  $('hwCount').textContent = k === 'k' ? '' : t('wm.count', { a: list.filter(e => !e.dim).length, b: list.length });
  // Probe tragen: gewählte Waffe an der Figur
  const se = list.find(e => e.key === sel);
  mage.previewWeapon(se?.kind === 'w' && se.item !== equipped() ? se.item : null);
  if (tree) { $('hwGrid').textContent = ''; renderTree(); }
  else if (k === 'g' && !mageGear()) { $('hwTree').textContent = ''; $('hwGrid').textContent = ''; $('hwGrid').append(el('p', 'hwMuted', t('gear.mageOnly'))); }
  else { $('hwTree').textContent = ''; renderGrid(list); }
  renderSel(list);
  renderFinds();
  $('hwDust').innerHTML = t('gear.info', { dust: fmtInt(meta.dust) });
  ($('hwChest') as HTMLButtonElement).disabled = viewOnly();
  // Verschmelzen gibt es im Code nicht: Knopf nur als Anzeige, deaktiviert
  const pool = k === 'w' ? meta.inv.filter(w => w !== equipped()) : k === 'g' ? gearInv(tab as Slot).filter(g => g !== worn(tab as Slot)) : [];
  const counts = CARD_RARITIES.map((_, r) => pool.filter(x => x.r === r).length);
  $('hwFuse').textContent = t('wm.fuse', { r: CARD_RARITIES[Math.max(0, counts.findIndex(n => n >= 3))].name });
  $('hwHint').textContent = viewOnly() ? t('hw.hintRun') : t('hw.hintKeys');
  $('hwHint').title = t('hw.hint');
}
for (const b of document.querySelectorAll<HTMLElement>('.hwToggle button')) b.addEventListener('click', () => { setUi('heroView', b.dataset.v as 'grid' | 'tree'); renderInv(); });
$('hwChest').addEventListener('click', () => {
  const fromShop = $('shopModal').classList.contains('show');
  closeHero();
  if (!fromShop && $('startModal').classList.contains('show')) $('menuShop').click();
});
addEventListener('keydown', e => { if (e.key === 'Shift' && !shift && heroOpen()) { shift = true; renderSel(entries(tab)); } }, true);
addEventListener('keyup', e => { if (e.key === 'Shift' && shift) { shift = false; if (heroOpen()) renderSel(entries(tab)); } });

function render() {
  hideTip();
  $('heroModal').classList.toggle('viewOnly', viewOnly());
  renderLeft();
  renderInv();
}

export function openHero(opts: { tab?: Tab; done?: () => void } = {}) {
  onClose = opts.done ?? null;
  if (opts.tab && opts.tab !== tab) { tab = opts.tab; sel = null; }
  seenW = uiSettings.weaponSeen;
  seenG = uiSettings.gearSeen;
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
  closeLists();
  setUi('weaponSeen', Math.max(uiSettings.weaponSeen, ...meta.inv.map(w => w.id)));   // ab jetzt nicht mehr NEU
  setUi('gearSeen', Math.max(uiSettings.gearSeen, ...SLOTS.flatMap(s => gearInv(s).map(g => g.id))));
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

// ---------- Bedienung ohne Maus: Tastatur und Pad (gamepad.ts) über dieselben Befehle ----------
export type HeroCmd = 'left' | 'right' | 'up' | 'down' | 'enter' | 'delete' | 'prevTab' | 'nextTab' | 'view' | 'search' | 'close';
// Auswahl sichtbar machen: hinscrollen und die Karte am Eintrag zeigen
function showSel() {
  const node = document.querySelector<HTMLElement>(`#heroModal [data-key="${CSS.escape(sel ?? '')}"]`);
  if (!node) { hideTip(); return; }
  node.scrollIntoView({ block: 'nearest' });
  const e = (treeView() ? treeRows().find(r => r.key === sel)?.entry : entries(tab).find(x => x.key === sel)) ?? null;
  if (!e) { hideTip(); return; }
  tipAt(node, () => e.kind === 'w' ? weaponCardData(e.item) : tipOf(e));
}
function moveSel(step: number) {
  if (treeView()) {
    const rows = treeRows(), i = rows.findIndex(r => r.key === sel), next = rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? 0 : i + step))];
    if (next) { sel = next.key; if (next.tab !== tab) { tab = next.tab; setUi('heroTab', tab); } }
  } else {
    const list = entries(tab), i = list.findIndex(x => x.key === sel);
    const next = list[i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + step))];
    if (next) sel = next.key;
  }
  render();
  showSel();
}
function stepTab(d: number) { setTab(TABS[(TABS.indexOf(tab) + d + TABS.length) % TABS.length]); if (treeView()) { sel = `f:${tab}`; render(); } showSel(); }
export function heroCommand(cmd: HeroCmd) {
  if (!heroOpen() || askOpen()) return;
  const tree = treeView(), row = tree ? treeRows().find(r => r.key === sel) : null, cur = tree ? row?.entry : entries(tab).find(x => x.key === sel);
  if (cmd === 'close') { if (listsOpen()) closeLists(); else closeHero(); return; }
  if (cmd === 'up') return moveSel(tree ? -1 : -10);
  if (cmd === 'down') return moveSel(tree ? 1 : 10);
  if (cmd === 'left') {
    if (!tree) return moveSel(-1);
    if (row?.folder && isOpenF(row.folder)) { setFolder(row.folder, false); render(); showSel(); return; }   // Ordner zu
    if (row?.parent) { sel = row.parent; render(); showSel(); }                                             // zum Eltern-Ordner
    return;
  }
  if (cmd === 'right') {
    if (!tree) return moveSel(1);
    if (row?.folder && !isOpenF(row.folder)) { setFolder(row.folder, true); render(); showSel(); return; }  // Ordner auf
    return moveSel(1);
  }
  if (cmd === 'enter') {
    if (row?.folder) { setFolder(row.folder, !isOpenF(row.folder)); render(); showSel(); return; }
    if (cur) { wearEntry(cur); showSel(); }
    return;
  }
  if (cmd === 'delete') { if (cur) salvageEntry(cur).then(showSel); return; }
  if (cmd === 'prevTab') return stepTab(-1);
  if (cmd === 'nextTab') return stepTab(1);
  if (cmd === 'view') { setUi('heroView', tree ? 'grid' : 'tree'); renderInv(); showSel(); return; }
  if (cmd === 'search') { const q = document.getElementById('hwQ') as HTMLInputElement | null; if (q && !$('hwBar').hidden) { hideTip(); q.focus(); q.select(); } }
}
// Pfeile wählen (im Baum → ← auf/zu), Enter rüstet aus, Entf zerlegt (Rückfrage), / sucht, Q/E bzw. Bild↑/↓ wechseln den Tab, Tab schaltet Raster/Baum,
// Shift vergleicht (Karte und Zeile unten), Esc schließt. Tasten, die hier etwas tun, gehen nicht weiter ans Spiel
const KEYS: Record<string, HeroCmd> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'enter', NumpadEnter: 'enter', Delete: 'delete',
  KeyQ: 'prevTab', KeyE: 'nextTab', PageUp: 'prevTab', PageDown: 'nextTab', Tab: 'view', Slash: 'search', NumpadDivide: 'search', Escape: 'close' };
$('hwClose').addEventListener('click', closeHero);
addEventListener('keydown', e => {
  if (!heroOpen() || askOpen() || e.target instanceof HTMLInputElement) return;
  const cmd = e.key === '/' ? 'search' : KEYS[e.code];
  if (!cmd || e.ctrlKey || e.altKey || e.metaKey) return;
  if (cmd === 'enter' && document.activeElement instanceof HTMLButtonElement && document.activeElement.closest('#heroModal') && !document.activeElement.closest('.hwGrid, .hwTree')) return;   // fokussierter Knopf: der Browser klickt
  e.preventDefault();
  e.stopImmediatePropagation();
  heroCommand(cmd);
}, true);
