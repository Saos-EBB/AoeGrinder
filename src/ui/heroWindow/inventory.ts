// Charakterfenster rechts (E10, aus heroWindow.ts): Tabs, Inhalt und Auswahl, Ausrüsten und Zerlegen, Raster, gewählter Eintrag, Funde, Inventar zeichnen.
import { $ } from '../../util';
import { state } from '../../state';
import { SPELLS, CARD_RARITIES } from '../../config';
import type { Find } from '../../loot';
import { meta } from '../../meta';
import { heroModel } from '../../models/heroModel';
import { ROLLS, VALUE_KEY, equipped, equip, deleteWeapon, weaponName, rarityOf, typeOf, elementOf, effectRows, mainValue } from '../../weaponRolls';
import { SLOTS, KOSMETIK_SLOTS, KOSMETIK, GEAR, type Slot, type GearItem } from '../../gear/data';
import { SETS } from '../../gear/sets';
import { worn, wearGear, hasKosmetik, kosmetikIn, wearKosmetik, gearInv, deleteGear, overflow } from '../../gear/inventory';
import { gearName, gearRows, slotName, kosmetikSource, kosmetikHint, gearMainValue } from '../../gear/text';
import { MAKERS, TYPES, HEADS, SHAFTS, ELEMENTS, elementColor } from '../../models/weapons/baukasten';
import { askConfirm } from '../confirm';
import { openKeepChooser } from '../lootView';
import { fmtInt } from '../fmt';
import { attachWeaponCard } from '../weaponCard';
import { mainDelta, mainStrength, fmtDelta } from '../compare';
import { gearThumbHtml, kosmetikThumbHtml, weaponThumbHtml } from '../itemThumb';
import { attachTip, type TipData } from '../tooltip';
import { uiSettings, setUi } from '../uiSettings';
import { t } from '../../i18n';
import { elementOfTag } from '../../figureTable';
import { el } from '../dom';
import { type Tab, type Kind, hw, viewOnly, mageGear } from './state';
import { gearMaker, gearDelta, gearTip, typeSvg, slotSvg, tabSvg, changed } from './left';
import { buildBar, chipValue, activeChips } from './filter';
import { treeView, tabName, tabFill, tabLabel, treeRows, renderTree } from './tree';
import { render } from './index';

