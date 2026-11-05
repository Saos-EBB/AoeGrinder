// Boss-Modelle aus dem Boss-Viewer: biped, quadruped, maggot, blob, lavaTorso, spider (stick nur für den Viewer-Spieler, hier nicht gebraucht).
// Gebaut wie die Mobs (models/creatures.ts): Teile hängen an Gelenk-Gruppen, Farben über M() als Vertex-Farben, Leuchtteile über glowMat.
// finish() verschmilzt alles zu einem SkinnedMesh pro Material: ein Boss sind 2–4 Draw Calls plus Schatten.
// Die Pose steuert boss.ts über model.ctl: arms (Ausholen, Bogenmaß), lean (Kippen nach vorn), dragon (Drachenarm sichtbar).

import * as THREE from 'three';
import { joint } from '../util';
import { M, glowMat, finish } from '../models/creatures';

const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d), Sp = (r, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
const Cy = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s), Ko = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
function put(par, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; }
// Leuchtfarbe für Augen und Glühen: HDR, damit der Bloom greift
const glow = (hex, k = 2.2) => { const c = new THREE.Color(hex); return glowMat(+(c.r * k).toFixed(2), +(c.g * k).toFixed(2), +(c.b * k).toFixed(2)); };

function ctxOf(P) {
  const side = { side: THREE.DoubleSide };
  const Md = c => { const m = M(c); m.side = THREE.DoubleSide; return m; };
  const glowC = P.glow ?? P.eye ?? 0xffcc66;
  void side;
  return {
    skin: M(P.skin ?? 0x8a7a6a), armor: Md(P.armor ?? 0x4a4a52), acc: Md(P.accent ?? 0x8a2a22), eye: glow(P.eye ?? glowC), glow: glow(glowC, 1.4), dark: M(0x1a1418),
    metal: P.weaponGlow ? glow(P.weaponGlow, .9) : M(P.metal ?? 0xb8b8c0), wood: M(P.wood ?? 0x5a3a22), Md, M,
  };
}

function weapon(type, x) {
  const g = new THREE.Group(); const { metal, wood } = x;
  switch (type) {
    case 'club': put(g, Cy(.08, .24, 1.4), wood, 0, -.7, 0); break;
    case 'sword': put(g, Bx(.07, 1.5, .22), metal, 0, -.95, 0); put(g, Bx(.5, .08, .12), wood, 0, -.2, 0); break;
    case 'greatsword': put(g, Bx(.12, 2.7, .48), metal, 0, -1.55, 0); put(g, Bx(.85, .1, .16), wood, 0, -.2, 0); break;
    case 'spear': put(g, Cy(.05, .05, 3.2), wood, 0, -1.0, 0); { const t = put(g, Ko(.14, .6), metal, 0, -2.85, 0); t.rotation.x = Math.PI; } break;
    case 'hammer': put(g, Cy(.07, .07, 1.9), wood, 0, -.95, 0); put(g, Bx(.9, .55, .55), metal, 0, -1.9, 0); break;
    case 'axe': put(g, Cy(.06, .06, 1.8), wood, 0, -.9, 0); put(g, Bx(.09, .8, .7), metal, 0, -1.55, .32); break;
    case 'katana': put(g, Bx(.05, 1.35, .1), metal, 0, -.85, 0); put(g, Cy(.1, .1, .03, 10), wood, 0, -.15, 0); break;
    case 'needle': put(g, Cy(.025, .06, 1.8), metal, 0, -.9, 0); break;
    case 'hook': put(g, Cy(.05, .05, .5), wood, 0, -.25, 0); { const h = put(g, new THREE.TorusGeometry(.32, .06, 6, 14, Math.PI * 1.3), metal, 0, -.75, 0); h.rotation.y = Math.PI / 2; } break;
    case 'staff': put(g, Cy(.05, .06, 2.3), wood, 0, -1.1, 0); put(g, Sp(.2), x.glow, 0, -2.3, 0); break;
    case 'scythe': put(g, Cy(.05, .05, 2.4), wood, 0, -1.1, 0); put(g, Bx(.06, .18, 1.2), metal, 0, -2.25, .55); break;
  }
  g.rotation.x = type === 'staff' ? Math.PI * .92 : -0.9;
  return g;
}

