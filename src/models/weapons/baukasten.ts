// Waffen-Baukasten der Magier: Teile, Hersteller-Material, Element-Effekte und Seltenheit, übernommen aus dem Viewer „Frost Grind – Waffen-Baukasten“
// (https://claude.ai/artifact/McdzspSdum69PJUhrWJjKy). Im Spiel nur Langer Stab und Zauberstab (keine Nebenhand, Kevin 2026-11-03).
// Statische Teile werden pro Material verschmolzen, bewegte Teile (Kopf-Edelstein, Flammen, Runen, Partikel) bleiben einzeln.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { t, lang } from '../../i18n';
import { toonMat } from '../../toon';
import { hex } from '../../ui/dom';
import { CARD_RARITIES } from '../../config';
import { V, rand as rnd } from '../../util';

// Daten aus dem Viewer. Die Spielwerte (Regeln, Zahlen) stehen in weaponRolls.ts
const RARITY = CARD_RARITIES;   // Seltenheitsfarbe am Modell, Quelle config.ts
// Kopf = Schule des Fokus-Spells, zwei Formen je Schule (Kevin 2026-11-08). Jeder Kopf geht an jedem Typ
export const ALL_HEADS = ['frostorb', 'sichel', 'glutschaedel', 'dreizack', 'wolke', 'spulen', 'speischaedel', 'phiole', 'ring', 'auge'];
export const TYPES = {
  staff: { name: t('wtype.staff.name'), noun: 'stab', g: 'm', slot: t('wtype.staff.slot'), rule: t('wtype.staff.rule'), heads: ALL_HEADS },
  wand: { name: t('wtype.wand.name'), noun: 'zauberstab', g: 'm', slot: t('wtype.wand.slot'), rule: t('wtype.wand.rule'), heads: ALL_HEADS },
  book: { name: t('wtype.book.name'), noun: 'buch', g: 'n', slot: t('wtype.book.slot'), rule: t('wtype.book.rule'), heads: ALL_HEADS },
  relic: { name: t('wtype.relic.name'), noun: 'relikt', g: 'n', slot: t('wtype.relic.slot'), rule: t('wtype.relic.rule'), heads: ALL_HEADS },
};
export const HEADS = {   // Name (Dev-Anzeige, im Waffennamen steht whead.*), Schule des Fokus-Spells (Form verrät die Schule)
  frostorb: ['Frostkugel', 'Frost'], sichel: ['Sichel', 'Frost'],
  glutschaedel: ['Glutschädel', 'Feuer'], dreizack: ['Dreizack', 'Feuer'],
  wolke: ['Wolken', 'Blitz'], spulen: ['Spulen', 'Blitz'],
  speischaedel: ['Speischädel', 'Seuche'], phiole: ['Phiolen', 'Seuche'],
  ring: ['Ring', 'Arkan'], auge: ['Augen', 'Arkan'],
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
export const ELEMENTS = {   // die aktiven Schulen + Arkan (nur über Gegenstände, Schule geparkt). Kevin 2026-11-08: Blut und Dunkel raus
  none: { name: t('element.none.name'), color: 0x000000, adj: '' },
  frost: { name: t('element.frost.name'), color: 0x9fe4ff, adj: t('element.frost.adj'), fx: t('element.frost.fx') },
  feuer: { name: t('element.feuer.name'), color: 0xff7a22, adj: t('element.feuer.adj'), fx: t('element.feuer.fx') },
  blitz: { name: t('element.blitz.name'), color: 0xffe866, adj: t('element.blitz.adj'), fx: t('element.blitz.fx') },
  seuche: { name: t('element.seuche.name'), color: 0x7dff3a, adj: t('element.seuche.adj'), fx: t('element.seuche.fx') },
  arkan: { name: t('element.arkan.name'), color: 0xd070ff, adj: t('element.arkan.adj'), fx: t('element.arkan.fx') },
};
export const elementColor = el => hex(ELEMENTS[el].color);   // CSS-Farbe für UI
export const MAKERS = {   // jeder Hersteller hat sein eigenes Material mit Textur (Kevin 2026-11-08), Namen in wmat.*
  grab: { name: t('maker.grab.name'), gen: t('maker.grab.gen'), trait: t('maker.grab.trait'), main: 'bronze', accent: 'bronze', detail: 'leather', thick: 1.35, radial: 7, bend: 0, float: false },
  stern: { name: t('maker.stern.name'), gen: t('maker.stern.gen'), trait: t('maker.stern.trait'), main: 'gold', accent: 'gold', detail: 'glass', thick: 0.75, radial: 12, bend: 0, float: false },
  morra: { name: t('maker.morra.name'), gen: t('maker.morra.gen'), trait: t('maker.morra.trait'), main: 'darkwood', accent: 'darkwood', detail: 'leather', thick: 1.0, radial: 7, bend: 0.07, float: false },
  vey: { name: t('maker.vey.name'), gen: t('maker.vey.gen'), trait: t('maker.vey.trait'), main: 'crystal', accent: 'crystal', detail: 'glass', thick: 0.9, radial: 6, bend: 0, float: true },
  brandt: { name: t('maker.brandt.name'), gen: t('maker.brandt.gen'), trait: t('maker.brandt.trait'), main: 'blueiron', accent: 'blueiron', detail: 'leather', thick: 1.1, radial: 6, bend: 0, float: false },
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
function strokes(g, s, n, cols, vertical, w = [1, 3], a = [0.1, 0.3]) {
  for (let i = 0; i < n; i++) { g.strokeStyle = cols[i % cols.length]; g.globalAlpha = rnd(a[0], a[1]); g.lineWidth = rnd(w[0], w[1]); g.beginPath();
    const x = rnd(0, s), y = rnd(0, s), l = rnd(8, 40); vertical ? (g.moveTo(x, y), g.lineTo(x + rnd(-2, 2), y + l)) : (g.moveTo(x, y), g.lineTo(x + l, y + rnd(-2, 2))); g.stroke(); }
  g.globalAlpha = 1;
}
function blot(g, s, n, col, r = [3, 12]) { for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.arc(rnd(0, s), rnd(0, s), rnd(r[0], r[1]), 0, 7); g.fill(); } }
const TEX = {   // gemalt wie im Viewer: grab Bronze mit Grünspan, stern Gold mit Filigran, morra Dunkelholz mit Maserung, vey Kristall, brandt gehämmertes Blaueisen mit Nieten
  leather: () => canvasTex(256, (g, s) => { g.fillStyle = '#4a2c18'; g.fillRect(0, 0, s, s); blot(g, s, 60, 'rgba(20,10,5,0.25)', [2, 8]); strokes(g, s, 80, ['#6a4224', '#2a160a'], false);
    g.fillStyle = 'rgba(230,200,150,0.7)'; for (let x = 4; x < s; x += 16) g.fillRect(x, s * 0.1, 8, 2); }, [1, 3]),
  crystal: () => canvasTex(256, (g, s) => { const grd = g.createLinearGradient(0, 0, s, s); grd.addColorStop(0, '#e8f4ff'); grd.addColorStop(0.5, '#a8c4e0'); grd.addColorStop(1, '#f6fbff');
    g.fillStyle = grd; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(rnd(0, s), 0); g.lineTo(rnd(0, s), s); g.stroke(); } }),
  gold: () => canvasTex(256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, s, 0); grd.addColorStop(0, '#7a5408'); grd.addColorStop(0.35, '#f2c84a'); grd.addColorStop(0.5, '#fff6c8'); grd.addColorStop(0.65, '#e6b032'); grd.addColorStop(1, '#6a4806');
    g.fillStyle = grd; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(90,55,5,0.75)'; g.lineWidth = 2.5;
    for (let y = 0; y < s; y += 64) for (let x = 0; x < s; x += 64) { g.beginPath(); g.arc(x + 20, y + 32, 14, 0.3, 4.4); g.stroke(); g.beginPath(); g.arc(x + 44, y + 32, 14, 3.4, 7.5); g.stroke(); }
  }),
  darkwood: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#3a2416'; g.fillRect(0, 0, s, s); strokes(g, s, 260, ['#6a3a22', '#24140c', '#8a4a2a'], true, [2, 6], [0.35, 0.7]);
    for (let i = 0; i < 5; i++) { const x = rnd(20, s - 20), y = rnd(20, s - 20); g.strokeStyle = '#5a2c18'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, 7, 14, 0, 0, 7); g.stroke(); g.fillStyle = '#0a0604'; g.beginPath(); g.ellipse(x, y, 3, 7, 0, 0, 7); g.fill(); }
  }, [1, 3]),
  bronze: () => canvasTex(256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, s, 0); grd.addColorStop(0, '#5a2e10'); grd.addColorStop(0.45, '#c07a3a'); grd.addColorStop(0.55, '#e8a868'); grd.addColorStop(1, '#5a2e10');
    g.fillStyle = grd; g.fillRect(0, 0, s, s); strokes(g, s, 120, ['#7a4420', '#f0b880'], false, [1, 2], [0.1, 0.3]);
    blot(g, s, 40, 'rgba(60,170,140,0.5)', [4, 14]); blot(g, s, 20, 'rgba(120,220,190,0.35)', [2, 6]);
  }),
  blueiron: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#2c4664'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) { const x = rnd(0, s), y = rnd(0, s), r = rnd(8, 18), grd = g.createRadialGradient(x - 3, y - 3, 1, x, y, r); grd.addColorStop(0, 'rgba(150,190,230,0.5)'); grd.addColorStop(1, 'rgba(10,20,40,0)'); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let y = 16; y < s; y += 64) for (let x = 8; x < s; x += 32) { g.fillStyle = '#0e1828'; g.beginPath(); g.arc(x + 1, y + 1, 5, 0, 7); g.fill(); g.fillStyle = '#b8d0ec'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  }),
  paper: () => canvasTex(128, (g, s) => { g.fillStyle = '#e8dcb8'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(120,90,50,0.5)'; for (let y = 4; y < s; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } }),
};
const texCache: any = {}; const tex = k => texCache[k] || (texCache[k] = TEX[k]());
// Stil (Kevin 2026-11-08): Toon wie im Viewer, flache Grundfarbe, 3 Lichtstufen und Fresnel-Rand aus toon.ts (0 extra Draw Calls), auch ohne ?toon=1.
// 'gemalt' = Lambert mit den Canvas-Texturen oben (Viewer-Stil „Gemalt“), bleibt zum Umschalten
const STYLE: 'toon' | 'gemalt' = 'toon';
const TOON_COL = { gold: 0xe8b23a, darkwood: 0x5a3420, bronze: 0xb8743a, crystal: 0xc8ecff, blueiron: 0x3e6490, leather: 0x5a3420, glass: 0xc0e4ff, paper: 0xe8dcb8 };
const shade = (o: any) => STYLE === 'toon' ? toonMat(o) : new THREE.MeshLambertMaterial(o);   // alle beleuchteten Teile der Waffen
// Materialien pro Waffe neu (grau entsättigt sie)
function makeMats(spec) {
  const M = MAKERS[spec.maker], dim = spec.rarity === 0 ? 0.55 : 1;
  const see = k => k === 'glass' || k === 'crystal';
  const lit = k => {
    if (STYLE === 'toon') return toonMat({ color: new THREE.Color(TOON_COL[k]).multiplyScalar(dim), transparent: see(k), opacity: k === 'glass' ? 0.5 : k === 'crystal' ? 0.85 : 1 });   // PH
    if (k === 'glass') return new THREE.MeshLambertMaterial({ color: new THREE.Color(0.75, 0.9, 1).multiplyScalar(dim), transparent: true, opacity: 0.45 });
    if (k === 'crystal') return new THREE.MeshLambertMaterial({ map: tex(k), color: new THREE.Color(1, 1, 1).multiplyScalar(dim), transparent: true, opacity: 0.8, emissive: 0x22303c });
    return new THREE.MeshLambertMaterial({ map: tex(k), color: new THREE.Color(1, 1, 1).multiplyScalar(dim * 1.15) });
  };
  const el = ELEMENTS[spec.element], hasEl = spec.element !== 'none';
  let gem;
  if (hasEl && spec.rarity >= 2) gem = new THREE.MeshBasicMaterial({ color: new THREE.Color(el.color).multiplyScalar(1.6) });     // grün+: leuchtet in Element-Farbe
  else if (hasEl) gem = shade({ color: el.color, emissive: new THREE.Color(el.color).multiplyScalar(0.15) });   // weiß: nur gefärbt
  else gem = shade({ color: new THREE.Color(0.85, 0.85, 0.9).multiplyScalar(dim), emissive: 0x111118, transparent: true, opacity: 0.85 });
  return { main: lit(M.main), accent: lit(M.accent), detail: lit(M.detail), glass: lit('glass'), paper: lit('paper'), gem, bone: shade({ color: 0xe8dcc0 }), dark: shade({ color: 0x15121a }) };
}

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
  if (spec.maker === 'morra') { mesh(new THREE.SphereGeometry(r * 2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), mats.detail === mats.main ? mats.accent : shade({ color: 0xc04a3a }), parent, r * 1.2, y0 + L * 0.35, 0); }
  if (spec.maker === 'grab') for (const t of [0.25, 0.6]) mesh(new THREE.TorusGeometry(r * 1.3, r * 0.5, 5, 8), mats.main, parent, 0, y0 + L * t, 0).rotation.x = Math.PI / 2;
  return pts;
}
// =====================================================================
// Typen
// =====================================================================
// Kopf je Schule, für alle Typen gleich gebaut (aus dem Viewer); s = Größe, r = Dicke von Ringen/Bögen
function skull(H, s, mats, jawOpen = 0) {
  mesh(new THREE.SphereGeometry(s, 12, 9).scale(0.9, 1, 1), mats.bone, H);
  const jaw = mesh(new THREE.BoxGeometry(s * 1.0, s * 0.42, s * 0.85), mats.bone, H, 0, -s * 0.85, s * 0.12); jaw.rotation.x = jawOpen;
  if (jawOpen) jaw.position.set(0, -s * 0.95, s * 0.35);
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(s * 0.24, 8, 6), mats.gem, H, sx * s * 0.36, 0, s * 0.82);   // Augen in Element-Farbe
  mesh(new THREE.ConeGeometry(s * 0.12, s * 0.22, 3).rotateX(Math.PI), mats.dark, H, 0, -s * 0.35, s * 0.9);          // Nasenloch
}
function makeHead(H, head, s, mats, r) {
  if (head === 'frostorb') {                                             // gefrorene Kugel mit Eissplittern
    mesh(new THREE.IcosahedronGeometry(s, 1), mats.gem, H).userData.spin = 0.5;
    const ice = shade({ color: 0xe0f6ff, transparent: true, opacity: 0.85, emissive: 0x18303c });
    for (let k = 0; k < 7; k++) { const d = new THREE.Vector3(Math.sin(k * 2.4), Math.cos(k * 1.7) * 0.8, Math.cos(k * 2.4)).normalize(), m = mesh(new THREE.ConeGeometry(s * 0.18, s * 0.9, 4), ice, H, d.x * s, d.y * s, d.z * s); m.quaternion.setFromUnitVectors(V(0, 1, 0), d); }
  }
  if (head === 'sichel') {
    const c = mesh(new THREE.TorusGeometry(s * 2.2, r * 0.9, 4, 20, Math.PI * 1.15).scale(1, 1, 0.35), mats.accent, H, -s * 1.1, s * 1.4, 0); c.rotation.z = -0.4;
    mesh(new THREE.OctahedronGeometry(s * 0.6).scale(0.7, 1.4, 0.7), mats.gem, H).userData.spin = 0.6;
  }
  if (head === 'glutschaedel') {                                         // Schädel mit Flammenkrone
    skull(H, s, mats);
    for (let k = 0; k < 3; k++) { const m = mesh(new THREE.ConeGeometry(s * (0.55 - k * 0.15), s * (1.6 - k * 0.4), 8, 1, true).translate(0, s * (0.8 - k * 0.2), 0), new THREE.MeshBasicMaterial({ color: [0xff5a10, 0xffa030, 0xffe8a0][k], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), H, 0, s * 0.7, 0); m.userData.flame = k; }
  }
  if (head === 'dreizack') {                                             // Dreizack mit Widerhaken
    mesh(new THREE.BoxGeometry(s * 2.6, s * 0.25, s * 0.25), mats.accent, H, 0, 0, 0);
    for (const sx of [-1, 0, 1]) {
      const h = sx ? s * 2.0 : s * 2.6, x = sx * s * 1.2;
      mesh(new THREE.CylinderGeometry(s * 0.1, s * 0.13, h, 6), mats.accent, H, x, h / 2, 0);
      mesh(new THREE.ConeGeometry(s * 0.28, s * 0.7, 4), mats.accent, H, x, h + s * 0.3, 0);
      const b = mesh(new THREE.ConeGeometry(s * 0.12, s * 0.45, 4), mats.accent, H, x + (sx || 1) * s * 0.18, h - s * 0.1, 0); b.rotation.z = -(sx || 1) * 2.4;   // Widerhaken
    }
    mesh(new THREE.OctahedronGeometry(s * 0.4), mats.gem, H, 0, -s * 0.05, s * 0.2);
  }
  if (head === 'wolke') {                                                // Gewitterwolke, darunter ein Blitz
    const cloud = shade({ color: 0x4a4e60, emissive: 0x101420 });
    for (const [x, y, z, k] of [[0, 0.3, 0, 1], [-0.8, 0.1, 0.1, 0.75], [0.8, 0.15, -0.1, 0.8], [-0.35, 0.55, -0.2, 0.7], [0.4, 0.6, 0.15, 0.65], [0, 0, 0.45, 0.6]]) mesh(new THREE.IcosahedronGeometry(s * k, 1), cloud, H, x * s, y * s, z * s);
    const bolt = new THREE.Shape(); bolt.moveTo(0, 0); bolt.lineTo(s * 0.35, -s * 0.7); bolt.lineTo(s * 0.05, -s * 0.7); bolt.lineTo(s * 0.3, -s * 1.5); bolt.lineTo(-s * 0.25, -s * 0.55); bolt.lineTo(s * 0.05, -s * 0.55); bolt.lineTo(-s * 0.2, 0); bolt.closePath();
    mesh(new THREE.ShapeGeometry(bolt), mats.gem, H, 0, -s * 0.35, s * 0.3).material.side = THREE.DoubleSide;
  }
  if (head === 'spulen') {                                               // Spulen um einen Stab, oben eine Funkenkugel
    mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.12, s * 2.6, 6), mats.accent, H, 0, s * 0.9, 0);
    for (let k = 0; k < 3; k++) mesh(new THREE.TorusGeometry(s * (0.75 - k * 0.15), s * 0.16, 6, 18).rotateX(Math.PI / 2), mats.accent, H, 0, s * (0.2 + k * 0.6), 0);
    mesh(new THREE.SphereGeometry(s * 0.45, 12, 10), mats.gem, H, 0, s * 2.4, 0);
  }
  if (head === 'speischaedel') {                                         // Schädel mit offenem Kiefer, Schleim läuft heraus
    skull(H, s, mats, 0.6);
    const slime = new THREE.MeshBasicMaterial({ color: 0x6adf2a });
    const pts = [V(0, -s * 0.75, s * 0.75), V(0, -s * 1.1, s * 1.2), V(0, -s * 1.8, s * 1.35), V(0, -s * 2.6, s * 1.2)];
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, s * 0.22, 6), slime, H);
    for (let k = 0; k < 3; k++) { const d = mesh(new THREE.SphereGeometry(s * 0.16, 8, 6), slime, H, (k - 1) * s * 0.15, -s * 2.7, s * 1.2); d.userData.sdrip = { t: k / 3, y: -s * 2.7, len: s * 1.6 }; }
  }
  if (head === 'phiole') {                                               // Glasphiole mit leuchtender Flüssigkeit, Korken
    mesh(new THREE.SphereGeometry(s * 1.0, 16, 12), mats.glass, H);
    mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.38, s * 0.9, 12, 1, true), mats.glass, H, 0, s * 1.2, 0);
    mesh(new THREE.SphereGeometry(s * 0.82, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), mats.gem, H, 0, -s * 0.05, 0);
    mesh(new THREE.CylinderGeometry(s * 0.33, s * 0.28, s * 0.35, 10), shade({ color: 0x8a6440 }), H, 0, s * 1.75, 0);
    for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(s * 0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xc8ff9a }), H, (Math.random() - 0.5) * s, -s * 0.3 + k * s * 0.2, (Math.random() - 0.5) * s).userData.bubble = Math.random();
  }
  if (head === 'ring') { mesh(new THREE.TorusGeometry(s * 1.7, r * 0.6, 6, 24), mats.accent, H, 0, s * 0.9, 0); mesh(new THREE.IcosahedronGeometry(s * 0.6, 0), mats.gem, H, 0, s * 0.9, 0).userData.spin = 0.8; }
  if (head === 'auge') { const e = new THREE.Group(); e.position.y = s * 0.6; H.add(e); mesh(new THREE.SphereGeometry(s, 16, 12), mats.bone, e); mesh(new THREE.CircleGeometry(s * 0.45, 20), mats.gem, e, 0, 0, s * 1.001); mesh(new THREE.CircleGeometry(s * 0.2, 16), mats.dark, e, 0, 0, s * 1.003); e.userData.look = true; }
}

