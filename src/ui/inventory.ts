// Inventar (Mockup InvDiablo.dc.html, Look Glut): links Figur mit Slots (Waffe aktiv, Ring/Amulett/Relikt gesperrt), Werte darunter;
// Mitte Truhe 5×3 mit Seltenheitsrahmen. Hover = Waffen-Karte mit Vergleich. Rechtsklick = ausrüsten, Linksklick = zerlegen mit Rückfrage.

import { $ } from '../util';
import { meta } from '../meta';
import { ROLLS, sortedInv, rarityOf, weaponName, equipped, equip, deleteWeapon, effectRows } from '../weaponRolls';
import { mage } from '../models/mage';
import { attachWeaponCard } from './weaponCard';
import { weaponThumb } from './weaponThumb';
import { hideTip } from './tooltip';
import { askConfirm } from './confirm';
import { currentFigure } from './mainMenu';
import { syncPause } from './menus';

const STAFF = '<svg viewBox="0 0 12 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 46V10"/><circle cx="6" cy="6" r="4"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const FIGURE = '<svg viewBox="0 0 60 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="14" r="10"/><path d="M30 24v34M30 34l-16 12M30 34l16 10M30 58l-10 30M30 58l10 30"/></svg>';
const GRID = 15;   // 5×3 wie ROLLS.invMax; im Dev-Inventar wachsen weitere Reihen dazu

document.body.insertAdjacentHTML('beforeend', `<div id="invModal" class="modal">
  <div class="frame panel" id="invBox">
    <div class="invHead"><h1 class="title">Inventar</h1><span id="invInfo"></span></div>
    <div class="invMain">
      <div class="gPanel invFig">
        <div class="invFigName"></div>
        <div class="invFigBody">${FIGURE}</div>
        <div class="invSlot weapon" id="invWeapon"></div><span class="invSlotLabel">Waffe</span>
        <div class="invLocked">${['Ring', 'Amulett', 'Relikt'].map(n => `<div class="invSlot locked" title="Gesperrt">${LOCK}<span>${n}</span></div>`).join('')}</div>
        <div class="invStats" id="invStats"></div>
      </div>
      <div class="gPanel invChest">
        <div class="invGrid5" id="invGrid"></div>
        <p class="invHint">Rechtsklick = ausrüsten · Klick = zerlegen (mit Rückfrage) · Rechtsklick auf die Waffe links = ablegen</p>
      </div>
    </div>
    <button class="smallBtn" id="invClose">Schließen</button>
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
  const img = weaponThumb(w);
  return img ? `<img class="invImg" src="${img}" alt="">` : `<span class="invItem" style="--rc:${rarityOf(w).color}">${STAFF}</span>`;
}
function render() {
  const eq = equipped();
  $('invInfo').innerHTML = `Truhe ${meta.inv.length} / ${ROLLS.invMax} · <b>${meta.dust} Staub</b>`;
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
    : '<div class="invStat">Keine Waffe ausgerüstet (Pilgerast ohne Effekt)</div>';
  if (eq) {
    $('invStats').querySelector('.invWName').textContent = weaponName(eq);
    $('invStats').querySelectorAll('.invStat').forEach((el, i) => { el.textContent = stats[i].text; });
  }
  const grid = $('invGrid');
  grid.textContent = '';
  const list = sortedInv();
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
        if (!await askConfirm('Waffe zerlegen?', `${weaponName(w)} zerlegen? Du bekommst ${ROLLS.refund[w.r]} Staub zurück.`, 'Zerlegen')) return;
        deleteWeapon(w.id);
        mage.refreshWeapon();
        render();
      });
    }
    grid.appendChild(cell);
  }
}

$('invClose').addEventListener('click', closeInventory);
addEventListener('keydown', e => {
  if (!invOpen() || e.code !== 'Escape' || document.getElementById('askTitle')?.closest('.modal')?.classList.contains('show')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  closeInventory();
}, true);
