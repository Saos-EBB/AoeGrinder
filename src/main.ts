import * as THREE from 'three';
import { state, player } from './state';
import { $, rand, randInt, clamp, dist2d, lerpTo } from './util';
import { CFG, SPELLS, mods, resetMods, CARDS } from './config';
import { aggroRadius, hitChance, xpForKill, xpNeeded, maxHp, maxMana, spirit, dmgMult, mobMaxHp, mobHitDmg, manaCost, spellCd, blizRadius } from './formulas';
import { renderer, scene, camera, composer } from './render';
import { heightAt, collide, drape } from './world';
import { particles } from './fx/particles';
import { mage } from './models/mage';
import { buildBoar } from './models/boar';
import { blizCursor, blizFx, FROST_WHITE, novaFx, arcaneExplosionFx, coneOfColdFx, blinkFx, hitSparkFx, crystalBurst, levelUpFx, ambientParticles, updateEffects, resetShard } from './fx/spellFx';
import { cam, shakeCamera, updateCamera } from './camera';
import { overlay, combatText, showError, fmtTime, refreshKeyLabels, updateHud } from './ui/hud';

const ACTIONS = [
  { group: 'Bewegung' },
  { id: 'forward',     label: 'Vorwärts',          code: 'KeyW',   key: 'W' },
  { id: 'back',        label: 'Rückwärts',         code: 'KeyS',   key: 'S' },
  { id: 'turnLeft',    label: 'Links drehen',      code: 'KeyA',   key: 'A' },
  { id: 'turnRight',   label: 'Rechts drehen',     code: 'KeyD',   key: 'D' },
  { id: 'strafeLeft',  label: 'Seitwärts links',   code: 'KeyQ',   key: 'Q' },
  { id: 'strafeRight', label: 'Seitwärts rechts',  code: 'KeyE',   key: 'E' },
  { id: 'jump',        label: 'Springen',          code: 'Space',  key: 'Leertaste' },
  { id: 'autorun',     label: 'Autorun',           code: 'KeyR',   key: 'R' },
  { group: 'Zauber' },
  { id: 'nova',  label: 'Frost Nova',       code: 'Digit1', key: '1', spell: true },
  { id: 'ae',    label: 'Arcane Explosion', code: 'Digit2', key: '2', spell: true },
  { id: 'bliz',  label: 'Blizzard',         code: 'Digit3', key: '3', spell: true },
  { id: 'coc',   label: 'Cone of Cold',     code: 'Digit4', key: '4', spell: true },
  { id: 'blink', label: 'Blink',            code: 'Digit5', key: '5', spell: true },
  { id: 'drink', label: 'Trinken',          code: 'Digit6', key: '6', spell: true },
];
const BIND_STORE = 'frostgrind.binds.v1';
export let binds = loadBinds();

function defaultBinds() {
  const b = {};
  for (const a of ACTIONS) if (a.id) b[a.id] = { code: a.code, key: a.key };
  return b;
}
function loadBinds() {
  const b = defaultBinds();
  try { Object.assign(b, JSON.parse(localStorage.getItem(BIND_STORE) || '{}')); } catch { /* kein Storage */ }
  return b;
}
function saveBinds() {
  try { localStorage.setItem(BIND_STORE, JSON.stringify(binds)); } catch { /* egal */ }
}
function resetBinds() {
  binds = defaultBinds();
}
const keyName = e => e.code === 'Space' ? 'Leertaste' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
const actionForCode = code => Object.keys(binds).find(id => binds[id].code === code);

// Eingabe
const held = new Set();      // gedrückte Tasten (e.code)
const mouseBtn = { left: false, right: false };
const mouse = { ndc: new THREE.Vector2(), ground: new THREE.Vector3(), dragged: false, downX: 0, downY: 0 };
const act = id => held.has(binds[id].code);

