// Waffen-Baukasten der Magier: Teile, Hersteller-Material, Element-Effekte und Seltenheit, übernommen aus dem Viewer „Frost Grind – Waffen-Baukasten“
// (https://claude.ai/artifact/McdzspSdum69PJUhrWJjKy). Im Spiel nur Langer Stab und Zauberstab (keine Nebenhand, Kevin 2026-11-03).
// Statische Teile werden pro Material verschmolzen, bewegte Teile (Kopf-Edelstein, Flammen, Runen, Partikel) bleiben einzeln.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { t, lang } from '../../i18n';

// Daten aus dem Viewer. Die Spielwerte (Regeln, Zahlen) stehen in weaponRolls.ts
const RARITY = [
  { name: 'grau', color: '#b0b0b0', mult: 0.5 }, { name: 'weiß', color: '#ffffff', mult: 1 }, { name: 'grün', color: '#3fe05a', mult: 2 },
  { name: 'blau', color: '#4aa3ff', mult: 3 }, { name: 'lila', color: '#c573ff', mult: 4 }, { name: 'orange', color: '#ff9a2e', mult: 5 }];
export const TYPES = {
  staff: { name: t('wtype.staff.name'), noun: 'stab', g: 'm', slot: t('wtype.staff.slot'), rule: t('wtype.staff.rule'), heads: ['kristall', 'kaefig', 'gabel', 'ring', 'sichel'] },
  wand: { name: t('wtype.wand.name'), noun: 'zauberstab', g: 'm', slot: t('wtype.wand.slot'), rule: t('wtype.wand.rule'), heads: ['splitter', 'kugel', 'klaue', 'nadel'] },
  book: { name: t('wtype.book.name'), noun: 'buch', g: 'n', slot: t('wtype.book.slot'), rule: t('wtype.book.rule'), heads: ['auge', 'rune', 'siegel', 'maul'] },
  relic: { name: t('wtype.relic.name'), noun: 'relikt', g: 'n', slot: t('wtype.relic.slot'), rule: t('wtype.relic.rule'), heads: ['schaedel', 'laterne', 'auge', 'kugel', 'herz'] },
};
export const HEADS = {   // Name im Waffennamen, Schule des Fokus-Spells (Form verrät die Schule)
  kristall: ['Kristall', 'Frost'], sichel: ['Sichel', 'Frost'], splitter: ['Splitter', 'Frost'], nadel: ['Nadel', 'Frost'],
  kaefig: ['Käfig', 'Feuer'], gabel: ['Gabel', 'Blitz'],   // Gabel: Blitzableiter, seit v26 Blitz-Fokus
  klaue: ['Klauen', 'Feuer'], maul: ['Maul', 'Feuer'], laterne: ['Laternen', 'Feuer'],
  ring: ['Ring', 'Arkan'], kugel: ['Kugel', 'Arkan'], auge: ['Augen', 'Arkan'], rune: ['Runen', 'Arkan'], siegel: ['Siegel', 'Frost'], schaedel: ['Schädel', 'Arkan'], herz: ['Herz', 'Feuer'],
};
// Schaft/Körper: Form zeigt die Wert-Gruppe; Name je Typ
export const SHAFTS = {
  gerade: { values: ['Schaden', 'Crit'], names: { staff: 'gerade', wand: 'gerade', book: 'schlicht', relic: 'Ring' } },
  gedreht: { values: ['Abklingzeit', 'Lauftempo'], names: { staff: 'gedreht', wand: 'gedreht', book: 'Riemen', relic: 'Spirale' } },
  geknotet: { values: ['Leben', 'Regen im Kampf'], names: { staff: 'geknotet', wand: 'geknotet', book: 'Schnallen', relic: 'Klaue' } },
  segmentiert: { values: ['Mana', 'Dauereffekte'], names: { staff: 'segmentiert', wand: 'segmentiert', book: 'Metallecken', relic: 'Käfig' } },
  umwickelt: { values: ['Radius'], names: { staff: 'umwickelt', wand: 'umwickelt', book: 'Kette', relic: 'Kette' } },
};
export const EXTRAS = { baender: t('wextra.baender'), ketten: t('wextra.ketten'), federn: t('wextra.federn'), gloeckchen: t('wextra.gloeckchen') };
export const ELEMENTS = {
  none: { name: t('element.none.name'), color: 0x000000, adj: '' },
  frost: { name: t('element.frost.name'), color: 0x9fe4ff, adj: t('element.frost.adj'), fx: t('element.frost.fx') },
  feuer: { name: t('element.feuer.name'), color: 0xff7a22, adj: t('element.feuer.adj'), fx: t('element.feuer.fx') },
  arkan: { name: t('element.arkan.name'), color: 0xd070ff, adj: t('element.arkan.adj'), fx: t('element.arkan.fx') },
  blitz: { name: t('element.blitz.name'), color: 0xffe866, adj: t('element.blitz.adj'), fx: t('element.blitz.fx') },
  blut: { name: t('element.blut.name'), color: 0xe0202e, adj: t('element.blut.adj'), fx: t('element.blut.fx') },   // seit v28 statt Gift und Void: nur Schulen, die es im Spiel gibt
  dunkel: { name: t('element.dunkel.name'), color: 0xff2440, adj: t('element.dunkel.adj'), fx: t('element.dunkel.fx') },
};
export const elementColor = el => `#${ELEMENTS[el].color.toString(16).padStart(6, '0')}`;   // CSS-Farbe für UI
export const MAKERS = {
  grab: { name: t('maker.grab.name'), gen: t('maker.grab.gen'), trait: t('maker.grab.trait'), main: 'bone', accent: 'rust', detail: 'leather', thick: 1.35, radial: 7, bend: 0, float: false },
  stern: { name: t('maker.stern.name'), gen: t('maker.stern.gen'), trait: t('maker.stern.trait'), main: 'brass', accent: 'brass', detail: 'glass', thick: 0.75, radial: 12, bend: 0, float: false },
  morra: { name: t('maker.morra.name'), gen: t('maker.morra.gen'), trait: t('maker.morra.trait'), main: 'wood', accent: 'wood', detail: 'glass', thick: 1.0, radial: 7, bend: 0.07, float: false },
  vey: { name: t('maker.vey.name'), gen: t('maker.vey.gen'), trait: t('maker.vey.trait'), main: 'crystal', accent: 'crystal', detail: 'brass', thick: 0.9, radial: 6, bend: 0, float: true },
  brandt: { name: t('maker.brandt.name'), gen: t('maker.brandt.gen'), trait: t('maker.brandt.trait'), main: 'steel', accent: 'steel', detail: 'leather', thick: 1.1, radial: 6, bend: 0, float: false },
};

