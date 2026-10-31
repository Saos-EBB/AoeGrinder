import * as THREE from 'three';
import { state, player } from '../state';
import { rand, lerpTo, pick, perFrame } from '../util';
import { SPELLS } from '../config';
import { blizRadius } from '../formulas';
import { scene } from '../render';
import { heightAt, terrainDecal, drape } from '../world';
import { glowSprite, particles } from '../fx/particles';
import { mage } from '../models/mage';
import { shakeCamera } from '../camera';

export const blizCursor = terrainDecal(new THREE.RingGeometry(0.93, 1, 64, 1),
  new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.9, depthWrite: false }));
blizCursor.visible = false;
scene.add(blizCursor);

// Blizzard-Effekt (Boden + fallende Eissplitter)
export const blizFx = (() => {
  const g = new THREE.Group();
  const disc = terrainDecal(new THREE.RingGeometry(0, 1, 48, 8),
    new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.12, depthWrite: false }));
  scene.add(disc);
  const shardGeo = new THREE.BoxGeometry(0.06, 0.9, 0.06);
  const shardMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.3, 1.8) });
  const shards = [];
  for (let i = 0; i < 90; i++) {
    const s = new THREE.Mesh(shardGeo, shardMat);
    s.rotation.z = 0.25;
    s.userData.speed = rand(18, 28);
    shards.push(s); g.add(s);
  }
  // Wolke aus flachen Kugeln über dem Zielkreis
  const cloud = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0x8796b4, emissive: 0x1a2440, transparent: true, opacity: 0.9, depthWrite: false });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, r = rand(2, 7);
    const m = new THREE.Mesh(puff, cloudMat);
    m.position.set(Math.cos(a) * r, rand(-0.6, 0.6), Math.sin(a) * r);
    m.scale.set(rand(2.2, 3.6), rand(1, 1.6), rand(2.2, 3.6));
    cloud.add(m);
  }
  cloud.position.y = 15;
  g.add(cloud);
  g.visible = disc.visible = false;
  scene.add(g);
  return { g, disc, shards, cloud, cloudMat };
})();

const effects = [];
// ---------- Partikelsystem (ein Draw-Call, additiv, HDR-Farben > 1 erzeugen Bloom) ----------
export const FROST = [0.35, 1.0, 2.1], FROST_WHITE = [1.1, 1.5, 2.1], MIST = [0.05, 0.1, 0.15];
const ARCANE = [1.5, 0.45, 2.1], ARCANE_PINK = [1.9, 0.7, 1.6], GOLD = [2.2, 1.6, 0.5];
const SCHOOL_COLOR = { frost: FROST, arcane: ARCANE, fire: [2.4, 0.9, 0.15], shadow: [0.8, 0.15, 1.5], nature: [0.5, 2, 0.8], lightning: [1.3, 1.7, 2.8], bone: [1.9, 1.75, 1.3] };

// Heller Lichtblitz (Sprite, wächst und verblasst)
export function flashFx(pos, color, size, dur) {
  const sp = glowSprite(color, 0.1);
  sp.position.copy(pos);
  addEffect(sp, dur, t => { sp.scale.setScalar(size * (0.3 + t * 0.7)); sp.material.opacity = 0.6 * (1 - t); });
}
// Schockwellen-Ring am Boden
export function ringFx(pos, radius, color, dur) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  mesh.position.set(pos.x, pos.y + 0.35, pos.z);
  addEffect(mesh, dur, t => { mesh.scale.setScalar(Math.max(0.01, radius * Math.sqrt(t))); mesh.material.opacity = 1 - t; });
}

