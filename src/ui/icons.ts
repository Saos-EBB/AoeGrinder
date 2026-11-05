// Spell-ID → Icon-URL. SVGs aus dem Spell-Viewer (spellIcons.ts, nicht von Hand ändern), Zuordnung über den Anzeigenamen.
// Fehlt ein Icon, steht der erste Buchstabe in der Schulfarbe. Getränke des ?-Magiers laufen über ihren Namen in RANDOM_MAGE.drinks.
import { SPELLS, RANDOM_MAGE } from '../config';
import { SPELL_ICONS, SPELL_ICON_ID } from './spellIcons';
import { COLORS } from './colors';

// Spiel-Namen, die im Viewer anders heißen oder ein Icon mitnutzen
const ALIAS: Record<string, string> = { 'Trinken': 'q_drink', 'Archon-Strahl': 'archon', 'Archon-Explosion': 'archon', 'Archon-Teleport': 'archon' };

// Klammern und Apostrophe mitkodieren: die URL steht ungequotet in url(...) und in style-Attributen
const dataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/[()']/g, c => `%${c.charCodeAt(0).toString(16)}`)}`;
const placeholder = (name: string, color: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect x="1.5" y="1.5" width="61" height="61" rx="9" fill="#1d1b18" stroke="${color}" stroke-width="3"/><text x="32" y="44" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="34" fill="${color}">${[...name][0]?.toUpperCase() ?? '?'}</text></svg>`;

const cache: Record<string, string> = {};
export function iconUrl(id: string): string | undefined {
  if (cache[id]) return cache[id];
  const s = SPELLS[id], name: string | undefined = s?.name ?? RANDOM_MAGE.drinks[id]?.name;
  if (!name) return undefined;   // SPELLS füllt sich erst beim Import von spells/index.ts
  const key = SPELL_ICON_ID[name] ?? ALIAS[name];
  return cache[id] = dataUrl(key ? SPELL_ICONS[key] : placeholder(name, COLORS.school[s?.school ?? s?.cls] ?? COLORS.text));
}

export const ICONS: Record<string, string> = new Proxy({}, { get: (_, id) => typeof id === 'string' ? iconUrl(id) : undefined });
