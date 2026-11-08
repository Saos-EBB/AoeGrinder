// Mob-Modus Wellen (ersetzt die Belagerung): Jede Welle hat eine feste Zahl Gegner, die vom Kartenrand kommen.
// Sind alle tot, kommt ein Boss (boss.ts, Stufe nach Level); ist er besiegt, startet die nächste Welle. Nach WAVES.goal Wellen ist der Run geschafft.
// Ohne Packs auf der Karte (mobs.ts). Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from './state';
import { $, rand } from './util';
import { WORLD_K } from './config';
import { mobMode, setMobMode, setSiegeGoal } from './modifiers';
import { zone } from './world';
import { spawnMob, enterCombat, pickMobType } from './mobs';
import { run } from './score';
import { resetGame, completeRun } from './player';
import { renderMenu } from './ui/mainMenu';
import { t } from './i18n';

// Gegner pro Welle = base + perWave × (Welle − 1); kommen mit perSecond pro Sekunde, höchstens maxPerFrame pro Frame
export const WAVES = { base: 50, perWave: 50, perSecond: 4, edgeR: 90 * WORLD_K, maxPerFrame: 3, pauseMs: 2500, goal: 10 };   // PH

const CHOICES = [
  { name: t('mobmode.packs'), mode: 'packs', title: t('mobmode.packsTip') },
  { name: t('mobmode.waves'), mode: 'waves', title: t('mobmode.wavesTip', { n: WAVES.goal }) },
];

// Boss-Anbindung: boss.ts meldet sich hier an (sonst Import-Kreis über player.ts)
let bossApi = { start: () => false, active: () => false };
export function connectBoss(api: typeof bossApi) { bossApi = api; }

// step: spawn (Gegner kommen), clear (alle da, Rest töten), boss (Boss läuft), pause (kurz bis zur nächsten Welle)
let step = 'pause', toSpawn = 0, due = 0, stepAt = 0, fps = 60, lastFrame = performance.now();
const waveSize = n => WAVES.base + WAVES.perWave * (n - 1);
const waveLeft = () => state.mobs.filter(m => !m.dead && m.wave === run.wave).length + toSpawn;

function spawnFromEdge() {
  for (let tries = 0; tries < 20; tries++) {
    const a = rand(0, Math.PI * 2), r = zone.edgeR ?? WAVES.edgeR, x = Math.cos(a) * r, z = Math.sin(a) * r;   // edgeR: Zone mit Wand (Kathedrale)
    if (!(zone.spawnOk?.(x, z) ?? true)) continue;
    const level = Math.max(1, player.level + [-1, 0, 0, 1, 1, 2][Math.floor(rand(0, 6))]);
    const m: any = spawnMob(pickMobType(), new THREE.Vector3(x, 0, z), level, ++state.packCounter);
    m.wave = run.wave;
    enterCombat(m, false);   // Kein Hilferuf: jeder läuft sofort los
    return true;
  }
  return false;
}
function startWave() {
  run.wave = (run.wave ?? 0) + 1;
  toSpawn = waveSize(run.wave);
  due = 0;
  step = 'spawn';
}

export function updateWaves(dt) {
  const hud = $('siegeHud');
  hud.hidden = mobMode !== 'waves';
  if (mobMode !== 'waves' || player.dead) return;
  if (!run.wave) startWave();
  if (step === 'spawn') {
    due += WAVES.perSecond * dt / 1000;
    for (let n = 0; n < WAVES.maxPerFrame && due >= 1 && toSpawn > 0; n++, due--) if (spawnFromEdge()) toSpawn--;
    if (toSpawn <= 0) step = 'clear';
  } else if (step === 'clear' && waveLeft() === 0) {
    step = bossApi.start() ? 'boss' : 'pause';   // ohne passenden Boss gleich weiter
    stepAt = state.now;
  } else if (step === 'boss' && !bossApi.active()) {
    if (run.wave >= WAVES.goal) return completeRun(t('cause.wave', { n: WAVES.goal }));
    step = 'pause';
    stepAt = state.now;
  } else if (step === 'pause' && state.now - stepAt >= WAVES.pauseMs) {
    if (run.wave >= WAVES.goal) return completeRun(t('cause.wave', { n: WAVES.goal }));
    startWave();
  }
  const nowMs = performance.now();                       // echte Zeit: dt ist im Spiel auf 50 ms gedeckelt
  fps += (1000 / Math.max(1, nowMs - lastFrame) - fps) * 0.05;
  lastFrame = nowMs;
  const live = state.mobs.filter(m => !m.dead).length;
  if (live > (run.peakMobs ?? 0)) { run.peakMobs = live; run.peakFps = Math.round(fps); }
  const text = step === 'boss' ? t('wave.boss', { a: run.wave, b: WAVES.goal }) : step === 'pause' ? t('wave.next', { a: run.wave + 1, b: WAVES.goal }) : t('wave.left', { a: run.wave, b: WAVES.goal, n: waveLeft() });
  if (hud.textContent !== text) hud.textContent = text;
}

export function resetWaves() { step = 'pause'; toSpawn = 0; due = 0; stepAt = -1e9; }

document.head.insertAdjacentHTML('beforeend', `<style>#siegeHud { position: fixed; top: 56px; left: 50%; transform: translateX(-50%); z-index: 2; pointer-events: none; font: 700 14px system-ui, sans-serif; color: #ff9a7a; text-shadow: 0 1px 3px #000; }</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="siegeHud" hidden></div>`);

// Auswahl im Hauptmenü, unabhängig vom Modus
function renderMobPick() {
  const box = $('menuMobs');
  box.innerHTML = '';
  for (const c of CHOICES) {
    const b = document.createElement('button');
    b.className = 'chip' + (c.mode === mobMode ? ' selected' : '');
    b.textContent = c.name;
    b.dataset.nav = c.name;
    b.title = c.title;
    b.addEventListener('click', () => { setMobMode(c.mode); setSiegeGoal(0); resetGame(); renderMobPick(); renderMenu(); });
    box.appendChild(b);
  }
}
renderMobPick();
