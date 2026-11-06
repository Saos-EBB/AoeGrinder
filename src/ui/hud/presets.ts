// HUD-Presets: Lage jedes Elements (Mockups H01 … H19, Layout-Funktionen in gen.py). Elemente ohne Eintrag sind im Preset aus.
// pt() nimmt den Ankerpunkt des Elements in Mockup-Pixeln (1280×720) und rechnet ihn in % vom Bildschirm um.
// Die Elemente sind in --hu gebaut (1 px Mockup), scale = Größe im Mockup / Grundgröße des Elements.

import type { HudPreset, HudElementId, Placement, Anchor } from './layout';

const W = 1280, H = 720, CX = 640, CY = 360;
const FRAC: Record<Anchor, [number, number]> = { tl: [0, 0], t: [0.5, 0], tr: [1, 0], l: [0, 0.5], c: [0.5, 0.5], r: [1, 0.5], bl: [0, 1], b: [0.5, 1], br: [1, 1] };
const r2 = v => Math.round(v * 100) / 100;
function pt(anchor: Anchor, ax: number, ay: number, scale = 1, variant?: string): Placement {
  const [fx, fy] = FRAC[anchor];
  return { anchor, x: r2((ax - W * fx) / W * 100), y: r2((ay - H * fy) / H * 100), scale: r2(scale), ...(variant ? { variant } : {}) };
}
// Grundgrößen der Elemente in hud.css: Zauberplatz 52, Minimap 150, Combo-Zahl 64, Kompass 600, Kill-Leiste 420, Kugel 132
const SLOT = 52, MAP = 150, COMBO = 64;

