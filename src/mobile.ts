// Handy und Tablet: feste Kamera von schräg oben (camera.ts), Touch-Steuerung im Stil von Wild Rift.
// Links: Lauf-Stick, daneben Blink, Relikt, Trinken. Rechts unten: die 5 Zauber im Bogen, dazu Ausweichen.
// Zauber: kurz tippen = Schnellzauber auf das nächste Ziel, Taste ziehen = zielen, loslassen = zaubern, auf ✕ loslassen = abbrechen.
// Welche Taste welchen Zauber trägt, ist die Leisten-Reihenfolge (hotbar.ts), einstellbar unter Einstellungen → Steuerung.

import { spellAtAction, slotAt, posOf, swapPos } from './hotbar';
import { state, player } from './state';
import { SPELLS, SPELL_ACTIONS } from './config';
import { ICONS } from './ui/icons';
import { openPause, menuOpen } from './ui/mainMenu';
import { device, goFullscreen, toView } from './device';
import { blizCursor } from './fx/spellFx';
import { groundAt, SKY } from './collision';
import { isGround, castSpell } from './spells';
import { cdEnd, chargesOf, paysLife } from './spells/core';
import { manaCost, spellCd } from './formulas';
import { cam, MOBILE_YAW } from './camera';
import * as THREE from 'three';

export const touch = {
  move: { x: 0, y: 0 },        // wie pad.move: x rechts, y vorwärts (auf dem Bildschirm nach oben)
  look: { x: 0, y: 0 },        // bleibt 0: die Kamera steht fest
  held: new Set<string>(),     // gehaltene Pad-Aktionen (nur noch Ausweichen)
  aiming: false,               // eine Zauber-Taste wird gezogen: gamepad.ts bricht das Zielen dann nicht ab
};

const STICK_R = 60;            // px, Ausschlag bis voll // PH
const AIM_R = 90;              // px Ziehen bis volle Reichweite // PH
const DRAG_PX = 14;            // ab hier ist es Ziehen statt Tippen // PH
const QUICK_YD = 30;           // Schnellzauber sucht das nächste Ziel in diesem Umkreis // PH

// Rechts: 5 Zauber (Leistenplätze 0–4), links: Trinken, Blink, Relikt (Plätze 5–7)
const RIGHT = SPELL_ACTIONS.slice(0, 5), LEFT = SPELL_ACTIONS.slice(5);
const POS_NAMES = ['Zauber 1 (groß)', 'Zauber 2', 'Zauber 3', 'Zauber 4', 'Zauber 5', 'Links 1', 'Links 2', 'Links 3'];

// Bildschirm-Richtung (x rechts, y unten) → Welt-Richtung bei fester Kamera
function worldDir(dx: number, dy: number) {
  const fwd = -dy, right = dx, y = MOBILE_YAW;
  return { x: Math.sin(y) * fwd - Math.cos(y) * right, z: Math.cos(y) * fwd + Math.sin(y) * right };
}

function nearestMob() {
  let best = null, bd = QUICK_YD * QUICK_YD;
  for (const m of state.mobs) {
    if (m.dead || m.hidden) continue;
    const d = (m.pos.x - player.pos.x) ** 2 + (m.pos.z - player.pos.z) ** 2;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

// ---------- Lauf-Stick: erscheint unter dem Daumen ----------
function stick() {
  const zone = document.createElement('div'), base = document.createElement('div'), knob = document.createElement('div');
  zone.className = 'tzone';
  base.className = 'tbase';
  knob.className = 'tknob';
  base.appendChild(knob);
  zone.appendChild(base);
  const out = touch.move;
  let id = -1, ox = 0, oy = 0;
  const reset = () => { id = -1; out.x = out.y = 0; knob.style.transform = ''; base.style.cssText = ''; };
  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (id >= 0) return;
    const t = e.changedTouches[0], v = toView(t.clientX, t.clientY);   // in Seiten-Koordinaten, auch bei gedrehter Seite
    const r = zone.getBoundingClientRect(), z = toView(r.left, r.top);
    id = t.identifier; ox = v.x; oy = v.y;
    base.style.left = `${ox - z.x}px`; base.style.top = `${oy - z.y}px`; base.style.bottom = 'auto'; base.style.margin = '-60px 0 0 -60px';
  }, { passive: false });
  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      const v = toView(t.clientX, t.clientY);
      let dx = v.x - ox, dy = v.y - oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      out.x = dx / STICK_R;
      out.y = -dy / STICK_R;
    }
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === id) reset(); };
  zone.addEventListener('touchend', end);
  zone.addEventListener('touchcancel', end);
  return { zone, reset };
}

