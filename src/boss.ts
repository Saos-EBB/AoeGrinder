// Boss-Kämpfe: Bei Level 15/30 (früh), 45/60 (mittel), 75/90 (spät) und 100 (final) kommt ein Boss aus dem Roster (bosses/roster.ts) in eine Arena.
// Nur aktiv mit #boss in der URL oder über das Dev-Menü. Ohne beides läuft das Spiel wie vorher.
// Hier: Auswahl, Arena, Kamera und Lock-on, Boss-Leiste, Körper und ihre Steuerung, Phase 2, Ende. Angriffe in bosses/attacks.ts, Regeln in bosses/rules.ts.

import * as THREE from 'three';
import { state, player } from './state';
import { $, clamp, dist2d, rand } from './util';
import { LEVEL_UNLOCKS } from './config';
import { mobMaxHp, maxHp, xpForKill } from './formulas';
import { scene, camera } from './render';
import { cam, setCamOverride } from './camera';
import { pad } from './gamepad';
import { mouse, mouseBtn } from './input';
import { zone } from './world';
import { groundAt, resolve } from './collision';
import { MOB_TYPES } from './mobTypes';
import { spawnMob, removeMob, enterCombat, damageMob } from './mobs';
import { mobMode, scoreMult } from './modifiers';
import { C } from './champions';
import { run } from './score';
import { meta, saveMeta } from './meta';
import { combatText, fmtTime } from './ui/hud';
import { completeRun, setRunEndHook } from './player';
import { particles } from './fx/particles';
import { ringFx } from './fx/spellFx';
import { shockwave, lightFlash, hitstop } from './fx/impact';
import { addTrauma, decal, debris } from './wucht';
import { BOSSES, TIERS, TIER_OF_LEVEL, bossById } from './bosses/roster';
import { buildBossModel } from './bosses/models';
import { ATT, RANGE } from './bosses/attacks';
import { ruleOf } from './bosses/rules';
import { fight, setFight, tickTasks, tickObjs, clearObjs, newRun, impactFx, textAt, yawTo as yawOf, BK } from './bosses/core';

// Alle Zahlen PH. Zeiten in ms, Wege in yd
export const B = {
  every: 15,                // PH: Boss bei Level 15, 30, … 90; dazu der finale bei 100
  arena: 20,                // PH: Radius der Arena um den Spieler
  hpMul: 15,                // PH: × Mob-Leben des Levels (Handoff: Start 40; der Prototyp hat 15 gemessen: 40 dauerten 245 s mit Start-Kit)
  body: 2,                  // PH: Körperradius, der Spieler wird hinausgeschoben
  speed: 5,                 // PH: Laufen zwischen den Angriffen
  intro: { ms: 1500, fallMs: 600, height: 14, dist: 10, trauma: 0.9, decal: 9, hitstopMs: 90 },   // PH: fällt vor dem Spieler herab
  ringColor: [2.6, 0.5, 0.25],   // PH: leuchtender Bodenring der Arena (> 1 → Bloom)
  // PH: Boss-Sicht hinter dem Spieler. look: Blickhöhe über dem Spieler, toward: Anteil des Wegs zum Boss, auf den die Kamera schaut
  cam: { blendMs: 600, dist: 6, pitch: 0.15, fov: 70, height: 1.8, look: 1.6, toward: 0.45, ahead: 3, yawRate: 8, freeRate: 30, pitchMin: -0.1, pitchMax: 0.9, padBreak: 0.5 },   // freeRate: ohne Lock folgt die Kamera Maus und Stick fast sofort; padBreak: so weit gedrückter rechter Stick löst den Lock
  lockPadBtn: 11,           // Gamepad R3 (Standard-Mapping)
  pauseMs: [400, 800],      // PH: zwischen zwei Angriffen läuft er auf den Spieler zu
  near: 3, far: 9,          // PH: Abstand ab Körperkante: nah, mittel, weit
  // Phase 2 ab at des Lebens: Brüllen (unverwundbar), Druckwelle stößt weg, alle Ausholzeiten × 0,8 (bosses/core.ts)
  phase2: { at: 0.5, roarMs: 1000, push: 4, pushMs: 250, trauma: 0.8 },   // PH
  // Tod: Stopp stopMs, dann Zeitlupe slowMs mit slow (echte Zeit), riesiger Riss. Belohnung: Punkte wie points Champions, Knochenstaub dust
  end: { stopMs: 150, stop: 0.05, slowMs: 800, slow: 0.3, decal: 16, trauma: 1, statsMs: 7000 },   // PH
  points: 10, dust: 20,     // PH
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
  // Ohne Lock neigt die Maus die Kamera wie sonst, ausgehend von der Boss-Neigung
  const pitch = lockOn || !saved ? C.pitch : clamp(C.pitch + cam.pitch - saved.pitch, C.pitchMin, C.pitchMax);
  const h = Math.cos(pitch) * C.dist;
  _pos.set(p.x - Math.sin(camYaw) * h, p.y + C.height + Math.sin(pitch) * C.dist, p.z - Math.cos(camYaw) * h);
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
  if (boss) camBoss.copy(focus().mob.pos);
  const want = lockOn && boss ? yawTo(player.pos, camBoss) : player.facing + cam.offset;
  camYaw += wrap(want - camYaw) * (1 - Math.exp(-(lockOn && boss ? B.cam.yawRate : B.cam.freeRate) * dt / 1000));
}