function resetGame() {
  for (const m of state.mobs) { scene.remove(m.model.root); m.plate.remove(); }
  state.mobs = [];
  resetMods();
  state.cardRanks = {};
  state.now = 0;
  state.pendingLevelUps = 0;
  state.autorun = false;
  Object.assign(player, {
    pos: new THREE.Vector3(0, heightAt(0, 0), 0), vel: new THREE.Vector3(), grounded: true,
    facing: Math.PI, moveState: 'idle', level: CFG.startLevel, xp: 0,
    lastManaUse: -1e9, nextRegen: CFG.regenTick, gcdUntil: 0, cds: {}, castAnimUntil: 0,
    channel: null, drink: null, targeting: false, lastCombat: -1e9, dead: false, kills: 0,
  });
  cam.offset = 0;
  player.hp = maxHp();
  player.mana = maxMana();
  blizCursor.visible = false;
  stopChannel();
  while (state.mobs.length < 30) spawnPack();
}

function spawnPack() {
  let center;
  for (let tries = 0; tries < 40; tries++) {
    const a = rand(0, Math.PI * 2), r = rand(15, 85);
    center = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const farFromPlayer = dist2d(center, player.pos) > 40;
    const farFromPacks = state.mobs.every(m => m.dead || dist2d(m.home, center) > 18);
    if (farFromPlayer && farFromPacks) break;
  }
  const size = clamp(3 + Math.floor((player.level - 20) / 2) + randInt(-1, 1), 2, 10);
  const packId = ++state.packCounter;
  for (let i = 0; i < size; i++) {
    const level = Math.max(1, player.level + [-1, 0, 0, 1, 1, 2][randInt(0, 5)]);
    const pos = center.clone().add(new THREE.Vector3(rand(-5, 5), 0, rand(-5, 5)));
    collide(pos, 0.7);
    pos.y = heightAt(pos.x, pos.z);
    const model = buildBoar(level);
    model.root.position.copy(pos);
    model.root.rotation.y = rand(0, Math.PI * 2);
    scene.add(model.root);
    const plate = document.createElement('div');
    plate.className = 'plate';
    plate.innerHTML = `<span class="lv"></span> Wildeber<div class="hp"><div></div></div>`;
    overlay.appendChild(plate);
    state.mobs.push({
      model, plate, plateHp: plate.querySelector('.hp div'), plateLv: plate.querySelector('.lv'),
      pos: model.root.position, home: pos.clone(), combatStart: pos.clone(), packId,
      level, hp: mobMaxHp(level), maxHp: mobMaxHp(level),
      state: 'idle', assistAt: 0, nextSwing: 0, attackAt: -1e9, rootUntil: 0, slowUntil: 0, slowPct: 0,
      fleeRolled: false, fleeTarget: null, fleeUntil: 0, lastLeashExt: 0, dead: false, deathAt: 0, moving: false,
    });
  }
}

function enterCombat(mob, callForHelp) {
  if (mob.dead || mob.state === 'combat') return;
  mob.state = 'combat';
  mob.combatStart.copy(mob.pos);
  mob.lastLeashExt = state.now;
  mob.nextSwing = state.now + 500;
  mob.assistAt = 0;
  if (!callForHelp) return;
  for (const other of state.mobs) {                 // Social Aggro: 10 yd, Helfer nach 1,5 s
    if (other === mob || other.dead || other.state !== 'idle' || other.assistAt) continue;
    if (dist2d(other.pos, mob.pos) <= CFG.socialRadius) other.assistAt = state.now + CFG.socialDelay;
  }
}

function startEvade(mob) {
  mob.state = 'evade';
  mob.rootUntil = 0;
  mob.slowUntil = 0;
}

function isOutOfThreatArea(mob) {
  const area = Math.max(aggroRadius(mob) * 1.5, CFG.leashRadius);
  const out = dist2d(mob.pos, mob.combatStart) > area && dist2d(player.pos, mob.combatStart) > area;
  return out && state.now - mob.lastLeashExt > CFG.leashGrace;
}

function startFlee(mob) {
  let helper = null, best = CFG.fleeAssistRadius;
  for (const other of state.mobs) {
    if (other === mob || other.dead || other.state !== 'idle') continue;
    const d = dist2d(other.pos, mob.pos);
    if (d < best) { best = d; helper = other; }
  }
  mob.state = 'flee';
  mob.fleeTarget = helper;
  mob.fleeUntil = state.now + CFG.fleeDuration;
  combatText(mob.pos, 'läuft in Panik davon!', 'info', 2.5);
}

