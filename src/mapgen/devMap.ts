// Dev-Fenster (Gruppe Spawn → Zone): Seed der generierten Map anzeigen und setzen, neu würfeln. Theme = Zonen-Knopf map-<theme>.
// Test-Hook window.__mapgen (Skripte unter .fg-pw/maps): Layout, Seed, Draw Calls der Umgebung, Bild von oben.

import * as THREE from 'three';
import { zone, zoneId } from '../world';
import { mapSeed, setMapSeed, rerollSeed } from './rng';
import { scene, renderer, camera } from '../render';
import { GEN_ZONES, zoneIdOf } from './registry';
import { generate } from './genZone';

export function renderDevMapGen(box: HTMLElement, rebuild: (id: string) => void) {
  const row = document.createElement('div');
  row.id = 'devMapGen';
  row.style.cssText = 'grid-column: 1 / -1; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; font-size: 12px;';
  const info = zone.gen ? `Seed ${zone.seed} · ${zone.tries} Versuch${zone.tries === 1 ? '' : 'e'}${zone.problem ? ' · ⚠ ' + zone.problem : ''}` : `Seed ${mapSeed()} (nur generierte Maps)`;
  row.innerHTML = `<span>${info}</span><input type="number" min="1" value="${mapSeed()}" style="width: 90px"><button class="bindBtn" data-a="set">Seed setzen</button><button class="bindBtn" data-a="roll">Neu würfeln</button>`;
  row.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (!a) return;
    if (a === 'set') setMapSeed(Number((row.querySelector('input') as HTMLInputElement).value));
    else rerollSeed();
    rebuild(zone.gen ? zoneId : zoneIdOf('wald'));
  });
  box.appendChild(row);
}

// Bild von oben: eigene Ortho-Kamera, ohne Nebel, aufgehellt. Gibt eine PNG-Data-URL zurück.
function topShot(px = 640) {
  const b = zone.bounds ?? { minX: -110, maxX: 110, minZ: -110, maxZ: 110 }, w = b.maxX - b.minX;
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, w / 2, -w / 2, 1, 400);
  cam.position.set((b.minX + b.maxX) / 2, 200, (b.minZ + b.maxZ) / 2);
  cam.up.set(0, 0, -1);
  cam.lookAt(cam.position.x, 0, cam.position.z);
  const fog = scene.fog, size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio();
  const amb = new THREE.AmbientLight(0xffffff, 2.2);
  scene.fog = null; scene.add(amb);
  renderer.setPixelRatio(1); renderer.setSize(px, px, false);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(amb); scene.fog = fog;
  renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false);
  return url;
}

// Draw Calls nur der Umgebung: Gelände + Meshes der Map, ein Durchgang ohne Post
function envCalls() {
  const meshes = zone.meshes ?? [];
  return 1 + meshes.length;
}

(window as any).__mapgen = {
  zones: GEN_ZONES, generate, setSeed: setMapSeed, seed: mapSeed,
  get zone() { return zone; }, get layout() { return zone.layout; },
  topShot, envCalls, scene, camera,
};
