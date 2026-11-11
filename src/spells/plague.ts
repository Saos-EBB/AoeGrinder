// Seuchenmagier (v31, ersetzt den Blutmagier): Male, Gift, Zerfließen und die Seuchen-Spells. Zahlen in PLAGUE (config.ts).
// Male legen Schlammwurf, Schleimfalle, Schleimwelle und Giftwolke. Zusammenziehen, Entziehen und Platzen verbrauchen sie, Wirkung ×Stapel.

import { dist2d } from '../util';
import { state, player } from '../state';
import { PLAGUE as P, UNIT, mods } from '../config';
import { maxHp } from '../formulas';
import { burnMob, knockbackMob, pullMob, applyRoot, startLeap } from '../mobs';
import { particles } from '../fx/particles';
import { shakeCamera } from '../camera';
import { showError, combatText } from '../feedback';
import { modValue } from '../modifiers';
import { forward, mobsOnLine } from '../melee';
import { mobsInRadius, addField, makeCtx, cdEnd, startCd, noteCastStart, stopChannel, stopDrink } from './core';
import { nearestTarget } from './target';
import { zapLook } from '../vfx/boltLook';
import { sludgeLook, slimeTrapField, slimeWaveLook, blackHoleField, holeImpact, poisonCloudField, webLook, contractLook, drainLook, burstLook, meltField, pestilenceLook } from '../vfx/plagueLook';
import { mark, markStacks, popMark, poison, poisoned } from '../plagueMarks';
import { t } from '../i18n';
import { onMobDeath, onAnyHit } from '../hooks';

const GREEN = [0.5, 1.6, 0.25], SICK = [0.25, 0.5, 0.08], DARK = [0.15, 0.08, 0.2];
const heal = v => { if (!player.dead) player.hp = Math.min(maxHp(), player.hp + v); };
const marked = r => mobsInRadius(player.pos, r, Infinity).filter(m => markStacks(m));
const spray = (pos, n = 30) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 5; particles.spawn({ x: pos.x, y: pos.y + 0.5, z: pos.z, vx: Math.cos(a) * v, vy: 1 + Math.random() * 3, vz: Math.sin(a) * v, grav: 10, life: 0.6, color: i % 2 ? GREEN : SICK, size: 0.3 + Math.random() * 0.3 }); } };

// ---------- Gift: Ticks, Ansteckung beim Tod ----------
onMobDeath(m => {
  if (!poisoned(m) || !mods.contagion) return;
  const left = m.poison.dps * (m.poison.until - state.now) / 1000;
  const next = mobsInRadius(m.pos, 8, Infinity).filter(o => o !== m && !poisoned(o)).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos)).slice(0, mods.contagion);
  for (const o of next) { zapLook(m.pos, o.pos, 'slime'); poison(o, left); }
});
// Klebefaden: Schaden geht zu share auf die Angeketteten über (burnMob löst keine Treffer-Haken aus, also keine Schleife)
onAnyHit((m, id, dmg) => {
  if (!m.web || m.web.until <= state.now) return;
  for (const o of m.web.links) if (!o.dead) burnMob(o, Math.max(1, Math.round(dmg * P.web.share)));
});

// ---------- Zerfließen (Bewegung) ----------
const liquid = { start: -1e9, end: -1e9 };
export function meltScale() {
  const t = state.now;
  if (t >= liquid.end + 300 || t < liquid.start) return 1;
  if (t >= liquid.end) return 0.1 + 0.9 * (t - liquid.end) / 300;
  return Math.max(0.1, 1 - (t - liquid.start) / 600 * 0.9);
}
export const plagueRooted = () => liquid.end > state.now;
export function resetPlague() { liquid.start = liquid.end = -1e9; player.meltUntil = 0; }

// Jeden Frame aus updatePlayer: Gift-Ticks
export function updatePlague() {
  if (modValue('lifeCost')) player.resLabel = t('plague.label');
  for (const m of state.mobs) {
    if (m.dead || !poisoned(m) || state.now < m.poison.next) continue;
    m.poison.next += m.poison.step ?? 1000;
    burnMob(m, Math.max(1, Math.round(m.poison.dps)));
  }
  if (liquid.end > state.now) player.vel.set(0, 0, 0);
}

