// Ausrüstungsfenster im Hauptmenü (Handoff items.md Schritt 5, Vorlage docs/ref/items-mockup.dc.html), nur Magier. Look des UI-Flavors, Bausteine
// aus dem Waffenmenü (wmHead, wmCell, wmRows). Links Gear-Spalte (5 Slots + Waffe, SET-Marke, Set-Fortschritt), Mitte die Menü-Figur (figPreview),
// rechts Kosmetik-Spalte (Regel: Look vor Gear, Klick auf einen belegten Slot leert ihn). Darunter das Inventar mit Tabs je Slot (25 Plätze):
// Klick legt an, ✕ löscht nach Rückfrage. Handy: Spalten untereinander, Knöpfe ab 44 px.

import { $ } from '../util';
import { meta } from '../meta';
import { mage } from '../models/mage';
import { ROLLS, equipped, weaponName, rarityOf, effectRows } from '../weaponRolls';
import { SLOTS, LOOK_SLOTS, LOOKS, SETS, GEAR, gearInv, sortedGear, worn, wearGear, deleteGear, gearName, gearLines, gearRarity, slotName, setOfSchool, setCount, fullSet,
  perfectText, isMagierSkin, overflow, hasLook, lookIn, wearLook, type Slot, type GearItem } from '../gear';
import { mountFigPreview } from './figPreview';
import { openKeepChooser } from './lootView';
import { openWeaponMenu } from './weaponMenu';
import { askConfirm } from './confirm';
import { syncPause } from './menus';
import { fmtInt } from './dmgNumbers';
import { t } from '../i18n';
import './gearWindow.css';

