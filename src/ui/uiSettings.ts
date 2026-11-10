// UI-Einstellungen in einem localStorage-Eintrag. Fehlende Felder bekommen die Standardwerte (wie meta.ts),
// unbekannte Felder (alte HUD-Presets, Zahlen-Stile, Zahlen-Schriften) werden beim Laden verworfen.

const STORE = 'frostgrind.ui.v1';

export const UI_DEFAULTS = {
  flavor: 'hoellenfeste',  // UI-Flavor (ui/flavors): hoellenfeste, schlachtbank, krypta
  screenFx: true,         // Bildschirm-Effekte des Flavors
  font: 'standard' as 'standard' | 'fraktur',
  menuZone: '',
  menuPan: true,          // langsamer Kameraschwenk in der Charakterwahl (ui/mainMenu.ts)
  weaponFilter: {} as Record<string, any>,   // Filter im Waffen-Tab des Fensters heroWindow.ts, fehlende Felder = Standard
  heroAll: false,
  heroTab: 'waffen',
  heroView: 'grid' as 'grid' | 'tree',   // Fenster heroWindow.ts: Raster oder Baum
  heroOpen: ['waffen'] as string[],       // offene Ordner im Baum      // Fenster heroWindow.ts: zuletzt gewählter Tab
  gearFilter: {} as Record<string, any>,   // Filter für Gear-Tabs im Fenster heroWindow.ts, fehlende Felder = Standard
  gearSeen: 0,            // höchste Gear-ID beim letzten Schließen: alles darüber ist NEU         // Fenster heroWindow.ts: „Alle Werte“ aufgeklappt
  weaponSeen: 0,          // höchste Waffen-ID beim letzten Schließen des Fensters heroWindow.ts: alles darüber ist NEU           // zuletzt gewählte Map im Hauptmenü (zones.ts), leer = Tirisfal
  hudOverrides: {} as Record<string, Record<string, any>>,   // eigene Lage pro Layout (ui/hud/layout.ts)
  hudScale: 100,          // % (70–150)
  brightness: 50,         // Helligkeit der Szene in % (0–100, 0 = dunkelster Look), dunkel.ts
  numFlavor: 'flavor',    // Zahlen & Meldungen: 'flavor' = wie der UI-Flavor, sonst eine Flavor-ID
  messages: true,         // Erfolgs-Meldungen (ui/messages.ts)
  numSize: 100,           // % (50–200)
  numMerge: true,         // kleine Treffer zusammenfassen
  healNums: true,
  tooltipsExt: true,      // erweiterte Tooltips
  devPanel: { x: 12, y: 60, w: 440, h: 620, ghost: false, fold: false },   // Dev-Fenster in px
  profiles: [null, null, null, null] as ({ at: string; data: Record<string, any> } | null)[],   // 4 eigene UI-Stände
};
export type UiSettings = typeof UI_DEFAULTS;

// Nur bekannte Felder übernehmen; alte Overrides hingen an Preset-IDs (H01 …) und gelten nicht mehr
const OLD_LAYOUT = /^H\d\d(@mobile)?$/;
function clean(raw: Record<string, any>): Partial<UiSettings> {
  const out = Object.fromEntries(Object.entries(raw ?? {}).filter(([k]) => k in UI_DEFAULTS)) as Partial<UiSettings>;
  if (out.hudOverrides) out.hudOverrides = Object.fromEntries(Object.entries(out.hudOverrides).filter(([k]) => !OLD_LAYOUT.test(k)));
  return out;
}
function load(): UiSettings {
  try { return { ...UI_DEFAULTS, ...clean(JSON.parse(localStorage.getItem(STORE) || '{}')) }; } catch { return { ...UI_DEFAULTS }; }
}
export const uiSettings = load();
uiSettings.profiles = uiSettings.profiles.map(p => p && { ...p, data: clean(p.data) });
try { localStorage.setItem(STORE, JSON.stringify(uiSettings)); } catch { /* kein Storage */ }

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
  Object.assign(uiSettings, { ...UI_DEFAULTS, ...structuredClone(clean(p.data)), devPanel: uiSettings.devPanel, profiles: uiSettings.profiles });
  try { localStorage.setItem(STORE, JSON.stringify(uiSettings)); } catch { /* kein Storage */ }
  applyUi();
  return true;
}

// Klassen auf <body>; Module mit eigener Darstellung hören auf das Ereignis 'uisettings'
export function applyUi() {
  document.body.classList.toggle('font-fraktur', uiSettings.font === 'fraktur');
  dispatchEvent(new Event('uisettings'));
}
applyUi();
