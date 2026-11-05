// Boss-Prototyp: Beim Erreichen von Level 15, 30, 45 … kommt ein Boss in eine Arena um den Spieler. Nur aktiv mit #boss in der URL
// oder über den Dev-Knopf „Boss jetzt“. Ohne beides läuft das Spiel wie vorher. Alle Zahlen in B.

import * as THREE from 'three';
import { state, player } from './state';
import { $, clamp, dist2d, rand } from './util';
import { LEVEL_UNLOCKS } from './config';
import { mobMaxHp, maxHp, xpForKill } from './formulas';
import { scene, camera } from './render';
import { cam, setCamOverride } from './camera';
import { pad } from './gamepad';
import { zone, terrainDecal, drape } from './world';
import { groundAt, resolve } from './collision';
import { MOB_TYPES } from './mobTypes';
import { spawnMob, removeMob, enterCombat } from './mobs';
import { mobMode, scoreMult } from './modifiers';
import { C } from './champions';
import { run } from './score';
import { meta, saveMeta } from './meta';
import { combatText, fmtTime } from './ui/hud';
import { damagePlayer } from './player';
import { particles } from './fx/particles';
import { ringFx } from './fx/spellFx';
import { shockwave, lightFlash, hitstop } from './fx/impact';
import { addTrauma, decal, debris } from './wucht';

