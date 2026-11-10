// HUD-Layout: Jedes Element steckt in einem Wrapper (position: fixed), Lage = Layout + eigene Änderungen (Overrides) pro Layout.
// x, y in % vom Bildschirm ab dem Anker; ein Fensterwechsel behält die %. Overrides in frostgrind.ui.v1 (hudOverrides).
// Bearbeiten-Modus: ziehen (Raster 0,5 %, Shift = frei), Mausrad = Größe, H = ein/aus, Rechtsklick = Element auf Layout zurück.

import { $ } from '../../util';
import { device } from '../../device';
import { UI } from '../uiConfig';
import { uiSettings, setUi } from '../uiSettings';
import { MOBILE, MIX_FIXES, HUD_PARTS, partOf, type HudPart } from './presets';
import { activeFlavor, flavorById, FLAVORS, type Flavor } from '../flavors';
import { t } from '../../i18n';

export type Anchor = 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br';
export type HudElementId = 'timer' | 'runinfo' | 'xp' | 'hp' | 'mana' | 'cast' | 'hotbar' | 'killmeter' | 'combo' | 'buffs' | 'relics'
  | 'minimap' | 'compass' | 'splits' | 'tracker' | 'unitframe' | 'micro' | 'feats';
export type Placement = { anchor: Anchor; x: number; y: number; scale: number; hidden?: boolean; variant?: string };
export type HudLayout = { id: string; elements: Partial<Record<HudElementId, Placement>> };

export const HUD_NAMES: Record<HudElementId, string> = {
  timer: t('hudEl.timer'), runinfo: t('hudEl.runinfo'), xp: t('hudEl.xp'), hp: t('hudEl.hp'), mana: t('hudEl.mana'), cast: t('hudEl.cast'), hotbar: t('hudEl.hotbar'), killmeter: t('hudEl.killmeter'), combo: t('hudEl.combo'), buffs: t('hudEl.buffs'), relics: t('hudEl.relics'), minimap: t('hudEl.minimap'), compass: t('hudEl.compass'), splits: t('hudEl.splits'), tracker: t('hudEl.tracker'), unitframe: t('hudEl.unitframe'),
  micro: t('hudEl.micro'), feats: t('hudEl.feats'),
};
const ANCHORS: Record<Anchor, [number, number]> = { tl: [0, 0], t: [0.5, 0], tr: [1, 0], l: [0, 0.5], c: [0.5, 0.5], r: [1, 0.5], bl: [0, 1], b: [0.5, 1], br: [1, 1] };
const SNAP = 0.5;   // Raster in %

// Layout = Standard-Layout des aktiven UI-Flavors; ein HUD-Teil (presets.ts HUD_PARTS) kann aus einem anderen Flavor kommen (uiSettings.hudMix).
// Eigene Änderungen gelten pro UI-Flavor, bei einem fremden Teil pro Paar „UI-Flavor+Teil-Flavor“ (Schlüssel hoellenfeste+krypta)
export function elementFlavor(id: HudElementId): Flavor {
  const part = partOf(id), pick = part && uiSettings.hudMix?.[part];
  return pick && pick !== 'flavor' && FLAVORS.some(f => f.id === pick) ? flavorById(pick) : activeFlavor();
}
const mobileKey = () => device.mobile ? '@mobile' : '';
const overrideKey = (id: HudElementId) => { const main = activeFlavor().id, src = elementFlavor(id).id; return main + (src !== main ? `+${src}` : '') + mobileKey(); };
const overrides = (id: HudElementId): Partial<Record<HudElementId, Placement>> => uiSettings.hudOverrides[overrideKey(id)] ?? {};
const mixNow = () => Object.assign({ main: activeFlavor().id },
  ...(Object.keys(HUD_PARTS) as HudPart[]).map(k => ({ [k]: elementFlavor(HUD_PARTS[k][0]).id }))) as Parameters<(typeof MIX_FIXES)[number]['when']>[0];
