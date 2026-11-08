// Die 15 Waffen aus dem Viewer „Stäbe & Klingen“ (Abschnitte 2, 3 und 5), Texte als Daten für die spätere UI.
// Ergänzt: id, gripY (Griffhöhe in Waffen-Koordinaten), cane (Stab stützt beim Gehen), pitch (Neigung in der Hand), fx.anchor (Leuchtpunkt).
// Alle Griff- und Haltungswerte sind // PH.

import * as THREE from 'three';
import { rng } from './textures';
import { rndDir } from './fx';
import { t } from '../../i18n';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Materialien: nur Beschreibungen, index.ts mergt sie in ein Lambert-Mesh mit Atlas. Rauheit und Bump fallen weg (Vanilla-Look).
const KINDS = {
  wood: { tex: 'wood' }, bark: { tex: 'bark' }, metal: { tex: 'metal' }, iron: { tex: 'metal' },
  rust: { tex: 'rust', colored: true }, patina: { tex: 'patina', colored: true },
  bone: { tex: 'bone' }, leather: { tex: 'leather' }, cloth: { tex: 'cloth' },
};
function S(kind, color = 0xffffff, o: any = {}) {
  const k = KINDS[kind];
  return { tex: k.tex, color: k.colored ? 0xffffff : color, rep: o.rep, rot: o.rot, double: o.side === THREE.DoubleSide, opacity: 1 };
}
const E = (c, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }); // leuchtet (Bloom ab 1,5, siehe render.ts)
const ICE = { tex: 'ice', color: 0xc4ecff, opacity: .72 };
const GLASS = { tex: 'white', color: 0xffffff, opacity: .6 };

// Geometrie-Helfer
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
function part(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}
function tube(g, pts, r, mat, seg = 8, rs = 5) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new (THREE.Vector3 as any)(...p)));
  const m = part(g, new THREE.TubeGeometry(c, seg, r, rs, false), mat); m.userData.curve = c; return m;
}
function gnarl(seed, y0, y1, wob, n = 8) {
  const r = rng(seed), a = [];
  for (let i = 0; i <= n; i++) { const k = (i === 0 || i === n) ? 0 : 1; a.push([(r() - .5) * wob * k, y0 + (y1 - y0) * i / n, (r() - .5) * wob * k]); }
  return a;
}
function wrap(g, y0, y1, r, mat, n, sh) {
  const h = (y1 - y0) / n, c = sh?.userData.curve, top = c ? c.points[c.points.length - 1].y : 1;
  for (let i = 0; i < n; i++) {
    const y = y0 + h * (i + .5), p = c ? c.getPoint(y / top) : { x: 0, z: 0 };
    part(g, cyl(r, r, h * .8, 6), mat, p.x, y, p.z, 0, 0, i % 2 ? .08 : -.08);
  }
}
function shp(pts) { const s = new THREE.Shape(); (s.moveTo as any)(...pts[0]); for (let i = 1; i < pts.length; i++) (s.lineTo as any)(...pts[i]); s.closePath(); return s; }
function ext(shape, depth, bevel = false) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel, bevelThickness: .008, bevelSize: .008, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2); return g;
}

export const WEAPONS: any[] = [];
const def = o => WEAPONS.push(o);

def({ id: 'pilgerast', gripY: 1.02, cane: true, pitch: .06, name: t('wmodel.pilgerast.name'), school: 'Alle', arch: 'Wanderstab des grauen Pilgers',
  story: t('wmodel.pilgerast.story'),
  read: 'Drei Äste schließen sich zu einer Krone, wie eine offene Hand um den Stein.',
  wear: 'Die Lederwicklung ist in Griffhöhe glatt gewetzt, der Fuß vom Gehen gesplittert.',
  fx: t('wmodel.pilgerast.fx'),
  build(g, fx) {
    const bark = S('bark', 0x8a6a4a, { rep: [6, 1], rot: true });
    const sh = tube(g, gnarl(11, 0, 1.52, .07), .03, bark, 16, 6);
    part(g, new THREE.IcosahedronGeometry(.045, 0), bark, 0, .02, 0).scale.set(1, 1.4, 1);
    wrap(g, .95, 1.18, .036, S('leather', 0x8a5a3a), 4, sh);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094, c = Math.cos(a), s = Math.sin(a);
      tube(g, [[0, 1.5], [.07, 1.62], [.12, 1.76], [.08, 1.9], [.025, 1.97]].map(([x, y]) => [x * c, y, x * s]), .017, bark, 8, 4);
    }
    fx.anchor(g, 0, 1.76, 0);
    const P = V(0, 1.76, 0);
    part(g, new THREE.IcosahedronGeometry(.055, 0), E(0xe4f4ff, 3), P.x, P.y, P.z);
    fx.halo(g, P, 0x9fd8ff, .35);
    fx.rays(g, P, 0x9fd8ff, .55, .12);
    fx.emit(g, { rate: 14, max: 90, life: [2, 3.5], size: [.022, 0], c0: [1.6, 2.4, 3.2], c1: [.2, .5, 1], gravity: .03, drag: .3,
      spawn: (R, p, v) => { rndDir(R, p).multiplyScalar(.05 + R() * .07); p.y += 1.76; rndDir(R, v).multiplyScalar(.05); v.y += .06; } });
    fx.emit(g, { rate: 3, max: 20, life: [1, 1.8], size: [.035, 0], c0: [2, 2.6, 3], c1: [.6, .9, 1.4], gravity: -.04, tex: 'spark',
      spawn: (R, p, v) => { const a = R() * 6.28; p.set(Math.cos(a) * .1, 1.85 + R() * .1, Math.sin(a) * .1); } });
  } });

