// VFX-Labor: echter Spell-Code und echte Render-Kette auf flachem Boden, ohne KI-Bewegung, Menüs und HUD.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state, player } from './state';
import { $, clamp, rand } from './util';
import { CFG, SPELLS, PERF } from './config';
import { camera, renderer, composer } from './render';
import { particles } from './fx/particles';
import { mage } from './models/mage';
import { ambientParticles, updateBlizFx, updateEffects, clearEffects, fxClock } from './fx/spellFx';
import { bolt } from './fx/bolts';
import { mountVolume } from './fx/sound';
import { hitstopDt, impact, onMultiKill } from './fx/impact';
import { cam } from './camera';
import { spawnMob, updateMob, removeMob } from './mobs';
import { makeCtx, stopChannel, clearSpellEffects, updateChannel, isGround, rune } from './spells';
import { resetGame, switchZone } from './player';
import { MOB_TYPES } from './mobTypes';
import { ZONES } from './zones';

const TARGETS = 8, PACK_CENTER = new THREE.Vector3(0, 0, 7);   // PH: alle Ziele in 10 yd, damit Kegel und Flächen sie treffen

ZONES.lab = {
  name: 'VFX-Labor',
  env: { fog: 0x20242e, fogNear: 45, fogFar: 130, sky: 0xaab4c8, ground: 0x30343c, hemi: 1.1, sun: 0xfff0e0, sunPower: 1.4, sunPos: [40, 60, 25], top: 0x121722, mid: 0x1c2230, sunDisc: 0 },
  height: () => 0,
  ground: (c, x, z) => {   // Raster alle 5 yd als Maßstab
    const line = Math.min(Math.abs(((x % 5) + 5) % 5), Math.abs(((z % 5) + 5) % 5)) < 0.8;
    c.setRGB(line ? 0.17 : 0.13, line ? 0.19 : 0.15, line ? 0.21 : 0.16);
  },
  props: () => {},
  spawn: { x: 0, z: 0 },
  mobs: ['dummy'],
  packs: { count: 1, initialMobs: 0, sizeBonus: 0 },
};

const dummyGeo = new THREE.CylinderGeometry(0.55, 0.65, 2, 32);
MOB_TYPES.dummy = { name: 'Ziel', ability: null, hpMul: 1e5, speedMul: 0, aggro: 0, rootImmune: false,
  build() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a93a6 }), root = new THREE.Group(), body = new THREE.Mesh(dummyGeo, mat);
    body.position.y = 1;
    root.add(body);
    return { root, update(_dt, anim) { mat.emissive.setRGB(anim.flash * 0.3, anim.flash * 0.3, anim.flash * 0.3); } };
  } };

// Welt und Spieler wie im Spiel aufbauen, danach Ziele statt Packs
resetGame();
switchZone('lab');
for (const m of state.mobs) removeMob(m);
state.mobs = [];
player.facing = 0;
state.paused = false;

const homes = [];
for (let i = 0; i < TARGETS; i++) {
  const a = -0.5 + i / (TARGETS - 1), row = i % 2;
  const home = new THREE.Vector3(Math.sin(a) * (6 + row * 2.5), 0, Math.cos(a) * (6 + row * 2.5));
  homes.push(home);
  spawnMob('dummy', home.clone(), player.level, 1);
}
function resetStage() {
  player.pos.set(0, 0, 0);
  state.mobs.forEach((m, i) => { m.pos.copy(homes[i]); m.leap = null; m.state = 'idle'; m.rootUntil = m.slowUntil = 0; });
}

// Kamera
camera.position.set(-9.5, 8.5, -14);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3.2, 5);
controls.enableDamping = true;

// Wirken ohne Kosten, Abklingzeit und Castzeit
let selected = 'nova';
function castLab(id) {
  selected = id;
  fillRunes();
  if (!state.fields.length && !player.channel) resetStage();
  stopChannel(true);
  player.drink = null;
  player.castAnimUntil = state.now + 450;
  SPELLS[id].effect(makeCtx(id), isGround(id) ? PACK_CENTER.clone() : undefined);
}
function fillRunes() {
  const sel = $('runeSel') as HTMLSelectElement, s = SPELLS[selected];
  $('runeHead').textContent = `Rune: ${s.name}`;
  sel.innerHTML = '<option value="">keine</option>' + (s.runes ?? []).map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  sel.value = rune(selected)?.id ?? '';
  sel.disabled = !s.runes;
}
$('runeSel').addEventListener('change', e => {
  const v = (e.target as HTMLSelectElement).value;
  if (v) state.runes[selected] = v; else delete state.runes[selected];
  castLab(selected);
});

