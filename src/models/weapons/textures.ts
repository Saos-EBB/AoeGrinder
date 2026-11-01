// Gemalte Texturen der Waffen (prozedural, periodisch kachelbar). Quelle: Viewer „Stäbe & Klingen“, Abschnitt 1.
// Jede Textur wird beim ersten Gebrauch einmal gemalt und bleibt im Cache. Pro Waffe ein Atlas aus 2×2 Kacheln.

import * as THREE from 'three';

export const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

function makeNoise(seed) {
  const r = rng(seed), N = 256, g = new Float32Array(N * N).map(() => r());
  const sm = t => t * t * (3 - 2 * t);
  return (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const at = (a, b) => g[((b % py + py) % py) * N + ((a % px + px) % px)];
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
function fbm(n, u, v, fx, fy, oct = 4) {
  let s = 0, a = .5, m = 1, t = 0;
  for (let o = 0; o < oct; o++) { s += a * n(u * fx * m, v * fy * m, fx * m, fy * m); t += a; a *= .5; m *= 2; }
  return s / t;
}
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function paint(fn, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const img = x.createImageData(size, size), d = img.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const [r, g, b] = fn(i / size, j / size), k = (j * size + i) * 4;
    d[k] = clamp01(r) * 255; d[k + 1] = clamp01(g) * 255; d[k + 2] = clamp01(b) * 255; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
function scratches(c, n, seed, light, dark, maxLen = 30, vertical = false) {
  const x = c.getContext('2d'), r = rng(seed), S = c.width;
  for (let i = 0; i < n; i++) {
    x.strokeStyle = r() < .5 ? light : dark; x.lineWidth = .6 + r() * 1.2; x.globalAlpha = .25 + r() * .35;
    const px = r() * S, py = r() * S, a = vertical ? Math.PI / 2 + (r() - .5) * .4 : r() * Math.PI, l = 5 + r() * maxLen;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  x.globalAlpha = 1; return c;
}
function cracks(c, n, seed, col, width = 1.2) {
  const x = c.getContext('2d'), r = rng(seed), S = c.width;
  x.strokeStyle = col; x.lineWidth = width;
  for (let i = 0; i < n; i++) {
    let px = r() * S, py = r() * S, a = r() * 6.28; x.globalAlpha = .4 + r() * .4; x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 7; k++) { a += (r() - .5) * 1.4; px += Math.cos(a) * (6 + r() * 12); py += Math.sin(a) * (6 + r() * 12); x.lineTo(px, py); }
    x.stroke();
  }
  x.globalAlpha = 1; return c;
}

const n1 = makeNoise(1), n2 = makeNoise(2), n3 = makeNoise(3);
const PAINTERS = {
  // Holz: Maserung entlang v
  wood: () => scratches(paint((u, v) => {
    const w = fbm(n1, u, v, 8, 2, 3), s = Math.abs(Math.sin((u * 14 + w * 3) * Math.PI));
    const g = (.5 + .42 * Math.pow(s, .35)) * (.85 + .15 * fbm(n2, u, v, 32, 4, 2));
    return [g, g * .97, g * .93];
  }), 40, 5, 'rgba(255,255,255,.5)', 'rgba(0,0,0,.6)', 18, true),
  // Rinde: tiefe Furchen
  bark: () => paint((u, v) => {
    const f = fbm(n1, u, v, 12, 2, 4), g = .3 + .7 * smooth(.3, .7, f) * (.8 + .2 * fbm(n3, u, v, 32, 16, 2));
    return [g, g * .96, g * .9];
  }),
  // Metall: gebürstet + Kratzer
  metal: () => scratches(paint((u, v) => {
    const g = .7 + .12 * fbm(n2, u, v, 2, 64, 2) + .12 * fbm(n1, u, v, 8, 8, 4) - .18 * smooth(.55, .8, fbm(n3, u, v, 4, 4, 4));
    return [g, g, g];
  }), 70, 7, 'rgba(255,255,255,.9)', 'rgba(0,0,0,.8)', 30),
  // Rost auf Eisen
  rust: () => scratches(paint((u, v) => {
    const f = fbm(n1, u, v, 3, 3, 6), m = smooth(.52, .7, f) * (.6 + .4 * fbm(n3, u, v, 16, 16, 2)), d = .7 + .4 * fbm(n2, u, v, 16, 16, 3);
    const iron = [.2, .21, .23], rust = [.36, .16, .07];
    return iron.map((c, i) => (c * (1 - m) + rust[i] * m) * d);
  }), 35, 9, 'rgba(150,155,160,.6)', 'rgba(20,10,5,.8)', 22),
  // Bronze mit Grünspan
  patina: () => paint((u, v) => {
    const f = fbm(n3, u, v, 4, 4, 5), m = smooth(.45, .62, f), d = .8 + .3 * fbm(n1, u, v, 16, 16, 3);
    const br = [.55, .38, .18], gr = [.32, .62, .52];
    return br.map((c, i) => (c * (1 - m) + gr[i] * m) * d);
  }),
  // Knochen: Poren + Haarrisse
  bone: () => {
    const c = paint((u, v) => { const g = .78 + .16 * fbm(n2, u, v, 6, 6, 4); return [g, g * .97, g * .9]; });
    const x = c.getContext('2d'), r = rng(13); x.fillStyle = 'rgba(70,55,35,.5)';
    for (let i = 0; i < 260; i++) { x.beginPath(); x.arc(r() * 256, r() * 256, .5 + r() * 1.2, 0, 7); x.fill(); }
    return cracks(c, 10, 14, 'rgba(60,45,30,.8)', 1);
  },
  // Leder: Wickelbänder
  leather: () => paint((u, v) => {
    const st = ((v * 8 + u) % 1 + 1) % 1, edge = st < .07 ? .35 : 1;
    const g = (.45 + .3 * fbm(n1, u, v, 16, 16, 4)) * edge; return [g, g * .92, g * .85];
  }),
  // Stoff: Webmuster + Flecken
  cloth: () => paint((u, v) => {
    const i = Math.floor(u * 128), j = Math.floor(v * 128), w = ((i % 2) ^ (j % 2)) ? .92 : .8;
    const g = w * (.7 + .3 * fbm(n3, u, v, 8, 8, 4)) - .25 * smooth(.6, .75, fbm(n2, u, v, 4, 4, 4)); return [g, g, g];
  }),
  // Stein
  stone: () => cracks(paint((u, v) => { const g = .45 + .4 * fbm(n1, u, v, 8, 8, 5); return [g, g, g * 1.02]; }), 12, 21, 'rgba(0,0,0,.8)', 1.4),
  // Eis: wolkig + weiße Risse
  ice: () => cracks(paint((u, v) => { const f = fbm(n2, u, v, 4, 8, 5); return [.7 + .25 * f, .86 + .14 * f, 1]; }), 18, 31, 'rgba(255,255,255,.95)', 1.3),
  // Glas hat keine Textur, seine Kachel bleibt weiß
  white: () => paint(() => [1, 1, 1], 4),
};

const tiles = {};
const tile = kind => tiles[kind] ??= PAINTERS[kind]();

export const ATLAS_TILE = 256;
const atlases = new Map();
// Atlas für bis zu 4 Texturen. Die Reihenfolge der Namen ist die Kachelreihenfolge (Zeile für Zeile).
export function atlasFor(kinds) {
  const key = kinds.join('|');
  if (atlases.has(key)) return atlases.get(key);
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_TILE * 2;
  const x = c.getContext('2d');
  kinds.forEach((k, i) => x.drawImage(tile(k), (i % 2) * ATLAS_TILE, (i >> 1) * ATLAS_TILE, ATLAS_TILE, ATLAS_TILE));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  atlases.set(key, t);
  return t;
}

// Partikel-Atlas (4×2 Kacheln), damit eine Waffe mit einem Points-Draw-Call auskommt
function ctxCanvas(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
const radial = (x, s, stops) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, s, s); };
const PDRAW = {
  dot: () => ctxCanvas(64, (x, s) => radial(x, s, [[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']])),
  smoke: () => ctxCanvas(64, (x, s) => radial(x, s, [[0, 'rgba(255,255,255,.55)'], [.5, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']])),
  spark: () => ctxCanvas(64, (x, s) => {
    radial(x, s, [[0, 'rgba(255,255,255,1)'], [.15, 'rgba(255,255,255,.6)'], [.4, 'rgba(255,255,255,0)']]);
    x.globalCompositeOperation = 'lighter'; x.fillStyle = '#fff';
    ([[s / 2 - 1, 4, 2, s - 8], [4, s / 2 - 1, s - 8, 2]] as any).forEach(r => (x.fillRect as any)(...r));
  }),
  flake: () => ctxCanvas(64, (x, s) => {
    radial(x, s, [[0, 'rgba(255,255,255,.6)'], [.3, 'rgba(255,255,255,.15)'], [1, 'rgba(255,255,255,0)']]);
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.lineCap = 'round'; x.translate(s / 2, s / 2);
    for (let k = 0; k < 6; k++) { x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -26); x.moveTo(0, -15); x.lineTo(-7, -21); x.moveTo(0, -15); x.lineTo(7, -21); x.stroke(); }
  }),
  ring: () => ctxCanvas(64, x => {
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 24, 0, 7); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(24, 23, 4, 0, 7); x.fill();
  }),
  halo: () => ctxCanvas(64, (x, s) => radial(x, s, [[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']])),
  rays: () => ctxCanvas(256, (x, s) => {
    x.translate(s / 2, s / 2); const r = rng(5);
    for (let k = 0; k < 18; k++) {
      const a = k / 18 * 6.283 + r() * .2, l = s * (.28 + r() * .22), w = .05 + r() * .05;
      const g = x.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l); g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a - w) * l, Math.sin(a - w) * l); x.lineTo(Math.cos(a + w) * l, Math.sin(a + w) * l); x.fill();
    }
  }),
};
export const PTILE = Object.fromEntries(Object.keys(PDRAW).map((k, i) => [k, i]));
let pAtlas = null;
export function particleAtlas() {
  if (pAtlas) return pAtlas;
  const cell = 128, c = document.createElement('canvas'); c.width = cell * 4; c.height = cell * 2;
  const x = c.getContext('2d');
  Object.values(PDRAW).forEach((d: any, i) => x.drawImage(d(), (i % 4) * cell, (i >> 2) * cell, cell, cell));
  pAtlas = new THREE.CanvasTexture(c);
  pAtlas.generateMipmaps = false; pAtlas.minFilter = THREE.LinearFilter;
  return pAtlas;
}
