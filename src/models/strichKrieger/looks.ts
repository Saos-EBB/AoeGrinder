// Skins des Strichkriegers am Körper (KOMP-04): je Skin ein Block `if (look === …)`, Teile über partKit (gleiches Körper-Mesh). Aus strichKrieger.ts herausgezogen, Werte unverändert.
import * as THREE from 'three';
import { V } from '../../util';
import { TAU, M4, col, hp, tube, HOLZ, partKit, showTag, tintTag } from './parts';
import type { Fig } from './fig';

// Skins (src/skins.ts): Teile mit part(bone, …) wie oben, je Skin ein Block `if (look === …)`. Vorlage docs/ref/set-skins-krieger.html (SKINS).
// Alles landet im selben Körper-Mesh (0 Draw Calls extra). Kopf-Maße des Viewers mit hp() aufs Spiel umrechnen (Kopf hier r .15 statt .12)
// Viewer-Farben gedimmt: das Spiel-Licht ist auf die dunkle Tusche abgestimmt, helle Stoffe würden sonst ausbrennen (Bloom)
// Rückgabe: Stoffbahn hinten (Farbe, Breite) und Sprechblasen (ui/skinTalk.ts: kind, keys, plate)
export function lookBody(F: Fig, look: string) {
  const { part, drop, paint, rod, band } = partKit(F);
  const { parts, hips, chest, head, armL, armR, legL, legR, clothAnchor } = F;
  const { pHips, pChest, pNeck, pHead, pBelt } = F.bp;
  let cloth0 = { color: 0xa3151b, w: 1 };   // Stoffbahn hinten: Farbe, Breite
  const TALK: any = {};                      // Sprechblasen (ui/skinTalk.ts): kind, keys, plate
  if (look === 'klapse') {
    // Ausbrecher: Zwangsjacke, linker Ärmel aufgerissen, Gurte, Krankenhaus-Hose, Schlappen, wirre Haare, Pflaster, Glubschaugen
    const jacket = col(0xe8e4d8), pants = col(0xa8c0c8), strap = col(0x6a5a48), skin = col(0xe8ccb0), ink = col(0x15121a);
    drop(armL.plate);
    paint(jacket, pChest, armL.pu, armR.pu, armR.pf);
    paint(skin, pNeck, pHead, armL.pf, armL.ph, armR.ph);
    paint(pants, pHips, legL.pt, legL.ps, legR.pt, legR.ps);
    paint(col(0x8aa0b0), legL.pf, legR.pf);
    paint(strap, pBelt);
    // ausgefranster Saum am Ellbogen links
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; part(armL.fa, new THREE.ConeGeometry(.03, .1 + (i % 2) * .04, 4), jacket, [Math.cos(a) * .085, -.04, Math.sin(a) * .085], [Math.PI, 0, 0]); }
    // drei Gurte um die Brust mit Schnallen vorne (Radien am Brust-Profil)
    for (const [y, r] of [[.42, .28], [.26, .215], [.1, .16]]) {
      band(chest, [0, y, 0], r, .018, strap, [1.15, .7, 1], 16);
      part(chest, new THREE.BoxGeometry(.05, .045, .03), col(0xb0b0b8), [.06, y, r * .7 + .01]);
    }
    // baumelnde Gurte vorne (fest), der hinten ist die Stoffbahn
    part(chest, new THREE.BoxGeometry(.035, .34, .012), strap, [-.12, -.15, .13], [.1, 0, .12]);
    part(chest, new THREE.BoxGeometry(.035, .44, .012), strap, [.14, -.2, .12], [.08, 0, -.1]);
    cloth0 = { color: 0x6a5a48, w: .35 };
    // wirre Haare, Pflaster-Kreuz, Glubschaugen, schiefes Grinsen
    const hair = col(0x5a4a3a);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; part(head, new THREE.ConeGeometry(.05, .17, 5), hair, hp(Math.cos(a) * .07, .1 + Math.sin(i * 3) * .02, Math.sin(a) * .07 - .02), [Math.sin(a) * .9, 0, -Math.cos(a) * .9]); }
    for (const r of [.5, -.5]) part(head, new THREE.BoxGeometry(.08, .026, .015), col(0xf2ece0), hp(.04, .06, .108), [0, 0, r]);
    for (const [x, r] of [[-.042, .042], [.042, .034]]) { part(head, new THREE.SphereGeometry(r, 8, 6), col(0xffffff), [x * 1.3, .13, .145], [0, 0, 0], [1, 1, .45]); part(head, new THREE.SphereGeometry(.011, 5, 4), ink, [x * 1.3 + .005, .132, .163]); }
    part(head, new THREE.TorusGeometry(.055, .011, 3, 10, Math.PI), ink, [0, .065, .142], [0, 0, Math.PI + .15]);
    Object.assign(TALK, { kind: 'whisper', keys: [1, 2, 3, 4, 5, 6, 7].map(i => `look.krieger.klapse.say${i}`) });
  }
  if (look === 'classic') {
    // Classic-Krieger 55, „Clownsuit“: jedes Teil aus einem anderen Dungeon. Low-Poly mit harten Kanten (flat)
    const purple = col(0x5a3a8a), purple2 = col(0x7a5ab0), red = col(0xa8231c), gold = col(0xc9a640), steel = col(0x8a929c),
      green = col(0x5a7a3a), yel = col(0xd8e03a), pink = col(0xff5ab0), brown = col(0x6a4022), navy = col(0x2a3a6a), skin = col(0xe0b898), ink = col(0x15121a);
    const n0 = parts.length;
    drop(armL.plate, pHead);
    paint(purple, pChest); paint(skin, pNeck); paint(col(0x3a3a46), armL.pu, armR.pu);
    paint(yel, armL.pf, armR.pf, armL.ph, armR.ph); paint(green, pHips, legL.pt, legL.ps, legR.pt, legR.ps); paint(navy, legL.pf, legR.pf);
    paint(brown, pBelt);
    // Brustplatte: zwei Wölbungen, Goldgrat, Goldring unten
    for (const x of [-.11, .11]) part(chest, new THREE.SphereGeometry(.14, 7, 5), purple2, [x, .33, .1], [0, 0, 0], [1, .75, .55]);
    part(chest, new THREE.BoxGeometry(.06, .42, .06), gold, [0, .25, .17]);
    band(chest, [0, .06, 0], .155, .02, gold, [1.15, .7, 1], 8);
    // riesige rote Dorn-Schultern, zweilagig, Goldrand (beide Seiten, am Oberarm wie die Schulterplatte des Standards)
    for (const a of [armL, armR]) {
      const s = a.side, g = M4([s * .04, .05, 0], [0, 0, -s * .25]);
      part(a.ua, new THREE.SphereGeometry(.24, 8, 5, 0, TAU, 0, Math.PI / 2), red, [0, 0, 0], [0, 0, 0], [1.15, .8, 1], g);
      part(a.ua, new THREE.SphereGeometry(.2, 8, 4, 0, TAU, 0, Math.PI / 2), red, [s * .05, -.1, 0], [0, 0, 0], [1.2, .7, 1.05], g);
      part(a.ua, new THREE.TorusGeometry(.27, .02, 4, 10), gold, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 1], g);
      for (let i = 0; i < 3; i++) part(a.ua, new THREE.ConeGeometry(.05, .28 - i * .05, 5), steel, [s * (.02 + i * .07), .16 - i * .03, (i - 1) * .1], [0, 0, -s * (.25 + i * .25)], [1, 1, 1], g);
      // knallgelbe Stulpen mit pinkem Saum
      part(a.fa, new THREE.CylinderGeometry(.115, .095, .2, 6), yel, [0, -.23, 0]);
      part(a.fa, new THREE.TorusGeometry(.115, .024, 4, 8), pink, [0, -.13, 0], [Math.PI / 2, 0, 0]);
    }
    // Riesenschnalle mit grünem Stein (Stein im Körper-Mesh, leuchtet nicht: Körper hat kein Glüh-Mesh)
    part(hips, new THREE.BoxGeometry(.16, .13, .05), gold, [0, .06, .22]);
    part(hips, new THREE.OctahedronGeometry(.035), col(0xb4ff9a), [0, .06, .25]);
    // Kniebuckel mit Dorn, klobige blaue Stiefel mit hochgezogener Spitze
    for (const l of [legL, legR]) {
      part(l.sh, new THREE.SphereGeometry(.11, 6, 4), steel, [0, 0, .05], [0, 0, 0], [1, 1, .7]);
      part(l.sh, new THREE.ConeGeometry(.03, .12, 4), steel, [0, 0, .15], [Math.PI / 2, 0, 0]);
      part(l.ft, new THREE.CylinderGeometry(.1, .115, .2, 6), navy, [0, .05, .01]);
      part(l.ft, new THREE.ConeGeometry(.065, .14, 4), navy, [0, -.02, .26], [Math.PI / 2 - .5, 0, 0]);
    }
    // Helm: grauer Topf mit T-Schlitz, Goldkamm, Bronze-Stierhörner
    part(head, new THREE.IcosahedronGeometry(.15, 1), steel, [0, .13, 0], [0, 0, 0], [1.08, 1.14, 1.1]);
    part(head, new THREE.BoxGeometry(.22, .032, .03), ink, [0, .145, .16]);
    part(head, new THREE.BoxGeometry(.04, .13, .03), ink, [0, .08, .155]);
    part(head, new THREE.BoxGeometry(.04, .1, .34), gold, [0, .29, 0]);
    for (const s of [-1, 1]) {
      const pts = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => { const t = i / 8; return hp(s * (.1 + t * .2), .03 + Math.pow(t, 2.5) * .22, -t * .04); });
      part(head, tube(pts, .06, 10, 6), col(0xa8783a));
      const e = pts[8]; part(head, new THREE.ConeGeometry(.06, .13, 6), col(0xe8dcc0), [e[0], e[1] + .05, e[2]], [0, 0, -s * .2]);
    }
    for (let i = n0; i < parts.length; i++) parts[i].flat = true;
    for (const e of [pChest, pHips, armL.pu, armR.pu, armL.pf, armR.pf, legL.pt, legL.ps, legR.pt, legR.ps, legL.pf, legR.pf]) e.flat = true;
    // Umhang (passt natürlich auch nicht): türkis, ab den Schultern
    cloth0 = { color: 0x2a9a9a, w: 2.3 };
    chest.add(clothAnchor); clothAnchor.position.set(0, .52, -.28);
    Object.assign(TALK, { kind: 'shout', keys: [1, 2, 3, 4].map(i => `look.krieger.classic.say${i}`), plate: 'look.krieger.classic.plate' });
  }
  if (look === 'holz') {
    // Holzfäller: kariertes Hemd (Karo als dunkle Streifen, Vertex-Farben statt Textur), Ärmel hochgekrempelt, Hosenträger, Jeans mit Umschlag,
    // Arbeitsstiefel, Strickmütze mit Bommel, Vollbart, Kraxe mit Holzstapel auf dem Rücken
    const plaid = col(0xb8241c), dark = col(0x1a1214), jeans = col(0x3a5a8a), skin = col(0xe8bc98), boot = col(0x6a4022), beard = col(0x7a3a1a), wood = col(0x5a3a20);
    drop(armL.plate);
    paint(plaid, pChest, armL.pu, armR.pu); paint(skin, pNeck, pHead, armL.pf, armR.pf, armL.ph, armR.ph);
    paint(jeans, pHips, legL.pt, legL.ps, legR.pt, legR.ps); paint(boot, legL.pf, legR.pf); paint(col(0x3a2414), pBelt);
    for (const [y, r] of [[.48, .29], [.32, .23], [.16, .17]]) band(chest, [0, y, 0], r, .016, dark, [1.15, .68, 1], 16);   // Karo quer
    for (const a of [armL, armR]) {
      for (const y of [-.1, -.24]) band(a.ua, [0, y, 0], .1, .014, dark, [1, 1, 1], 8);
      band(a.fa, [0, -.03, 0], .1, .032, plaid, [1, 1, 1], 8);   // hochgekrempelt
    }
    for (const x of [-.11, .11]) { rod(chest, [x, -.02, .1], [x * 1.1, .55, .2], .016, col(0x8a2a1a)); rod(chest, [x, -.02, -.1], [x * 1.1, .55, -.19], .016, col(0x8a2a1a)); }   // Hosenträger
    for (const l of [legL, legR]) { band(l.sh, [0, -.4, 0], .1, .028, col(0x6a8ab0), [1, 1, 1], 10); part(l.ft, new THREE.CylinderGeometry(.1, .095, .14, 8), boot, [0, .03, .01]); }   // Umschlag, Stiefelschaft
    // Strickmütze mit Bommel
    const hat = col(0x2a4a3a);
    part(head, new THREE.SphereGeometry(.17, 10, 6, 0, TAU, 0, Math.PI * .55), hat, [0, .19, 0], [0, 0, 0], [1, 1.15, 1.04]);
    band(head, [0, .19, 0], .155, .033, hat, [1, 1.04, 1], 14);
    part(head, new THREE.SphereGeometry(.06, 7, 5), col(0xf2ece0), [0, .4, 0]);
    // Augen, Brauen, Vollbart, Schnauzer
    for (const x of [-.055, .055]) { part(head, new THREE.SphereGeometry(.018, 6, 4), col(0x15121a), [x, .135, .15], [0, 0, 0], [1, 1.1, .5]); part(head, new THREE.BoxGeometry(.065, .016, .014), col(0x6a3a1a), [x, .165, .152], [0, 0, x > 0 ? .35 : -.35]); }
    part(head, new THREE.SphereGeometry(.143, 9, 6), beard, [0, .0, .062], [0, 0, 0], [1, .7, .85]);
    part(head, new THREE.BoxGeometry(.13, .026, .026), beard, [0, .085, .152]);
    // Kraxe auf dem Rücken: Gestell fest, Scheite einzeln markiert (tag) und je nach Kills eingeblendet (lookTick)
    const kz = -.22, ky = .28;
    for (const x of [-.17, .17]) rod(chest, [x, ky - .3, kz - .02], [x, ky + .45, kz - .02], .014, wood);
    part(chest, new THREE.BoxGeometry(.38, .03, .18), wood, [0, ky - .3, kz - .1]);
    for (let i = 0; i < HOLZ.logs; i++) {
      const row = Math.floor(i / 3), c = i % 3, z = kz - .06 - c * .1 + (row % 2) * .03, y = ky - .24 + row * .1;
      part(chest, new THREE.CylinderGeometry(.055, .055, .4, 7), col(0x8a5a32), [0, y, z], [0, 0, Math.PI / 2]).tag = `log${i}`;
      for (const sx of [-1, 1]) part(chest, new THREE.CircleGeometry(.05, 7), col(0xe8c890), [sx * .201, y, z], [0, sx * Math.PI / 2, 0]).tag = `log${i}`;
    }
  }
  return { cloth0, TALK };
}
// Skin-Gags pro Frame (nur Optik)
export function lookTick(F: Fig, s: number, anim) {
  const { look, head, lookW, bodyT, swordMesh } = F, { emit } = F.fx;
  if (look === 'klapse') head.rotation.z = Math.sin(F.anim.T * 7) * .04 + (Math.sin(F.anim.T * .9) > .85 ? .25 : 0);   // ruckartiges Kopf-Zucken // PH
  // Holzfäller: Kerben, goldener Stiel, Sprössling, Scheite nach Kills im Run (anim.kills), nur bei Änderung
  if (look === 'holz' && (anim.kills ?? 0) !== F.anim.kills) {
    F.anim.kills = anim.kills ?? 0;
    for (let i = 0; i < HOLZ.notches; i++) showTag(lookW, `n${i}`, i < F.anim.kills);
    tintTag(lookW, 'wood', col(F.anim.kills >= HOLZ.gold ? 0xe8b23a : 0xd8a868));
    showTag(lookW, 'sprout', F.anim.kills >= HOLZ.sprout);
    const logs = Math.min(HOLZ.logs, Math.floor(F.anim.kills / HOLZ.perLog));
    for (let i = 0; i < HOLZ.logs; i++) showTag(bodyT, `log${i}`, i < logs);
  }
  // Classic: roter Verzauberungs-Schein an der Klinge, über die Partikel der Figur (0 Draw Calls extra)
  if (look === 'classic' && swordMesh.visible && Math.random() < s * 18) emit(swordMesh.localToWorld(V((Math.random() - .5) * .22, .35 + Math.random() * 1.5, 0)), 1, .15, 0xff3a2a, -.6, .55);   // PH
}
