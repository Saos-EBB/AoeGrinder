// Arkan-Optik aus dem Spell-Viewer (SPELLS.arcane), soweit andere Figuren sie nutzen: Woge (Seuche), Blink-Puff, Getränke des ?-Magiers.
// Der Rest der Arkan-Figur liegt geparkt in maybeLater/src/vfx/arcaneLook.parked.ts. Nur Optik, alle Zahlen // PH

import * as THREE from 'three';
import { player } from '../state';
import { fx, em, uK, lay, boom, sparks, env, outC, rnd, clamp, PAL, EU, after } from './energy';
import { gy, onGround } from './fireLook';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const chestOf = (p: THREE.Vector3) => V(p.x, p.y + 1.1, p.z);

// Arkane Woge: Wellen-Segment läuft nach vorn
export function surgeLook(from: THREE.Vector3, len: number, width: number, pal = PAL.arcane) {
  const o = onGround(from), yaw = player.facing, open = clamp(width / len, .4, 1.2);
  fx(1, (k, dt, e) => {
    if (!e.ms.length) { const w = em(e, 'wave', pal, { sc: 2.2 / Math.max(1, len * .15), core: .1, tip: 1, flow: [0, 0, -6], side: THREE.DoubleSide }); w.position.copy(o); w.rotation.y = yaw; }
    const r = .5 + len * outC(k), w = e.ms[0]; w.scale.set(r * open, 2 * (1 - k * .5), r); uK(w, 1 - k * k);
    if (Math.random() < dt * 30) { const a = yaw + rnd(-.8, .8) * open; sparks(V(o.x + Math.sin(a) * r, o.y + .3, o.z + Math.cos(a) * r), 1, pal, { v: [0, 1.5, 0], grav: 4, life: .5, spread: .2 }); }
  });
}
// Blink: Arkan-Puff am Start und Ziel
export function blinkLook(from: THREE.Vector3, to: THREE.Vector3) {
  boom(chestOf(from), 1.1, PAL.arcane, .35, { ground: gy(from), n: 15 });
  after(.05, () => boom(chestOf(to), 1.1, PAL.arcane, .35, { ground: gy(to), n: 15 }));
}
// ?-Magier, Drink Something: farbiger Ring und Säule je Getränk, solange er sitzt (Goldbecher und Feuerschnaps Feuer, Heiße Tasse Frost, Tee-Schale Arkan)
const DRINK_PAL = { gold: PAL.fire, schnaps: PAL.fire, tasse: PAL.ice, tee: PAL.arcane };
export function drinkLook(kind: string, ms: number) {
  const pal = DRINK_PAL[kind] ?? PAL.arcane;
  fx(ms / 1000, (k, _dt, e) => {
    if (!e.ms.length) { em(e, 'gring', pal, { sc: 3, core: 0, flow: [0, 0, 0] }); em(e, 'cyl', pal, { sc: 3, core: -.4, tip: 1.2, flow: [0, 2, 0], side: THREE.DoubleSide }); }
    const o = onGround(player.pos), T = EU.uTime.value;
    lay(e.ms[0], o, 1.4 + .12 * Math.sin(T * 6)); e.ms[1].position.copy(o); e.ms[1].scale.set(1.1, 2.6 * env(k, .2, .3), 1.1);
    for (const m of e.ms) uK(m, env(k, .2, .2) * .8);
  });
}
