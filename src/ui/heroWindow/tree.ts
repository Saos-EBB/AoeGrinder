// Baum-Ansicht des Charakterfensters (E10, aus heroWindow.ts): Tabs als Ordner, darin nach Schule bzw. Slot.
import { $ } from '../../util';
import { ROLLS, typeOf, elementOf } from '../../weaponRolls';
import { KOSMETIK_SLOTS, KOSMETIK, GEAR, type Slot } from '../../gear/data';
import { slotName } from '../../gear/text';
import { ELEMENTS, elementColor } from '../../models/weapons/baukasten';
import { fmtDelta } from '../compare';
import { gearThumbHtml, kosmetikThumbHtml } from '../itemThumb';
import { uiSettings, setUi } from '../uiSettings';
import { t } from '../../i18n';
import { el } from '../dom';
import { type Tab, hw, heroOpen } from './state';
import { typeSvg, slotSvg, tabSvg } from './left';
import { TABS, type Entry, tabCount, entries, isOn, rarColor, entryName, isNewEntry, deltaOf, wearEntry, LOCK, attachEntryTip } from './inventory';
import { render } from './index';

// ---------- Baum: statt des Rasters, die Tabs werden Ordner (auf/zu und Ansicht in frostgrind.ui.v1) ----------
export const treeView = () => uiSettings.heroView === 'tree';
// Ordner: oben was es ist (Tab), darin nach Schule = Element (Kosmetik: nach Slot). Offen-Schlüssel in heroOpen: „waffen“ bzw. „waffen/frost“
export const isOpenF = (f: string) => (uiSettings.heroOpen ?? []).includes(f);
export function setFolder(f: string, open: boolean) {
  const cur = uiSettings.heroOpen ?? [];
  setUi('heroOpen', open ? [...new Set([...cur, f])] : cur.filter(x => x !== f));
}
export const tabName = (x: Tab) => x === 'waffen' ? t('hw.title') : x === 'kosmetik' ? t('hw.cosmetic') : slotName(x);
export const tabFill = (x: Tab) => x === 'kosmetik' ? `${tabCount(x)}` : `${tabCount(x)}/${x === 'waffen' ? ROLLS.invMax : GEAR.invMax}`;
export const tabLabel = (x: Tab) => `${tabName(x)} ${tabFill(x)}`;
const subOf = (e: Entry): string => {
  if (e.kind === 'k') return KOSMETIK[e.item].slot;
  const elm = e.kind === 'w' ? elementOf(e.item) : e.item.s.element;
  return elm in ELEMENTS ? elm : 'none';
};
const SUBS = (x: Tab): string[] => x === 'kosmetik' ? [...KOSMETIK_SLOTS] : [...Object.keys(ELEMENTS).filter(k => k !== 'none'), 'none'];   // „Ohne Element“ zuletzt
const subName = (x: Tab, sub: string) => x === 'kosmetik' ? (sub === 'waffe' ? t('hw.weapon') : slotName(sub as Slot)) : sub === 'none' ? t('hw.noElement') : ELEMENTS[sub]?.name ?? sub;
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
export function renderTree() {
  const box = $('hwTree');
  box.textContent = '';
  for (const r of treeRows()) {
    const row = el('button', 'hwTRow' + (r.key === hw.sel ? ' sel' : '') + (r.depth ? ` d${r.depth}` : ''));
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
      row.addEventListener('click', () => { hw.sel = r.key; hw.tab = r.tab; setUi('heroTab', r.tab); setFolder(r.folder, !open); render(); });
    } else {
      const e = r.entry, c = rarColor(e), d = deltaOf(e);
      if (e.dim) row.classList.add('dim');
      const name = el('span', 'hwTName', entryName(e));
      name.style.color = c;
      const ic = icon(e.kind === 'g' ? gearThumbHtml(e.item, entryIcon(e)) : e.kind === 'k' && !e.dim ? kosmetikThumbHtml(e.item, entryIcon(e)) : entryIcon(e));   // Gear und freie Kosmetik mit Bild, Waffen (hochkant, zu dünn) und Gesperrtes mit Umriss
      if (e.kind === 'g' || e.kind === 'k' && !e.dim) ic.classList.add('hwTThumb');
      row.append(ic, name);
      if (e.kind === 'g' && e.item.s.setId) row.append(el('b', 'hwSetMark', 'SET'));
      if (d !== null) row.append(el('span', d > 0 ? 'hwUp' : 'hwDown', fmtDelta(d, false)));
      if (isOn(e)) row.append(el('b', 'hwE', 'E'));
      if (isNewEntry(e)) row.append(el('b', 'hwNew', t('shop.new')));
      row.setAttribute('role', 'treeitem');
      attachEntryTip(row, e);
      row.addEventListener('click', () => { hw.tab = r.tab; setUi('heroTab', r.tab); wearEntry(e); });
    }
    box.append(row);
  }
}
