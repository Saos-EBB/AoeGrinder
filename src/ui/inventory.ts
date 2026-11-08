// Inventar (Mockup InvDiablo.dc.html, Look Glut): links Figur mit Slots (Waffe aktiv, Ring/Amulett/Relikt gesperrt), Werte darunter;
// Mitte Truhe 5×3 mit Seltenheitsrahmen, darüber Filter (Seltenheit, Element, Typ) und Sortierung; Punkt rechts oben = Element. Hover = Waffen-Karte mit Vergleich. Rechtsklick = ausrüsten, Linksklick = zerlegen mit Rückfrage.

import { $ } from '../util';
import { meta } from '../meta';
import { ROLLS, sortedInv, rarityOf, weaponName, equipped, equip, deleteWeapon, effectRows, elementOf, typeOf } from '../weaponRolls';
import { CARD_RARITIES } from '../config';
import { ELEMENTS, TYPES, elementColor } from '../models/weapons/baukasten';
import { mage } from '../models/mage';
import { attachWeaponCard } from './weaponCard';
import { weaponThumb } from './weaponThumb';
import { hideTip } from './tooltip';
import { askConfirm } from './confirm';
import { currentFigure } from './mainMenu';
import { syncPause } from './menus';
import { t } from '../i18n';

const STAFF = '<svg viewBox="0 0 12 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 46V10"/><circle cx="6" cy="6" r="4"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const FIGURE = '<svg viewBox="0 0 60 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="14" r="10"/><path d="M30 24v34M30 34l-16 12M30 34l16 10M30 58l-10 30M30 58l10 30"/></svg>';
const GRID = 15;   // 5×3 wie ROLLS.invMax; im Dev-Inventar wachsen weitere Reihen dazu

