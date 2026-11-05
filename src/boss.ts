// Boss-Prototyp: Beim Erreichen von Level 15, 30, 45 … kommt ein Boss in eine Arena um den Spieler. Nur aktiv mit #boss in der URL
// oder über den Dev-Knopf „Boss jetzt“. Ohne beides läuft das Spiel wie vorher. Alle Zahlen in B.

import * as THREE from 'three';
import { state, player } from './state';
import { $, clamp, dist2d, rand } from './util';
import { LEVEL_UNLOCKS } from './config';
import { mobMaxHp } from './formulas';
import { scene, camera } from './render';
import { cam, setCamOverride } from './camera';
import { pad } from './gamepad';
import { zone } from './world';
import { groundAt, resolve } from './collision';
import { MOB_TYPES } from './mobTypes';
import { spawnMob, removeMob, enterCombat } from './mobs';
import { mobMode } from './modifiers';
import { particles } from './fx/particles';
import { ringFx } from './fx/spellFx';
import { shockwave, lightFlash, hitstop } from './fx/impact';
import { addTrauma, decal, debris } from './wucht';

// Alle Zahlen PH. Zeiten in ms, Wege in yd
export const B = {
  every: 15,                // PH: Boss beim Erreichen jedes 15. Levels (vor der Mob-Freischaltung bei 16, 31, 46 …)
  arena: 20,                // PH: Radius der Arena um den Spieler
  scale: 2.5,               // PH: Mob-Modell so viel größer
  hpMul: 40,                // PH: × normales Mob-Leben des Levels
  body: 1.8,                // PH: Körperradius, der Spieler wird hinausgeschoben
  speed: 5,                 // PH: Laufen zwischen den Angriffen
  intro: { ms: 1500, fallMs: 600, height: 14, dist: 10, trauma: 0.9, decal: 9, hitstopMs: 90 },   // PH: fällt vor dem Spieler herab
  ringColor: [2.6, 0.5, 0.25],   // PH: leuchtender Bodenring der Arena (> 1 → Bloom)
  // PH: Boss-Sicht hinter dem Spieler. look: Blickhöhe über dem Spieler, toward: Anteil des Wegs zum Boss, auf den die Kamera schaut
  cam: { blendMs: 600, dist: 6, pitch: 0.15, fov: 70, height: 1.8, look: 1.6, toward: 0.45, ahead: 3, yawRate: 8 },
  lockPadBtn: 11,           // Gamepad R3 (Standard-Mapping)
};

const autoOn = () => location.hash.includes('boss');

// Laufender Kampf oder null
let boss: any = null;
let lastLevel = 1;
let lockOn = true;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// ---------- Kamera: blendet in B.cam.blendMs in die Boss-Sicht und zurück ----------
// Hängt sich über setCamOverride in updateCamera (camera.ts), Wackeln und Kamera-Ruck laufen danach wie immer
let camK = 0, camIn = false, camYaw = 0, baseFov = 55, saved = null;
const camBoss = new THREE.Vector3(), _pos = new THREE.Vector3(), _look = new THREE.Vector3();
function bossCam(c, target) {
  const C = B.cam, p = player.pos, k = camK * camK * (3 - 2 * camK);
  const h = Math.cos(C.pitch) * C.dist;
  _pos.set(p.x - Math.sin(camYaw) * h, p.y + C.height + Math.sin(C.pitch) * C.dist, p.z - Math.cos(camYaw) * h);
  _pos.y = Math.max(_pos.y, groundAt(_pos.x, _pos.z, _pos.y) + 0.5);
  if (lockOn && boss) _look.set(p.x + (camBoss.x - p.x) * C.toward, p.y + C.look, p.z + (camBoss.z - p.z) * C.toward);   // Punkt zwischen beiden, der Boss steht dadurch oben im Bild
  else _look.set(p.x + Math.sin(camYaw) * C.ahead, p.y + C.look, p.z + Math.cos(camYaw) * C.ahead);
  c.position.lerp(_pos, k);
  c.lookAt(_look.lerp(target, 1 - k));
  const fov = baseFov + (C.fov - baseFov) * k;
  if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); }
}
function camStart() {
  if (!camIn && camK === 0) { baseFov = camera.fov; saved = { dist: cam.dist, pitch: cam.pitch }; }
  camIn = true;
  camYaw = player.facing + cam.offset;
  setCamOverride(bossCam);
}
function camEnd(instant = false) {
  camIn = false;
  if (saved) { Object.assign(cam, saved); saved = null; }   // Zoom und Neigung waren im Kampf gesperrt
  if (instant) camK = 0;
  if (camK === 0) { setCamOverride(null); camera.fov = baseFov; camera.updateProjectionMatrix(); }
}
function updateCam(dt) {
  if (!camIn && camK === 0) return;
  camK = clamp(camK + (camIn ? 1 : -1) * dt / B.cam.blendMs, 0, 1);
  if (camK === 0) return camEnd();
  if (boss) camBoss.copy(boss.mob.pos);
  const want = lockOn && boss ? yawTo(player.pos, camBoss) : player.facing + cam.offset;
  camYaw += wrap(want - camYaw) * (1 - Math.exp(-B.cam.yawRate * dt / 1000));
}

