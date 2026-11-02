// Mob-Modus Belagerung: Mobs kommen vom Kartenrand, ohne Obergrenze und immer schneller. Zum Finden des Limits.
// Stopp-Regel gibt es keine: Kartenmodell, Nameplates und Kollision bleiben teuer, darum zeigt die Anzeige die FPS mit.

import * as THREE from 'three';
import { state, player } from './state';
import { $, rand } from './util';
import { WORLD_K } from './config';
import { mobMode, setMobMode } from './modifiers';
import { zone } from './world';
import { spawnMob, enterCombat, pickMobType } from './mobs';
import { run } from './score';
import { resetGame } from './player';
import { renderMenu } from './ui/mainMenu';

// Mobs pro Sekunde = base + perLevel × (Level − 1) + perMinute × Minuten. // PH
export const SIEGE = { base: 1, perLevel: 0.15, perMinute: 0.75, edgeR: 90 * WORLD_K, maxPerFrame: 3 };

const NAMES = { packs: 'Packs', siege: 'Belagerung' };
let due = 0, fps = 60, lastFrame = performance.now();

export const siegeRate = () => SIEGE.base + SIEGE.perLevel * (player.level - 1) + SIEGE.perMinute * state.now / 60000;

function spawnFromEdge() {
  for (let tries = 0; tries < 20; tries++) {
    const a = rand(0, Math.PI * 2), x = Math.cos(a) * SIEGE.edgeR, z = Math.sin(a) * SIEGE.edgeR;
    if (!(zone.spawnOk?.(x, z) ?? true)) continue;
    const level = Math.max(1, player.level + [-1, 0, 0, 1, 1, 2][Math.floor(rand(0, 6))]);
    enterCombat(spawnMob(pickMobType(), new THREE.Vector3(x, 0, z), level, ++state.packCounter), false);   // Kein Hilferuf: jeder läuft sofort los
    return;
  }
}

export function updateSiege(dt) {
  const hud = $('siegeHud');
  hud.hidden = mobMode !== 'siege';
  if (mobMode !== 'siege' || player.dead) return;
  due += siegeRate() * dt / 1000;
  for (let n = 0; n < SIEGE.maxPerFrame && due >= 1; n++, due--) spawnFromEdge();   // Rest bleibt fällig, der Modellbau kostet Zeit
  const t = performance.now();                       // echte Zeit: dt ist im Spiel auf 50 ms gedeckelt, darunter wären es immer 20 FPS
  fps += (1000 / Math.max(1, t - lastFrame) - fps) * 0.05;
  lastFrame = t;
  const live = state.mobs.filter(m => !m.dead).length;
  if (live > (run.peakMobs ?? 0)) { run.peakMobs = live; run.peakFps = Math.round(fps); }
  hud.textContent = `Belagerung · ${live} Mobs · Rekord ${run.peakMobs ?? 0} · +${siegeRate().toFixed(1).replace('.', ',')}/s · ${Math.round(fps)} FPS`;
}

export function resetSiege() { due = 0; }

document.head.insertAdjacentHTML('beforeend', `<style>#siegeHud { position: fixed; top: 56px; left: 50%; transform: translateX(-50%); z-index: 2; pointer-events: none; font: 700 14px system-ui, sans-serif; color: #ff9a7a; text-shadow: 0 1px 3px #000; }</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="siegeHud" hidden></div>`);

// Auswahl im Hauptmenü, unabhängig vom Modus
function renderMobPick() {
  const box = $('menuMobs');
  box.innerHTML = '';
  for (const id of Object.keys(NAMES)) {
    const b = document.createElement('button');
    b.className = 'chip' + (id === mobMode ? ' selected' : '');
    b.textContent = NAMES[id];
    b.dataset.nav = NAMES[id];
    b.title = id === 'siege' ? 'Mobs kommen vom Kartenrand, immer mehr pro Level und Minute, ohne Obergrenze' : 'Packs stehen auf der Karte';
    b.addEventListener('click', () => { setMobMode(id); resetGame(); renderMobPick(); renderMenu(); });
    box.appendChild(b);
  }
}
renderMobPick();
