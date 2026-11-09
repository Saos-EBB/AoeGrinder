// Waffenmenü (Mockups X1W/X2W/X3W, gen10.py), ersetzt das alte Inventar. Daten direkt aus dem Waffen-Baukasten (models/weapons/baukasten.ts)
// und weaponRolls.ts, nichts doppelt gepflegt. Keine Nebenhand (Kevin): Buch und Relikt liegen in der Waffenhand, Ring und Amulett gesperrt.
// Kopf: Titel, Staub, Belegung. Filterleiste: Typ, Schule (= Kopf-Schule), Element, Hersteller, Werte (= Schaft-Gruppe) als Listen mit Häkchen,
// 6 Seltenheits-Rauten, Sortieren, Suche; aktive Filter als Chips mit ✕ und „x von y“. Nicht passende Waffen werden abgedunkelt, nicht ausgeblendet.
// Links Figur + Slots + Werte, Mitte Raster 5 × 3, rechts Detail der gewählten Waffe mit Vergleich. Filter in frostgrind.ui.v1 (weaponFilter).

import { $ } from '../util';
import { meta } from '../meta';
import { CARD_RARITIES } from '../config';
import { ROLLS, VALUE_KEY, rarityOf, weaponName, equipped, equip, deleteWeapon, effectRows, elementOf, typeOf } from '../weaponRolls';
import { TYPES, HEADS, SHAFTS, ELEMENTS, MAKERS, elementColor } from '../models/weapons/baukasten';
import { mage } from '../models/mage';
import { COLORS } from './colors';
import { askConfirm } from './confirm';
import { currentFigure } from './mainMenu';
import { mountFigPreview } from './figPreview';
import { syncPause } from './menus';
import { uiSettings, setUi } from './uiSettings';
import { t, fmtNum } from '../i18n';
import { fmtInt } from './dmgNumbers';
import './weaponMenu.css';

const GRID = 25;   // 5 × 5 wie ROLLS.invMax; im Dev-Inventar (50) wachsen Reihen dazu
// Material-Farbe des Herstellers für Quadrat und Liste (gen10.py MAKERS), Schlüssel = MAKERS[k].main // PH
const MAT_COLOR = { bronze: '#b07a3a', gold: '#e3c27a', darkwood: '#6b4a2a', crystal: '#9fd8ff', blueiron: '#5a7aa8' };
// Typ-Silhouetten (gen10.py type_svg), viewBox 28 × 70; alte Waffen zeigen den Stab
const TYPE_SVG = {
  staff: '<path d="M14 66V14"/><circle cx="14" cy="9" r="6"/><path d="M8 20h12"/>',
  wand: '<path d="M14 62V30"/><path d="M14 18l3 6 6 1-4.5 4 1 6L14 32l-5.5 3 1-6L5 25l6-1z"/>',
  book: '<rect x="3" y="26" width="22" height="30" rx="2"/><path d="M3 30h22M14 26v30"/><circle cx="14" cy="14" r="5"/>',
  relic: '<circle cx="14" cy="36" r="10"/><circle cx="14" cy="36" r="4"/><path d="M14 22v-8M14 50v8M4 36H0M28 36h-4"/>',
};
const typeSvg = (type: string, color: string) => `<svg aria-hidden="true" viewBox="0 0 28 70" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TYPE_SVG[type] ?? TYPE_SVG.staff}</svg>`;
const LOCK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

// ---------- Eigenschaften einer Waffe (alte Waffen { e, r, m } haben nur Seltenheit und ggf. Element) ----------
const isNew = w => w.v === 2;
const schoolKey = (school: string) => school?.toLowerCase();   // HEADS[h][1] ist der deutsche Schulname, ELEMENTS nutzt dieselben Wörter klein
const attr = {
  type: w => typeOf(w),
  school: w => isNew(w) ? schoolKey(HEADS[w.s.head]?.[1]) ?? null : null,
  el: w => elementOf(w),
  maker: w => isNew(w) ? w.s.maker : null,
  val: w => isNew(w) ? w.s.shaft : null,
};
type Group = keyof typeof attr;
const valueRow = w => effectRows(w).find(r => r.kind === 'value')?.text ?? '';
// „+9 % Schaden“ → Zahl und Rest, für Hauptwert, Sortierung und ▲/▼
const pctOf = (text: string) => { const m = text.match(/^([+−-]?\d+(?:[,.]\d+)?) %\s*(.*)$/); return m ? { v: parseFloat(m[1].replace('−', '-').replace(',', '.')), label: m[2] } : null; };
const mainValue = w => Math.abs(pctOf(valueRow(w))?.v ?? 0);

