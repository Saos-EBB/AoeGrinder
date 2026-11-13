// ───────────────────────── Skins (src/skins.ts): Teile an Bones ins Körper-Mesh, Leuchtteile ins Glühen, Gag-Teile auf eigenen Bones

import * as THREE from 'three';
import { lerpTo as lerp, V } from '../../util';
import { state } from '../../state';
import { markStacks } from '../../plagueMarks';
import { A1, A2, col, L1, L2, nextFacet, rate, TAU } from './shared';
import { FACETTE, LAMP_COMP, LOOKS } from './palette';

const tubeGeo = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 4);
const zigPts = (x, y0, y1, amp, n) => Array.from({ length: n + 1 }, (_, i) => V(x, lerp(y0, y1, i / n), i % 2 ? amp : -amp));
const SK = {   // Optik-Zahlen der Skins // PH
  blitz: { lvlMin: .08, lvlRate: 4, drip: 6, full: .98, arcs: 24 },   // Pegel: mindestens 8 %, folgt der Anzeige mit 4/s; Funken pro Sekunde am Korken (+ drip × Pegel) und bei voller Flasche zu den Händen
  glut: { flame: [.45, .8], flick: 9 },   // Augen-Feuer: Länge 45 % ohne Hitze bis 125 % bei voller Hitze, Flackern pro Sekunde
  frost14: { slots: [2, 4, 4], r: .72, y: 1.35, spin: .8, sparkle: 6 },   // Splitter: Plätze für leuchtende (je 25), große (je 5), kleine; Bahn-Radius und Höhe; Umläufe; Glitzern pro Sekunde je leuchtendem
  seuche: { perMark: .06, cap: 20, every: .25, grow: 3, steam: 8, flies: 6, drip: .7 },   // Müllbeutel +6 % pro markiertem Mob, höchstens 20 zählen (× 2,2), gezählt alle 0,25 s; Dampf pro Sekunde; Fliegen; Tropfen pro Sekunde an den Manschetten
};
export function buildLook(F, look, { part, glow, B, M }) {
  const { chest, hips, head } = F, arms = [F.armL, F.armR], legs = [F.legL, F.legR];
  const L: any = F.lk = { look, lvl: SK.blitz.lvlMin };
  const at = (list, bone, base, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => list.push({ bone, geo, color, m: base.clone().multiply(M(pos, rot, scl)) });
  const eye = d => (F.wel != null ? col(F.wel) : col(d));   // Augen in der Farbe des Waffen-Elements, sonst die des Skins
  const sneakers = () => { for (const l of legs) { part(l.ft, new THREE.BoxGeometry(.14, .1, .3), col(0xe8e8e8), [0, -.02, .07]); part(l.ft, new THREE.BoxGeometry(.15, .03, .31), col(0xb8b8c0), [0, -.07, .07]); } };   // weiße Sneaker mit grauer Sohle

  if (look === 'blitz') {   // Hochspannung: Trainingsanzug mit eigenem Zickzack-Streifen, Sonnenbrille, Kupferkette, Isolierband-Bündchen, Flasche mit Strom auf dem Rücken
    const YEL = col(0xffe866), WHITE = col(0xe8e8e8), COPPER = col(0xc97a3a), BLACK = col(0x0b0b0b);
    part(chest, new THREE.BoxGeometry(.014, .42, .012), col(0xd8d8d8), [0, .33, .112], [.12, 0, 0]);   // Reißverschluss
    for (const a of arms) { glow(a.ua, tubeGeo(zigPts(a.side * .06, -.02, -A1, .02, 6), .009), YEL); glow(a.fa, tubeGeo(zigPts(a.side * .054, 0, -A2 * .9, .02, 6), .009), YEL); }   // Zickzack-Streifen außen
    for (const l of legs) { glow(l.th, tubeGeo(zigPts(l.side * .083, -.04, -L1, .024, 7), .01), YEL); glow(l.sh, tubeGeo(zigPts(l.side * .067, 0, -L2 * .92, .024, 7), .01), YEL); }
    for (const a of arms) part(a.fa, new THREE.TorusGeometry(.056, .017, 4, 12), WHITE, [0, -A2 * .97, 0], [Math.PI / 2, 0, 0]);   // Isolierband-Bündchen
    part(chest, new THREE.TorusGeometry(.12, .012, 4, 20), COPPER, [0, .52, .03], [1.2, 0, 0], [1, 1, .8]);   // Kupferkette
    sneakers();
    part(head, new THREE.SphereGeometry(.19, 12, 6, 0, TAU, 0, Math.PI * .45), col(0x2a221c), [0, .16, -.02], [-.4, 0, 0], [.97, 1.1, 1.02]);   // Haar, nach hinten gekippt
    const lens = F.wel != null ? glow : part, LC = F.wel != null ? eye(0) : BLACK;   // Sonnenbrille: mit Waffen-Element leuchten die Gläser
    for (const sx of [-1, 1]) lens(head, new THREE.BoxGeometry(.1, .05, .025), LC, [sx * .068, .17, .165], [0, sx * .35, 0]);
    part(head, new THREE.BoxGeometry(.26, .014, .02), BLACK, [0, .188, .168]);
    // Flasche auf dem Rücken: Glas (undurchsichtig, blass), Strom als Flüssigkeit etwas dicker als das Glas, Pegel über die Bone-Skalierung
    const Mb = M([-.1, .36, -.25], [0, 0, -.25]);
    at(F.parts, chest, Mb, new THREE.CylinderGeometry(.12, .12, .44, 12), col(0x8fb0c4).multiplyScalar(.5));
    at(F.parts, chest, Mb, new THREE.CylinderGeometry(.05, .12, .1, 12), col(0x8fb0c4).multiplyScalar(.5), [0, .27, 0]);
    at(F.parts, chest, Mb, new THREE.CylinderGeometry(.045, .045, .06, 8), col(0x8a6a3a), [0, .35, 0]);
    for (const y of [-.22, .2]) at(F.parts, chest, Mb, new THREE.TorusGeometry(.124, .012, 4, 14), COPPER, [0, y, 0], [Math.PI / 2, 0, 0]);
    const bot = V(0, -.21, 0).applyMatrix4(Mb);
    const lq = L.liquid = B(chest, bot.x, bot.y, bot.z); lq.rotation.z = -.25;
    F.glow.push({ bone: lq, geo: new THREE.CylinderGeometry(.126, .126, .42, 12).translate(0, .21, 0), color: YEL, m: new THREE.Matrix4(), noShell: true });
    L.cork = new THREE.Object3D(); L.cork.position.copy(V(0, .38, 0).applyMatrix4(Mb)); chest.add(L.cork);
  }

  if (look === 'seuche') {   // Pestbringer: verwester Anzug Dunkellila/Grün/Gold, Pestmaske mit Hut, Phiolen-Kette, Umhangrest, tropfende Manschetten, Dampf, Fliegen, Müllbeutel in der freien Hand
    const PURPLE = col(0x3b1f46), GOLD = col(0xc9a640), BONE = col(0xd8cfb0).multiplyScalar(.5), SLIME = col(0x7dff3a), HAT = col(0x2e1838);
    const skirt = new THREE.CylinderGeometry(.19, .25, .38, 10, 1, true), sp = skirt.attributes.position;   // Schoß mit ausgefranstem Saum
    for (let i = 0; i < sp.count; i++) if (sp.getY(i) < 0) sp.setY(i, sp.getY(i) - (i % 2) * .08);
    part(hips, skirt, PURPLE, [0, -.15, 0], [0, 0, 0], [1, 1, .74]);
    for (let k = 0; k < 3; k++) part(chest, new THREE.SphereGeometry(.016, 6, 4), GOLD, [0, .42 - k * .12, .1 - k * .01]);   // Knöpfe
    for (const [b, p] of [[chest, [-.08, .16, .085]], [chest, [.1, .36, .1]], [F.legL.th, [0, -.3, .075]]] as any) glow(b, new THREE.SphereGeometry(.024, 6, 4), SLIME, p);   // Schleim-Flecken
    for (const sx of [-1, 1]) part(chest, new THREE.BoxGeometry(.19, .7, .014), PURPLE, [sx * .1, .17, -.125], [.1, 0, sx * .08]);   // Umhangrest
    part(chest, new THREE.TorusGeometry(.1, .006, 3, 16), GOLD, [0, .53, .04], [1.25, 0, 0]);   // Phiolen-Kette
    for (let k = 0; k < 3; k++) glow(chest, new THREE.CylinderGeometry(.018, .018, .06, 6), col(k === 1 ? 0xb46bff : 0x7dff3a), [(k - 1) * .06, .48, .11]);
    for (const a of arms) {   // Manschetten, je ein Tropfen auf eigenem Bone
      part(a.fa, new THREE.CylinderGeometry(.066, .072, .07, 8), col(0x5a2a66), [0, -A2 * .93, 0]);
      const d = B(a.fa, 0, -A2 * .97, 0); (L.drops ??= []).push(d);
      F.glow.push({ bone: d, geo: new THREE.SphereGeometry(.022, 6, 4), color: SLIME, m: new THREE.Matrix4(), noShell: true });
    }
    // Pestmaske: Schnabel, Gold-Brille (Gläser leuchten in Schleim- oder Waffen-Farbe), Hut
    part(head, new THREE.ConeGeometry(.075, .3, 8), BONE, [0, .09, .26], [Math.PI / 2 + .45, 0, 0]);
    for (const sx of [-1, 1]) {
      part(head, new THREE.TorusGeometry(.042, .01, 4, 10), GOLD, [sx * .068, .19, .165], [0, sx * .35, 0]);
      glow(head, new THREE.SphereGeometry(.032, 8, 6), eye(0x7dff3a), [sx * .068, .19, .16], [0, sx * .35, 0], [1, 1, .5]);
    }
    part(head, new THREE.CylinderGeometry(.24, .24, .022, 16), HAT, [0, .32, -.02], [-.12, 0, 0]);   // Krempe, nach hinten gekippt: das Gesicht bleibt sichtbar
    part(head, new THREE.CylinderGeometry(.12, .145, .18, 12), HAT, [0, .42, -.03], [-.12, 0, 0]);
    part(head, new THREE.TorusGeometry(.142, .011, 4, 16), GOLD, [0, .345, -.02], [Math.PI / 2 - .12, 0, 0]);
    // Müllbeutel: eigener Bone an der linken Hand (dort sitzt auch die Trink-Requisite), wächst mit den markierten Mobs
    const bag = L.bag = B(F.armL.hand, 0, -.02, 0), BAG = col(0x1c1a20), r0 = .13;
    F.parts.push({ bone: bag, geo: new THREE.SphereGeometry(1, 10, 8), color: BAG, m: M([0, -r0 * 1.1, 0], [0, 0, 0], [r0, r0 * 1.2, r0]), noShell: true });
    F.parts.push({ bone: bag, geo: new THREE.ConeGeometry(.03, .07, 6), color: BAG, m: M([0, -.01, 0], [Math.PI, 0, 0]), noShell: true });
    L.marks = 0; L.markT = 0; L.size = 1;
    if (F.skin !== 'plague') for (let i = 0; i < SK.seuche.flies; i++) {   // Fliegen (die Seuchen-Schule hat eigene)
      const f = B(F.root); (L.flies ??= []).push({ b: f, a: i * 1.7, r: .45 + (i % 3) * .12, y: (i % 4) * .15 - .2, s: 1.5 + (i % 5) * .45 });
      F.parts.push({ bone: f, geo: new THREE.SphereGeometry(.02, 5, 4), color: col(0x0b0a0e), m: new THREE.Matrix4(), noShell: true });
    }
  }
  if (look === 'glut') {   // Glutprophet: Streetwear, schwarzer Hoodie, hellblaue Baggy, weiße Sneaker, Sturmhaube, scharfe Augen mit Hitzekern und Flammenzungen, Bauchtasche quer, Skulls und Schlüssel am Bund
    const BLACK = col(0x1a1a1e), DARK = col(0x101013), WHITE = col(0xd8d8d8), BONE = col(0xece4d0).multiplyScalar(.55), STEEL = col(0xb0b0b8).multiplyScalar(.7), PANTS = LOOKS.glut.pants;
    part(chest, new THREE.SphereGeometry(.2, 10, 6), BLACK, [0, .58, -.13], [0, 0, 0], [1.05, .55, .75]);   // Kapuze im Nacken
    part(chest, new THREE.BoxGeometry(.3, .15, .02), DARK, [0, .13, .085], [-.12, 0, 0]);                 // Bauchtasche des Hoodies
    for (const x of [-.05, .05]) part(chest, new THREE.CylinderGeometry(.007, .007, .17, 4), WHITE, [x, .5, .115], [.15, 0, 0]);   // Kordeln
    for (const a of arms) part(a.fa, new THREE.TorusGeometry(.055, .017, 4, 12), DARK, [0, -A2 * .97, 0], [Math.PI / 2, 0, 0]);   // Bündchen
    part(hips, new THREE.TorusGeometry(.18, .018, 4, 16), col(0x2a2a2e), [0, .05, 0], [Math.PI / 2, 0, 0], [1.05, 1, .8]);   // Gürtel
    [.17, .11, .05].forEach(x => {   // 3 Skulls am Bund
      part(hips, new THREE.CylinderGeometry(.005, .005, .06, 3), STEEL, [x, .02, .13]);
      part(hips, new THREE.SphereGeometry(.032, 7, 5), BONE, [x, -.04, .135]);
      for (const ex of [-.011, .011]) part(hips, new THREE.SphereGeometry(.008, 4, 3), DARK, [x + ex, -.038, .162]);
    });
    part(hips, new THREE.TorusGeometry(.026, .006, 3, 8), STEEL, [-.2, .0, .04], [0, Math.PI / 2, 0]);   // Schlüssel am Karabiner
    for (const [x, r] of [[-.007, .2], [.009, -.25]]) part(hips, new THREE.BoxGeometry(.012, .065, .005), col(0xd8b04a).multiplyScalar(.7), [-.2 + x, -.06, .04], [0, 0, r]);
    for (const l of legs) part(l.sh, new THREE.TorusGeometry(.085, .035, 4, 10), PANTS, [0, -L2 * .9, 0], [Math.PI / 2, 0, 0]);   // gestauchter Saum der Baggy
    sneakers();
    // Bauchtasche quer über die Brust: Gurte vorn und hinten, Tasche mit leuchtendem Reißverschluss
    part(chest, tubeGeo([V(.2, .56, .07), V(.05, .36, .12), V(-.17, .1, .09)], .013), DARK);
    part(chest, tubeGeo([V(.2, .56, -.07), V(.02, .34, -.13), V(-.17, .1, -.09)], .013), DARK);
    part(chest, new THREE.CapsuleGeometry(.055, .18, 2, 8), col(0x24242a), [-.01, .34, .14], [0, 0, Math.PI / 2 - .75]);
    glow(chest, new THREE.BoxGeometry(.19, .01, .012), col(0xff7a22), [-.01, .34, .195], [0, 0, -.75]);
    // Sturmhaube (Kopf schwarz): Augenschlitz, schmale schräge Augen mit Hitzekern, Lidschatten
    part(head, new THREE.BoxGeometry(.26, .06, .03), col(0x3a2a24).multiplyScalar(.6), [0, .15, .165]);
    for (const sx of [-1, 1]) {
      glow(head, new THREE.SphereGeometry(1, 8, 5), col(0xffe9a0), [sx * .065, .15, .177], [0, 0, sx * .28], [.039, .008, .009]);
      glow(head, new THREE.SphereGeometry(.0075, 5, 4), eye(0xff7a0d), [sx * .06, .15, .184]);
      part(head, new THREE.BoxGeometry(.084, .012, .012), col(0x0b0809), [sx * .065, .17, .182], [0, 0, sx * .32]);
    }
    // Flammenzungen aus den Augen (Feuer-Palette rot → orange → gelb), je Auge ein Bone: Länge folgt der Hitze, das Glühen flackert im Shader
    const PAL5 = [0xd11d0a, 0xff7a0d, 0xffd23a];
    L.eyeFl = [-1, 1].map(sx => {
      const b = B(head, sx * .075, .15, .17);
      for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) {
        const g = new THREE.ConeGeometry(.033 - k * .009, .5 * (1 - k * .25) * (1 - i * .15), 6, 1, true).translate(0, .25 * (1 - k * .25) * (1 - i * .15), 0);
        F.glow.push({ bone: b, geo: g, color: { base: col(PAL5[k]), tip: col(PAL5[Math.max(0, k - 1)]) }, flick: true, noShell: true,
          m: M([sx * i * .012, 0, -k * .004], [-.5 - i * .12, 0, -sx * (.25 + i * .18)]) });
      }
      return b;
    });
  }

  if (look === 'frost14') {   // Splitterkönig: Muster Facette, Schnitt 14 „Weste mit Stehkragen“, Platin-Perücke, Eis-Schulter links, Kristall-Kette, Eis-Manschetten, Knöchel frei, spitze Lackschuhe
    const LK_SHOE = LOOKS.frost14.shoe, LIGHT = col(0xeaf3fb).multiply(LAMP_COMP), ICE = col(0xbfe9ff).multiplyScalar(.5), CRY = col(0x9fe4ff), PLAT = col(0xe8eef6).multiply(LAMP_COMP).multiplyScalar(.8), PEARL = col(0xd8e4f0).multiplyScalar(.5);
    nextFacet(); part(chest, new THREE.CylinderGeometry(.095, .1, .1, 10), FACETTE, [0, .63, 0], [0, 0, 0], [1, 1, .9]);   // Stehkragen
    for (let k = 0; k < 5; k++) part(chest, new THREE.SphereGeometry(.012, 5, 4), PEARL, [0, .44 - k * .085, .108 - k * .006]);   // Knopfleiste
    part(chest, new THREE.ConeGeometry(.07, .2, 3), LIGHT, [0, .5, .1], [Math.PI, 0, 0], [1, 1, .25]);   // Hemd im Westen-Ausschnitt
    nextFacet(); part(hips, new THREE.CylinderGeometry(.17, .2, .2, 10, 1, true), FACETTE, [0, -.05, 0], [0, 0, 0], [1, 1, .74]);   // Westen-Saum über der Hüfte
    for (const a of arms) glow(a.fa, new THREE.OctahedronGeometry(.02, 0), CRY, [0, -A2 * .9, .055]);   // Eis-Manschetten
    [[0, .1, 0, .32], [-.05, .08, .04, -.2], [.04, .07, -.04, .6], [-.02, .05, .05, 1]].forEach(([x, h, z, r]) =>   // Eis-Schulter links
      part(chest, new THREE.ConeGeometry(.036, (.12 + h) * 1.2, 5), ICE, [.25 - x, .56 + h * .6, z - .02], [r * .3, 0, -(.5 + r * .4)]));
    part(chest, new THREE.TorusGeometry(.07, .005, 3, 16), PEARL, [0, .57, .05], [1.3, 0, 0]);   // Kette
    glow(chest, new THREE.OctahedronGeometry(.022, 0), CRY, [0, .5, .125]);                      // Kristall
    for (const l of legs) part(l.ft, new THREE.BoxGeometry(.08, .06, .1), LK_SHOE, [0, -.05, -.02]);   // Absatz zum spitzen Lackschuh
    // Platin-Perücke: Kappe nach hinten gekippt, hohe Welle, Spitze nach hinten, Spiral-Locke an der Schläfe
    part(head, new THREE.SphereGeometry(.19, 12, 8, 0, TAU, 0, Math.PI * .6), PLAT, [0, .17, -.03], [-.45, 0, 0], [.97, 1.1, 1.02]);
    part(head, new THREE.SphereGeometry(1, 10, 6), PLAT, [.03, .385, .045], [-.5, 0, -.15], [.15, .11, .22]);
    part(head, new THREE.ConeGeometry(.075, .3, 6), PLAT, [.045, .415, -.18], [-2.1, 0, .1]);
    const coil = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * Math.PI * 4; coil.push(V(-.17 + Math.cos(a) * .04, .19 - i / 30 * .18, .06 + Math.sin(a) * .04)); }
    part(head, tubeGeo(coil, .018), PLAT);
    for (const sx of [-1, 1]) glow(head, new THREE.SphereGeometry(1, 8, 6), eye(0x7cc8ff), [sx * .063, .15, .172], [0, 0, 0], [.017, .026, .012]);   // Augen
    // Splitter (figures.ts: state.shards): 5 klein → 1 groß, 5 groß → 1 leuchtend, kreisen um die Figur. Je Platz ein Bone, leer = versteckt
    const SH = [[new THREE.OctahedronGeometry(.085, 0), col(0xe9fbff), 1], [new THREE.OctahedronGeometry(.06, 0), col(0x7cc8ff), 0], [new THREE.OctahedronGeometry(.026, 0), col(0xf2fbff), 1]] as const;
    L.shards = SK.frost14.slots.map((n, kind) => Array.from({ length: n }, () => {
      const b = B(F.root), [geo, c, g] = SH[kind];
      (g ? F.glow : F.parts).push({ bone: b, geo: geo.clone(), color: c, m: new THREE.Matrix4(), noShell: true });
      return b;
    }));
    L.shown = 0;
  }

}
// Gags: liest nur Anzeige und Spielstand, ändert nichts. sp(p, color) = Funken ins Partikel-System
const _lp = V(), _lq = V(), _lqa = new THREE.Quaternion(), _lqb = new THREE.Quaternion();
export function updateLook(F, s, sp) {
  const L = F.lk;
  if (L.look === 'glut') {   // Augen-Feuer: lodert mit der Hitze (Anzeige der Figur)
    const k = SK.glut, len = F.dead ? 1e-4 : (k.flame[0] + k.flame[1] * F.m) * (1 + .08 * Math.sin(F.t * k.flick));
    for (const b of L.eyeFl) b.scale.set(1, len, 1);
  }
  if (L.look === 'frost14') {
    const k = SK.frost14, n = F.dead ? 0 : Math.max(0, Math.floor(state.shards ?? 0));
    const want = [Math.min(k.slots[0], Math.floor(n / 25)), Math.min(k.slots[1], Math.floor(n % 25 / 5)), Math.min(k.slots[2], n % 5)];
    const total = want[0] + want[1] + want[2]; let i = 0;
    L.shown = total;
    L.shards.forEach((list, kind) => list.forEach((b, j) => {
      if (j >= want[kind]) { b.scale.setScalar(1e-4); return; }
      const a = i++ / total * TAU + F.t * k.spin;
      b.position.set(Math.cos(a) * k.r, k.y + Math.sin(a * 2 + F.t) * .14, Math.sin(a) * k.r); b.rotation.y = F.t * 2; b.scale.setScalar(1);
      if (kind === 0 && Math.random() < s * k.sparkle) sp(F.root.localToWorld(_lp.copy(b.position)), 0x7cd8ff);
    }));
  }
  if (L.look === 'seuche') {
    const k = SK.seuche;
    if ((L.markT -= s) <= 0) {   // markierte Mobs zählen (plagueMarks.ts), nur lesen
      L.markT = k.every; let n = 0;
      for (const m of state.mobs) if (!m.dead && markStacks(m) > 0) n++;
      L.marks = n;
    }
    L.size = lerp(L.size, 1 + Math.min(k.cap, L.marks) * k.perMark, Math.min(1, s * k.grow));
    // Beutel hängt immer nach unten (gegen die Drehung der Hand), schwingt leicht; beim Trinken weg
    F.armL.hand.getWorldQuaternion(_lqa).invert(); F.root.getWorldQuaternion(_lqb);
    L.bag.quaternion.copy(_lqa.multiply(_lqb)); L.bag.rotateZ(Math.sin(F.t * 2) * .06);
    L.bag.scale.setScalar(F.dead || (F.last?.ps ?? 0) > .02 ? 1e-4 : L.size);
    L.drops.forEach((d, i) => { const u = (F.t * k.drip + i * .5) % 1; d.position.y = -A2 * .97 - u * .35; d.scale.setScalar(F.dead ? 1e-4 : 1 - u * .6); });
    if (L.flies) {
      F.root.worldToLocal(F.head.getWorldPosition(_lq));
      for (const f of L.flies) { const a = f.a + F.t * f.s; f.b.position.set(_lq.x + Math.cos(a) * f.r, _lq.y + f.y + Math.sin(F.t * 7 + f.a) * .08, _lq.z + Math.sin(a * 1.3) * f.r); f.b.scale.setScalar(F.dead ? 1e-4 : 1); }
    }
    if (F.dead) return;
    for (let n = rate(s * k.steam); n > 0; n--) {   // Dampf rund um die Figur
      const a = Math.random() * TAU, r = .3 + Math.random() * .2;
      F.root.localToWorld(_lp.set(Math.cos(a) * r, .2 + Math.random() * 1.6, Math.sin(a) * r));
      sp(_lp, Math.random() < .5 ? 0x7dff3a : 0xb46bff);
    }
  }
  if (L.look === 'blitz') {   // Pegel = Anzeige der Figur (Blitz: Batterie)
    const k = SK.blitz;
    L.lvl = lerp(L.lvl, F.dead ? k.lvlMin : Math.max(k.lvlMin, F.m), Math.min(1, s * k.lvlRate));
    L.liquid.scale.set(1, L.lvl, 1);
    if (F.dead) return;
    L.cork.getWorldPosition(_lp);
    for (let n = rate(s * (1 + k.drip * L.lvl)); n > 0; n--) sp(_lp, 0xffe866);
    if (L.lvl >= k.full) for (let n = rate(s * k.arcs); n > 0; n--) { (Math.random() < .5 ? F.armL : F.armR).hand.getWorldPosition(_lq); sp(_lq.lerp(_lp, Math.random()), 0xfff6b0); }
  }
}
