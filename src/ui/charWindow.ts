// Charakterfenster: pausiert, geht auch während der Kartenwahl. Tabs: Werte, Build, Schaden nach Quelle.

import { state, player } from '../state';
import { $ } from '../util';
import { fmtInt } from './dmgNumbers';
import { CFG, SPELLS, CARDS } from '../config';
import { maxHp, maxMana, spirit, dmgMult } from '../formulas';
import { modFactor, modValue } from '../modifiers';
import { mage } from '../models/mage';
import { run } from '../score';
import { spellValue } from '../cards';
import { SUPPORTS } from '../spells/supports';
import { rune, stat } from '../spells/core';
import { moveMul } from '../realMen';
import { syncPause } from './menus';
import { COLORS } from './colors';
import { ICONS } from './icons';
import { attachSpellCard } from './spellCard';
import { attachWeaponCard } from './weaponCard';
import { equipped, rarityOf, weaponName } from '../weaponRolls';
import { figureInfo } from './charInfo';
import { t, fmtNum, locale } from '../i18n';

const TABS = { stats: t('cw.tab.stats'), build: t('cw.tab.build'), dmg: t('cw.tab.dmg') };
let tab = 'stats';
const pct = v => `${Math.round(v * 100)} %`;
const SCHOOLS = { frost: t('school.frost'), fire: t('school.fire'), arcane: t('school.arcane'), shadow: t('tag.Dunkel'), nature: t('school.nature'), lightning: t('school.lightning'), blood: t('school.blood'), bone: t('school.bone') };

// Mockup C2: drei Spalten Werte / Build / Schaden. Breite Fenster zeigen alle drei, schmale nur den aktiven Tab (CSS).
const kv = (a, b) => `<div class="cRow"><span>${a}</span><b>${b}</b></div>`;
function statsTab() {
  const rage = !!player.rageMax;
  const owned = state.slots.filter(Boolean);
  const schools: any[] = [...new Set(owned.map(id => SPELLS[id].school ?? SPELLS[id].cls))].filter(s => s !== 'util');
  return `<div class="title">${t('cw.tab.stats')}</div>
    ${kv(t('cw.life'), `${Math.ceil(player.hp)} / ${maxHp()}`)}
    ${kv(rage ? t('res.rage') : 'Mana', `${Math.floor(player.mana)} / ${maxMana()}`)}
    ${rage || modValue('lifeCost') ? '' : kv(t('cw.regen'), t('cw.regenVal', { n: +(spirit() / 4 + 12.5).toFixed(1), s: CFG.regenTick / 1000 }))}
    ${kv('Crit', pct(modValue('baseCrit') ?? CFG.baseCrit))}
    ${kv(t('cw.speed'), `${fmtNum(+(CFG.runSpeed * (mage.fx.speedMul ?? 1) * moveMul()).toFixed(1))} yd/s`)}
    ${kv(t('cw.dmgAll'), pct(dmgMult() * modFactor('dmg')))}
    ${schools.map(s => {
      const best = Math.max(...owned.filter(id => (SPELLS[id].school ?? SPELLS[id].cls) === s).map(id => spellValue(id)));
      return kv(`<span style="color:${COLORS.school[s]}">${SCHOOLS[s] ?? t('school.warrior')}</span>`, best ? t('cw.upTo', { n: best }) : '—');
    }).join('')}
    ${player.luck ? kv(t('cw.luck'), player.luck) : ''}
    ${figureInfo()}`;
}

