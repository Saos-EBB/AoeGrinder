// Helfer für die HUD-Layouts der Flavors (ui/flavors/<id>.ts → hud). pt() nimmt den Ankerpunkt des Elements in Mockup-Pixeln (1280×720)
// und rechnet ihn in % vom Bildschirm um. Die Elemente sind in --hu gebaut (1 px Mockup), scale = Größe im Mockup / Grundgröße des Elements.

import type { HudElementId, Placement, Anchor } from './layout';
import type { FlavorId } from '../flavors';

export const W = 1280, H = 720, CX = 640;
const FRAC: Record<Anchor, [number, number]> = { tl: [0, 0], t: [0.5, 0], tr: [1, 0], l: [0, 0.5], c: [0.5, 0.5], r: [1, 0.5], bl: [0, 1], b: [0.5, 1], br: [1, 1] };
const r2 = v => Math.round(v * 100) / 100;
export function pt(anchor: Anchor, ax: number, ay: number, scale = 1, variant?: string): Placement {
  const [fx, fy] = FRAC[anchor];
  return { anchor, x: r2((ax - W * fx) / W * 100), y: r2((ay - H * fy) / H * 100), scale: r2(scale), ...(variant ? { variant } : {}) };
}
// Grundgröße der Minimap in hud.css (Zauberplatz 52 und Combo-Zahl 64 stehen nur dort)
export const MAP = 150;

// Handy: Sticks und Tasten liegen unten in den Ecken, das HUD oben. Gilt über jedem Layout, Leben und Mana dort als schlichte Balken // PH
export const MOBILE: Partial<Record<HudElementId, Placement>> = {
  runinfo: { anchor: 't', x: 0, y: 0, scale: 0.8 },
  hp: { anchor: 'tl', x: 1, y: 11, scale: 0.9, variant: '', hidden: false },
  mana: { anchor: 'tl', x: 1, y: 19, scale: 0.9, variant: '', hidden: false },
  cast: { anchor: 'c', x: 0, y: 12, scale: 1 },
  hotbar: { anchor: 'b', x: 0, y: -1, scale: 0.6 },
  buffs: { anchor: 'tl', x: 1, y: 28, scale: 1 },
  relics: { anchor: 'tr', x: -9, y: 11, scale: 0.7 },
  minimap: { anchor: 'tr', x: -1, y: 11, scale: 0.6 },
  combo: { anchor: 'tr', x: -1, y: 30, scale: 0.5 },     // unter der Minimap, über dem Zauberbogen (mobile.ts)
};

// HUD-Teile, die sich einzeln einem anderen Flavor zuordnen lassen (Einstellungen → Interface, uiSettings.hudMix).
// Ein Teil bringt Lage, Variante und Look seiner Elemente aus dem gewählten Flavor mit; Rahmen-Ecken und Bildschirm-Effekte bleiben beim UI-Flavor.
// Elemente, die im Layout aneinander hängen (Leiste mit Kill-Anzeige, XP, Castbar; Karte mit Zeit und linker Spalte), sind ein Teil, sonst überlappen sie.
// Erfolgs-Meldungen (feats) hängen an keinem Teil: ihr Look folgt „Zahlen & Meldungen“, ihre Lage dem UI-Flavor.
export const HUD_PARTS = {
  res: ['hp', 'mana', 'unitframe'],                                                  // Leben & Mana: Kugeln, große Zahlen oder Spielerrahmen
  bar: ['hotbar', 'killmeter', 'xp', 'cast', 'micro'],                               // Zauberleiste mit allem, was an ihr hängt
  map: ['minimap', 'relics', 'timer', 'runinfo', 'buffs', 'tracker', 'compass', 'splits'],   // Karte, Zeit, Effekte, Tracker
  combo: ['combo'],
} satisfies Record<string, HudElementId[]>;
export type HudPart = keyof typeof HUD_PARTS;
export const partOf = (id: HudElementId) => (Object.keys(HUD_PARTS) as HudPart[]).find(k => (HUD_PARTS[k] as HudElementId[]).includes(id));

// Gemischte Layouts: wo ein fremder Teil mit dem UI-Flavor oder einem anderen Teil zusammenstößt, eine feste Ausweich-Lage (nur Lage, Look bleibt).
// mix = Flavor pro Teil, main = UI-Flavor. Gilt nie für einen reinen Flavor; eigene Änderungen (Bearbeiten-Modus) liegen darüber.
// Gefunden per Skript über alle 243 Kombinationen (1920×1080 und 1263×638): Überlappung zwischen Teilen oder mit den Zierrahmen-Ecken (--fg-safe).
type Mix = Record<HudPart, FlavorId> & { main: FlavorId };
export const MIX_FIXES: { when: (m: Mix) => boolean; hud: Partial<Record<HudElementId, Placement>> }[] = [
  // Krypta-Leiste mit Kugeln oder großen Zahlen: unten rechts sitzt schon Mana → Mikro-Menü und Taschen darüber
  { when: m => m.bar === 'krypta' && m.res !== 'krypta', hud: { micro: pt('br', W - 24, H - 170) } },
  // Große Zahlen (Schlachtbank) neben dem breiten Höllenfeste-Panel: die Ecke schöbe sie ins Panel → über die Ecke
  { when: m => m.res === 'schlachtbank' && m.bar === 'hoellenfeste', hud: { hp: pt('bl', 28, H - 132, 1, 'bignum'), mana: pt('br', W - 28, H - 132, 1, 'bignum') } },
  // Linke Spalte der Schlachtbank (Zeit groß, Run-Info, Effekte, Tracker) unter große Höllenfeste-Ecken bzw. den Krypta-Spielerrahmen
  { when: m => m.map === 'schlachtbank' && (m.main === 'hoellenfeste' || m.res === 'krypta'),
    hud: { timer: pt('tl', 24, 132, 40 / 26, 'big'), runinfo: pt('tl', 26, 184, 15 / 14), buffs: pt('tl', 24, 214), tracker: pt('tl', 24, 254) } },
];
