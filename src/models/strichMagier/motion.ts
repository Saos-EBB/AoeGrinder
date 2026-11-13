// ───────────────────────── Bewegungsstil je Schule (ANIM): idle, run, cast (Keyframes), chan, sit; Tod und Sprung

import { clamp, lerpTo as lerp, inOut, V } from '../../util';
import { A1, A2 } from './shared';
import { cp, mix, P } from './pose';

const bump = (t, a, b, f = .15) => clamp(Math.min((t - a) / f, (b - t) / f), 0, 1); // 0→1→0 im Fenster
const N = P({ y: .98, h: [0, 0, 0], c: [.05, 0, 0], n: [0, 0, 0], hL: [.3, .95, .06], hR: [-.3, 1.08, .14], b: [0, 1, .04], fL: [.13, .06, 0], fR: [-.13, .06, 0] });
function runBase(ph, A = .5, lift = .28) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return { fL: [.12, .06 + lift * Math.max(0, c), A * s], fR: [-.12, .06 + lift * Math.max(0, -c), -A * s], s, c };
}
export const ANIM: any = {
  // ── Basis: ruhig, neutral
  base: {
    idle: t => { const p = cp(N); const br = Math.sin(t * 1.8); p.y += .01 * br; p.c[0] += .025 * br; return p; },
    run: t => {
      const ph = t * 11, r = runBase(ph);
      return P(N, { y: .95 - .04 * Math.abs(r.c), c: [.3, -.1 * r.s, 0], n: [-.25, 0, 0], h: [0, .15 * r.s, 0], fL: r.fL, fR: r.fR,
        hL: [.28, 1.08, -.3 * r.s], hR: [-.3, 1.12, .3 * r.s], b: [0, .75, .65] });
    },
    cast: { dur: 1000, keys: () => {
      const w = P(N, { c: [-.08, .35, 0], hL: [.38, 1.32, -.25] });
      const push = P(N, { y: .92, c: [.25, -.3, 0], n: [-.1, .2, 0], hL: [.12, 1.45, .62], fL: [.15, .06, .3], fR: [-.13, .06, -.15] });
      return [[0, N], [.35, w], [.55, push, 'out'], [.8, push], [1, N]];
    } },
    chan: t => P(N, { y: .96, c: [-.05, 0, 0], n: [-.15, 0, 0], hL: [.26, 1.62, .45], hR: [-.24, 1.6, .4], b: [0, .9, .45],
      fL: [.16, .06, .12], fR: [-.16, .06, -.12] })
  },

  // ── Feuer: chaotisch, Theater, Cartoon
  fire: {
    idle: t => {
      const bounce = Math.abs(Math.sin(t * Math.PI * 2.2));
      const p = P(N, {
        y: .93 + .06 * bounce, h: [0, .22 * Math.sin(t * 3.1), .05 * Math.sin(t * 6.9)],
        c: [.12, .15 * Math.sin(t * 2.2), .14 * Math.sin(t * 13.8)],
        n: [-.05, .25 * Math.tanh(4 * Math.sin(t * 1.3)), .38 * Math.tanh(5 * Math.sin(t * 1.7))],
        hL: [.42 + .16 * Math.sin(t * 3), 1.3 + .22 * Math.sin(t * 4.3), .3 + .1 * Math.cos(t * 2.4)],
        hR: [-.36, 1.12, .24], b: [Math.sin(t * 9), .35, Math.cos(t * 9)],
        fL: [.19, .06 + .07 * Math.max(0, Math.sin(t * 13.8)), .06], fR: [-.19, .06 + .07 * Math.max(0, -Math.sin(t * 13.8)), -.04]
      });
      // alle 5 s: „Ta-da!“, danach Lachanfall
      const k = t % 5;
      const tada = P(N, { y: 1.0, c: [-.25, 0, .15], n: [-.35, .2, .35], hL: [.78, 1.9, .2], hR: [-.75, 1.85, .25], b: [-.4, 1, .2], fL: [.2, .06, .25], fR: [-.15, .2, -.2], toe: -.6 });
      const laugh = P(N, { y: .9, c: [-.35 + .07 * Math.sin(t * 34), 0, .05 * Math.sin(t * 17)], n: [-.6 + .1 * Math.sin(t * 34), 0, .2], hL: [.25, 1.12, .32], hR: [-.3, 1.05, .2], b: [0, 1, .1], fL: [.16, .06, .05], fR: [-.16, .06, -.05] });
      let q = mix(p, tada, bump(k, 3.0, 3.9, .12));
      q = mix(q, laugh, bump(k, 3.9, 4.9, .15));
      return q;
    },
    run: t => {
      const ph = t * 8.5, r = runBase(ph, .9, .45);
      const s2 = Math.sin(ph * 2);
      return P(N, {
        y: .84 - .12 * Math.abs(r.c), h: [.1, .45 * r.s, .1 * r.s], c: [.35 + .18 * s2, -.35 * r.s, .1 * Math.sin(ph * 1.5)],
        n: [-.25 + .3 * s2, .35 * r.s, .25 * Math.sin(ph * 1.5)], fL: r.fL, fR: r.fR,
        hL: [.48 + .28 * Math.cos(ph * 2), 1.4 + .45 * Math.sin(ph * 2), .3 * r.s],
        hR: [-.48 - .28 * Math.cos(ph * 2 + 1), 1.4 + .45 * Math.sin(ph * 2 + 1.6), -.35 * r.s],
        b: [Math.sin(ph * 2), .5, Math.cos(ph * 2)]
      });
    },
    cast: { dur: 1600, keys: () => {
      const wind = P(N, { y: 1.02, h: [0, .5, 0], c: [-.5, .55, 0], n: [-.45, .4, .2], hL: [.62, 1.95, -.42], hR: [-.5, 1.3, .3], b: [-.6, .6, .5], fL: [.15, .06, .05], fR: [-.15, .5, .32], toe: -.5 });
      const hurl = P(N, { y: .74, h: [0, -.4, 0], c: [.65, -.65, 0], n: [-.45, -.35, -.2], hL: [.0, 1.35, .9], hR: [-.6, 1.25, -.3], b: [-.5, .3, -.8], fL: [.22, .06, .78], fR: [-.2, .06, -.55] });
      const bow = P(N, { y: .8, h: [0, .2, 0], c: [.85, .1, 0], n: [.45, 0, 0], hL: [.82, 1.15, .15], hR: [-.4, 1.05, -.4], b: [-.6, .35, -.7], fL: [.15, .06, .25], fR: [-.1, .06, -.62], toe: .3 });
      return [[0, N], [.3, wind, 'back'], [.42, hurl, 'out'], [.55, hurl], [.72, bow, 'back'], [.9, bow], [1, N]];
    } },
    chan: t => P(N, {
      y: .9 + .03 * Math.sin(t * 9), h: [0, .3 * Math.sin(t * 2.5), 0], c: [.1 + .12 * Math.sin(t * 5), -.2 * Math.sin(t * 2.5), .1 * Math.sin(t * 3.3)],
      n: [-.2 + .15 * Math.sin(t * 9), .2 * Math.sin(t * 2.5), .4],
      hL: [.4 + .3 * Math.sin(t * 7), 1.6 + .28 * Math.cos(t * 9.1), .45 + .1 * Math.sin(t * 5)], hR: [-.3, 1.45, .5],
      b: [.35 * Math.sin(t * 4), .45, .85], fL: [.22, .06, .2], fR: [-.22, .06 + .08 * Math.max(0, Math.sin(t * 9)), -.18]
    })
  },

  // ── Eis: steif, zittert, gleitet
  ice: {
    idle: t => {
      const shud = bump(t % 3.4, 2.6, 2.95, .05);
      const j = (Math.sin(t * 57) * .6 + Math.sin(t * 39) * .4) * (1 + 3 * shud);
      return P(N, {
        y: .95 - .02 * shud, h: [0, 0, 0], c: [.32 + .03 * shud, .01 * j, .018 * j], n: [.18, .02 * j, .03 * j],
        hL: [-.13 + .008 * j, 1.33, .19], hR: [.13 - .008 * j, 1.3, .21], b: [-.15, 1, .12],
        fL: [.08, .06, .03], fR: [-.08, .06, -.01]
      });
    },
    run: t => {
      const ph = t * 6.5;
      const leg = (s, side) => s > 0
        ? [side * (.12 + .5 * s), .06, -.38 * s]
        : [side * .12, .06 + .14 * (-s), .12 * (-s)];
      const s = Math.sin(ph);
      return P(N, {
        y: .8, h: [0, .12 * s, .12 * s], c: [.8, -.1 * s, .18 * s], n: [-.7, 0, -.1 * s],
        hL: [.12, 1.22, -.32], hR: [-.12, 1.2, -.32], b: [1, 0, .05],
        fL: leg(s, 1), fR: leg(-s, -1)
      });
    },
    cast: { dur: 1900, keys: () => {
      const I = ANIM.ice.idle(0);
      const up = P(N, { y: .97, c: [.05, 0, 0], n: [0, 0, 0], hL: [.22, 1.48, .66], hR: [-.3, 1.1, .2], b: [0, 1, .05] });
      const push = P(N, { y: .95, c: [.12, -.15, 0], n: [-.05, .1, 0], hL: [.12, 1.42, .74], hR: [-.12, 1.4, .72], b: [0, .3, 1], fL: [.13, .06, .2], fR: [-.13, .06, -.15] });
      return [[0, I], [.12, mix(I, up, .33), 'lin'], [.2, mix(I, up, .66), 'lin'], [.28, up, 'lin'], [.4, push, 'lin'], [.88, push, 'lin'], [1, I]];
    }, freeze: [.4, .86] },
    chan: t => {
      const j = Math.sin(t * 45) * .5 + Math.sin(t * 31) * .5;
      return P(N, { y: .96, c: [.12, 0, .01 * j], n: [-.08, 0, .015 * j], hL: [.27, 1.24 + .01 * j, .62], hR: [-.25, 1.3, .55], b: [0, 1, .08], fL: [.15, .06, .1], fR: [-.15, .06, -.1] });
    }
  },

  // ── Arkan: schwebt, Yoga, ganz bei sich
  arcane: {
    idle: t => {
      const br = Math.sin(t * 1.05);
      return P(N, {
        y: .52 + .015 * br, h: [0, 0, 0], c: [-.02 - .04 * br, 0, 0], n: [.08 + .03 * br, 0, .06 * Math.sin(t * .4)],
        hL: [.36, .66, .26], hR: [-.36, .66, .26], fL: [-.17, .34, .2], fR: [.17, .32, .22], kp: 1, toe: .4,
        sf: 1, sp: [-.75, .95 + .06 * Math.sin(t * 1.3), .05], b: [.08 * Math.sin(t * .7), 1, 0]
      });
    },
    run: t => P(N, {
      y: .98, c: [.12, 0, 0], n: [-.1, 0, 0], hL: [.04, 1.32, .28], hR: [-.04, 1.32, .28],
      fL: [.06, -.06, -.14], fR: [-.06, -.1, -.18], toe: .9, sf: 1, sp: [-.65, .95 + .05 * Math.sin(t * 2), -.45], b: [0, .9, -.4]
    }),
    cast: { dur: 2200, keys: () => {
      const I = ANIM.arcane.idle(0);
      const pray = P(I, { hL: [.04, 1.15, .3], hR: [-.04, 1.15, .3] });
      const up = P(I, { y: .56, c: [-.18, 0, 0], n: [-.35, 0, 0], hL: [.12, 2.02, .08], hR: [-.12, 2.02, .08] });
      const open = P(I, { y: .54, c: [.06, 0, 0], n: [-.05, 0, 0], hL: [.48, 1.38, .5], hR: [-.48, 1.38, .5], b: [0, .55, .8] });
      return [[0, I], [.2, pray, 'sine'], [.45, up, 'sine'], [.7, open, 'sine'], [.85, open], [1, I, 'sine']];
    } },
    chan: t => {
      const br = Math.sin(t * 1.2);
      return P(N, {
        y: .8 + .01 * br, h: [0, 0, 0], c: [-.04 * br, 0, 0], n: [0, .7, 0],
        hL: [.86, 1.52, .02], hR: [-.86, 1.52, .02], fL: [.62, .02, .05], fR: [-.58, .06, -.02], kp: .3,
        sf: 1, sp: [-.5, 1.1, -.45], b: [0, 1, 0]
      });
    }
  }
};
export const FLOAT = { arcane: .42 };
// Schluck-Rhythmus: 0 = Ruhe, 1 = am Mund. Periode in s, Anteil am Mund
function sip(t, per, frac = .35) { const k = (t % per) / per; return k < frac ? Math.sin(Math.PI * k / frac) ** .6 : 0; }
const STAFF_DOWN = { sf: 1, sp: [-.62, .04, .05], b: [.05, .03, 1] };
ANIM.base.sit = t => { // lümmelt, zurückgelehnt, Becher mit Stil
  const s = sip(t, 3.2);
  return P(N, { ...STAFF_DOWN, sp: [.62, .04, .05], y: .26, h: [-.12, .25, 0], c: [-.32 + .1 * s, -.15, 0], n: [.12 - .3 * s, -.2, -.12 + .1 * s],
    fL: [.14, .06, .72], fR: [-.22, .06, .3], hR: [-.36, .22, -.32],
    hL: [lerp(.32, .03, s), lerp(.62, .98, s), lerp(.38, .14, s)], pd: [lerp(0, -.1, s), lerp(1, .55, s), lerp(.05, -.8, s)], ps: 1 });
};
ANIM.fire.sit = t => { // wippt, Beine weit, trommelt, ext die Flasche
  const s = sip(t, 3.6, .45), sw = Math.sin(t * 3);
  return P(N, { ...STAFF_DOWN, y: .28, h: [-.05, .15 * sw, .1 * sw], c: [.15 - .65 * s, .2 * sw, .08 * Math.sin(t * 7)], n: [-.1 - .55 * s, .3 * Math.tanh(4 * Math.sin(t * 1.9)), .3 * (1 - s)],
    fL: [.38, .06 + .05 * Math.max(0, Math.sin(t * 6)), .42], fR: [-.38, .06 + .05 * Math.max(0, -Math.sin(t * 6)), .4],
    hR: [-.32, .52 + .06 * Math.abs(Math.sin(t * 12)), .48],
    hL: [lerp(.48 + .12 * sw, .04, s), lerp(.85 + .15 * Math.sin(t * 4), 1.12, s), lerp(.35, .12, s)], pd: [lerp(.4 * sw, 0, s), lerp(1, -.55, s), lerp(0, -.85, s)], ps: 1 });
};
ANIM.ice.sit = t => { // Knie angezogen, Tasse mit beiden Händen, zittert. Nur die Unterarme heben die Tasse, Oberarme bleiben ruhig
  const s = sip(t, 3.0), j = Math.sin(t * 57) * .6 + Math.sin(t * 39) * .4;
  const c0 = .36, hipY = .25;
  // Schulter im Wurzel-Raum aus Hüfte + Brust (Rumpf steht still), Ellbogen fest davor-unten
  const sh = side => V(side * .23, hipY + .05 + .49 * Math.cos(c0), .49 * Math.sin(c0));
  const el = side => sh(side).add(V(side * .05, -.8, .6).normalize().multiplyScalar(A1));
  const tgt = V(0, .66, .58).lerp(V(0, .95, .34), s);           // Tasse vorn → am Mund
  const hand = side => { const e = el(side); return e.clone().add(tgt.clone().add(V(side * .055, 0, 0)).sub(e).normalize().multiplyScalar(A2 - .002)).toArray(); };
  return P(N, { ...STAFF_DOWN, y: hipY, h: [0, 0, 0], c: [c0, .004 * j, .008 * j], n: [-.05 + .42 * s, .02 * j, .02 * j],
    fL: [.1, .06, .28], fR: [-.1, .06, .28], hL: hand(1), hR: hand(-1), ep: [.9, -.4, 1.4], pd: [0, lerp(1, .7, s), lerp(0, -.7, s)], ps: 1 });
};
ANIM.arcane.sit = t => { // Lotus, Tee-Schale mit beiden Händen, langsam
  const p = ANIM.arcane.idle(t), s = sip(t, 6, .45);
  return P(p, { hL: [.08, lerp(.82, 1.06, s), lerp(.34, .26, s)], hR: [-.08, lerp(.82, 1.06, s), lerp(.34, .26, s)], n: [lerp(.15, .32, s), 0, 0], c: [lerp(.04, -.06, s), 0, 0],
    pd: [0, lerp(1, .85, s), lerp(0, -.5, s)], ps: 1, ep: [1.1, .25, .35] });
};
// ── Blitz: aufgedrehtes Kind. Viel Batterie = zappelig, sprungbereit; wenig = schlapp und langsam. curM = Anzeige der Figur
let curM = .5;
export const setCurM = (m: number) => { curM = m; };
const snap = (x, k = 5) => Math.tanh(k * x);
ANIM.blitz = {
  idle: t => {
    const m = curM, f = 1.5 + 3.5 * m, b = Math.abs(Math.sin(t * Math.PI * f));
    const hi = P(N, {
      y: .9 + .06 * b, h: [0, .2 * snap(Math.sin(t * 2.3)), 0], c: [.18, .15 * Math.sin(t * 5.1), .06 * Math.sin(t * 9)],
      n: [-.12, .45 * snap(Math.sin(t * 1.9 + 1), 8), .15 * snap(Math.sin(t * 3.1), 6)],
      hL: [.34, 1.18 + .08 * Math.sin(t * f * 2), .3], hR: [-.34, 1.12 + .05 * Math.sin(t * f * 2 + 1), .25], b: [.1 * Math.sin(t * 4), 1, .1],
      fL: [.17, .06 + .08 * Math.max(0, Math.sin(t * f * 2)), .08], fR: [-.17, .06 + .08 * Math.max(0, -Math.sin(t * f * 2)), -.06]
    });
    const lo = P(N, { y: .95, c: [.32 + .03 * Math.sin(t), 0, .04 * Math.sin(t * .6)], n: [.28, .1 * Math.sin(t * .4), 0], hL: [.26, .82, .1], hR: [-.3, .95, .12], b: [0, 1, .08], fL: [.12, .06, 0], fR: [-.12, .06, 0] });
    return mix(lo, hi, m);
  },
  run: t => {
    const m = curM, ph = t * (7 + 5 * m), r = runBase(ph, .35 + .4 * m, .15 + .25 * m);
    return P(N, { y: .93 - .06 * Math.abs(r.c), h: [0, .2 * r.s, 0], c: [.15 + .35 * m, -.15 * r.s, 0], n: [-.1 - .3 * m, .1 * r.s, 0], fL: r.fL, fR: r.fR,
      hL: [.3, 1.05 + .2 * m * Math.max(0, r.s), -.1 + .45 * m * r.s], hR: [-.32, 1.1, .1 - .3 * m * r.s], b: [0, .8, .5] });
  },
  cast: { dur: 900, keys: () => {
    const I = ANIM.blitz.idle(0);
    const pull = P(I, { y: .88, c: [-.05, .45, 0], hL: [.42, 1.45, -.3], n: [-.1, -.2, 0] });
    const zap = P(I, { y: .86, c: [.3, -.4, 0], n: [-.15, .3, 0], hL: [.12, 1.42, .75], fL: [.2, .06, .35], fR: [-.15, .06, -.25] });
    return [[0, I], [.25, pull, 'out'], [.35, zap, 'out'], [.65, zap], [1, I]];
  } },
  chan: t => P(N, { y: .86 + .01 * Math.sin(t * 40), c: [.25, 0, .02 * Math.sin(t * 37)], n: [-.2, 0, 0], hL: [.15, 1.32, .62], hR: [-.15, 1.3, .6], b: [0, .3, 1], fL: [.24, .06, .25], fR: [-.24, .06, -.2] }),
  // Aufladen: Hand in den Himmel, nach 3 s schlägt ein Blitz ein
  sit: t => {
    const k = t % 4.4;
    const up = P(N, { y: .88, h: [0, -.1, 0], c: [-.15, -.1, .05], n: [-.6, 0, 0], hR: [-.12, 2.2, .05], b: [0, 1, 0], hL: [.4, .95, .15], fL: [.28, .06, .1], fR: [-.28, .06, -.08] });
    const jolt = P(up, { y: .78, c: [.1, -.1, 0], n: [-.3, 0, 0], hL: [.7, 1.6, .1] });
    const w = clamp(k / .5, 0, 1), vib = .012 * clamp(k / 3, 0, 1) * Math.sin(t * 60);
    let p = mix(ANIM.blitz.idle(t), up, inOut(w));
    if (k > 3) p = mix(jolt, up, clamp((k - 3.15) / .8, 0, 1));
    p.c[2] += vib; p.hR[0] += vib;
    return p;
  }
};
// ── Seuche: klebt, zerrinnt, Füße kleben bei jedem Schritt fest
ANIM.plague = {
  idle: t => {
    const buck = bump(t % 5.5, 3.6, 4.6, .4);
    return P(N, { y: .9 - .04 * (.5 + .5 * Math.sin(t * .8)) - .1 * buck, h: [0, 0, .04 * Math.sin(t * .7)], c: [.38 + .05 * Math.sin(t * .9), .1 * Math.sin(t * .5), .08 * Math.sin(t * .7)],
      n: [.35 + .12 * Math.sin(t * .9), .25 * Math.sin(t * .5), .28 * Math.sin(t * .6)], hL: [.3, .72 + .03 * Math.sin(t * 1.1), .16], hR: [-.3, .85, .2], b: [-.15, 1, .15],
      fL: [.15, .06, .02], fR: [-.15, .06, -.02] });
  },
  run: t => {
    const ph = t * 5, s = Math.sin(ph), c = Math.cos(ph), A = .32;
    // Schwungbein: hebt erst zäh ab (Faden), dann schnell
    const leg = (s, c, x) => {
      if (c > 0) { const u = (Math.atan2(s, c) + Math.PI / 2) / Math.PI;   // 0 … 1 über die Schwungphase
        return [x, .06 + .24 * Math.sin(Math.PI * u) * clamp((u - .12) / .25, 0, 1), A * s]; }
      return [x, .06, A * s];
    };
    return P(N, { y: .88 - .05 * Math.abs(c), h: [0, .12 * s, .1 * s], c: [.42, -.08 * s, .1 * s], n: [.25 + .1 * Math.sin(ph * 2 + .7), .15 * s, .15 * Math.sin(ph + .9)],
      hL: [.3, .78, .1 - .12 * s], hR: [-.3, .85, .15 + .1 * s], b: [-.1, .9, .4], fL: leg(s, c, .13), fR: leg(-s, -c, -.13) });
  },
  cast: { dur: 1200, keys: () => {
    const I = ANIM.plague.idle(0);
    const wind = P(I, { y: .92, c: [.05, .5, 0], hL: [.45, 1.6, -.3], n: [-.1, -.2, 0] });
    const fling = P(I, { y: .82, c: [.55, -.45, 0], n: [.1, .3, 0], hL: [.1, 1.1, .75], fL: [.18, .06, .35] });
    return [[0, I], [.35, wind, 'io'], [.5, fling, 'out'], [.75, fling], [1, I]];
  }, fling: .5 },
  chan: t => P(N, { y: .86, c: [.3, 0, .04 * Math.sin(t * 2)], n: [.1, 0, 0], hL: [.16, 1.2, .6], hR: [-.16, 1.2, .58], b: [0, .4, 1], fL: [.2, .06, .2], fR: [-.2, .06, -.15] }),
  sit: t => {
    const s = sip(t, 3.4, .4);
    return P(N, { ...STAFF_DOWN, y: .24, h: [-.08, 0, .06], c: [.4 - .45 * s, 0, .1], n: [.35 - .7 * s, .2, .2], fL: [.3, .06, .62], fR: [-.32, .06, .55],
      hR: [-.34, .3, .25], hL: [lerp(.3, .04, s), lerp(.55, 1.0, s), lerp(.4, .2, s)], pd: [0, lerp(1, -.4, s), lerp(0, -.9, s)], ps: 1 });
  }
};
ANIM.qm = ANIM.base;   // ?-Magier: Basis-Bewegungen, beim Trinken die des gewürfelten Getränks (anim.drinkSkin)
// Tod gibt es im Viewer nicht
export const DEAD = P(N, { y: .2, h: [-1.45, 0, 0], c: [-.05, .1, 0], n: [-.1, .3, 0], hL: [.62, .12, -.55], hR: [-.6, .12, -.3], b: [-.2, .05, 1], fL: [.3, .06, .9], fR: [-.28, .06, .96], sf: 0 });
export const airOf = (A, t) => P(A.run(0.3), { fL: [.16, .36, .18], fR: [-.16, .26, -.2] });