// Alle Zahlen PH. Zeiten in ms, Wege in yd
export const B = {
  every: 15,                // PH: Boss beim Erreichen jedes 15. Levels (vor der Mob-Freischaltung bei 16, 31, 46 …)
  arena: 20,                // PH: Radius der Arena um den Spieler
  scale: 2.5,               // PH: Mob-Modell so viel größer
  hpMul: 15,                // PH: × normales Mob-Leben des Levels. Start war 40: Bot mit Start-Kit ohne Karten brauchte 245 s, 15 ≈ 90 s
  body: 2,                  // PH: Körperradius, der Spieler wird hinausgeschoben
  speed: 5,                 // PH: Laufen zwischen den Angriffen
  intro: { ms: 1500, fallMs: 600, height: 14, dist: 10, trauma: 0.9, decal: 9, hitstopMs: 90 },   // PH: fällt vor dem Spieler herab
  ringColor: [2.6, 0.5, 0.25],   // PH: leuchtender Bodenring der Arena (> 1 → Bloom)
  // PH: Boss-Sicht hinter dem Spieler. look: Blickhöhe über dem Spieler, toward: Anteil des Wegs zum Boss, auf den die Kamera schaut
  cam: { blendMs: 600, dist: 6, pitch: 0.15, fov: 70, height: 1.8, look: 1.6, toward: 0.45, ahead: 3, yawRate: 8 },
  lockPadBtn: 11,           // Gamepad R3 (Standard-Mapping)
  // Angriffe: Ausholen (lesbar) → Treffer → Lücke. Schaden pro Treffer als Anteil am max. Leben, in der Lücke nimmt der Boss mehr Schaden
  hit: 0.25,                // PH
  punish: 1.25,             // PH
  pauseMs: [400, 800],      // PH: zwischen zwei Angriffen läuft er auf den Spieler zu
  near: 3, far: 9,          // PH: Abstand ab Körperkante. Nah → Schlag-Kette, mittel → Ansturm, weit → Sprung-Slam
  combo: { windups: [800, 500, 1000], reach: 4, cone: Math.PI / 2, gapMs: 1200, lunge: 1.2, strikeMs: 180, track: 0.7, turn: 6, trauma: 0.3 },   // PH: reach ab Körperkante, track: dreht sich bis zu diesem Anteil des Ausholens mit
  slam: { crouchMs: 400, airMs: 1000, radius: 6, height: 7, gapMs: 1500, trauma: 1, hitstopMs: 100, decal: 8 },   // PH: Kreis erscheint beim Absprung, airMs vor der Landung
  charge: { windupMs: 700, len: 15, width: 3, speed: 32, gapMs: 1000, track: 0.5, trauma: 0.5 },                 // PH: Linie width breit, dreht bis track mit
  tele: { color: [1, 0.1, 0.06], min: 0.15, max: 0.55 },   // PH: rote Bodenwarnung, Deckkraft steigt bis zum Treffer
  // Phase 2 ab at des Lebens: Brüllen (unverwundbar), Druckwelle stößt weg, alle Ausholzeiten × windupMul, Slam mit Ring, Geschoss-Fächer
  phase2: { at: 0.5, roarMs: 1000, push: 4, pushMs: 250, trauma: 0.8, windupMul: 0.8, ring: { max: 12, ms: 2000, band: 0.5, color: [2.6, 0.7, 0.2] } },   // PH
  // Tod: Stopp stopMs, dann Zeitlupe slowMs mit slow (echte Zeit), riesiger Riss. Belohnung: Punkte wie points Champions, Knochenstaub dust
  end: { stopMs: 150, stop: 0.05, slowMs: 800, slow: 0.3, decal: 16, trauma: 1, statsMs: 7000 },   // PH
  points: 10, dust: 20,     // PH
  fan: { windupMs: 700, n: 5, spread: Math.PI / 3, speed: 8, range: 24, radius: 0.5, gapMs: 800, color: [3, 0.9, 0.3] },   // PH: langsame Geschosse, ein Fächer trifft höchstens einmal
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
const wave = ringMesh(B.phase2.ring.color);   // Phase 2: Ring des Sprung-Slams

// ---------- Bodenwarnungen: Kreis, Kegel und Linie, je ein Mesh, rot ----------
const teleMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(...B.tele.color), transparent: true, depthWrite: false, side: THREE.DoubleSide });
const teleCircle = terrainDecal(new THREE.RingGeometry(0, 1, 48, 6), teleMat());
// Gitter in lokalen Koordinaten (x quer, z nach vorn), wird gedreht und auf den Boden gelegt
function gridMesh(nu, nv, fn) {
  const base = [], idx = [];
  for (let v = 0; v <= nv; v++) for (let u = 0; u <= nu; u++) base.push(...fn(u / nu, v / nv));
  for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) { const a = v * (nu + 1) + u, b = a + nu + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.length / 2 * 3), 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, teleMat());
  mesh.userData.base = base;
  return mesh;
}
const teleCone = gridMesh(16, 4, (u, v) => { const a = (u - 0.5) * B.combo.cone; return [Math.sin(a) * v, Math.cos(a) * v]; });
const teleLine = gridMesh(1, 16, (u, v) => [u - 0.5, v]);
function layGrid(mesh, c, sx, sz, yaw) {
  const base = mesh.userData.base, arr = mesh.geometry.attributes.position.array, co = Math.cos(yaw), si = Math.sin(yaw);
  for (let i = 0, j = 0; i < base.length; i += 2, j += 3) {
    const lx = base[i] * sx, lz = base[i + 1] * sz, x = c.x + lx * co + lz * si, z = c.z - lx * si + lz * co;
    arr[j] = x; arr[j + 1] = groundAt(x, z, c.y) + 0.14; arr[j + 2] = z;
  }
  mesh.geometry.attributes.position.needsUpdate = true;
}
const TELES = [teleCircle, teleCone, teleLine];
for (const t of TELES) { t.visible = false; t.frustumCulled = false; t.renderOrder = 2; scene.add(t); }
const teleAlpha = (t, k) => { t.visible = true; t.material.opacity = B.tele.min + (B.tele.max - B.tele.min) * k; };
const hideTeles = () => { for (const t of TELES) t.visible = false; };

// ---------- Boss-Leiste oben ----------
document.head.insertAdjacentHTML('beforeend', `<style>
  #bossBar { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); width: min(56vw, 760px); z-index: 2; pointer-events: none; text-align: center; display: none;
    font-family: Georgia, serif; color: #f3e2c0; text-shadow: 0 2px 4px #000; }
  #bossBar .name { font-size: 26px; letter-spacing: 2px; margin-bottom: 4px; }
  #bossBar .bar { height: 14px; background: rgba(0,0,0,0.65); border: 1px solid #8a6a3a; border-radius: 2px; overflow: hidden; position: relative; }
  #bossBar .lag { position: absolute; inset: 0 auto 0 0; background: #e8c070; }
  #bossBar .fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(#c8302a, #7a1410); }
  #bossBar .sub { font-size: 14px; margin-top: 4px; color: #d8c8a8; }
  #bossBar.won .name { font-size: 40px; color: #ffd27a; letter-spacing: 4px; }
  body.menu #bossBar { display: none !important; }
</style>`);
const bar = document.createElement('div');
bar.id = 'bossBar';
bar.innerHTML = '<div class="name"></div><div class="bar"><div class="lag"></div><div class="fill"></div></div><div class="sub"></div>';
document.body.appendChild(bar);
const barTrack = bar.querySelector('.bar') as HTMLElement, barName = bar.querySelector('.name') as HTMLElement, barFill = bar.querySelector('.fill') as HTMLElement,
  barLag = bar.querySelector('.lag') as HTMLElement, barSub = bar.querySelector('.sub') as HTMLElement;

