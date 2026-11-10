// Vorschaubild eines Gear- oder Kosmetik-Teils aus dem echten Modell (Fenster, Shop, Run-Ende), wie weaponThumb.ts bei den Waffen.
// Die Bauer (models/gearParts.ts buildGearTree, models/kosmetikParts.ts kosmetikTree) liefern einen Baum in Viewer-Koordinaten mit
// Geometrie und Farbe in userData; hier wird er ohne Figur zu Meshes: beleuchtet als Toon, Leuchtteile unbeleuchtet, Glas durchsichtig.
// Gerechnet im geteilten Offscreen-Renderer (snap), nur wenn ein Bild gebraucht wird, Ergebnis als data-URL gemerkt
// (Gear nach Aussehen: Slot, Form, Seltenheit, Hersteller, Element, Fokus; Kosmetik je Look-id). Kein Draw Call in der Spielszene.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildGearTree } from '../models/gearParts';
import { kosmetikTree } from '../models/kosmetikParts';
import { groupOf, makerOf, LOOKS, type GearItem } from '../gear';
import { snap, weaponThumb } from './weaponThumb';

export const THUMB = { px: 128, yaw: 0.5, pitch: 0.22, pad: 1.1, splinter: 0.85, budget: 6 };   // Bildgröße, Blick leicht schräg von vorn und oben, Rand, ms pro Frame beim Nachladen // PH
const cache = new Map<string, string>();
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
type Mat = { c: THREE.Color; g?: 0 | 1; ds?: boolean; glass?: number; fn?: (p: THREE.Vector3) => THREE.Color } | null;

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
function shoot(group: THREE.Group, splinters: THREE.Mesh[], back: boolean) {
  const pivot = new THREE.Group();
  pivot.add(group);
  for (const s of splinters) group.remove(s);
  pivot.rotation.set(THUMB.pitch, back ? Math.PI - THUMB.yaw : THUMB.yaw, 0);   // Rücken-Teile von hinten
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  if (box.isEmpty()) throw new Error('leer');
  const size = box.getSize(V()), ctr = box.getCenter(V());
  splinters.forEach((s, i) => {   // in Welt-Lage neben das Teil, ohne die Drehung des Pivots
    pivot.add(s);
    s.geometry.center();
    s.position.set(ctr.x + (i % 2 ? 1 : -1) * size.x * 0.5 * THUMB.splinter, ctr.y + size.y * 0.35, ctr.z + size.z);
    s.position.applyMatrix4(pivot.matrixWorld.clone().invert());
  });
  return snap(pivot, THUMB.px, THUMB.px, box, THUMB.pad);
}

function render(tree: THREE.Object3D, back: boolean, skip?: (o: THREE.Object3D) => boolean) {
  const m = toMeshes(tree, skip);
  freeTree(tree);
  try {
    const spl = m.out.children.filter(c => c.userData.splinter);
    return shoot(m.out, spl as THREE.Mesh[], back);
  } finally { m.dispose(); }
}

const gearKey = (g: GearItem) => `g:${g.slot}:${groupOf(g)}:${g.r}:${makerOf(g) ?? 'stern'}:${g.s.element}:${g.s.focus ?? ''}`;   // nach Aussehen, gleiche Teile teilen sich ein Bild
// Gear-Teil: Form nach Wertgruppe, Farben nach Hersteller/Seltenheit/Element, Fokus-Emblem. Arme: nur der rechte Arm
export function gearThumb(g: GearItem): string {
  const group = groupOf(g);
  if (!group) return '';
  const look = { r: g.r, s: { maker: makerOf(g) ?? 'stern', element: g.s.element, ...(g.s.focus ? { focus: g.s.focus } : {}) } };
  const key = gearKey(g), hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const t = buildGearTree(g.slot, group, look);
    if (t) {
      const tree = 'L' in t ? (freeTree(t.L), t.R) : t;
      url = render(tree, g.slot === 'ruecken');
    }
  } catch { url = ''; }   // ohne Bild bleibt das SVG
  cache.set(key, url);
  return url;
}

// Kosmetik-Teil je Look-id (Ruhelage, ohne Reaktion). Waffen-Looks (Haarspray) aus dem Waffen-Modell
export function lookThumb(id: string): string {
  const key = `k:${id}`, hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    if (LOOKS[id]?.slot === 'waffe') url = weaponThumb({ id: `look:${id}`, m: id });
    else { const tree = kosmetikTree(id); if (tree) url = render(tree, LOOKS[id].slot === 'ruecken', o => !!o.userData.free); }
  } catch { url = ''; }
  cache.set(key, url);
  return url;
}

// ---------------- Nachladen: Bilder erst nach dem Aufbau des Fensters rechnen, verteilt auf Frames ----------------
// thumbHtml gibt das fertige <img> zurück, wenn es schon gemerkt ist, sonst das SVG in einem Platzhalter. Ein Frame-Loop rechnet dann
// höchstens THUMB.budget ms pro Frame und tauscht die Platzhalter, die noch im Dokument hängen. Ist keiner mehr da (Fenster zu,
// neu gebaut), wird nichts gerechnet; der Loop läuft nur, solange etwas wartet.
const jobs = new Map<string, () => string>();
let loop = 0;
const img = (src: string) => `<img class="thumb" src="${src}" alt="" draggable="false">`;
function pump() {
  loop = 0;
  const t0 = performance.now();
  for (const [key, make] of jobs) {
    const spots = document.querySelectorAll<HTMLElement>(`[data-thumb="${key}"]`);
    jobs.delete(key);
    if (!spots.length) continue;
    const src = make();
    if (src) for (const s of spots) { s.innerHTML = img(src); s.removeAttribute('data-thumb'); }
    if (performance.now() - t0 > THUMB.budget) break;
  }
  if (jobs.size) loop = requestAnimationFrame(pump);
}
function thumbHtml(key: string, make: () => string, fallback: string) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit ? img(hit) : fallback;
  jobs.set(key, make);
  if (!loop) loop = requestAnimationFrame(pump);
  return `<span class="thumbWait" data-thumb="${key}">${fallback}</span>`;
}
// HTML fürs Feld: Bild des Teils bzw. Looks, bis es fertig ist (oder wenn das Rendern scheitert) das SVG
export const gearThumbHtml = (g: GearItem, fallback: string) => thumbHtml(gearKey(g), () => gearThumb(g), fallback);
export const lookThumbHtml = (id: string, fallback: string) => thumbHtml(`k:${id}`, () => lookThumb(id), fallback);