def({ id: 'knoechelzweig', gripY: 0.055, cane: false, pitch: 0.95, name: t('wmodel.knoechelzweig.name'), school: 'Arkan', arch: 'Zauberstab des dunklen Lords',
  story: t('wmodel.knoechelzweig.story'),
  read: 'Ein Griff aus drei Knöcheln, die Spitze knickt ab und endet in einem Haken.',
  wear: 'Die Gelenkringe sind dunkel vom Schweiß und die Spitze ist leicht verzogen, weil er sich biegt, wenn der Träger zögert.',
  fx: t('wmodel.knoechelzweig.fx'),
  build(g, fx) {
    const bone = S('bone', 0xeadcbc, { rep: [1, 1] }), dark = S('iron', 0x5a4a3a);
    for (let i = 0; i < 3; i++) part(g, new THREE.IcosahedronGeometry(.02, 1), bone, 0, .02 + i * .034, 0).scale.set(1.1, .8, 1);
    part(g, cyl(.013, .013, .008, 6), dark, 0, .037, 0); part(g, cyl(.013, .013, .008, 6), dark, 0, .071, 0);
    part(g, cyl(.011, .015, .16, 6), bone, .004, .17, 0, 0, 0, -.04);
    part(g, cyl(.006, .011, .14, 6), bone, .012, .315, 0, 0, 0, -.1);
    tube(g, [[.019, .383, 0], [.026, .4, 0], [.018, .413, 0], [.009, .406, 0]], .004, bone, 6, 4);
    fx.anchor(g, .012, .408, 0);
    const tip = V(.012, .408, 0);
    part(g, new THREE.IcosahedronGeometry(.005, 0), E(0xc8a0ff, 4), tip.x, tip.y, tip.z);
    fx.arc(g, { a: () => tip, b: () => rndDir(Math.random, V()).multiplyScalar(.03 + Math.random() * .04).add(tip), color: [3, 1.6, 6], amp: .3, seg: 6, on: [.04, .09], off: [.15, 1] });
    fx.arc(g, { a: () => tip, b: () => rndDir(Math.random, V()).multiplyScalar(.03 + Math.random() * .03).add(tip), color: [2.5, 1.2, 5], amp: .3, seg: 6, on: [.04, .08], off: [.3, 1.4], branch: false });
    fx.emit(g, { rate: 22, max: 60, life: [.8, 1.5], size: [.008, .001], c0: [2.6, 1.3, 4.6], c1: [.4, .1, .9], drag: .5,
      spawn: (R, p, v) => { rndDir(R, p).multiplyScalar(.01).add(tip); rndDir(R, v).multiplyScalar(.03); v.y += .04; } });
    fx.emit(g, { rate: 10, max: 40, life: [1.2, 2], size: [.012, .04], c0: [.12, .04, .2], c1: [.04, .02, .06], alpha: .6, normal: true, tex: 'smoke',
      spawn: (R, p, v) => { p.set(.004 + (R() - .5) * .02, .08 + R() * .3, (R() - .5) * .02); v.set((R() - .5) * .02, .03, (R() - .5) * .02); } });
  } });

def({ id: 'grenzwaechter', gripY: .97, cane: true, pitch: .06, name: t('wmodel.grenzwaechter.name'), school: 'Frost', arch: 'Einfacher Stab aus der Questbelohnung',
  story: t('wmodel.grenzwaechter.story'),
  read: 'Gerade und symmetrisch: vier Eisenkrallen halten einen Eiskristall, dazu baumelt eine Marke.',
  wear: 'Sieben Kerben auf einer Seite, die Marke mit der Nummer hängt noch am Band.',
  fx: t('wmodel.grenzwaechter.fx'),
  build(g, fx) {
    const wood = S('wood', 0xa8733f, { rep: [1, 4] }), iron = S('iron', 0x7a7e86);
    part(g, cyl(.026, .03, 1.7, 6), wood, 0, .87, 0);
    part(g, new THREE.ConeGeometry(.031, .08, 6), iron, 0, -.01, 0, Math.PI);
    [.45, 1.05, 1.6].forEach(y => part(g, cyl(.034, .034, .04, 6), iron, 0, y, 0));
    const notch = S('wood', 0x2b1d12);
    for (let i = 0; i < 7; i++) part(g, new THREE.BoxGeometry(.012, .006, .02), notch, .025, 1.15 + i * .035, 0);
    part(g, cyl(.045, .028, .07, 6), iron, 0, 1.75, 0);
    const tips = [];
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      tube(g, [[c * .035, 1.77, s * .035], [c * .065, 1.85, s * .065], [c * .03, 1.94, s * .03]], .008, iron, 6, 4);
      tips.push(V(c * .065, 1.85, s * .065));
    }
    fx.anchor(g, 0, 1.86, 0);
    const P = V(0, 1.86, 0);
    part(g, new THREE.OctahedronGeometry(.052), E(0x9ee0ff, 3), P.x, P.y, P.z).scale.set(1, 1.5, 1);
    fx.halo(g, P, 0x6fc8ff, .3);
    part(g, new THREE.BoxGeometry(.008, .08, .004), S('leather', 0x5a3a22), .036, 1.55, 0);
    part(g, new THREE.BoxGeometry(.03, .04, .006), S('metal', 0xc0a868), .036, 1.5, 0);
    fx.emit(g, { rate: 14, max: 80, life: [2, 3.2], size: [.028, .018], c0: [2, 2.6, 3.2], c1: [.8, 1.2, 1.6], gravity: -.12, drag: .8, tex: 'flake',
      force: (p, v, i, dt, a, k) => { v[i] += Math.sin(a * 2 + k) * dt * .08; },
      spawn: (R, p, v) => { rndDir(R, p).multiplyScalar(.04 + R() * .08).add(P); rndDir(R, v).multiplyScalar(.06); } });
    fx.emit(g, { rate: 8, max: 20, life: [.2, .45], size: [.035, 0], c0: [3, 3.6, 4], c1: [1, 1.6, 2.4], tex: 'spark',
      spawn: (R, p) => p.copy(tips[Math.floor(R() * 4)]) });
    fx.emit(g, { rate: 6, max: 30, life: [1.4, 2.2], size: [.04, .11], c0: [.75, .9, 1], c1: [.5, .7, .9], alpha: .22, gravity: -.04, normal: true, tex: 'smoke',
      spawn: (R, p, v) => { rndDir(R, p).multiplyScalar(.05).add(P); v.y = -.05; } });
  } });