// Build: Spells mit Rang und Rune, Talente, Supports, Relikt, Waffe. Seltenheit der gewählten Karten speichert das Spiel nicht: Rahmen = Schule bzw. Typ
const rankOf = id => Object.entries<any>(state.cardPicks ?? {}).reduce((n, [cid, k]) => cid.startsWith(`${id}-`) ? n + k : n, 0);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = n => ROMAN[n] ?? String(n);
function buildTab() {
  const picks = Object.values<any>(state.cardPicks ?? {}).reduce((a, b) => a + b, 0);
  const tile = (attrs, color, icon, name, sub) => `<div class="cTile" ${attrs} style="--tc:${color}">${icon ? `<i style="background-image:url(${icon})"></i>` : '<i class="none"></i>'}<b>${name}</b><span>${sub}</span></div>`;
  const spells = state.slots.filter(id => id && !SPELLS[id].relic).map(id => {
    const r = rune(id), rank = rankOf(id);
    return tile(`data-spell="${id}"`, COLORS.school[SPELLS[id].school ?? SPELLS[id].cls] ?? COLORS.text, ICONS[id], SPELLS[id].name, `${t('cw.rank', { n: roman(rank + 1) })}${r ? ` · ${r.name}` : ''}`);
  });
  const talents = Object.entries<any>(state.cardRanks ?? {}).filter(([, n]) => n).map(([id, n]) => tile('', COLORS.cardKind.talent, null, CARDS.find(c => c.id === id)?.name ?? id, t('cw.stage', { n: roman(n) })));
  const supports = Object.keys(state.supports ?? {}).map(id => tile('', COLORS.cardKind.support, null, SUPPORTS.find(x => x.id === id)?.name ?? id, t('cardui.kindName.support')));
  const relics = state.slots.filter(id => id && SPELLS[id].relic);
  const w = equipped();
  return `<div class="title">${t('cw.buildTitle', { n: picks })}</div>
    <div class="cTiles">${[...spells, ...talents, ...supports].join('')}</div>
    <div class="cSub">${t('cw.relic')}</div>${relics.length ? relics.map(id => `<div class="cRelic" data-spell="${id}">♛ ${SPELLS[id].name}</div>`).join('') : '<div class="cNone">—</div>'}
    <div class="cSub">${t('cw.weapon')}</div>${w ? `<div class="cWeapon" data-weapon style="color:${rarityOf(w).color}">${weaponName(w)}</div>` : '<div class="cNone">—</div>'}`;
}

function dmgTab() {
  const list = Object.entries<any>(run.dmgBySource ?? {}).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((sum, [, v]) => sum + v, 0);
  if (!total) return `<div class="title">${t('cw.dmgTitle')}</div><p class="cNone">${t('cw.noDmg')}</p>`;
  const top = list[0][1];
  return `<div class="title">${t('cw.dmgTitle')}</div>${list.slice(0, 8).map(([id, v]) => {
    const def = SPELLS[id], color = def?.relic ? '#e3c27a' : COLORS.school[def?.school ?? def?.cls] ?? '#fff';
    return `<div class="cDmg"><div class="cRow"><span${def ? ` data-spell="${id}"` : ''}>${def?.name ?? t('cw.env')}</span><b>${fmtInt(v)} <small>${pct(v / total)}</small></b></div><i style="width:${v / top * 100}%;background:${color}"></i></div>`;
  }).join('')}
    <div class="cRow cDps"><span>${t('cw.dps')}</span><b>${state.now > 1000 ? fmtInt(total / (state.now / 1000)) : '—'}</b></div>`;
}

function render() {
  const bar = $('charTabs');
  bar.innerHTML = '';
  for (const [id, name] of Object.entries(TABS)) {
    const b = document.createElement('button');
    b.className = 'cTab' + (id === tab ? ' on' : '');
    b.textContent = name;
    b.addEventListener('click', () => { tab = id; render(); });
    bar.appendChild(b);
  }
  const body = $('charBody');
  body.innerHTML = ['stats', 'build', 'dmg'].map(id => `<div class="gPanel charCol${id === tab ? ' on' : ''}" data-col="${id}">${id === 'stats' ? statsTab() : id === 'build' ? buildTab() : dmgTab()}</div>`).join('');
  for (const el of body.querySelectorAll<HTMLElement>('[data-spell]')) attachSpellCard(el, el.dataset.spell);
  const wEl = body.querySelector<HTMLElement>('[data-weapon]');
  if (wEl && equipped()) attachWeaponCard(wEl, equipped());
}
export const charOpen = () => $('charModal').classList.contains('show');
export function toggleChar() {
  if ($('startModal').classList.contains('show')) return;
  $('charModal').classList.toggle('show');
  if (charOpen()) render();
  syncPause();
}
export function charTab(step) {
  const ids = Object.keys(TABS);
  tab = ids[(ids.indexOf(tab) + step + ids.length) % ids.length];
  render();
}
$('charClose').addEventListener('click', toggleChar);
