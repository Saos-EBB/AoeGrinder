// Posen des Strichkriegers (KOMP-04): Schlüssel-Posen aus dem Viewer, Mischen, Lauf-Zyklus. Aus strichKrieger.ts herausgezogen, Werte unverändert.
// Pose: y Hüfthöhe, h/c/n Hüfte/Brust/Hals (Euler), hR/hL Hände, b Klingenrichtung, e Schneide, fL/fR Füße, g Griff links (hL: 'G' = an den Griff)
import { lerpTo as lerp, inOut, outC } from '../../util';

const inC = t => t * t * t;
export const EASE = { io: inOut, out: outC, in: inC, lin: t => t };

export function mix(a, b, u) {
  const o: any = {};
  for (const k of KEYS) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u);
  return o;
}
export const P = (base, o = {}) => Object.assign({}, base, o);
export const KEYS = ['y', 'h', 'c', 'n', 'hL', 'hR', 'b', 'e', 'fL', 'fR', 'g'];
export const IDLE = { y: .93, h: [0, .2, 0], c: [.3, -.1, 0], n: [.05, .1, 0], hR: [-.36, 1.62, .22], hL: [.48, 1.05, .2],
  b: [-.12, .45, -.88], e: [0, 1, 0], fL: [.3, .07, .26], fR: [-.3, .07, -.28] };
export const Q_END = [
  P(IDLE, { y: .78, h: [0, .7, 0], c: [.6, .55, 0], n: [-.3, -.3, 0], hR: [.3, .98, .7], hL: 'G', b: [.55, -.55, .62], e: [.7, -.7, 0], fL: [.32, .07, -.1], fR: [-.28, .07, .55] }),
  P(IDLE, { y: .8, h: [0, -.6, 0], c: [.35, -.75, 0], n: [-.2, .4, 0], hR: [-.78, 1.3, .38], hL: [.5, 1.25, -.2], b: [-.95, .05, .28], e: [0, 0, -1], fL: [.35, .07, .4], fR: [-.35, .07, -.2] }),
  P(IDLE, { y: 1.02, h: [0, -.2, 0], c: [-.2, -.2, 0], n: [-.35, .1, 0], hR: [-.1, 2.05, .35], hL: 'G', b: [0, .85, .5], e: [0, .3, -1], fL: [.28, .07, .1], fR: [-.3, .07, .35] }),
  P(IDLE, { y: .6, h: [0, 0, 0], c: [.75, 0, 0], n: [-.6, 0, 0], hR: [0, .82, .8], hL: 'G', b: [0, -.72, .7], e: [0, -1, 0], fL: [.4, .07, .3], fR: [-.4, .07, -.35] })
];
export const SIT = { y: .32, h: [-.1, .15, 0], c: [.2, -.1, 0], n: [.1, 0, 0], hR: [-.55, 1.0, .25], b: [0, -1, .05], e: [0, 0, 1], hL: [.35, .75, .4], fL: [.42, .07, .75], fR: [-.3, .07, .45] };
export const DEAD = { y: .24, h: [-1.45, 0, 0], c: [-.05, .1, 0], n: [-.1, .3, 0], hR: [-.75, .18, -.2], hL: [.7, .14, -.6], b: [-.5, -.02, .85], e: [0, 1, 0], fL: [.32, .07, .98], fR: [-.3, .07, 1.02] };
export function runPose(ph) {
const s = Math.sin(ph), c = Math.cos(ph);
return {
  y: .95 - .07 * Math.abs(c), h: [.15, .2 * s, 0], c: [.55, -.15 * s, 0], n: [-.25, .1 * s, 0],
  hR: [-.5, .98, -.32], b: [-.22, -.55, -.8], e: [0, 0, -1],
  hL: [.4, 1.25 + .1 * s, .35 * s], fL: [.15, .07 + .32 * Math.max(0, c), .65 * s], fR: [-.15, .07 + .32 * Math.max(0, -c), -.65 * s]
};
}
