// Filterleiste des Charakterfensters (E10, aus heroWindow.ts): Listen mit Häkchen, Seltenheits-Rauten, Sortieren, Suche, aktive Filter als Chips.
import { $ } from '../../util';
import { CARD_RARITIES } from '../../config';
import { t } from '../../i18n';
import { el } from '../dom';
import { type Kind, hw } from './state';
import { attrs, options, GROUP_NAME, SORTS, DEF, F, setF, renderInv } from './inventory';

// ---------- Filterleiste ----------
const RAR_DIA = () => CARD_RARITIES.map((r, i) => `<button type="button" class="hwRar" data-r="${i}" style="--rc:${r.color}" aria-label="${t('inv.rarity')} ${r.name}" title="${r.name}"></button>`).join('');
export function buildBar(k: Kind) {
  hw.barKind = k;
  const bar = $('hwBar');
  bar.hidden = k === 'k';
  if (k === 'k') { bar.textContent = ''; return; }
  bar.innerHTML = `${Object.keys(attrs(k)).map(g => `<div class="hwDrop" data-g="${g}"><button type="button" class="hwChip" aria-haspopup="listbox" aria-expanded="false"><small>${GROUP_NAME(g)}</small><b></b></button><div class="hwList fg-panel" role="listbox" hidden></div></div>`).join('')}
    <div class="hwRars"><small>${t('inv.rarity')}</small><span>${RAR_DIA()}</span></div>
    <div class="hwDrop" data-g="sort"><button type="button" class="hwChip" aria-haspopup="listbox" aria-expanded="false"><small>${t('inv.sort')}</small><b></b></button><div class="hwList fg-panel" role="listbox" hidden></div></div>
    <label class="hwSearch"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="hwQ" placeholder="${t('hw.search')}" aria-label="${t('hw.search')}"></label>`;
  for (const drop of bar.querySelectorAll<HTMLElement>('.hwDrop')) {
    const g = drop.dataset.g, list = drop.querySelector<HTMLElement>('.hwList'), btn = drop.querySelector('.hwChip');
    btn.addEventListener('click', () => {
      closeLists(drop);
      list.hidden = !list.hidden;
      btn.setAttribute('aria-expanded', String(!list.hidden));
      if (!list.hidden) renderList(drop);
    });
    list.addEventListener('change', () => {
      const on = [...list.querySelectorAll<HTMLInputElement>('input:checked')].map(i => i.dataset.v);
      setF(k, { [g]: on.length === options(k, g).length ? null : on });
      renderInv();
    });
    list.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (g === 'sort') { setF(k, { sort: b.dataset.v }); closeLists(); }
      else setF(k, { [g]: b.dataset.all === '1' ? null : [] });
      renderList(drop);
      renderInv();
    });
  }
  for (const b of bar.querySelectorAll<HTMLElement>('.hwRar')) b.addEventListener('click', () => {
    const r = +b.dataset.r, rar = F(k).rar;
    setF(k, { rar: rar.includes(r) ? rar.filter(x => x !== r) : [...rar, r].sort() });
    renderInv();
  });
  const q = $('hwQ') as HTMLInputElement;
  q.addEventListener('input', () => { setF(k, { q: q.value.trim() }); renderInv(); });
  q.addEventListener('keydown', e => {   // Tippen löst keine Spieltasten aus; Esc/Enter/↓ zurück ins Raster
    e.stopPropagation();
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'ArrowDown') { e.preventDefault(); q.blur(); }
  });
}
export function chipValue(k: Kind, g: string) {
  const f = F(k);
  if (g === 'sort') return (SORTS[f.sort] ?? SORTS.rar)[0]();
  const s = f[g];
  if (!s) return t('inv.all');
  if (!s.length) return t('hw.none');
  return s.length === 1 ? options(k, g).find(o => o.id === s[0])?.name ?? s[0] : t('hw.picked', { n: s.length });
}
function renderList(drop: HTMLElement) {
  const k = hw.barKind, g = drop.dataset.g, list = drop.querySelector<HTMLElement>('.hwList'), f = F(k);
  if (g === 'sort') {
    list.innerHTML = Object.entries(SORTS).map(([id, [n]]) => `<button type="button" role="option" class="hwOpt${f.sort === id ? ' on' : ''}" data-v="${id}" aria-selected="${f.sort === id}">${n()}</button>`).join('');
    return;
  }
  const s = f[g];
  list.innerHTML = options(k, g).map(o => `<label class="hwOpt"><input type="checkbox" data-v="${o.id}"${!s || s.includes(o.id) ? ' checked' : ''}>`
    + `${o.color ? `<i style="background:${o.color}"></i>` : ''}<span>${o.name}</span>${o.sub ? `<small>${o.sub}</small>` : ''}</label>`).join('')
    + `<div class="hwAllNone"><button type="button" data-all="1">${t('inv.all')}</button><button type="button" data-all="0">${t('hw.none')}</button></div>`;
}
export function closeLists(except?: HTMLElement) {
  for (const d of document.querySelectorAll<HTMLElement>('#heroModal .hwDrop')) if (d !== except) {
    d.querySelector<HTMLElement>('.hwList').hidden = true;
    d.querySelector('.hwChip').setAttribute('aria-expanded', 'false');
  }
}
export const listsOpen = () => !!document.querySelector('#heroModal .hwList:not([hidden])');
// Aktive Filter als Chips mit ✕
export function activeChips(k: Kind) {
  const f = F(k), out: [string, Record<string, any>][] = [];
  for (const g of Object.keys(attrs(k))) if (f[g]) out.push([`${GROUP_NAME(g)}: ${f[g].length ? f[g].map(v => options(k, g).find(o => o.id === v)?.name ?? v).join(', ') : t('hw.none')}`, { [g]: null }]);
  if (f.rar.length < CARD_RARITIES.length) out.push([`${t('inv.rarity')}: ${f.rar.map(i => CARD_RARITIES[i].name).join(', ') || t('hw.none')}`, { rar: DEF.rar }]);
  if (f.q) out.push([`„${f.q}“`, { q: '' }]);
  const box = $('hwChips');
  box.textContent = '';
  for (const [label, reset] of out) {
    const b = el('button', 'hwActiveChip', `${label} ✕`);
    b.type = 'button';
    b.addEventListener('click', () => { setF(k, reset); if ('q' in reset) ($('hwQ') as HTMLInputElement).value = ''; renderInv(); });
    box.append(b);
  }
}
