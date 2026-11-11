// Explosiv-Fässer: reagieren auf das Element des Treffers (objects.ts elementOf): Feuer = Explosion + Brand, Frost = Eis-Nova (Slow),
// Blitz = Kette auf 5 Ziele, Seuche = Giftwolke 5 s, Nahkampf/sonst = Explosion + Rückstoß. Lösen Fässer in Reichweite aus (Kettenreaktion,
// gleiches Element). Treffen auch den Spieler, mit halber Wucht. Schaden fest (wie Umgebung, burnMob): Anteil des Mob-Lebens auf dem Level. Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from '../state';
import { mobMaxHp, maxHp } from '../formulas';
import { hpMulOf } from '../mapgen/difficulty';
import { zone } from '../world';
import { burnMob, knockbackMob } from '../mobs';
import { damagePlayer } from '../player/damage';
import { applySlow, schedule } from '../spells/core';
import { burstFx, boltFx } from '../spells/fx';
import { ringFx } from '../fx/spellFx';
import { particles } from '../fx/particles';
import { addTrauma } from '../wucht';
import { colored } from '../mapgen/build';
import { registerKind, planObjects, removeObj, objects, addDevButton, devAhead, spawnObj, type Obj, type Element } from './objects';
import { dist2d, rand } from '../util';

export const BARREL = {
  perMap: 8,
  r: 5, chainR: 6, chainMs: 160,           // yd Wirkradius, Kettenreichweite, Verzögerung pro Glied
  dmg: 0.6,                                // × Mob-Leben auf dem Spielerlevel (inkl. Theme-Schwierigkeit)
  player: 0.12,                            // × Spieler-Leben, das ist schon die halbe Wucht (Handoff: Spieler halber Schaden)
  burn: { ticks: 3, part: 0.15 },          // Feuer: 3 Ticks à 15 % nach der Explosion
  frost: { slow: 0.6, ms: 4000, dmg: 0.3 },
  blitz: { n: 5, yd: 14, dmg: 0.8 },
  seuche: { ms: 5000, tickMs: 500, r: 4.5, part: 0.08 },
  knock: 5,
  colors: {
    feuer: [[2.6, 0.9, 0.2], [2.0, 0.4, 0.1]], frost: [[0.6, 1.6, 2.8], [1.4, 2.2, 2.8]], blitz: [[1.8, 1.8, 2.8], [2.4, 2.4, 1.2]],
    seuche: [[0.8, 2.2, 0.4], [0.5, 1.4, 0.2]], nah: [[2.2, 1.2, 0.5], [1.6, 0.8, 0.4]],
  } as Record<Element, number[][]>,
};

function body() {
  const b = new THREE.CylinderGeometry(0.5, 0.5, 1.15, 12).translate(0, 0.575, 0);
  const bulge = new THREE.CylinderGeometry(0.56, 0.56, 0.5, 12).translate(0, 0.575, 0);
  const r1 = new THREE.CylinderGeometry(0.575, 0.575, 0.08, 12).translate(0, 0.25, 0), r2 = new THREE.CylinderGeometry(0.575, 0.575, 0.08, 12).translate(0, 0.9, 0);
  const mark = new THREE.BoxGeometry(0.34, 0.34, 0.06).rotateZ(Math.PI / 4).translate(0, 0.6, 0.56);
  return colored([[b, 0x8a2a1c], [bulge, 0x9a3020], [r1, 0x2a2420], [r2, 0x2a2420], [mark, 0xf0c040]]);
}

const mobDmg = (k: number) => mobMaxHp(player.level) * hpMulOf(zone.theme) * BARREL.dmg * k;
const mobsNear = (p: { x: number; z: number }, r: number) => state.mobs.filter(m => !m.dead && dist2d(m.pos, p) <= r);   // nicht mobsInRadius: das würde Fässer erneut auslösen
function hurtPlayer(p: { x: number; z: number }, r: number, k = 1) {
  if (!player.dead && dist2d(player.pos, p) <= r) damagePlayer(Math.round(maxHp() * BARREL.player * k), false, 'barrel');
}