function base(id: HudElementId): Placement | undefined {
  let p = elementFlavor(id).hud[id];
  if (p) { const m = mixNow(); for (const fix of MIX_FIXES) if (fix.hud[id] && fix.when(m)) p = { ...p, ...fix.hud[id] }; }   // Ausweich-Lage im gemischten Layout
  return device.mobile && p && MOBILE[id] ? { ...p, ...MOBILE[id] } : p;
}
export function placementOf(id: HudElementId): Placement | undefined {
  const b = base(id), o = overrides(id)[id];
  return b || o ? { ...b, ...o } as Placement : undefined;
}
function saveOverride(id: HudElementId, p: Placement | null) {
  const key = overrideKey(id), all = { ...uiSettings.hudOverrides }, mine = { ...(all[key] ?? {}) };
  if (p) mine[id] = { ...p }; else delete mine[id];
  all[key] = mine;
  setUi('hudOverrides', all);
}

// Wrapper um ein vorhandenes Element. Die Position setzt nur applyLayout
const wrappers = new Map<HudElementId, HTMLElement>();
export function registerHudElement(id: HudElementId, inner: HTMLElement) {
  const w = document.createElement('div');
  w.className = 'hudEl';
  w.dataset.hud = id;
  w.dataset.name = HUD_NAMES[id];
  inner.replaceWith(w);
  w.append(inner);
  wrappers.set(id, w);
  sizeWatch.observe(w);
  bindEdit(id, w);
  place(id);
  return w;
}
export const hudWrapper = (id: HudElementId) => wrappers.get(id);

function place(id: HudElementId) {
  const w = wrappers.get(id), p = placementOf(id);
  w.classList.toggle('hudOff', !p || !!p.hidden);
  if (!p) return;
  const [fx, fy] = ANCHORS[p.anchor] ?? ANCHORS.c;
  Object.assign(w.style, { left: `${fx * 100 + p.x}%`, top: `${fy * 100 + p.y}%`,
    transform: `translate(${-fx * 100}%, ${-fy * 100}%) scale(${(p.scale ?? 1) * uiSettings.hudScale / 100})`, transformOrigin: `${fx * 100}% ${fy * 100}%` });
  w.dataset.anchor = p.anchor;
  w.dataset.flavor = elementFlavor(id).id;   // Look des Elements: Variablen und Regeln aus ui/flavors/<id>.css greifen am Wrapper
  if (p.variant) w.dataset.variant = p.variant; else delete w.dataset.variant;
  w.classList.toggle('fg-panel', !!p.variant?.split(' ').includes('panel'));   // Panel mit den Ornamenten des Flavors
}
export function applyLayout() {
  for (const id of wrappers.keys()) place(id);
  keepOutOfCorners();
}
addEventListener('uisettings', applyLayout);

// Zierrahmen-Ecken (#fgOverlay, über dem HUD): kein Element im Quadrat --fg-safe einer Bildschirmecke (base.css). Ein Element, das hineinragt,
// rückt um den kürzeren Weg heraus (waagrecht oder senkrecht) – zusätzlich zur gespeicherten Lage über `translate`, Layout und Overrides bleiben unverändert.
// Gilt für Standard-Layouts wie eigene Änderungen; neu bei Größe, Fenster, Flavor und Inhalt (Buffs, Tracker)
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:var(--fg-safe);height:0;visibility:hidden;pointer-events:none';
document.body.append(safeProbe);
function keepOutOfCorners() {
  const s = safeProbe.getBoundingClientRect().width, W = innerWidth, H = innerHeight;
  for (const w of wrappers.values()) w.style.translate = '';
  const rects = [...wrappers.values()].map(w => w.getBoundingClientRect());   // erst alle messen, dann schieben (ein Layout-Durchlauf)
  [...wrappers.values()].forEach((w, i) => {
    const r = rects[i];
    if (!r.width || !r.height) return;
    let dx = 0, dy = 0;
    for (const [left, top] of [[true, true], [false, true], [true, false], [false, false]]) {
      const inX = left ? r.left + dx < s : r.right + dx > W - s, inY = top ? r.top + dy < s : r.bottom + dy > H - s;
      if (!inX || !inY) continue;
      const mx = left ? s - (r.left + dx) : W - s - (r.right + dx), my = top ? s - (r.top + dy) : H - s - (r.bottom + dy);
      if (Math.abs(mx) <= Math.abs(my)) dx += mx; else dy += my;
    }
    if (dx || dy) w.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
  });
}
addEventListener('resize', keepOutOfCorners);
const sizeWatch = new ResizeObserver(() => keepOutOfCorners());