// =====================================================================
// Typen (alle mit makeHead)
// =====================================================================
function buildStaff(g, spec, M, mats) {
  const L = 1.62, r = 0.022 * M.thick;
  const pts = shaft(g, spec, M, mats, 0, L, r), top = pts[pts.length - 1];
  if (spec.maker === 'brandt') mesh(new THREE.ConeGeometry(r * 1.4, 0.14, 6).rotateX(Math.PI), mats.accent, g, 0, -0.05, 0);   // Fuß
  else if (spec.maker === 'vey') mesh(new THREE.OctahedronGeometry(r * 2).scale(1, 2, 1), mats.main, g, 0, 0.0, 0);
  else mesh(new THREE.SphereGeometry(r * 1.5, 8, 5), mats.accent, g, 0, 0.0, 0);
  mesh(new THREE.CylinderGeometry(r * 1.9, r * 1.3, 0.06, M.radial), mats.accent, g, top.x, L - 0.02, top.z);   // Kragen
  const H = new THREE.Group(); H.position.set(top.x, L + 0.15, top.z); g.add(H);
  makeHead(H, spec.head, 0.1, mats, r);
  return H;
}
function buildWand(g, spec, M, mats) {
  const L = 0.42, r = 0.011 * M.thick;
  const pts = shaft(g, spec, M, mats, 0, L, r), top = pts[pts.length - 1];
  mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.8, 0.13, M.radial), mats.detail, g, 0, 0.07, 0);            // Griff (festes Kennteil)
  mesh(new THREE.SphereGeometry(r * 2, 8, 5), mats.accent, g, 0, 0, 0);
  const H = new THREE.Group(); H.position.set(top.x, L + 0.045, top.z); g.add(H);
  makeHead(H, spec.head, 0.045, mats, r);
  return H;
}
function runeTex() { return canvasTex(128, (g, s) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 0.3, s * 0.2); g.lineTo(s * 0.5, s * 0.8); g.lineTo(s * 0.7, s * 0.2); g.moveTo(s * 0.25, s * 0.5); g.lineTo(s * 0.75, s * 0.5); g.stroke(); }); }

