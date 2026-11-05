// Boss-Angriffe aus dem Boss-Viewer (ATT). Jeder Angriff: async (run, b, p). Ausholen (Warnfläche) → Treffer → Lücke.
// run: stirbt der Lauf (Phase-2-Brüllen, Kampfende), endet der Angriff still. b: Boss-Körper, p: Parameter aus dem Roster. Alle Zahlen // PH

import { player } from '../state';
import { resolve } from '../collision';
import { hitstop } from '../fx/impact';
import { fx, em, lay, killFx, sparks, boom, PAL } from '../vfx/energy';
import { addTrauma } from '../wucht';
import {
  V, TAU, clamp, ease, easeIn, rnd, wrap, yawTo, dist2, gy, onGround, fight, tw, wait, addObj, tele, hurt, burnPlayer,
  face, dirOf, arms, lean, R, windMul, windup, strike, gap, moveBody, impactFx, bigImpact, shoot, lob, palOf, textAt, BK, liveMesh,
} from './core';

const deg = d => d * Math.PI / 180;
const inArena = p => { const c = fight.center, d = dist2(p, c), max = fight.arena - 1; if (d > max) { p.x = c.x + (p.x - c.x) / d * max; p.z = c.z + (p.z - c.z) / d * max; } return p; };
const target = () => inArena(onGround(player.pos));
const chest = b => b.mob.pos.clone().setY(b.mob.pos.y + Math.min(b.mob.model.height * .6, 3));

// Dauerfläche am Boden: Treffer beim Erscheinen, danach Schaden pro Sekunde, solange der Spieler drinsteht
function puddle(pos, r, color, dur, label?) {
  const e = fx(1e9); const m = em(e, 'gdisk', palOf(color), { sc: 1.6, core: 0, edge: 1.3, flow: [.3, 0, .2] });
  let t = 0, tick = 0, grow = 0;
  const h: any = { pos: pos.clone(), r, hit: false };
  addObj({
    update: dt => {
      const s = dt * (fight?.scale ?? 1); t += s; tick -= s; grow = Math.min(1, grow + s / .3);
      lay(m, h.pos, Math.max(.1, h.r * ease(grow)));
      if (dist2(player.pos, h.pos) < h.r && tick <= 0) { tick = 1; burnPlayer(BK.dot, label); h.onTouch?.(); }
      return t < dur && !!fight;
    },
    remove: () => { h.gone = true; killFx(e); },
  });
  return h;
}

