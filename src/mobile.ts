// Handy und Tablet: Erkennung, Vollbild quer, Touch-Steuerung mit 2 Sticks und 4 Tasten pro Seite.
// Die Touch-Eingabe läuft über das virtuelle Pad (gamepad.ts), damit Zielen, Halten und Runen wie am Controller funktionieren.

import { state, player } from './state';
import { SPELLS, SPELL_ACTIONS } from './config';
import { ICONS } from './ui/icons';
import { openPause, menuOpen } from './ui/mainMenu';
import { device, goFullscreen, toView } from './device';


export const touch = {
  move: { x: 0, y: 0 },        // wie pad.move: x rechts, y vorwärts
  look: { x: 0, y: 0 },        // wie pad.look: x rechts, y unten
  held: new Set<string>(),     // gehaltene Aktionen (IDs aus SPELL_ACTIONS)
};

const STICK_R = 60;            // px, Ausschlag bis voll // PH
const TAP_MS = 220, TAP_PX = 12;   // Tippen auf den rechten Stick = Springen // PH


function stick(side: 'L' | 'R') {
  const zone = document.createElement('div'), base = document.createElement('div'), knob = document.createElement('div');
  zone.className = `tzone t${side}`;
  base.className = 'tbase';
  knob.className = 'tknob';
  base.appendChild(knob);
  zone.appendChild(base);
  const out = side === 'L' ? touch.move : touch.look;
  let id = -1, ox = 0, oy = 0, t0 = 0, maxD = 0;
  const reset = () => { id = -1; out.x = out.y = 0; knob.style.transform = ''; base.style.cssText = ''; };
  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (id >= 0) return;
    const t = e.changedTouches[0], v = toView(t.clientX, t.clientY);   // in Seiten-Koordinaten, auch bei gedrehter Seite
    id = t.identifier; ox = v.x; oy = v.y; t0 = performance.now(); maxD = 0;
    base.style.left = `${ox - zone.offsetLeft}px`; base.style.top = `${oy - zone.offsetTop}px`; base.style.bottom = 'auto'; base.style.right = 'auto';
  }, { passive: false });
  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      const v = toView(t.clientX, t.clientY);
      let dx = v.x - ox, dy = v.y - oy;
      const d = Math.hypot(dx, dy);
      maxD = Math.max(maxD, d);
      if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      out.x = dx / STICK_R;
      out.y = side === 'L' ? -dy / STICK_R : dy / STICK_R;
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      if (side === 'R' && performance.now() - t0 < TAP_MS && maxD < TAP_PX) state.jumpQueued = true;
      reset();
    }
  };
  zone.addEventListener('touchend', end);
  zone.addEventListener('touchcancel', end);
  return { zone, reset };
}

const btns: { el: HTMLElement, action: string, spell: string | null }[] = [];
function button(action: string) {
  const el = document.createElement('div');
  el.className = 'tbtn';
  const on = e => { e.preventDefault(); e.stopPropagation(); touch.held.add(action); el.classList.add('down'); };
  const off = e => { e.preventDefault(); touch.held.delete(action); el.classList.remove('down'); };
  el.addEventListener('touchstart', on, { passive: false });
  el.addEventListener('touchend', off);
  el.addEventListener('touchcancel', off);
  btns.push({ el, action, spell: undefined });
  return el;
}

let layer: HTMLElement, sticks: ReturnType<typeof stick>[] = [];
function build() {
  layer = document.createElement('div');
  layer.id = 'touchLayer';
  sticks = [stick('L'), stick('R')];
  for (const s of sticks) layer.appendChild(s.zone);
  // Slots 5–8 links (linker Daumen hält, rechter Stick zielt), Slots 1–4 rechts
  for (const [cls, ids] of [['tbL', SPELL_ACTIONS.slice(4)], ['tbR', SPELL_ACTIONS.slice(0, 4)]] as const) {
    const grid = document.createElement('div');
    grid.className = `tbtns ${cls}`;
    for (const id of ids) grid.appendChild(button(id));
    layer.appendChild(grid);
  }
  const menu = document.createElement('div');
  menu.id = 'tMenu';
  menu.textContent = '☰';
  menu.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); openPause(); }, { passive: false });
  layer.appendChild(menu);
  document.body.appendChild(layer);
  addEventListener('touchend', goFullscreen, { capture: true });
  addEventListener('click', goFullscreen, { capture: true });
}

function releaseAll() {
  for (const s of sticks) s.reset();
  touch.held.clear();
  for (const b of btns) b.el.classList.remove('down');
}

// Einmal pro Frame aus pollGamepad: Sichtbarkeit und Icons der Slots
export function updateTouch() {
  if (!layer) return;
  const show = !state.paused && !menuOpen() && !player.dead;
  if (layer.hidden === show) { layer.hidden = !show; if (!show) releaseAll(); }
  if (!show) return;
  btns.forEach(b => {
    const spell = state.slots[SPELL_ACTIONS.indexOf(b.action)] ?? null;
    if (spell === b.spell) return;
    b.spell = spell;
    b.el.className = `tbtn ${spell ? SPELLS[spell].cls : 'empty'}`;
    b.el.style.backgroundImage = spell && ICONS[spell] ? `url(${ICONS[spell]})` : '';
    b.el.textContent = spell && !ICONS[spell] ? SPELLS[spell].name : '';
  });
}

// Hinweis oben: Die Touch-Steuerung ist noch nicht fertig. Antippen blendet ihn aus.
function banner() {
  const el = document.createElement('div');
  el.id = 'mobileBanner';
  el.textContent = 'Handy-Steuerung noch buggy – in Arbeit. Am PC spielt es sich besser. ✕';
  Object.assign(el.style, { position: 'fixed', top: '0', left: '50%', transform: 'translateX(-50%)', zIndex: '30', maxWidth: '92%',
    padding: '6px 14px', background: '#7a1a10ee', color: '#fff3d6', border: '1px solid #f2c94c', borderTop: 'none', borderRadius: '0 0 8px 8px',
    font: '600 13px system-ui, sans-serif', textAlign: 'center', cursor: 'pointer' });
  el.addEventListener('click', () => el.remove());
  el.addEventListener('touchend', e => { e.preventDefault(); el.remove(); });
  document.body.appendChild(el);
}

if (device.mobile) { build(); banner(); }