// ---------- Rechts: Inventar ----------
// Tabs Waffen, 5 Gear-Slots, Kosmetik. Filterleiste wie im früheren Waffenmenü (Listen mit Häkchen, Seltenheits-Rauten, Sortieren, Suche), für Gear mit
// Element, Hersteller, Fokus, Set. Nicht passende Teile werden abgedunkelt, nicht ausgeblendet. Filter in frostgrind.ui.v1 (weaponFilter, gearFilter).
export const TABS: Tab[] = ['waffen', ...SLOTS, 'kosmetik'];
const kindOf = (x: Tab): Kind => x === 'waffen' ? 'w' : x === 'kosmetik' ? 'k' : 'g';
type Opt = { id: string; name: string; color?: string; sub?: string };
// Material-Farbe des Herstellers (gen10.py MAKERS) // PH
const MAT_COLOR = { bronze: '#b07a3a', gold: '#e3c27a', darkwood: '#6b4a2a', crystal: '#9fd8ff', blueiron: '#5a7aa8' };
const isNewW = w => w.v === 2;
const schoolKey = (school: string) => elementOfTag(school);   // HEADS-Schule ('Frost') → Element (figureTable.ts)
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
export const attrs = (k: Kind) => k === 'w' ? W_ATTR : k === 'g' ? G_ATTR : {};
const valName = (k: string) => t(`wval.${VALUE_KEY[k]}`);
const NONE: Opt = { id: 'none', name: '—' };
// Erst beim ersten Gebrauch gebaut: weaponRolls/baukasten sind beim Import dieses Moduls noch nicht fertig (Import-Kreis über mainMenu)
export function options(k: Kind, g: string): Opt[] {
  if (g === 'type') return [...Object.keys(TYPES).map(x => ({ id: x, name: TYPES[x].name })), { id: 'alt', name: t('inv.oldWeapon') }];
  if (g === 'school') return [...new Set(Object.values(HEADS).map(h => schoolKey(h[1])))].map(x => ({ id: x, name: ELEMENTS[x]?.name ?? x, color: ELEMENTS[x] ? elementColor(x) : '' }));
  if (g === 'el') return Object.keys(ELEMENTS).map(x => ({ id: x, name: ELEMENTS[x].name, color: x === 'none' ? '#777777' : elementColor(x) }));
  if (g === 'maker') return [...Object.keys(MAKERS).map(x => ({ id: x, name: MAKERS[x].name, color: MAT_COLOR[MAKERS[x].main], sub: t(`wmat.${MAKERS[x].main}`) })), ...(k === 'g' ? [NONE] : [])];
  if (g === 'val') return Object.keys(SHAFTS).map(x => ({ id: x, name: SHAFTS[x].values.map(valName).join(' / ') }));
  if (g === 'focus') return [...new Set(SLOTS.flatMap(s => gearInv(s).map(x => x.s.focus)).filter(Boolean))].sort().map(x => ({ id: x, name: SPELLS[x]?.name ?? x })).concat(NONE);
  if (g === 'set') return [...Object.keys(SETS).map(x => ({ id: x, name: t(`look.magier.${x}.name`), color: SETS[x].color })), NONE];
  return [];
}
export const GROUP_NAME = (g: string) => ({ type: t('inv.type'), school: t('hw.school'), el: t('inv.element'), maker: t('hw.maker'), val: t('hw.values'), focus: t('hw.focus'), set: t('hw.set') })[g] ?? g;
const mainW = w => mainStrength(mainValue(w));
const mainG = (g: GearItem) => mainStrength(gearMainValue(g));
export const SORTS: Record<string, [() => string, (k: Kind) => (a, b) => number]> = {
  rar: [() => t('inv.sort.rar'), () => (a, b) => b.r - a.r || b.id - a.id],
  neu: [() => t('inv.sort.neu'), () => (a, b) => b.id - a.id],
  main: [() => t('hw.sort.main'), k => (a, b) => (k === 'w' ? mainW(b) - mainW(a) : mainG(b) - mainG(a)) || b.r - a.r],
  maker: [() => t('hw.maker'), k => (a, b) => String(attrs(k).maker(a)).localeCompare(String(attrs(k).maker(b))) || b.r - a.r],
};
export const DEF = { type: null, school: null, el: null, maker: null, val: null, focus: null, set: null, rar: [0, 1, 2, 3, 4, 5], sort: 'rar', q: '' };
const fKey = (k: Kind) => k === 'g' ? 'gearFilter' : 'weaponFilter';
export const F = (k: Kind) => ({ ...DEF, ...(uiSettings[fKey(k)] ?? {}) });
export const setF = (k: Kind, patch: Record<string, any>) => setUi(fKey(k), { ...F(k), ...patch });
const nameOf = (k: Kind, x) => k === 'w' ? weaponName(x) : gearName(x);
function matches(k: Kind, x) {
  const f = F(k), A = attrs(k);
  for (const g of Object.keys(A)) if (f[g] && !f[g].includes(A[g](x))) return false;
  if (!f.rar.includes(x.r)) return false;
  return !f.q || nameOf(k, x).toLowerCase().includes(f.q.toLowerCase());
}