// Deutsch baut ein Wort mit Endung nach Geschlecht (Eisiger Kristallstab der Grabkammer), Englisch reiht Wörter (Icy Crystal Staff of the Crypt)
export function weaponNameOf(s) {
  const T = TYPES[s.type], el = ELEMENTS[s.element], head = t(`whead.${s.head}`);
  if (lang === 'de') return `${el.adj ? `${el.adj}${T.g === 'm' ? 'er' : 'es'} ` : ''}${head}${T.noun} ${MAKERS[s.maker].gen}`;
  return `${el.adj ? `${el.adj} ` : ''}${head} ${t(`wtype.${s.type}.noun`)} ${MAKERS[s.maker].gen}`;
}

function canvasTex(size, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function strokes(g, s, n, cols, vertical, w = [1, 3], a = [0.1, 0.3]) {
  for (let i = 0; i < n; i++) { g.strokeStyle = cols[i % cols.length]; g.globalAlpha = rnd(a[0], a[1]); g.lineWidth = rnd(w[0], w[1]); g.beginPath();
    const x = rnd(0, s), y = rnd(0, s), l = rnd(8, 40); vertical ? (g.moveTo(x, y), g.lineTo(x + rnd(-2, 2), y + l)) : (g.moveTo(x, y), g.lineTo(x + l, y + rnd(-2, 2))); g.stroke(); }
  g.globalAlpha = 1;
}
function blot(g, s, n, col, r = [3, 12]) { for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.arc(rnd(0, s), rnd(0, s), rnd(r[0], r[1]), 0, 7); g.fill(); } }
const TEX = {
  bone: () => canvasTex(256, (g, s) => { g.fillStyle = '#d8c7a0'; g.fillRect(0, 0, s, s); strokes(g, s, 120, ['#b8a27a', '#f2e6c8'], true); blot(g, s, 14, 'rgba(90,60,40,0.25)');
    g.strokeStyle = 'rgba(60,40,30,0.6)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); let x = rnd(0, s), y = rnd(0, s); g.moveTo(x, y); for (let k = 0; k < 5; k++) g.lineTo(x += rnd(-10, 10), y += rnd(4, 14)); g.stroke(); } }),
  rust: () => canvasTex(256, (g, s) => { g.fillStyle = '#5c5550'; g.fillRect(0, 0, s, s); strokes(g, s, 160, ['#3a3530', '#7a726a'], false); blot(g, s, 30, 'rgba(160,80,30,0.45)', [4, 16]); }),
  leather: () => canvasTex(256, (g, s) => { g.fillStyle = '#4a2c18'; g.fillRect(0, 0, s, s); blot(g, s, 60, 'rgba(20,10,5,0.25)', [2, 8]); strokes(g, s, 80, ['#6a4224', '#2a160a'], false);
    g.fillStyle = 'rgba(230,200,150,0.7)'; for (let x = 4; x < s; x += 16) g.fillRect(x, s * 0.1, 8, 2); }, [1, 3]),
  brass: () => canvasTex(256, (g, s) => { const grd = g.createLinearGradient(0, 0, s, 0); grd.addColorStop(0, '#6a4a18'); grd.addColorStop(0.4, '#e2b45a'); grd.addColorStop(0.55, '#fff0b8'); grd.addColorStop(1, '#8a6224');
    g.fillStyle = grd; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(70,45,10,0.6)'; g.lineWidth = 2; for (let y = 10; y < s; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
    for (let y = 22; y < s; y += 48) for (let x = 10; x < s; x += 20) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.stroke(); } }),
  wood: () => canvasTex(256, (g, s) => { g.fillStyle = '#3a2618'; g.fillRect(0, 0, s, s); strokes(g, s, 200, ['#5a3a22', '#1e120a', '#6e4a2c'], true, [2, 5], [0.3, 0.6]); blot(g, s, 8, 'rgba(10,6,4,0.6)', [3, 7]); }, [1, 3]),
  crystal: () => canvasTex(256, (g, s) => { const grd = g.createLinearGradient(0, 0, s, s); grd.addColorStop(0, '#e8f4ff'); grd.addColorStop(0.5, '#a8c4e0'); grd.addColorStop(1, '#f6fbff');
    g.fillStyle = grd; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(rnd(0, s), 0); g.lineTo(rnd(0, s), s); g.stroke(); } }),
  steel: () => canvasTex(256, (g, s) => { const grd = g.createLinearGradient(0, 0, s, 0); grd.addColorStop(0, '#3e4148'); grd.addColorStop(0.5, '#a8adb6'); grd.addColorStop(1, '#4a4d55');
    g.fillStyle = grd; g.fillRect(0, 0, s, s); strokes(g, s, 200, ['#c8ccd4', '#2a2c30'], true, [1, 2], [0.1, 0.25]);
    for (let y = 16; y < s; y += 64) for (let x = 8; x < s; x += 32) { g.fillStyle = '#2a2c30'; g.beginPath(); g.arc(x + 1, y + 1, 5, 0, 7); g.fill(); g.fillStyle = '#d8dce4'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } }),
  paper: () => canvasTex(128, (g, s) => { g.fillStyle = '#e8dcb8'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(120,90,50,0.5)'; for (let y = 4; y < s; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } }),
};
const texCache: any = {}; const tex = k => texCache[k] || (texCache[k] = TEX[k]());
// Materialien pro Waffe neu (grau entsättigt sie)
function makeMats(spec) {
  const M = MAKERS[spec.maker], dim = spec.rarity === 0 ? 0.55 : 1;
  const lit = (k, extra = {}) => {
    if (k === 'glass') return new THREE.MeshLambertMaterial({ color: new THREE.Color(0.75, 0.9, 1).multiplyScalar(dim), transparent: true, opacity: 0.45, ...extra });
    if (k === 'crystal') return new THREE.MeshLambertMaterial({ map: tex(k), color: new THREE.Color(1, 1, 1).multiplyScalar(dim), transparent: true, opacity: 0.8, emissive: 0x22303c, ...extra });
    return new THREE.MeshLambertMaterial({ map: tex(k), color: new THREE.Color(1, 1, 1).multiplyScalar(dim * (k === 'brass' || k === 'steel' ? 1.25 : 1.1)), ...extra });
  };
  const el = ELEMENTS[spec.element], hasEl = spec.element !== 'none';
  let gem;
  if (hasEl && spec.rarity >= 2) gem = new THREE.MeshBasicMaterial({ color: new THREE.Color(el.color).multiplyScalar(1.6) });     // grün+: leuchtet in Element-Farbe
  else if (hasEl) gem = new THREE.MeshLambertMaterial({ color: el.color, emissive: new THREE.Color(el.color).multiplyScalar(0.15) });   // weiß: nur gefärbt
  else gem = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.85, 0.85, 0.9).multiplyScalar(dim), emissive: 0x111118, transparent: true, opacity: 0.85 });
  return { main: lit(M.main), accent: lit(M.accent), detail: lit(M.detail), paper: lit('paper'), gem, dark: new THREE.MeshLambertMaterial({ color: 0x15121a }) };
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, parent, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
function tubeAlong(pts, r, radial, mat, parent, closed = false, segs = 24) {
  const c = new THREE.CatmullRomCurve3(pts, closed); return mesh(new THREE.TubeGeometry(c, segs, r, radial, closed), mat, parent);
}
function helix(y0, y1, r, turns, n = 40, phase = 0) { const p = []; for (let i = 0; i <= n; i++) { const t = i / n, a = phase + t * turns * Math.PI * 2; p.push(V(Math.cos(a) * r, y0 + (y1 - y0) * t, Math.sin(a) * r)); } return p; }
function chain(parent, from, to, mat, link = 0.03) {
  const n = Math.max(2, Math.round(from.distanceTo(to) / (link * 1.6))), g = new THREE.TorusGeometry(link * 0.6, link * 0.18, 4, 8);
  for (let i = 0; i <= n; i++) { const m = mesh(g, mat, parent); m.position.lerpVectors(from, to, i / n); m.lookAt(to); m.rotateZ(i % 2 ? Math.PI / 2 : 0); }
}
// Schaft entlang y: Form = Wertgruppe, Hersteller = Material/Querschnitt/Biegung/Schweben
function shaft(parent, spec, M, mats, y0, y1, r) {
  const n = 8, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, y = y0 + (y1 - y0) * t; pts.push(V(Math.sin(t * 9 + spec.seed % 7) * M.bend * (y1 - y0) * 0.15, y, Math.cos(t * 6) * M.bend * (y1 - y0) * 0.1)); }
  const pieces = M.float ? [[0, 0.3], [0.34, 0.64], [0.68, 1]] : [[0, 1]];
  for (const [a, b] of pieces) {
    const sub = pts.filter((p, i) => i / n >= a - 1e-6 && i / n <= b + 1e-6);
    if (sub.length < 2) sub.push(pts[Math.min(n, Math.round(b * n))]);
    if (spec.shaft === 'gedreht') for (const ph of [0, Math.PI]) tubeAlong(sub.map((p, i) => p.clone().add(V(Math.cos(ph + p.y * 18) * r * 0.55, 0, Math.sin(ph + p.y * 18) * r * 0.55))), r * 0.6, M.radial, mats.main, parent);
    else tubeAlong(sub, r, M.radial, mats.main, parent, false, 16);
  }
  const L = y1 - y0;
  if (spec.shaft === 'geknotet') for (const t of [0.22, 0.48, 0.74]) mesh(new THREE.SphereGeometry(r * 1.8, M.radial, 5).scale(1, 0.7, 1), mats.main, parent, pts[Math.round(t * n)].x, y0 + L * t, pts[Math.round(t * n)].z);
  if (spec.shaft === 'segmentiert') for (const t of [0.2, 0.4, 0.6, 0.8]) mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, L * 0.025, M.radial), mats.accent, parent, pts[Math.round(t * n)].x, y0 + L * t, pts[Math.round(t * n)].z);
  if (spec.shaft === 'umwickelt') tubeAlong(helix(y0 + L * 0.15, y0 + L * 0.85, r * 1.15, 6), r * 0.35, 4, mats.detail, parent, false, 80);
  // Hersteller-Details am Schaft
  if (spec.maker === 'stern') for (const t of [0.3, 0.7]) { const m = mesh(new THREE.TorusGeometry(r * 3, r * 0.25, 4, 20), mats.accent, parent, 0, y0 + L * t, 0); m.rotation.x = Math.PI / 2; }
  if (spec.maker === 'brandt') for (const t of [0.15, 0.85]) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2, m = mesh(new THREE.ConeGeometry(r * 0.6, r * 3, 4), mats.accent, parent, Math.cos(a) * r * 1.2, y0 + L * t, Math.sin(a) * r * 1.2); m.rotation.z = -Math.cos(a) * Math.PI / 2; m.rotation.x = Math.sin(a) * Math.PI / 2; }
  if (spec.maker === 'morra') { mesh(new THREE.SphereGeometry(r * 2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), mats.detail === mats.main ? mats.accent : new THREE.MeshLambertMaterial({ color: 0xc04a3a }), parent, r * 1.2, y0 + L * 0.35, 0); }
  if (spec.maker === 'grab') for (const t of [0.25, 0.6]) mesh(new THREE.TorusGeometry(r * 1.3, r * 0.5, 5, 8), mats.main, parent, 0, y0 + L * t, 0).rotation.x = Math.PI / 2;
  return pts;
}
function gemShape(head, s) {   // Edelstein/Kern je Kopf
  if (head === 'kristall' || head === 'splitter' || head === 'nadel') return new THREE.OctahedronGeometry(s, 0).scale(0.6, head === 'nadel' ? 2.6 : 1.6, 0.6);
  return new THREE.IcosahedronGeometry(s, 0);
}