function moveMob(mob, target, dt, speedMul = 1, ignoreCC = false) {
  if (!ignoreCC && mob.rootUntil > state.now) return;
  let speed = CFG.mobSpeed * speedMul;
  if (!ignoreCC && mob.slowUntil > state.now) speed *= 1 - mob.slowPct;
  const dx = target.x - mob.pos.x, dz = target.z - mob.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return;
  const step = Math.min(d, speed * dt / 1000);
  mob.pos.x += dx / d * step;
  mob.pos.z += dz / d * step;
  mob.moving = true;
  mob.speed = speed;
}

function faceMob(mob, target) {
  const want = Math.atan2(target.x - mob.pos.x, target.z - mob.pos.z);
  if (mob.rootUntil > state.now) return;
  mob.model.root.rotation.y = want;
}

function updateMob(mob, dt) {
  if (mob.dead) return;
  mob.moving = false;
  const d = dist2d(mob.pos, player.pos);

  if (mob.state === 'idle') {
    if (!player.dead && d < aggroRadius(mob)) enterCombat(mob, true);
    else if (mob.assistAt && state.now >= mob.assistAt) enterCombat(mob, false);
  }
  else if (mob.state === 'combat') {
    if (player.dead || isOutOfThreatArea(mob)) { startEvade(mob); return; }
    if (d > CFG.meleeRange) moveMob(mob, player.pos, dt);
    else if (state.now >= mob.nextSwing && mob.rootUntil <= state.now) {
      mob.nextSwing = state.now + CFG.swingTime;
      mob.attackAt = state.now;
      damagePlayer(mobHitDmg(mob.level));
    }
    faceMob(mob, player.pos);
  }
  else if (mob.state === 'flee') {
    const helper = mob.fleeTarget;
    if (helper && !helper.dead) {
      moveMob(mob, helper.pos, dt);
      faceMob(mob, helper.pos);
      if (dist2d(mob.pos, helper.pos) < 3) { enterCombat(helper, true); mob.state = 'combat'; }
    } else {
      const away = mob.pos.clone().multiplyScalar(2).sub(player.pos);
      moveMob(mob, away, dt);
      faceMob(mob, away);
      if (state.now >= mob.fleeUntil) mob.state = 'combat';
    }
  }
  else if (mob.state === 'evade') {
    moveMob(mob, mob.home, dt, 1.6, true);
    faceMob(mob, mob.home);
    mob.hp = mob.maxHp;
    if (dist2d(mob.pos, mob.home) < 0.5) { mob.state = 'idle'; mob.fleeRolled = false; }
  }
  collide(mob.pos, 0.7);
  mob.pos.y = heightAt(mob.pos.x, mob.pos.z);
}

// Mobs im Kampf schieben sich leicht auseinander
function separateMobs() {
  const active = state.mobs.filter(m => !m.dead && m.state !== 'idle');
  for (let i = 0; i < active.length; i++) {
    for (let k = i + 1; k < active.length; k++) {
      const a = active[i].pos, b = active[k].pos;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 1.3) {
        const push = (1.3 - d) / 2;
        if (active[i].rootUntil <= state.now) { a.x -= dx / d * push; a.z -= dz / d * push; }
        if (active[k].rootUntil <= state.now) { b.x += dx / d * push; b.z += dz / d * push; }
      }
    }
  }
}

// Gibt true zurück, wenn der Zauber getroffen hat
function damageMob(mob, amount, source) {
  if (mob.dead) return false;
  if (mob.state === 'evade') { combatText(mob.pos, 'Entkommen', 'miss'); return false; }
  if (mob.state === 'idle') enterCombat(mob, true);
  player.lastCombat = state.now;
  mob.lastLeashExt = state.now;

  if (Math.random() * 100 >= hitChance(mob)) { combatText(mob.pos, 'Widerstanden', 'miss'); return false; }

  const frozen = mob.rootUntil > state.now;
  const crit = Math.random() < CFG.baseCrit + (frozen ? mods.shatter : 0);
  const dmg = Math.round(amount * dmgMult() * (crit ? 1 + CFG.critBonus : 1));
  mob.hp -= dmg;
  mob.hitAt = state.now;
  if (crit) shakeCamera(0.18);
  combatText(mob.pos, dmg, crit ? 'crit' : 'dmg');
  hitSparkFx(mob.pos, source === 'ae' ? 'arcane' : 'frost');

  if (frozen && source !== 'nova' && Math.random() < CFG.novaBreakChance) mob.rootUntil = 0;

  if (mob.hp <= 0) { killMob(mob); return true; }
  if (!mob.fleeRolled && mob.hp < mob.maxHp * CFG.fleeHpPct) {
    mob.fleeRolled = true;
    if (Math.random() < CFG.fleeChance) startFlee(mob);
  }
  return true;
}