// ---------- Verbraucher, auch für Pestilenz (keep: Male bleiben) ----------
const rootMs = stacks => (P.contract.rootMs + 1000 * mods.toughSlime) * stacks;
function contractAll(c, list, keep = false) {
  if (!list.length) return;
  const center = list.reduce((p, m) => p.add(m.pos), list[0].pos.clone().multiplyScalar(0)).multiplyScalar(1 / list.length);
  contractLook(list.map(m => m.pos.clone()), center);
  for (const m of list) { const n = markStacks(m); pullMob(m, center, dist2d(m.pos, center)); applyRoot(m, rootMs(n), 'glue'); if (!keep) popMark(m); }
}
const drainDmg = n => P.drain.dmg * UNIT * n;
function drainAll(c, list, keep = false) {
  drainLook(list.map(m => m.pos.clone()), list.map(m => markStacks(m)));
  for (const m of list) {
    const n = markStacks(m);
    if (c.hit(m, drainDmg(n))) heal(maxHp() * (P.drain.heal + mods.leech));
    if (!keep) popMark(m);
  }
}
function burstAll(c, list, keep = false) {
  for (const m of list) {
    const n = markStacks(m);
    poison(m, drainDmg(n) * c.scaleOut() * (1 + mods.burstDmg), P.burst.ms, 1000 / (1 + mods.burstTick));   // Gift in Höhe des Entziehen-Schadens, verteilt auf 12 s; Set Pestbringer: stärker, tickt schneller
    burstLook(m.pos, n, list.indexOf(m) * .07);
    if (!keep) popMark(m);
  }
}
// Schaden, den ein Treffer dieses Kontexts ungefähr machen würde (ohne Wurf und Rüstung): fürs Gift
function withScale(c) { c.scaleOut = () => 1; return c; }

const spell = (o) => ({ ranks: ['dmg', 'radius'], tags: ['Seuche', ...(o.tags ?? [])], cls: 'nature', ...o });

export const sludge = spell({
  name: t('spell.sludge.name'), desc: t('spell.sludge.desc'), tags: ['Geschoss'],
  lifePct: 0.01, mana: 40, cd: 0, range: P.sludge.range, showDmg: P.sludge.dmg * UNIT,
  canCast: () => nearestTarget(P.sludge.range) ? null : t('msg.noTarget'),
  effect(c) {
    const t = nearestTarget(P.sludge.range);
    if (!t) return;
    sludgeLook(t.pos, c.radius(P.sludge.radius));
    for (const m of mobsInRadius(t.pos, c.radius(P.sludge.radius))) if (c.hit(m, P.sludge.dmg * UNIT) && !m.dead) mark(m);
  },
});

export const slimetrap = spell({
  name: t('spell.slimetrap.name'), desc: t('spell.slimetrap.desc'), tags: ['Fläche', 'Kontrolle'],
  lifePct: 0.02, mana: 80, cd: 8000, range: P.trap.range, radius: P.trap.radius, ground: true,
  effect(c, point) {
    const seen = new Set();
    addField(c, { pos: point, radius: c.radius(P.trap.radius), dur: P.trap.ms, tickMs: 250, visual: slimeTrapField(),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) { if (seen.has(m)) continue; seen.add(m); applyRoot(m, P.trap.rootMs + 1000 * mods.toughSlime, 'glue'); mark(m); } },
    });
  },
});

export const slimewave = spell({
  name: t('spell.slimewave.name'), desc: t('spell.slimewave.desc'), tags: ['Fläche', 'Kontrolle'],
  lifePct: 0.03, mana: 110, cd: 6000, showDmg: P.wave.dmg * UNIT,
  effect(c) {
    const f = forward(), a = player.pos.clone(), len = c.radius(P.wave.length), b = { x: a.x + f.x * len, y: a.y, z: a.z + f.z * len };
    for (const m of mobsOnLine(a, b, c.radius(P.wave.width))) {
      if (!c.hit(m, P.wave.dmg * UNIT) || m.dead) continue;
      knockbackMob(m, player.pos, P.wave.push);
      applyRoot(m, P.wave.rootMs + 1000 * mods.toughSlime, 'glue');
      mark(m);
    }
    slimeWaveLook(a, len, c.radius(P.wave.width));
  },
});

export const blackhole = spell({
  name: t('spell.blackhole.name'), desc: t('spell.blackhole.desc'), tags: ['Fläche', 'Kontrolle'],
  lifePct: 0.05, mana: 200, cd: 20000, range: P.hole.range, radius: P.hole.radius, ground: true, showDmg: P.hole.dmg * UNIT,
  effect(c, point) {
    const caught = new Set<any>();
    addField(c, { pos: point, radius: c.radius(P.hole.radius), dur: P.hole.ms, visual: blackHoleField(),
      onUpdate(f, dt) {
        for (const m of mobsInRadius(f.pos, f.radius)) { caught.add(m); pullMob(m, f.pos, P.hole.pull * dt / 1000); }
      },
      onEnd(f) {
        const list = [...caught].filter(m => !m.dead);
        const target = state.mobs.filter(m => !m.dead && !caught.has(m) && dist2d(m.pos, f.pos) <= P.hole.fling).sort((a, b) => dist2d(a.pos, f.pos) - dist2d(b.pos, f.pos))[0];
        const to = target ? target.pos.clone() : f.pos.clone();
        let landed = false;
        const impact = () => {
          if (landed) return;
          landed = true;
          for (const m of mobsInRadius(to, c.radius(P.hole.impact))) c.hit(m, P.hole.dmg * UNIT * (1 + mods.wreckingBall));
          holeImpact(to, c.radius(P.hole.impact));
          shakeCamera(0.35);
        };
        for (const m of list) startLeap(m, to.clone().setX(to.x + (Math.random() - 0.5) * 2), P.hole.flightMs, impact);
        if (!list.length) impact();
      },
    });
  },
});