// =====================================================================
// Typen
// =====================================================================
function buildStaff(g, spec, M, mats) {
  const L = 1.62, r = 0.022 * M.thick;
  const pts = shaft(g, spec, M, mats, 0, L, r), top = pts[pts.length - 1];
  // Fuß
  if (spec.maker === 'brandt') mesh(new THREE.ConeGeometry(r * 1.4, 0.14, 6).rotateX(Math.PI), mats.accent, g, 0, -0.05, 0);
  else if (spec.maker === 'vey') mesh(new THREE.OctahedronGeometry(r * 2).scale(1, 2, 1), mats.main, g, 0, 0.0, 0);
  else mesh(new THREE.SphereGeometry(r * 1.5, 8, 5), mats.accent, g, 0, 0.0, 0);
  // Kragen
  mesh(new THREE.CylinderGeometry(r * 1.9, r * 1.3, 0.06, M.radial), mats.accent, g, top.x, L - 0.02, top.z);
  const H = new THREE.Group(); H.position.set(top.x, L + 0.14, top.z); g.add(H);
  const s = 0.06 * Math.max(0.9, M.thick * 0.9);
  const gem = mesh(gemShape(spec.head, s), mats.gem, H); gem.userData.spin = 0.6;
  if (spec.head === 'kristall') for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; tubeAlong([V(Math.cos(a) * r, -0.12, Math.sin(a) * r), V(Math.cos(a) * s * 1.3, 0, Math.sin(a) * s * 1.3), V(Math.cos(a) * s * 0.6, s * 1.6, Math.sin(a) * s * 0.6)], r * 0.4, 5, mats.accent, H); }
  if (spec.head === 'kaefig') for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; tubeAlong([V(0, -0.1, 0), V(Math.cos(a) * s * 1.7, -0.02, Math.sin(a) * s * 1.7), V(Math.cos(a) * s * 1.6, s * 1.4, Math.sin(a) * s * 1.6), V(0, s * 2.4, 0)], r * 0.32, 5, mats.accent, H); }
  if (spec.head === 'gabel') { for (const sx of [-1, 1]) tubeAlong([V(0, -0.1, 0), V(sx * s * 1.2, 0, 0), V(sx * s * 2, s * 2.4, 0), V(sx * s * 1.6, s * 3.4, 0)], r * 0.55, 6, mats.accent, H); gem.position.y = s * 0.6; }
  if (spec.head === 'ring') { const t = mesh(new THREE.TorusGeometry(s * 2.2, r * 0.6, 6, 24), mats.accent, H, 0, s * 1.6, 0); gem.position.y = s * 1.6; gem.userData.bob = 1; }
  if (spec.head === 'sichel') { const c = mesh(new THREE.TorusGeometry(s * 3, r * 0.9, 4, 20, Math.PI * 1.15).scale(1, 1, 0.35), mats.accent, H, -s * 1.5, s * 2, 0); c.rotation.z = -0.4; gem.position.y = s * 0.3; }
  return H;
}
function buildWand(g, spec, M, mats) {
  const L = 0.42, r = 0.011 * M.thick;
  const pts = shaft(g, spec, M, mats, 0, L, r), top = pts[pts.length - 1];
  mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.8, 0.13, M.radial), mats.detail, g, 0, 0.07, 0);            // Griff (festes Kennteil)
  mesh(new THREE.SphereGeometry(r * 2, 8, 5), mats.accent, g, 0, 0, 0);
  const H = new THREE.Group(); H.position.set(top.x, L + 0.03, top.z); g.add(H);
  const s = 0.028;
  const gem = mesh(gemShape(spec.head, s), mats.gem, H); gem.userData.spin = 1;
  if (spec.head === 'klaue') for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; tubeAlong([V(0, -0.02, 0), V(Math.cos(a) * s * 1.6, s * 0.4, Math.sin(a) * s * 1.6), V(Math.cos(a) * s * 0.6, s * 1.7, Math.sin(a) * s * 0.6)], r * 0.35, 4, mats.accent, H); }
  if (spec.head === 'kugel') gem.scale.setScalar(1.4);
  if (spec.head === 'nadel') gem.position.y = s * 1.6;
  return H;
}
function runeTex() { return canvasTex(128, (g, s) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 0.3, s * 0.2); g.lineTo(s * 0.5, s * 0.8); g.lineTo(s * 0.7, s * 0.2); g.moveTo(s * 0.25, s * 0.5); g.lineTo(s * 0.75, s * 0.5); g.stroke(); }); }