// ---------- Filter-Optionen aus dem Baukasten ----------
const valName = (k: string) => t(`wval.${VALUE_KEY[k]}`);
// Erst beim ersten Öffnen gebaut: weaponRolls/baukasten sind beim Import dieses Moduls noch nicht fertig (Import-Kreis über mainMenu)
let optCache: Record<Group, { id: string; name: string; color?: string; sub?: string }[]> | null = null;
const OPTIONS = () => optCache ??= ({
  type: [...Object.keys(TYPES).map(k => ({ id: k, name: TYPES[k].name })), { id: 'alt', name: t('inv.oldWeapon') }],
  school: [...new Set(Object.values(HEADS).map(h => schoolKey(h[1])))].map(k => ({ id: k, name: ELEMENTS[k]?.name ?? k, color: ELEMENTS[k] ? elementColor(k) : '' })),
  el: Object.keys(ELEMENTS).map(k => ({ id: k, name: ELEMENTS[k].name, color: k === 'none' ? '#777777' : elementColor(k) })),
  maker: Object.keys(MAKERS).map(k => ({ id: k, name: MAKERS[k].name, color: MAT_COLOR[MAKERS[k].main], sub: t(`wmat.${MAKERS[k].main}`) })),
  val: Object.keys(SHAFTS).map(k => ({ id: k, name: SHAFTS[k].values.map(valName).join(' / ') })),
});
const GROUP_NAME: Record<Group, string> = { type: t('inv.type'), school: t('wm.school'), el: t('inv.element'), maker: t('wm.maker'), val: t('wm.values') };
const SORTS: Record<string, [string, (a, b) => number]> = {
  rar: [t('inv.sort.rar'), (a, b) => b.r - a.r || b.id - a.id],
  neu: [t('inv.sort.neu'), (a, b) => b.id - a.id],
  main: [t('wm.sort.main'), (a, b) => mainValue(b) - mainValue(a) || b.r - a.r],
  maker: [t('wm.maker'), (a, b) => String(attr.maker(a)).localeCompare(String(attr.maker(b))) || b.r - a.r],
};
// Gruppen: null = alle, sonst Liste der gewählten ids ([] = keine). rar: eingeschaltete Seltenheiten
const DEF = { type: null, school: null, el: null, maker: null, val: null, rar: [0, 1, 2, 3, 4, 5], sort: 'rar', q: '' };
const F = () => ({ ...DEF, ...uiSettings.weaponFilter });
const setF = (patch: Record<string, any>) => setUi('weaponFilter', { ...F(), ...patch });
const matches = w => {
  const f = F();
  for (const g of Object.keys(attr) as Group[]) if (f[g] && !f[g].includes(attr[g](w))) return false;
  if (!f.rar.includes(w.r)) return false;
  return !f.q || weaponName(w).toLowerCase().includes(f.q.toLowerCase());
};