def({ id: 'schlachtblech', gripY: 0.24, cane: false, pitch: 0.75, name: t('wmodel.schlachtblech.name'), school: 'Alle', arch: 'Zu großes Schwert des schwarzen Söldners',
  story: t('wmodel.schlachtblech.story'),
  read: 'Eine rohe Platte, breiter als jede Klinge im Set. Die Scharten an den Kanten sieht man sogar in der Silhouette.',
  wear: 'Drei tiefe Scharten, Rost bis in die Kanten, Nieten aus Pflugeisen. Verziert ist nichts.',
  fx: t('wmodel.schlachtblech.fx'),
  build(g, fx) {
    const rust = S('rust', 0xffffff, { rep: [2, 2] }), riv = S('metal', 0x9a9ea4);
    part(g, new THREE.IcosahedronGeometry(.05, 0), S('rust', 0xffffff, { rep: [1, 1] }), 0, -.04, 0);
    part(g, cyl(.03, .032, .46, 6), S('leather', 0x5a4030, { rep: [1, 3] }), 0, .23, 0);
    part(g, new THREE.BoxGeometry(.4, .07, .09), S('rust', 0xffffff, { rep: [1, .3] }), 0, .49, 0);
    const blade = shp([[-.17, 0], [.17, 0], [.17, .42], [.14, .46], [.17, .5], [.17, .95], [.15, .99], [.13, 1.03], [.17, 1.06], [.17, 1.42], [.03, 1.62], [-.17, 1.5], [-.17, 1.2], [-.14, 1.17], [-.17, 1.14], [-.17, .7], [-.15, .67], [-.17, .64]]);
    part(g, ext(blade, .06), rust, 0, .525, 0);
    part(g, new THREE.BoxGeometry(.05, .95, .064), S('iron', 0x585b62, { rep: [1, 3] }), -.02, 1.1, 0);
    [[-.1, .62], [.1, .62], [-.1, .75], [.1, .75]].forEach(([x, y]) => { part(g, new THREE.IcosahedronGeometry(.015, 0), riv, x, y, .031); part(g, new THREE.IcosahedronGeometry(.015, 0), riv, x, y, -.031); });
    fx.anchor(g, .14, 1.555, 0);
    const chips = [V(.15, .985, 0), V(.14, 1.555, 0), V(-.15, 1.695, 0), V(-.155, 1.195, 0)];
    let cur = chips[0];
    const em = fx.emit(g, { burst: { every: [1.2, 3], count: 30 }, max: 80, life: [.3, .8], size: [.035, .006], c0: [4, 2.6, 1], c1: [1.6, .3, 0], gravity: -3, drag: .6, tex: 'spark',
      spawn: (R, p, v) => { p.copy(cur); v.set(Math.sign(cur.x) * (.4 + R()), .2 + R() * 1.2, (R() - .5) * .8); } });
    let prev = .5;
    fx.every(() => { if (em.burstT > prev) cur = chips[Math.floor(Math.random() * 4)]; prev = em.burstT; });
  } });

def({ id: 'runenzunge', gripY: 0.1, cane: false, pitch: 0.85, name: t('wmodel.runenzunge.name'), school: 'Arkan', arch: 'Magierklinge',
  story: t('wmodel.runenzunge.story'),
  read: 'Eine schmale, gerade Klinge mit einer Leuchtlinie, die mehrmals abreißt. Die Parierstange ist ein Halbmond.',
  wear: 'Die leuchtende Linie hat Lücken, und der Griff ist frisch neu gewickelt.',
  fx: t('wmodel.runenzunge.fx'),
  build(g, fx) {
    const brass = S('metal', 0xd0a650);
    part(g, new THREE.TorusGeometry(.03, .008, 4, 8), brass, 0, -.02, 0);
    part(g, cyl(.017, .019, .22, 6), S('leather', 0x3a4890, { rep: [1, 2] }), 0, .1, 0);
    part(g, new THREE.TorusGeometry(.09, .012, 4, 10, Math.PI), brass, 0, .3, 0, 0, 0, Math.PI);
    part(g, ext(shp([[-.035, 0], [.035, 0], [.03, .95], [0, 1.06], [-.03, .95]]), .012), S('metal', 0xd8dce6, { rep: [4, 4] }), 0, .22, 0);
    const runes = [[.05, .18], [.22, .3], [.34, .37], [.42, .58], [.66, .7], [.74, .86]].map(([a, b]) => {
      const m = part(g, new THREE.BoxGeometry(.008, b - a, .015), E(0xc49bff, 2), 0, .22 + (a + b) / 2, 0); m.userData.y = (a + b) / 2; return m;
    });
    const base = new THREE.Color(0xc49bff);
    fx.every((dt, t) => runes.forEach(r => r.material.color.copy(base).multiplyScalar(1.1 + 1.3 * Math.max(0, Math.sin(t * 3 - r.userData.y * 7)))));
    fx.anchor(g, 0, .82, 0);
    const onBlade = () => V((Math.random() - .5) * .05, .3 + Math.random() * .85, (Math.random() - .5) * .01);
    let A = V();
    const pick = () => (A = onBlade());
    fx.arc(g, { a: pick, b: () => V(A.x + (Math.random() - .5) * .1, A.y + .08 + Math.random() * .14, A.z), color: [2.6, 1.7, 5.5], amp: .25, seg: 8, on: [.04, .1], off: [.08, .5] });
    fx.emit(g, { rate: 16, max: 50, life: [.8, 1.4], size: [.012, 0], c0: [2.4, 1.6, 4.5], c1: [.5, .2, 1], drag: .4,
      spawn: (R, p, v) => { p.set(0, .25 + R() * .9, 0); v.set((R() - .5) * .12, .04, (R() - .5) * .12); } });
  } });