function addExtra(g, spec, H, mats) {
  if (spec.extra === 'none') return;
  const at = spec.type === 'staff' ? V(H.position.x, H.position.y - 0.2, H.position.z) : spec.type === 'wand' ? V(0, 0, 0) : spec.type === 'book' ? V(0.05, -0.14, 0) : V(0, -0.12, 0);
  const E = new THREE.Group(); E.position.copy(at); g.add(E); E.userData.sway = true;
  const col = new THREE.MeshLambertMaterial({ color: new THREE.Color(RARITY[spec.rarity].color), side: THREE.DoubleSide });
  if (spec.extra === 'baender') for (const sx of [-1, 1]) { const m = mesh(new THREE.PlaneGeometry(0.03, 0.3, 1, 6).translate(0, -0.15, 0), col, E, sx * 0.03, 0, 0); m.rotation.z = sx * 0.2; m.userData.wave = true; }
  if (spec.extra === 'ketten') for (const sx of [-1, 1]) chain(E, V(sx * 0.02, 0, 0), V(sx * 0.06, -0.22, 0), mats.accent, 0.016);
  if (spec.extra === 'federn') for (let k = 0; k < 3; k++) { const m = mesh(new THREE.ConeGeometry(0.02, 0.16, 4).scale(1, 1, 0.2).translate(0, -0.08, 0), col, E, (k - 1) * 0.025, 0, 0); m.rotation.z = (k - 1) * 0.35; }
  if (spec.extra === 'gloeckchen') for (const sx of [-1, 1]) { const b = new THREE.Group(); b.position.set(sx * 0.03, -0.06, 0); E.add(b); mesh(new THREE.ConeGeometry(0.022, 0.04, 10, 1, true), mats.accent, b); mesh(new THREE.SphereGeometry(0.008, 6, 4), mats.accent, b, 0, -0.02, 0); tubeAlong([V(0, 0.02, 0), V(0, 0.06, 0)], 0.002, 3, mats.detail, b); }
}
const dotTex = canvasTex(64, (g, s) => { const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, s, s); });
const smokeTex = canvasTex(64, (g, s) => { const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); grd.addColorStop(0, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, s, s); });
// Partikel-Bewegung je Element (lokal um den Kopf)
const MOTION = {
  frost: (p, v, dt) => { p.y -= dt * 0.18; p.x += Math.sin(p.y * 9) * dt * 0.05; return p.y < -0.5; },
  feuer: (p, v, dt) => { p.y += dt * (0.35 + v.x); p.x += (Math.random() - 0.5) * dt * 0.2; return p.y > 0.45; },
  arkan: (p, v, dt, t) => { const a = v.y + t * 1.4, r = 0.16 + v.x * 0.5; p.set(Math.cos(a) * r, Math.sin(t * 2 + v.y) * 0.08, Math.sin(a) * r); return false; },
  blitz: (p, v, dt) => { if (Math.random() < dt * 8) p.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4); return false; },
  blut: (p, v, dt) => { v.z += dt * 0.6; p.y -= dt * v.z; return p.y < -0.6; },
  dunkel: (p, v, dt) => { p.y += dt * 0.12; p.x += Math.sin(p.y * 6 + v.y) * dt * 0.04; return p.y > 0.55; },
};
function spawnP(el, p, v) {
  v.set(Math.random() * 0.2, Math.random() * 7, 0);
  if (el === 'frost') p.set((Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3);
  else if (el === 'feuer' || el === 'dunkel') p.set((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08);
  else if (el === 'blut') p.set((Math.random() - 0.5) * 0.06, -0.03, (Math.random() - 0.5) * 0.06);
  else p.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
}
function addElement(g, spec, H, size) {
  const el = spec.element, E = ELEMENTS[el], col = new THREE.Color(E.color), fx = ({ parts: null, arcs: [], spinners: [], flames: [] } as any);
  if (el === 'none' || spec.rarity < 1) return fx;
  // Kopf-Details in Element-Form (ab grün sichtbar, Aura + Partikel ab blau)
  if (spec.rarity >= 2) {
    if (el === 'frost') for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, m = mesh(new THREE.ConeGeometry(size * 0.12, size * (0.5 + (k % 2) * 0.3), 5).rotateX(Math.PI), new THREE.MeshLambertMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.85, emissive: 0x1a3040 }), H, Math.cos(a) * size * 0.45, -size * 0.35, Math.sin(a) * size * 0.45); }
    if (el === 'feuer') for (let k = 0; k < 2; k++) { const m = mesh(new THREE.ConeGeometry(size * (0.35 - k * 0.12), size * (1.4 - k * 0.4), 8, 1, true).translate(0, size * (0.7 - k * 0.2), 0), new THREE.MeshBasicMaterial({ color: k ? 0xffe28a : 0xff6a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), H, 0, size * 0.3, 0); fx.flames.push(m); }
    if (el === 'arkan') { const rt = runeTex(); for (let k = 0; k < 3; k++) { const m = mesh(new THREE.PlaneGeometry(size * 0.5, size * 0.5), new THREE.MeshBasicMaterial({ map: rt, color: col.clone().multiplyScalar(1.5), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), H); m.userData.orbit = k / 3 * Math.PI * 2; fx.spinners.push(m); } }
    if (el === 'blut') for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(size * 0.12, 8, 6), new THREE.MeshBasicMaterial({ color: col }), H, (Math.random() - 0.5) * size, -size * 0.4 - Math.random() * size * 0.3, (Math.random() - 0.5) * size).userData.drip = Math.random();
    if (el === 'dunkel') { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x100008, depthWrite: false })); s.scale.setScalar(size * 2.6); H.add(s); }
  }
  if (spec.rarity >= 3) {
    if (el !== 'dunkel') { const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: col.clone().multiplyScalar(0.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 })); aura.scale.setScalar(size * 3.2); H.add(aura); fx.aura = aura; }
    const n = spec.rarity >= 5 ? 80 : 40, pos = new Float32Array(n * 3), P = [], Vv = [];
    for (let i = 0; i < n; i++) { const p = V(0, 0, 0), v = V(0, 0, 0); spawnP(el, p, v); if (el === 'frost' || el === 'feuer' || el === 'dunkel' || el === 'blut') p.y += (Math.random() - 0.5) * 0.4; P.push(p); Vv.push(v); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dark = el === 'dunkel';
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dark ? smokeTex : dotTex, color: dark ? 0x1a0a10 : col.clone().multiplyScalar(1.4), size: dark ? 0.12 : el === 'blut' ? 0.045 : 0.035, transparent: true, depthWrite: false, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: dark ? 0.7 : 1 }));
    H.add(pts); fx.parts = { pts, P, Vv, el };
    if (el === 'blitz') for (let k = 0; k < 2; k++) { const l = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3)), new THREE.LineBasicMaterial({ color: new THREE.Color(0xfff6c0).multiplyScalar(2) })); H.add(l); fx.arcs.push(l); }
  }
  return fx;
}