// ---------- Markup ----------
const rarDia = CARD_RARITIES.map((r, i) => `<button type="button" class="wmRar" data-r="${i}" style="--rc:${r.color}" aria-label="${t('inv.rarity')} ${r.name}" title="${r.name}"></button>`).join('');
document.body.insertAdjacentHTML('beforeend', `<div id="invModal" class="modal">
  <div id="wmBox">
    <div class="wmHead"><h1 class="fg-title l">${t('wm.title')}</h1><span id="wmInfo"></span><button type="button" class="fg-btn alt" id="wmClose">${t('ui.close')}</button></div>
    <div class="wmBar">
      ${(Object.keys(attr) as Group[]).map(g => `<div class="wmDrop" data-g="${g}"><button type="button" class="wmChip" aria-haspopup="listbox" aria-expanded="false"><small>${GROUP_NAME[g]}</small><b></b></button><div class="wmList fg-panel" role="listbox" hidden></div></div>`).join('')}
      <div class="wmRars"><small>${t('inv.rarity')}</small><span>${rarDia}</span></div>
      <div class="wmDrop" data-g="sort"><button type="button" class="wmChip" aria-haspopup="listbox" aria-expanded="false"><small>${t('inv.sort')}</small><b></b></button><div class="wmList fg-panel" role="listbox" hidden></div></div>
      <label class="wmSearch"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="wmQ" placeholder="${t('wm.search')}" aria-label="${t('wm.search')}"></label>
    </div>
    <div class="wmMain">
      <div class="fg-panel wmFig" data-sektor="SEKTOR 31">
        <div class="wmFigName fg-title"></div>
        <div class="wmSlots">
          <div><div class="wmSlot weapon" id="wmWeapon"></div><span class="wmSlotLabel">${t('wm.hand')}</span></div>
          <div class="wmFigBody" id="wmFigBody"></div>
          <div class="wmLocked">${[t('inv.ring'), t('inv.amulet')].map(n => `<div class="wmSlot locked" title="${t('inv.locked')}">${LOCK}<span>${n}</span></div>`).join('')}</div>
        </div>
        <p class="wmNote">${t('wm.handNote')}</p>
        <div class="wmStats" id="wmStats"></div>
      </div>
      <div class="fg-panel wmChest" data-sektor="SEKTOR 47">
        <div class="wmActive"><span id="wmChips"></span><small id="wmCount"></small></div>
        <div class="wmGrid" id="wmGrid"></div>
        <div class="wmBtns"><button type="button" class="fg-btn alt" id="wmChest">${t('wm.toChest')}</button><button type="button" class="fg-btn alt" id="wmFuse" disabled title="${t('shop.soon')}"></button></div>
        <p class="wmHint">${t('wm.hint1')}<br>${t('wm.hint2')}</p>
      </div>
      <div class="fg-panel wmDetail" id="wmDetail" data-sektor="SEKTOR 66"></div>
    </div>
  </div>
</div>`);

mountFigPreview($('wmFigBody'));   // 3D-Ansicht der Figur, gezeichnet in main.ts

let onClose: (() => void) | null = null, selected: number | null = null, seen = 0, shift = false;
export const weaponMenuOpen = () => $('invModal').classList.contains('show');
export function openWeaponMenu(done?: () => void) {
  onClose = done ?? null;
  seen = uiSettings.weaponSeen;
  selected = equipped()?.id ?? [...meta.inv].sort(SORTS.rar[1])[0]?.id ?? null;   // ohne Waffe in der Hand: die beste zeigen
  $('invModal').classList.add('show');
  ($('wmQ') as HTMLInputElement).value = F().q;
  render();
  syncPause();
}
export function closeWeaponMenu() {
  closeLists();
  $('invModal').classList.remove('show');
  mage.previewWeapon(null);
  setUi('weaponSeen', Math.max(uiSettings.weaponSeen, ...meta.inv.map(w => w.id)));   // ab jetzt nicht mehr NEU
  syncPause();
  const done = onClose;
  onClose = null;
  done?.();
}