export const PRESETS: HudPreset[] = [
  { id: 'H01', name: 'Klar', theme: 'clean', elements: {
    runinfo: pt('t', CX, 0, 1, 'bar'),
    timer: pt('t', CX, 4, 24 / 26),
    xp: pt('t', CX, 46, 1, 'full'),
    minimap: pt('tr', W - 20, 64, 156 / MAP, 'circle'),
    relics: pt('tr', W - 52, 260),
    buffs: pt('tl', 20, 64),
    tracker: pt('tl', 20, 104),
    combo: pt('tr', W - 30, 320, 60 / COMBO),
    hp: pt('c', CX - 76.5, 448, 1, 'bars-side'),
    mana: pt('c', CX + 76.5, 448, 1, 'bars-side'),
    cast: pt('t', CX, 462),
    killmeter: pt('t', CX, 600),
    hotbar: pt('b', CX, 682, 56 / SLOT, 'row'),
  } },
  { id: 'H03', name: 'WeakAura kompakt', theme: 'wa', elements: {
    minimap: pt('tr', W - 16, 16, 180 / MAP, 'square'),
    timer: pt('tr', W - 206, 22, 24 / 26),
    runinfo: pt('tr', W - 206, 50),
    hp: pt('t', CX, 420, 1, 'bars-stacked'),
    mana: pt('t', CX, 434, 1, 'bars-stacked'),
    hotbar: pt('t', CX, 446, 44 / SLOT, 'row'),
    cast: pt('t', CX, 496, 12 / 14),
    killmeter: pt('tl', CX + 128, CY - 60, 100 / 150, 'vertical'),
    combo: pt('tr', CX - 140, CY - 20, 36 / COMBO),
    relics: pt('br', W - 20, H - 20, 36 / 40),
    buffs: pt('tl', 16, 16),
    tracker: pt('tl', 16, 52),
  } },
  { id: 'H07', name: 'WoW Classic', theme: 'wow', elements: {
    unitframe: pt('tl', 16, 16),
    minimap: pt('tr', W - 26, 40, 1, 'circle+nametop'),
    timer: pt('t', W - 101, 202, 22 / 26),
    runinfo: pt('t', W - 101, 226),
    buffs: pt('tl', W - 330, 40),
    relics: pt('tl', W - 330, 80, 34 / 40),
    cast: pt('t', CX, H - 140, 16 / 14),
    killmeter: pt('t', CX, H - 108, 300 / 420),
    hotbar: pt('b', CX, H - 14, 50 / 46, 'framed'),
    xp: pt('t', CX, H - 12, 1, 'thick'),
    combo: pt('tr', W - 40, 330, 52 / COMBO),
    tracker: pt('tl', 16, 112),
  } },
  { id: 'H08', name: 'ElvUI', theme: 'wa', elements: {
    unitframe: pt('tl', CX - 360, CY + 110, 1, 'compact'),
    killmeter: pt('tl', CX - 360, CY + 186, 220 / 420),
    combo: pt('tl', CX + 140, CY + 110, 44 / COMBO),
    hotbar: pt('b', CX, H - 16, 40 / SLOT, 'row'),
    cast: pt('t', CX, H - 86),
    minimap: pt('tr', W - 16, 16, 180 / MAP, 'square'),
    timer: pt('tl', W - 186, 200, 17 / 26, 'info'),
    runinfo: pt('tr', W - 16, 228, 1, 'info'),
    buffs: pt('tl', W - 196 - 4 * 33 - 8, 16),
    relics: pt('tl', W - 196 - 92, 52, 36 / 40),
    tracker: pt('tl', W - 196 - 4 * 33 - 8, 100),
  } },
  { id: 'H09', name: 'MOBA', theme: 'clean', elements: {
    hotbar: pt('b', CX, H - 8, 56 / SLOT, 'panel'),
    hp: pt('t', CX + 30, H - 48, 1, 'panel'),
    mana: pt('t', CX + 30, H - 30, 1, 'panel'),
    killmeter: pt('br', CX + 340, H - 128, 200 / 420),
    minimap: pt('br', W - 16, H - 16, 210 / MAP, 'square'),
    timer: pt('t', CX, 12),
    runinfo: pt('t', CX, 40),
    combo: pt('tr', W - 30, 30, 56 / COMBO),
    buffs: pt('tl', CX - 340, H - 156),
    relics: pt('tl', CX + 250, H - 186, 36 / 40),
    cast: pt('t', CX, 450, 280 / 300),
    tracker: pt('tl', 20, 20),
  } },
  { id: 'H13', name: 'Doom', theme: 'doom', elements: {
    hp: pt('bl', 28, H - 24, 1, 'bignum'),
    mana: pt('br', W - 28, H - 24, 1, 'bignum'),
    hotbar: pt('b', CX, H - 18, 46 / SLOT, 'row'),
    compass: pt('t', CX, 10, 520 / 600),
    minimap: pt('tl', 20, 20, 140 / MAP, 'square'),
    timer: pt('tr', W - 24, 18, 28 / 26, 'big'),
    runinfo: pt('tr', W - 24, 54),
    killmeter: pt('t', CX, H - 84, 320 / 420),
    combo: pt('tr', W - 30, 220, 60 / COMBO),
    cast: pt('t', CX, 450),
    buffs: pt('tl', 20, 172),
    relics: pt('tl', 20, 208),
    tracker: pt('tl', 20, 256),
  } },
  { id: 'H18', name: 'Gotisch', theme: 'ornate', elements: {
    hotbar: pt('b', CX, H, 56 / SLOT, 'ornate'),
    hp: pt('bl', 150, H - 8, 168 / 132, 'orbs'),
    mana: pt('br', W - 150, H - 8, 168 / 132, 'orbs'),
    killmeter: pt('t', CX, H - 112, 1),
    xp: pt('t', CX, H - 16, 740 / 520),
    minimap: pt('tr', W - 38, 36, 168 / MAP, 'circle+name'),
    timer: pt('t', CX, 14, 1, 'banner'),
    runinfo: pt('t', CX, 76),
    combo: pt('t', CX, 100, 60 / COMBO),
    relics: pt('tl', 40, 150, 44 / 40, 'vertical'),
    buffs: pt('tl', 40, 100),
    cast: pt('t', CX, 450),
    tracker: pt('tl', 40, 270),
  } },
  { id: 'H19', name: 'Speedrun', theme: 'clean', elements: {
    minimap: pt('tr', W - 20, 16, 230 / MAP, 'square'),
    splits: pt('tr', W - 20, 262),
    hotbar: pt('b', CX - 120, H - 18, 50 / SLOT, 'row'),
    hp: pt('c', CX - 71, 436, 0.93, 'bars-side'),
    mana: pt('c', CX + 71, 436, 0.93, 'bars-side'),
    cast: pt('t', CX, 448, 280 / 300),
    killmeter: pt('b', CX - 120, H - 82, 1),
    combo: pt('tl', 30, 200, 56 / COMBO),
    buffs: pt('tl', 20, 20),
    relics: pt('tl', 20, 60),
    runinfo: pt('t', CX, 12),
    tracker: pt('tl', 20, 110),
  } },
];

// Handy: Sticks und Tasten liegen unten in den Ecken, das HUD oben. Gilt über jedem Preset // PH
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
