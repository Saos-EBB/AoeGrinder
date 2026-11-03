// HUD-Layout: Jedes Element hat Anker und Versatz in % vom Bildschirm. Eigene Werte liegen in localStorage, „Zurücksetzen“ lädt den Standard.

import { $ } from '../util';
import { UI } from './uiConfig';
import { device } from '../device';

const ANCHORS = { tl: [0, 0], tc: [0.5, 0], tr: [1, 0], cl: [0, 0.5], c: [0.5, 0.5], cr: [1, 0.5], bl: [0, 1], bc: [0.5, 1], br: [1, 1] };
const NAMES = { hudHeader: 'Kopfleiste', hudHp: 'Leben', hudMana: 'Mana', hudCast: 'Castbar', actionbar: 'Zauberleiste', hudEffects: 'Effekte und Runen', hudRelics: 'Relikte', hudMap: 'Minimap' };
const DEFAULT_LAYOUT: any = {
  hudHeader: { anchor: 'tc', x: 0, y: 0, scale: 1 },
  hudHp: { anchor: 'c', x: -10, y: 24, scale: 1, links: ['hudMana', 'hudCast'] },
  hudMana: { anchor: 'c', x: 10, y: 24, scale: 1, links: ['hudHp'] },
  hudCast: { anchor: 'c', x: 0, y: 28, scale: 1, links: ['hudHp'] },
  actionbar: { anchor: 'bc', x: 0, y: -1, scale: 1 },
  hudEffects: { anchor: 'tl', x: 1, y: 8, scale: 1 },
  hudRelics: { anchor: 'cr', x: -1, y: -10, scale: 1 },
  hudMap: { anchor: 'tr', x: -1, y: 6, scale: 1 },
};
// Eigenes Layout am Handy: Sticks und Tasten liegen unten in den Ecken, das HUD oben // PH
const MOBILE_LAYOUT: any = {
  hudHeader: { anchor: 'tc', x: 0, y: 0, scale: 0.8 },
  hudHp: { anchor: 'tl', x: 1, y: 11, scale: 0.9 },
  hudMana: { anchor: 'tl', x: 1, y: 19, scale: 0.9 },
  hudCast: { anchor: 'c', x: 0, y: 12, scale: 1 },
  actionbar: { anchor: 'bc', x: 0, y: -1, scale: 0.6 },
  hudEffects: { anchor: 'tl', x: 1, y: 28, scale: 1 },
  hudRelics: { anchor: 'tr', x: -9, y: 11, scale: 0.7 },
  hudMap: { anchor: 'tr', x: -1, y: 11, scale: 0.6 },
};
if (device.mobile) Object.assign(DEFAULT_LAYOUT, MOBILE_LAYOUT);
const STORE = device.mobile ? 'frostgrind.hud.mobile.v1' : 'frostgrind.hud.v1';

function load() {
  const out = structuredClone(DEFAULT_LAYOUT);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    for (const id in out) if (saved[id]) Object.assign(out[id], saved[id]);
  } catch { /* kein Storage */ }
  return out;
}
let layout = load();
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(layout)); } catch { /* egal */ } };

function applyLayout() {
  for (const id in layout) {
    const e = layout[id], [fx, fy] = ANCHORS[e.anchor], el = $(id);
    Object.assign(el.style, { position: 'fixed', right: 'auto', bottom: 'auto', margin: '0',
      left: `${fx * 100 + e.x}%`, top: `${fy * 100 + e.y}%`, transform: `translate(${-fx * 100}%, ${-fy * 100}%) scale(${e.scale ?? 1})`,
      transformOrigin: `${fx * 100}% ${fy * 100}%` });
    el.dataset.hudName = NAMES[id];
  }
}

// Bearbeiten-Modus: Elemente ziehen, Raster, Umrandung mit Name
let onDone = null, drag = null;
export const hudEditing = () => !!onDone;
export function startHudEdit(done) {
  onDone = done;
  document.body.classList.add('hudEdit');
  $('hudEditBar').hidden = false;
  showGrid();
}
export function stopHudEdit() {
  if (!onDone) return;
  const done = onDone;
  onDone = null;
  drag = null;
  document.body.classList.remove('hudEdit');
  $('hudEditBar').hidden = true;
  $('hudGrid').hidden = true;
  done();
}

