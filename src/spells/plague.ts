// Seuchenmagier (v31, ersetzt den Blutmagier): Male, Gift, Zerfließen und die Seuchen-Spells. Zahlen in PLAGUE (config.ts).
// Male legen Schlammwurf, Schleimfalle, Schleimwelle und Giftwolke. Zusammenziehen, Entziehen und Platzen verbrauchen sie, Wirkung ×Stapel.

import { dist2d } from '../util';
import { state, player } from '../state';
import { PLAGUE as P, UNIT, mods } from '../config';
import { maxHp } from '../formulas';
import { burnMob, knockbackMob, pullMob, applyRoot, onMobDeath, startLeap } from '../mobs';
import { particles } from '../fx/particles';
import { blightTex, voidTex } from '../fx/spellFx';
import { shakeCamera } from '../camera';
import { showError, combatText } from '../ui/hud';
import { modValue } from '../modifiers';
import { forward, mobsOnLine } from '../melee';
import { mobsInRadius, addField, makeCtx, cdEnd, startCd, noteCastStart, stopChannel, stopDrink, onAnyHit } from './core';
import { nearestTarget } from './target';
import { boltFx, burstFx, fieldDecal, areaParticles } from './fx';
import { mark, markStacks, clearMark, poison, poisoned } from '../plagueMarks';

const GREEN = [0.5, 1.6, 0.25], SICK = [0.25, 0.5, 0.08], DARK = [0.15, 0.08, 0.2];
const heal = v => { if (!player.dead) player.hp = Math.min(maxHp(), player.hp + v); };
const marked = r => mobsInRadius(player.pos, r, Infinity).filter(m => markStacks(m));
const spray = (pos, n = 30) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 5; particles.spawn({ x: pos.x, y: pos.y + 0.5, z: pos.z, vx: Math.cos(a) * v, vy: 1 + Math.random() * 3, vz: Math.sin(a) * v, grav: 10, life: 0.6, color: i % 2 ? GREEN : SICK, size: 0.3 + Math.random() * 0.3 }); } };

// ---------- Gift: Ticks, Ansteckung beim Tod ----------
onMobDeath(m => {
  if (!poisoned(m) || !mods.contagion) return;
  const left = m.poison.dps * (m.poison.until - state.now) / 1000;
  const next = mobsInRadius(m.pos, 8, Infinity).filter(o => o !== m && !poisoned(o)).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos)).slice(0, mods.contagion);
  for (const o of next) { boltFx(m.pos, o.pos, GREEN, 200); poison(o, left); }
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
  if (modValue('lifeCost')) player.resLabel = 'Kein Mana · Zauber kosten Leben';
  for (const m of state.mobs) {
    if (m.dead || !poisoned(m) || state.now < m.poison.next) continue;
    m.poison.next += 1000;
    burnMob(m, Math.max(1, Math.round(m.poison.dps)));
  }
  if (liquid.end > state.now) player.vel.set(0, 0, 0);
}

// ---------- Verbraucher, auch für Pestilenz (keep: Male bleiben) ----------
const rootMs = stacks => (P.contract.rootMs + 1000 * mods.toughSlime) * stacks;
function contractAll(c, list, keep = false) {
  if (!list.length) return;
  const center = list.reduce((p, m) => p.add(m.pos), list[0].pos.clone().multiplyScalar(0)).multiplyScalar(1 / list.length);
  for (const m of list) { const n = markStacks(m); boltFx(m.pos, center, GREEN, 220); pullMob(m, center, dist2d(m.pos, center)); applyRoot(m, rootMs(n), 'glue'); if (!keep) clearMark(m); }
  burstFx(center, 3, [GREEN, SICK], 0x60c020);
}
const drainDmg = n => P.drain.dmg * UNIT * n;
function drainAll(c, list, keep = false) {
  for (const m of list) {
    const n = markStacks(m);
    boltFx(m.pos, player.pos, GREEN, 180);
    if (c.hit(m, drainDmg(n))) heal(maxHp() * (P.drain.heal + mods.leech));
    if (!keep) clearMark(m);
  }
}
function burstAll(c, list, keep = false) {
  for (const m of list) {
    const n = markStacks(m);
    poison(m, drainDmg(n) * c.scaleOut());   // Gift in Höhe des Entziehen-Schadens, verteilt auf 12 s
    spray(m.pos, 10);
    if (!keep) clearMark(m);
  }
}
// Schaden, den ein Treffer dieses Kontexts ungefähr machen würde (ohne Wurf und Rüstung): fürs Gift
function withScale(c) { c.scaleOut = () => 1; return c; }

const spell = (o) => ({ ranks: ['dmg', 'radius'], tags: ['Seuche', ...(o.tags ?? [])], cls: 'nature', ...o });

