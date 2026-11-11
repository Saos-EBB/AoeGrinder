// Kleiner Punkt-Partikelpool einer Figur (Audit E9, DUP-09): Strichmagier (Rauch, Reif, Funken ohne Spiel-Partikel) und Strichkrieger (Staub, Glut, Blut).
// Ein THREE.Points mit festen Plätzen, der älteste Platz wird überschrieben. Zählt die lebenden Punkte: ohne lebende ist das Mesh unsichtbar
// und update tut nichts. floor(): Boden-Höhe, Punkte bleiben darauf liegen (Krieger), sonst fallen sie durch.
// Liegt nicht in fx/particles.ts: das lädt render.ts (Renderer beim Laden) und zöge die Testseite /strich.html und die Modelle in den Spiel-Graph.

import * as THREE from 'three';

export function makePointPool(n: number, size: number, o: { floor?: () => number } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3).fill(-1000), col = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n), grav = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true }));
  points.frustumCulled = false;
  let next = 0, live = 0;
  // Ein Punkt: Lage, Farbe, Geschwindigkeit, Lebensdauer (s), Schwerkraft. Zufall würfelt der Aufrufer (Reihenfolge der Math.random-Aufrufe bleibt seine)
  function put(x: number, y: number, z: number, c: THREE.Color, vx: number, vy: number, vz: number, l: number, g: number) {
    const j = next++ % n;
    if (life[j] <= 0) live++;
    pos.set([x, y, z], j * 3); col.set([c.r, c.g, c.b], j * 3);
    vel.set([vx, vy, vz], j * 3);
    life[j] = l; grav[j] = g;
  }
  function update(dt: number) {
    points.visible = live > 0;
    if (!live) return;
    const fl = o.floor ? o.floor() : null;
    for (let j = 0; j < n; j++) {
      if (life[j] <= 0) continue;
      life[j] -= dt; if (life[j] <= 0) { pos[j * 3 + 1] = -1000; live--; continue; }
      vel[j * 3 + 1] -= grav[j] * dt;
      for (let k = 0; k < 3; k++) pos[j * 3 + k] += vel[j * 3 + k] * dt;
      if (fl !== null && pos[j * 3 + 1] < fl) { pos[j * 3 + 1] = fl; vel[j * 3] *= .5; vel[j * 3 + 2] *= .5; vel[j * 3 + 1] = 0; }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  return { points, put, update };
}
