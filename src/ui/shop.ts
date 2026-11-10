// Ergebnis → Shop → Hauptmenü. Ohne Abschluss kein Shop, der Staub aus dem Run bleibt trotzdem.

import { player } from '../state';
import { $ } from '../util';
import { CARD_RARITIES } from '../config';
import { meta, awardDust, rollShop, keepOffer, menuOffer, menuTier, buy, priceOf, devSetDust, devUnlockAll, devReset } from '../meta';
import { completeRun } from '../player';
import { toMainMenu, renderMenu } from './mainMenu';
import { syncPause } from './menus';
import { ROLLS, buyChest, deleteWeapon, devFillInventory, devTopUpInventory, devClearInventory, inventoryFull, rollWeapon, weaponName, rarityOf, effectRows, equipped, equip } from '../weaponRolls';
import { mage } from '../models/mage';
import { attachWeaponCard } from './weaponCard';
import { askConfirm } from './confirm';
import { openHero } from './heroWindow';
import { weaponThumb } from './weaponThumb';
import { pick } from '../util';
import { t, fmtNum } from '../i18n';
import { BOX, buyGearBox, buyLookBox, lookBoxLeft, anySlotFull, rollDrop, gearName, gearRarity, gearRows, slotName, wearGear, worn, isMagierSkin } from '../gear';

const rarityColor = name => CARD_RARITIES.find(r => r.id === name)?.color ?? '#fff';
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

