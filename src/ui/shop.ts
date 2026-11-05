// Ergebnis → Shop → Hauptmenü. Ohne Abschluss kein Shop, der Staub aus dem Run bleibt trotzdem.

import { player } from '../state';
import { $ } from '../util';
import { CARD_RARITIES } from '../config';
import { meta, awardDust, rollShop, keepOffer, menuOffer, menuTier, buy, priceOf, devSetDust, devUnlockAll, devReset } from '../meta';
import { completeRun } from '../player';
import { toMainMenu, renderMenu } from './mainMenu';
import { syncPause } from './menus';
import { ROLLS, buyChest, deleteWeapon, devFillInventory, devClearInventory, inventoryFull, rollWeapon, weaponName, rarityOf, sortedInv, effectRows, equipped, equip } from '../weaponRolls';
import { mage } from '../models/mage';
import { attachWeaponCard } from './weaponCard';
import { askConfirm } from './confirm';
import { pick } from '../util';

const rarityColor = name => CARD_RARITIES.find(r => r.name === name)?.color ?? '#fff';
let offer = [], tierNow = 0, fromMenu = false;

// Staub vergeben, Shop vorbereiten. Gibt die Staub-Rechnung zurück, das Run-Ende zeigt sie (leaderboardView.ts)
export function afterRun(completed) {
  const award = awardDust(completed), { tier } = award;
  tierNow = tier;
  offer = tier ? rollShop(tier) : [];
  if (tier) keepOffer(offer);
  $('deathShopBtn').hidden = !tier;
  return award;
}

