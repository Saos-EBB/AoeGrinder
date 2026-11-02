// HUD-Layout: Jedes Element hat Anker und Versatz in % vom Bildschirm. Eigene Werte liegen in localStorage, „Zurücksetzen“ lädt den Standard.

import { $ } from '../util';
import { UI } from './uiConfig';

const ANCHORS = { tl: [0, 0], tc: [0.5, 0], tr: [1, 0], cl: [0, 0.5], c: [0.5, 0.5], cr: [1, 0.5], bl: [0, 1], bc: [0.5, 1], br: [1, 1] };
const NAMES = { hudHeader: 'Kopfleiste', hudBars: 'Leben, Mana, Castbar', actionbar: 'Zauberleiste', hudEffects: 'Effekte und Runen', hudRelics: 'Relikte' };
export const DEFAULT_LAYOUT = {
  hudHeader: { anchor: 'tc', x: 0, y: 0 },
  hudBars: { anchor: 'c', x: 0, y: 24 },
  actionbar: { anchor: 'bc', x: 0, y: -1 },
  hudEffects: { anchor: 'tl', x: 1, y: 8 },
  hudRelics: { anchor: 'cr', x: -1, y: -10 },
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
      left: `${fx * 100 + e.x}%`, top: `${fy * 100 + e.y}%`, transform: `translate(${-fx * 100}%, ${-fy * 100}%)` });
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

const snap = v => Math.round(v / UI.gridPct) * UI.gridPct;
for (const id of Object.keys(layout)) {
  $(id).addEventListener('pointerdown', e => {
    if (!onDone) return;
    e.preventDefault(); e.stopPropagation();
    drag = { id, x: e.clientX, y: e.clientY, ox: layout[id].x, oy: layout[id].y };
  }, true);
  $(id).addEventListener('click', e => { if (onDone) { e.preventDefault(); e.stopPropagation(); } }, true);
}
addEventListener('pointermove', e => {
  if (!drag) return;
  layout[drag.id].x = snap(drag.ox + (e.clientX - drag.x) / innerWidth * 100);
  layout[drag.id].y = snap(drag.oy + (e.clientY - drag.y) / innerHeight * 100);
  applyLayout();
});
addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });
$('hudEditReset').addEventListener('click', () => {
  layout = structuredClone(DEFAULT_LAYOUT);
  try { localStorage.removeItem(STORE); } catch { /* egal */ }
  applyLayout();
});
$('hudEditDone').addEventListener('click', stopHudEdit);
applyLayout();
