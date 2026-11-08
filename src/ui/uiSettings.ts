// UI-Einstellungen in einem localStorage-Eintrag. Fehlende Felder bekommen die Standardwerte (wie meta.ts).
import { t } from '../i18n';

const STORE = 'frostgrind.ui.v1';

// HUD-Presets und Zahlen-Stile (Mockups H… und N…). Wirkung: Presets ab Phase 6, Zahlen-Stile ab Phase 7
export const HUD_PRESETS: [string, string][] = [
  ['H01', t('preset.H01')], ['H03', 'WeakAura kompakt'], ['H07', 'WoW Classic'], ['H08', 'ElvUI'],
  ['H09', 'MOBA'], ['H13', 'Doom'], ['H18', t('preset.H18')], ['H19', 'Speedrun'],
];
export const NUM_STYLES: [string, string][] = [
  ['N01', t('preset.N01')], ['N02', 'Diablo'], ['N03', t('preset.N03')], ['N04', t('preset.N04')],
  ['N07', 'Pixel'], ['N08', 'Neon'], ['N10', 'Doom'],
];

export const UI_DEFAULTS = {
  font: 'standard' as 'standard' | 'fraktur',
  hudPreset: 'H01',
  hudOverrides: {} as Record<string, Record<string, any>>,   // eigene Lage pro Preset (ui/hud/layout.ts)
  hudScale: 100,          // % (70–150)
  showCombo: true,        // Combo- und Kill-Anzeige
  numStyle: 'N01',
  numSize: 100,           // % (50–200)
  numFont: '',            // eigene Zahlen-Schrift (ui/numFonts.ts), leer = Schrift des Zahlen-Stils
  numMerge: true,         // kleine Treffer zusammenfassen
  healNums: true,
  tooltipsExt: true,      // erweiterte Tooltips
  devPanel: { x: 12, y: 60, w: 440, h: 620, ghost: false, fold: false },   // Dev-Fenster in px
  profiles: [null, null, null, null] as ({ at: string; data: Record<string, any> } | null)[],   // 4 eigene UI-Stände
};
export type UiSettings = typeof UI_DEFAULTS;

function load(): UiSettings {
  try { return { ...UI_DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return { ...UI_DEFAULTS }; }
}
export const uiSettings = load();

export function setUi<K extends keyof UiSettings>(key: K, value: UiSettings[K]) {
  uiSettings[key] = value;
  try { localStorage.setItem(STORE, JSON.stringify(uiSettings)); } catch { /* kein Storage */ }
  applyUi();
}

// Eigene UI-Stände: alles außer Dev-Fenster und den Plätzen selbst
const NOT_IN_PROFILE = ['devPanel', 'profiles'];
export function saveProfile(i: number) {
  const data = Object.fromEntries(Object.entries(structuredClone(uiSettings)).filter(([k]) => !NOT_IN_PROFILE.includes(k)));
  const list = [...uiSettings.profiles];
  list[i] = { at: new Date().toISOString(), data };
  setUi('profiles', list);
}
export function loadProfile(i: number) {
  const p = uiSettings.profiles[i];
  if (!p) return false;
  Object.assign(uiSettings, { ...UI_DEFAULTS, ...structuredClone(p.data), devPanel: uiSettings.devPanel, profiles: uiSettings.profiles });
  try { localStorage.setItem(STORE, JSON.stringify(uiSettings)); } catch { /* kein Storage */ }
  applyUi();
  return true;
}

// Klassen auf <body>; Module mit eigener Darstellung hören auf das Ereignis 'uisettings'
export function applyUi() {
  document.body.classList.toggle('font-fraktur', uiSettings.font === 'fraktur');
  document.body.classList.toggle('noCombo', !uiSettings.showCombo);
  dispatchEvent(new Event('uisettings'));
}
applyUi();
