// Werte für das Fenster aus heroWindow.ts: 6 Hauptwerte und „Alle Werte“ in Gruppen, jeder Wert mit Aufschlüsselung Basis + Waffe + Gear + Karten/Relikte.
// Quelle sind nur mods, stat() und die Formeln (formulas.ts), nichts doppelt gerechnet: Für die Aufschlüsselung werden die mods einmal frisch gesetzt
// (resetMods), dann Waffe (applyRunWeapon) und Gear (applyRunGear) angewendet wie beim Run-Start, und danach alles zurückgelegt. Im Run ist der Rest
// bis zum echten Wert Karten/Relikte, im Hauptmenü gibt es den nicht. Fehlt ein Wert im Spiel (z. B. Regeneration beim Seuchenmagier), steht „—“. Werte der Figur: charInfo.ts.

import { state, player } from '../state';
import { CFG, SPELLS, CARDS, mods, resetMods } from '../config';
import { maxHp, maxMana, spirit, dmgMult } from '../formulas';
import { modFactor, modValue } from '../modifiers';
import { mage } from '../models/mage';
import { run } from '../score';
import { SUPPORTS } from '../spells/supports';
import { rune } from '../spells/core';
import { takenMul, moveMul } from '../realMen';
import { DG } from '../dodge';
import { meterSchool, meterDmgMul, meterValue } from '../schoolMeter';
import { ROLLS, equipped, factor, applyRunWeapon, weaponName } from '../weaponRolls';
import { applyRunGear, fullSet, worn, SLOTS, GEAR, isMagierSkin } from '../gear';
import { ELEMENTS, elementColor } from '../models/weapons/baukasten';
import { fmtInt } from './dmgNumbers';
import { t, fmtNum } from '../i18n';

export type StatRow = { id: string; label: string; value: string; color?: string; small?: string; parts?: [string, string][] };
export type StatGroup = { id: string; name: string; rows: StatRow[] };

type Snap = Record<string, any>;
const DASH = '—';
const de1 = (v: number) => fmtNum(Math.round(v * 10) / 10, 1);
const pctAbs = (v: number) => `${de1(v * 100)} %`;
const pctSigned = (v: number) => `${v < 0 ? '−' : '+'}${de1(Math.abs(v) * 100)} %`;
const intSigned = (v: number) => `${v < 0 ? '−' : '+'}${fmtInt(Math.abs(v))}`;

// Formel mit diesen mods auswerten (echte Funktionen aus formulas.ts), danach die echten mods zurück
function withMods<T>(snap: Snap, fn: () => T): T {
  const keep = { ...mods };
  for (const k of Object.keys(mods)) delete mods[k];
  Object.assign(mods, snap);
  try { return fn(); } finally { for (const k of Object.keys(mods)) delete mods[k]; Object.assign(mods, keep); }
}
// mods nach Basis, nach Waffe und nach Gear. Alles, was der Run-Start dabei anfasst, wird zurückgelegt. Schlägt etwas fehl: keine Aufschlüsselung
const STATE_KEYS = ['poolExtra', 'runWeapon', 'weaponHit', 'bonusCharges', 'weaponAura', 'gearSet', 'spellStats'];
function layers(): { base: Snap; weapon: Snap; gear: Snap } | null {
  const keepMods = { ...mods }, keepState = Object.fromEntries(STATE_KEYS.map(k => [k, state[k]]));
  try {
    state.spellStats = structuredClone(state.spellStats ?? {});
    state.poolExtra = [];
    resetMods();
    const base = { ...mods };
    applyRunWeapon(!!mage.weapon);
    const weapon = { ...mods };
    applyRunGear(mage.skin);
    return { base, weapon, gear: { ...mods } };
  } catch {
    return null;
  } finally {
    for (const k of Object.keys(mods)) delete mods[k];
    Object.assign(mods, keepMods);
    Object.assign(state, keepState);
  }
}

