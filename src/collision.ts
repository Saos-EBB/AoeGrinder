// Kollision: Kreise, gedrehte Boxen, begehbare Flächen, alle mit Höhe. Spec: docs/map-audit.md
// Jede Oberkante trägt, wenn man sie erreicht; darunter blockiert das Objekt, wenn sie mehr als eine Stufe über den Füßen liegt.

import { CFG } from './config';
import { clamp } from './util';

export const STEP = 0.6;       // PH: Stufenhöhe in yd
export const BODY_HEIGHT = 2;  // PH: Körperhöhe von Spieler und Mobs
const CELL = 8;                // PH: Rastergröße in yd

export const colliders = [];
const routes = [];
const grid = new Map();
let terrain = (x, z) => 0;
let stamp = 0;
const found = [];

export function clearColliders(terrainHeight) {
  terrain = terrainHeight;
  colliders.length = 0;
  routes.length = 0;
  grid.clear();
}

const cellKey = (ix, iz) => (ix + 512) * 1024 + iz + 512;

function add(c, reach) {
  c.seen = 0;
  colliders.push(c);
  for (let ix = Math.floor((c.x - reach) / CELL); ix <= Math.floor((c.x + reach) / CELL); ix++) {
    for (let iz = Math.floor((c.z - reach) / CELL); iz <= Math.floor((c.z + reach) / CELL); iz++) {
      const key = cellKey(ix, iz);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(c);
    }
  }
  return c;
}

// top und height sind absolute Höhen; bottom nur bei Dingen, unter denen man durchgehen kann
export const addCircle = (x, z, r, top = Infinity, bottom = -Infinity) => add({ kind: 'circle', x, z, r, top, bottom }, r);

const boxShape = (x, z, w, d, ry) => ({ x, z, hw: w / 2, hd: d / 2, cos: Math.cos(ry), sin: Math.sin(ry) });
export const addBox = (x, z, w, d, ry, top = Infinity, bottom = -Infinity) => add({ kind: 'box', ...boxShape(x, z, w, d, ry), top, bottom }, Math.hypot(w, d) / 2);

// Plattform oder Rampe: height(x, z) ist die Lauffläche. solid: Seiten blockieren, sonst nur Boden unter den Füßen.
export const addWalk = (x, z, w, d, ry, height, solid = true) => add({ kind: 'walk', ...boxShape(x, z, w, d, ry), height, solid, bottom: -Infinity }, Math.hypot(w, d) / 2);

// Collider, deren Raster-Zellen den Kreis um x, z berühren. Der Puffer gilt bis zum nächsten Aufruf.
function near(x, z, r) {
  stamp++;
  found.length = 0;
  for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++) {
    for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
      const cell = grid.get(cellKey(ix, iz));
      if (!cell) continue;
      for (const c of cell) if (c.seen !== stamp) { c.seen = stamp; found.push(c); }
    }
  }
  return found;
}

const topAt = (c, x, z) => c.height ? c.height(x, z) : c.top;

function contains(c, x, z) {
  const dx = x - c.x, dz = z - c.z;
  if (c.kind === 'circle') return dx * dx + dz * dz <= c.r * c.r;
  return Math.abs(dx * c.cos - dz * c.sin) <= c.hw && Math.abs(dx * c.sin + dz * c.cos) <= c.hd;
}

// Höchste Fläche unter dem Punkt, die man von currentY aus erreicht (Gelände oder Objekt)
export function groundAt(x, z, currentY) {
  let ground = terrain(x, z);
  for (const c of near(x, z, 0)) {
    if (!contains(c, x, z)) continue;
    const h = topAt(c, x, z);
    if (h > ground && h <= currentY + STEP) ground = h;
  }
  return ground;
}

// Schiebt pos aus diesem Collider, gibt zurück, ob er geschoben hat
function push(c, pos, radius) {
  const dx = pos.x - c.x, dz = pos.z - c.z;
  if (c.kind === 'circle') {
    const d = Math.hypot(dx, dz), min = c.r + radius;
    if (d >= min || pos.y + STEP >= c.top) return false;
    const nx = d > 0.0001 ? dx / d : 1, nz = d > 0.0001 ? dz / d : 0;
    pos.x = c.x + nx * min;
    pos.z = c.z + nz * min;
    return true;
  }
  const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
  const cx = clamp(lx, -c.hw, c.hw), cz = clamp(lz, -c.hd, c.hd);
  const ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz);
  if (d >= radius) return false;
  const top = c.height ? c.height(c.x + cx * c.cos + cz * c.sin, c.z - cx * c.sin + cz * c.cos) : c.top;
  if (pos.y + STEP >= top) return false;
  let px, pz;
  if (d > 0.0001) {                         // außen: von der nächsten Kante weg
    px = ox / d * (radius - d);
    pz = oz / d * (radius - d);
  } else {                                  // innen: über die nächste Kante raus
    const exitX = c.hw - Math.abs(lx), exitZ = c.hd - Math.abs(lz);
    px = exitX < exitZ ? (lx >= 0 ? 1 : -1) * (exitX + radius) : 0;
    pz = exitX < exitZ ? 0 : (lz >= 0 ? 1 : -1) * (exitZ + radius);
  }
  pos.x += px * c.cos + pz * c.sin;
  pos.z += -px * c.sin + pz * c.cos;
  return true;
}