function headOf(h, type, P, x) {
  const { skin, armor, acc, eye, dark } = x;
  const eyes = (z = .27, y = 0, sp = .11, r = .055) => { put(h, Sp(r, 6, 5), eye, -sp, y, z); put(h, Sp(r, 6, 5), eye, sp, y, z); };
  switch (type) {
    case 'gnoll': { const s = put(h, Sp(.32), skin); s.scale.y = 1.05; put(h, Bx(.24, .22, .42), skin, 0, -.06, .32); put(h, Sp(.07, 6, 5), dark, 0, -.02, .54); put(h, Ko(.09, .3), skin, -.2, .3, 0); put(h, Ko(.09, .3), skin, .2, .3, 0); eyes(.25, .06, .12); break; }
    case 'helm': put(h, Bx(.52, .58, .56), armor); put(h, Bx(.38, .06, .02), eye, 0, .02, .29); break;
    case 'skull': put(h, Sp(.31), M(0xd8cfb4)); eyes(.25, .03, .11, .07); break;
    case 'crown': put(h, Sp(.3), skin); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(h, Ko(.06, .24, 5), M(0xd8b04a), Math.cos(a) * .24, .32, Math.sin(a) * .24); } eyes(); break;
    case 'horns': put(h, Sp(.31), skin); { const a = put(h, Ko(.09, .7), dark, -.24, .3, 0); a.rotation.z = .7; const b = put(h, Ko(.09, .7), dark, .24, .3, 0); b.rotation.z = -.7; } eyes(); break;
    case 'hood': put(h, Ko(.42, .85), armor, 0, .1, -.02); put(h, Sp(.24), M(0x050407), 0, -.02, .07); eyes(.27, 0, .09); break;
    case 'lich': put(h, Bx(.52, .6, .56), armor); for (let i = -2; i <= 2; i++) put(h, Ko(.06, .38, 5), armor, i * .11, .45, 0); put(h, Bx(.38, .07, .02), eye, 0, .02, .29); break;
    case 'mask': { const s = put(h, Sp(.3), M(0xf2ede4)); s.scale.set(1, 1.15, .9); put(h, Sp(.07, 6, 5), dark, -.11, 0, .25); put(h, Sp(.07, 6, 5), dark, .11, 0, .25); const a = put(h, Ko(.06, .55), M(0xf2ede4), -.14, .5, 0); a.rotation.z = .25; const b = put(h, Ko(.06, .55), M(0xf2ede4), .14, .5, 0); b.rotation.z = -.25; break; }
    case 'lion': put(h, Bx(.52, .58, .6), armor); put(h, Bx(.38, .06, .02), eye, 0, .02, .31); { const p = put(h, Ko(.12, .6), acc, 0, .5, -.1); p.rotation.x = -.5; } break;
    default: put(h, Sp(.31), skin); eyes();
  }
  if (P.redHair) { const hr = put(h, Ko(.3, 1.4, 8), M(0xb8261a), 0, -.55, -.2); hr.rotation.x = Math.PI - .15; }
  if (P.tusks) { put(h, Ko(.05, .2), M(0xe8e0c8), -.1, -.18, .25); put(h, Ko(.05, .2), M(0xe8e0c8), .1, -.18, .25); }
}

