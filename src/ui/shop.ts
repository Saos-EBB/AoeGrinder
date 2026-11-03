// Ergebnis → Shop → Hauptmenü. Ohne Abschluss kein Shop, der Staub aus dem Run bleibt trotzdem.

import { player } from '../state';
import { $ } from '../util';
import { CARD_RARITIES } from '../config';
import { meta, awardDust, rollShop, keepOffer, menuOffer, menuTier, buy, priceOf, devSetDust, devUnlockAll, devReset } from '../meta';
import { completeRun } from '../player';
import { toMainMenu, renderMenu } from './mainMenu';
import { syncPause } from './menus';
import { ROLLS, buyChest, deleteWeapon, devFillInventory, devClearInventory, inventoryFull, rollWeapon, weaponName, rarityOf } from '../weaponRolls';
import { mage } from '../models/mage';
import { attachWeaponCard, weaponStats } from './weaponCard';
import { askConfirm } from './confirm';
import { pick } from '../util';

const rarityColor = name => CARD_RARITIES.find(r => r.name === name)?.color ?? '#fff';
let offer = [], tierNow = 0, fromMenu = false;

export function afterRun(completed) {
  const { dust, tier } = awardDust(completed);
  tierNow = tier;
  offer = tier ? rollShop(tier) : [];
  if (tier) keepOffer(offer);
  $('deathStatsDust')?.remove();
  $('runRank').insertAdjacentHTML('afterend', `<div id="deathStatsDust" style="color:#efe0b8;font-weight:700;margin-top:6px">Knochenstaub +${dust}, jetzt ${meta.dust}${tier ? ` · Shop-Stufe ${tier}` : ''}</div>`);
  $('deathShopBtn').hidden = !tier;
  $('restartBtn').hidden = !!tier;
  $('deathMenuBtn').hidden = !!tier;
}

// Magische Kiste: kurzes Würfeln, dann liegt die Waffe im Inventar. Animation: Namen wechseln schnell und werden langsamer. // PH: Zeiten
const SPIN = { steps: 16, startMs: 40, growMs: 12 };
let spinning = false, lastPull = null;   // lastPull: Ergebnis-Karte bleibt bis zum nächsten Zug stehen
function chestBox() {
  const box = document.createElement('div');
  const h = document.createElement('h3');
  h.textContent = `Magische Kiste · Inventar ${meta.inv.length}/${ROLLS.invMax}`;
  const b = document.createElement('button');
  b.className = 'shopItem';
  b.style.borderColor = '#f2c94c';
  const name = document.createElement('span'), tag = document.createElement('span');
  name.textContent = inventoryFull() ? 'Erst einen Stab löschen' : 'Zufällige Mage-Waffe ziehen';
  tag.textContent = `${ROLLS.price} Staub`;
  b.append(name, tag);
  b.disabled = spinning || inventoryFull() || meta.dust < ROLLS.price;
  b.dataset.nav = 'chest';
  b.addEventListener('click', () => {
    const w = buyChest();
    if (!w) return;
    spinning = true;
    b.disabled = true;
    let i = 0;
    const step = () => {
      const show = i < SPIN.steps ? { ...rollWeapon(), r: pick([0, 1, 2, 3, 4, 5]) } : w;
      name.textContent = weaponName(show);
      b.style.borderColor = name.style.color = rarityOf(show).color;
      if (i++ < SPIN.steps) { setTimeout(step, SPIN.startMs + SPIN.growMs * i); return; }
      spinning = false;
      lastPull = w;
      setTimeout(renderShop, 900);
    };
    step();
  });
  const card = document.createElement('div');   // Ergebnis-Karte des letzten Zugs
  Object.assign(card.style, { fontSize: '12px', textAlign: 'left', border: '1px solid transparent', borderRadius: '4px', padding: '4px 8px', margin: '0 0 6px' });
  if (lastPull) {                                // Ergebnis: Name und alle Schichten der Waffe
    const name = Object.assign(document.createElement('div'), { textContent: weaponName(lastPull) });
    Object.assign(name.style, { color: rarityOf(lastPull).color, fontWeight: '700', marginBottom: '4px' });
    card.append(name, weaponStats(lastPull));
    card.style.borderColor = rarityOf(lastPull).color;
  }
  box.append(h, b, card);
  // Inventar: löschen gibt Staub zurück
  for (const w of meta.inv) {
    const row = document.createElement('button');
    row.className = 'shopItem';
    row.style.borderColor = rarityOf(w).color;
    const n = document.createElement('span'), t = document.createElement('span');
    n.textContent = weaponName(w);
    n.style.color = rarityOf(w).color;
    attachWeaponCard(row, w);
    t.textContent = `Löschen +${ROLLS.refund[w.r]}`;
    row.append(n, t);
    row.dataset.nav = `inv-${w.id}`;
    row.addEventListener('click', async () => {
      if (spinning || !await askConfirm('Waffe löschen?', `${weaponName(w)} löschen? Du bekommst ${ROLLS.refund[w.r]} Staub zurück.`, 'Löschen')) return;
      deleteWeapon(w.id);
      mage.refreshWeapon();
      renderShop();
    });
    box.appendChild(row);
  }
  return box;
}

function renderShop() {
  $('shopInfo').textContent = `Knochenstaub: ${meta.dust} · Shop-Stufe ${tierNow}`;
  const box = $('shopList');
  box.textContent = '';
  box.appendChild(chestBox());
  if (!offer.length) { box.insertAdjacentText('beforeend', 'Alles für diese Stufe ist schon freigeschaltet.'); return; }
  for (const type of [...new Set(offer.map(e => e.type))]) {
    const h = document.createElement('h3');
    h.textContent = type;
    box.appendChild(h);
    for (const e of offer.filter(x => x.type === type)) {
      const owned = meta.unlocked.includes(e.key), price = priceOf(e);
      const b = document.createElement('button');
      b.className = 'shopItem' + (owned ? ' bought' : '');
      b.style.borderColor = rarityColor(e.rarity);
      const name = document.createElement('span'), tag = document.createElement('span');
      name.textContent = e.name;
      tag.textContent = owned ? 'gekauft' : `${price} Staub`;
      b.append(name, tag);
      b.disabled = owned || meta.dust < price;
      b.dataset.nav = e.key;
      b.addEventListener('click', () => { buy(e); renderShop(); });
      box.appendChild(b);
    }
  }
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
  $('restartBtn').hidden = false;
  $('deathMenuBtn').hidden = false;
  toMainMenu();
});

// Dev
const refresh = () => { renderMenu(); };
$('devDust').addEventListener('click', () => { devSetDust(meta.dust + 500); refresh(); });
$('devUnlock').addEventListener('click', () => { devUnlockAll(); refresh(); });
$('devMetaReset').addEventListener('click', () => { devReset(); refresh(); });
const refreshInv = () => { refresh(); if ($('shopModal').classList.contains('show')) renderShop(); };
$('devInvFill').addEventListener('click', () => { devFillInventory(); refreshInv(); });
$('devInvClear').addEventListener('click', () => { devClearInventory(); refreshInv(); });
$('devComplete').addEventListener('click', () => { $('settingsClose').click(); $('pauseModal').classList.remove('show'); if (!player.dead) completeRun('Dev'); });