const KIT = ['nova', 'ae', 'bliz', 'coc', 'blink', 'drink'];
for (const [id, s] of Object.entries<any>(SPELLS)) {
  const b = document.createElement('button');
  b.textContent = s.name;
  b.addEventListener('click', () => castLab(id));
  $(s.relic ? 'relics' : KIT.includes(id) ? 'kit' : 'fresh').appendChild(b);
}
fillRunes();

function setOld(old) {
  PERF.vfxOld = old;
  $('modeOld').classList.toggle('on', old);
  $('modeNew').classList.toggle('on', !old);
}
$('modeOld').addEventListener('click', () => setOld(true));
$('modeNew').addEventListener('click', () => setOld(false));
setOld(false);

const qualitySel = $('quality') as HTMLSelectElement;
qualitySel.value = PERF.vfx;
qualitySel.addEventListener('change', () => { PERF.vfx = qualitySel.value; });

mountVolume($('slow'), 'beforebegin');

let slow = 1;
$('slow').addEventListener('click', () => {
  slow = fxClock.scale = slow === 1 ? 0.25 : 1;
  $('slow').textContent = `Zeitlupe 0,25×: ${slow === 1 ? 'aus' : 'an'}`;
  $('slow').classList.toggle('on', slow !== 1);
});

function stopAll() {
  stopChannel(true);
  player.drink = null;
  clearSpellEffects();
  clearEffects();
  resetStage();
}
$('stop').addEventListener('click', stopAll);
function stress() {
  stopAll();
  const chainRune = state.runes.chain;
  state.runes.chain = 'repeat';   // 8 Ziele reichen sonst nur für 7 Sprünge
  SPELLS.chain.effect(makeCtx('chain'));
  state.runes.chain = chainRune;
  SPELLS.bliz.effect(makeCtx('bliz'), PACK_CENTER.clone());
}
$('stress').addEventListener('click', stress);
$('impact').addEventListener('click', () => impact(PACK_CENTER, 0xbfe4ff));
$('boltTest').addEventListener('click', () => bolt({ x: 0, y: 1.4, z: 0 }, { x: 0, y: 1.2, z: 8 }, [1.3, 1.7, 2.8]));
$('multi').addEventListener('click', () => { impact(PACK_CENTER, 0xffd080, { radius: 18, power: 600 }); onMultiKill(); });
$('toggle').addEventListener('click', () => $('panel').classList.toggle('closed'));
if (innerWidth < 700) $('panel').classList.add('closed');

// Anzeige
let frames = 0, since = performance.now(), fps = 0;
function updateStats(t) {
  const calls = renderer.info.render.calls;
  renderer.info.reset();
  frames++;
  if (t - since >= 500) { fps = Math.round(frames * 1000 / (t - since)); frames = 0; since = t; }
  $('stats').innerHTML = `${fps} FPS<br>${calls} Draw Calls<br>${particles.count()} Partikel`;
}

const saved = new THREE.Vector3();
let last = performance.now();
function loop(t) {
  const fxDt = Math.min(50, t - last) * slow, dt = hitstopDt(fxDt);
  last = t;
  state.now += dt;
  player.hp = 1e7;
  player.mana = 1e7;
  player.cds = {};
  player.gcdUntil = 0;
  updateChannel();
  for (const m of state.mobs) {
    m.hp = m.maxHp;
    updateMob(m, dt);
    m.nextSwing = state.now + 1e6;   // Ziele schlagen nicht zurück
  }
  mage.root.position.copy(player.pos);
  mage.root.rotation.y = player.facing;
  const castT = clamp((player.castAnimUntil - state.now) / 450, 0, 1);
  mage.update(dt, { state: player.drink ? 'sit' : 'idle', speed: CFG.runSpeed, vy: 0, squat: 0, channel: !!player.channel, cast: Math.sin(castT * Math.PI) });
  for (const m of state.mobs) m.model.update(dt, { state: 'idle', speed: 0, frozen: false, slowed: false, attack: 0, flash: clamp(1 - (state.now - (m.hitAt ?? -1e9)) / 140, 0, 1) });
  updateBlizFx(fxDt);
  ambientParticles(fxDt);
  particles.update(fxDt);
  controls.update();
  // Wackeln und Ruck nur für dieses Bild, OrbitControls behält die eigene Position
  saved.copy(camera.position);
  if (cam.shake > 0.001) {
    camera.position.x += rand(-1, 1) * cam.shake;
    camera.position.y += rand(-1, 1) * cam.shake;
    cam.shake *= 0.86;
  }
  updateEffects();
  composer.render();
  camera.position.copy(saved);
  updateStats(t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Für Tests
(window as any).__lab = { setSlow(v) { slow = fxClock.scale = v; }, bolt, impact, castLab, stress, stopAll, setOld, state, player, particles, SPELLS };