def({ id: 'glutrute', gripY: 1.0, cane: true, pitch: .06, name: t('wmodel.glutrute.name'), school: 'Feuer', arch: 'Feuerstab',
  story: t('wmodel.glutrute.story'),
  read: 'Ein schwarzer Stab mit fünf Krallen um eine glühende Kohle. Die Risse leuchten den ganzen Schaft entlang.',
  wear: 'Das Eisen ist rissig und verzundert, glatt ist es nirgends.',
  fx: t('wmodel.glutrute.fx'),
  build(g, fx) {
    const iron = S('iron', 0x4a3e38, { rep: [1, 4] });
    part(g, cyl(.022, .034, 1.68, 6), iron, 0, .84, 0);
    const crackM = E(0xff6a1a, 2), crackBase = new THREE.Color(0xff6a1a), r = rng(33);
    for (let i = 0; i < 14; i++) {
      const y = .15 + r() * 1.45, a = r() * 6.28, rr = .034 - .012 * (y / 1.68) + .002;
      part(g, new THREE.BoxGeometry(.006, .05 + r() * .06, .006), crackM, Math.cos(a) * rr, y, Math.sin(a) * rr, 0, -a, (r() - .5) * .6);
    }
    const claw = S('iron', 0x3a302c, { rep: [3, 1], rot: true });
    for (let k = 0; k < 5; k++) {
      const a = k * 1.2566, c = Math.cos(a), s = Math.sin(a);
      tube(g, [[c * .022, 1.68, s * .022], [c * .09, 1.78, s * .09], [c * .075, 1.9, s * .075], [c * .03, 1.96, s * .03]], .012, claw, 8, 4);
    }
    fx.anchor(g, 0, 1.82, 0);
    const P = V(0, 1.82, 0);
    part(g, new THREE.IcosahedronGeometry(.058, 0), E(0xffb050, 4), P.x, P.y, P.z);
    fx.every((dt, t) => crackM.color.copy(crackBase).multiplyScalar(1.6 + Math.sin(t * 2.3) * .7 + Math.sin(t * 11) * .2));
    fx.emit(g, { rate: 50, max: 70, life: [.45, .85], size: [.075, .012], c0: [1.5, .62, .12], c1: [.7, .06, 0], drag: 1.2,
      force: (p, v, i, dt) => { v[i] -= p[i] * dt * 2; v[i + 2] -= p[i + 2] * dt * 2; },
      spawn: (R, p, v) => { rndDir(R, p).multiplyScalar(.04).add(P); v.set((R() - .5) * .1, .35 + R() * .3, (R() - .5) * .1); } });
    fx.emit(g, { rate: 12, max: 40, life: [1, 2], size: [.016, .004], c0: [3.6, 1.6, .4], c1: [1, .15, 0], drag: .4, tex: 'spark', flicker: true,
      force: (p, v, i, dt, a, k) => { v[i] += Math.sin(a * 4 + k) * dt * .4; },
      spawn: (R, p, v) => { rndDir(R, p).multiplyScalar(.05).add(P); v.set((R() - .5) * .25, .4 + R() * .5, (R() - .5) * .25); } });
    fx.emit(g, { rate: 7, max: 30, life: [1.6, 2.6], size: [.06, .2], c0: [.12, .1, .09], c1: [.05, .05, .05], alpha: .45, normal: true, tex: 'smoke', drag: .3,
      spawn: (R, p, v) => { p.set((R() - .5) * .05, 1.98, (R() - .5) * .05); v.set((R() - .5) * .04, .22, (R() - .5) * .04); } });
  } });

def({ id: 'zirkelstab', gripY: 1.0, cane: true, pitch: .06, name: t('wmodel.zirkelstab.name'), school: 'Arkan', arch: 'Stab des Hofastronomen',
  story: t('wmodel.zirkelstab.story'),
  read: 'Der Kopf schwebt über dem Schaft: ein Prisma in drei Messingringen.',
  wear: 'Die Messingkappen sind poliert vom vielen Anfassen, das Holz ist dunkel vom Lampenöl.',
  fx: t('wmodel.zirkelstab.fx'),
  build(g, fx) {
    const brass = S('metal', 0xd8b05a);
    part(g, cyl(.02, .026, 1.72, 6), S('wood', 0x5a3a62, { rep: [1, 4] }), 0, .86, 0);
    part(g, cyl(.03, .03, .05, 6), brass, 0, .02, 0); part(g, cyl(.028, .02, .06, 6), brass, 0, 1.72, 0);
    const p = fx.dyn(part(g, new THREE.OctahedronGeometry(.06), E(0xd8b8ff, 3), 0, 1.95, 0)); p.scale.set(1, 2.2, 1);
    const rings = [0, 1, 2].map(i => fx.dyn(part(g, new THREE.TorusGeometry(.12 + i * .035, .007, 3, 18), brass, 0, 1.95, 0)));
    fx.anchor(p);
    const h = fx.halo(g, p.position, 0xb080ff, .35);
    const ringPt = () => { const r = rings[Math.floor(Math.random() * 3)], a = Math.random() * 6.28, rad = r.geometry.parameters.radius; return V(Math.cos(a) * rad, Math.sin(a) * rad, 0).applyEuler(r.rotation).add(r.position); };
    fx.arc(g, { a: () => p.position, b: ringPt, color: [3, 2.4, 6], amp: .18, seg: 8, on: [.05, .1], off: [.1, .6] });
    fx.arc(g, { a: () => p.position, b: ringPt, color: [2.4, 2.4, 6], amp: .18, seg: 8, on: [.04, .08], off: [.2, .9], branch: false });
    fx.emit(g, { rate: 10, max: 50, life: [2, 3.2], size: [.016, .004], c0: [2.6, 2, 4], c1: [.6, .4, 1], tex: 'spark',
      force: (q, v, i, dt) => { v[i] -= q[i] * dt * 1.8; v[i + 2] -= q[i + 2] * dt * 1.8; },
      spawn: (R, q, v) => { const a = R() * 6.28, r = .2 + R() * .1; q.set(Math.cos(a) * r, 1.95 + (R() - .5) * .25, Math.sin(a) * r); v.set(-Math.sin(a) * .26, (R() - .5) * .03, Math.cos(a) * .26); } });
    return t => {
      p.position.y = h.position.y = 1.95 + Math.sin(t * 1.5) * .02; p.rotation.y = t;
      rings.forEach((r, i) => { r.position.y = p.position.y; r.rotation.set(t * (.6 + i * .3), t * (.4 + i * .2) * (i % 2 ? -1 : 1), i * .7); });
    };
  } });