function addExtra(g, spec, H, mats) {
  if (spec.extra === 'none') return;
  const at = spec.type === 'staff' ? V(H.position.x, H.position.y - 0.2, H.position.z) : spec.type === 'wand' ? V(0, 0, 0) : spec.type === 'book' ? V(0.05, -0.14, 0) : V(0, -0.12, 0);
  const E = new THREE.Group(); E.position.copy(at); g.add(E); E.userData.sway = true;
  const col = shade({ color: new THREE.Color(RARITY[spec.rarity].color), side: THREE.DoubleSide });
  if (spec.extra === 'baender') for (const sx of [-1, 1]) { const m = mesh(new THREE.PlaneGeometry(0.03, 0.3, 1, 6).translate(0, -0.15, 0), col, E, sx * 0.03, 0, 0); m.rotation.z = sx * 0.2; m.userData.wave = true; }
  if (spec.extra === 'ketten') for (const sx of [-1, 1]) chain(E, V(sx * 0.02, 0, 0), V(sx * 0.06, -0.22, 0), mats.accent, 0.016);
  if (spec.extra === 'federn') for (let k = 0; k < 3; k++) { const m = mesh(new THREE.ConeGeometry(0.02, 0.16, 4).scale(1, 1, 0.2).translate(0, -0.08, 0), col, E, (k - 1) * 0.025, 0, 0); m.rotation.z = (k - 1) * 0.35; }
  if (spec.extra === 'gloeckchen') for (const sx of [-1, 1]) { const b = new THREE.Group(); b.position.set(sx * 0.03, -0.06, 0); E.add(b); mesh(new THREE.ConeGeometry(0.022, 0.04, 10, 1, true), mats.accent, b); mesh(new THREE.SphereGeometry(0.008, 6, 4), mats.accent, b, 0, -0.02, 0); tubeAlong([V(0, 0.02, 0), V(0, 0.06, 0)], 0.002, 3, mats.detail, b); }
}
const dotTex = canvasTex(64, (g, s) => { const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, s, s); });
// Partikel-Bewegung je Element (lokal um den Kopf)
const MOTION = {
  frost: (p, v, dt) => { p.y -= dt * 0.18; p.x += Math.sin(p.y * 9) * dt * 0.05; return p.y < -0.5; },
  feuer: (p, v, dt) => { p.y += dt * (0.35 + v.x); p.x += (Math.random() - 0.5) * dt * 0.2; return p.y > 0.45; },
  arkan: (p, v, dt, t) => { const a = v.y + t * 1.4, r = 0.16 + v.x * 0.5; p.set(Math.cos(a) * r, Math.sin(t * 2 + v.y) * 0.08, Math.sin(a) * r); return false; },
  blitz: (p, v, dt) => { if (Math.random() < dt * 8) p.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4); return false; },
  seuche: (p, v, dt) => { v.z += dt * 0.6; p.y -= dt * v.z; return p.y < -0.6; },
};
function spawnP(el, p, v) {
  v.set(Math.random() * 0.2, Math.random() * 7, 0);
  if (el === 'frost') p.set((Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3);
  else if (el === 'feuer') p.set((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08);
  else if (el === 'seuche') p.set((Math.random() - 0.5) * 0.06, -0.03, (Math.random() - 0.5) * 0.06);
  else p.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
}
function addElement(g, spec, H, size) {
  const el = spec.element, E = ELEMENTS[el], col = new THREE.Color(E.color), fx = ({ parts: null, arcs: [], spinners: [], flames: [] } as any);
  if (el === 'none' || spec.rarity < 1) return fx;
  // Kopf-Details in Element-Form (ab grün sichtbar, Aura + Partikel ab blau)
  if (spec.rarity >= 2) {
    if (el === 'frost') for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, m = mesh(new THREE.ConeGeometry(size * 0.12, size * (0.5 + (k % 2) * 0.3), 5).rotateX(Math.PI), shade({ color: 0xd8f4ff, transparent: true, opacity: 0.85, emissive: 0x1a3040 }), H, Math.cos(a) * size * 0.45, -size * 0.35, Math.sin(a) * size * 0.45); }
    if (el === 'feuer') for (let k = 0; k < 2; k++) { const m = mesh(new THREE.ConeGeometry(size * (0.35 - k * 0.12), size * (1.4 - k * 0.4), 8, 1, true).translate(0, size * (0.7 - k * 0.2), 0), new THREE.MeshBasicMaterial({ color: k ? 0xffe28a : 0xff6a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), H, 0, size * 0.3, 0); fx.flames.push(m); }
    if (el === 'arkan') { const rt = runeTex(); for (let k = 0; k < 3; k++) { const m = mesh(new THREE.PlaneGeometry(size * 0.5, size * 0.5), new THREE.MeshBasicMaterial({ map: rt, color: col.clone().multiplyScalar(1.5), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), H); m.userData.orbit = k / 3 * Math.PI * 2; fx.spinners.push(m); } }
    if (el === 'seuche') for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(size * 0.12, 8, 6), new THREE.MeshBasicMaterial({ color: col }), H, (Math.random() - 0.5) * size, -size * 0.4 - Math.random() * size * 0.3, (Math.random() - 0.5) * size).userData.drip = Math.random();
  }
  if (spec.rarity >= 3) {
    { const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: col.clone().multiplyScalar(0.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 })); aura.scale.setScalar(size * 3.2); H.add(aura); fx.aura = aura; }
    const n = spec.rarity >= 5 ? 80 : 40, pos = new Float32Array(n * 3), P = [], Vv = [];
    for (let i = 0; i < n; i++) { const p = V(0, 0, 0), v = V(0, 0, 0); spawnP(el, p, v); if (el === 'frost' || el === 'feuer' || el === 'seuche') p.y += (Math.random() - 0.5) * 0.4; P.push(p); Vv.push(v); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dotTex, color: col.clone().multiplyScalar(1.4), size: el === 'seuche' ? 0.045 : 0.035, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    H.add(pts); fx.parts = { pts, P, Vv, el };
    if (el === 'blitz') for (let k = 0; k < 2; k++) { const l = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3)), new THREE.LineBasicMaterial({ color: new THREE.Color(0xfff6c0).multiplyScalar(2) })); H.add(l); fx.arcs.push(l); }
  }
  return fx;
}

