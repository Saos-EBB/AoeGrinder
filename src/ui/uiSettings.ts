// UI-Einstellungen in einem localStorage-Eintrag. Fehlende Felder bekommen die Standardwerte (wie meta.ts).

const STORE = 'frostgrind.ui.v1';

// HUD-Presets und Zahlen-Stile (Mockups H… und N…). Wirkung: Presets ab Phase 6, Zahlen-Stile ab Phase 7
export const HUD_PRESETS: [string, string][] = [
  ['H01', 'Klar'], ['H03', 'WeakAura kompakt'], ['H07', 'WoW Classic'], ['H08', 'ElvUI'],
  ['H09', 'MOBA'], ['H13', 'Doom'], ['H18', 'Gotisch'], ['H19', 'Speedrun'],
];
export const NUM_STYLES: [string, string][] = [
  ['N01', 'Schulfarbe'], ['N02', 'Diablo'], ['N03', 'Pop-Sticker'], ['N04', 'WoW klassisch'],
  ['N07', 'Pixel'], ['N08', 'Neon'], ['N10', 'Doom'],
];

export const UI_DEFAULTS = {
  font: 'standard' as 'standard' | 'fraktur',
  hudPreset: 'H01',
  hudScale: 100,          // % (70–150)
  showCombo: true,        // Combo- und Kill-Anzeige
  numStyle: 'N01',
  numSize: 100,           // % (50–200)
  numMerge: true,         // kleine Treffer zusammenfassen
  healNums: true,
  tooltipsExt: true,      // erweiterte Tooltips
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

// Klassen auf <body>; Module mit eigener Darstellung hören auf das Ereignis 'uisettings'
export function applyUi() {
  document.body.classList.toggle('font-fraktur', uiSettings.font === 'fraktur');
  document.body.classList.toggle('noCombo', !uiSettings.showCombo);
  dispatchEvent(new Event('uisettings'));
}
applyUi();