def({ id: 'lampenhaken', gripY: 1.0, cane: true, pitch: .06, name: t('wmodel.lampenhaken.name'), school: 'Feuer', arch: 'Laternenstab des Lichtbringers',
  story: t('wmodel.lampenhaken.story'),
  read: 'Oben ein Hirtenhaken, an dessen Ende eine Laterne pendelt. Die Form ist stark asymmetrisch.',
  wear: 'Das Holz unter dem Haken ist rußgeschwärzt, an der Laterne fehlt eine Scheibe.',
  fx: t('wmodel.lampenhaken.fx'),
  build(g, fx) {
    const wood = S('wood', 0x9a6a3e, { rep: [1, 4] }), metal = S('iron', 0x4a4a4a);
    part(g, cyl(.024, .028, 1.7, 6), wood, 0, .85, 0);
    part(g, new THREE.TorusGeometry(.13, .022, 5, 10, Math.PI), S('wood', 0x9a6a3e, { rep: [4, 1], rot: true }), .13, 1.7, 0);
    part(g, cyl(.02, .022, .06, 5), wood, .26, 1.67, 0);
    part(g, cyl(.03, .03, .12, 6), S('wood', 0x241e1a), .02, 1.58, 0);
    const pv = fx.pivot(g, .26, 1.64, 0);
    part(pv, new THREE.TorusGeometry(.012, .003, 3, 6), metal, 0, -.015, 0);
    part(pv, new THREE.TorusGeometry(.012, .003, 3, 6), metal, 0, -.037, 0, 0, Math.PI / 2);
    part(pv, new THREE.ConeGeometry(.06, .06, 4), metal, 0, -.08, 0, 0, Math.PI / 4);
    part(pv, cyl(.05, .05, .015, 4), metal, 0, -.22, 0, 0, Math.PI / 4);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => part(pv, new THREE.BoxGeometry(.006, .13, .006), metal, a * .033, -.15, b * .033));
    part(pv, new THREE.BoxGeometry(.06, .12, .06), GLASS, 0, -.15, 0);
    part(pv, new THREE.IcosahedronGeometry(.016, 0), E(0xffe2a0, 5), 0, -.18, 0);
    fx.halo(pv, V(0, -.16, 0), 0xffb060, .25);
    fx.emit(pv, { local: true, rate: 35, max: 30, life: [.25, .5], size: [.035, .008], c0: [3, 1.8, .6], c1: [1.5, .35, 0], drag: 1,
      spawn: (R, p, v) => { p.set((R() - .5) * .01, -.185, (R() - .5) * .01); v.set(0, .14 + R() * .06, 0); } });
    fx.anchor(pv, 0, -.18, 0);
    const C = V(.26, 1.49, 0);
    fx.emit(g, { rate: 3, max: 20, life: [3, 5], size: [.014, .014], c0: [2.6, 2.4, .6], c1: [2, 1.6, .3], flicker: true, tex: 'dot',
      force: (p, v, i, dt) => { v[i] += (Math.random() - .5) * dt * .6; v[i + 1] += (Math.random() - .5) * dt * .6; v[i + 2] += (Math.random() - .5) * dt * .6; v[i] *= .99; v[i + 1] *= .99; v[i + 2] *= .99; },
      spawn: (R, p, v) => { rndDir(R, p).multiplyScalar(.1 + R() * .25).add(C); rndDir(R, v).multiplyScalar(.04); } });
    return t => { pv.rotation.z = Math.sin(t * 1.4) * .1; };
  } });

def({ id: 'erntemond', gripY: 1.0, cane: true, pitch: .06, name: t('wmodel.erntemond.name'), school: 'Frost', arch: 'Sense des Totenbeschwörers',
  story: t('wmodel.erntemond.story'),
  read: 'Ein Halbmond-Blatt quer am Kopf und ein Dorn nach hinten. Die Form ist klar asymmetrisch.',
  wear: 'Die Klinge ist fleckig angelaufen, das Tuch ist ausgefranst und verblichen.',
  fx: t('wmodel.erntemond.fx'),
  build(g, fx) {
    tube(g, gnarl(55, 0, 1.86, .04), .024, S('bark', 0x5a554c, { rep: [6, 1], rot: true }), 12, 5);
    const iron = S('iron', 0x6d7078);
    part(g, cyl(.034, .034, .06, 6), iron, 0, 1.83, 0);
    const s = new THREE.Shape(); s.moveTo(0, .04); s.quadraticCurveTo(.42, .16, .78, -.22); s.quadraticCurveTo(.42, 0, 0, -.04);
    part(g, ext(s, .018), S('metal', 0xd0d6dc, { rep: [2, 2] }), 0, 1.84, 0);
    part(g, new THREE.ConeGeometry(.02, .12, 4), iron, -.08, 1.84, 0, 0, 0, Math.PI / 2);
    part(g, new THREE.IcosahedronGeometry(.022, 0), E(0x8cffc8, 3), 0, 1.84, .03);
    part(g, ext(shp([[0, 0], [.06, 0], [.07, -.18], [.05, -.14], [.04, -.22], [.02, -.16], [0, -.2]]), .004), S('cloth', 0x8a2e2e, { rep: [3, 3], side: THREE.DoubleSide }), .02, 1.7, .02);
    fx.anchor(g, 0, 1.84, .03);
    const edge = new THREE.Path(); edge.moveTo(0, .04); edge.quadraticCurveTo(.42, .16, .78, -.22);
    const pts = edge.getPoints(20).map(p => V(p.x, p.y + 1.84, 0));
    fx.emit(g, { rate: 16, max: 60, life: [1.5, 2.5], size: [.02, .05], c0: [.3, 1.5, .95], c1: [.03, .25, .2], drag: .3, tex: 'smoke',
      force: (p, v, i, dt, a, k) => { v[i] += Math.sin(a * 3 + k) * dt * .06; },
      spawn: (R, p, v) => { p.copy(pts[Math.floor(R() * pts.length)]); v.set((R() - .5) * .03, .1 + R() * .08, (R() - .5) * .03); } });
    fx.emit(g, { rate: 3, max: 10, life: [.8, 1.1], size: [.022, .012], c0: [1.8, 2.4, 3], c1: [.8, 1.2, 1.6], gravity: -.8, tex: 'flake',
      spawn: (R, p) => p.set(.77, 1.62, 0) });
  } });

