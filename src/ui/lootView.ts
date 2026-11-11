// Gear-Funde im Run-Ende (Handoff items.md Schritt 2): Liste der Funde und, wenn ein Slot-Tab voll war, die Auswahl, was bleibt.
// Kein Verlust ohne Rückfrage: Überzählige Teile warten in meta.gearOver, bis die Auswahl bestätigt ist (auch später aus dem Charakterfenster heroWindow.ts).
// Look: Klassen des Run-Endes (endRow, gPanel) und der Filterlisten im Fenster heroWindow.ts (hwKeepOpt in heroWindow.css).

import { state } from '../state';
import { ROLLS, rarityOf } from '../weaponRolls';
import { SLOTS, GEAR, type Slot } from '../gear/data';
import { gearInv, overflow, worn } from '../gear/inventory';
import { gearName, gearLines, slotName } from '../gear/text';
import { meta, saveMeta, earnDust } from '../meta';
import { askConfirm } from './confirm';
import { t } from '../i18n';
import type { Find } from '../loot';
import { gearThumbHtml } from './itemThumb';
import { esc } from './dom';



// HTML für das Run-Ende (leaderboardView.ts showRunResult). Leer, wenn es nichts gab
export function findsHtml() {
  const finds: Find[] = state.finds ?? [];
  if (!finds.length && !overflow().length) return '';
  const kept = finds.filter(f => !f.dust), dust = finds.reduce((s, f) => s + f.dust, 0);
  const thumb = (g) => `<i class="lootThumb" style="--rc:${rarityOf(g).color}">${gearThumbHtml(g, '◆')}</i>`;   // Bild des Teils (bis es da ist: Raute)
  const rows = kept.map(f => `<div class="endRow"><span style="color:${rarityOf(f.item).color}">${thumb(f.item)}${esc(gearName(f.item))}${f.item.s.setId ? ' · SET' : ''}</span><b>${esc(slotName(f.item.slot))}</b></div>`).join('');
  return `<div class="gPanel fg-panel" style="margin-top:14px;padding:14px 20px 18px;text-align:left"><div class="fg-title" style="position:relative;z-index:2;font-size:17px;margin-bottom:8px">${t('loot.title', { n: finds.length })}</div>
    <div style="position:relative;z-index:2">${rows || `<p>${t('loot.noneKept')}</p>`}
    ${dust ? `<div class="endRow"><span>${t('loot.dustRow', { n: finds.length - kept.length })}</span><b>+${dust}</b></div>` : ''}
    ${overflow().length ? `<p style="color:#f87171">${t('loot.full', { n: overflow().length })}</p><button class="fg-btn" id="gearKeepBtn" style="min-height:44px">${t('loot.choose')}</button>` : ''}</div></div>`;
}
export function bindFinds(after?: () => void) {
  document.getElementById('gearKeepBtn')?.addEventListener('click', () => openKeepChooser(after));
}

// ---------- Auswahl, was bleibt ----------
const modal = document.createElement('div');
modal.id = 'gearKeepModal';
modal.className = 'modal';
modal.style.zIndex = '5';
modal.innerHTML = `<div class="frame panel" style="width:min(760px,96vw);max-width:none;max-height:92vh;overflow:auto;text-align:left">
  <h1 class="title" style="font-size:24px">${t('loot.keepTitle')}</h1>
  <p>${t('loot.keepHint', { n: GEAR.invMax })}</p>
  <div id="gearKeepList"></div>
  <p id="gearKeepMsg" style="min-height:1.4em;color:#ff8a7a"></p>
  <div class="row2">
    <button class="smallBtn" id="gearKeepLater" style="width:auto;min-height:44px;padding:6px 14px">${t('loot.later')}</button>
    <button class="smallBtn" id="gearKeepOk" style="width:auto;min-height:44px;padding:6px 14px">${t('loot.keepOk')}</button>
  </div>
</div>`;
document.body.appendChild(modal);
const $m = (id: string) => modal.querySelector<HTMLElement>(`#${id}`);
let pick: Record<number, boolean> = {}, done: (() => void) | null = null;
const slotsOver = () => SLOTS.filter(s => overflow().some(g => g.slot === s));
const allOf = (slot: Slot) => [...gearInv(slot), ...overflow().filter(g => g.slot === slot)].sort((a, b) => b.r - a.r || b.id - a.id);

export function openKeepChooser(after?: () => void) {
  done = after ?? null;
  pick = {};
  for (const slot of slotsOver()) allOf(slot).forEach((g, i) => { pick[g.id] = i < GEAR.invMax || worn(slot) === g; });   // Vorschlag: die besten 25, das angelegte immer
  render();
  modal.classList.add('show');
}
function render() {
  const box = $m('gearKeepList');
  box.textContent = '';
  for (const slot of slotsOver()) {
    const list = allOf(slot), n = list.filter(g => pick[g.id]).length;
    const head = document.createElement('h3');
    head.textContent = t('loot.slotCount', { slot: slotName(slot), a: n, b: GEAR.invMax });
    head.style.color = n > GEAR.invMax ? '#f87171' : '';
    box.append(head);
    for (const g of list) {
      const row = document.createElement('label'), cb = document.createElement('input'), name = document.createElement('span'), sub = document.createElement('small');
      row.className = 'hwKeepOpt';
      row.style.minHeight = '44px';
      row.style.whiteSpace = 'normal';
      cb.type = 'checkbox';
      cb.checked = !!pick[g.id];
      cb.disabled = worn(slot) === g;   // angelegt: bleibt
      cb.addEventListener('change', () => { pick[g.id] = cb.checked; render(); });
      name.textContent = `${gearName(g)}${g.s.setId ? ' · SET' : ''}${overflow().includes(g) ? ` · ${t('shop.new')}` : ''}`;
      name.style.color = rarityOf(g).color;
      sub.textContent = `${gearLines(g).join(' · ')} · +${ROLLS.refund[g.r]}`;
      const ic = document.createElement('i');
      ic.className = 'lootThumb';
      ic.style.setProperty('--rc', rarityOf(g).color);
      ic.innerHTML = gearThumbHtml(g, '◆');
      row.append(cb, ic, name, sub);
      box.append(row);
    }
  }
  const tooMany = slotsOver().some(s => allOf(s).filter(g => pick[g.id]).length > GEAR.invMax);
  $m('gearKeepMsg').textContent = tooMany ? t('loot.tooMany', { n: GEAR.invMax }) : '';
  ($m('gearKeepOk') as HTMLButtonElement).disabled = tooMany;
}
$m('gearKeepLater').addEventListener('click', () => { modal.classList.remove('show'); done?.(); });
$m('gearKeepOk').addEventListener('click', async () => {
  const lose = slotsOver().flatMap(s => allOf(s).filter(g => !pick[g.id]));
  const dust = lose.reduce((s, g) => s + ROLLS.refund[g.r], 0);
  if (lose.length && !await askConfirm(t('loot.keepTitle'), t('loot.keepConfirm', { n: lose.length, dust }), t('loot.keepOk'))) return;
  for (const slot of slotsOver()) meta.gear[slot] = allOf(slot).filter(g => pick[g.id]);
  meta.gearOver = [];
  earnDust(dust);
  saveMeta();
  modal.classList.remove('show');
  done?.();
});