// ---------- Boss ----------
// Fähigkeit des Boss-Mobs: updateMob überlässt ihr die Steuerung, Schaden läuft über onDamaged
const BOSS_ABILITY = {
  onUpdate: () => true,
  onDamaged: (m, amount) => (!boss || boss.step === 'intro' || boss.step === 'roar' ? 0 : boss.step === 'gap' ? amount * B.punish : amount),   // Lücke: Bestrafen lohnt sich
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
  m.xpMul = C.xp;                                      // XP und Punkte wie ein Champion, dazu der Bonus in endBoss
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
  boss = { mob: m, center, step: 'intro', t0: state.now, until: state.now + I.ms, landed: false, startAt: state.now, yaw: Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z),
    phase: 1, last: null, att: null, stats: { hits: 0, perfect0: state.dodgeStats?.perfect ?? 0 } };
  barName.textContent = m.type.name;
  barSub.textContent = `Boss · Level ${level}`;
  barLag.style.width = barFill.style.width = '100%';
  barTrack.style.display = 'block';
  bar.classList.remove('won');
  clearTimeout(statsTimer);
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
  updatePush(dt);
  updateWave();
  updateShots(dt);
  if (boss.phase === 1 && boss.step !== 'intro' && m.hp <= m.maxHp * B.phase2.at) roar();
  if (boss.step === 'intro') {
    const I = B.intro, t = clamp((state.now - boss.t0) / I.fallMs, 0, 1);
    if (!boss.landed) {
      m.pos.y = m.ground + I.height * (1 - t * t);
      m.falling = false;
      if (t >= 1) land();
    }
    if (state.now >= boss.until) walk();
    return;
  }
  STEPS[boss.step]?.(dt);
}

// ---------- Ablauf ----------
const next = (step, ms) => { boss.step = step; boss.t0 = state.now; boss.until = state.now + ms; };
const prog = () => clamp((state.now - boss.t0) / Math.max(1, boss.until - boss.t0), 0, 1);
const done = () => state.now >= boss.until;
const windup = ms => ms * (boss.phase === 2 ? B.phase2.windupMul : 1);
const toPlayer = () => dist2d(boss.mob.pos, player.pos);
function turnTo(target, rate, dt) {
  const want = yawTo(boss.mob.pos, target), d = wrap(want - boss.yaw), max = rate * dt / 1000;
  boss.yaw += Math.max(-max, Math.min(max, d));
}

// Treffer am Spieler: i-Frames und Perfekter Dodge greifen in damagePlayer. true, wenn Leben abging
function hurt() {
  if (player.dead) return false;
  const hp = player.hp;
  boss.mob.attackAt = state.now;                       // Todesursache und Angriffs-Animation
  damagePlayer(Math.round(maxHp() * B.hit));
  if (player.hp < hp) { boss.stats.hits++; return true; }
  return false;
}

// Lücke nach jedem Angriff: weißes Aufleuchten, B.punish mehr Schaden
function gap(ms) {
  hideTeles();
  next('gap', ms);
  boss.mob.hitAt = state.now;
}
function walk() {
  boss.att = null;
  next('walk', rand(B.pauseMs[0], B.pauseMs[1]));
}

// Auswahl nach Abstand, nie derselbe zweimal hintereinander
function chooseAttack() {
  const d = toPlayer() - B.body;
  const order = d < B.near ? ['combo', 'charge', 'slam'] : d < B.far ? ['charge', 'slam', 'combo'] : ['slam', 'charge', 'combo'];
  if (boss.phase === 2 && d >= B.near) order.splice(Math.random() < 0.5 ? 0 : 1, 0, 'fan');   // Phase 2: Fächer mittel und weit
  const id = order.find(a => a !== boss.last);
  boss.last = id;
  ATTACKS[id]();
}

