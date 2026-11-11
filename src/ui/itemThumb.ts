// Vorschaubild eines Gear- oder Kosmetik-Teils aus dem echten Modell (Fenster, Shop, Run-Ende), wie weaponThumb.ts bei den Waffen.
// Die Bauer (models/gearParts.ts buildGearTree, models/kosmetikParts.ts kosmetikTree) liefern einen Baum in Viewer-Koordinaten mit
// Geometrie und Farbe in userData; hier wird er ohne Figur zu Meshes: beleuchtet als Toon, Leuchtteile unbeleuchtet, Glas durchsichtig.
// Gerechnet im geteilten Offscreen-Renderer (snap), nur wenn ein Bild gebraucht wird, Ergebnis als data-URL gemerkt
// (Gear nach Aussehen: Slot, Form, Seltenheit, Hersteller, Element, Fokus; Kosmetik je Look-id). Kein Draw Call in der Spielszene.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildGearTree } from '../models/gearParts';
import { kosmetikTree } from '../models/kosmetikParts';
import type { Mat } from '../models/partKit';
import { groupOf, makerOf, KOSMETIK, type GearItem } from '../gear';
import { snapMany, thumbCache as cache, weaponKey, weaponShot, type Shot } from './weaponThumb';
import { V } from '../util';

const THUMB = { px: 128, yaw: 0.5, pitch: 0.22, pad: 1.1, splinter: 0.85, budget: 6, batch: 8 };   // Bildgröße, Blick leicht schräg von vorn und oben, Rand; Nachladen: ms Aufbau und Bilder pro Frame // PH