// Ein Wert aus den mods: v rechnet, fmt zeigt den Wert, dfmt einen Anteil (Differenz zweier Stufen)
type Def = { id: string; label: () => string; v: () => number; fmt: (v: number) => string; dfmt: (d: number) => string; show?: () => boolean };
const DEFS: Record<string, Def> = {
  dmg: { id: 'dmg', label: () => t('stat.dmg'), v: () => dmgMult() * modFactor('dmg'), fmt: v => `${fmtInt(v * 100)} %`, dfmt: pctSigned },
  crit: { id: 'crit', label: () => t('hw.st.crit'), v: () => (modValue('baseCrit') ?? CFG.baseCrit) + mods.crit, fmt: pctAbs, dfmt: pctSigned },
  critDmg: { id: 'critDmg', label: () => t('hw.st.critDmg'), v: () => 1 + CFG.critBonus, fmt: v => `${fmtInt(v * 100)} %`, dfmt: pctSigned },
  cd: { id: 'cd', label: () => t('hw.st.cd'), v: () => mods.cdMul - 1, fmt: pctSigned, dfmt: pctSigned },
  cast: { id: 'cast', label: () => t('hw.st.cast'), v: () => 1 / mods.castMul - 1, fmt: pctSigned, dfmt: pctSigned },
  radius: { id: 'radius', label: () => t('hw.st.radius'), v: () => mods.radius - 1, fmt: pctSigned, dfmt: pctSigned },
  dur: { id: 'dur', label: () => t('hw.st.dur'), v: () => mods.durMul - 1, fmt: pctSigned, dfmt: pctSigned },
  proj: { id: 'proj', label: () => t('hw.st.proj'), v: () => mods.fbExtra ?? 0, fmt: v => `+${fmtInt(v)}`, dfmt: intSigned },
  hp: { id: 'hp', label: () => t('cw.life'), v: () => maxHp(), fmt: fmtInt, dfmt: intSigned },
  // Leben-Regeneration aus player.ts regenerate(): CFG.hpRegen vom max. Leben je Tick (CFG.regenTick), nur außer Kampf; Seuchenmagier gar nicht
  regen: { id: 'regen', label: () => t('hw.st.regen'), v: () => maxHp() * CFG.hpRegen / (CFG.regenTick / 1000), fmt: v => `${de1(v)}/s`, dfmt: v => `${v < 0 ? '−' : '+'}${de1(Math.abs(v))}/s`,
    show: () => !modValue('lifeCost') },
  dr: { id: 'dr', label: () => t('hw.st.dr'), v: () => 1 - takenMul(), fmt: pctAbs, dfmt: pctSigned },
  dodge: { id: 'dodge', label: () => t('hw.st.dodge'), v: () => DG.charges + (mods.dodgeCharges ?? 0), fmt: fmtInt, dfmt: intSigned },
  speed: { id: 'speed', label: () => t('cw.speed'), v: () => CFG.runSpeed * (mods.moveMul ?? 1) * moveMul(), fmt: v => `${de1(v)} yd/s`, dfmt: v => `${v < 0 ? '−' : '+'}${de1(Math.abs(v))} yd/s` },
  mana: { id: 'mana', label: () => player.rageMax ? t('res.rage') : 'Mana', v: () => maxMana(), fmt: fmtInt, dfmt: intSigned },
  manaS: { id: 'manaS', label: () => t('hw.st.manaS'), v: () => (spirit() / 4 + 12.5) / (CFG.regenTick / 1000), fmt: v => `${de1(v)}/s`, dfmt: v => `${v < 0 ? '−' : '+'}${de1(Math.abs(v))}/s`,
    show: () => !player.rageMax && !modValue('lifeCost') },
  regenCombat: { id: 'regenCombat', label: () => t('hw.st.regenCombat'), v: () => mods.castRegen, fmt: pctAbs, dfmt: pctSigned, show: () => !player.rageMax },
  cost: { id: 'cost', label: () => t('hw.st.cost'), v: () => 1 - mods.manaCostMul * modFactor('manaCost'), fmt: pctAbs, dfmt: pctSigned },
};
export const MAIN = ['dmg', 'crit', 'cd', 'radius', 'hp', 'mana'];