// 1. Schlag-Kette: 3 Schläge im Kegel, der dritte holt länger aus
function comboWind() {
  next('comboWind', windup(B.combo.windups[boss.att.i]));
}
// 2. Sprung-Slam auf die Spielerposition beim Absprung
// 3. Ansturm: Linie, rennt durch, taumelt am Ende
const ATTACKS = {
  combo() { boss.att = { id: 'combo', i: 0 }; comboWind(); },
  slam() { boss.att = { id: 'slam' }; next('slamCrouch', windup(B.slam.crouchMs)); },
  charge() { boss.att = { id: 'charge' }; next('chargeWind', windup(B.charge.windupMs)); },
  fan() { boss.att = { id: 'fan' }; next('fanWind', B.fan.windupMs); },   // 4. Phase 2: Geschoss-Fächer, Ausholen fest 0,7 s
};

const STEPS = {
  walk(dt) {
    walkTo(player.pos, dt);
    if (done()) chooseAttack();
  },
  comboWind(dt) {
    const K = B.combo, m = boss.mob;
    if (prog() < K.track) turnTo(player.pos, K.turn, dt);
    layGrid(teleCone, m.pos, B.body + K.reach, B.body + K.reach, boss.yaw);
    teleAlpha(teleCone, prog());
    if (!done()) return;
    teleCone.visible = false;
    const d = toPlayer(), off = Math.abs(wrap(yawTo(m.pos, player.pos) - boss.yaw));
    if (d <= B.body + K.reach && off <= K.cone / 2) hurt();
    else m.attackAt = state.now;
    const tip = { x: m.pos.x + Math.sin(boss.yaw) * (B.body + 1), y: m.pos.y, z: m.pos.z + Math.cos(boss.yaw) * (B.body + 1) };
    addTrauma(K.trauma);
    decal(tip, 3, 3);
    debris(tip);
    next('comboStrike', K.strikeMs);
  },
  comboStrike(dt) {
    const K = B.combo, m = boss.mob;
    if (toPlayer() > B.body + 0.6) {                    // Ausfallschritt nach vorn, nicht in den Spieler hinein
      const step = K.lunge * dt / K.strikeMs;
      m.pos.x += Math.sin(boss.yaw) * step; m.pos.z += Math.cos(boss.yaw) * step;
      resolve(m.pos, 0.7);
      m.pos.y = groundAt(m.pos.x, m.pos.z, m.pos.y);
    }
    if (!done()) return;
    if (++boss.att.i < K.windups.length) comboWind();
    else gap(K.gapMs);
  },
  slamCrouch(dt) {
    const S = B.slam, m = boss.mob;
    turnTo(player.pos, 10, dt);
    if (!done()) return;
    const c = boss.center, t = player.pos.clone(), d = dist2d(t, c), max = B.arena - B.body;
    if (d > max) { t.x = c.x + (t.x - c.x) / d * max; t.z = c.z + (t.z - c.z) / d * max; }
    t.y = groundAt(t.x, t.z, player.pos.y);
    boss.att.from = m.pos.clone();
    boss.att.to = t;
    drape(teleCircle, t, S.radius);
    teleAlpha(teleCircle, 0);
    next('slamAir', windup(S.airMs));
  },
  slamAir() {
    const S = B.slam, m = boss.mob, a = boss.att, t = prog();
    m.pos.x = a.from.x + (a.to.x - a.from.x) * t;
    m.pos.z = a.from.z + (a.to.z - a.from.z) * t;
    m.pos.y = a.from.y + (a.to.y - a.from.y) * t + Math.sin(t * Math.PI) * S.height;
    m.falling = false;
    teleAlpha(teleCircle, t);
    if (!done()) return;
    m.pos.y = a.to.y;
    teleCircle.visible = false;
    a.slamHit = dist2d(player.pos, a.to) <= S.radius && hurt();
    if (!a.slamHit) m.attackAt = state.now;
    hitstop(S.hitstopMs);
    addTrauma(S.trauma);
    decal(a.to, 3, S.decal);
    debris(a.to); debris(a.to); debris(a.to);
    shockwave(a.to, S.radius * 1.5, 0.05, 500);
    ringFx(a.to, S.radius, [2.4, 0.5, 0.25], 400);
    lightFlash(a.to, 0xff6a3a, 400, 25, 250);
    slamLanded(a.to);
    gap(S.gapMs);
  },
  chargeWind() {
    const K = B.charge, m = boss.mob;
    if (prog() < K.track) boss.yaw = yawTo(m.pos, player.pos);
    layGrid(teleLine, m.pos, K.width, K.len, boss.yaw);
    teleAlpha(teleLine, prog());
    if (!done()) return;
    teleLine.visible = false;
    // Ziel am Ende der Linie, an der Arenagrenze gekürzt
    const c = boss.center, max = B.arena - B.body;
    let len = K.len;
    for (; len > 0; len -= 0.5) if (Math.hypot(m.pos.x + Math.sin(boss.yaw) * len - c.x, m.pos.z + Math.cos(boss.yaw) * len - c.z) <= max) break;
    boss.att.from = m.pos.clone();
    boss.att.len = Math.max(0, len);
    boss.att.hit = false;
    addTrauma(0.15);
    next('chargeRun', boss.att.len / K.speed * 1000);
  },
  chargeRun() {
    const K = B.charge, m = boss.mob, a = boss.att, s = a.len * prog();
    m.pos.x = a.from.x + Math.sin(boss.yaw) * s;
    m.pos.z = a.from.z + Math.cos(boss.yaw) * s;
    m.pos.y = groundAt(m.pos.x, m.pos.z, m.pos.y);
    m.moving = true; m.speed = K.speed;
    // Getroffen, wer im Korridor bis zur aktuellen Spitze steht
    const px = player.pos.x - a.from.x, pz = player.pos.z - a.from.z;
    const along = px * Math.sin(boss.yaw) + pz * Math.cos(boss.yaw), side = Math.abs(px * Math.cos(boss.yaw) - pz * Math.sin(boss.yaw));
    if (!a.hit && along > -B.body && along < s + B.body && side < K.width / 2 + 0.45) { a.hit = true; hurt(); }
    if (Math.random() < 0.6) debris(m.pos);
    if (!done()) return;
    addTrauma(K.trauma);
    decal(m.pos, 3, 3);
    gap(K.gapMs);
  },
  fanWind(dt) {
    turnTo(player.pos, 8, dt);
    if (!done()) return;
    const F = B.fan, m = boss.mob, volley = { hit: false };
    for (let i = 0; i < F.n; i++) {
      const a = boss.yaw + (i / (F.n - 1) - 0.5) * F.spread;
      fire(m.pos.x + Math.sin(boss.yaw) * B.body, m.pos.y + 1.2, m.pos.z + Math.cos(boss.yaw) * B.body, a, volley);
    }
    m.attackAt = state.now;
    lightFlash(m.pos, 0xff8a3a, 300, 20, 200);
    addTrauma(0.25);
    gap(F.gapMs);
  },
  roar() { if (done()) walk(); },
  gap() { if (done()) walk(); },
};

