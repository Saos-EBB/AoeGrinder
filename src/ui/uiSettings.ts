// UI-Einstellungen in einem localStorage-Eintrag. Fehlende Felder bekommen die Standardwerte (wie meta.ts).

const STORE = 'frostgrind.ui.v1';

export const UI_DEFAULTS = {
  font: 'standard' as 'standard' | 'fraktur',
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

// Schrift: eine Klasse auf <body>, theme.css schaltet damit --font-title um
export function applyUi() {
  document.body.classList.toggle('font-fraktur', uiSettings.font === 'fraktur');
}
applyUi();