// Raster: an rastet beim Ziehen ein und zeigt die Linien, aus heißt frei schieben
let gridOn = true, gridStep = UI.gridSteps[0];
const snap = v => gridOn ? Math.round(v / gridStep) * gridStep : Math.round(v * 10) / 10;
function showGrid() {
  $('hudEditGrid').textContent = `Raster: ${gridOn ? 'an' : 'aus'}`;
  $('hudEditStep').textContent = `Größe: ${gridStep} %`;
  ($('hudEditStep') as HTMLButtonElement).disabled = !gridOn;
  const g = $('hudGrid');
  g.hidden = !gridOn;
  g.style.backgroundSize = `${gridStep}vw ${gridStep}vh`;
}
$('hudEditGrid').addEventListener('click', () => { gridOn = !gridOn; showGrid(); });
$('hudEditStep').addEventListener('click', () => { gridStep = UI.gridSteps[(UI.gridSteps.indexOf(gridStep) + 1) % UI.gridSteps.length]; showGrid(); });
for (const id of Object.keys(layout)) {
  $(id).addEventListener('pointerdown', e => {
    if (!onDone) return;
    e.preventDefault(); e.stopPropagation();
    if (e.shiftKey) unlink(id);                      // Shift + Ziehen trennt das Element von seiner Gruppe
    const start = {};
    for (const g of group(id)) start[g] = { x: layout[g].x, y: layout[g].y };
    drag = { id, x: e.clientX, y: e.clientY, start, free: e.shiftKey, dockTo: [] };
  }, true);
  $(id).addEventListener('click', e => { if (onDone) { e.preventDefault(); e.stopPropagation(); } }, true);
  $(id).addEventListener('wheel', e => {             // Mausrad über dem Element ändert seine Größe
    if (!onDone) return;
    e.preventDefault();
    const { min, max, step } = UI.hudScale, next = (layout[id].scale ?? 1) - Math.sign(e.deltaY) * step;
    layout[id].scale = Math.round(Math.min(max, Math.max(min, next)) * 100) / 100;
    applyLayout();
    save();
  }, { passive: false });
}
// Eingerastete Elemente bilden eine Gruppe und wandern zusammen
function group(id) {
  const seen = new Set([id]);
  for (const g of seen) for (const n of layout[g].links ?? []) seen.add(n);
  return [...seen];
}
function link(a, b) {
  (layout[a].links ??= []).includes(b) || layout[a].links.push(b);
  (layout[b].links ??= []).includes(a) || layout[b].links.push(a);
}
function unlink(id) {
  for (const n of layout[id].links ?? []) layout[n].links = layout[n].links.filter(x => x !== id);
  layout[id].links = [];
}

// Andocken: Kommt ein Element nah an ein anderes, liegt es danach bündig daneben. Der Winkel zum Ziel entscheidet:
// im linken oder rechten Viertel seitlich, im oberen oder unteren darüber oder darunter. Beim Loslassen rastet es ein.
const clearDockMark = () => document.querySelectorAll('.hudDockTarget').forEach(el => el.classList.remove('hudDockTarget'));
function dock(id) {
  clearDockMark();
  drag.dockTo = [];
  for (let pass = 0; pass < 2; pass++) if (!dockOnce(id)) break;   // Zweiter Durchgang: In einer Ecke rastet es an zwei Nachbarn ein
}
function dockOnce(id) {
  const me = $(id).getBoundingClientRect();
  let best = null, bestGap = UI.hudDockPx;
  for (const other of Object.keys(layout)) {
    if (other in drag.start || drag.dockTo.includes(other)) continue;
    const o = $(other).getBoundingClientRect();
    const gap = Math.abs(Math.max(o.left - me.right, me.left - o.right, o.top - me.bottom, me.top - o.bottom));
    if (gap < bestGap) { bestGap = gap; best = { other, o }; }
  }
  if (!best) return false;
  const { o } = best, dx = (me.left + me.right - o.left - o.right) / 2, dy = (me.top + me.bottom - o.top - o.bottom) / 2;
  const side = Math.abs(dx) / o.width > Math.abs(dy) / o.height;   // Viertel über die Ecken des Ziels, sonst wäre neben breiten Leisten immer „seitlich“
  if (best.other === 'hudHeader' && side) return false;   // Die Kopfleiste ist bildschirmbreit, seitlich gibt es nichts
  const near = (a, b) => Math.abs(a - b) < UI.hudDockPx;
  const left = side ? (dx > 0 ? o.right : o.left - me.width) : near(me.left, o.left) ? o.left : near(me.right, o.right) ? o.right - me.width : me.left;
  const top = !side ? (dy > 0 ? o.bottom : o.top - me.height) : near(me.top, o.top) ? o.top : near(me.bottom, o.bottom) ? o.bottom - me.height : me.top;
  for (const g in drag.start) {
    layout[g].x += (left - me.left) / innerWidth * 100;
    layout[g].y += (top - me.top) / innerHeight * 100;
  }
  applyLayout();
  drag.dockTo.push(best.other);
  $(best.other).classList.add('hudDockTarget');
  return true;
}

addEventListener('pointermove', e => {
  if (!drag) return;
  const s = drag.start[drag.id];
  const dx = snap(s.x + (e.clientX - drag.x) / innerWidth * 100) - s.x, dy = snap(s.y + (e.clientY - drag.y) / innerHeight * 100) - s.y;
  for (const g in drag.start) { layout[g].x = drag.start[g].x + dx; layout[g].y = drag.start[g].y + dy; }
  applyLayout();
  if (!drag.free) dock(drag.id);
});
addEventListener('pointerup', () => {
  if (!drag) return;
  for (const other of drag.dockTo ?? []) link(drag.id, other);
  drag = null;
  clearDockMark();
  save();
});
$('hudEditReset').addEventListener('click', () => {
  layout = structuredClone(DEFAULT_LAYOUT);
  try { localStorage.removeItem(STORE); } catch { /* egal */ }
  applyLayout();
});
$('hudEditDone').addEventListener('click', stopHudEdit);
applyLayout();
