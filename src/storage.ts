// Alle Speicher-Keys im localStorage und der Zugriff darauf. Eigenes Modul ohne Imports (wie device.ts), damit es nirgends zirkulär wird.
// Die Werte sind gespeicherte Spielerdaten: NIE umbenennen, sonst ist der Stand weg. Regel für neue Keys: frostgrind.<bereich>.v1, Kleinbuchstaben.
// Lesen und Schreiben dürfen fehlschlagen (privater Modus, Storage voll oder gesperrt): Lesen gibt dann den Fallback, Schreiben gibt false
// und warnt einmal pro Sitzung in der Konsole.

export const KEYS = {
  meta: 'frostgrind.meta.v1',                 // Spielstand (meta.ts)
  metaBackup: 'frostgrind.meta.v1.backup-',   // Präfix: Sicherung eines unlesbaren Spielstands, + ISO-Zeit (meta.ts)
  ui: 'frostgrind.ui.v1',                     // UI-Einstellungen (ui/uiSettings.ts)
  runs: 'frostgrind.runs.v1',                 // Rangliste, nur über leaderboard.ts loadRuns/saveRuns
  splits: 'frostgrind.splits.v1',             // Bestzeiten pro Split (leaderboard.ts)
  binds: 'frostgrind.binds.v1',               // Tastenbelegung (input.ts)
  bindsMelee: 'frostgrind.binds.klinge.v1',   // Tastenbelegung Krieger; Name vom geparkten Klingenstrich, bleibt (input.ts)
  padBinds: 'frostgrind.padbinds.v1',         // Controller-Belegung (gamepad.ts)
  autoCam: 'frostgrind.autocam.v1',           // '1' / '0' (camera.ts)
  shake: 'frostgrind.shake.v1',               // Bildschirmwackeln (wucht.ts)
  volume: 'frostgrind.volume.v1',             // Lautstärke 0–1 (fx/sound.ts)
  mobileZoom: 'frostgrind.mobilezoom.v1',     // Kameraabstand am Handy (mobile.ts)
  hotbar: 'frostgrind.hotbar',                // Reihenfolge und Modi der Leiste pro Figur (hotbar.ts)
  lang: 'frostgrind.lang',                    // 'de' / 'en' (i18n/index.ts)
  warWeapon: 'frostgrind.warWeapon',          // gewählte Krieger-Waffe (models/heroModel.ts)
  warLegendary: 'frostgrind.warLegendary',    // gewählte Krieger-Legende (realMen.ts)
  devMapsOpen: 'frostgrind.dev.mapsOpen',     // Dev: alle Maps offen, '1' / '0' (mapgen/progress.ts)
} as const;
export type StoreKey = (typeof KEYS)[keyof typeof KEYS];

// Schema-Version des Spielstands (KEYS.meta, Feld schema; ARCH-08 Schritt 4). Fehlt = 0 (Stand vor E8). normalizeMeta (metaNormalize.ts) setzt sie
// nach dem Säubern. Eine spätere Migration erhöht META_SCHEMA und läuft in normalizeMeta nur, wenn metaSchemaOf(stand) kleiner ist.
// 1 = Stand von E8 (alles, was das Säubern seit v1 repariert). Ein Stand mit höherer Zahl (neuere Version) behält seine Zahl.
export const META_SCHEMA = 1;
export const metaSchemaOf = (m: unknown): number => { const v = (m as { schema?: unknown } | null)?.schema; return Number.isInteger(v) && (v as number) >= 0 ? v as number : 0; };

let warned = false;
const warnOnce = (key: string, e: unknown) => { if (warned) return; warned = true; console.warn(`[storage] Speichern fehlgeschlagen (${key}), weitere Fehler still`, e); };

// Rohtext oder null (fehlt oder kein Storage)
export function readRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writeRaw(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch (e) { warnOnce(key, e); return false; }
}
export function remove(key: string) {
  try { localStorage.removeItem(key); } catch { /* kein Storage */ }
}
// Alle Keys mit diesem Präfix, sortiert
export function keysWith(prefix: string): string[] {
  try { return Object.keys(localStorage).filter(k => k.startsWith(prefix)).sort(); } catch { return []; }
}
// JSON lesen: fehlt, leer, kein Storage oder kein JSON → fallback. Sonst der Wert, wie er ist (Form prüft der Aufrufer)
export function read<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
export function write(key: string, value: unknown): boolean {
  try { return writeRaw(key, JSON.stringify(value)); } catch (e) { warnOnce(key, e); return false; }
}