// ---------- Phase 2 ----------
// Brüllen: bricht den Angriff ab, Druckwelle schiebt den Spieler weg, Leuchten wird heller
function roar() {
  const P = B.phase2, m = boss.mob;
  boss.phase = 2;
  boss.att = null;
  hideTeles();
  m.pos.y = groundAt(m.pos.x, m.pos.z, m.pos.y);       // falls er gerade in der Luft war
  m.bossTint = 'boss2';
  next('roar', P.roarMs);
  const dx = player.pos.x - m.pos.x, dz = player.pos.z - m.pos.z, d = Math.hypot(dx, dz) || 1;
  boss.push = { dx: dx / d, dz: dz / d, left: P.push };
  addTrauma(P.trauma);
  shockwave(m.pos, 14, 0.06, 700);
  ringFx(m.pos, 10, [2.6, 0.6, 0.2], 600);
  lightFlash(m.pos, 0xff5a2a, 600, 35, 400);
  m.attackAt = state.now;
}
function updatePush(dt) {
  const p = boss.push;
  if (!p || p.left <= 0) return;
  const step = Math.min(p.left, B.phase2.push * dt / B.phase2.pushMs);
  p.left -= step;
  player.pos.x += p.dx * step; player.pos.z += p.dz * step;
  resolve(player.pos, 0.45);
  player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y);
}