// ---------- Filterleiste ----------
function chipValue(g: string) {
  const f = F();
  if (g === 'sort') return SORTS[f.sort]?.[0] ?? SORTS.rar[0];
  const sel = f[g];
  if (!sel) return t('inv.all');
  if (!sel.length) return t('wm.none');
  return sel.length === 1 ? OPTIONS()[g].find(o => o.id === sel[0])?.name ?? sel[0] : t('wm.picked', { n: sel.length });
}
function renderList(drop: HTMLElement) {
  const g = drop.dataset.g, list = drop.querySelector<HTMLElement>('.wmList'), f = F();
  if (g === 'sort') {
    list.innerHTML = Object.entries(SORTS).map(([k, [n]]) => `<button type="button" role="option" class="wmOpt${f.sort === k ? ' on' : ''}" data-v="${k}" aria-selected="${f.sort === k}">${n}</button>`).join('');
    return;
  }
  const sel = f[g];
  list.innerHTML = OPTIONS()[g].map(o => `<label class="wmOpt"><input type="checkbox" data-v="${o.id}"${!sel || sel.includes(o.id) ? ' checked' : ''}>`
    + `${o.color ? `<i style="background:${o.color}"></i>` : ''}<span>${o.name}</span>${o.sub ? `<small>${o.sub}</small>` : ''}</label>`).join('')
    + `<div class="wmAllNone"><button type="button" data-all="1">${t('inv.all')}</button><button type="button" data-all="0">${t('wm.none')}</button></div>`;
}
function closeLists(except?: HTMLElement) {
  for (const d of document.querySelectorAll<HTMLElement>('#invModal .wmDrop')) if (d !== except) {
    d.querySelector<HTMLElement>('.wmList').hidden = true;
    d.querySelector('.wmChip').setAttribute('aria-expanded', 'false');
  }
}
for (const drop of document.querySelectorAll<HTMLElement>('#invModal .wmDrop')) {
  const g = drop.dataset.g, list = drop.querySelector<HTMLElement>('.wmList'), btn = drop.querySelector('.wmChip');
  btn.addEventListener('click', () => {
    closeLists(drop);
    list.hidden = !list.hidden;
    btn.setAttribute('aria-expanded', String(!list.hidden));
    if (!list.hidden) renderList(drop);
  });
  list.addEventListener('change', () => {
    const on = [...list.querySelectorAll<HTMLInputElement>('input:checked')].map(i => i.dataset.v);
    setF({ [g]: on.length === OPTIONS()[g].length ? null : on });
    render();
  });
  list.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (g === 'sort') { setF({ sort: b.dataset.v }); closeLists(); }
    else setF({ [g]: b.dataset.all === '1' ? null : [] });
    renderList(drop);
    render();
  });
}
$('invModal').addEventListener('pointerdown', e => { if (!(e.target as HTMLElement).closest('.wmDrop')) closeLists(); });
for (const b of document.querySelectorAll<HTMLElement>('#invModal .wmRar')) b.addEventListener('click', () => {
  const r = +b.dataset.r, rar = F().rar;
  setF({ rar: rar.includes(r) ? rar.filter(x => x !== r) : [...rar, r].sort() });
  render();
});
$('wmQ').addEventListener('input', () => { setF({ q: ($('wmQ') as HTMLInputElement).value.trim() }); render(); });
$('wmQ').addEventListener('keydown', e => e.stopPropagation());   // Tippen löst keine Spieltasten aus

// Aktive Filter als Chips mit ✕
function activeChips() {
  const f = F(), out: [string, Record<string, any>][] = [];
  for (const g of Object.keys(attr) as Group[]) if (f[g]) out.push([`${GROUP_NAME[g]}: ${f[g].length ? f[g].map(v => OPTIONS()[g].find(o => o.id === v)?.name ?? v).join(', ') : t('wm.none')}`, { [g]: null }]);
  if (f.rar.length < CARD_RARITIES.length) out.push([`${t('inv.rarity')}: ${f.rar.map(i => CARD_RARITIES[i].name).join(', ') || t('wm.none')}`, { rar: DEF.rar }]);
  if (f.q) out.push([`„${f.q}“`, { q: '' }]);
  const box = $('wmChips');
  box.textContent = '';
  for (const [label, reset] of out) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'wmActiveChip', textContent: `${label} ✕` });
    b.addEventListener('click', () => { setF(reset); if ('q' in reset) ($('wmQ') as HTMLInputElement).value = ''; render(); });
    box.append(b);
  }
}

// ---------- Raster, Slots, Detail ----------
function tile(w, eq) {
  const rc = rarityOf(w).color, el = elementOf(w), mk = attr.maker(w);
  return typeSvg(typeOf(w), rc)
    + (el !== 'none' ? `<i class="wmEl" style="--ec:${elementColor(el)}" title="${ELEMENTS[el].name}"></i>` : '')
    + (mk ? `<i class="wmMk" style="background:${MAT_COLOR[MAKERS[mk].main]}" title="${MAKERS[mk].name}"></i>` : '')
    + (w === eq ? `<b class="wmE" title="${t('shop.equipped')}">E</b>` : '')
    + (w.id > seen ? `<b class="wmNew">${t('shop.new')}</b>` : '');
}
function select(id: number | null) { selected = id; render(); }
function equipIt(w) { equip(w.id); mage.refreshWeapon(); render(); }
async function salvage(w) {
  if (!await askConfirm(t('shop.salvageTitle'), t('shop.salvageText', { name: weaponName(w), n: ROLLS.refund[w.r] }), t('shop.salvage'))) return;
  deleteWeapon(w.id);
  mage.refreshWeapon();
  if (selected === w.id) selected = equipped()?.id ?? null;
  render();
}