const el = (tag: string, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
document.body.insertAdjacentHTML('beforeend', `<div id="gearModal" class="modal" role="dialog" aria-labelledby="gmTitle">
  <div id="gmBox">
    <div class="wmHead"><h1 class="fg-title l" id="gmTitle">${t('gear.title')}</h1><span id="gmInfo"></span><button type="button" class="fg-btn alt" id="gmClose">${t('ui.close')}</button></div>
    <div id="gmWait"></div>
    <div class="gmCols">
      <div class="gmCol"><div class="gmColHead"><h2 class="fg-title">${t('gear.colGear')}</h2><span>${t('gear.invNote', { n: GEAR.invMax })}</span></div><div id="gmGear" class="gmCol"></div><div id="gmSet"></div></div>
      <div class="fg-panel gmFig"><div id="gmFigBody" style="position:absolute;inset:0"></div><span class="gmMuted">${t('gear.figHint')}</span></div>
      <div class="gmCol"><div class="gmColHead"><h2 class="fg-title">${t('gear.colLook')}</h2><span>${t('gear.lookNote')}</span></div><div id="gmLooks" class="gmCol"></div><p class="gmMuted">${t('gear.lookRule')}</p></div>
    </div>
    <div class="fg-panel" style="padding:calc(14 * var(--hu)) calc(18 * var(--hu))">
      <div class="gmColHead" style="position:relative;z-index:2"><h2 class="fg-title">${t('gear.inv')}</h2><span id="gmCount"></span></div>
      <div class="gmTabs" id="gmTabs" style="position:relative;z-index:2;margin:8px 0"></div>
      <div class="gmInv" style="position:relative;z-index:2"><div><div class="wmGrid" id="gmGrid"></div><p class="wmHint">${t('gear.hint')}</p></div><div class="gmDetail" id="gmDetail"></div></div>
    </div>
  </div>
</div>`);

let tab: Slot = 'kopf', selected: number | null = null, onClose: (() => void) | null = null;
export const gearWindowOpen = () => $('gearModal').classList.contains('show');
export function openGearWindow(done?: () => void) {
  onClose = done ?? null;
  selected = worn(tab)?.id ?? null;
  mountFigPreview($('gmFigBody'));
  $('gearModal').classList.add('show');
  render();
  syncPause();
}
function closeGearWindow() {
  $('gearModal').classList.remove('show');
  syncPause();
  const done = onClose;
  onClose = null;
  done?.();
}
// Nach jeder Änderung: Figur (Set-Skin, Waffen-Look) und Fenster neu
const changed = () => { mage.refreshLook(); mage.refreshWeapon(); render(); };

// Zeile im Look des Mockups: Slot, Name (+ Wert), Marke
function row(slot: string, name: string, color: string, sub: string, tag = '', cls = '') {
  const b = el('button', `gmRow ${cls}`) as HTMLButtonElement;
  b.type = 'button';
  const txt = el('span', 'gmTxt'), n = el('b', '', name), s = el('small', '', sub);
  n.style.color = color;
  txt.append(n, s);
  b.append(el('span', 'gmSlot', slotName(slot)), txt);
  if (tag) b.append(el('span', 'gmTag', tag));
  return b;
}

function renderGear() {
  const box = $('gmGear'), set = fullSet(mage.skin);
  box.textContent = '';
  for (const slot of SLOTS) {
    const g = worn(slot);
    const sub = !g ? '—' : set ? perfectText(set, slot) : gearLines(g).join(' · ');
    const b = row(slot, g ? gearName(g) : t('gear.empty'), g ? gearRarity(g).color : 'var(--fg-muted)', sub, g?.s.setId ? 'SET' : '', g?.s.setId ? 'set' : '');
    b.addEventListener('click', () => { tab = slot; selected = g?.id ?? null; render(); });
    if (slot === tab) b.classList.add('sel');
    box.append(b);
  }
  const w = equipped(), wb = row('waffe', w ? weaponName(w) : t('menu.noWeapon'), w ? rarityOf(w).color : 'var(--fg-muted)', w ? effectRows(w).find(r => r.kind === 'value')?.text ?? '' : '—');
  wb.addEventListener('click', () => { closeGearWindow(); openWeaponMenu(); });
  box.append(wb);
}

// Set-Fortschritt des gespielten Magiers: „Glutprophet 3/5“, Mechanik, Look; inaktiv ausgegraut
function renderSet() {
  const box = $('gmSet'), id = setOfSchool(mage.skin);
  box.textContent = '';
  if (!id) { box.append(el('p', 'gmMuted', t('gear.noSet'))); return; }
  const n = setCount(id), on = n === SLOTS.length, S = SETS[id];
  const p = el('div', `gmSet${on ? '' : ' off'}`);
  p.style.borderColor = on ? S.color : '';
  const head = el('b', 'fg-title', `${t(`look.magier.${id}.name`)} ${n}/${SLOTS.length}`);
  head.style.color = S.color;
  const bar = el('div', 'gmBar'), fill = el('i');
  fill.style.cssText = `width:${n / SLOTS.length * 100}%;background:${S.color}`;
  bar.append(fill);
  const line = (label: string, text: string) => { const d = el('div'); d.append(el('strong', '', `${label} `), text); return d; };
  p.append(head, bar, line(t('gear.mech'), t(`gear.set.${id}.mech`)), line(t('gear.look'), t(`gear.set.${id}.look`)), el('div', 'gmMuted', t(on ? 'gear.setOn' : 'gear.setOff')));
  box.append(p);
}

// Kosmetik: belegt = Look, leer = „zeigt Gear: …“. Einziger Inhalt bisher Haarspray + Feuerzeug im Waffen-Slot
function renderLooks() {
  const box = $('gmLooks');
  box.textContent = '';
  for (const slot of LOOK_SLOTS) {
    const on = lookIn(slot), gearShown = slot === 'waffe' ? (equipped() ? weaponName(equipped()) : t('menu.noWeapon')) : worn(slot as Slot) ? gearName(worn(slot as Slot)) : '—';
    const free = Object.keys(LOOKS).filter(id => LOOKS[id].slot === slot && hasLook(id)), locked = Object.keys(LOOKS).filter(id => LOOKS[id].slot === slot && !hasLook(id));
    let name = t('gear.empty'), sub = t('gear.showsGear', { name: gearShown });
    if (on) { name = t(LOOKS[on].name); sub = t('gear.lookOn'); }
    else if (free.length) sub = t('gear.freeClick', { name: gearShown });
    else if (locked.length) { name = t('gear.locked'); sub = t('gear.lockedSpray'); }
    const b = row(slot, name, on ? 'var(--fg-text)' : 'var(--fg-muted)', sub, '', `look${on ? ' on' : ''}`);
    b.disabled = !on && !free.length;
    b.addEventListener('click', () => { wearLook(slot, on ? null : free[0]); changed(); });   // belegt: leeren, sonst den freien Look anlegen
    box.append(b);
  }
}

function renderInv() {
  const tabs = $('gmTabs');
  tabs.textContent = '';
  for (const slot of SLOTS) {
    const b = el('button', 'fg-chip', `${slotName(slot)} ${gearInv(slot).length}/${GEAR.invMax}`) as HTMLButtonElement;
    b.type = 'button';
    b.setAttribute('aria-pressed', String(slot === tab));
    b.addEventListener('click', () => { tab = slot; selected = worn(slot)?.id ?? null; render(); });
    tabs.append(b);
  }
  $('gmCount').textContent = t('wm.count', { a: gearInv(tab).length, b: GEAR.invMax });
  const grid = $('gmGrid'), list = sortedGear(tab), on = worn(tab);
  grid.textContent = '';
  for (let i = 0; i < GEAR.invMax; i++) {
    const g = list[i], cell = el('button', 'wmCell' + (g ? '' : ' empty') + (g && g.id === selected ? ' sel' : '')) as HTMLButtonElement;
    cell.type = 'button';
    if (g) {
      cell.style.setProperty('--rc', gearRarity(g).color);
      cell.append(el('span', 'gmCellName', gearName(g)));
      if (g.s.setId) cell.append(el('span', 'gmTag', 'SET'));
      if (g === on) cell.append(el('b', 'wmE', 'E'));
      cell.title = `${gearName(g)} · ${gearRarity(g).name} · ${gearLines(g).join(' · ')}`;
      cell.setAttribute('aria-label', cell.title);
      cell.addEventListener('click', () => { selected = g.id; wearGear(tab, g.id); changed(); });   // Klick legt an
    } else cell.disabled = true;
    grid.append(cell);
  }
  renderDetail(list.find(g => g.id === selected) ?? on);
}

function renderDetail(g: GearItem | null) {
  const box = $('gmDetail');
  box.textContent = '';
  if (!g) { box.append(el('p', 'wmEmpty', t('gear.invEmpty'))); return; }
  const rar = gearRarity(g), name = el('div', 'wmName fg-title', gearName(g));
  name.style.color = rar.color;
  box.append(name, el('div', 'wmSub', `${rar.name} · ${slotName(g.slot)}${g.s.setId ? ` · SET ${t(`look.magier.${g.s.setId}.name`)}` : ''}`));
  const rows = el('div', 'wmRows');
  for (const l of gearLines(g)) rows.append(el('div', '', `◆ ${l}`));
  if (g.s.setId) rows.append(el('div', 'gmMuted', `5/5: ${perfectText(g.s.setId, g.slot)}`));
  box.append(rows);
  const btns = el('div', 'wmDBtns'), isOn = worn(g.slot) === g;
  const eq = el('button', 'fg-btn', t(isOn ? 'gear.unwear' : 'gear.wear')) as HTMLButtonElement;
  eq.type = 'button';
  eq.addEventListener('click', () => { wearGear(g.slot, isOn ? null : g.id); changed(); });
  const del = el('button', 'fg-btn alt', `✕ +${ROLLS.refund[g.r]}`) as HTMLButtonElement;
  del.type = 'button';
  del.title = t('gear.delete');
  del.setAttribute('aria-label', `${t('gear.delete')} +${ROLLS.refund[g.r]}`);
  del.addEventListener('click', async () => {
    if (!await askConfirm(t('gear.deleteTitle'), t('gear.deleteText', { name: gearName(g), n: ROLLS.refund[g.r] }), t('gear.delete'))) return;
    deleteGear(g.slot, g.id);
    if (selected === g.id) selected = worn(tab)?.id ?? null;
    changed();
  });
  btns.append(eq, del);
  box.append(btns);
}

function render() {
  $('gmInfo').innerHTML = t('gear.info', { dust: fmtInt(meta.dust) });
  const wait = $('gmWait');
  wait.textContent = '';
  if (overflow().length) {
    const b = el('button', 'fg-btn', t('gear.waiting', { n: overflow().length })) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () => openKeepChooser(render));
    wait.append(b);
  }
  if (!isMagierSkin(mage.skin)) { $('gmGear').textContent = t('gear.mageOnly'); $('gmSet').textContent = ''; }
  else { renderGear(); renderSet(); }
  renderLooks();
  renderInv();
}