// Ring des Sprung-Slams: dehnt sich von 0 auf max aus. Trifft einmal, wenn der Spieler von außen nach innen wechselt; wer schon vom Slam getroffen wurde, bleibt verschont
function slamLanded(at) {
  if (boss.phase !== 2) return;
  boss.wave = { c: at.clone(), t0: state.now, r: 0, outside: true, hit: !!boss.att.slamHit };
}
function updateWave() {
  const w = boss.wave, R = B.phase2.ring;
  if (!w) return;
  const t = (state.now - w.t0) / R.ms;
  if (t >= 1) { boss.wave = null; wave.visible = false; return; }
  const r = R.max * t, d = dist2d(player.pos, w.c), outside = d > r;
  if (!w.hit && w.outside && !outside) { w.hit = true; hurt(); }   // Front hat den Spieler überholt, auch wenn er ihr entgegenläuft
  w.r = r;
  w.outside = outside;
  layRing(wave, w.c, Math.max(0, r - R.band), r + R.band);
  wave.material.opacity = 1 - t * t;
}

// Geschosse: kleiner Pool, langsam, jedes fliegt range weit
const shotGeo = new THREE.SphereGeometry(1, 10, 8), shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...B.fan.color) });
const shots = Array.from({ length: 10 }, () => {
  const mesh = new THREE.Mesh(shotGeo, shotMat);
  mesh.visible = false;
  mesh.scale.setScalar(B.fan.radius);
  scene.add(mesh);
  return { mesh, live: false, dx: 0, dz: 0, flown: 0, volley: null };
});
function fire(x, y, z, yaw, volley) {
  const s = shots.find(o => !o.live);
  if (!s) return;
  Object.assign(s, { live: true, dx: Math.sin(yaw), dz: Math.cos(yaw), flown: 0, volley });
  s.mesh.position.set(x, y, z);
  s.mesh.visible = true;
}
function updateShots(dt) {
  const F = B.fan;
  for (const s of shots) {
    if (!s.live) continue;
    const step = F.speed * dt / 1000, p = s.mesh.position;
    p.x += s.dx * step; p.z += s.dz * step; s.flown += step;
    p.y = Math.max(p.y, groundAt(p.x, p.z, p.y) + 0.6);
    if (Math.random() < 0.5) particles.spawn({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0.3, vz: 0, life: 0.35, color: F.color, size: 0.5, grow: -0.5 });
    const hitNow = dist2d(p, player.pos) < F.radius + 0.45 && Math.abs(p.y - (player.pos.y + 1)) < 1.6;
    if (hitNow && !s.volley.hit) { s.volley.hit = true; hurt(); }
    if (hitNow || s.flown >= F.range) { s.live = false; s.mesh.visible = false; }
  }
}
const clearShots = () => { for (const s of shots) { s.live = false; s.mesh.visible = false; } };

// Tod: Stopp, Zeitlupe, riesiger Riss, Einblendung. Belohnung über Punkte und Knochenstaub, kein eigenes Drop-System
let endAt = -1e9, statsTimer = 0;
export function bossTimeScale() {
  const E = B.end, t = performance.now() - endAt;
  return t < E.stopMs ? E.stop : t < E.stopMs + E.slowMs ? E.slow : 1;
}
function endBoss() {
  const m = boss.mob, E = B.end, st = boss.stats;
  const time = state.now - boss.startAt, perfect = (state.dodgeStats?.perfect ?? 0) - st.perfect0;
  endAt = performance.now();
  addTrauma(E.trauma);
  decal(m.pos, 3, E.decal, E.decal);
  debris(m.pos); debris(m.pos); debris(m.pos); debris(m.pos);
  shockwave(m.pos, 18, 0.07, 900);
  ringFx(m.pos, 14, [2.6, 0.6, 0.2], 900);
  lightFlash(m.pos, 0xffb070, 800, 40, 600);
  // Ein Champion-Kill zählte schon in killMob (xpMul), dazu die übrigen points − 1
  run.killPoints += Math.round(xpForKill(m.level) * C.xp * (B.points - 1) * scoreMult());
  meta.dust += B.dust;
  saveMeta();
  combatText(m.pos, `+${B.dust} Knochenstaub`, 'xp', 4);
  cleanup();
  barName.textContent = 'Boss besiegt';
  bar.classList.add('won');
  barTrack.style.display = 'none';
  barSub.textContent = `Kampfzeit ${fmtTime(time)} · Treffer genommen ${st.hits} · Perfekte Dodges ${perfect} · +${B.dust} Knochenstaub`;
  bar.style.display = 'block';
  statsTimer = window.setTimeout(() => { bar.style.display = 'none'; }, E.statsMs);
  lastResult = { time, hits: st.hits, perfect };
}
let lastResult = null;