// Canvas-Texturen für Bodeneffekte
function canvasTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  draw(c.getContext('2d'), 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const iceTex = canvasTex((g, r) => {                      // Eisfläche mit Rissen
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, 'rgba(220,245,255,0.75)');
  grd.addColorStop(0.75, 'rgba(170,220,255,0.55)');
  grd.addColorStop(1, 'rgba(170,220,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 2 * r, 2 * r);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 26; i++) {                          // Risse vom Zentrum nach außen
    let a = Math.random() * Math.PI * 2, x = r, y = r;
    g.lineWidth = rand(1, 3);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      a += rand(-0.4, 0.4);
      x += Math.cos(a) * rand(20, 38); y += Math.sin(a) * rand(20, 38);
      g.lineTo(x, y);
    }
    g.stroke();
  }
});
const runeTex = canvasTex((g, r) => {                     // Arkaner Runenkreis
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  for (const [rad, w] of [[0.95, 6], [0.82, 3], [0.55, 4], [0.45, 2]]) {
    g.lineWidth = w; g.beginPath(); g.arc(r, r, r * rad, 0, Math.PI * 2); g.stroke();
  }
  for (let i = 0; i < 6; i++) {                           // Hexagramm
    const a = i / 6 * Math.PI * 2, b = (i + 2) / 6 * Math.PI * 2;
    g.lineWidth = 3; g.beginPath();
    g.moveTo(r + Math.cos(a) * r * 0.55, r + Math.sin(a) * r * 0.55);
    g.lineTo(r + Math.cos(b) * r * 0.55, r + Math.sin(b) * r * 0.55); g.stroke();
  }
  for (let i = 0; i < 24; i++) {                          // Runenzeichen zwischen den Ringen
    const a = i / 24 * Math.PI * 2;
    g.save(); g.translate(r + Math.cos(a) * r * 0.885, r + Math.sin(a) * r * 0.885); g.rotate(a + Math.PI / 2);
    g.lineWidth = 3; g.beginPath();
    for (let k = 0; k < 3; k++) { g.moveTo(rand(-9, 9), rand(-11, 11)); g.lineTo(rand(-9, 9), rand(-11, 11)); }
    g.stroke(); g.restore();
  }
});

// Bodeneffekt, der sich ans Gelände legt, sich dreht/skaliert und ausblendet
function groundDecalFx(tex, center, radius, color, dur, { additive = false, spin = 0, grow = 0.15, peak = 1 } = {}) {
  const mesh = terrainDecal(new THREE.RingGeometry(0, 1, 48, 8), new THREE.MeshBasicMaterial({
    map: tex, color: new THREE.Color(...color), transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  const c = center.clone();
  addEffect(mesh, dur, t => {
    drape(mesh, c, radius * Math.min(1, t / grow));
    mesh.rotation.y = spin * t;
    mesh.material.opacity = peak * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
  });
}

const spikeGeo = new THREE.ConeGeometry(0.22, 1.5, 5);
export function novaFx(pos, radius) {
  groundDecalFx(iceTex, pos, radius, [1, 1, 1], 4000, { grow: 0.04, peak: 0.85 });
  shakeCamera(0.12);
  ringFx(pos, radius, FROST_WHITE, 450);
  flashFx(new THREE.Vector3(pos.x, pos.y + 1, pos.z), 0x9fdcff, 5, 250);
  for (let i = 0; i < 160; i++) {                           // Frostwelle über den Boden
    const a = rand(0, Math.PI * 2), sp = rand(14, 22);
    particles.spawn({ x: pos.x, y: pos.y + rand(0.2, 0.8), z: pos.z, vx: Math.cos(a) * sp, vy: rand(0, 1.5), vz: Math.sin(a) * sp,
      drag: 2.6, life: rand(0.5, 0.85), color: pick([FROST, FROST_WHITE]), size: rand(0.25, 0.6) });
  }
  for (let i = 0; i < 25; i++) {                            // kalter Nebel
    const a = rand(0, Math.PI * 2), sp = rand(4, 9);
    particles.spawn({ x: pos.x, y: pos.y + 0.5, z: pos.z, vx: Math.cos(a) * sp, vy: 0.3, vz: Math.sin(a) * sp,
      drag: 1.5, life: rand(1, 1.6), color: MIST, size: rand(2, 3.5), grow: 1 });
  }
  // Eisspitzen aus dem Boden
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.15, 1.5), transparent: true });
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2 + rand(-0.1, 0.1), r = radius * rand(0.45, 0.95);
    const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    const sp = new THREE.Mesh(spikeGeo, mat);
    sp.position.set(x, heightAt(x, z), z);
    sp.rotation.set(rand(-0.35, 0.35), 0, rand(-0.35, 0.35));
    g.add(sp);
  }
  scene.add(g);
  effects.push({ mesh: g, start: performance.now(), dur: 1000, shared: true,
    update: t => { const k = t < 0.15 ? t / 0.15 : 1; g.children.forEach(c => c.scale.set(1, k, 1)); mat.opacity = t < 0.6 ? 0.9 : 0.9 * (1 - (t - 0.6) / 0.4); } });
}