// Lock-on lösen und wieder anlegen: Tab, Gamepad R3
function toggleLock() {
  if (!boss || state.paused) return;
  lockOn = !lockOn;
  if (!lockOn) { cam.offset = 0; }
}
addEventListener('keydown', e => {
  if (e.code !== 'Tab' || !boss) return;
  e.preventDefault();
  if (!e.repeat) toggleLock();
});

// ---------- Arena: ein Ring aus zwei Kreisen, auf den Boden gelegt ----------
const SEG = 96;
function ringMesh(color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
  const idx = [];
  for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}
// Ring mit Innen- und Außenradius um c, jeder Punkt auf groundAt
function layRing(mesh, c, rIn, rOut) {
  const arr = mesh.geometry.attributes.position.array;
  for (let i = 0; i <= SEG; i++) {
    const a = i / SEG * Math.PI * 2, s = Math.sin(a), co = Math.cos(a);
    for (let k = 0; k < 2; k++) {
      const r = k ? rOut : rIn, x = c.x + s * r, z = c.z + co * r, j = (i * 2 + k) * 3;
      arr[j] = x; arr[j + 1] = groundAt(x, z, c.y) + 0.12; arr[j + 2] = z;
    }
  }
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.visible = true;
}
const arena = ringMesh(B.ringColor);

// ---------- Boss-Leiste oben ----------
document.head.insertAdjacentHTML('beforeend', `<style>
  #bossBar { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); width: min(56vw, 760px); z-index: 2; pointer-events: none; text-align: center; display: none;
    font-family: Georgia, serif; color: #f3e2c0; text-shadow: 0 2px 4px #000; }
  #bossBar .name { font-size: 26px; letter-spacing: 2px; margin-bottom: 4px; }
  #bossBar .bar { height: 14px; background: rgba(0,0,0,0.65); border: 1px solid #8a6a3a; border-radius: 2px; overflow: hidden; position: relative; }
  #bossBar .lag { position: absolute; inset: 0 auto 0 0; background: #e8c070; }
  #bossBar .fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(#c8302a, #7a1410); }
  #bossBar .sub { font-size: 14px; margin-top: 4px; color: #d8c8a8; }
  body.menu #bossBar { display: none !important; }
</style>`);
const bar = document.createElement('div');
bar.id = 'bossBar';
bar.innerHTML = '<div class="name"></div><div class="bar"><div class="lag"></div><div class="fill"></div></div><div class="sub"></div>';
document.body.appendChild(bar);
const barName = bar.querySelector('.name') as HTMLElement, barFill = bar.querySelector('.fill') as HTMLElement,
  barLag = bar.querySelector('.lag') as HTMLElement, barSub = bar.querySelector('.sub') as HTMLElement;

// ---------- Boss ----------
// Fähigkeit des Boss-Mobs: updateMob überlässt ihr die Steuerung, Schaden läuft über onDamaged
const BOSS_ABILITY = {
  onUpdate: () => true,
  onDamaged: (m, amount) => (!boss || boss.step === 'intro' ? 0 : amount),
};