export const poisoncloud = spell({
  name: t('spell.poisoncloud.name'), desc: t('spell.poisoncloud.desc'), tags: ['Fläche'],
  lifePct: 0.03, mana: 120, cd: 10000, range: P.cloud.range, radius: P.cloud.radius, ground: true, showDmg: P.cloud.dps * UNIT,
  effect(c, point) {
    addField(c, { pos: point, radius: c.radius(P.cloud.radius), dur: P.cloud.ms, visual: poisonCloudField(),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) if (c.hit(m, P.cloud.dps * UNIT) && !m.dead) mark(m); },
    });
  },
});

export const web = spell({
  name: t('spell.web.name'), desc: t('spell.web.desc'), tags: ['Fläche', 'Kontrolle'],
  lifePct: 0.04, mana: 150, cd: 30000, range: P.web.range, radius: P.web.radius, ground: true,
  effect(c, point) {
    const list = mobsInRadius(point, c.radius(P.web.radius));
    for (const m of list) {
      const links = list.filter(o => o !== m).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos)).slice(0, P.web.links);
      m.web = { links, until: state.now + P.web.ms };
    }
    const pairs = list.flatMap(m => m.web.links.filter(o => list.indexOf(o) > list.indexOf(m) || !o.web?.links.includes(m)).map(o => [m, o] as [any, any]));
    webLook(pairs, P.web.ms);
  },
});

export const contract = spell({
  name: t('spell.contract.name'), desc: t('spell.contract.desc'), tags: ['Kontrolle'],
  lifePct: 0.03, mana: 100, cd: 10000,
  canCast: () => marked(P.contract.radius).length ? null : t('msg.noMarked'),
  effect(c) { contractAll(c, marked(c.radius(P.contract.radius))); },
});

export const drain = spell({
  name: t('spell.drain.name'), desc: t('spell.drain.desc'), tags: ['Heilung'],
  lifePct: 0.02, mana: 90, cd: 6000, showDmg: P.drain.dmg * UNIT,
  canCast: () => marked(P.drain.radius).length ? null : t('msg.noMarked'),
  effect(c) { drainAll(c, marked(c.radius(P.drain.radius))); },
});

export const burst = spell({
  name: t('spell.burst.name'), desc: t('spell.burst.desc'),
  lifePct: 0.02, mana: 90, cd: 6000, showDmg: P.drain.dmg * UNIT,
  canCast: () => marked(P.burst.radius).length ? null : t('msg.noMarked'),
  effect(c) { burstAll(withScale(c), marked(c.radius(P.burst.radius))); },
});

export const melt = spell({
  name: t('spell.melt.name'), desc: t('spell.melt.desc'), tags: ['Bewegung', 'Fläche', 'Kontrolle'],
  lifePct: 0.1, mana: 300, cd: 45000, ranks: ['mana', 'radius'],
  effect(c) {
    const M = P.melt, pos = player.pos.clone(), R = c.radius(M.radius);
    liquid.start = state.now; liquid.end = state.now + M.ms;
    player.meltUntil = liquid.end;
    player.invulnUntil = Math.max(player.invulnUntil ?? 0, liquid.end);
    stopChannel(true); stopDrink();
    addField(c, { pos, radius: 0.5, dur: M.ms, tickMs: M.tickMs, visual: meltField(),
      onUpdate(f) { f.radius = Math.max(0.5, R * (state.now - f.start) / M.ms); },
      onTick(f) { for (const m of mobsInRadius(f.pos, f.radius)) mark(m); },
      onEnd(f) {
        for (const m of mobsInRadius(f.pos, R)) { pullMob(m, f.pos, dist2d(m.pos, f.pos)); applyRoot(m, M.rootMs, 'glue'); }
        spray(f.pos, 50);
        shakeCamera(0.5);
        combatText(player.pos, t('spell.melt.name'), 'heal', 2.8);
      },
    });
  },
});

// Relikt Pestilenz: alle Male im Umkreis platzen, ziehen zusammen und entziehen gleichzeitig, ohne sich zu verbrauchen
export const pestilence = {
  name: t('spell.pestilence.name'), figRelic: true, desc: t('spell.pestilence.desc'), ranks: [], tags: ['Seuche'], cls: 'nature',
  mana: 0, cd: P.pestilence.cd,
  press() {
    if (cdEnd('pestilence') > state.now) return showError(t('msg.notReady'));
    const list = marked(P.pestilence.radius);
    if (!list.length) return showError(t('msg.noMarked'));
    startCd('pestilence');
    noteCastStart('pestilence');
    const c = withScale(makeCtx('pestilence'));
    burstAll(c, list, true);
    drainAll(c, list, true);
    contractAll(c, list, true);
    pestilenceLook(P.pestilence.radius);
    combatText(player.pos, t('spell.pestilence.name'), 'info', 3);
  },
};
