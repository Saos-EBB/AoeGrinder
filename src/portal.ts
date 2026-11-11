// Portale im Run (map-umbau-2 Phase 1). Nur auf generierten Maps (zone.gen).
// Packs: bei Level 25 / 50 / 75 öffnet sich ein Portal auf einem portalSpot des Layouts (Index 0 liegt bei der Landmarke).
// Wellen: nach jedem Boss. Betreten = gleiches Theme, neue Map, Seed aus dem Start-Seed abgeleitet (rng.ts portalMapSeed),
// Mobs neu gewürfelt; Level, Karten, Ausrüstung bleiben (player.ts switchZone). Kurze Blende, kein Ladebildschirm.
// Wer das Portal liegen lässt: nach 2 min sinkt die XP pro Kill um 25 %, bis man durchgeht. Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from './state';
import { $, dist2d } from './util';
import { scene } from './render';
import { zone, zoneId, heightAt } from './world';
import { mobMode } from './modifiers';
import { collectAll } from './loot';
import { addXpMul } from './xpBonus';
import { t } from './i18n';
import { portalMapSeed } from './mapgen/rng';

export const PORTAL = {
  levels: [25, 50, 75],       // PH: Packs
  minFromPlayer: 40,          // PH: yd, Platz nicht direkt neben dir
  enterR: 2.2,                // PH: yd, so nah = durchgehen
  lazyMs: 120000, lazyXp: 0.75,   // PH: 2 min liegen lassen → XP pro Kill −25 %
  fadeMs: 350,                // PH: Blende rein/raus
  safeMs: 1500,               // PH: nach dem Übergang kurz unverwundbar
  color: new THREE.Color(1.6, 0.7, 2.6),   // > 1 = Bloom
  landmarkPulse: 2.2,         // PH: Landmarke leuchtet so viel heller, solange das Portal offen ist
};

// Anbindung aus main.ts (sonst Import-Kreis über player.ts / boss.ts)
let api = { switchZone: (_id: string) => {}, bossActive: () => false };
export function connectPortal(a: typeof api) { api = a; }

type Portal = { pos: THREE.Vector3; at: number; warned?: boolean; zone: any; seed: number; group: THREE.Group; glow: { mesh: THREE.Mesh; base: THREE.Color } | null };
let portal: Portal | null = null, done = 0, wasBoss = false, fading = false, taken = 0;

// ---------- Optik: Ring, Fläche, Säule (3 Draw Calls, nur solange offen) ----------
function buildMesh(pos: THREE.Vector3) {
  const g = new THREE.Group(), c = PORTAL.color;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 10, 40), new THREE.MeshBasicMaterial({ color: c, fog: false }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.35), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.7, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.3), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  ring.position.y = disc.position.y = 1.9;
  pillar.position.y = 20;
  g.add(ring, disc, pillar);
  g.position.copy(pos);
  g.userData = { ring, disc, pillar };
  scene.add(g);
  return g;
}
function disposeMesh(g: THREE.Group) {
  scene.remove(g);
  g.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose(); });
}
function findGlow() {
  const m = (zone.meshes ?? []).find((o: any) => o.userData?.landmarkGlow) as THREE.Mesh | undefined;
  return m ? { mesh: m, base: (m.material as THREE.MeshBasicMaterial).color.clone() } : null;
}

// Platz: der bei der Landmarke (Index 0), sonst der entfernteste, nie näher als minFromPlayer
function pickSpot() {
  const spots = zone.layout?.portalSpots ?? [];
  if (!spots.length) return null;
  const ok = spots.filter(s => dist2d(s, player.pos) >= PORTAL.minFromPlayer);
  return ok[0] ?? spots.reduce((a, b) => dist2d(a, player.pos) >= dist2d(b, player.pos) ? a : b);
}

export function openPortal() {
  if (!zone.gen || portal) return false;
  const s = pickSpot();
  if (!s) return false;
  const pos = new THREE.Vector3(s.x, heightAt(s.x, s.z), s.z);
  portal = { pos, at: state.now, zone, seed: zone.seed, group: buildMesh(pos), glow: findGlow() };
  state.newMob = { text: t('portal.open'), at: state.now };   // Banner wie „Neuer Gegner“ (ui/scoreHud.ts)
  return true;
}