def({ id: 'totenglocke', gripY: 1.02, cane: true, pitch: .06, name: t('wmodel.totenglocke.name'), school: 'Frost', arch: 'Stab des Seelenhirten',
  story: t('wmodel.totenglocke.story'),
  read: 'Ein Querbalken wie ein Galgen, an dessen Ende eine Glocke schwingt.',
  wear: 'Die Bronze hat grünen Grünspan angesetzt, an der Kette fehlt ein Glied, es wurde mit Draht ersetzt.',
  fx: t('wmodel.totenglocke.fx'),
  build(g, fx) {
    const wood = S('wood', 0x4a3c30, { rep: [1, 4] }), metal = S('iron', 0x5a5a56);
    part(g, cyl(.024, .028, 1.8, 6), wood, 0, .9, 0);
    part(g, new THREE.BoxGeometry(.36, .035, .035), S('wood', 0x4a3c30, { rep: [1, .3] }), .08, 1.78, 0);
    part(g, new THREE.ConeGeometry(.03, .08, 5), metal, 0, 1.84, 0);
    const pv = fx.pivot(g, .23, 1.76, 0);
    for (let i = 0; i < 3; i++) part(pv, new THREE.TorusGeometry(.012, .003, 3, 6), metal, 0, -.02 - i * .022, 0, 0, i % 2 ? Math.PI / 2 : 0);
    const prof = [[0, .22], [.04, .21], [.06, .16], [.065, .08], [.08, .02], [.11, -.01], [.1, -.015]].map(([x, y]) => new THREE.Vector2(x, y));
    part(pv, new THREE.LatheGeometry(prof, 8), S('patina', 0xffffff, { rep: [2, 1], side: THREE.DoubleSide }), 0, -.3, 0);
    part(pv, new THREE.IcosahedronGeometry(.02, 0), E(0x9fffe0, 3), 0, -.29, 0);
    fx.anchor(pv, 0, -.29, 0);
    const tmp = V();
    const mouth = R => tmp.set((R() - .5) * .16, -.31, (R() - .5) * .16).applyMatrix4(pv.matrix);
    fx.emit(g, { rate: 12, max: 60, life: [1.6, 2.6], size: [.04, .16], c0: [.6, .95, .9], c1: [.35, .55, .55], alpha: .3, gravity: -.03, normal: true, tex: 'smoke', drag: .4,
      spawn: (R, p, v) => { p.copy(mouth(R)); v.set((R() - .5) * .08, -.1, (R() - .5) * .08); } });
    fx.emit(g, { rate: 5, max: 20, life: [1.5, 2.5], size: [.014, 0], c0: [1, 3, 2.6], c1: [.2, .6, .6], tex: 'spark',
      spawn: (R, p, v) => { p.copy(mouth(R)); v.set(0, .12, 0); } });
    const ring = part(g, new THREE.TorusGeometry(.1, .004, 3, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fffe0).multiplyScalar(1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0, 0, Math.PI / 2);
    ring.userData.fxMesh = true;
    let last = 0;
    fx.every((dt, t) => {
      const k = Math.floor(t * 1.1 / Math.PI + .5);
      if (k !== last) { last = k; ring.userData.t0 = t; ring.position.copy(V(0, -.2, 0).applyMatrix4(pv.matrix)); }
      const a = t - (ring.userData.t0 ?? -9);
      ring.visible = a < 1.4; ring.scale.setScalar(1 + a * 4); ring.material.opacity = Math.max(0, 1 - a / 1.4);
    });
    return t => { pv.rotation.z = Math.sin(t * 1.1) * .18; };
  } });

def({ id: 'eidstumpf', gripY: 1, cane: true, pitch: .06, name: t('wmodel.eidstumpf.name'), school: 'Feuer', arch: 'Zerbrochenes Heldenschwert',
  story: t('wmodel.eidstumpf.story'),
  read: 'Eine Parierstange auf einem krummen Stock, darüber eine kurze Klinge mit gezackter Bruchkante.',
  wear: 'Das Seil ist mehrfach neu geknotet und der alte Griff ist neben den Stock gebunden. Den Stumpf hat nie jemand nachgeschliffen.',
  fx: t('wmodel.eidstumpf.fx'),
  build(g, fx) {
    const sh = tube(g, gnarl(77, 0, 1.5, .03), .026, S('bark', 0x8a6844, { rep: [6, 1], rot: true }), 12, 5);
    wrap(g, 1.28, 1.52, .033, S('cloth', 0xc8ac78, { rep: [1, 2] }), 6, sh);
    part(g, cyl(.016, .016, .22, 6), S('leather', 0x4a3424), .04, 1.4, 0);
    const steel = S('metal', 0xb0b6be, { rep: [3, 3] });
    part(g, new THREE.BoxGeometry(.34, .035, .05), steel, 0, 1.54, 0);
    [-1, 1].forEach(d => part(g, new THREE.ConeGeometry(.018, .06, 4), steel, d * .17, 1.52, 0, 0, 0, Math.PI));
    part(g, ext(shp([[-.045, 0], [.045, 0], [.04, .3], [.022, .27], [.012, .37], [-.008, .31], [-.022, .345], [-.04, .3]]), .016), steel, 0, 1.557, 0);
    const brk = [[.04, .3], [.022, .27], [.012, .37], [-.008, .31], [-.022, .345], [-.04, .3]].map(([x, y]) => V(x, y + 1.557, 0));
    brk.slice(0, -1).forEach((a, i) => { const b = brk[i + 1], m = part(g, new THREE.BoxGeometry(a.distanceTo(b), .005, .018), E(0xffc860, 3), (a.x + b.x) / 2, (a.y + b.y) / 2, 0); m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x); });
    const shard = fx.dyn(part(g, new THREE.OctahedronGeometry(.016), E(0xffd27a, 4), .005, 1.98, 0));
    fx.anchor(shard);
    fx.rays(g, V(0, 1.93, -.01), 0xffc060, .7, -.1);
    fx.arc(g, { a: () => brk[Math.floor(Math.random() * brk.length)], b: () => shard.position, color: [5, 3.6, 1.2], amp: .2, seg: 8, on: [.04, .1], off: [.1, .6] });
    fx.emit(g, { rate: 10, max: 40, life: [1, 2], size: [.014, 0], c0: [3.6, 2.6, .8], c1: [1, .4, 0], drag: .3, tex: 'spark', flicker: true,
      spawn: (R, p, v) => { p.copy(brk[Math.floor(R() * brk.length)]); v.set((R() - .5) * .08, .12 + R() * .1, (R() - .5) * .08); } });
    return t => { shard.position.y = 1.98 + Math.sin(t * 2) * .015; shard.rotation.y = t * 2; };
  } });