export const sludge = spell({
  name: 'Schlammwurf', desc: 'Wirft ein Stück von sich selbst aufs nächste Ziel: 1 Einheit, Explosion 2 yd, markiert.', tags: ['Geschoss'],
  lifePct: 0.01, mana: 40, cd: 0, range: P.sludge.range, showDmg: P.sludge.dmg * UNIT,
  canCast: () => nearestTarget(P.sludge.range) ? null : 'Kein Ziel in Reichweite',
  effect(c) {
    const t = nearestTarget(P.sludge.range);
    if (!t) return;
    boltFx({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z }, t.pos, GREEN, 200);
    for (const m of mobsInRadius(t.pos, c.radius(P.sludge.radius))) if (c.hit(m, P.sludge.dmg * UNIT) && !m.dead) mark(m);
    spray(t.pos, 16);
  },
});

export const slimetrap = spell({
  name: 'Schleimfalle', desc: 'Bodenziel: Falle 4 yd, klebt 2 s fest, markiert.', tags: ['Fläche', 'Kontrolle'],
  lifePct: 0.02, mana: 80, cd: 8000, range: P.trap.range, radius: P.trap.radius, ground: true,
  effect(c, point) {
    const seen = new Set();
    addField(c, { pos: point, radius: c.radius(P.trap.radius), dur: P.trap.ms, tickMs: 250, visual: fieldDecal(blightTex, GREEN, 0.5, 0.05),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) { if (seen.has(m)) continue; seen.add(m); applyRoot(m, P.trap.rootMs + 1000 * mods.toughSlime, 'glue'); mark(m); } },
    });
  },
});

export const slimewave = spell({
  name: 'Schleimwelle', desc: 'Welle 12 yd nach vorn, 6 yd breit, schiebt Gegner 5 yd weg, klebt 1 s fest, markiert.', tags: ['Fläche', 'Kontrolle'],
  lifePct: 0.03, mana: 110, cd: 6000, showDmg: P.wave.dmg * UNIT,
  effect(c) {
    const f = forward(), a = player.pos.clone(), len = c.radius(P.wave.length), b = { x: a.x + f.x * len, y: a.y, z: a.z + f.z * len };
    for (const m of mobsOnLine(a, b, c.radius(P.wave.width))) {
      if (!c.hit(m, P.wave.dmg * UNIT) || m.dead) continue;
      knockbackMob(m, player.pos, P.wave.push);
      applyRoot(m, P.wave.rootMs + 1000 * mods.toughSlime, 'glue');
      mark(m);
    }
    for (let i = 0; i < 100; i++) { const t = Math.random(), s = (Math.random() - 0.5) * P.wave.width; particles.spawn({ x: a.x + f.x * len * t + f.z * s, y: a.y + 0.3, z: a.z + f.z * len * t - f.x * s, vx: f.x * 8, vy: 1 + Math.random() * 2, vz: f.z * 8, grav: 6, drag: 1.5, life: 0.6, color: i % 3 ? GREEN : SICK, size: 0.4 }); }
  },
});

export const blackhole = spell({
  name: 'Schwarzes Loch', desc: 'Bodenziel: saugt alle in 8 yd ein. Nach 1,5 s fliegen sie auf die nächste andere Gruppe bis 20 yd: Aufprall 4 yd, 3 Einheiten.', tags: ['Fläche', 'Kontrolle'],
  lifePct: 0.05, mana: 200, cd: 20000, range: P.hole.range, radius: P.hole.radius, ground: true, showDmg: P.hole.dmg * UNIT,
  effect(c, point) {
    const caught = new Set<any>();
    addField(c, { pos: point, radius: c.radius(P.hole.radius), dur: P.hole.ms, visual: fieldDecal(voidTex, DARK, 0.7, 2),
      onUpdate(f, dt) {
        for (const m of mobsInRadius(f.pos, f.radius)) { caught.add(m); pullMob(m, f.pos, P.hole.pull * dt / 1000); }
        areaParticles(f.pos, f.radius, 40, dt, [DARK, GREEN], { up: 0.5, size: 0.3, swirl: 10 });
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
          burstFx(to, P.hole.impact, [GREEN, DARK], 0x60c020);
          shakeCamera(0.35);
        };
        for (const m of list) startLeap(m, to.clone().setX(to.x + (Math.random() - 0.5) * 2), P.hole.flightMs, impact);
        if (!list.length) impact();
      },
    });
  },
});

export const poisoncloud = spell({
  name: 'Giftwolke', desc: 'Fläche 6 yd für 6 s, 0,3 Einheiten pro Sekunde, markiert jede Sekunde.', tags: ['Fläche'],
  lifePct: 0.03, mana: 120, cd: 10000, range: P.cloud.range, radius: P.cloud.radius, ground: true, showDmg: P.cloud.dps * UNIT,
  effect(c, point) {
    addField(c, { pos: point, radius: c.radius(P.cloud.radius), dur: P.cloud.ms, visual: fieldDecal(blightTex, SICK, 0.55, 0.3),
      onTick: f => { for (const m of mobsInRadius(f.pos, f.radius)) if (c.hit(m, P.cloud.dps * UNIT) && !m.dead) mark(m); },
      onUpdate: (f, dt) => areaParticles(f.pos, f.radius, 40, dt, [GREEN, SICK], { up: 1.2, size: 0.5 }),
    });
  },
});

