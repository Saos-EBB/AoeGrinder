// Moves des Strichkriegers (KOMP-04): je Fähigkeit eine Definition { dur, keys, ev, walk?, hold?, tick?, end? }, Auswahl über ACTIONS[ability](F, W).
// keys: [u, Pose, Ease], ev: [u, Funktion] (Treffer-Momente über F.hitTip/F.hitRoot → model.onHit). Aus strichKrieger.ts herausgezogen, Werte unverändert.
import { clamp, inOut } from '../../util';
import { PAL } from '../../vfx/energy';
import { STRICH_TIMING } from './timing';
import { P, IDLE, Q_END } from './poses';
import { TAU } from './parts';
import { FX_LIGHT } from './fx';
import type { Fig } from './fig';

function defQ(F: Fig, step, hitI = step) {
  const { tipPos, hitTip } = F; const { arc, impact, emit } = F.fx;
  const from = step === 0 ? IDLE : Q_END[step - 1];
  const W = [
    P(IDLE, { y: .9, h: [0, -.3, 0], c: [.15, -.45, 0], hR: [-.3, 1.95, -.05], hL: 'G', b: [.15, .6, -.8], e: [0, 1, 0], fR: [-.3, .07, -.15] }),
    P(Q_END[0], { hR: [.55, 1.32, .35], hL: [.3, 1.1, .4], b: [.92, .15, .3], e: [0, 0, 1], c: [.45, .75, 0] }),
    P(IDLE, { y: .72, h: [0, .4, 0], c: [.55, .45, 0], n: [-.4, -.2, 0], hR: [-.5, .7, -.1], hL: 'G', b: [-.35, -.6, -.72], e: [0, -.2, 1], fL: [.32, .07, .2], fR: [-.32, .07, -.2] }),
    P(IDLE, { y: 1.35, h: [0, 0, 0], c: [-.3, 0, 0], n: [-.1, 0, 0], hR: [-.05, 2.25, -.15], hL: 'G', b: [0, .3, -.95], e: [0, 1, 0], fL: [.25, .5, .15], fR: [-.25, .42, -.1] })
  ][step];
  const dur = STRICH_TIMING.q[step];
  const tHit = [.42, .42, .42, .52][step];
  const keys = [[0, from], [step === 3 ? .32 : .28, W, 'io'], [tHit, Q_END[step], 'in'], [step === 3 ? .78 : .7, P(Q_END[step], { y: Q_END[step].y - .02 })], [1, Q_END[step]]];
  const ev = [[tHit - .06, () => {
    const pal = F.anim.qPal ? PAL[F.anim.qPal] : null;
    if (step === 0) arc([.0, 1.3, .9], [0, -.3, -.7], 2.1 * F.anim.fin.s, 2.4, .3, true, pal);
    if (step === 1) arc([0, 1.3, .3], [-Math.PI / 2, 0, 0], 2.3 * F.anim.fin.s, 2.8, .3, true, pal);
    if (step === 2) arc([-.1, 1.6, .8], [0, -Math.PI / 2, Math.PI], 1.9 * F.anim.fin.s, 2.2, .3, true, pal);
  }], [tHit, () => {
    if (step === 3) { const p = tipPos(); impact(p, 4.5, 7); }
    else emit(tipPos(), 8, 3, 0x8f877a, 12, .5);
    hitTip('q', hitI);
  }]];
  return { dur, keys, ev, walk: step < 3 };
}
// Kahlschlag (Axt): einmal rundum mit ausgestreckter Axt, Treffer am Spieler
function defSpin(F: Fig, W) {
  const { hitRoot } = F; const { arc } = F.fx;
  const wind = P(IDLE, { y: .9, h: [0, .5, 0], c: [.3, .6, 0], n: [-.2, -.3, 0], hR: [.55, 1.3, -.3], hL: 'G', b: [.9, .2, -.4], e: [0, 0, 1], fL: [.32, .07, .1], fR: [-.32, .07, -.2] });
  const out = P(IDLE, { y: .82, h: [0, 0, 0], c: [.3, 0, .1], n: [-.15, 0, 0], hR: [-.7, 1.15, .25], hL: 'G', b: [-1, -.05, .15], e: [0, 0, 1], fL: [.36, .07, .05], fR: [-.36, .07, -.05] });
  return { dur: W.e, keys: [[0, IDLE], [.25, wind, 'out'], [.4, out], [.8, out], [1, IDLE]],
    ev: [[.5, () => { arc([0, 1.0, 0], [-Math.PI / 2, 0, 0], 2.8, 5.8, .35); hitRoot('e'); }]],
    tick(u) { F.anim.spinAng = TAU * inOut(clamp((u - .3) / .5, 0, 1)); },
    end() { F.anim.spinAng = 0; } };
}
function defE(F: Fig) {
  const { tipPos, hitTip } = F; const { impact } = F.fx;
  const up = P(IDLE, { y: 1.0, c: [-.25, 0, 0], n: [-.2, 0, 0], hR: [-.05, 2.2, -.1], hL: 'G', b: [0, .35, -.94], e: [0, 1, 0], fL: [.32, .07, .1], fR: [-.32, .07, -.15] });
  const slam = P(IDLE, { y: .62, h: [0, 0, 0], c: [.85, 0, 0], n: [-.7, 0, 0], hR: [0, .75, .82], hL: 'G', b: [0, -.8, .6], e: [0, -1, 0], fL: [.42, .07, .28], fR: [-.42, .07, -.35] });
  return { dur: STRICH_TIMING.e, keys: [[0, IDLE], [.35, up], [.48, slam, 'in'], [.85, P(slam, { y: .6 })], [1, IDLE]],
    ev: [[.48, () => { impact(tipPos(), 2.5, 3); hitTip('e'); }]] };
}
// Wirbelwind hält, solange das Spiel ihn meldet. Treffer tickt das Spiel selbst.
function defWhirl(F: Fig) {
  const { root, gy, tipPos } = F; const { emit, windG, windArcs } = F.fx;
  const sp = P(IDLE, { y: .97, h: [0, 0, 0], c: [.1, 0, .1], n: [-.1, 0, 0], hR: [-.62, 1.3, .2], hL: 'G', b: [-1, .02, .1], e: [0, 0, 1], fL: [.32, .07, .05], fR: [-.32, .07, -.05] });
  return { hold: true, dur: 200, keys: [[0, IDLE], [1, sp]],
    ev: [[.3, () => windG.visible = true]],
    tick(u, s) {
      F.anim.spinAng += s * TAU * 2.5;
      windG.position.copy(root.position);
      windArcs.forEach((m, i) => { m.rotation.z = -(F.anim.spinAng + m.userData.off); m.material.userData.u.uK.value = .75 + .15 * Math.sin(performance.now() / 50 + i); });
      if (Math.random() < .5) emit(tipPos().setY(gy() + .1), 1, 2, 0x8f877a, 8, .5);
    }, end() { F.anim.spinAng = 0; windG.visible = false; } };
}
function defLeap(F: Fig) {
  const { root, hitRoot } = F; const { impact, ghost } = F.fx;
  const crouch = P(IDLE, { y: .6, c: [.8, 0, 0], n: [-.6, 0, 0], hR: [-.4, 1.0, -.45], hL: 'G', b: [-.1, .1, -1], e: [0, 1, 0], fL: [.32, .07, .3], fR: [-.32, .07, -.4] });
  const air = P(IDLE, { y: 1.1, h: [-.2, 0, 0], c: [-.35, 0, 0], n: [-.1, 0, 0], hR: [-.05, 2.3, -.2], hL: 'G', b: [0, .25, -.97], e: [0, 1, 0], fL: [.25, .45, .3], fR: [-.25, .35, -.2] });
  const land = P(Q_END[3], { y: .55 });
  let gi = -1;
  const { from: f0, to: f1 } = STRICH_TIMING.leap.move;
  return { dur: STRICH_TIMING.leap.ms, keys: [[0, IDLE], [.2, crouch], [.3, air, 'out'], [.6, P(air, { c: [-.15, 0, 0] })], [.66, land, 'in'], [.9, P(land, { y: .56 })], [1, IDLE]],
    ev: [[f1, () => { F.anim.lift = 0; impact(root.position, 7, 9); hitRoot('leap'); }]],
    tick(u) {
      const k = clamp((u - f0) / (f1 - f0), 0, 1);
      F.anim.lift = 3.8 * Math.sin(Math.PI * k);
      const g = Math.floor(k * 5); if (k > 0 && k < 1 && g > gi) { gi = g; ghost(); }
    }, end() { F.anim.lift = 0; } };
}
function defExec(F: Fig) {
  const { tipPos, hitTip } = F; const { arc, impact } = F.fx;
  const wind = P(IDLE, { y: 1.04, h: [0, -.15, 0], c: [-.45, -.1, 0], n: [-.45, 0, 0], hR: [-.05, 2.3, -.35], hL: 'G', b: [0, -.1, -1], e: [0, 1, 0], fL: [.36, .07, .25], fR: [-.36, .07, -.35] });
  const strike = P(IDLE, { y: .52, h: [0, 0, 0], c: [.95, 0, 0], n: [-.75, 0, 0], hR: [0, .66, .95], hL: 'G', b: [0, -.62, .78], e: [0, -1, 0], fL: [.45, .07, .55], fR: [-.45, .07, -.45] });
  return { dur: STRICH_TIMING.exec, keys: [[0, IDLE], [.4, wind, 'out'], [.6, P(wind, { y: 1.06, c: [-.5, -.1, 0] })], [.67, strike, 'in'], [.92, P(strike, { y: .5 })], [1, IDLE]],
    ev: [[.15, () => { F.anim.flare = 1; }], [.63, () => arc([0, 1.4, 1.1], [0, Math.PI / 2, 0], 2.6, 2.6, .4)],
      [.67, () => { impact(tipPos(), 5, 8); hitTip('exec'); }]] };
}
function defCry(F: Fig) {
  const { root, gy, hitRoot } = F; const { ring, emit } = F.fx;
  const roar = P(IDLE, { y: .95, h: [0, 0, 0], c: [-.35, 0, 0], n: [-.6, 0, 0], hR: [-.85, 1.2, .1], b: [-.55, -.8, .1], e: [-1, 0, 0], hL: [.85, 1.6, .15], fL: [.38, .07, .1], fR: [-.38, .07, -.1] });
  return { dur: STRICH_TIMING.cry, keys: [[0, IDLE], [.2, P(IDLE, { y: .82, c: [.6, 0, 0], n: [.2, 0, 0] })], [.35, roar, 'out'], [.8, P(roar, { c: [-.4, 0, 0] })], [1, IDLE]],
    ev: [[.35, () => { F.anim.flare = 1; ring(root.position, 0xd8121c, 8, .6, .1); ring(root.position, FX_LIGHT, 6, .5, .08); emit(root.position.clone().setY(gy() + .2), 40, 5, 0x8f877a, 10, .7); hitRoot('cry'); }]] };
}
function defLast(F: Fig) {
  const { root, gy, tipPos, hitRoot } = F; const { ring, emit, cracksStar } = F.fx;
  const plant = P(IDLE, { y: .66, h: [0, 0, 0], c: [.55, 0, 0], n: [.4, 0, 0], hR: [0, 1.3, .55], hL: 'G', b: [0, -1, .08], e: [0, 0, 1], fL: [.3, .07, .15], fR: [-.25, .19, -.5] });
  const rise = P(plant, { y: .98, c: [-.4, 0, 0], n: [-.7, 0, 0], hL: [.85, 1.55, .2], fR: [-.3, .07, -.3] });
  return { dur: STRICH_TIMING.last, keys: [[0, IDLE], [.25, plant, 'in'], [.55, P(plant, { y: .64 })], [.72, rise, 'out'], [.9, rise], [1, IDLE]],
    ev: [[.25, () => { const p = tipPos(); cracksStar(p, 6, 2.5); emit(p.setY(gy() + .1), 25, 3, 0x8f877a, 12, .7); }],
      [.72, () => { F.anim.flare = 1.5; ring(root.position, 0xd8121c, 12, .8, .12); emit(root.position.clone().setY(gy() + .3), 60, 6, 0xe0141c, 2, 1.4); hitRoot('last'); }]] };
}
// Finisher-Spin (Version E): einmal rundum, Treffer am Spieler. Größe fin.s, Tornado: Staub am Boden
function defFinSpin(F: Fig) {
  const { root, gy, tipPos, hitRoot } = F; const { arc, ring, emit } = F.fx;
  const sp = P(IDLE, { y: .82, h: [0, 0, 0], c: [.35, 0, 0], n: [-.2, 0, 0], hR: [-.95, 1.15, .3], hL: [.6, 1.2, .2], b: [-1, .02, .15], e: [0, 0, 1], fL: [.36, .07, .2], fR: [-.36, .07, -.2] });
  const s = F.anim.fin.s, tor = F.anim.fin.tor, pal = F.anim.qPal ? PAL[F.anim.qPal] : null;
  return { dur: 560, keys: [[0, IDLE], [.2, sp, 'io'], [.8, sp], [1, P(sp, { y: .8 })]],
    ev: [[.46, () => { arc([0, 1.1, 0], [-Math.PI / 2, 0, 0], 3 * s, TAU, .35, true, pal); ring(root.position, 0, 3.6 * s, .4, .15, pal); hitRoot('q', 9); }]],
    tick(u) { F.anim.spinAng = TAU * inOut(clamp((u - .2) / .6, 0, 1)); if (tor && Math.random() < .6) emit(tipPos().setY(gy() + .1), 2, 3, 0x8f877a, 8, .6); },
    end() { F.anim.spinAng = 0; } };
}
// Sprung-Smash (Version E): Hieb von oben mit Sprung, Einschlag an der Spitze
function defFinSmash(F: Fig) {
  const { tipPos, hitTip } = F; const { impact } = F.fx;
  const d: any = defQ(F, 3, 10), s = F.anim.fin.s;
  d.ev = [[.52, () => { const p = tipPos(); impact(p, 4.5 * s, 7); hitTip('q', 10); }]];
  d.tick = u => { F.anim.lift = 1.6 * Math.sin(Math.PI * clamp((u - .1) / .42, 0, 1)); };
  d.end = () => { F.anim.lift = 0; };
  d.walk = false;
  return d;
}