// Inhalt eines Tabs: Waffen, Gear eines Slots, Kosmetik (alle Looks, gesperrte abgedunkelt)
export type Entry = { key: string; kind: Kind; item: any; dim: boolean };
const KOSMETIK_IDS = () => Object.keys(KOSMETIK);
export const tabCount = (x: Tab) => x === 'waffen' ? meta.inv.length : x === 'kosmetik' ? KOSMETIK_IDS().filter(hasKosmetik).length : gearInv(x).length;
export function entries(x: Tab): Entry[] {
  const k = kindOf(x);
  if (k === 'k') return KOSMETIK_IDS().sort((a, b) => Number(hasKosmetik(b)) - Number(hasKosmetik(a))).map(id => ({ key: `k${id}`, kind: k, item: id, dim: !hasKosmetik(id) }));
  if (k === 'g' && !mageGear()) return [];
  const all = [...(k === 'w' ? meta.inv : gearInv(x as Slot))].sort(SORTS[F(k).sort]?.[1](k) ?? SORTS.rar[1](k));
  const hit = all.filter(i => matches(k, i)), miss = all.filter(i => !matches(k, i));
  return [...hit, ...miss].map(i => ({ key: `${k}${i.id}`, kind: k, item: i, dim: miss.includes(i) }));
}
export const isOn = (e: Entry) => e.kind === 'w' ? equipped() === e.item : e.kind === 'g' ? worn(e.item.slot) === e.item : Object.values(KOSMETIK_SLOTS).some(s => kosmetikIn(s) === e.item);
export const rarColor = (e: Entry) => e.kind === 'w' ? rarityOf(e.item).color : e.kind === 'g' ? rarityOf(e.item).color : 'var(--fg-title)';
export const entryName = (e: Entry) => e.kind === 'k' ? t(KOSMETIK[e.item].name) : nameOf(e.kind, e.item);
export const isNewEntry = (e: Entry) => e.kind === 'w' ? e.item.id > hw.seenW : e.kind === 'g' ? e.item.id > hw.seenG : false;
// ▲/▼ gegenüber dem Ausgerüsteten (Hauptwert, nur bei gleichem Wert-Wort, Regel in compare.ts)
export function deltaOf(e: Entry): number | null {
  if (e.kind === 'g') return gearDelta(e.item);
  if (e.kind !== 'w') return null;
  const eq = equipped();
  return !eq || eq === e.item ? null : mainDelta(mainValue(e.item), mainValue(eq));
}

export function setTab(next: Tab) { hw.tab = next; hw.sel = null; setUi('heroTab', next); render(); }

// Aktionen: Ausrüsten (Klick, Enter, A) und Zerlegen mit Rückfrage (Entf, X). Im Run aus
export function wearEntry(e: Entry) {
  hw.sel = e.key;
  if (viewOnly() || e.dim && e.kind === 'k') { render(); return; }
  if (e.kind === 'w') { if (equipped() !== e.item) equip(e.item.id); }
  else if (e.kind === 'g') { if (mageGear() && worn(e.item.slot) !== e.item) wearGear(e.item.slot, e.item.id); }
  else wearKosmetik(KOSMETIK[e.item].slot, kosmetikIn(KOSMETIK[e.item].slot) === e.item ? null : e.item);   // Kosmetik: an/aus
  changed();
}
export async function salvageEntry(e: Entry) {
  if (viewOnly() || e.kind === 'k') return;
  const name = entryName(e), n = ROLLS.refund[e.item.r];
  const ok = e.kind === 'w' ? await askConfirm(t('shop.salvageTitle'), t('shop.salvageText', { name, n }), t('shop.salvage'))
    : await askConfirm(t('gear.deleteTitle'), t('gear.deleteText', { name, n }), t('shop.salvage'));
  if (!ok) return;
  const list = treeView() ? treeRows() : entries(hw.tab), i = list.findIndex(x => x.key === e.key);
  if (e.kind === 'w') deleteWeapon(e.item.id); else deleteGear(e.item.slot, e.item.id);
  hw.sel = list[i + 1]?.key ?? list[i - 1]?.key ?? null;   // Auswahl rückt weiter (im Baum zur nächsten sichtbaren Zeile)
  changed();
}

