// Status-Anzeigen über und unter den Mobs (Vorlage: Ziel-Puppen im Spell-Viewer). Pro Status ein InstancedMesh für alle Mobs:
// Brand (3 Flammenzungen), Arkan-Mal (schwebendes Oktaeder), Betäubt (kreisender Ring), Seuchen-Male (1–3 grüne Kugeln), Festgeklebt (Schleim-Fleck), Gift (Blasen).
// Eisblock, Verlangsamt, Gift- und Fluchtfarbe macht das Mob-Modell selbst (models/creatures.ts). Nur Optik, liest den Mob-Zustand.

import * as THREE from 'three';
import { state } from '../state';
import { scene } from '../render';
import { markStacks, poisoned } from '../plagueMarks';
import { activeModIds } from '../modifiers';
import { eMat, PAL, EU, sparks } from './energy';
import { V } from '../util';

const S = { max: 128, burnY: [.35, .7, .45], markY: .45, stunY: .15, plY: .35, bubbles: 5 };   // PH: höchstens so viele Mobs pro Anzeige, Höhen über dem Kopf in Mob-Höhen

function inst(geo: THREE.BufferGeometry, pal, o, n) {
  const m = new THREE.InstancedMesh(geo, eMat(pal, o), n);
  m.frustumCulled = false; m.count = 0; m.visible = false;
  scene.add(m);
  return m;
}
let L: Record<string, THREE.InstancedMesh> = null;
function build() {
  L = {
    burn: inst(new THREE.ConeGeometry(1, 1, 10, 3, true).translate(0, .5, 0), PAL.fire, { flow: [0, 3, 0], sc: 5, core: .3, tip: 1.2, puff: .04 }, S.max * 3),
    mark: inst(new THREE.OctahedronGeometry(1, 0), PAL.arcane, { flow: [0, 1, 0], sc: 6, core: .8, local: true }, S.max),
    stun: inst(new THREE.TorusGeometry(1, .09, 6, 28).rotateX(Math.PI / 2), PAL.blitz, { flow: [2, 0, 0], sc: 8, core: .3, local: true }, S.max),
    stunW: inst(new THREE.TorusGeometry(1, .09, 6, 28).rotateX(Math.PI / 2), PAL.donner, { flow: [2, 0, 0], sc: 8, core: .3, local: true }, S.max),
    pl: inst(new THREE.SphereGeometry(1, 10, 8), PAL.slime, { sc: 8, core: .9, puff: .1, flow: [0, 1, 0] }, S.max * 3),
    glue: inst(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), PAL.slime, { sc: 3, core: 0, edge: 1.4, flow: [.2, 0, .1] }, S.max),
  };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = V(), _s = V(), _e = new THREE.Euler();
function put(mesh, i, x, y, z, sx, sy = sx, sz = sx, ry = 0) {
  _q.setFromEuler(_e.set(0, ry, 0));
  mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
}

export function updateMobStatus(dt: number) {
  if (!L) build();
  const now = state.now, T = EU.uTime.value, warrior = activeModIds().includes('realmen');
  const n: Record<string, number> = { burn: 0, mark: 0, stun: 0, pl: 0, glue: 0 };
  const stun = warrior ? L.stunW : L.stun;
  for (const m of state.mobs) {
    if (m.dead || m.hidden || !m.model.root.visible) continue;
    const h = m.model.height ?? 2.4, s = h / 2.4, p = m.pos, top = p.y + h;
    if (m.burn && m.burn.until > now && n.burn < S.max * 3 - 2) for (let i = 0; i < 3; i++) {   // Brand: 3 Zungen vor dem Körper
      const a = (i - 1) * .9 + m.model.root.rotation.y, f = 1 + .2 * Math.sin(T * 9 + i * 2 + p.x);
      put(L.burn, n.burn++, p.x + Math.sin(a) * .35 * s, p.y + h * S.burnY[i], p.z + Math.cos(a) * .35 * s, .2 * s, .7 * s * f, .2 * s);
    }
    if (m.markUntil > now && n.mark < S.max) put(L.mark, n.mark++, p.x, top + S.markY * s + .08 * Math.sin(T * 4), p.z, .17 * s, .27 * s, .17 * s, T * 3);
    if (m.rootUntil > now && m.rootLook !== 'ice' && m.rootLook !== 'glue' && n.stun < S.max) put(stun, n.stun++, p.x, top + S.stunY * s, p.z, .32 * s, .32 * s, .32 * s, T * 6);
    if (m.rootUntil > now && m.rootLook === 'glue' && n.glue < S.max) put(L.glue, n.glue++, p.x, p.y + .04, p.z, .75 * s);
    const pl = markStacks(m);
    for (let i = 0; i < pl && n.pl < S.max * 3; i++) put(L.pl, n.pl++, p.x + (i - (pl - 1) / 2) * .22 * s, top + S.plY * s + .05 * Math.sin(T * 5 + i), p.z, .09 * s);
    if (poisoned(m) && Math.random() < dt * S.bubbles) sparks(V(p.x, p.y + h * .6, p.z), 1, Math.random() < .5 ? PAL.gift : PAL.slime, { v: [0, 1, 0], grav: -.2, life: .8, spread: .6 * s, band: 3 });
  }
  const set = (mesh, k) => { mesh.count = k; mesh.visible = k > 0; if (k) mesh.instanceMatrix.needsUpdate = true; };
  set(L.burn, n.burn); set(L.mark, n.mark); set(L.pl, n.pl); set(L.glue, n.glue);
  set(stun, n.stun); set(warrior ? L.stun : L.stunW, 0);
}