function biped(root, P) {
  const x = ctxOf(P), b = P.bulk ?? 1, parts: any = {};
  const body = joint(root);
  if (P.float) put(body, Ko(.8 * b, 1.4, 10), x.armor, 0, .95, 0);
  else for (const s of [-1, 1]) { put(body, Bx(.32 * b, 1.0, .38), x.armor, s * .24 * b, .5, 0); put(body, Bx(.36 * b, .16, .5), x.acc, s * .24 * b, .08, .05); }
  put(body, Bx(.8 * b, .3, .45), x.armor, 0, 1.05, 0);
  put(body, Bx(.95 * b, .85, .55), x.armor, 0, 1.6, 0);
  if (P.belly) { const bl = put(body, Sp(.68 * b, 12, 10), x.skin, 0, 1.35, .18); bl.scale.set(1, .9, .95); }
  if (P.pauldrons !== false) for (const s of [-1, 1]) { const p = put(body, Sp(.28 * b), x.acc, s * .6 * b, 2.0, 0); p.scale.set(1.15, .7, 1.15); }
  if (P.cape) { const c = put(body, new THREE.PlaneGeometry(1.1 * b, 1.9), x.Md(P.cape), 0, 1.15, -.33); c.rotation.x = .1; }
  if (P.wings) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.2, 1.2); sh.lineTo(1.9, -.4); sh.lineTo(1.2, -1.4); sh.lineTo(0, -.4);
    for (const s of [-1, 1]) { const w = put(body, new THREE.ShapeGeometry(sh), x.Md(P.wings), s * .2, 2.0, -.32); w.scale.set(s * 1.1, 1.1, 1); w.rotation.y = s * -.45; }
  }
  if (P.coils) for (const s of [-1, 1]) { put(body, Cy(.12, .16, 1.1), x.armor, s * .32 * b, 2.4, -.35); put(body, Sp(.2), x.glow, s * .32 * b, 3.05, -.35); }
  const head = joint(body, 0, 2.33, 0); headOf(head, P.head ?? 'bare', P, x); parts.head = head;
  for (const s of [1, -1]) {
    const a = joint(body, s * .62 * b, 1.95, 0);
    put(a, Bx(.27 * b, .95, .29), x.skin, 0, -.45, 0);
    if (s === -1 && P.dragonArm) { put(a, Bx(.42, .42, .62), x.acc, 0, -1.05, .12); put(a, Sp(.06, 6, 5), x.eye, -.12, -.9, .38); put(a, Sp(.06, 6, 5), x.eye, .12, -.9, .38); }
    else put(a, Sp(.17 * b), s === -1 && P.prosthetic ? M(0xd8b04a) : x.skin, 0, -.95, 0);
    const wt = s === 1 ? P.weapon : P.weapon2;
    if (wt && wt !== 'none') { const w = weapon(wt, x); w.position.set(0, -.95, 0); a.add(w); }
    parts[s === 1 ? 'armR' : 'armL'] = a;
  }
  parts.twoHand = (P.weapon2 && P.weapon2 !== 'none') || ['greatsword', 'hammer', 'axe'].includes(P.weapon);
  parts.body = body;
  return { parts, h: 2.7 };
}

function quadruped(root, P) {
  const x = ctxOf(P), parts: any = {};
  const body = joint(root);
  put(body, Bx(1.0, .9, 2.2), x.skin, 0, 1.45, 0); put(body, Sp(.72), x.skin, 0, 1.55, .8); put(body, Sp(.62), x.skin, 0, 1.45, -.8);
  parts.legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = joint(body, sx * .38, 1.32, sz * .8); put(l, Cy(.16, .12, 1.35), x.skin, 0, -.67, 0); parts.legs.push(l); }
  { const n = put(body, Bx(.45, .45, .85), x.skin, 0, 1.95, 1.25); n.rotation.x = -.6; }
  const heads = P.heads ?? 1, hg = joint(body, 0, 2.3, 1.65); parts.head = hg;
  for (let i = 0; i < heads; i++) {
    const hh = joint(hg, heads > 1 ? (i - .5) * .7 : 0, 0, 0);
    put(hh, Bx(.56, .5, .72), x.skin); put(hh, Bx(.36, .28, .55), x.skin, 0, -.08, .58); put(hh, Sp(.06, 6, 5), x.eye, -.14, .08, .36); put(hh, Sp(.06, 6, 5), x.eye, .14, .08, .36);
    if (P.horns) { const a = put(hh, Ko(.08, .6), x.dark, -.2, .38, -.1); a.rotation.x = -.6; const b = put(hh, Ko(.08, .6), x.dark, .2, .38, -.1); b.rotation.x = -.6; }
    else { put(hh, Ko(.1, .3), x.skin, -.18, .33, -.1); put(hh, Ko(.1, .3), x.skin, .18, .33, -.1); }
  }
  { const t = put(body, Cy(.09, .04, 1.3), x.skin, 0, 1.55, -1.7); t.rotation.x = -.9; }
  if (P.swordInMouth) put(hg, Bx(2.8, .09, .4), x.metal, 1.15, -.12, .62);
  if (P.wings) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.4, 1.0); sh.lineTo(1.6, -.8); sh.lineTo(0, -.3); for (const s of [-1, 1]) { const w = put(body, new THREE.ShapeGeometry(sh), x.Md(P.wings), s * .4, 2.0, .2); w.scale.set(s, 1, 1); w.rotation.y = s * -.3; } }
  parts.body = body;
  return { parts, h: 2.6 };
}