// Filter und Sortierung, pro Browser gemerkt. -1 / 'all' = alle
const FILTER_KEY = 'frostgrind.invFilter.v1';
const filter = (() => { const d = { r: -1, el: 'all', type: 'all', sort: 'rar' }; try { return { ...d, ...JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}') }; } catch { return d; } })();
const saveFilter = () => { try { localStorage.setItem(FILTER_KEY, JSON.stringify(filter)); } catch { /* privat: nur ohne Merken */ } };
const EL_IDS = Object.keys(ELEMENTS), TYPE_IDS = [...Object.keys(TYPES), 'alt'];
const typeName = x => TYPES[x]?.name ?? t('inv.oldWeapon');
const SORTS: Record<string, [string, (a, b) => number]> = {
  rar: [t('inv.sort.rar'), (a, b) => b.r - a.r || b.id - a.id],
  neu: [t('inv.sort.neu'), (a, b) => b.id - a.id],
  el: [t('inv.sort.el'), (a, b) => EL_IDS.indexOf(elementOf(a)) - EL_IDS.indexOf(elementOf(b)) || b.r - a.r || b.id - a.id],
  typ: [t('inv.sort.typ'), (a, b) => TYPE_IDS.indexOf(typeOf(a)) - TYPE_IDS.indexOf(typeOf(b)) || b.r - a.r || b.id - a.id],
};
const shownInv = () => sortedInv().filter(w => (filter.r < 0 || w.r === filter.r) && (filter.el === 'all' || elementOf(w) === filter.el) && (filter.type === 'all' || typeOf(w) === filter.type)).sort(SORTS[filter.sort]?.[1] ?? SORTS.rar[1]);
const chip = (group: string, value: string | number, label: string, color = '', title = label) => `<button class="invChip" data-g="${group}" data-v="${value}" title="${title}"${color ? ` style="--ec:${color}"` : ''}>${label}</button>`;
const FILTER_HTML = `<div class="invFilter">
  <div class="invFRow"><span>${t('inv.rarity')}</span>${chip('r', -1, t('inv.all'))}${CARD_RARITIES.map((r, i) => chip('r', i, '', r.color, r.name)).join('')}</div>
  <div class="invFRow"><span>${t('inv.element')}</span>${chip('el', 'all', t('inv.all'))}${EL_IDS.map(e => chip('el', e, ELEMENTS[e].name, e === 'none' ? '' : elementColor(e))).join('')}</div>
  <div class="invFRow"><span>${t('inv.type')}</span>${chip('type', 'all', t('inv.all'))}${TYPE_IDS.map(x => chip('type', x, typeName(x))).join('')}</div>
  <div class="invFRow"><span>${t('inv.sort')}</span>${Object.entries(SORTS).map(([k, [n]]) => chip('sort', k, n)).join('')}<button class="invChip invReset" id="invReset">${t('inv.resetFilter')}</button></div>
</div>`;

document.body.insertAdjacentHTML('beforeend', `<div id="invModal" class="modal">
  <div class="frame panel" id="invBox">
    <div class="invHead"><h1 class="title">${t('inv.title')}</h1><span id="invInfo"></span></div>
    <div class="invMain">
      <div class="gPanel invFig">
        <div class="invFigName"></div>
        <div class="invFigBody">${FIGURE}</div>
        <div class="invSlot weapon" id="invWeapon"></div><span class="invSlotLabel">${t('inv.weapon')}</span>
        <div class="invLocked">${[t('inv.ring'), t('inv.amulet'), t('inv.relic')].map(n => `<div class="invSlot locked" title="${t('inv.locked')}">${LOCK}<span>${n}</span></div>`).join('')}</div>
        <div class="invStats" id="invStats"></div>
      </div>
      <div class="gPanel invChest">
        ${FILTER_HTML}
        <div class="invGrid5" id="invGrid"></div>
        <p class="invHint">${t('inv.hint')}</p>
      </div>
    </div>
    <button class="smallBtn" id="invClose">${t('ui.close')}</button>
  </div>
</div>`);

let onClose: (() => void) | null = null;
export const invOpen = () => $('invModal').classList.contains('show');
export function openInventory(done?: () => void) {
  onClose = done ?? null;
  $('invModal').classList.add('show');
  render();
  syncPause();
}
export function closeInventory() {
  hideTip();
  $('invModal').classList.remove('show');
  syncPause();
  const done = onClose;
  onClose = null;
  done?.();
}

// Bild aus dem echten Modell (weaponThumb), sonst das Strich-Symbol
function slotHtml(w) {
  const img = weaponThumb(w), el = elementOf(w);
  const dot = el === 'none' ? '' : `<i class="invEl" style="--ec:${elementColor(el)}" title="${ELEMENTS[el].name}"></i>`;
  return (img ? `<img class="invImg" src="${img}" alt="">` : `<span class="invItem" style="--rc:${rarityOf(w).color}">${STAFF}</span>`) + dot;
}
function render() {
  const eq = equipped();
  $('invInfo').innerHTML = t('inv.info', { a: meta.inv.length, b: ROLLS.invMax, dust: meta.dust });
  document.querySelector('#invModal .invFigName').textContent = currentFigure()?.name ?? '';
  const ws = $('invWeapon').cloneNode(false) as HTMLElement;   // frisches Element: keine doppelten Hover-Listener
  $('invWeapon').replaceWith(ws);
  ws.innerHTML = eq ? slotHtml(eq) : '';
  ws.style.setProperty('--rc', eq ? rarityOf(eq).color : 'var(--glut-line)');
  ws.oncontextmenu = e => { e.preventDefault(); if (eq) { equip(null); mage.refreshWeapon(); render(); } };
  if (eq) attachWeaponCard(ws, eq);
  const stats = eq ? effectRows(eq).filter(r => r.text && r.kind !== 'type') : [];
  $('invStats').innerHTML = eq
    ? `<div class="invWName" style="color:${rarityOf(eq).color}"></div>${stats.map(() => '<div class="invStat"></div>').join('')}`
    : `<div class="invStat">${t('inv.none')}</div>`;
  if (eq) {
    $('invStats').querySelector('.invWName').textContent = weaponName(eq);
    $('invStats').querySelectorAll<HTMLElement>('.invStat').forEach((el, i) => { el.textContent = stats[i].text; if (stats[i].kind === 'element') el.style.color = stats[i].color; });
  }
  document.querySelectorAll<HTMLElement>('#invModal .invChip[data-g]').forEach(b => b.classList.toggle('on', String(filter[b.dataset.g]) === b.dataset.v));
  const grid = $('invGrid');
  grid.textContent = '';
  const list = shownInv();
  if (list.length !== meta.inv.length) $('invInfo').innerHTML += t('inv.shows', { n: list.length });
  for (let i = 0; i < Math.max(GRID, Math.ceil(list.length / 5) * 5); i++) {
    const w = list[i], cell = document.createElement('div');
    cell.className = 'invCell' + (w && w === eq ? ' equipped' : '');
    if (w) {
      cell.innerHTML = slotHtml(w);
      cell.style.setProperty('--rc', rarityOf(w).color);
      attachWeaponCard(cell, w);
      cell.addEventListener('contextmenu', e => { e.preventDefault(); hideTip(); equip(w.id); mage.refreshWeapon(); render(); });
      cell.addEventListener('click', async () => {
        hideTip();
        if (!await askConfirm(t('shop.salvageTitle'), t('shop.salvageText', { name: weaponName(w), n: ROLLS.refund[w.r] }), t('shop.salvage'))) return;
        deleteWeapon(w.id);
        mage.refreshWeapon();
        render();
      });
    }
    grid.appendChild(cell);
  }
}

$('invClose').addEventListener('click', closeInventory);
document.querySelectorAll<HTMLElement>('#invModal .invChip[data-g]').forEach(b => b.addEventListener('click', () => {
  const g = b.dataset.g;
  filter[g] = g === 'r' ? +b.dataset.v : b.dataset.v;
  saveFilter(); render();
}));
$('invReset').addEventListener('click', () => { Object.assign(filter, { r: -1, el: 'all', type: 'all' }); saveFilter(); render(); });
addEventListener('keydown', e => {
  if (!invOpen() || e.code !== 'Escape' || document.getElementById('askTitle')?.closest('.modal')?.classList.contains('show')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  closeInventory();
}, true);
