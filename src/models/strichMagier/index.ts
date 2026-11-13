// Strichmagier aus dem Viewer „Frost Grind – Strichmagier“ (Stand optimiert): Basis, Feuer, Eis, Arkan, Blitz, Seuche und der ?-Magier (Spell-Viewer, skin qm).
// Ein SkinnedMesh trägt Körper, Glüh-Teile (aGlow), Eiszapfen (icT/icB) und Trink-Requisiten (eigene Bones, icT = -2): 1 Draw Call plus Schatten.
// Die Stufen-Effekte lesen nur einen Wert 0 … 1 (setMeter): Hitze, Kälte, Ladungen/4, Batterie. Die Spiellogik liest nichts aus dem Modell.
// Gleiche Schnittstelle wie buildMage: anim = { state, speed, cast, channel, squat, frozen, smoke, charge, over, drinkSkin }, anchors.crystal hängt am Stabgelenk (dort sitzt die Waffe).
// Effekte in Weltkoordinaten (Flammen, Blitze, Tropfen, Partikel) hängen in `scarf`, models/heroModel.ts legt die Gruppe in die Szene.
// Aufgeteilt (Audit ARCH-06): shared (Maße, fester Zufall, Facetten), palette, shader, fx/{eis,arkan,feuer,blitz,seuche}, props (Trink-Requisiten), hide (Ausblend-Regeln),
// look (Skins), gearFx, pose (IK, Posen-Mischung), motion (Bewegungsstil ANIM); hier nur buildStrichMagier.

import * as THREE from 'three';
import { clamp, lerpTo as lerp, V, rand as rnd } from '../../util';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTrail, stepWatcher, SKIN_FX } from '../trail';
import '../../vfx/energy';   // nur Lade-Reihenfolge wie vor dem Schnitt
import '../../i18n';   // nur Lade-Reihenfolge wie vor dem Schnitt
import { ELEMENTS } from '../weapons/baukasten';
import '../../state';   // nur Lade-Reihenfolge wie vor dem Schnitt
import '../../plagueMarks';   // nur Lade-Reihenfolge wie vor dem Schnitt
import { gearPieces, animateGear } from '../gearParts';
import { paletteOf } from '../../figureTable';
import { kosmetikPieces, glassGeo, makeKillFlag, KOS, type KosEvent, type KosFrame } from '../kosmetikParts';
import { capDown, grad } from '../strichKit';
import { makePointPool } from '../../fx/pointPool';
import { A1, A2, col, L1, L2, prep, rate, resetFacet, TAU } from './shared';
import { LOOKS, SKINS } from './palette';
import { bodyHook, depthMat } from './shader';
import { ICE_TINT, makeIceShell, makeIcicles } from './fx/eis';
import { bodyRunes, makeChargeOrbs, runeMat } from './fx/arkan';
import { makeFireShell, makeFlames, updateFlames } from './fx/feuer';
import { bolt, makeBolts, updateBolts } from './fx/blitz';
import { makeGoo, plagueShader, setStrand, updateGoo } from './fx/seuche';
import { propGeo, qGeo } from './props';
import { GEAR_HIDE, KOS_HIDE } from './hide';
import { buildLook, updateLook } from './look';
import { GEAR_FX, updateGearFx } from './gearFx';
import { applyPose, cp, kf, mix } from './pose';
import { airOf, ANIM, DEAD, FLOAT, setCurM } from './motion';

// Im Spiel: Zaubern dauert höchstens so lang, sonst hinkt die Figur dem schnellen Zaubern hinterher. Der Viewer zeigt 1,0–2,2 s. // PH
const CAST_MS = 700;
const CAST_HOLD = 0.55;       // Hier wartet die Pose, solange ein längerer Zauber läuft
// Skin-IDs im Spiel → Skins des Viewers: paletteOf (figureTable.ts, dort auch alle = Kevins Zuhälter-Look und arkan)

// Partikel pro Sekunde: Rauch beim Überhitzen, Reif bei Kälte // PH
const STAGE_FX = { smoke: 25, frost: 30 };
const WEL_STONE_Y = .95;   // Stein des Waffen-Elements, Höhe am Stab-Gelenk (Viewer) // PH
const WEL_SPARK = 14;      // Funken des Waffen-Elements pro Sekunde (≈ alle 0,07 s), an Hand oder Stein-Spitze (Viewer) // PH