// Baum → wenige Meshes: Geometrie in Welt-Lage mit Farbe je Ecke, je Art (beleuchtet, Leuchtteil, Glas) und Seite zusammengefasst,
// Materialien einmal angelegt. Schwebende Splitter bleiben einzeln (shoot setzt sie neu). skip: Teilbäume, die nicht ins Bild gehören
let MATS: Record<string, THREE.Material> | null = null;
const mats = () => MATS ??= {
  lit: new THREE.MeshToonMaterial({ vertexColors: true }), litDs: new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }), glowDs: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  glass: new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
};
const _c = V(), _p = V();
function toMeshes(tree: THREE.Object3D, skip: (o: THREE.Object3D) => boolean = () => false) {
  tree.updateMatrixWorld(true);
  const out = new THREE.Group(), buckets: Record<string, THREE.BufferGeometry[]> = {}, own: THREE.BufferGeometry[] = [];
  const walk = (o: THREE.Object3D) => {
    if (skip(o)) return;
    const m = o.userData.mat as Mat, g0 = o.userData.geo as THREE.BufferGeometry | undefined;
    if (g0 && m) {
      const g = (g0.index ? g0.toNonIndexed() : g0.clone()).applyMatrix4(o.matrixWorld), p = g.attributes.position, col = new Float32Array(p.count * 3);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      for (let i = 0; i + 2 < p.count; i += 3) {   // Muster (Kuh, Karo): Farbe je Dreieck wie im Körper-Mesh
        let k = m.c;
        if (m.fn) { _c.set(0, 0, 0); for (let j = 0; j < 3; j++) _c.add(_p.fromBufferAttribute(p, i + j)); k = m.fn(_c.multiplyScalar(1 / 3)); }
        for (let j = 0; j < 3; j++) col.set([k.r, k.g, k.b], (i + j) * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const kind = m.glass != null ? 'glass' : (m.g ? 'glow' : 'lit') + (m.ds ? 'Ds' : '');
      if (o.userData.orbit && !o.userData.orbit.flat) { const s = new THREE.Mesh(g, mats()[kind]); s.userData.splinter = true; out.add(s); own.push(g); }
      else (buckets[kind] ??= []).push(g);
    }
    for (const c of o.children) walk(c);
  };
  walk(tree);
  for (const [kind, list] of Object.entries(buckets)) {
    const g = mergeGeometries(list);
    for (const x of list) x.dispose();
    if (!g) continue;
    own.push(g);
    const mesh = new THREE.Mesh(g, mats()[kind]);
    if (kind === 'glass') mesh.renderOrder = 2;
    out.add(mesh);
  }
  return { out, dispose() { for (const g of own) g.dispose(); } };
}
// Bauer-Geometrie (Original vor dem Klonen) freigeben
const freeTree = (tree: THREE.Object3D) => tree.traverse(o => (o.userData.geo as THREE.BufferGeometry | undefined)?.dispose());

// Leicht schräg von vorn drehen, ins Quadrat einpassen. Schwebende Splitter (Seltenheit ab Lila) kreisen an der Figur weit weg vom Teil:
// im Bild stehen sie oben links und rechts neben dem Teil, damit das Teil groß bleibt. back: Rücken-Teile von hinten zeigen
function shotOf(tree: THREE.Object3D, back: boolean, skip?: (o: THREE.Object3D) => boolean): Shot | null {
  const m = toMeshes(tree, skip);
  freeTree(tree);
  const splinters = m.out.children.filter(c => c.userData.splinter) as THREE.Mesh[];
  const pivot = new THREE.Group();
  pivot.add(m.out);
  for (const s of splinters) m.out.remove(s);
  pivot.rotation.set(THUMB.pitch, back ? Math.PI - THUMB.yaw : THUMB.yaw, 0);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  if (box.isEmpty()) { m.dispose(); return null; }
  const size = box.getSize(V()), ctr = box.getCenter(V()), inv = pivot.matrixWorld.clone().invert();
  splinters.forEach((s, i) => {   // in Welt-Lage neben das Teil, ohne die Drehung des Pivots
    pivot.add(s);
    s.geometry.center();
    s.scale.setScalar(Math.max(1, size.y * 0.07 / 0.04));   // bei großen Teilen (Robe) mitwachsen, sonst kaum zu sehen // PH
    s.position.set(ctr.x + (i % 2 ? 1 : -1) * size.x * 0.5 * THUMB.splinter, ctr.y + size.y * 0.35, ctr.z + size.z).applyMatrix4(inv);
  });
  return { root: pivot, w: THUMB.px, h: THUMB.px, fit: box, pad: THUMB.pad, done: m.dispose };
}

const gearKey = (g: GearItem) => `g:${g.slot}:${groupOf(g)}:${g.r}:${makerOf(g) ?? 'stern'}:${g.s.element}:${g.s.focus ?? ''}`;   // nach Aussehen, gleiche Teile teilen sich ein Bild
// Gear-Teil: Form nach Wertgruppe, Farben nach Hersteller/Seltenheit/Element, Fokus-Emblem. Arme: nur der rechte Arm
function gearShot(g: GearItem): Shot | null {
  const group = groupOf(g);
  if (!group) return null;
  const t = buildGearTree(g.slot, group, { r: g.r, s: { maker: makerOf(g) ?? 'stern', element: g.s.element, ...(g.s.focus ? { focus: g.s.focus } : {}) } });
  if (!t) return null;
  return shotOf('L' in t ? (freeTree(t.L), t.R) : t, g.slot === 'ruecken');
}
// Kosmetik-Teil je Look-id (Ruhelage, ohne Reaktion). Waffen-Looks (Haarspray) aus dem Waffen-Modell
function kosmetikShot(id: string): Shot | null {
  if (KOSMETIK[id]?.slot === 'waffe') return weaponShot({ id: `look:${id}`, m: id });
  const tree = kosmetikTree(id);
  return tree ? shotOf(tree, KOSMETIK[id].slot === 'ruecken', o => !!o.userData.free) : null;
}

// Sofort (z. B. Shop-Ergebnis): Bild oder '' (dann bleibt das SVG)
function now(key: string, make: () => Shot | null) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try { const s = make(); url = s ? snapMany([s])[0] : ''; } catch { url = ''; }
  cache.set(key, url);
  return url;
}
export const gearThumb = (g: GearItem) => now(gearKey(g), () => gearShot(g));
export const kosmetikThumb = (id: string) => now(`k:${id}`, () => kosmetikShot(id));

// ---------------- Nachladen: Bilder erst nach dem Aufbau des Fensters rechnen, verteilt auf Frames ----------------
// thumbHtml gibt das fertige <img> zurück, wenn es schon gemerkt ist, sonst das SVG in einem Platzhalter. Ein Frame-Loop baut dann
// pro Frame Teile für höchstens THUMB.budget ms (bis THUMB.batch Stück), rendert sie gesammelt und tauscht die Platzhalter, die
// noch im Dokument hängen. Ist keiner mehr da (Fenster zu, neu gebaut), wird nichts gerechnet; der Loop läuft nur, solange etwas wartet.
const jobs = new Map<string, () => Shot | null>();
let loop = 0;
const img = (src: string) => `<img class="thumb" src="${src}" alt="" draggable="false">`;
const attr = (key: string) => key.replace(/[^\w:.,-]/g, '_');   // Schlüssel als Attribut (Waffen-Schlüssel enthalten JSON)
const spotsOf = (key: string) => document.querySelectorAll<HTMLElement>(`[data-thumb="${attr(key)}"]`);
function pump() {
  loop = 0;
  const t0 = performance.now(), keys: string[] = [], shots: Shot[] = [];
  for (const [key, make] of jobs) {
    jobs.delete(key);
    if (!spotsOf(key).length) continue;
    let s: Shot | null = null;
    try { s = make(); } catch { s = null; }
    if (s) { keys.push(key); shots.push(s); } else done(key, '');
    if (shots.length >= THUMB.batch || performance.now() - t0 > THUMB.budget) break;
  }
  let urls: string[] = [];
  try { urls = snapMany(shots); } catch { for (const s of shots) s.done?.(); }
  keys.forEach((k, i) => done(k, urls[i] ?? ''));
  if (jobs.size) loop = requestAnimationFrame(pump);
}
function done(key: string, src: string) {
  cache.set(key, src);
  for (const s of spotsOf(key)) { if (src) s.outerHTML = img(src); else s.removeAttribute('data-thumb'); }   // ohne Bild bleibt das SVG stehen
}
function thumbHtml(key: string, make: () => Shot | null, fallback: string) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit ? img(hit) : fallback;
  jobs.set(key, make);
  if (!loop) loop = requestAnimationFrame(pump);
  return `<span class="thumbWait" data-thumb="${attr(key)}">${fallback}</span>`;
}
// HTML fürs Feld: Bild des Teils bzw. Looks, bis es fertig ist (oder wenn das Rendern scheitert) das SVG. Waffen im Raster ebenso
export const gearThumbHtml = (g: GearItem, fallback: string) => thumbHtml(gearKey(g), () => gearShot(g), fallback);
export const kosmetikThumbHtml = (id: string, fallback: string) => thumbHtml(`k:${id}`, () => kosmetikShot(id), fallback);
export const weaponThumbHtml = (w, fallback: string) => thumbHtml(weaponKey(w), () => weaponShot(w), fallback);

// Renderer und Shader vorab anlegen (im Hauptmenü, wenn der Browser Luft hat), damit das erste Öffnen des Fensters nicht stockt.
// when(): nur dann (z. B. nicht im Run); sonst beim nächsten Leerlauf erneut fragen, höchstens bis es einmal geklappt hat
export function warmThumbs(when: () => boolean) {
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500));
  const go = () => {
    if (!when()) { setTimeout(() => idle(go), 3000); return; }
    try {
      const g = new THREE.Group(), box = new THREE.BoxGeometry(0.1, 0.1, 0.1).toNonIndexed();
      box.setAttribute('color', new THREE.BufferAttribute(new Float32Array(box.attributes.position.count * 3).fill(1), 3));
      for (const k of ['lit', 'litDs', 'glow', 'glowDs', 'glass']) g.add(new THREE.Mesh(box, mats()[k]));
      snapMany([{ root: g, w: 8, h: 8, done: () => box.dispose() }, weaponShot({ id: 'look:haarspray', m: 'haarspray' })]);
    } catch { /* ohne WebGL: SVG bleibt */ }
  };
  idle(go);
}