export function arcaneExplosionFx(pos, radius) {
  const c = new THREE.Vector3(pos.x, pos.y + 1, pos.z);
  groundDecalFx(runeTex, pos, radius, [1.8, 0.7, 2.4], 700, { additive: true, spin: 1.2, grow: 0.25 });
  flashFx(c, 0xd890ff, 6, 250);
  ringFx(pos, radius, ARCANE_PINK, 350);
  for (let i = 0; i < 180; i++) {                           // Kugel-Explosion
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize();
    const sp = rand(15, 24);
    particles.spawn({ x: c.x, y: c.y, z: c.z, vx: dir.x * sp, vy: dir.y * sp * 0.6, vz: dir.z * sp,
      drag: 3.2, life: rand(0.4, 0.7), color: pick([ARCANE, ARCANE_PINK]), size: rand(0.22, 0.5) });
  }
  for (let i = 0; i < 40; i++) {                            // Funken, die nachglühen und aufsteigen
    const a = rand(0, Math.PI * 2), r = rand(1, radius);
    particles.spawn({ x: pos.x + Math.cos(a) * r, y: pos.y + rand(0.3, 1.5), z: pos.z + Math.sin(a) * r,
      vy: rand(1, 3), life: rand(0.6, 1.1), color: ARCANE_PINK, size: rand(0.2, 0.35) });
  }
}

export function coneOfColdFx(range, angle) {
  const hand = new THREE.Vector3();
  mage.anchors.handL.getWorldPosition(hand);
  for (let i = 0; i < 150; i++) {
    const a = player.facing + rand(-angle / 2, angle / 2), sp = rand(14, 24);
    particles.spawn({ x: hand.x, y: hand.y, z: hand.z, vx: Math.sin(a) * sp, vy: rand(-2, 1.5), vz: Math.cos(a) * sp,
      drag: 2.4, life: rand(0.45, 0.8), color: pick([FROST, FROST_WHITE, FROST]), size: rand(0.4, 0.9) });
  }
  for (let i = 0; i < 20; i++) {
    const a = player.facing + rand(-angle / 2, angle / 2), sp = rand(5, 10);
    particles.spawn({ x: hand.x, y: hand.y - 0.5, z: hand.z, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp,
      drag: 1.2, life: rand(1, 1.5), color: MIST, size: rand(2, 3), grow: 1.2 });
  }
}

export function blinkFx(from, to) {
  for (const p of [from, to]) {
    const c = new THREE.Vector3(p.x, p.y + 1.2, p.z);
    flashFx(c, 0xd890ff, 5, 300);
    for (let i = 0; i < 70; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      particles.spawn({ x: c.x, y: c.y, z: c.z, vx: dir.x * 6, vy: dir.y * 6, vz: dir.z * 6,
        drag: 3, life: rand(0.3, 0.6), color: pick([ARCANE, ARCANE_PINK]), size: rand(0.25, 0.5) });
    }
  }
  for (let i = 0; i < 80; i++) {                            // Spur zwischen Start und Ziel
    const t = Math.random();
    particles.spawn({ x: lerpTo(from.x, to.x, t) + rand(-0.3, 0.3), y: lerpTo(from.y, to.y, t) + rand(0.5, 1.8), z: lerpTo(from.z, to.z, t) + rand(-0.3, 0.3),
      vy: rand(0.2, 1), life: rand(0.3, 0.7), color: ARCANE, size: rand(0.2, 0.4) });
  }
}

// Funken in der Farbe der Schule des Spells, der getroffen hat
export function hitSparkFx(pos, spellId) {
  const color = SCHOOL_COLOR[SPELLS[spellId]?.cls] || FROST;
  for (let i = 0; i < 10; i++) {
    particles.spawn({ x: pos.x, y: pos.y + 0.9, z: pos.z, vx: rand(-4, 4), vy: rand(1, 5), vz: rand(-4, 4),
      grav: 9, drag: 1, life: rand(0.25, 0.5), color, size: rand(0.15, 0.3) });
  }
}

export function crystalBurst(school) {
  const c = new THREE.Vector3();
  mage.anchors.handR.getWorldPosition(c);   // der Stab hängt auf dem Rücken, gezaubert wird aus der Hand
  const color = SCHOOL_COLOR[school] || FROST;
  for (let i = 0; i < 25; i++) {
    const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    particles.spawn({ x: c.x, y: c.y, z: c.z, vx: dir.x * 4, vy: dir.y * 4, vz: dir.z * 4,
      drag: 3, life: rand(0.2, 0.45), color, size: rand(0.15, 0.35) });
  }
}

