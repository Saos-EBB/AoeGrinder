// Raster des Generators: 8 yd pro Zelle (gleich dem Kollisionsraster in collision.ts), Mitte der Karte im Ursprung.
// Zelle = boden | wand | loch. Wasser und Lava liegen feiner (2 yd) in fine, damit eine 4-yd-Rinne mitten im Gang geht.
// Dazu die Prüfungen nach jeder Erzeugung (Flood-Fill, Spawn frei, Abstände). Alle Zahlen // PH

import type { PackSpot, Spot, Deco, Bounds } from './types';

export const CELL = 8;          // yd, wie CELL in collision.ts
export const SIZE = 26;         // PH: Zellen pro Seite (208 yd, gerade Zahl, damit die Zellgrenzen auf dem Kollisionsraster liegen)
export const FINE = 4;          // Unterteilung für Wasser/Lava: 2 yd
export const FLOOR = 0, WALL = 1, HOLE = 2;
export const DRY = 0, WATER = 1, LAVA = 2;

export class Grid {
  n = SIZE;
  cells = new Uint8Array(SIZE * SIZE).fill(WALL);
  fine = new Uint8Array(SIZE * FINE * SIZE * FINE);
  x0 = -SIZE * CELL / 2;
  z0 = -SIZE * CELL / 2;

  inside(i: number, j: number) { return i >= 0 && j >= 0 && i < this.n && j < this.n; }
  get(i: number, j: number) { return this.inside(i, j) ? this.cells[j * this.n + i] : WALL; }
  set(i: number, j: number, v: number) { if (this.inside(i, j)) this.cells[j * this.n + i] = v; }
  // Rand bleibt immer Wand, sonst läuft man aus der Karte
  carve(i: number, j: number, v = FLOOR) { if (i >= 1 && j >= 1 && i < this.n - 1 && j < this.n - 1) this.cells[j * this.n + i] = v; }
  rect(i0: number, j0: number, i1: number, j1: number, v = FLOOR) {
    for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++) for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) this.carve(i, j, v);
  }
  walk(i: number, j: number) { return this.get(i, j) === FLOOR; }

  cx(i: number) { return this.x0 + (i + 0.5) * CELL; }
  cz(j: number) { return this.z0 + (j + 0.5) * CELL; }
  ci(x: number) { return Math.floor((x - this.x0) / CELL); }
  cj(z: number) { return Math.floor((z - this.z0) / CELL); }
  at(x: number, z: number) { return this.get(this.ci(x), this.cj(z)); }
  walkAt(x: number, z: number) { return this.at(x, z) === FLOOR; }

  // Feines Raster (2 yd) für Wasser und Lava
  fineAt(x: number, z: number) {
    const fi = Math.floor((x - this.x0) / (CELL / FINE)), fj = Math.floor((z - this.z0) / (CELL / FINE)), m = this.n * FINE;
    return fi < 0 || fj < 0 || fi >= m || fj >= m ? DRY : this.fine[fj * m + fi];
  }
  // Rechteck in Welt-Koordinaten, Unterzellen mit Mitte darin
  fineRect(xa: number, za: number, xb: number, zb: number, v: number) {
    const s = CELL / FINE, m = this.n * FINE;
    for (let fj = Math.max(0, Math.floor((Math.min(za, zb) - this.z0) / s)); fj < Math.min(m, Math.ceil((Math.max(za, zb) - this.z0) / s)); fj++)
      for (let fi = Math.max(0, Math.floor((Math.min(xa, xb) - this.x0) / s)); fi < Math.min(m, Math.ceil((Math.max(xa, xb) - this.x0) / s)); fi++) {
        const x = this.x0 + (fi + 0.5) * s, z = this.z0 + (fj + 0.5) * s;
        if (x >= Math.min(xa, xb) && x <= Math.max(xa, xb) && z >= Math.min(za, zb) && z <= Math.max(za, zb)) this.fine[fj * m + fi] = v;
      }
  }

  bounds(): Bounds { const h = this.n * CELL / 2; return { minX: -h, maxX: h, minZ: -h, maxZ: h }; }

  // Wandzelle mit begehbarem Nachbarn (8er-Nachbarschaft): nur die werden gezeichnet
  edgeWall(i: number, j: number) {
    if (this.walk(i, j)) return false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && this.walk(i + di, j + dj)) return true;
    return false;
  }
  // Bodenzelle mit Wand daneben (4er): Rand-Bodenzellen für Wellen
  edgeFloor(i: number, j: number) {
    return this.walk(i, j) && (!this.walk(i + 1, j) || !this.walk(i - 1, j) || !this.walk(i, j + 1) || !this.walk(i, j - 1));
  }

  // Zusammenhang der Bodenzellen ab (i, j): Liste der Komponente
  flood(i: number, j: number) {
    const seen = new Uint8Array(this.n * this.n), out: number[] = [], stack = [j * this.n + i];
    if (!this.walk(i, j)) return { seen, out };
    seen[stack[0]] = 1;
    while (stack.length) {
      const k = stack.pop()!, ci = k % this.n, cj = (k - ci) / this.n;
      out.push(k);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj, nk = nj * this.n + ni;
        if (this.walk(ni, nj) && !seen[nk]) { seen[nk] = 1; stack.push(nk); }
      }
    }
    return { seen, out };
  }
  // Schritte von (i, j) zu jeder Bodenzelle (BFS), -1 = unerreichbar
  steps(i: number, j: number) {
    const d = new Int32Array(this.n * this.n).fill(-1), q = [j * this.n + i];
    d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], ci = k % this.n, cj = (k - ci) / this.n;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj, nk = nj * this.n + ni;
        if (this.walk(ni, nj) && d[nk] < 0) { d[nk] = d[k] + 1; q.push(nk); }
      }
    }
    return d;
  }
  floorCount() { let n = 0; for (const c of this.cells) if (c === FLOOR) n++; return n; }
}