// ---------- Raster ----------
const GRID = 25;   // wie ROLLS.invMax / GEAR.invMax; im Dev-Inventar (50) wachsen Reihen dazu
function cellInner(e: Entry) {
  const c = rarColor(e);
  if (e.kind === 'k') return kosmetikThumbHtml(e.item, e.dim ? LOCK : slotSvg('kosmetik', c)) + (e.dim ? `<i class="hwLock">${LOCK}</i>` : '')   // gesperrt: Bild grau mit Schloss
    + (isOn(e) ? `<b class="hwE" title="${t('shop.equipped')}">E</b>` : '');
  const i = e.item, elm = e.kind === 'w' ? elementOf(i) : i.s.element, mk = e.kind === 'w' ? W_ATTR.maker(i) : gearMaker(i);
  return (e.kind === 'w' ? weaponThumbHtml(i, typeSvg(typeOf(i), c)) : gearThumbHtml(i, slotSvg(i.slot, c)))
    + (elm && elm !== 'none' ? `<i class="hwEl" style="--ec:${elementColor(elm)}" title="${ELEMENTS[elm]?.name ?? elm}"></i>` : '')
    + (mk && MAKERS[mk] ? `<i class="hwMk" style="background:${MAT_COLOR[MAKERS[mk].main]}" title="${MAKERS[mk].name}"></i>` : '')
    + (e.kind === 'g' && i.s.setId ? '<b class="hwSetMark">SET</b>' : '')
    + (isOn(e) ? `<b class="hwE" title="${t('shop.equipped')}">E</b>` : '')
    + (isNewEntry(e) ? `<b class="hwNew">${t('shop.new')}</b>` : '');
}
export const LOCK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
export function tipOf(e: Entry): TipData | null {
  if (e.kind === 'g') return gearTip(e.item);
  if (e.kind === 'k') {
    const L = KOSMETIK[e.item];
    return { title: t(L.name), color: 'var(--fg-title)', sub: `${t('hw.cosmetic')} · ${L.slot === 'waffe' ? t('hw.weapon') : slotName(L.slot)}`,
      short: [kosmetikHint(e.item), hasKosmetik(e.item) ? t(isOn(e) ? 'hw.lookOnTip' : 'hw.lookOffTip') : `🔒 ${kosmetikSource(e.item)}`].filter(Boolean).join('<br>') };   // Reaktion, dann Zustand bzw. Quelle (Box, Set, ⭐ Meilenstein mit Fortschritt)
  }
  return null;
}
export function attachEntryTip(node: HTMLElement, e: Entry) {
  if (e.kind === 'w') attachWeaponCard(node, e.item);
  else attachTip(node, () => tipOf(e));
}
function renderGrid(list: Entry[]) {
  const grid = $('hwGrid');
  grid.textContent = '';
  const cols = 10, n = Math.max(hw.tab === 'kosmetik' ? cols : GRID, list.length);
  for (let i = 0; i < n; i++) {
    const e = list[i], cell = el('button', 'hwCell' + (e ? '' : ' empty') + (e?.dim ? e.kind === 'k' ? ' locked' : ' dim' : '') + (e && e.key === hw.sel ? ' sel' : ''));
    cell.type = 'button';
    if (e) {
      cell.dataset.key = e.key;
      cell.style.setProperty('--rc', rarColor(e));
      cell.innerHTML = cellInner(e);
      cell.setAttribute('aria-label', `${entryName(e)}${e.kind !== 'k' ? ` · ${rarityOf(e.item).name}` : ''}`);
      attachEntryTip(cell, e);
      cell.addEventListener('click', () => wearEntry(e));
      cell.addEventListener('contextmenu', ev => { ev.preventDefault(); hw.sel = e.key; render(); });
    } else cell.disabled = true;
    grid.append(cell);
  }
}

