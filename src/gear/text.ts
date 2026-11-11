// Gear-Texte (ARCH-06): Namen, Werte-Zeilen, Hauptwert, Quelle eines Kosmetik-Looks, Set-Perfektwerte.

import { SPELLS } from '../config';
import { meta, MILESTONES } from '../meta';
import { ROLLS, VALUE_KEY, factor, pct, mainOf, type MainValue } from '../rollTables';
import { ELEMENTS, MAKERS, elementColor } from '../models/weapons/baukasten';
import { t } from '../i18n';
import { fmtInt } from '../ui/fmt';
import { GEAR, KOSMETIK, type Slot, type GearItem } from './data';
import { SETS } from './sets';
import { groupOf, makerOf } from './shown';

export const perfectText = (setId: string, slot: Slot) => { const [k, v] = SETS[setId].perfect[slot]; return t(`gear.perfect.${k}`, { n: Math.round(v * (v < 1 ? 1000 : 10)) / 10 }); };

// Quelle eines Looks fürs Fenster: Set 5/5, Meilenstein (mit Fortschritt, wo es einen Zähler gibt) oder Kosmetik-Box
const MS_PROGRESS: Record<string, () => [number, number]> = { dust10k: () => [meta.stats?.dust ?? 0, MILESTONES.dust10k], kills1k: () => [meta.stats?.kills ?? 0, MILESTONES.kills1k] };
export function kosmetikSource(id: string) {
  const L = KOSMETIK[id];
  if (!L) return '';
  if (L.unlock) return t('hw.lookUnlock', { set: t(`look.magier.${L.unlock}.name`) });
  if (L.ach) {
    const p = MS_PROGRESS[L.ach]?.(), f = (n: number) => fmtInt(Math.floor(n));
    return t('hw.lookMs', { name: t(`ach.ms.${L.ach}`) }) + (p ? ` · ${f(Math.min(p[0], p[1]))}/${f(p[1])}` : '');
  }
  return t('hw.lookBox');
}
export const kosmetikHint = (id: string) => (KOSMETIK[id]?.name.startsWith('look.') ? t(`look.${id}.hint`) : '');

export const valueKey = (g: GearItem) => VALUE_KEY[g.s.value];
// Name folgt der Form an der Figur (Slot × Wertgruppe, wie im Gear-Baukasten), wird nicht gespeichert: alte Teile heißen beim Laden gleich richtig.
// Set-Teile behalten ihre eigenen Namen; ohne Wert (sollte nach cleanGearItem nicht vorkommen) der alte Grundname nach Id
export const gearName = (g: GearItem) => {
  if (g.s.setId) return t(`gear.set.${g.s.setId}.${g.slot}`);
  const group = groupOf(g);
  return group ? t(`gear.form.${g.slot}.${group}`) : t(`gear.base.${g.slot}.${g.id % GEAR.baseNames}`);
};
export const slotName = (slot: string) => t(`gear.slot.${slot}`);
// Werte-Zeilen wie effectLines bei der Waffe: Wert, ggf. Fokus, Element, Hersteller
export function gearRows(g: GearItem): { kind: string; text: string; color?: string }[] {
  const f = factor(g.r) * GEAR.mul, rows = [];
  const k = valueKey(g); rows.push({ kind: 'value', text: `${pct((k === 'cd' ? -1 : 1) * ROLLS.values[k] * f)} ${t(`wval.${k}`)}` });
  if (g.s.focus) rows.push({ kind: 'focus', text: t('wrow.focusText', { name: SPELLS[g.s.focus].name, dmg: pct(ROLLS.focus.dmg * f), radius: pct(ROLLS.focus.radius * f) }) });
  if (g.s.element !== 'none') rows.push({ kind: 'element', text: t('wrow.perHit', { name: ELEMENTS[g.s.element].name, fx: ELEMENTS[g.s.element].fx, pct: pct(ROLLS.procChance * f).slice(1) }), color: elementColor(g.s.element) });
  if (makerOf(g)) rows.push({ kind: 'maker', text: t('gear.makerHalf', { name: MAKERS[g.s.maker].name, trait: MAKERS[g.s.maker].trait }) });
  return rows;
}
export const gearLines = (g: GearItem) => gearRows(g).map(r => r.text);
// Hauptwert als Zahl (wie die Zeile 'value' oben), für ▲/▼ und Sortierung im Charakterfenster
export const gearMainValue = (g: GearItem): MainValue => mainOf(valueKey(g), ROLLS.values[valueKey(g)] * factor(g.r) * GEAR.mul);