// Buch und Relikt liegen im Spiel in der Waffenhand (keine Nebenhand)
function buildBook(g, spec, M, mats) {
  const W = 0.22, Hh = 0.29, D = 0.07 * (M.thick > 1.2 ? 1.3 : M.thick < 0.8 ? 0.8 : 1);
  const book = new THREE.Group(); g.add(book); g.userData.float = true;
  const cover = d => mesh(new THREE.BoxGeometry(W, Hh, 0.012), mats.main, book, 0, 0, d);
  cover(D / 2); const back = cover(-D / 2);
  mesh(new THREE.BoxGeometry(0.02, Hh, D), mats.main, book, -W / 2, 0, 0);                                   // Rücken
  mesh(new THREE.BoxGeometry(W * 0.94, Hh * 0.94, D * 0.85), mats.paper, book, 0.006, 0, 0);                // Seiten
  const page = mesh(new THREE.PlaneGeometry(W * 0.9, Hh * 0.9).translate(W * 0.45, 0, 0), mats.paper.clone(), book, -W / 2 + 0.01, 0, D / 2 + 0.004); page.material.side = THREE.DoubleSide; page.userData.flip = true;
  // Einband-Form (Wertgruppe)
  if (spec.shaft === 'gedreht') for (const sy of [-1, 1]) mesh(new THREE.BoxGeometry(W * 1.02, 0.02, D * 1.12), mats.detail, book, 0, sy * Hh * 0.28, 0);
  if (spec.shaft === 'geknotet') for (const sy of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 0.03, 0.016), mats.accent, book, W / 2, sy * Hh * 0.25, 0);
  if (spec.shaft === 'segmentiert') for (const sx of [-1, 1]) for (const sy of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.04, D * 1.15), mats.accent, book, sx * (W / 2 - 0.015), sy * (Hh / 2 - 0.015), 0);
  if (spec.shaft === 'umwickelt') chain(book, V(-W / 2, Hh * 0.3, D / 2 + 0.01), V(W / 2, -Hh * 0.3, D / 2 + 0.01), mats.accent, 0.018);
  if (spec.maker === 'vey') { back.position.z -= 0.03; back.userData.bob = 1; }
  book.rotation.y = 0.35;
  const H = new THREE.Group(); H.position.set(0, Hh / 2 + 0.11, 0); g.add(H); H.userData.hover = true;   // Kopf schwebt über dem Buch
  makeHead(H, spec.head, 0.05, mats, 0.012);
  return H;
}
function buildRelic(g, spec, M, mats) {
  g.userData.float = true;
  const H = new THREE.Group(); g.add(H);
  const s = 0.075 * Math.max(0.85, M.thick * 0.85);                     // Kopf = Kern in der Fassung
  makeHead(H, spec.head, s, mats, 0.02);
  const F = new THREE.Group(); g.add(F);                                 // Fassung (Wertgruppe)
  if (spec.shaft === 'gerade') mesh(new THREE.TorusGeometry(s * 1.9, s * 0.1, 5, 28), mats.accent, F).userData.spinX = 0.8;
  if (spec.shaft === 'gedreht') tubeAlong(helix(-s * 1.6, s * 1.6, s * 1.8, 2.2), s * 0.08, 5, mats.accent, F, false, 60);
  if (spec.shaft === 'geknotet') for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; tubeAlong([V(0, -s * 2.4, 0), V(Math.cos(a) * s * 1.4, -s * 1.5, Math.sin(a) * s * 1.4), V(Math.cos(a) * s * 1.3, -s * 0.2, Math.sin(a) * s * 1.3), V(Math.cos(a) * s * 0.6, s * 0.3, Math.sin(a) * s * 0.6)], s * 0.08, 5, mats.accent, F); }
  if (spec.shaft === 'segmentiert') for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; tubeAlong([V(0, -s * 1.9, 0), V(Math.cos(a) * s * 1.6, -s * 0.9, Math.sin(a) * s * 1.6), V(Math.cos(a) * s * 1.6, s * 0.9, Math.sin(a) * s * 1.6), V(0, s * 1.9, 0)], s * 0.06, 4, mats.accent, F); }
  if (spec.shaft === 'umwickelt') chain(F, V(0, s * 1.4, 0), V(0, s * 4.2, 0), mats.accent, 0.022);
  if (spec.maker === 'vey') F.userData.orbitY = 0.5;
  return H;
}
const BUILD = { staff: buildStaff, wand: buildWand, book: buildBook, relic: buildRelic };
function buildParts(spec) {
  const M = MAKERS[spec.maker], mats = makeMats(spec), g = new THREE.Group();
  const H = BUILD[spec.type](g, spec, M, mats);
  addExtra(g, spec, H, mats);
  const size = spec.type === 'staff' ? 0.2 : spec.type === 'wand' ? 0.08 : spec.type === 'book' ? 0.12 : 0.17;
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
      if (u.sdrip) { u.sdrip.t = (u.sdrip.t + dt * 0.8) % 1; o.position.y = u.sdrip.y - u.sdrip.t * u.sdrip.len; o.scale.setScalar(1 - u.sdrip.t * 0.7); }   // Seuche: Schleim tropft
      if (u.flame !== undefined) o.scale.set(1 + Math.sin(t * 15 + u.flame) * 0.12, 1 + Math.sin(t * 9 + u.flame * 2) * 0.3, 1 + Math.sin(t * 13 + u.flame) * 0.12);   // Glutschädel
      if (u.hover) o.position.y += Math.sin(t * 2.2) * 0.0008;                                                         // Buch: Kopf schwebt
      if (u.bubble !== undefined) { u.bubble = (u.bubble + dt * 0.4) % 1; o.position.y = -0.03 + u.bubble * 0.06; }              // Seuche: Blasen steigen
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
const animated = o => { const u = o.userData; return u.spin || u.bob || u.spinX || u.orbitY || u.flip || u.wave || u.sway || u.drip !== undefined || u.beat || u.look || u.orbit !== undefined || u.sdrip || u.bubble !== undefined || u.flame !== undefined || u.hover; };
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
  // Der Kopf (Edelstein, Element) bleibt beweglich, der Rest wird verschmolzen; im Kopf werden die festen Teile für sich verschmolzen
  mergeStatic(built.head);
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