// Gewählter Eintrag unten: Name, Hauptwert mit ▲/▼, Ausrüsten und Zerlegen (+Staub). Shift: das Ausgerüstete zum Vergleich
export function renderSel(list: Entry[]) {
  const box = $('hwSel'), e = list.find(x => x.key === hw.sel);
  box.textContent = '';
  if (!e) { box.append(el('span', 'hwMuted', list.length ? t('hw.selHint') : hw.tab === 'waffen' ? t('hw.empty') : t('gear.invEmpty'))); return; }
  const other = e.kind === 'w' ? equipped() : e.kind === 'g' ? worn(e.item.slot) : null;
  const show = hw.shift && other && other !== e.item ? { ...e, item: other } as Entry : e;
  const name = el('b', 'hwSelName', entryName(show));
  name.style.color = rarColor(show);
  const info = el('div', 'hwSelInfo');
  info.append(name);
  const sub = hw.shift && show !== e ? t('hw.compare') : e.kind === 'k' ? t('hw.cosmetic') : (e.kind === 'w' ? effectRows(e.item) : gearRows(e.item)).find(r => r.kind === 'value')?.text ?? '';
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
    for (const f of kept) { const c = el('span', 'hwFind', `${gearName(f.item)}${f.item.s.setId ? ' · SET' : ''} (${slotName(f.item.slot)})`); c.style.color = rarityOf(f.item).color; box.append(c); }
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
export function fitTabs() {
  const tabs = $('hwTabs');
  if (!tabs.offsetParent) return;   // zu oder Baum-Ansicht: der ResizeObserver misst, sobald sichtbar
  tabs.classList.remove('compact');
  const cut = [...tabs.querySelectorAll<HTMLElement>('.hwTab span')].some(s => s.scrollWidth > s.clientWidth + 0.5);
  tabs.classList.toggle('compact', cut);
}

export function renderInv() {
  const k = kindOf(hw.tab);
  // Tabs mit Belegung (x/25, Kosmetik nur Anzahl)
  const tabs = $('hwTabs');
  tabs.textContent = '';
  for (const x of TABS) {
    const b = el('button', 'hwTab' + (x === hw.tab ? ' on' : ''));
    b.innerHTML = tabSvg(x);
    b.append(el('span', '', tabName(x)), el('small', '', tabFill(x)));
    b.title = tabLabel(x);
    b.setAttribute('aria-label', tabLabel(x));
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(x === hw.tab));
    b.addEventListener('click', () => setTab(x));
    tabs.append(b);
  }
  fitTabs();
  if (hw.barKind !== k) buildBar(k);
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
  const list = entries(hw.tab), tree = treeView();
  $('heroModal').classList.toggle('tree', tree);
  for (const b of document.querySelectorAll<HTMLElement>('.hwToggle button')) { b.classList.toggle('on', (b.dataset.v === 'tree') === tree); b.setAttribute('aria-pressed', String((b.dataset.v === 'tree') === tree)); }
  if (tree ? !treeRows().some(r => r.key === hw.sel) : !list.some(e => e.key === hw.sel)) hw.sel = list.find(isOn)?.key ?? list[0]?.key ?? null;
  if (tree && !treeRows().some(r => r.key === hw.sel)) hw.sel = `f:${hw.tab}`;
  $('hwCount').textContent = k === 'k' ? '' : t('hw.count', { a: list.filter(e => !e.dim).length, b: list.length });
  // Probe tragen: gewählte Waffe an der Figur
  const se = list.find(e => e.key === hw.sel);
  heroModel.previewWeapon(se?.kind === 'w' && se.item !== equipped() ? se.item : null);
  if (tree) { $('hwGrid').textContent = ''; renderTree(); }
  else if (k === 'g' && !mageGear()) { $('hwTree').textContent = ''; $('hwGrid').textContent = ''; $('hwGrid').append(el('p', 'hwMuted', t('gear.mageOnly'))); }
  else { $('hwTree').textContent = ''; renderGrid(list); }
  renderSel(list);
  renderFinds();
  $('hwDust').innerHTML = t('gear.info', { dust: fmtInt(meta.dust) });
  ($('hwChest') as HTMLButtonElement).disabled = viewOnly();
  // Verschmelzen gibt es im Code nicht: Knopf nur als Anzeige, deaktiviert
  const pool = k === 'w' ? meta.inv.filter(w => w !== equipped()) : k === 'g' ? gearInv(hw.tab as Slot).filter(g => g !== worn(hw.tab as Slot)) : [];
  const counts = CARD_RARITIES.map((_, r) => pool.filter(x => x.r === r).length);
  $('hwFuse').textContent = t('hw.fuse', { r: CARD_RARITIES[Math.max(0, counts.findIndex(n => n >= 3))].name });
  $('hwHint').textContent = viewOnly() ? t('hw.hintRun') : t('hw.hintKeys');
  $('hwHint').title = t('hw.hint');
}