function maggot(root, P) {
  const x = ctxOf(P), parts: any = {};
  const body = joint(root);
  for (let i = 0; i < 5; i++) { const r = 1.0 - i * .12; const s = put(body, Sp(r, 12, 10), x.skin, 0, r, -i * 1.15); s.scale.z = 1.1; }
  const hd = joint(body, 0, 1.15, 1.0); parts.head = hd; put(hd, Sp(.62), x.armor); put(hd, Sp(.07, 6, 5), x.eye, -.2, .15, .55); put(hd, Sp(.07, 6, 5), x.eye, .2, .15, .55);
  { const m1 = put(hd, Ko(.08, .5), x.dark, -.22, -.25, .5); m1.rotation.x = 1.8; const m2 = put(hd, Ko(.08, .5), x.dark, .22, -.25, .5); m2.rotation.x = 1.8; }
  for (const s of [1, -1]) { const a = joint(body, s * .95, 1.5, .6); put(a, Bx(.32, 1.5, .32), x.armor, 0, -.7, 0); const t = put(a, Ko(.2, .7), x.acc, 0, -1.75, 0); t.rotation.x = Math.PI; a.userData.rest = -1.1; parts[s === 1 ? 'armR' : 'armL'] = a; }
  parts.twoHand = true; parts.body = body;
  return { parts, h: 2.2 };
}

function blob(root, P) {
  const x = ctxOf(P), parts: any = { tentacles: [] };
  const body = joint(root);
  const bd = put(body, Sp(2.1, 18, 14), x.skin, 0, 2.5, 0); bd.scale.y = 1.05;
  const eh = joint(body, 0, 2.7, 1.75); parts.head = eh; put(eh, Sp(.75, 14, 10), M(0xeee6cc)); put(eh, Sp(.36, 10, 8), x.eye, 0, 0, .55);
  for (let i = 0; i < 7; i++) { const a = i * 1.3 + .4, y = 1.4 + ((i * 37) % 10) / 6; put(body, Sp(.16, 6, 5), x.eye, Math.sin(a) * 2.0, y + .6, Math.cos(a) * 1.95); }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, t = joint(body, Math.sin(a) * 1.9, .7, Math.cos(a) * 1.9); t.rotation.y = a; t.userData.ph = i;
    let p = t; const segs = [];
    for (let j = 0; j < 4; j++) { const seg = joint(p, 0, j ? 1.0 : 0, 0); put(seg, Ko(.32 - j * .06, 1.1), x.armor, 0, .5, 0); segs.push(seg); p = seg; }
    parts.tentacles.push(segs);
  }
  parts.body = body;
  return { parts, h: 4.5, float: true };
}

function lavaTorso(root, P) {
  const x = ctxOf(P), parts: any = {};
  const body = joint(root), lava = glow(0xff6a1a, 1.6);
  put(root, new THREE.CircleGeometry(3.4 * .9, 32).rotateX(-Math.PI / 2), lava, 0, .03, 0);   // Lavasee um ihn
  put(body, Cy(1.15, .7, 2.6, 10), x.skin, 0, 1.3, 0); put(body, Bx(2.0, 1.0, 1.1), x.armor, 0, 2.6, 0);
  for (const s of [-1, 1]) { const p = put(body, Sp(.55), x.acc, s * 1.15, 3.0, 0); p.scale.y = .7; }
  const hd = joint(body, 0, 3.6, .05); parts.head = hd; put(hd, Sp(.55), x.skin); put(hd, Sp(.08, 6, 5), x.eye, -.18, .05, .48); put(hd, Sp(.08, 6, 5), x.eye, .18, .05, .48);
  { const a = put(hd, Ko(.13, 1.0), x.dark, -.42, .45, 0); a.rotation.z = .8; const b = put(hd, Ko(.13, 1.0), x.dark, .42, .45, 0); b.rotation.z = -.8; }
  for (let i = 0; i < 5; i++) { const f = put(hd, Ko(.1, .6, 5), lava, (i - 2) * .13, -.55, .35); f.rotation.x = Math.PI; }
  for (const s of [1, -1]) {
    const a = joint(body, s * 1.25, 2.9, 0); put(a, Bx(.5, 1.4, .5), x.skin, 0, -.7, 0); put(a, Sp(.3), x.skin, 0, -1.45, 0);
    if (s === 1) { const w = weapon('hammer', x); w.scale.setScalar(1.7); w.position.y = -1.45; a.add(w); }
    parts[s === 1 ? 'armR' : 'armL'] = a;
  }
  parts.twoHand = true; parts.body = body;
  return { parts, h: 4.2 };
}

