// @ts-nocheck
// Frost Grind – Spielermodell (Vanilla-Rig + Skins). Automatisch aus dem Viewer „Frost Grind – MC-Modell“ gezogen:
// nur der Code, den die vier Spiel-Skins brauchen. Änderungen am besten im Viewer machen und neu ziehen.
// Schnittstelle: buildMage(skin) und buildWarrior() → { root, update(dt, anim), anchors: { crystal, handL, handR } }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const H = 1.0 / 0.53;
const L = { thigh: 0.245 * H, shank: 0.246 * H, upper: 0.186 * H, fore: 0.146 * H, kneeY: 0.285 * H, ankleY: (0.285 - 0.246) * H, shoulderY: 1.546 };
const HIP_X = 0.09, TEX = 512;
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
function weave(g, s, step, dark, light, k = 1) {
  for (let y = 0; y < s; y += step) { g.fillStyle = `rgba(${dark},${rand(0.06, 0.13) * k})`; g.fillRect(0, y, s, 1); }
  for (let x = 0; x < s; x += step) { g.fillStyle = `rgba(${light},${rand(0.03, 0.07) * k})`; g.fillRect(x, 0, 1, s); }
  for (let i = 0; i < s * 6; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? dark : light},${rand(0.04, 0.1) * k})`; g.fillRect(rand(0, s), rand(0, s), rand(1, 4), 1); }
}
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
function pipeFold(g, x, y0, y1, w, shadow, light, alpha) {
  for (const [dx, col, ww] of [[w * 0.35, shadow, w * 0.5], [-w * 0.25, light, w * 0.35]]) {
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, `rgba(${col},0)`); grd.addColorStop(0.35, `rgba(${col},${alpha})`); grd.addColorStop(1, `rgba(${col},${alpha * 0.6})`);
    g.fillStyle = grd; g.beginPath();
    g.moveTo(x + dx, y0); g.quadraticCurveTo(x + dx + ww * 0.6, (y0 + y1) / 2, x + dx + ww, y1);
    g.lineTo(x + dx - ww * 0.3, y1); g.quadraticCurveTo(x + dx - ww * 0.1, (y0 + y1) / 2, x + dx, y0); g.fill();
  }
}
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
const garmentY = (spec, y) => 1 - (y - spec.yBot) / (spec.yTop - spec.yBot);
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
const T1Y = 1.535, T12Y = 1.255;
const spineZ = y => y > T1Y ? -0.03 + 0.012 * Math.sin(Math.PI * (y - T1Y) / 0.15)
  : y > T12Y ? -0.03 - 0.025 * Math.sin(Math.PI * (T1Y - y) / (T1Y - T12Y))
  : -0.03 + 0.03 * Math.sin(Math.PI * (T12Y - y) / 0.27);
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
function paintLimbBone(s) {
  return canvas(s, (g) => {
    g.drawImage(rotated(paintBone(s, 'cyl')), 0, 0);
    hGrad(g, s, [[0, 'rgba(45,28,12,0.7)'], [0.1, 'rgba(45,28,12,0)'], [0.9, 'rgba(45,28,12,0)'], [1, 'rgba(45,28,12,0.7)']]);
    blotches(g, s, 12, 'rgba(70,50,25,0.3)', [0.03, 0.08]);
    strokes(g, s, 120, ['#3e2c18'], { angle: 0, len: [0.05, 0.15], w: [1, 1.5], a: [0.25, 0.45] });   // Muskelansatz-Rillen längs
  });
}
function paintHandBone(s) {
  return canvas(s, (g) => {
    g.drawImage(rotated(paintBone(s, 'cyl')), 0, 0);
    hGrad(g, s, [[0, 'rgba(45,28,12,0.75)'], [0.14, 'rgba(45,28,12,0)'], [0.86, 'rgba(45,28,12,0)'], [1, 'rgba(45,28,12,0.75)']]);
    blotches(g, s, 8, 'rgba(70,50,25,0.3)', [0.02, 0.06]);
    blotches(g, s, 4, 'rgba(80,100,50,0.22)', [0.02, 0.05]);
  });
}
const HL = 0.108 * H;
const HAND = {
  zK: [0.031, 0.011, -0.01, -0.028],                     // Knöchel (vorn = Daumenseite)
  zB: [0.014, 0.005, -0.005, -0.014],                    // Basis an der Handwurzel
  kY: [-0.097, -0.102, -0.097, -0.088].map(v => v * HL / 0.204),
  len: [0.092, 0.102, 0.097, 0.075].map(v => v * HL / 0.204),
  ph: [[0.495, 0.288, 0.217], [0.485, 0.318, 0.197], [0.468, 0.312, 0.22], [0.47, 0.279, 0.251]],
  rB: [0.0046, 0.0047, 0.0043, 0.004],                   // Knochenradius Mittelhand
  rF: [0.0094, 0.0098, 0.0092, 0.008],                   // Fingerradius mit Fleisch
};
const FOOT_K = 1.0;
const FL = 0.152 * H * FOOT_K;
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
const CELLS = { bone: 0, boneTube: 1, boneFlat: 2, cranium: 3, shell: 4, pants: 5, woodTube: 6, inner: 7, accent: 8, foot: 9, arm: 10, hand: 11 };
const ATLAS_COLS = 4, ATLAS_ROWS = 3;
function makeMats(C) {
  const cells = C.cells || CELLS;
  const tag = (name, kind = 'lit', color = 0xffffff) => { const m = new THREE.MeshBasicMaterial({ color }); m.userData = { cell: cells[name], kind }; return m; };
  const M = {};
  for (const k of Object.keys(cells)) M[k] = tag(k);
  M.eye = tag('bone', 'glow', new THREE.Color(...C.eyeCol));
  M.crystal = new THREE.MeshBasicMaterial({ color: new THREE.Color(...(C.crystalCol || [0.8, 1.8, 2.8])) });
  return M;
}
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
const jacketWeights = ({ torso, hips, armL, armR, legL, legR }) => p => {
  const wT = smooth(0.98, 1.12, p.y), wL = 0.7 * smooth(1.0, 0.9, p.y), k = clamp01(0.5 + p.x / 0.2);
  const wS = 0.35 * smooth(0.16, 0.235, Math.abs(p.x)) * smooth(1.45, 1.52, p.y);
  return [[torso, wT * (1 - wS)], [p.x > 0 ? armL.shoulder : armR.shoulder, wT * wS], [hips, Math.max(0, 1 - wT - wL)], [legL.hip, wL * k], [legR.hip, wL * (1 - k)]];
};
const lapelW = t => t < 0.2 ? 0.038 : t < 0.27 ? lerp(0.038, 0.012, smooth(0.2, 0.27, t)) : 0.078 * smooth(0.27, 0.36, t) * (1 - smooth(0.4, 1, t)) + 0.012 * (1 - smooth(0.27, 0.4, t));
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
const LOW_CELLS = { face: 0, bone: 1, hand: 2, foot: 3, shell: 4, pants: 5, woodTube: 6, inner: 7, accent: 8, sleeve: 9, satin: 10, cranium: 11 };
const LOWP = { pants: [8, 9], fr: 3 };
const LOW_JACKET = { ...GENT_JACKET, armSin: 0.95, fold: (y, a) => 0.035 * smooth(1.25, 0.95, y) * (0.5 + 0.5 * Math.sin(a * 3 + 1)) + 0.012 * (1 + Math.sin(a * 2 + y * 9)) };
const LOW_SHIRT = { ...GENT_SHIRT, yBot: 1.12, RX: GENT_SHIRT.RX.map(([y, r]) => [y, r * lerp(0.93, 1, smooth(1.2, 1.35, y))]), fold: null };
const FACE = { x0: -0.09, x1: 0.09, y0: -0.165, y1: 0.015 };
const CRAN = { y0: -0.06, y1: 0.088 };
const faceUV = (x, y) => [(x - FACE.x0) / (FACE.x1 - FACE.x0), (y - FACE.y0) / (FACE.y1 - FACE.y0)];
const LIT = '255,244,214', SHD = '46,26,62', DEEP = '14,8,20';
const rgba = (c, a) => `rgba(${c},${a})`;
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
function lowForearm(elbow, M, side, k = 1.35) {                        // k > 1,35: Fleisch (Elle und Speiche verschmelzen)
  const Lf = L.fore;
  add(elbow, tube([[0, 0.022, -0.016], [0, -0.01, -0.013], [side * 0.002, -Lf * 0.5, -0.012], [side * 0.003, -Lf + 0.004, -0.013]], 0.0062 * k, 4, 4,
    { oval: (v, tg, t) => v.multiplyScalar(table([[0, 1.9], [0.15, 1.2], [0.6, 0.85], [1, 1.25]], t)) }), M.bone);           // Elle
  add(elbow, tube([[0, -0.006, 0.01], [0, -Lf * 0.3, 0.012], [side * 0.001, -Lf * 0.7, 0.013], [0, -Lf + 0.002, 0.012]], 0.0055 * k, 4, 4,
    { oval: (v, tg, t) => v.multiplyScalar(table([[0, 1.3], [0.15, 1.0], [0.6, 1.1], [1, 1.8]], t)) }), M.bone);             // Speiche
}
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
function soft(g, x, y, rx, ry, c, a) {                                    // weicher Fleck: Licht oder Schatten
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx); grd.addColorStop(0, rgba(c, a)); grd.addColorStop(1, rgba(c, 0));
  g.fillStyle = grd; g.fillRect(-rx, -rx, 2 * rx, 2 * rx); g.restore();
}
function band(g, s, y0, y1, c, a) {                                       // waagrechter Schatten, oben am stärksten
  const grd = g.createLinearGradient(0, y0, 0, y1); grd.addColorStop(0, rgba(c, a)); grd.addColorStop(1, rgba(c, 0));
  g.fillStyle = grd; g.fillRect(0, y0, s, y1 - y0);
}
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
const BONE_CELLS = [0, 1, 2, 3, 11], CLOTH_CELLS = [4, 5, 7, 8, 9, 10];
const FIRE_CRACKS = Array.from({ length: 12 }, () => walk(rand(0.1, 0.9), rand(0.1, 0.9)));
const BURN_HOLES = [[0.25, 0.5, 0.05, 0.035], [0.65, 0.72, 0.04, 0.03], [0.12, 0.82, 0.05, 0.035]];
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
const SCHOOLS = [[0.8, 1.8, 2.8], [2.8, 1.0, 0.25], [2.2, 0.9, 2.9]];
const wave = (time, ms) => (time / ms) % 1;
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
const TRAIL = { max: 10, life: 5, r: 0.45 };
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
function makeTrail(kind) {
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
function stepWatcher(R) {
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
const SKIN = { ...LOW, extra(R, j, time) { GENT_BASE.extra(R, j, time); if (this.animate) this.animate(R, time); } };
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
function skullEmblem(g, x, y, r, bone, dark) {                         // Wappen-Schädel für Schild, Rock, Platte, Schnalle
  g.fillStyle = bone; g.beginPath(); g.arc(x, y - r * 0.15, r, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(x + r * 0.55, y + r * 0.75); g.lineTo(x - r * 0.55, y + r * 0.75); g.closePath(); g.fill();
  g.fillStyle = dark; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(x + d * r * 0.4, y, r * 0.27, r * 0.24, 0, 0, 7); g.fill(); }
  g.beginPath(); g.moveTo(x, y + r * 0.2); g.lineTo(x - r * 0.12, y + r * 0.42); g.lineTo(x + r * 0.12, y + r * 0.42); g.fill();
  g.strokeStyle = dark; g.lineWidth = Math.max(1, r * 0.06);
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * r * 0.16, y + r * 0.55); g.lineTo(x + i * r * 0.16, y + r * 0.75); g.stroke(); }
}
const EMBLEM = [0.72, 0.72, 1, 1];
function rivet(g, x, y, r) {
  g.fillStyle = 'rgba(10,10,14,0.6)'; g.beginPath(); g.arc(x + 1.5, y + 2, r, 0, 7); g.fill();
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); grd.addColorStop(0, '#d8dce4'); grd.addColorStop(1, '#3a3c44');
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}
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
    } else {                                                             // Wirbel: Windstreifen rundherum
      for (let i = 0; i < 16; i++) {
        const y = rand(0.15, 0.85) * s, x0 = rand(0, s), len = rand(0.3, 0.7) * s, grd = g.createLinearGradient(x0, 0, x0 + len, 0);
        grd.addColorStop(0, 'rgba(255,240,220,0)'); grd.addColorStop(0.7, 'rgba(255,240,220,0.8)'); grd.addColorStop(1, 'rgba(255,240,220,0)');
        g.strokeStyle = grd; g.lineWidth = rand(2, 7); g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + len, y + rand(-6, 6)); g.stroke();
      }
    }
  }));
}
function makeWarriorFx() {                                               // je Art ein Bodenquad, das wiederverwendet wird
  const group = new THREE.Group(), live = {}, SPEC = {
    crack: { life: 1.6, s0: 2.4, s1: 2.6, fadeAt: 0.6 }, dust: { life: 0.55, s0: 0.6, s1: 3.2, fadeAt: 0 }, ring: { life: 0.6, s0: 0.6, s1: 9, fadeAt: 0.3 } };
  const meshes = Object.fromEntries(Object.keys(SPEC).map(k => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: fxTex(k), transparent: true, depthWrite: false, blending: k === 'crack' ? THREE.NormalBlending : THREE.AdditiveBlending }));
    m.visible = false; group.add(m); return [k, m];
  }));
  let last = null;
  return { group,
    spawn(kind, x, y, z) { const m = meshes[kind]; m.position.set(x, y + 0.012 + (kind === 'ring' ? 0.006 : 0), z); m.rotation.y = rand(0, 7); m.visible = true; live[kind] = 0; },
    update(time) {
      const dt = last === null ? 0 : Math.min(0.1, (time - last) / 1000); last = time;
      for (const k of Object.keys(live)) {
        const sp = SPEC[k], m = meshes[k], t = (live[k] += dt) / sp.life;
        if (t >= 1) { m.visible = false; delete live[k]; continue; }
        m.scale.setScalar(lerp(sp.s0, sp.s1, 1 - (1 - t) ** 2)); m.material.opacity = 1 - smooth(sp.fadeAt, 1, t);
      }
    } };
}
function warriorAddons(R) {
  const mat = new THREE.MeshBasicMaterial({ map: fxTex('swirl'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true });   // sonst 2 Draw Calls pro Schleier
  R.swirl = [[0.95, 0.55, 0.5], [1.15, 1.15, 0.6]].map(([r, y, h]) => { const m = add(R.root, new THREE.CylinderGeometry(r, r * 0.9, h, 24, 1, true), mat, 0, y, 0); m.userData.keep = true; m.visible = false; return m; });
  R.fx = makeWarriorFx();
}
const tmpV = new THREE.Vector3();
const WAR_HITS = { cast: [1200, [0.24, 0.6]], smash: [1300, [0.47]], thunderclap: [1500, [0.42]] };
function warriorAnimate(R, time) {
  const ww = R.action === 'whirlwind';
  R.swirlK = lerp(R.swirlK || 0, ww ? 1 : 0, 0.15);
  R.swirl.forEach((m, i) => { m.material.opacity = R.swirlK * 0.75; m.visible = R.swirlK > 0.02; m.rotation.y = -time / (i ? 70 : 95); });
  const cyc = WAR_HITS[R.action];
  if (cyc) {
    const k = wave(R.actTime, cyc[0]), prev = R.fxAct === R.action ? R.fxK : k;
    for (const at of cyc[1]) if (prev < at && k >= at) {
      R.root.updateMatrixWorld(true); R.root.getWorldPosition(tmpV); const y = tmpV.y;
      if (R.action === 'thunderclap') { R.fx.spawn('ring', tmpV.x, y, tmpV.z); R.fx.spawn('dust', tmpV.x, y, tmpV.z); }
      else {
        R.crystal.getWorldPosition(tmpV);                                  // Schwertspitze
        if (R.action === 'smash') { R.fx.spawn('crack', tmpV.x, y, tmpV.z); R.fx.spawn('dust', tmpV.x, y, tmpV.z); }
      }
      if (R.onHit) R.onHit(R.action, tmpV.x, tmpV.z);
    }
    R.fxK = k;
  }
  R.fxAct = R.action;
  R.fx.update(time);
}
const mix = (t, pose, w) => { for (const k in pose) t[k] = lerp(t[k] ?? 0, pose[k], w); };
const CARRY = { rSh: -0.4, rShZ: -0.15, rEl: -2.3, wpn: -0.13 };
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
  if (atlasCache[C.id]) return atlasCache[C.id];
  const s = TEX, cells = C.atlasCells(s, C);
  const big = document.createElement('canvas'); big.width = s * ATLAS_COLS; big.height = s * ATLAS_ROWS;
  const bg = big.getContext('2d'); cells.forEach((c, i) => bg.drawImage(c, (i % ATLAS_COLS) * s, Math.floor(i / ATLAS_COLS) * s, s, s));
  const tex = toTex(big);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return (atlasCache[C.id] = tex);
}
const emitCache = {};
function emitAtlas(C) {                                                  // Leuchtmaske: schwarz = leuchtet nicht
  if (emitCache[C.id]) return emitCache[C.id];
  const s = TEX, big = document.createElement('canvas'); big.width = s * ATLAS_COLS; big.height = s * ATLAS_ROWS;
  const bg = big.getContext('2d'); bg.fillStyle = '#000'; bg.fillRect(0, 0, big.width, big.height);
  C.emitCells(s, C).forEach((c, i) => c && bg.drawImage(c, (i % ATLAS_COLS) * s, Math.floor(i / ATLAS_COLS) * s, s, s));
  return (emitCache[C.id] = toTex(big));
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
const KEYS = ['hipsY', 'lean', 'sway', 'twist', 'lHip', 'rHip', 'lKnee', 'rKnee', 'rAnkle', 'lSh', 'rSh', 'lShZ', 'rShZ', 'lEl', 'rEl', 'headX', 'headZ', 'jaw', 'gripL', 'wpn'];
const LAGGED = { headX: 'head', headZ: 'head', lSh: 'arm', lEl: 'arm' };
const UPPER = ['lSh', 'rSh', 'lShZ', 'rShZ', 'lEl', 'rEl', 'gripL', 'headX', 'headZ', 'jaw', 'wpn'];
const BASE_ACTIONS = {
  cast(t, time) { const c = (Math.sin(time / 260) + 1) / 2; Object.assign(t, { rSh: -1.6 * c, lSh: -1.1 * c, rEl: -0.2, lEl: -0.3, jaw: 0.1 + 0.25 * c, gripL: 0, headX: -0.1 * c }); },
  channel(t, time) { Object.assign(t, { lSh: -2.6 + Math.sin(time / 120) * 0.05, rSh: -2.6, lShZ: 0.35, rShZ: -0.35, lEl: 0, rEl: 0, jaw: 0.22 + Math.sin(time / 70) * 0.05, headX: -0.25, gripL: 0 }); },
};
const POSES = {
  sit: { hipsY: 0.55, lHip: -1.45, rHip: -1.45, lKnee: 1.5, rKnee: 1.5, lean: 0.05, lSh: 0.2, lEl: -0.6, rSh: -0.3, rEl: -0.6, gripL: 0.4, headX: 0.1 },
  dead: { hipsY: 0.5, lHip: 0, rHip: 0.1, lKnee: 1.6, rKnee: 1.6, lean: 0.9, headX: 0.7, headZ: 0.2, lSh: 0.4, rSh: 0.3, lEl: -0.1, rEl: -0.2, jaw: 0.4, gripL: 0 },   // auf die Knie gesackt
  air: { lHip: -0.5, rHip: 0.2, lKnee: 0.9, rKnee: 0.5, lSh: -0.4, lShZ: 0.3, rSh: -0.5, rEl: -0.6, lean: 0.1, gripL: 0.3 },
};
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
    R.action = action; R.actTime = actTime;
    if (C.extra) C.extra(R, j, time);
    const pulse = 1 + Math.sin(time / 300) * 0.08 + (action ? 0.4 : 0);
    if (R.crystalGlow) { R.crystalGlow.scale.setScalar(0.55 * pulse); R.crystal.rotation.y = time / 1500; }
  };
}
function buildChar(C) {
  const M = makeMats(C);
  const R = C.build(M, C);
  skinMerge(R.root, C);
  R.anchors = { crystal: R.crystal, handL: R.armL.wrist };
  return R;
}

// =====================================================================
// Spiel-Schnittstelle
// =====================================================================
export const SKINS = { alle: HOOD, frost: ICE, feuer: FIRE, arkan: ARCANE };
// Spielregeln pro Skin. Die Spiellogik wendet sie an; das Modell liefert nur Spuren (trail.zones()) und Werte.
export const SKIN_FX = {
  alle: {},
  frost: { trail: 'frost', slow: 0.3, slowMs: 1500 },  // wie Improved Blizzard Rang 1 (mechanics-spec): 30 % für 1,5 s, solange der Mob auf einer Spur steht
  feuer: { trail: 'fire', dps: 5 },                     // PLATZHALTER „bissi dmg“: Schaden pro Sekunde pro Mob, Spuren stapeln nicht
  arkan: { speedMul: 1.1, float: true },                // schwebt, 10 % schneller, keine Spuren
};
const RUN_REF = 3.9;                                    // im Spiel gemessen (Agent Rot): bei diesem anim.speed rutscht der Fuß nicht

const norm = c => c.multiplyScalar(1 / Math.max(1, c.r, c.g, c.b));
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
export function buildMage(skin = 'alle', { bloom = false } = {}) {
  const C = SKINS[skin] || SKINS.alle, R = buildChar(C), step = animator(R, C), watch = stepWatcher(R);
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
export const WAR_TIMING = { cast: WAR_HITS.cast[0], smash: WAR_HITS.smash[0], thunderclap: WAR_HITS.thunderclap[0] };
export function buildWarrior({ bloom = false } = {}) {
  const R = buildChar(WARRIOR), step = animator(R, WARRIOR);
  if (!bloom) dimGlow(R);
  let clock = 0, act = null, actStart = 0;
  const mage = {
    root: R.root,
    anchors: { ...R.anchors, handR: R.armR.wrist },     // crystal = Schwertspitze
    fx: R.fx,                                           // fx.group gehört in die Szene (Weltkoordinaten)
    onHit: null,
    update(dt, anim = {}) {
      const ms = Math.min(100, dt > 1 ? dt : dt * 1000);
      if (anim.frozen) { R.fx.update(clock); return; }
      clock += ms;
      const st = anim.state || 'idle';
      const loco = ['run', 'back', 'air', 'sit', 'dead'].includes(st) ? st : 'idle';
      const a = anim.ability === 'warcry' ? 'channel' : anim.ability || (anim.attack ? 'cast' : null);
      if (a !== act) { act = a; actStart = clock; }
      const speedK = anim.speed ? Math.min(1.8, Math.max(0.5, anim.speed / RUN_REF)) : 1;
      step(ms, loco, act, clock, speedK, clock - actStart);
    },
  };
  R.onHit = (kind, x, z) => mage.onHit && mage.onHit(kind, x, z);
  return mage;
}