export function explode(o: Obj, el: Element) {
  if (!o.alive) return;
  removeObj(o);
  const pos = new THREE.Vector3(o.x, o.y + 0.5, o.z), C = BARREL.colors[el], R = BARREL.r;
  burstFx(pos, R, C, el === 'frost' ? 0x9fd8ff : el === 'seuche' ? 0x8aff60 : el === 'blitz' ? 0xccccff : 0xffa040);
  addTrauma(0.25);
  if (el === 'blitz') {
    const list = mobsNear(o, BARREL.blitz.yd).sort((a, b) => dist2d(a.pos, o) - dist2d(b.pos, o)).slice(0, BARREL.blitz.n);
    let from = pos;
    for (const m of list) { boltFx(from, m.pos); burnMob(m, Math.round(mobDmg(BARREL.blitz.dmg))); from = m.pos; }
    hurtPlayer(o, 2.5);
  } else if (el === 'seuche') {
    const S = BARREL.seuche, end = state.now + S.ms;
    const tick = () => {
      for (let i = 0; i < 10; i++) particles.spawn({ x: o.x + rand(-S.r, S.r) * 0.8, y: o.y + rand(0.2, 1.4), z: o.z + rand(-S.r, S.r) * 0.8, vy: rand(0.2, 0.8), life: rand(0.6, 1.1), color: C[0], size: rand(0.5, 0.9) });
      for (const m of mobsNear(o, S.r)) burnMob(m, Math.max(1, Math.round(mobDmg(S.part))));
      if (!player.dead && dist2d(player.pos, o) <= S.r) damagePlayer(Math.max(1, Math.round(maxHp() * BARREL.player * S.part)), true, 'barrel');
      if (state.now + S.tickMs <= end) schedule(S.tickMs, tick);
    };
    tick();
  } else {
    const k = el === 'frost' ? BARREL.frost.dmg : 1;
    for (const m of mobsNear(o, R)) {
      burnMob(m, Math.round(mobDmg(k)));
      if (m.dead) continue;
      if (el === 'frost') applySlow(m, BARREL.frost.slow, BARREL.frost.ms);
      if (el === 'nah') knockbackMob(m, pos, BARREL.knock);
    }
    if (el === 'frost') ringFx(pos, R * 1.2, C[1], 600);
    if (el === 'feuer') for (let n = 1; n <= BARREL.burn.ticks; n++) schedule(n * 1000, () => { for (const m of mobsNear(o, R)) burnMob(m, Math.max(1, Math.round(mobDmg(BARREL.burn.part)))); });
    hurtPlayer(o, R, el === 'frost' ? BARREL.frost.dmg : 1);
  }
  // Kettenreaktion: Fässer in Reichweite, gleiches Element
  for (const b of objects()) if (b.alive && b.kind.id === 'barrel' && dist2d(b, o) <= BARREL.chainR) schedule(BARREL.chainMs, () => explode(b, el));
}

registerKind({
  id: 'barrel', name: 'Explosiv-Fass', reserve: 16, radius: 0.7, body,
  init(o, rng) { o.s = rng.range(0.92, 1.08); },
  onHit: (o, el) => explode(o, el),
});
planObjects({ kind: 'barrel', n: BARREL.perMap, place: 'nearPacks' });

// Dev: 8 Fässer im Ring vor dir, Abstand < chainR, dann das erste mit Feuer
for (const el of ['feuer', 'frost', 'blitz', 'seuche', 'nah'] as Element[]) addDevButton(`8 Fässer ${el}`, () => {
  const c = devAhead(10), list: Obj[] = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, o = spawnObj('barrel', c.x + Math.cos(a) * 4, c.z + Math.sin(a) * 4); if (o) list.push(o); }
  if (list[0]) schedule(400, () => explode(list[0], el));
});
(window as any).__barrels = { BARREL, explode };