export const ATT = {
  // Schlag-Kette: Kegel vor dem Boss, jedes Ausholen eigene Warnfläche
  async kette(run, b, p) {
    const ang = deg(p.ang ?? 90);
    for (const w of p.hits) {
      const r = R(b, p.r), d = face(b), h = tele(ang >= TAU - .01 ? 'circle' : 'cone', { pos: b.mob.pos, yaw: b.yaw, r, ang }, w * windMul(b), p.color ?? BK.teleColor, run);
      await windup(run, b, w, .7);
      h.move(b.mob.pos, b.yaw);
      strike(run, b);
      const pos = b.mob.pos, off = Math.abs(wrap(yawTo(pos, player.pos) - b.yaw));
      impactFx(pos.clone().addScaledVector(dirOf(b), r * .6), 2, p.fx ?? p.color ?? 0xffc890, .25);
      if (dist2(pos, player.pos) < r + .5 && off <= ang / 2 + .05) hurt(1, pos, b);
      void d;
      await wait(run, .1);
    }
    await gap(run, b, p.gap ?? 1.2);
  },
  // Sprung-Slam auf die Spielerposition beim Absprung. ringP2: Phase 2 schickt danach einen Ring bis ringP2 yd los
  async slam(run, b, p) {
    const t = target(), start = b.mob.pos.clone(), r = R(b, p.r), warn = (p.warn ?? 1.0) * windMul(b);
    tele('circle', { pos: t, r }, warn, p.color ?? BK.teleColor, run); face(b, t);
    await tw(run, .18, k => lean(b, .25 * k));
    await tw(run, Math.max(.1, warn - .18), k => { const q = start.clone().lerp(t, k); q.y = start.y + (t.y - start.y) * k + Math.sin(Math.PI * k) * (4 + r * .5); moveBody(b, q); b.mob.falling = false; lean(b, -.5 * (1 - k) + .45 * k); });
    moveBody(b, t); lean(b, 0);
    bigImpact(t, r, p.fx ?? 0xffb070);
    if (dist2(t, player.pos) < r && hurt(1, t, b)) b.slamHit = true;
    if (fight.phase === 2 && p.ringP2) ringWave(run, b, t, R(b, p.ringP2), 2, p.color ?? 0xff7a2a, true);
    await gap(run, b, p.gap ?? 1.5);
  },
  // Ansturm: Linie, rennt durch, taumelt am Ende
  async ansturm(run, b, p) {
    face(b); const len = p.len ?? 14, w = p.w ?? 2.2, warn = (p.warn ?? .7) * windMul(b);
    const h = tele('line', { pos: b.mob.pos, yaw: b.yaw, len, w }, warn, p.color ?? BK.teleColor, run);
    await tw(run, warn, k => { if (k < .5) { face(b); h.move(b.mob.pos, b.yaw); } lean(b, .3 * ease(k)); });
    const start = b.mob.pos.clone(), d = dirOf(b);
    let L = len; while (L > 0 && dist2(start.clone().addScaledVector(d, L), fight.center) > fight.arena - 1.5) L -= .5;
    let hit = false;
    await tw(run, Math.max(.12, L / 32), k => {
      moveBody(b, start.clone().addScaledVector(d, L * k)); b.mob.moving = true; b.mob.speed = 32;
      const px = player.pos.x - start.x, pz = player.pos.z - start.z, along = px * d.x + pz * d.z, side = Math.abs(px * d.z - pz * d.x);
      if (!hit && along > -1 && along < L * k + 1 && side < w / 2 + .45) { hit = true; hurt(1, start, b); }
      if (Math.random() < .5) sparks(onGround(b.mob.pos).setY(gy(b.mob.pos) + .2), 1, PAL.staub, { v: [0, 1, 0], grav: 6, life: .5, glow: .6, band: 2 });
    });
    lean(b, 0); impactFx(b.mob.pos, 2.5, 0xd8c0a0, .35);
    await gap(run, b, p.gap ?? 1.0);
  },
  // Fächer aus Geschossen (360° = Ring), waves Wellen
  async faecher(run, b, p) {
    const warn = p.warn ?? .7, n = p.n ?? 5, spread = deg(p.spread ?? 60), color = p.color ?? 0xff7a3a;
    await windup(run, b, warn, .9); strike(run, b);
    const d = face(b), org = chest(b).addScaledVector(d, 1.2);
    const volley = { hit: false };   // eine Salve trifft höchstens einmal (wie im Prototyp)
    for (let wv = 0; wv < (p.waves ?? 1); wv++) {
      for (let i = 0; i < n; i++) {
        const a = spread >= TAU - .01 ? i / n * TAU + wv * .2 : n === 1 ? 0 : spread * (i / (n - 1) - .5);
        shoot(org, V(d.x * Math.cos(a) + d.z * Math.sin(a), 0, -d.x * Math.sin(a) + d.z * Math.cos(a)), p.speed ?? 11, 26, p.size ?? .35, color, () => { if (!volley.hit) { volley.hit = true; hurt(1, org, b); } });
      }
      if (wv < (p.waves ?? 1) - 1) await wait(run, .35);
    }
    await wait(run, .4);
    await gap(run, b, p.gap ?? .8);
  },
  // Ring läuft vom Boss nach außen; trifft, wenn die Front den Spieler überholt
  async ring(run, b, p) {
    await windup(run, b, p.warn ?? .5); strike(run, b); addTrauma(.5);
    await ringWave(run, b, onGround(b.mob.pos), R(b, p.r ?? 12), p.dur ?? 1.8, p.color ?? 0xff4a2a);
    await gap(run, b, p.gap ?? .8);
  },
  // Blinzeln hinter den Spieler, danach optional Explosion
  async blink(run, b, p) {
    const color = p.color ?? 0xb070ff;
    boom(chest(b), 1.4, palOf(color), .4, { ground: b.mob.pos.y, n: 14 });
    const d = V(player.pos.x - b.mob.pos.x, 0, player.pos.z - b.mob.pos.z).normalize();
    moveBody(b, inArena(onGround(player.pos).addScaledVector(d, p.behind ?? 3.6)));
    face(b); boom(chest(b), 1.4, palOf(color), .4, { ground: b.mob.pos.y, n: 14 });
    textAt(b.mob.pos, 'Blink');
    if (p.explode) await ATT.explosion(run, b, { r: p.explode, warn: p.warn ?? .6, color, gap: p.gap ?? 1.0 });
    else await wait(run, .4);
  },
  // Explosion um den Boss
  async explosion(run, b, p) {
    const pos = onGround(b.mob.pos), r = R(b, p.r ?? 6), warn = (p.warn ?? .6) * windMul(b), color = p.color ?? 0xff3a2a, y0 = b.yaw;
    tele('circle', { pos, r }, warn, color === 0xffffff ? BK.teleColor : color, run);
    await tw(run, warn, k => { arms(b, -2.8 * ease(k)); if (p.spin) b.yaw = y0 + k * k * Math.PI * 4; });
    b.yaw = y0; strike(run, b);
    bigImpact(pos, r, p.fx ?? color);
    if (dist2(pos, player.pos) < r) hurt(1, pos, b);
    await gap(run, b, p.gap ?? 1.0);
  },
  // Lachen: Brocken im Bogen, Fläche mit Schaden pro Sekunde. Gibt die Pfützen zurück (pfuetzeWaechst)
  async pfuetze(run, b, p) {
    await windup(run, b, p.warn ?? .5); strike(run, b);
    const n = p.n ?? 1, color = p.color ?? 0x8a1a2a, r = R(b, p.r ?? 4), spots = [];
    for (let i = 0; i < n; i++) { const t = target(); if (i > 0) { const a = rnd(0, TAU), s = rnd(3, 6); t.x += Math.cos(a) * s; t.z += Math.sin(a) * s; inArena(t); } spots.push(t); }
    await Promise.all(spots.map((t, i) => lob(run, chest(b), t, color, .6 + i * .12)));
    let hit = false;
    const out = spots.map(t => { const h = puddle(t, r, color, p.dur ?? 6, p.label); if (!hit && dist2(t, player.pos) < r) { hit = true; hurt(1, t, b); } return h; });
    p.track?.push(...out);
    if (p.grow) for (const h of out) h.onTouch = () => { h.r = Math.min(p.maxR ?? 14, h.r * p.grow); textAt(h.pos, `${p.label ?? 'Pfütze'} wächst`, 'hurt', 2); };   // pfuetzeWaechst
    textAt(b.mob.pos, p.label ?? 'Pfütze');
    await gap(run, b, p.gap ?? .8);
    return out;
  },
  // Feuerwand quer durch den Spieler
  async feuerwand(run, b, p) {
    await windup(run, b, .5); strike(run, b);
    const c = target(), d = V(c.x - b.mob.pos.x, 0, c.z - b.mob.pos.z).normalize(), side = V(-d.z, 0, d.x), len = p.len ?? 18, warn = (p.warn ?? .8) * windMul(b);
    const start = c.clone().addScaledVector(side, -len / 2), yaw = Math.atan2(side.x, side.z);
    tele('line', { pos: start, yaw, len, w: 1.6 }, warn, 0xff6a1a, run);
    await wait(run, warn);
    const onLine = () => { const px = player.pos.x - start.x, pz = player.pos.z - start.z, al = px * side.x + pz * side.z, sd = Math.abs(px * side.z - pz * side.x); return al > -.5 && al < len + .5 && sd < 1.3; };
    if (onLine()) hurt(1, c, b);
    const e = fx(1e9), flames = [];
    for (let i = 0; i <= len / 1.1; i++) { const m = em(e, 'cone', PAL.fire, { sc: 4, core: .35, tip: 1.1, puff: .05, flow: [0, 3.2, 0] }); const q = start.clone().addScaledVector(side, i * 1.1); m.position.set(q.x, gy(q), q.z); flames.push(m); }
    addTrauma(.4);
    let t = 0, tick = 1;
    addObj({ update: dt => { const s = dt * (fight?.scale ?? 1); t += s; tick -= s; flames.forEach((m, i) => m.scale.set(.5, 1.6 * (.8 + .5 * Math.abs(Math.sin(t * 30 + i))) * Math.min(1, (p.dur ?? 4) - t + .3), .5));
      if (onLine() && tick <= 0) { tick = 1; burnPlayer(BK.dot, 'Feuerwand'); } return t < (p.dur ?? 4) && !!fight; }, remove: () => killFx(e) });
    await gap(run, b, p.gap ?? .6);
  },
  // Riesenkugel wächst über dem Boss, fliegt langsam auf den Spieler
  async riesenkugel(run, b, p) {
    face(b); const color = p.color ?? 0x9aff4a, size = p.size ?? 2.4, t = target(), r = p.r ?? 7;
    const ball = liveMesh(run, 'sph', palOf(color), { sc: 2, core: .9, puff: .06, flow: [0, 2, 0] }), m = ball.m, org = b.mob.pos.clone().setY(b.mob.pos.y + b.mob.model.height + .6);
    m.position.copy(org);
    await tw(run, 1.0 * windMul(b), k => { m.scale.setScalar(.01 + size * ease(k)); arms(b, -2.9 * ease(k)); });
    strike(run, b);
    const dur = dist2(org, t) / (p.speed ?? 5);
    tele('circle', { pos: t, r }, dur, color, run);
    await tw(run, dur, k => { m.position.lerpVectors(org, t.clone().setY(t.y + size * .6), k); m.rotation.y += .1; });
    ball.kill();
    bigImpact(t, r, color);
    if (dist2(t, player.pos) < r) hurt(1, t, b);
    await gap(run, b, p.gap ?? 1.2);
  },
  // Sog: zieht den Spieler heran, danach optional Explosion
  async sog(run, b, p) {
    face(b); await tw(run, .5, k => arms(b, -1.6 * ease(k)));
    const color = p.color ?? 0xa070ff, dur = p.dur ?? 2.2, total = dist2(player.pos, b.mob.pos) * .55;   // zieht 55 % des Abstands heran
    textAt(b.mob.pos, 'Sog');
    let lk = 0;
    await tw(run, dur, k => {
      const dx = b.mob.pos.x - player.pos.x, dz = b.mob.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1, step = total * (ease(k) - ease(lk));
      lk = k;
      if (d > 3) { player.pos.x += dx / d * step; player.pos.z += dz / d * step; resolve(player.pos, .45); player.pos.y = gy(player.pos); }
      if (Math.random() < .7) { const a = rnd(0, TAU), q = b.mob.pos.clone().add(V(Math.cos(a) * 8, rnd(.5, 2), Math.sin(a) * 8)); sparks(q, 1, palOf(color), { v: [(b.mob.pos.x - q.x) * 2, 0, (b.mob.pos.z - q.z) * 2], grav: 0, life: .45, spread: .2, band: 3 }); }
      void k;
    });
    arms(b, 0);
    if (p.explode) await ATT.explosion(run, b, { r: p.explode, warn: .45, color, gap: .01 });
    await gap(run, b, p.gap ?? .8);
  },
  // Meteore um den Spieler, leicht versetzt
  async meteor(run, b, p) {
    face(b); await tw(run, .5, k => arms(b, -2.9 * ease(k))); strike(run, b);
    const n = p.n ?? 5, r = R(b, p.r ?? 3), warn = (p.warn ?? 1.2) * windMul(b), color = p.color ?? 0xff6a1a;
    const spots = []; for (let i = 0; i < n; i++) { const t = target(); if (i > 0) { const a = rnd(0, TAU), s = Math.random() * (p.spread ?? 7); t.x += Math.cos(a) * s; t.z += Math.sin(a) * s; inArena(t); } spots.push(t); }
    await Promise.all(spots.map(async (t, i) => {
      await wait(run, i * (p.stagger ?? .22));
      tele('circle', { pos: t, r }, warn, color, run);
      const rock = liveMesh(run, 'sph', palOf(color), { sc: 3, core: 1, puff: .05, flow: [0, 3, 0] }), m = rock.m; m.scale.setScalar(Math.max(.4, r * .28));
      const s0 = t.clone().add(V(6, 22, -4));
      await tw(run, warn, k => m.position.lerpVectors(s0, t.clone().setY(t.y + .3), easeIn(k)));
      rock.kill();
      impactFx(t, r, color, .45); boom(t.clone().setY(t.y + .5), r * .7, palOf(color), .45, { ground: t.y, n: 14 });
      if (dist2(t, player.pos) < r) hurt(1, t, b);
    }));
    await gap(run, b, p.gap ?? .8);
  },
  // Atem: Kegel vor dem Boss, Strom aus Funken. p.onHit: Wirkung des Atems (zufallsAtem)
  async atem(run, b, p) {
    const len = p.len ?? 14, ang = deg(p.ang ?? 40), color = p.color ?? 0xff7a2a, warn = (p.warn ?? .8) * windMul(b);
    if (p.label) textAt(b.mob.pos, p.label);
    face(b); const base = onGround(b.mob.pos), h = tele('cone', { pos: base, yaw: b.yaw, r: len, ang }, warn, color, run);
    await tw(run, warn, k => { if (k < .5) { face(b); h.move(b.mob.pos, b.yaw); } lean(b, -.18 * ease(k)); });
    lean(b, .12);
    const d = dirOf(b), off = Math.abs(wrap(yawTo(base, player.pos) - b.yaw));
    if (dist2(base, player.pos) < len && off < ang / 2 + .05 && hurt(1, base, b)) p.onHit?.();
    const head = chest(b).add(V(0, .6, 0));
    await tw(run, p.dur ?? 1.4, () => { for (let i = 0; i < 2; i++) { const a = rnd(-.5, .5) * ang, dir = V(d.x * Math.cos(a) + d.z * Math.sin(a), -.1, -d.x * Math.sin(a) + d.z * Math.cos(a)); sparks(head, 1, palOf(color), { v: [dir.x * len, dir.y * 4, dir.z * len], grav: 0, life: 1, spread: .3, band: 3 }); } });
    lean(b, 0);
    await gap(run, b, p.gap ?? .8);
  },
  // Slams im Takt auf den Spieler, der letzte groß
  async rhythmus(run, b, p) {
    const beats = p.beats ?? 4, iv = (p.int ?? .65) * windMul(b);
    for (let i = 0; i < beats; i++) {
      const last = i === beats - 1, t = target(), r = last ? 7 : 4, col = last ? 0xff3a6a : 0x6ab0ff;
      tele('circle', { pos: t, r }, iv, col, run); textAt(b.mob.pos, String(i + 1), 'info', 1.6);
      await tw(run, iv, k => arms(b, -2.6 * ease(k))); strike(run, b);
      (last ? bigImpact : impactFx)(t, r, col);
      if (dist2(t, player.pos) < r) hurt(1, t, b);
    }
    await gap(run, b, p.gap ?? 1.0);
  },
  // Merk-Spiel: 3×3 Felder um den Spieler, Folge zeigen, dann in derselben Reihenfolge explodieren
  async muster(run, b, p) {
    const n = p.n ?? 5, size = 4.6, c = target(), cells = [];
    for (let i = 0; i < 9; i++) cells.push(V(c.x + ((i % 3) - 1) * size, c.y, c.z + (Math.floor(i / 3) - 1) * size));
    const pool = [...Array(9).keys()], seq = [];
    while (seq.length < n) seq.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (!seq.includes(4)) seq[n - 1] = 4;   // die Mitte ist immer dabei: Stehenbleiben geht nicht
    const grid = cells.map(q => tele('square', { pos: q, size: size - .3 }, 99, 0x3a5a8a, run));
    textAt(b.mob.pos, 'Merken', 'info', 3);
    await wait(run, .6);
    for (const [i, ix] of seq.entries()) { tele('square', { pos: cells[ix], size: size - .3 }, .45, 0x7ae8ff, run); textAt(cells[ix], String(i + 1), 'heal', 2); await wait(run, .45 * windMul(b)); }
    await wait(run, .7); textAt(b.mob.pos, 'Gleiche Reihenfolge', 'info', 3);
    for (const ix of seq) {
      const q = cells[ix];
      tele('square', { pos: q, size: size - .3 }, .45 * windMul(b), BK.teleColor, run);
      await wait(run, .45 * windMul(b));
      impactFx(q, 2.5, 0xff6a6a, .3);
      if (Math.abs(player.pos.x - q.x) < size / 2 && Math.abs(player.pos.z - q.z) < size / 2) hurt(1, q, b);
    }
    grid.forEach(h => h.remove());
    await gap(run, b, p.gap ?? .8);
  },
};