// Kampf beenden: Arena weg, Leiste weg. Der Spawn läuft danach von selbst weiter (updateRespawn füllt die Packs auf)
function cleanup(instant = false) {
  boss = null;
  hideTeles();
  clearShots();
  wave.visible = false;
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
  pose(m);
  const pct = `${Math.max(0, m.hp / m.maxHp * 100)}%`;
  if (barFill.style.width !== pct) barFill.style.width = pct;
  const lag = parseFloat(barLag.style.width) || 100, want = Math.max(0, m.hp / m.maxHp * 100);   // gelber Rest folgt langsam
  barLag.style.width = `${lag > want ? Math.max(want, lag - 0.6) : want}%`;
}

// Pose ohne neue Animation: Stauchen, Kippen, Taumeln über root.scale und root.rotation
function pose(m) {
  const r = m.model.root, t = prog(), step = boss.step;
  let sx = 1, sy = 1, pitch = 0, roll = 0;
  if (step === 'comboWind' || step === 'chargeWind' || step === 'slamCrouch') {
    const e = t * t * (3 - 2 * t);
    sy = 1 - 0.2 * e; sx = 1 + 0.1 * e;
    pitch = step === 'comboWind' ? -0.35 * e : step === 'chargeWind' ? 0.25 * e : 0.15 * e;   // Schlag: aufbäumen, Ansturm: Kopf runter
    if (step === 'chargeWind') roll = Math.sin(state.now * 0.06) * 0.04 * e;                      // scharrt
  } else if (step === 'comboStrike') { const k = 1 - t; pitch = 0.4 * k; sy = 1 + 0.12 * k; sx = 1 - 0.05 * k; }
  else if (step === 'slamAir') { pitch = -0.5 * (1 - t) + 0.45 * t; sy = 1.15; sx = 0.92; }
  else if (step === 'chargeRun') { pitch = 0.3; sy = 0.92; sx = 1.06; }
  else if (step === 'roar') { const k = Math.sin(t * Math.PI); pitch = -0.6 * k; sy = 1 + 0.12 * k; sx = 1 + 0.06 * k; }
  else if (step === 'fanWind') { const e = t * t; pitch = -0.3 * e; sy = 1 - 0.12 * e; sx = 1 + 0.08 * e; }
  else if (step === 'gap') { const k = 1 - t; pitch = 0.18 * k; sy = 1 - 0.1 * k; roll = Math.sin(t * 14) * 0.12 * k; }   // taumelt
  r.rotation.y = boss.yaw;
  r.rotation.x = pitch;
  r.rotation.z = roll;
  r.scale.set(m.baseScale.x * sx, m.baseScale.y * sy, m.baseScale.z * sx);
}

// Dev: Boss jetzt
$('devPerf').insertAdjacentHTML('afterend', '<button class="bindBtn" id="devBoss" style="width:100%;margin-bottom:14px">Dev: Boss jetzt</button>');
$('devBoss').addEventListener('click', () => { $('settingsClose').click(); startBoss(); });

// Für Tests
(window as any).__boss = { B, start: () => startBoss(), toggleLock, force: id => { if (boss) { boss.last = null; ATTACKS[id](); } }, phase2: () => { if (boss) { boss.mob.hp = Math.floor(boss.mob.maxHp * B.phase2.at); } }, get boss() { return boss; }, get result() { return lastResult; }, camera, shotsLive: () => shots.filter(o => o.live).map(o => o.mesh.position), get lock() { return lockOn; }, get camK() { return camK; } };