export function levelUpFx() {
  for (let i = 0; i < 180; i++) {
    const a = rand(0, Math.PI * 2), r = rand(0.3, 1.4);
    particles.spawn({ x: player.pos.x + Math.cos(a) * r, y: player.pos.y + rand(0, 0.5), z: player.pos.z + Math.sin(a) * r,
      vx: -Math.sin(a) * 2, vy: rand(4, 10), vz: Math.cos(a) * 2, drag: 0.6, life: rand(0.8, 1.5), color: GOLD, size: rand(0.2, 0.5) });
  }
  flashFx(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), 0xffd060, 8, 600);
}

// Laufende Emitter: Kristall, Blizzard, Trinken, eingefrorene Mobs
const tmpV = new THREE.Vector3();
export function ambientParticles(dt) {
  if (!dt) return;
  const channeling = !!player.channel;
  (channeling ? mage.anchors.handR : mage.anchors.crystal).getWorldPosition(tmpV);
  for (let i = perFrame(channeling ? 45 : 5, dt); i > 0; i--) {
    const a = rand(0, Math.PI * 2), r = channeling ? 0.35 : 0.1;
    particles.spawn({ x: tmpV.x + Math.cos(a) * r, y: tmpV.y, z: tmpV.z + Math.sin(a) * r,
      vx: -Math.sin(a) * (channeling ? 2 : 0.2), vy: rand(0.5, channeling ? 4 : 1), vz: Math.cos(a) * (channeling ? 2 : 0.2),
      life: rand(0.4, 0.9), color: FROST, size: rand(0.12, channeling ? 0.35 : 0.2) });
  }
  if (player.channel?.id === 'bliz') {
    const c = player.channel.point, r = blizRadius();
    for (let i = perFrame(40, dt); i > 0; i--) {             // wirbelnder Schnee
      const a = rand(0, Math.PI * 2), d = r * Math.sqrt(Math.random());
      particles.spawn({ x: c.x + Math.cos(a) * d, y: c.y + rand(4, 12), z: c.z + Math.sin(a) * d,
        vx: -Math.sin(a) * 3, vy: -rand(5, 9), vz: Math.cos(a) * 3, life: rand(0.8, 1.4), color: FROST_WHITE, size: rand(0.12, 0.25) });
    }
    for (let i = perFrame(5, dt); i > 0; i--) {              // Kältenebel am Boden
      const a = rand(0, Math.PI * 2), d = r * Math.sqrt(Math.random());
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      particles.spawn({ x, y: heightAt(x, z) + 0.4, z, vx: rand(-1, 1), vz: rand(-1, 1),
        life: rand(1.2, 2), color: MIST, size: rand(2.5, 4), grow: 0.6 });
    }
  }
  if (player.drink) {
    for (let i = perFrame(12, dt); i > 0; i--) {
      const a = rand(0, Math.PI * 2);
      particles.spawn({ x: player.pos.x + Math.cos(a) * 0.8, y: player.pos.y + rand(0, 1), z: player.pos.z + Math.sin(a) * 0.8,
        vy: rand(0.8, 1.6), life: rand(0.8, 1.3), color: [0.6, 1.2, 2.6], size: rand(0.12, 0.22) });
    }
  }
  for (const m of state.mobs) {
    if (m.dead || m.rootUntil <= state.now) continue;
    for (let i = perFrame(4, dt); i > 0; i--) {
      particles.spawn({ x: m.pos.x + rand(-0.7, 0.7), y: m.pos.y + rand(0.3, 1.6), z: m.pos.z + rand(-0.9, 0.9),
        vy: rand(0.3, 0.8), life: rand(0.6, 1), color: FROST, size: rand(0.12, 0.22) });
    }
  }
}

export function addEffect(mesh, dur, update) {
  scene.add(mesh);
  effects.push({ mesh, start: performance.now(), dur, update });
}
export function updateEffects() {
  const t0 = performance.now();
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    const t = (t0 - e.start) / e.dur;
    if (t >= 1) {
      scene.remove(e.mesh);
      if (!e.shared) { e.mesh.geometry.dispose(); e.mesh.material.dispose(); }
      effects.splice(i, 1);
    } else e.update(t);
  }
}
export function resetShard(sh, randomHeight) {
  const r = blizRadius() * Math.sqrt(Math.random()), a = rand(0, Math.PI * 2);
  sh.position.set(Math.cos(a) * r, randomHeight ? rand(0, 16) : rand(14, 18), Math.sin(a) * r);
}