// Ring läuft von c auf r in dur s. Trifft einmal, wenn die Front den Spieler überholt (auch beim Entgegenlaufen). skipIfHit: wer gerade getroffen wurde, bleibt verschont
export function ringWave(run, b, c, r, dur, color, skipIfHit = false) {
  const e = fx(1e9), m = em(e, 'gring', palOf(color), { sc: 2, core: 0, flow: [0, 0, 0] });
  let t = 0, outside = dist2(player.pos, c) > .3, hit = skipIfHit && !!b.slamHit;
  b.slamHit = false;
  return new Promise<void>(res => addObj({
    update: dt => {
      if (run && !run.alive) { res(); return false; }
      t += dt * (fight?.scale ?? 1); const k = Math.min(1, t / dur), s = Math.max(.2, r * k), d = dist2(player.pos, c), out = d > s;
      if (!hit && outside && !out) { hit = true; hurt(1, c, b); }
      outside = out;
      lay(m, c, s); (m.material as any).userData.u.uK.value = 1 - k * .5;
      if (k >= 1) { res(); return false; }
      return true;
    },
    remove: () => killFx(e),
  }));
}
// Wo ein Angriff hinpasst: nah (am Körper), mittel, weit. Für die Auswahl nach Abstand
export const RANGE = { kette: 'near', explosion: 'near', ring: 'near', slam: 'mid', ansturm: 'mid', pfuetze: 'mid', feuerwand: 'mid', atem: 'mid', rhythmus: 'mid', blink: 'far', sog: 'far', faecher: 'far', meteor: 'far', riesenkugel: 'far', muster: 'any' };
void clamp; void hitstop; void lob;
