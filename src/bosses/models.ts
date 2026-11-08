// Boss-Modelle aus dem Boss-Viewer (Version 1794166146-2db2): biped, quadruped, maggot, blob, lavaTorso, spider, crystal (stick nur für den Viewer-Spieler, hier nicht gebraucht).
// Gebaut wie die Mobs (models/creatures.ts): Teile hängen an Gelenk-Gruppen, Farben über M() als Vertex-Farben, Leuchtteile über glowMat.
// Viewer-Materialien mit Eigenleuchten: ab Stärke .9 Leuchtmaterial (glow), schwächer als normale Farbe (verschmilzt mit dem Körper, kein extra Draw Call).
// finish() verschmilzt alles zu einem SkinnedMesh pro Material, mergeGlow() danach alle Leuchtteile zu einem (Farbe als Vertex-Farbe):
// ein Boss sind 2–3 Draw Calls (Körper, doppelseitige Teile, Leuchten).
// Die Pose steuert boss.ts über model.ctl: arms (Ausholen, Bogenmaß), lean (Kippen nach vorn), dragon (Drachenarm sichtbar).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
    // Viewer-Material M(c, emissive, Stärke) → Spiel: ab .9 leuchtend, sonst Farbe (ds: doppelseitig)
    em: (c, e = 0, i = 0, ds = false) => i >= .9 ? glow(c, i) : ds ? Md(c) : M(c),
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
    case 'mace': put(g, Cy(.06, .06, 1.3), wood, 0, -.65, 0); put(g, Sp(.32, 8, 6), metal, 0, -1.4, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, sp = put(g, Ko(.07, .28, 4), metal, Math.cos(a) * .34, -1.4, Math.sin(a) * .34); sp.rotation.z = -Math.PI / 2; sp.rotation.y = -a; } break;
    case 'curved': put(g, Bx(.12, 1.6, .5), metal, 0, -1.0, 0); { const t = put(g, Bx(.12, 1.3, .5), metal, 0, -2.25, .28); t.rotation.x = .45; } put(g, Bx(.8, .1, .16), wood, 0, -.2, 0); break;
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
    case 'demonQueen': put(h, Sp(.3), skin); eyes(); for (const s of [-1, 1]) { const a = put(h, Ko(.08, .9), dark, s * .2, .35, -.25); a.rotation.x = -1.0; a.rotation.z = s * -.3; } for (let i = -1; i <= 1; i++) put(h, Ko(.05, .25, 4), acc, i * .12, .34, .05); break;
    case 'roundHelm': { const s = put(h, Sp(.46, 12, 10), armor); s.scale.y = .95; put(h, Bx(.5, .07, .05), eye, 0, 0, .42); break; }
    case 'weaver': { const s = put(h, Sp(.3), M(0xf2ede4)); s.scale.set(.85, 1.25, .9); for (const [px, py] of [[-.1, .06], [.1, .06], [-.07, -.08], [.07, -.08]]) put(h, Sp(.045, 6, 5), dark, px, py, .25); for (const s2 of [-1, 1]) { const a = put(h, Cy(.012, .012, .6, 4), dark, s2 * .1, .55, -.05); a.rotation.z = s2 * -.35; } break; }
    case 'brain': put(h, Sp(.22), skin); eyes(.19, 0, .08, .04); { const br = put(h, Sp(.5, 12, 10), x.glow, 0, .48, 0); br.scale.set(1.15, .8, 1); for (let i = -1; i <= 1; i++) { const r = put(h, new THREE.TorusGeometry(.42, .025, 4, 20, Math.PI), dark, 0, .48, i * .15); r.rotation.y = Math.PI / 2; } } break;
    case 'ashKing': put(h, Sp(.3), skin); eyes(); { const bd = put(h, Ko(.22, .5, 6), M(0xc8c0b0), 0, -.35, .12); bd.rotation.x = Math.PI; } for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; put(h, Ko(.05, .12 + ((i * 3) % 4) * .06, 4), M(0x7a6a3a), Math.cos(a) * .24, .32, Math.sin(a) * .24); } break;
    case 'iceCrown': put(h, Bx(.5, .56, .54), armor); put(h, Bx(.36, .06, .02), eye, 0, .02, .28); { const im = x.em(0xbfe8ff, 0x4ab0ff, .5); for (let i = -3; i <= 3; i++) { const c = put(h, Ko(.06, .35 + (3 - Math.abs(i)) * .12, 4), im, i * .08, .42 + (3 - Math.abs(i)) * .05, 0); c.rotation.z = i * -.12; } } break;
    case 'mane': put(h, Sp(.3), skin); eyes(); { const mm = M(0xc8402a); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; put(h, Sp(.2, 6, 5), mm, Math.cos(a) * .33, .05 + Math.sin(a) * .33, -.12); } put(h, Sp(.3, 8, 6), mm, 0, .12, -.22); } break;
    case 'starHood': put(h, Ko(.44, .95), armor, 0, .12, -.02); put(h, Sp(.25), M(0x05070f), 0, -.02, .08); for (const [px, py, c] of [[-.08, .04, 0xffffff], [.07, -.05, 0x6ab0ff], [.02, .1, 0xffffff], [-.03, -.1, 0x6ab0ff], [.1, .08, 0xffffff]]) put(h, Sp(.025, 5, 4), x.em(c, c, 2), px, py, .31); break;
    case 'porcelain': { const s = put(h, Sp(.3), M(0xe8e0d0)); s.scale.set(.9, 1.15, .9); put(h, Bx(.11, .035, .02), dark, -.1, .04, .27); put(h, Bx(.11, .035, .02), dark, .1, .04, .27); put(h, Bx(.13, .025, .02), dark, 0, -.15, .27); eyes(.28, .03, .1, .03); put(h, Ko(.4, .55), armor, 0, .34, -.06); break; }
    case 'candles': { put(h, Sp(.28), skin); eyes(.25, .02, .1, .045); put(h, new THREE.TorusGeometry(.26, .03, 5, 20).rotateX(Math.PI / 2), x.em(0xd8b04a, 0x3a2a00, .4), 0, .26, 0); for (let i = -2; i <= 2; i++) { const z = -.02 - Math.abs(i) * .04; put(h, Cy(.035, .035, .18 + (2 - Math.abs(i)) * .06, 6), M(0xe8dcc0), i * .1, .38 + (2 - Math.abs(i)) * .03, z); put(h, Ko(.035, .1, 5), x.glow, i * .1, .54 + (2 - Math.abs(i)) * .06, z); } break; }
    default: put(h, Sp(.31), skin); eyes();
  }
  if (P.redHair) { const hr = put(h, Ko(.3, 1.4, 8), M(0xb8261a), 0, -.55, -.2); hr.rotation.x = Math.PI - .15; }
  if (P.wildMane) { const wm = M(0x0e0c10); for (let i = 0; i < 11; i++) { const a = (i / 10 - .5) * Math.PI * 1.4, sp = put(h, Ko(.08, .55, 4), wm, Math.sin(a) * .3, .15 + Math.cos(a) * .2, -.18); sp.rotation.z = -a * .9; sp.rotation.x = -.5; } }
  if (P.flameCrown) { const fm = x.em(0xff7a2a, 0xff4a00, 1.4); for (let i = -2; i <= 2; i++) put(h, Ko(.06, .3 + (2 - Math.abs(i)) * .12, 5), fm, i * .1, .42 + (2 - Math.abs(i)) * .04, 0); }
  if (P.tusks) { put(h, Ko(.05, .2), M(0xe8e0c8), -.1, -.18, .25); put(h, Ko(.05, .2), M(0xe8e0c8), .1, -.18, .25); }
}