// Shop (Mockup S2, Look Glut): links Kiste, Mitte Ergebnis des letzten Zugs, rechts Verschmelzen, darunter Freischaltungen und Inventar.
// Kiste: kurzes Würfeln, dann liegt die Waffe im Inventar. Animation: Namen wechseln schnell und werden langsamer. // PH: Zeiten
// Pity-Zähler, „×5 öffnen“ und Verschmelzen gibt es im Code nicht: kein Pity-Balken, kein ×5, Verschmelzen nur als Oberfläche („kommt bald“).
const SPIN = { steps: 16, startMs: 40, growMs: 12 };
let spinning = false, lastPull = null, lastIsNew = false;   // lastPull: Ergebnis-Karte bleibt bis zum nächsten Zug stehen
const el = (tag: string, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
const CHEST_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M3 10h18v10H3zM3 10l2-5h14l2 5M10 13h4v3h-4z"/></svg>';
const STAFF_SVG = '<svg viewBox="0 0 12 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 46V10"/><circle cx="6" cy="6" r="4"/></svg>';
const pctOf = (t: string) => { const m = t?.match(/^([+−-]?\d+(?:,\d+)?) %\s*(.*)$/); return m ? { v: parseFloat(m[1].replace('−', '-').replace(',', '.')), label: m[2] } : null; };

function chestCol(resultName: HTMLElement, result: HTMLElement) {
  const col = el('div', 'gPanel shopCol');
  const icon = el('div', 'shopIcon'); icon.innerHTML = CHEST_SVG;
  const price = el('div', 'shopPrice', `Ein Zug: ${ROLLS.price} Staub`);
  const b = el('button', 'btn shopOpen', inventoryFull() ? 'Inventar voll' : 'Öffnen') as HTMLButtonElement;
  b.disabled = spinning || inventoryFull() || meta.dust < ROLLS.price;
  b.dataset.nav = 'chest';
  b.addEventListener('click', () => {
    const w = buyChest();
    if (!w) return;
    spinning = true;
    b.disabled = true;
    result.classList.add('spinning');
    let i = 0;
    const step = () => {
      const show = i < SPIN.steps ? { ...rollWeapon(), r: pick([0, 1, 2, 3, 4, 5]) } : w;
      resultName.textContent = weaponName(show);
      result.style.setProperty('--rc', rarityOf(show).color);
      if (i++ < SPIN.steps) { setTimeout(step, SPIN.startMs + SPIN.growMs * i); return; }
      spinning = false;
      lastPull = w;
      lastIsNew = true;
      setTimeout(renderShop, 900);
    };
    step();
  });
  const hint = el('div', 'shopHint', inventoryFull() ? 'Erst eine Waffe zerlegen.' : meta.dust < ROLLS.price ? 'Zu wenig Knochenstaub.' : '');
  col.append(icon, price, b, hint);
  return col;
}

function resultCol() {
  const col = el('div', 'shopResult');
  const name = el('div', 'resName');
  if (!lastPull) {
    col.classList.add('empty');
    name.textContent = 'Noch kein Zug';
    col.append(el('div', 'resIcon'), name, el('div', 'resSub', 'Öffne die Kiste links.'));
    return { col, name };
  }
  const w = lastPull, rar = rarityOf(w), rows = effectRows(w);
  col.style.setProperty('--rc', rar.color);
  if (lastIsNew) col.append(el('span', 'resNew', 'Neu'));
  const icon = el('div', 'resIcon'); icon.innerHTML = STAFF_SVG;
  name.textContent = weaponName(w);
  const type = rows.find(r => r.kind === 'type')?.text?.split(':')[0];
  col.append(icon, name, el('div', 'resSub', `${rar.name}${type ? ` · ${type}` : ''}`));
  const lines = el('div', 'resLines');
  for (const r of rows) if (r.text && r.kind !== 'type') lines.append(el('div', r.kind === 'unique' ? 'tLegend' : r.kind === 'value' ? '' : 'tAffix', r.text));
  col.append(lines, el('i', 'tSep'));
  const eq = equipped(), mine = pctOf(rows.find(r => r.kind === 'value')?.text ?? ''), other = eq && eq !== w ? pctOf(effectRows(eq).find(r => r.kind === 'value')?.text ?? '') : null;
  const cmp = el('div', 'resCmp');
  if (eq === w) cmp.textContent = 'Ausgerüstet';
  else if (eq) {
    cmp.textContent = `Aktuell: ${weaponName(eq)}`;
    if (mine && other && mine.label === other.label && mine.v !== other.v) {
      const d = Math.round((mine.v - other.v) * 10) / 10;
      cmp.append(' · ', Object.assign(el('b', '', `${d > 0 ? '▲ +' : '▼ −'}${String(Math.abs(d)).replace('.', ',')} %`), { style: `color:${d > 0 ? '#6ee7a0' : '#f87171'}` }));
    }
  } else cmp.textContent = 'Aktuell: keine Waffe';
  const btns = el('div', 'resBtns');
  const equipB = el('button', 'btn', eq === w ? 'Ausgerüstet' : 'Ausrüsten') as HTMLButtonElement;
  equipB.disabled = eq === w;
  equipB.addEventListener('click', () => { equip(w.id); mage.refreshWeapon(); lastIsNew = false; renderShop(); });
  const dust = el('button', 'smallBtn', `+${ROLLS.refund[w.r]} Staub`) as HTMLButtonElement;
  dust.title = 'Zerlegen';
  dust.addEventListener('click', async () => {
    if (spinning || !await askConfirm('Waffe zerlegen?', `${weaponName(w)} zerlegen? Du bekommst ${ROLLS.refund[w.r]} Staub zurück.`, 'Zerlegen')) return;
    deleteWeapon(w.id); mage.refreshWeapon(); lastPull = null; renderShop();
  });
  btns.append(equipB, dust);
  col.append(cmp, btns);
  attachWeaponCard(icon, w);
  return { col, name };
}

function fuseCol() {
  const col = el('div', 'gPanel shopCol shopFuse');
  col.append(el('div', 'title fuseTitle', 'Verschmelzen'), el('p', 'shopHint', '3 Waffen gleicher Seltenheit → 1 Zug eine Stufe höher. Ausgerüstete sind gesperrt.'));
  const slots = el('div', 'fuseSlots');
  for (let i = 0; i < 3; i++) slots.append(el('div', 'fuseSlot'));
  const b = el('button', 'smallBtn', 'Kommt bald') as HTMLButtonElement;
  b.disabled = true;
  col.append(slots, el('div', 'fuseArrow', '▼'), el('div', 'fuseSlot result', '?'), b);
  return col;
}

// Inventar: Zerlegen gibt Staub zurück. Nach Seltenheit gruppiert, Details zeigt die Hover-Karte
function inventoryBox() {
  const box = document.createElement('div');
  box.append(el('h3', '', `Inventar ${meta.inv.length}/${ROLLS.invMax}`));
  let grid = null, group = null;
  for (const w of sortedInv()) {
    if (rarityOf(w) !== group) {
      group = rarityOf(w);
      const g = el('div', 'invGroup', `${group.name} · ${meta.inv.filter(x => x.r === w.r).length}`);
      g.style.color = group.color;
      grid = el('div', 'invGrid');
      box.append(g, grid);
    }
    const row = el('button', 'shopItem');
    row.style.borderColor = rarityOf(w).color;
    const n = el('span', '', weaponName(w)), t = el('span', '', `✕ +${ROLLS.refund[w.r]}`);
    n.style.color = rarityOf(w).color;
    t.title = 'Zerlegen';
    attachWeaponCard(row, w);
    row.append(n, t);
    row.dataset.nav = `inv-${w.id}`;
    row.addEventListener('click', async () => {
      if (spinning || !await askConfirm('Waffe löschen?', `${weaponName(w)} löschen? Du bekommst ${ROLLS.refund[w.r]} Staub zurück.`, 'Löschen')) return;
      deleteWeapon(w.id);
      mage.refreshWeapon();
      renderShop();
    });
    grid.appendChild(row);
  }
  return box;
}

function renderShop() {
  $('shopInfo').innerHTML = `<b>${meta.dust}</b> Knochenstaub · Inventar ${meta.inv.length} / ${ROLLS.invMax}${tierNow ? ` · Shop-Stufe ${tierNow}` : ''}`;
  const cols = $('shopCols');
  cols.textContent = '';
  const res = resultCol();
  cols.append(chestCol(res.name, res.col), res.col, fuseCol());
  const box = $('shopList');
  box.textContent = '';
  box.append(el('h3', '', 'Freischaltungen'));
  if (!offer.length) box.insertAdjacentText('beforeend', 'Alles für diese Stufe ist schon freigeschaltet.');
  for (const type of [...new Set(offer.map(e => e.type))]) {
    box.appendChild(el('h4', '', type));
    for (const e of offer.filter(x => x.type === type)) {
      const owned = meta.unlocked.includes(e.key), price = priceOf(e);
      const b = el('button', 'shopItem' + (owned ? ' bought' : '')) as HTMLButtonElement;
      b.style.borderColor = rarityColor(e.rarity);
      b.append(el('span', '', e.name), el('span', '', owned ? 'gekauft' : `${price} Staub`));
      b.disabled = owned || meta.dust < price;
      b.dataset.nav = e.key;
      b.addEventListener('click', () => { buy(e); renderShop(); });
      box.appendChild(b);
    }
  }
  box.append(inventoryBox());
}

$('deathShopBtn').addEventListener('click', () => {
  $('deathModal').classList.remove('show');
  $('shopModal').classList.add('show');
  renderShop();
  syncPause();
});
// Aus dem Hauptmenü: letztes Angebot, zurück ins Menü ohne neuen Aufbau
function openMenuShop() {
  fromMenu = true;
  tierNow = menuTier();
  offer = menuOffer();
  $('shopClose').textContent = 'Zurück';
  $('shopModal').classList.add('show');
  renderShop();
}
$('menuShop').addEventListener('click', openMenuShop);
$('shopClose').addEventListener('click', () => {
  $('shopModal').classList.remove('show');
  if (fromMenu) {
    fromMenu = false;
    $('shopClose').textContent = 'Weiter zum Hauptmenü';
    renderMenu();
    return;
  }
  $('deathShopBtn').hidden = true;
  toMainMenu();
});

// Dev
const refresh = () => { renderMenu(); };
$('devDust').addEventListener('click', () => { devSetDust(meta.dust + 500); refresh(); });
$('devUnlock').addEventListener('click', () => { devUnlockAll(); refresh(); });
$('devMetaReset').addEventListener('click', () => { devReset(); refresh(); });
const refreshInv = () => { refresh(); if ($('shopModal').classList.contains('show')) renderShop(); };
$('devInvFill').addEventListener('click', () => {
  const v = ($('devInvTier') as HTMLSelectElement).value;
  devFillInventory(v === '' ? null : Number(v));
  refreshInv();
});
$('devInvClear').addEventListener('click', () => { devClearInventory(); refreshInv(); });
$('devComplete').addEventListener('click', () => { $('settingsClose').click(); $('pauseModal').classList.remove('show'); if (!player.dead) completeRun('Dev'); });