// ---------- Zauber-Tasten: tippen oder ziehen ----------
let cancelEl: HTMLElement;
const overCancel = (x: number, y: number) => {
  const r = cancelEl.getBoundingClientRect(), a = toView(r.left, r.top), b = toView(r.right, r.bottom);
  return x >= Math.min(a.x, b.x) - 10 && x <= Math.max(a.x, b.x) + 10 && y >= Math.min(a.y, b.y) - 10 && y <= Math.max(a.y, b.y) + 10;
};
function stopAim() {
  touch.aiming = false;
  state.padAim = null;
  player.targeting = false;
  blizCursor.visible = false;
  cancelEl.hidden = true;
}
const groundSpell = (id: string) => isGround(id);   // auch ?-Magier: die Kategorie meldet, ob der nächste Wurf ein Bodenziel ist
const rangeOf = (id: string) => (SPELLS[id].range ?? 30) * 0.97;

function quickCast(id: string) {
  const m = nearestMob();
  if (groundSpell(id)) {
    const r = rangeOf(id), f = player.facing;
    let x = player.pos.x + Math.sin(f) * Math.min(12, r), z = player.pos.z + Math.cos(f) * Math.min(12, r);
    if (m && Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z) <= r) { x = m.pos.x; z = m.pos.z; }
    return castSpell(id, new THREE.Vector3(x, groundAt(x, z, SKY), z));
  }
  if (m) player.facing = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
  castSpell(id);
}

type Btn = { el: HTMLElement, action: string, spell: string | null, size: string, label: HTMLElement, cd: HTMLElement, cdText: HTMLElement, charges: HTMLElement, shown: string };
const btns: Btn[] = [];
const part = (el: HTMLElement, cls: string) => el.appendChild(Object.assign(document.createElement('span'), { className: cls }));
function spellButton(action: string, cls: string) {
  const el = document.createElement('div');
  el.className = 'tbtn ' + cls;
  const label = part(el, 'tlabel'), cd = part(el, 'tcd'), cdText = part(el, 'tcdText'), charges = part(el, 'tcharges');
  let id = -1, ox = 0, oy = 0, aiming = false, spell: string = null, aimDir = { x: 0, z: 1 }, aimLen = 0;
  el.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (id >= 0 || state.paused || player.dead) return;
    const t = e.changedTouches[0], v = toView(t.clientX, t.clientY);
    spell = spellAtAction(action);
    if (!spell) return;
    id = t.identifier; ox = v.x; oy = v.y; aiming = false;
    el.classList.add('down');
  }, { passive: false });
  el.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      const v = toView(t.clientX, t.clientY), dx = v.x - ox, dy = v.y - oy, d = Math.hypot(dx, dy);
      if (!aiming && d < DRAG_PX) continue;
      if (!aiming) { aiming = true; touch.aiming = true; cancelEl.hidden = false; if (groundSpell(spell)) { player.targeting = spell; blizCursor.visible = true; } }
      const w = worldDir(dx, dy), wl = Math.hypot(w.x, w.z) || 1;
      aimDir = { x: w.x / wl, z: w.z / wl };
      aimLen = Math.min(1, d / AIM_R);
      cancelEl.classList.toggle('hot', overCancel(v.x, v.y));
      if (groundSpell(spell)) {
        const r = rangeOf(spell) * aimLen, x = player.pos.x + aimDir.x * r, z = player.pos.z + aimDir.z * r;
        state.padAim = new THREE.Vector3(x, groundAt(x, z, SKY), z);
      } else player.facing = Math.atan2(aimDir.x, aimDir.z);
    }
  }, { passive: false });
  const end = (e, cancelled = false) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      id = -1;
      el.classList.remove('down');
      const v = toView(t.clientX, t.clientY);
      if (!aiming) { if (!cancelled) quickCast(spell); continue; }
      const point = state.padAim, abort = cancelled || overCancel(v.x, v.y);
      stopAim();
      cancelEl.classList.remove('hot');
      if (abort) continue;
      if (groundSpell(spell)) castSpell(spell, point);
      else { player.facing = Math.atan2(aimDir.x, aimDir.z); castSpell(spell); }
    }
  };
  el.addEventListener('touchend', e => end(e));
  el.addEventListener('touchcancel', e => end(e, true));
  btns.push({ el, action, spell: undefined, size: cls, label, cd, cdText, charges, shown: '' });
  return el;
}

