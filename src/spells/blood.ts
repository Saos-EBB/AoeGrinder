// Blutmagier: Infekt (passiv), Blutpeitsche, Blutsprung, Saugen, Blutwelle, Verkleben, Blutlachen, Zerfließen. Zahlen in BLOOD (config.ts).
// Infekt: jeder Treffer eines Blut-Spells (Haken onBloodHit in core.ts) hängt 4 s an, höchstens 5 Stapel = 20 s.

import { rand, dist2d } from '../util';
import { state, player } from '../state';
import { BLOOD, SPELL_ACTIONS } from '../config';
import { maxHp, manaCost } from '../formulas';
import { burnMob, knockbackMob, pullMob, applyRoot, onMobDeath } from '../mobs';
import { particles } from '../fx/particles';
import { burnTex } from '../fx/spellFx';
import { shakeCamera } from '../camera';
import { showError, combatText } from '../ui/hud';
import { act } from '../input';
import { pad, padBinds } from '../gamepad';
import { randomMode, modValue } from '../modifiers';
import { forward, mobsOnLine } from '../melee';
import { blinkTo } from './blink';
import { spendMana } from '../player';
import { mobsInRadius, addField, applySlow, startChannel, makeCtx, onBloodHit, cdEnd, startCd, noteCastStart, stopChannel, stopDrink, paysLife } from './core';
import { boltFx, burstFx, fieldDecal, areaParticles } from './fx';

const B = BLOOD, I = B.infect;
const RED = [1.3, 0.05, 0.08], DARK = [0.5, 0.02, 0.04];

// ---------- Infekt ----------
export const infectStacks = m => m.infect && m.infect.until > state.now ? Math.min(I.maxStacks, Math.ceil((m.infect.until - state.now) / I.stackMs)) : 0;
export function infect(m, n = 1) {
  if (m.dead) return;
  const fresh = !infectStacks(m), left = fresh ? 0 : m.infect.until - state.now;
  m.infect = { until: state.now + Math.min(I.maxStacks * I.stackMs, left + n * I.stackMs), next: fresh ? state.now + I.tickMs : m.infect.next };
}
onBloodHit(m => infect(m));
// Ein infizierter Mob stirbt: Blutlache
onMobDeath(m => { if (infectStacks(m)) spawnPool(m.pos.clone()); });

// ---------- Blutlachen: höchstens BLOOD.pool.max gleichzeitig, die älteste geht ----------
let pools = [];
function spawnPool(pos) {
  const P = B.pool, c = makeCtx('bjump');
  pools = pools.filter(f => state.fields.includes(f));
  while (pools.length >= P.max) { pools.shift().end = state.now; }
  pools.push(addField(c, { pos, radius: P.radius, dur: P.ms, visual: fieldDecal(burnTex, RED, 0.45, 0.1),
    onTick(f) {
      for (const m of mobsInRadius(f.pos, f.radius)) { applySlow(m, P.slow, 1200); c.hit(m, P.dmg); }
      if (dist2d(player.pos, f.pos) <= f.radius) heal(maxHp() * P.healPct);
    },
    onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 6, dt, [RED, DARK], { up: 0.6, size: 0.25 }),
  }));
}
const heal = v => { if (!player.dead) player.hp = Math.min(maxHp(), player.hp + v); };