function spider(root, P) {
  const x = ctxOf(P), parts: any = {};
  const body = joint(root);
  const ab = put(body, Sp(1.35, 14, 10), x.skin, 0, 1.5, -1.0); ab.scale.set(1, .8, 1.3);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const l = put(body, Cy(.11, .08, 2.6), x.armor, s * 1.45, .95, -.3 - i * .8); l.rotation.z = s * .8; l.rotation.x = (i - 1) * .25; }
  put(body, Bx(1.35, 1.2, .85), x.armor, 0, 2.7, 0);
  const hd = joint(body, 0, 3.6, 0); parts.head = hd; put(hd, Sp(.45), x.skin); put(hd, Sp(.07, 6, 5), x.eye, -.15, .05, .4); put(hd, Sp(.07, 6, 5), x.eye, .15, .05, .4);
  { const a = put(hd, Ko(.1, .8), x.dark, -.3, .4, 0); a.rotation.z = .6; const b = put(hd, Ko(.1, .8), x.dark, .3, .4, 0); b.rotation.z = -.6; }
  for (const s of [1, -1]) { const a = joint(body, s * .85, 3.15, 0); put(a, Bx(.32, 1.1, .32), x.skin, 0, -.5, 0); put(a, Sp(.22), x.glow, 0, -1.1, 0); parts[s === 1 ? 'armR' : 'armL'] = a; }
  parts.twoHand = true; parts.body = body;
  return { parts, h: 4 };
}

const BUILD = { biped, quadruped, maggot, blob, lavaTorso, spider };

// Modell eines Boss-Körpers: { root, update(dt, anim), height, ctl, parts }. spec = { t, p } aus dem Roster
export function buildBossModel(spec) {
  const root = new THREE.Group();
  const { parts, h, float } = BUILD[spec.t](root, spec.p);
  const sc = spec.p.scale ?? 1.6, isFloat = !!spec.p.float || !!float;
  const ctl = { arms: 0, lean: 0 };
  let T = Math.random() * 9, walk = 0;
  const armRest = a => a?.userData.rest ?? 0;
  // level 23: finish skaliert dann genau mit sc (Mob-Größe nach Level gilt für Bosse nicht)
  const model: any = finish(root, (dt, a) => {
    const s = dt / 1000;
    T += s;
    const b = parts.body;
    b.position.y = isFloat ? .3 + Math.sin(T * 2) * .12 : 0;
    b.rotation.x = ctl.lean;
    if (parts.armR) parts.armR.rotation.x = armRest(parts.armR) + ctl.arms;
    if (parts.armL) parts.armL.rotation.x = armRest(parts.armL) + (parts.twoHand ? ctl.arms : 0);
    if (a.state === 'run') { walk += s * (a.speed ?? 5) * 1.2; if (!isFloat) b.position.y = Math.abs(Math.sin(walk)) * .08; }
    if (parts.legs) parts.legs.forEach((l, i) => { l.rotation.x = a.state === 'run' ? Math.sin(walk + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * .5 : 0; });
    if (parts.tentacles) parts.tentacles.forEach((segs, i) => segs.forEach((seg, j) => { seg.rotation.x = Math.sin(T * 1.6 + i + j) * .18; }));
  }, 23, [sc, sc, sc], [2.2 / sc * 1.6, 3.2 / sc * 1.6, 2.2 / sc * 1.6], 1.4);
  model.ctl = ctl;
  model.parts = parts;
  model.height = h * sc;
  model.float = isFloat;
  return model;
}