export const web = spell({
  name: 'Klebefaden', desc: 'Fläche 8 yd: kettet jeden an bis zu 2 Nachbarn, 6 s. Schaden und Kontrolle gehen zu 50 % auf die Angeketteten über.', tags: ['Fläche', 'Kontrolle'],
  lifePct: 0.04, mana: 150, cd: 30000, range: P.web.range, radius: P.web.radius, ground: true,
  effect(c, point) {
    const list = mobsInRadius(point, c.radius(P.web.radius));
    for (const m of list) {
      const links = list.filter(o => o !== m).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos)).slice(0, P.web.links);
      m.web = { links, until: state.now + P.web.ms };
      for (const o of links) boltFx(m.pos, o.pos, [1.4, 1.4, 1.2], 600);
    }
    burstFx(point, P.web.radius, [[1.2, 1.2, 1], GREEN], 0xd0e0c0);
  },
});

export const contract = spell({
  name: 'Zusammenziehen', desc: 'Alle Markierten in 15 yd auf einen Haufen, 4 s festgehalten, × Stapel. Verbraucht die Male.', tags: ['Kontrolle'],
  lifePct: 0.03, mana: 100, cd: 10000,
  canCast: () => marked(P.contract.radius).length ? null : 'Kein markierter Gegner in der Nähe',
  effect(c) { contractAll(c, marked(c.radius(P.contract.radius))); },
});

export const drain = spell({
  name: 'Entziehen', desc: 'Alle Markierten in 15 yd: 2 Einheiten pro Stapel, heilt 0,5 % pro Treffer. Verbraucht die Male.', tags: ['Heilung'],
  lifePct: 0.02, mana: 90, cd: 6000, showDmg: P.drain.dmg * UNIT,
  canCast: () => marked(P.drain.radius).length ? null : 'Kein markierter Gegner in der Nähe',
  effect(c) { drainAll(c, marked(c.radius(P.drain.radius))); },
});

export const burst = spell({
  name: 'Platzen', desc: 'Alle Markierten in 15 yd: Gift in Höhe des Entziehen-Schadens, verteilt auf 12 s. Verbraucht die Male.',
  lifePct: 0.02, mana: 90, cd: 6000, showDmg: P.drain.dmg * UNIT,
  canCast: () => marked(P.burst.radius).length ? null : 'Kein markierter Gegner in der Nähe',
  effect(c) { burstAll(withScale(c), marked(c.radius(P.burst.radius))); },
});

export const melt = spell({
  name: 'Zerfließen', desc: 'Du zerfließt 3 s zu einer Lache bis 15 yd (nicht angreifbar, kein Zaubern, markiert darin). Dann reißt der Schleim alle darin zur Mitte und hält sie 2 s fest.', tags: ['Bewegung', 'Fläche', 'Kontrolle'],
  lifePct: 0.1, mana: 300, cd: 45000, ranks: ['mana', 'radius'],
  effect(c) {
    const M = P.melt, pos = player.pos.clone(), R = c.radius(M.radius);
    liquid.start = state.now; liquid.end = state.now + M.ms;
    player.meltUntil = liquid.end;
    player.invulnUntil = Math.max(player.invulnUntil ?? 0, liquid.end);
    stopChannel(true); stopDrink();
    addField(c, { pos, radius: 0.5, dur: M.ms, tickMs: M.tickMs, visual: fieldDecal(blightTex, GREEN, 0.55, 0.4),
      onUpdate(f, dt) { f.radius = Math.max(0.5, R * (state.now - f.start) / M.ms); areaParticles(f.pos, f.radius, 40, dt, [GREEN, SICK], { up: 0.8, size: 0.3 }); },
      onTick(f) { for (const m of mobsInRadius(f.pos, f.radius)) mark(m); },
      onEnd(f) {
        for (const m of mobsInRadius(f.pos, R)) { pullMob(m, f.pos, dist2d(m.pos, f.pos)); applyRoot(m, M.rootMs, 'glue'); }
        spray(f.pos, 50);
        shakeCamera(0.5);
        combatText(player.pos, 'Zerfließen', 'heal', 2.8);
      },
    });
  },
});

// Relikt Pestilenz: alle Male im Umkreis platzen, ziehen zusammen und entziehen gleichzeitig, ohne sich zu verbrauchen
export const pestilence = {
  name: 'Pestilenz', figRelic: true, desc: 'Alle Male in der Nähe platzen, ziehen zusammen und entziehen gleichzeitig, ohne sich zu verbrauchen.', ranks: [], tags: ['Seuche'], cls: 'nature',
  mana: 0, cd: P.pestilence.cd,
  press() {
    if (cdEnd('pestilence') > state.now) return showError('Fähigkeit ist noch nicht bereit');
    const list = marked(P.pestilence.radius);
    if (!list.length) return showError('Kein markierter Gegner in der Nähe');
    startCd('pestilence');
    noteCastStart('pestilence');
    const c = withScale(makeCtx('pestilence'));
    burstAll(c, list, true);
    drainAll(c, list, true);
    contractAll(c, list, true);
    combatText(player.pos, 'Pestilenz', 'info', 3);
  },
};