function killMob(mob) {
  mob.dead = true;
  mob.deathAt = state.now;
  mob.hp = 0;
  mob.rootUntil = 0;
  mob.plate.style.display = 'none';
  player.kills++;
  const xp = xpForKill(mob.level);
  if (xp > 0) { combatText(mob.pos, `+${xp} XP`, 'xp', 2); gainXp(xp); }
}

function damagePlayer(amount) {
  if (player.dead) return;
  player.hp -= amount;
  player.lastCombat = state.now;
  combatText(player.pos, amount, 'hurt', 2.6);
  if (player.drink) stopDrink();
  pushbackChannel();
  if (player.hp <= 0) die();
}

// Channel-Pushback: 1000, 800, 600, 400, 200, 200 ... ms (Spell::DelayedChannel)
function pushbackChannel() {
  const ch = player.channel;
  if (!ch) return;
  const delay = ch.delays < 5 ? 1000 - ch.delays * 200 : 200;
  ch.delays++;
  ch.end -= delay;
  if (ch.end <= state.now) stopChannel();
}

function spendMana(cost) {
  if (cost <= 0) return;
  player.mana -= cost;
  player.lastManaUse = state.now;              // startet die 5-Sekunden-Regel
}

function regenerate(dt) {
  if (state.now >= player.nextRegen) {         // Tick alle 2 s
    player.nextRegen += CFG.regenTick;
    let mana = spirit() / 4 + 12.5;
    if (state.now - player.lastManaUse < CFG.fiveSecRule) mana *= mods.castRegen;
    player.mana = Math.min(maxMana(), player.mana + mana);
    if (state.now - player.lastCombat > 5000) player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.03);  // PH
  }
  if (player.drink) {                    // PH: 90 % Mana + 50 % HP über 18 s
    player.mana = Math.min(maxMana(), player.mana + maxMana() * 0.9 * dt / SPELLS.drink.dur);
    player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.5 * dt / SPELLS.drink.dur);
    const full = player.mana >= maxMana() && player.hp >= maxHp();
    if (state.now >= player.drink.end || full) stopDrink();
  }
}

function gainXp(xp) {
  player.xp += xp;
  while (player.xp >= xpNeeded()) {
    player.xp -= xpNeeded();
    player.level++;
    state.pendingLevelUps++;
  }
  if (state.pendingLevelUps > 0 && !$('cardModal').classList.contains('show')) { levelUpFx(); showCards(); }
}

function die() {
  player.dead = true;
  player.hp = 0;
  stopChannel(); stopDrink();
  state.paused = true;
  setTimeout(() => {
    $('deathStats').innerHTML = `Level <b>${player.level}</b> · <b>${player.kills}</b> Kills · Zeit <b>${fmtTime(state.now)}</b>`;
    $('deathModal').classList.add('show');
  }, 900);
}