// Ausweichen: läuft als Pad-Aktion über gamepad.ts
function dodgeButton() {
  const el = document.createElement('div');
  el.className = 'tbtn tDodge';
  el.innerHTML = 'Aus-<br>weichen';
  const on = e => { e.preventDefault(); e.stopPropagation(); touch.held.add('dodge'); el.classList.add('down'); };
  const off = e => { e.preventDefault(); touch.held.delete('dodge'); el.classList.remove('down'); };
  el.addEventListener('touchstart', on, { passive: false });
  el.addEventListener('touchend', off);
  el.addEventListener('touchcancel', off);
  return el;
}

// Bogen um eine Ecke: Winkel in Grad (0 = waagrecht nach innen, 90 = nach oben), Abstand in px
const place = (el: HTMLElement, side: 'left' | 'right', a: number, r: number, size: number, cx: number, cy: number) => {
  const rad = a * Math.PI / 180, x = cx + Math.cos(rad) * r - size / 2, y = cy + Math.sin(rad) * r - size / 2;
  el.style.width = el.style.height = `${size}px`;
  el.style[side] = `calc(env(safe-area-inset-${side}, 0px) + ${x}px)`;
  el.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${y}px)`;
};

let layer: HTMLElement, joy: ReturnType<typeof stick>;
function build() {
  layer = document.createElement('div');
  layer.id = 'touchLayer';
  joy = stick();
  layer.appendChild(joy.zone);
  // Rechts: großer Zauber 1 in der Ecke, 2–5 im Bogen darum, Ausweichen ganz links unten im Bogen
  const R = { cx: 70, cy: 64 };
  RIGHT.forEach((a, i) => {
    const el = spellButton(a, i === 0 ? 'big' : '');
    if (i === 0) place(el, 'right', 0, 0, 92, R.cx, R.cy);
    else place(el, 'right', [0, 30, 60, 90][i - 1], 112, 62, R.cx, R.cy);
    layer.appendChild(el);
  });
  const dodge = dodgeButton();
  place(dodge, 'right', -8, 196, 58, R.cx, R.cy);
  layer.appendChild(dodge);
  // Links: Trinken, Blink, Relikt im Bogen rechts über dem Stick
  const L = { cx: 110, cy: 96 };
  LEFT.forEach((a, i) => {
    const el = spellButton(a, 'small');
    place(el, 'left', [8, 42, 76][i], 128, 54, L.cx, L.cy);
    layer.appendChild(el);
  });
  cancelEl = document.createElement('div');
  cancelEl.id = 'tCancel';
  cancelEl.textContent = '✕';
  cancelEl.hidden = true;
  layer.appendChild(cancelEl);
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
  joy.reset();
  touch.held.clear();
  if (touch.aiming) stopAim();
  for (const b of btns) b.el.classList.remove('down');
}

// Einmal pro Frame aus pollGamepad: Sichtbarkeit und Icons der Tasten
export function updateTouch() {
  if (!layer) return;
  const show = !state.paused && !menuOpen() && !player.dead;
  if (layer.hidden === show) { layer.hidden = !show; if (!show) releaseAll(); }
  if (!show) return;
  cam.dist = zoomDist;                                 // Menü und dunkel.ts setzen eigene Abstände, im Run gilt der Zoom aus den Einstellungen
  btns.forEach(b => {
    const spell = spellAtAction(b.action);
    if (spell !== b.spell) {
      b.spell = spell;
      b.el.className = `tbtn ${b.size} ${spell ? SPELLS[spell].cls ?? '' : 'empty'}`;
      b.el.style.backgroundImage = spell && ICONS[spell] ? `url(${ICONS[spell]})` : '';
      b.label.textContent = spell && !ICONS[spell] ? SPELLS[spell].name : '';
    }
    if (spell) showCd(b, spell);
  });
}

// Abklingzeit wie an der Leiste (ui/hud.ts): dunkler Kreisausschnitt, ab 1,5 s Restzeit die Sekunden; dazu Ladungen und „kein Mana“
function showCd(b: Btn, id: string) {
  const end = cdEnd(id), left = Math.max(0, end - state.now), total = spellCd(id) || 1;
  const pct = Math.min(100, left / total * 100), n = chargesOf(id) ?? 0;
  const ready = n > 1 ? (player.charges[id] ? player.charges[id].filter(t => t <= state.now).length : n) : -1;
  const key = `${Math.round(pct)}|${left > 1500 ? Math.ceil(left / 1000) : ''}|${ready}`;
  if (key !== b.shown) {
    b.shown = key;
    b.cd.style.background = pct > 0 ? `conic-gradient(#000b ${pct}%, transparent 0)` : 'none';
    b.cdText.textContent = left > 1500 ? String(Math.ceil(left / 1000)) : '';
    b.charges.textContent = ready >= 0 ? String(ready) : '';
  }
  b.el.classList.toggle('nomana', !paysLife(id) && player.mana < manaCost(id));
}