export type WarDef = { dur: number; keys: any[]; ev: any[]; walk?: boolean; hold?: boolean; tick?: (u: number, s?: number) => void; end?: () => void };
// Fähigkeit → Move. W: Waffe aus STRICH_TIMING.weapons (Dauern, Posen der Schlagfolge). Schläge 'q0'..'q3' über die Waffen-Pose (makeAction)
export const ACTIONS: Record<string, (F: Fig, W) => WarDef> = {
  fs: F => defFinSpin(F),
  fm: F => defFinSmash(F),
  qs: (F, W) => { const d = defQ(F, 1, 9); d.dur = W.spin ?? 420; return d; },   // Spin: Treffer-Index 9
  e: (F, W) => { const d: WarDef = F.weapon === 'axe' ? defSpin(F, W) : defE(F); d.dur = W.e; return d; },
  whirl: F => defWhirl(F),
  leap: F => defLeap(F),
  exec: (F, W) => { const d: WarDef = defExec(F); d.dur = W.exec; return d; },
  cry: F => defCry(F),
  last: F => defLast(F),
};
export function makeAction(F: Fig, W, ability: string): WarDef | undefined {
  const a = ACTIONS[ability];
  if (a) return a(F, W);
  if (ability?.[0] === 'q') {
    const i = +ability[1], d = defQ(F, W.pose[i] ?? i, i);
    d.dur = W.q[i] ?? d.dur;
    return d;
  }
}