// weaponElement: Element der ausgerüsteten Waffe (ELEMENTS in weapons/baukasten.ts), null oder unbekannt = kein Element.
// opts.trail: vorhandene Spur übernehmen (Neubau bei Waffenwechsel, models/heroModel.ts), sonst eine neue nach dem Skin.
// opts.spark(p, color): Funken des Waffen-Elements ins Partikel-System des Spiels (kein eigener Draw Call), sonst in die eigenen Partikel
// opts.skinId: Skin aus src/skins.ts (standard, blitz, seuche, frost14, glut), getrennt vom Schul-Look skin. Unbekannt oder noch nicht gebaut = Standard
export function buildStrichMagier(gameSkin = 'alle', weaponElement: string | null = null, opts: any = {}) {
  const skin = paletteOf(gameSkin), A = ANIM[skin];
  const look: string = opts.skinId ?? 'standard';   // intern look wie im Viewer
  const S = SKINS[skin];
  const LK = LOOKS[look] ?? null;   // null = Standard: Schul-Look wie bisher
  const ink = k => LK?.[k] ?? S.ink;
  resetFacet();
  const U = { uTime: { value: 0 }, uM: { value: 0 }, uK: { value: 0 }, uLvl: { value: 0 } };   // pro Figur
  const F: any = { skin, look, S, bones: [], parts: [], glow: [], t: 0, last: null, blendFrom: null, blendT: 0, freeze: 0, m: 0, props: {}, groundY: 0, groundPos: V() };
  F.root = new THREE.Group();
  const world = new THREE.Group();   // Effekte in Weltkoordinaten
  const B = (p, x = 0, y = 0, z = 0) => { const b = new THREE.Bone(); b.position.set(x, y, z); p.add(b); F.bones.push(b); return b; };
  const M = (pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scl));
  const part = (bone, geo, color, pos?, rot?, scl?) => F.parts.push({ bone, geo, color, m: M(pos, rot, scl) });
  const glow = (bone, geo, color, pos?, rot?, scl?) => F.glow.push({ bone, geo, color, m: M(pos, rot, scl) });

  const hips = F.hips = B(F.root, 0, 1, 0);
  part(hips, new THREE.SphereGeometry(.14, 7, 4), ink('pants'), [0, 0, 0], [0, 0, 0], [1.25, .8, .9]);
  const chest = F.chest = B(hips, 0, .05, 0);
  part(chest, new THREE.LatheGeometry([[0, -.04], [.1, -.02], [.11, .1], [.15, .33], [.18, .47], [.15, .56], [.08, .61], [0, .62]]
    .map(([a, b]) => new THREE.Vector2(a, b)), 8), ink('top'), [0, 0, 0], [0, Math.PI / 8, 0], [1.1, 1, .64]);
  part(chest, new THREE.TorusGeometry(.13, .04, 3, 10), LK?.collar ?? S.accent, [0, .56, 0], [Math.PI / 2, 0, 0], [1, 1, .8]);   // Kragen-Schal
  const neck = F.neck = B(chest, 0, .6, 0);
  part(neck, new THREE.CylinderGeometry(.04, .05, .12, 5), ink('skin'), [0, .05, 0]);
  const head = F.head = B(neck, 0, .1, 0);
  part(head, new THREE.IcosahedronGeometry(.18, 1), ink('head'), [0, .16, 0], [0, 0, 0], [.95, 1.05, 1]);
  const arm = side => {
    const ua = B(chest, side * .23, .49, 0); part(ua, capDown(.058, A1), ink('sleeve'));
    const fa = B(ua, 0, -A1, 0); part(fa, capDown(.052, A2), ink('sleeve'));
    const hand = B(fa, 0, -A2, 0); part(hand, new THREE.IcosahedronGeometry(.07, 0), ink('skin'));
    return { ua, fa, hand, side };
  };
  const leg = side => {
    const th = B(hips, side * .11, -.05, 0); part(th, capDown(.08, L1), ink('pants'));
    const sh = B(th, 0, -L1, 0);
    if (LK?.ankle) { part(sh, capDown(.064, L2 * .8), ink('pants')); part(sh, capDown(.036, L2 * .2), ink('skin'), [0, -L2 * .8, 0]); }   // Knöchel frei
    else part(sh, capDown(.064, L2), ink('pants'));
    const ft = B(sh, 0, -L2, 0); part(ft, new THREE.ConeGeometry(.065, .26, 5), ink('shoe'), [0, -.02, .08], [Math.PI / 2, 0, 0], [1, 1, .7]);
    return { th, sh, ft, side };
  };
  F.armL = arm(1); F.armR = arm(-1); F.legL = leg(1); F.legR = leg(-1);
  F.burnBones = [F.chest, F.chest, head, hips, F.armL.ua, F.armR.ua, F.armL.fa, F.armR.fa, F.legL.th, F.legR.th, F.legL.sh, F.legR.sh];
  const staff = F.staff = B(F.root);
  // Der eingebaute Stab des Viewers weicht den Waffen: nur das Gelenk bleibt, models/heroModel.ts hängt die Waffe daran
  F.crystal = new THREE.Object3D(); F.crystal.position.set(0, .79, 0); staff.add(F.crystal);

  if (skin === 'base' && !LK) {
    // 90er-Zuhälter-Look: pinker Pelzmantel, weißer Fedora, dicke Goldkette
    const PINK = col(0xff5fb0), FUR = col(0xffa8d4), GOLD = col(0xe2b13c), HAT = col(0xf2ede4), BAND = col(0x1d1b18);
    part(chest, new THREE.LatheGeometry([[0, -.06], [.12, -.04], [.13, .1], [.17, .33], [.2, .47], [.17, .57], [0, .6]]
      .map(([a, b]) => new THREE.Vector2(a, b)), 8), PINK, [0, 0, 0], [0, Math.PI / 8, 0], [1.12, 1, .7]);
    part(hips, new THREE.LatheGeometry([[.28, -.58], [.24, -.35], [.19, -.1], [.15, .08]].map(([a, b]) => new THREE.Vector2(a, b)), 8), PINK, [0, 0, 0], [0, Math.PI / 8, 0], [1.05, 1, .8]);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; part(chest, new THREE.IcosahedronGeometry(.075, 0), FUR, [Math.sin(a) * .15, .55 + .03 * Math.cos(a * 2), Math.cos(a) * .11]); }
    for (let i = 0; i < 6; i++) part(hips, new THREE.IcosahedronGeometry(.06, 0), FUR, [Math.sin(i / 6 * TAU) * .27, -.56, Math.cos(i / 6 * TAU) * .22]);
    for (const a of [F.armL, F.armR]) {
      part(a.ua, capDown(.074, A1), PINK);
      part(a.fa, capDown(.068, A2 * .8), PINK);
      for (let i = 0; i < 5; i++) { const q = i / 5 * TAU; part(a.fa, new THREE.IcosahedronGeometry(.045, 0), FUR, [Math.sin(q) * .07, -A2 * .8, Math.cos(q) * .07]); }
    }
    for (let i = 0; i <= 12; i++) {
      const t = i / 12 * 2 - 1;
      part(chest, new THREE.TorusGeometry(.028, .011, 3, 6), GOLD, [.13 * t, .3 + .26 * t * t, .13 - .02 * t * t], [i % 2 ? Math.PI / 2 : 0, 0, .3 * t]);
    }
    part(chest, new THREE.CylinderGeometry(.06, .06, .018, 8), GOLD, [0, .25, .135], [Math.PI / 2, 0, 0]);
    part(head, new THREE.CylinderGeometry(.29, .29, .022, 10), HAT, [0, .3, 0], [-.08, 0, .1], [1, 1, .9]);
    part(head, new THREE.CylinderGeometry(.14, .17, .17, 8), HAT, [.008, .39, 0], [-.08, 0, .1], [1, 1, .85]);
    part(head, new THREE.CylinderGeometry(.172, .172, .04, 8), BAND, [.004, .33, 0], [-.08, 0, .1], [1, 1, .85]);
    glow(chest, new THREE.OctahedronGeometry(.03, 0), col(0xfff3b0), [0, .25, .15]);
  }
  if (skin === 'fire' && !LK) part(head, new THREE.IcosahedronGeometry(.185, 1), S.ink, [0, .14, 0], [0, 0, 0], [.9, .7, .95]);   // verkohlter Kiefer
  const iceTint = look === 'frost14';   // Splitterkönig friert wie der Frost-Magier ein (Zapfen, Eisschicht), das Eis babyblau statt weiß
  if (skin === 'ice' && (!LK || iceTint)) F.ice = makeIcicles(F, iceTint);
  if (skin === 'arcane') { glow(head, new THREE.OctahedronGeometry(.035, 0), S.orb, [0, .2, .17], [0, 0, 0], [1, 1.5, .5]); F.runeParts = bodyRunes(F); }   // drittes Auge
  if (skin === 'blitz' && !LK) for (let i = 0; i < 7; i++) { const a = (i / 7 - .5) * 2.4; part(head, new THREE.ConeGeometry(.04, .17, 4), S.ink, [Math.sin(a) * .12, .3 - Math.abs(a) * .03, Math.cos(a) * .05 - .06], [-.5 + Math.abs(a) * .1, 0, -a * .55]); }   // Haar-Zacken
  if (skin === 'plague' && !LK) {
    // Kapuzen-Klumpen und hängende Fäden: zerläuft nach unten
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; part(head, new THREE.ConeGeometry(.035, .14, 5), S.ink, [Math.sin(a) * .12, .02, Math.cos(a) * .1], [Math.PI, 0, 0]); }
    for (const a of [F.armL, F.armR]) part(a.hand, new THREE.ConeGeometry(.04, .16, 5), S.ink, [0, -.06, 0], [Math.PI, 0, 0]);
    part(chest, new THREE.ConeGeometry(.12, .2, 7), S.ink, [0, -.06, 0], [Math.PI, 0, 0], [1.2, 1, .8]);
  }
  // Ausblend-Listen für Gear und Kosmetik (unten), schon hier gebraucht: die Fragezeichen des ?-Magiers fragen, ob ein Körper-Teil sichtbar ist
  const gearHide = [...(GEAR_HIDE.look[look] ?? []), ...(LK ? [] : GEAR_HIDE.skin[skin] ?? [])];
  const kosHide = [...(KOS_HIDE.look[look] ?? []), ...(LK ? [] : KOS_HIDE.skin[skin] ?? [])];
  if (skin === 'qm') {
    // Gelbe und weiße Fragezeichen auf Brust, Rücken, Hüfte, Armen, Beinen und Kopf, 3 schwebende über dem Kopf
    const Y = col(0xffd23a), W = col(0xf4efe4);
    const deco: any[] = [[chest, [0, .32, .15], .1, Y], [chest, [-.1, .18, .14], .06, W], [chest, [.11, .45, .12], .05, W], [chest, [0, .32, -.15], .1, Y], [chest, [.08, .12, -.14], .06, W],
      [hips, [.1, -.02, .12], .06, W], [hips, [-.09, -.05, -.12], .06, Y], [F.armL.ua, [0, -.12, .06], .05, Y], [F.armR.ua, [0, -.14, .06], .05, W], [F.armL.fa, [0, -.1, .05], .045, W], [F.armR.fa, [0, -.1, .05], .045, Y],
      [F.legL.th, [0, -.2, .08], .055, W], [F.legR.th, [0, -.15, .08], .055, Y], [head, [0, .2, .17], .05, Y]];
    // Körper-Teil an (Gear Körper, Kosmetik Onesie/Anzug/Rock): die Fragezeichen auf dem Körper fallen weg, sonst schauen sie durch den Stoff;
    // Arm-Teil an: die auf den Armen. Kopf und die 3 schwebenden bleiben. Beim Wechsel baut heroModel.ts die Figur neu (gearKey)
    const worn = (sl: string) => (!!opts.gear?.[sl] && !gearHide.includes(sl)) || (!!opts.kosmetik?.[sl] && !kosHide.includes(sl) && !kosHide.includes(opts.kosmetik[sl]));
    const arms = [F.armL.ua, F.armR.ua, F.armL.fa, F.armR.fa], off = (b) => b !== head && (worn('koerper') || (worn('arme') && arms.includes(b)));
    if (!LK) for (const [b, p, sc, c] of deco) if (!off(b)) part(b, qGeo(), c, p, [0, 0, 0], [sc * 1.5, sc * 1.5, sc * .7]);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; glow(head, qGeo(), Y, [Math.sin(a) * .36, .52 + .06 * i, Math.cos(a) * .36], [0, a, 0], [.14, .14, .07]); }
  }
  F.wel = weaponElement && weaponElement !== 'none' && ELEMENTS[weaponElement] ? ELEMENTS[weaponElement].color : null;
  // Skins (src/skins.ts): Teile an Bones wie oben, ersetzen die Kostüm-Teile der Schule (Stufen-Effekte bleiben). Gag-Teile auf eigenen Bones, Größe 1e-4 = versteckt
  if (LK) buildLook(F, look, { part, glow, B, M });
  // Element der Waffe (Spell-Viewer, Block WEL): Kragen, Schärpe, Armreifen, schwebender Stein über dem Stab, Augen in der Element-Farbe.
  // Alles hängt an Bones im Körper-Mesh, kein Draw Call mehr. Ohne Element bleibt die Figur wie bisher.
  if (F.wel != null) {
    const E = col(F.wel), add = skin === 'plague' && !LK ? glow : part;   // auf Schleim leuchten, sonst geht die Farbe im Muster unter
    add(chest, new THREE.TorusGeometry(.14, .045, 4, 12), E, [0, .555, 0], [Math.PI / 2, 0, 0], [1.05, 1, .85]);   // Kragen // PH
    add(hips, new THREE.TorusGeometry(.16, .035, 4, 12), E, [0, .03, 0], [Math.PI / 2, 0, 0], [1.2, 1, .95]);       // Schärpe // PH
    for (let i = 0; i < 3; i++) add(hips, new THREE.ConeGeometry(.03, .22, 4).translate(0, -.11, 0), E, [.12 - i * .03, .02, .13 - i * .02], [0, 0, .15 * i]);   // Schärpen-Enden // PH
    for (const a of [F.armL, F.armR]) add(a.fa, new THREE.TorusGeometry(.06, .022, 3, 8), E, [0, -A2 * .82, 0], [Math.PI / 2, 0, 0]);   // Armreifen // PH
    glow(staff, new THREE.OctahedronGeometry(.055, 0), E, [0, WEL_STONE_Y, 0], [0, 0, 0], [1, 1.5, 1]);   // Stein über dem Knauf
    if (!LK?.eyes) for (const sx of [-1, 1]) glow(head, new THREE.SphereGeometry(.022, 5, 4), E, [sx * .065, .18, .16], [0, 0, 0], [1.3, .7, .6]);   // Augen // PH (Skins tragen sie in Brille/Maske/Blick)
  }
  // Gear (models/gearParts.ts, opts.gear aus gear/shown.ts gearShown): Teile an Bones ins Körper-Mesh, Leuchtteile als Glühen, bewegte Teile auf eigenen Bones
  F.gear = { anim: [], fx: [], hidden: [] as string[], el: null as number | null, rar: 0 };
  const hide = gearHide;
  for (const [slot, it] of Object.entries(opts.gear ?? {}) as [string, any][]) {
    if (!it) continue;
    if (hide.includes(slot)) { F.gear.hidden.push(slot); continue; }
    const o = gearPieces(F, B, slot, it.group, it, A1, A2);
    for (const p of o.pieces) (p.glow ? F.glow : F.parts).push({ bone: p.bone, geo: p.geo, color: p.color, m: p.m, noShell: p.noShell, gear: 1 });
    F.gear.anim.push(...o.anim); F.gear.fx.push(...o.fx.map(f => ({ ...f, color: ELEMENTS[it.s.element] && it.s.element !== 'none' ? ELEMENTS[it.s.element].color : 0xd8d4e0 })));
    if (it.r >= 3 && it.s.element !== 'none' && ELEMENTS[it.s.element] && it.r >= F.gear.rar) { F.gear.el = ELEMENTS[it.s.element].color; F.gear.rar = it.r; }   // Funken: Element des seltensten Teils ab Blau (Viewer elAny)
  }
  // Kosmetik (models/kosmetikParts.ts, opts.kosmetik aus gear/shown.ts kosmetikShown): wie Gear an Bones ins Körper-Mesh. Glas in einem eigenen transparenten Mesh,
  // Kill-Flagge als Textur-Mesh am Flaggen-Bone. Reaktionen auf Ereignisse (onEvent, figEvents.ts) drehen/skalieren nur eigene Bones
  F.kosHidden = [] as string[];
  const kHide = kosHide;
  const kSel = Object.fromEntries(Object.entries(opts.kosmetik ?? {}).filter(([slot, id]: [string, any]) => { const off = kHide.includes(slot) || kHide.includes(id); if (id && off) F.kosHidden.push(id); return id && !off; })) as Record<string, string>;
  F.kos = Object.keys(kSel).length ? kosmetikPieces(F, B, kSel, A1, A2, L1, L2, F.wel, skin) : null;
  if (F.kos) for (const p of F.kos.pieces) (p.glow ? F.glow : F.parts).push({ bone: p.bone, geo: p.geo, color: p.color, m: p.m, noShell: p.noShell, gear: 1 });
  // Trink-Requisiten: je ein Bone, der ?-Magier hat alle 4 Getränke (anim.drinkSkin wählt)
  for (const k of skin === 'qm' ? ['base', 'fire', 'ice', 'arcane'] : [skin]) {
    const pg = propGeo(k);
    if (!pg) continue;
    const bone = F.props[k] = B(F.root);
    F.parts.push({ bone, m: new THREE.Matrix4(), raw: mw => pg.clone().applyMatrix4(mw), prop: true });
  }
  F.prop = F.props[skin === 'qm' ? 'base' : skin] ?? null;

  F.root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(F.bones);
  const build = (list, mat, extra?) => {
    const geo = mergeGeometries(list.map(p => {
      const mw = p.bone.matrixWorld.clone().multiply(p.m);
      const g = p.raw ? p.raw(mw) : prep(p.geo, p.color, mw, p.flick);
      if (extra) extra(p, g, mw);
      const n = g.attributes.position.count, bi = F.bones.indexOf(p.bone);
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      return g;
    }));
    const m = new THREE.SkinnedMesh(geo, mat); m.frustumCulled = false; F.root.add(m); m.bind(skel); return m;
  };
  F.mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, emissive: 0x000000 });
  F.mat.onBeforeCompile = bodyHook(U);
  F.mat.customProgramCacheKey = () => 'strichBody';
  if (skin === 'plague' && !LK) plagueShader(F.mat, U);   // mit Skin bleibt der Anzug sichtbar, Tropfen und Fliegen laufen weiter
  // alles in einem Mesh: Körper + Glühen + Eiszapfen + Requisite → 1 Draw Call
  F.body = build([...F.parts, ...F.glow.map(g => ({ ...g, glow: 1 })), ...(F.ice || [])], F.mat, (p, g, mw) => {
    const n = g.attributes.position.count, b = V().applyMatrix4(mw), base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) base.set([b.x, b.y, b.z], i * 3);
    g.setAttribute('icB', new THREE.BufferAttribute(base, 3));
    g.setAttribute('icT', new THREE.BufferAttribute(new Float32Array(n).fill(p.prop || p.noShell ? -2 : p.t ?? -1), 1));
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(p.glow || 0), 1));
    g.setAttribute('aGear', new THREE.BufferAttribute(new Float32Array(n).fill(p.gear || 0), 1));   // Gear behält im Seuchen-Muster seine Farben
    if (p.gear && !p.glow) {   // Lampen-Ausgleich: das Fülllicht hängt GEAR_FX.fillY über dem Boden (dunkel.ts), hohe Hüte kämen ihm sonst so nah, dass sie weiß ausbrennen
      const pa = g.attributes.position, ca = g.attributes.color, y0 = GEAR_FX.dimFrom, y1 = GEAR_FX.fillY;
      for (let i = 0; i < n; i++) { const y = pa.getY(i); if (y <= y0) continue; const k = Math.max(GEAR_FX.dimMin, Math.pow(Math.max(0, (y1 - y) / (y1 - y0)), 1.6)); ca.setXYZ(i, ca.getX(i) * k, ca.getY(i) * k, ca.getZ(i) * k); }
    }
  });
  F.body.customDepthMaterial = depthMat(U);
  if (F.runeParts) F.runeMesh = build(F.runeParts, runeMat(U));
  if (skin === 'ice' && (!LK || iceTint)) F.iceShell = makeIceShell(F, U, iceTint);
  if (skin === 'fire') { F.flames = makeFlames(F, U); world.add(F.flames); F.shell = makeFireShell(F, U); }
  if (skin === 'arcane') { F.orbs = makeChargeOrbs(); world.add(F.orbs); }
  if (skin === 'blitz') { F.bolts = makeBolts(); world.add(F.bolts.mesh); }
  if (skin === 'plague') { F.goo = makeGoo(F); world.add(F.goo.drops, F.goo.strands); }
  if (F.lk?.shards) for (const b of F.lk.shards.flat()) b.scale.setScalar(1e-4);   // Splitter erst nach dem Binden verstecken (Bind-Pose mit Größe 1)
  // Kosmetik: Glas (+1 Draw Call, transparent, ohne Schatten), Kill-Flagge (+1 Draw Call), danach erste Reaktion (versteckt Teile erst nach dem Binden)
  const kosT: Partial<Record<KosEvent, number>> = {};
  let kosSprint = false;
  if (F.kos) {
    if (F.kos.glass.length) { F.glass = build(F.kos.glass.map(p => ({ bone: p.bone, m: new THREE.Matrix4(), raw: mw => glassGeo(p, mw) })), new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, depthWrite: false, gradientMap: grad })); F.glass.renderOrder = 2; }
    if (F.kos.flag?.bone) { F.flag = makeKillFlag(grad); F.kos.flag.bone.add(F.flag.mesh); }
  }
  const _kp = V(), _kv = V(), _kq = new THREE.Quaternion(), _ks = V();
  const kosFrame = (dt: number): KosFrame => ({ t: F.t, dt, since: e => F.t - (kosT[e] ?? -1e9), sprint: kosSprint, vals: opts.vals ?? { mana: .7, kills: 0 }, F });
  function updateKos(dt: number) {
    const K = F.kos; if (!K) return;
    const fr = kosFrame(dt);
    K.hop = 0;
    for (const fn of K.ticks) fn(fr);
    if (K.hop) F.hips.position.y += K.hop * 1.15;   // Hüpfen (Schaf, Kuh): Viewer-Maß × Körper-Maßstab (gearParts FIT.body.s)
    if (F.flag) F.flag.update(fr.vals.kills, F.t, kosSprint);
    if (K.says.length) { for (const s of K.says) opts.say?.(s); K.says.length = 0; }
    if (K.spawns.length) {
      F.root.updateMatrixWorld(true); F.root.getWorldQuaternion(_kq);
      for (const q of K.spawns) {
        const o = q.space === 'head' ? K.space.head : q.space === 'body' ? K.space.body : q.space === 'neck' ? K.space.neck ?? K.space.body : q.space.bone;
        if (!o) continue;
        o.localToWorld(_kp.copy(q.p)); o.getWorldScale(_ks);
        _kv.copy(q.v).applyQuaternion(_kq).multiplyScalar(_ks.x);
        if (opts.puff) opts.puff(_kp, _kv, q.col, q.size * KOS.puffSize, q.life, q.grav * _ks.x);
        else emit(_kp, 1, _kv, q.col, q.grav, q.life, .02);
      }
      K.spawns.length = 0;
    }
  }
  updateKos(0);

  // Partikel in Weltkoordinaten
  const pool = makePointPool(400, .06);   // fx/pointPool.ts
  world.add(pool.points);
  function emit(p, n, v, color, g = 0, life = 1, spread = .3) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      pool.put(p.x + (Math.random() - .5) * spread, p.y + (Math.random() - .5) * spread, p.z + (Math.random() - .5) * spread, c,
        v.x + (Math.random() - .5) * .6, v.y + (Math.random() - .5) * .4, v.z + (Math.random() - .5) * .6, life * (.6 + Math.random() * .6), g);
    }
  }
  const updateParts = pool.update;

  const trail = opts.trail ?? (SKIN_FX[gameSkin]?.trail ? makeTrail(SKIN_FX[gameSkin].trail) : null);
  const watch = stepWatcher({ root: F.root, legL: { ankle: F.legL.ft }, legR: { ankle: F.legR.ft } });
  const fl = FLOAT[skin] || 0;
  let loco = 'idle', mode = 'idle', castT = -1, castKeys = null, runT = 0, wasCast = false, chargeT = -1;
  const _o = new THREE.Object3D(), _om = new THREE.Matrix4();
  // ---------- Pro Frame (update), in Schritten (KOMP-03). Reihenfolge in update wie im Viewer ----------
  // Zaubern: startet, sobald anim.cast steigt. Im Laufen läuft die Laufpose weiter, die Bewegung wird nie gesperrt. Rückgabe castU 0 … 1, −1 = kein Zauber
  function stepCast(s: number, casting: boolean, moving: boolean, charging: boolean) {
    if (casting && !wasCast && !moving) { castT = 0; castKeys = A.cast.keys(); }
    wasCast = casting;
    if (moving || loco === 'sit' || loco === 'dead' || loco === 'air' || charging) castT = -1;
    let castU = -1;
    const dur = A.cast.dur;
    if (castT >= 0) {
      castU = castT / Math.min(dur, CAST_MS);
      if (!(castU >= CAST_HOLD && casting)) castT += s * 1000;
      if (castU >= 1) { castT = -1; castU = -1; F.blendFrom = F.last; F.blendT = .2; }
    }
    return castU;
  }
  // Modus der Figur: Zustand vor Bewegung vor Aufladen vor Kanal vor Zauber
  const nextMode = (moving: boolean, charging: boolean, channel: boolean, castU: number) =>
    loco === 'sit' ? 'sit' : loco === 'dead' ? 'dead' : loco === 'air' ? 'air' : moving ? 'run' : charging ? 'charge' : channel ? 'chan' : castU >= 0 ? 'cast' : 'idle';
  // Pose des Modus (ANIM der Schule; ?-Magier trinkt mit den Bewegungen des gewürfelten Getränks)
  function poseFor(s: number, anim: any, castU: number) {
    let p;
    if (mode === 'cast') p = kf(castKeys, castU);
    else if (mode === 'run') p = A.run(runT);
    else if (mode === 'chan') p = A.chan(F.t);
    else if (mode === 'charge') { chargeT += s; p = A.sit(chargeT); }
    else if (mode === 'sit') {
      const drinkA = skin === 'qm' && ANIM[anim.drinkSkin] ? ANIM[anim.drinkSkin] : A;
      if (skin === 'qm') F.prop = F.props[anim.drinkSkin] ?? F.props.base;
      p = drinkA.sit ? drinkA.sit(F.t) : ANIM.base.sit(F.t);
    }
    else if (mode === 'dead') p = cp(DEAD);
    else if (mode === 'air') p = airOf(A, F.t);
    else p = A.idle(F.t);
    return p;
  }
  // Funken (Skin, Gear) ins Partikel-System des Spiels, ohne opts.spark in die eigenen Partikel
  const sparkOr = (p, c) => (opts.spark ? opts.spark(p, c) : emit(p, 1, V(0, .5, 0), c, -.3, .7, .12));
  // Schul-Effekte nach der Anzeige m (Stufen-Effekte)
  function fireFx(m: number, s: number, anim: any) {   // Flammen, Hülle, Glühen, Rauch beim Überhitzen, Funken über dem Kopf
    updateFlames(F, m, F.t);
    U.uK.value = clamp((m - .5) / .5, 0, 1); F.shell.visible = m > .5 && !LK;   // Skin (z. B. Glutprophet): keine Flammen-Hülle und kein Glühen über dem Körper, die Hitze zeigt der Skin selbst (Augen-Feuer)
    if (!LK) F.mat.emissive.setRGB(.5 * Math.max(0, m - .6), .12 * Math.max(0, m - .6), 0);
    if ((m >= .98 || anim.smoke) && !F.dead) { const n = rate(STAGE_FX.smoke * s); for (let i = 0; i < n; i++) emit(F.chest.getWorldPosition(V()).add(V(0, .7, 0)), 1, V(rnd(-.2, .2), 1.2, rnd(-.2, .2)), Math.random() < .5 ? 0x3a3330 : 0x5a504a, -.3, 1.4, .4); }
    if (Math.random() < s * 14 && !F.dead) emit(F.head.getWorldPosition(V()).add(V(0, .4, 0)), 1, V(0, 1.4, 0), Math.random() < .5 ? 0xff7a1a : 0xffd04a, -.5, .7, .2);
  }
  function iceFx(m: number, s: number, castU: number) {   // Eisschicht beim Zaubern, Reif, Atemwolke
    U.uM.value = m;
    const fr = A.cast.freeze;
    let target = mode === 'chan' ? .35 : 0;
    if (castU > fr[0] && castU < fr[1]) target = 1;
    F.freeze = lerp(F.freeze, target, Math.min(1, s * (target > F.freeze ? 10 : 4)));
    if (!LK) F.mat.emissive.setRGB(.35 * F.freeze, .55 * F.freeze, .7 * F.freeze);   // Skin: kein weißes Aufleuchten über dem ganzen Körper
    else if (iceTint) { const [r, g, b] = ICE_TINT.emissive; F.mat.emissive.setRGB(r * F.freeze, g * F.freeze, b * F.freeze); }   // Splitterkönig: nur ein Hauch Blau beim Zaubern
    if (castU > fr[1] && castU < fr[1] + .05) emit(F.chest.getWorldPosition(V()).add(V(0, .3, 0)), 25, V(0, 1, 0), 0xdff6ff, 4, .6, .6);
    if (F.freeze > .5 && Math.random() < s * 30) emit(F.chest.getWorldPosition(V()).add(V(0, .2, .1)), 1, V(0, .3, 0), 0xe8f8ff, -.2, .9, .8);
    if (m > .5) { const n = rate(STAGE_FX.frost * (m - .5) * s); for (let i = 0; i < n; i++) emit(pickBone(F).getWorldPosition(V()), 1, V(0, -.2, 0), Math.random() < .5 ? 0xe8f8ff : 0x9fd8ff, .4, .9, .18); }
    if (mode === 'idle' && (F.t % 2.6) < s) emit(F.head.getWorldPosition(V()).add(V(0, .12, .2)), 10, V(0, .15, .5), 0xffffff, -.1, 1, .08);
  }
  function arcaneFx(m: number) {   // Runen-Stufe, Glühen bei 4 Ladungen, Ladungs-Kugeln
    U.uLvl.value = Math.floor(m * 4 + 1e-6) / 4;
    const g = m >= .999 ? .1 + .04 * Math.sin(F.t * 8) : 0; F.mat.emissive.setRGB(g * .8, g * .3, g);   // Körper glüht nur bei 4 Ladungen
    // Ladungs-Kugeln über dem Kopf
    const n = Math.round(m * 4), h = F.head.getWorldPosition(V());
    F.orbs.visible = n > 0 && !F.dead;
    if (F.orbs.visible) {
      for (let i = 0; i < 4; i++) {
        const a = F.t * 1.5 + i / 4 * TAU;
        _o.position.set(h.x + Math.cos(a) * .42, h.y + .55 + .04 * Math.sin(F.t * 3 + i), h.z + Math.sin(a) * .42); _o.scale.setScalar(i < n ? .09 : .035); _o.updateMatrix();
        F.orbs.setMatrixAt(i, _om.copy(_o.matrix));
      }
      F.orbs.instanceMatrix.needsUpdate = true;
    }
  }
  function blitzFx(m: number, s: number, anim: any) {   // Blitz aus dem Himmel beim Aufladen, Blitze am Körper, Glühen
    const mm = mode === 'chan' ? Math.max(m, .6) : anim.over ? 1 : m;
    if (mode === 'charge') {   // Aufladen: nach 3 s schlägt ein Blitz aus dem Himmel in die Hand
      const k = chargeT % 4.4;
      if (k >= 3 && k - s < 3) {
        const hp = F.armR.hand.getWorldPosition(V());
        bolt(F.bolts, hp.clone().add(V(rnd(-1.5, 1.5), 12, rnd(-1, 1))), hp, .3, 3.5); bolt(F.bolts, hp.clone().add(V(rnd(-1, 1), 9, 0)), hp, .2, 2.2);
        emit(hp, 40, V(0, 0, 0), 0x8ff1ff, 3, .6, .2);
      }
    }
    updateBolts(F, mm, s);
    const k = m * m, f = m >= .98 ? .08 * Math.random() : 0; if (!LK) F.mat.emissive.setRGB(.12 * k + f, .42 * k + f, .75 * k + f);   // Skin (Hochspannung): Körper bleibt in seinen Farben, die Ladung zeigen Blitze und Flasche
  }
  function plagueFx(s: number, castU: number) {   // Pfütze, Tropfen schleudern beim Zaubern, Fäden an den Füßen
    F.melt = F.root.scale.y < .9 ? 1 + (1 - F.root.scale.y) : 1;   // Zerfließen (main.ts skaliert die Figur): Pfütze wächst
    F.goo.rate = mode === 'chan' ? 5 : mode === 'cast' ? 2 : 1;
    if (mode === 'cast' && castU >= A.cast.fling && castU - s * 1000 / Math.min(A.cast.dur, CAST_MS) < A.cast.fling) {
      const hp = F.armL.hand.getWorldPosition(V()), fw = V(0, 0, 1).transformDirection(F.root.matrixWorld);
      F.goo.st.filter(d => d.ph === 'wait').slice(0, 8).forEach(d => { d.ph = 'fall'; d.p.copy(hp); d.v.copy(fw).multiplyScalar(rnd(3, 6)).add(V(rnd(-1, 1), rnd(1, 3), rnd(-1, 1))); });
    }
    updateGoo(F, s, F.t);
    // Füße kleben: Faden vom Boden-Klebepunkt zum Fuß, solange der Fuß in der ersten Schwungphase ist
    [F.legL, F.legR].forEach((l, si) => {
      const fp = l.ft.getWorldPosition(V()), G = F.goo;
      if (mode === 'run' && fp.y > F.groundY + .075) { if (G.stick[si] == null) G.stick[si] = fp.clone().setY(F.groundY + .02); }
      else G.stick[si] = null;
      const a = G.stick[si];
      if (a && fp.distanceTo(a) > .32) { const d = G.st.find(x => x.ph === 'wait'); if (d) Object.assign(d, { ph: 'splat', t: 1.5, p: a.clone() }); G.stick[si] = false; }
      setStrand(G, si, G.stick[si] || null, fp, .018);
    });
  }
  function welSparks(s: number) {
    if (F.wel != null && !F.dead && Math.random() < s * WEL_SPARK) {   // Funken in Element-Farbe, steigen leicht auf
      let p;
      if (Math.random() < .5) p = (Math.random() < .5 ? F.armL : F.armR).hand.getWorldPosition(V());
      else { F.staff.updateWorldMatrix(true, false); p = F.staff.localToWorld(V(0, WEL_STONE_Y, 0)); }
      if (opts.spark) opts.spark(p, F.wel); else emit(p, 1, V(0, .5, 0), F.wel, -.3, .7, .12);
    }
  }
  return {
    root: F.root,
    look,                                         // Skin, nach dem gebaut wurde
    element: F.wel != null ? weaponElement : null,   // Element der Waffe, nach dem gebaut wurde (models/heroModel.ts baut bei Wechsel neu)
    body: F.body,                                 // Körper-Mesh: Hüllen der Effekte (Archon) binden an sein Skelett
    anchors: { crystal: F.crystal, handL: F.armL.hand, handR: F.armR.hand },
    trail,
    scarf: world,                                 // liegt in Weltkoordinaten, models/heroModel.ts legt es in die Szene
    fx: SKIN_FX[gameSkin] || SKIN_FX.alle,
    get tris() { return Math.round(F.body.geometry.attributes.position.count / 3); },
    // Anzeige der Figur 0 … 1: Hitze, Kälte, Ladungen/4, Batterie
    setMeter(v) { F.m = clamp(v || 0, 0, 1); },
    get meter() { return F.m; },
    // Gag-Werte des Skins (Tests): Pegel der Flasche, Größe des Müllbeutels, sichtbare Splitter
    get kosState() { return { ids: F.kos?.ids ?? [], hidden: F.kosHidden, glass: !!F.glass, flag: !!F.flag }; },   // Tests
    // Ereignis fürs Modell (figEvents.ts über models/heroModel.ts): Zeit merken, Reaktionen der Kosmetik auslösen. sprint: on = an/aus
    onEvent(e: KosEvent, on?: boolean) {
      if (!F.kos) return;
      if (e === 'sprint') kosSprint = !!on;
      kosT[e] = F.t;
      const fr = kosFrame(0);
      for (const fn of F.kos.ons) fn(e, fr);
    },
    get gearState() { return { hidden: F.gear.hidden, anim: F.gear.anim.length, fx: F.gear.fx.length, el: F.gear.el }; },   // Tests
    get lookState() { const L = F.lk; return L ? { look: L.look, lvl: L.lvl, bag: L.bag?.scale.x, marks: L.marks, shards: L.shown } : null; },
    // Laufende Animation für den Neubau bei Waffenwechsel (models/heroModel.ts): Zeit, Modus, Zaubern, Laufphase, Überblendung, Anzeige
    get animState() { return { t: F.t, m: F.m, last: F.last, blendFrom: F.blendFrom, blendT: F.blendT, freeze: F.freeze, uTime: U.uTime.value, loco, mode, castT, castKeys, runT, wasCast, chargeT }; },
    adoptAnim(a) {
      Object.assign(F, { t: a.t, m: a.m, last: a.last, blendFrom: a.blendFrom, blendT: a.blendT, freeze: a.freeze });
      U.uTime.value = a.uTime;
      ({ loco, mode, castT, castKeys, runT, wasCast, chargeT } = a);
    },
    update(dt, anim: any = {}) {
      const s = Math.min(.1, dt > 1 ? dt / 1000 : dt);
      if (trail) trail.update(s);
      if (anim.frozen) return;
      U.uTime.value += s;
      F.t += s;
      loco = anim.state || 'idle';
      F.dead = loco === 'dead';
      const moving = loco === 'run' || loco === 'back';
      const charging = skin === 'blitz' && !!anim.charge && !moving;
      const castU = stepCast(s, (anim.cast || 0) > 0, moving, charging);
      const next = nextMode(moving, charging, anim.channel, castU);
      if (next !== mode) { F.blendFrom = F.last; F.blendT = .25; mode = next; if (mode === 'charge') chargeT = 0; }
      if (moving) runT += s * (anim.speed || 7) / 7 * (loco === 'back' ? -1 : 1);
      setCurM(skin === 'blitz' ? F.m : .5);
      let p = poseFor(s, anim, castU);
      if (anim.squat) p.y -= anim.squat * .15;
      if (F.blendT > 0 && F.blendFrom) { F.blendT -= s; p = mix(F.blendFrom, p, 1 - clamp(F.blendT / .25, 0, 1)); }
      F.last = p;

      // Schweben: die Füße bleiben im Pose-Raum, die ganze Figur hebt sich (im Tod nicht)
      if (fl && mode !== 'dead') F.root.position.y += fl + .07 * Math.sin(F.t * 1.3);
      applyPose(F, p);
      if (F.gear.anim.length) animateGear(F.gear.anim, F.t);   // Gear: wehen, drehen, kreisen (gearParts.ts)
      updateKos(s);   // Kosmetik: Reaktionen additiv auf die Pose (Arme, Kopf, Hüpfen), eigene Bones, Partikel
      F.root.getWorldPosition(F.groundPos); F.groundY = F.groundPos.y - (fl && mode !== 'dead' ? fl + .07 * Math.sin(F.t * 1.3) : 0);
      if (F.lk) updateLook(F, s, sparkOr);
      if (!F.dead) updateGearFx(F, s, sparkOr);

      // Stufen-Effekte der Schule nach der Anzeige m
      const m = F.dead ? 0 : F.m;
      if (F.flames) fireFx(m, s, anim);
      if (skin === 'ice') iceFx(m, s, castU);
      if (F.runeMesh) arcaneFx(m);
      if (F.bolts) blitzFx(m, s, anim);
      if (F.goo) plagueFx(s, castU);
      welSparks(s);
      updateParts(s);
      if (trail && moving) { F.root.updateMatrixWorld(true); watch((x, y, z, a, side) => trail.add(x, y, z, a, side)); }
    },
  };
}
const pickBone = F => F.burnBones[Math.floor(Math.random() * F.burnBones.length)];