// ---------- Einstellungen → Steuerung: Zoom und Tastenbelegung ----------
const ZOOM_STORE = 'frostgrind.mobilezoom.v1';
export const ZOOM = { min: 7, max: 14, def: 10 };   // PH: Kameraabstand in yd, dunkel.ts deckelt bei 14
let zoomDist = ZOOM.def;
function loadZoom() {
  try { zoomDist = Number(localStorage.getItem(ZOOM_STORE)) || ZOOM.def; } catch { /* kein Storage */ }
  zoomDist = Math.min(ZOOM.max, Math.max(ZOOM.min, zoomDist));
}
function settings() {
  const box = document.getElementById('setSteuerung');
  if (!box) return;
  const sec = document.createElement('div');
  sec.id = 'setMobile';
  const zoom = Object.assign(document.createElement('input'), { type: 'range', min: ZOOM.min, max: ZOOM.max, step: 1, value: String(zoomDist), id: 'setMobileZoom' });
  zoom.addEventListener('input', () => { zoomDist = +zoom.value; try { localStorage.setItem(ZOOM_STORE, zoom.value); } catch { /* egal */ } });
  const zrow = document.createElement('label');
  zrow.className = 'setRow';
  zrow.append(Object.assign(document.createElement('span'), { textContent: 'Zoom (nah ↔ weit)' }), zoom);
  const list = document.createElement('div');
  list.id = 'setMobileSlots';
  // Jede Taste wählt einen Zauber der Leiste. Wählen tauscht mit der Taste, die ihn bisher hatte.
  const render = () => {
    list.textContent = '';
    POS_NAMES.forEach((name, pos) => {
      const sel = document.createElement('select');
      sel.className = 'setSelect';
      sel.id = `setMobileSlot${pos}`;
      for (let slot = 0; slot < SPELL_ACTIONS.length; slot++) {
        const id = state.slots[slot];
        sel.add(new Option(id ? SPELLS[id].name : `leer (Slot ${slot + 1})`, String(slot)));
      }
      sel.value = String(slotAt(pos));
      sel.addEventListener('change', () => { swapPos(pos, posOf(+sel.value)); render(); });
      const r = document.createElement('label');
      r.className = 'setRow';
      r.append(Object.assign(document.createElement('span'), { textContent: name }), sel);
      list.appendChild(r);
    });
  };
  render();
  new MutationObserver(() => { if (document.getElementById('settingsModal').classList.contains('show')) render(); })
    .observe(document.getElementById('settingsModal'), { attributes: true, attributeFilter: ['class'] });
  sec.append(Object.assign(document.createElement('h2'), { textContent: 'Handy' }), zrow,
    Object.assign(document.createElement('h3'), { className: 'setH3', textContent: 'Tastenbelegung' }), list);
  box.prepend(sec);
}

if (device.mobile) { build(); loadZoom(); settings(); }