// Buch und Relikt liegen im Spiel in der Waffenhand (keine Nebenhand)
function buildBook(g, spec, M, mats) {
  const W = 0.22, Hh = 0.29, D = 0.07 * (M.thick > 1.2 ? 1.3 : M.thick < 0.8 ? 0.8 : 1);
  const book = new THREE.Group(); book.position.y = 0.0; g.add(book); g.userData.float = true;
  const cover = d => { const m = mesh(new THREE.BoxGeometry(W, Hh, 0.012), mats.main, book, 0, 0, d); return m; };
  cover(D / 2); const back = cover(-D / 2);
  mesh(new THREE.BoxGeometry(0.02, Hh, D), mats.main, book, -W / 2, 0, 0);                                   // Rücken
  mesh(new THREE.BoxGeometry(W * 0.94, Hh * 0.94, D * 0.85), mats.paper, book, 0.006, 0, 0);                // Seiten
  const page = mesh(new THREE.PlaneGeometry(W * 0.9, Hh * 0.9).translate(W * 0.45, 0, 0), mats.paper, book, -W / 2 + 0.01, 0, D / 2 + 0.004); page.material = mats.paper.clone(); page.material.side = THREE.DoubleSide; page.userData.flip = true;
  // Einband-Form (Wertgruppe)
  if (spec.shaft === 'gedreht') for (const sy of [-1, 1]) mesh(new THREE.BoxGeometry(W * 1.02, 0.02, D * 1.12), mats.detail, book, 0, sy * Hh * 0.28, 0);
  if (spec.shaft === 'geknotet') for (const sy of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 0.03, 0.016), mats.accent, book, W / 2, sy * Hh * 0.25, 0);
  if (spec.shaft === 'segmentiert') for (const sx of [-1, 1]) for (const sy of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.04, D * 1.15), mats.accent, book, sx * (W / 2 - 0.015), sy * (Hh / 2 - 0.015), 0);
  if (spec.shaft === 'umwickelt') { chain(book, V(-W / 2, Hh * 0.3, D / 2 + 0.01), V(W / 2, -Hh * 0.3, D / 2 + 0.01), mats.accent, 0.018); }
  // Motiv vorn (Kopf)
  const H = new THREE.Group(); H.position.set(0.01, 0.02, D / 2 + 0.012); book.add(H);
  if (spec.head === 'auge') { mesh(new THREE.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }), H); mesh(new THREE.CircleGeometry(0.018, 16), mats.gem, H, 0, 0, 0.041); }
  if (spec.head === 'rune') { const m = mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ map: runeTex(), transparent: true, color: mats.gem.color }), H, 0, 0, 0.002); }
  if (spec.head === 'siegel') { mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20).rotateX(Math.PI / 2), mats.accent, H); mesh(gemShape('kugel', 0.022), mats.gem, H, 0, 0, 0.015); }
  if (spec.head === 'maul') { mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16).scale(1, 0.6, 1), mats.accent, H); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, m = mesh(new THREE.ConeGeometry(0.008, 0.025, 4), new THREE.MeshLambertMaterial({ color: 0xf0e8d0 }), H, Math.cos(a) * 0.04, Math.sin(a) * 0.024, 0.005); m.rotation.z = a + Math.PI / 2; } mesh(new THREE.CircleGeometry(0.03, 12).scale(1, 0.5, 1), mats.gem, H, 0, 0, 0.002); }
  if (spec.maker === 'vey') { back.position.z -= 0.03; back.userData.bob = 1; }
  book.rotation.y = 0.35;
  return H;
}
function buildRelic(g, spec, M, mats) {
  g.userData.float = true;
  const H = new THREE.Group(); g.add(H);
  const s = 0.075 * Math.max(0.85, M.thick * 0.85);
  if (spec.head === 'schaedel') { mesh(new THREE.SphereGeometry(s, 10, 8).scale(0.9, 1, 1), mats.main === mats.accent && spec.maker !== 'grab' ? new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }) : new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }), H);
    mesh(new THREE.BoxGeometry(s * 1.1, s * 0.5, s * 0.9), new THREE.MeshLambertMaterial({ color: 0xd8ccb0 }), H, 0, -s * 0.85, s * 0.15);
    for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(s * 0.22, 8, 6), mats.gem, H, sx * s * 0.36, 0, s * 0.84); }
  if (spec.head === 'laterne') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(s * 0.12, s * 2.2, s * 0.12), mats.accent, H, sx * s * 0.7, 0, sz * s * 0.7);
    for (const sy of [-1, 1]) mesh(new THREE.BoxGeometry(s * 1.6, s * 0.15, s * 1.6), mats.accent, H, 0, sy * s * 1.1, 0); mesh(new THREE.OctahedronGeometry(s * 0.55).scale(1, 1.4, 1), mats.gem, H).userData.spin = 1; }
  if (spec.head === 'auge') { mesh(new THREE.SphereGeometry(s, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf2ece0 }), H); mesh(new THREE.CircleGeometry(s * 0.45, 20), mats.gem, H, 0, 0, s * 1.001); mesh(new THREE.CircleGeometry(s * 0.2, 16), mats.dark, H, 0, 0, s * 1.003); H.userData.look = true; }
  if (spec.head === 'kugel') mesh(new THREE.IcosahedronGeometry(s, 1), mats.gem, H).userData.spin = 0.5;
  if (spec.head === 'herz') { for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(s * 0.55, 10, 8), mats.gem, H, sx * s * 0.38, s * 0.2, 0); mesh(new THREE.ConeGeometry(s * 0.88, s * 1.2, 12).rotateX(Math.PI), mats.gem, H, 0, -s * 0.45, 0); H.userData.beat = true; }
  // Fassung (Wertgruppe)
  const F = new THREE.Group(); g.add(F);
  if (spec.shaft === 'gerade') mesh(new THREE.TorusGeometry(s * 1.6, s * 0.1, 5, 28), mats.accent, F).userData.spinX = 0.8;
  if (spec.shaft === 'gedreht') tubeAlong(helix(-s * 1.4, s * 1.4, s * 1.5, 2.2), s * 0.08, 5, mats.accent, F, false, 60);
  if (spec.shaft === 'geknotet') for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; tubeAlong([V(0, -s * 2.2, 0), V(Math.cos(a) * s * 1.2, -s * 1.3, Math.sin(a) * s * 1.2), V(Math.cos(a) * s * 1.1, -s * 0.2, Math.sin(a) * s * 1.1), V(Math.cos(a) * s * 0.5, s * 0.3, Math.sin(a) * s * 0.5)], s * 0.08, 5, mats.accent, F); }
  if (spec.shaft === 'segmentiert') for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; tubeAlong([V(0, -s * 1.6, 0), V(Math.cos(a) * s * 1.35, -s * 0.8, Math.sin(a) * s * 1.35), V(Math.cos(a) * s * 1.35, s * 0.8, Math.sin(a) * s * 1.35), V(0, s * 1.6, 0)], s * 0.06, 4, mats.accent, F); }
  if (spec.shaft === 'umwickelt') chain(F, V(0, s * 1.2, 0), V(0, s * 4, 0), mats.accent, 0.022);
  if (spec.maker === 'vey') F.userData.orbitY = 0.5;
  return H;
}
const BUILD = { staff: buildStaff, wand: buildWand, book: buildBook, relic: buildRelic };
function buildParts(spec) {
  const M = MAKERS[spec.maker], mats = makeMats(spec), g = new THREE.Group();
  const H = BUILD[spec.type](g, spec, M, mats);
  addExtra(g, spec, H, mats);
  const size = spec.type === 'staff' ? 0.16 : spec.type === 'wand' ? 0.08 : spec.type === 'book' ? 0.12 : 0.17;
  const fx = addElement(g, spec, H, size), rar: any = {};   // Bodenring und Lichtsäule nur im Viewer
  const tmp = V(0, 0, 0);
  function update(dt, t) {
    g.traverse(o => {
      const u = o.userData;
      if (u.spin) o.rotation.y += dt * u.spin;
      if (u.bob) o.position.y += Math.sin(t * 2) * 0.0006;
      if (u.spinX) o.rotation.x = t * u.spinX;
      if (u.orbitY) o.rotation.y = t * u.orbitY;
      if (u.flip) o.rotation.y = -Math.abs(Math.sin(t * 1.3)) * 2.6;
      if (u.wave) o.rotation.x = Math.sin(t * 3 + o.position.x * 30) * 0.3;
      if (u.sway) o.rotation.z = Math.sin(t * 1.7) * 0.15;
      if (u.drip !== undefined) { u.drip = (u.drip + dt * 0.7) % 1; o.position.y = -size * 0.4 - u.drip * size * 1.6; o.scale.setScalar(1 - u.drip * 0.6); }
      if (u.beat) o.scale.setScalar(1 + Math.max(0, Math.sin(t * 6)) * 0.08);
      if (u.look) o.rotation.y = Math.sin(t * 0.7) * 0.6;
    });
    if (g.userData.float) g.position.y = (g.userData.baseY ?? 0) + Math.sin(t * 1.6) * 0.03;
    fx.flames.forEach((f, i) => f.scale.set(1 + Math.sin(t * 17 + i) * 0.1, 1 + Math.sin(t * 11 + i * 2) * 0.25, 1));
    fx.spinners.forEach(m => { const a = m.userData.orbit + t * 1.2; m.position.set(Math.cos(a) * size * 1.1, Math.sin(t * 2 + a) * size * 0.25, Math.sin(a) * size * 1.1); m.lookAt(g.localToWorld(tmp.set(0, 0, 0)).set(1e3, 0, 0)); m.rotation.set(0, -a, 0); });
    if (fx.aura) fx.aura.material.opacity = 0.38 + Math.sin(t * 3) * 0.1;
    if (fx.parts) {
      const { pts, P, Vv, el } = fx.parts, a = pts.geometry.attributes.position;
      P.forEach((p, i) => { if (MOTION[el](p, Vv[i], dt, t)) spawnP(el, p, Vv[i]); a.setXYZ(i, p.x, p.y, p.z); });
      a.needsUpdate = true;
    }
    fx.arcs.forEach((l, k) => {
      l.visible = Math.random() < 0.55;
      if (!l.visible) return;
      const a = l.geometry.attributes.position, end = V((Math.random() - 0.5) * size * 4, (Math.random() - 0.4) * size * 4, (Math.random() - 0.5) * size * 4);
      for (let i = 0; i < 8; i++) { const t2 = i / 7; a.setXYZ(i, end.x * t2 + (i && i < 7 ? (Math.random() - 0.5) * size * 0.8 : 0), end.y * t2 + (i && i < 7 ? (Math.random() - 0.5) * size * 0.8 : 0), end.z * t2); }
      a.needsUpdate = true;
    });
    if (rar.ring) rar.ring.rotation.y = t * 0.5;
  }
  return { root: g, floor: rar, update, head: H };
}

