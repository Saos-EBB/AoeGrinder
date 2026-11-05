// Hover-Karte für Spells und Relikte (Mockup T1): Hauptmenü (Start-Kit), Pause, Zauberleiste, Charakterfenster.
// Spell: Name in Schulfarbe, Rang, Schule · Typ, Kosten, Abklingzeit, Zauberzeit, Reichweite, Text mit farbigen Stichwörtern,
// Rune (orange) und Talente (grün), Schaden-Anteil im Run, Shift = Formel. Relikt: Goldrahmen, Abklingzeit, Text, Flavor.

import { state, player } from '../state';
import { SPELLS, CARDS } from '../config';
import { manaCost, spellCd, dmgMult } from '../formulas';
import { modFactor } from '../modifiers';
import { paysLife, rune, runesOf, stat } from '../spells/core';
import { spellValue } from '../cards';
import { batteryMode } from '../battery';
import { run } from '../score';
import { ICONS } from './icons';
import { COLORS } from './colors';
import { markWords } from './keywords';
import { attachTip, hideTip, TipData } from './tooltip';

const RELIC_GOLD = '#e3c27a';
const SCHOOL_NAME = { frost: 'Frost', fire: 'Feuer', arcane: 'Arkan', lightning: 'Blitz', nature: 'Natur', shadow: 'Schatten', blood: 'Blut', bone: 'Knochen', util: 'Hilfe', warrior: 'Krieger' };
const BASE_HIT = s => s.tickDmg ?? (s.min ? (s.min + s.max) / 2 : s.dmg ?? s.pulse ?? s.showDmg);
const num = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
const sec = ms => `${String(Math.round(ms / 10) / 100).replace('.', ',')} s`;
const unit = id => paysLife(id) ? 'Leben' : batteryMode() ? 'Ladung' : player.rageMax === 1 ? '' : player.rageMax ? 'Wut' : 'Mana';

// Rang = gewählte Rang-Karten dieses Spells (ids „spell-wert“)
const rankOf = id => Object.entries<any>(state.cardPicks ?? {}).reduce((n, [cid, k]) => cid.startsWith(`${id}-`) ? n + k : n, 0);
function runShare(id) {
  const all = Object.values<any>(run.dmgBySource ?? {}).reduce((a, b) => a + b, 0), mine = run.dmgBySource?.[id] ?? 0;
  return all ? `${Math.round(mine / all * 100)} %` : '—';
}

export function spellTip(id: string, label?: string): TipData | null {
  const s = SPELLS[id];
  if (!s) return null;
  const school = s.school ?? s.cls, relic = !!s.relic;
  const color = relic ? RELIC_GOLD : COLORS.school[school] ?? COLORS.text;
  const stats: [string, string][] = [];
  const cost = s.press && !s.random ? s.mana : manaCost(id), u = unit(id);
  stats.push(['Kosten', cost > 0 && u ? `${cost} ${u}` : '—']);
  const cd = spellCd(id);
  stats.push(['Abklingzeit', cd > 0 ? sec(cd) : '—']);
  stats.push([s.channel ? 'Kanal' : 'Zauberzeit', s.channel ? sec(s.channel) : s.castTime ? sec(s.castTime) : s.press || s.fixed ? '—' : 'sofort']);
  stats.push(['Reichweite', s.range ? `${s.range + (stat(id).range ?? 0)} yd` : '—']);
  const dmg = spellValue(id);
  if (dmg) stats.push(['Schaden', `etwa ${dmg}${s.tickDmg ? ' pro Tick' : ''}`]);
  if (s.preview) { const next = s.preview(); stats.push(['Nächster Wurf', SPELLS[next]?.name ?? next]); }
  const rows: string[] = [];
  const active = rune(id);
  if (active) rows.push(`<span class="tRune">Rune · ${active.name}:</span> ${active.desc}`);
  for (const r of runesOf(id) ?? []) if (r.id !== active?.id) rows.push(`<span style="opacity:.55">Rune · ${r.name}: ${r.desc}</span>`);
  for (const [cid, n] of Object.entries<any>(state.cardRanks ?? {})) {
    const c: any = CARDS.find(x => x.id === cid);
    if (n && c && (c.spell === id || c.needs === id)) rows.push(`<span class="tTalent">${c.name} ${n}:</span> ${typeof c.desc === 'function' ? c.desc(1) : c.desc ?? ''}`);
  }
  const rank = rankOf(id), base = BASE_HIT(s);
  return {
    label: label ?? (relic ? 'Relikt' : 'Spell'), title: s.name, icon: ICONS[id], color, relic, border: color,
    right: relic ? 'Relikt' : rank ? `Rang ${rank + 1}` : '',
    sub: [SCHOOL_NAME[school] ?? school, ...(s.tags ?? [])].filter(Boolean).join(' · '),
    stats, short: markWords(s.desc ?? ''), rows,
    flavor: relic ? '[FLAVOR]' : undefined,
    facts: relic ? [] : [['Schaden in diesem Run', runShare(id)]],
    formulas: base ? `Grundschaden ${num(base)} × Rang ${num(stat(id).dmg)} × Stufe/Ausrüstung ${num(dmgMult())} × Mods ${num(modFactor('dmg'))} = ${dmg}` : undefined,
  };
}

export function hideSpellCards() { hideTip(); }
export function attachSpellCard(el: HTMLElement, id: string, label?: string) {
  attachTip(el, () => spellTip(id, label));
}

// Zeile kleiner Spell-Felder mit Icon oder Kurznamen, Hovern zeigt die Karte
export function renderKit(box, ids) {
  box.textContent = '';
  for (const id of ids) {
    if (!id || !SPELLS[id]) continue;
    const el = document.createElement('div');
    el.className = `kitSlot ${SPELLS[id].cls}`;
    if (ICONS[id]) el.style.backgroundImage = `url(${ICONS[id]})`;
    else el.textContent = SPELLS[id].name;
    attachSpellCard(el, id);
    box.appendChild(el);
  }
}
export const currentKit = () => state.slots ?? [];
