// Strichkrieger: Figur, Schwert, Wut-Aura, Moves und Effekte aus dem Viewer „Frost Grind – Strichkrieger“ (https://claude.ai/artifact/CWAKpz96NVdZ2sQQWd8yXR, wie docs/handoff.md), dazu Rückwärts, Sprung, Tod und Rim-Licht.
// Vanilla-Technik: ein SkinnedMesh, Gewicht 1, Vertex-Farben, 3-Stufen-Toon. Das Modell bewegt den Spieler nicht: Sprung und Treffer macht realMen.ts über onHit.
// anim = { state, speed, ability: null|'q0'..'q3'|'fs'|'fm'|'e'|'whirl'|'leap'|'exec'|'cry'|'last', seq, rate, rage (0–100), frozen }. dt > 1 gilt als ms.
// Schlagfolge Version E (realMen.ts): 'fs' Finisher-Spin, 'fm' Sprung-Smash; anim.fin = { s: Größe, tor: Tornado }, anim.qPal = Hieb-Farbe ('staub' | 'wut' | 'donner')

import * as THREE from 'three';
import { outC, V } from '../util';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { eMat, PAL, fx as efx, em, uK as setK } from '../vfx/energy';
import { grad, capDown, RIM, rimChunk } from './strichKit';
import type { Fig } from './strichKrieger/fig';
import { TAU, C, prep, partKit, mergeTagged, L1, L2, A1, A2 } from './strichKrieger/parts';
import { lookBody } from './strichKrieger/looks';
import { buildWarFx, SN } from './strichKrieger/fx';
import { STRICH_TIMING } from './strichKrieger/timing';
import { IDLE } from './strichKrieger/poses';
import { updateWar, resolve, tipPos } from './strichKrieger/update';
import { WEAPON_SHAPE, swordGeo, axeGeo, maceGeo, maceGlowGeo, lookWeapon } from './strichKrieger/weapons';
export type { Fig, WarAnim } from './strichKrieger/fig';

// Dauern: strichKrieger/timing.ts (realMen.ts liest sie hier)
export { STRICH_TIMING } from './strichKrieger/timing';