// ---------- Blutsprung: Halten lädt, Loslassen springt. Im ?-Magier ohne Halten mit fester Weite ----------
const held = id => { const a = SPELL_ACTIONS[state.slots.indexOf(id)]; return !!a && (act(a) || !!pad.down[padBinds[a]]); };
const leap = { charge: null, flight: null };
function startLeap(yd) {
  const from = player.pos.clone(), f = forward();
  blinkTo(from.x + f.x * yd, from.z + f.z * yd);            // gleiche Regeln wie Blink: stoppt vor Wänden
  const to = player.pos.clone();
  player.pos.copy(from);
  leap.flight = { from, to, start: state.now, end: state.now + B.jump.flightMs };
  player.invulnUntil = Math.max(player.invulnUntil ?? 0, leap.flight.end);   // in der Luft nicht angreifbar
}
function payAndStart(id) {
  const cost = manaCost(id);
  if (paysLife(id)) { if (player.hp <= cost) { showError('Nicht genug Leben'); return false; } player.hp -= cost; }
  else { if (player.mana < cost) { showError('Nicht genug Mana'); return false; } spendMana(cost); }
  startCd(id);
  noteCastStart(id);
  return true;
}
function land() {
  const fl = leap.flight, c = makeCtx('bjump'), r = c.radius(B.jump.radius);
  leap.flight = null;
  player.pos.copy(fl.to);
  for (const m of mobsInRadius(player.pos, r)) if (c.hit(m, rand(B.jump.min, B.jump.max)) && !m.dead) knockbackMob(m, player.pos, B.jump.knock);
  splash(player.pos, r);
  spawnPool(player.pos.clone());
  shakeCamera(0.25);
}
function splash(pos, r) {
  burstFx(pos, r, [RED, DARK], 0xa01020);
  for (let i = 0; i < 60; i++) { const a = rand(0, Math.PI * 2), v = rand(3, 8); particles.spawn({ x: pos.x, y: pos.y + 0.3, z: pos.z, vx: Math.cos(a) * v, vy: rand(2, 6), vz: Math.sin(a) * v, grav: 14, drag: 0.8, life: rand(0.4, 0.8), color: i % 2 ? RED : DARK, size: rand(0.25, 0.5) }); }
}
// Laden 0 … 1 für die Figur (Feder), in der Luft gestreckt
export const leapCharge = () => leap.charge ? Math.min(1, (state.now - leap.charge.start) / B.jump.maxMs) : 0;
export const leapAir = () => !!leap.flight;
export const bloodMoveMul = () => leap.charge ? B.jump.chargeMove : 1;

// ---------- Zerfließen ----------
const liquid = { start: -1e9, end: -1e9 };
// Figur 0 … 1: sackt in 0,6 s zusammen, schnellt am Ende in 0,3 s hoch
export function meltScale() {
  const t = state.now;
  if (t >= liquid.end + 300 || t < liquid.start) return 1;
  if (t >= liquid.end) return 0.1 + 0.9 * (t - liquid.end) / 300;
  return Math.max(0.1, 1 - (t - liquid.start) / 600 * 0.9);
}

// Jeden Frame aus updatePlayer: Infekt-Ticks, Laden, Flug, Tropfen
let dropAt = 0;
export function updateBlood() {
  if (modValue('lifeCost')) player.resLabel = 'Kein Mana · Zauber kosten Leben';
  for (const m of state.mobs) {
    if (m.dead || !m.infect || m.infect.until <= state.now || state.now < m.infect.next) continue;
    m.infect.next += I.tickMs;
    const v = Math.max(1, Math.round(m.maxHp * I.pctPerStack * infectStacks(m)));
    burnMob(m, v);
    heal(v);
  }
  if (state.now >= dropAt) {                     // Tropfen an Infizierten, gedrosselt
    dropAt = state.now + 120;
    for (const m of state.mobs) if (!m.dead && !m.hidden && infectStacks(m) && Math.random() < 0.3) particles.spawn({ x: m.pos.x + rand(-0.3, 0.3), y: m.pos.y + rand(0.8, 1.6), z: m.pos.z + rand(-0.3, 0.3), vy: -1, grav: 9, life: 0.5, color: RED, size: 0.18 });
  }
  if (leap.charge && !leap.flight) {
    const ms = state.now - leap.charge.start;
    if (!held('bjump') || ms >= B.jump.autoMs || player.dead) {
      leap.charge = null;
      const k = Math.min(1, Math.max(0, (ms - B.jump.minMs) / (B.jump.maxMs - B.jump.minMs)));
      if (payAndStart('bjump')) startLeap(B.jump.minYd + (B.jump.maxYd - B.jump.minYd) * k);
    }
  }
  if (leap.flight) {
    const fl = leap.flight, t = Math.min(1, (state.now - fl.start) / (fl.end - fl.start));
    player.pos.lerpVectors(fl.from, fl.to, t);
    player.pos.y += 4 * B.jump.height * t * (1 - t);
    player.vel.set(0, 0, 0);
    if (t >= 1) land();
  }
  if (liquid.end > state.now) player.vel.set(0, 0, 0);
}
export function resetBlood() { leap.charge = null; leap.flight = null; liquid.start = liquid.end = -1e9; pools = []; player.meltUntil = 0; }
export const bloodRooted = () => !!leap.flight || liquid.end > state.now;