// Mob-Modell der Zone: der Mob, der als nächster freigeschaltet wird (Level 15 → zweiter Mob der Zone)
function bossTypeId() {
  const i = LEVEL_UNLOCKS.filter(l => player.level >= l).length + 1;
  return zone.mobs[Math.min(i, zone.mobs.length - 1)];
}

function puff(pos, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    particles.spawn({ x: pos.x + Math.cos(a) * 0.5, y: pos.y + 0.4, z: pos.z + Math.sin(a) * 0.5, vx: Math.cos(a) * rand(0.5, 1.5), vy: rand(0.3, 1.2), vz: Math.sin(a) * rand(0.5, 1.5),
      drag: 1.5, life: rand(0.6, 1.1), color: [0.12, 0.1, 0.09], size: rand(0.8, 1.4), grow: 0.8 });
  }
}

export function startBoss() {
  if (boss || player.dead || mobMode === 'siege') return false;
  // Restliche Mobs verschwinden in einer Staubwolke, der Spawn pausiert (bossBusy in main.ts)
  for (const m of state.mobs) { if (!m.dead) puff(m.pos); removeMob(m); }
  state.mobs = [];
  const center = player.pos.clone();
  layRing(arena, center, B.arena - 0.25, B.arena + 0.25);
  // Landepunkt vor dem Spieler, in der Arena
  const f = player.facing, I = B.intro;
  const at = new THREE.Vector3(player.pos.x + Math.sin(f) * I.dist, 0, player.pos.z + Math.cos(f) * I.dist);
  resolve(at, B.body);
  const typeId = bossTypeId(), level = player.level;
  const m: any = spawnMob(typeId, at, level, ++state.packCounter);
  m.type = { ...MOB_TYPES[typeId], fleeChance: 0, rootImmune: true, stealth: false };
  m.ability = BOSS_ABILITY;
  m.hidden = false; m.model.root.visible = true;
  m.hp = m.maxHp = Math.round(mobMaxHp(level) * B.hpMul);
  m.noKnock = true;
  m.boss = true;
  m.bossTint = 'boss';
  m.plate.remove();                                    // Name und Leben stehen oben in der Boss-Leiste
  m.model.root.rotation.order = 'YXZ';                 // Kippen um die eigene Querachse
  m.model.root.scale.multiplyScalar(B.scale);
  m.baseScale = m.model.root.scale.clone();
  m.ground = m.pos.y;
  m.pos.y += I.height;
  enterCombat(m, false);
  lockOn = true;
  camStart();
  boss = { mob: m, center, step: 'intro', t0: state.now, until: state.now + I.ms, landed: false, startAt: state.now, yaw: Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z) };
  barName.textContent = m.type.name;
  barSub.textContent = `Boss · Level ${level}`;
  barLag.style.width = barFill.style.width = '100%';
  bar.style.display = 'block';
  return true;
}

// Spieler und Boss bleiben in der Arena, der Spieler steckt nie im Boss
function keepInside() {
  const c = boss.center, p = player.pos, m = boss.mob;
  const d = dist2d(p, c), max = B.arena - 0.5;
  if (d > max) { p.x = c.x + (p.x - c.x) / d * max; p.z = c.z + (p.z - c.z) / d * max; p.y = groundAt(p.x, p.z, p.y); }
  const bd = dist2d(m.pos, c), bmax = B.arena - B.body;
  if (bd > bmax) { m.pos.x = c.x + (m.pos.x - c.x) / bd * bmax; m.pos.z = c.z + (m.pos.z - c.z) / bd * bmax; }
  if (boss.step === 'intro' && !boss.landed) return;
  const pd = dist2d(p, m.pos);
  if (pd < B.body && pd > 0.001) { p.x = m.pos.x + (p.x - m.pos.x) / pd * B.body; p.z = m.pos.z + (p.z - m.pos.z) / pd * B.body; }
}

// Zum Spieler laufen, vor dem Körper stehen bleiben
function walkTo(target, dt, speed = B.speed, stopAt = B.body + 0.8) {
  const m = boss.mob, dx = target.x - m.pos.x, dz = target.z - m.pos.z, d = Math.hypot(dx, dz);
  boss.yaw = Math.atan2(dx, dz);
  if (d <= stopAt) return;
  const step = Math.min(d - stopAt, speed * dt / 1000);
  m.pos.x += dx / d * step; m.pos.z += dz / d * step;
  resolve(m.pos, 0.7);
  m.pos.y = groundAt(m.pos.x, m.pos.z, m.pos.y);
  m.moving = true;
  m.speed = speed;
}

