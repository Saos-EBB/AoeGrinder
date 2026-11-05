// Vorschaubild einer Waffe aus dem echten Modell (Inventar, Shop). Ein kleiner eigener Renderer, erst beim ersten Bild angelegt.
// Ergebnis als data-URL, pro Waffe einmal gerechnet und gemerkt.

import * as THREE from 'three';
import { buildWeaponOf } from '../weaponRolls';

const W = 96, H = 240;   // Pixel des Bilds, angezeigt etwa halb so groß // PH
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null, scene: THREE.Scene, camera: THREE.OrthographicCamera;

function setup() {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x201010, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
}

export function weaponThumb(w): string {
  const key = `${w.id}:${JSON.stringify(w.s ?? w.m ?? w.e)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    if (!renderer) setup();
    const built = buildWeaponOf(w);
    built.update?.(0, 0);
    const root = built.root;
    scene.add(root);
    root.updateMatrixWorld(true);
    // Längste Achse senkrecht stellen, dann ins Bild einpassen
    let box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    if (size.x > size.y && size.x >= size.z) root.rotation.z = Math.PI / 2;
    else if (size.z > size.y) root.rotation.x = Math.PI / 2;
    root.rotation.y += 0.5;
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);
    size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3()), aspect = W / H;
    const half = Math.max(size.y / 2, size.x / 2 / aspect) * 1.08;
    Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    camera.position.set(c.x, c.y, c.z + 10);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(root);
    built.dispose?.();
    cache.set(key, url);
    return url;
  } catch {
    return '';   // ohne Bild bleibt das Feld beim Platzhalter
  }
}
