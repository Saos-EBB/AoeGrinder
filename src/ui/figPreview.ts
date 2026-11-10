// Fenster heroWindow.ts: die gewählte Figur mit der ausgerüsteten Waffe als 3D-Ansicht zwischen den Slots.
// Kein eigener Renderer: Vor dem normalen Bild wird nur die Figur in eine Ecke des Spiel-Canvas gezeichnet, sofort in ein
// 2D-Canvas kopiert und danach vom Composer übermalt. Läuft nur, solange ein Fenster mit Vorschau offen ist (setFigPreview): ein eigener Schalter statt
// einer Layout-Abfrage (offsetParent) in jedem Frame, die im Run sonst Layout erzwingt.

import * as THREE from 'three';
import { renderer, scene } from '../render';
import { mage } from '../models/mage';

const VIEW = { fov: 28, dist: 6.2, camY: 1.5, lookY: 1.15, turn: 0.35 };   // Kamera vor der Figur, leicht von der Seite // PH
const cam = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 60);
const size = new THREE.Vector2(), clear = new THREE.Color();
const TURN_PER_PX = 0.012;   // Ziehen mit der Maus dreht die Figur // PH
let active = false, canvas: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null, spin = 0, dragX: number | null = null;

// Ein Canvas, erneutes Mounten hängt es in den neuen Platz um
export function mountFigPreview(host: HTMLElement) {
  if (canvas) { host.replaceChildren(canvas); return; }
  canvas = document.createElement('canvas');
  canvas.className = 'hwFig3d';
  canvas.setAttribute('aria-hidden', 'true');
  host.replaceChildren(canvas);
  ctx = canvas.getContext('2d');
  canvas.addEventListener('pointerdown', e => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (dragX === null) return; spin -= (e.clientX - dragX) * TURN_PER_PX; dragX = e.clientX; });
  const stop = () => { dragX = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}

// Fenster mit Vorschau auf/zu (heroWindow.ts)
export function setFigPreview(on: boolean) { active = on; }

export function renderFigPreview() {
  if (!active || !canvas?.offsetParent || !ctx) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const pr = renderer.getPixelRatio(), pw = Math.round(w * pr), ph = Math.round(h * pr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }

  // Kamera vor die Figur (Modell schaut entlang +z)
  const root = mage.root, a = root.rotation.y + VIEW.turn + spin;
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  cam.position.set(root.position.x + Math.sin(a) * VIEW.dist, root.position.y + VIEW.camY, root.position.z + Math.cos(a) * VIEW.dist);
  cam.lookAt(root.position.x, root.position.y + VIEW.lookY, root.position.z);

  // Nur Figur, Schal/Effekte der Figur und Lichter zeichnen; Hintergrund = Kartenfarbe des Flavors
  const keep = new Set<THREE.Object3D>([root, mage.hero?.scarf, mage.hero?.fx?.group].filter(Boolean));
  const hidden: THREE.Object3D[] = [];
  for (const o of scene.children) if (o.visible && !keep.has(o) && !(o as THREE.Light).isLight) { o.visible = false; hidden.push(o); }
  const { fog, background } = scene;
  scene.fog = null;
  scene.background = null;
  const oldClear = renderer.getClearColor(new THREE.Color()), oldAlpha = renderer.getClearAlpha();
  renderer.setClearColor(clear.setStyle(getComputedStyle(document.body).getPropertyValue('--fg-card').trim() || '#120a08'), 1);

  renderer.getSize(size);
  renderer.setRenderTarget(null);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.setScissorTest(true);
  renderer.render(scene, cam);
  ctx.drawImage(renderer.domElement, 0, renderer.domElement.height - ph, pw, ph, 0, 0, pw, ph);   // gleich kopieren, der Composer übermalt die Ecke

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, size.x, size.y);
  renderer.setClearColor(oldClear, oldAlpha);
  scene.fog = fog;
  scene.background = background;
  for (const o of hidden) o.visible = true;
}