// Zeile mit Aufschlüsselung. L = Stufen (oder null), cur = mods, wie sie gerade gelten (Run) bzw. nach Gear (Hauptmenü)
function statRow(def: Def, L: ReturnType<typeof layers>, live: boolean): StatRow {
  if (def.show && !def.show()) return { id: def.id, label: def.label(), value: DASH };
  if (!L) return { id: def.id, label: def.label(), value: def.fmt(def.v()) };
  const at = (s: Snap) => withMods(s, def.v);
  const b = at(L.base), w = at(L.weapon), g = at(L.gear), cur = live ? def.v() : g;
  const parts: [string, string][] = [[t('hw.br.base'), def.fmt(b)], [t('hw.br.weapon'), def.dfmt(w - b)], [t('hw.br.gear'), def.dfmt(g - w)]];
  parts.push([t('hw.br.cards'), live ? def.dfmt(cur - g) : DASH]);
  for (const p of parts) if (p[1] === '+0' || p[1] === '+0 %' || p[1] === '−0 %' || p[1] === '+0 yd/s' || p[1] === '+0/s') p[1] = '±0';
  return { id: def.id, label: def.label(), value: def.fmt(cur), parts };
}

// Element: Anteil der Treffer mit Element-Effekt, aus Waffe und Gear (wie applyRunWeapon / applyRunGear). 5/5-Set: Gear ohne eigene Procs
function elementRows(live: boolean): StatRow[] {
  const w = equipped(), set = fullSet(mage.skin), mag = isMagierSkin(mage.skin);
  const fromW: Record<string, number> = {}, fromG: Record<string, number> = {};
  if (mag && w?.v === 2 && w.s.element !== 'none') fromW[w.s.element] = ROLLS.procChance * factor(w.r);
  if (mag && !set) for (const s of SLOTS) { const g = worn(s); if (g && g.s.element !== 'none') fromG[g.s.element] = (fromG[g.s.element] ?? 0) + ROLLS.procChance * factor(g.r) * GEAR.mul; }
  const rows: StatRow[] = Object.keys(ELEMENTS).filter(k => k !== 'none').map(k => {
    const a = fromW[k] ?? 0, b = fromG[k] ?? 0;
    return { id: `el.${k}`, label: t('hw.st.elProc', { el: ELEMENTS[k].name }), color: elementColor(k), value: a + b ? pctAbs(a + b) : DASH,
      parts: a + b ? [[t('hw.br.weapon'), a ? pctSigned(a) : '±0'], [t('hw.br.gear'), b ? pctSigned(b) : '±0']] : undefined };
  });
  const has = (k: string) => !!(fromW[k] || fromG[k]), E = ROLLS.element;
  rows.push({ id: 'slow', label: t('hw.st.slow'), value: has('frost') ? t('hw.st.slowVal', { pct: pctAbs(E.slow), s: de1(E.slowMs / 1000) }) : DASH });
  rows.push({ id: 'burn', label: t('hw.st.burn'), value: has('feuer') ? t('hw.st.burnVal', { pct: pctAbs(E.burn), n: E.burnTicks }) : DASH });
  rows.push({ id: 'poison', label: t('hw.st.poison'), value: has('seuche') ? t('hw.st.poisonVal', { n: E.infectStacks }) : DASH });
  const school = live ? meterSchool() : null;
  rows.push({ id: 'meter', label: t('hw.st.meter'), value: school === 'Feuer' ? pctSigned(meterDmgMul() - 1) : school === 'Frost' ? pctAbs(meterValue()) : DASH });
  return rows;
}