function biped(root, P) {
  const x = ctxOf(P), b = P.bulk ?? 1, parts: any = {};
  const body = joint(root);
  if (P.float) {
    const r = put(body, P.gown ? Ko(1.2 * b, 2.0, 12) : Ko(.8 * b, 1.4, 10), x.armor, 0, P.gown ? 1.0 : .95, 0);
    if (P.wisp) { r.rotation.x = Math.PI; r.scale.set(.7, 1.3, .7); r.position.y = .6; }
  }
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
  if (P.roundBody) { const rb = put(body, Sp(.78 * b, 14, 10), x.armor, 0, 1.5, 0); rb.scale.set(1, 1.05, .9); }
  if (P.thorns) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, y = .4 + (i % 3) * .4, r = (1.25 - y * .45) * b, t = put(body, Ko(.06, .35, 4), x.acc, Math.cos(a) * r, y, Math.sin(a) * r); t.rotation.z = -Math.cos(a) * 1.2; t.rotation.x = Math.sin(a) * 1.2; }
  if (P.lantern) { put(body, Bx(.22, .32, .22), M(0x7a6a3a), .55 * b, .95, .3); put(body, Sp(.1, 6, 5), x.glow, .55 * b, .95, .3); }
  if (P.insectLegs) for (const s of [-1, 1]) for (const z of [-.15, .15]) { const l = put(body, Cy(.03, .02, 1.1, 4), x.dark, s * .45, .55, z); l.rotation.z = s * .6; }
  if (P.spool) { const sp = put(body, new THREE.TorusGeometry(.18, .08, 6, 14), M(0xf2ede4), -.5 * b, .95, .25); sp.rotation.y = Math.PI / 2; }
  if (P.embers) for (let i = 0; i < 12; i++) { const a = i * 2.4; put(body, Sp(.05, 4, 3), x.glow, Math.cos(a) * (1 + i % 3 * .3), .6 + ((i * 7) % 10) * .22, Math.sin(a) * (1 + i % 3 * .3)); }
  if (P.skullPads) { const sk = M(0xd8d0c0); for (const s of [-1, 1]) { put(body, Sp(.17, 7, 6), sk, s * .68 * b, 2.05, .15); for (let i = 0; i < 3; i++) { const sp = put(body, Ko(.06, .45, 4), x.armor, s * (.6 + i * .08) * b, 2.25, -.1 + i * .08); sp.rotation.z = s * -.5; } } }
  if (P.rocks) { const rm = x.em(0x7a6a8a, 0x4a2a7a, .4); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3; put(body, new THREE.DodecahedronGeometry(.18 + (i % 3) * .08), rm, Math.cos(a) * 1.9, .8 + (i % 3) * .9, Math.sin(a) * 1.9); } }
  if (P.bloom) { const pm = x.em(0xd0203a, 0x8a0010, .5, true); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, p = put(body, Sp(.32, 8, 6), pm, Math.cos(a) * .42, 1.85 + Math.sin(a) * .42, -.42); p.scale.set(.55, 1.1, .18); p.rotation.z = a - Math.PI / 2; } put(body, Sp(.15, 6, 5), x.em(0xffd060, 0xffa000, 1), 0, 1.85, -.45); }
  if (P.runeRings) for (const [y, tl] of [[1.2, .25], [2.0, -.3]]) { const r = put(body, new THREE.TorusGeometry(1.15, .035, 4, 40), x.glow, 0, y, 0); r.rotation.x = Math.PI / 2 + tl; }
  if (P.emberCracks) { const cm = x.em(0xff8a30, 0xff6a00, 1.4); for (const [cx, cy, rz, l] of [[-.2, 1.75, .6, .45], [.15, 1.5, -.4, .5], [.05, 1.25, .9, .3], [-.25, 1.4, -.2, .3]]) { const c = put(body, Bx(.04, l, .02), cm, cx * b, cy, .29); c.rotation.z = rz; } }
  // Seelen: dunkel mit rotem Eigenleuchten (Viewer 0x2a0a0e, Leuchten 0xff2a2a ×.5) → schwaches rotes Leuchtmaterial
  if (P.souls) { const sm = glow(0xff2a2a, .5); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; put(body, Sp(.22, 8, 6), sm, Math.cos(a) * 2.2, 1.4 + (i % 2) * .8, Math.sin(a) * 2.2); } }
  if (P.iceSpikes) { const im = x.em(P.iceSpikes, P.iceSpikes, .5); for (let i = 0; i < 7; i++) { const sp = put(body, Ko(.17 + .05 * (i % 2), 1.05 + .35 * (i % 3), 5), im, (i - 3) * .16 * b, 2.35 - Math.abs(i - 3) * .1, -.42); sp.rotation.x = -.55; sp.rotation.z = (i - 3) * -.18; } }
  if (P.collar) for (let i = 0; i < 7; i++) { const a = (i / 6 - .5) * 2.4, sp = put(body, Ko(.08, .95, 4), x.acc, Math.sin(a) * .42, 2.55, -Math.cos(a) * .28 - .05); sp.rotation.x = -.3; sp.rotation.z = -Math.sin(a) * .45; }
  if (P.halo) { put(body, new THREE.TorusGeometry(.62, .06, 6, 28), x.glow, 0, 2.4, -.38); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = put(body, Ko(.06, .3, 4), x.glow, Math.cos(a) * .8, 2.4 + Math.sin(a) * .8, -.38); r.rotation.z = a - Math.PI / 2; } }
  if (P.stole) { const sm = M(P.stole); for (const s of [-1, 1]) put(body, Bx(.14, 1.4, .04), sm, s * .16, 1.35, .29); }
  // Lache unter ihr: am Wurzel-Gelenk wie Ragnaros' Lavasee, kippt nicht mit dem Körper
  if (P.puddle) put(root, new THREE.CircleGeometry(2.4 * .9, 32).rotateX(-Math.PI / 2), x.em(P.puddle, P.puddle, .15), 0, .03, 0);
  const head = joint(body, 0, 2.33, 0); headOf(head, P.head ?? 'bare', P, x); parts.head = head;
  for (const s of [1, -1]) {
    const a = joint(body, s * .62 * b, 1.95, 0);
    put(a, Bx(.27 * b, .95, .29), x.skin, 0, -.45, 0);
    if (s === -1 && P.dragonArm) { put(a, Bx(.42, .42, .62), x.acc, 0, -1.05, .12); put(a, Sp(.06, 6, 5), x.eye, -.12, -.9, .38); put(a, Sp(.06, 6, 5), x.eye, .12, -.9, .38); }
    else put(a, Sp(.17 * b), s === -1 && P.prosthetic ? M(0xd8b04a) : x.skin, 0, -.95, 0);
    const wt = s === 1 ? P.weapon : P.weapon2;
    if (wt && wt !== 'none') { const w = weapon(wt, x); w.position.set(0, -.95, 0); a.add(w); }
    if (s === -1 && P.book) { put(a, Bx(.42, .52, .12), M(0x3a2a1a), 0, -1.2, .12); put(a, Bx(.02, .52, .13), M(0xb08a3a), 0, -1.2, .12); }
    const orb = s === 1 ? P.orbR : P.orbL;
    if (orb) put(a, Sp(.2, 8, 6), x.em(orb, orb, 1.6), 0, -1.18, .05);
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
    const hs = P.headColors ? M(P.headColors[i]) : x.skin;
    put(hh, Bx(.56, .5, .72), hs); put(hh, Bx(.36, .28, .55), hs, 0, -.08, .58); put(hh, Sp(.06, 6, 5), x.eye, -.14, .08, .36); put(hh, Sp(.06, 6, 5), x.eye, .14, .08, .36);
    if (P.horns) { const a = put(hh, Ko(.08, .6), x.dark, -.2, .38, -.1); a.rotation.x = -.6; const b = put(hh, Ko(.08, .6), x.dark, .2, .38, -.1); b.rotation.x = -.6; }
    else { put(hh, Ko(.1, .3), x.skin, -.18, .33, -.1); put(hh, Ko(.1, .3), x.skin, .18, .33, -.1); }
  }
  { const t = put(body, Cy(.09, .04, 1.3), x.skin, 0, 1.55, -1.7); t.rotation.x = -.9; }
  if (P.swordInMouth) put(hg, Bx(2.8, .09, .4), x.metal, 1.15, -.12, .62);
  if (P.spine) { const sm = x.em(P.spine, P.spine, .3); for (let i = 0; i < 7; i++) put(body, Ko(.12, .45 - Math.abs(i - 3) * .05, 4), sm, 0, 2.05, 1.0 - i * .4); }
  if (P.ribs) { const bm = M(P.ribs); for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { const r = put(body, Bx(.07, .85, .1), bm, sx * .53, 1.42, .65 - i * .3); r.rotation.z = sx * .15; } }
  if (P.mane) { const fm = x.em(P.mane, P.mane, 1.6); for (let i = 0; i < 9; i++) { const f = put(body, Ko(.17, i % 3 === 1 ? .85 : .55, 5), fm, i % 2 ? -.13 : .13, 2.0 + (i < 3 ? .3 : 0) - i * .03, 1.25 - i * .3); f.rotation.x = -.55; } const tf = put(body, Ko(.2, .7, 5), fm, 0, 2.05, -2.15); tf.rotation.x = -.9; }
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
  if (P.cracks) for (const [cx, cy, rz, l] of [[-.5, 1.0, .5, .9], [.4, 1.4, -.4, .8], [0, 2.0, .1, .6], [-.6, 2.6, 1.2, .7], [.6, 2.7, -1.1, .6]]) { const c = put(body, Bx(.08, l, .04), lava, cx, cy, cy < 2.1 ? .85 : .56); c.rotation.z = rz; }
  if (P.lavaCrown) for (let i = -2; i <= 2; i++) put(hd, Ko(.08, .35 + (2 - Math.abs(i)) * .15, 5), lava, i * .14, .5 + (2 - Math.abs(i)) * .05, -.05);
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
  if (P.bellyMouth) {
    const mm = x.em(P.bellyMouth, P.bellyMouth, 1.2), m = put(body, Sp(.42, 12, 8), mm, 0, 2.45, .4); m.scale.set(1.2, .45, .25);
    for (let i = -3; i <= 3; i++) { const t = put(body, Ko(.05, .18, 4), M(0xe8e0c8), i * .12, 2.62, .47); t.rotation.x = Math.PI; }
    put(body, Sp(.18, 8, 6), mm, 0, 2.95, .43);
  }
  const hd = joint(body, 0, 3.6, 0); parts.head = hd; put(hd, Sp(.45), x.skin); put(hd, Sp(.07, 6, 5), x.eye, -.15, .05, .4); put(hd, Sp(.07, 6, 5), x.eye, .15, .05, .4);
  { const a = put(hd, Ko(.1, .8), x.dark, -.3, .4, 0); a.rotation.z = .6; const b = put(hd, Ko(.1, .8), x.dark, .3, .4, 0); b.rotation.z = -.6; }
  for (const s of [1, -1]) { const a = joint(body, s * .85, 3.15, 0); put(a, Bx(.32, 1.1, .32), x.skin, 0, -.5, 0); put(a, Sp(.22), x.glow, 0, -1.1, 0); parts[s === 1 ? 'armR' : 'armL'] = a; }
  parts.twoHand = true; parts.body = body;
  return { parts, h: 4 };
}