// Lock-on lösen und wieder anlegen: Tab, Gamepad R3
function toggleLock() {
  if (!boss || state.paused) return;
  lockOn = !lockOn;
  if (!lockOn) cam.offset = 0;
  else if (saved) cam.pitch = saved.pitch;   // Neigung beim Anlegen zurück auf die Boss-Sicht
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
  #bossBar.won .name { font-size: 40px; color: #ffd27a; letter-spacing: 4px; }
  body.menu #bossBar { display: none !important; }
</style>`);
const bar = document.createElement('div');
bar.id = 'bossBar';
bar.innerHTML = '<div class="name"></div><div class="bar"><div class="lag"></div><div class="fill"></div></div><div class="sub"></div>';
document.body.appendChild(bar);
const barTrack = bar.querySelector('.bar') as HTMLElement, barName = bar.querySelector('.name') as HTMLElement, barFill = bar.querySelector('.fill') as HTMLElement,
  barLag = bar.querySelector('.lag') as HTMLElement, barSub = bar.querySelector('.sub') as HTMLElement;

// ---------- Boss-Körper ----------
// Fähigkeit der Boss-Mobs: updateMob überlässt ihr die Steuerung, Schaden läuft über onDamaged
const BOSS_ABILITY = {
  onUpdate: () => true,
  onDamaged: (m, amount) => {
    const b = boss?.bodies.find(x => x.mob === m);
    if (!b || boss.step !== 'fight' || b.state !== 'active' || b.invuln || b.submerged) return 0;
    let a = amount * (b.gapUntil > fight.time ? BK.punish : 1);   // Lücke: Bestrafen lohnt sich
    for (const fn of boss.hooks.dmgTaken) a = fn(b, a);
    return a;
  },
};

// Mob-Modell der Zone für den Prototyp: der Mob, der als nächster freigeschaltet wird
function zoneTypeId() {
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

// Einen Körper als Mob in die Arena setzen. spec: Modell aus dem Roster, hp: Leben dieses Körpers
function spawnBody(def, spec, home, hp, level) {
  const at = home.clone();
  let m: any;
  if (def.zoneModel) {
    const typeId = zoneTypeId();
    m = spawnMob(typeId, at, level, ++state.packCounter);
    m.model.root.scale.multiplyScalar(2.5);
    m.model.ctl = { arms: 0, lean: 0 };
    m.model.height = 2.2 * 2.5;
  } else m = spawnMob(null, at, level, ++state.packCounter, { ...MOB_TYPES[zoneTypeId()], name: def.name, build: () => buildModel(spec) });
  m.type = { ...m.type, name: def.name, fleeChance: 0, rootImmune: true, stealth: false };
  m.ability = BOSS_ABILITY;
  m.hidden = false; m.model.root.visible = true;
  m.hp = m.maxHp = Math.max(1, Math.round(hp));
  m.noKnock = true;
  m.xpMul = C.xp;
  m.boss = true;
  m.bossTint = 'boss';
  m.plate.remove();                                    // Name und Leben stehen oben in der Boss-Leiste
  m.model.root.rotation.order = 'YXZ';
  enterCombat(m, false);
  return m;
}
// Modell: Viewer-Bauer, verdorbene Figuren (Schritt 4) vorerst als dunkler Zweibeiner
function buildModel(spec) {
  if (spec.t === 'evil') return buildBossModel({ t: 'biped', p: { skin: spec.p.color, armor: spec.p.color, accent: 0x5a0a0e, eye: spec.p.glow, glow: spec.p.glow, weapon: spec.p.weapon, weapon2: spec.p.weapon2, weaponGlow: spec.p.weaponGlow, float: spec.p.float, head: 'hood', scale: 1.5 } });
  return buildBossModel(spec);
}

// ---------- Auswahl ----------
const seen = new Set<string>();
// Boss für dieses Level: aus der Stufe würfeln, kein Boss doppelt im Run
function pickBoss(level) {
  const all = BOSSES.filter(b => b.tier === TIER_OF_LEVEL(level)), fresh = all.filter(b => !seen.has(b.id)), list = fresh.length ? fresh : all;
  return list[Math.floor(Math.random() * list.length)];
}

// Kampf starten. id: fester Boss (Dev), sonst nach Level gewürfelt
export function startBoss(id?: string) {
  if (boss || player.dead || mobMode === 'siege') return false;
  const def = id ? bossById(id) : pickBoss(player.level);
  if (!def) return false;
  seen.add(def.id);
  for (const m of state.mobs) { if (!m.dead) puff(m.pos); removeMob(m); }
  state.mobs = [];
  const center = player.pos.clone(), level = player.level;
  const f = player.facing, fw = new THREE.Vector3(Math.sin(f), 0, Math.cos(f)), side = new THREE.Vector3(fw.z, 0, -fw.x);
  const specs = def.bodies ?? [{ m: def.model, off: [0, -4] }];
  const total = mobMaxHp(level) * B.hpMul * (def.hpMul ?? 1);
  boss = { def, center, step: 'intro', t0: state.now, until: state.now + B.intro.ms, startAt: state.now, phase: 1, arena: B.arena, time: 0, scale: 1, windMul: 1, dmgMul: 1,
    bodies: [], hooks: { tick: [], onPlayerHit: [], onDodged: [], dmgTaken: [], onBodyDeath: [], onEnd: [], bar: [], cleanup: [] }, stats: { hits: 0, perfect0: state.dodgeStats?.perfect ?? 0 }, totalHp: total };
  boss.hp = bossHp;
  boss.awaken = b => awaken(b);
  boss.spawnAdd = (pos, tint = 'boss2') => { const m: any = spawnMob(zoneTypeId(), pos.clone(), level, ++state.packCounter); m.bossTint = tint; enterCombat(m, false); return m; };
  boss.attack = (b, k, p) => runAttack(b, { k, p });
  boss.setArena = r => { boss.arena = r; layRing(arena, center, r - 0.25, r + 0.25); };
  setFight(boss);
  for (const s of specs) {
    const home = center.clone().addScaledVector(fw, B.intro.dist + (-4 - s.off[1])).addScaledVector(side, s.off[0]);
    resolve(home, B.body); home.y = groundAt(home.x, home.z, center.y);
    const b: any = { spec: s.m, home, grow: 1, yaw: 0, state: s.state ?? 'active', run: null, busy: false, last: null, walkUntil: 0, gapUntil: -1, mob: null, hp: total / specs.length };
    if (b.state !== 'hidden') awaken(b, true);
    boss.bodies.push(b);
  }
  for (const r of def.rules) ruleOf(r.k)(boss, { ...(r.p || {}), n: r.n });
  layRing(arena, center, boss.arena - 0.25, boss.arena + 0.25);
  lockOn = true;
  camStart();
  barName.textContent = def.name;
  barBase = `Boss · Level ${level}`;
  barSub.textContent = barBase;
  barLag.style.width = barFill.style.width = '100%';
  barTrack.style.display = 'block';
  bar.classList.remove('won');
  clearTimeout(statsTimer);
  bar.style.display = 'block';
  return true;
}
let barBase = '';
// Körper in die Arena holen: fällt herab (intro) oder steht auf (sleep → active)
export function awaken(b, intro = false) {
  const level = player.level;
  if (!b.mob) {
    b.mob = spawnBody(boss.def, b.spec, b.home, b.hp, level);
    b.mob.model.root.rotation.y = b.yaw = yawOf(b.home, player.pos);
    b.ground = b.mob.pos.y;
    if (intro && b.state === 'active') { b.mob.pos.y += B.intro.height; b.falling = true; }
  }
  if (b.state === 'sleep') { b.mob.model.ctl.lean = .9; return; }
  if (!intro) { b.state = 'active'; b.mob.model.ctl.lean = 0; impactFx(b.mob.pos, 5, 0xa070ff, .4); textAt(b.mob.pos, 'erwacht', 'info', 3); }
}
const alive = () => boss.bodies.filter(b => b.mob && !b.mob.dead || b.state === 'hidden');
const active = () => boss.bodies.filter(b => b.state === 'active' && b.mob && !b.mob.dead);
// Lock-on und Kamera: der nächste aktive Körper
function focus() {
  let best = null, bd = Infinity;
  for (const b of boss.bodies) if (b.mob && !b.mob.dead) { const d = dist2d(b.mob.pos, player.pos) + (b.state === 'active' && !b.submerged ? 0 : 100); if (d < bd) { bd = d; best = b; } }
  return best ?? boss.bodies[0];
}
export const bossHp = () => { let hp = 0, max = 0; for (const b of boss.bodies) { max += b.hp; hp += b.mob ? Math.max(0, b.mob.dead ? 0 : b.mob.hp) : b.hp; } return { hp, max }; };

// Spieler und Bosse bleiben in der Arena, der Spieler steckt nie im Boss
function keepInside() {
  const c = boss.center, p = player.pos, max = (boss.wall ?? boss.arena) - 0.5;   // wall: feste Wand, wenn der Ring schrumpft (arenaSchrumpft)
  const d = dist2d(p, c);
  if (d > max) { p.x = c.x + (p.x - c.x) / d * max; p.z = c.z + (p.z - c.z) / d * max; p.y = groundAt(p.x, p.z, p.y); }
  for (const b of boss.bodies) {
    if (!b.mob || b.mob.dead) continue;
    const m = b.mob, bd = dist2d(m.pos, c), bmax = boss.arena - B.body;
    if (bd > bmax) { m.pos.x = c.x + (m.pos.x - c.x) / bd * bmax; m.pos.z = c.z + (m.pos.z - c.z) / bd * bmax; }
    if (b.falling || b.state !== 'active' || b.submerged) continue;
    const pd = dist2d(p, m.pos), r = B.body * (b.grow ?? 1);
    if (pd < r && pd > 0.001) { p.x = m.pos.x + (p.x - m.pos.x) / pd * r; p.z = m.pos.z + (p.z - m.pos.z) / pd * r; }
  }
}

function land(b) {
  const m = b.mob, I = B.intro;
  m.pos.y = b.ground = groundAt(m.pos.x, m.pos.z, b.ground);
  b.falling = false;
  hitstop(I.hitstopMs);
  addTrauma(I.trauma);
  decal(m.pos, 3, I.decal);
  debris(m.pos); debris(m.pos);
  shockwave(m.pos, 10, 0.05, 600);
  ringFx(m.pos, 8, [2.4, 0.5, 0.25], 500);
  lightFlash(m.pos, 0xff6a3a, 500, 30, 300);
}

// Aus update() in main.ts, nach den Mobs: Auslöser, Ablauf, Arena
let finalPending = false;
export function updateBoss(dt) {
  if (!boss) {
    if (player.level < lastLevel) seen.clear();          // neuer Run
    const crossed = Math.floor(Math.min(player.level, 99) / B.every) > Math.floor(Math.min(lastLevel, 99) / B.every);
    lastLevel = player.level;
    if (finalPending) { finalPending = false; if (!startBoss()) completeRun('Level 100'); return; }
    if (crossed && autoOn() && mobMode === 'packs') startBoss();
    return;
  }
  lastLevel = player.level;
  const s = dt / 1000;
  boss.time += s * boss.scale;
  for (const b of boss.bodies) if (b.mob?.dead && !b.deadSeen) { b.deadSeen = true; b.state = 'dead'; if (b.run) b.run.alive = false; for (const fn of boss.hooks.onBodyDeath) fn(b); }
  if (!alive().length) return endBoss();
  const locked = lockOn && !player.dead, fm = focus().mob;
  state.bossLock = locked;
  state.bossAim = locked ? new THREE.Vector3(fm.pos.x, groundAt(fm.pos.x, fm.pos.z, fm.pos.y), fm.pos.z) : null;
  if (player.dead) return;
  keepInside();
  if (locked) { player.facing = yawTo(player.pos, fm.pos); cam.offset = 0; }   // W läuft auf den Boss zu
  updatePush(dt);
  tickTasks(s);
  tickObjs(s);
  if (boss.step === 'intro') {
    const I = B.intro, t = clamp((state.now - boss.t0) / I.fallMs, 0, 1);
    for (const b of boss.bodies) if (b.falling) { b.mob.pos.y = b.ground + I.height * (1 - t * t); b.mob.falling = false; if (t >= 1) land(b); }
    if (state.now >= boss.until) boss.step = 'fight';
    return;
  }
  for (const fn of boss.hooks.tick) fn(s * boss.scale);
  if (boss.phase === 1 && boss.step === 'fight') { const { hp, max } = bossHp(); if (hp <= max * B.phase2.at) roar(); }
  if (boss.step === 'roar') { if (state.now >= boss.until) boss.step = 'fight'; return; }
  if (boss.scale === 0) return;                          // Zeitstopp: Bosse stehen
  for (const b of active()) think(b, dt);
}

// Ein aktiver Körper: laufen, dann einen Angriff wählen; der Angriff läuft als async-Funktion, bis er fertig ist
function think(b, dt) {
  if (b.busy || b.submerged) return;
  if (fight.time < b.walkUntil) { walkTo(b, player.pos, dt); return; }
  const a = chooseAttack(b);
  if (!a) { b.walkUntil = fight.time + 1; return; }
  runAttack(b, a);
}
// Angriff starten: läuft als async-Funktion in einem eigenen Lauf, danach kurz laufen. Gibt das Promise zurück (Regeln warten darauf)
function runAttack(b, a) {
  if (b.run) b.run.alive = false;
  b.busy = true;
  b.mob.moving = false;
  const run = b.run = newRun();
  return (ATT[a.k](run, b, { ...a.p }) as Promise<any>).then(() => {
    if (!run.alive) return;
    b.busy = false;
    b.walkUntil = fight.time + rand(B.pauseMs[0], B.pauseMs[1]) / 1000;
  }, err => { console.error('Boss-Angriff', a.k, err); b.busy = false; });
}
function walkTo(b, target, dt) {
  const m = b.mob, dx = target.x - m.pos.x, dz = target.z - m.pos.z, d = Math.hypot(dx, dz), stop = B.body * (b.grow ?? 1) + 0.8;
  b.yaw = Math.atan2(dx, dz);
  if (d <= stop) { m.moving = false; return; }
  const speed = B.speed * (b.speedMul ?? 1) * (boss.speedMul ?? 1), step = Math.min(d - stop, speed * dt / 1000);
  m.pos.x += dx / d * step; m.pos.z += dz / d * step;
  resolve(m.pos, 0.7);
  m.pos.y = groundAt(m.pos.x, m.pos.z, m.pos.y);
  m.moving = true;
  m.speed = speed;
}
// Auswahl nach Abstand (nah, mittel, weit), nie derselbe zweimal hintereinander. Angriffe mit p2 erst in Phase 2, mit b nur für diesen Körper
function chooseAttack(b) {
  const idx = boss.bodies.indexOf(b);
  const list = (b.attacks ?? boss.def.attacks).filter(a => (!a.p2 || boss.phase === 2) && (a.b == null || a.b === idx) && ATT[a.k]);
  if (!list.length) return null;
  const d = dist2d(b.mob.pos, player.pos) - B.body * (b.grow ?? 1), want = d < B.near ? 'near' : d < B.far ? 'mid' : 'far';
  const fits = a => RANGE[a.k] === want || RANGE[a.k] === 'any' || (want === 'mid' && RANGE[a.k] !== 'near') || (want === 'far' && RANGE[a.k] === 'mid');
  const fresh = list.filter(a => a !== b.last);
  const pool = fresh.filter(fits);
  const a = (pool.length ? pool : fresh.length ? fresh : list)[Math.floor(Math.random() * (pool.length || fresh.length || list.length))];
  b.last = a;
  return a;
}

// ---------- Phase 2 ----------
// Brüllen: bricht alle Angriffe ab, Druckwelle schiebt den Spieler weg, Leuchten wird heller
function roar() {
  const P = B.phase2, b = focus(), m = b.mob;
  boss.phase = 2;
  boss.step = 'roar';
  boss.until = state.now + P.roarMs;
  for (const x of boss.bodies) { if (x.run) x.run.alive = false; x.busy = false; x.walkUntil = 0; if (x.mob) { x.mob.bossTint = 'boss2'; x.mob.pos.y = groundAt(x.mob.pos.x, x.mob.pos.z, x.mob.pos.y); x.mob.model.ctl.arms = 0; x.mob.model.ctl.lean = 0; } }
  const dx = player.pos.x - m.pos.x, dz = player.pos.z - m.pos.z, d = Math.hypot(dx, dz) || 1;
  boss.push = { dx: dx / d, dz: dz / d, left: P.push };
  addTrauma(P.trauma);
  shockwave(m.pos, 14, 0.06, 700);
  ringFx(m.pos, 10, [2.6, 0.6, 0.2], 600);
  lightFlash(m.pos, 0xff5a2a, 600, 35, 400);
  m.attackAt = state.now;
  textAt(m.pos, 'Phase 2', 'info', 3);
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

// Tod: Stopp, Zeitlupe, riesiger Riss, Einblendung. Belohnung über Punkte und Knochenstaub
let endAt = -1e9, statsTimer = 0;
export function bossTimeScale() {
  const E = B.end, t = performance.now() - endAt;
  return t < E.stopMs ? E.stop : t < E.stopMs + E.slowMs ? E.slow : 1;
}
function endBoss() {
  const last = boss.bodies.filter(b => b.mob).sort((a, b) => (b.mob.deathAt ?? 0) - (a.mob.deathAt ?? 0))[0], m = last.mob, E = B.end, st = boss.stats, def = boss.def;
  const time = state.now - boss.startAt, perfect = (state.dodgeStats?.perfect ?? 0) - st.perfect0;
  endAt = performance.now();
  addTrauma(E.trauma);
  decal(m.pos, 3, E.decal, E.decal);
  debris(m.pos); debris(m.pos); debris(m.pos); debris(m.pos);
  shockwave(m.pos, 18, 0.07, 900);
  ringFx(m.pos, 14, [2.6, 0.6, 0.2], 900);
  lightFlash(m.pos, 0xffb070, 800, 40, 600);
  // Champion-Kills zählten schon in killMob (xpMul), dazu die übrigen points − 1
  run.killPoints += Math.round(xpForKill(m.level) * C.xp * (B.points - 1) * scoreMult());
  meta.dust += B.dust;
  saveMeta();
  combatText(m.pos, `+${B.dust} Knochenstaub`, 'xp', 4);
  for (const fn of boss.hooks.onEnd) fn(m.pos);
  const final = def.tier === 'final';
  cleanup();
  barName.textContent = `${def.name} besiegt`;
  bar.classList.add('won');
  barTrack.style.display = 'none';
  barSub.textContent = `Kampfzeit ${fmtTime(time)} · Treffer genommen ${st.hits} · Perfekte Dodges ${perfect} · +${B.dust} Knochenstaub`;
  bar.style.display = 'block';
  statsTimer = window.setTimeout(() => { bar.style.display = 'none'; }, E.statsMs);
  lastResult = { id: def.id, time, hits: st.hits, perfect };
  if (final && player.level >= 100) window.setTimeout(() => completeRun('Level 100'), E.stopMs + E.slowMs + 600);   // Finale: danach Ergebnis
}
let lastResult = null;

// Kampf beenden: Arena weg, Leiste weg. Der Spawn läuft danach von selbst weiter (updateRespawn füllt die Packs auf)
function cleanup(instant = false) {
  if (boss) for (const b of boss.bodies) { if (b.run) b.run.alive = false; if (b.mob && !b.mob.dead && !state.mobs.includes(b.mob)) b.mob = null; }
  for (const fn of boss?.hooks.cleanup ?? []) fn();
  clearObjs();
  setFight(null);
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
  if (!boss.bodies.some(b => b.mob && state.mobs.includes(b.mob))) return cleanup(true);
  if (pad.down[B.lockPadBtn] && !pad.prev[B.lockPadBtn]) toggleLock();
  // Maus ziehen (links Kamera, rechts Drehen) oder rechter Stick: Lock lösen, damit die gewohnte Steuerung greift. Tab oder R3 legt wieder an
  const steering = (mouseBtn.left || mouseBtn.right) && mouse.dragged || Math.hypot(pad.look.x, pad.look.y) > B.cam.padBreak;
  if (lockOn && steering && !state.paused) toggleLock();
  for (const b of boss.bodies) {
    if (!b.mob) continue;
    const r = b.mob.model.root, c = b.mob.model.ctl;
    r.rotation.y = b.yaw;
    if (!b.mob.model.parts) r.rotation.x = c.lean + c.arms * .12;   // Prototyp (Mob-Modell der Zone): Ausholen als Kippen
  }
  const { hp, max } = bossHp(), want = Math.max(0, hp / max * 100), pct = `${want}%`;
  if (barFill.style.width !== pct) barFill.style.width = pct;
  const lag = parseFloat(barLag.style.width) || 100;   // gelber Rest folgt langsam
  barLag.style.width = `${lag > want ? Math.max(want, lag - 0.6) : want}%`;
  const extra = boss.hooks.bar.map(fn => fn()).filter(Boolean).join(' · ');
  const sub = extra ? `${barBase} · ${extra}` : barBase;
  if (barSub.textContent !== sub) barSub.textContent = sub;
}

// ---------- Dev: alle Bosse nach Stufe, Starten ----------
{
  const opts = TIERS.map(([t, label]) => `<optgroup label="${label}">${BOSSES.filter(b => b.tier === t).map(b => `<option value="${b.id}">${b.evil ? 'V · ' : ''}${b.name}</option>`).join('')}</optgroup>`).join('') + '<option value="prototyp">Prototyp-Boss</option>';
  $('devPerf').insertAdjacentHTML('afterend', `<div style="display:flex;gap:6px;margin-bottom:14px"><select id="devBossPick" class="bindBtn" style="flex:1">${opts}</select><button class="bindBtn" id="devBoss">Starten</button></div>`);
  $('devBoss').addEventListener('click', () => { $('settingsClose').click(); startBoss(($('devBossPick') as HTMLSelectElement).value); });
}
// Level 100 im #boss-Modus: erst der finale Boss, dann das Ergebnis (player.ts fragt hier nach)
setRunEndHook(() => { if (!autoOn() || mobMode !== 'packs') return false; finalPending = true; return true; });

// Für Tests
(window as any).__boss = {
  B, BOSSES, start: (id?) => startBoss(id), toggleLock,
  force: (k, bi = 0) => { const b = boss?.bodies[bi]; const a = boss?.def.attacks.find(x => x.k === k || x.n === k); if (!b || !a) return false; if (b.run) b.run.alive = false; b.busy = true; const run = b.run = newRun(); ATT[a.k](run, b, { ...a.p }).then(() => { if (run.alive) { b.busy = false; b.walkUntil = fight.time + .5; } }); return true; },
  phase2: () => { if (boss) for (const b of boss.bodies) if (b.mob) b.mob.hp = Math.floor(b.mob.maxHp * B.phase2.at * .99); },
  hit: (bi = 0, amount = 1e9) => { const m = boss?.bodies[bi]?.mob; return m ? damageMob(m, amount, 'test', 0, true) : false; },
  get boss() { return boss; }, get result() { return lastResult; }, camera, get lock() { return lockOn; }, get camK() { return camK; }, seen,
};