def({ id: 'tidenast', gripY: 1, cane: true, pitch: .06, name: t('wmodel.tidenast.name'), school: 'Frost', arch: 'Stab der Gezeitenpriesterin',
  story: t('wmodel.tidenast.story'),
  read: 'Ein krummes, bleiches Holz, aus dem Korallen-Dornen wachsen. Oben sitzt eine schiefe Schnecke.',
  wear: 'Das Holz ist salzgebleicht, die Korallen wachsen kreuz und quer und folgen keinem Muster.',
  fx: t('wmodel.tidenast.fx'),
  build(g, fx) {
    const sh = tube(g, gnarl(91, 0, 1.6, .09, 10), .03, S('bark', 0xc4c8be, { rep: [6, 1], rot: true }), 18, 5), curve = sh.userData.curve;
    const r = rng(92), cols = [0xf08a78, 0x5fc8b8, 0xe8d088].map(c => S('bone', c));
    for (let i = 0; i < 9; i++) {
      const p = curve.getPointAt(.15 + r() * .7), a = r() * 6.28;
      part(g, new THREE.ConeGeometry(.012, .06 + r() * .05, 4), cols[i % 3], p.x + Math.cos(a) * .035, p.y, p.z + Math.sin(a) * .035, Math.sin(a), 0, -Math.cos(a));
    }
    part(g, new THREE.ConeGeometry(.07, .22, 7), S('bone', 0xf4e2c8), .03, 1.71, 0, 0, 0, -.5);
    part(g, new THREE.TorusGeometry(.06, .015, 4, 8), S('bone', 0xd8c4a4), -.015, 1.62, 0, Math.PI / 2, 0, -.5);
    fx.anchor(g, -.02, 1.6, .02);
    const P = V(-.02, 1.6, .02);
    part(g, new THREE.IcosahedronGeometry(.026, 1), E(0xd8f0ff, 1.5), P.x, P.y, P.z);
    fx.halo(g, P, 0x8fd0ff, .12);
    fx.emit(g, { rate: 9, max: 50, life: [2, 3.2], size: [.018, .03], c0: [1, 1.6, 2.1], c1: [.5, .9, 1.3], alpha: .9, tex: 'ring',
      force: (p, v, i, dt, a, k) => { v[i] += Math.sin(a * 6 + k) * dt * .12; },
      spawn: (R, p, v) => { const q = R() < .3 ? P : curve.getPointAt(R() * .95); p.set(q.x + (R() - .5) * .05, q.y, q.z + (R() - .5) * .05); v.set(0, .1 + R() * .08, 0); } });
    fx.emit(g, { rate: 3, max: 10, life: [.6, .9], size: [.012, .01], c0: [1.2, 1.8, 2.4], c1: [.6, 1, 1.4], gravity: -1.4,
      spawn: (R, p) => p.set(-.04 + (R() - .5) * .06, 1.6, (R() - .5) * .06) });
  } });

def({ id: 'kammerschluessel', gripY: 1.08, cane: true, pitch: .06, name: t('wmodel.kammerschluessel.name'), school: 'Arkan', arch: 'Schlüssel der verbotenen Bibliothek',
  story: t('wmodel.kammerschluessel.story'),
  read: 'Ein riesiger Schlüssel als Stab: Oben ist der Ring mit dem Auge, unten der Bart mit den Zähnen.',
  wear: 'Der Bart ist abgegriffen, als hätte jemand tausend Schlösser ausprobiert.',
  fx: t('wmodel.kammerschluessel.fx'),
  build(g, fx) {
    const metal = S('metal', 0xa88850, { rep: [1, 4] }), dark = S('iron', 0x5a4a30);
    part(g, cyl(.03, .03, 1.62, 6), metal, 0, .91, 0);
    [.42, 1.0, 1.62].forEach(y => part(g, cyl(.042, .042, .05, 6), dark, 0, y, 0));
    const bit = S('metal', 0xa88850, { rep: [2, 2] });
    part(g, new THREE.BoxGeometry(.14, .24, .035), bit, .1, .2, 0);
    part(g, new THREE.BoxGeometry(.045, .05, .035), bit, .19, .1, 0);
    part(g, new THREE.BoxGeometry(.045, .08, .035), bit, .19, .26, 0);
    part(g, new THREE.BoxGeometry(.03, .1, .037), dark, .1, .2, 0);
    part(g, cyl(.04, .04, .04, 6), dark, 0, .1, 0);
    part(g, cyl(.035, .035, .05, 6), dark, 0, 1.73, 0);
    part(g, new THREE.TorusGeometry(.13, .028, 6, 12), S('metal', 0xa88850, { rep: [4, 1] }), 0, 1.88, 0);
    part(g, new THREE.TorusGeometry(.07, .012, 4, 10), dark, 0, 1.88, 0);
    const eye = fx.dyn(part(g, new THREE.IcosahedronGeometry(.04, 1), E(0xffe08a, 2.5), 0, 1.88, 0));
    fx.anchor(eye);
    const pupil = new THREE.MeshBasicMaterial({ color: 0x120a02 });
    [-1, 1].forEach(d => part(eye, new THREE.BoxGeometry(.01, .05, .004), pupil, 0, 0, d * .041));
    fx.rays(g, V(0, 1.88, -.02), 0xffc860, .75, .12);
    fx.emit(g, { rate: 12, max: 50, life: [2, 3], size: [.012, .004], c0: [3, 2.4, 1], c1: [1, .6, .1], tex: 'spark',
      force: (p, v, i, dt) => { v[i] -= p[i] * dt * 1.6; v[i + 1] -= (p[i + 1] - 1.88) * dt * 1.6; },
      spawn: (R, p, v) => { const a = R() * 6.28, r = .2 + R() * .04; p.set(Math.cos(a) * r, 1.88 + Math.sin(a) * r, (R() - .5) * .04); v.set(-Math.sin(a) * .25, Math.cos(a) * .25, 0); } });
    return t => { const s = 1 + Math.sin(t * 1.7) * .08; eye.scale.setScalar(s); eye.rotation.y = Math.sin(t * .7) * .6; eye.rotation.x = Math.sin(t * .43) * .3; };
  } });