// Ergebnis eines Layouts. height: Gelände (nur Offen), paths: Polylinien für Bodenfarbe, deco: Props (Theme liefert Modell)
export interface Layout {
  grid: Grid;
  spawn: Spot;
  packSpots: PackSpot[];
  objectSpots: Spot[];
  portalSpots: Spot[];
  landmark: Spot & { ry: number };
  bounds: Bounds;
  deco: Deco[];
  lights: Spot[];                       // Kerzen/Lichtinseln
  paths?: [number, number][][];
  height?: (x: number, z: number) => number;
}

// Prüfungen nach jeder Erzeugung. Gibt den Grund zurück oder null, wenn alles passt.
export const RULES = { packFromSpawn: 30, portalFromSpawn: 60 };   // PH
export function check(l: Layout): string | null {
  const g = l.grid, si = g.ci(l.spawn.x), sj = g.cj(l.spawn.z);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!g.walk(si + di, sj + dj)) return 'spawn 3×3 nicht frei';
  const { out } = g.flood(si, sj);
  if (out.length !== g.floorCount()) return `Boden nicht verbunden (${out.length}/${g.floorCount()})`;
  if (!l.packSpots.length) return 'keine Pack-Plätze';
  if (!l.portalSpots.length) return 'kein Portal-Platz';
  return null;
}

// Pflicht-Abstände durchsetzen (Packs ≥ 30 yd, Portale ≥ 60 yd vom Spawn) und Plätze auf Wände prüfen
export function tidy(l: Layout) {
  const far = (p: Spot, d: number) => Math.hypot(p.x - l.spawn.x, p.z - l.spawn.z) >= d;
  l.packSpots = l.packSpots.filter(p => far(p, RULES.packFromSpawn) && l.grid.walkAt(p.x, p.z));
  l.portalSpots = l.portalSpots.filter(p => far(p, RULES.portalFromSpawn) && l.grid.walkAt(p.x, p.z));
  l.objectSpots = l.objectSpots.filter(p => l.grid.walkAt(p.x, p.z));
}

// Plätze mit Mindestabstand ausdünnen (der erste gewinnt)
export function spaced<T extends Spot>(list: T[], min: number): T[] {
  const out: T[] = [];
  for (const p of list) if (out.every(q => Math.hypot(p.x - q.x, p.z - q.z) >= min)) out.push(p);
  return out;
}
