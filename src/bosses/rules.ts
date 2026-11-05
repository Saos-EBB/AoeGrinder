// Boss-Regeln aus dem Boss-Viewer (RULE). Eine Regel läuft einmal beim Kampfstart: (f, p) → hängt sich in f.hooks ein.
// Haken: tick(dt) jedes Bild, onPlayerHit(body), onDodged(body), dmgTaken(body, amount) → amount, onBodyDeath(body), onEnd(pos), bar() → Zusatztext der Boss-Leiste, cleanup().
// Einmalige Auslöser (HP-Schwelle, Zeit) prüft die Regel selbst in tick. Werte aus RULE_P (roster.ts) oder hier, alle // PH

import { state, player } from '../state';
import { meta, saveMeta } from '../meta';
import { mage } from '../models/mage';
import { rollWeapon, rollTier, inventoryFull } from '../weaponRolls';
import { CARD_RARITIES } from '../config';
import { boom, PAL } from '../vfx/energy';
import { addTrauma } from '../wucht';
import { fx, em, killFx } from '../vfx/energy';
import { CFG } from '../config';
import { maxHp } from '../formulas';
import { textAt, impactFx, bigImpact, burnPlayer, V, gy, dist2, rnd, TAU, onGround, newRun, tw, face, moveBody, ease, palOf } from './core';
import { ATT } from './attacks';
import { removeMob } from '../mobs';
import { STYLES, BOSSES } from './roster';

// Summe der Boss-Leben (boss.ts hängt sie an f.hp)
const hpFrac = f => { const { hp, max } = f.hp(); return hp / Math.max(1, max); };
const mainBody = f => f.bodies.find(b => b.mob && !b.mob.dead) ?? f.bodies[0];

