// Freischaltung der Themes für die Weltkarte (map-umbau-2 Phase 2). Reihenfolge Wald → Wüste → Kanäle → Kathedrale → Hölle,
// das nächste Theme wird frei, sobald man im vorherigen Level UNLOCK_LEVEL erreicht (PH). Gespeichert in meta.maps (meta.ts),
// kommt mit in den Spielstand-Code (ui/saveCode.ts). Dev: „alles offen“ (localStorage, nur dieser Browser) oder ?maps=all.

import { player, state } from '../state';
import { KEYS, readRaw, writeRaw } from '../storage';
import { meta, saveMeta } from '../meta';
import { zone } from '../world';
import { t } from '../i18n';
import { THEMES } from './themes';
import type { ThemeId } from './types';

export const ORDER: ThemeId[] = ['wald', 'wueste', 'kanaele', 'kathedrale', 'hoelle'];
export const UNLOCK_LEVEL = 100;   // PH

let devOpen = readRaw(KEYS.devMapsOpen) === '1' || /[?&]maps=all/.test(location.search);
export const devAllMapsUnlocked = () => devOpen;
export function setDevAllMapsUnlocked(on: boolean) { devOpen = on; writeRaw(KEYS.devMapsOpen, on ? '1' : '0'); }

// Gespeicherte Liste säubern: nur bekannte Themes, Wald immer offen
export function cleanMaps(list: unknown): ThemeId[] {
  const ok = Array.isArray(list) ? list.filter((id): id is ThemeId => ORDER.includes(id as ThemeId)) : [];
  return ORDER.filter(id => id === 'wald' || ok.includes(id));
}
meta.maps = cleanMaps(meta.maps);

export const isThemeUnlocked = (id: ThemeId) => devOpen || meta.maps.includes(id);
export const nextTheme = (id: ThemeId) => ORDER[ORDER.indexOf(id) + 1] ?? null;

export function unlockTheme(id: ThemeId) {
  if (meta.maps.includes(id)) return false;
  meta.maps = cleanMaps([...meta.maps, id]);
  saveMeta();
  return true;
}

// Jeden Frame (main.ts), billig: nur wenn Level ≥ UNLOCK_LEVEL auf einer Theme-Map
export function updateMapProgress() {
  const id = zone.theme?.id as ThemeId | undefined;
  if (!id || player.level < UNLOCK_LEVEL) return;
  const next = nextTheme(id);
  if (next && unlockTheme(next)) state.newMob = { text: t('world.unlocked', { name: THEMES[next].name }), at: state.now };
}

// Debug-API für Testskripte: alte Namen als Keys bleiben (E7)
(window as any).__progress = { ORDER, themeOpen: isThemeUnlocked, unlockTheme, setDevMapsOpen: setDevAllMapsUnlocked, get maps() { return meta.maps; } };
