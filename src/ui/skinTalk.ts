// Sprechblasen und Namensschild der Krieger-Skins als DOM-Overlay (wie die Nameplates), nicht als 3D: kein Draw Call.
// Das Modell meldet mage.hero.talk = { kind: 'whisper' | 'shout', keys, plate?, anchor (Kopf-Bone), on }; Texte über i18n.
// Ausbrecher flüstert (Blasen tauchen um den Kopf auf), Classic-Krieger 55 ruft der Reihe nach und trägt ein Namensschild. Blasen nur im Run, nicht im Hauptmenü.

import * as THREE from 'three';
import { mage } from '../models/mage';
import { screenPos } from './hud';
import { t } from '../i18n';
import './skinTalk.css';

const WHISPER = { every: 2.4, life: 2.6, max: 3, dx: 70, dy: 18, rise: 26, up: .35 };   // Sekunden, Pixel, Meter über dem Kopf // PH
const SHOUT = { every: 4, life: 1.8, up: .62, pop: .15 };                               // PH
const PLATE = { up: .32 };                                                              // PH

const box = document.createElement('div');
box.id = 'skinTalk';
(document.getElementById('overlay') ?? document.body).after(box);
const el = (cls: string) => { const d = document.createElement('div'); d.className = cls; box.append(d); return d; };
const whispers = Array.from({ length: WHISPER.max }, () => ({ d: el('say whisper'), t: -1, a: 0, k: 0 }));
const shout = { d: el('say shout'), t: -1, i: -1 };
const plate = el('tag');

let talk = null, clock = 0, next = 0, last = -1;
const head = new THREE.Vector3();
const hideAll = () => { for (const w of whispers) { w.t = -1; w.d.style.display = 'none'; } shout.t = -1; shout.d.style.display = 'none'; plate.style.display = 'none'; };

// dt in ms (Loop in main.ts)
export function updateSkinTalk(dt: number) {
  const tk = mage.hero?.talk ?? null;
  if (tk !== talk) { talk = tk; hideAll(); clock = 0; next = 1; last = -1; shout.i = -1; if (talk?.plate) plate.textContent = t(talk.plate); }
  if (!talk) return;
  const s = Math.max(0, dt) / 1000;
  clock += s;
  talk.anchor.getWorldPosition(head);
  const show = talk.on && mage.root.visible;
  const at = (d: HTMLElement, up: number, x = 0, y = 0, op = 1, sc = 1) => {
    const p = show && screenPos(head, up);
    if (!p) { d.style.display = 'none'; return; }
    d.style.display = 'block';
    d.style.left = `${p.x + x}px`; d.style.top = `${p.y + y}px`;
    d.style.opacity = String(op);
    d.style.transform = sc === 1 ? '' : `translate(-50%, -100%) scale(${sc})`;
  };
  if (document.body.classList.contains('menu')) {   // Hauptmenü (Figur-Vorschau): keine Sprechblasen, nur im Run; das Namensschild bleibt
    for (const w of whispers) { w.t = -1; w.d.style.display = 'none'; }
    shout.t = -1; shout.d.style.display = 'none'; next = clock + 1;
  } else if (talk.kind === 'whisper') {
    if (clock >= next) {
      next = clock + WHISPER.every * (.7 + Math.random() * .6);
      const w = whispers.find(x => x.t < 0);
      if (w) {
        let k; do k = Math.floor(Math.random() * talk.keys.length); while (talk.keys.length > 1 && k === last);
        last = k; w.t = 0; w.k = k; w.a = Math.random() * Math.PI * 2;
        w.d.textContent = t(talk.keys[k]);
      }
    }
    for (const w of whispers) {
      if (w.t < 0) continue;
      w.t += s;
      const u = w.t / WHISPER.life;
      if (u >= 1) { w.t = -1; w.d.style.display = 'none'; continue; }
      at(w.d, WHISPER.up, Math.cos(w.a) * WHISPER.dx, Math.sin(w.a) * WHISPER.dy - u * WHISPER.rise, Math.sin(u * Math.PI) * .9);
    }
  } else {
    if (clock >= next) { next = clock + SHOUT.every; shout.t = 0; shout.i = (shout.i + 1) % talk.keys.length; shout.d.textContent = t(talk.keys[shout.i]); }
    if (shout.t >= 0) {
      shout.t += s;
      const u = shout.t / SHOUT.life;
      if (u >= 1) { shout.t = -1; shout.d.style.display = 'none'; }
      else at(shout.d, SHOUT.up, 0, -u * 8, 1, 1 + Math.max(0, SHOUT.pop - u));
    }
  }
  if (talk.plate) at(plate, PLATE.up);
}