// Schaden in diesem Run nach Quelle: ganze Zahlen mit Tausenderpunkt, Anteil klein daneben
function dmgRows(live: boolean): StatRow[] {
  const list = live ? Object.entries<number>(run.dmgBySource ?? {}).sort((a, b) => b[1] - a[1]) : [];
  const total = list.reduce((s, [, v]) => s + v, 0);
  if (!total) return [{ id: 'dmgTotal', label: t('hw.st.dmgTotal'), value: DASH }];
  return [{ id: 'dmgTotal', label: t('hw.st.dmgTotal'), value: fmtInt(total) },
    ...list.slice(0, 8).map(([id, v]) => ({ id: `src.${id}`, label: SPELLS[id]?.name ?? t('cw.env'), value: fmtInt(v), small: `${fmtInt(v / total * 100)} %` })),
    { id: 'dps', label: t('cw.dps'), value: state.now > 1000 ? fmtInt(total / (state.now / 1000)) : DASH }];
}

// Build im Run: Spells mit Rang und Rune, Talente, Supports, Relikte, Waffe
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = (n: number) => ROMAN[n] ?? String(n);
const rankOf = (id: string) => Object.entries<any>(state.cardPicks ?? {}).reduce((n, [cid, k]) => cid.startsWith(`${id}-`) ? n + k : n, 0);
function buildRows(): StatRow[] {
  const rows: StatRow[] = [];
  for (const id of (state.slots ?? []).filter(Boolean)) {
    const def = SPELLS[id];
    if (!def) continue;
    if (def.relic) { rows.push({ id: `relic.${id}`, label: t('cw.relic'), value: def.name }); continue; }
    const r = rune(id);
    rows.push({ id: `spell.${id}`, label: def.name, value: `${t('cw.rank', { n: roman(rankOf(id) + 1) })}${r ? ` · ${r.name}` : ''}` });
  }
  for (const [id, n] of Object.entries<any>(state.cardRanks ?? {})) if (n) rows.push({ id: `tal.${id}`, label: CARDS.find(c => c.id === id)?.name ?? id, value: t('cw.stage', { n: roman(n) }) });
  for (const id of Object.keys(state.supports ?? {})) rows.push({ id: `sup.${id}`, label: SUPPORTS.find(x => x.id === id)?.name ?? id, value: t('cardui.kindName.support') });
  const w = equipped();
  rows.push({ id: 'weapon', label: t('cw.weapon'), value: w && mage.weapon ? weaponName(w) : DASH });
  return rows;
}

// Regeneration: dazu die Regel aus der Config, z. B. „3 % / 2 s außer Kampf“
const regenRow = (r: StatRow): StatRow => r.value === DASH ? r : { ...r, small: t('hw.st.regenRule', { p: fmtNum(CFG.hpRegen * 100), s: fmtNum(CFG.regenTick / 1000), c: fmtNum(CFG.hpRegenCalm / 1000) }) };

// Alles auf einmal (je Öffnen bzw. Neuzeichnen einmal gerechnet)
export function heroStats(live: boolean): { main: StatRow[]; groups: StatGroup[] } {
  const L = layers(), row = (id: string) => statRow(DEFS[id], L, live);
  const groups: StatGroup[] = [
    { id: 'atk', name: t('hw.g.atk'), rows: ['dmg', 'crit', 'critDmg', 'cd', 'cast', 'radius', 'proj', 'dur'].map(row) },
    { id: 'def', name: t('hw.g.def'), rows: [row('hp'), regenRow(row('regen')), row('dr'), row('dodge'), row('speed')] },
    { id: 'res', name: t('hw.g.res'), rows: ['mana', 'manaS', 'regenCombat', 'cost'].map(row) },
    { id: 'el', name: t('hw.g.el'), rows: elementRows(live) },
    { id: 'dmgRun', name: t('cw.dmgTitle'), rows: dmgRows(live) },
  ];
  if (live) groups.push({ id: 'build', name: t('cw.tab.build'), rows: buildRows() });
  return { main: MAIN.map(row), groups };
}