// Bewegung wie in WoW: A/D drehen, Q/E (oder A/D mit rechter Maus) seitwärts,
// kein Lenken in der Luft, Rückwärts langsamer.
function updatePlayer(dt) {
  const s = dt / 1000;
  const turn = (act('turnLeft') ? 1 : 0) - (act('turnRight') ? 1 : 0);
  if (!mouseBtn.right) player.facing += turn * CFG.turnSpeed * s;

  let fwd = (act('forward') || state.autorun || (mouseBtn.left && mouseBtn.right)) ? 1 : 0;
  if (act('back')) fwd -= 1;
  let strafe = (act('strafeRight') ? 1 : 0) - (act('strafeLeft') ? 1 : 0);
  if (mouseBtn.right) strafe -= turn;
  strafe = clamp(strafe, -1, 1);

  if (player.grounded) {
    const f = player.facing;
    let vx = Math.sin(f) * fwd - Math.cos(f) * strafe;
    let vz = Math.cos(f) * fwd + Math.sin(f) * strafe;
    const len = Math.hypot(vx, vz);
    const speed = fwd < 0 ? CFG.backSpeed : CFG.runSpeed;
    player.vel.x = len ? vx / len * speed : 0;
    player.vel.z = len ? vz / len * speed : 0;
    player.moveState = len ? (fwd < 0 ? 'back' : 'run') : 'idle';
    if (state.jumpQueued) {
      player.vel.y = CFG.jumpSpeed;
      player.grounded = false;
    }
  }
  state.jumpQueued = false;

  const moved = Math.hypot(player.vel.x, player.vel.z) > 0 || !player.grounded;
  player.pos.x += player.vel.x * s;
  player.pos.z += player.vel.z * s;
  collide(player.pos, 0.45);

  const ground = heightAt(player.pos.x, player.pos.z);
  if (player.grounded) {
    player.pos.y = ground;               // klebt am Boden (auch bergab)
  } else {
    player.vel.y -= CFG.gravity * s;
    player.pos.y += player.vel.y * s;
    if (player.pos.y <= ground) { player.pos.y = ground; player.vel.y = 0; player.grounded = true; }
  }

  if (moved) {
    if (player.channel) stopChannel();   // Bewegung bricht Channel und Trinken ab
    if (player.drink) stopDrink();
    if (!mouseBtn.left) cam.offset -= cam.offset * Math.min(1, s * 3);   // Kamera dreht sich langsam hinter den Spieler
  }
  updateChannel();
  regenerate(dt);
}

