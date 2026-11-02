// HUD-Layout: Jedes Element hat Anker und Versatz in % vom Bildschirm. Eigene Werte liegen in localStorage, „Zurücksetzen“ lädt den Standard.

import { $ } from '../util';
import { UI } from './uiConfig';

const ANCHORS = { tl: [0, 0], tc: [0.5, 0], tr: [1, 0], cl: [0, 0.5], c: [0.5, 0.5], cr: [1, 0.5], bl: [0, 1], bc: [0.5, 1], br: [1, 1] };
const NAMES = { hudHeader: 'Kopfleiste', hudHp: 'Leben', hudMana: 'Mana', hudCast: 'Castbar', actionbar: 'Zauberleiste', hudEffects: 'Effekte und Runen', hudRelics: 'Relikte' };
export const DEFAULT_LAYOUT = {
  hudHeader: { anchor: 'tc', x: 0, y: 0, scale: 1 },
  hudHp: { anchor: 'c', x: -10, y: 24, scale: 1 },
  hudMana: { anchor: 'c', x: 10, y: 24, scale: 1 },
  hudCast: { anchor: 'c', x: 0, y: 28.5, scale: 1 },
  actionbar: { anchor: 'bc', x: 0, y: -1, scale: 1 },
  hudEffects: { anchor: 'tl', x: 1, y: 8, scale: 1 },
  hudRelics: { anchor: 'cr', x: -1, y: -10, scale: 1 },
};
const STORE = 'frostgrind.hud.v1';

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

export function applyLayout() {
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
    drag = { id, x: e.clientX, y: e.clientY, ox: layout[id].x, oy: layout[id].y };
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
// Andocken: Kommt ein Element nah an ein anderes, liegt es danach bündig daneben. Der Winkel zwischen den Mitten entscheidet:
// im linken oder rechten Viertel seitlich, im oberen oder unteren darüber oder darunter. Gedockte Elemente bleiben einzeln ziehbar.
const clearDockMark = () => document.querySelectorAll('.hudDockTarget').forEach(el => el.classList.remove('hudDockTarget'));
function dock(id) {
  clearDockMark();
  const me = $(id).getBoundingClientRect();
  let best = null, bestGap = UI.hudDockPx;
  for (const other of Object.keys(layout)) {
    if (other === id) continue;
    const o = $(other).getBoundingClientRect();
    const gap = Math.max(o.left - me.right, me.left - o.right, o.top - me.bottom, me.top - o.bottom);
    if (gap < bestGap) { bestGap = gap; best = { other, o }; }
  }
  if (!best) return;
  const { o } = best, dx = (me.left + me.right - o.left - o.right) / 2, dy = (me.top + me.bottom - o.top - o.bottom) / 2;
  if (best.other === 'hudHeader' && Math.abs(dx) > Math.abs(dy)) return;   // Die Kopfleiste ist bildschirmbreit, seitlich gibt es nichts
  const side = Math.abs(dx) > Math.abs(dy);
  const left = side ? (dx > 0 ? o.right : o.left - me.width) : o.left;
  const top = side ? o.top : (dy > 0 ? o.bottom : o.top - me.height);
  layout[id].x += (left - me.left) / innerWidth * 100;
  layout[id].y += (top - me.top) / innerHeight * 100;
  applyLayout();
  $(best.other).classList.add('hudDockTarget');
}

addEventListener('pointermove', e => {
  if (!drag) return;
  layout[drag.id].x = snap(drag.ox + (e.clientX - drag.x) / innerWidth * 100);
  layout[drag.id].y = snap(drag.oy + (e.clientY - drag.y) / innerHeight * 100);
  applyLayout();
  dock(drag.id);
});
addEventListener('pointerup', () => { if (drag) { drag = null; clearDockMark(); save(); } });
$('hudEditReset').addEventListener('click', () => {
  layout = structuredClone(DEFAULT_LAYOUT);
  try { localStorage.removeItem(STORE); } catch { /* egal */ }
  applyLayout();
});
$('hudEditDone').addEventListener('click', stopHudEdit);
applyLayout();