function closePortal() {
  if (!portal) return;
  disposeMesh(portal.group);
  if (portal.glow && portal.glow.mesh.parent) (portal.glow.mesh.material as THREE.MeshBasicMaterial).color.copy(portal.glow.base);
  portal = null;
}

// Blende: schwarzes Overlay
const veil = document.createElement('div');
veil.id = 'portalVeil';
veil.style.cssText = `position: fixed; inset: 0; background: #07020c; opacity: 0; pointer-events: none; z-index: 30; transition: opacity ${PORTAL.fadeMs}ms ease;`;
document.body.appendChild(veil);

function enter() {
  fading = true;
  player.invulnUntil = state.now + PORTAL.fadeMs * 3 + PORTAL.safeMs;
  veil.style.opacity = '1';
  window.setTimeout(() => {
    collectAll();          // Boden-Drops kommen mit (loot.ts)
    closePortal();
    portalMapSeed();       // Seed der nächsten Map folgt aus dem Start-Seed des Runs (mapgen/rng.ts)
    api.switchZone(zoneId);    // gleiches Theme, neue Map, Packs neu
    player.invulnUntil = state.now + PORTAL.safeMs;
    taken++;
    state.newMob = { text: t('portal.through', { n: taken }), at: state.now };
    veil.style.opacity = '0';
    fading = false;
  }, PORTAL.fadeMs);
}

// Jeden Frame aus main.ts
export function updatePortal() {
  if (portal && (portal.zone !== zone || portal.seed !== zone.seed)) closePortal();   // Dev: Zone gewechselt
  if (!zone.gen || player.dead) return;
  const boss = api.bossActive();
  if (mobMode === 'waves') { if (wasBoss && !boss) openPortal(); }
  else if (!portal && done < PORTAL.levels.length && player.level >= PORTAL.levels[done]) {
    if (openPortal()) done = PORTAL.levels.filter(l => player.level >= l).length;
  }
  wasBoss = boss;
  if (!portal) return;
  const u = portal.group.userData, k = 0.5 + 0.5 * Math.sin(state.now / 260);
  u.ring.rotation.y = state.now / 900;
  u.disc.rotation.y = u.ring.rotation.y;
  u.disc.material.opacity = 0.55 + 0.35 * k;
  if (portal.glow) (portal.glow.mesh.material as THREE.MeshBasicMaterial).color.copy(portal.glow.base).multiplyScalar(1 + (PORTAL.landmarkPulse - 1) * k);
  if (!portal.warned && lazy()) { portal.warned = true; state.newMob = { text: t('portal.lazy'), at: state.now }; }
  if (!fading && !boss && dist2d(player.pos, portal.pos) < PORTAL.enterR) enter();
}

// XP-Druck: Portal liegt länger als lazyMs offen
const lazy = () => !!portal && state.now - portal.at > PORTAL.lazyMs;
addXpMul(() => lazy() ? PORTAL.lazyXp : 1);

export const portalPos = () => portal?.pos ?? null;

// Run-Start (resetGame)
export function resetPortal() {
  closePortal();
  done = 0; taken = 0; wasBoss = false; fading = false;
  veil.style.opacity = '0';
}

// Dev-Knopf (Gruppe Map-Objekte)
$('devZones').insertAdjacentHTML('afterend', `<div id="devPortal" style="display:flex;gap:6px;flex-wrap:wrap"><button class="bindBtn" data-a="open">Portal öffnen</button><button class="bindBtn" data-a="go">Hin + durch</button><button class="bindBtn" data-a="lazy">2 min vorspulen</button></div>`);
$('devPortal').addEventListener('click', e => {
  const a = (e.target as HTMLElement).closest('button')?.dataset.a;
  if (a === 'open') openPortal();
  if (a === 'go' && (portal || openPortal())) { player.pos.set(portal.pos.x, portal.pos.y, portal.pos.z); }
  if (a === 'lazy' && portal) portal.at -= PORTAL.lazyMs;
});

(window as any).__portal = { PORTAL, open: openPortal, get portal() { return portal; }, get taken() { return taken; }, get done() { return done; }, lazy };