function renderDetail(eq) {
  const box = $('wmDetail'), w = shift && eq ? eq : meta.inv.find(x => x.id === selected) ?? eq;
  mage.previewWeapon(w && w !== eq ? w : null);   // Figur links trägt die gezeigte Waffe zur Probe
  box.textContent = '';
  if (!w) { box.innerHTML = `<p class="wmEmpty">${t('wm.empty')}</p>`; return; }
  const rar = rarityOf(w), rows = effectRows(w), main = pctOf(valueRow(w)), s = w.s;
  const add = (cls: string, html: string) => box.insertAdjacentHTML('beforeend', `<div class="${cls}">${html}</div>`);
  if (w.id > seen) add('wmTag', t('shop.new'));
  if (shift && eq) add('wmTag', t('wm.compare'));
  box.insertAdjacentHTML('beforeend', `<div class="wmName fg-title" style="color:${rar.color};text-shadow:0 0 14px ${rar.color}88"></div>`);
  box.querySelector('.wmName').textContent = weaponName(w);
  if (isNew(w)) {
    add('wmSub', `${rar.name} · ${TYPES[s.type].name} · ${t('wm.head')} ${t(`whead.${s.head}`)}`);
    add('wmSub', `<i class="wmMk" style="background:${MAT_COLOR[MAKERS[s.maker].main]}"></i>${MAKERS[s.maker].name} (${t(`wmat.${MAKERS[s.maker].main}`)}) · ${t('inv.element')} `
      + (s.element !== 'none' ? `<b style="color:${elementColor(s.element)}">● ${ELEMENTS[s.element].name}</b>` : ELEMENTS.none.name));
  } else add('wmSub', `${rar.name} · ${t('inv.oldWeapon')}`);
  if (main) add('wmMain', `<b>${main.v > 0 ? '+' : '−'}${fmtNum(Math.abs(main.v))} %</b><span>${main.label}</span>`);
  const mine = eq && eq !== w ? pctOf(valueRow(eq)) : null;
  if (main && mine && mine.label === main.label && mine.v !== main.v) {
    const d = Math.round((Math.abs(main.v) - Math.abs(mine.v)) * 10) / 10;
    add('wmCmp', `<span style="color:${d > 0 ? '#6ee7a0' : '#f87171'}">${t(d > 0 ? 'wm.better' : 'wm.worse', { n: fmtNum(Math.abs(d)) })}</span>`);
  }
  const lines = document.createElement('div');
  lines.className = 'wmRows';
  for (const r of rows) if (r.text && r.kind !== 'value') {
    const line = document.createElement('div');
    line.style.color = r.color ?? COLORS.weaponRow[r.kind] ?? '';
    line.textContent = `◆ ${r.label}: ${r.text}`;
    lines.append(line);
  }
  box.append(lines);
  add('wmEq', eq ? `${t('wm.equipped')} ` : t('inv.none'));
  if (eq) box.lastElementChild.append(`${weaponName(eq)}${pctOf(valueRow(eq)) ? ` (${valueRow(eq).split(' ')[0]} %)` : ''}`);
  const btns = document.createElement('div');
  btns.className = 'wmDBtns';
  const eqB = Object.assign(document.createElement('button'), { type: 'button', className: 'fg-btn', textContent: t(w === eq ? 'shop.equipped' : 'shop.equip'), disabled: w === eq });
  eqB.addEventListener('click', () => equipIt(w));
  const dust = Object.assign(document.createElement('button'), { type: 'button', className: 'fg-btn alt', textContent: `+${ROLLS.refund[w.r]}`, title: t('shop.salvage') });
  dust.setAttribute('aria-label', `${t('shop.salvage')} +${ROLLS.refund[w.r]}`);
  dust.addEventListener('click', () => salvage(w));
  btns.append(eqB, dust);
  box.append(btns);
}