// Kristall-Wesen (Shazzrah): Oktaeder-Kern, schwebende Splitter, Arme aus Kristall
function crystal(root, P) {
  const x = ctxOf(P), parts: any = {};
  const body = joint(root);
  const core = put(body, new THREE.OctahedronGeometry(.9), x.armor, 0, 2.0, 0); core.scale.y = 1.4;
  put(body, new THREE.OctahedronGeometry(.45), x.glow, 0, 2.0, .35);
  const hd = joint(body, 0, 3.3, 0); parts.head = hd;
  put(hd, new THREE.OctahedronGeometry(.35), x.armor); put(hd, Sp(.06, 6, 5), x.eye, -.12, .05, .25); put(hd, Sp(.06, 6, 5), x.eye, .12, .05, .25);
  for (const s of [-1, 1]) { const hn = put(hd, Ko(.1, .8, 4), x.glow, s * .25, .45, 0); hn.rotation.z = s * -.5; }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, sh = put(body, new THREE.OctahedronGeometry(.18), x.glow, Math.cos(a) * 1.7, 1.6 + (i % 2) * .5, Math.sin(a) * 1.7); sh.scale.y = 1.8; }
  for (const s of [1, -1]) {
    const a = joint(body, s * .95, 2.6, 0), p = put(a, new THREE.OctahedronGeometry(.25), x.armor, 0, -.5, 0); p.scale.y = 2;
    put(a, Sp(.15), x.glow, 0, -1.0, 0);
    parts[s === 1 ? 'armR' : 'armL'] = a;
  }
  parts.twoHand = true; parts.body = body;
  return { parts, h: 3.8 };
}