export const RULE: Record<string, (f: any, p: any) => void> = {
  // Enrage: ab HP-Schwelle (hp) oder nach Zeit (after s). Tempo (Laufen und Ausholen) und Schaden steigen. Zeit-Enrage zeigt einen Timer an der Leiste
  enrage(f, p) {
    let on = false;
    const fire = () => {
      on = true;
      f.speedMul = (f.speedMul ?? 1) * (p.speed ?? 1);
      f.windMul = (f.windMul ?? 1) / (p.speed ?? 1);
      f.dmgMul = (f.dmgMul ?? 1) * (p.dmg ?? 1);
      for (const b of f.bodies) if (b.mob) { b.mob.bossTint = 'boss2'; impactFx(b.mob.pos, 6, 0xff2a2a, .8); textAt(b.mob.pos, 'ENRAGE', 'hurt', 3.5); }
    };
    f.hooks.tick.push(() => { if (!on && (p.after != null ? f.time >= p.after : hpFrac(f) <= (p.hp ?? .2))) fire(); });
    if (p.after != null) f.hooks.bar.push(() => on ? 'ENRAGE' : `Enrage in ${Math.ceil(p.after - f.time)} s`);
  },
  // Hinken: unter hp langsamer, holt länger aus
  hinken(f, p) {
    let on = false;
    f.hooks.tick.push(() => {
      if (on || hpFrac(f) > (p.hp ?? .25)) return;
      on = true;
      f.speedMul = (f.speedMul ?? 1) * (p.speed ?? .6);
      f.windMul = (f.windMul ?? 1) * (p.wind ?? 1.3);
      textAt(mainBody(f).mob.pos, 'hinkt', 'info', 3);
    });
  },
  // Enge Kammer: kleinere Arena
  arenaRadius(f, p) { f.setArena(p.r ?? 10); },
  // Dauer-Slow über den Spieler-Slow (30 %, CFG.curseSlow), solange der Kampf läuft
  slowAura(f) {
    f.hooks.tick.push(() => { player.slowUntil = Math.max(player.slowUntil, state.now + 300); });
    f.hooks.bar.push(() => 'Frost-Aura: Tempo −30 %');
  },
  // Garantierter Drop: Magier eine Waffe ab Grün, sonst Staub ×3. Inventar voll → Staub
  loot(f, p) {
    f.hooks.onEnd.push(pos => {
      const melee = mage.skin === 'krieger' || mage.skin === 'klinge';
      boom(V(pos.x, gy(pos) + 1, pos.z), 2, PAL.slime, .8, { ground: gy(pos), n: 40 });
      addTrauma(.4);
      if (melee || inventoryFull()) {
        const dust = (p.dust ?? 20) * 3;
        meta.dust += dust; saveMeta();
        textAt(pos, `+${dust} Knochenstaub`, 'xp', 4);
        return;
      }
      const w = rollWeapon(Math.max(2, rollTier()));
      meta.inv.push(w); saveMeta();
      textAt(pos, `Waffe: ${CARD_RARITIES[w.r].name}`, 'heal', 4);
    });
  },

  // ---------- Mittel ----------
  // Wachstum: alle 30 s Größe, Schaden und Radien +10 %
  wachstum(f, p) {
    let next = p.every ?? 30;
    f.hooks.tick.push(() => {
      if (f.time < next) return;
      next += p.every ?? 30;
      for (const b of f.bodies) if (b.mob && !b.mob.dead) { b.grow *= 1.1; b.mob.model.root.scale.multiplyScalar(1.1); b.mob.model.height *= 1.1; impactFx(b.mob.pos, 6, 0xb0c0d0, .4); textAt(b.mob.pos, `Wachstum: ×${b.grow.toFixed(2).replace('.', ',')}`, 'info', 3); }
    });
    f.hooks.bar.push(() => `Wachstum in ${Math.max(0, Math.ceil(next - f.time))} s`);
  },
  // Arena schrumpft 20 → 8 yd über 90 s, ab 50 % HP doppelt so schnell. Die Wand bleibt bei 20 yd, außerhalb des Rings Schaden pro Sekunde
  arenaSchrumpft(f, p) {
    const from = f.arena, to = p.to ?? 8, dur = p.dur ?? 90;
    let r = from, tick = 0;
    f.wall = from;
    f.hooks.tick.push(dt => {
      const k = hpFrac(f) <= .5 ? 2 : 1;
      r = Math.max(to, r - (from - to) / dur * k * dt);
      if (Math.abs(r - f.arena) > .1 || r === to && f.arena !== to) { f.setArena(r); f.wall = from; }   // Ring nur alle 0,1 yd neu legen
      tick -= dt;
      if (dist2(player.pos, f.center) > r && tick <= 0) { tick = 1; burnPlayer(p.dot ?? .08, 'Arena'); }
    });
    f.hooks.bar.push(() => `Arena ${Math.round(r)} yd`);
  },
  // Abtauchen (Ragnaros bei 50 %): 30 s unangreifbar, 4–6 Söhne der Flamme aus Mobs der Zone, dann Rückkehr mit Ring
  abtauchen(f, p) {
    let done = false, until = 0, adds = [], b = null;
    f.hooks.tick.push(() => {
      if (!done && f.phase === 2 && f.step === 'fight') {
        done = true; b = mainBody(f);
        if (b.run) b.run.alive = false;
        b.busy = false; b.submerged = true; until = f.time + (p.ms ?? 30);
        const y0 = b.mob.pos.y, depth = b.mob.model.height * 1.1;
        b.rise = k => { b.mob.pos.y = y0 - depth * k; };
        tw(null, 1, k => b.rise(ease(k)));                 // versinkt in der Lava
        textAt(b.mob.pos, 'Taucht ab', 'info', 3); impactFx(b.mob.pos, 6, 0xff7a2a, .6);
        const n = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) { const a = i / n * TAU + .4, pos = onGround(player.pos).add(V(Math.cos(a) * 6, 0, Math.sin(a) * 6)); adds.push(f.spawnAdd(pos)); impactFx(pos, 2, 0xff8a3a, .2); }
        textAt(player.pos, 'Söhne der Flamme', 'hurt', 3.5);
      }
      if (!b?.submerged) return;
      const left = until - f.time;
      if (left <= 0 || adds.every(m => m.dead)) {
        b.submerged = false; tw(null, .6, k => b.rise(1 - ease(k)));
        bigImpact(b.mob.pos, 10, 0xff7a2a); textAt(b.mob.pos, 'Kehrt zurück', 'info', 3);
        f.attack(b, 'ring', { r: 10, color: 0xff7a2a });
      }
    });
    f.hooks.bar.push(() => b?.submerged ? `abgetaucht · ${Math.ceil(until - f.time)} s` : '');
  },
  // Zufalls-Atem (Chromaggus): beim Start 2 von 5 Atem würfeln, nur diese nutzt er (dazu der Biss)
  zufallsAtem(f) {
    const ALL = [
      { n: 'Zeitraffer', color: 0xd8c050, hit: () => { player.slowUntil = Math.max(player.slowUntil, state.now + 5000); textAt(player.pos, 'Zeitraffer: langsamer', 'hurt'); } },
      { n: 'Ätzende Säure', color: 0x7aff3a, hit: () => dot(f, .03, 4, 'Säure') },
      { n: 'Fleisch entzünden', color: 0xff3a1a, hit: () => { f.dmgMul = (f.dmgMul ?? 1) * 1.3; textAt(player.pos, 'nimmt +30 % Schaden', 'hurt'); setTimeout(() => { if (f.dmgMul) f.dmgMul /= 1.3; }, 8000); } },
      { n: 'Verbrennen', color: 0xff9a2a, hit: () => dot(f, .04, 3, 'Verbrennen') },
      { n: 'Frostbrand', color: 0x6ac8ff, hit: () => { player.slowUntil = Math.max(player.slowUntil, state.now + 3000); dot(f, .02, 3, 'Frostbrand'); } },
    ];
    const pool = [...ALL], pick = [];
    while (pick.length < 2) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const bite = f.def.attacks.find(a => a.k === 'kette');
    const atts = [bite, ...pick.map(x => ({ n: x.n, k: 'atem', p: { color: x.color, label: x.n, len: 15, ang: 50, onHit: x.hit } }))];
    for (const b of f.bodies) b.attacks = atts;
    textAt(f.bodies[0].home, `Atem: ${pick[0].n} + ${pick[1].n}`, 'info', 4);
    f.hooks.bar.push(() => `${pick[0].n} · ${pick[1].n}`);
  },
  // Polarität (Thaddius): alle 8 s würfelt der Spieler eine Ladung, der Boss hat eine feste. Gleich: +30 % Schaden auf den Boss. Verschieden und nah: Schaden pro Sekunde
  polaritaet(f, p) {
    const bossPlus = Math.random() < .5;
    let plus = Math.random() < .5, next = p.every ?? 8, tick = 0;
    const e = fx(1e9), sB = em(e, 'sph', bossPlus ? PAL.wut : PAL.blitz, { sc: 6, core: 1, flow: [0, 2, 0] }), sP = em(e, 'sph', plus ? PAL.wut : PAL.blitz, { sc: 6, core: 1, flow: [0, 2, 0] });
    const paint = () => { (sP.material as any).userData.u.uC.value = plus ? PAL.wut : PAL.blitz; };
    f.hooks.tick.push(dt => {
      const b = mainBody(f);
      sB.position.set(b.mob.pos.x, b.mob.pos.y + b.mob.model.height + .9, b.mob.pos.z); sB.scale.setScalar(.5);
      sP.position.set(player.pos.x, player.pos.y + 3, player.pos.z); sP.scale.setScalar(.35);
      if (f.time >= next) { next += p.every ?? 8; plus = Math.random() < .5; paint(); textAt(player.pos, plus === bossPlus ? 'Gleiche Ladung: +30 % Schaden' : 'Falsche Ladung: Abstand halten!', plus === bossPlus ? 'heal' : 'hurt', 3); }
      tick -= dt;
      if (plus !== bossPlus && dist2(player.pos, b.mob.pos) < (p.r ?? 8) && tick <= 0) { tick = 1; burnPlayer(p.dot ?? .05, 'Polarität'); }
    });
    f.hooks.dmgTaken.push((b, a) => plus === bossPlus ? a * 1.3 : a);
    f.hooks.bar.push(() => `Ladung ${plus ? '+' : '−'} / Boss ${bossPlus ? '+' : '−'}`);
    f.hooks.cleanup.push(() => killFx(e));
  },
  // Bekämpfen sich (Abgrundwächter): der Rotäugige (letzter Körper) greift alle 15 s auch einen anderen Wächter an
  bekaempfenSich(f, p) {
    let next = p.every ?? 15;
    f.hooks.tick.push(() => {
      const red = f.bodies[f.bodies.length - 1];
      if (f.time < next || !red.mob || red.mob.dead || red.busy || red.state !== 'active') return;
      const others = f.bodies.filter(b => b !== red && b.mob && !b.mob.dead);
      if (!others.length) return;
      next = f.time + (p.every ?? 15);
      const t = others[Math.floor(Math.random() * others.length)], run = red.run = newRun(), p0 = red.mob.pos.clone();
      red.busy = true;
      textAt(red.mob.pos, 'rotes Auge', 'hurt', 3);
      face(red, t.mob.pos);
      const end = t.mob.pos.clone().add(p0.clone().sub(t.mob.pos).setY(0).normalize().multiplyScalar(2.2));
      tw(run, .4, k => moveBody(red, p0.clone().lerp(end, ease(k)))).then(() => {
        t.mob.hp = Math.max(1, t.mob.hp - t.mob.maxHp * (p.dmg ?? .08)); t.mob.hitAt = state.now;
        impactFx(t.mob.pos, 3, 0xff6a3a, .4); textAt(t.mob.pos, 'Wächter gegen Wächter', 'info', 3);
        red.busy = false; red.walkUntil = f.time + .6;
      });
    });
  },
  // Ablösung (Wachritter): höchstens max wach; fällt einer, erwacht der nächste. every: alle every s ein Körper mehr (Könige, Schritt 5)
  spawnUeberZeit(f, p) {
    const wake = () => {
      const next = f.bodies.find(b => b.state === 'sleep' || b.state === 'hidden');
      if (!next) return;
      next.state = 'active';
      f.awaken(next);                                     // steht auf (sleep) oder wird gerufen (hidden)
    };
    f.hooks.onBodyDeath.push(() => { if (!p.every || !f.bodies.some(b => b.state === 'active' && b.mob && !b.mob.dead)) wake(); });   // Könige: keiner mehr wach → der nächste sofort
    if (p.every) { let next = p.every; f.hooks.tick.push(() => { if (f.time < next) return; next += p.every; const act = f.bodies.filter(b => b.state === 'active' && b.mob && !b.mob.dead).length; if (act < (p.max ?? 4)) wake(); }); }
    f.hooks.bar.push(() => { const a = f.bodies.filter(b => b.state === 'active' && b.mob && !b.mob.dead).length, rest = f.bodies.filter(b => b.state === 'sleep' || b.state === 'hidden').length; return `${a} wach · ${rest} warten`; });
  },

  // ---------- Spät ----------
  // Erbt die Kraft (Ornstein & Smough): stirbt einer, wird der andere größer, schneller, stärker und nutzt alle Angriffe
  erbtKraft(f, p) {
    f.hooks.onBodyDeath.push(dead => {
      const s = f.bodies.find(b => b !== dead && b.mob && !b.mob.dead);
      if (!s || s.inherited) return;
      s.inherited = true;
      const k = p.mul ?? 1.3;
      s.dmgMul = (s.dmgMul ?? 1) * k; s.speedMul = (s.speedMul ?? 1) * k; s.windMul = (s.windMul ?? 1) / k;
      s.grow *= 1.15; s.mob.model.root.scale.multiplyScalar(1.15); s.mob.model.height *= 1.15;
      s.attacks = f.def.attacks.map(a => ({ ...a, b: undefined }));
      s.mob.bossTint = 'boss2';
      bigImpact(s.mob.pos, 8, 0xffe070); textAt(s.mob.pos, `erbt die Kraft: +${Math.round((k - 1) * 100)} %`, 'hurt', 4);
    });
    f.hooks.bar.push(() => f.bodies.some(b => b.inherited) ? 'Kraft geerbt' : '');
  },
  // Neue Waffe in Phase 2 (Godrick): Drachenarm am Modell, dazu der Feueratem
  neuePhaseWaffe(f, p) {
    let done = false;
    f.hooks.tick.push(() => {
      if (done || f.phase !== 2) return;
      done = true;
      const b = mainBody(f);
      f.swapModel(b, { ...b.spec, p: { ...b.spec.p, dragonArm: true } });
      b.attacks = [...f.def.attacks, { n: 'Feueratem', k: 'atem', p: { color: 0xff6a1a, len: p.len ?? 14, ang: 45, label: 'Feueratem', onHit: () => dot(f, .03, 3, 'Verbrennen') } }];
      bigImpact(b.mob.pos, 6, 0xff6a1a); textAt(b.mob.pos, 'Drachenarm', 'hurt', 4);
    });
    f.hooks.bar.push(() => done ? 'Drachenarm' : '');
  },
  // Entweihen wächst (Lichkönig): eigene Pfütze; jeder Schaden-Tick am Spieler vergrößert sie ×1,4
  pfuetzeWaechst(f, p) {
    const live = [];                                       // Pfützen dieses Kampfs (attacks.ts pfuetze legt sie in p.track)
    const def = { n: 'Entweihen', k: 'pfuetze', p: { r: 3, color: 0x3a2a5a, label: 'Entweihen', dur: p.dur ?? 25, grow: p.grow ?? 1.4, maxR: p.maxR ?? 14, track: live } };
    for (const b of f.bodies) b.attacks = [...f.def.attacks, def];
    f.hooks.bar.push(() => { const r = Math.max(0, ...live.filter(h => !h.gone).map(h => h.r)); return r ? `Entweihen ${r.toFixed(1).replace('.', ',')} yd` : ''; });
  },
  // Wahnsinn (Yogg-Saron): Sanity 100, sinkt pro Sekunde und pro Treffer. Bei 0: 5 s links und rechts vertauscht, dann zurück auf 50
  wahnsinn(f, p) {
    let san = 100;
    f.hooks.tick.push(dt => {
      san = Math.max(0, san - (p.perS ?? 1) * dt);
      if (san > 0) return;
      state.mirrorUntil = state.now + (p.ms ?? 5000);
      san = p.reset ?? 50;
      addTrauma(.6); textAt(player.pos, 'WAHNSINN: Steuerung gespiegelt', 'hurt', 4);
    });
    f.hooks.onPlayerHit.push(() => { san = Math.max(0, san - (p.perHit ?? 10)); });
    f.hooks.bar.push(() => state.mirrorUntil > state.now ? 'WAHNSINN' : `Sanity ${Math.ceil(san)}`);
    f.hooks.cleanup.push(() => { state.mirrorUntil = 0; });
  },
  // Spiegelbilder (Atziri): alle 30 s 4 Kopien, die echte springt an einen der 5 Plätze. Kopien zerplatzen beim ersten Treffer, machen keinen Schaden
  spiegelbilder(f, p) {
    let next = p.first ?? 6, copies = [];
    const clear = (puffIt = true) => { for (const m of copies) { if (puffIt) impactFx(m.pos, 2, 0xff8a40, .25); removeMob(m); state.mobs.splice(state.mobs.indexOf(m), 1); } copies = []; };
    f.hooks.tick.push(() => {
      const b = mainBody(f);
      for (const m of copies) { m.model.root.rotation.y = Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z); Object.assign(m.model.ctl, b.mob.model.ctl); }   // gleiche Pose wie das Original
      const popped = copies.filter(m => m.popped || m.dead);
      if (popped.length) { for (const m of popped) { impactFx(m.pos, 2.5, 0xff8a40, .3); textAt(m.pos, 'Spiegelbild', 'info', 2); removeMob(m); state.mobs.splice(state.mobs.indexOf(m), 1); } copies = copies.filter(m => !m.popped && !m.dead); }
      if (f.time < next || b.busy || f.step !== 'fight') return;
      next = f.time + (p.every ?? 30);
      clear(false);
      const n = (p.copies ?? 4) + 1, spots = [], a0 = rnd(0, TAU), r = p.r ?? 7;
      for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU, q = player.pos.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); const c = f.center, d = dist2(q, c), max = f.arena - 2.5; if (d > max) { q.x = c.x + (q.x - c.x) / d * max; q.z = c.z + (q.z - c.z) / d * max; } spots.push(onGround(q)); }
      const real = Math.floor(Math.random() * n);
      impactFx(b.mob.pos, 3, 0xff8a40, .4);
      moveBody(b, spots[real]);
      for (let i = 0; i < n; i++) { if (i === real) continue; const m = f.spawnCopy(b, spots[i]); m.bossTint = b.mob.bossTint; copies.push(m); impactFx(spots[i], 3, 0xff8a40, .4); }
      textAt(player.pos, 'Spiegelbilder: nur eine ist echt', 'info', 3.5);
    });
    f.hooks.bar.push(() => copies.length ? `${copies.length} Spiegelbilder` : `Spiegelbilder in ${Math.max(0, Math.ceil(next - f.time))} s`);
    f.hooks.cleanup.push(() => clear(false));
  },
  // Konter (Gwyn): perfekter Dodge öffnet 2 s, in denen er dreifachen Schaden nimmt
  konter(f, p) {
    let seen = state.dodgeStats?.perfect ?? 0, until = -1;
    f.hooks.tick.push(() => {
      const n = state.dodgeStats?.perfect ?? 0;
      if (n > seen) {
        seen = n; until = f.time + (p.s ?? 2);
        const b = mainBody(f);
        b.mob.bossTint = 'gap'; b.mob.hitAt = state.now;
        textAt(b.mob.pos, 'KONTER!', 'heal', 3);
      }
      if (until > 0 && f.time >= until) { until = -1; for (const b of f.bodies) if (b.mob && b.mob.bossTint === 'gap' && b.gapUntil <= f.time) b.mob.bossTint = f.phase === 2 ? 'boss2' : 'boss'; }
    });
    f.hooks.dmgTaken.push((b, a) => f.time < until ? a * (p.mul ?? 3) : a);
    f.hooks.bar.push(() => f.time < until ? `KONTER ×${p.mul ?? 3}` : 'Perfekter Dodge = Konter');
  },

  // ---------- Final ----------
  // Heilt bei Treffer (Malenia): jeder Treffer am Spieler heilt den Körper um 4 % seines Lebens
  heiltBeiTreffer(f, p) {
    f.hooks.onPlayerHit.push(b => {
      const m = (b ?? mainBody(f)).mob;
      if (!m || m.dead) return;
      const add = m.maxHp * (p.pct ?? .04);
      m.hp = Math.min(m.maxHp, m.hp + add);
      textAt(m.pos, `+${Math.round((p.pct ?? .04) * 100)} % geheilt`, 'heal', 2.4);
    });
    f.hooks.bar.push(() => 'Heilt bei Treffer');
  },
  // Zerstörung (Maliketh): jeder Treffer senkt das maximale Leben um 10 %, höchstens bis 30 %. Grauer Teil im Leben-Balken, nach dem Kampf zurück
  maxHpSenken(f, p) {
    const step = p.step ?? .1, floor = p.min ?? .3;
    f.hooks.onPlayerHit.push(() => {
      if (player.dead) return;
      player.hpCut = Math.min(1 - floor, (player.hpCut ?? 0) + step);
      player.hp = Math.min(player.hp, maxHp());
      textAt(player.pos, `max. Leben −${Math.round(step * 100)} %`, 'hurt', 2.4);
    });
    f.hooks.bar.push(() => player.hpCut ? `max. Leben ${Math.round((1 - player.hpCut) * 100)} %` : 'Zerstörung');
    f.hooks.cleanup.push(() => { player.hpCut = 0; });
  },
  // Zeitstopp (Shaper): alle 25 s friert alles 1,3 s (Spieler, Geschosse, Boss-Zeit, Bild grau), danach sofort der Slam-Rhythmus
  zeitstopp(f, p) {
    let next = p.first ?? 14, until = 0;
    f.hooks.tick.push(() => {
      const b = mainBody(f);
      if (until) {
        if (state.now < until) return;
        until = 0; f.scale = 1; document.body.classList.remove('zeitstopp');
        const rh = f.def.attacks.find(a => a.k === 'rhythmus');
        if (rh && b.mob && !b.mob.dead) f.attack(b, 'rhythmus', { ...rh.p });
        return;
      }
      if (f.time < next || b.busy || f.step !== 'fight') return;
      next = f.time + (p.every ?? 25);
      const ms = (p.s ?? 1.3) * 1000;
      until = state.now + ms;
      f.scale = 0;
      player.stunUntil = Math.max(player.stunUntil, until);
      document.body.classList.add('zeitstopp');
      addTrauma(.5); textAt(player.pos, 'ZEITSTOPP', 'hurt', 3);
    });
    f.hooks.bar.push(() => until ? 'ZEITSTOPP' : `Zeitstopp in ${Math.max(0, Math.ceil(next - f.time))} s`);
    f.hooks.cleanup.push(() => { f.scale = 1; document.body.classList.remove('zeitstopp'); });
  },
  // Stilwechsel (Seele der Asche): bei 75/50/25 % Leben wird er zur nächsten Figur aus STYLES, mit deren Modell und Angriffen
  stilwechsel(f, p) {
    let i = 0, style = STYLES[0].name;
    const at = p.at ?? [.75, .5, .25];
    f.hooks.tick.push(() => {
      if (i >= at.length || hpFrac(f) > at[i] || f.step !== 'fight') return;
      i++;
      const st = STYLES[i % STYLES.length], b = mainBody(f), src = BOSSES.find(x => x.model === st.model);
      if (b.run) b.run.alive = false;
      b.busy = false; b.walkUntil = f.time + .8;
      f.swapModel(b, st.model);
      b.attacks = src?.evil ? src.attacks : [...f.def.attacks, { n: st.name, ...st.atk }];
      style = st.name;
      bigImpact(b.mob.pos, 7, 0xff8a30); addTrauma(.5);
      textAt(b.mob.pos, st.name, 'hurt', 4);
    });
    f.hooks.bar.push(() => style);
  },
};

// Dauerschaden am Spieler: frac max. Leben pro Sekunde über s Sekunden, ignoriert Dodge
function dot(f, frac, s, name) {
  let t = 0, n = 0;
  const fn = dt => { t += dt; if (t < 1) return; t -= 1; burnPlayer(frac, name); if (++n >= s) f.hooks.tick.splice(f.hooks.tick.indexOf(fn), 1); };
  f.hooks.tick.push(fn);   // in Boss-Zeit: Pause und Zeitstopp halten ihn an
  textAt(player.pos, name, 'hurt', 2.6);
}

// Regeln, die erst in einem späteren Schritt kommen, tun nichts
export function ruleOf(k) { return RULE[k] ?? (() => {}); }