// Shop (Mockups X?S, Look des UI-Flavors): links Kiste, Mitte Ergebnis des letzten Zugs, rechts Verschmelzen, darunter Freischaltungen und Inventar.
// Kiste: kurzes Würfeln, dann liegt die Waffe im Inventar. Animation: Namen wechseln schnell und werden langsamer. // PH: Zeiten
// Pity-Zähler, „×5 öffnen“ und Verschmelzen gibt es im Code nicht: kein Pity-Balken, kein ×5, Verschmelzen nur als Oberfläche („kommt bald“).
const SPIN = { steps: 16, startMs: 40, growMs: 12 };
let spinning = false, lastPull = null, lastIsNew = false;   // lastPull: Ergebnis-Karte bleibt bis zum nächsten Zug stehen
const el = (tag: string, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
const CHEST_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M3 10h18v10H3zM3 10l2-5h14l2 5M10 13h4v3h-4z"/></svg>';
const STAFF_SVG = '<svg viewBox="0 0 12 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 46V10"/><circle cx="6" cy="6" r="4"/></svg>';
const pctOf = (t: string) => { const m = t?.match(/^([+−-]?\d+(?:[,.]\d+)?) %\s*(.*)$/); return m ? { v: parseFloat(m[1].replace('−', '-').replace(',', '.')), label: m[2] } : null; };

function chestCol(resultName: HTMLElement, result: HTMLElement) {
  const col = el('div', 'gPanel fg-panel shopCol');
  const icon = el('div', 'shopIcon'); icon.innerHTML = CHEST_SVG;
  const price = el('div', 'shopPrice', t('shop.price', { n: ROLLS.price }));
  const b = el('button', 'btn fg-btn shopOpen', t(inventoryFull() ? 'shop.invFull' : 'shop.open')) as HTMLButtonElement;
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
  const hint = el('div', 'shopHint', inventoryFull() ? t('shop.needSalvage') : meta.dust < ROLLS.price ? t('shop.noDust') : '');
  col.append(icon, price, b, hint);
  return col;
}

function resultCol() {
  const col = el('div', 'shopResult');
  const name = el('div', 'resName');
  if (!lastPull) {
    col.classList.add('empty');
    name.textContent = t('shop.noDraw');
    col.append(el('div', 'resIcon'), name, el('div', 'resSub', t('shop.openLeft')));
    return { col, name };
  }
  if (lastPull.gear) return gearResult(col, name);
  const w = lastPull, rar = rarityOf(w), rows = effectRows(w);
  col.style.setProperty('--rc', rar.color);
  if (lastIsNew) col.append(el('span', 'resNew', t('shop.new')));
  const icon = el('div', 'resIcon'), img = weaponThumb(w);
  icon.innerHTML = img ? `<img src="${img}" alt="">` : STAFF_SVG;
  name.textContent = weaponName(w);
  const type = rows.find(r => r.kind === 'type')?.text?.split(':')[0];
  col.append(icon, name, el('div', 'resSub', `${rar.name}${type ? ` · ${type}` : ''}`));
  const lines = el('div', 'resLines');
  for (const r of rows) if (r.text && r.kind !== 'type') lines.append(el('div', r.kind === 'unique' ? 'tLegend' : r.kind === 'value' ? '' : 'tAffix', r.text));
  col.append(lines, el('i', 'tSep'));
  const eq = equipped(), mine = pctOf(rows.find(r => r.kind === 'value')?.text ?? ''), other = eq && eq !== w ? pctOf(effectRows(eq).find(r => r.kind === 'value')?.text ?? '') : null;
  const cmp = el('div', 'resCmp');
  if (eq === w) cmp.textContent = t('shop.equipped');
  else if (eq) {
    cmp.textContent = t('shop.current', { name: weaponName(eq) });
    if (mine && other && mine.label === other.label && mine.v !== other.v) {
      const d = Math.round((mine.v - other.v) * 10) / 10;
      cmp.append(' · ', Object.assign(el('b', '', `${d > 0 ? '▲ +' : '▼ −'}${fmtNum(Math.abs(d))} %`), { style: `color:${d > 0 ? '#6ee7a0' : '#f87171'}` }));
    }
  } else cmp.textContent = t('shop.noneEquipped');
  const btns = el('div', 'resBtns');
  const equipB = el('button', 'btn fg-btn', t(eq === w ? 'shop.equipped' : 'shop.equip')) as HTMLButtonElement;
  equipB.disabled = eq === w;
  equipB.addEventListener('click', () => { equip(w.id); mage.refreshWeapon(); lastIsNew = false; renderShop(); });
  const dust = el('button', 'smallBtn fg-btn alt', t('shop.refund', { n: ROLLS.refund[w.r] })) as HTMLButtonElement;
  dust.title = t('shop.salvage');
  dust.addEventListener('click', async () => {
    if (spinning || !await askConfirm(t('shop.salvageTitle'), t('shop.salvageText', { name: weaponName(w), n: ROLLS.refund[w.r] }), t('shop.salvage'))) return;
    deleteWeapon(w.id); mage.refreshWeapon(); lastPull = null; renderShop();
  });
  btns.append(equipB, dust);
  col.append(cmp, btns);
  attachWeaponCard(icon, w);
  return { col, name };
}

// Ergebnis der Gear-Box: Teil mit Werten; unter Blau wurde es schon zu Staub (gear.ts takeGear)
function gearResult(col: HTMLElement, name: HTMLElement) {
  const { g, res } = lastPull, rar = gearRarity(g);
  col.style.setProperty('--rc', rar.color);
  if (lastIsNew) col.append(el('span', 'resNew', t('shop.new')));
  const icon = el('div', 'resIcon');
  icon.innerHTML = CHEST_SVG;
  name.textContent = gearName(g);
  col.append(icon, name, el('div', 'resSub', `${rar.name} · ${slotName(g.slot)}${g.s.setId ? ' · SET' : ''}`));
  const lines = el('div', 'resLines');
  for (const r of gearRows(g)) lines.append(el('div', r.kind === 'element' ? 'tAffix' : '', r.text));
  col.append(lines, el('i', 'tSep'));
  if (!res.kept) { col.append(el('div', 'resCmp', t('box.toDust', { n: res.dust }))); return { col, name }; }
  const on = worn(g.slot) === g, b = el('button', 'btn fg-btn', t(on ? 'shop.equipped' : 'shop.equip')) as HTMLButtonElement;
  b.disabled = on;
  b.addEventListener('click', () => { wearGear(g.slot, g.id); mage.refreshLook(); lastIsNew = false; renderShop(); });
  const btns = el('div', 'resBtns');
  btns.append(b);
  col.append(el('div', 'resCmp', res.over ? t('box.over') : t('box.kept', { slot: slotName(g.slot) })), btns);
  return { col, name };
}

// Gear-Box und Kosmetik-Box unter den drei Spalten (Handoff items.md Schritt 3). Nur Magier: der Strichkrieger trägt kein Gear
function boxRow(resultName: HTMLElement, result: HTMLElement) {
  const row = el('div', '');
  row.style.cssText = 'grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:40px';
  const box = (title: string, price: number, label: string, disabled: boolean, hint: string, onBuy: () => void) => {
    const col = el('div', 'gPanel fg-panel shopCol');
    col.style.minHeight = '0';
    const b = el('button', 'btn fg-btn shopOpen', label) as HTMLButtonElement;
    b.disabled = disabled;
    b.style.height = '52px';
    b.addEventListener('click', onBuy);
    col.append(el('div', 'fg-title fuseTitle', title), el('div', 'shopPrice', t('shop.price', { n: price })), el('div', 'shopHint', hint), b);
    return col;
  };
  const mageNow = isMagierSkin(mage.skin), full = anySlotFull();
  const gearHint = !mageNow ? t('box.mageOnly') : full ? t('box.full') : meta.dust < BOX.gear ? t('shop.noDust') : t('box.gearHint');
  row.append(box(t('box.gear'), BOX.gear, t(full ? 'shop.invFull' : 'shop.open'), spinning || !mageNow || full || meta.dust < BOX.gear, gearHint, () => {
    const got = buyGearBox(mage.skin);
    if (!got) return;
    spinning = true;
    result.classList.add('spinning');
    let i = 0;
    const step = () => {
      const show = i < SPIN.steps ? { ...rollDrop(mage.skin), r: pick([0, 1, 2, 3, 4, 5]) } : got.g;
      resultName.textContent = gearName(show);
      result.style.setProperty('--rc', gearRarity(show).color);
      if (i++ < SPIN.steps) { setTimeout(step, SPIN.startMs + SPIN.growMs * i); return; }
      spinning = false;
      lastPull = { gear: true, ...got };
      lastIsNew = true;
      setTimeout(renderShop, 900);
    };
    step();
  }));
  const soon = !lookBoxLeft().length;   // Pool leer oder alles besessen
  row.append(box(t('box.look'), BOX.look, t(soon ? 'box.soon' : 'shop.open'), soon || meta.dust < BOX.look, t(soon ? 'box.lookSoon' : 'box.lookHint'), () => {
    if (buyLookBox()) renderShop();
  }));
  return row;
}

function fuseCol() {
  const col = el('div', 'gPanel fg-panel shopCol shopFuse');
  col.append(el('div', 'fg-title fuseTitle', t('shop.fuse')), el('p', 'shopHint', t('shop.fuseHint')));
  const slots = el('div', 'fuseSlots');
  for (let i = 0; i < 3; i++) slots.append(el('div', 'fuseSlot'));
  const b = el('button', 'smallBtn fg-btn alt', t('shop.soon')) as HTMLButtonElement;
  b.disabled = true;
  col.append(slots, el('div', 'fuseArrow', '▼'), el('div', 'fuseSlot result', '?'), b);
  return col;
}

function renderShop() {
  $('shopInfo').innerHTML = t('shop.info', { dust: meta.dust, inv: meta.inv.length, max: ROLLS.invMax }) + (tierNow ? t('shop.tier', { n: tierNow }) : '');
  const cols = $('shopCols');
  cols.textContent = '';
  const res = resultCol();
  cols.append(chestCol(res.name, res.col), res.col, fuseCol(), boxRow(res.name, res.col));
  const box = $('shopList');
  box.textContent = '';
  box.append(el('h3', '', t('shop.unlocks')));
  if (!offer.length) box.insertAdjacentText('beforeend', t('shop.allUnlocked'));
  for (const type of [...new Set(offer.map(e => e.type))]) {
    box.appendChild(el('h4', '', t(`shop.type.${type}`)));
    for (const e of offer.filter(x => x.type === type)) {
      const owned = meta.unlocked.includes(e.key), price = priceOf(e);
      const b = el('button', 'shopItem' + (owned ? ' bought' : '')) as HTMLButtonElement;
      b.style.borderColor = rarityColor(e.rarity);
      b.append(el('span', '', e.name), el('span', '', owned ? t('shop.bought') : t('shop.cost', { n: price })));
      b.disabled = owned || meta.dust < price;
      b.dataset.nav = e.key;
      b.addEventListener('click', () => { buy(e); renderShop(); });
      box.appendChild(b);
    }
  }
  const inv = el('button', 'smallBtn fg-btn alt shopInvBtn', t('shop.openInv', { a: meta.inv.length, b: ROLLS.invMax }));
  inv.addEventListener('click', () => openHero({ tab: 'waffen', done: renderShop }));
  box.append(inv);
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
  $('shopClose').textContent = t('shop.back');
  $('shopModal').classList.add('show');
  renderShop();
}
$('menuShop').addEventListener('click', openMenuShop);
$('shopClose').addEventListener('click', () => {
  $('shopModal').classList.remove('show');
  if (fromMenu) {
    fromMenu = false;
    $('shopClose').textContent = t('shop.close');
    renderMenu();
    return;
  }
  $('deathShopBtn').hidden = true;
  toMainMenu();
});

// Esc schließt den Shop wie der Knopf (nicht, solange das Fenster aus heroWindow.ts oder eine Rückfrage darüber liegen)
addEventListener('keydown', e => {
  if (e.code !== 'Escape' || !$('shopModal').classList.contains('show') || document.querySelector('#heroModal.show, .modal.show:has(#askTitle)')) return;
  e.stopImmediatePropagation();
  $('shopClose').click();
}, true);

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
$('devInvTopUp').addEventListener('click', () => {
  const v = ($('devInvTier') as HTMLSelectElement).value;
  devTopUpInventory(v === '' ? null : Number(v));
  refreshInv();
});
$('devInvClear').addEventListener('click', () => { devClearInventory(); refreshInv(); });
$('devComplete').addEventListener('click', () => { $('settingsClose').click(); $('pauseModal').classList.remove('show'); if (!player.dead) completeRun('Dev'); });