def({ id: 'sandwender', gripY: 1, cane: true, pitch: .06, name: t('wmodel.sandwender.name'), school: 'Arkan', arch: 'Stab des Zeitmagiers',
  story: t('wmodel.sandwender.story'),
  read: 'Eine Sanduhr in einem Messingrahmen sitzt auf einem geraden Schaft. Der Kopf ist breit, flach und symmetrisch.',
  wear: 'Das Glas ist matt, auf dem Rahmen sind Striche eingeritzt, einer für jede zurückgeholte Minute.',
  fx: t('wmodel.sandwender.fx'),
  build(g, fx) {
    const brass = S('metal', 0xd0a048);
    part(g, cyl(.024, .028, 1.62, 6), S('wood', 0x6a4a36, { rep: [1, 4] }), 0, .81, 0);
    part(g, cyl(.045, .03, .05, 6), brass, 0, 1.64, 0);
    const hg = fx.pivot(g, 0, 1.8, 0);
    part(hg, cyl(.08, .08, .02, 6), brass, 0, .14, 0); part(hg, cyl(.08, .08, .02, 6), brass, 0, -.14, 0);
    for (let k = 0; k < 3; k++) { const a = k * 2.094; part(hg, cyl(.006, .006, .28, 4), brass, Math.cos(a) * .07, 0, Math.sin(a) * .07); }
    part(hg, new THREE.ConeGeometry(.065, .13, 6), GLASS, 0, .065, 0, Math.PI);
    part(hg, new THREE.ConeGeometry(.065, .13, 6), GLASS, 0, -.065, 0);
    fx.anchor(hg);
    const sandM = E(0xffd08a, 1.3);
    const A = fx.dyn(part(hg, new THREE.ConeGeometry(.05, .06, 6), sandM, 0, -.1, 0));   // unten (Haufen)
    const B = fx.dyn(part(hg, new THREE.ConeGeometry(.05, .06, 6), sandM, 0, .1, 0, Math.PI)); // oben (Trichter)
    const stream = fx.emit(g, { local: true, rate: 40, max: 20, life: [.14, .2], size: [.008, .006], c0: [2.6, 1.9, .9], c1: [2.2, 1.6, .7], gravity: -1,
      spawn: (R, p, v) => { p.set((R() - .5) * .003, 1.8, (R() - .5) * .003); v.set(0, -.2, 0); } });
    fx.emit(g, { rate: 14, max: 60, life: [2, 3], size: [.011, .003], c0: [2.6, 2, .8], c1: [1, .6, .1], tex: 'spark',
      force: (p, v, i, dt) => { v[i] -= p[i] * dt * 2; v[i + 2] -= p[i + 2] * dt * 2; },
      spawn: (R, p, v) => { const a = R() * 6.28, r = .13 + R() * .04; p.set(Math.cos(a) * r, 1.95, Math.sin(a) * r); v.set(-Math.sin(a) * .3, -.08, Math.cos(a) * .3); } });
    return t => {
      const n = Math.floor(t / 8), ph = t % 8, e = ph > 6 ? (1 - Math.cos((ph - 6) / 2 * Math.PI)) / 2 : 0;
      hg.rotation.z = (n + e) * Math.PI;
      const f = Math.min(1, ph / 6), lo = n % 2 ? B : A, hi = n % 2 ? A : B;
      lo.scale.setScalar(.15 + .85 * f); hi.scale.setScalar(.15 + .85 * (1 - f));
      stream.c.rate = ph < 6 ? 40 : 0;
    };
  } });

def({ id: 'frostzahn', gripY: 0.12, cane: false, pitch: 0.85, name: t('wmodel.frostzahn.name'), school: 'Frost', arch: 'Eisklinge des Nordens',
  story: t('wmodel.frostzahn.story'),
  read: 'Ein gebogener Zahn statt einer geraden Klinge, darunter eine Parierstange aus Eisdornen.',
  wear: 'Am Griff ist noch das Fell des Wurmjägers, die Dornen sind unterschiedlich lang nachgewachsen.',
  fx: t('wmodel.frostzahn.fx'),
  build(g, fx) {
    part(g, new THREE.IcosahedronGeometry(.035, 0), ICE, 0, -.02, 0);
    part(g, cyl(.02, .022, .24, 6), S('cloth', 0xe0e4e8, { rep: [2, 1] }), 0, .12, 0);
    [.04, .12, .2].forEach(y => part(g, cyl(.024, .024, .015, 6), S('leather', 0x6a6f76), 0, y, 0));
    [[1, .14], [-1, .1]].forEach(([d, l]) => part(g, new THREE.ConeGeometry(.018, l, 4), ICE, d * .065, .27, 0, 0, 0, -d * (Math.PI / 2 - .35)));
    [[1, .07], [-1, .09]].forEach(([d, l]) => part(g, new THREE.ConeGeometry(.014, l, 4), ICE, 0, .27, d * .04, d * (Math.PI / 2 - .4), 0, 0));
    const s = new THREE.Shape(); s.moveTo(-.045, 0); s.quadraticCurveTo(-.07, .55, .07, 1.0); s.quadraticCurveTo(.11, .5, .045, 0);
    part(g, ext(s, .03, true), ICE, 0, .27, 0);
    part(g, new THREE.BoxGeometry(.012, .55, .008), E(0xbfefff, 1.6), .01, .52, 0, 0, 0, -.06);
    fx.anchor(g, .01, .82, 0);
    const center = (t, out) => out.set(2 * (1 - t) * t * .015 + t * t * .07, .27 + 2 * (1 - t) * t * .52 + t * t * 1.0, 0);
    fx.emit(g, { rate: 18, max: 80, life: [1.5, 2.5], size: [.03, .11], c0: [.85, .95, 1], c1: [.55, .75, .95], alpha: .28, gravity: -.05, normal: true, tex: 'smoke', drag: .4,
      spawn: (R, p, v) => { center(R() * .95, p); p.x += (R() - .5) * .06; v.set((R() - .5) * .04, -.03, (R() - .5) * .04); } });
    fx.emit(g, { rate: 10, max: 20, life: [.2, .5], size: [.03, 0], c0: [3, 3.5, 4], c1: [1, 1.6, 2.4], tex: 'spark',
      spawn: (R, p) => { center(R() * .98, p); p.x += (R() - .5) * .07; p.z = (R() < .5 ? -1 : 1) * .017; } });
    fx.emit(g, { rate: 4, max: 30, life: [2.5, 3.5], size: [.022, .016], c0: [1.8, 2.2, 2.8], c1: [.7, 1, 1.4], gravity: -.08, drag: .6, tex: 'flake',
      spawn: (R, p) => { p.set((R() - .5) * .5, 1.35 + R() * .1, (R() - .5) * .3); } });
  } });