// Schiebt aus Kreisen und Boxen; was parallel zur Kante läuft, bleibt erhalten und gleitet. Gibt den letzten Collider zurück, der geschoben hat.
export function resolve(pos, radius, height = BODY_HEIGHT) {
  let hit = null;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const c of near(pos.x, pos.z, radius)) {
      if (c.kind === 'walk' && !c.solid) continue;
      if (pos.y + height <= c.bottom) continue;
      if (push(c, pos, radius)) { hit = c; moved = true; }
    }
    if (!moved) break;
  }
  const r = Math.hypot(pos.x, pos.z);
  if (r > CFG.playRadius) { pos.x *= CFG.playRadius / r; pos.z *= CFG.playRadius / r; }
  return hit;
}

// Nächster Punkt des Colliders zu pos
const nearest = { x: 0, z: 0 };
function closest(c, pos) {
  const dx = pos.x - c.x, dz = pos.z - c.z;
  if (c.kind === 'circle') {
    const d = Math.hypot(dx, dz) || 1;
    nearest.x = c.x + dx / d * c.r;
    nearest.z = c.z + dz / d * c.r;
    return nearest;
  }
  const cx = clamp(dx * c.cos - dz * c.sin, -c.hw, c.hw), cz = clamp(dx * c.sin + dz * c.cos, -c.hd, c.hd);
  nearest.x = c.x + cx * c.cos + cz * c.sin;
  nearest.z = c.z - cx * c.sin + cz * c.cos;
  return nearest;
}

// Ausweichen ohne Pathfinding: Liegt ein Hindernis voraus, läuft body an seiner Tangente entlang.
// Die Seite bleibt, bis der Weg zum Ziel frei ist, sonst pendelt er vor langen Wänden.
const STUCK_CALLS = 20, STUCK_DIST = 0.5, ESCAPE_CALLS = 45, ESCAPE_ANGLE = 2.1;   // PH
const LOOKAHEAD = 0.4;   // PH: kurz genug, dass eine steile Rampe voraus nicht als Wand zählt
const probe = { x: 0, y: 0, z: 0 }, steered = { x: 0, z: 0 };
export function steer(body, dx, dz, radius) {
  if (body.escape > 0) {                     // Ausbruch aus einer Nische: schräg zurück
    body.escape--;
    const a = ESCAPE_ANGLE * body.escapeSide;
    steered.x = dx * Math.cos(a) - dz * Math.sin(a);
    steered.z = dx * Math.sin(a) + dz * Math.cos(a);
    return steered;
  }
  body.stuckCalls = (body.stuckCalls ?? 0) + 1;
  if (body.stuckCalls >= STUCK_CALLS) {      // kaum vom Fleck gekommen: Ausbruch, jedes Mal zur anderen Seite
    const stuck = Math.hypot(body.pos.x - (body.stuckX ?? Infinity), body.pos.z - body.stuckZ) < STUCK_DIST;
    body.stuckX = body.pos.x; body.stuckZ = body.pos.z; body.stuckCalls = 0;
    if (stuck) { body.escape = ESCAPE_CALLS; body.escapeSide = -(body.escapeSide ?? 1); body.steerSide = 0; }
  }
  probe.x = body.pos.x + dx * LOOKAHEAD;
  probe.z = body.pos.z + dz * LOOKAHEAD;
  probe.y = groundAt(probe.x, probe.z, body.pos.y);   // auf einer Rampe liegt der Fuß dort schon höher
  steered.x = dx; steered.z = dz;
  const hit = resolve(probe, radius);
  if (!hit) { body.steerSide = 0; return steered; }
  // Normale vom Körper aus, nicht von der Vorausschau: Die steckt an Ecken schon im Objekt
  const n = closest(hit, body.pos), nx = body.pos.x - n.x, nz = body.pos.z - n.z, len = Math.hypot(nx, nz);
  if (len < 0.0001) return steered;
  const tx = -nz / len, tz = nx / len;
  body.steerSide ||= tx * dx + tz * dz >= 0 ? 1 : -1;
  steered.x = tx * body.steerSide;
  steered.z = tz * body.steerSide;
  return steered;
}

// Aufstieg: points [{x, y, z}] vom Fuß nach oben, Abstand unter einer Stufe, area: Kreis um x, z, in dem das Ziel auf dem Bauwerk steht.
// Kein Pathfinding, eine feste Spur je Treppe. Ohne sie käme kein Mob auf eine Wendeltreppe.
export const addRoute = (x, z, r, points) => routes.push({ x, z, r, points });

// Steht das Ziel höher auf einem Bauwerk, läuft der Mob zum nächsten Punkt der Spur statt direkt zum Ziel
export function climbTarget(pos, target) {
  if (target.y - pos.y <= STEP) return target;
  for (const route of routes) {
    if (Math.hypot(target.x - route.x, target.z - route.z) > route.r) continue;
    // Höchster Punkt, den man von hier erreicht; von hinten führt das erst zum Fuß, nicht zur Spitze
    let i = 0;
    while (i < route.points.length - 1 && route.points[i + 1].y <= pos.y + STEP) i++;
    const p = route.points[i];
    return Math.hypot(p.x - pos.x, p.z - pos.z) < 1.2 ? route.points[Math.min(i + 1, route.points.length - 1)] : p;
  }
  return target;
}

// Boden und Schwerkraft für Körper ohne eigenen Sprung (Mobs): body.vy, body.falling
export function settle(body, radius, dt) {
  const pos = body.pos;
  resolve(pos, radius);
  const ground = groundAt(pos.x, pos.z, pos.y);
  if (!body.falling && pos.y - ground > STEP) { body.falling = true; body.vy = 0; }
  if (!body.falling) { pos.y = ground; return; }
  body.vy -= CFG.gravity * dt / 1000;
  pos.y += body.vy * dt / 1000;
  if (pos.y <= ground) { pos.y = ground; body.vy = 0; body.falling = false; }
}
