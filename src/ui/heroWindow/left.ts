// Charakterfenster links (E10, aus heroWindow.ts): Gear-Karten, Bilder, Figur mit Slots und Looks, Set und Erfolge, Werte.
import { $ } from '../../util';
import { player } from '../../state';
import { hasAch } from '../../meta';
import { ACHIEVEMENTS, setAch } from '../../skins';
import { heroModel } from '../../models/heroModel';
import { ROLLS, equipped, equip, rarityOf, typeOf, valueText } from '../../weaponRolls';
import { SLOTS, KOSMETIK, type Slot, type GearItem } from '../../gear/data';
import { SETS } from '../../gear/sets';
import { worn, wearGear, setOfFigure, setCount, hasKosmetik, kosmetikIn, wearKosmetik } from '../../gear/inventory';
import { makerOf, groupOf } from '../../gear/shown';
import { gearName, gearRows, slotName, perfectText, gearMainValue } from '../../gear/text';
import { MAKERS } from '../../models/weapons/baukasten';
import { charCard } from '../mainMenu';
import { attachWeaponCard } from '../weaponCard';
import { mainDelta, fmtDelta, deltaColor, fmtMain } from '../compare';
import { COLORS } from '../colors';
import { weaponThumb } from '../weaponThumb';
import { gearThumbHtml, kosmetikThumbHtml } from '../itemThumb';
import { attachTip, type TipData } from '../tooltip';
import { heroStats, type StatRow } from '../heroStats';
import { figureInfo } from '../charInfo';
import { uiSettings, setUi } from '../uiSettings';
import { t } from '../../i18n';
import { isWarrior } from '../../modifiers';
import { el } from '../dom';
import { hw, inRun, viewOnly, mageGear } from './state';
import { setTab } from './inventory';
import { render } from './index';

// ---------- Gear: Hersteller und Gruppe (gear/shown.ts makerOf/groupOf) ----------
export const gearMaker = (g: GearItem) => makerOf(g);
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
  const rar = rarityOf(g), rows = gearRows(g), main = gearMainValue(g), on = worn(g.slot), d = gearDelta(g);
  const lines = rows.filter(r => r.kind !== 'value').map(r => `<span class="tAffix"${r.color ? ` style="color:${r.color}"` : ''}>◆ ${r.text}</span>`);
  lines.push(`<span class="tAffix">◆ ${t('hw.maker')}: ${makerName(gearMaker(g))} · ${t('hw.group')}: ${groupName(gearGroup(g))}</span>`);
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
export const tabSvg = (x: string, color = 'currentColor') => x === 'waffen' || x === 'waffe' ? typeSvg('staff', color) : slotSvg(x, color);

// ---------- Links: Kopf, Figur mit Slots, Set, Werte ----------
const LEFT: (Slot | 'waffe')[] = ['kopf', 'hals', 'ruecken'], RIGHT: (Slot | 'waffe')[] = ['arme', 'koerper', 'waffe'];
// Nach jeder Änderung: Figur (Set-Skin, Waffen-Look) und Fenster neu
export function changed() { heroModel.refreshSkin(); heroModel.refreshWeapon(); render(); }

// Leeres Waffen-Inventar: die Figur trägt ROLLS.fallback (Pilgerast ohne Effekt). Als alte Waffe (ohne v: 2) baut buildWeaponOf das Modell m
const pilger = () => ({ id: 'pilger', m: ROLLS.fallback, r: 0 });   // erst beim Zeichnen: ROLLS ist beim Laden des Moduls evtl. noch nicht da (Import-Zyklus)
function slotEl(slot: Slot | 'waffe') {
  const wrap = el('div', 'hwSlotWrap'), b = el('button', 'hwSlot'), isW = slot === 'waffe';
  b.type = 'button';
  b.dataset.slot = slot;
  const w = isW && heroModel.weapon ? equipped() : null, g = !isW && mageGear() ? worn(slot as Slot) : null;
  const color = w ? rarityOf(w).color : g ? rarityOf(g).color : '';
  if (color) b.style.setProperty('--rc', color);
  if (w) { const src = weaponThumb(w); b.innerHTML = src ? `<img src="${src}" alt="">` : typeSvg(typeOf(w), color); }
  else if (g) b.innerHTML = gearThumbHtml(g, slotSvg(slot, color));
  else if (isW && isWarrior()) b.innerHTML = '<span class="hwSlotEmpty"></span>';
  else if (isW) { const src = weaponThumb(pilger()); b.innerHTML = `<span class="hwSlotEmpty pilger">${src ? `<img src="${src}" alt="">` : tabSvg(slot)}</span>`; }   // kein Stab: die Figur trägt den Pilgerast, gedimmt
  else b.innerHTML = `<span class="hwSlotEmpty">${tabSvg(slot)}</span>`;   // leer: Umriss gedimmt
  b.append(el('small', '', isW ? t('hw.weapon') : slotName(slot)));
  if (g?.s.setId) b.append(el('b', 'hwSetMark', 'SET'));
  if (w) attachWeaponCard(b, w);
  else if (g) attachTip(b, () => gearTip(g));
  else b.title = isW ? t('menu.noWeapon') : t('gear.empty');
  b.classList.toggle('sel', hw.tab === (isW ? 'waffen' : slot));
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
  const on = kosmetikIn(slot), free = Object.keys(KOSMETIK).filter(id => KOSMETIK[id].slot === slot && hasKosmetik(id));
  const b = el('button', `hwLook${on ? ' on' : ''}`);
  b.type = 'button';
  b.title = on ? `${t(KOSMETIK[on].name)} · ${t('hw.lookClear')}` : free.length ? t('hw.lookSet', { name: t(KOSMETIK[free[0]].name) }) : t('hw.lookNone');
  b.setAttribute('aria-label', `${t('hw.look')} ${slot === 'waffe' ? t('hw.weapon') : slotName(slot)}: ${b.title}`);
  if (on) b.innerHTML = kosmetikThumbHtml(on, slotSvg('kosmetik', 'currentColor'));
  b.disabled = viewOnly() || (!on && !free.length) || !mageGear();
  b.addEventListener('click', () => { wearKosmetik(slot, on ? null : free[0]); changed(); });
  return b;
}

// Set-Fortschritt des gespielten Magiers: „Glutprophet 3/5“, Mechanik, Look; inaktiv ausgegraut. Darunter die Erfolge
function renderSet() {
  const box = $('hwSet'), id = setOfFigure(heroModel.figureId);
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

export function renderLeft() {
  const fig = charCard();
  $('hwName').textContent = fig?.name ?? '';
  $('hwLevel').textContent = inRun() ? t('hw.level', { n: player.level ?? 1 }) : t('hw.level', { n: '—' });
  const L = $('hwSlotsL'), R = $('hwSlotsR');
  L.textContent = R.textContent = '';
  for (const s of LEFT) L.append(slotEl(s));
  for (const s of RIGHT) R.append(slotEl(s));
  renderSet();
  renderStats();
}
