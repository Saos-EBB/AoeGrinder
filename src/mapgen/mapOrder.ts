// Reihenfolge der Themes und Säubern der gespeicherten Liste (aus progress.ts, E10): nur Typ-Imports, damit metaNormalize.ts ohne world/render testbar ist.
import type { ThemeId } from './types';

export const ORDER: ThemeId[] = ['wald', 'wueste', 'kanaele', 'kathedrale', 'hoelle'];

// Gespeicherte Liste säubern: nur bekannte Themes, Wald immer offen
export function cleanMaps(list: unknown): ThemeId[] {
  const ok = Array.isArray(list) ? list.filter((id): id is ThemeId => ORDER.includes(id as ThemeId)) : [];
  return ORDER.filter(id => id === 'wald' || ok.includes(id));
}