$('gmClose').addEventListener('click', closeGearWindow);
addEventListener('keydown', e => {
  if (!gearWindowOpen() || document.getElementById('askTitle')?.closest('.modal')?.classList.contains('show') || $('gearKeepModal').classList.contains('show')) return;
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeGearWindow(); }
}, true);

// Taste (input.ts, Aktion gearWin): schließt das offene Fenster, öffnet es sonst wie der Knopf – nur im Hauptmenü ohne anderes Fenster
// darüber und nur, wenn der Knopf da ist (Magier). Im Run nicht: das Gear wirkt erst ab dem nächsten Run (applyRunGear)
export function toggleGearWindow() {
  if (gearWindowOpen()) {
    if (!document.querySelector('.modal.show:not(#gearModal):not(#startModal)')) closeGearWindow();
    return;
  }
  if (btn.hidden || !$('startModal').classList.contains('show') || document.querySelector('.modal.show:not(#startModal)')) return;
  btn.click();
}

// Knopf im Hauptmenü neben „Waffen“, nur für Magier (mainMenu.ts renderMenu blendet ihn)
const btn = el('button', 'fg-btn alt', t('gear.btn')) as HTMLButtonElement;
btn.id = 'menuGearBtn';
btn.type = 'button';
$('menuWeaponsBtn').after(btn);
export const gearBtn = btn;
