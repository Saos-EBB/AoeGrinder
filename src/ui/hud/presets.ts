// HUD-Grundlayout bis zu den Flavor-Layouts (UI-Mix Phase 4). pt() nimmt den Ankerpunkt des Elements in Mockup-Pixeln (1280×720)
// und rechnet ihn in % vom Bildschirm um. Die Elemente sind in --hu gebaut (1 px Mockup), scale = Größe im Mockup / Grundgröße des Elements.

import type { HudLayout, HudElementId, Placement, Anchor } from './layout';

const W = 1280, H = 720, CX = 640;
const FRAC: Record<Anchor, [number, number]> = { tl: [0, 0], t: [0.5, 0], tr: [1, 0], l: [0, 0.5], c: [0.5, 0.5], r: [1, 0.5], bl: [0, 1], b: [0.5, 1], br: [1, 1] };
const r2 = v => Math.round(v * 100) / 100;
export function pt(anchor: Anchor, ax: number, ay: number, scale = 1, variant?: string): Placement {
  const [fx, fy] = FRAC[anchor];
  return { anchor, x: r2((ax - W * fx) / W * 100), y: r2((ay - H * fy) / H * 100), scale: r2(scale), ...(variant ? { variant } : {}) };
}
// Grundgrößen der Elemente in hud.css: Zauberplatz 52, Minimap 150, Combo-Zahl 64
export const SLOT = 52, MAP = 150, COMBO = 64;

export const DEFAULT_LAYOUT: HudLayout = { id: 'standard', elements: {
  runinfo: pt('t', CX, 40),
  timer: pt('t', CX, 8, 24 / 26),
  xp: pt('t', CX, H - 8),
  minimap: pt('tr', W - 20, 20, 156 / MAP, 'circle'),
  relics: pt('tr', W - 52, 210),
  buffs: pt('tl', 20, 20),
  tracker: pt('tl', 20, 60),
  combo: pt('tr', W - 30, 320, 60 / COMBO),
  hp: pt('c', CX - 76.5, 448, 1),
  mana: pt('c', CX + 76.5, 448, 1),
  cast: pt('t', CX, 462),
  killmeter: pt('t', CX, 600),
  hotbar: pt('b', CX, 682, 56 / SLOT),
  compass: { ...pt('t', CX, 10, 520 / 600), hidden: true },
  splits: { ...pt('tr', W - 20, 262), hidden: true },
} };

// Handy: Sticks und Tasten liegen unten in den Ecken, das HUD oben. Gilt über jedem Layout // PH
export const MOBILE: Partial<Record<HudElementId, Placement>> = {
  runinfo: { anchor: 't', x: 0, y: 0, scale: 0.8 },
  hp: { anchor: 'tl', x: 1, y: 11, scale: 0.9 },
  mana: { anchor: 'tl', x: 1, y: 19, scale: 0.9 },
  cast: { anchor: 'c', x: 0, y: 12, scale: 1 },
  hotbar: { anchor: 'b', x: 0, y: -1, scale: 0.6 },
  buffs: { anchor: 'tl', x: 1, y: 28, scale: 1 },
  relics: { anchor: 'tr', x: -9, y: 11, scale: 0.7 },
  minimap: { anchor: 'tr', x: -1, y: 11, scale: 0.6 },
  combo: { anchor: 'tr', x: -1, y: 30, scale: 0.5 },     // unter der Minimap, über dem Zauberbogen (mobile.ts)
};
