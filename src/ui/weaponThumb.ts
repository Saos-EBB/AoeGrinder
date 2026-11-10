// Vorschaubild einer Waffe aus dem echten Modell (Inventar, Shop). Ein kleiner eigener Renderer, erst beim ersten Bild angelegt,
// geteilt mit den Gear- und Kosmetik-Bildern (itemThumb.ts). Ergebnis als data-URL, pro Waffe einmal gerechnet und gemerkt.
// Mehrere Bilder auf einmal (snapMany): nebeneinander in einem Bild gerendert und einmal zurückgelesen, dann zugeschnitten.
// Das Zurücklesen wartet auf die Grafikkarte (auch auf die Spielszene), daher lieber selten und gesammelt.

import * as THREE from 'three';
import { buildWeaponOf } from '../weaponRolls';

const W = 96, H = 240;   // Pixel des Bilds, angezeigt etwa halb so groß // PH
const ATLAS = 2048;      // Breite des Sammelbilds
export const thumbCache = new Map<string, string>();   // Schlüssel → data-URL ('' = Rendern gescheitert, SVG bleibt)
let renderer: THREE.WebGLRenderer | null = null, scene: THREE.Scene, camera: THREE.OrthographicCamera;
let atlas: HTMLCanvasElement, tile: HTMLCanvasElement;

function setup() {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x201010, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  atlas = document.createElement('canvas');
  tile = document.createElement('canvas');
}

// Ein Bild: root ins Feld w × h einpassen (Box fit, sonst die ganze Gruppe). done räumt danach auf
export interface Shot { root: THREE.Object3D; w: number; h: number; fit?: THREE.Box3; pad?: number; done?: () => void }

function aim(s: Shot) {
  s.root.updateMatrixWorld(true);
  const box = s.fit ?? new THREE.Box3().setFromObject(s.root), size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3()), aspect = s.w / s.h;
  const half = Math.max(size.y / 2, size.x / 2 / aspect) * (s.pad ?? 1.08);
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half, near: 0.01, far: 20 + size.z * 2 });
  camera.position.set(c.x, c.y, c.z + 10 + size.z);
  camera.lookAt(c);
  camera.updateProjectionMatrix();
}

// Alle Bilder in einem Durchgang, Ergebnis in derselben Reihenfolge ('' wenn eins scheitert). Wirft, wenn WebGL fehlt
export function snapMany(shots: Shot[]): string[] {
  if (!shots.length) return [];
  if (!renderer) setup();
  const pos: [number, number][] = [];
  let x = 0, y = 0, row = 0, wMax = 0;
  for (const s of shots) {
    if (x + s.w > ATLAS) { x = 0; y += row; row = 0; }
    pos.push([x, y]); x += s.w; row = Math.max(row, s.h); wMax = Math.max(wMax, x);
  }
  const AW = wMax, AH = y + row, cur = renderer.getSize(new THREE.Vector2());
  if (cur.x < AW || cur.y < AH) renderer.setSize(Math.max(cur.x, AW), Math.max(cur.y, AH), false);
  const full = renderer.getSize(new THREE.Vector2()), ok = shots.map(() => true);
  renderer.setScissorTest(true);
  shots.forEach((s, i) => {
    const [px, py] = pos[i], gy = full.y - py - s.h;   // GL zählt von unten
    renderer.setViewport(px, gy, s.w, s.h);
    renderer.setScissor(px, gy, s.w, s.h);
    try { aim(s); scene.add(s.root); renderer.render(scene, camera); } catch { ok[i] = false; }
    scene.remove(s.root);
  });
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, full.x, full.y);
  let src: CanvasImageSource = renderer.domElement;
  if (shots.length > 1) {   // einmal zurücklesen, dann aus der Kopie schneiden
    if (atlas.width !== full.x || atlas.height !== full.y) { atlas.width = full.x; atlas.height = full.y; }
    const a = atlas.getContext('2d');
    a.clearRect(0, 0, AW, AH);
    a.drawImage(renderer.domElement, 0, 0, AW, AH, 0, 0, AW, AH);
    src = atlas;
  }
  const tc = tile.getContext('2d');
  const out = shots.map((s, i) => {
    s.done?.();
    if (!ok[i]) return '';
    if (tile.width !== s.w || tile.height !== s.h) { tile.width = s.w; tile.height = s.h; }
    tc.clearRect(0, 0, s.w, s.h);
    tc.drawImage(src, pos[i][0], pos[i][1], s.w, s.h, 0, 0, s.w, s.h);
    return tile.toDataURL('image/png');
  });
  return out;
}

export const weaponKey = w => `w:${w.id}:${JSON.stringify(w.s ?? w.m ?? w.e)}`;
// Waffe als Bild vorbereiten: längste Achse senkrecht, leicht gedreht
export function weaponShot(w): Shot {
  const built = buildWeaponOf(w);
  built.update?.(0, 0);
  const root = built.root;
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  if (size.x > size.y && size.x >= size.z) root.rotation.z = Math.PI / 2;
  else if (size.z > size.y) root.rotation.x = Math.PI / 2;
  root.rotation.y += 0.5;
  return { root, w: W, h: H, done: () => built.dispose?.() };
}

export function weaponThumb(w): string {
  const key = weaponKey(w), hit = thumbCache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try { url = snapMany([weaponShot(w)])[0]; } catch { url = ''; }   // ohne Bild bleibt das Feld beim Platzhalter
  thumbCache.set(key, url);
  return url;
}