function render() {
  const eq = equipped(), f = F();
  $('wmInfo').innerHTML = t('wm.info', { dust: fmtInt(meta.dust), a: meta.inv.length, b: ROLLS.invMax });
  for (const d of document.querySelectorAll<HTMLElement>('#invModal .wmDrop')) {
    d.querySelector('.wmChip b').textContent = `${chipValue(d.dataset.g)} ▾`;
    d.querySelector('.wmChip').classList.toggle('on', d.dataset.g !== 'sort' && f[d.dataset.g] !== null);
  }
  for (const b of document.querySelectorAll<HTMLElement>('#invModal .wmRar')) b.setAttribute('aria-pressed', String(f.rar.includes(+b.dataset.r)));
  activeChips();
  // Links: Figur, Waffenhand, gesperrte Slots, Werte der ausgerüsteten Waffe
  document.querySelector('#invModal .wmFigName').textContent = currentFigure()?.name ?? '';
  const ws = $('wmWeapon');
  ws.innerHTML = eq ? typeSvg(typeOf(eq), rarityOf(eq).color) : '<span>—</span>';
  ws.style.setProperty('--rc', eq ? rarityOf(eq).color : 'var(--fg-line)');
  ws.title = eq ? weaponName(eq) : t('inv.none');
  ws.oncontextmenu = e => { e.preventDefault(); if (eq) { equip(null); mage.refreshWeapon(); render(); } };
  ws.onclick = () => eq && select(eq.id);
  const stats = eq ? effectRows(eq).filter(r => r.text && r.kind !== 'type') : [];
  $('wmStats').innerHTML = '';
  for (const r of stats) {
    const p = pctOf(r.text), row = document.createElement('div');
    row.className = 'wmStat';
    row.append(Object.assign(document.createElement('span'), { textContent: p ? p.label : r.label }), Object.assign(document.createElement('b'), { textContent: p ? `${p.v > 0 ? '+' : '−'}${fmtNum(Math.abs(p.v))} %` : r.text }));
    if (!p) row.classList.add('long');
    $('wmStats').append(row);
  }
  if (!eq) $('wmStats').textContent = t('inv.none');
  // Mitte: passende zuerst, nicht passende abgedunkelt dahinter
  const all = [...meta.inv].sort(SORTS[f.sort]?.[1] ?? SORTS.rar[1]), hit = all.filter(matches), miss = all.filter(w => !matches(w));
  $('wmCount').textContent = t('wm.count', { a: hit.length, b: all.length });
  const grid = $('wmGrid');
  grid.textContent = '';
  const list = [...hit, ...miss];
  for (let i = 0; i < Math.max(GRID, Math.ceil(list.length / 5) * 5); i++) {
    const w = list[i], cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'wmCell' + (w ? '' : ' empty') + (w && miss.includes(w) ? ' dim' : '') + (w && w.id === selected ? ' sel' : '');
    if (w) {
      cell.style.setProperty('--rc', rarityOf(w).color);
      cell.innerHTML = tile(w, eq);
      cell.setAttribute('aria-label', `${weaponName(w)} · ${rarityOf(w).name}`);
      cell.addEventListener('click', () => select(w.id));
      cell.addEventListener('dblclick', () => equipIt(w));
      cell.addEventListener('contextmenu', e => { e.preventDefault(); selected = w.id; equipIt(w); });
    } else cell.disabled = true;
    grid.append(cell);
  }
  // Verschmelzen gibt es im Code nicht: Knopf nur als Anzeige, deaktiviert
  const counts = CARD_RARITIES.map((_, r) => meta.inv.filter(w => w.r === r && w !== eq).length);
  const fuseR = Math.max(0, counts.findIndex(n => n >= 3));
  $('wmFuse').textContent = t('wm.fuse', { r: CARD_RARITIES[fuseR].name });
  renderDetail(eq);
}

$('wmClose').addEventListener('click', closeWeaponMenu);
$('wmChest').addEventListener('click', () => {
  const fromShop = $('shopModal').classList.contains('show');
  closeWeaponMenu();
  if (!fromShop && $('startModal').classList.contains('show')) $('menuShop').click();
});
// Esc schließt, Entf zerlegt die gewählte Waffe, Shift zeigt solange die ausgerüstete zum Vergleich
addEventListener('keydown', e => {
  if (!weaponMenuOpen() || document.getElementById('askTitle')?.closest('.modal')?.classList.contains('show')) return;
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (document.querySelector('#invModal .wmList:not([hidden])')) closeLists(); else closeWeaponMenu(); }
  if (e.code === 'Delete') { const w = meta.inv.find(x => x.id === selected); if (w) { e.preventDefault(); salvage(w); } }
  if (e.key === 'Shift' && !shift) { shift = true; render(); }
}, true);
addEventListener('keyup', e => { if (e.key === 'Shift' && shift) { shift = false; if (weaponMenuOpen()) render(); } });