const BUILD = { biped, quadruped, maggot, blob, lavaTorso, spider, crystal };

// Alle Leuchtteile (je Farbe ein glowMat-SkinnedMesh aus finish) zu einem Mesh: Farbe als Vertex-Farbe, ein geteiltes Material.
// Gleiches Skelett und gleiche Bind-Matrix, die Gelenke bewegen die Teile wie vorher. Spart pro Leuchtfarbe einen Draw Call
const glowV = new THREE.MeshBasicMaterial({ vertexColors: true });
glowV.dispose = () => {};   // geteilt, swapModel (boss.ts) räumt Materialien ab
function mergeGlow(root) {
  const list = root.children.filter(o => o.isSkinnedMesh && o.material.isMeshBasicMaterial && o.material !== glowV);
  if (list.length < 2) return;
  const geos = list.map(o => {
    const g = o.geometry.clone(), n = g.attributes.position.count, col = new Float32Array(n * 3), c = o.material.color;
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const first = list[0], sm = new THREE.SkinnedMesh(mergeGeometries(geos), glowV);
  root.add(sm);
  sm.bind(first.skeleton, first.bindMatrix);
  sm.geometry.computeBoundingSphere();
  sm.boundingSphere = sm.geometry.boundingSphere.clone();
  sm.boundingSphere.radius *= 1.6;
  for (const o of list) { root.remove(o); o.geometry.dispose(); }
  for (const g of geos) g.dispose();
}

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
  mergeGlow(root);
  model.ctl = ctl;
  model.parts = parts;
  model.height = h * sc;
  model.float = isFloat;
  return model;
}