function cast(id, point?) {
  if (state.paused || player.dead) return;
  if (state.now < player.gcdUntil || (player.cds[id] || 0) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  const cost = manaCost(id);
  if (player.mana < cost) return showError('Nicht genug Mana');
  if (id === 'bliz' && dist2d(player.pos, point) > SPELLS.bliz.range) return showError('Außer Reichweite');
  if (id === 'drink' && !player.grounded) return showError('Du kannst das nicht im Sprung tun');

  stopChannel();
  stopDrink();
  spendMana(cost);
  player.gcdUntil = state.now + CFG.gcd;
  if (SPELLS[id].cd) player.cds[id] = state.now + spellCd(id);
  if (id !== 'drink' && id !== 'bliz') { player.castAnimUntil = state.now + 450; crystalBurst(SPELLS[id].cls); }
  SPELL_EFFECTS[id](point);
}

const mobsInRadius = (center, r) => state.mobs.filter(m => !m.dead && dist2d(m.pos, center) <= r);

const SPELL_EFFECTS = {
  nova() {
    const s = SPELLS.nova;
    for (const m of mobsInRadius(player.pos, s.radius)) {
      if (damageMob(m, rand(s.min, s.max), 'nova') && !m.dead) m.rootUntil = state.now + s.root;
    }
    novaFx(player.pos, s.radius);
  },
  ae() {
    const s = SPELLS.ae;
    for (const m of mobsInRadius(player.pos, s.radius)) damageMob(m, rand(s.min, s.max), 'ae');
    arcaneExplosionFx(player.pos, s.radius);
  },
  bliz(point) {
    player.channel = { id: 'bliz', point: point.clone(), start: state.now, end: state.now + SPELLS.bliz.channel, nextTick: state.now + 1000, delays: 0 };
    player.targeting = false;
    blizCursor.visible = false;
    blizFx.g.position.copy(point);
    drape(blizFx.disc, point, blizRadius());
    for (const sh of blizFx.shards) resetShard(sh, true);
    blizFx.g.visible = blizFx.disc.visible = true;
    blizFx.cloud.scale.setScalar(blizRadius() / 8 * 0.2);
  },
  coc() {
    const s = SPELLS.coc;
    for (const m of mobsInRadius(player.pos, s.range)) {
      const angleToMob = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      const diff = Math.abs(Math.atan2(Math.sin(angleToMob - player.facing), Math.cos(angleToMob - player.facing)));
      if (diff > s.angle / 2) continue;
      if (damageMob(m, rand(s.min, s.max), 'coc') && !m.dead) applySlow(m, s.slow, s.slowDur);
    }
    coneOfColdFx(s.range, s.angle);
  },
  blink() {
    const from = player.pos.clone();
    player.pos.x += Math.sin(player.facing) * SPELLS.blink.dist;
    player.pos.z += Math.cos(player.facing) * SPELLS.blink.dist;
    collide(player.pos, 0.45);
    player.pos.y = heightAt(player.pos.x, player.pos.z);
    player.grounded = true;
    player.vel.set(0, 0, 0);
    blinkFx(from, player.pos);
  },
  drink() {
    player.drink = { start: state.now, end: state.now + SPELLS.drink.dur };
  },
};

// Stärkerer Slow gewinnt; abgelaufener Slow zählt nicht mehr
function applySlow(mob, pct, dur) {
  if (mob.slowUntil <= state.now) mob.slowPct = 0;
  mob.slowPct = Math.max(mob.slowPct, pct);
  mob.slowUntil = Math.max(mob.slowUntil, state.now + dur);
}

function updateChannel() {
  const ch = player.channel;
  if (!ch) return;
  while (ch.nextTick <= state.now && ch.nextTick <= ch.end) {
    ch.nextTick += 1000;
    for (const m of mobsInRadius(ch.point, blizRadius())) {
      if (damageMob(m, SPELLS.bliz.tick, 'bliz') && !m.dead && mods.blizSlow > 0) applySlow(m, mods.blizSlow, 1500);
    }
  }
  if (state.now >= ch.end) stopChannel();
}

function stopChannel() {
  player.channel = null;
  blizFx.g.visible = blizFx.disc.visible = false;
}
function stopDrink() {
  player.drink = null;
}

// Level-Up-Karten
function showCards() {
  state.paused = true;
  const available = CARDS.filter(c => (state.cardRanks[c.id] || 0) < c.max);
  const picks = available.sort(() => Math.random() - 0.5).slice(0, 3);
  $('cardLvl').textContent = String(player.level - state.pendingLevelUps + 1);
  $('cards').innerHTML = '';
  for (const c of picks) {
    const rank = state.cardRanks[c.id] || 0;
    const el = document.createElement('div');
    el.className = 'card frame';
    el.innerHTML = `<h3 class="title">${c.name}</h3>
      <div class="src">${c.verified ? 'Classic-Talent (Wert belegt)' : 'Prototyp-Upgrade'}</div>
      <p>${c.desc(rank)}</p><div class="rank">Rang ${rank + 1} / ${c.max}</div>`;
    el.addEventListener('click', () => pickCard(c));
    $('cards').appendChild(el);
  }
  $('cardModal').classList.add('show');
  ding();
}

function pickCard(card) {
  card.apply(state.cardRanks[card.id] || 0);
  state.cardRanks[card.id] = (state.cardRanks[card.id] || 0) + 1;
  state.pendingLevelUps--;
  player.hp = maxHp();                 // Ding füllt auf
  player.mana = maxMana();
  $('cardModal').classList.remove('show');
  if (state.pendingLevelUps > 0) showCards();
  else state.paused = false;
}

// Tastenbelegung-Menü
function openBinds() {
  state.paused = true;
  renderBinds();
  $('bindModal').classList.add('show');
}
function closeBinds() {
  state.rebinding = null;
  $('bindModal').classList.remove('show');
  state.paused = $('startModal').classList.contains('show') || $('cardModal').classList.contains('show') || player.dead;
}
function renderBinds() {
  const list = $('bindList');
  list.innerHTML = '';
  for (const a of ACTIONS) {
    if (a.group) { list.insertAdjacentHTML('beforeend', `<div class="group">${a.group}</div>`); continue; }
    const label = document.createElement('span');
    label.textContent = a.label;
    const btn = document.createElement('button');
    btn.className = 'bindBtn' + (state.rebinding === a.id ? ' waiting' : '');
    btn.textContent = state.rebinding === a.id ? 'Taste drücken …' : binds[a.id].key;
    btn.addEventListener('click', () => { state.rebinding = a.id; renderBinds(); });
    list.append(label, btn);
  }
}
function setBind(id, e) {
  const other = actionForCode(e.code);
  if (other && other !== id) binds[other] = { code: '', key: '–' };   // Doppelbelegung aufheben
  binds[id] = { code: e.code, key: keyName(e) };
  saveBinds();
  refreshKeyLabels();
}

// Ding-Sound
let audio;
function ding() {
  try {
    audio = audio || new AudioContext();
    const t = audio.currentTime;
    for (const [freq, delay] of [[784, 0], [1175, 0.12]]) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.9);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + delay); osc.stop(t + delay + 1);
    }
  } catch { /* kein Audio – egal */ }
}

