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
import { t, fmtNum } from '../i18n';

const RELIC_GOLD = '#e3c27a';
// cls 'nature' sind die Seuche-Spells (spells/plague.ts): Anzeige „Seuche“, die ID selbst bleibt vorerst
const SCHOOL_NAME = Object.fromEntries(['frost', 'fire', 'arcane', 'lightning', 'nature', 'shadow', 'blood', 'bone', 'util', 'warrior'].map(k => [k, t(`school.${k === 'nature' ? 'plague' : k}`)]));
const BASE_HIT = s => s.tickDmg ?? (s.min ? (s.min + s.max) / 2 : s.dmg ?? s.pulse ?? s.showDmg);
const num = (v: number) => fmtNum(Math.round(v * 100) / 100);
const sec = ms => `${fmtNum(Math.round(ms / 10) / 100)} s`;
const unit = id => paysLife(id) ? t('cost.life') : batteryMode() ? t('res.charge') : player.rageMax === 1 ? '' : player.rageMax ? t('res.rage') : t('cost.mana');

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
  stats.push([t('sc.cost'), cost > 0 && u ? `${cost} ${u}` : '—']);
  const cd = spellCd(id);
  stats.push([t('sc.cd'), cd > 0 ? sec(cd) : '—']);
  stats.push([t(s.channel ? 'sc.channel' : 'sc.cast'), s.channel ? sec(s.channel) : s.castTime ? sec(s.castTime) : s.press || s.fixed ? '—' : t('sc.instant')]);
  stats.push([t('sc.range'), s.range ? `${s.range + (stat(id).range ?? 0)} yd` : '—']);
  const dmg = spellValue(id);
  if (dmg) stats.push([t('sc.dmg'), t('sc.dmgAbout', { n: dmg, unit: s.tickDmg ? t('cardui.perTick') : '' })]);
  if (s.preview) { const next = s.preview(); stats.push([t('sc.next'), SPELLS[next]?.name ?? next]); }
  const rows: string[] = [];
  const active = rune(id);
  if (active) rows.push(`<span class="tRune">${t('sc.rune', { name: active.name })}</span> ${active.desc}`);
  for (const r of runesOf(id) ?? []) if (r.id !== active?.id) rows.push(`<span style="opacity:.55">${t('sc.runeOther', { name: r.name, desc: r.desc })}</span>`);
  for (const [cid, n] of Object.entries<any>(state.cardRanks ?? {})) {
    const c: any = CARDS.find(x => x.id === cid);
    if (n && c && (c.spell === id || c.needs === id)) rows.push(`<span class="tTalent">${c.name} ${n}:</span> ${typeof c.desc === 'function' ? c.desc(1) : c.desc ?? ''}`);
  }
  const rank = rankOf(id), base = BASE_HIT(s);
  return {
    label: label ?? t(relic ? 'cardui.relic' : 'sc.spell'), title: s.name, icon: ICONS[id], color, relic, border: color,
    right: relic ? t('cardui.relic') : rank ? t('sc.rank', { n: rank + 1 }) : '',
    sub: [SCHOOL_NAME[school] ?? school, ...(s.tags ?? []).map(x => t(`tag.${x}`))].filter(Boolean).join(' · '),
    stats, short: markWords(s.desc ?? ''), rows,
    flavor: relic ? '[FLAVOR]' : undefined,
    facts: relic ? [] : [[t('sc.runShare'), runShare(id)]],
    formulas: base ? t('sc.formula', { a: num(base), b: num(stat(id).dmg), c: num(dmgMult()), d: num(modFactor('dmg')), e: dmg }) : undefined,
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
