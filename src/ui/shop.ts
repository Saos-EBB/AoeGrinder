// Ergebnis → Shop → Hauptmenü. Ohne Abschluss kein Shop, der Staub aus dem Run bleibt trotzdem.

import { player } from '../state';
import { $ } from '../util';
import { CARD_RARITIES } from '../config';
import { meta, awardDust, rollShop, buy, priceOf, devSetDust, devUnlockAll, devReset } from '../meta';
import { completeRun } from '../player';
import { toMainMenu, renderMenu } from './mainMenu';
import { syncPause } from './menus';

const rarityColor = name => CARD_RARITIES.find(r => r.name === name)?.color ?? '#fff';
let offer = [], tierNow = 0;

export function afterRun(completed) {
  const { dust, tier } = awardDust(completed);
  tierNow = tier;
  offer = tier ? rollShop(tier) : [];
  $('deathStatsDust')?.remove();
  $('runRank').insertAdjacentHTML('afterend', `<div id="deathStatsDust" style="color:#efe0b8;font-weight:700;margin-top:6px">Knochenstaub +${dust}, jetzt ${meta.dust}${tier ? ` · Shop-Stufe ${tier}` : ''}</div>`);
  $('deathShopBtn').hidden = !tier;
  $('restartBtn').hidden = !!tier;
  $('deathMenuBtn').hidden = !!tier;
}

function renderShop() {
  $('shopInfo').textContent = `Knochenstaub: ${meta.dust} · Shop-Stufe ${tierNow}`;
  const box = $('shopList');
  box.textContent = '';
  if (!offer.length) { box.textContent = 'Alles für diese Stufe ist schon freigeschaltet.'; return; }
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
$('shopClose').addEventListener('click', () => {
  $('shopModal').classList.remove('show');
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
$('devComplete').addEventListener('click', () => { $('settingsClose').click(); if (!player.dead) completeRun('Dev'); });