export function pressSpell(id) {
  if (state.paused || player.dead) return;
  if (id === 'bliz') {                       // erst Zielmodus, Cast per Klick
    player.targeting = !player.targeting;
    blizCursor.visible = player.targeting;
    return;
  }
  cast(id);
}

addEventListener('keydown', e => {
  if (state.rebinding) {
    e.preventDefault();
    if (e.code !== 'Escape') setBind(state.rebinding, e);
    state.rebinding = null;
    renderBinds();
    return;
  }
  if (e.code === 'Escape') {
    if (player.targeting) { player.targeting = false; blizCursor.visible = false; }
    else if ($('bindModal').classList.contains('show')) closeBinds();
    else if (!state.paused) openBinds();
    return;
  }
  const id = actionForCode(e.code);
  if (id) e.preventDefault();
  held.add(e.code);
  if (e.repeat || !id) return;
  if (SPELLS[id]) pressSpell(id);
  if (id === 'jump') state.jumpQueued = true;
  if (id === 'autorun') state.autorun = !state.autorun;
  if (id === 'back' || id === 'forward') state.autorun = false;
});
addEventListener('keyup', e => held.delete(e.code));
addEventListener('blur', () => { held.clear(); mouseBtn.left = mouseBtn.right = false; });

const canvas = renderer.domElement;
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) mouseBtn.left = true;
  if (e.button === 2) {
    mouseBtn.right = true;
    player.facing += cam.offset;               // Charakter dreht sich in Kamerarichtung
    cam.offset = 0;
  }
  mouse.dragged = false;
  mouse.downX = e.clientX; mouse.downY = e.clientY;
});
addEventListener('mouseup', e => {
  const wasClick = !mouse.dragged;
  if (e.button === 0) mouseBtn.left = false;
  if (e.button === 2) mouseBtn.right = false;
  if (document.pointerLockElement && !mouseBtn.left && !mouseBtn.right) document.exitPointerLock();
  if (!wasClick || !player.targeting || e.target !== canvas) return;
  if (e.button === 0) cast('bliz', mouse.ground.clone());
  else { player.targeting = false; blizCursor.visible = false; }
});
addEventListener('mousemove', e => {
  if (mouseBtn.left || mouseBtn.right) {
    if (!mouse.dragged && Math.hypot(e.clientX - mouse.downX, e.clientY - mouse.downY) > 4) {
      mouse.dragged = true;
      try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* ohne Lock geht's auch */ }
    }
    if (mouse.dragged) {
      const yaw = -e.movementX * 0.005;
      if (mouseBtn.right) player.facing += yaw; else cam.offset += yaw;
      cam.pitch = clamp(cam.pitch + e.movementY * 0.004, -0.2, 1.35);
    }
  }
  if (!document.pointerLockElement) mouse.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 1.5, 3, 35); });
$('startBtn').addEventListener('click', () => { $('startModal').classList.remove('show'); state.paused = false; ding(); });
$('restartBtn').addEventListener('click', () => {
  $('deathModal').classList.remove('show');
  resetGame();
  state.paused = false;
});
$('bindsOpen').addEventListener('click', openBinds);
$('bindsClose').addEventListener('click', closeBinds);
$('bindsReset').addEventListener('click', () => { resetBinds(); saveBinds(); refreshKeyLabels(); renderBinds(); });

// Mauszeiger auf den Boden projizieren (Ray-Marching über die Höhenfunktion)
const raycaster = new THREE.Raycaster();
function pickGround() {
  raycaster.setFromCamera(mouse.ndc, camera);
  const { origin, direction } = raycaster.ray;
  const p = new THREE.Vector3();
  for (let t = 0; t < 150; t += 0.5) {
    p.copy(origin).addScaledVector(direction, t);
    if (p.y <= heightAt(p.x, p.z)) { mouse.ground.set(p.x, heightAt(p.x, p.z), p.z); return; }
  }
}

