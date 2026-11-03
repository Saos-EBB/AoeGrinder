// @ts-nocheck
// Alle Spielfiguren für Frost Grind: Magier (4 Skins), Krieger (4 Waffen), Samurai und Ninja. Automatisch aus dem Viewer „Frost Grind – MC-Modell“
// (slug 677fa515-4c5d-4dc3-9b50-181e9a15fcc6) gezogen. Änderungen am Modell gehören in den Viewer, nicht hierher.
// Die Magier-Schnittstelle (SKINS, SKIN_FX, buildMage) steht am Ende; sie kam früher aus mageModel.ts und muss beim Neuziehen mit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// =====================================================================
// Grundmaße: Drillis & Contini (Anteil der Körpergröße H), Hüftgelenk bei y = 1.0
// =====================================================================
const H = 1.0 / 0.53;
const L = { thigh: 0.245 * H, shank: 0.246 * H, upper: 0.186 * H, fore: 0.146 * H, kneeY: 0.285 * H, ankleY: (0.285 - 0.246) * H, shoulderY: 1.546 };
const HIP_X = 0.09, TEX = 512;
const BUDGET = { tris: 10000, calls: 6 };
const POLY = {
  minimal: { skull: [14, 10], radial: 4, samples: 4, tubeSeg: 4, tubeRad: 3, sphere: [6, 4], rib: 4, fr: 3, pants: [9, 12], shell: [16, 10] },
  wenig:   { skull: [18, 13], radial: 5, samples: 5, tubeSeg: 5, tubeRad: 4, sphere: [7, 5], rib: 5, fr: 4, pants: [11, 16], shell: [22, 13] },
  mittel:  { skull: [24, 17], radial: 6, samples: 6, tubeSeg: 6, tubeRad: 4, sphere: [9, 6], rib: 6, fr: 4, pants: [12, 18], shell: [24, 14] },
};
// Stil: Kopf, Hände, Füße und Knochendicke überzeichnet
const STYLE = { head: 1.45, hand: 1.7, foot: 1.8, bk: 1.7 };

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
const gauss = (d, w) => Math.exp(-(d * d) / (w * w));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = x => Math.min(1, Math.max(0, x));
const table = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return lerp(y0, y1, (x - x0) / (x1 - x0)); }
  return pts[pts.length - 1][1];
};

// =====================================================================
// Malwerkzeuge (Canvas). Licht und Schatten werden eingemalt wie bei Vanilla.
// =====================================================================
function canvas(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
function toTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function rotated(c) { return canvas(c.width, (g, s) => { g.translate(s / 2, s / 2); g.rotate(Math.PI / 2); g.drawImage(c, -s / 2, -s / 2); }); }
function strokes(g, s, n, colors, { len = [0.04, 0.16], w = [1, 4], a = [0.05, 0.14], angle = Math.PI / 2, jitter = 0.25, margin = 0, y0 = 0, y1 = 1 } = {}) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rand(margin * s, s - margin * s), y = rand(y0 * s, y1 * s), Ln = rand(...len) * s, ang = angle + rand(-jitter, jitter);
    g.globalAlpha = rand(...a); g.strokeStyle = colors[i % colors.length]; g.lineWidth = rand(...w) * s / 512;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang) * Ln / 2 + rand(-4, 4), y + Math.sin(ang) * Ln / 2 + rand(-4, 4), x + Math.cos(ang) * Ln, y + Math.sin(ang) * Ln);
    g.stroke();
  }
  g.globalAlpha = 1;
}
function blotches(g, s, n, color, r = [0.04, 0.15], area = [0, 0, 1, 1]) {
  for (let i = 0; i < n; i++) {
    const x = rand(area[0], area[2]) * s, y = rand(area[1], area[3]) * s, rr = rand(...r) * s;
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
}
function vGrad(g, s, stops, x = 0, w = s) { const grd = g.createLinearGradient(0, 0, 0, s); for (const [o, c] of stops) grd.addColorStop(o, c); g.fillStyle = grd; g.fillRect(x, 0, w, s); }
function hGrad(g, s, stops) { const grd = g.createLinearGradient(0, 0, s, 0); for (const [o, c] of stops) grd.addColorStop(o, c); g.fillStyle = grd; g.fillRect(0, 0, s, s); }
function wavy(g, pts, col, w, amp, alpha = 1) {
  g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w; g.beginPath();
  pts.forEach(([x, y], i) => { const j = i % 2 ? amp : -amp; i ? g.lineTo(x + rand(-amp, amp) * 0.5, y + j) : g.moveTo(x, y); });
  g.stroke(); g.globalAlpha = 1;
}
function cracks(g, s, n) {
  for (let i = 0; i < n; i++) {
    let x = rand(0.1, 0.9) * s, y = rand(0.1, 0.9) * s, ang = Math.PI / 2 + rand(-0.8, 0.8);
    const pts = [[x, y]];
    for (let k = 0; k < rand(3, 6); k++) { ang += rand(-0.5, 0.5); x += Math.cos(ang) * s * 0.03; y += Math.sin(ang) * s * 0.03; pts.push([x, y]); }
    for (const [dx, col, w, al] of [[1.5, '#fff4d6', 1.2, 0.5], [0, '#3e2c18', 1.4, 0.8]]) {
      g.globalAlpha = al; g.strokeStyle = col; g.lineWidth = w * s / 512;
      g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0] + dx, p[1]); g.stroke();
    }
  }
  g.globalAlpha = 1;
}
// Webstruktur: Kett- und Schussfäden + Faserflecken
function weave(g, s, step, dark, light, k = 1) {
  for (let y = 0; y < s; y += step) { g.fillStyle = `rgba(${dark},${rand(0.06, 0.13) * k})`; g.fillRect(0, y, s, 1); }
  for (let x = 0; x < s; x += step) { g.fillStyle = `rgba(${light},${rand(0.03, 0.07) * k})`; g.fillRect(x, 0, 1, s); }
  for (let i = 0; i < s * 6; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? dark : light},${rand(0.04, 0.1) * k})`; g.fillRect(rand(0, s), rand(0, s), rand(1, 4), 1); }
}
// Naht: dunkle Rille, helle Kanten, Steppstich
function seamV(g, x, y0, y1, stitch = 'rgba(225,200,150,0.7)') {
  g.fillStyle = 'rgba(10,5,5,0.7)'; g.fillRect(x - 1.5, y0, 3, y1 - y0);
  g.fillStyle = 'rgba(255,235,215,0.2)'; g.fillRect(x - 5, y0, 2.5, y1 - y0); g.fillRect(x + 2.5, y0, 2.5, y1 - y0);
  if (stitch) { g.fillStyle = stitch; for (let y = y0; y < y1; y += 10) g.fillRect(x + 7, y, 2, 6); }
}
function seamH(g, y, x0, x1, stitch = 'rgba(225,200,150,0.7)') {
  g.fillStyle = 'rgba(10,5,5,0.7)'; g.fillRect(x0, y - 1.5, x1 - x0, 3);
  g.fillStyle = 'rgba(255,235,215,0.2)'; g.fillRect(x0, y - 5, x1 - x0, 2.5); g.fillRect(x0, y + 2.5, x1 - x0, 2.5);
  if (stitch) { g.fillStyle = stitch; for (let x = x0; x < x1; x += 10) g.fillRect(x, y - 8, 6, 2); }
}
// Röhrenfalte: kühler Kernschatten + warmes Licht, oben ausgeblendet (Aufhängepunkt)
function pipeFold(g, x, y0, y1, w, shadow, light, alpha) {
  for (const [dx, col, ww] of [[w * 0.35, shadow, w * 0.5], [-w * 0.25, light, w * 0.35]]) {
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, `rgba(${col},0)`); grd.addColorStop(0.35, `rgba(${col},${alpha})`); grd.addColorStop(1, `rgba(${col},${alpha * 0.6})`);
    g.fillStyle = grd; g.beginPath();
    g.moveTo(x + dx, y0); g.quadraticCurveTo(x + dx + ww * 0.6, (y0 + y1) / 2, x + dx + ww, y1);
    g.lineTo(x + dx - ww * 0.3, y1); g.quadraticCurveTo(x + dx - ww * 0.1, (y0 + y1) / 2, x + dx, y0); g.fill();
  }
}
// Zickzackfalte: gestauchter Stoff (Knie, Ellbogen, Saum)
function zigzag(g, x0, x1, y, h, n, shadow, light, alpha) {
  for (let i = 0; i < n; i++) {
    const yy = y + i * h / n, d = (i % 2 ? 1 : -1) * h / n * 0.6;
    g.globalAlpha = alpha; g.fillStyle = `rgb(${shadow})`;
    g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy + d); g.lineTo(x1, yy + d + 4); g.lineTo(x0, yy + 5); g.fill();
    g.globalAlpha = alpha * 0.8; g.fillStyle = `rgb(${light})`;
    g.beginPath(); g.moveTo(x0, yy - 3); g.lineTo(x1, yy + d - 3); g.lineTo(x1, yy + d - 1); g.lineTo(x0, yy - 1); g.fill();
  }
  g.globalAlpha = 1;
}
// Loch mit ausgefranstem Rand ausschneiden (alphaTest), dunkler angesengter Rand drumherum
function tear(g, x, y, rx, ry, rim = 'rgba(40,25,10,0.6)') {
  const pts = []; for (let a = 0; a < Math.PI * 2; a += 0.35) { const k = rand(0.65, 1.15); pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]); }
  g.fillStyle = rim; g.beginPath(); pts.forEach(([px, py], i) => { const qx = x + (px - x) * 1.25, qy = y + (py - y) * 1.25; i ? g.lineTo(qx, qy) : g.moveTo(qx, qy); }); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.fill();
  g.globalCompositeOperation = 'source-over';
}
function frayBottom(g, s, depth = 0.05, step = 30) {
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';             // Füllfarbe setzen, sonst radiert die letzte (oft transparente) Farbe
  g.beginPath(); g.moveTo(0, s);
  for (let x = 0; x <= s; x += s / step) g.lineTo(x, s - rand(0.004, depth) * s);
  g.lineTo(s, s); g.fill();
  g.globalCompositeOperation = 'source-over';
}
function crossStitchPatch(g, px, py, pw, ph, color) {
  g.fillStyle = color; g.fillRect(px, py, pw, ph);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + ph - 4, pw, 4);
  g.strokeStyle = 'rgba(225,200,150,0.85)'; g.lineWidth = 1.5;
  const x = (cx, cy) => { g.beginPath(); g.moveTo(cx - 3, cy - 3); g.lineTo(cx + 3, cy + 3); g.moveTo(cx + 3, cy - 3); g.lineTo(cx - 3, cy + 3); g.stroke(); };
  for (let k = 0; k <= pw; k += 8) { x(px + k, py); x(px + k, py + ph); }
  for (let k = 0; k <= ph; k += 8) { x(px, py + k); x(px + pw, py + k); }
}
function grime(g, s, bottom = true) {                                   // Grabschmutz + Schimmel
  if (bottom) blotches(g, s, 12, 'rgba(40,30,15,0.5)', [0.03, 0.08], [0, 0.75, 1, 1]);
  blotches(g, s, 6, 'rgba(90,110,60,0.3)', [0.02, 0.05], [0, 0.3, 1, 0.95]);
}

// ---- Knochen ----
function paintBone(s, mode) {
  return canvas(s, (g) => {
    if (mode === 'cyl') hGrad(g, s, [[0, '#f0e2bc'], [0.12, '#dbc89c'], [0.3, '#b09a70'], [0.5, '#6e5a38'], [0.7, '#b09a70'], [0.88, '#dbc89c'], [1, '#f0e2bc']]);
    else vGrad(g, s, [[0, '#ecdcb2'], [1, '#ad9870']]);
    strokes(g, s, 650, ['#fff4d4', '#6b5636', '#e8d6a8', '#8a7348'], { margin: 0.03 });
    blotches(g, s, 14, 'rgba(110,90,40,0.22)');
    blotches(g, s, 6, 'rgba(80,100,55,0.14)');
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(70,50,25,${rand(0.15, 0.4)})`; g.fillRect(rand(0, s), rand(0, s), 1.5, 1.5); }
    vGrad(g, s, [[0, 'rgba(60,38,18,0.55)'], [0.1, 'rgba(60,38,18,0)'], [0.9, 'rgba(60,38,18,0)'], [1, 'rgba(60,38,18,0.55)']]);
    cracks(g, s, 8);
  });
}
function paintCranium(s) {
  return canvas(s, (g) => {
    vGrad(g, s, [[0, '#f4e8c4'], [0.4, '#dcc99e'], [0.62, '#b19c70'], [1, '#5a472c']]);
    strokes(g, s, 450, ['#fff6da', '#6b5636', '#e8d6a8'], { angle: 0, len: [0.03, 0.1] });
    blotches(g, s, 12, 'rgba(110,85,40,0.22)');
    blotches(g, s, 5, 'rgba(70,90,50,0.14)', [0.03, 0.08]);
    const coronal = [], lambda = [];
    for (let u = 0; u <= 0.5; u += 0.01) coronal.push([u * s, (0.42 - 0.3 * Math.sin(2 * Math.PI * u)) * s]);
    for (let u = 0.5; u <= 1; u += 0.01) lambda.push([u * s, (0.55 - 0.22 * Math.sin(2 * Math.PI * (u - 0.5))) * s]);
    for (const pts of [coronal, lambda]) { wavy(g, pts, '#3a2814', 2.5, 2.5, 0.85); wavy(g, pts.map(([x, y]) => [x + 1.5, y + 1.5]), '#fff2d0', 1, 2, 0.35); }
    for (const [u, y1] of [[0.25, 0.12], [0.75, 0.33]]) { const pts = []; for (let y = 0; y <= y1; y += 0.01) pts.push([u * s, y * s]); wavy(g, pts, '#3a2814', 2.5, 2.5, 0.85); }
    let grd = g.createRadialGradient(0.25 * s, 0.3 * s, 0, 0.25 * s, 0.3 * s, s * 0.1);
    grd.addColorStop(0, 'rgba(255,250,230,0.55)'); grd.addColorStop(1, 'rgba(255,250,230,0)'); g.fillStyle = grd; g.fillRect(0, 0, s, s);
    cracks(g, s, 3);
  });
}
function paintWood(s) {
  return canvas(s, (g) => {
    hGrad(g, s, [[0, '#8a5e36'], [0.15, '#6e4626'], [0.5, '#2a170a'], [0.85, '#6e4626'], [1, '#8a5e36']]);
    strokes(g, s, 500, ['#a87445', '#1e0f05', '#7a4e2a'], { len: [0.15, 0.4], w: [1, 3], a: [0.1, 0.25], jitter: 0.06, margin: 0.03 });
    for (let i = 0; i < 4; i++) { const x = rand(0.05, 0.25) * s, y = rand(0, s); g.fillStyle = 'rgba(20,10,3,0.8)'; g.beginPath(); g.ellipse(x, y, s * 0.012, s * 0.03, 0, 0, 7); g.fill(); }
  });
}
function paintLeather(s, base = ['#6a4426', '#2c180c']) {
  return canvas(s, (g) => {
    hGrad(g, s, [[0, base[0]], [0.5, base[1]], [1, base[0]]]);
    strokes(g, s, 260, ['#8a5a32', '#1a0d05'], { angle: 0, len: [0.05, 0.2] });
    strokes(g, s, 40, ['rgba(230,200,160,1)'], { angle: 0.3, len: [0.02, 0.06], w: [1, 1.5], a: [0.2, 0.35] });   // Kratzer
    blotches(g, s, 10, 'rgba(20,10,5,0.35)', [0.03, 0.08]);
    g.fillStyle = 'rgba(220,180,120,0.7)';
    for (let i = 0; i < s; i += s / 16) { g.fillRect(i, s * 0.12, s / 32, s * 0.02); g.fillRect(i, s * 0.86, s / 32, s * 0.02); }
  });
}

// =====================================================================
// Geometrie-Bausteine
// =====================================================================
function joint(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function add(parent, geo, mat, x = 0, y = 0, z = 0, extra) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (extra) Object.assign(m.userData, extra); parent.add(m); return m; }
const glowTex = toTex(canvas(64, (g, s) => {
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
}));
function glow(parent, color, size, x = 0, y = 0, z = 0) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(size); sp.position.set(x, y, z); parent.add(sp); return sp;
}
function tube(pts, r, segs, radial, { taper = 0, oval = null, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), closed);
  const geo = new THREE.TubeGeometry(curve, segs, r, radial, closed);
  if (taper || oval) {
    const p = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3(), tg = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / (radial + 1)) / segs;
      curve.getPointAt(t, c); v.fromBufferAttribute(p, i).sub(c);
      if (taper) v.multiplyScalar(1 - taper * t);
      if (oval) { curve.getTangentAt(t, tg); oval(v, tg, t); }
      v.add(c); p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
  }
  return geo;
}
// Knochen nach −y, Gelenkenden verdickt
function longBone(len, r, samples, radial, ends = [1, 1], tip = 0.25) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    let w = r * (0.78 + 0.22 * Math.abs(2 * t - 1));
    w += r * 0.9 * ends[0] * gauss(t - 0.05, 0.1) + r * 0.8 * ends[1] * gauss(t - 0.95, 0.1);
    if (i === 0) w = r * 0.25; if (i === samples) w = r * tip;
    pts.push(new THREE.Vector2(w, -t * len));
  }
  return new THREE.LatheGeometry(pts, radial);
}
const bone = (len, r, P, ends) => longBone(len, r * STYLE.bk, P.samples, P.radial, ends);
// Offene Stoffröhre aus Tabellen: Querschnitt RX/RZ/CZ über y, vorne Spalt g(y), optional Armlöcher, Falten
function garment(spec, segs) {
  const [aSeg, rowsBase] = segs, rows = Math.max(4, Math.round(rowsBase * (spec.yTop - spec.yBot) / 0.5));
  const pos = [], uv = [], idx = [];
  const gap = y => typeof spec.g === 'function' ? spec.g(y) : spec.g;
  const angAt = (y, a) => lerp(gap(y), 2 * Math.PI - gap(y), a);
  for (let r = 0; r <= rows; r++) {
    const t = r / rows, y = lerp(spec.yBot, spec.yTop, t);
    for (let a = 0; a <= aSeg; a++) {
      const ang = angAt(y, a / aSeg), f = 1 + (spec.fold ? spec.fold(y, ang) : 0);
      pos.push(Math.sin(ang) * table(spec.RX, y) * f, y, table(spec.CZ, y) + Math.cos(ang) * table(spec.RZ, y) * f);
      uv.push(a / aSeg, t);
    }
  }
  for (let r = 0; r < rows; r++) for (let a = 0; a < aSeg; a++) {
    const y = lerp(spec.yBot, spec.yTop, (r + 0.5) / rows), ang = angAt(y, (a + 0.5) / aSeg);
    if (spec.armSin && Math.abs(Math.sin(ang)) > spec.armSin && y > spec.armY0 && y < spec.armY1) continue;
    const i = r * (aSeg + 1) + a, j = i + aSeg + 1;
    idx.push(i, i + 1, j, i + 1, j + 1, j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
const garmentU = (spec, ang) => (ang - spec.g0) / (2 * Math.PI - 2 * spec.g0);   // für die Textur (g an der Armlochhöhe)
const garmentY = (spec, y) => 1 - (y - spec.yBot) / (spec.yTop - spec.yBot);     // Canvas-y (0 oben)
// Hosenbein: gewichtet Becken → Oberschenkel → Unterschenkel
function pantsLeg(s, P, J, o) {
  const [rad, rows] = P.pants, pos = [], uv = [], idx = [], yTop = 1.13, yBot = o.yBot, w = o.wide || 1;
  const RX = [[0.1, 0.08], [0.2, 0.076], [0.35, 0.07], [L.kneeY, 0.071], [0.7, 0.078], [0.86, 0.092], [0.98, 0.12], [1.13, 0.122]];
  const RZ = [[0.1, 0.082], [0.2, 0.078], [0.35, 0.072], [L.kneeY, 0.073], [0.7, 0.076], [0.86, 0.088], [0.98, 0.108], [1.13, 0.11]];
  const phase = s * 1.7;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows, y = lerp(yTop, yBot, t);
    const cx = s * lerp(HIP_X, 0.062, smooth(0.86, 1.08, y)), cz = -0.012 * gauss(y - 0.97, 0.08);
    const wk = lerp(w, 1, smooth(0.9, 1.1, y)) * lerp(1, o.hipK ?? 1, smooth(0.86, 1.0, y));
    const aW = 0.05 * smooth(1.03, 1.12, y), aK = 0.06 * gauss(y - L.kneeY, 0.05), aC = 0.07 * gauss(y - yBot - 0.04, 0.05), aT = 0.035;
    const flare = 1 + (o.flare ?? 0.1) * smooth(yBot + 0.1, yBot, y);
    for (let a = 0; a <= rad; a++) {
      const ang = a / rad * Math.PI * 2;
      const f = wk * flare * (1 + aW * Math.sin(ang * 9 + phase) + aK * Math.sin(ang * 4 + r * 1.7) + aC * Math.sin(ang * 5 + (r % 2) * 2) + aT * Math.sin(ang * 3 + phase + y * 4));
      pos.push(cx + s * Math.sin(ang) * table(RX, y) * f, y, cz - Math.cos(ang) * table(RZ, y) * f);
      uv.push(a / rad, 1 - t);
    }
  }
  for (let r = 0; r < rows; r++) for (let a = 0; a < rad; a++) {
    const i = r * (rad + 1) + a, j = i + rad + 1;
    if (s > 0) idx.push(i, j, i + 1, i + 1, j, j + 1); else idx.push(i, i + 1, j, i + 1, j + 1, j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const weights = p => { const wH = smooth(0.9, 1.02, p.y), wK = smooth(L.kneeY + 0.06, L.kneeY - 0.05, p.y); return [[J.hips, wH], [J.hip, Math.max(0, 1 - wH - wK)], [J.knee, wK]]; };
  return { geo, weights };
}
// Ärmel am hängenden Arm (Bindungspose), gewichtet Schulter → Ellbogen
function sleeve(P, side, shX, y0, y1, r0, r1, J, rowsK = 20) {
  const rad = P.fr + 5, rows = Math.max(4, Math.round((y0 - y1) * rowsK)), pos = [], uv = [], idx = [];
  const elY = L.shoulderY - L.upper;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows, y = lerp(y0, y1, t), d = y0 - y, cap = d < 0.03 ? Math.sqrt(1 - ((0.03 - d) / 0.03) ** 2) : 1;
    const rr = lerp(r0, r1, t) * (1 + 0.15 * gauss(y - elY, 0.04)) * Math.max(0.6, cap);   // oben leicht abgerundet
    for (let a = 0; a <= rad; a++) {
      const ang = a / rad * Math.PI * 2, f = 1 + 0.09 * Math.sin(ang * 3 + y * 20);
      pos.push(side * shX + Math.sin(ang) * rr * f, y, -0.03 + Math.cos(ang) * rr * f);
      uv.push(a / rad, 1 - t);
    }
  }
  for (let r = 0; r < rows; r++) for (let a = 0; a < rad; a++) { const i = r * (rad + 1) + a, j = i + rad + 1; idx.push(i, j, i + 1, i + 1, j, j + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const weights = p => { const wE = smooth(elY + 0.04, elY - 0.04, p.y); return [[J.shoulder, 1 - wE], [J.elbow, wE]]; };
  return { geo, weights };
}
// Stoffbahn, oben aufgehängt, leicht gewölbt
function panel(w, h, P, curve = 2.2, taperK = 0.15) {
  const geo = new THREE.PlaneGeometry(w, h, 3, Math.max(4, Math.round(h * 10))).translate(0, -h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -curve * x * x + 0.01 * Math.sin(x * 60)); p.setX(i, x * (1 - taperK * (-y / h))); }
  geo.computeVertexNormals();
  return geo;
}
function wrapGeo(y0, y1, r, turns) {
  const pts = [], n = turns * 6;
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2; pts.push([Math.sin(a) * r, lerp(y0, y1, t) + Math.sin(a) * 0.006, Math.cos(a) * r]); }
  return tube(pts, 0.008, n * 2, 3, { oval: v => { v.y *= 1.7; } });
}

// =====================================================================
// Schädel: Hirnschädel + Gesichtsschale (stilisiert: Augenhöhlen groß, Brauen kräftig)
// =====================================================================
function craniumGeo(seg) {
  const geo = new THREE.SphereGeometry(1, seg[0], seg[1]);
  const p = geo.attributes.position, d = new THREE.Vector3(), q = new THREE.Vector3();
  const G = (x, y, z, w) => gauss(d.distanceTo(q.set(x, y, z).normalize()), w);
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    let o = 0;
    o += 0.01 * (G(0.35, -0.08, 0.93, 0.18) + G(-0.35, -0.08, 0.93, 0.18)) + 0.004 * G(0, -0.06, 1, 0.18);
    o += 0.003 * (G(0.35, 0.45, 0.8, 0.3) + G(-0.35, 0.45, 0.8, 0.3));
    o -= 0.008 * (G(1, -0.1, 0.3, 0.42) + G(-1, -0.1, 0.3, 0.42));
    o += 0.005 * (G(0.7, 0.5, -0.4, 0.35) + G(-0.7, 0.5, -0.4, 0.35));
    o += 0.006 * G(0, -0.15, -1, 0.3);
    p.setXYZ(i, d.x * (0.072 + o), d.y * ((d.y > 0 ? 0.08 : 0.05) + o), d.z * (0.094 + o));
  }
  geo.computeVertexNormals();
  return geo;
}
function faceGeo(seg, flesh = false) {
  const geo = new THREE.SphereGeometry(1, seg[0], seg[1], -0.35, Math.PI + 0.7);
  const p = geo.attributes.position, shade = new Float32Array(p.count);
  const pow4 = (a, b) => Math.exp(-(a ** 4) - (b ** 4));
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i);
    let x = dx * lerp(0.033, 0.068, smooth(-0.55, 0.25, dy)), y = dy * 0.055, z = dz * 0.046;
    if (z > 0.036) z = 0.036 + (z - 0.036) * 0.35;
    const front = smooth(0.0, 0.02, z);
    const orb = Math.max(pow4((x - 0.034) / 0.022, (y - 0.017) / 0.019), pow4((x + 0.034) / 0.022, (y - 0.017) / 0.019)) * front;
    const halfW = 0.008 + 0.007 * smooth(0.01, -0.02, y);
    const nas = Math.exp(-((x / halfW) ** 2) - ((y + 0.009) / 0.016) ** 4) * front;
    if (flesh) {
      z += -0.016 * orb + 0.016 * nas * smooth(-0.03, 0.0, y);                                   // flache Augenhöhle, Nase
      x += Math.sign(x) * 0.007 * smooth(0.02, 0.05, Math.abs(x)) * smooth(0.0, -0.04, y);       // Wangen nach außen
      z += 0.008 * smooth(0.0, -0.035, y) * front;                                                // Oberlippe vor
    }
    else z -= 0.036 * orb + 0.02 * nas;
    z += 0.004 * Math.exp(-((x / 0.008) ** 2) - ((y - 0.03) / 0.012) ** 2) * front;
    const cheek = Math.exp(-(((Math.abs(x) - 0.052) / 0.016) ** 2) - ((y + 0.004) / 0.016) ** 2);
    x += Math.sign(x) * 0.009 * cheek; z += 0.004 * cheek;
    z += 0.008 * smooth(-0.015, -0.04, y) * front;
    p.setXYZ(i, x, y - 0.05, z + 0.045);
    shade[i] = flesh ? Math.max(0.35, 1 - 0.6 * smooth(0.25, 0.75, orb)) : Math.max(0.04, 1 - 1.25 * smooth(0.15, 0.65, orb) - 1.15 * smooth(0.2, 0.7, nas));
  }
  geo.computeVertexNormals();
  geo.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
  return geo;
}
function buildSkull(parent, M, P, C) {
  const sk = joint(parent, 0, 0.05, 0.01);
  const cr = add(sk, craniumGeo(P.skull.map(n => Math.round(n * 0.8))), M.cranium);
  add(sk, faceGeo(C.flesh ? P.skull.map(n => Math.round(n * 0.85)) : P.skull, C.flesh), C.flesh ? M.boneFlat : M.cranium);
  const cheeks = [];
  if (C.flesh) {
    cr.scale.setScalar(1.05);                                                          // Haut + Haar über dem Schädel
    for (const s of [-1, 1]) add(sk, new THREE.SphereGeometry(0.02, P.sphere[0], P.sphere[1]).scale(0.35, 1, 0.7), M.boneFlat, s * 0.074, -0.03, -0.005).rotation.y = s * 0.3;   // Ohren
    for (const s of [-1, 1]) {
      cheeks.push(add(sk, new THREE.SphereGeometry(0.026, P.sphere[0], P.sphere[1]).scale(0.7, 1.15, 0.85), M.boneFlat, s * 0.047, -0.078, 0.04));   // Wange über dem Kaumuskel (dehnt sich mit dem Kiefer)
      add(sk, new THREE.SphereGeometry(0.012, P.sphere[0], P.sphere[1]).scale(1.6, 0.6, 0.8), M.boneFlat, s * 0.034, -0.012, 0.066, { tint: TINT.lid });   // Oberlid / Braue
      add(sk, new THREE.SphereGeometry(0.011, P.sphere[0], P.sphere[1]).scale(1.6, 0.7, 0.7), M.boneFlat, s * 0.034, -0.05, 0.064, { tint: TINT.bag });   // Tränensack
    }
    // Mund: dunkler Rachen hinter den Zähnen, Oberlippe (rissig, Mundwinkel hängen)
    add(sk, new THREE.SphereGeometry(0.03, 8, 6).scale(1, 0.55, 0.6), M.boneFlat, 0, -0.098, 0.058, { tint: TINT.mouth });
    add(sk, tube([[-0.029, -0.098, 0.068], [-0.016, -0.091, 0.08], [0, -0.09, 0.084], [0.016, -0.091, 0.08], [0.029, -0.098, 0.068]], 0.0038, 8, 4, { oval: v => { v.y *= 1.3; } }), M.boneFlat, 0, 0, 0, { tint: TINT.lip });
  }
  if (!C.flesh) for (const s of [-1, 1]) {                                            // Jochbogen + Warzenfortsatz nur am Skelett (unter Haut verdeckt)
    add(sk, tube([[s * 0.054, -0.048, 0.052], [s * 0.069, -0.044, 0.024], [s * 0.069, -0.046, -0.006]], 0.0065, P.tubeSeg, P.tubeRad), M.boneTube);
    add(sk, new THREE.ConeGeometry(0.009, 0.02, P.radial).rotateX(Math.PI), M.bone, s * 0.05, -0.058, -0.03);
  }
  const teeth = (par, y0, y1, zF, missing) => {
    for (let i = 0; i < 10; i++) {
      if (missing.includes(i)) continue;
      const t = (i - 4.5) / 4.5, x = 0.025 * t, z = zF - 0.024 * t * t;
      const w = Math.abs(t) > 0.6 ? 0.008 : Math.abs(t) > 0.35 ? 0.0068 : 0.0062;
      const h = (y1 - y0) * (Math.abs(t) > 0.35 && Math.abs(t) < 0.6 ? 1.2 : 1);
      add(par, new THREE.BoxGeometry(w * 0.86, h, 0.007), M.boneFlat, x, (y0 + y1) / 2, z, { tint: C.flesh ? TINT.teethFlesh : TINT.teeth }).rotation.y = Math.atan2(0.048 * t, 0.025);
    }
  };
  teeth(sk, -0.1, -0.086, 0.079, C.missingTop || []);
  const jaw = joint(sk, 0, -0.045, -0.012);
  const half = [[0.056, -0.008, 0.004], [0.054, -0.038, 0.002], [0.05, -0.064, 0.012], [0.042, -0.078, 0.05], [0.023, -0.088, 0.078]];
  const path = [...half.map(([x, y, z]) => [-x, y, z]), [0, -0.093, 0.09], ...half.map(([x, y, z]) => [x, y, z]).reverse()];
  if (C.flesh) {
    // Unterkiefer mit Fleisch: derselbe U-Bogen wie der Knochen, aber dick, rund und mit Haut
    add(jaw, tube(path, 0.017, P.tubeSeg * 3, P.tubeRad + 1, {
      oval: (v, tg) => { const vert = Math.abs(tg.y); v.y *= 1 + 0.7 * (1 - vert); v.z *= 1 + 0.5 * vert; },
    }), M.boneFlat);
    add(jaw, tube([[-0.027, -0.061, 0.068], [-0.014, -0.064, 0.08], [0, -0.065, 0.083], [0.014, -0.064, 0.08], [0.027, -0.061, 0.068]], 0.0045, 8, 4, { oval: v => { v.y *= 1.3; } }), M.boneFlat, 0, 0, 0, { tint: TINT.lip });
    add(jaw, new THREE.SphereGeometry(0.012, P.sphere[0], P.sphere[1]).scale(1.3, 0.9, 0.8), M.boneFlat, 0, -0.084, 0.078);   // Kinnspitze
  } else add(jaw, tube(path, 0.0075, P.tubeSeg * 3, P.tubeRad + 1, {
    oval: (v, tg) => { const vert = Math.abs(tg.y); v.y *= 1 + 0.9 * (1 - vert); v.z *= 1 + 1.5 * vert; v.x *= 0.7 + 0.1 * vert; },
  }), M.boneTube);
  teeth(jaw, -0.069, -0.056, 0.084, C.missingBottom || []);
  // Wangen: oben am Schädel, unten am Kiefer (Gewichte nach Höhe in der Bindungspose)
  const jp = new THREE.Vector3();
  for (const c of cheeks) c.userData.weights = p => { jaw.getWorldPosition(jp); const w = smooth(jp.y + 0.005, jp.y - 0.06, p.y); return [[sk, 1 - w], [jaw, w]]; };
  for (const s of [-1, 1]) {
    const e = add(sk, new THREE.SphereGeometry(C.flesh ? 0.0085 : 0.009, 6, 4), M.eye, s * 0.034, -0.032, C.flesh ? 0.069 : 0.065);
    glow(e, C.eye, 0.065);
  }
  return { sk, jaw };
}

// =====================================================================
// Stilisierter Rumpf: 8 dicke Rippenpaare, Rippenbogen, Brustbein, Schlüsselbeine
// =====================================================================
const T1Y = 1.535, T12Y = 1.255;
const spineZ = y => y > T1Y ? -0.03 + 0.012 * Math.sin(Math.PI * (y - T1Y) / 0.15)
  : y > T12Y ? -0.03 - 0.025 * Math.sin(Math.PI * (T1Y - y) / (T1Y - T12Y))
  : -0.03 + 0.03 * Math.sin(Math.PI * (T12Y - y) / 0.27);
const sternumZ = y => 0.11 + (1.455 - y) * 0.16;
function buildTorso(torso, M, P, C) {
  const W = (x, y, z) => [x, y - 1, z], bk = STYLE.bk, wk = C.shX / 0.2;
  if (C.flesh) {                                                                       // Fleisch: ein Rumpf, durch die Hemdrisse sieht man Haut
    add(torso, new THREE.SphereGeometry(1, 12, 8).scale(0.15, 0.27, 0.125), M.boneFlat, ...W(0, 1.32, 0.012));
    return;
  }
  // Wirbel: 6 Brust- und (falls sichtbar) 3 Lendenwirbel, dick
  const n = C.showLumbar ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const y = i < 6 ? T1Y - i * (T1Y - T12Y) / 5 : T12Y - 0.05 * (i - 5), r = (i < 6 ? 0.011 : 0.016) * bk, z = spineZ(y);
    add(torso, new THREE.CylinderGeometry(r, r * 1.05, i < 6 ? 0.03 : 0.038, P.radial), M.bone, ...W(0, y, z));
    add(torso, new THREE.ConeGeometry(0.008, 0.04, 3).rotateX(-Math.PI / 2 - 0.5), M.bone, ...W(0, y - 0.01, z - 0.04));
  }
  // 8 Rippenpaare (Tabellen aus der Anatomie, interpoliert)
  const A12 = (arr, i) => arr[Math.round(i * 11 / 7)];
  const W12 = [0.068, 0.095, 0.113, 0.126, 0.136, 0.143, 0.148, 0.15, 0.148, 0.142, 0.127, 0.107];
  const DROP = [0.035, 0.065, 0.085, 0.1, 0.11, 0.12, 0.13, 0.135, 0.135, 0.13, 0.08, 0.06];
  const FX = [0.035, 0.05, 0.058, 0.064, 0.07, 0.076, 0.082, 0.1, 0.115, 0.128, 0, 0];
  const ends = { [-1]: [], [1]: [] };
  for (let i = 0; i < 8; i++) {
    const a = Math.round(i * 11 / 7), yb = T1Y - 0.01 - a * (T1Y - T12Y) / 11, zs = spineZ(yb), w = W12[a] * wk, dr = DROP[a], floating = a >= 10;
    for (const s of [-1, 1]) {
      const pts = [[s * 0.02, yb, zs], [s * 0.055, yb - 0.004, zs - 0.035], [s * w * 0.82, yb - 0.016, zs - 0.02], [s * w, yb - 0.04, zs + 0.06]];
      if (floating) pts.push([s * w * 0.9, yb - dr, zs + 0.1]);
      else pts.push([s * lerp(w, FX[a], 0.35), yb - dr * 0.8, 0.08], [s * FX[a], yb - dr, a === 0 ? 0.092 : 0.104]);
      add(torso, tube(pts.map(p => W(...p)), 0.0065 * bk, P.rib + (floating ? 0 : 2), 4, { oval: v => { v.y *= 1.35; } }), M.boneTube);
      if (!floating) ends[s].push(pts[pts.length - 1]);
    }
  }
  // Knorpel: obere 5 zum Brustbein, Rippen 6–7 als Rippenbogen
  for (const s of [-1, 1]) {
    const e = ends[s];
    for (let k = 0; k < Math.min(5, e.length); k++) {
      const ty = 1.445 - k * 0.032, t = [s * 0.018, ty, sternumZ(ty)];
      add(torso, tube([e[k], [lerp(e[k][0], t[0], 0.5), lerp(e[k][1], t[1], 0.4), lerp(e[k][2], t[2], 0.5) + 0.006], t].map(p => W(...p)), 0.0055 * bk, 3, 4), M.boneTube, 0, 0, 0, { tint: TINT.cartilage });
    }
    const arch = [...e.slice(5).reverse(), [s * 0.045, 1.29, sternumZ(1.3)], [s * 0.018, 1.31, sternumZ(1.31)]];
    add(torso, tube(arch.map(p => W(...p)), 0.0058 * bk, 5, 4), M.boneTube, 0, 0, 0, { tint: TINT.cartilage });
  }
  const stern = (y0, y1, w0, w1) => {
    const g = new THREE.CylinderGeometry(w0, w1, y0 - y1, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.35);
    add(torso, g, M.boneFlat, ...W(0, (y0 + y1) / 2, (sternumZ(y0) + sternumZ(y1)) / 2)).rotation.x = -Math.atan(0.16);
  };
  stern(1.465, 1.41, 0.04, 0.03); stern(1.41, 1.3, 0.026, 0.03); stern(1.3, 1.26, 0.016, 0.004);
  for (const s of [-1, 1]) {
    add(torso, tube([[s * 0.022, 1.468, 0.105], [s * 0.075 * wk, 1.482, 0.112], [s * 0.14 * wk, 1.51, 0.062], [s * (C.shX - (C.covered ? 0.04 : 0.01)), C.covered ? 1.53 : 1.545, -0.005]].map(p => W(...p)), 0.0072 * bk, P.tubeSeg, P.tubeRad), M.boneTube);
    if (!C.covered) add(torso, new THREE.SphereGeometry(0.02 * bk, P.sphere[0], P.sphere[1]), M.boneFlat, ...W(s * (C.shX - 0.012), 1.565, -0.03)).scale.set(1.3, 0.45, 1.1);   // Schulterdach (unterm Sakko weg)
  }
}
function buildPelvis(hips, M, P) {
  for (const s of [-1, 1]) {
    const wing = add(hips, new THREE.SphereGeometry(0.095, P.sphere[0], P.sphere[1], 0, Math.PI), M.boneFlat, s * 0.095, 0.05, -0.02);
    wing.scale.set(1, 0.85, 0.16); wing.rotation.set(0.15, s * 0.75 + (s > 0 ? Math.PI : 0), s * 0.35);
    add(hips, tube([[s * 0.04, -0.07, 0.06], [s * 0.09, -0.06, 0.03], [s * HIP_X, -0.01, 0], [s * 0.075, 0.03, -0.06]], 0.016, P.tubeSeg, P.tubeRad), M.boneTube);
  }
  add(hips, new THREE.CylinderGeometry(0.055, 0.016, 0.14, P.radial).scale(1, 1, 0.5), M.boneFlat, 0, 0.02, -0.08).rotation.x = -0.5;
}

// =====================================================================
// Hände und Füße (neu): groß, klare Knöchel, Fuß steht flach auf dem Boden
// =====================================================================
// Fuß-Knochen: ausgebleicht, Erde und Moos von unten, Risse, dunkle Gelenkfugen an den Enden
function paintFootBone(s) {
  return canvas(s, (g) => {
    hGrad(g, s, [[0, '#e6d6ae'], [0.15, '#d2bf93'], [0.35, '#a8916a'], [0.5, '#6e5a3a'], [0.65, '#a8916a'], [0.85, '#d2bf93'], [1, '#e6d6ae']]);
    strokes(g, s, 500, ['#fff2d0', '#5e4a2c', '#cdb98c'], { margin: 0.02 });
    blotches(g, s, 26, 'rgba(70,50,25,0.4)', [0.04, 0.12]);                 // Erde
    blotches(g, s, 10, 'rgba(80,100,50,0.3)', [0.02, 0.06]);                // Moos
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(50,35,18,${rand(0.2, 0.5)})`; g.fillRect(rand(0, s), rand(0, s), rand(1, 2.5), rand(1, 2.5)); }   // Erdkrümel
    vGrad(g, s, [[0, 'rgba(40,25,10,0.75)'], [0.12, 'rgba(40,25,10,0)'], [0.88, 'rgba(40,25,10,0)'], [1, 'rgba(40,25,10,0.75)']]);   // Gelenkenden
    cracks(g, s, 12);
  });
}
// Fuß-Haut (Loft: x = rundherum, 0–0.5 oben, 0.5–1 Sohle; y = Ferse unten → Ballen oben)
function paintFootSkin(s) {
  return canvas(s, (g) => {
    g.drawImage(paintSkin(s, 'flat'), 0, 0);
    // Rist: Strecksehnen laufen zu den Zehen, Adern
    for (let i = 0; i < 0; i++) {   // Sehnen-Streifen aus: wirkten wie Cord
      const x = (0.1 + i * 0.075) * s;
      const grd = g.createLinearGradient(x - 6, 0, x + 6, 0);
      grd.addColorStop(0, 'rgba(60,70,45,0)'); grd.addColorStop(0.4, 'rgba(225,230,200,0.12)'); grd.addColorStop(0.6, 'rgba(60,70,45,0.12)'); grd.addColorStop(1, 'rgba(60,70,45,0)');
      g.fillStyle = grd; g.fillRect(x - 6, 0, 12, s * 0.6);
    }
    // Sohle: fahler, Hornhaut an Ferse und Ballen, Querfalten, Dreck
    g.fillStyle = 'rgba(190,180,140,0.55)'; g.fillRect(0.5 * s, 0, 0.5 * s, s);
    blotches(g, s, 6, 'rgba(225,210,160,0.6)', [0.06, 0.12], [0.55, 0.8, 0.95, 1]);   // Hornhaut Ferse
    blotches(g, s, 6, 'rgba(225,210,160,0.5)', [0.05, 0.1], [0.55, 0, 0.95, 0.15]);   // Hornhaut Ballen
    g.strokeStyle = 'rgba(70,55,35,0.6)'; g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { const y = rand(0, 0.2) * s; g.beginPath(); g.moveTo(0.52 * s, y); g.quadraticCurveTo(0.75 * s, y + rand(-8, 8), 0.98 * s, y + rand(-6, 6)); g.stroke(); }
    blotches(g, s, 30, 'rgba(45,32,18,0.55)', [0.03, 0.09], [0.5, 0, 1, 1]);          // Dreck
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(40,28,14,${rand(0.2, 0.5)})`; g.fillRect(rand(0.5, 1) * s, rand(0, s), 2, 2); }
    // Zehengelenk-Falten oben (Ballenbereich, oberer Rand)
    g.strokeStyle = 'rgba(55,60,40,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const y = rand(0.02, 0.12) * s, x = rand(0.05, 0.4) * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(15, 30), y + rand(-2, 2)); g.stroke(); }
    // Schmutzrand: von unten hochgezogen
    hGrad(g, s, [[0, 'rgba(50,35,18,0.35)'], [0.08, 'rgba(50,35,18,0)'], [0.42, 'rgba(50,35,18,0)'], [0.5, 'rgba(50,35,18,0.45)']]);
  });
}
// Unterarm-Knochen (Röhre: x = entlang, y = rundherum): Ränder = Gelenkenden dunkel, Erde, Risse
function paintLimbBone(s) {
  return canvas(s, (g) => {
    g.drawImage(rotated(paintBone(s, 'cyl')), 0, 0);
    hGrad(g, s, [[0, 'rgba(45,28,12,0.7)'], [0.1, 'rgba(45,28,12,0)'], [0.9, 'rgba(45,28,12,0)'], [1, 'rgba(45,28,12,0.7)']]);
    blotches(g, s, 12, 'rgba(70,50,25,0.3)', [0.03, 0.08]);
    strokes(g, s, 120, ['#3e2c18'], { angle: 0, len: [0.05, 0.15], w: [1, 1.5], a: [0.25, 0.45] });   // Muskelansatz-Rillen längs
  });
}
// Hand-Knochen: wie Fuß, aber sauberer, Gelenkenden dunkel
function paintHandBone(s) {
  return canvas(s, (g) => {
    g.drawImage(rotated(paintBone(s, 'cyl')), 0, 0);
    hGrad(g, s, [[0, 'rgba(45,28,12,0.75)'], [0.14, 'rgba(45,28,12,0)'], [0.86, 'rgba(45,28,12,0)'], [1, 'rgba(45,28,12,0.75)']]);
    blotches(g, s, 8, 'rgba(70,50,25,0.3)', [0.02, 0.06]);
    blotches(g, s, 4, 'rgba(80,100,50,0.22)', [0.02, 0.05]);
  });
}
// Unterarm-Haut (x = rundherum, y = Ellbogen oben → Handgelenk unten)
function paintForearmSkin(s) {
  return canvas(s, (g) => {
    hGrad(g, s, [[0, '#7b8768'], [0.25, '#a9b394'], [0.5, '#7b8768'], [0.75, '#56604a'], [1, '#7b8768']]);   // Licht oben/außen, Schatten innen
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,45,30' : '210,215,190'},${rand(0.04, 0.1)})`; g.fillRect(rand(0, s), rand(0, s), 1.5, 1.5); }
    blotches(g, s, 12, 'rgba(120,80,110,0.22)', [0.04, 0.1]);
    blotches(g, s, 10, 'rgba(70,85,45,0.28)', [0.03, 0.09]);
    // Adern längs, auf der Handflächenseite (x 0.5–1) deutlicher
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      let x = rand(0.55, 0.95) * s, y = rand(0, 0.2) * s;
      g.strokeStyle = `rgba(70,60,110,${rand(0.35, 0.55)})`; g.lineWidth = rand(1.5, 3); g.beginPath(); g.moveTo(x, y);
      while (y < s) { x += rand(-8, 8); y += rand(20, 40); g.lineTo(x, y); }
      g.stroke();
    }
    // Sehnen am Handgelenk (unteres Viertel, Handflächenseite)
    for (const x of [0.66, 0.74, 0.82]) {
      const grd = g.createLinearGradient(x * s - 6, 0, x * s + 6, 0);
      grd.addColorStop(0, 'rgba(50,55,35,0)'); grd.addColorStop(0.4, 'rgba(225,230,200,0.3)'); grd.addColorStop(0.6, 'rgba(50,55,35,0.3)'); grd.addColorStop(1, 'rgba(50,55,35,0)');
      g.fillStyle = grd; g.fillRect(x * s - 6, 0.72 * s, 12, 0.28 * s);
    }
    // Handgelenk-Falten
    g.strokeStyle = 'rgba(50,55,35,0.55)'; g.lineWidth = 1.5;
    for (const y of [0.95, 0.975]) { g.beginPath(); g.moveTo(0.55 * s, y * s); g.quadraticCurveTo(0.75 * s, y * s + 4, 0.98 * s, y * s); g.stroke(); }
    // genähte Wunde auf dem Rücken
    const x0 = 0.18 * s, y0 = 0.3 * s;
    g.strokeStyle = 'rgba(80,30,35,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 30, y0 + 90); g.stroke();
    g.strokeStyle = 'rgba(30,25,20,0.9)'; g.lineWidth = 1.5;
    for (let k = 0; k < 9; k++) { const cx = x0 + k * 3.3, cy = y0 + k * 10; g.beginPath(); g.moveTo(cx - 6, cy + 2); g.lineTo(cx + 6, cy - 2); g.stroke(); }
    vGrad(g, s, [[0, 'rgba(40,30,15,0.25)'], [0.15, 'rgba(0,0,0,0)'], [0.85, 'rgba(0,0,0,0)'], [1, 'rgba(40,30,15,0.3)']]);
  });
}
// Handteller-Haut (x 0–0.5 Handrücken, 0.5–1 Handfläche; y oben = Knöchel, unten = Handgelenk)
function paintHandSkin(s) {
  return canvas(s, (g) => {
    g.drawImage(paintSkin(s, 'flat'), 0, 0);
    // Handrücken: Strecksehnen fächern zu den Knöcheln, Adern dazwischen, Knöchelfalten oben
    for (let i = 0; i < 4; i++) {
      const xt = (0.08 + i * 0.11) * s, xb = (0.2 + i * 0.035) * s;
      g.strokeStyle = 'rgba(225,230,200,0.28)'; g.lineWidth = 5; g.beginPath(); g.moveTo(xb, s); g.lineTo(xt, 0.05 * s); g.stroke();
      g.strokeStyle = 'rgba(50,55,35,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(xb + 5, s); g.lineTo(xt + 5, 0.05 * s); g.stroke();
    }
    g.strokeStyle = 'rgba(70,60,110,0.5)'; g.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { let x = rand(0.1, 0.4) * s, y = s; g.beginPath(); g.moveTo(x, y); while (y > 0.3 * s) { x += rand(-12, 12); y -= rand(25, 45); g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(50,55,35,0.6)'; g.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const x = (0.08 + i * 0.11) * s, y = (0.04 + k * 0.025) * s; g.beginPath(); g.moveTo(x - 12, y); g.quadraticCurveTo(x, y - 4, x + 12, y); g.stroke(); }
    // Handfläche: fahler, Handlinien, Dreck in den Falten
    g.fillStyle = 'rgba(200,190,150,0.45)'; g.fillRect(0.5 * s, 0, 0.5 * s, s);
    g.strokeStyle = 'rgba(60,45,30,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0.55 * s, 0.25 * s); g.quadraticCurveTo(0.75 * s, 0.3 * s, 0.95 * s, 0.2 * s); g.stroke();     // Herzlinie
    g.beginPath(); g.moveTo(0.55 * s, 0.42 * s); g.quadraticCurveTo(0.72 * s, 0.45 * s, 0.9 * s, 0.4 * s); g.stroke();     // Kopflinie
    g.beginPath(); g.moveTo(0.92 * s, 0.42 * s); g.quadraticCurveTo(0.8 * s, 0.7 * s, 0.86 * s, 0.98 * s); g.stroke();     // Lebenslinie
    blotches(g, s, 16, 'rgba(45,32,18,0.45)', [0.03, 0.07], [0.5, 0, 1, 1]);
  });
}
// Fleischiges Glied: Muskelbauch oben, schmal zum Gelenk, Enden geschlossen
function fleshLimb(len, r0, r1, P, bulge = 0.35) {
  const pts = [], n = P.samples + 3;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let w = lerp(r0, r1, t) * (1 + bulge * gauss(t - 0.28, 0.22));
    if (i === 0 || i === n) w *= 0.55;
    pts.push(new THREE.Vector2(w, -t * len));
  }
  return new THREE.LatheGeometry(pts, P.radial + 3);
}
// Untote Haut: grau-grünlich, fleckig, Adern, Nähte, Licht eingemalt
function paintSkin(s, mode) {
  return canvas(s, (g) => {
    if (mode === 'cyl') hGrad(g, s, [[0, '#a9b394'], [0.15, '#96a283'], [0.32, '#7b8768'], [0.5, '#56604a'], [0.68, '#7b8768'], [0.85, '#96a283'], [1, '#a9b394']]);
    else vGrad(g, s, [[0, '#a7b191'], [1, '#76805f']]);
    blotches(g, s, 18, 'rgba(120,80,110,0.22)', [0.04, 0.12]);                  // Blutergüsse
    blotches(g, s, 14, 'rgba(70,85,45,0.28)', [0.03, 0.1]);                     // Verwesung
    blotches(g, s, 8, 'rgba(200,190,150,0.2)', [0.03, 0.08]);                   // fahle Stellen
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,45,30' : '210,215,190'},${rand(0.04, 0.1)})`; g.fillRect(rand(0, s), rand(0, s), 1.5, 1.5); }   // Poren
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {                                              // Adern
      let x = rand(0, s), y = rand(0, s), a = rand(0, 6.3);
      g.strokeStyle = `rgba(70,60,110,${rand(0.25, 0.45)})`; g.lineWidth = rand(1, 2.2); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { a += rand(-0.6, 0.6); x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 2; i++) {                                               // genähte Wunden
      const x = rand(0.2, 0.8) * s, y = rand(0.2, 0.8) * s, L2 = rand(40, 80), a = rand(-0.5, 0.5);
      g.strokeStyle = 'rgba(80,30,35,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L2, y + Math.sin(a) * L2); g.stroke();
      g.strokeStyle = 'rgba(30,25,20,0.9)'; g.lineWidth = 1.5;
      for (let k = 6; k < L2; k += 9) { const cx = x + Math.cos(a) * k, cy = y + Math.sin(a) * k; g.beginPath(); g.moveTo(cx - Math.sin(a) * 6, cy + Math.cos(a) * 6); g.lineTo(cx + Math.sin(a) * 6, cy - Math.cos(a) * 6); g.stroke(); }
    }
    if (mode === 'cyl') vGrad(g, s, [[0, 'rgba(60,40,40,0.35)'], [0.1, 'rgba(0,0,0,0)'], [0.9, 'rgba(0,0,0,0)'], [1, 'rgba(60,40,40,0.35)']]);
  });
}
// Kopfhaut: oben schütteres, verfilztes Haar, Stirn frei
function paintScalp(s) {
  return canvas(s, (g) => {
    g.drawImage(paintSkin(s, 'flat'), 0, 0);
    vGrad(g, s, [[0, 'rgba(25,20,15,0.92)'], [0.3, 'rgba(25,20,15,0.85)'], [0.42, 'rgba(25,20,15,0)']]);
    strokes(g, s, 900, ['#2a2218', '#4a3e2c', '#15110b'], { len: [0.04, 0.12], w: [1, 2.5], a: [0.4, 0.8], y0: 0, y1: 0.4 });
    for (let i = 0; i < 6; i++) blotches(g, s, 1, 'rgba(150,160,125,0.7)', [0.03, 0.06], [0, 0.05, 1, 0.3]);   // kahle Stellen
    g.fillStyle = 'rgba(0,0,0,0)';
  });
}

// =====================================================================
// Hand (echte Maße, Ruhehaltung: Handfläche zum Körper, Daumen nach vorn)
//  Handlänge 10,8 % der Körpergröße. Mittelfinger ≈ Mittelhand-Länge (Handgelenk → Knöchel).
//  Knöchel liegen auf einem Bogen, Mittelfinger am höchsten. Finger-Glieder (Röntgen, Anteil am Finger):
//  Zeigefinger 49,5/28,8/21,7 %, Mittel 48,5/31,8/19,6, Ring 46,8/31,2/22, Klein 47/27,9/25,1, Daumen 57,3/42,7.
// =====================================================================
const HL = 0.108 * H;                                    // ≈ 0,204 m
const HAND = {
  zK: [0.031, 0.011, -0.01, -0.028],                     // Knöchel (vorn = Daumenseite)
  zB: [0.014, 0.005, -0.005, -0.014],                    // Basis an der Handwurzel
  kY: [-0.097, -0.102, -0.097, -0.088].map(v => v * HL / 0.204),
  len: [0.092, 0.102, 0.097, 0.075].map(v => v * HL / 0.204),
  ph: [[0.495, 0.288, 0.217], [0.485, 0.318, 0.197], [0.468, 0.312, 0.22], [0.47, 0.279, 0.251]],
  rB: [0.0046, 0.0047, 0.0043, 0.004],                   // Knochenradius Mittelhand
  rF: [0.0094, 0.0098, 0.0092, 0.008],                   // Fingerradius mit Fleisch
};
function buildHand(wrist, M, P, side, C = {}) {
  const hand = joint(wrist);
  const fingers = [], k = C.flesh ? 1 : 1.25;            // Skelett: Knochen etwas dicker, damit sie aus der Kamera lesbar bleiben
  const dors = side;                                      // Handrücken zeigt nach außen (+side x), Handfläche zum Körper
  if (!C.flesh) {
    // Handwurzel: 8 Knochen in zwei Reihen
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++)
      add(hand, new THREE.SphereGeometry(0.0072, 5, 3).scale(1, 0.85, 1.15), M.hand, dors * 0.002, -0.008 - r * 0.015, lerp(0.016, -0.015, i / 3) * (r ? 1.1 : 0.95));
    // Mittelhand: 4 lange Knochen, Basis an der Handwurzel, Köpfchen = Knöchel
    for (let i = 0; i < 4; i++) {
      const b = [dors * 0.002, -0.03, HAND.zB[i]], h = [dors * [0.002, 0.004, 0.002, -0.001][i], HAND.kY[i], HAND.zK[i]];
      add(hand, tube([b, [(b[0] + h[0]) / 2 + dors * 0.002, (b[1] + h[1]) / 2, (b[2] + h[2]) / 2], h], HAND.rB[i] * k, 4, P.fr,
        { oval: (v, tg, t) => v.multiplyScalar(1 + 0.4 * gauss(t, 0.15) + 0.55 * gauss(t - 1, 0.15)) }), M.hand);
    }
  } else {
    // Handteller als ein Körper: am Handgelenk schmal und dick, an den Knöcheln breit und flach; Ende folgt dem Knöchelbogen
    const nT = 7, nA = 14, pos = [], uv = [], idx = [];
    const yEnd = z => table([[-0.03, HAND.kY[3]], [-0.01, HAND.kY[2]], [0.011, HAND.kY[1]], [0.031, HAND.kY[0]]], z) + 0.006;
    for (let r = 0; r <= nT; r++) {
      const t = r / nT, rx = lerp(0.017, 0.012, t), rz = lerp(0.027, 0.043, smooth(0, 0.8, t)), cz = lerp(0, 0.002, t);
      for (let q = 0; q <= nA; q++) {
        const a = q / nA * Math.PI * 2, z = cz + rz * Math.cos(a), x = dors * rx * Math.sin(a) * (Math.sin(a) < 0 ? 1.15 : 1);
        pos.push(x, lerp(0.004, yEnd(z), t), z); uv.push(q / nA, t);
      }
    }
    for (let r = 0; r < nT; r++) for (let q = 0; q < nA; q++) { const i = r * (nA + 1) + q, j = i + nA + 1; if (side > 0) idx.push(i, j, i + 1, i + 1, j, j + 1); else idx.push(i, i + 1, j, i + 1, j + 1, j); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    add(hand, g, M.hand);
    add(hand, new THREE.SphereGeometry(0.017, P.sphere[0], P.sphere[1]).scale(0.85, 1.25, 0.9), M.boneFlat, -dors * 0.009, -0.034, 0.02);    // Daumenballen
    add(hand, new THREE.SphereGeometry(0.013, P.sphere[0], P.sphere[1]).scale(0.8, 1.6, 0.8), M.boneFlat, -dors * 0.008, -0.045, -0.026);    // Kleinfingerballen
  }
  // Finger: Gelenkketten (für die Animation), Ruhe leicht gebeugt
  for (let i = 0; i < 4; i++) {
    let par = joint(hand, dors * [0.002, 0.004, 0.002, -0.001][i], HAND.kY[i], HAND.zK[i]);
    par.rotation.x = -(HAND.zK[i] - HAND.zB[i]) * 1.6;                                  // fächert leicht auf
    const segs = [];
    HAND.ph[i].forEach((f, n) => {
      const len = HAND.len[i] * f, last = n === 2;
      segs.push(par);
      if (C.flesh) {
        const r = HAND.rF[i] * (1 - n * 0.1);
        add(par, tube([[0, 0.004, 0], [0, -len * 0.5, 0], [0, -len, 0]], r, 3, P.fr + 1, { oval: (v, tg, t) => { v.multiplyScalar(1 + 0.08 * gauss(t, 0.2)); v.z *= 1.06; } }), M.boneFlat);
        if (last) {
          add(par, new THREE.SphereGeometry(r * 0.98, 5, 3), M.boneFlat, 0, -len, 0);
          add(par, new THREE.CircleGeometry(r * 0.72, 6).scale(1, 1.35, 1).rotateY(dors * Math.PI / 2), M.boneFlat, dors * r * 0.88, -len * 0.62, 0, { tint: TINT.nail });
        }
      } else {
        const r = HAND.rB[i] * 0.78 * k * (1 - n * 0.14);
        add(par, tube([[0, -0.0025, 0], [0, -len * 0.5, 0], [0, -len + 0.002, 0]], r, 3, P.fr,
          { oval: (v, tg, t) => v.multiplyScalar(last ? (1 + 0.4 * gauss(t, 0.2)) * (1 - 0.35 * t) + 0.35 * gauss(t - 1, 0.1) : 1 + 0.45 * gauss(t, 0.2) + 0.4 * gauss(t - 1, 0.2)) }), M.hand);
      }
      par = joint(par, 0, -len, 0);
    });
    segs.side = side; fingers.push(segs);
  }
  // Daumen: Sattelgelenk vorn an der Handwurzel, zeigt nach vorn-unten und leicht zur Handfläche
  const tb = joint(hand, -dors * 0.01, -0.02, 0.022);
  tb.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-dors * 0.25, -0.78, 0.57).normalize());
  const tLens = [0.046, 0.034, 0.026].map(v => v * HL / 0.204), tsegs = [];
  let par = tb;
  tLens.forEach((len, n) => {
    const last = n === 2;
    if (n) tsegs.push(par);                                 // Mittelhandknochen des Daumens bewegt sich nicht mit
    if (C.flesh) {
      const r = [0.013, 0.0115, 0.0105][n];
      add(par, tube([[0, 0.004, 0], [0, -len * 0.5, 0], [0, -len, 0]], r, 3, P.fr + 2), n ? M.boneFlat : M.boneFlat);
      if (last) {
        add(par, new THREE.SphereGeometry(r * 0.98, 5, 3), M.boneFlat, 0, -len, 0);
        add(par, new THREE.CircleGeometry(r * 0.72, 6).scale(1, 1.3, 1), M.boneFlat, 0, -len * 0.6, r * 0.9, { tint: TINT.nail });
      }
    } else {
      const r = [0.0055, 0.0048, 0.0042][n] * k;
      add(par, tube([[0, -0.0025, 0], [0, -len * 0.5, 0], [0, -len + 0.002, 0]], r, 3, P.fr,
        { oval: (v, tg, t) => v.multiplyScalar(last ? (1 + 0.4 * gauss(t, 0.2)) * (1 - 0.35 * t) + 0.35 * gauss(t - 1, 0.1) : 1 + 0.45 * gauss(t, 0.2) + 0.45 * gauss(t - 1, 0.2)) }), M.hand);
    }
    par = joint(par, 0, -len, 0);
  });
  tsegs.side = side; tsegs.thumb = true; fingers.push(tsegs);
  return { hand, fingers };
}
// =====================================================================
// Unterarm. Elle (Kleinfingerseite, hinten): dicker Ellenhaken am Ellbogen, schmal zum Handgelenk.
// Speiche (Daumenseite, vorn): dünn am Ellbogen, breit am Handgelenk. Fleisch: oben Muskelmasse,
// Mitte rund, am Handgelenk flach (Handfläche–Handrücken) und breit.
// =====================================================================
function buildForearm(elbow, M, P, side, C) {
  const Lf = L.fore, dors = side;
  if (!C.flesh) {
    const k = 1.35;
    const prof = (pts) => (v, tg, t) => v.multiplyScalar(table(pts, t));
    add(elbow, tube([[0, 0.022, -0.016], [0, -0.01, -0.013], [dors * 0.002, -Lf * 0.5, -0.012], [dors * 0.003, -Lf + 0.004, -0.013]], 0.0062 * k, 8, P.radial,
      { oval: prof([[0, 1.9], [0.08, 1.5], [0.2, 1.05], [0.6, 0.85], [0.95, 0.95], [1, 1.25]]) }), M.arm);                         // Elle
    add(elbow, new THREE.ConeGeometry(0.0035 * k, 0.012, 4).rotateX(Math.PI), M.arm, dors * 0.004, -Lf - 0.002, -0.016);        // Griffelfortsatz
    add(elbow, tube([[0, -0.006, 0.01], [0, -Lf * 0.3, 0.012], [dors * 0.001, -Lf * 0.7, 0.013], [0, -Lf + 0.002, 0.012]], 0.0055 * k, 8, P.radial,
      { oval: (v, tg, t) => { v.multiplyScalar(table([[0, 1.45], [0.06, 0.9], [0.15, 1.0], [0.6, 1.1], [0.88, 1.5], [1, 1.9]], t)); v.x *= lerp(1, 0.7, t); } }), M.arm);   // Speiche
    return;
  }
  // Fleisch: Loft vom Ellbogen bis zum Handgelenk
  const nT = 10, nA = P.radial + 8, pos = [], uv = [], idx = [];
  const RX = [[0, 0.033], [0.2, 0.036], [0.45, 0.03], [0.75, 0.022], [1, 0.0175]];   // Dicke (Handfläche ↔ Handrücken)
  const RZ = [[0, 0.036], [0.2, 0.039], [0.45, 0.033], [0.75, 0.029], [1, 0.027]];   // Breite (Daumen ↔ Kleinfinger)
  for (let r = 0; r <= nT; r++) {
    const t = r / nT, y = lerp(0.03, -Lf + 0.004, t), rx = table(RX, t), rz = table(RZ, t);
    for (let q = 0; q <= nA; q++) {
      const a = q / nA * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const brach = 0.006 * gauss(t - 0.22, 0.18) * Math.max(0, c) * Math.max(0, sn + 0.4);   // Oberarm-Speichen-Muskel (Daumenseite, oben)
      const flex = 0.004 * gauss(t - 0.25, 0.2) * Math.max(0, -sn);                          // Beuger auf der Handflächenseite
      pos.push(dors * (rx * sn + (brach + flex) * Math.sign(sn || 1)), y, rz * c + brach * c);
      uv.push(q / nA, 1 - t);
    }
  }
  for (let r = 0; r < nT; r++) for (let q = 0; q < nA; q++) { const i = r * (nA + 1) + q, j = i + nA + 1; if (side > 0) idx.push(i, j, i + 1, i + 1, j, j + 1); else idx.push(i, i + 1, j, i + 1, j + 1, j); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  add(elbow, g, M.arm);
  add(elbow, new THREE.SphereGeometry(0.006, P.sphere[0], 4), M.boneFlat, dors * 0.014, -Lf + 0.012, -0.02);     // Ellenköpfchen am Handgelenk
}
// =====================================================================
// Füße (Maße real, dann leicht überzeichnet):
//  Fußlänge 15,2 % der Körpergröße, Ballenbreite = Länge / 3,3, Fersenbreite = Länge / 5,5,
//  Großzehenballen bei 77 % der Länge ab Ferse. Großzehe 2 Glieder und doppelt so dick, die anderen 3 Glieder.
//  Innen Längsgewölbe (hoch), außen fast flach; Innenknöchel höher als Außenknöchel.
// =====================================================================
const FOOT_K = 1.0;                                 // echte Länge; Stil kommt über dicke Knochen und Zehen
const FL = 0.152 * H * FOOT_K;                     // Fußlänge
const FOOT = {
  heelZ: -0.24 * FL,
  headZ: [0.77, 0.76, 0.735, 0.705, 0.665],        // Mittelfußköpfchen (Anteil ab Ferse)
  headX: [0.036, 0.018, 0.002, -0.014, -0.03],     // + = innen
  headR: [0.011, 0.0075, 0.007, 0.0066, 0.0062],
  baseZ: [0.44, 0.45, 0.43, 0.41, 0.38],
  baseX: [0.02, 0.009, -0.002, -0.013, -0.024],
  baseY: [0.05, 0.052, 0.047, 0.038, 0.03],         // Basis über Boden: innen hoch (Gewölbe), außen flach
  mtR: [0.0068, 0.0048, 0.0046, 0.0044, 0.0048],
  splay: [0, 0.04, 0.08, 0.13, 0.18],               // kleine Zehen zeigen leicht nach außen
};
// Zehenpunkte ab Mittelfußköpfchen: Großzehe gerade mit leichtem Schwung nach oben, die anderen krallen nach unten
function toePoints(i, mx, gY) {
  const lens = i === 0 ? [0.105, 0.085].map(k => k * FL) : [0.07, 0.042, 0.032].map(k => k * FL * [1, 0.94, 0.88, 0.8][i - 1]);
  const pitch = i === 0 ? [-0.05, 0.12] : [0.25, -0.5, -0.35];
  const r = FOOT.headR[i], yaw = -mx * FOOT.splay[i];
  let p = [mx * FOOT.headX[i], gY + r, FOOT.heelZ + FOOT.headZ[i] * FL];
  const pts = [p.slice()];
  lens.forEach((len, k) => {
    p = [p[0] + Math.sin(yaw) * len, p[1] + Math.sin(pitch[k]) * len, p[2] + Math.cos(yaw) * Math.cos(pitch[k]) * len];
    p[1] = Math.max(p[1], gY + r * 0.55);
    pts.push(p.slice());
  });
  return pts;
}
function buildFoot(ankle, M, P, side, C = {}) {
  const foot = joint(ankle);
  const gY = -L.ankleY, mx = -side, hz = FOOT.heelZ;
  const Z = k => hz + k * FL;
  const toes = [];
  if (!C.flesh) {
    // Knöchel (Schienbein innen höher, Wadenbein außen tiefer)
    add(foot, new THREE.SphereGeometry(0.011, P.sphere[0], P.sphere[1]).scale(0.7, 1.3, 1), M.foot, mx * 0.026, 0.008, 0.002);
    add(foot, new THREE.SphereGeometry(0.01, P.sphere[0], P.sphere[1]).scale(0.7, 1.4, 0.9), M.foot, -mx * 0.03, -0.006, -0.01);
    // Fußwurzel: Sprungbein, Fersenbein, Kahnbein, Würfelbein, 3 Keilbeine (mit Fugen dazwischen)
    add(foot, new THREE.SphereGeometry(0.02, P.sphere[0], P.sphere[1]).scale(1.15, 0.85, 1.3), M.foot, 0, -0.012, 0.006);
    add(foot, tube([[-mx * 0.004, gY + 0.048, -0.004], [-mx * 0.006, gY + 0.034, hz * 0.5], [-mx * 0.006, gY + 0.022, hz + 0.022]], 0.016, 5, P.radial, { oval: v => { v.y *= 1.3; } }), M.foot);
    add(foot, new THREE.SphereGeometry(0.02, P.sphere[0], P.sphere[1]).scale(0.95, 1.05, 1), M.foot, -mx * 0.006, gY + 0.021, hz + 0.02);
    add(foot, new THREE.SphereGeometry(0.013, P.sphere[0], P.sphere[1]).scale(1.2, 0.9, 0.8), M.foot, mx * 0.016, gY + 0.056, Z(0.36));
    add(foot, new THREE.SphereGeometry(0.015, P.sphere[0], P.sphere[1]).scale(0.95, 0.8, 1.05), M.foot, -mx * 0.018, gY + 0.03, Z(0.36));   // Würfelbein
    for (let k = 0; k < 3; k++) add(foot, new THREE.SphereGeometry(0.0085, P.sphere[0], 4).scale(0.8, 1.2, 1.3), M.foot, mx * [0.021, 0.008, -0.004][k], gY + [0.054, 0.056, 0.05][k], Z(0.41));
    // Mittelfuß: 5 lange Knochen, Basis hoch, Köpfchen auf dem Boden
    for (let i = 0; i < 5; i++) {
      const b = [mx * FOOT.baseX[i], gY + FOOT.baseY[i], Z(FOOT.baseZ[i])], h = [mx * FOOT.headX[i], gY + FOOT.headR[i], Z(FOOT.headZ[i])];
      add(foot, tube([b, [(b[0] + h[0]) / 2, (b[1] + h[1]) / 2 + 0.004, (b[2] + h[2]) / 2], h], FOOT.mtR[i], 5, P.fr + 1,
        { oval: (v, tg, k) => v.multiplyScalar(1 + 0.45 * gauss(k, 0.15) + 0.6 * (FOOT.headR[i] / FOOT.mtR[i] - 0.6) * gauss(k - 1, 0.15)) }), M.foot);
      // Zehenglieder: einzelne Knochen mit kleinen Fugen, Gelenkenden verdickt, Endglied läuft spitz aus
      const pts = toePoints(i, mx, gY), r0 = FOOT.headR[i] * 0.62;
      for (let k = 0; k < pts.length - 1; k++) {
        const A = new THREE.Vector3(...pts[k]), B = new THREE.Vector3(...pts[k + 1]), d = B.clone().sub(A).normalize();
        const a2 = A.clone().addScaledVector(d, 0.003), b2 = B.clone().addScaledVector(d, -0.002);
        const last = k === pts.length - 2, r = r0 * (1 - k * 0.12);
        const g = tube([a2.toArray(), a2.clone().lerp(b2, 0.5).toArray(), b2.toArray()], r, 3, P.fr,
          { oval: (v, tg, t) => v.multiplyScalar(last ? (1 + 0.45 * gauss(t, 0.2)) * (1 - 0.35 * t) : 1 + 0.45 * gauss(t, 0.2) + 0.4 * gauss(t - 1, 0.2)) });
        const toe = joint(foot); toes.push(toe); add(toe, g, M.foot);
      }
    }
    return { foot, toes };
  }
  // ---- Fleisch ----
  // Knöchel: Innenknöchel höher, Außenknöchel tiefer und weiter hinten
  add(foot, new THREE.SphereGeometry(0.03, P.sphere[0] + 2, P.sphere[1] + 1).scale(1.05, 1.1, 1.15), M.boneFlat, 0, -0.008, 0.002);
  add(foot, new THREE.SphereGeometry(0.009, P.sphere[0], P.sphere[1]).scale(0.6, 1.2, 1), M.boneFlat, mx * 0.027, 0.004, 0.004);    // Innenknöchel (höher)
  add(foot, new THREE.SphereGeometry(0.0085, P.sphere[0], P.sphere[1]).scale(0.6, 1.3, 0.9), M.boneFlat, -mx * 0.029, -0.01, -0.008);   // Außenknöchel (tiefer)
  // Fußkörper als Loft von der Ferse bis hinter die Zehen: flache Sohle, Gewölbe innen, Rist innen höher
  const W = [[0, 0.02], [0.06, 0.03], [0.2, 0.034], [0.45, 0.04], [0.75, 0.05], [0.92, 0.054], [1, 0.05]];
  const HT = [[0, 0.022], [0.06, 0.05], [0.25, 0.07], [0.4, 0.068], [0.6, 0.048], [0.82, 0.03], [1, 0.022]];
  const nT = 12, nA = 14, pos = [], uv = [], sh = [], idx = [];
  const len = 0.8 * FL;
  for (let r = 0; r <= nT; r++) {
    const t = r / nT, end = r === nT ? 0.55 : 1;                                     // letzter Ring schließt die Spitze unter den Zehen
    const z = hz - 0.004 + t * len - (r === nT ? 0.01 : 0), w = table(W, t) * end, h = table(HT, t) * end, cx = mx * 0.004 * t;
    const arch = 0.024 * gauss(t - 0.5, 0.17);
    for (let q = 0; q <= nA; q++) {
      const a = q / nA * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const med = Math.max(0, mx * c);
      let y = sn >= 0 ? gY + h * 0.5 * (1 + sn) : gY + h * 0.5 * (1 - Math.pow(-sn, 0.35));
      if (sn < 0) y += arch * med * Math.sqrt(-sn);                               // Längsgewölbe innen
      if (sn > 0) y += 0.007 * sn * med;                                          // Rist innen höher
      pos.push(cx + w * c * (r === 0 ? 0.6 : 1), y, z - (r === 0 ? 0.004 * (1 - Math.abs(sn)) : 0));
      uv.push(q / nA, t);
      sh.push(sn < -0.4 ? 0.62 : 1);                                              // Sohle: Schmutz
    }
  }
  for (let r = 0; r < nT; r++) for (let q = 0; q < nA; q++) { const i = r * (nA + 1) + q, j = i + nA + 1; idx.push(i, j, i + 1, i + 1, j, j + 1); }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.setAttribute('shade', new THREE.Float32BufferAttribute(sh, 1));
  body.setIndex(idx); body.computeVertexNormals();
  add(foot, body, M.foot);
  // Ferse: runder Ballen hinten
  add(foot, new THREE.SphereGeometry(0.024, P.sphere[0] + 2, P.sphere[1] + 1).scale(0.95, 0.85, 1), M.boneFlat, -mx * 0.002, gY + 0.02, hz + 0.018);
  // Zehen: Großzehe dick und gerade, die anderen krallen sich nach unten; runde Kuppen und Nägel
  const NAIL = new THREE.Color(0.9, 0.84, 0.6);
  for (let i = 0; i < 5; i++) {
    const pts = toePoints(i, mx, gY), r = i === 0 ? 0.0155 : [0.0095, 0.009, 0.0085, 0.008][i - 1];
    pts[0][2] -= 0.012;                                                           // Zehe beginnt im Ballen
    const toe = joint(foot); toes.push(toe);
    add(toe, tube(pts, r, P.tubeSeg + 1, P.fr + 1, { oval: (v, tg, t) => { v.multiplyScalar(1 + 0.12 * gauss(t - 0.55, 0.12) - 0.1 * t); v.y *= 0.85; } }), M.boneFlat);
    const tip = pts[pts.length - 1], prev = pts[pts.length - 2];
    add(toe, new THREE.SphereGeometry(r * 0.92, 5, 3).scale(1, 0.82, 1.05), M.boneFlat, ...tip);
    const dir = new THREE.Vector3(tip[0] - prev[0], tip[1] - prev[1], tip[2] - prev[2]).normalize();
    const nail = add(toe, new THREE.CircleGeometry(r * 0.68, 7).scale(1, 1.25, 1), M.boneFlat, tip[0] - dir.x * r * 0.5, tip[1] + r * 0.72, tip[2] - dir.z * r * 0.5, { tint: NAIL });
    nail.rotation.set(-Math.PI / 2 + Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) - 0.15, Math.atan2(dir.x, dir.z), 0, 'YXZ');
  }
  return { foot, toes };
}

// =====================================================================
// Gemeinsames Skelett-Rig + Stab. Kleidung kommt aus der jeweiligen Charakter-Definition.
// =====================================================================
function buildBase(P, C, M) {
  const root = new THREE.Group();
  const hips = joint(root, 0, 1.0, 0);
  const torso = joint(hips);
  if (C.showPelvis) buildPelvis(hips, M, P);
  buildTorso(torso, M, P, C);
  const neck = joint(torso, 0, T1Y + 0.01 - 1, spineZ(T1Y));
  // Hals: HWS C2–C7 ≈ 8,4 cm (Röntgen-Median), + Atlas und Schädelbasis. Weil der Kopf ×1,45 überzeichnet ist,
  // muss der Hals mitwachsen, sonst sitzt das Kinn im Kragen. Leichte Lordose: Mitte etwas nach vorn.
  const NECK = 0.225, nz = t => 0.012 * Math.sin(Math.PI * t) + 0.012 * t;
  if (C.flesh) {
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(lerp(0.043, 0.031, smooth(0, 0.7, t)) * (1 + 0.06 * gauss(t - 0.15, 0.12)), t * NECK - 0.02)); }
    const ng = new THREE.LatheGeometry(pts, P.radial + 2).scale(1, 1, 0.92);
    { const p = ng.attributes.position; for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 0.02) / NECK; p.setZ(i, p.getZ(i) + nz(t)); } ng.computeVertexNormals(); }
    add(neck, ng, M.boneFlat);
    add(neck, new THREE.SphereGeometry(0.009, P.sphere[0], P.sphere[1]).scale(0.9, 1.4, 0.8), M.boneFlat, 0, NECK * 0.42, 0.034 + nz(0.42));   // Adamsapfel
    for (const s of [-1, 1]) add(neck, tube([[s * 0.026, NECK * 0.92, 0.0], [s * 0.022, NECK * 0.5, 0.022], [s * 0.012, 0.0, 0.036]], 0.0075, 5, 4), M.boneFlat);   // Kopfwender-Muskel
  } else for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7, y = t * (NECK - 0.03);
    add(neck, new THREE.CylinderGeometry(0.011 * STYLE.bk, 0.012 * STYLE.bk, 0.02, P.radial), M.bone, 0, y, nz(t));
    add(neck, new THREE.ConeGeometry(0.0045, 0.022 + i * 0.002, 3).rotateX(-Math.PI / 2 - 0.4), M.bone, 0, y - 0.004, nz(t) - 0.026);   // Dornfortsatz (C7 am längsten)
  }
  const head = joint(neck, 0, NECK, 0.03); head.scale.setScalar(STYLE.head);
  const { sk, jaw } = buildSkull(head, M, P, C);

  const arm = side => {
    const shoulder = joint(torso, side * C.shX, L.shoulderY - 1, -0.03);
    if (!C.covered) add(shoulder, new THREE.SphereGeometry(0.02 * STYLE.bk, P.sphere[0], P.sphere[1]), M.bone, -side * 0.006, -0.004, 0);
    add(shoulder, bone(L.upper, 0.0105, P, [1.1, 1.5]), M.bone);
    const elbow = joint(shoulder, 0, -L.upper, 0);
    buildForearm(elbow, M, P, side, C);
    const wrist = joint(elbow, 0, -L.fore, 0);
    return { shoulder, elbow, wrist, ...buildHand(wrist, M, P, side, C) };
  };
  const armL = arm(1), armR = arm(-1);

  const staff = joint(armR.wrist, 0.018, -0.088, 0.004);                  // im Griff der rechten Hand (Handfläche zeigt nach +x)
  staff.rotation.x = 0.5;
  const shaft = [];
  for (let i = 0; i <= 12; i++) shaft.push([Math.sin(i * 1.7) * 0.012, -0.85 + i * 0.19, Math.cos(i * 2.3) * 0.012]);
  add(staff, tube(shaft, 0.032, P.tubeSeg * 2, P.tubeRad + 1), M.woodTube);
  for (const a of [0, 2.1, 4.2]) {
    const cx = Math.cos(a), cz = Math.sin(a);
    add(staff, tube([[cx * 0.026, 1.3, cz * 0.026], [cx * 0.09, 1.42, cz * 0.09], [cx * 0.11, 1.58, cz * 0.11], [cx * 0.045, 1.72, cz * 0.045]], 0.016, P.tubeSeg, P.tubeRad, { taper: 0.6 }), M.woodTube);
  }
  for (let i = 0; i < 3; i++) add(staff, new THREE.TorusGeometry(0.037, 0.008, 3, P.tubeSeg * 2), M.accent, 0, -0.075 - i * 0.024, 0, { tint: C.wrapTint }).rotation.x = Math.PI / 2;
  const crystal = add(staff, new THREE.OctahedronGeometry(0.1), M.crystal, 0, 1.53, 0);
  crystal.scale.y = 1.8; crystal.userData.keep = true;
  const crystalGlow = glow(staff, 0x7fd8ff, 0.55, 0, 1.53, 0);

  const leg = side => {
    const hip = joint(hips, side * HIP_X, 0, 0);
    if (C.showThigh) {
      add(hip, new THREE.SphereGeometry(0.022 * STYLE.bk, P.sphere[0], P.sphere[1]), M.bone);
      add(hip, bone(L.thigh, 0.012, P, [1, 1.5]), M.bone, side * 0.02, -0.02, 0).rotation.z = side * 0.05;
    }
    const knee = joint(hip, 0, -L.thigh, 0);
    if (C.showThigh) add(knee, new THREE.SphereGeometry(0.02 * STYLE.bk, P.sphere[0], P.sphere[1]), M.boneFlat, 0, 0.005, 0.03).scale.set(1, 1.1, 0.55);
    const shinTop = C.shinFrom ?? 0;
    if (C.flesh) add(knee, fleshLimb(L.shank - shinTop + 0.01, 0.036, 0.024, P, 0.6), M.bone, 0, -shinTop, -0.004);
    else {
      add(knee, bone(L.shank - shinTop, 0.0125, P, [shinTop ? 0 : 1.3, 1.1]), M.bone, 0, -shinTop, 0);
      add(knee, bone(L.shank - shinTop - 0.015, 0.0055, P, [shinTop ? 0 : 1, 1.4]), M.bone, side * 0.028, -shinTop - 0.01, -0.012);
    }
    const ankle = joint(knee, 0, -L.shank, 0);
    return { hip, knee, ankle, ...buildFoot(ankle, M, P, side, C) };
  };
  const legL = leg(1), legR = leg(-1);
  return { root, hips, torso, neck, head, sk, jaw, armL, armR, legL, legR, staff, crystal, crystalGlow };
}

// =====================================================================
// Materialien (Platzhalter mit Atlas-Zelle; skinMerge macht daraus 1 Lambert + 1 Glüh-Material)
// =====================================================================
const CELLS = { bone: 0, boneTube: 1, boneFlat: 2, cranium: 3, shell: 4, pants: 5, woodTube: 6, inner: 7, accent: 8, foot: 9, arm: 10, hand: 11 };
const ATLAS_COLS = 4, ATLAS_ROWS = 3;
const TINT = { nail: new THREE.Color(0.95, 0.88, 0.62), teethFlesh: new THREE.Color(1.45, 1.25, 0.95), lip: new THREE.Color(0.78, 0.55, 0.6), mouth: new THREE.Color(0.12, 0.05, 0.06), lid: new THREE.Color(0.82, 0.78, 0.78), bag: new THREE.Color(0.75, 0.62, 0.72), cartilage: new THREE.Color(0.8, 0.74, 0.62), teeth: new THREE.Color(1.1, 1.06, 0.92), brass: new THREE.Color(2.1, 1.7, 0.8), iron: new THREE.Color(0.5, 0.5, 0.55), dark: new THREE.Color(0.25, 0.22, 0.2) };
function makeMats(C) {
  const cells = C.cells || CELLS;
  const tag = (name, kind = 'lit', color = 0xffffff) => { const m = new THREE.MeshBasicMaterial({ color }); m.userData = { cell: cells[name], kind }; return m; };
  const M = {};
  for (const k of Object.keys(cells)) M[k] = tag(k);
  M.eye = tag('bone', 'glow', new THREE.Color(...C.eyeCol));
  M.crystal = new THREE.MeshBasicMaterial({ color: new THREE.Color(...(C.crystalCol || [0.8, 1.8, 2.8])) });
  return M;
}

// =====================================================================
// 1 · UNTOTER GENTLEMAN
// =====================================================================
const GENT_JACKET = {
  // Schulterlinie: vom Halsansatz (x 0.075, y 1.61) zum Schulterpunkt (x 0.24, y 1.535) ≈ 22° Gefälle wie beim Menschen.
  // Vorne: am Taillenknopf (y 1.21) geschlossen, darüber V mit Revers, darunter schräg auseinander (Cutaway).
  yBot: 0.9, yTop: 1.61, g0: 0.1, armSin: 0.86, armY0: 1.37, armY1: 1.515,
  g: y => y > 1.21 ? 0.1 + 0.42 * smooth(1.21, 1.47, y) + 0.2 * smooth(1.52, 1.61, y) : 0.1 + 0.42 * smooth(1.21, 0.92, y),
  RX: [[0.9, 0.2], [1.0, 0.185], [1.1, 0.172], [1.25, 0.175], [1.38, 0.19], [1.46, 0.205], [1.505, 0.235], [1.535, 0.244], [1.555, 0.21], [1.575, 0.165], [1.595, 0.115], [1.61, 0.078]],
  RZ: [[0.9, 0.16], [1.0, 0.145], [1.1, 0.14], [1.25, 0.15], [1.4, 0.166], [1.5, 0.14], [1.555, 0.12], [1.59, 0.095], [1.61, 0.07]],
  CZ: [[0.9, -0.01], [1.1, 0.0], [1.25, 0.022], [1.4, 0.015], [1.5, 0.0], [1.56, -0.01], [1.61, -0.02]],
  fold: (y, a) => 0.04 * smooth(1.25, 0.95, y) * Math.sin(a * 6 + 1) + 0.025 * Math.sin(a * 3 + y * 9),
};
const GENT_SHIRT = {
  yBot: 1.08, yTop: 1.6, g0: 0.06, g: y => 0.06 + 0.32 * smooth(1.5, 1.6, y),   // oberster Knopf offen
  RX: [[1.08, 0.15], [1.25, 0.16], [1.38, 0.172], [1.47, 0.168], [1.53, 0.15], [1.57, 0.11], [1.6, 0.07]],
  RZ: [[1.08, 0.13], [1.25, 0.138], [1.4, 0.15], [1.5, 0.125], [1.57, 0.095], [1.6, 0.062]],
  CZ: [[1.08, 0.01], [1.25, 0.022], [1.4, 0.015], [1.5, 0.0], [1.6, -0.018]],
  fold: (y, a) => 0.03 * smooth(1.3, 1.1, y) * Math.sin(a * 8),
};
// Sakko-Gewichte: oben Rumpf, Schulterpartie geht mit dem Arm, Schöße mit den Beinen
const jacketWeights = ({ torso, hips, armL, armR, legL, legR }) => p => {
  const wT = smooth(0.98, 1.12, p.y), wL = 0.7 * smooth(1.0, 0.9, p.y), k = clamp01(0.5 + p.x / 0.2);
  const wS = 0.35 * smooth(0.16, 0.235, Math.abs(p.x)) * smooth(1.45, 1.52, p.y);
  return [[torso, wT * (1 - wS)], [p.x > 0 ? armL.shoulder : armR.shoulder, wT * wS], [hips, Math.max(0, 1 - wT - wL)], [legL.hip, wL * k], [legR.hip, wL * (1 - k)]];
};
// Revers mit Kerbe: oben schmaler Kragen, Kerbe, dann breite Spitze, läuft am obersten Knopf aus
const lapelW = t => t < 0.2 ? 0.038 : t < 0.27 ? lerp(0.038, 0.012, smooth(0.2, 0.27, t)) : 0.078 * smooth(0.27, 0.36, t) * (1 - smooth(0.4, 1, t)) + 0.012 * (1 - smooth(0.27, 0.4, t));
// Gemeinsam für alle Gentleman-Modelle: Schulterbreite, Zahnlücken, Augen, Schlurfgang, Idle
const GENT_BASE = {
  shX: 0.2, missingTop: [2, 6], missingBottom: [4], eye: 0x8fffd0, eyeCol: [0.9, 2.8, 1.9],
  // Schlurfen: rechtes Bein zieht nach, Oberkörper schwankt, Kopf und linker Arm hängen verzögert hinterher
  gait(j, t, ph, s, R) {
    const sw = Math.sin(ph), cw = Math.cos(ph);
    t.lHip = -sw * 0.5; t.lKnee = Math.max(0, sw) * 0.8 + 0.08;
    t.rHip = sw * 0.32; t.rKnee = 0.12 + Math.max(0, -sw) * 0.25; t.rAnkle = 0.35 * Math.max(0, -sw);   // Zehen schleifen
    t.sway = sw * 0.13; t.lean = 0.16; t.hipsY = 0.975 + Math.abs(cw) * 0.035;
    t.headZ = 0.2 + sw * 0.16; t.headX = 0.14 + Math.abs(cw) * 0.06; t.jaw = 0.2 + Math.abs(sw) * 0.05;
    t.lSh = sw * 0.3; t.lShZ = 0.06; t.lEl = -0.05; t.gripL = 0.1;
    t.rSh = -0.35 + Math.max(0, -sw) * 0.35; t.rEl = -0.55; t.rShZ = -0.16;
  },
  // Idle: Kopf sackt langsam weg (wie einschlafen) und ruckt zurück, danach klappert der Kiefer
  idle(t, ph, time) {
    const c = (time / 5200) % 1, droop = c < 0.8 ? smooth(0.1, 0.78, c) : 1 - smooth(0.8, 0.84, c);
    const clack = c > 0.84 && c < 0.95 ? Math.abs(Math.sin(c * 160)) * 0.14 : 0;
    t.sway = Math.sin(ph * 0.6) * 0.05; t.headZ = 0.18 + Math.sin(ph * 0.45) * 0.06 + droop * 0.12; t.headX = 0.08 + droop * 0.42;
    t.jaw = 0.1 + droop * 0.16 + clack; t.lean = 0.1 + droop * 0.05; t.lShZ = 0.05; t.lEl = -0.05; t.gripL = 0.1;
  },
  lag: { head: 3.5, arm: 3 }, freq: 4.2,
  extra(R, j, time) { if (R.tie) { R.tie.rotation.z = -j.swayLag * 0.9 + Math.sin(time / 400) * 0.03; R.tie.rotation.x = 0.12 + j.lean * 0.5; R.tie2.rotation.z = 0.15 - j.swayLag * 0.5; } },
};

const GENT = {
  ...GENT_BASE, id: 'gent', name: 'Skelett', covered: true, wrapTint: TINT.dark, shinFrom: 0.22,
  paint(s) {
    const SH = '22,16,30', LI = '150,140,165';
    const jacket = canvas(s, g => {
      const S = GENT_JACKET, yOf = y => garmentY(S, y) * s;
      g.fillStyle = '#463e52'; g.fillRect(0, 0, s, s);
      weave(g, s, 3, '10,5,15', '230,220,240');
      for (let x = 6; x < s; x += 16) { g.fillStyle = 'rgba(200,190,215,0.16)'; g.fillRect(x, 0, 1.5, s); }   // Nadelstreifen
      blotches(g, s, 16, `rgba(${LI},0.14)`, [0.05, 0.15]);
      blotches(g, s, 12, `rgba(${SH},0.35)`, [0.05, 0.15]);
      vGrad(g, s, [[0, `rgba(${LI},0.22)`], [0.3, `rgba(${LI},0)`], [0.7, `rgba(${SH},0)`], [1, `rgba(${SH},0.55)`]]);
      for (let i = 0; i < 16; i++) pipeFold(g, rand(0.02, 0.98) * s, yOf(1.24) + rand(-10, 30), s, rand(16, 30), SH, LI, rand(0.3, 0.5));
      // Revers / Besatz an den Vorderkanten: dunkler, glatter Satin mit Glanzkante
      for (const x of [0, s - 22]) { g.fillStyle = '#1c1822'; g.fillRect(x, 0, 22, s); g.fillStyle = 'rgba(200,190,230,0.25)'; g.fillRect(x + (x ? 2 : 18), 0, 2, s); }
      // Nähte: Seiten, Rücken, Taille, Rückenschlitz
      const u = a => garmentU(S, a) * s;
      for (const a of [Math.PI / 2, 3 * Math.PI / 2]) seamV(g, u(a), yOf(S.armY0), s, null);
      seamV(g, 0.5 * s, 0, s, null); seamH(g, yOf(1.1), 0, s, null);
      tear(g, 0.5 * s, s - 5, 6, 40, 'rgba(10,5,15,0.6)');                                                     // Schlitz hinten
      // Taschenklappen vorn, Knöpfe
      for (const x of [0.12, 0.88]) { g.fillStyle = 'rgba(15,10,20,0.6)'; g.fillRect(x * s - 26, yOf(1.02), 52, 5); g.fillStyle = 'rgba(200,190,230,0.2)'; g.fillRect(x * s - 26, yOf(1.02) - 2, 52, 2); }
      for (const y of [1.2, 1.1]) { g.fillStyle = '#0f0c12'; g.beginPath(); g.arc(s - 34, yOf(y), 6, 0, 7); g.fill(); g.fillStyle = 'rgba(220,210,240,0.5)'; g.beginPath(); g.arc(s - 36, yOf(y) - 2, 2, 0, 7); g.fill(); }
      crossStitchPatch(g, 0.6 * s, 0.45 * s, 54, 44, 'rgba(80,60,55,0.9)');
      // Verfall: Mottenlöcher, Abrieb an den Kanten, Grabschmutz
      for (let i = 0; i < 6; i++) tear(g, rand(0.08, 0.92) * s, rand(0.35, 0.9) * s, rand(4, 9), rand(5, 12), 'rgba(20,12,25,0.5)');
      strokes(g, s, 160, [`rgb(${LI})`], { angle: 0, len: [0.01, 0.04], w: [1, 2], a: [0.15, 0.3], y0: 0.9, y1: 0.98 });
      grime(g, s);
      frayBottom(g, s, 0.06);
      // Ärmel (eigene Zone unten links nicht nötig: Ärmel nutzen dieselbe Zelle, Ellbogen-Zickzack mittig)
      zigzag(g, 0.3 * s, 0.7 * s, 0.42 * s, 0.1 * s, 4, SH, LI, 0.25);
    });
    const pants = canvas(s, g => {
      const yBot = 0.17, yOf = y => (1 - (y - yBot) / (1.13 - yBot)) * s;
      g.fillStyle = '#423b4c'; g.fillRect(0, 0, s, s);
      weave(g, s, 3, '10,5,15', '230,220,240');
      for (let x = 6; x < s; x += 16) { g.fillStyle = 'rgba(200,190,215,0.14)'; g.fillRect(x, 0, 1.5, s); }
      blotches(g, s, 12, `rgba(${SH},0.35)`, [0.05, 0.15]);
      vGrad(g, s, [[0, 'rgba(0,0,0,0.3)'], [0.1, `rgba(${LI},0.1)`], [0.4, 'rgba(0,0,0,0)'], [1, `rgba(${SH},0.5)`]]);
      for (let i = 0; i < 24; i++) pipeFold(g, rand(0, 1) * s, 0, rand(0.08, 0.14) * s, rand(6, 12), SH, LI, 0.5);
      for (let i = 0; i < 10; i++) pipeFold(g, rand(0, 1) * s, rand(0.15, 0.25) * s, yOf(L.kneeY) + 40, rand(14, 26), SH, LI, 0.35);
      zigzag(g, 0.34 * s, 0.66 * s, yOf(L.kneeY) - 30, 60, 5, SH, LI, 0.55);
      g.fillStyle = 'rgba(220,210,240,0.12)'; g.fillRect(0.5 * s - 1, 0.1 * s, 2, 0.85 * s);                       // alte Bügelfalte
      zigzag(g, 0, s, 0.82 * s, 0.12 * s, 6, SH, LI, 0.5);
      seamV(g, 0.25 * s, 0.03 * s, s, null); seamV(g, 0.75 * s, 0.25 * s, s, null);
      tear(g, 0.5 * s, yOf(L.kneeY) - 6, 14, 18, 'rgba(20,12,25,0.5)');                                          // Knieloch
      for (let i = 0; i < 4; i++) tear(g, rand(0, 1) * s, rand(0.3, 0.85) * s, rand(3, 7), rand(4, 9), 'rgba(20,12,25,0.45)');
      grime(g, s); frayBottom(g, s, 0.09, 22);
    });
    const shirt = canvas(s, g => {
      const S = GENT_SHIRT, yOf = y => garmentY(S, y) * s;
      g.fillStyle = '#bfb08a'; g.fillRect(0, 0, s, s);
      weave(g, s, 2, '90,70,40', '255,250,235', 0.8);
      hGrad(g, s, [[0, 'rgba(60,45,20,0.35)'], [0.15, 'rgba(0,0,0,0)'], [0.85, 'rgba(0,0,0,0)'], [1, 'rgba(60,45,20,0.35)']]);
      vGrad(g, s, [[0, 'rgba(255,250,230,0.25)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(90,70,30,0.35)']]);
      blotches(g, s, 14, 'rgba(150,120,60,0.35)', [0.03, 0.09]);                                                 // Vergilbung
      blotches(g, s, 6, 'rgba(90,60,30,0.35)', [0.02, 0.05]);
      for (let i = 0; i < 10; i++) pipeFold(g, rand(0, 1) * s, rand(0.3, 0.5) * s, s, rand(10, 20), '110,95,70', '255,250,235', 0.35);
      // Knopfleiste an den Vorderkanten, Kragen oben
      for (const x of [10, s - 10]) { g.fillStyle = 'rgba(120,100,70,0.35)'; g.fillRect(x - 8, 0, 16, s); }
      for (let y = 30; y < s; y += 55) { g.fillStyle = 'rgba(60,45,25,0.6)'; g.beginPath(); g.arc(s - 10, y + 1, 4.5, 0, 7); g.fill(); g.fillStyle = '#e6dcc2'; g.beginPath(); g.arc(s - 10, y, 3.5, 0, 7); g.fill(); g.fillStyle = 'rgba(60,45,25,0.7)'; g.fillRect(6, y - 1, 9, 2); }   // Knöpfe nur an einer Leiste, Knopflöcher gegenüber
      g.fillStyle = 'rgba(120,100,70,0.5)'; g.fillRect(0, 0, s, 14);
      // Risse vorne: Rippen schauen durch
      const front = [[0.07, 1.42, 18, 26], [0.13, 1.3, 26, 34], [0.9, 1.36, 24, 30], [0.95, 1.22, 16, 20], [0.18, 1.19, 14, 16], [0.84, 1.47, 10, 12], [0.06, 1.17, 12, 18], [0.86, 1.13, 16, 12]];
      for (const [u, y, rx, ry] of front) tear(g, u * s, yOf(y), rx, ry, 'rgba(90,60,25,0.55)');
      for (let i = 0; i < 4; i++) tear(g, rand(0.3, 0.7) * s, rand(0.2, 0.8) * s, rand(5, 12), rand(6, 14), 'rgba(90,60,25,0.5)');
    });
    const tie = canvas(s, g => {                                                    // Krawatte (oben) + Stabwicklung
      g.fillStyle = '#5a1418'; g.fillRect(0, 0, s, s);
      for (let k = -s; k < 2 * s; k += 36) { g.strokeStyle = 'rgba(160,60,50,0.55)'; g.lineWidth = 8; g.beginPath(); g.moveTo(k, 0); g.lineTo(k + s, s); g.stroke(); g.strokeStyle = 'rgba(20,0,5,0.4)'; g.lineWidth = 3; g.beginPath(); g.moveTo(k + 10, 0); g.lineTo(k + 10 + s, s); g.stroke(); }
      hGrad(g, s, [[0, 'rgba(0,0,0,0.45)'], [0.35, 'rgba(255,200,190,0.18)'], [0.5, 'rgba(255,200,190,0.05)'], [1, 'rgba(0,0,0,0.5)']]);   // Seidenglanz
      blotches(g, s, 6, 'rgba(20,10,5,0.4)', [0.03, 0.06]);
      tear(g, 0.6 * s, 0.7 * s, 10, 14, 'rgba(30,5,5,0.6)');
      frayBottom(g, s, 0.06, 14);
    });
    return { shell: jacket, pants, inner: shirt, accent: tie };
  },
  clothe(R, P, M) {
    const { root, hips, torso, armL, armR, legL, legR } = R;
    for (const [s, lg] of [[1, legL], [-1, legR]]) {
      const { geo, weights } = pantsLeg(s, P, { hips, hip: lg.hip, knee: lg.knee }, { yBot: 0.17, flare: 0.14 });
      add(root, geo, M.pants, 0, 0, 0, { weights });
    }
    add(root, garment(GENT_JACKET, P.shell), M.shell, 0, 0, 0, { weights: jacketWeights(R) });
    add(root, garment(GENT_SHIRT, [Math.round(P.shell[0] * 0.7), P.shell[1]]), M.inner, 0, 0, 0, { weights: () => [[torso, 1]] });
    for (const s of [-1, 1]) {
      const pts = [], uv = [], n = 8;
      for (let i = 0; i <= n; i++) {
        const t = i / n, y = lerp(1.6, 1.22, t), ang = s > 0 ? GENT_JACKET.g(y) : 2 * Math.PI - GENT_JACKET.g(y);
        const ex = Math.sin(ang) * table(GENT_JACKET.RX, y), ez = table(GENT_JACKET.CZ, y) + Math.cos(ang) * table(GENT_JACKET.RZ, y);
        const w = lapelW(t);
        pts.push(ex, y, ez + 0.004, ex + s * w, y + 0.016 * (1 - t), ez + 0.016 - w * 0.3);
        uv.push(0.01, 1 - t, 0.04, 1 - t);
      }
      const idx = []; for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      add(root, geo, M.shell, 0, 0, 0, { weights: () => [[torso, 1]] });
    }
    // Kragen hinten: Wulst um den Nacken, verbindet die beiden Revers
    const collar = [];
    for (let i = 0; i <= 10; i++) {
      const ang = lerp(GENT_JACKET.g(1.6), 2 * Math.PI - GENT_JACKET.g(1.6), i / 10);
      collar.push([Math.sin(ang) * 0.088, 1.608 + 0.01 * Math.abs(Math.cos(ang)), -0.02 + Math.cos(ang) * 0.078]);
    }
    add(root, tube(collar, 0.014, 14, 4, { oval: v => { v.y *= 1.5; } }), M.shell, 0, 0, 0, { weights: () => [[torso, 1]], tint: TINT.dark.clone().multiplyScalar(2.4) });
    // Einstecktuch (linke Brusttasche) aus Krawattenseide
    for (const [rz, dx] of [[0.35, -0.008], [-0.3, 0.008]]) add(torso, new THREE.CircleGeometry(0.022, 3).rotateZ(Math.PI / 2 + rz), M.accent, 0.112 + dx, 1.437 - 1, 0.152).rotation.x = -0.25;
    // Sakkoärmel: setzt unter der Schulterkante an, deckt den Oberarm, reißt knapp unterm Ellbogen ab
    for (const [s, a] of [[1, armL], [-1, armR]]) {
      const { geo, weights } = sleeve(P, s, 0.205, 1.53, L.shoulderY - L.upper - L.fore * 0.16, 0.055, 0.047, a);
      add(root, geo, M.shell, 0, 0, 0, { weights });
    }
    // Sakkoknöpfe (oberer geschlossen, unterer offen) und Taschenklappen
    const onJacket = (x, y, out = 0.006) => { const ang = Math.asin(Math.max(-1, Math.min(1, x / table(GENT_JACKET.RX, y)))); return [x, y - 1, table(GENT_JACKET.CZ, y) + Math.cos(ang) * table(GENT_JACKET.RZ, y) + out, ang]; };
    for (const [x, y] of [[0.004, 1.21], [0.05, 1.11]]) { const [px, py, pz] = onJacket(x, y); add(torso, new THREE.CylinderGeometry(0.009, 0.009, 0.006, 8).rotateX(Math.PI / 2), M.accent, px, py, pz, { tint: TINT.dark }); }
    for (const s of [-1, 1]) { const [px, py, pz, ang] = onJacket(s * 0.125, 1.03, 0.004); add(hips, new THREE.BoxGeometry(0.1, 0.03, 0.006), M.shell, px, py + 1 - 1, pz, { tint: TINT.dark.clone().multiplyScalar(2.6) }).rotation.y = ang; }
    // Boutonniere: verwelkte Blume im linken Revers
    for (let k = 0; k < 4; k++) add(torso, new THREE.CircleGeometry(0.011, 5), M.accent, 0.095 + Math.cos(k * 1.6) * 0.008, 0.505 + Math.sin(k * 1.6) * 0.008, 0.152, { tint: new THREE.Color(0.75, 0.55, 0.6) }).rotation.set(-0.3, 0.5, k);
    add(torso, tube([[0.095, 0.505, 0.15], [0.1, 0.47, 0.152], [0.096, 0.44, 0.153]], 0.0025, 3, 3), M.accent, 0, 0, 0, { tint: new THREE.Color(0.4, 0.6, 0.3) });
    // Hemdkragen: zwei Spitzen, aufgeklappt
    for (const s of [-1, 1]) add(torso, panel(0.042, 0.055, P, 0, 0.5), M.inner, s * 0.04, 1.6 - 1, 0.055).rotation.set(-0.55, s * 0.5, s * 0.55);
    // Krawatte: Knoten + zwei Bahnen an eigenem Gelenk (schwingt nach)
    const tie = joint(torso, 0, 1.505 - 1, 0.138); tie.rotation.x = 0.12;                          // gelockert: Knoten tiefer
    add(tie, new THREE.BoxGeometry(0.032, 0.028, 0.02).rotateZ(0.2), M.accent, 0, -0.01, 0);
    for (const s of [-1, 1]) add(torso, tube([[s * 0.05, 1.595 - 1, 0.05], [s * 0.032, 1.545 - 1, 0.112], [s * 0.008, 1.505 - 1, 0.138]], 0.006, 4, 3, { oval: v => { v.x *= 2.2; } }), M.accent);   // Schlinge zum Kragen
    add(tie, panel(0.05, 0.27, P, 3, -0.4), M.accent, 0, -0.02, 0.004);
    const tie2 = joint(tie, -0.004, -0.02, -0.004); tie2.rotation.z = 0.15;
    add(tie2, panel(0.032, 0.21, P, 3, -0.3), M.accent, 0, 0, 0);
    R.tie = tie; R.tie2 = tie2;
  },
};

const GENT_FLESH = { ...GENT, id: 'gentFlesh', name: 'Mit Fleisch und Haut', flesh: true, eye: 0xd8ff70, eyeCol: [1.8, 2.6, 0.5] };
// =====================================================================
// Vanilla-Weg: dasselbe Rig, rund 2.000 statt 10.000 Dreiecke.
// Wie in Classic WoW: Geometrie nur für die Silhouette. Licht, AO, Nähte, Rippen,
// Knöpfe und Blume stehen in der Textur. Finger, Zehen und Zähne sind Platten mit
// Alpha-Ausschnitt (alphaTest), so lesen sie sich als einzelne Knochen.
// Malregeln: Licht warm, Schatten kühl ins Lila, nie neutrales Grau, Licht von oben.
// =====================================================================
const LOW_CELLS = { face: 0, bone: 1, hand: 2, foot: 3, shell: 4, pants: 5, woodTube: 6, inner: 7, accent: 8, sleeve: 9, satin: 10, cranium: 11 };
const LOWP = { pants: [8, 9], fr: 3 };                                  // Stoffröhren: 8 Seiten
const LOW_JACKET = { ...GENT_JACKET, armSin: 0.95, fold: (y, a) => 0.035 * smooth(1.25, 0.95, y) * (0.5 + 0.5 * Math.sin(a * 3 + 1)) + 0.012 * (1 + Math.sin(a * 2 + y * 9)) };   // Falten nur nach außen: grobe Sehnen schneiden sonst ins Hemd
const LOW_SHIRT = { ...GENT_SHIRT, yBot: 1.12, RX: GENT_SHIRT.RX.map(([y, r]) => [y, r * lerp(0.93, 1, smooth(1.2, 1.35, y))]), fold: null };
const FACE = { x0: -0.09, x1: 0.09, y0: -0.165, y1: 0.015 };            // Frontalprojektion im Schädelraum
const CRAN = { y0: -0.06, y1: 0.088 };
const faceUV = (x, y) => [(x - FACE.x0) / (FACE.x1 - FACE.x0), (y - FACE.y0) / (FACE.y1 - FACE.y0)];
const LIT = '255,244,214', SHD = '46,26,62', DEEP = '14,8,20';
const rgba = (c, a) => `rgba(${c},${a})`;

// ---------- UV- und Geometrie-Werkzeuge ----------
function setUV(geo, fn) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const [u, v] = fn(p.getX(i), p.getY(i), p.getZ(i)); uv[i * 2] = u; uv[i * 2 + 1] = v; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
function subUV(geo, x0, y0, x1, y1) {                                   // UV in einen Teil der Zelle legen
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(x0, x1, uv.getX(i)), lerp(y0, y1, uv.getY(i)));
  return geo;
}
function mirrorU(geo) {                                                 // links und rechts teilen sich die Textur: doppelte Auflösung
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, Math.abs(2 * uv.getX(i) - 1));
  return geo;
}
function gridGeo(rows, uvOf) {                                          // rows[r][c] = [x, y, z]
  const pos = [], uv = [], idx = [], C = rows[0].length;
  rows.forEach((row, r) => row.forEach((p, c) => { pos.push(...p); uv.push(...uvOf(r, c, p)); }));
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < C - 1; c++) { const a = r * C + c, b = a + C; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// Platte mit Dicke: Ober- und Unterseite tragen das Alpha-Motiv, die Seitenkanten
// nehmen die Randspalte der Textur (dort liegt der äußere Knochen).
function slab(rows, th, nrm, uvOf, tip = true, edge = 0.03) {          // edge: wie weit die Kante in die Textur greift (Knochenmitte)
  const pos = [], uv = [], R = rows.length, C = rows[0].length;
  const at = (r, c, k, du = 0, dv = 0) => { const p = rows[r][c], [u, v] = uvOf(r, c); return [[p[0] + nrm[0] * th * k, p[1] + nrm[1] * th * k, p[2] + nrm[2] * th * k], [u + du, v + dv]]; };
  const quad = (a, b, c, d) => { for (const [p, t] of [a, b, c, c, b, d]) { pos.push(...p); uv.push(...t); } };
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
    quad(at(r, c, 0.5), at(r + 1, c, 0.5), at(r, c + 1, 0.5), at(r + 1, c + 1, 0.5));
    quad(at(r, c + 1, -0.5), at(r + 1, c + 1, -0.5), at(r, c, -0.5), at(r + 1, c, -0.5));
  }
  for (const [c, du] of [[0, edge], [C - 1, -edge]]) for (let r = 0; r < R - 1; r++) quad(at(r, c, 0.5, du), at(r + 1, c, 0.5, du), at(r, c, -0.5, du), at(r + 1, c, -0.5, du));
  if (tip) { const r = R - 1, dv = (uvOf(R - 2, 0)[1] - uvOf(r, 0)[1]) * 0.15; for (let c = 0; c < C - 1; c++) quad(at(r, c, 0.5, 0, dv), at(r, c + 1, 0.5, 0, dv), at(r, c, -0.5, 0, dv), at(r, c + 1, -0.5, 0, dv)); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}
function lowPanel(w, h, ny, taperK = 0) {                               // Stoffbahn, Mitte leicht nach vorn
  const geo = new THREE.PlaneGeometry(w, h, 2, ny).translate(0, -h / 2, 0), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, x === 0 ? 0.004 : 0); p.setX(i, x * (1 - taperK * (-y / h))); }
  geo.computeVertexNormals();
  return geo;
}

// ---------- Schädel ----------
// Gesichtsmaske aus 7 Reihen. Proportionen nach Loomis und Schädel-Zeichenregeln:
// Augen auf halber Kopfhöhe, eine Augenbreite Abstand, Drittel Braue – Nasenbasis – Kinn,
// Jochbein = breiteste Stelle. Tiefe kommt nur grob aus der Geometrie, der Rest ist gemalt.
const FACE_ROWS = [   // y, halbe Breite, z vorn, z Mitte der Rundung, Umgriff (Grad)
  [0.000, 0.066, 0.090, 0.0, 100], [-0.014, 0.068, 0.088, 0.0, 105], [-0.032, 0.070, 0.084, 0.0, 110],
  [-0.050, 0.071, 0.084, 0.0, 112], [-0.066, 0.058, 0.084, 0.01, 100], [-0.078, 0.046, 0.083, 0.02, 95], [-0.088, 0.036, 0.080, 0.03, 95],
];
const FACE_COLS = [-1, -0.73, -0.47, -0.26, -0.11, 0, 0.11, 0.26, 0.47, 0.73, 1];
function faceMask() {
  const rows = FACE_ROWS.map(([y, hw, zc, zb, tm], r) => FACE_COLS.map(f => {
    const th = f * tm * Math.PI / 180, a = Math.abs(f);
    let x = hw * Math.sin(th), z = zb + (zc - zb) * Math.cos(th);
    const orb = a === 0.26 ? 1 : (a === 0.11 || a === 0.47) ? 0.4 : 0;
    if (r === 1 && a <= 0.47) z += 0.004;                                  // Brauenwulst
    if (r === 2) z -= 0.02 * orb;                                          // Augenhöhle
    if (r === 3) { z -= 0.009 * orb; if (a === 0.73) { x += Math.sign(f) * 0.004; z += 0.004; } }   // Unterrand, Jochbein
    if (r === 4 && a <= 0.11) z -= a ? 0.005 : 0.009;                      // Nasenöffnung
    if (r === 5 && a === 0) z -= 0.006;
    return [x, y, z];
  }));
  return gridGeo(rows, (r, c, p) => faceUV(p[0], p[1]));
}
const teethStrip = (y0, y1, zF, dy) => gridGeo([y1, y0].map(y => Array.from({ length: 7 }, (_, i) => { const t = -1 + i / 3; return [0.027 * t, y, zF - 0.026 * t * t]; })), (r, c, q) => faceUV(q[0], q[1] + dy));
function lowSkull(head, M, C) {
  const sk = joint(head, 0, 0.05, 0.01);
  if (C.hood) {                                                          // leere Kapuze: nur Dunkel, kein Gesicht, keine Augen
    add(sk, new THREE.SphereGeometry(0.08, 8, 6), glowMat(0, 0, 0), 0, -0.03, -0.035);
    return { sk, jaw: joint(sk, 0, -0.045, -0.012) };
  }
  const cr = craniumGeo([12, 8]), p = cr.attributes.position, uv = cr.attributes.uv;
  for (let i = 0; i < p.count; i++) {                                     // Spiegel-UV: vorn u = 0, hinten u = 1
    const lon = uv.getX(i) * 2 * Math.PI - Math.PI / 2;
    uv.setXY(i, Math.abs(Math.atan2(Math.sin(lon), Math.cos(lon))) / Math.PI, (p.getY(i) - CRAN.y0) / (CRAN.y1 - CRAN.y0));
  }
  add(sk, cr, M.cranium);
  add(sk, faceMask(), M.face);
  add(sk, teethStrip(-0.1, -0.086, 0.079, 0), M.face);                   // Oberkiefer-Zähne (Lücken per Alpha)
  const jaw = joint(sk, 0, -0.045, -0.012);
  const half = [[0.056, -0.008, 0.004], [0.054, -0.038, 0.002], [0.05, -0.064, 0.012], [0.042, -0.078, 0.05], [0.023, -0.088, 0.078]];
  const path = [...half.map(([x, y, z]) => [-x, y, z]), [0, -0.093, 0.09], ...half.map(q => q.slice()).reverse()];
  const jg = C.flesh ? tube(path, 0.017, 10, 5, { oval: (v, tg) => { const vert = Math.abs(tg.y); v.y *= 1 + 0.5 * (1 - vert); v.z *= 1 + 0.4 * vert; } })   // Fleisch: voller Unterkiefer
    : tube(path, 0.009, 10, 4, { oval: (v, tg) => { const vert = Math.abs(tg.y); v.y *= 1 + 0.9 * (1 - vert); v.z *= 1 + 1.5 * vert; v.x *= 0.7 + 0.1 * vert; } });
  add(jaw, jg, M.bone);
  add(jaw, teethStrip(-0.069, -0.056, 0.084, -0.045), M.face);
  for (const s of [-1, 1]) { const e = add(sk, new THREE.OctahedronGeometry(0.0085), M.eye, s * 0.034, -0.032, 0.056); glow(e, C.eye, 0.065); }
  return { sk, jaw };
}

// ---------- Unterarm, Hand, Fuß ----------
function lowForearm(elbow, M, side, k = 1.35) {                        // k > 1,35: Fleisch (Elle und Speiche verschmelzen)
  const Lf = L.fore;
  add(elbow, tube([[0, 0.022, -0.016], [0, -0.01, -0.013], [side * 0.002, -Lf * 0.5, -0.012], [side * 0.003, -Lf + 0.004, -0.013]], 0.0062 * k, 4, 4,
    { oval: (v, tg, t) => v.multiplyScalar(table([[0, 1.9], [0.15, 1.2], [0.6, 0.85], [1, 1.25]], t)) }), M.bone);           // Elle
  add(elbow, tube([[0, -0.006, 0.01], [0, -Lf * 0.3, 0.012], [side * 0.001, -Lf * 0.7, 0.013], [0, -Lf + 0.002, 0.012]], 0.0055 * k, 4, 4,
    { oval: (v, tg, t) => v.multiplyScalar(table([[0, 1.3], [0.15, 1.0], [0.6, 1.1], [1, 1.8]], t)) }), M.bone);             // Speiche
}
// Hand: Handwurzel-Block, Mittelhand-Platte, eine Fingerplatte in 3 Gliedern (alle vier Finger gemalt), Daumen als Röhren.
const LOW_HAND = { zMin: -0.034, zMax: 0.037, base: -0.026, len: 0.176, fl: HAND.ph[1].map(f => f * HAND.len[1]) };
const handU = z => (z - LOW_HAND.zMin) / (LOW_HAND.zMax - LOW_HAND.zMin);
function lowHand(wrist, M, side) {
  const hand = joint(wrist), d = side, H_ = LOW_HAND, along = y => (H_.base - y) / H_.len;
  const row = (y, z0, z1, x0) => [[d * x0, y, z0], [d * (x0 + 0.003), y, (z0 + z1) / 2], [d * x0, y, z1]];   // Handrücken leicht gewölbt
  add(hand, subUV(new THREE.SphereGeometry(0.018, 6, 3).scale(0.5, 0.95, 1.05), 0.76, 0, 1, 1), M.hand, d * 0.002, -0.014, 0);
  const meta = [row(-0.024, -0.017, 0.019, 0.002), row(-0.103, H_.zMin, H_.zMax, 0.002)];
  add(hand, subUV(slab(meta, 0.017, [d, 0, 0], (r, c) => [c / 2, 1 - along(meta[r][c][1])], false, 0.085), 0, 0, 0.75, 1), M.hand);
  const fingers = [], segs = [];
  let par = joint(hand, d * 0.002, -0.1, 0.0015), yA = -0.1;
  H_.fl.forEach((len, n) => {
    segs.push(par);
    const last = n === 2, z0 = H_.zMin - 0.0015, z1 = H_.zMax - 0.0015, y0 = yA;
    const rows = [row(0.003, z0, z1, 0), row(-len - (last ? 0 : 0.002), z0, z1, 0)];
    add(par, subUV(slab(rows, 0.015 * (1 - n * 0.12), [d, 0, 0], (r, c) => [c / 2, 1 - along(y0 + rows[r][c][1])], last, 0.085), 0, 0, 0.75, 1), M.hand);
    par = joint(par, 0, -len, 0); yA -= len;
  });
  segs.side = side; fingers.push(segs);
  const tb = joint(hand, -d * 0.01, -0.02, 0.022);
  tb.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-d * 0.25, -0.78, 0.57).normalize());
  const tsegs = []; par = tb;
  [0.046, 0.034, 0.026].map(v => v * HL / 0.204).forEach((len, n) => {
    if (n) tsegs.push(par);
    add(par, subUV(tube([[0, 0.002, 0], [0, -len * 0.5, 0], [0, -len, 0]], [0.0068, 0.006, 0.0052][n], 2, 4, { taper: n === 2 ? 0.4 : 0 }), 0.76, 0, 1, 1), M.hand);
    par = joint(par, 0, -len, 0);
  });
  tsegs.side = side; tsegs.thumb = true; fingers.push(tsegs);
  return { hand, fingers };
}
// Fuß: Fußwurzel als ein Loft, davor eine gewölbte Platte für Mittelfuß und Zehen (gemalt, Alpha)
const LOW_FOOT = { z0: 0.05, z1: 0.222, xo: -0.042, xi: 0.048 };
function lowFoot(ankle, M, side) {
  const foot = joint(ankle), gY = -L.ankleY, mx = -side, hz = FOOT.heelZ;
  const T = [[hz - 0.002, 0, 0.022, 0.008, 0.008], [hz + 0.014, 0, 0.022, 0.021, 0.021], [0.0, 0.002, 0.036, 0.025, 0.03], [0.045, 0.006, 0.038, 0.028, 0.02], [0.075, 0.002, 0.034, 0.026, 0.012]];
  const ring = T.map(([z, cx, cy, rx, ry]) => Array.from({ length: 7 }, (_, q) => { const a = q / 6 * Math.PI * 2; return [mx * cx + rx * Math.sin(a), gY + cy + ry * Math.cos(a), z]; }));
  add(foot, subUV(gridGeo(ring, (r, c) => [c / 6, r / 4]), 0.76, 0, 1, 1), M.foot);
  const P = [ // z, außen, innen, Höhe außen / Mitte / innen (innen = Großzehe, Längsgewölbe)
    [0.05, -0.026, 0.024, 0.026, 0.042, 0.046], [0.10, -0.034, 0.034, 0.016, 0.03, 0.032],
    [0.152, -0.042, 0.048, 0.011, 0.016, 0.016], [0.185, -0.044, 0.05, 0.009, 0.012, 0.012], [0.222, -0.044, 0.05, 0.008, 0.009, 0.01]];
  const rows = P.map(([z, xo, xi, ho, hm, hi]) => [[mx * xo, gY + ho + 0.005, z], [mx * (xo + xi) / 2, gY + hm + 0.005, z], [mx * xi, gY + hi + 0.005, z]]);
  add(foot, subUV(slab(rows, 0.01, [0, 1, 0], (r, c) => [c / 2, 1 - (P[r][0] - LOW_FOOT.z0) / (LOW_FOOT.z1 - LOW_FOOT.z0)], true, 0.1), 0, 0, 0.75, 1), M.foot);
  return { foot, toes: [] };
}
function lowStaff(wrist, M, C) {
  const staff = joint(wrist, 0.018, -0.088, 0.004); staff.rotation.x = 0.5;
  const shaft = []; for (let i = 0; i <= 12; i++) shaft.push([Math.sin(i * 1.7) * 0.012, -0.85 + i * 0.19, Math.cos(i * 2.3) * 0.012]);
  add(staff, subUV(tube(shaft, 0.032, 10, 5), 0, 0, 1, 0.75), M.woodTube);              // Lederwicklung ist gemalt
  for (const a of [0, 2.1, 4.2]) {
    const cx = Math.cos(a), cz = Math.sin(a);
    add(staff, subUV(tube([[cx * 0.026, 1.3, cz * 0.026], [cx * 0.09, 1.42, cz * 0.09], [cx * 0.11, 1.58, cz * 0.11], [cx * 0.045, 1.72, cz * 0.045]], 0.016, 4, 3, { taper: 0.6 }), 0, 0.75, 1, 1), M.woodTube);
  }
  const crystal = add(staff, new THREE.OctahedronGeometry(0.1), M.crystal, 0, 1.53, 0);
  crystal.scale.y = 1.8; crystal.userData.keep = true;
  return { staff, crystal, crystalGlow: glow(staff, C.crystalGlow ?? 0x7fd8ff, 0.55, 0, 1.53, 0) };
}

// ---------- Kleidung ----------
function lowClothes(R, M) {
  const { root, torso, hips, armL, armR, legL, legR } = R, J = GENT_JACKET, onTorso = { weights: () => [[torso, 1]] };
  for (const [s, lg] of [[1, legL], [-1, legR]]) {
    const { geo, weights } = pantsLeg(s, LOWP, { hips, hip: lg.hip, knee: lg.knee }, { yBot: 0.17, flare: 0.14, hipK: 0.86 });
    add(root, mirrorU(geo), M.pants, 0, 0, 0, { weights });
  }
  add(root, mirrorU(garment(LOW_JACKET, [12, 8])), M.shell, 0, 0, 0, { weights: jacketWeights(R) });
  add(root, mirrorU(garment(LOW_SHIRT, [10, 6])), M.inner, 0, 0, 0, onTorso);
  for (const s of [-1, 1]) {                                               // Revers: 5 Quads je Seite, Kerbe über die Stützpunkte
    const rows = [0, 0.2, 0.27, 0.4, 0.7, 1].map(t => {
      const y = lerp(1.6, 1.22, t), ang = s > 0 ? J.g(y) : 2 * Math.PI - J.g(y), w = lapelW(t);
      const ex = Math.sin(ang) * table(J.RX, y), ez = table(J.CZ, y) + Math.cos(ang) * table(J.RZ, y);
      return [[ex, y, ez + 0.004], [ex + s * w, y + 0.016 * (1 - t), ez + 0.016 - w * 0.3]];
    });
    const ts = [0, 0.2, 0.27, 0.4, 0.7, 1];
    add(root, subUV(gridGeo(rows, (r, c) => [c, 1 - ts[r]]), s > 0 ? 0 : 0.5, 0, s > 0 ? 0.5 : 1, 1), M.satin, 0, 0, 0, onTorso);
  }
  const collar = [];
  for (let i = 0; i <= 6; i++) { const ang = lerp(J.g(1.6), 2 * Math.PI - J.g(1.6), i / 6); collar.push([Math.sin(ang) * 0.088, 1.608 + 0.01 * Math.abs(Math.cos(ang)), -0.02 + Math.cos(ang) * 0.078]); }
  add(root, subUV(tube(collar, 0.014, 6, 3, { oval: v => { v.y *= 1.5; } }), 0.5, 0, 1, 0.25), M.satin, 0, 0, 0, onTorso);
  for (const [rz, dx] of [[0.35, -0.008], [-0.3, 0.008]]) add(torso, new THREE.CircleGeometry(0.022, 3).rotateZ(Math.PI / 2 + rz), M.accent, 0.112 + dx, 1.437 - 1, 0.152).rotation.x = -0.25;   // Einstecktuch
  for (const [s, a] of [[1, armL], [-1, armR]]) {
    const { geo, weights } = sleeve(LOWP, s, 0.205, 1.53, L.shoulderY - L.upper - L.fore * 0.16, 0.055, 0.047, a, 13);
    add(root, mirrorU(geo), M.sleeve, 0, 0, 0, { weights });
  }
  for (const s of [-1, 1]) add(torso, subUV(lowPanel(0.042, 0.055, 1, 0.5), 0.05, 0.85, 0.35, 1), M.inner, s * 0.04, 1.6 - 1, 0.055).rotation.set(-0.55, s * 0.5, s * 0.55);   // Hemdkragen
  const tie = joint(torso, 0, 1.505 - 1, 0.138); tie.rotation.x = 0.12;
  add(tie, new THREE.BoxGeometry(0.032, 0.028, 0.02).rotateZ(0.2), M.accent, 0, -0.01, 0);
  for (const s of [-1, 1]) add(torso, tube([[s * 0.05, 0.595, 0.05], [s * 0.032, 0.545, 0.112], [s * 0.008, 0.505, 0.138]], 0.006, 2, 3, { oval: v => { v.x *= 2.2; } }), M.accent);
  add(tie, lowPanel(0.05, 0.27, 3, -0.4), M.accent, 0, -0.02, 0.004);
  const tie2 = joint(tie, -0.004, -0.02, -0.004); tie2.rotation.z = 0.15;
  add(tie2, lowPanel(0.032, 0.21, 3, -0.3), M.accent);
  R.tie = tie; R.tie2 = tie2;
}

function buildLow(M, C) {
  const F = !!C.flesh, root = new THREE.Group(), hips = joint(root, 0, 1.0, 0), torso = joint(hips);
  const NECK = 0.225, neck = joint(torso, 0, T1Y + 0.01 - 1, spineZ(T1Y));
  add(neck, tube([[0, -0.01, 0], [0, NECK * 0.35, 0.012], [0, NECK * 0.65, 0.016], [0, NECK * 0.82, 0.014]], F ? 0.027 : 0.016, 3, 5), M.bone);   // endet in der Schädelbasis, nicht im Mund
  const head = joint(neck, 0, NECK, 0.03); head.scale.setScalar(STYLE.head);
  const { sk, jaw } = lowSkull(head, M, C);
  const arm = side => {
    const shoulder = joint(torso, side * C.shX, L.shoulderY - 1, -0.03), elbow = joint(shoulder, 0, -L.upper, 0);
    lowForearm(elbow, M, side, F ? 2.1 : 1.35);
    const wrist = joint(elbow, 0, -L.fore, 0);
    return { shoulder, elbow, wrist, ...lowHand(wrist, M, side) };
  };
  const armL = arm(1), armR = arm(-1);
  const leg = side => {
    const hip = joint(hips, side * HIP_X, 0, 0), knee = joint(hip, 0, -L.thigh, 0);
    add(knee, tube([[0, -0.2, 0.004], [0, -0.34, 0.008], [0, -L.shank + 0.004, 0.003]], F ? 0.03 : 0.02, 2, 5, { taper: F ? 0.35 : 0.15 }), M.bone);                     // Schienbein
    add(knee, tube([[side * 0.028, -0.2, -0.012], [side * 0.03, -0.34, -0.012], [side * 0.026, -L.shank + 0.012, -0.01]], 0.009, 2, 3), M.bone);   // Wadenbein
    for (const [x, y, r] of [[-side * 0.02, 0.014, 0.011], [side * 0.029, 0.004, 0.01]])                                              // Innen- und Außenknöchel (innen höher)
      add(knee, new THREE.SphereGeometry(r, 5, 3).scale(0.8, 1.2, 1), M.bone, x, -L.shank + y, -0.004);
    const ankle = joint(knee, 0, -L.shank, 0);
    return { hip, knee, ankle, ...lowFoot(ankle, M, side) };
  };
  const R = { root, hips, torso, neck, head, sk, jaw, armL, armR, legL: leg(1), legR: leg(-1), ...(C.weapon ? C.weapon(armR, armL, M, C) : lowStaff(armR.wrist, M, C)) };
  (C.clothes || lowClothes)(R, M, C);
  if (C.addons) C.addons(R, M, C);
  return R;
}

// ---------- Malen ----------
function soft(g, x, y, rx, ry, c, a) {                                    // weicher Fleck: Licht oder Schatten
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx); grd.addColorStop(0, rgba(c, a)); grd.addColorStop(1, rgba(c, 0));
  g.fillStyle = grd; g.fillRect(-rx, -rx, 2 * rx, 2 * rx); g.restore();
}
function band(g, s, y0, y1, c, a) {                                       // waagrechter Schatten, oben am stärksten
  const grd = g.createLinearGradient(0, y0, 0, y1); grd.addColorStop(0, rgba(c, a)); grd.addColorStop(1, rgba(c, 0));
  g.fillStyle = grd; g.fillRect(0, y0, s, y1 - y0);
}
// Senkrechter Knochen mit dicken Gelenkenden, zylindrisch schattiert (Licht links oben)
const BONE_PAL = ['#5a4652', '#e6d5aa', '#f8eed2', '#b29b74', '#4a3646'];
function boneStick(g, x, y0, y1, w, tipTaper = 0, pal = BONE_PAL) {
  const grd = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  [0, 0.28, 0.42, 0.72, 1].forEach((o, i) => grd.addColorStop(o, pal[i]));
  g.fillStyle = grd;
  g.beginPath(); g.roundRect(x - w * 0.34, y0, w * 0.68, y1 - y0, w * 0.3); g.fill();
  g.beginPath(); g.ellipse(x, y0 + w * 0.2, w * 0.5, w * 0.28, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(x, y1 - w * 0.18, w * 0.47 * (1 - tipTaper), w * 0.26, 0, 0, 7); g.fill();
}
function shadeAtop(g, s, draw) { g.globalCompositeOperation = 'source-atop'; draw(); g.globalCompositeOperation = 'source-over'; }

function paintLowFace(s, C) {
  return canvas(s, g => {
    const X = x => (x - FACE.x0) / (FACE.x1 - FACE.x0) * s, Y = y => (1 - (y - FACE.y0) / (FACE.y1 - FACE.y0)) * s, K = s / (FACE.x1 - FACE.x0);
    // 1 Großform: Stirn im Licht, nach unten kühler
    vGrad(g, s, [[0, '#f2e4be'], [0.3, '#e0cb9e'], [0.55, '#c4ab7e'], [0.75, '#a08c80'], [1, '#64505c']]);
    strokes(g, s, 520, ['#fff4d4', '#7a6448', '#e6d2a4', '#9a8a8a'], { angle: 0, len: [0.015, 0.06], a: [0.04, 0.1] });
    blotches(g, s, 10, 'rgba(120,95,50,0.2)', [0.02, 0.06]);
    // 2 Seiten drehen vom Licht weg: Schläfen und Wangen kühl
    for (const d of [-1, 1]) { soft(g, X(d * 0.088), Y(-0.03), 0.028 * K, 0.07 * K, SHD, 0.6); soft(g, X(d * 0.07), Y(-0.1), 0.03 * K, 0.04 * K, SHD, 0.4); }
    // 3 Jochbein: Lichtkante oben, Kernschatten darunter
    for (const d of [-1, 1]) { soft(g, X(d * 0.053), Y(-0.047), 0.02 * K, 0.009 * K, LIT, 0.7); soft(g, X(d * 0.05), Y(-0.067), 0.026 * K, 0.012 * K, SHD, 0.65); }
    // 4 Brauenwulst: helle Kante; Nasenwurzel
    for (const d of [-1, 1]) soft(g, X(d * 0.032), Y(-0.011), 0.026 * K, 0.006 * K, LIT, 0.85);
    soft(g, X(0), Y(-0.02), 0.012 * K, 0.014 * K, LIT, 0.5);
    // 5 Augenhöhlen: gerundete Vierecke, außen tiefer gekippt; oben am dunkelsten, Unterrand fängt Licht
    for (const d of [-1, 1]) {
      const cx = X(d * 0.034), cy = Y(-0.033), w = 0.0185 * K, h = 0.0165 * K;
      soft(g, cx, cy, w * 1.7, h * 1.6, SHD, 0.55);
      g.save(); g.translate(cx, cy); g.rotate(d * 0.14);
      const grd = g.createRadialGradient(0, h * 0.25, 0, 0, 0, w * 1.15);
      grd.addColorStop(0, '#07040a'); grd.addColorStop(0.6, '#140b18'); grd.addColorStop(1, '#3a2638');
      g.fillStyle = grd; g.beginPath(); g.roundRect(-w, -h, 2 * w, 2 * h, w * 0.5); g.fill();
      g.strokeStyle = 'rgba(30,15,28,0.8)'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = 'rgba(255,236,200,0.55)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-w * 0.7, h + 2); g.quadraticCurveTo(0, h * 1.28, w * 0.8, h * 0.92); g.stroke();
      g.restore();
    }
    // 6 Nasenöffnung: umgedrehte Birne, unten am breitesten; Nasenbeine darüber hell
    soft(g, X(0), Y(-0.044), 0.007 * K, 0.006 * K, LIT, 0.6);
    g.beginPath(); g.moveTo(X(0), Y(-0.049));
    g.bezierCurveTo(X(0.006), Y(-0.054), X(0.015), Y(-0.066), X(0.012), Y(-0.075)); g.quadraticCurveTo(X(0.006), Y(-0.08), X(0), Y(-0.076));
    g.quadraticCurveTo(X(-0.006), Y(-0.08), X(-0.012), Y(-0.075)); g.bezierCurveTo(X(-0.015), Y(-0.066), X(-0.006), Y(-0.054), X(0), Y(-0.049)); g.closePath();
    { const grd = g.createRadialGradient(X(0), Y(-0.07), 0, X(0), Y(-0.065), 0.016 * K); grd.addColorStop(0, '#0a050c'); grd.addColorStop(1, '#3a2632'); g.fillStyle = grd; }
    g.fill(); g.strokeStyle = 'rgba(30,15,28,0.8)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(255,236,200,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(-0.011), Y(-0.078)); g.quadraticCurveTo(X(0), Y(-0.081), X(0.011), Y(-0.078)); g.stroke();
    g.strokeStyle = 'rgba(140,120,105,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(0), Y(-0.076)); g.lineTo(X(0.001), Y(-0.061)); g.stroke();   // Scheidewand
    // 7 Oberkiefer: Zahnwurzeln als leichte Wülste, Zahnfleischkante dunkel
    for (let i = 0; i < 10; i++) soft(g, X(0.025 * (i - 4.5) / 4.5), Y(-0.082), 0.003 * K, 0.005 * K, LIT, 0.3);
    soft(g, X(0), Y(-0.087), 0.03 * K, 0.003 * K, DEEP, 0.6);
    // 8 Kinn und Unterkiefer: Kinnhöcker im Licht, darunter Schatten, Kieferwinkel kühl
    soft(g, X(0), Y(-0.129), 0.014 * K, 0.006 * K, LIT, 0.6);
    band(g, s, Y(-0.136), s, DEEP, 0); soft(g, X(0), Y(-0.145), 0.05 * K, 0.008 * K, DEEP, 0.6);
    for (const d of [-1, 1]) { soft(g, X(d * 0.02), Y(-0.124), 0.002 * K, 0.002 * K, DEEP, 0.9); soft(g, X(d * 0.054), Y(-0.105), 0.012 * K, 0.02 * K, SHD, 0.5); }
    // 9 Risse: einer über der linken Braue in die Höhle, ein Haarriss rechts am Jochbein
    for (const pts of [[[0.012, 0.013], [0.016, 0.004], [0.021, -0.002], [0.019, -0.009], [0.025, -0.016]], [[-0.058, -0.04], [-0.052, -0.047], [-0.055, -0.055]]])
      for (const [dx, col, w, al] of [[1.5, '#fff4d6', 1.3, 0.55], [0, '#2e1e14', 1.8, 0.85]]) { g.globalAlpha = al; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(X(x) + dx, Y(y)) : g.moveTo(X(x) + dx, Y(y))); g.stroke(); }
    g.globalAlpha = 1;
    blotches(g, s, 5, 'rgba(80,100,55,0.16)', [0.02, 0.05]);
    // 10 Zähne: ein Bogen, vorn groß und hell, seitlich dunkler; fehlende Zähne sind Löcher
    g.clearRect(X(-0.032), Y(-0.0875), X(0.032) - X(-0.032), Y(-0.1145) - Y(-0.0875));
    const teeth = (yGum, yEdge, missing) => {
      for (let i = 0; i < 10; i++) {
        if (missing.includes(i)) continue;
        const t = (i - 4.5) / 4.5, x = 0.025 * t, hw = 0.00245 * K, top = Math.min(Y(yGum), Y(yEdge)), bot = Math.max(Y(yGum), Y(yEdge));
        const grd = g.createLinearGradient(0, Y(yGum), 0, Y(yEdge)); grd.addColorStop(0, '#9c8556'); grd.addColorStop(0.5, '#e3d4ac'); grd.addColorStop(1, '#f6edd2');
        g.fillStyle = grd; g.beginPath(); g.roundRect(X(x) - hw, top, 2 * hw, bot - top, hw * 0.6); g.fill();
        g.fillStyle = rgba(SHD, 0.15 + 0.45 * Math.abs(t)); g.fill();
      }
    };
    teeth(-0.0875, -0.1, C.missingTop || []);
    teeth(-0.1145, -0.1015, C.missingBottom || []);
  });
}
function paintLowCranium(s) {
  return canvas(s, g => {
    const V = y => (1 - (y - CRAN.y0) / (CRAN.y1 - CRAN.y0)) * s;
    vGrad(g, s, [[0, '#f6ebd2'], [0.22, '#ead8ae'], [0.5, '#cdb588'], [0.7, '#a08a7c'], [1, '#3a2a38']]);
    strokes(g, s, 480, ['#fff6da', '#6b5636', '#e8d6a8', '#9a8a8a'], { angle: 0, len: [0.03, 0.1], a: [0.04, 0.1] });
    blotches(g, s, 12, 'rgba(110,85,40,0.2)');
    soft(g, 0.22 * s, 0.14 * s, 0.3 * s, 0.12 * s, LIT, 0.55);           // Glanz oben vorn
    soft(g, 0.1 * s, V(0.03), 0.12 * s, 0.08 * s, LIT, 0.3);             // Stirnhöcker
    soft(g, 0.48 * s, V(-0.012), 0.16 * s, 0.13 * s, SHD, 0.5);          // Schläfengrube
    soft(g, 0.95 * s, V(-0.04), 0.3 * s, 0.1 * s, DEEP, 0.45);           // Hinterhaupt unten
    // Nähte (Spiegel-UV: u 0 = Stirnmitte, 1 = Hinterkopfmitte)
    const suture = pts => { wavy(g, pts, '#3a2814', 2.5, 2.5, 0.85); wavy(g, pts.map(([x, y]) => [x + 1.5, y + 1.5]), '#fff2d0', 1, 2, 0.35); };
    const line = (a, b, n = 24) => Array.from({ length: n + 1 }, (_, i) => [lerp(a[0], b[0], i / n) * s, lerp(a[1], b[1], i / n) * s]);
    suture(line([0.04, 0.17], [0.42, 0.5]));                             // Kranznaht: Bregma → Schläfe
    suture(line([0.006, 0.0], [0.006, 0.17])); suture(line([0.994, 0.0], [0.994, 0.2]));   // Pfeilnaht
    suture(line([0.96, 0.2], [0.68, 0.58]));                             // Lambdanaht
    cracks(g, s, 3);
    blotches(g, s, 5, 'rgba(70,90,50,0.16)', [0.03, 0.08]);
  });
}
// Hand- und Fußplatte: Glieder als senkrechte Stifte (Palette: Knochen, Haut, Leinen), rechts ein fester Bereich für Block und Daumen
function paintHandPlate(s, { pal = BONE_PAL, wk = 1, right, tip } = {}) {
  return canvas(s, g => {
    const W = 0.75 * s, A = y => (LOW_HAND.base - y) / LOW_HAND.len * s;
    g.drawImage(right, W, 0, s - W, s, W, 0, s - W, s);
    for (let i = 0; i < 4; i++) {                                          // Zeigefinger … kleiner Finger
      const x = handU(HAND.zK[i]) * W;
      let y = A(HAND.kY[i]);
      boneStick(g, x, A(-0.03), y, 62 * wk, 0, pal);
      HAND.ph[i].forEach((f, n) => { const len = HAND.len[i] * f / LOW_HAND.len * s, w = [56, 50, 44][n] * wk; boneStick(g, x, y + 3, y + len, w, n === 2 ? 0.35 : 0, pal); if (n === 2 && tip) tip(g, x, y + len, w); y += len; });
    }
    shadeAtop(g, s, () => {
      vGrad(g, s, [[0, rgba(SHD, 0.35)], [0.3, rgba(SHD, 0)], [0.7, rgba(SHD, 0.05)], [1, rgba(SHD, 0.4)]], 0, W);
      blotches(g, s, 8, 'rgba(70,50,25,0.3)', [0.02, 0.06]);
    });
  });
}
const paintLowHand = s => paintHandPlate(s, { right: paintHandBone(s) });
function paintFootPlate(s, { pal = BONE_PAL, wk = 1, right, tip } = {}) {
  return canvas(s, g => {
    const W = 0.75 * s, A = z => (z - LOW_FOOT.z0) / (LOW_FOOT.z1 - LOW_FOOT.z0) * s, FZ = k => FOOT.heelZ + k * FL;
    g.drawImage(right, W, 0, s - W, s, W, 0, s - W, s);
    for (let i = 0; i < 5; i++) {                                          // Großzehe … kleine Zehe
      const x = (FOOT.headX[i] - LOW_FOOT.xo) / (LOW_FOOT.xi - LOW_FOOT.xo) * W;
      let y = A(FZ(FOOT.headZ[i]));
      boneStick(g, x, A(FZ(FOOT.baseZ[i])), y, (i ? 40 : 60) * wk, 0, pal);
      const lens = i === 0 ? [0.105, 0.085].map(k => k * FL) : [0.07, 0.042, 0.032].map(k => k * FL * [1, 0.94, 0.88, 0.8][i - 1]);
      lens.forEach((len, n) => { const l = A(LOW_FOOT.z0 + len), w = (i ? [38, 34, 30][n] : [58, 50][n]) * wk, last = n === lens.length - 1; boneStick(g, x, y + 3, y + l, w, last ? 0.25 : 0, pal); if (last && tip) tip(g, x, y + l, w); y += l; });
    }
    shadeAtop(g, s, () => {
      hGrad(g, s, [[0, rgba(SHD, 0.4)], [0.3, rgba(SHD, 0.1)], [0.75, rgba(SHD, 0)]]);   // außen dunkler (vom Licht weg)
      blotches(g, s, 10, 'rgba(50,35,15,0.4)', [0.02, 0.06], [0, 0.5, 0.75, 1]);       // Erde an den Zehen
    });
  });
}
const paintLowFoot = s => paintFootPlate(s, { right: paintFootBone(s) });
function lowCloth(g, s, base, stripe) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  weave(g, s, 3, '10,5,15', '230,220,240');
  if (stripe) for (let x = 6; x < s; x += stripe) { g.fillStyle = 'rgba(200,190,215,0.14)'; g.fillRect(x, 0, 1.5, s); }
  blotches(g, s, 14, 'rgba(150,140,165,0.12)', [0.05, 0.15]);
  blotches(g, s, 12, 'rgba(22,16,30,0.3)', [0.05, 0.15]);
}
function button(g, x, y, r) {
  g.fillStyle = 'rgba(10,5,15,0.5)'; g.beginPath(); g.arc(x + 2, y + 3, r, 0, 7); g.fill();
  g.fillStyle = '#17121c'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = 'rgba(220,205,240,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r - 1.5, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.85)'; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.fillRect(x + dx * r * 0.3 - 1, y + dy * r * 0.3 - 1, 2, 2);
}
function paintLowJacket(s) {
  const S = LOW_JACKET, yOf = y => garmentY(S, y) * s;
  const xOf = (ang, y) => Math.abs(2 * (ang - S.g(y)) / (2 * Math.PI - 2 * S.g(y)) - 1) * s;     // Spiegel-u wie im Mesh
  return canvas(s, g => {
    lowCloth(g, s, '#4a4058', 16);
    // Großform: Schultern im Licht, Saum im Schatten, Rücken dunkler als Brust
    vGrad(g, s, [[0, rgba(LIT, 0.22)], [0.2, rgba(LIT, 0.06)], [0.55, rgba(SHD, 0)], [1, rgba(SHD, 0.65)]]);
    hGrad(g, s, [[0, rgba(SHD, 0.35)], [0.45, rgba(SHD, 0.15)], [1, rgba(LIT, 0.06)]]);
    // AO: Achsel, unter dem Revers, Kragen hinten; Licht auf Brust und Schulterblättern
    soft(g, xOf(Math.PI / 2, 1.44), yOf(1.44), 0.11 * s, 0.13 * s, DEEP, 0.75);
    soft(g, 0.93 * s, yOf(1.42), 0.09 * s, 0.22 * s, DEEP, 0.45);
    soft(g, 0.12 * s, 0, 0.3 * s, 0.06 * s, DEEP, 0.5);
    soft(g, 0.8 * s, yOf(1.42), 0.1 * s, 0.08 * s, LIT, 0.18);
    soft(g, 0.2 * s, yOf(1.45), 0.12 * s, 0.07 * s, LIT, 0.12);
    // Zugfalten vom geschlossenen Taillenknopf: Schattenlinie unter der Lichtlinie
    g.filter = 'blur(2px)';
    for (const [dy, len] of [[-0.18, 0.3], [-0.08, 0.36], [0.06, 0.32], [0.16, 0.26]]) {
      const x0 = s - 24, y0 = yOf(1.21), x1 = x0 - len * s, y1 = y0 + dy * s;
      for (const [o, c, a, w] of [[3, DEEP, 0.5, 5], [-3, LIT, 0.18, 3]]) { g.strokeStyle = rgba(c, a); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0 + o); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + o + 6, x1, y1 + o); g.stroke(); }
    }
    g.filter = 'none';
    for (let i = 0; i < 12; i++) pipeFold(g, rand(0.02, 0.9) * s, yOf(1.12) + rand(-6, 20), s, rand(16, 30), '22,16,30', '150,140,165', rand(0.3, 0.5));
    // Nähte: Rücken (Spiegelachse), Seite, Taille
    seamV(g, 3, 0, s, null);
    seamV(g, xOf(Math.PI / 2, 1.2), yOf(S.armY0), s, null);
    seamH(g, yOf(1.1), 0, s * 0.96, null);
    // Vorderkante: dunkler Satinbesatz mit Glanzlinie
    g.fillStyle = '#1c1822'; g.fillRect(s - 14, 0, 14, s);
    g.fillStyle = 'rgba(200,190,230,0.3)'; g.fillRect(s - 12, 0, 2, s);
    // Knöpfe: oben geschlossen, unten hängt einer an zwei Fäden
    button(g, s - 26, yOf(1.21), 9);
    g.strokeStyle = 'rgba(225,200,150,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(s - 30, yOf(1.11)); g.lineTo(s - 31, yOf(1.11) + 9); g.moveTo(s - 28, yOf(1.11)); g.lineTo(s - 29, yOf(1.11) + 9); g.stroke();
    button(g, s - 30, yOf(1.11) + 14, 8);
    // Pattentasche: Klappe wirft Schatten nach unten
    { const y = 1.03, x = xOf(Math.asin(0.125 / table(S.RX, y)), y), w = 0.17 * s, h = 0.045 * s;
      soft(g, x, yOf(y) + h * 0.9, w * 0.55, h * 0.5, DEEP, 0.6);
      g.fillStyle = '#3a3146'; g.fillRect(x - w / 2, yOf(y), w, h);
      g.fillStyle = rgba(LIT, 0.25); g.fillRect(x - w / 2, yOf(y), w, 2);
      g.fillStyle = 'rgba(10,5,15,0.6)'; g.fillRect(x - w / 2, yOf(y) + h - 2, w, 2); }
    // Flicken über der Rückennaht, Riss an der Seite, Grabschmutz, ausgefranster Saum
    crossStitchPatch(g, 0, yOf(1.32), 34, 46, '#5c4c3c');
    tear(g, xOf(Math.PI * 0.55, 1.0), yOf(0.99), 9, 22, 'rgba(10,5,15,0.6)');
    grime(g, s);
    frayBottom(g, s, 0.035, 40);
  });
}
function ribTear(g, cx, cy, rx, ry, nRib) {
  const pts = []; for (let a = 0; a < Math.PI * 2; a += 0.3) { const k = rand(0.72, 1.12); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  path(); g.lineWidth = 10; g.strokeStyle = 'rgba(70,50,30,0.35)'; g.stroke();          // Schmutzrand am Stoff
  g.save(); path(); g.clip();
  const grd = g.createRadialGradient(cx, cy + ry * 0.3, 0, cx, cy, Math.max(rx, ry) * 1.2);
  grd.addColorStop(0, '#24141f'); grd.addColorStop(1, '#0a050c'); g.fillStyle = grd; g.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);
  // Rippen fallen zur Seite hin ab (Bild links = seitlich, rechts = Brustbein)
  g.lineCap = 'round';
  for (let k = 0; k < nRib; k++) {
    const y0 = cy - ry * 0.7 + k * ry * 0.62, th = ry * 0.24;
    const rib = (o, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(cx - rx * 1.3, y0 + rx * 0.5 + o); g.quadraticCurveTo(cx, y0 + rx * 0.05 + o, cx + rx * 1.3, y0 - rx * 0.05 + o); g.stroke(); };
    g.strokeStyle = 'rgba(0,0,0,0.6)'; rib(th * 0.25, th * 1.15);
    g.strokeStyle = '#a89270'; rib(0, th);
    g.strokeStyle = '#efe0b8'; rib(-th * 0.22, th * 0.4);
    g.strokeStyle = rgba(SHD, 0.6); rib(th * 0.32, th * 0.22);
  }
  path(); g.lineWidth = 16; g.strokeStyle = 'rgba(8,4,10,0.75)'; g.filter = 'blur(4px)'; g.stroke(); g.filter = 'none';   // Stoff wirft Schatten hinein
  g.restore();
  g.strokeStyle = 'rgba(240,232,210,0.8)'; g.lineWidth = 1.5;                         // Fransen
  for (const [x, y] of pts) { const a = Math.atan2(y - cy, x - cx); g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * rand(3, 9), y - Math.sin(a) * rand(3, 9)); g.stroke(); }
  path(); g.lineWidth = 2; g.strokeStyle = 'rgba(250,245,230,0.6)'; g.stroke();
}
function paintLowShirt(s) {
  const yOf = y => garmentY(LOW_SHIRT, y) * s;
  return canvas(s, g => {
    g.fillStyle = '#bfae86'; g.fillRect(0, 0, s, s);
    weave(g, s, 2, '70,55,30', '255,250,235', 0.7);
    vGrad(g, s, [[0, rgba(LIT, 0.3)], [0.4, rgba(LIT, 0)], [1, rgba(SHD, 0.45)]]);
    hGrad(g, s, [[0, rgba(SHD, 0.3)], [0.6, rgba(SHD, 0.05)], [1, rgba(LIT, 0.1)]]);
    blotches(g, s, 22, 'rgba(140,100,45,0.35)', [0.03, 0.1]);
    blotches(g, s, 8, 'rgba(90,105,60,0.22)', [0.02, 0.06]);
    g.fillStyle = rgba(LIT, 0.25); g.fillRect(s - 20, 0, 14, s);                       // Knopfleiste
    for (const x of [s - 21, s - 6]) { g.fillStyle = 'rgba(60,45,40,0.35)'; g.fillRect(x, 0, 1.5, s); }
    for (const y of [1.48, 1.39, 1.3, 1.21, 1.12]) { const yy = yOf(y); g.fillStyle = 'rgba(40,30,30,0.35)'; g.beginPath(); g.arc(s - 12, yy + 2, 5, 0, 7); g.fill(); g.fillStyle = '#e8e0cc'; g.beginPath(); g.arc(s - 13, yy, 5, 0, 7); g.fill(); }
    // Schatten, den das Revers aufs Hemd wirft: folgt der Sakko-Vorderkante
    g.filter = 'blur(6px)'; g.strokeStyle = rgba(DEEP, 0.5); g.lineWidth = 18; g.beginPath();
    for (let y = 1.22; y <= 1.6; y += 0.02) { const xs = Math.abs(2 * (LOW_JACKET.g(y) - LOW_SHIRT.g(y)) / (2 * Math.PI - 2 * LOW_SHIRT.g(y)) - 1) * s + 6; y > 1.22 ? g.lineTo(xs, yOf(y)) : g.moveTo(xs, yOf(y)); }
    g.stroke(); g.filter = 'none';
    soft(g, s, yOf(1.58), 0.12 * s, 0.05 * s, DEEP, 0.5);                                // unter Kragen und Krawattenknoten
    ribTear(g, 0.79 * s, yOf(1.37), 0.15 * s, 0.17 * s, 3);
    ribTear(g, 0.7 * s, yOf(1.17), 0.07 * s, 0.05 * s, 1);
    seamH(g, 6, 0, s, null);
  });
}
function paintLowSatin(s) {
  return canvas(s, g => {
    g.fillStyle = '#211b29'; g.fillRect(0, 0, s, s);
    weave(g, s, 2, '0,0,0', '200,190,230', 0.5);
    for (const x0 of [0, s / 2]) {                                         // Satinglanz quer über das Revers
      const grd = g.createLinearGradient(x0, 0, x0 + s / 2, 0);
      grd.addColorStop(0, rgba(DEEP, 0.4)); grd.addColorStop(0.55, 'rgba(180,170,215,0.28)'); grd.addColorStop(0.7, 'rgba(180,170,215,0.05)'); grd.addColorStop(0.95, 'rgba(210,200,235,0.25)'); grd.addColorStop(1, 'rgba(210,200,235,0.1)');
      g.fillStyle = grd; g.fillRect(x0, 0, s / 2, s);
    }
    vGrad(g, s, [[0, rgba(LIT, 0.12)], [0.5, rgba(SHD, 0)], [1, rgba(DEEP, 0.4)]]);
    blotches(g, s, 8, 'rgba(120,110,90,0.15)', [0.02, 0.06]);
    const fx = 0.28 * s, fy = 0.42 * s;                                    // verwelkte Blume, nur linkes Revers
    soft(g, fx + 6, fy + 10, 46, 20, DEEP, 0.7);
    for (let k = 0; k < 5; k++) { const a = k * 1.26 + 0.3; g.fillStyle = k % 2 ? '#8e5f68' : '#a6737a'; g.beginPath(); g.ellipse(fx + Math.cos(a) * 18, fy + Math.sin(a) * 8, 20, 9, a, 0, 7); g.fill(); g.strokeStyle = 'rgba(40,15,25,0.6)'; g.lineWidth = 1.5; g.stroke(); }
    g.fillStyle = '#3a1a22'; g.beginPath(); g.ellipse(fx, fy, 9, 4, 0, 0, 7); g.fill();
    soft(g, fx - 8, fy - 4, 18, 6, '255,220,220', 0.35);
    g.strokeStyle = '#3e5a2c'; g.lineWidth = 5; g.beginPath(); g.moveTo(fx + 4, fy + 6); g.quadraticCurveTo(fx + 10, fy + 30, fx + 2, fy + 52); g.stroke();
  });
}
function paintLowTie(s) {
  return canvas(s, g => {
    g.fillStyle = '#5a1e2c'; g.fillRect(0, 0, s, s);
    weave(g, s, 2, '0,0,0', '255,200,200', 0.6);
    g.save(); g.translate(s / 2, s / 2); g.rotate(-0.7);                   // Repp-Streifen
    for (let x = -s; x < s; x += 46) { g.fillStyle = 'rgba(170,135,70,0.45)'; g.fillRect(x, -s, 9, 2 * s); g.fillStyle = 'rgba(20,5,10,0.35)'; g.fillRect(x + 12, -s, 4, 2 * s); }
    g.restore();
    vGrad(g, s, [[0, rgba(LIT, 0.18)], [0.5, rgba(SHD, 0.1)], [1, rgba(DEEP, 0.5)]]);
    hGrad(g, s, [[0, rgba(DEEP, 0.35)], [0.3, rgba(DEEP, 0)], [0.5, rgba(LIT, 0.12)], [0.7, rgba(DEEP, 0)], [1, rgba(DEEP, 0.35)]]);
    blotches(g, s, 6, 'rgba(40,30,15,0.4)', [0.03, 0.07]);
  });
}
function paintLowPants(s) {
  const yOf = y => (1.13 - y) / (1.13 - 0.17) * s;
  return canvas(s, g => {
    lowCloth(g, s, '#3a3342', 22);
    vGrad(g, s, [[0, rgba(LIT, 0.1)], [0.35, rgba(SHD, 0)], [0.75, rgba(SHD, 0.3)], [1, rgba(DEEP, 0.6)]]);
    hGrad(g, s, [[0, rgba(LIT, 0.1)], [0.5, rgba(SHD, 0.15)], [1, rgba(SHD, 0.35)]]);   // u 0 = vorn, 1 = hinten
    band(g, s, yOf(0.9), yOf(0.78), DEEP, 0.55);                                        // Schatten unterm Sakkosaum
    soft(g, 0.06 * s, yOf(L.kneeY + 0.02), 0.2 * s, 0.07 * s, LIT, 0.2);                // Knie blank gescheuert
    crossStitchPatch(g, 0, yOf(0.6), 30, 40, '#4e4436');
    zigzag(g, 0.78 * s, s, yOf(L.kneeY + 0.05), 40, 4, '20,14,26', '120,110,140', 0.35);   // Kniekehle
    g.fillStyle = rgba(LIT, 0.14); g.fillRect(0, 0, 3, s);                              // Bügelfalte
    seamV(g, 0.5 * s, 0, s, null);                                                      // Seitennaht = Innen- und Außennaht
    zigzag(g, 0, s, yOf(0.3), 30, 3, '20,14,26', '120,110,140', 0.3);
    grime(g, s);
    frayBottom(g, s, 0.06, 26);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';               // ein paar tiefe Risse im Saum
    for (let i = 0; i < 5; i++) { const x = rand(0.05, 0.95) * s, w = rand(10, 22); g.beginPath(); g.moveTo(x - w, s); g.lineTo(x, s - rand(0.06, 0.12) * s); g.lineTo(x + w, s); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  });
}
function paintLowSleeve(s) {
  const y1 = L.shoulderY - L.upper - L.fore * 0.16, yOf = y => (1.53 - y) / (1.53 - y1) * s, eY = yOf(L.shoulderY - L.upper);
  return canvas(s, g => {
    lowCloth(g, s, '#4a4058', 16);
    vGrad(g, s, [[0, rgba(LIT, 0.25)], [0.15, rgba(LIT, 0.05)], [0.6, rgba(SHD, 0.1)], [1, rgba(SHD, 0.55)]]);
    hGrad(g, s, [[0, rgba(SHD, 0.3)], [0.5, rgba(SHD, 0.1)], [1, rgba(LIT, 0.08)]]);   // u 0 = hinten (Ellbogen), 1 = vorn
    seamH(g, 8, 0, s, null);
    seamV(g, 0.55 * s, 0, s, null);
    for (let i = 0; i < 5; i++) pipeFold(g, rand(0.1, 0.9) * s, 0.05 * s, 0.6 * s, rand(14, 24), '22,16,30', '150,140,165', rand(0.2, 0.35));
    soft(g, 0, eY, 0.22 * s, 0.07 * s, '150,140,170', 0.35);                            // Ellbogen blank
    zigzag(g, 0.7 * s, s, eY - 30, 46, 4, '22,16,30', '150,140,165', 0.4);             // Armbeuge gestaucht
    grime(g, s, false);
    tear(g, 0, eY, 10, 16, 'rgba(10,5,15,0.6)');                                        // Loch am Ellbogen (auf der Spiegelachse)
    frayBottom(g, s, 0.08, 18);                                                         // zerrissene Manschette
  });
}
function paintLowWood(s) {
  return canvas(s, g => {
    g.drawImage(rotated(paintWood(s)), 0, 0);
    for (let k = 0; k < 3; k++) {                                          // Lederwicklung unter der Hand
      const x = (0.31 + k * 0.014) * s, w = 0.012 * s;
      g.fillStyle = '#2a1a10'; g.fillRect(x, 0.25 * s, w, 0.75 * s);
      g.fillStyle = 'rgba(230,190,140,0.4)'; g.fillRect(x, 0.25 * s, 1.5, 0.75 * s);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x + w - 1.5, 0.25 * s, 1.5, 0.75 * s);
    }
  });
}
const paintLowAtlas = (s, C) => [paintLowFace(s, C), paintLimbBone(s), paintLowHand(s), paintLowFoot(s), paintLowJacket(s), paintLowPants(s), paintLowWood(s), paintLowShirt(s), paintLowTie(s), paintLowSleeve(s), paintLowSatin(s), paintLowCranium(s)];
const LOW = { ...GENT_BASE, id: 'low', name: 'Vanilla-Weg', cells: LOW_CELLS, build: buildLow, atlasCells: paintLowAtlas };

// =====================================================================
// Skins auf dem Vanilla-Rig. Wie in Classic sind Skins vor allem Textur-Swaps derselben
// Geometrie. Dazu kommen wenige Silhouettenteile (Flammen, Eiszacken, Splitter, Kapuze)
// und eine Leuchtmaske (emissiveMap) für Glut, Frost und Runen. Kostet keinen Draw Call.
// =====================================================================
function glowMat(r, g, b) { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) }); m.userData = { cell: 0, kind: 'glow' }; return m; }
function recolor(c, filter, over) {                                     // dieselbe Malerei, umgefärbt
  return canvas(c.width, (g, s) => { g.filter = filter; g.drawImage(c, 0, 0); g.filter = 'none'; if (over) over(g, s); });
}
function atop(g, fn) { g.globalCompositeOperation = 'source-atop'; fn(); g.globalCompositeOperation = 'source-over'; }
const blank = s => canvas(s, () => {});
const faceXY = s => ({ X: x => (x - FACE.x0) / (FACE.x1 - FACE.x0) * s, Y: y => (1 - (y - FACE.y0) / (FACE.y1 - FACE.y0)) * s, K: s / (FACE.x1 - FACE.x0) });
const scaled = (pts, s) => pts.map(([x, y]) => [x * s, y * s]);
function walk(x, y, n = 6, step = 0.035) {                             // Zickzack-Linie in 0..1 (Riss, Ader)
  const pts = [[x, y]]; let a = rand(0, 7);
  for (let k = 0; k < n; k++) { a += rand(-0.7, 0.7); x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); }
  return pts;
}
function glowLine(g, pts, col, w) {                                     // Linie mit Halo (für die Leuchtmaske)
  g.lineCap = g.lineJoin = 'round';
  for (const [ww, a] of [[w * 4, 0.25], [w * 2, 0.5], [w, 1]]) { g.strokeStyle = rgba(col, a); g.lineWidth = ww; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
}
function rune(g, x, y, r, col) {                                        // kleines Zeichen: Ring, Strich, Haken
  const a = rand(0, 7);
  glowLine(g, [[x + Math.cos(a) * r, y + Math.sin(a) * r], [x - Math.cos(a) * r, y - Math.sin(a) * r]], col, 1.5);
  glowLine(g, [[x, y - r], [x + r * 0.7, y], [x, y + r]], col, 1.5);
  g.strokeStyle = rgba(col, 1); g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r * 0.35, 0, 7); g.stroke();
}
function stitches(g, [x0, y0], [x1, y1]) {                             // genähte Wunde
  g.strokeStyle = '#3a1418'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 10)), nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
  g.strokeStyle = '#1a1210'; g.lineWidth = 1.5;
  for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n); g.beginPath(); g.moveTo(x - nx / l * 6, y - ny / l * 6); g.lineTo(x + nx / l * 6, y + ny / l * 6); g.stroke(); }
}
const BONE_CELLS = [0, 1, 2, 3, 11], CLOTH_CELLS = [4, 5, 7, 8, 9, 10];   // Gesicht, Röhre, Hand, Fuß, Schädel | Stoffe

// ---------- Zombie: gleiche Geometrie, Haut statt Knochen ----------
const SKIN_PAL = ['#33302f', '#8f977c', '#aab095', '#6c735c', '#2f2c36'];
const nail = (g, x, y, w) => { g.fillStyle = '#3a3026'; g.beginPath(); g.roundRect(x - w * 0.26, y - w * 0.8, w * 0.52, w * 0.62, 4); g.fill(); g.fillStyle = 'rgba(210,200,160,0.35)'; g.fillRect(x - w * 0.14, y - w * 0.74, 2, w * 0.4); };
function paintSkinTube(s) {                                             // Haut für Röhren: u = entlang, v = rundherum
  return canvas(s, g => {
    vGrad(g, s, [[0, '#4a4a46'], [0.2, '#8e9579'], [0.4, '#a9ae93'], [0.7, '#737a62'], [1, '#3e3a42']]);
    strokes(g, s, 400, ['#b9bd9f', '#55584a', '#8c7f8c'], { angle: 0, len: [0.02, 0.08], a: [0.05, 0.12] });
    blotches(g, s, 10, 'rgba(90,60,95,0.3)', [0.03, 0.08]);                                  // Blutergüsse
    blotches(g, s, 8, 'rgba(80,100,45,0.3)', [0.02, 0.06]);                                  // Fäulnis
    for (let i = 0; i < 6; i++) { const y = rand(0.25, 0.75) * s; wavy(g, Array.from({ length: 12 }, (_, k) => [k / 11 * s, y + k * rand(-3, 3)]), '#3c4a3e', 2, 2, 0.5); }   // Adern
    const x = 0.35 * s, y = 0.42 * s, w = 0.28 * s, h = 0.16 * s;                           // Wunde mit freiliegendem Knochen
    g.fillStyle = '#4a1418'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 + 6, h / 2 + 5, 0, 0, 7); g.fill();
    const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, '#f1e3be'); grd.addColorStop(1, '#9c8763');
    g.fillStyle = grd; g.beginPath(); g.roundRect(x, y + h * 0.25, w, h * 0.5, h * 0.25); g.fill();
    stitches(g, [0.7 * s, 0.2 * s], [0.9 * s, 0.26 * s]);
  });
}
function paintZombieFace(s, C) {
  const bone = paintLowFace(s, C);
  return canvas(s, g => {
    const { X, Y, K } = faceXY(s);
    vGrad(g, s, [[0, '#aab093'], [0.3, '#969d80'], [0.55, '#7f8669'], [0.78, '#686a62'], [1, '#4a4452']]);
    strokes(g, s, 500, ['#bfc3a5', '#55584a', '#8c7f8c'], { angle: 0, len: [0.015, 0.06], a: [0.04, 0.1] });
    blotches(g, s, 8, 'rgba(90,60,95,0.28)', [0.02, 0.06]); blotches(g, s, 6, 'rgba(80,100,45,0.25)', [0.02, 0.05]);
    for (const d of [-1, 1]) {
      soft(g, X(d * 0.088), Y(-0.03), 0.028 * K, 0.07 * K, SHD, 0.6);                        // Schläfen
      soft(g, X(d * 0.05), Y(-0.072), 0.024 * K, 0.018 * K, SHD, 0.85);                      // eingefallene Wangen
      soft(g, X(d * 0.053), Y(-0.047), 0.02 * K, 0.009 * K, LIT, 0.6);                       // Jochbein
      soft(g, X(d * 0.032), Y(-0.011), 0.026 * K, 0.006 * K, LIT, 0.7);                      // Braue
      soft(g, X(d * 0.034), Y(-0.034), 0.026 * K, 0.022 * K, '60,30,55', 0.85);              // dunkle Augenringe
      g.fillStyle = '#1a0e14'; g.beginPath(); g.ellipse(X(d * 0.034), Y(-0.034), 0.015 * K, 0.011 * K, d * 0.15, 0, 7); g.fill();
      g.strokeStyle = 'rgba(205,210,180,0.6)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(X(d * 0.034), Y(-0.034), 0.016 * K, 0.012 * K, d * 0.15, Math.PI * 1.1, Math.PI * 1.9); g.stroke();   // Oberlid
    }
    // Nase weggefault: Rücken bleibt, unten ein Loch mit rohem Rand
    soft(g, X(0), Y(-0.045), 0.007 * K, 0.014 * K, LIT, 0.5);
    g.fillStyle = '#5a1a20'; g.beginPath(); g.ellipse(X(0), Y(-0.067), 0.012 * K, 0.009 * K, 0, 0, 7); g.fill();
    g.fillStyle = '#120709'; g.beginPath(); g.ellipse(X(0), Y(-0.068), 0.008 * K, 0.006 * K, 0, 0, 7); g.fill();
    // Keine Lippen mehr: Zahnfleisch oben und unten, Riss in der linken Wange
    g.fillStyle = '#5a1c22'; g.fillRect(X(-0.031), Y(-0.083), X(0.031) - X(-0.031), Y(-0.088) - Y(-0.083)); g.fillRect(X(-0.031), Y(-0.114), X(0.031) - X(-0.031), Y(-0.12) - Y(-0.114));
    g.fillStyle = '#3a0e12'; g.beginPath(); g.ellipse(X(0.042), Y(-0.1), 0.016 * K, 0.008 * K, -0.2, 0, 7); g.fill();
    g.strokeStyle = 'rgba(220,205,160,0.8)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(X(0.032 + i * 0.006), Y(-0.095)); g.lineTo(X(0.032 + i * 0.006), Y(-0.105)); g.stroke(); }
    stitches(g, [X(-0.066), Y(-0.05)], [X(-0.042), Y(-0.082)]); stitches(g, [X(-0.022), Y(0.008)], [X(0.024), Y(0.0)]);
    soft(g, X(0), Y(-0.129), 0.014 * K, 0.006 * K, LIT, 0.4); soft(g, X(0), Y(-0.145), 0.05 * K, 0.008 * K, DEEP, 0.5);
    const rx = X(-0.032), ry = Y(-0.0875), rw = X(0.032) - rx, rh = Y(-0.1145) - ry;    // Zähne vom Skelett übernehmen, vergilbt
    g.clearRect(rx, ry, rw, rh); g.filter = 'sepia(0.5) brightness(0.8)'; g.drawImage(bone, rx, ry, rw, rh, rx, ry, rw, rh); g.filter = 'none';
  });
}
function paintZombieScalp(s) {                                          // Spiegel-UV: u 0 = Stirn, 1 = Hinterkopf
  return canvas(s, g => {
    vGrad(g, s, [[0, '#a3a98c'], [0.35, '#8c9377'], [0.7, '#6b7060'], [1, '#3e3a44']]);
    strokes(g, s, 400, ['#bfc3a5', '#55584a', '#8c7f8c'], { angle: 0, len: [0.03, 0.08], a: [0.04, 0.1] });
    blotches(g, s, 8, 'rgba(90,60,95,0.28)', [0.03, 0.08]);
    soft(g, 0.22 * s, 0.14 * s, 0.3 * s, 0.12 * s, LIT, 0.4); soft(g, 0.48 * s, 0.55 * s, 0.16 * s, 0.13 * s, SHD, 0.5);
    g.lineCap = 'round';                                                 // Haare: strähnig, lang, nur Seiten und hinten
    for (let i = 0; i < 140; i++) {
      const x = rand(0.3, 1) * s, y = rand(0.02, 0.3) * s, len = rand(0.25, 0.55) * s;
      g.strokeStyle = `rgba(30,26,24,${rand(0.5, 0.9)})`; g.lineWidth = rand(1.5, 3.5);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + rand(-12, 12), y + len / 2, x + rand(-20, 20), y + len); g.stroke();
    }
    strokes(g, s, 60, ['rgba(160,150,140,1)'], { len: [0.08, 0.2], w: [1, 1.5], a: [0.15, 0.3], y0: 0.1, y1: 0.6 });   // Glanz im Haar
    const pts = []; for (let a = 0; a < 6.3; a += 0.4) pts.push([0.66 * s + Math.cos(a) * 0.1 * s * rand(0.75, 1.2), 0.25 * s + Math.sin(a) * 0.08 * s * rand(0.75, 1.2)]);
    const path = k => { g.beginPath(); pts.forEach(([x, y], i) => { const px = 0.66 * s + (x - 0.66 * s) * k, py = 0.25 * s + (y - 0.25 * s) * k; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); };
    g.fillStyle = '#4a1418'; path(1.15); g.fill();                                               // Haut aufgerissen, Schädel schaut durch
    const grd = g.createLinearGradient(0, 0.17 * s, 0, 0.33 * s); grd.addColorStop(0, '#f2e6c4'); grd.addColorStop(1, '#a8916a'); g.fillStyle = grd; path(1); g.fill();
    wavy(g, Array.from({ length: 10 }, (_, i) => [lerp(0.58, 0.74, i / 9) * s, lerp(0.2, 0.3, i / 9) * s]), '#3a2814', 2, 2, 0.8);
    stitches(g, [0.1 * s, 0.4 * s], [0.25 * s, 0.32 * s]);
  });
}
const zombieHand = s => paintHandPlate(s, { pal: SKIN_PAL, wk: 1.12, right: paintSkinTube(s), tip: nail });
const zombieFoot = s => paintFootPlate(s, { pal: SKIN_PAL, wk: 1.15, right: paintSkinTube(s), tip: nail });
function zombieCells(s, C) {
  const c = paintLowAtlas(s, C);
  c[0] = paintZombieFace(s, C); c[1] = paintSkinTube(s); c[2] = zombieHand(s); c[3] = zombieFoot(s); c[11] = paintZombieScalp(s);
  return c;
}

// ---------- Feuer-Skelett: verkohlte Knochen, glühende Risse, brennender Schädel ----------
const FIRE_CRACKS = Array.from({ length: 12 }, () => walk(rand(0.1, 0.9), rand(0.1, 0.9)));
const BURN_HOLES = [[0.25, 0.5, 0.05, 0.035], [0.65, 0.72, 0.04, 0.03], [0.12, 0.82, 0.05, 0.035]];   // x, y, rx, ry (Anteil der Zelle)
function fireCells(s, C) {
  return paintLowAtlas(s, C).map((c, i) => {
    if (BONE_CELLS.includes(i)) return recolor(c, 'brightness(0.42) sepia(0.7) saturate(1.3) contrast(1.15)', g => atop(g, () => { for (const k of FIRE_CRACKS) glowLine(g, scaled(k, s), '20,8,4', 2); }));
    if (CLOTH_CELLS.includes(i)) return recolor(c, 'brightness(0.55) saturate(0.5) sepia(0.3)', g => {
      atop(g, () => vGrad(g, s, [[0, 'rgba(20,8,4,0)'], [0.7, 'rgba(20,8,4,0.2)'], [1, 'rgba(20,8,4,0.8)']]));   // Ruß zum Saum hin
      for (const [x, y, rx, ry] of BURN_HOLES) tear(g, x * s, y * s, rx * s, ry * s, 'rgba(15,5,0,0.85)');
    });
    return recolor(c, 'brightness(0.6) saturate(0.8)');
  });
}
function fireEmit(s) {
  const EMB = '255,120,30', e = Array(12).fill(null);
  const cracks = () => canvas(s, g => { for (const k of FIRE_CRACKS) glowLine(g, scaled(k, s), EMB, 2); });
  e[0] = canvas(s, g => {
    const { X, Y, K } = faceXY(s);
    for (const k of FIRE_CRACKS.slice(0, 4)) glowLine(g, scaled(k, s), EMB, 2);
    for (const d of [-1, 1]) soft(g, X(d * 0.034), Y(-0.035), 0.02 * K, 0.018 * K, '255,110,20', 0.9);   // Glut in den Augenhöhlen
    soft(g, X(0), Y(-0.068), 0.01 * K, 0.012 * K, '255,90,20', 0.7);
  });
  for (const i of [1, 2, 3, 11]) e[i] = cracks();
  const hem = canvas(s, g => {
    vGrad(g, s, [[0, 'rgba(255,90,20,0)'], [0.9, 'rgba(255,90,20,0)'], [1, 'rgba(255,110,30,0.9)']]);
    for (let i = 0; i < 60; i++) { g.fillStyle = rgba('255,150,50', rand(0.3, 1)); g.fillRect(rand(0, s), s - rand(0, 0.08) * s, 2, 2); }   // Funken am Saum
    g.filter = 'blur(1px)'; g.strokeStyle = rgba(EMB, 0.9); g.lineWidth = 4;
    for (const [x, y, rx, ry] of BURN_HOLES) { g.beginPath(); g.ellipse(x * s, y * s, rx * s * 1.12, ry * s * 1.12, 0, 0, 7); g.stroke(); }   // glimmende Lochränder
    g.filter = 'none';
  });
  for (const i of [4, 5, 9]) e[i] = hem;
  return e;
}
function fireAddons(R) {
  const hot = glowMat(1.0, 0.28, 0.03), core = glowMat(1.0, 0.72, 0.16);   // unter 1 bleiben: darüber zieht der Tonemapper die Farbe Richtung Weiß
  R.flames = [];
  const flame = (par, x, y, z, h, tilt = 0) => {
    const j = joint(par, x, y, z); j.rotation.set(-Math.abs(tilt) * 0.3, 0, tilt); R.flames.push(j);
    add(j, new THREE.ConeGeometry(h * 0.28, h, 5, 1, true).translate(0, h / 2, 0), hot);
    add(j, new THREE.ConeGeometry(h * 0.16, h * 0.6, 4, 1, true).translate(0, h * 0.3, 0.004), core);
  };
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; flame(R.sk, Math.sin(a) * 0.045, 0.058 + 0.012 * Math.cos(a), Math.cos(a) * 0.05 - 0.01, 0.07 + 0.03 * (i % 2), -Math.sin(a) * 0.4); }   // Flammenkrone
  flame(R.sk, 0, 0.075, -0.01, 0.11);
  for (const a of [R.armL, R.armR]) for (let i = 0; i < 3; i++) flame(a.wrist, (i - 1) * 0.01, -0.02, (i - 1) * 0.012, 0.05);   // Hände brennen
  for (const s of [-1, 1]) flame(R.torso, s * 0.17, 0.57, -0.03, 0.07, -s * 0.3);                                               // Schultern
}

// ---------- Eis-Skelett: blasse Knochen, Raureif auf dem Stoff, Eiszacken ----------
const ICE_VEINS = Array.from({ length: 10 }, () => walk(rand(0.1, 0.9), rand(0.1, 0.9), 5, 0.04));
function iceCells(s, C) {
  const rime = g => atop(g, () => {                                       // Raureif: oben dicht, unten dünn
    vGrad(g, s, [[0, 'rgba(235,248,255,0.55)'], [0.35, 'rgba(235,248,255,0.12)'], [1, 'rgba(200,230,255,0.25)']]);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(240,250,255,${rand(0.15, 0.6)})`; g.fillRect(rand(0, s), Math.pow(Math.random(), 1.8) * s, rand(1, 3), rand(1, 3)); }
  });
  return paintLowAtlas(s, C).map((c, i) => {
    if (BONE_CELLS.includes(i)) return recolor(c, 'hue-rotate(165deg) saturate(0.45) brightness(1.12)', g => atop(g, () => { for (const v of ICE_VEINS) glowLine(g, scaled(v, s), '120,190,255', 1.2); }));
    if (CLOTH_CELLS.includes(i)) return recolor(c, 'hue-rotate(15deg) saturate(0.6) brightness(1.05)', rime);
    return recolor(c, 'saturate(0.5) brightness(0.9)', rime);
  });
}
function iceEmit(s) {
  const e = Array(12).fill(null);
  e[0] = canvas(s, g => { const { X, Y, K } = faceXY(s); for (const d of [-1, 1]) soft(g, X(d * 0.034), Y(-0.035), 0.022 * K, 0.02 * K, '90,180,255', 0.6); });
  e[1] = canvas(s, g => { for (const v of ICE_VEINS) glowLine(g, scaled(v, s), '60,140,255', 1); });
  return e;
}
function iceAddons(R, M) {
  const ice = new THREE.Color(1.25, 1.5, 1.8);
  const spike = (par, x, y, z, h, rx, rz, r = h * 0.18) => add(par, new THREE.ConeGeometry(r, h, 5).translate(0, h / 2, 0), M.bone, x, y, z, { tint: ice }).rotation.set(rx, 0, rz);
  for (const s of [-1, 1]) for (const [dx, h, a] of [[0, 0.12, 0.35], [0.035, 0.09, 0.75], [-0.03, 0.08, 0.1]]) spike(R.torso, s * (0.19 + dx), 0.55, -0.04, h, -0.2, -s * a);   // Schulterzacken
  for (const [x, h, a] of [[0, 0.09, 0], [0.04, 0.07, 0.5], [-0.04, 0.07, -0.5]]) spike(R.sk, x, 0.055, -0.04, h, -0.6, -a);                                   // Eiskrone hinten
  for (const a of [R.armL, R.armR]) spike(a.elbow, 0, 0, -0.03, 0.08, -1.9, 0);                                                                                 // Ellbogen
  for (let i = 0; i < 9; i++) { const ang = Math.PI * 0.35 + i / 8 * Math.PI * 1.3; spike(R.hips, Math.sin(ang) * 0.21, -0.08, Math.cos(ang) * 0.17, rand(0.04, 0.08), Math.PI, 0, 0.008); }   // Zapfen am Saum
}

// ---------- Arkan-Skelett: fahl violette Knochen, leuchtende Adern und Runen, kreisende Splitter ----------
const ARC = '205,120,255';
function arcaneCells(s, C) {
  return paintLowAtlas(s, C).map((c, i) =>
    BONE_CELLS.includes(i) ? recolor(c, 'hue-rotate(215deg) saturate(0.55) brightness(1.08)')   // Knochen fahl violett
    : [4, 9, 10].includes(i) ? recolor(c, 'hue-rotate(-30deg) saturate(1.25) brightness(0.9)')
    : i === 8 ? recolor(c, 'hue-rotate(-70deg) saturate(1.2)') : c);
}
function arcaneEmit(s) {
  const e = Array(12).fill(null), veins = n => canvas(s, g => { for (let i = 0; i < n; i++) glowLine(g, scaled(walk(rand(0.1, 0.9), rand(0.1, 0.9)), s), ARC, 1.3); });
  e[0] = canvas(s, g => {
    const { X, Y, K } = faceXY(s);
    for (const d of [-1, 1]) for (let i = 0; i < 3; i++) {                                // Adern laufen von den Augen weg
      const pts = [[X(d * 0.034), Y(-0.034)]]; let a = d > 0 ? rand(-1, 1) : Math.PI + rand(-1, 1);
      for (let k = 0; k < 5; k++) { a += rand(-0.5, 0.5); const [px, py] = pts[pts.length - 1]; pts.push([px + Math.cos(a) * 0.012 * K, py + Math.sin(a) * 0.012 * K]); }
      glowLine(g, pts, ARC, 1.4);
    }
    rune(g, X(0), Y(0.0), 0.007 * K, ARC);                                                 // Stirnrune
    for (const d of [-1, 1]) soft(g, X(d * 0.034), Y(-0.035), 0.02 * K, 0.018 * K, ARC, 0.7);   // Leuchten in den Augenhöhlen
  });
  e[1] = veins(8); e[2] = veins(6); e[3] = veins(6); e[11] = veins(8);
  e[4] = canvas(s, g => { for (let y = 20; y < s * 0.75; y += 38) rune(g, s - 34, y, 9, ARC); glowLine(g, [[0, s - 3], [s, s - 3]], ARC, 1.5); });   // Runen an der Sakkokante, Saum
  e[9] = canvas(s, g => { for (let x = 20; x < s; x += 44) rune(g, x, s * 0.88, 9, ARC); });
  e[10] = canvas(s, g => { for (const x0 of [0.25, 0.75]) for (let y = 30; y < s; y += 60) rune(g, x0 * s, y, 8, ARC); });
  e[5] = canvas(s, g => glowLine(g, [[s / 2, 0], [s / 2, s]], ARC, 1.2));
  return e;
}
function arcaneAddons(R) {
  const m = glowMat(1.9, 0.7, 2.8);
  R.orbit = joint(R.torso, 0, 0.62, -0.02);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; add(R.orbit, new THREE.OctahedronGeometry(0.022), m, Math.sin(a) * 0.3, 0.06 * Math.sin(a * 2), Math.cos(a) * 0.3).scale.y = 1.8; }
}

// ---------- Kapuzenmagier (Modus „Alle“): Robe, Umhang, Kapuze, kein Gesicht ----------
const ROBE = { yBot: 0.1, yTop: 1.62, g0: 0.04, armSin: 0.95, armY0: 1.37, armY1: 1.515,
  g: y => 0.04 + 0.22 * smooth(0.62, 0.15, y),                                                       // vorn zu, unten Gehschlitz
  RX: [[0.1, 0.27], [0.5, 0.235], [0.9, 0.2], [1.05, 0.172], [1.2, 0.176], [1.38, 0.19], [1.46, 0.205], [1.505, 0.235], [1.535, 0.246], [1.555, 0.212], [1.575, 0.165], [1.6, 0.11], [1.62, 0.08]],
  RZ: [[0.1, 0.23], [0.5, 0.2], [0.9, 0.17], [1.05, 0.148], [1.2, 0.152], [1.4, 0.168], [1.5, 0.142], [1.555, 0.122], [1.6, 0.09], [1.62, 0.07]],
  CZ: [[0.1, -0.02], [0.9, -0.01], [1.1, 0.0], [1.25, 0.02], [1.4, 0.015], [1.5, 0.0], [1.56, -0.01], [1.62, -0.02]],
  fold: (y, a) => 0.05 * smooth(0.95, 0.2, y) * (0.5 + 0.5 * Math.sin(a * 4 + 0.5)) };
const MANTLE = { yBot: 1.3, yTop: 1.625, g0: 0.05, g: () => 0.05,
  RX: [[1.3, 0.285], [1.42, 0.275], [1.5, 0.262], [1.545, 0.25], [1.57, 0.2], [1.6, 0.13], [1.625, 0.09]],
  RZ: [[1.3, 0.2], [1.45, 0.19], [1.53, 0.16], [1.57, 0.13], [1.6, 0.1], [1.625, 0.078]],
  CZ: [[1.3, 0.0], [1.5, 0.0], [1.625, -0.02]] };
const robeWeights = ({ torso, hips, armL, armR, legL, legR }) => p => {     // wie das Sakko, aber der lange Rock geht mit den Beinen
  const wT = smooth(0.98, 1.12, p.y), wL = 0.85 * smooth(1.0, 0.75, p.y), k = clamp01(0.5 + p.x / 0.14);
  const wS = 0.35 * smooth(0.16, 0.235, Math.abs(p.x)) * smooth(1.45, 1.52, p.y);
  return [[torso, wT * (1 - wS)], [p.x > 0 ? armL.shoulder : armR.shoulder, wT * wS], [hips, Math.max(0, 1 - wT - wL)], [legL.hip, wL * k], [legR.hip, wL * (1 - k)]];
};
// Kapuze im Schädelraum: Ringe von der Spitze (hinten oben) bis zum Kragen, vorn offen
const HOOD_ROWS = [   // y, Radius, z-Mitte, halbe Öffnung (Grad)
  [0.13, 0.012, -0.085, 0], [0.105, 0.06, -0.05, 22], [0.07, 0.1, -0.02, 34], [0.02, 0.118, -0.01, 40],
  [-0.04, 0.12, -0.005, 38], [-0.1, 0.112, 0.0, 30], [-0.15, 0.11, -0.005, 16], [-0.19, 0.125, -0.015, 6]];
function hoodGeo() {
  const N = 12, rows = HOOD_ROWS.map(([y, r, cz, open]) => Array.from({ length: N + 1 }, (_, c) => {
    const a = (open + (360 - 2 * open) * c / N) * Math.PI / 180, edge = c === 0 || c === N;
    return [Math.sin(a) * r * (edge ? 1.04 : 1), y, cz + Math.cos(a) * r * 0.95 + (edge ? 0.025 : 0)];   // Saum steht vor: Gesicht liegt im Schatten
  }));
  return gridGeo(rows, (r, c) => [c / N, 1 - r / (HOOD_ROWS.length - 1)]);
}
function hoodClothes(R, M) {
  const { root, torso, hips, armL, armR, sk } = R;
  add(root, mirrorU(garment(ROBE, [14, 4])), M.shell, 0, 0, 0, { weights: robeWeights(R) });
  add(root, subUV(mirrorU(garment(MANTLE, [14, 8])), 0.5, 0, 1, 1), M.satin, 0, 0, 0, { weights: jacketWeights(R) });
  for (const [s, a] of [[1, armL], [-1, armR]]) {                                                  // Glockenärmel
    const { geo, weights } = sleeve(LOWP, s, 0.205, 1.53, L.shoulderY - L.upper - L.fore * 0.85, 0.058, 0.085, a, 12);
    add(root, mirrorU(geo), M.sleeve, 0, 0, 0, { weights });
  }
  root.updateMatrixWorld(true);                                                                   // Kapuze: oben mit dem Kopf, unten mit dem Rumpf
  const hood = subUV(hoodGeo(), 0, 0, 0.5, 1).applyMatrix4(sk.matrixWorld);
  add(root, hood, M.satin, 0, 0, 0, { weights: p => { const w = smooth(1.6, 1.72, p.y); return [[sk, w], [torso, 1 - w]]; } });
  const belt = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; belt.push([Math.sin(a) * 0.184, 1.05 + 0.012 * Math.cos(a), Math.cos(a) * 0.16]); }
  add(root, subUV(tube(belt, 0.013, 12, 3, { closed: true }), 0, 0, 1, 0.3), M.accent, 0, 0, 0, { weights: () => [[torso, 0.5], [hips, 0.5]] });
  for (const [x, rz] of [[0.04, 0.08], [0.075, 0.18]]) add(hips, subUV(lowPanel(0.04, 0.32, 3, 0.2), 0, 0.3, 1, 1), M.accent, x, 0.04, 0.165).rotation.set(-0.1, 0, rz);   // Schärpenenden
  add(hips, new THREE.BoxGeometry(0.05, 0.065, 0.035), M.accent, -0.17, -0.005, 0.07).rotation.y = -0.9;                                                        // Beutel
  [[0.8, 1.8, 2.8], [2.8, 1.0, 0.25], [2.2, 0.9, 2.9]].forEach(([r, g, b], i) => add(hips, new THREE.OctahedronGeometry(0.012), glowMat(r, g, b), (i - 1) * 0.035, 0.05, 0.17).scale.y = 1.4);   // Runensteine: Frost, Feuer, Arkan
}
function paintTrim(g, x, y, w, h, vertical) {                           // Goldborte mit gesticktem Rautenmuster
  const grd = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, '#5a4218'); grd.addColorStop(0.35, '#c9a24e'); grd.addColorStop(0.55, '#f0d48a'); grd.addColorStop(1, '#6a4c1a');
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(60,35,10,0.8)'; g.lineWidth = 1.5; g.beginPath();
  for (let t = 0; t < (vertical ? h : w); t += 14) {
    if (vertical) { g.moveTo(x + w / 2, y + t); g.lineTo(x + w - 3, y + t + 7); g.lineTo(x + w / 2, y + t + 14); g.lineTo(x + 3, y + t + 7); g.closePath(); }
    else { g.moveTo(x + t, y + h / 2); g.lineTo(x + t + 7, y + 3); g.lineTo(x + t + 14, y + h / 2); g.lineTo(x + t + 7, y + h - 3); g.closePath(); }
  }
  g.stroke();
}
function paintRobe(s) {
  const yOf = y => garmentY(ROBE, y) * s;
  return canvas(s, g => {
    lowCloth(g, s, '#332d3f', 0);
    vGrad(g, s, [[0, rgba(LIT, 0.22)], [0.15, rgba(LIT, 0.05)], [0.45, rgba(SHD, 0.05)], [1, rgba(SHD, 0.6)]]);
    hGrad(g, s, [[0, rgba(SHD, 0.35)], [0.5, rgba(SHD, 0.12)], [1, rgba(LIT, 0.06)]]);
    soft(g, 0.52 * s, yOf(1.44), 0.1 * s, 0.1 * s, DEEP, 0.7);                                  // Achsel
    band(g, s, yOf(1.03), yOf(0.88), DEEP, 0.5);                                                 // unter dem Gürtel
    for (let i = 0; i < 16; i++) pipeFold(g, rand(0.02, 0.95) * s, yOf(1.0) + rand(0, 30), s, rand(18, 34), '18,12,26', '150,140,170', rand(0.3, 0.55));   // Fallfalten
    seamV(g, 3, 0, s, null); seamV(g, 0.52 * s, yOf(1.37), s, null);
    paintTrim(g, s - 20, 0, 20, s, true); paintTrim(g, 0, s - 26, s, 22, false);
    grime(g, s); frayBottom(g, s, 0.015, 60);
  });
}
function paintRobeSleeve(s) {
  return canvas(s, g => {
    lowCloth(g, s, '#332d3f', 0);
    vGrad(g, s, [[0, rgba(LIT, 0.25)], [0.2, rgba(LIT, 0.05)], [1, rgba(SHD, 0.5)]]);
    hGrad(g, s, [[0, rgba(SHD, 0.3)], [0.5, rgba(SHD, 0.1)], [1, rgba(LIT, 0.08)]]);
    for (let i = 0; i < 7; i++) pipeFold(g, rand(0.05, 0.95) * s, 0.2 * s, s, rand(16, 28), '18,12,26', '150,140,170', rand(0.25, 0.45));
    seamH(g, 8, 0, s, null); paintTrim(g, 0, s - 30, s, 24, false);
    soft(g, s, s, 0.4 * s, 0.1 * s, DEEP, 0.4);                                                  // Innenseite der Glocke
  });
}
function paintHoodMantle(s) {                                            // links Kapuze (u 0/1 = Öffnungskanten), rechts Umhang (gespiegelt)
  return canvas(s, g => {
    const h = s / 2;
    lowCloth(g, s, '#2b2636', 0);
    vGrad(g, s, [[0, rgba(LIT, 0.25)], [0.4, rgba(LIT, 0.03)], [1, rgba(SHD, 0.5)]]);
    for (const x of [0, h]) { const grd = g.createLinearGradient(x === 0 ? 0 : h, 0, x === 0 ? 70 : h - 70, 0); grd.addColorStop(0, rgba(DEEP, 0.9)); grd.addColorStop(1, rgba(DEEP, 0)); g.fillStyle = grd; g.fillRect(x === 0 ? 0 : h - 70, 0, 70, s); }   // Kapuzenrand innen dunkel
    paintTrim(g, 0, 0, 10, s, true); paintTrim(g, h - 10, 0, 10, s, true);
    for (let i = 0; i < 6; i++) pipeFold(g, rand(0.05, 0.45) * s, 0.1 * s, s, rand(14, 24), '18,12,26', '150,140,170', rand(0.2, 0.35));
    // Umhang
    for (let i = 0; i < 10; i++) pipeFold(g, rand(0.52, 0.98) * s, 0.15 * s, s, rand(16, 28), '18,12,26', '150,140,170', rand(0.3, 0.5));
    paintTrim(g, s - 16, 0, 16, s, true); paintTrim(g, h, s - 46, h, 20, false);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';                     // gezackter Saum (Alpha)
    g.beginPath(); g.moveTo(h, s); for (let x = h; x <= s; x += 24) { g.lineTo(x, s - 22); g.lineTo(x + 12, s); } g.lineTo(s, s); g.fill();
    g.globalCompositeOperation = 'source-over';
  });
}
function paintSash(s) {
  return canvas(s, g => {
    g.fillStyle = '#5a1f25'; g.fillRect(0, 0, s, s); weave(g, s, 2, '0,0,0', '255,210,200', 0.6);
    vGrad(g, s, [[0, rgba(LIT, 0.15)], [1, rgba(DEEP, 0.45)]]);
    for (const x of [0, s - 24]) paintTrim(g, x, 0, 24, s * 0.7, true);
    g.save(); g.beginPath(); g.rect(0, 0.7 * s, s, 0.3 * s); g.clip();                          // Gürtel: gedrehte Kordel
    for (let x = -s; x < s; x += 18) { g.fillStyle = 'rgba(20,5,5,0.5)'; g.fillRect(x, 0.7 * s, 6, 0.3 * s); }
    g.restore();
    blotches(g, s, 6, 'rgba(40,30,15,0.4)', [0.03, 0.07]);
  });
}
const LINEN_PAL = ['#4a4034', '#b8ab8a', '#d6cbad', '#8f8266', '#3c3430'];
function wraps(g, x0, x1, s) { atop(g, () => { g.strokeStyle = 'rgba(60,45,30,0.55)'; g.lineWidth = 2; for (let y = -s; y < 2 * s; y += 12) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y + (x1 - x0) * 0.35); g.stroke(); } }); }
function paintWrapTube(s) {                                              // Binden um die Unterarme: u = entlang, v = rundherum
  return canvas(s, g => {
    vGrad(g, s, [[0, '#4a4034'], [0.25, '#b8ab8a'], [0.45, '#d6cbad'], [0.75, '#8f8266'], [1, '#3c3430']]);
    g.strokeStyle = 'rgba(60,45,30,0.6)'; g.lineWidth = 3; for (let x = -s; x < s; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + s * 0.6, s); g.stroke(); }
    blotches(g, s, 10, 'rgba(90,70,40,0.3)', [0.03, 0.08]); grime(g, s, false);
  });
}
function hoodCells(s) {
  const hand = paintHandPlate(s, { pal: LINEN_PAL, wk: 1.12, right: paintWrapTube(s) }); wraps(hand.getContext('2d'), 0, s, s);
  const foot = paintFootPlate(s, { pal: LINEN_PAL, wk: 1.2, right: paintWrapTube(s) }); wraps(foot.getContext('2d'), 0, s, s);
  return [blank(s), paintWrapTube(s), hand, foot, paintRobe(s), blank(s), paintLowWood(s), blank(s), paintSash(s), paintRobeSleeve(s), paintHoodMantle(s), blank(s)];
}
function hoodEmit(s) {                                                   // Runen am Umhangsaum in allen drei Schulen
  const e = Array(12).fill(null), cols = ['120,190,255', '255,130,40', '205,120,255'];
  e[10] = canvas(s, g => { let k = 0; for (let x = s / 2 + 26; x < s - 20; x += 40) rune(g, x, s - 70, 9, cols[k++ % 3]); });
  return e;
}
const SCHOOLS = [[0.8, 1.8, 2.8], [2.8, 1.0, 0.25], [2.2, 0.9, 2.9]];  // Frost, Feuer, Arkan


// ---------- Bewegung pro Skin: idle, Laufen, Zaubern, Kanal ----------
// Schulter x < 0 = Arm nach vorn/oben, lShZ > 0 / rShZ < 0 = Arm zur Seite, Ellbogen x < 0 = beugen, Hüfte x < 0 = Bein nach vorn.
const wave = (time, ms) => (time / ms) % 1;                               // 0..1, wiederholt sich alle ms
// Feuer: aggressiv, ruckartig, nach vorn gelehnt. Wirft Feuerbälle, Kanal = Flammenwerfer mit beiden Händen.
const FIRE_MOVES = {
  freq: 5.2, blend: 16, lag: { head: 8, arm: 8 },
  gait(j, t, ph) {
    const sw = Math.sin(ph), cw = Math.cos(ph);
    Object.assign(t, { lHip: -sw * 0.7, rHip: sw * 0.7, lKnee: Math.max(0, sw) * 1.1 + 0.15, rKnee: Math.max(0, -sw) * 1.1 + 0.15, lean: 0.3, hipsY: 0.96 + Math.abs(cw) * 0.06,
      sway: sw * 0.06, twist: sw * 0.12, lSh: sw * 0.7, lEl: -0.9, gripL: 1, rSh: -0.4 - sw * 0.3, rEl: -0.8, headX: 0.1 + Math.abs(cw) * 0.08, jaw: 0.15 });
  },
  idle(t, ph) {
    Object.assign(t, { sway: Math.sin(ph * 1.3) * 0.04, hipsY: 0.99 + Math.abs(Math.sin(ph * 1.6)) * 0.015, lean: 0.12, lSh: -0.15, lShZ: 0.15, lEl: -0.9, gripL: 1, rSh: -0.25, rEl: -0.7,
      headX: 0.05 + Math.sin(ph * 2.3) * 0.04, headZ: Math.sin(ph * 0.9) * 0.08, jaw: 0.1 + Math.abs(Math.sin(ph * 3)) * 0.08 });
  },
  cast(t, time) {                                                          // ausholen, schleudern, nachschwingen
    const k = wave(time, 620), back = smooth(0, 0.4, k), fwd = smooth(0.4, 0.55, k);
    Object.assign(t, { lSh: back * 0.9 - fwd * 2.4, lEl: -1.4 * back * (1 - fwd) - 0.1, lShZ: 0.2, gripL: fwd > 0.5 ? 0 : 1, twist: 0.4 * back - 0.7 * fwd, lean: 0.15 + 0.2 * fwd,
      rSh: -0.5, rEl: -0.6, jaw: 0.05 + 0.35 * fwd, headX: -0.05 * fwd });
  },
  channel(t, time) {                                                       // Flammenwerfer: beide Arme vor, Körper bebt
    const sh = Math.sin(time / 40) * 0.02;
    Object.assign(t, { lSh: -1.45 + sh, rSh: -1.3 - sh, lEl: -0.1, rEl: -0.25, lShZ: 0.05, rShZ: -0.05, lean: 0.25 + sh, hipsY: 0.97, lHip: -0.2, rHip: 0.15, lKnee: 0.2, rKnee: 0.25,
      headX: -0.05, jaw: 0.35 + Math.sin(time / 50) * 0.05, gripL: 0 });
  },
};
// Eis: steif, aufrecht, kontrolliert, gefrorene Gelenke. Stab-Stoß in den Boden, Kanal = Hände zum Boden (Blizzard).
const ICE_MOVES = {
  freq: 3.4, blend: 8, lag: { head: 10, arm: 10 },
  gait(j, t, ph) {
    const sw = Math.sin(ph), q = x => Math.round(x * 5) / 5;               // Knie in Stufen: wie eingefroren
    Object.assign(t, { lHip: -sw * 0.4, rHip: sw * 0.4, lKnee: q(Math.max(0, sw) * 0.35) + 0.03, rKnee: q(Math.max(0, -sw) * 0.35) + 0.03, lean: 0.02, hipsY: 1.0,
      lSh: sw * 0.15, lEl: -0.15, lShZ: 0.05, rSh: -0.2, rEl: -0.45, headZ: Math.sin(ph * 13) * 0.01, gripL: 0.2 });
  },
  idle(t, ph, time) {
    const shiver = wave(time, 4200) > 0.9 ? Math.sin(time / 18) * 0.04 : 0;   // ab und zu ein Frostschauer
    Object.assign(t, { lean: -0.02, headX: -0.05, headZ: shiver, sway: shiver * 0.5, lShZ: 0.06, lEl: -0.1, gripL: 0.2, rSh: -0.25, rEl: -0.55, hipsY: 1 + Math.sin(ph * 0.5) * 0.004 });
  },
  cast(t, time) {                                                          // Stab hoch, in den Boden stoßen, linke Hand vor
    const k = wave(time, 760), up = smooth(0, 0.5, k), down = smooth(0.5, 0.62, k);
    Object.assign(t, { rSh: -0.3 - 1.6 * up + 1.4 * down, rEl: -0.5, lSh: -1.0 * down, lEl: -0.2, lShZ: 0.2, gripL: 0, lean: 0.3 * down, hipsY: 1 - 0.07 * down, lKnee: 0.4 * down, rKnee: 0.4 * down,
      lHip: -0.25 * down, rHip: -0.25 * down, headX: -0.1 * up + 0.15 * down, jaw: 0.25 * down });
  },
  channel(t, time) {                                                       // Arme seitlich, Hände zum Boden, langsam
    const sl = Math.sin(time / 900) * 0.03;
    Object.assign(t, { lSh: -0.9, rSh: -0.9, lShZ: 0.5 + sl, rShZ: -0.5 - sl, lEl: -0.4, rEl: -0.4, headX: 0.25, jaw: 0.25, gripL: 0, lean: 0.08 });
  },
};
// Arkan: schwerelos, schwebt eine Handbreit über dem Boden, Beine hängen. Zaubern = Armkreis, Kanal = Arme weit offen, steigt höher.
const ARCANE_MOVES = {
  freq: 2.4, blend: 6, lag: { head: 2.5, arm: 2 },
  gait(j, t, ph) {
    const sw = Math.sin(ph);
    Object.assign(t, { hipsY: 1.06 + Math.sin(ph * 2) * 0.015, lHip: 0.15 + sw * 0.12, rHip: 0.15 - sw * 0.12, lKnee: 0.35 + sw * 0.08, rKnee: 0.35 - sw * 0.08, rAnkle: 0.4,
      lean: 0.12, sway: sw * 0.02, lSh: 0.35, lShZ: 0.35, lEl: -0.3, rSh: -0.1, rEl: -0.5, rShZ: -0.15, headX: 0.05, gripL: 0.2 });
  },
  idle(t, ph) {
    Object.assign(t, { hipsY: 1.05 + Math.sin(ph * 0.8) * 0.02, lHip: 0.08, rHip: 0.05, lKnee: 0.2, rKnee: 0.25, rAnkle: 0.35, lSh: -0.2, lShZ: 0.3 + Math.sin(ph * 0.7) * 0.05,
      lEl: -0.4, gripL: 0.2, headZ: 0.12, headX: Math.sin(ph * 0.5) * 0.05 });
  },
  cast(t, time) {                                                          // linke Hand zieht einen Kreis
    const a = wave(time, 640) * Math.PI * 2;
    Object.assign(t, { lSh: -1.2 + Math.sin(a) * 0.6, lShZ: 0.4 + Math.cos(a) * 0.5, lEl: -0.2, gripL: 0, rSh: -0.8, rEl: -0.3, twist: Math.sin(a) * 0.15, hipsY: 1.08, rAnkle: 0.4, lKnee: 0.3, rKnee: 0.3, headZ: 0.08 });
  },
  channel(t, time) {                                                       // Arme weit offen, Kopf zurück, schwebt höher
    Object.assign(t, { lShZ: 1.4, rShZ: -1.4, lSh: -0.3, rSh: -0.3, lEl: 0, rEl: 0, gripL: 0, headX: -0.35, hipsY: 1.14 + Math.sin(time / 400) * 0.02, lKnee: 0.3, rKnee: 0.35, rAnkle: 0.5, jaw: 0.2 });
  },
  poses: { sit: { hipsY: 0.75, lHip: -1.45, rHip: -1.45, lKnee: 1.5, rKnee: 1.5, rAnkle: 0.4, lSh: -0.2, lShZ: 0.3, lEl: -0.6, rSh: -0.3, rEl: -0.6, gripL: 0.2, headZ: 0.1 } },   // sitzt im Schweben
};
// Kapuze (Alle): würdevoll und ruhig. Zaubern = Hände zusammen, dann nach vorn stoßen; Kanal = Stab hoch, linke Hand vor.
const HOOD_MOVES = {
  freq: 3.6, blend: 10, lag: { head: 5, arm: 4 },
  gait(j, t, ph) {
    const sw = Math.sin(ph), cw = Math.cos(ph);
    Object.assign(t, { lHip: -sw * 0.45, rHip: sw * 0.45, lKnee: Math.max(0, sw) * 0.7 + 0.05, rKnee: Math.max(0, -sw) * 0.7 + 0.05, sway: sw * 0.04, lean: 0.08,
      hipsY: 0.985 + Math.abs(cw) * 0.02, headX: 0.05, lSh: sw * 0.25, lShZ: 0.08, lEl: -0.25, gripL: 0.5, rSh: -0.3, rEl: -0.6, rShZ: -0.12, jaw: 0 });
  },
  idle(t, ph) { Object.assign(t, { sway: Math.sin(ph * 0.6) * 0.02, headX: 0.05 + Math.sin(ph * 0.4) * 0.03, lean: 0.04, lShZ: 0.08, lEl: -0.2, gripL: 0.5 }); },
  cast(t, time) {
    const k = wave(time, 560), gather = smooth(0, 0.5, k), push = smooth(0.5, 0.68, k);
    Object.assign(t, { lSh: -0.8 * gather - 0.6 * push, rSh: -0.8 * gather - 0.4 * push, lShZ: 0.1 - 0.2 * gather, rShZ: -0.1 + 0.2 * gather, lEl: -1.0 * gather * (1 - push) - 0.15, rEl: -1.0 * gather * (1 - push) - 0.3,
      gripL: 0, lean: 0.12 * push, headX: 0.1 * gather - 0.1 * push });
  },
  channel(t, time) { Object.assign(t, { rSh: -2.8, rEl: 0, rShZ: -0.1, lSh: -1.4 + Math.sin(time / 300) * 0.05, lEl: -0.1, gripL: 0, headX: -0.15, lean: -0.05 }); },
};


// ---------- Fußspuren: Feuer brennt (Schaden), Frost verlangsamt ----------
// Ein InstancedMesh mit 10 Plätzen pro Spieler (1 Draw Call). Jede Spur lebt 5 s; die 11. ersetzt die älteste.
const TRAIL = { max: 10, life: 5, r: 0.45 };                             // r = Wirkradius fürs Spiel
function footprintTex(kind) {                                            // Skelett-Fußabdruck, additiv: Schwarz = unsichtbar
  return toTex(canvas(128, (g, s) => {
    const w = s / 2, foot = () => {                                      // Ferse, schmale Mitte, Ballen, 5 Zehen (Großzehe rechts)
      g.beginPath(); g.ellipse(w * 0.5, s * 0.82, w * 0.2, s * 0.12, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(w * 0.56, s * 0.62, w * 0.14, s * 0.16, 0.1, 0, 7); g.fill();
      g.beginPath(); g.ellipse(w * 0.52, s * 0.4, w * 0.28, s * 0.1, -0.1, 0, 7); g.fill();
      [[0.74, 0.2, 0.11], [0.56, 0.17, 0.08], [0.41, 0.19, 0.07], [0.29, 0.23, 0.065], [0.19, 0.28, 0.06]].forEach(([x, y, r]) => { g.beginPath(); g.arc(w * x, s * y, w * r, 0, 7); g.fill(); });
    };
    g.translate(w / 2, 0);
    if (kind === 'fire') {
      g.filter = 'blur(6px)'; g.fillStyle = '#c23a08'; foot(); g.filter = 'blur(2px)'; g.fillStyle = '#ff8a1e'; foot();
      g.filter = 'none'; g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,220,120,0.6)'; g.scale(0.92, 0.95); g.translate(w * 0.04, s * 0.02); foot();
    } else {
      g.filter = 'blur(5px)'; g.fillStyle = '#2a6aa8'; foot(); g.filter = 'none'; g.fillStyle = '#9fd8ff'; foot();
      g.strokeStyle = 'rgba(230,248,255,0.9)'; g.lineWidth = 1.5;                       // Eiskristalle am Rand
      for (let i = 0; i < 14; i++) { const x = rand(0.1, 0.9) * w, y = rand(0.15, 0.95) * s, a = rand(0, 7), l = rand(4, 10); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }
  }));
}
export function makeTrail(kind) {
  const mat = new THREE.MeshBasicMaterial({ map: footprintTex(kind), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.62).rotateX(-Math.PI / 2).rotateY(Math.PI), mat, TRAIL.max);
  mesh.frustumCulled = false;
  const prints = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  let next = 0;
  const trail = {
    mesh, kind,
    add(x, y, z, ang, side) { prints[next] = { x, y, z, ang, side, age: 0 }; next = (next + 1) % TRAIL.max; },
    update(dt) {                                                         // dt in Sekunden
      for (let i = 0; i < TRAIL.max; i++) {
        const p = prints[i];
        if (p) p.age += dt;
        if (!p || p.age >= TRAIL.life) { mesh.setMatrixAt(i, m.makeScale(0, 0, 0)); mesh.setColorAt(i, c.setScalar(0)); continue; }
        const fade = 1 - smooth(TRAIL.life - 1, TRAIL.life, p.age), flick = kind === 'fire' ? 0.75 + 0.25 * Math.sin(p.age * 18 + i * 2) : 1;
        mesh.setMatrixAt(i, m.compose(v.set(p.x, p.y + 0.012, p.z), q.setFromAxisAngle(up, p.ang), sc.set(p.side, 1, 1)));
        mesh.setColorAt(i, c.setScalar(fade * flick));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
    zones: () => prints.filter(p => p && p.age < TRAIL.life).map(p => ({ x: p.x, z: p.z, r: TRAIL.r })),   // fürs Spiel: wo brennt/friert es gerade
  };
  trail.update(0);
  return trail;
}
// Schritt = tiefster Punkt des Sprunggelenks in einem Schrittzyklus (der Fuß setzt nicht immer genau auf Ruhehöhe auf).
// Ein Fuß gilt als „fällt“, sobald er 2 cm unter sein letztes Hoch sinkt; steigt er danach wieder, war das ein Schritt.
export function stepWatcher(R) {
  const foot = [{ hi: 0, lo: 0, falling: false }, { hi: 0, lo: 0, falling: false }], v = new THREE.Vector3(), base = new THREE.Vector3();
  return onStep => {
    R.root.getWorldPosition(base);
    const e = R.root.matrixWorld.elements, ang = Math.atan2(e[8], e[10]);
    [R.legL, R.legR].forEach((lg, i) => {
      const f = foot[i]; lg.ankle.getWorldPosition(v); const h = v.y - base.y;
      if (!f.falling) { f.hi = Math.max(f.hi, h); if (h < f.hi - 0.02) { f.falling = true; f.lo = h; } }
      else if (h > f.lo + 0.005) { f.falling = false; f.hi = h; if (f.lo < 0.2) onStep(v.x, base.y, v.z, ang, i ? -1 : 1); }
      else f.lo = Math.min(f.lo, h);
    });
  };
}

// ---------- Charaktere ----------
const SKIN = { ...LOW, extra(R, j, time) { GENT_BASE.extra(R, j, time); if (this.animate) this.animate(R, time); } };
const LOW_ZOMBIE = { ...SKIN, id: 'lowZombie', name: 'Zombie', flesh: true, atlasCells: zombieCells, eye: 0xd8ff70, eyeCol: [1.8, 2.6, 0.5] };
const FIRE = { ...SKIN, ...FIRE_MOVES, id: 'fire', name: 'Feuer-Skelett', trail: 'fire', atlasCells: fireCells, emitCells: fireEmit, addons: fireAddons,
  eye: 0xff8a30, eyeCol: [3, 1.2, 0.3], crystalCol: SCHOOLS[1], crystalGlow: 0xff7a30,
  animate: (R, t) => R.flames.forEach((f, i) => f.scale.set(1 - 0.1 * Math.sin(t / 60 + i), 1 + 0.3 * Math.sin(t / 85 + i * 1.9) + 0.15 * Math.sin(t / 37 + i), 1)) };
const ICE = { ...SKIN, ...ICE_MOVES, id: 'ice', name: 'Eis-Skelett', trail: 'frost', atlasCells: iceCells, emitCells: iceEmit, emitK: 1.6, addons: iceAddons, eye: 0x9fdcff, eyeCol: [1.2, 2.4, 3.2] };
const ARCANE = { ...SKIN, ...ARCANE_MOVES, id: 'arcane', name: 'Arkan-Skelett', speedMul: 1.1, atlasCells: arcaneCells, emitCells: arcaneEmit, addons: arcaneAddons,
  eye: 0xd090ff, eyeCol: [2.4, 1.2, 3.2], crystalCol: SCHOOLS[2], crystalGlow: 0xc070ff,
  animate: (R, t) => { R.orbit.rotation.y = t / 900; R.orbit.position.y = 0.62 + Math.sin(t / 700) * 0.03; } };
const HOOD = { ...SKIN, ...HOOD_MOVES, id: 'hood', name: 'Kapuzenmagier (Alle)', hood: true, atlasCells: hoodCells, emitCells: hoodEmit, clothes: hoodClothes,
  animate(R, t) {                                                         // Kristall wechselt durch Frost, Feuer, Arkan
    const p = (t / 2500) % 3, i = Math.floor(p), k = smooth(0.7, 1, p - i), a = SCHOOLS[i], b = SCHOOLS[(i + 1) % 3];
    const c = [0, 1, 2].map(n => lerp(a[n], b[n], k));
    R.crystal.material.color.setRGB(...c); R.crystalGlow.material.color.setRGB(c[0] / 2.8, c[1] / 2.8, c[2] / 2.8);
  } };

// =====================================================================
// Skelett-Krieger: WotLK-Krieger trifft Diablo-3-Barbar und Tryndamere. Gleiches Vanilla-Rig wie die Magier.
// Freier Brustkorb (Rippen per Alpha), Hörnerhelm, schwere Schulterplatten (links größer), Kreuzgurt,
// Fellrock mit Wappenrock und ein riesiges Zweihand-Schwert (gut 2 m, Eisenplatte mit Scharten).
// Attacken: Kombo (2 Schläge), Kampfschrei, Wirbelwind, Smash, Donnerknall.
// Bodeneffekte liegen in Weltkoordinaten (fx.group in die Szene); Treffer melden sich über R.onHit.
// =====================================================================
function skullEmblem(g, x, y, r, bone, dark) {                         // Wappen-Schädel für Schild, Rock, Platte, Schnalle
  g.fillStyle = bone; g.beginPath(); g.arc(x, y - r * 0.15, r, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(x + r * 0.55, y + r * 0.75); g.lineTo(x - r * 0.55, y + r * 0.75); g.closePath(); g.fill();
  g.fillStyle = dark; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(x + d * r * 0.4, y, r * 0.27, r * 0.24, 0, 0, 7); g.fill(); }
  g.beginPath(); g.moveTo(x, y + r * 0.2); g.lineTo(x - r * 0.12, y + r * 0.42); g.lineTo(x + r * 0.12, y + r * 0.42); g.fill();
  g.strokeStyle = dark; g.lineWidth = Math.max(1, r * 0.06);
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * r * 0.16, y + r * 0.55); g.lineTo(x + i * r * 0.16, y + r * 0.75); g.stroke(); }
}
const EMBLEM = [0.72, 0.72, 1, 1];                                       // Ecke der Eisenzelle mit Bronze-Schädel (UV)
function rivet(g, x, y, r) {
  g.fillStyle = 'rgba(10,10,14,0.6)'; g.beginPath(); g.arc(x + 1.5, y + 2, r, 0, 7); g.fill();
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); grd.addColorStop(0, '#d8dce4'); grd.addColorStop(1, '#3a3c44');
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}

// ---------- Texturen ----------
function paintIron(s) {
  return canvas(s, g => {
    vGrad(g, s, [[0, '#8a8f99'], [0.3, '#5e636d'], [0.65, '#41444c'], [1, '#26252c']]);   // Licht oben, kühle Schatten unten
    strokes(g, s, 500, ['#a9aeb8', '#2a2a30', '#6c707a'], { angle: 0, len: [0.05, 0.25], w: [1, 2], a: [0.05, 0.15] });   // Schleifspuren
    blotches(g, s, 10, 'rgba(120,60,25,0.35)', [0.02, 0.07]);                               // Rost
    blotches(g, s, 8, 'rgba(20,20,26,0.4)', [0.03, 0.08]);                                  // Dellen
    for (const y of [0.4, 0.93]) for (let x = 14; x < s; x += 34) rivet(g, x, y * s, 5);    // Nieten an Rand und Mitte
    g.fillStyle = rgba(LIT, 0.35); g.fillRect(0, 0.3 * s, s, 3);                            // Kantenlicht oben
    const ex = EMBLEM[0] * s, ew = (1 - EMBLEM[0]) * s, grd = g.createRadialGradient(ex + ew * 0.4, ew * 0.4, 0, ex + ew / 2, ew / 2, ew / 2);
    grd.addColorStop(0, '#e2b56a'); grd.addColorStop(0.7, '#9a6a2a'); grd.addColorStop(1, '#4a2e10');
    g.fillStyle = grd; g.fillRect(ex, 0, ew, ew);
    skullEmblem(g, ex + ew / 2, ew / 2, ew * 0.34, '#efe3bd', '#2a1a10');
  });
}
function paintFur(s) {                                                   // Fellrock: Strähnen hängen nach unten, Büschel am Saum
  return canvas(s, g => {
    vGrad(g, s, [[0, '#6b5a46'], [0.5, '#4f4134'], [1, '#2e251f']]);
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const x = rand(0, s), y = rand(-0.05, 1) * s, l = rand(10, 26), c = Math.random();
      g.strokeStyle = c < 0.5 ? `rgba(30,22,16,${rand(0.3, 0.7)})` : `rgba(${c < 0.85 ? '150,130,105' : '205,190,165'},${rand(0.25, 0.6)})`;
      g.lineWidth = rand(1.5, 3); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + rand(-4, 4), y + l / 2, x + rand(-6, 6), y + l); g.stroke();
    }
    band(g, s, 0, 0.12 * s, DEEP, 0.7);                                                     // Schatten unter dem Gürtel
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    g.beginPath(); g.moveTo(0, s); for (let x = 0; x <= s; x += 16) { g.lineTo(x + 8, s - rand(0.03, 0.09) * s); g.lineTo(x + 16, s); } g.fill();
    g.globalCompositeOperation = 'source-over';
  });
}
function paintRibs(s) {                                                  // u 0 = Wirbelsäule, 1 = Brustbein; zwischen den Rippen durchsichtig
  return canvas(s, g => {
    g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const y0 = (0.06 + k * 0.12) * s, th = (0.055 - k * 0.003) * s, drop = 0.16 * s, floating = k >= 5, end = floating ? 0.62 - (k - 5) * 0.12 : 0.88;
      const rib = (o, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(0, y0 + o); g.bezierCurveTo(0.35 * s, y0 + o + drop * 0.6, 0.6 * s, y0 + o + drop, end * s, y0 + o + drop * 0.8); g.stroke(); };
      rib(th * 0.25, th * 1.15, 'rgba(30,18,24,0.85)'); rib(0, th, '#b39d76'); rib(-th * 0.22, th * 0.45, '#f3e5bf'); rib(th * 0.3, th * 0.25, rgba(SHD, 0.7));
      if (!floating) {                                                   // Rippenknorpel: steigt zum Brustbein an, kühler Ton
        g.strokeStyle = '#8f9a9c'; g.lineWidth = th * 0.8; g.beginPath(); g.moveTo(end * s, y0 + drop * 0.8); g.quadraticCurveTo(0.95 * s, y0 + drop * 0.6, s, y0 + drop * 0.25); g.stroke();
      }
    }
    const grd = g.createLinearGradient(0.93 * s, 0, s, 0); grd.addColorStop(0, '#9a8562'); grd.addColorStop(0.5, '#f0e2bc'); grd.addColorStop(1, '#c9b48a');
    g.fillStyle = grd; g.beginPath(); g.roundRect(0.92 * s, 0.02 * s, 0.1 * s, 0.68 * s, 10); g.fill();                     // Brustbein
    g.fillStyle = '#c9b48a'; g.fillRect(0, 0, 0.05 * s, s);                                                                   // Wirbelsäule hinten
    for (let y = 8; y < s; y += 24) { g.fillStyle = 'rgba(40,25,15,0.7)'; g.fillRect(0, y, 0.05 * s, 3); }
  });
}
function paintWarLeather(s) {                                            // oben Wappenrock (rot, Schädel, Fransen), unten Leder für Riemen
  return canvas(s, g => {
    const h = s / 2;
    g.drawImage(paintLeather(s), 0, 0);
    for (let y = h + 20; y < s; y += 40) for (let x = 16; x < s; x += 40) rivet(g, x, y, 4);   // Nieten auf Riemen und Armschienen
    g.save(); g.beginPath(); g.rect(0, 0, s, h); g.clip();
    g.fillStyle = '#6a1c1c'; g.fillRect(0, 0, s, h); weave(g, s, 2, '0,0,0', '255,200,190', 0.6);
    vGrad(g, s, [[0, rgba(LIT, 0.15)], [0.5, rgba(DEEP, 0.45)]]);
    for (const x of [0.06, 0.94]) { g.fillStyle = '#b08a3e'; g.fillRect(x * s - 5, 0, 10, h); }
    skullEmblem(g, s / 2, h * 0.42, s * 0.15, '#e8dcb8', '#1a0e0a');
    g.restore();
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';                      // ausgefranster Saum des Wappenrocks
    g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= s; x += 20) { g.lineTo(x + 10, h - rand(10, 26)); g.lineTo(x + 20, h); } g.fill();
    g.globalCompositeOperation = 'source-over';
  });
}
function paintBlade(s) {                                                 // Klinge: u quer (Schneide links/rechts), v Heft → Spitze
  return canvas(s, g => {
    hGrad(g, s, [[0, '#eef0f4'], [0.08, '#aab0ba'], [0.3, '#8a909a'], [0.5, '#9ca1ab'], [0.7, '#80858f'], [0.92, '#a2a7b1'], [1, '#e4e8ee']]);   // Fase an beiden Schneiden
    strokes(g, s, 600, ['#9aa0aa', '#2c2d33', '#70747e'], { angle: -Math.PI / 2, jitter: 0.05, len: [0.05, 0.3], w: [1, 2], a: [0.06, 0.16] });   // Schleifspuren längs
    blotches(g, s, 12, 'rgba(110,55,25,0.35)', [0.02, 0.07]);                              // Rost
    blotches(g, s, 7, 'rgba(70,10,10,0.55)', [0.03, 0.09], [0, 0, 1, 0.35]);               // getrocknetes Blut zur Spitze hin
    vGrad(g, s, [[0, rgba(LIT, 0.12)], [0.6, rgba(SHD, 0)], [1, rgba(SHD, 0.35)]]);
    g.fillStyle = 'rgba(20,20,26,0.6)'; g.fillRect(0.47 * s, 0.25 * s, 0.06 * s, 0.75 * s);   // Hohlkehle
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';                  // Scharten in beiden Schneiden
    for (let i = 0; i < 14; i++) { const x = i % 2 ? s : 0, y = rand(0.05, 0.95) * s, d = rand(0.03, 0.07) * s, h = rand(8, 22); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + (i % 2 ? -d : d), y); g.lineTo(x, y + h); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  });
}
function paintGrip(s) {                                                  // Griff: dunkles Leder, schräg gewickelt
  return canvas(s, g => {
    vGrad(g, s, [[0, '#24160d'], [0.35, '#5a3a22'], [0.5, '#6b4628'], [0.75, '#3a2414'], [1, '#1c1009']]);
    g.strokeStyle = 'rgba(10,5,2,0.8)'; g.lineWidth = 3;
    for (let x = -s; x < s; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + s * 0.5, s); g.stroke(); }
    blotches(g, s, 6, 'rgba(70,10,10,0.4)', [0.03, 0.08]);
  });
}
function paintHorn(s) {                                                  // Horn und Stacheln: Röhre, u = Ansatz → Spitze
  return canvas(s, g => {
    hGrad(g, s, [[0, '#4a3826'], [0.5, '#a08860'], [1, '#efe2c0']]);
    vGrad(g, s, [[0, rgba(SHD, 0.5)], [0.35, rgba(LIT, 0.25)], [0.5, rgba(LIT, 0.1)], [1, rgba(SHD, 0.5)]]);
    for (let x = 8; x < s * 0.8; x += rand(10, 20)) { g.fillStyle = 'rgba(40,25,15,0.5)'; g.fillRect(x, 0, 2, s); }   // Wachstumsringe
    strokes(g, s, 200, ['#3a2a1a', '#fff2d0'], { angle: 0, len: [0.05, 0.2], w: [1, 2], a: [0.1, 0.25] });
  });
}
const warriorCells = (s, C) => { const c = paintLowAtlas(s, C); c[4] = paintFur(s); c[5] = paintIron(s); c[6] = paintGrip(s); c[7] = paintRibs(s); c[8] = paintWarLeather(s); c[9] = paintBlade(s); c[10] = paintHorn(s); return c; };

// ---------- Geometrie ----------
const RIB = { y0: 1.2, y1: 1.53 };
function ribcageGeo() {                                                  // Fass aus 7 Ringen × 12 Seiten; die Rippen macht die Textur
  const N = 12, rows = [];
  for (let r = 0; r <= 6; r++) {
    const t = 1 - r / 6, y = lerp(RIB.y0, RIB.y1, t);
    const rx = 0.125 + 0.03 * Math.sin(Math.PI * Math.min(1, t * 1.3)) - 0.035 * smooth(0.75, 1, t), rz = 0.095 + 0.02 * Math.sin(Math.PI * t), cz = 0.015 + 0.01 * t;
    rows.push(Array.from({ length: N + 1 }, (_, c) => { const a = c / N * 2 * Math.PI; return [Math.sin(a) * rx, y, cz - Math.cos(a) * rz]; }));
  }
  return gridGeo(rows, (r, c) => [1 - Math.abs(2 * c / N - 1), 1 - r / 6]);
}
const KILT = { yBot: 0.6, yTop: 1.08, g0: 0, g: () => 0,
  RX: [[0.6, 0.27], [0.8, 0.235], [0.95, 0.205], [1.08, 0.18]], RZ: [[0.6, 0.23], [0.8, 0.2], [0.95, 0.175], [1.08, 0.155]], CZ: [[0.6, -0.01], [1.08, 0]],
  fold: (y, a) => 0.06 * smooth(0.95, 0.6, y) * (0.5 + 0.5 * Math.sin(a * 5)) };
function warriorClothes(R, M) {
  const { root, torso, hips, armL, armR, legL, legR, sk } = R, onTorso = { weights: () => [[torso, 1]] };
  add(torso, ribcageGeo().translate(0, -1, 0), M.inner);                                                                      // Brustkorb
  add(torso, tube([[0, 0.02, -0.03], [0, 0.2, -0.05], [0, 0.4, -0.06], [0, 0.55, -0.035]], 0.017, 5, 5), M.bone);             // Wirbelsäule
  for (const s of [-1, 1]) add(torso, tube([[0, 0.54, 0.1], [s * 0.1, 0.56, 0.06], [s * 0.19, 0.555, -0.01]], 0.011, 3, 4), M.bone);   // Schlüsselbeine
  for (const [s, a] of [[1, armL], [-1, armR]]) add(a.shoulder, tube([[0, -0.01, 0], [0, -L.upper * 0.5, 0.005], [0, -L.upper + 0.01, 0]], 0.016, 3, 5, { oval: (v, tg, t) => v.multiplyScalar(1 + 0.5 * gauss(t, 0.15) + 0.4 * gauss(t - 1, 0.15)) }), M.bone);   // Oberarm
  for (const [s, lg] of [[1, legL], [-1, legR]]) {
    add(lg.hip, tube([[s * 0.01, -0.02, 0], [0, -L.thigh * 0.5, 0.01], [0, -L.thigh + 0.02, 0.005]], 0.019, 3, 5, { oval: (v, tg, t) => v.multiplyScalar(1 + 0.4 * gauss(t - 1, 0.15)) }), M.bone);   // Oberschenkel
    add(lg.knee, new THREE.SphereGeometry(0.022, 5, 3).scale(1, 1.1, 0.6), M.bone, 0, 0.005, 0.035);                          // Kniescheibe
    add(lg.knee, subUV(tube([[0, -0.15, 0.008], [0, -0.3, 0.01], [0, -L.shank + 0.05, 0.006]], 0.046, 2, 7, { taper: 0.15 }), 0, 0, 1, 0.7), M.pants);   // Beinschiene
    add(lg.knee, new THREE.TorusGeometry(0.05, 0.022, 4, 8).rotateX(Math.PI / 2), M.shell, 0, -0.15, 0.008);                  // Fellstulpe
  }
  for (const a of [armL, armR]) add(a.elbow, subUV(tube([[0, -0.07, -0.002], [0, -0.17, -0.002], [0, -L.fore + 0.03, -0.002]], 0.034, 2, 6, { taper: -0.15 }), 0, 0, 1, 0.5), M.accent);   // Armschienen
  // Hörnerhelm (Schädelraum): Kalotte bis zur Braue, Nasenschutz, zwei Hörner
  add(sk, subUV(new THREE.SphereGeometry(0.1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(0.82, 0.95, 1.04), 0, 0, 1, 0.7), M.pants, 0, 0.004, -0.004);
  add(sk, subUV(new THREE.BoxGeometry(0.014, 0.055, 0.008), 0, 0, 1, 0.7), M.pants, 0, -0.035, 0.1);
  for (const s of [-1, 1]) add(sk, tube([[s * 0.07, 0.035, -0.005], [s * 0.125, 0.055, 0], [s * 0.16, 0.1, 0.025], [s * 0.165, 0.165, 0.07]], 0.02, 6, 5, { taper: 0.92 }), M.satin);
  // Schulterplatten: drei Schalen übereinander + Stacheln; links größer (Barbar)
  for (const [s, a, k] of [[1, armL, 1.25], [-1, armR, 1]]) {
    const p = joint(a.shoulder, s * 0.015, 0.035, 0); p.rotation.z = -s * 0.3;
    for (let i = 0; i < 3; i++) add(p, subUV(new THREE.SphereGeometry(0.105 * k * (1 - i * 0.1), 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.75, 1.05), 0, 0, 1, 0.7), M.pants, s * 0.012 * i, -0.04 * k * i, 0);
    for (const [dz, h] of [[-0.045, 0.1], [0.01, 0.14], [0.06, 0.09]]) add(p, new THREE.ConeGeometry(0.018 * k, h * k, 5).translate(0, h * k / 2, 0), M.satin, s * 0.03, 0.065 * k, dz).rotation.z = -s * 0.35;
  }
  // Kreuzgurt mit Schädelplatte, Gürtel mit Schnalle
  for (const s of [-1, 1]) add(torso, subUV(tube([[s * 0.12, 0.555, 0.06], [s * 0.08, 0.48, 0.13], [0, 0.34, 0.152], [-s * 0.08, 0.2, 0.15], [-s * 0.13, 0.08, 0.13]], 0.011, 6, 4), 0, 0, 1, 0.5), M.accent);
  add(torso, subUV(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 10).rotateX(Math.PI / 2), ...EMBLEM), M.pants, 0, 0.34, 0.16);
  const belt = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; belt.push([Math.sin(a) * 0.185, 1.07 + 0.01 * Math.cos(a), Math.cos(a) * 0.16]); }
  add(root, subUV(tube(belt, 0.022, 12, 4, { closed: true, oval: v => { v.y *= 1.6; } }), 0, 0, 1, 0.5), M.accent, 0, 0, 0, { weights: () => [[torso, 0.5], [hips, 0.5]] });
  add(hips, subUV(new THREE.BoxGeometry(0.075, 0.065, 0.02), ...EMBLEM), M.pants, 0, 0.07, 0.19);
  // Fellrock (geht mit den Beinen) + Wappenrock vorn
  add(root, mirrorU(garment(KILT, [14, 4])), M.shell, 0, 0, 0, { weights: robeWeights(R) });
  add(hips, subUV(lowPanel(0.2, 0.42, 3, -0.2), 0, 0.5, 1, 1), M.accent, 0, 0.075, 0.2).rotation.x = -0.05;
}
function warriorWeapon(armR, armL, M, C) {
  // Zweihand-Schwert: Griff durch die rechte Faust, breite Eisenplatte mit schräger Spitze. Die flache Seite zeigt zur Kamera
  // (auf der Schulter und beim Schlag von vorn) – lesbarer als physikalisch korrekt, wie bei Vanilla
  const w = joint(armR.wrist, 0.018, -0.088, 0.004); w.rotation.x = C.weaponX;
  add(w, tube([[0, -0.3, 0], [0, -0.1, 0.002], [0, 0.1, 0]], 0.022, 2, 5), M.woodTube);                                     // Griff (zwei Hände)
  add(w, subUV(new THREE.SphereGeometry(0.035, 5, 3), 0, 0, 1, 0.7), M.pants, 0, -0.32, 0);                                   // Knauf
  add(w, subUV(new THREE.BoxGeometry(0.32, 0.05, 0.07), 0, 0, 1, 0.7), M.pants, 0, 0.12, 0);                                  // Parierstange
  const b = new THREE.Shape(); b.moveTo(-0.13, 0.15); b.lineTo(0.13, 0.15); b.lineTo(0.125, 1.45); b.lineTo(0.05, 1.66); b.lineTo(-0.125, 1.55); b.closePath();
  const blade = new THREE.ExtrudeGeometry(b, { depth: 0.045, bevelEnabled: false }).translate(0, 0, -0.0225);
  setUV(blade, (x, y) => [(x + 0.13) / 0.26, (y - 0.15) / 1.51]);
  add(w, blade, M.sleeve);
  return { staff: w, crystal: joint(w, 0, 1.5, 0), crystalGlow: null };   // crystal = Spitze (Treffer-Effekte, Spiel: anchors.crystal)
}

// ---------- Effekte: Wirbel um die Figur, Risse, Staub, Schockwelle am Boden ----------
function fxTex(kind) {
  return toTex(canvas(256, (g, s) => {
    const c = s / 2;
    if (kind === 'ring') {                                               // Donnerknall: heller Ring mit Blitzzacken
      g.filter = 'blur(4px)'; g.strokeStyle = 'rgba(110,160,255,0.9)'; g.lineWidth = 16; g.beginPath(); g.arc(c, c, c * 0.82, 0, 7); g.stroke(); g.filter = 'none';
      g.strokeStyle = '#eef6ff'; g.lineWidth = 3; g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.1) { const r = c * (0.82 + rand(-0.05, 0.05)); a ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + r, c); }
      g.stroke();
    } else if (kind === 'dust') {                                        // Staubring
      const grd = g.createRadialGradient(c, c, 0, c, c, c); grd.addColorStop(0, 'rgba(180,150,110,0)'); grd.addColorStop(0.6, 'rgba(180,150,110,0.15)'); grd.addColorStop(0.8, 'rgba(200,175,135,0.55)'); grd.addColorStop(1, 'rgba(180,150,110,0)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
    } else if (kind === 'crack') {                                       // Bodenrisse: dunkler Krater, Risse mit glühendem Kern
      const grd = g.createRadialGradient(c, c, 0, c, c, c * 0.35); grd.addColorStop(0, 'rgba(20,12,8,0.85)'); grd.addColorStop(1, 'rgba(20,12,8,0)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s); g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const pts = [[c, c]]; let a = i / 9 * Math.PI * 2 + rand(-0.3, 0.3), x = c, y = c;
        for (let k = 0; k < 6; k++) { a += rand(-0.5, 0.5); x += Math.cos(a) * c * 0.15; y += Math.sin(a) * c * 0.15; pts.push([x, y]); }
        for (const [w, col] of [[7, 'rgba(25,15,10,0.9)'], [2.5, 'rgba(255,130,40,0.95)']]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); }
      }
    } else if (kind === 'slash') {                                       // Schnitt: heller Streifen, Enden laufen aus
      const grd = g.createLinearGradient(0, 0, 0, s); grd.addColorStop(0.3, 'rgba(120,170,255,0)'); grd.addColorStop(0.47, 'rgba(170,210,255,0.9)'); grd.addColorStop(0.5, 'rgba(255,255,255,1)'); grd.addColorStop(0.53, 'rgba(170,210,255,0.9)'); grd.addColorStop(0.7, 'rgba(120,170,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
      g.globalCompositeOperation = 'destination-in'; const h = g.createLinearGradient(0, 0, s, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.25, '#000'); h.addColorStop(0.8, '#000'); h.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = h; g.fillRect(0, 0, s, s); g.globalCompositeOperation = 'source-over';
    } else if (kind === 'star') {                                        // Wurfstern: 4 Zacken, Stahl mit Lichtkante
      g.translate(c, c); g.fillStyle = '#3a3d46';
      g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? c * 0.28 : c * 0.95; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
      g.strokeStyle = '#c8ccd6'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#0a0a0e'; g.beginPath(); g.arc(0, 0, c * 0.14, 0, 7); g.fill();
      g.setTransform(1, 0, 0, 1, 0, 0);
    } else if (kind === 'kunai') {                                       // Wurfmesser, Spitze nach unten, dahinter ein heller Zug
      const grd = g.createLinearGradient(0, 0, 0, s); grd.addColorStop(0, 'rgba(190,150,255,0)'); grd.addColorStop(0.55, 'rgba(190,150,255,0.6)'); g.fillStyle = grd; g.fillRect(c - 6, 0, 12, s * 0.62);
      g.fillStyle = '#2a2a30'; g.fillRect(c - 7, s * 0.5, 14, s * 0.18);
      g.fillStyle = '#b8bcc6'; g.beginPath(); g.moveTo(c - 18, s * 0.68); g.lineTo(c + 18, s * 0.68); g.lineTo(c, s * 0.98); g.closePath(); g.fill();
    } else if (kind === 'smoke') {                                       // Rauchwolke: weiche graue Ballen
      for (let i = 0; i < 9; i++) { const x = c + rand(-0.35, 0.35) * s, y = c + rand(-0.35, 0.35) * s, r = rand(0.18, 0.32) * s, grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(70,68,80,0.75)'); grd.addColorStop(1, 'rgba(70,68,80,0)'); g.fillStyle = grd; g.fillRect(0, 0, s, s); }
    } else if (kind === 'arc') {                                         // Sichel: Bauch zeigt nach unten im Canvas = nach vorn (+z)
      g.lineCap = 'round';
      for (const [w, col, blur] of [[26, 'rgba(110,160,255,0.55)', 6], [10, 'rgba(200,225,255,0.95)', 2], [3, '#ffffff', 0]]) {
        g.filter = `blur(${blur}px)`; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(c, c * 0.45, c * 0.8, 0.35, Math.PI - 0.35); g.stroke();
      }
      g.filter = 'none';
    } else {                                                             // Wirbel: Windstreifen rundherum
      for (let i = 0; i < 16; i++) {
        const y = rand(0.15, 0.85) * s, x0 = rand(0, s), len = rand(0.3, 0.7) * s, grd = g.createLinearGradient(x0, 0, x0 + len, 0);
        grd.addColorStop(0, 'rgba(255,240,220,0)'); grd.addColorStop(0.7, 'rgba(255,240,220,0.8)'); grd.addColorStop(1, 'rgba(255,240,220,0)');
        g.strokeStyle = grd; g.lineWidth = rand(2, 7); g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + len, y + rand(-6, 6)); g.stroke();
      }
    }
  }));
}
const FX_Y = new THREE.Vector3(0, 1, 0), FX_QV = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), FX_QT = new THREE.Quaternion();
function makeWarriorFx() {                                               // Bodenquads als kleiner Pool je Art; schedule() für verzögerte Effekte
  const group = new THREE.Group(), SPEC = {
    crack: { life: 1.6, s0: 2.4, s1: 2.6, fadeAt: 0.6, n: 10 }, dust: { life: 0.55, s0: 0.6, s1: 3.2, fadeAt: 0, n: 12 }, ring: { life: 0.6, s0: 0.6, s1: 9, fadeAt: 0.3, n: 3 },
    slash: { life: 0.45, s0: 1, s1: 1.08, fadeAt: 0.25, n: 16 }, arc: { life: 0.6, s0: 1, s1: 1.6, fadeAt: 0.35, n: 4 },
    star: { life: 0.6, s0: 0.35, s1: 0.35, fadeAt: 0.85, n: 10 }, kunai: { life: 0.25, s0: 0.55, s1: 0.55, fadeAt: 0.95, n: 10 }, smoke: { life: 1.4, s0: 1.4, s1: 3.4, fadeAt: 0.35, n: 14 } };
const FX_NORMAL = ['crack', 'star', 'kunai', 'smoke'];
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), pools = {}, queue = [];
  for (const k of Object.keys(SPEC)) {
    const map = fxTex(k);
    pools[k] = Array.from({ length: SPEC[k].n }, () => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: FX_NORMAL.includes(k) ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; group.add(m); return { m, age: -1, k: 1, sx: 1, sz: 1, v: null, spin: 0 };
    });
  }
  let last = null;
  return { group,
    // o: yaw (Drehung um y), vert (senkrecht stellen), tilt (Drehung in der Ebene), sx/sz (Länge/Breite), v (Geschwindigkeit, Welt)
    spawn(kind, x, y, z, k = 1, o = {}) {
      const pool = pools[kind], p = pool.find(q => q.age < 0) || pool.reduce((a, b) => (a.age > b.age ? a : b));
      p.m.position.set(x, y + 0.012 + (kind === 'ring' ? 0.006 : 0) + pool.indexOf(p) * 0.0004, z);
      const q = p.m.quaternion.setFromAxisAngle(FX_Y, o.yaw ?? rand(0, 7));
      if (o.vert) q.multiply(FX_QV); if (o.tilt) q.multiply(FX_QT.setFromAxisAngle(FX_Y, o.tilt));
      p.m.visible = true; p.age = 0; p.k = k; p.sx = o.sx ?? 1; p.sz = o.sz ?? 1; p.v = o.v ? o.v.clone() : null; p.spin = o.spin || 0;
    },
    schedule(ms, fn) { queue.push({ at: (last ?? 0) + ms, fn }); },
    update(time) {
      const dt = last === null ? 0 : Math.min(0.1, (time - last) / 1000); last = time;
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= time) { const q = queue.splice(i, 1)[0]; q.fn(); }
      for (const k of Object.keys(pools)) for (const p of pools[k]) {
        if (p.age < 0) continue;
        const sp = SPEC[k], t = (p.age += dt) / sp.life;
        if (t >= 1) { p.m.visible = false; p.age = -1; continue; }
        const sc = lerp(sp.s0, sp.s1, 1 - (1 - t) ** 2) * p.k; p.m.scale.set(sc * p.sx, 1, sc * p.sz); p.m.material.opacity = 1 - smooth(sp.fadeAt, 1, t);
        if (p.v) p.m.position.addScaledVector(p.v, dt);
        if (p.spin) p.m.rotateOnWorldAxis(FX_Y, p.spin * dt);
      }
    } };
}
function warriorAddons(R) {
  const mat = new THREE.MeshBasicMaterial({ map: fxTex('swirl'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true });   // sonst 2 Draw Calls pro Schleier
  R.swirl = [[0.95, 0.55, 0.5], [1.15, 1.15, 0.6]].map(([r, y, h]) => { const m = add(R.root, new THREE.CylinderGeometry(r, r * 0.9, h, 24, 1, true), mat, 0, y, 0); m.userData.keep = true; m.visible = false; return m; });
  R.fx = makeWarriorFx();
}
const tmpV = new THREE.Vector3();
// Treffer-Zeitpunkte: Dauer in ms und Anteile, an denen die Klinge trifft. Wirbelwind läuft durch (Spiel tickt selbst).
const WAR_HITS = { cast: [1200, [0.24, 0.6]], smash: [1300, [0.47]], thunderclap: [1500, [0.42]] };
WAR_HITS.atk1 = WAR_HITS.cast; WAR_HITS.atk2 = WAR_HITS.smash;          // Schwert: Attacke 1 = Kombo, Attacke 2 = Smash
function warriorAnimate(R, time) {                                      // this = Charakter (Aufruf über SKIN.extra)
  const C = this;
  if (R.swirl) {
    const ww = R.action === 'whirlwind';
    R.swirlK = lerp(R.swirlK || 0, ww ? 1 : 0, 0.15);
    R.swirl.forEach((m, i) => { m.material.opacity = R.swirlK * 0.75; m.visible = R.swirlK > 0.02; m.rotation.y = -time / (i ? 70 : 95); });
  }
  if (C.tick) C.tick(R, time);
  const cyc = (C.hits || WAR_HITS)[R.action];
  if (cyc) {
    const k = wave(R.actTime, cyc[0]), prev = R.fxAct === R.action ? R.fxK : k;
    cyc[1].forEach((at, i) => {
      if (!(prev < at && k >= at)) return;
      R.root.updateMatrixWorld(true); R.root.getWorldPosition(tmpV); const y = tmpV.y;
      if (C.hitFx) return C.hitFx(R, R.action, i, y, time);
      if (R.action === 'thunderclap') { R.fx.spawn('ring', tmpV.x, y, tmpV.z); R.fx.spawn('dust', tmpV.x, y, tmpV.z); }
      else {
        R.crystal.getWorldPosition(tmpV);                                  // Schwertspitze
        if (R.action === 'smash') { R.fx.spawn('crack', tmpV.x, y, tmpV.z); R.fx.spawn('dust', tmpV.x, y, tmpV.z); }
      }
      if (R.onHit) R.onHit(R.action, tmpV.x, tmpV.z);
    });
    R.fxK = k;
  }
  R.fxAct = R.action;
  R.fx.update(time);
}

// ---------- Bewegung: wuchtig wie Diablo-3-Barbar / Tryndamere ----------
// Ausholen langsam, Schlag in wenigen Bildern, danach Nachschwingen und kurz Stehenbleiben (Trefferpause).
// wpn kippt die Klinge im Handgelenk (0 = Ruhewinkel). Die Werte sind aus der Gelenkkette nachgerechnet, Fehler 3–8°.
const mix = (t, pose, w) => { for (const k in pose) t[k] = lerp(t[k] ?? 0, pose[k], w); };
const CARRY = { rSh: -0.4, rShZ: -0.15, rEl: -2.3, wpn: -0.13 };                       // Schwert auf der Schulter, Klinge nach hinten oben
const STAND = { ...CARRY, lean: 0.18, headX: 0.15, lKnee: 0.25, rKnee: 0.25, lHip: -0.15, rHip: -0.05, hipsY: 0.965, lSh: 0.1, lShZ: 0.18, lEl: -0.5, gripL: 1, jaw: 0.1, twist: 0 };
const W_POSES = {
  aWind: { rSh: -2.6, rShZ: -0.55, rEl: -0.9, wpn: 0.05, twist: 0.55, lean: -0.1, lSh: -1.6, lShZ: -0.2, lEl: -1.3, hipsY: 0.98 },
  aHit: { rSh: -0.45, rShZ: 0.55, rEl: -0.15, wpn: 1.06, twist: -0.65, lean: 0.4, hipsY: 0.9, lKnee: 0.4, rKnee: 0.2, lHip: -0.45, rHip: 0.15, lSh: 0.3, lShZ: 0.3, lEl: -0.4, jaw: 0.35 },
  bHit: { rSh: -1.35, rShZ: -1.25, rEl: -0.15, wpn: 1.34, twist: 0.75, lean: 0.25, hipsY: 0.92, lSh: -0.6, lShZ: 0.6, lEl: -0.8, lKnee: 0.3, rKnee: 0.35, jaw: 0.3 },
  smashUp: { hipsY: 1.28, lKnee: 0.9, rKnee: 0.7, lHip: -0.6, rHip: -0.2, rSh: -3.0, rShZ: -0.1, rEl: -0.7, wpn: -0.1, lSh: -3.0, lShZ: 0.1, lEl: -0.7, lean: -0.35, headX: -0.2, jaw: 0.4 },
  smashHit: { hipsY: 0.8, lKnee: 1.0, rKnee: 0.6, lHip: -0.85, rHip: 0.2, rSh: -0.55, rShZ: 0.1, rEl: -0.05, wpn: 0.95, lSh: -0.55, lShZ: -0.1, lEl: -0.05, lean: 0.75, headX: 0.35, jaw: 0.6 },
  clapUp: { hipsY: 1.32, lKnee: 1.1, rKnee: 1.1, lHip: -0.7, rHip: -0.7, rSh: -2.9, rEl: -0.4, wpn: 0, lSh: -2.9, lEl: -0.4, lShZ: 0.2, rShZ: -0.2, lean: -0.2, headX: -0.25 },
  clapDown: { hipsY: 0.8, lKnee: 1.05, rKnee: 1.05, lHip: -0.75, rHip: -0.55, rSh: -0.35, rShZ: 0.05, rEl: -0.05, wpn: 1.35, lSh: 0.3, lShZ: 0.9, lEl: -0.3, lean: 0.55, headX: 0.35, jaw: 0.6, gripL: 1 },
};
const WAR_MOVES = {
  freq: 4.6, blend: 18, lag: { head: 7, arm: 6 }, stance: 0.13, rigidWeapon: true, weaponX: 1.9,
  idle(t, ph) {                                                          // geduckt, lauernd, schweres Atmen
    const b = Math.sin(ph * 0.9);
    Object.assign(t, STAND, { hipsY: 0.965 + b * 0.006, lean: 0.18 + b * 0.025, headZ: Math.sin(ph * 0.4) * 0.05, rSh: CARRY.rSh + b * 0.03 });
  },
  gait(j, t, ph) {                                                       // Sturmlauf, Schwert auf der Schulter federt mit
    const sw = Math.sin(ph), cw = Math.cos(ph);
    Object.assign(t, CARRY, { lHip: -sw * 0.65, rHip: sw * 0.65, lKnee: Math.max(0, sw) * 1.0 + 0.12, rKnee: Math.max(0, -sw) * 1.0 + 0.12, lean: 0.32, hipsY: 0.94 + Math.abs(cw) * 0.06,
      sway: sw * 0.08, twist: sw * 0.12, lSh: sw * 0.8, lEl: -1.1, lShZ: 0.15, gripL: 1, headX: 0.2, rSh: CARRY.rSh + Math.abs(cw) * 0.06 });
  },
  cast(t, time) {                                                        // Kombo: schräg von rechts oben, dann Rückhand waagrecht
    const k = wave(time, 1200), P = W_POSES;
    Object.assign(t, STAND);
    mix(t, P.aWind, smooth(0, 0.16, k)); mix(t, P.aHit, smooth(0.16, 0.24, k)); mix(t, P.bHit, smooth(0.46, 0.6, k)); mix(t, STAND, smooth(0.8, 1, k));
  },
  channel(t, time) {                                                     // Kampfschrei: Schwert hoch, Kopf zurück, bebt
    const sh = Math.sin(time / 35) * 0.02;
    Object.assign(t, { rSh: -2.8, rShZ: -0.25, rEl: -0.2, wpn: 1.1, lSh: -0.5, lShZ: 0.9, lEl: -1.6, gripL: 1, headX: -0.5, headZ: sh, jaw: 0.65, lean: -0.2 + sh,
      hipsY: 0.95, lKnee: 0.3, rKnee: 0.3, lHip: -0.2, rHip: 0.1 });
  },
  whirlwind(t, time) {                                                   // 2,6 Umdrehungen pro Sekunde, Klinge weit draußen
    Object.assign(t, { spinY: time / 1000 * Math.PI * 2 * 2.6, rSh: -0.25, rShZ: -1.45, rEl: -0.05, wpn: 1.06, lSh: -0.3, lShZ: 0.5, lEl: -1.2, gripL: 1, lean: -0.05,
      hipsY: 0.93 + Math.abs(Math.sin(time / 120)) * 0.02, lKnee: 0.35, rKnee: 0.35, headX: 0.1 });
  },
  smash(t, time) {                                                       // Sprung, beidhändig über den Kopf, Aufschlag bei 47 %, Klinge steckt kurz im Boden
    const k = wave(time, 1300), P = W_POSES;
    Object.assign(t, STAND);
    mix(t, P.smashUp, smooth(0, 0.4, k) * (1 - smooth(0.4, 0.47, k))); mix(t, P.smashHit, smooth(0.4, 0.47, k) * (1 - smooth(0.78, 1, k)));
  },
  thunderclap(t, time) {                                                 // Sprung, Landung mit Stampfer und Klinge in den Boden bei 42 %
    const k = wave(time, 1500), P = W_POSES;
    Object.assign(t, STAND);
    mix(t, P.clapUp, smooth(0, 0.3, k) * (1 - smooth(0.3, 0.42, k))); mix(t, P.clapDown, smooth(0.32, 0.42, k) * (1 - smooth(0.75, 1, k)));
  },
};
const WARRIOR = { ...SKIN, ...WAR_MOVES, id: 'warrior', name: 'Skelett-Krieger', atlasCells: warriorCells, clothes: warriorClothes, weapon: warriorWeapon, addons: warriorAddons,
  eye: 0xff4a2a, eyeCol: [3, 0.55, 0.25], animate: warriorAnimate };
WARRIOR.atk1 = WAR_MOVES.cast; WARRIOR.atk2 = WAR_MOVES.smash;

// =====================================================================
// Krieger-Waffen: gleicher Körper, je eigene Waffe, Haltung, 2 Attacken und eine Eigenschaft.
// Attacke 1 / 2 = Aktionen 'atk1' / 'atk2'. hits: Dauer (ms) und Anteile, an denen getroffen wird.
// Geworfenes (Axt, Anker) hängt an einem Gelenk unter root und folgt sonst der Hand (follow).
// Spiel: R.onHit(kind, x, z, i) wie beim Schwert; kind z. B. 'atk1', 'nachbeben', 'anker'.
// =====================================================================
const wGlowMat = rgb => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb) }); m.userData = { cell: 1, kind: 'glow' }; return m; };
const BLOOD = wGlowMat([2.4, 0.25, 0.12]), SOUL = wGlowMat([0.35, 2.2, 1.5]);
const _inv = new THREE.Matrix4(), _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _h = new THREE.Vector3(), _d = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function follow(R, j, hold) {                                            // Gelenk unter root auf die Lage eines Haltepunkts setzen
  _inv.copy(R.root.matrixWorld).invert(); _m4.multiplyMatrices(_inv, hold.matrixWorld); _m4.decompose(j.position, j.quaternion, j.scale);
}
const localPos = (R, obj, out) => R.root.worldToLocal(obj.getWorldPosition(out));
const groundAt = (R, lx, lz, out = new THREE.Vector3()) => R.root.localToWorld(out.set(lx, 0, lz));   // lokaler Punkt am Boden → Welt
const easeOut = u => 1 - (1 - u) ** 2, seg = (k, a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));
const rootOf = j => { while (j.parent) j = j.parent; return j; };
const glowOf = R => R.glowMesh || (R.glowMesh = R.root.children.find(o => o.isSkinnedMesh && o.material.isMeshBasicMaterial));
const warIdle = carry => function (t, ph) {
  const b = Math.sin(ph * 0.9);
  Object.assign(t, STAND, carry, { hipsY: 0.965 + b * 0.006, lean: 0.18 + b * 0.025, headZ: Math.sin(ph * 0.4) * 0.05 });
  t.rSh += b * 0.03; t.lSh += b * 0.02;
};
const warGait = (carry, swing = {}) => function (j, t, ph) {
  WAR_MOVES.gait(j, t, ph); Object.assign(t, carry);
  const sw = Math.sin(ph); for (const k in swing) t[k] += sw * swing[k];
};
const WEAPON_BASE = { ...WARRIOR, atlasKey: 'warrior', addons(R) { R.fx = makeWarriorFx(); } };

// ---------- 1 · Schlachterpaar: zwei Bartäxte (Furor / Barbar) ----------
// Attacke 1 Raserei: 4 schnelle Hiebe, rechts-links im Wechsel.
// Attacke 2 Axtwurf: linke Axt fliegt drehend 8 m geradeaus und kommt zurück, trifft auf dem Hin- und Rückweg.
// Eigenschaft Blutrausch: jeder Treffer +1 Stapel (max. 5, verfällt nach 4 s ohne Treffer), je Stapel +6 % Angriffstempo.
//   Sichtbar: Augen und Axtschneiden glühen mit jedem Stapel stärker.
function axe(p, M, s) {                                                  // Stiel entlang +y, Blatt nach s·x, Griff bei y 0
  add(p, tube([[0, -0.13, 0], [0, 0.25, 0.003], [0, 0.62, 0]], 0.019, 2, 5), M.woodTube);
  add(p, subUV(new THREE.SphereGeometry(0.03, 5, 3), 0, 0, 1, 0.7), M.pants, 0, -0.14, 0);
  add(p, subUV(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), 0, 0, 1, 0.7), M.pants, 0, 0.46, 0);           // Tülle
  const sh = new THREE.Shape(); sh.moveTo(0.02, 0.54); sh.lineTo(0.1, 0.58); sh.quadraticCurveTo(0.19, 0.67, 0.27, 0.68);
  sh.quadraticCurveTo(0.34, 0.46, 0.25, 0.24); sh.lineTo(0.17, 0.28); sh.quadraticCurveTo(0.09, 0.38, 0.02, 0.39); sh.closePath();
  const blade = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -0.011);
  setUV(blade, (x, y) => [0.5 + x / 0.56, (y - 0.24) / 0.44]); blade.scale(s, 1, 1);
  add(p, blade, M.sleeve);
  const edge = []; for (let i = 0; i <= 5; i++) { const t = i / 5, u = 1 - t; edge.push([s * (u * u * 0.272 + 2 * u * t * 0.345 + t * t * 0.252), u * u * 0.68 + 2 * u * t * 0.46 + t * t * 0.24, 0]); }
  add(p, tube(edge, 0.007, 6, 3), BLOOD);                                                                       // Schneide glüht (Blutrausch)
  add(p, new THREE.ConeGeometry(0.022, 0.13, 5).rotateZ(s * Math.PI / 2).translate(-s * 0.09, 0.47, 0), M.satin);  // Dorn hinten
}
function axesWeapon(armR, armL, M, C) {
  const w = joint(armR.wrist, 0.018, -0.088, 0.004); w.rotation.x = C.weaponX;
  axe(w, M, -1);
  const holdL = joint(armL.wrist, -0.018, -0.088, 0.004); holdL.rotation.x = C.weaponX;
  const axL = joint(rootOf(armL.wrist)); axe(axL, M, 1);                // fliegt frei, sonst folgt sie holdL
  return { staff: w, holdL, axL, crystal: joint(w, 0, 0.46, 0), crystalGlow: null };
}
const AX_CARRY = { rSh: -0.2, rShZ: -0.18, rEl: -0.7, wpn: 1.35, lSh: -0.2, lShZ: 0.18, lEl: -0.7, wpnL: 1.35, gripL: 1 };
const AX_P = {
  rWind: { rSh: -2.7, rShZ: -0.35, rEl: -1.1, wpn: -0.6, twist: 0.35, lean: 0.05 },
  rHit: { rSh: -0.7, rShZ: 0.25, rEl: -0.15, wpn: 0.2, twist: -0.4, lean: 0.4, hipsY: 0.92, jaw: 0.35 },
  lWind: { lSh: -2.7, lShZ: 0.35, lEl: -1.1, wpnL: -0.6, twist: -0.35, lean: 0.05 },
  lHit: { lSh: -0.7, lShZ: -0.25, lEl: -0.15, wpnL: 0.2, twist: 0.4, lean: 0.4, hipsY: 0.92, jaw: 0.35 },
  throwWind: { lSh: -2.9, lShZ: 0.5, lEl: -1.6, wpnL: -0.4, twist: -0.6, lean: -0.15, rSh: -0.9, rShZ: -0.2, rEl: -0.6, headX: -0.1 },
  throwRel: { lSh: -1.6, lShZ: -0.2, lEl: -0.05, wpnL: 0.3, twist: 0.45, lean: 0.35, hipsY: 0.93, lKnee: 0.45, rKnee: 0.15, lHip: -0.5, jaw: 0.4 },
  catch: { lSh: -1.4, lShZ: 0.3, lEl: -0.4, twist: 0.1, lean: 0.15 },
};
const AX_THROW = { dur: 1400, out: [0.25, 0.5], back: [0.5, 0.78], reach: 8 };
const WAR_AXES = { ...WEAPON_BASE, id: 'warAxes', name: 'Krieger · Schlachterpaar', weapon: axesWeapon,
  idle: warIdle(AX_CARRY), gait: warGait(AX_CARRY, { rSh: -0.5, lSh: 0.5 }),
  hits: { atk1: [900, [0.14, 0.39, 0.64, 0.89]], atk2: [AX_THROW.dur, [0.5]] },
  atk1(t, time) {                                                        // Raserei: 4 Hiebe à 225 ms, rechts-links
    const k = wave(time, 900), i = Math.min(3, Math.floor(k * 4)), u = k * 4 - i, L = i % 2, P = AX_P;
    Object.assign(t, STAND, AX_CARRY);
    const wind = L ? P.lWind : P.rWind, hit = L ? P.lHit : P.rHit;
    mix(t, wind, smooth(0, 0.42, u) * (1 - smooth(0.42, 0.56, u))); mix(t, hit, smooth(0.42, 0.56, u) * (1 - smooth(0.85, 1, u) * (i < 3 ? 1 : 0)));
    if (i === 3) mix(t, AX_CARRY, smooth(0.8, 1, u));
  },
  atk2(t, time) {                                                        // Axtwurf mit links, Fangen
    const k = wave(time, AX_THROW.dur), P = AX_P;
    Object.assign(t, STAND, AX_CARRY);
    mix(t, P.throwWind, smooth(0, 0.2, k) * (1 - smooth(0.2, 0.27, k)));
    mix(t, P.throwRel, smooth(0.2, 0.27, k) * (1 - smooth(0.45, 0.7, k)));
    mix(t, P.catch, smooth(0.6, 0.76, k) * (1 - smooth(0.82, 1, k)));
  },
  tick(R, time) {
    R.root.updateMatrixWorld(true);
    const T = AX_THROW, k = R.action === 'atk2' ? wave(R.actTime, T.dur) : 0;
    const out = seg(k, ...T.out), back = seg(k, ...T.back), flying = k > T.out[0] && k < T.back[1];
    if (!flying) follow(R, R.axL, R.holdL);
    else {
      localPos(R, R.holdL, _h); const tgt = _d.set(-0.15, 1.15, T.reach);
      if (k < T.back[0]) _p.lerpVectors(_h, tgt, easeOut(out)); else _p.lerpVectors(tgt, _h, back * back);
      _p.y += Math.sin(Math.PI * (k < T.back[0] ? out : 1 - back)) * 0.25;
      R.axL.position.copy(_p); R.axL.rotation.set(-time / 38, 0, -0.35); R.axL.scale.setScalar(1);
    }
    if (time - (R.rageT ?? -1e9) > 4000) R.rage = 0;                    // Blutrausch verfällt
    R.rageGlow = lerp(R.rageGlow ?? 1, 1 + 0.32 * (R.rage || 0), 0.12);
    glowOf(R).material.color.setScalar(R.rageGlow);
  },
  hitFx(R, action, i, y, time) {
    R.rage = Math.min(5, (R.rage || 0) + 1); R.rageT = time;
    if (action === 'atk2') { groundAt(R, -0.15, AX_THROW.reach, tmpV); R.fx.spawn('dust', tmpV.x, y, tmpV.z, 0.45); }
    else (i % 2 ? R.axL : R.crystal).getWorldPosition(tmpV);
    if (R.onHit) R.onHit(action, tmpV.x, tmpV.z, i);
  },
};
WAR_AXES.cast = WAR_AXES.atk1; WAR_AXES.smash = WAR_AXES.atk2; WAR_AXES.hits.cast = WAR_AXES.hits.atk1; WAR_AXES.hits.smash = WAR_AXES.hits.atk2;

// ---------- 2 · Grabhammer: Zweihand-Hammer mit Eisenkopf (Waffen-Krieger / Tauren) ----------
// Attacke 1 Erdspalter: Schlag über Kopf, eine Spalte läuft 5 Risse weit (je 1,6 m) nach vorn.
// Attacke 2 Rundschlag: eine volle Drehung mit ausgestrecktem Hammer, trifft alles im Kreis (ca. 3 m).
// Eigenschaft Nachbeben: 1 s nach jedem Treffer bebt dieselbe Stelle noch einmal (50 % Schaden).
function hammerWeapon(armR, armL, M, C) {
  const w = joint(armR.wrist, 0.018, -0.088, 0.004); w.rotation.x = C.weaponX;
  add(w, tube([[0, -0.36, 0], [0, 0.4, 0.004], [0, 1.18, 0]], 0.024, 3, 5), M.woodTube);                      // Stiel
  add(w, subUV(new THREE.SphereGeometry(0.04, 5, 3), 0, 0, 1, 0.7), M.pants, 0, -0.37, 0);
  for (const y of [0.15, 0.95]) add(w, subUV(new THREE.CylinderGeometry(0.032, 0.032, 0.06, 6), 0, 0, 1, 0.7), M.pants, 0, y, 0);   // Eisenringe
  add(w, subUV(new THREE.BoxGeometry(0.27, 0.27, 0.56), ...EMBLEM), M.pants, 0, 1.27, 0);                      // Kopf, Schädelwappen auf jeder Seite
  for (const z of [-1, 1]) add(w, subUV(new THREE.BoxGeometry(0.31, 0.31, 0.05), 0, 0, 1, 0.7), M.pants, 0, 1.27, z * 0.29);   // Schlagflächen
  for (const [x, z] of [[0, 0], [0.09, 0.17], [-0.09, -0.17]]) add(w, new THREE.ConeGeometry(0.03, 0.14, 5).translate(0, 0.07, 0), M.satin, x, 1.405, z);   // Dornen oben
  return { staff: w, crystal: joint(w, 0, 1.27, 0.3), crystalGlow: null };   // crystal = vordere Schlagfläche
}
const HAM_P = {
  swingWind: { twist: 1.0, rSh: -0.7, rShZ: -1.1, rEl: -0.3, wpn: 0.9, lSh: -0.9, lShZ: 0.5, lEl: -0.5, lean: 0.15, hipsY: 0.92, lKnee: 0.4, rKnee: 0.4, gripL: 1 },
  swing: { rSh: -0.25, rShZ: -1.45, rEl: -0.05, wpn: 1.06, lSh: -0.3, lShZ: 0.5, lEl: -1.2, lean: 0.05, hipsY: 0.9, lKnee: 0.45, rKnee: 0.45, jaw: 0.5, gripL: 1 },
  stagger: { lean: 0.45, hipsY: 0.88, lKnee: 0.6, rKnee: 0.3, lHip: -0.4, rSh: -0.5, rShZ: -0.3, rEl: -0.4, wpn: 1.2, headX: 0.3 },
};
const HAM_SWING = [0.28, 0.6];
const WAR_HAMMER = { ...WEAPON_BASE, id: 'warHammer', name: 'Krieger · Grabhammer', weapon: hammerWeapon,
  hits: { atk1: [1400, [0.47]], atk2: [1500, [0.44]] },
  atk1(t, time) { WAR_MOVES.smash(t, wave(time, 1400) * 1300); },        // gleiche Bewegung wie Smash, 1,4 s
  atk2(t, time) {                                                        // Rundschlag: ausholen, eine Drehung, nachtaumeln
    const k = wave(time, 1500), P = HAM_P, u = seg(k, ...HAM_SWING);
    Object.assign(t, STAND);
    mix(t, P.swingWind, smooth(0, 0.25, k) * (1 - smooth(0.26, 0.34, k)));
    mix(t, P.swing, smooth(0.26, 0.32, k) * (1 - smooth(0.58, 0.7, k)));
    mix(t, P.stagger, smooth(0.58, 0.7, k) * (1 - smooth(0.85, 1, k)));
    t.spinY = -Math.PI * 2 * smooth(0, 1, u);
  },
  hitFx(R, action, i, y, time) {
    const quake = (lx, lz, k, kind, delay) => R.fx.schedule(delay, () => {
      groundAt(R, lx, lz, tmpV); R.fx.spawn('dust', tmpV.x, y, tmpV.z, k); if (R.onHit) R.onHit(kind, tmpV.x, tmpV.z, i);
    });
    if (action === 'atk2') {                                             // Rundschlag: Ring um den Krieger
      groundAt(R, 0, 0, tmpV); R.fx.spawn('dust', tmpV.x, y, tmpV.z, 2.1); R.fx.spawn('dust', tmpV.x, y, tmpV.z, 1.2);
      if (R.onHit) R.onHit(action, tmpV.x, tmpV.z, i);
      quake(0, 0, 2.1, 'nachbeben', 1000);
      return;
    }
    localPos(R, R.crystal, _p);                                          // Erdspalter: Spalte läuft von der Schlagfläche nach vorn
    for (let n = 0; n < 5; n++) {
      const lz = _p.z + n * 1.6, lx = _p.x;
      R.fx.schedule(n * 80, () => { groundAt(R, lx, lz, tmpV); R.fx.spawn('crack', tmpV.x, y, tmpV.z, n ? 0.75 : 1); if (!n) R.fx.spawn('dust', tmpV.x, y, tmpV.z); if (R.onHit) R.onHit(action, tmpV.x, tmpV.z, n); });
      quake(lx, lz, 0.9, 'nachbeben', 1000 + n * 80);
    }
  },
};
WAR_HAMMER.cast = WAR_HAMMER.atk1; WAR_HAMMER.hits.cast = WAR_HAMMER.hits.atk1;

// ---------- 3 · Seelenanker: Schiffsanker an einer Kette (sammelt Mobs) ----------
// Attacke 1 Ankerwurf: Anker fliegt 9 m geradeaus, bohrt sich ein, wird zurückgerissen und zieht getroffene Mobs mit.
// Attacke 2 Kettenwirbel: Anker kreist zwei Runden auf Hüfthöhe (Radius bis 4 m), Treffer bei jeder halben Runde.
// Eigenschaft Seelenfang: Mobs, die der Anker zieht, sind 5 s markiert und nehmen 15 % mehr Schaden aus allen Quellen.
function chainTex() {
  const t = toTex(canvas(64, (g, s) => {
    g.lineCap = 'round';
    for (const [y, side] of [[16, false], [48, true]]) {
      if (side) { g.fillStyle = '#2a2b30'; g.fillRect(s / 2 - 5, y - 18, 10, 36); g.fillStyle = '#9a9ea8'; g.fillRect(s / 2 - 2, y - 16, 3, 32); }
      else { g.strokeStyle = '#26272c'; g.lineWidth = 9; g.beginPath(); g.ellipse(s / 2, y, 14, 19, 0, 0, 7); g.stroke(); g.strokeStyle = '#8f939d'; g.lineWidth = 4; g.beginPath(); g.ellipse(s / 2, y, 14, 19, 0, -2.4, -0.4); g.stroke(); }
    }
  }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makeChain(n = 26, radial = 4, r = 0.028) {                     // Röhre mit fester Topologie, Punkte kommen pro Frame
  const geo = new THREE.BufferGeometry(), pos = new Float32Array((n + 1) * (radial + 1) * 3), uv = new Float32Array((n + 1) * (radial + 1) * 2), idx = [];
  for (let i = 0; i < n; i++) for (let a = 0; a < radial; a++) { const p = i * (radial + 1) + a, q = p + radial + 1; idx.push(p, q, p + 1, p + 1, q, q + 1); }
  geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: chainTex(), alphaTest: 0.5, side: THREE.DoubleSide }));
  mesh.userData.keep = true; mesh.frustumCulled = false;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), v = new THREE.Vector3();
  mesh.setPoints = pts => {                                              // pts: n+1 Vektoren im root-Raum
    let len = 0;
    for (let i = 0; i <= n; i++) {
      T.subVectors(pts[Math.min(n, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      N.crossVectors(T, Math.abs(T.y) > 0.9 ? v.set(1, 0, 0) : UP).normalize(); B.crossVectors(T, N);
      if (i) len += pts[i].distanceTo(pts[i - 1]);
      for (let a = 0; a <= radial; a++) {
        const ang = a / radial * Math.PI * 2, o = (i * (radial + 1) + a);
        v.copy(pts[i]).addScaledVector(N, Math.cos(ang) * r).addScaledVector(B, Math.sin(ang) * r);
        pos.set([v.x, v.y, v.z], o * 3); uv.set([a / radial, len / 0.16], o * 2);
      }
    }
    geo.attributes.position.needsUpdate = geo.attributes.uv.needsUpdate = true; geo.computeVertexNormals();
  };
  return mesh;
}
function anchorWeapon(armR, armL, M, C) {
  const hold = joint(armR.wrist, 0.018, -0.088, 0.004); hold.rotation.x = C.weaponX;
  const anc = joint(rootOf(armR.wrist));                                 // fliegt frei, sonst folgt er hold
  add(anc, new THREE.TorusGeometry(0.065, 0.016, 4, 8), M.pants, 0, -0.24, 0);                               // Ring für die Kette
  add(anc, tube([[0, -0.17, 0], [0, 0.4, 0.003], [0, 1.02, 0]], 0.034, 3, 6), M.pants);                    // Schaft
  add(anc, subUV(new THREE.BoxGeometry(0.44, 0.05, 0.05), 0, 0, 1, 0.7), M.pants, 0, 0.16, 0);               // Stock (Querbalken)
  for (const s of [-1, 1]) {
    add(anc, tube([[0, 1.0, 0], [s * 0.2, 0.98, 0], [s * 0.36, 0.84, 0], [s * 0.42, 0.66, 0]], 0.036, 6, 5, { taper: 0.35 }), M.pants);   // Arme
    const f = new THREE.Shape(); f.moveTo(-0.075, 0); f.lineTo(0.075, 0); f.lineTo(0, -0.2); f.closePath();
    const fl = new THREE.ExtrudeGeometry(f, { depth: 0.028, bevelEnabled: false }).translate(0, 0, -0.014);
    setUV(fl, (x, y) => [x / 0.15 + 0.5, -y / 0.2]); fl.rotateZ(s * 0.35);
    add(anc, fl, M.sleeve, s * 0.41, 0.72, 0);                                                               // Flunken
    add(anc, tube([[s * 0.36, 0.71, 0.016], [s * 0.42, 0.56, 0.016]], 0.006, 2, 3), SOUL);                    // Seelenglut auf den Flunken
  }
  add(anc, new THREE.ConeGeometry(0.035, 0.16, 5).translate(0, 1.08, 0), M.satin);                          // Dorn am Kreuz
  for (const y of [0.42, 0.6, 0.78]) add(anc, new THREE.TorusGeometry(0.04, 0.008, 3, 8).rotateX(Math.PI / 2), SOUL, 0, y, 0);   // Runenringe
  const ring = joint(anc, 0, -0.24, 0), belt = joint(armL.shoulder.parent.parent, 0.17, 0.06, 0.1);   // Kettenende am Gürtel (links, an der Hüfte)
  return { staff: hold, hold, anc, ring, belt, crystal: joint(anc, 0, 0.9, 0), crystalGlow: null };
}
const ANC = { throwDur: 1300, out: [0.2, 0.42], stuck: 0.52, back: 0.85, reach: 9, spinDur: 1600 };
const ANC_P = {
  wind: { rSh: 0.7, rShZ: -0.3, rEl: -1.0, wpn: -0.3, twist: 0.55, lean: -0.1, lSh: -1.3, lShZ: 0.1, lEl: -0.2, gripL: 0, headX: 0 },
  release: { rSh: -1.75, rShZ: 0.05, rEl: -0.05, wpn: 0.6, twist: -0.5, lean: 0.4, hipsY: 0.92, lSh: 0.4, lShZ: 0.3, lEl: -0.4, lKnee: 0.5, rKnee: 0.15, lHip: -0.55, jaw: 0.45 },
  brace: { rSh: -1.2, rShZ: 0.15, rEl: -0.3, lSh: -1.1, lShZ: -0.15, lEl: -0.4, gripL: 1, lean: -0.25, hipsY: 0.9, lKnee: 0.55, rKnee: 0.2, lHip: -0.6, rHip: 0.15 },
  yank: { rSh: 0.35, rShZ: -0.1, rEl: -1.3, lSh: 0.25, lShZ: 0.1, lEl: -1.3, gripL: 1, lean: -0.45, hipsY: 0.92, twist: 0.3, jaw: 0.6, headX: -0.25 },
  spin: { rSh: -1.35, rShZ: 0.3, rEl: -0.1, lSh: -1.35, lShZ: -0.3, lEl: -0.1, gripL: 1, lean: -0.3, hipsY: 0.9, lKnee: 0.4, rKnee: 0.4, headX: -0.1, jaw: 0.35 },
};
function sagPts(A, B, L, n, out) {                                      // Kette zwischen A und B mit Durchhang (Länge L)
  const d = A.distanceTo(B), drop = L > d ? Math.sqrt(L * L - d * d) * 0.5 : 0;
  for (let i = 0; i <= n; i++) { const t = i / n; out.push(new THREE.Vector3().lerpVectors(A, B, t).add(_d.set(0, -4 * t * (1 - t) * drop, 0))); }
  return out;
}
const WAR_ANCHOR = { ...WEAPON_BASE, id: 'warAnchor', name: 'Krieger · Seelenanker', weapon: anchorWeapon,
  addons(R) { R.fx = makeWarriorFx(); R.chain = makeChain(); R.root.add(R.chain); },
  hits: { atk1: [ANC.throwDur, [0.42, 0.7]], atk2: [ANC.spinDur, [0.25, 0.5, 0.75, 0.97]] },
  atk1(t, time) {                                                        // Ankerwurf: ausholen, schleudern, Kette greifen, zurückreißen
    const k = wave(time, ANC.throwDur), P = ANC_P;
    Object.assign(t, STAND);
    mix(t, P.wind, smooth(0, 0.17, k) * (1 - smooth(0.17, 0.24, k)));
    mix(t, P.release, smooth(0.17, 0.24, k) * (1 - smooth(0.36, 0.46, k)));
    mix(t, P.brace, smooth(0.36, 0.46, k) * (1 - smooth(0.52, 0.6, k)));
    mix(t, P.yank, smooth(0.52, 0.6, k) * (1 - smooth(0.82, 0.95, k)));
  },
  atk2(t, time) {                                                        // Kettenwirbel: zwei Runden, Anker kreist auf Hüfthöhe
    const k = wave(time, ANC.spinDur);
    Object.assign(t, STAND); mix(t, ANC_P.spin, smooth(0, 0.08, k) * (1 - smooth(0.92, 1, k)));
    t.spinY = k * Math.PI * 4;
  },
  anchorPos(R, k, kind, time) {                                          // null = in der Hand, sonst Lage im root-Raum
    if (kind === 'atk1') {
      if (k < ANC.out[0] || k > ANC.back) return null;
      const T = _d.set(0, 0.35, ANC.reach);
      if (k < ANC.out[1]) { const u = easeOut(seg(k, ...ANC.out)); return _p.lerpVectors(_h, T, u).add(new THREE.Vector3(0, Math.sin(Math.PI * u) * 1.1, 0)); }
      if (k < ANC.stuck) return _p.copy(T);
      const u = seg(k, ANC.stuck, ANC.back); return _p.lerpVectors(T, _h, u * u).add(new THREE.Vector3(0, Math.sin(Math.PI * u) * 0.5, 0));
    }
    if (kind === 'atk2') {
      if (k < 0.04 || k > 0.96) return null;
      const r = 0.7 + 3.3 * smooth(0.04, 0.22, k) * (1 - smooth(0.8, 0.96, k)), a = R.hips.rotation.y - 0.35;
      return _p.set(Math.sin(a) * r, 0.95 + Math.sin(k * 25) * 0.08, Math.cos(a) * r);
    }
    return null;
  },
  tick(R, time) {
    R.root.updateMatrixWorld(true);
    const kind = R.action === 'atk1' || R.action === 'cast' ? 'atk1' : R.action === 'atk2' ? 'atk2' : null;
    const k = kind ? wave(R.actTime, kind === 'atk1' ? ANC.throwDur : ANC.spinDur) : 0;
    localPos(R, R.armR.wrist, _h);
    const p = kind && this.anchorPos(R, k, kind, time);
    if (!p) follow(R, R.anc, R.hold);
    else {
      R.anc.position.copy(p);
      const dir = new THREE.Vector3().subVectors(p, _h);
      if (kind === 'atk1' && k >= ANC.out[1] && k < ANC.stuck) dir.set(0, -0.7, 1);   // steckt schräg im Boden
      R.anc.quaternion.setFromUnitVectors(UP, dir.normalize()); R.anc.scale.setScalar(1);
    }
    R.anc.updateMatrixWorld(true);
    const S = localPos(R, R.belt, new THREE.Vector3()), E = localPos(R, R.ring, new THREE.Vector3()), H = _h.clone(), pts = [];
    if (!p) sagPts(S, E, Math.max(1.15, S.distanceTo(E) * 1.1), 26, pts);              // hängt vom Gürtel zum Anker in der Hand
    else { sagPts(S, H, Math.max(0.8, S.distanceTo(H) * 1.1), 8, pts); pts.pop(); sagPts(H, E, H.distanceTo(E) * (kind === 'atk2' ? 1.0 : 1.02) + 0.05, 18, pts); }
    R.chain.setPoints(pts);
  },
  hitFx(R, action, i, y, time) {
    if (action === 'atk2') { groundAt(R, 0, 0, tmpV); R.fx.spawn('dust', tmpV.x, y, tmpV.z, 2.4); if (R.onHit) R.onHit(action, tmpV.x, tmpV.z, i); return; }
    if (i) R.anc.getWorldPosition(tmpV); else groundAt(R, 0, ANC.reach, tmpV);
    if (i === 0) { R.fx.spawn('crack', tmpV.x, y, tmpV.z, 0.55); R.fx.spawn('dust', tmpV.x, y, tmpV.z, 0.7); }
    else R.fx.spawn('dust', tmpV.x, y, tmpV.z, 0.5);                   // Rückriss: Mobs werden mitgezogen (Seelenfang)
    if (R.onHit) R.onHit(i ? 'anker' : action, tmpV.x, tmpV.z, i);
  },
};
WAR_ANCHOR.cast = WAR_ANCHOR.atk1; WAR_ANCHOR.hits.cast = WAR_ANCHOR.hits.atk1;

// =====================================================================
// Gebeinsamurai: eigener untoter Samurai auf dem Vanilla-Rig. Lackrüstung (Kabuto mit Sichelkrone, Sode, Dō,
// Kusazuri), Hakama, Geisterblaue Augen. Drei eigene Klingen: Katana „Fahlmond“ und Wakizashi „Glutzahn“ an der
// linken Hüfte, Ōdachi „Grabwind“ quer auf dem Rücken. Er hält nie mehr als zwei Klingen gleichzeitig.
// Spezial 1 Fahlmond-Iai: Ziehen und Schneiden in einem (Nukitsuke), 6 m Sprint; der Schaden fällt beim Wegstecken (Nōtō).
// Spezial 2 Zwei Himmel: Katana + Wakizashi zusammen (Nitō), Kreuzschnitt, dann eine Drehung.
// Spezial 3 Seoi-Sichel: Ōdachi vom Rücken, weiter Querschnitt, Sichelwelle fliegt ~8 m.
// Spezial 4 Totenwacht: kniet (Iai aus dem Sitz), lädt Geisterlicht, dann 3 Wellen Geisterschnitte im Umkreis von 5 m.
// =====================================================================
function paintHakama(s) {                                                // Indigo, senkrechte Falten, Saum zerrissen
  return canvas(s, g => {
    vGrad(g, s, [[0, '#2c3350'], [0.5, '#222842'], [1, '#141726']]);
    weave(g, s, 2, '0,0,0', '160,170,220', 0.5);
    for (let x = 0; x < s; x += s / 7) { pipeFold(g, x + s / 14, 0, s, 18, '8,8,20', '120,130,190', 0.5); }
    blotches(g, s, 10, 'rgba(70,55,40,0.35)', [0.03, 0.08], [0, 0.7, 1, 1]);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    g.beginPath(); g.moveTo(0, s); for (let x = 0; x <= s; x += 24) { g.lineTo(x + 12, s - rand(0.02, 0.08) * s); g.lineTo(x + 24, s); } g.fill();
    g.globalCompositeOperation = 'source-over';
  });
}
function paintLacquer(s) {                                               // Schuppenreihen (Kozane) in dunkelrotem Lack, helle Schnürung
  return canvas(s, g => {
    g.fillStyle = '#2a0c0e'; g.fillRect(0, 0, s, s);
    const rowH = 34;
    for (let y = 0; y < s; y += rowH) {
      const grd = g.createLinearGradient(0, y, 0, y + rowH); grd.addColorStop(0, '#a2333a'); grd.addColorStop(0.35, '#6e1a20'); grd.addColorStop(1, '#2a0a0d');
      g.fillStyle = grd; g.fillRect(0, y + 2, s, rowH - 4);
      for (let x = 0; x < s; x += 12) { g.fillStyle = 'rgba(10,2,4,0.5)'; g.fillRect(x, y + 4, 2, rowH - 8); }
      g.fillStyle = rgba(LIT, 0.35); g.fillRect(0, y + 3, s, 2);
    }
    for (let x = 18; x < s; x += 64) for (let y = 0; y < s; y += rowH) {      // Schnürung (Odoshi): dunkelblaue Kordeln über die Reihen
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + 2, y + 2, 6, rowH);
      g.fillStyle = '#2c3658'; g.fillRect(x, y, 6, rowH - 2); g.fillStyle = 'rgba(150,165,210,0.5)'; g.fillRect(x, y + 3, 6, 2);
    }
    blotches(g, s, 8, 'rgba(10,6,8,0.45)', [0.03, 0.08]);                              // abgeplatzter Lack
    const ex = EMBLEM[0] * s, ew = (1 - EMBLEM[0]) * s, grd = g.createRadialGradient(ex + ew * 0.4, ew * 0.4, 0, ex + ew / 2, ew / 2, ew / 2);
    grd.addColorStop(0, '#f0d080'); grd.addColorStop(0.7, '#a8782a'); grd.addColorStop(1, '#4a3010');
    g.fillStyle = '#1a0608'; g.fillRect(ex, 0, ew, ew); g.fillStyle = grd; g.beginPath(); g.arc(ex + ew / 2, ew / 2, ew * 0.42, 0, 7); g.fill();
    skullEmblem(g, ex + ew / 2, ew / 2, ew * 0.28, '#2a0c0e', '#f0d080');               // Wappen: Schädel im Goldkreis
  });
}
function paintTsuka(s) {                                                 // Griffwicklung: weiße Rochenhaut, schwarze Rauten
  return canvas(s, g => {
    g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(150,140,120,${rand(0.2, 0.5)})`; g.beginPath(); g.arc(rand(0, s), rand(0, s), rand(1, 3), 0, 7); g.fill(); }
    g.strokeStyle = '#141216'; g.lineWidth = s * 0.075;
    for (let x = -s; x < 2 * s; x += s / 4) for (const d of [1, -1]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + d * s, s); g.stroke(); }
    g.strokeStyle = 'rgba(120,120,140,0.5)'; g.lineWidth = 2;
    for (let x = -s; x < 2 * s; x += s / 4) for (const d of [1, -1]) { g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x - 6 + d * s, s); g.stroke(); }
  });
}
function paintObiSaya(s) {                                                  // oben Stoff (Obi, Schnüre), unten schwarzer Lack (Scheiden)
  return canvas(s, g => {
    const h = s / 2;
    g.save(); g.beginPath(); g.rect(0, 0, s, h); g.clip();
    g.fillStyle = '#3a3f52'; g.fillRect(0, 0, s, h); weave(g, s, 2, '0,0,0', '200,205,230', 0.6);
    for (let y = 12; y < h; y += 28) { g.fillStyle = 'rgba(200,190,150,0.35)'; g.fillRect(0, y, s, 3); }
    vGrad(g, s, [[0, rgba(LIT, 0.12)], [0.5, rgba(DEEP, 0.45)]]);
    g.restore();
    const grd = g.createLinearGradient(0, h, 0, s); grd.addColorStop(0, '#2a2a30'); grd.addColorStop(0.3, '#0c0c10'); grd.addColorStop(0.55, '#5a5a66'); grd.addColorStop(0.62, '#121216'); grd.addColorStop(1, '#060608');
    g.fillStyle = grd; g.fillRect(0, h, s, h);
    blotches(g, s, 6, 'rgba(90,70,50,0.35)', [0.02, 0.05], [0, 0.5, 1, 1]);
  });
}
function paintKatana(s) {                                                // u 0 = Rücken (Mune), 1 = Schneide; Hamon als welliger heller Saum
  return canvas(s, g => {
    hGrad(g, s, [[0, '#5a5e68'], [0.28, '#8d929c'], [0.32, '#c9ced6'], [0.6, '#9aa0aa'], [1, '#b8bec8']]);
    strokes(g, s, 400, ['#c0c5ce', '#4a4d55'], { angle: -Math.PI / 2, jitter: 0.03, len: [0.1, 0.4], w: [1, 2], a: [0.05, 0.12] });
    g.fillStyle = 'rgba(240,245,255,0.75)'; g.beginPath(); g.moveTo(s, 0);
    for (let y = 0; y <= s; y += 8) g.lineTo(s * (0.72 + 0.06 * Math.sin(y / 23) + 0.03 * Math.sin(y / 7)), y);
    g.lineTo(s, s); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(s * 0.96, 0, s * 0.04, s);                     // Schneide
  });
}
function paintGold(s) {
  return canvas(s, g => {
    vGrad(g, s, [[0, '#f6dc8c'], [0.35, '#c8962e'], [0.7, '#7a5418'], [1, '#3a2408']]);
    strokes(g, s, 300, ['#fff0c0', '#4a2e08'], { angle: 0, len: [0.05, 0.2], w: [1, 2], a: [0.08, 0.2] });
  });
}
const samuraiCells = (s, C) => { const c = paintLowAtlas(s, C); c[4] = paintHakama(s); c[5] = paintLacquer(s); c[6] = paintTsuka(s); c[7] = paintRibs(s); c[8] = paintObiSaya(s); c[9] = paintKatana(s); c[10] = paintGold(s); return c; };

// ---------- Klingen ----------
const GHOST = wGlowMat([0.45, 1.3, 2.8]);
const SAM_BLADES = {                                                     // L Klingenlänge, w Breite, sori Krümmung, grip Griffende (−y), tsuba Radius
  kat: { L: 0.72, w: 0.032, sori: 0.022, grip: -0.2, tsuba: 0.042 },
  waki: { L: 0.46, w: 0.03, sori: 0.014, grip: -0.13, tsuba: 0.036, sayaTint: new THREE.Color(1.6, 0.45, 0.35) },
  oda: { L: 1.15, w: 0.04, sori: 0.04, grip: -0.36, tsuba: 0.058, ghost: true },
};
const Y0 = 0.08;                                                          // Klinge beginnt hier (darunter Tsuba, Griff)
function bladeGeo({ L, w, sori }) {
  const off = y => -sori * ((y - Y0) / L) ** 2, sh = new THREE.Shape(), N = 10;
  sh.moveTo(-w / 2, Y0);
  for (let i = 1; i <= N; i++) { const y = Y0 + L * 0.92 * i / N, t = (y - Y0) / L; sh.lineTo(off(y) - w / 2 * (1 - 0.2 * t), y); }
  sh.lineTo(off(Y0 + L) + w * 0.05, Y0 + L);                              // Spitze (Kissaki) zieht zur Schneide
  sh.quadraticCurveTo(off(Y0 + L * 0.96) + w * 0.42, Y0 + L * 0.97, off(Y0 + L * 0.92) + w / 2 * 0.82, Y0 + L * 0.92);
  for (let i = N - 1; i >= 0; i--) { const y = Y0 + L * 0.92 * i / N, t = (y - Y0) / L; sh.lineTo(off(y) + w / 2 * (1 - 0.2 * t), y); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }).translate(0, 0, -0.003);
  setUV(geo, (x, y) => [Math.min(1, Math.max(0, (x - off(y)) / w + 0.5)), (y - Y0) / L]);
  return { geo, off };
}
function samSword(j, M, b) {                                              // Schwert entlang +y, Griff um y 0
  add(j, tube([[0, b.grip, 0], [0, (b.grip + 0.06) / 2, 0.002], [0, 0.06, 0]], 0.017 * (b.ghost ? 1.15 : 1), 2, 5), M.woodTube);
  add(j, new THREE.SphereGeometry(0.02, 5, 3).scale(1, 0.7, 1), M.satin, 0, b.grip - 0.005, 0);              // Kashira
  add(j, new THREE.CylinderGeometry(b.tsuba, b.tsuba, 0.008, 10), M.satin, 0, 0.066, 0);                     // Tsuba
  add(j, new THREE.BoxGeometry(b.w * 0.75, 0.025, 0.014), M.satin, 0, 0.083, 0);                             // Habaki
  const { geo, off } = bladeGeo(b); add(j, geo, M.sleeve);
  if (b.ghost) { const pts = []; for (let i = 0; i <= 6; i++) { const y = Y0 + 0.05 + (b.L * 0.85) * i / 6; pts.push([off(y) + b.w * 0.44, y, 0]); } add(j, tube(pts, 0.005, 8, 3), GHOST); }
  return j;
}
function samSaya(j, M, b) {                                               // Scheide im selben Rahmen wie das Schwert
  const pts = []; for (let i = 0; i <= 4; i++) { const y = 0.07 + (b.L + 0.04) * i / 4; pts.push([-b.sori * ((y - Y0) / b.L) ** 2, y, 0]); }
  const m = add(j, subUV(tube(pts, b.w * 0.62, 4, 6, { oval: v => { v.z *= 0.6; } }), 0, 0, 1, 0.5), M.accent);
  if (b.sayaTint) m.userData.tint = b.sayaTint;
}
function samuraiWeapon(armR, armL, M, C) {
  const torso = armL.shoulder.parent, hips = torso.parent, root = rootOf(hips);
  const holdR = joint(armR.wrist, 0.018, -0.088, 0.004); holdR.rotation.x = C.weaponX;
  const holdL = joint(armL.wrist, -0.018, -0.088, 0.004); holdL.rotation.x = C.weaponX;
  const sheath = (parent, pos, dir, roll = 0) => { const h = joint(parent, ...pos); h.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...dir).normalize()); h.rotateY(roll); return h; };
  const homes = {
    kat: sheath(hips, [0.21, 0.09, 0.13], [0.06, -0.32, -1], -Math.PI / 2),            // linke Hüfte, Griff nach vorn, Spitze nach hinten
    waki: sheath(hips, [0.17, 0.13, 0.12], [0.03, -0.2, -1], -Math.PI / 2),
    oda: sheath(torso, [-0.2, 0.72, -0.2], [0.47, -1, -0.04], 0),                      // Rücken: Griff über der rechten Schulter
  };
  const swords = {};
  for (const n of ['kat', 'waki', 'oda']) { samSaya(homes[n], M, SAM_BLADES[n]); swords[n] = { j: samSword(joint(root), M, SAM_BLADES[n]), home: homes[n] }; }
  return { staff: holdR, holdL, swords, crystal: joint(swords.kat.j, 0, 0.7, 0), crystalGlow: null };
}

// ---------- Rüstung ----------
const HAKAMA = { yBot: 0.3, yTop: 1.06, g0: 0, g: () => 0,
  RX: [[0.3, 0.34], [0.55, 0.29], [0.8, 0.235], [1.06, 0.185]], RZ: [[0.3, 0.29], [0.55, 0.245], [0.8, 0.2], [1.06, 0.158]], CZ: [[0.3, 0.02], [1.06, 0]],
  fold: (y, a) => 0.045 * smooth(1.0, 0.4, y) * (0.5 + 0.5 * Math.sin(a * 7)) };
const DO = { yBot: 1.08, yTop: 1.3, g0: 0, g: () => 0, RX: [[1.08, 0.185], [1.3, 0.175]], RZ: [[1.08, 0.16], [1.3, 0.15]], CZ: [[1.08, 0], [1.3, 0.02]], fold: null };
function samuraiClothes(R, M) {
  const { root, torso, hips, armL, armR, legL, legR, sk } = R, onTorso = { weights: () => [[torso, 1]] };
  add(torso, ribcageGeo().translate(0, -1, 0), M.inner);                                                                      // Brustkorb (oben frei)
  add(torso, tube([[0, 0.02, -0.03], [0, 0.2, -0.05], [0, 0.4, -0.06], [0, 0.55, -0.035]], 0.017, 5, 5), M.bone);
  for (const s of [-1, 1]) add(torso, tube([[0, 0.54, 0.1], [s * 0.1, 0.56, 0.06], [s * 0.19, 0.555, -0.01]], 0.011, 3, 4), M.bone);
  for (const a of [armL, armR]) add(a.shoulder, tube([[0, -0.01, 0], [0, -L.upper * 0.5, 0.005], [0, -L.upper + 0.01, 0]], 0.016, 3, 5, { oval: (v, tg, t) => v.multiplyScalar(1 + 0.5 * gauss(t, 0.15) + 0.4 * gauss(t - 1, 0.15)) }), M.bone);
  for (const [s, lg] of [[1, legL], [-1, legR]]) {
    add(lg.hip, tube([[s * 0.01, -0.02, 0], [0, -L.thigh * 0.5, 0.01], [0, -L.thigh + 0.02, 0.005]], 0.019, 3, 5), M.bone);
    add(lg.knee, subUV(tube([[0, -0.12, 0.012], [0, -0.28, 0.014], [0, -L.shank + 0.06, 0.008]], 0.042, 2, 6, { taper: 0.1 }), 0, 0, 1, 0.7), M.pants);   // Suneate
  }
  for (const a of [armL, armR]) add(a.elbow, subUV(tube([[0, -0.06, 0], [0, -0.16, 0], [0, -L.fore + 0.03, 0]], 0.032, 2, 6, { taper: -0.1 }), 0, 0, 1, 0.7), M.pants);   // Kote
  // Kabuto: Helmschale, zweistufiger Nackenschutz, Sichelkrone vorn
  add(sk, subUV(new THREE.SphereGeometry(0.104, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.85, 0.9, 1.05), 0, 0, 1, 0.7), M.pants, 0, 0.006, -0.004);
  for (const [y, r0, r1] of [[-0.01, 0.098, 0.115], [-0.045, 0.11, 0.13]]) add(sk, subUV(new THREE.CylinderGeometry(r0, r1, 0.045, 12, 1, true, Math.PI * 0.62, Math.PI * 1.76), 0, 0, 1, 0.7), M.pants, 0, y, -0.01);
  add(sk, new THREE.CylinderGeometry(0.02, 0.02, 0.01, 8).rotateX(Math.PI / 2), M.satin, 0, 0.045, 0.1);
  add(sk, new THREE.TorusGeometry(0.075, 0.009, 3, 12, Math.PI).rotateZ(Math.PI), M.satin, 0, 0.13, 0.095);              // Sichel, offen nach oben
  // Sode: flache Schulterplatten, leicht abstehend
  for (const [s, a] of [[1, armL], [-1, armR]]) {
    const p = joint(a.shoulder, s * 0.05, 0.02, 0); p.rotation.z = -s * 0.28;
    add(p, subUV(new THREE.BoxGeometry(0.02, 0.24, 0.2), 0, 0, 1, 0.7), M.pants, s * 0.03, -0.09, 0);
  }
  add(root, subUV(mirrorU(garment(DO, [12, 2])), 0, 0, 1, 0.7), M.pants, 0, 0, 0, onTorso);                                // Dō (Bauchpanzer)
  const belt = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; belt.push([Math.sin(a) * 0.19, 1.07 + 0.008 * Math.cos(a), Math.cos(a) * 0.165]); }
  add(root, subUV(tube(belt, 0.026, 12, 4, { closed: true, oval: v => { v.y *= 1.5; } }), 0, 0.5, 1, 1), M.accent, 0, 0, 0, { weights: () => [[torso, 0.5], [hips, 0.5]] });   // Obi
  for (const a of [0.42, -0.42, 1.35, -1.35, Math.PI]) {                                                                    // Kusazuri: fünf Lamellen um die Hüfte
    const p = joint(hips, 0, 0.06, 0); p.rotation.y = a;
    add(p, subUV(lowPanel(0.17, 0.3, 3, -0.1), 0, 0, 1, 0.7), M.pants, 0, 0, 0.205).rotation.x = -0.18;
  }
  add(root, mirrorU(garment(HAKAMA, [16, 6])), M.shell, 0, 0, 0, { weights: robeWeights(R) });                              // Hakama
}

// ---------- Bewegung ----------
const SAM_BASE = { hipsY: 0.95, lean: 0.12, headX: 0.1, lKnee: 0.3, rKnee: 0.3, lHip: -0.2, rHip: -0.05, twist: 0, jaw: 0.05, gripL: 1,
  rSh: -0.45, rShZ: 0.5, rEl: -1.05, wpn: 0, lSh: 0.05, lShZ: 0.12, lEl: -0.95, wpnL: 0 };     // rechte Hand am Griff, linke an der Scheide
const SAM_ARMS = ['rSh', 'rShZ', 'rEl', 'wpn', 'lSh', 'lShZ', 'lEl', 'wpnL', 'gripL'];
const S_P = {
  crouch: { hipsY: 0.82, lKnee: 0.8, rKnee: 0.5, lHip: -0.7, rHip: 0.25, lean: 0.5, rSh: -0.6, rShZ: 0.65, rEl: -1.15, lEl: -1.0, headX: -0.15 },
  iaiCut: { rSh: -1.45, rShZ: -1.25, rEl: -0.05, wpn: 1.15, lean: 0.55, hipsY: 0.85, lHip: -0.95, lKnee: 0.95, rHip: 0.55, rKnee: 0.2, lSh: 0.4, lShZ: 0.25, lEl: -0.6, twist: -0.5, jaw: 0.3 },
  chiburi: { rSh: -0.9, rShZ: -0.85, rEl: -0.3, wpn: 1.35, twist: -0.2, lean: 0.35 },
  reach2: { rSh: -0.6, rShZ: 0.6, rEl: -1.1, lSh: -0.2, lShZ: 0.05, lEl: -1.3 },
  raise2: { rSh: -2.8, rShZ: -0.45, rEl: -0.5, wpn: -0.2, lSh: -2.8, lShZ: 0.45, lEl: -0.5, wpnL: -0.2, lean: -0.1, hipsY: 0.98, headX: -0.15 },
  xcut: { rSh: -0.9, rShZ: 0.55, rEl: -0.1, wpn: 1.1, lSh: -0.9, lShZ: -0.55, lEl: -0.1, wpnL: 1.1, lean: 0.45, hipsY: 0.86, lKnee: 0.6, rKnee: 0.3, lHip: -0.6, jaw: 0.4 },
  spin2: { rSh: -0.2, rShZ: -1.4, rEl: -0.05, wpn: 1.15, lSh: -0.2, lShZ: 1.4, lEl: -0.05, wpnL: 1.15, lean: 0.05, hipsY: 0.9, lKnee: 0.4, rKnee: 0.4 },
  backReach: { rSh: -3.0, rShZ: -0.35, rEl: -2.0, lSh: -0.4, lShZ: 0.2, lEl: -0.8, lean: -0.05, headX: -0.1 },
  odaHigh: { rSh: -2.7, rShZ: -0.6, rEl: -0.4, wpn: 0.2, lSh: -2.5, lShZ: -0.2, lEl: -0.7, lean: -0.15, twist: 0.6, hipsY: 0.95 },
  odaWind: { twist: 1.0, rSh: -1.3, rShZ: -1.3, rEl: -0.2, wpn: 1.1, lSh: -1.2, lShZ: -0.4, lEl: -0.5, lean: 0.15, hipsY: 0.88, lKnee: 0.55, rKnee: 0.55, lHip: -0.5 },
  odaSweep: { twist: -1.0, rSh: -1.5, rShZ: -0.4, rEl: -0.05, wpn: 1.15, lSh: -1.4, lShZ: -0.3, lEl: -0.2, lean: 0.4, hipsY: 0.85, lKnee: 0.7, rKnee: 0.3, lHip: -0.7, rHip: 0.4, jaw: 0.5 },
  kneel: { hipsY: 0.58, lHip: -1.35, lKnee: 1.45, rHip: 0.15, rKnee: 1.95, lean: 0.15, headX: 0.45, rSh: -0.6, rShZ: 0.65, rEl: -1.15, lSh: 0.05, lShZ: 0.1, lEl: -1.05 },
  zanshin: { hipsY: 0.86, lHip: -0.8, lKnee: 0.9, rHip: 0.5, rKnee: 0.3, lean: 0.35, rSh: -0.3, rShZ: -1.0, rEl: -0.05, wpn: 1.35, lSh: 0.3, lShZ: 0.3, lEl: -0.5, headX: 0.2, jaw: 0.2 },
};
const SAM_DUR = { cast: 800, atk1: 1200, atk2: 1300, atk3: 1600, atk4: 1800 };
const SAM_DRAWN = {                                                       // wann welche Klinge in welcher Hand ist (Anteil der Aktion)
  cast: { kat: ['R', 0.14, 0.82] }, atk1: { kat: ['R', 0.21, 0.71] }, atk2: { kat: ['R', 0.1, 0.86], waki: ['L', 0.1, 0.86] }, atk3: { oda: ['R', 0.17, 0.86] }, atk4: { kat: ['R', 0.49, 0.85] } };
const SAM_DASH = 6;
const samPhase = (t, P, steps) => { for (const [pose, a, b, c, d] of steps) mix(t, P[pose], smooth(a, b, t.k) * (1 - smooth(c, d, t.k))); };
const SAMURAI = { ...WEAPON_BASE, id: 'samurai', name: 'Gebeinsamurai', atlasKey: 'samurai', atlasCells: samuraiCells, clothes: samuraiClothes, weapon: samuraiWeapon,
  eye: 0x8fd0ff, eyeCol: [0.7, 1.6, 3.0], stance: 0.1,
  idle(t, ph) { const b = Math.sin(ph * 0.8); Object.assign(t, SAM_BASE, { hipsY: 0.95 + b * 0.005, lean: 0.12 + b * 0.015, headZ: Math.sin(ph * 0.35) * 0.03 }); },
  gait(j, t, ph) { WAR_MOVES.gait(j, t, ph); for (const k of SAM_ARMS) t[k] = SAM_BASE[k]; t.lean = 0.38; },
  hits: { cast: [800, [0.3]], atk1: [1200, [0.22, 0.71]], atk2: [1300, [0.3, 0.56]], atk3: [1600, [0.43]], atk4: [1800, [0.5, 0.56, 0.62]] },
  cast(t, time) {                                                        // Grundangriff Kesagiri: ziehen, Schrägschnitt, wegstecken (ohne Sprint)
    t.k = wave(time, 800); Object.assign(t, SAM_BASE);
    samPhase(t, S_P, [['crouch', 0, 0.12, 0.14, 0.2], ['iaiCut', 0.16, 0.28, 0.5, 0.58], ['chiburi', 0.5, 0.58, 0.62, 0.7], ['crouch', 0.66, 0.76, 0.84, 0.98]]); delete t.k;
  },
  atk1(t, time) {                                                        // Fahlmond-Iai
    t.k = wave(time, 1200); Object.assign(t, SAM_BASE);
    samPhase(t, S_P, [['crouch', 0, 0.18, 0.2, 0.24], ['iaiCut', 0.2, 0.25, 0.55, 0.6], ['chiburi', 0.55, 0.6, 0.62, 0.66], ['crouch', 0.62, 0.68, 0.74, 0.9]]); delete t.k;
  },
  atk2(t, time) {                                                        // Zwei Himmel
    t.k = wave(time, 1300); Object.assign(t, SAM_BASE);
    samPhase(t, S_P, [['reach2', 0, 0.08, 0.1, 0.14], ['raise2', 0.1, 0.22, 0.24, 0.29], ['xcut', 0.24, 0.3, 0.38, 0.44], ['spin2', 0.38, 0.44, 0.66, 0.72], ['reach2', 0.7, 0.8, 0.88, 0.98]]);
    t.spinY = Math.PI * 2 * smooth(0.43, 0.67, t.k); delete t.k;
  },
  atk3(t, time) {                                                        // Seoi-Sichel
    t.k = wave(time, 1600); Object.assign(t, SAM_BASE);
    samPhase(t, S_P, [['backReach', 0, 0.13, 0.16, 0.2], ['odaHigh', 0.16, 0.22, 0.28, 0.32], ['odaWind', 0.28, 0.33, 0.37, 0.41], ['odaSweep', 0.37, 0.43, 0.62, 0.7], ['odaHigh', 0.62, 0.72, 0.76, 0.8], ['backReach', 0.76, 0.82, 0.86, 0.95]]); delete t.k;
  },
  atk4(t, time) {                                                        // Totenwacht
    t.k = wave(time, 1800); Object.assign(t, SAM_BASE);
    samPhase(t, S_P, [['kneel', 0, 0.1, 0.47, 0.5], ['zanshin', 0.47, 0.5, 0.74, 0.86]]);
    if (t.k > 0.1 && t.k < 0.48) t.headZ = Math.sin(time / 25) * 0.02 * smooth(0.25, 0.48, t.k);   // Zittern beim Laden
    delete t.k;
  },
  tick(R, time) {
    const a = R.action, d = SAM_DUR[a], k = d ? wave(R.actTime, d) : 0;
    if (!R.noMove) R.hips.position.z = a === 'atk1' ? SAM_DASH * (k < 0.9 ? smooth(0.2, 0.27, k) : 1 - smooth(0.9, 1, k)) : 0;   // Viewer: Sprint vor und zurück; im Spiel bewegt das Spiel
    R.root.updateMatrixWorld(true);
    const drawn = SAM_DRAWN[a] || {};
    for (const [n, sw] of Object.entries(R.swords)) {
      const st = drawn[n], hand = st && k >= st[1] && k < st[2] ? st[0] : null;
      follow(R, sw.j, hand === 'R' ? R.staff : hand === 'L' ? R.holdL : sw.home);
    }
    const charge = a === 'atk4' ? smooth(0.1, 0.48, k) * (1 - smooth(0.5, 0.62, k)) : 0;
    glowOf(R).material.color.setScalar(1 + 2.2 * charge);
  },
  hitFx(R, action, i, y, time) {
    const a = action, e = R.root.matrixWorld.elements, yaw = Math.atan2(e[8], e[10]);
    const W = (lx, ly, lz) => R.root.localToWorld(new THREE.Vector3(lx, ly, lz)), hit = (p, n = i) => R.onHit && R.onHit(a, p.x, p.z, n);
    if (a === 'cast') { R.crystal.getWorldPosition(tmpV); R.fx.spawn('slash', tmpV.x, tmpV.y, tmpV.z, 1, { yaw, vert: true, tilt: 0.5, sx: 2, sz: 0.4 }); return hit(tmpV); }
    if (a === 'atk1') {
      if (i === 0) { const p = W(0, 0, 0); R.fx.spawn('dust', p.x, y, p.z, 0.8); return; }
      const p = W(0, 1.0, SAM_DASH / 2);                                 // Schnittlinie entlang des Sprints, erst beim Wegstecken
      R.fx.spawn('slash', p.x, p.y, p.z, 1, { yaw: yaw + Math.PI / 2, vert: true, sx: SAM_DASH + 1, sz: 0.7 });
      R.fx.spawn('slash', p.x, p.y, p.z, 1, { yaw: yaw + Math.PI / 2, sx: SAM_DASH + 1, sz: 0.7 });
      return hit(W(0, 0, SAM_DASH));                                     // Spiel: alles auf der Linie Start → Ende
    }
    if (a === 'atk2') {
      if (i === 0) { const p = W(0, 1.15, 1.2); for (const s of [-1, 1]) R.fx.spawn('slash', p.x, p.y, p.z, 1, { yaw, vert: true, tilt: s * 0.75, sx: 2.6, sz: 0.5 }); return hit(W(0, 0, 1.2)); }
      const p = W(0, 1.0, 0); for (const r of [0, Math.PI]) R.fx.spawn('arc', p.x, p.y, p.z, 2.4, { yaw: yaw + r }); R.fx.spawn('dust', p.x, y, p.z, 1.4);
      return hit(p);
    }
    if (a === 'atk3') {
      const p = W(0, 1.1, 1.4), v = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(14);
      R.fx.spawn('arc', p.x, p.y, p.z, 1.8, { yaw, v }); R.fx.spawn('arc', p.x, p.y - 0.15, p.z, 1.3, { yaw, v: v.clone().multiplyScalar(0.9) });
      const f = W(0, 0, 0.8); R.fx.spawn('dust', f.x, y, f.z, 1.2);
      return hit(W(0, 0, 1.4));                                           // Spiel: Welle fliegt 14 m/s geradeaus, ~8 m
    }
    for (let n = 0; n < 4; n++) {                                         // atk4: Geisterschnitte im Umkreis
      const ang = rand(0, 7), r = rand(0.6, 4.5), p = W(Math.sin(ang) * r, rand(0.7, 1.4), Math.cos(ang) * r);
      R.fx.spawn('slash', p.x, p.y, p.z, 1, { yaw: rand(0, 7), vert: true, tilt: rand(-0.7, 0.7), sx: 3, sz: 0.5 });
    }
    const c = W(0, 0, 0); if (i === 0) R.fx.spawn('dust', c.x, y, c.z, 2.6);
    hit(c);
  },
};

// =====================================================================
// Ninja „Aschenschatten“: der Gebeinsamurai als Schattenkrieger. Eigenes Design: anthrazitfarbene Kleidung,
// Kapuze, Tuch vor dem Kiefer, violette Schärpe mit zwei Tuchenden, Binden an Unterarmen und Schienbeinen,
// violette Augen. Drei Klingen: Ninjatō verkehrt herum in der rechten Hand (leere Scheide quer auf dem Rücken),
// Kodachi quer am Kreuz (zieht er mit links), Geisterklinge schwebt über der rechten Schulter.
// Grundangriff Doppelschnitt (1 Klinge), Spezial 1 Schattenschritt (1), 2 Zwielichtkreuz (2), 3 Rauchbombe (1),
// 4 Geisterklingensturm (alle 3: Geisterklinge kreist selbstständig weit um ihn).
// Im Viewer verschiebt/hebt tick() die Hüfte (Sprint, Sprung). Im Spiel bewegt das Spiel den Spieler (R.noMove).
// =====================================================================
function paintNinjaCloth(s) {                                            // oben Stoff (v 0,5–1), unten Binden (v 0–0,5)
  return canvas(s, g => {
    const h = s / 2;
    g.save(); g.beginPath(); g.rect(0, 0, s, h); g.clip();
    g.fillStyle = '#2b2d38'; g.fillRect(0, 0, s, h); weave(g, s, 2, '0,0,0', '170,175,200', 0.55);
    strokes(g, s, 260, ['#3e4152', '#15161d'], { angle: Math.PI / 2, len: [0.04, 0.12], w: [2, 5], a: [0.15, 0.35], y1: 0.5 });   // Knitterfalten
    blotches(g, s, 6, 'rgba(90,80,70,0.3)', [0.03, 0.07], [0, 0, 1, 0.5]);
    g.restore();
    g.save(); g.beginPath(); g.rect(0, h, s, h); g.clip();
    g.fillStyle = '#a89c84'; g.fillRect(0, h, s, h);
    for (let y = h - s; y < s; y += 22) { g.strokeStyle = 'rgba(60,48,36,0.55)'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + s * 0.35); g.stroke();
      g.strokeStyle = 'rgba(240,230,205,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y + 6); g.lineTo(s, y + 6 + s * 0.35); g.stroke(); }
    blotches(g, s, 8, 'rgba(70,40,30,0.35)', [0.02, 0.06], [0, 0.5, 1, 1]);
    g.restore();
  });
}
function paintNinjaSash(s) {                                             // oben violettes Tuch, unten schwarzer Lack (Scheide)
  return canvas(s, g => {
    const c = paintObiSaya(s); g.drawImage(c, 0, 0);
    g.save(); g.beginPath(); g.rect(0, 0, s, s / 2); g.clip();
    g.fillStyle = '#4a2a62'; g.fillRect(0, 0, s, s / 2); weave(g, s, 2, '0,0,0', '220,190,255', 0.5);
    vGrad(g, s, [[0, rgba(LIT, 0.12)], [0.5, rgba(DEEP, 0.5)]]);
    g.restore();
  });
}
const ninjaCells = (s, C) => { const c = paintLowAtlas(s, C); c[4] = paintNinjaCloth(s); c[5] = paintIron(s); c[6] = paintTsuka(s); c[7] = paintRibs(s); c[8] = paintNinjaSash(s); c[9] = paintKatana(s); c[10] = paintGold(s); return c; };
const NJ_BLADE = { L: 0.58, w: 0.03, sori: 0, grip: -0.18, tsuba: 0.04, square: true };
const NJ_KODACHI = { L: 0.44, w: 0.028, sori: 0.008, grip: -0.14, tsuba: 0.034 };
const NJ_GHOST = { L: 0.66, w: 0.036, sori: 0.02, grip: -0.16, tsuba: 0.04 };
const GHOST_BLADE = wGlowMat([1.5, 0.6, 2.6]);                               // Geisterklinge: leuchtet ganz, kein Licht nötig
function njSword(j, M, b, bladeMat) {                                        // gerade/kurze Klinge mit eckigem Stichblatt
  const ghost = bladeMat !== M.sleeve;
  add(j, tube([[0, b.grip, 0], [0, (b.grip + 0.06) / 2, 0.002], [0, 0.06, 0]], 0.015, 2, 5), ghost ? bladeMat : M.woodTube);
  add(j, new THREE.BoxGeometry(0.065, 0.008, 0.065), ghost ? bladeMat : M.satin, 0, 0.066, 0);
  add(j, bladeGeo(b).geo, bladeMat);
  return j;
}
function ninjaWeapon(armR, armL, M, C) {
  const torso = armL.shoulder.parent;
  const holdR = joint(armR.wrist, 0.018, -0.088, 0.004); holdR.rotation.x = C.weaponX;
  const holdL = joint(armL.wrist, -0.018, -0.088, 0.004); holdL.rotation.x = C.weaponX;
  add(holdR, tube([[0, NJ_BLADE.grip, 0], [0, -0.06, 0.002], [0, 0.06, 0]], 0.016, 2, 5), M.woodTube);              // Ninjatō: Griff
  add(holdR, new THREE.BoxGeometry(0.075, 0.008, 0.075), M.satin, 0, 0.066, 0);                                        // eckiges Stichblatt
  const { geo } = bladeGeo(NJ_BLADE); add(holdR, geo, M.sleeve);
  const sh = joint(torso, -0.14, 0.62, -0.17); sh.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0.55, -1, -0.05).normalize());
  samSaya(sh, M, NJ_BLADE);                                                                                            // leere Scheide auf dem Rücken
  const root = rootOf(torso), hips = torso.parent;
  const kHome = joint(hips, 0.2, 0.07, -0.17); kHome.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-1, 0.12, -0.08).normalize());   // Kodachi quer am Kreuz, Griff links
  samSaya(kHome, M, NJ_KODACHI);
  const kodachi = { j: njSword(joint(root), M, NJ_KODACHI, M.sleeve), home: kHome };
  const gHome = joint(torso, -0.24, 0.78, -0.22); gHome.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-0.25, 1, -0.3).normalize());  // über der rechten Schulter
  const ghost = { j: njSword(joint(root), M, NJ_GHOST, GHOST_BLADE), home: gHome };
  return { staff: holdR, holdL, kodachi, ghost, crystal: joint(holdR, 0, 0.6, 0), crystalGlow: null };
}
const NJ_TOP = { yBot: 0.98, yTop: 1.6, g0: 0.08, g: y => 0.08 + 0.32 * smooth(1.44, 1.6, y),
  RX: [[0.98, 0.19], [1.1, 0.177], [1.25, 0.178], [1.38, 0.188], [1.47, 0.182], [1.53, 0.162], [1.57, 0.115], [1.6, 0.075]],
  RZ: [[0.98, 0.165], [1.25, 0.152], [1.4, 0.162], [1.5, 0.142], [1.57, 0.11], [1.6, 0.075]], CZ: [[0.98, 0], [1.25, 0.02], [1.5, 0], [1.6, -0.02]], fold: null };
const TOP_HALF = g => subUV(g, 0, 0.5, 1, 1), WRAP = g => subUV(g, 0, 0, 1, 0.5);
function ninjaClothes(R, M) {
  const { root, torso, hips, armL, armR, legL, legR, sk } = R;
  add(root, TOP_HALF(mirrorU(garment(NJ_TOP, [12, 6]))), M.shell, 0, 0, 0, { weights: p => [[torso, smooth(1.0, 1.14, p.y) + 0.001], [hips, 1 - smooth(1.0, 1.14, p.y) + 0.001]] });   // Jacke
  for (const [s, a] of [[1, armL], [-1, armR]]) {
    const { geo, weights } = sleeve(LOWP, s, 0.205, 1.53, L.shoulderY - L.upper - L.fore * 0.3, 0.056, 0.044, a, 13);
    add(root, TOP_HALF(mirrorU(geo)), M.shell, 0, 0, 0, { weights });
    add(a.elbow, WRAP(tube([[0, -0.05, 0], [0, -0.14, 0], [0, -L.fore + 0.02, 0]], 0.03, 2, 6)), M.shell);           // Binden Unterarm
  }
  for (const [s, lg] of [[1, legL], [-1, legR]]) {
    const { geo, weights } = pantsLeg(s, LOWP, { hips, hip: lg.hip, knee: lg.knee }, { yBot: 0.42, flare: 0.05, hipK: 0.9 });
    add(root, TOP_HALF(mirrorU(geo)), M.shell, 0, 0, 0, { weights });
    add(lg.knee, WRAP(tube([[0, -0.08, 0.008], [0, -0.25, 0.012], [0, -L.shank + 0.05, 0.006]], 0.034, 2, 6)), M.shell);   // Binden Schienbein
  }
  add(sk, TOP_HALF(new THREE.SphereGeometry(0.113, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(0.9, 0.95, 1.06)), M.shell, 0, 0.004, -0.006);   // Kapuze
  add(sk, TOP_HALF(new THREE.CylinderGeometry(0.104, 0.125, 0.12, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9)), M.shell, 0, -0.04, -0.01);           // Nackentuch
  add(sk, TOP_HALF(new THREE.CylinderGeometry(0.088, 0.078, 0.075, 10, 1, true, -1.25, 2.5)), M.shell, 0, -0.118, 0.012);                          // Tuch vor dem Kiefer
  const belt = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; belt.push([Math.sin(a) * 0.19, 1.06 + 0.008 * Math.cos(a), Math.cos(a) * 0.168]); }
  add(root, TOP_HALF(tube(belt, 0.024, 12, 4, { closed: true, oval: v => { v.y *= 1.5; } })), M.accent, 0, 0, 0, { weights: () => [[torso, 0.5], [hips, 0.5]] });   // Schärpe
  for (const s of [-1, 1]) add(hips, TOP_HALF(lowPanel(0.055, 0.34, 3, -0.2)), M.accent, s * 0.035 + 0.1, 0.06, -0.16).rotation.set(0.25, Math.PI + s * 0.2, s * 0.08);   // Tuchenden hinten
}
const NJ_BASE = { hipsY: 0.88, lean: 0.32, headX: 0.05, lKnee: 0.7, rKnee: 0.5, lHip: -0.6, rHip: -0.12, twist: 0.15, jaw: 0.05, gripL: 1,
  rSh: -0.15, rShZ: -0.3, rEl: -1.25, wpn: 2.6, lSh: -0.85, lShZ: 0.25, lEl: -1.45, wpnL: 2.6 };            // Ninjatō verkehrt herum am Unterarm, linke Hand als Deckung
const NJ_ARMS = ['rSh', 'rShZ', 'rEl', 'wpn', 'lSh', 'lShZ', 'lEl', 'wpnL', 'gripL'];
const N_P = {
  cutA: { rSh: -1.3, rShZ: 0.65, rEl: -0.25, wpn: 2.4, twist: -0.6, lean: 0.45, hipsY: 0.84 },
  cutB: { rSh: -1.1, rShZ: -1.25, rEl: -0.1, wpn: 2.3, twist: 0.55, lean: 0.4, hipsY: 0.84 },
  low: { hipsY: 0.72, lKnee: 1.2, rKnee: 1.0, lHip: -1.0, rHip: -0.4, lean: 0.6, headX: -0.1 },
  lReach: { lSh: 0.7, lShZ: 0.35, lEl: -1.7, twist: -0.3 },                     // linke Hand zum Kodachi am Kreuz
  lCut: { lSh: -1.3, lShZ: -0.65, lEl: -0.25, wpnL: 2.4, twist: 0.6, lean: 0.45, hipsY: 0.84 },
  xcutN: { rSh: -1.0, rShZ: 0.6, rEl: -0.1, wpn: 2.3, lSh: -1.0, lShZ: -0.6, lEl: -0.1, wpnL: 2.3, lean: 0.5, hipsY: 0.8, lKnee: 0.9, rKnee: 0.6, lHip: -0.8 },
  storm: { rSh: -0.3, rShZ: -1.35, rEl: -0.05, wpn: 2.3, lSh: -0.3, lShZ: 1.35, lEl: -0.05, wpnL: 2.3, lean: 0.15, hipsY: 0.82, lKnee: 0.6, rKnee: 0.6, headX: -0.1 },
  lUp: { lSh: -2.6, lShZ: 0.2, lEl: -0.6, lean: 0.05 },
  lSlam: { lSh: -0.4, lShZ: 0.1, lEl: -0.2, lean: 0.7, hipsY: 0.7, lKnee: 1.2, rKnee: 1.1, lHip: -1.0, rHip: -0.5 },
  spinCut: { rSh: -0.3, rShZ: -1.4, rEl: -0.05, wpn: 2.3, lSh: -0.3, lShZ: 1.3, lEl: -0.1, lean: 0.2, hipsY: 0.8 },
};
const NJ_DUR = { cast: 700, atk1: 1000, atk2: 1100, atk3: 1400, atk4: 1800 };
const NJ_DASH = 7, NJ_KODACHI_DRAWN = { atk2: [0.1, 0.9], atk4: [0.08, 0.92] }, NJ_GHOST_OUT = [0.12, 0.88];
const NINJA = { ...WEAPON_BASE, id: 'ninja', name: 'Ninja · Aschenschatten', atlasKey: 'ninja', atlasCells: ninjaCells, clothes: ninjaClothes, weapon: ninjaWeapon,
  eye: 0xc08aff, eyeCol: [2.0, 0.9, 3.0], stance: 0.16, freq: 5.2,
  idle(t, ph) { const b = Math.sin(ph * 1.1); Object.assign(t, NJ_BASE, { hipsY: 0.88 + b * 0.008, lean: 0.32 + b * 0.02, headZ: Math.sin(ph * 0.5) * 0.06 }); },
  gait(j, t, ph) { WAR_MOVES.gait(j, t, ph); const sw = Math.sin(ph); for (const k of NJ_ARMS) t[k] = NJ_BASE[k]; t.lean = 0.55; t.rSh += sw * 0.5; t.lSh -= sw * 0.4; t.hipsY -= 0.05; },
  hits: { cast: [700, [0.25, 0.6]], atk1: [1000, [0.2, 0.32]], atk2: [1100, [0.18, 0.28, 0.38, 0.56]], atk3: [1400, [0.18, 0.78]], atk4: [1800, [0.3, 0.5, 0.7]] },
  cast(t, time) { t.k = wave(time, 700); Object.assign(t, NJ_BASE); samPhase(t, N_P, [['cutA', 0, 0.2, 0.32, 0.42], ['cutB', 0.35, 0.55, 0.7, 0.95]]); delete t.k; },
  atk1(t, time) { t.k = wave(time, 1000); Object.assign(t, NJ_BASE); samPhase(t, N_P, [['low', 0, 0.18, 0.3, 0.4], ['cutB', 0.3, 0.34, 0.6, 0.85]]); delete t.k; },
  atk2(t, time) {                                                        // Zwielichtkreuz: Kodachi ziehen, 3 Wechselschnitte, Kreuzschnitt
    t.k = wave(time, 1100); Object.assign(t, NJ_BASE);
    samPhase(t, N_P, [['lReach', 0, 0.08, 0.1, 0.14], ['cutA', 0.12, 0.17, 0.2, 0.24], ['lCut', 0.22, 0.27, 0.3, 0.34], ['cutB', 0.32, 0.37, 0.4, 0.45],
      ['xcutN', 0.46, 0.55, 0.7, 0.8], ['lReach', 0.8, 0.86, 0.9, 0.96]]); delete t.k;
  },
  atk3(t, time) {
    t.k = wave(time, 1400); Object.assign(t, NJ_BASE);
    samPhase(t, N_P, [['lUp', 0, 0.12, 0.13, 0.18], ['lSlam', 0.13, 0.18, 0.3, 0.4], ['spinCut', 0.68, 0.72, 0.86, 0.98]]);
    t.spinY = Math.PI * 2 * smooth(0.7, 0.86, t.k); delete t.k;
  },
  atk4(t, time) {                                                        // Geisterklingensturm: zwei Klingen in der Hand, die dritte kreist
    t.k = wave(time, 1800); Object.assign(t, NJ_BASE);
    samPhase(t, N_P, [['lReach', 0, 0.06, 0.08, 0.12], ['storm', 0.1, 0.16, 0.84, 0.92]]);
    t.spinY = Math.PI * 4 * smooth(0.15, 0.85, t.k); delete t.k;
  },
  tick(R, time) {
    const a = R.action, d = NJ_DUR[a], k = d ? wave(R.actTime, d) : 0;
    let z = 0, hide = false;
    if (a === 'atk1') { z = NJ_DASH * (k < 0.9 ? smooth(0.2, 0.3, k) : 1 - smooth(0.9, 1, k)); hide = k > 0.2 && k < 0.3; }
    if (a === 'atk3') hide = k > 0.22 && k < 0.7;
    if (!R.noMove) R.hips.position.z = z;                               // Spiel: den Sprint bewegt das Spiel (Zeitfenster in NINJA_TIMING)
    R.root.updateMatrixWorld(true);
    const kd = NJ_KODACHI_DRAWN[a]; follow(R, R.kodachi.j, kd && k >= kd[0] && k < kd[1] ? R.holdL : R.kodachi.home);
    const g = R.ghost.j;
    if (a === 'atk4' && k > NJ_GHOST_OUT[0] && k < NJ_GHOST_OUT[1]) {   // Geisterklinge kreist flach, Spitze nach außen, gegen die Drehung des Ninjas
      const u = seg(k, ...NJ_GHOST_OUT), r = 0.9 + 3.6 * smooth(0, 0.2, u) * (1 - smooth(0.8, 1, u)), ang = -Math.PI * 6 * u;
      g.position.set(Math.sin(ang) * r, 1.15 + Math.sin(u * 20) * 0.1, Math.cos(ang) * r);
      g.quaternion.setFromUnitVectors(UP, _d.set(Math.cos(ang), -0.15, -Math.sin(ang)).normalize()); g.scale.setScalar(1);
    } else { follow(R, g, R.ghost.home); g.position.y += Math.sin(time / 450) * 0.04; }   // schwebt über der Schulter
    for (const o of R.root.children) if (o.isSkinnedMesh) o.visible = !hide;
    glowOf(R).material.color.setScalar((a === 'atk3' && k > 0.6 && k < 0.75) || (a === 'atk4' && k > 0.12 && k < 0.88) ? 2 : 1);
  },
  hitFx(R, a, i, y, time) {
    const e = R.root.matrixWorld.elements, yaw = Math.atan2(e[8], e[10]);
    const W = (lx, ly, lz) => R.root.localToWorld(new THREE.Vector3(lx, ly, lz)), hit = (kind, p, n = i) => R.onHit && R.onHit(kind, p.x, p.z, n);
    const smoke = (p, k = 1) => { for (let n = 0; n < 3; n++) R.fx.spawn('smoke', p.x + rand(-0.4, 0.4) * k, y + 0.2 + n * 0.45 * k, p.z + rand(-0.4, 0.4) * k, k * rand(0.8, 1.1), { yaw: rand(0, 7), vert: n > 0 }); };
    if (a === 'cast') { R.crystal.getWorldPosition(tmpV); R.fx.spawn('slash', tmpV.x, tmpV.y, tmpV.z, 1, { yaw, vert: true, tilt: i ? -0.5 : 0.6, sx: 1.6, sz: 0.35 }); return hit('cast', tmpV); }
    if (a === 'atk1') {
      if (i === 0) return smoke(W(0, 0, 0), 0.8);
      const p = W(0, 1.0, NJ_DASH / 2); R.fx.spawn('slash', p.x, p.y, p.z, 1, { yaw: yaw + Math.PI / 2, vert: true, sx: NJ_DASH + 0.5, sz: 0.5 });
      smoke(W(0, 0, NJ_DASH), 0.7); return hit('atk1', W(0, 0, NJ_DASH));       // Spiel: Linie Start → Ende
    }
    if (a === 'atk2') {                                                  // i 0–2 Wechselschnitte an der Klinge, i 3 Kreuzschnitt vorn
      if (i < 3) { (i === 1 ? R.kodachi.j : R.crystal).getWorldPosition(tmpV); R.fx.spawn('slash', tmpV.x, tmpV.y, tmpV.z, 1, { yaw, vert: true, tilt: i === 1 ? -0.6 : 0.6, sx: 1.5, sz: 0.3 }); return hit('atk2', tmpV); }
      const p = W(0, 1.1, 1.1); for (const s of [-1, 1]) R.fx.spawn('slash', p.x, p.y, p.z, 1, { yaw, vert: true, tilt: s * 0.75, sx: 2.4, sz: 0.45 }); return hit('atk2', W(0, 0, 1.1));
    }
    if (a === 'atk3') {
      const c = W(0, 0, 0);
      if (i === 0) { smoke(c, 1.4); smoke(c, 1.1); return hit('rauch', c); }
      for (const r of [0, Math.PI]) R.fx.spawn('arc', c.x, c.y + 1.0, c.z, 2.2, { yaw: yaw + r }); return hit('atk3', c);
    }
    const c = W(0, 0, 0);                                                 // atk4: 3 Wellen, Geisterklinge schneidet im Umkreis von 4,5 m
    for (const r of [0, Math.PI]) R.fx.spawn('arc', c.x, c.y + 1.1, c.z, 3.4, { yaw: yaw + r + i, sz: 1.1 });
    R.ghost.j.getWorldPosition(tmpV); R.fx.spawn('slash', tmpV.x, tmpV.y, tmpV.z, 1, { yaw: rand(0, 7), sx: 2, sz: 0.5 });
    if (i === 0) R.fx.spawn('dust', c.x, y, c.z, 2.2);
    hit('atk4', c);
  },
};


const CHARS = [HOOD, ICE, FIRE, ARCANE, WARRIOR, WAR_AXES, WAR_HAMMER, WAR_ANCHOR, SAMURAI, NINJA];
const GROUPS = { magier: ['hood', 'ice', 'fire', 'arcane'], krieger: ['warrior', 'warAxes', 'warHammer', 'warAnchor'], samurai: ['samurai', 'ninja'] };

// =====================================================================
// Ein SkinnedMesh für alles Beleuchtete (+ eins für Glühen). Kleidung bringt eigene Gewichte.
// =====================================================================
function aoFactor(v, n) {
  let f = lerp(0.62, 1.12, smooth(0.0, 1.85, v.y));
  f *= 0.8 + 0.3 * Math.max(0, n.y);
  const r = Math.hypot(v.x, v.z - 0.02);
  if (v.y > 1.15 && v.y < 1.6) f *= lerp(0.6, 1, smooth(0.03, 0.15, r));
  f *= lerp(0.7, 1, smooth(0.0, 0.035, v.y));                          // Bodenkontakt: Füße unten dunkler
  return f;
}
const atlasCache = {};
function atlas(C) {
  const key = C.atlasKey || C.id;
  if (atlasCache[key]) return atlasCache[key];
  const s = TEX, cells = C.atlasCells ? C.atlasCells(s, C) : baseCells(s, C);
  const big = document.createElement('canvas'); big.width = s * ATLAS_COLS; big.height = s * ATLAS_ROWS;
  const bg = big.getContext('2d'); cells.forEach((c, i) => bg.drawImage(c, (i % ATLAS_COLS) * s, Math.floor(i / ATLAS_COLS) * s, s, s));
  const tex = toTex(big);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return (atlasCache[key] = tex);
}
const emitCache = {};
function emitAtlas(C) {                                                  // Leuchtmaske: schwarz = leuchtet nicht
  if (emitCache[C.id]) return emitCache[C.id];
  const s = TEX, big = document.createElement('canvas'); big.width = s * ATLAS_COLS; big.height = s * ATLAS_ROWS;
  const bg = big.getContext('2d'); bg.fillStyle = '#000'; bg.fillRect(0, 0, big.width, big.height);
  C.emitCells(s, C).forEach((c, i) => c && bg.drawImage(c, (i % ATLAS_COLS) * s, Math.floor(i / ATLAS_COLS) * s, s, s));
  return (emitCache[C.id] = toTex(big));
}
function baseCells(s, C) {
  const boneCyl = paintBone(s, 'cyl'), own = C.paint(s);
  const skinCyl = C.flesh ? paintSkin(s, 'cyl') : null;
  return C.flesh
    ? [skinCyl, rotated(skinCyl), paintSkin(s, 'flat'), paintScalp(s), own.shell, own.pants, rotated(paintWood(s)), own.inner, own.accent, paintFootSkin(s), paintForearmSkin(s), paintHandSkin(s)]
    : [boneCyl, rotated(boneCyl), paintBone(s, 'flat'), paintCranium(s), own.shell, own.pants, rotated(paintWood(s)), own.inner, own.accent, paintFootBone(s), paintLimbBone(s), paintHandBone(s)];
}
function skinMerge(root, C) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse(o => { if (o.isMesh && !o.userData.keep) meshes.push(o); });
  const bones = [], boneOf = new Map(), buckets = { lit: [], glow: [] };
  const boneFor = j => { if (!boneOf.has(j)) { const b = new THREE.Bone(); j.add(b); boneOf.set(j, bones.length); bones.push(b); } return boneOf.get(j); };
  const v = new THREE.Vector3(), n = new THREE.Vector3(), white = new THREE.Color(1, 1, 1);
  const pad = 4 / TEX;
  for (const m of meshes) {
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'shade'].includes(name)) geo.deleteAttribute(name);
    geo.applyMatrix4(m.matrixWorld);
    const { cell, kind } = m.material.userData;
    const lit = kind === 'lit', base = lit ? (m.userData.tint || white) : m.material.color;
    const p = geo.attributes.position, nr = geo.attributes.normal, uv = geo.attributes.uv, sh = geo.attributes.shade, cnt = p.count;
    const col = new Float32Array(cnt * 3), si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
    const cx = cell % ATLAS_COLS, cy = ATLAS_ROWS - 1 - Math.floor(cell / ATLAS_COLS);
    const wFn = m.userData.weights, fixed = wFn ? -1 : boneFor(m.parent);
    for (let i = 0; i < cnt; i++) {
      v.fromBufferAttribute(p, i);
      const f = (lit ? aoFactor(v, n.fromBufferAttribute(nr, i)) : 1) * (sh ? sh.getX(i) : 1);
      col[i * 3] = base.r * f; col[i * 3 + 1] = base.g * f * 0.97; col[i * 3 + 2] = base.b * f * 0.92;
      if (wFn) {
        const ws = wFn(v).filter(([, w]) => w > 0.001).slice(0, 4), sum = ws.reduce((a, [, w]) => a + w, 0);
        ws.forEach(([j, w], k) => { si[i * 4 + k] = boneFor(j); sw[i * 4 + k] = w / sum; });
      } else { si[i * 4] = fixed; sw[i * 4] = 1; }
      if (uv) uv.setXY(i, (cx + pad + uv.getX(i) * (1 - 2 * pad)) / ATLAS_COLS, (cy + pad + uv.getY(i) * (1 - 2 * pad)) / ATLAS_ROWS);
    }
    if (sh) geo.deleteAttribute('shade');
    if (!uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    buckets[kind].push(geo);
    const j = m.parent;
    for (const c of [...m.children]) j.attach(c);
    j.remove(m);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const mats = {
    lit: new THREE.MeshLambertMaterial({ map: atlas(C), vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.5,
      ...(C.emitCells && { emissiveMap: emitAtlas(C), emissive: 0xffffff, emissiveIntensity: C.emitK ?? 2.2 }) }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  for (const kind of ['lit', 'glow']) {
    const sm = new THREE.SkinnedMesh(mergeGeometries(buckets[kind]), mats[kind]);
    sm.frustumCulled = false; root.add(sm); sm.bind(skeleton);
  }
}

// =====================================================================
// Animation: Grundgerüst gleich, Gang und Idle pro Charakter, Nachschwingen mit eigener Trägheit
// =====================================================================
const KEYS = ['hipsY', 'lean', 'sway', 'twist', 'lHip', 'rHip', 'lKnee', 'rKnee', 'rAnkle', 'lSh', 'rSh', 'lShZ', 'rShZ', 'lEl', 'rEl', 'headX', 'headZ', 'jaw', 'gripL', 'wpn', 'wpnL'];   // wpn/wpnL = Handgelenk rechts/links (Klinge kippen)
const LAGGED = { headX: 'head', headZ: 'head', lSh: 'arm', lEl: 'arm' };
// Aktionen und Posen, die ein Charakter nicht selbst mitbringt
const UPPER = ['lSh', 'rSh', 'lShZ', 'rShZ', 'lEl', 'rEl', 'gripL', 'headX', 'headZ', 'jaw', 'wpn', 'wpnL'];
const BASE_ACTIONS = {
  cast(t, time) { const c = (Math.sin(time / 260) + 1) / 2; Object.assign(t, { rSh: -1.6 * c, lSh: -1.1 * c, rEl: -0.2, lEl: -0.3, jaw: 0.1 + 0.25 * c, gripL: 0, headX: -0.1 * c }); },
  channel(t, time) { Object.assign(t, { lSh: -2.6 + Math.sin(time / 120) * 0.05, rSh: -2.6, lShZ: 0.35, rShZ: -0.35, lEl: 0, rEl: 0, jaw: 0.22 + Math.sin(time / 70) * 0.05, headX: -0.25, gripL: 0 }); },
};
const POSES = {
  sit: { hipsY: 0.55, lHip: -1.45, rHip: -1.45, lKnee: 1.5, rKnee: 1.5, lean: 0.05, lSh: 0.2, lEl: -0.6, rSh: -0.3, rEl: -0.6, gripL: 0.4, headX: 0.1 },
  dead: { hipsY: 0.5, lHip: 0, rHip: 0.1, lKnee: 1.6, rKnee: 1.6, lean: 0.9, headX: 0.7, headZ: 0.2, lSh: 0.4, rSh: 0.3, lEl: -0.1, rEl: -0.2, jaw: 0.4, gripL: 0 },   // auf die Knie gesackt
  air: { lHip: -0.5, rHip: 0.2, lKnee: 0.9, rKnee: 0.5, lSh: -0.4, lShZ: 0.3, rSh: -0.5, rEl: -0.6, lean: 0.1, gripL: 0.3 },
};
// loco: idle | run | back | air | sit | dead · action: null | cast | channel | … · speedK: Schrittfrequenz-Faktor
// actTime: Zeit seit Start der Aktion (Spiel: Schlag beginnt bei 0); im Viewer = Uhr, dann laufen Aktionen in Schleife
function animator(R, C) {
  let phase = 0;
  const j = Object.fromEntries(KEYS.map(k => [k, 0])); j.hipsY = 1; j.swayLag = 0;
  const rest = () => ({ ...Object.fromEntries(KEYS.map(k => [k, 0])), hipsY: 1, lSh: 0.05, rSh: 0.05, lShZ: 0.1, rShZ: -0.1, lEl: -0.2, rEl: -0.5, jaw: 0.05, gripL: 0.4 });
  return function update(dt, loco, action, time, speedK = 1, actTime = time) {
    const s = dt / 1000, t = rest();
    let moving = false, spinY = 0;
    if (loco === 'run' || loco === 'back') { phase += s * C.freq * speedK * (loco === 'back' ? -0.75 : 1); C.gait(j, t, phase, s, R); moving = true; }
    else if (loco === 'idle') { phase += s * 1.6; C.idle(t, phase, time); }
    else Object.assign(t, (C.poses || {})[loco] || POSES[loco] || {});
    if (action && loco !== 'dead' && loco !== 'sit') {
      const a = rest(); (C[action] || BASE_ACTIONS[action] || BASE_ACTIONS.cast)(a, actTime);
      spinY = a.spinY || 0;                                                // Wirbelwind: ganze Figur dreht sich, ohne Glättung
      if (moving || loco === 'air') for (const key of UPPER) t[key] = a[key]; else Object.assign(t, a);   // beim Laufen nur Oberkörper
    }
    const blend = C.blend ?? 12;
    for (const key of KEYS) {
      const lagRate = moving && LAGGED[key] ? C.lag[LAGGED[key]] : blend;
      j[key] = lerp(j[key], t[key], Math.min(1, s * lagRate));
    }
    j.swayLag = lerp(j.swayLag, j.sway, Math.min(1, s * 4));
    R.hips.position.y = j.hipsY;
    R.hips.rotation.set(0, j.twist + spinY, j.sway * 0.5);
    R.torso.rotation.set(j.lean, -j.twist * 1.6, -j.sway);
    R.neck.rotation.set(j.headX, j.twist * 0.6, j.headZ + j.sway * 0.4);
    R.jaw.rotation.x = j.jaw;
    const st = C.stance || 0;                                               // breiter Stand (Krieger)
    R.legL.hip.rotation.set(j.lHip, 0, -j.sway * 0.5 + st); R.legR.hip.rotation.set(j.rHip, 0, -j.sway * 0.5 - st);
    R.legL.ankle.rotation.z = -st; R.legR.ankle.rotation.z = st;
    R.legL.knee.rotation.x = j.lKnee; R.legR.knee.rotation.x = j.rKnee;
    R.legL.ankle.rotation.x = -j.lKnee * 0.35 - j.lHip * 0.2; R.legR.ankle.rotation.x = -j.rKnee * 0.35 - j.rHip * 0.2 + j.rAnkle;
    R.armL.shoulder.rotation.set(j.lSh, 0, j.lShZ); R.armR.shoulder.rotation.set(j.rSh, 0, j.rShZ);
    R.armL.elbow.rotation.x = j.lEl; R.armR.elbow.rotation.x = j.rEl;
    // Finger beugen zur Handfläche (die zeigt zum Körper) = Drehung um z; Daumen legt sich vorn um den Stab
    const curl = (fingers, g) => { for (const segs of fingers) segs.forEach((f, i) => { const a = segs.thumb ? g * [0.5, 0.7][i] : g * [0.9, 1.15, 0.8][i]; f.rotation.z = -segs.side * a; }); };
    curl(R.armR.fingers, 1.25);
    curl(R.armL.fingers, 0.15 + j.gripL * 0.9);
    // Stab bleibt grob aufrecht: Schulter- und Ellbogendrehung (gegenüber der Ruhehaltung) werden am Griff ausgeglichen
    if (C.rigidWeapon) R.staff.rotation.x = C.weaponX + j.wpn;              // Schwert: fest in der Faust, nur das Handgelenk kippt
    else {                                                                  // Stab: bleibt grob aufrecht
      R.staff.rotation.x = 0.5 - ((j.rSh - 0.05) + (j.rEl + 0.5) + j.lean) * 0.85;
      R.staff.rotation.z = -(j.rShZ + 0.1) * 0.85;
    }
    if (R.holdL) R.holdL.rotation.x = C.weaponX + j.wpnL;                 // zweite Waffe links (Äxte)
    R.action = action; R.actTime = actTime;
    if (C.extra) C.extra(R, j, time);
    const pulse = 1 + Math.sin(time / 300) * 0.08 + (action ? 0.4 : 0);
    if (R.crystalGlow) { R.crystalGlow.scale.setScalar(0.55 * pulse); R.crystal.rotation.y = time / 1500; }
  };
}

function buildChar(P, C) {
  const M = makeMats(C);
  const R = C.build ? C.build(M, C) : buildBase(P, C, M);
  if (!C.build) C.clothe(R, P, M);
  skinMerge(R.root, C);
  R.anchors = { crystal: R.crystal, handL: R.armL.wrist };
  return R;
}

// =====================================================================
// Spiel-Schnittstelle: Krieger (4 Waffen), Samurai, Ninja. Die Magier stehen ganz unten.
// =====================================================================
export const RUN_REF = 3.9;                                               // yd/s, bei denen die Schritte zum Boden passen (Rots Messwert für die Magier, hier ungeprüft)
export const WEAPONS = ['sword', 'axes', 'hammer', 'anchor'];
const WEAPON_CHAR = { sword: WARRIOR, axes: WAR_AXES, hammer: WAR_HAMMER, anchor: WAR_ANCHOR };
// Dauer der Aktionen (ms) und Anteile, an denen onHit feuert. Das Spiel hält eine Aktion so lange gesetzt.
export const WAR_TIMING = {
  sword: { attack: 1200, smash: 1300, thunderclap: 1500 },
  axes: { attack: 900, smash: 1400 }, hammer: { attack: 1400, smash: 1500 }, anchor: { attack: 1300, smash: 1600 },
  whirlwind: null, warcry: null,                                          // laufen, solange gesetzt
};
export const SAMURAI_TIMING = {
  attack: 800, iai: 1200, twoheavens: 1300, crescent: 1600, deathwatch: 1800,
  move: { iai: { from: 0.2, to: 0.27, yd: 6 } },                         // Spiel bewegt den Spieler in diesem Fenster 6 yd nach vorn
};
const SAMURAI_ACTION = { iai: 'atk1', twoheavens: 'atk2', crescent: 'atk3', deathwatch: 'atk4' };
export const NINJA_TIMING = {
  attack: 700, shadowstep: 1000, twinblades: 1100, smokebomb: 1400, ghoststorm: 1800,
  move: { shadowstep: { from: 0.2, to: 0.3, yd: 7 } },                      // Spiel bewegt den Spieler in diesem Fenster 7 yd nach vorn
  hidden: { shadowstep: [0.2, 0.3], smokebomb: [0.22, 0.7] },             // Modell unsichtbar (Spiel: nicht angreifbar, Aggro weg)
};
const NINJA_ACTION = { shadowstep: 'atk1', twinblades: 'atk2', smokebomb: 'atk3', ghoststorm: 'atk4' };
function dimForNoBloom(R) {                                               // ohne Bloom Glühfarben auf ≤ 1 holen, sonst brennen sie aus
  const g = glowOf(R).geometry.attributes.color;
  for (let i = 0; i < g.count; i++) { const m = Math.max(g.getX(i), g.getY(i), g.getZ(i), 1); g.setXYZ(i, g.getX(i) / m, g.getY(i) / m, g.getZ(i) / m); }
  g.needsUpdate = true;
}
function wrap(C, bloom, toAction) {
  const R = buildChar(POLY.wenig, C);
  R.noMove = true;
  if (!bloom) dimForNoBloom(R);
  const fig = animator(R, C);
  let clock = 0, actKey = null, actStart = 0;
  const api = {
    root: R.root, fx: R.fx, onHit: null,
    anchors: { crystal: R.crystal, handL: R.armL.wrist, handR: R.armR.wrist },
    // dt: Sekunden oder Millisekunden (Werte > 1 gelten als ms). anim: { state, speed (yd/s), attack, ability, frozen }
    update(dt, anim) {
      let ms = dt > 1 ? dt : dt * 1000;
      if (anim.frozen) ms = 0;
      clock += ms;
      const action = toAction(anim);
      if (action !== actKey) { actKey = action; actStart = clock; }
      const loco = anim.state || 'idle', speedK = loco === 'run' || loco === 'back' ? Math.max(0.3, (anim.speed || RUN_REF) / RUN_REF) : 1;
      fig(ms, loco, action, clock, speedK, clock - actStart);
    },
  };
  R.onHit = (kind, x, z, i) => { if (api.onHit) api.onHit(kind, x, z, i); };
  return api;
}
// weapon: 'sword' | 'axes' | 'hammer' | 'anchor'
// anim.attack → Attacke 1 der Waffe (Schwert: Kombo). anim.ability: 'smash' → Attacke 2 der Waffe (Schwert: Smash),
// 'whirlwind' | 'thunderclap' | 'warcry' gehen mit jeder Waffe.
// onHit(kind, x, z, i): Schwert 'cast'|'smash'|'thunderclap'; andere Waffen 'atk1'|'atk2', Hammer zusätzlich 'nachbeben', Anker 'anker' (Rückzug).
export function buildWarrior({ bloom = false, weapon = 'sword' } = {}) {
  const C = WEAPON_CHAR[weapon] || WARRIOR, sword = C === WARRIOR;
  return wrap(C, bloom, anim => {
    if (anim.ability === 'smash') return sword ? 'smash' : 'atk2';
    if (anim.ability) return anim.ability;
    if (anim.attack) return sword ? 'cast' : 'atk1';
    return null;
  });
}
// anim.attack → Kesagiri; anim.ability: 'iai' | 'twoheavens' | 'crescent' | 'deathwatch'
// onHit(kind, x, z, i): 'cast' (Klinge), 'atk1' (Ende des Iai-Sprints, Linie vom Start; i 0 = nur Staub beim Start, ohne onHit),
// 'atk2' i 0 Kreuzschnitt vorn / i 1 Drehung am Spieler, 'atk3' Start der Sichelwelle (fliegt 14 yd/s geradeaus), 'atk4' i 0–2 am Spieler
export function buildSamurai({ bloom = false } = {}) {
  return wrap(SAMURAI, bloom, anim => anim.ability ? SAMURAI_ACTION[anim.ability] || null : anim.attack ? 'cast' : null);
}
// anim.attack → Doppelschnitt; anim.ability: 'shadowstep' | 'twinblades' | 'smokebomb' | 'ghoststorm'
// onHit(kind, x, z, i): 'cast' (Klinge), 'atk1' (Ende des Schattenschritts, Linie vom Start), 'atk2' i 0–2 Wechselschnitte an der Klinge / i 3 Kreuzschnitt vorn,
// 'rauch' (Rauchbombe gezündet), 'atk3' (Drehschnitt beim Auftauchen), 'atk4' i 0–2 am Spieler (Geisterklinge kreist bis 4,5 yd)
export function buildNinja({ bloom = false } = {}) {
  return wrap(NINJA, bloom, anim => anim.ability ? NINJA_ACTION[anim.ability] || null : anim.attack ? 'cast' : null);
}

// =====================================================================
// Spiel-Schnittstelle: Magier (vorher mageModel.ts, Code unverändert übernommen)
// =====================================================================
function dimGlow(R) {                                   // ohne Bloom: Glühfarben auf ≤ 1, sonst brennen sie weiß aus
  R.root.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.isMeshLambertMaterial && m.emissiveMap) m.emissiveIntensity = 1;
    if (m.isMeshBasicMaterial && m.vertexColors) {
      const c = o.geometry.attributes.color;
      for (let i = 0; i < c.count; i++) { const k = Math.max(1, c.getX(i), c.getY(i), c.getZ(i)); c.setXYZ(i, c.getX(i) / k, c.getY(i) / k, c.getZ(i) / k); }
      c.needsUpdate = true;
    }
  });
  if (R.crystal.material) norm(R.crystal.material.color);
}

// anim = { state: 'idle'|'run'|'back'|'air'|'sit'|'dead', speed, cast, channel, attack, frozen }
// trail.mesh gehört in die Szene (Weltkoordinaten), nicht unter root.
const norm = c => c.multiplyScalar(1 / Math.max(1, c.r, c.g, c.b));
export const SKINS = { alle: HOOD, frost: ICE, feuer: FIRE, arkan: ARCANE };
// Spielregeln pro Skin. Die Spiellogik wendet sie an; das Modell liefert nur Spuren (trail.zones()) und Werte.
export const SKIN_FX = {
  alle: {},
  frost: { trail: 'frost', slow: 0.3, slowMs: 1500 },  // wie Improved Blizzard Rang 1 (mechanics-spec): 30 % für 1,5 s, solange der Mob auf einer Spur steht
  feuer: { trail: 'fire', dps: 5 },                     // PLATZHALTER „bissi dmg“: Schaden pro Sekunde pro Mob, Spuren stapeln nicht
  arkan: { speedMul: 1.1, float: true },                // schwebt, 10 % schneller, keine Spuren
};
export function buildMage(skin = 'alle', { bloom = false } = {}) {
  const C = SKINS[skin] || SKINS.alle, R = buildChar(POLY.wenig, C), step = animator(R, C), watch = stepWatcher(R);
  const trail = C.trail ? makeTrail(C.trail) : null;
  if (!bloom) dimGlow(R);
  let clock = 0;
  return {
    root: R.root,
    anchors: { ...R.anchors, handR: R.armR.wrist },     // handR: für spätere Waffen (handoff-waffen)
    trail,
    fx: SKIN_FX[skin] || SKIN_FX.alle,
    update(dt, anim = {}) {
      const ms = Math.min(100, dt > 1 ? dt : dt * 1000);   // nimmt Sekunden oder Millisekunden
      if (trail) trail.update(ms / 1000);
      if (anim.frozen) return;                      // eingefroren: Pose bleibt stehen
      clock += ms;
      const st = anim.state || 'idle';
      const loco = ['run', 'back', 'air', 'sit', 'dead'].includes(st) ? st : 'idle';
      const action = anim.channel ? 'channel' : (anim.cast || anim.attack) ? 'cast' : null;
      const speedK = anim.speed ? Math.min(1.8, Math.max(0.5, anim.speed / RUN_REF)) : 1;
      step(ms, loco, action, clock, speedK);
      if (!bloom) norm(R.crystal.material.color);   // Kapuze färbt den Kristall jedes Bild neu
      if (trail && (loco === 'run' || loco === 'back')) { R.root.updateMatrixWorld(true); watch((x, y, z, a, side) => trail.add(x, y, z, a, side)); }
    },
  };
}

// =====================================================================
// Krieger (Real Men Mode)
// =====================================================================
// anim = { state: 'idle'|'run'|'back'|'air'|'sit'|'dead', speed, attack, ability: null|'whirlwind'|'smash'|'thunderclap'|'warcry', frozen }
// Eine Aktion startet bei Phase 0, sobald sie sich ändert. Einmal-Aktionen so lange gesetzt lassen, wie WAR_TIMING sagt.
// onHit(kind, x, z): genau im Moment, in dem die Klinge trifft (kind 'cast' = Grundangriff, 'smash', 'thunderclap').
// Wirbelwind meldet keine Treffer; das Spiel tickt selbst, solange ability === 'whirlwind'.
