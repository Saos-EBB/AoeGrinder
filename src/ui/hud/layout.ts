// HUD-Layout: Jedes Element steckt in einem Wrapper (position: fixed), Lage = Preset + eigene Änderungen (Overrides) pro Preset.
// x, y in % vom Bildschirm ab dem Anker; ein Fensterwechsel behält die %. Gespeichert in frostgrind.ui.v1 (hudPreset, hudOverrides).
// Bearbeiten-Modus: ziehen (Raster 0,5 %, Shift = frei), Mausrad = Größe, H = ein/aus, Rechtsklick = Element auf Preset zurück.

import { $ } from '../../util';
import { device } from '../../device';
import { UI } from '../uiConfig';
import { uiSettings, setUi } from '../uiSettings';
import { PRESETS, MOBILE } from './presets';
import { t } from '../../i18n';

export type Anchor = 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br';
export type HudElementId = 'timer' | 'runinfo' | 'xp' | 'hp' | 'mana' | 'cast' | 'hotbar' | 'killmeter' | 'combo' | 'buffs' | 'relics'
  | 'minimap' | 'compass' | 'splits' | 'tracker' | 'unitframe';
export type Placement = { anchor: Anchor; x: number; y: number; scale: number; hidden?: boolean; variant?: string };
export type HudPreset = { id: string; name: string; theme: string; elements: Partial<Record<HudElementId, Placement>> };

export const HUD_NAMES: Record<HudElementId, string> = {
  timer: t('hudEl.timer'), runinfo: t('hudEl.runinfo'), xp: t('hudEl.xp'), hp: t('hudEl.hp'), mana: t('hudEl.mana'), cast: t('hudEl.cast'), hotbar: t('hudEl.hotbar'), killmeter: t('hudEl.killmeter'), combo: t('hudEl.combo'), buffs: t('hudEl.buffs'), relics: t('hudEl.relics'), minimap: t('hudEl.minimap'), compass: t('hudEl.compass'), splits: t('hudEl.splits'), tracker: t('hudEl.tracker'), unitframe: t('hudEl.unitframe'),
};
const ANCHORS: Record<Anchor, [number, number]> = { tl: [0, 0], t: [0.5, 0], tr: [1, 0], l: [0, 0.5], c: [0.5, 0.5], r: [1, 0.5], bl: [0, 1], b: [0.5, 1], br: [1, 1] };
const SNAP = 0.5;   // Raster in %

export const activePreset = (): HudPreset => PRESETS.find(p => p.id === uiSettings.hudPreset) ?? PRESETS[0];
const overrideKey = () => activePreset().id + (device.mobile ? '@mobile' : '');
const overrides = (): Partial<Record<HudElementId, Placement>> => uiSettings.hudOverrides[overrideKey()] ?? {};
function base(id: HudElementId): Placement | undefined {
  const p = activePreset().elements[id];
  return device.mobile && p && MOBILE[id] ? { ...p, ...MOBILE[id] } : p;
}
export function placementOf(id: HudElementId): Placement | undefined {
  const b = base(id), o = overrides()[id];
  return b || o ? { ...b, ...o } as Placement : undefined;
}
function saveOverride(id: HudElementId, p: Placement | null) {
  const all = { ...uiSettings.hudOverrides }, mine = { ...(all[overrideKey()] ?? {}) };
  if (p) mine[id] = { ...p }; else delete mine[id];
  all[overrideKey()] = mine;
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
  if (p.variant) w.dataset.variant = p.variant; else delete w.dataset.variant;
}
export function applyLayout() {
  for (const id of wrappers.keys()) place(id);
  document.body.dataset.hudTheme = activePreset().theme;
}
addEventListener('uisettings', applyLayout);

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

$('hudEditReset').addEventListener('click', () => {
  const all = { ...uiSettings.hudOverrides };
  delete all[overrideKey()];
  setUi('hudOverrides', all);
});
$('hudEditDone').addEventListener('click', stopHudEdit);

// Eigenes Layout aus dem alten Speicher (frostgrind.hud.v1) einmal als Override von H01 übernehmen
const OLD_IDS: Record<string, HudElementId> = { hudHeader: 'runinfo', hudHp: 'hp', hudMana: 'mana', hudCast: 'cast', actionbar: 'hotbar', hudEffects: 'buffs', hudRelics: 'relics', hudMap: 'minimap' };
const OLD_ANCHOR: Record<string, Anchor> = { tl: 'tl', tc: 't', tr: 'tr', cl: 'l', c: 'c', cr: 'r', bl: 'bl', bc: 'b', br: 'br' };
(function migrate() {
  const store = device.mobile ? 'frostgrind.hud.mobile.v1' : 'frostgrind.hud.v1', key = 'H01' + (device.mobile ? '@mobile' : '');
  try {
    const old = JSON.parse(localStorage.getItem(store) || 'null');
    if (!old || uiSettings.hudOverrides[key]) return;
    const mine = {};
    for (const [oldId, id] of Object.entries(OLD_IDS)) {
      const o = old[oldId];
      if (o && OLD_ANCHOR[o.anchor]) mine[id] = { anchor: OLD_ANCHOR[o.anchor], x: o.x, y: o.y, scale: o.scale ?? 1 };
    }
    setUi('hudOverrides', { ...uiSettings.hudOverrides, [key]: mine });
    localStorage.removeItem(store);
  } catch { /* kein Storage */ }
})();

// Alle HUD-Elemente: id → Markup in index.html
const DOM_IDS: Record<HudElementId, string> = {
  timer: 'hudTimer', runinfo: 'hudRun', xp: 'hudXp', hp: 'hudHp', mana: 'hudMana', cast: 'hudCast', hotbar: 'actionbar', killmeter: 'hudKill',
  combo: 'hudCombo', buffs: 'hudEffects', relics: 'hudRelics', minimap: 'hudMap', compass: 'hudCompass', splits: 'hudSplits', tracker: 'hudTracker', unitframe: 'hudUnit',
};
for (const [id, dom] of Object.entries(DOM_IDS)) registerHudElement(id as HudElementId, $(dom));
applyLayout();