// skinId: Skin aus src/skins.ts (standard, klapse, classic, holz). Unbekannt oder noch nicht gebaut = Standard. Intern heißt er look (Viewer-Code)
export function buildStrichKrieger({ bloom = false, weapon = 'sword', skinId: look = 'standard' } = {}) {
  const W = STRICH_TIMING.weapons[weapon] ?? STRICH_TIMING.weapons.sword;
  const fxGroup = new THREE.Group();
  const VMAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  VMAT.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
      `outgoingLight += ${rimChunk(RIM.color, RIM.power)};\n#include <opaque_fragment>`);
  };
  // Geteilter Animations-Zustand der Figur (vorher lose let im Builder)
  const bones = [], parts = [];
  const F = { bones, parts, anim: { lift: 0, spinAng: 0, rage: 0, flare: 0, qPal: null, fin: { s: 1, tor: 0 }, tipLen: 0, gripLen: 0, baseTip: 0, baseGrip: 0, lastGrip: null,
    eatK: { s: 0, k: 0 }, act: null, actKey: '', lastPose: null, blendFrom: null, blendT: 0, runPh: 0, T: 0, lastLoco: 'idle', ready: false, kills: -1 } } as Fig;
  const gy = () => root.position.y - F.anim.lift;             // Boden unter der Figur
  function B(p, x = 0, y = 0, z = 0) { const b = new THREE.Bone(); b.position.set(x, y, z); p.add(b); bones.push(b); return b; }
  const { part } = partKit(F);   // strichKrieger/parts.ts
  const root = new THREE.Group();
  const hips = B(root, 0, 1.04, 0);
  const pHips = part(hips, new THREE.SphereGeometry(.19, 7, 4), C.ink, [0, 0, 0], [0, 0, 0], [1.25, .8, .9]);
  const chest = B(hips, 0, .06, 0);
  const pChest = part(chest, new THREE.LatheGeometry([[0, -.04], [.13, -.02], [.14, .1], [.22, .32], [.29, .5], [.25, .6], [.12, .66], [0, .67]]
    .map(([x, y]) => new THREE.Vector2(x, y)), 8), C.ink, [0, 0, 0], [0, Math.PI / 8, 0], [1.15, 1, .66]);
  const neck = B(chest, 0, .64, .03);
  const pNeck = part(neck, new THREE.CylinderGeometry(.07, .09, .12, 5), C.ink, [0, .04, 0]);
  const head = B(neck, 0, .08, .02);
  const pHead = part(head, new THREE.IcosahedronGeometry(.15, 1), C.ink, [0, .13, 0], [0, 0, 0], [1, 1.02, 1.05]);
  // Gürtel mit Stoffbahn hinten
  const pBelt = part(hips, new THREE.TorusGeometry(.2, .045, 3, 10), C.plate, [0, .06, 0], [Math.PI / 2, 0, 0], [1.2, .9, 1]);
  const clothAnchor = (() => { const o = new THREE.Object3D(); o.position.set(0, .02, -.2); hips.add(o); return o; })();

  function arm(side) {
    const ua = B(chest, side * .32, .52, 0);
    const pu = part(ua, capDown(.095, A1), C.ink);
    const fa = B(ua, 0, -A1, 0);
    const pf = part(fa, capDown(.085, A2), C.ink);
    const hand = B(fa, 0, -A2, 0);
    const ph = part(hand, new THREE.IcosahedronGeometry(.11, 0), C.ink);
    const plate = [];
    if (side === 1) {
      // eine schwere Schulterplatte links mit zwei Dornen: macht die Silhouette asymmetrisch
      plate.push(part(ua, new THREE.ConeGeometry(.22, .14, 6), C.plate, [.03, .05, 0], [0, 0, -.35]));
      plate.push(part(ua, new THREE.ConeGeometry(.045, .26, 4), C.plate, [.08, .2, .04], [0, 0, -.35]));
      plate.push(part(ua, new THREE.ConeGeometry(.04, .2, 4), C.plate, [.16, .14, -.08], [-.3, 0, -.8]));
    }
    return { ua, fa, hand, side, pu, pf, ph, plate };
  }
  function leg(side) {
    const th = B(hips, side * .14, -.06, 0);
    const pt = part(th, capDown(.115, L1), C.ink);
    const sh = B(th, 0, -L1, 0);
    const ps = part(sh, capDown(.095, L2), C.ink);
    const ft = B(sh, 0, -L2, 0);
    const pf = part(ft, new THREE.ConeGeometry(.095, .32, 5), C.ink, [0, -.02, .09], [Math.PI / 2, 0, 0], [1, 1, .7]);
    return { th, sh, ft, side, pt, ps, pf };
  }
  const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);
  Object.assign(F, { weapon, fxGroup, gy, root, hips, chest, neck, head, armL, armR, legL, legR, clothAnchor, bp: { pHips, pChest, pNeck, pHead, pBelt } });
  // Skins (src/skins.ts) am Körper: strichKrieger/looks.ts. Stoffbahn (Farbe, Breite) und Sprechblasen kommen vom Skin
  const { cloth0, TALK } = lookBody(F, look);
  root.updateMatrixWorld(true);
  const bodyT = mergeTagged(parts.map(p => {
    const g = prep(p.geo, p.color, p.bone.matrixWorld.clone().multiply(p.m), p.flat);
    const n = g.attributes.position.count, bi = bones.indexOf(p.bone);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return { g, tag: p.tag };
  }));
  const bodyGeo = bodyT.geo;
  const body = new THREE.SkinnedMesh(bodyGeo, VMAT);
  body.frustumCulled = false; root.add(body); body.bind(new THREE.Skeleton(bones));
  // Wut-Aura: zweite Hülle aus derselben Geometrie, entlang der Normalen aufgeblasen, Rückseiten, 1 Draw Call
  // Spell-Viewer: dieselbe Hülle mit dem Energie-Shader (Palette Wut), wächst mit der Wut
  const AURA_E = eMat(PAL.wut, { sc: 4, core: .2, inf: .04, puff: .02, flow: [0, 2.5, 0], k: 0 });
  const aura = new THREE.SkinnedMesh(bodyGeo, AURA_E);
  aura.frustumCulled = false; root.add(aura); aura.bind(body.skeleton, body.bindMatrix); aura.renderOrder = -1;
  // Das Schwert wird immer gebaut (auch unter Look oder Axt): jede Geometrie würfelt beim Bau ihre uuid mit Math.random, gleiche Zahl Aufrufe = gleiche Effekte bei festem Seed
  const SWORD_GEO = swordGeo();
  // Waffen-Look der Skins (strichKrieger/weapons.ts), top: oberes Ende, wird auf die Treffer-Spitze der Waffe skaliert
  const LW = lookWeapon(look, bloom);
  const lookW = LW.list.length ? mergeTagged(LW.list) : null;
  // Schwert-Rahmen: y = Klinge, x = Schneide, Griff im Ursprung. Darin das eigene Schwert oder eine Waffe aus models/weapons (setWeapon)
  const sword = new THREE.Group(); root.add(sword);
  const swordMesh = new THREE.Mesh(lookW ? lookW.geo : weapon === 'axe' ? axeGeo() : weapon === 'mace' ? maceGeo() : SWORD_GEO, VMAT); sword.add(swordMesh);
  F.anim.tipLen = WEAPON_SHAPE[weapon]?.tip ?? 1.95; F.anim.gripLen = WEAPON_SHAPE[weapon]?.grip ?? .24; F.anim.baseTip = F.anim.tipLen; F.anim.baseGrip = F.anim.gripLen;
  // Kolben: Blitzrisse leuchten blau (+1 Draw Call), mit Bloom heller
  let maceGlow = null;
  if (weapon === 'mace' && !lookW) {
    maceGlow = new THREE.Mesh(maceGlowGeo(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    if (bloom) maceGlow.material.color.setScalar(2.2);
    sword.add(maceGlow);
  }
  // Look-Waffe auf die Spitze der Waffe skalieren (k = Waffen-Maß × Skalierung)
  const fitLook = (tip) => { if (lookW) swordMesh.scale.setScalar(tip / LW.top); };
  fitLook(F.anim.tipLen);
  // Fleischkeule zum Essen: Knochen + Fleisch, Griff im Ursprung, Fleisch nach +y
  const meat = new THREE.Mesh(mergeGeometries([
    prep(new THREE.CylinderGeometry(.025, .025, .22, 5).translate(0, -.02, 0), new THREE.Color(0xeee6d0)),
    prep(new THREE.IcosahedronGeometry(.035, 0).translate(.02, -.14, 0), new THREE.Color(0xeee6d0)), prep(new THREE.IcosahedronGeometry(.035, 0).translate(-.02, -.14, 0), new THREE.Color(0xeee6d0)),
    prep(new THREE.IcosahedronGeometry(.11, 1).scale(1, 1.35, 1).translate(0, .17, 0), new THREE.Color(0x8a3b1c)),
    prep(new THREE.IcosahedronGeometry(.06, 0).translate(.06, .2, .05), new THREE.Color(0xa9552a))
  ]), VMAT); meat.visible = false; root.add(meat);
  Object.assign(F, { look, sword, swordMesh, lookW, bodyT, meat, aura, auraMat: AURA_E });
  // Effekte (strichKrieger/fx.ts): Wut-Ring und Stoffbahn hier gebaut wie vorher, der Rest ohne neue Objekte bis zum Pool
  F.fx = buildWarFx(F, cloth0);
  const { cloth, ring, crack, ghost, emit } = F.fx;
  // Pro Frame (strichKrieger/update.ts): stepAction, locoPose, applyPose, tickFx
  F.tipPos = () => tipPos(F);
  F.anim.lastGrip = [.2, 1.2, .3];
  // Treffer-Moment an der Schwertspitze
  F.hitTip = (kind, i = 0) => { const p = F.tipPos(); model.onHit?.(kind, p.x, p.z, i); };
  F.hitRoot = (kind, i = 0) => model.onHit?.(kind, root.position.x, root.position.z, i);
  F.anim.lastPose = resolve(F, IDLE);
  const update = (dt, anim: any = {}) => updateWar(F, W, dt, anim);
  // Risse von Bodenbrecher: das Spiel meldet jede Welle
  const crackAt = (x, z, dx, dz) => { const q = V(x, 0, z); crack(q, V(dx, 0, dz).applyAxisAngle(V(0, 1, 0), (Math.random() - .5) * .5), 1.9, 1.4); emit(V(x, gy() + .1, z), 8, 3, 0x8f877a, 12, .7); };
  const model: any = {
    root, update, scarf: cloth, onHit: null, weapon, look,
    // Sprechblasen und Namensschild des Skins (ui/skinTalk.ts): null = keine
    talk: TALK.kind ? { ...TALK, anchor: head, get on() { return F.anim.lastLoco !== 'dead'; } } : null,
    anchors: { crystal: armR.hand, handL: armL.hand, handR: armR.hand },
    fx: { group: fxGroup, crackAt, ring, ghost, gy, blood: (x, y, z, n = 6) => emit(V(x, y, z), n, 2.5, 0x9e0b0f, 12, .8) },
    get tris() { return Math.round((body.geometry.attributes.position.count + swordMesh.geometry.attributes.position.count + (maceGlow ? maceGlow.geometry.attributes.position.count : 0)) / 3 + (SN - 1) * 2); },
    get bloom() { return bloom; },
    // Waffe aus models/weapons statt des eigenen Schwerts: Griff in der rechten Hand, Länge für Treffer und linke Hand aus der Waffe
    // Skin mit eigenem Waffen-Look: Waffe bleibt im Rahmen, aber unsichtbar; der Look übernimmt ihre Länge
    setWeapon(w, scale = 1, tip = 1.95, grip = .24) {
      swordMesh.visible = !!lookW;
      w.root.scale.setScalar(scale);
      w.root.visible = !lookW;
      sword.add(w.root);
      F.anim.tipLen = tip * scale; F.anim.gripLen = grip * scale; F.anim.baseTip = F.anim.tipLen; F.anim.baseGrip = F.anim.gripLen;
      fitLook(F.anim.tipLen);
    },
    // Schlagfolge Version E: Schwert wächst pro Stufe (Größe und Treffer-Spitze)
    setBladeScale(k) { sword.scale.setScalar(k); F.anim.tipLen = F.anim.baseTip * k; F.anim.gripLen = F.anim.baseGrip * k; },
    // Neue Stufe: goldene Kugel an der Spitze + Ring, Aura flammt auf
    flareTip() {
      F.anim.flare = 1.5;
      efx(.7, (k, _d, e) => { if (!e.ms.length) em(e, 'sph', PAL.donner, { sc: 3, core: .8, flow: [0, 3, 0], puff: .05 }); e.ms[0].position.copy(F.tipPos()); e.ms[0].scale.setScalar(.3 + 1.6 * outC(k)); setK(e.ms[0], 1 - k); });
      ring(root.position, 0, 5, .7, .2, PAL.donner);
    },
  };
  return model;
}