// ---------- Bearbeiten-Modus ----------
let onDone: (() => void) | null = null, drag = null, hover: HudElementId | null = null;
export const hudEditing = () => !!onDone;
export function startHudEdit(done: () => void) {
  onDone = done;
  document.body.classList.add('hudEdit');
  $('hudEditBar').hidden = false;
}
export function stopHudEdit() {
  if (!onDone) return;
  const done = onDone;
  onDone = null;
  drag = null;
  document.body.classList.remove('hudEdit');
  $('hudEditBar').hidden = true;
  done();
}

function bindEdit(id: HudElementId, w: HTMLElement) {
  w.addEventListener('pointerdown', e => {
    if (!onDone || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const p = placementOf(id) ?? { anchor: 'c', x: 0, y: 0, scale: 1 };
    drag = { id, x: e.clientX, y: e.clientY, p: { ...p } };
  }, true);
  w.addEventListener('click', e => { if (onDone) { e.preventDefault(); e.stopPropagation(); } }, true);
  w.addEventListener('wheel', e => {
    if (!onDone) return;
    e.preventDefault();
    const p = placementOf(id);
    if (!p) return;
    const { min, max, step } = UI.hudScale;
    saveOverride(id, { ...p, scale: Math.round(Math.min(max, Math.max(min, p.scale - Math.sign(e.deltaY) * step)) * 100) / 100 });
  }, { passive: false });
  w.addEventListener('contextmenu', e => {
    if (!onDone) return;
    e.preventDefault(); e.stopPropagation();
    saveOverride(id, null);
  }, true);
  w.addEventListener('pointerenter', () => { hover = id; });
  w.addEventListener('pointerleave', () => { if (hover === id) hover = null; });
}
const snap = (v: number, free: boolean) => free ? Math.round(v * 10) / 10 : Math.round(v / SNAP) * SNAP;
addEventListener('pointermove', e => {
  if (!drag) return;
  const free = e.shiftKey;
  const p = { ...drag.p, x: snap(drag.p.x + (e.clientX - drag.x) / innerWidth * 100, free), y: snap(drag.p.y + (e.clientY - drag.y) / innerHeight * 100, free) };
  drag.now = p;
  const w = wrappers.get(drag.id), [fx, fy] = ANCHORS[p.anchor];
  w.style.left = `${fx * 100 + p.x}%`;   // während des Ziehens nur verschieben, gespeichert wird beim Loslassen
  w.style.top = `${fy * 100 + p.y}%`;
});
addEventListener('pointerup', () => {
  if (!drag) return;
  if (drag.now) saveOverride(drag.id, drag.now);
  drag = null;
});
addEventListener('keydown', e => {
  if (!onDone || e.code !== 'KeyH' || !hover) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const p = placementOf(hover);
  if (p) saveOverride(hover, { ...p, hidden: !p.hidden });
}, true);

// Zurücksetzen: alle eigenen Änderungen des UI-Flavors, auch die der fremden Teile
$('hudEditReset').addEventListener('click', () => {
  const main = activeFlavor().id, all = { ...uiSettings.hudOverrides };
  for (const k of Object.keys(all)) if (k.split(/[+@]/)[0] === main && k.includes('@mobile') === device.mobile) delete all[k];
  setUi('hudOverrides', all);
});
$('hudEditDone').addEventListener('click', stopHudEdit);

// Alle HUD-Elemente: id → Markup in index.html
const DOM_IDS: Record<HudElementId, string> = {
  timer: 'hudTimer', runinfo: 'hudRun', xp: 'hudXp', hp: 'hudHp', mana: 'hudMana', cast: 'hudCast', hotbar: 'actionbar', killmeter: 'hudKill',
  combo: 'hudCombo', buffs: 'hudEffects', relics: 'hudRelics', minimap: 'hudMap', compass: 'hudCompass', splits: 'hudSplits', tracker: 'hudTracker', unitframe: 'hudUnit',
  micro: 'hudMicro', feats: 'hudFeats',
};
for (const [id, dom] of Object.entries(DOM_IDS)) registerHudElement(id as HudElementId, $(dom));
applyLayout();