function update(dt) {
  updatePlayer(dt);
  for (const m of state.mobs) updateMob(m, dt);
  separateMobs();

  // Leichen nach 4 s entfernen, Packs nachspawnen
  state.mobs = state.mobs.filter(m => {
    if (m.dead && state.now - m.deathAt > 4000) { scene.remove(m.model.root); m.plate.remove(); return false; }
    return true;
  });
  const activePacks = new Set(state.mobs.filter(m => !m.dead).map(m => m.packId)).size;
  if (activePacks < CFG.packCount) spawnPack();
}

// Leiche versinkt nach 1,5 s im Boden, mit Staubwolke
function sinkCorpse(mob) {
  const t = clamp((state.now - mob.deathAt - 1500) / 2000, 0, 1);
  if (t > 0 && !mob.dusted) {
    mob.dusted = true;
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      particles.spawn({ x: mob.pos.x + Math.cos(a) * 0.6, y: mob.pos.y + 0.3, z: mob.pos.z + Math.sin(a) * 0.6,
        vx: Math.cos(a) * rand(0.5, 1.5), vy: rand(0.3, 1), vz: Math.sin(a) * rand(0.5, 1.5), drag: 1.5,
        life: rand(0.8, 1.4), color: [0.09, 0.07, 0.05], size: rand(1, 1.8), grow: 0.8 });
    }
  }
  mob.pos.y = heightAt(mob.pos.x, mob.pos.z) - t * 1.4;
}

function updateVisuals(dt) {
  updateCamera();
  if (player.targeting) pickGround();

  mage.root.position.copy(player.pos);
  mage.root.rotation.y = player.facing;
  const castT = clamp((player.castAnimUntil - state.now) / 450, 0, 1);
  mage.update(dt, {
    state: player.dead ? 'dead' : player.drink ? 'sit' : !player.grounded ? 'air' : player.moveState,
    speed: player.moveState === 'back' ? CFG.backSpeed : CFG.runSpeed,
    channel: !!player.channel, cast: Math.sin(castT * Math.PI),
  });

  for (const m of state.mobs) {
    const attackT = (state.now - m.attackAt) / 400;
    m.model.update(dt, {
      state: m.dead ? 'dead' : m.moving ? 'run' : 'idle', speed: m.speed || CFG.mobSpeed,
      frozen: !m.dead && m.rootUntil > state.now, slowed: m.slowUntil > state.now,
      attack: attackT >= 0 && attackT < 1 ? attackT : 0,
      flash: clamp(1 - (state.now - (m.hitAt ?? -1e9)) / 140, 0, 1),
    });
    if (m.dead) sinkCorpse(m);
  }

  if (player.targeting) {
    drape(blizCursor, mouse.ground, blizRadius());
    blizCursor.material.color.set(dist2d(player.pos, mouse.ground) <= SPELLS.bliz.range ? 0x7fd0ff : 0xff5050);
  }
  if (blizFx.g.visible) {
    const cl = blizFx.cloud;
    cl.rotation.y += dt / 1000 * 0.4;
    cl.scale.setScalar(lerpTo(cl.scale.x, blizRadius() / 8, Math.min(1, dt / 150)));   // Wolke baut sich auf
    for (const sh of blizFx.shards) {
      sh.position.y -= sh.userData.speed * (state.paused ? 0 : dt) / 1000;
      if (sh.position.y < 0) {
        const wx = blizFx.g.position.x + sh.position.x, wz = blizFx.g.position.z + sh.position.z;
        for (let i = 0; i < 3; i++) particles.spawn({ x: wx, y: heightAt(wx, wz) + 0.1, z: wz,
          vx: rand(-2, 2), vy: rand(1, 3), vz: rand(-2, 2), grav: 6, life: rand(0.2, 0.4), color: FROST_WHITE, size: rand(0.12, 0.25) });
        resetShard(sh, false);
      }
    }
  }
  ambientParticles(state.paused ? 0 : dt);
  particles.update(state.paused ? 0 : dt);
  updateEffects();
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(50, t - last);
  last = t;
  if (!state.paused) { state.now += dt; update(dt); }
  updateVisuals(dt);
  composer.render();
  updateHud();
  requestAnimationFrame(loop);
}

resetGame();
refreshKeyLabels();
requestAnimationFrame(loop);

// Für Tests
(window as any).__game = { player, get mobs() { return state.mobs; }, get mods() { return mods; }, cast, pressSpell, CFG, cam, binds: () => binds };
