// Gelenk-Rig mit prozeduralen Animationen. Gleiche Schnittstelle wie später ein glTF-Modell:
//   model.root (Object3D) · model.update(dt, anim)
// anim = { state: 'idle'|'run'|'back'|'air'|'sit'|'dead', speed, cast, channel, attack, frozen }

import * as THREE from 'three';
import { lerpTo, part, joint } from '../util';
import { scene } from '../render';
import { glowSprite } from '../fx/particles';

// Skelett-Magier mit rotem Lendenschurz und Stab
function buildMage() {
  const bone = new THREE.MeshLambertMaterial({ color: 0xd2c8a8 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0xa01818, side: THREE.DoubleSide });
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a2f1a });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3.0) });   // > 1 → Bloom
  const crystalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.8, 2.8) });

  const cyl = (r, h) => new THREE.CylinderGeometry(r, r * 0.85, h, 7);
  const ball = r => new THREE.SphereGeometry(r, 8, 6);

  const root = new THREE.Group();
  const body = joint(root);                       // verschiebbar (Sitzen, Tod)
  const hips = joint(body, 0, 1.0, 0);
  // Becken
  hips.add(part(new THREE.BoxGeometry(0.42, 0.14, 0.2), bone, 0, 0.02, 0));
  const torso = joint(hips);
  // Wirbelsäule
  for (let i = 0; i < 6; i++) torso.add(part(ball(0.055), bone, 0, 0.1 + i * 0.12, -0.08));
  // Rippen (Torus-Bögen)
  for (let i = 0; i < 4; i++) {
    const w = 0.24 - Math.abs(i - 1.2) * 0.03;
    const rib = part(new THREE.TorusGeometry(w, 0.022, 4, 14, Math.PI * 1.5), bone, 0, 0.36 + i * 0.1, 0);
    rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.75);
    torso.add(rib);
  }
  torso.add(part(new THREE.BoxGeometry(0.06, 0.32, 0.04), bone, 0, 0.5, 0.17));          // Brustbein
  const collar = part(cyl(0.035, 0.7), bone, 0, 0.8, -0.02);                            // Schlüsselbein
  collar.rotation.z = Math.PI / 2;
  torso.add(collar);
  // Schädel
  const neck = joint(torso, 0, 0.86, 0);
  neck.add(part(cyl(0.04, 0.12), bone, 0, 0.04, -0.04));
  neck.add(part(new THREE.SphereGeometry(0.22, 12, 10), bone, 0, 0.24, 0));
  neck.add(part(new THREE.BoxGeometry(0.24, 0.1, 0.2), bone, 0, 0.07, 0.07));            // Kiefer
  for (const sx of [-0.08, 0.08]) {
    neck.add(part(ball(0.06), dark, sx, 0.25, 0.16));                                     // Augenhöhle
    neck.add(part(ball(0.025), eyeMat, sx, 0.25, 0.2));                                   // Leuchtauge
  }
  const nose = part(new THREE.ConeGeometry(0.03, 0.06, 3), dark, 0, 0.16, 0.2);          // Nasenloch
  nose.rotation.x = Math.PI;
  neck.add(nose);

  const arm = side => {
    const shoulder = joint(torso, side * 0.36, 0.78, 0);
    shoulder.add(part(ball(0.06), bone));
    shoulder.add(part(cyl(0.04, 0.42), bone, 0, -0.22, 0));
    const elbow = joint(shoulder, 0, -0.45, 0);
    elbow.add(part(ball(0.05), bone));
    elbow.add(part(cyl(0.032, 0.4), bone, side * 0.02, -0.2, 0));
    elbow.add(part(cyl(0.028, 0.4), bone, -side * 0.02, -0.2, 0));
    elbow.add(part(new THREE.BoxGeometry(0.1, 0.12, 0.05), bone, 0, -0.44, 0));           // Hand
    return { shoulder, elbow };
  };
  const armL = arm(1), armR = arm(-1);

  const staff = joint(armR.elbow, 0, -0.45, 0.04);
  staff.add(part(new THREE.CylinderGeometry(0.035, 0.045, 2.3, 6), wood, 0, 0.3, 0));
  for (const a of [0, 2.1, 4.2]) {                                                         // Krallen um den Kristall
    const claw = part(new THREE.ConeGeometry(0.03, 0.3, 4), wood, Math.cos(a) * 0.09, 1.5, Math.sin(a) * 0.09);
    claw.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    staff.add(claw);
  }
  const crystal = part(new THREE.OctahedronGeometry(0.13), crystalMat, 0, 1.55, 0);
  crystal.scale.y = 1.6;
  staff.add(crystal);
  const crystalGlow = glowSprite(0x7fd8ff, 0.4);
  crystalGlow.position.y = 1.55;
  staff.add(crystalGlow);
  staff.rotation.x = 0.5;                                          // gleicht den gebeugten Ellbogen aus -> Stab senkrecht

  const leg = side => {
    const hip = joint(hips, side * 0.15, 0, 0);
    hip.add(part(ball(0.06), bone));
    hip.add(part(cyl(0.045, 0.48), bone, 0, -0.25, 0));
    const knee = joint(hip, 0, -0.5, 0);
    knee.add(part(ball(0.055), bone));
    knee.add(part(cyl(0.038, 0.44), bone, 0, -0.22, 0));
    knee.add(part(new THREE.BoxGeometry(0.11, 0.05, 0.24), bone, 0, -0.47, 0.06));       // Fuß
    return { hip, knee };
  };
  const legL = leg(1), legR = leg(-1);

  // Roter Lendenschurz: Gürtel + vordere und hintere Stoffbahn (schwingen beim Laufen)
  const belt = part(new THREE.TorusGeometry(0.22, 0.03, 4, 16), cloth, 0, 0.06, 0);
  belt.rotation.x = Math.PI / 2;
  hips.add(belt);
  const flapFront = joint(hips, 0, 0.05, 0.14);
  flapFront.add(part(new THREE.BoxGeometry(0.3, 0.55, 0.015), cloth, 0, -0.27, 0));
  const flapBack = joint(hips, 0, 0.05, -0.14);
  flapBack.add(part(new THREE.BoxGeometry(0.32, 0.5, 0.015), cloth, 0, -0.25, 0));

  // Punkte, an denen Zauber-Partikel entstehen
  const anchors = { crystal, handL: armL.elbow };
  let phase = 0;
  const j = { hipsY: 1, bodyY: 0, bodyRotX: 0, lean: 0,
    lHip: 0, rHip: 0, lKnee: 0, rKnee: 0, lSh: 0, rSh: 0, lShZ: 0.1, rShZ: -0.1, lEl: 0, rEl: 0, headX: 0 };

  function update(dt, a) {
    const s = dt / 1000;
    const t = { ...j, hipsY: 1, bodyY: 0, bodyRotX: 0, lean: 0, lHip: 0, rHip: 0, lKnee: 0, rKnee: 0,
      lSh: 0.05, rSh: 0.05, lShZ: 0.12, rShZ: -0.12, lEl: -0.15, rEl: -0.5, headX: 0 };

    if (a.state === 'run' || a.state === 'back') {
      const dir = a.state === 'back' ? -1 : 1;
      phase += s * a.speed * 1.55 * dir;
      const sw = Math.sin(phase), amp = a.state === 'back' ? 0.6 : 0.85;
      t.lHip = -sw * amp; t.rHip = sw * amp;
      t.lKnee = Math.max(0, sw) * 1.1; t.rKnee = Math.max(0, -sw) * 1.1;
      t.lSh = sw * 0.6; t.rSh = -sw * 0.6 - 0.2;
      t.lean = 0.12 * dir;
      t.hipsY = 1 - 0.04 + Math.abs(Math.cos(phase)) * 0.08;
    } else if (a.state === 'idle') {
      phase += s * 1.6;
      t.hipsY = 1 + Math.sin(phase) * 0.012;
      t.lShZ = 0.12 + Math.sin(phase) * 0.03;
    } else if (a.state === 'air') {
      t.lHip = -0.7; t.rHip = -0.2; t.lKnee = 1.2; t.rKnee = 0.6;
      t.lShZ = 0.6; t.rShZ = -0.6;
    } else if (a.state === 'sit') {
      t.bodyY = -0.55; t.lHip = -1.45; t.rHip = -1.45; t.lKnee = 0.2; t.rKnee = 0.2;
      t.rSh = -1.1; t.rEl = -1.7; t.headX = -0.15;               // Becher zum Mund
    } else if (a.state === 'dead') {
      t.bodyRotX = -Math.PI / 2; t.bodyY = 0.3;
    }
    if (a.channel) {                                            // Arme hoch, leichtes Zittern
      t.lSh = -2.6 + Math.sin(performance.now() / 120) * 0.05; t.rSh = -2.6; t.lShZ = 0.35; t.rShZ = -0.35;
      t.lEl = 0; t.rEl = 0;
    } else if (a.cast > 0) {                                     // kurzer Wurf nach vorne
      t.rSh = -1.6 * a.cast; t.lSh = -1.1 * a.cast; t.rEl = -0.2; t.lEl = -0.3;
    }

    const k = Math.min(1, s * 14);
    for (const key in j) j[key] = lerpTo(j[key], t[key], k);

    hips.position.y = j.hipsY;
    body.position.y = j.bodyY;
    body.rotation.x = j.bodyRotX;
    torso.rotation.x = j.lean;
    neck.rotation.x = j.headX;
    legL.hip.rotation.x = j.lHip;  legR.hip.rotation.x = j.rHip;
    legL.knee.rotation.x = j.lKnee; legR.knee.rotation.x = j.rKnee;
    armL.shoulder.rotation.x = j.lSh; armR.shoulder.rotation.x = j.rSh;
    armL.shoulder.rotation.z = j.lShZ; armR.shoulder.rotation.z = j.rShZ;
    armL.elbow.rotation.x = j.lEl; armR.elbow.rotation.x = j.rEl;
    flapFront.rotation.x = Math.min(j.lHip, j.rHip, 0) * 0.7;
    flapBack.rotation.x = Math.max(j.lHip, j.rHip, 0) * 0.7;
    crystalGlow.scale.setScalar(0.4 + Math.sin(performance.now() / 300) * 0.06 + (a.channel || a.cast > 0 ? 0.3 : 0));
  }
  return { root, update, anchors };
}

export const mage = buildMage();
scene.add(mage.root);