// ---------- Spells ----------
export const bwhip = {
  name: 'Blutpeitsche', desc: 'Kegel 6 yd vor dir, legt Infekt.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blut', 'Fläche'], cls: 'blood',
  mana: 60, lifePct: 0.02, cd: 0, min: B.whip.min, max: B.whip.max,   // PH
  effect(c) {
    const r = c.radius(B.whip.range), f = player.facing;
    for (const m of mobsInRadius(player.pos, r)) {
      const a = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z), d = Math.abs(Math.atan2(Math.sin(a - f), Math.cos(a - f)));
      if (d <= B.whip.halfAngle) c.hit(m, rand(bwhip.min, bwhip.max));
    }
    for (let i = 0; i < 40; i++) { const a = f + rand(-B.whip.halfAngle, B.whip.halfAngle), v = rand(5, 12); particles.spawn({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z, vx: Math.sin(a) * v, vy: rand(-1, 1), vz: Math.cos(a) * v, drag: 3, life: rand(0.3, 0.5), color: RED, size: rand(0.25, 0.45) }); }
  },
};

export const bjump = {
  name: 'Blutsprung', desc: 'Halten lädt (0,2 s → 6 yd bis 1,2 s → 18 yd), Loslassen springt. Landung: Schaden in 4 yd, Rückstoß, Infekt, Blutlache. In der Luft nicht angreifbar.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blut', 'Bewegung', 'Fläche'], cls: 'blood',
  mana: 90, lifePct: 0.04, cd: 8000, min: B.jump.min, max: B.jump.max,   // PH
  press() {
    if (leap.charge || leap.flight) return;
    if (cdEnd('bjump') > state.now) return showError('Fähigkeit ist noch nicht bereit');
    stopChannel(true); stopDrink();
    if (randomMode()) { if (payAndStart('bjump')) startLeap(B.jump.randomYd); return; }   // ?-Magier: Taste würfelt, kein Halten
    leap.charge = { start: state.now };
  },
};

export const siphon = {
  name: 'Saugen', desc: 'Kanal 3 s: Blutfäden zu allen Gegnern in 6 yd, alle 0,5 s Schaden, Heilung und Infekt. Laufen bricht ab.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blut', 'Kanal', 'Heilung'], cls: 'blood',
  mana: 140, lifePct: 0.05, cd: 6000, channel: 3000, dmg: B.siphon.dmg,   // PH
  effect(c) {
    const ch = startChannel(c, player.pos, siphon.channel);
    ch.nextTick = Infinity;   // eigener Takt
    ch.nextSuck = state.now + B.siphon.everyMs;
  },
  tick() {},
  channelUpdate(ch) {
    while (ch.nextSuck <= state.now && ch.nextSuck <= ch.end) {
      ch.nextSuck += B.siphon.everyMs;
      for (const m of mobsInRadius(player.pos, ch.c.radius(B.siphon.radius))) {
        boltFx(m.pos, player.pos, RED, 160);
        if (ch.c.hit(m, siphon.dmg)) heal(maxHp() * B.siphon.healPct);
      }
    }
  },
};

