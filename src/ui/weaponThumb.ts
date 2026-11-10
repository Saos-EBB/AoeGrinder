// Vorschaubild einer Waffe aus dem echten Modell (Inventar, Shop). Ein kleiner eigener Renderer, erst beim ersten Bild angelegt,
// geteilt mit den Gear- und Kosmetik-Bildern (itemThumb.ts). Ergebnis als data-URL, pro Waffe einmal gerechnet und gemerkt.

import * as THREE from 'three';
import { buildWeaponOf } from '../weaponRolls';

const W = 96, H = 240;   // Pixel des Bilds, angezeigt etwa halb so groß // PH
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null, scene: THREE.Scene, camera: THREE.OrthographicCamera;

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
}

// root ins Bild w × h einpassen (Box des Bilds: fit, sonst die ganze Gruppe) und als PNG-data-URL zurück. Wirft, wenn WebGL fehlt
export function snap(root: THREE.Object3D, w: number, h: number, fit?: THREE.Box3, pad = 1.08): string {
  if (!renderer) setup();
  const cur = renderer.getSize(new THREE.Vector2());
  if (cur.x !== w || cur.y !== h) renderer.setSize(w, h, false);
  scene.add(root);
  root.updateMatrixWorld(true);
  const box = fit ?? new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3()), aspect = w / h;
  const half = Math.max(size.y / 2, size.x / 2 / aspect) * pad;
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half, near: 0.01, far: 10 + size.z * 2 + 10 });
  camera.position.set(c.x, c.y, c.z + 10 + size.z);
  camera.lookAt(c);
  camera.updateProjectionMatrix();
  try {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally { scene.remove(root); }
}

export function weaponThumb(w): string {
  const key = `${w.id}:${JSON.stringify(w.s ?? w.m ?? w.e)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const built = buildWeaponOf(w);
    built.update?.(0, 0);
    const root = built.root;
    root.updateMatrixWorld(true);
    // Längste Achse senkrecht stellen, dann ins Bild einpassen
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    if (size.x > size.y && size.x >= size.z) root.rotation.z = Math.PI / 2;
    else if (size.z > size.y) root.rotation.x = Math.PI / 2;
    root.rotation.y += 0.5;
    const url = snap(root, W, H);
    built.dispose?.();
    cache.set(key, url);
    return url;
  } catch {
    return '';   // ohne Bild bleibt das Feld beim Platzhalter
  }
}
