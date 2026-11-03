// Charakterfenster: pausiert, geht auch während der Kartenwahl. Tabs: Werte, Build, Schaden nach Quelle.

import { state, player } from '../state';
import { $ } from '../util';
import { CFG, SPELLS, CARDS } from '../config';
import { maxHp, maxMana, spirit, dmgMult } from '../formulas';
import { modFactor, modValue } from '../modifiers';
import { mage } from '../models/mage';
import { run } from '../score';
import { spellValue } from '../cards';
import { SUPPORTS } from '../spells/supports';
import { rune, stat } from '../spells/core';
import { moveMul } from '../realMen';
import { klingeMoveMul } from '../klinge';
import { syncPause } from './menus';
import { COLORS } from './colors';

const TABS = { stats: 'Werte', build: 'Build', dmg: 'Schaden nach Quelle' };
let tab = 'stats';
const pct = v => `${Math.round(v * 100)} %`;
const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
const SCHOOLS = { frost: 'Frost', fire: 'Feuer', arcane: 'Arkan', shadow: 'Dunkel', nature: 'Natur', lightning: 'Blitz', bone: 'Knochen' };

function statsTab() {
  const rage = !!player.rageMax;
  const owned = state.slots.filter(Boolean);
  const schools: any[] = [...new Set(owned.map(id => SPELLS[id].school ?? SPELLS[id].cls))].filter(s => s !== 'util');
  return `<table>
    ${row('Leben', `${Math.ceil(player.hp)} / ${maxHp()}`)}
    ${player.resLabel ? row('Haltung', player.resLabel) : row(rage ? 'Wut' : 'Mana', `${Math.floor(player.mana)} / ${maxMana()}`)}
    ${rage ? '' : row('Mana-Regeneration', `${(spirit() / 4 + 12.5).toFixed(1).replace('.', ',')} alle ${CFG.regenTick / 1000} s`)}
    ${row('Crit', pct(modValue('baseCrit') ?? CFG.baseCrit))}
    ${row('Tempo', `${(CFG.runSpeed * (mage.fx.speedMul ?? 1) * moveMul() * klingeMoveMul()).toFixed(1).replace('.', ',')} yd/s`)}
    ${row('Schaden allgemein', pct(dmgMult() * modFactor('dmg')))}
    ${schools.map(s => {
      const best = Math.max(...owned.filter(id => (SPELLS[id].school ?? SPELLS[id].cls) === s).map(id => spellValue(id)));
      return row(`<span style="color:${COLORS.school[s]}">${SCHOOLS[s] ?? 'Krieger'}</span>`, best ? `bis ${best} pro Treffer` : '–');
    }).join('')}
  </table>`;
}

function buildTab() {
  const lines = [];
  for (const id of state.slots) {
    if (!id) continue;
    const s = stat(id), r = rune(id);
    const c = COLORS.school[SPELLS[id].school ?? SPELLS[id].cls];
    lines.push(row(`<span style="color:${c}">${SPELLS[id].relic ? '♛ ' : ''}${SPELLS[id].name}</span>${r ? ` · ${r.name}` : ''}`, `Schaden ${pct(s.dmg)}, Mana ${pct(s.mana)}, Radius ${pct(s.radius)}`));
  }
  for (const id of Object.keys(state.supports ?? {})) lines.push(row(SUPPORTS.find(x => x.id === id)?.name ?? id, 'Support'));
  for (const [id, n] of Object.entries<any>(state.cardRanks ?? {})) if (n) lines.push(row(CARDS.find(c => c.id === id)?.name ?? id, `Stufe ${n}`));
  if (player.luck) lines.push(row('Glück', player.luck));
  return `<table>${lines.join('')}</table>`;
}

function dmgTab() {
  const list = Object.entries<any>(run.dmgBySource ?? {}).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((sum, [, v]) => sum + v, 0);
  if (!total) return '<p>Noch kein Schaden in diesem Run.</p>';
  return `<table>${list.map(([id, v]) => {
    const def = SPELLS[id], color = COLORS.school[def?.school ?? def?.cls] ?? '#fff', share = v / total;
    return `<tr><td style="color:${color}">${def?.name ?? 'Umgebung'}</td><td>${v.toLocaleString('de-DE')}</td><td>${pct(share)}</td></tr>
      <tr class="dmgBar"><td colspan="3"><div style="width:${share * 100}%;background:${color}"></div></td></tr>`;
  }).join('')}</table>`;
}

function render() {
  const bar = $('charTabs');
  bar.innerHTML = '';
  for (const [id, name] of Object.entries(TABS)) {
    const b = document.createElement('button');
    b.className = 'bindBtn' + (id === tab ? ' selected' : '');
    b.textContent = name;
    b.addEventListener('click', () => { tab = id; render(); });
    bar.appendChild(b);
  }
  $('charBody').innerHTML = tab === 'stats' ? statsTab() : tab === 'build' ? buildTab() : dmgTab();
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