// ---------- Spiel-Schnittstelle wie models/weapons/index.ts buildWeapon ----------
// Griff und Haltung: der lange Stab stützt wie ein Gehstock, der Zauberstab liegt in der Hand und ist für die Spielkamera vergrößert // PH
const HOLD = { staff: { gripY: 1.0, cane: true, pitch: 0.06, scale: 1.15 }, wand: { gripY: 0.07, cane: false, pitch: 0.95, scale: 1.5 },
  book: { gripY: -0.12, cane: false, pitch: 0, scale: 1.5 }, relic: { gripY: -0.18, cane: false, pitch: 0, scale: 1.5 } };   // Buch und Relikt schweben über der Hand
const animated = o => { const u = o.userData; return u.spin || u.bob || u.spinX || u.orbitY || u.flip || u.wave || u.sway || u.drip !== undefined || u.beat || u.look || u.orbit !== undefined; };
// Statische Meshes pro Material zu einem Mesh verschmelzen; alles unter einem bewegten Teil bleibt, wie es ist
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), drop = [];
  root.traverse(o => {
    if (!o.isMesh || o.isPoints) return;
    for (let p = o; p && p !== root; p = p.parent) if (animated(p) || p.userData.keep) return;
    if (o.material.transparent && o.material.blending === THREE.AdditiveBlending) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    (groups.get(o.material) ?? groups.set(o.material, []).get(o.material)).push(g);
    drop.push(o);
  });
  for (const o of drop) { o.parent.remove(o); o.geometry.dispose(); }
  for (const [mat, list] of groups) root.add(new THREE.Mesh(mergeGeometries(list), mat));
}
export function buildBaukastenWeapon(spec) {
  const built = buildParts(spec), hold = HOLD[spec.type] ?? HOLD.staff;
  const inner = built.root;
  // Der Kopf (Edelstein, Element) bleibt beweglich, der Rest wird verschmolzen
  built.head.userData.keep = true;
  mergeStatic(inner);
  inner.scale.setScalar(hold.scale);
  inner.position.y = -hold.gripY * hold.scale;
  const root = new THREE.Group();
  root.add(inner);
  const glowAnchor = new THREE.Object3D();
  built.head.add(glowAnchor);
  let combat = false;
  return {
    id: `baukasten-${spec.type}`, def: null, root, gripY: hold.gripY * hold.scale, cane: hold.cane, pitch: hold.pitch, yaw: 0, glowAnchor,
    get combat() { return combat; }, set combat(v) { combat = v; },
    alive: true,
    update(dt, t) { built.update(dt, t); },
    dispose() {
      root.removeFromParent();
      root.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) for (const m of [].concat(o.material)) if (!Object.values(texCache).includes(m.map)) { m.map?.dispose?.(); m.dispose(); } else m.dispose();
      });
    },
  };
}