export const bwave = {
  name: 'Blutwelle', desc: 'Welle 12 yd nach vorn, 6 yd breit, schiebt Gegner 5 yd weg, Infekt.', ranks: ['dmg', 'mana', 'radius'], tags: ['Blut', 'Fläche', 'Kontrolle'], cls: 'blood',
  mana: 110, lifePct: 0.04, cd: 5000, min: B.wave.min, max: B.wave.max,   // PH
  effect(c) {
    const f = forward(), a = player.pos.clone(), len = c.radius(B.wave.length), b = { x: a.x + f.x * len, y: a.y, z: a.z + f.z * len };
    for (const m of mobsOnLine(a, b, c.radius(B.wave.width))) if (c.hit(m, rand(bwave.min, bwave.max)) && !m.dead) knockbackMob(m, player.pos, B.wave.push);
    for (let i = 0; i < 120; i++) { const t = Math.random(), s = rand(-0.5, 0.5) * B.wave.width; particles.spawn({ x: a.x + f.x * len * t + f.z * s, y: a.y + 0.3, z: a.z + f.z * len * t - f.x * s, vx: f.x * 8, vy: rand(1, 3), vz: f.z * 8, grav: 6, drag: 1.5, life: rand(0.4, 0.8), color: i % 3 ? RED : DARK, size: rand(0.3, 0.6) }); }
  },
};

export const glue = {
  name: 'Verkleben', desc: 'Nur infizierte Gegner in 15 yd: werden zur Mitte ihres Klumpens gezogen und kleben 2 s fest.', ranks: ['mana', 'radius'], tags: ['Blut', 'Kontrolle'], cls: 'blood',
  mana: 100, lifePct: 0.03, cd: 10000,   // PH
  canCast: () => mobsInRadius(player.pos, B.glue.range, Infinity).some(m => infectStacks(m)) ? null : 'Kein infizierter Gegner in der Nähe',
  effect(c) {
    const list = mobsInRadius(player.pos, c.radius(B.glue.range), Infinity).filter(m => infectStacks(m));
    if (!list.length) return;
    // Klumpen: der infizierte Mob mit den meisten infizierten Nachbarn in 5 yd, Mitte = Schwerpunkt dieser Nachbarn
    const near = m => list.filter(o => dist2d(o.pos, m.pos) <= 5);
    const core = list.reduce((best, m) => near(m).length > near(best).length ? m : best, list[0]), group = near(core);
    const center = group.reduce((p, m) => p.add(m.pos), core.pos.clone().multiplyScalar(0)).multiplyScalar(1 / group.length);
    for (const m of list) { boltFx(m.pos, center, RED, 200); pullMob(m, center, dist2d(m.pos, center)); applyRoot(m, B.glue.rootMs); }
    burstFx(center, 3, [RED, DARK], 0xa01020);
  },
};

export const melt = {
  name: 'Zerfließen', desc: 'Du zerfließt 3 s zu einer Lache bis 15 yd (nicht angreifbar, kein Zaubern, Infekt darin). Dann reißt das Blut alle darin zur Mitte und betäubt sie 2 s.', ranks: ['mana', 'radius'], tags: ['Blut', 'Fläche', 'Kontrolle'], cls: 'blood',
  mana: 300, lifePct: 0.1, cd: 45000,   // PH
  effect(c) {
    const M = B.melt, pos = player.pos.clone(), R = c.radius(M.radius);
    liquid.start = state.now; liquid.end = state.now + M.ms;
    player.meltUntil = liquid.end;
    player.invulnUntil = Math.max(player.invulnUntil ?? 0, liquid.end);
    stopChannel(true); stopDrink();
    addField(c, { pos, radius: 0.5, dur: M.ms, tickMs: M.tickMs, visual: fieldDecal(burnTex, RED, 0.55, 0.4),
      onUpdate(f, dt) { f.radius = Math.max(0.5, R * (state.now - f.start) / M.ms); areaParticles(f.pos, f.radius, 40, dt, [RED, DARK], { up: 0.8, size: 0.3 }); },
      onTick(f) { for (const m of mobsInRadius(f.pos, f.radius)) infect(m); },
      onEnd(f) {
        for (const m of mobsInRadius(f.pos, R)) { pullMob(m, f.pos, dist2d(m.pos, f.pos)); applyRoot(m, M.rootMs); }
        splash(f.pos, 4);
        shakeCamera(0.5);
        combatText(player.pos, 'Zerfließen', 'heal', 2.8);
      },
    });
  },
};