function land() {
  const m = boss.mob, I = B.intro;
  m.pos.y = m.ground = groundAt(m.pos.x, m.pos.z, m.ground);
  m.falling = false;
  boss.landed = true;
  hitstop(I.hitstopMs);
  addTrauma(I.trauma);
  decal(m.pos, 3, I.decal);
  debris(m.pos); debris(m.pos);
  shockwave(m.pos, 10, 0.05, 600);
  ringFx(m.pos, 8, [2.4, 0.5, 0.25], 500);
  lightFlash(m.pos, 0xff6a3a, 500, 30, 300);
}

// Aus update() in main.ts, nach den Mobs: Auslöser, Ablauf, Arena
export function updateBoss(dt) {
  if (!boss) {
    const crossed = Math.floor(player.level / B.every) > Math.floor(lastLevel / B.every);
    lastLevel = player.level;
    if (crossed && autoOn() && mobMode === 'packs') startBoss();
    return;
  }
  lastLevel = player.level;
  const m = boss.mob;
  if (m.dead) return endBoss();
  const locked = lockOn && !player.dead;
  state.bossLock = locked;
  state.bossAim = locked ? new THREE.Vector3(m.pos.x, groundAt(m.pos.x, m.pos.z, m.pos.y), m.pos.z) : null;
  if (player.dead) return;
  keepInside();
  if (locked) { player.facing = yawTo(player.pos, m.pos); cam.offset = 0; }   // W läuft auf den Boss zu
  if (boss.step === 'intro') {
    const I = B.intro, t = clamp((state.now - boss.t0) / I.fallMs, 0, 1);
    if (!boss.landed) {
      m.pos.y = m.ground + I.height * (1 - t * t);
      m.falling = false;
      if (t >= 1) land();
    }
    if (state.now >= boss.until) boss.step = 'walk';
    return;
  }
  if (boss.step === 'walk') walkTo(player.pos, dt);
}

function endBoss() {
  cleanup();
}

// Kampf beenden: Arena weg, Leiste weg. Der Spawn läuft danach von selbst weiter (updateRespawn füllt die Packs auf)
function cleanup(instant = false) {
  boss = null;
  state.bossLock = false;
  state.bossAim = null;
  camEnd(instant);
  arena.visible = false;
  bar.style.display = 'none';
}

// Läuft der Kampf? Dann pausiert der Mob-Spawn (main.ts)
export const bossBusy = () => !!boss;

// Aus updateVisuals in main.ts, vor den Mob-Modellen: Blickrichtung, Leiste. Neuer Run oder Zonenwechsel räumt den Kampf ab
export function updateBossVisuals(dt) {
  updateCam(dt);
  if (!boss) return;
  const m = boss.mob;
  if (!state.mobs.includes(m)) return cleanup(true);
  if (pad.down[B.lockPadBtn] && !pad.prev[B.lockPadBtn]) toggleLock();
  m.model.root.rotation.y = boss.yaw;
  const pct = `${Math.max(0, m.hp / m.maxHp * 100)}%`;
  if (barFill.style.width !== pct) barFill.style.width = pct;
  const lag = parseFloat(barLag.style.width) || 100, want = Math.max(0, m.hp / m.maxHp * 100);   // gelber Rest folgt langsam
  barLag.style.width = `${lag > want ? Math.max(want, lag - 0.6) : want}%`;
}

// Dev: Boss jetzt
$('devPerf').insertAdjacentHTML('afterend', '<button class="bindBtn" id="devBoss" style="width:100%;margin-bottom:14px">Dev: Boss jetzt</button>');
$('devBoss').addEventListener('click', () => { $('settingsClose').click(); startBoss(); });

// Für Tests
(window as any).__boss = { B, start: () => startBoss(), toggleLock, get boss() { return boss; }, get lock() { return lockOn; }, get camK() { return camK; } };
