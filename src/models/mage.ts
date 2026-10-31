// Gelenk-Rig mit prozeduralen Animationen. Gleiche Schnittstelle wie später ein glTF-Modell:
//   model.root (Object3D) · model.update(dt, anim)
// anim = { state: 'idle'|'run'|'back'|'air'|'sit'|'dead', speed, vy, squat, cast, channel }

import * as THREE from 'three';
import { clamp, lerpTo, part, joint, mergeByJoint } from '../util';
import { CFG } from '../config';
import { scene } from '../render';
import { glowSprite } from '../fx/particles';

// Skelett-Magier mit rotem Lendenschurz und Stab
const THIGH = 0.5, SHIN = 0.46, ANKLE_H = 0.09;

function buildMage() {
  const bone = new THREE.MeshLambertMaterial({ color: 0xd2c8a8 });
  const boneShade = new THREE.MeshLambertMaterial({ color: 0xa79c7c });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0xa01818, side: THREE.DoubleSide });
  const clothDark = new THREE.MeshLambertMaterial({ color: 0x6e1010, side: THREE.DoubleSide });
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a2f1a });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3.0) })   // > 1 → Bloom;
  const crystalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.8, 2.8) });

  const ball = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
  // Röhrenknochen mit verdickten Enden, hängt von y=0 nach unten
  const longBone = (len, r) => {
    const pts = [[0, 0], [r * 1.5, 0.01], [r * 1.7, len * 0.05], [r * 1.05, len * 0.16], [r * 0.85, len * 0.5], [r, len * 0.84], [r * 1.55, len * 0.95], [r * 1.25, len - 0.005], [0, len]];
    return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, -y)).reverse(), 9);
  };
  const scaled = (mesh, x, y, z) => { mesh.scale.set(x, y, z); return mesh; };

  const root = new THREE.Group();
  const air = joint(root);                    // Sprunghöhe, Sturz
  const pelvis = joint(air, 0, 0.95, 0);

  // Becken
  for (const side of [-1, 1]) {
    const wing = scaled(part(ball(0.13), boneShade, side * 0.1, 0.07, -0.05), 0.72, 0.62, 0.16);
    wing.rotation.set(0.25, side * 0.55, side * -0.4);
    pelvis.add(wing);
    pelvis.add(part(ball(0.05), bone, side * 0.15, -0.03, 0));
  }
  pelvis.add(scaled(part(ball(0.08), bone, 0, 0.03, -0.07), 0.8, 1.1, 0.5));
  const pubis = part(new THREE.TorusGeometry(0.08, 0.02, 5, 12, Math.PI), bone, 0, -0.02, 0.03);
  pubis.rotation.x = Math.PI;
  pelvis.add(pubis);

  // Wirbelsäule in drei Teilen
  const vertebrae = (parent, n, step, r) => {
    for (let i = 0; i < n; i++) {
      parent.add(scaled(part(ball(r, 8, 5), bone, 0, 0.02 + i * step, -0.08), 1, 0.72, 1));
      const spine = part(new THREE.ConeGeometry(r * 0.4, r * 1.5, 4), boneShade, 0, 0.02 + i * step, -0.08 - r * 1.2);
      spine.rotation.x = -1.9;
      parent.add(spine);
    }
  };
  const spine1 = joint(pelvis, 0, 0.1, 0);
  vertebrae(spine1, 4, 0.055, 0.042);
  const spine2 = joint(spine1, 0, 0.22, 0);
  vertebrae(spine2, 4, 0.055, 0.046);
  const spine3 = joint(spine2, 0, 0.22, 0);
  vertebrae(spine3, 5, 0.06, 0.05);

  // Rippen wandern mit dem Rücken mit
  const rib = (parent, y, w) => {
    const m = scaled(part(new THREE.TorusGeometry(w, 0.016, 5, 18, Math.PI * 1.55), bone, 0, y, -0.015), 1, 0.78, 1);
    m.rotation.set(Math.PI / 2 + 0.22, 0, Math.PI * 0.725);
    parent.add(m);
  };
  rib(spine2, 0.08, 0.19); rib(spine2, 0.15, 0.205);
  for (const [i, w] of [0.215, 0.215, 0.205, 0.185, 0.155].entries()) rib(spine3, 0.0 + i * 0.07, w);
  spine3.add(part(new THREE.BoxGeometry(0.055, 0.26, 0.025), bone, 0, 0.14, 0.145));

  // Schlüsselbein, Schulterblatt, Arm, Hand
  const arm = side => {
    const clav = joint(spine3, side * 0.05, 0.33, 0.05);
    const bar = part(longBone(0.26, 0.016), bone);
    bar.rotation.z = side * Math.PI / 2;
    clav.add(bar);
    clav.add(scaled(part(ball(0.1, 8, 6), boneShade, side * 0.15, -0.09, -0.14), 0.75, 1, 0.16));
    const shoulder = joint(clav, side * 0.27, -0.02, -0.02);
    shoulder.add(part(ball(0.058), bone));
    shoulder.add(part(longBone(0.42, 0.027), bone));
    const elbow = joint(shoulder, 0, -0.42, 0);
    elbow.add(part(ball(0.042), bone));
    for (const o of [-1, 1]) {
      const b = part(longBone(0.38, 0.017), o === side ? bone : boneShade, o * 0.026, 0, 0);
      b.rotation.z = o * 0.03;
      elbow.add(b);
    }
    const wrist = joint(elbow, 0, -0.39, 0);
    wrist.add(part(new THREE.BoxGeometry(0.035, 0.1, 0.08), bone, 0, -0.05, 0));
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const thumb = i === 3;
      const base = joint(wrist, 0, thumb ? -0.04 : -0.1, thumb ? 0.05 : -0.03 + i * 0.03);
      base.add(part(longBone(thumb ? 0.05 : 0.065, 0.007), bone));
      const tip = joint(base, 0, thumb ? -0.05 : -0.065, 0);
      tip.add(part(longBone(0.05, 0.006), bone));
      fingers.push({ base, tip });
    }
    return { clav, shoulder, elbow, wrist, fingers, side };
  };
  const armL = arm(1), armR = arm(-1);

  // Schädel und Kiefer
  const neck1 = joint(spine3, 0, 0.36, -0.04);
  neck1.add(scaled(part(ball(0.036, 8, 5), bone, 0, 0.03, 0), 1, 0.7, 1));
  neck1.add(scaled(part(ball(0.033, 8, 5), bone, 0, 0.08, 0), 1, 0.7, 1));
  const head = joint(neck1, 0, 0.12, 0.01);
  head.add(scaled(part(new THREE.SphereGeometry(0.17, 16, 12), bone, 0, 0.145, -0.03), 0.92, 0.95, 1.14));
  head.add(scaled(part(ball(0.11), bone, 0, 0.055, 0.075), 0.92, 0.72, 0.8));
  const brow = scaled(part(ball(0.1, 10, 6), bone, 0, 0.142, 0.1), 1.25, 0.2, 0.6);
  head.add(brow);
  for (const sx of [-1, 1]) {
    head.add(scaled(part(ball(0.052), dark, sx * 0.062, 0.095, 0.126), 1.05, 0.9, 0.55));
    head.add(part(ball(0.012, 6, 5), eyeMat, sx * 0.062, 0.095, 0.153));
    const cheek = scaled(part(ball(0.03, 8, 5), bone, sx * 0.1, 0.035, 0.09), 1, 0.5, 1.5);
    head.add(cheek);
  }
  const nose = part(new THREE.ConeGeometry(0.024, 0.06, 3), dark, 0, 0.042, 0.16);
  nose.rotation.x = Math.PI;
  head.add(nose);
  const tooth = new THREE.BoxGeometry(0.016, 0.026, 0.012);
  const teethArc = (parent, y, r) => {
    for (let i = 0; i < 8; i++) {
      const a = (i - 3.5) * 0.17;
      const t = part(tooth, bone, Math.sin(a) * r, y, Math.cos(a) * r);
      t.rotation.y = a;
      parent.add(t);
    }
  };
  teethArc(head, -0.012, 0.09);
  const jaw = joint(head, 0, 0.0, -0.01);
  const jawBone = scaled(part(new THREE.TorusGeometry(0.08, 0.019, 6, 14, Math.PI), bone, 0, -0.04, 0.015), 1, 1.2, 1);
  jawBone.rotation.x = Math.PI / 2;
  jawBone.rotation.z = Math.PI;
  jawBone.scale.set(1, 1.35, 1);
  jaw.add(jawBone);
  teethArc(jaw, -0.026, 0.086);

  // Stab
  const staff = joint(spine3, 0, -0.1, -0.2);   // quer auf dem Rücken, Kristall über der rechten Schulter
  staff.rotation.z = 0.55;
  staff.add(part(new THREE.CylinderGeometry(0.028, 0.042, 1.95, 8), wood));
  for (const y of [-0.57, 0.31]) {
    const ring = part(new THREE.TorusGeometry(0.043, 0.012, 5, 10), clothDark, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
    staff.add(ring);
  }
  for (const a of [0, 1.57, 3.14, 4.71]) {
    const claw = part(new THREE.ConeGeometry(0.026, 0.34, 5), wood, Math.cos(a) * 0.09, 0.99, Math.sin(a) * 0.09);
    claw.rotation.set(Math.sin(a) * 0.42, 0, -Math.cos(a) * 0.42);
    staff.add(claw);
  }
  const crystal = part(new THREE.OctahedronGeometry(0.13), crystalMat, 0, 1.05, 0);
  crystal.scale.y = 1.6;
  staff.add(crystal);
  const crystalGlow = glowSprite(0x7fd8ff, 0.4);
  crystalGlow.position.y = 1.05;
  // Gurt quer über die Brust hält den Stab
  const strap = part(new THREE.TorusGeometry(0.255, 0.014, 5, 24).rotateX(Math.PI / 2).scale(1, 1, 0.85), clothDark, 0, 0.13, -0.015);
  strap.rotation.z = 1.0;
  spine3.add(strap);
  staff.add(crystalGlow);

  // Bein mit Fußgelenk und Zehen
  const leg = side => {
    const hip = joint(pelvis, side * 0.15, -0.03, 0);
    hip.add(part(longBone(THIGH, 0.03), bone));
    const knee = joint(hip, 0, -THIGH, 0);
    knee.add(scaled(part(ball(0.04), boneShade, 0, 0, 0.03), 1, 1, 0.6));
    knee.add(part(longBone(SHIN, 0.024), bone, side * -0.012, 0, 0));
    knee.add(part(longBone(SHIN - 0.01, 0.011), boneShade, side * 0.03, 0, -0.005));
    const ankle = joint(knee, 0, -SHIN, 0);
    ankle.add(scaled(part(ball(0.05), bone, 0, -0.04, -0.035), 0.8, 0.8, 1.1));
    ankle.add(scaled(part(ball(0.06), bone, 0, -0.05, 0.07), 0.85, 0.4, 1.7));
    const toe = joint(ankle, 0, -0.07, 0.15);
    for (const dx of [-0.036, 0, 0.036]) {
      const t = part(longBone(0.075, 0.008), bone, dx, 0, 0);
      t.rotation.x = -Math.PI / 2;
      toe.add(t);
    }
    return { hip, knee, ankle, toe };
  };
  const legL = leg(1), legR = leg(-1);

  // Lendenschurz als Kette aus drei Gliedern
  const belt = scaled(part(new THREE.TorusGeometry(0.2, 0.024, 6, 20), clothDark, 0, 0.03, 0), 1, 0.72, 1);
  belt.rotation.x = Math.PI / 2;
  pelvis.add(belt);
  const flap = (z, w) => {
    const links = [];
    let parent = pelvis, y = 0, off = z;
    for (let i = 0; i < 3; i++) {
      const g = joint(parent, 0, y, off);
      const wid = w * (1 - i * 0.14);
      const shape = new THREE.PlaneGeometry(wid, 0.15);
      const m = part(shape, i % 2 ? clothDark : cloth, 0, -0.075, 0);
      g.add(m);
      links.push(g);
      parent = g; y = -0.145; off = 0;
    }
    return links;
  };
  const front = flap(0.13, 0.3), back = flap(-0.13, 0.32);
  const clothState = { f: [0, 0, 0], b: [0, 0, 0] };

  mergeByJoint(root, crystal);

  let phase = 0, tAcc = 0;
  const j = {
    pX: 0, pY: 0, pZ: 0, s1: 0, s2: 0, s3: 0, sY: 0, sZ: 0, neck: 0, head: 0, headY: 0, jaw: 0.04,
    lCl: 0, rCl: 0, lSh: 0, rSh: 0, lShZ: 0.1, rShZ: -0.1, lEl: -0.2, rEl: -0.9, lWr: 0, rWr: 0, lCurl: 0.4, rCurl: 1.1,
    lH: 0, rH: 0, lHz: 0.03, rHz: -0.03, lK: 0.2, rK: 0.2, lA: 0, rA: 0, lT: 0, rT: 0, bodyX: 0, py: 0.9, airY: 0,
  };

  function update(dt, a) {
    const s = dt / 1000, h = CFG.mageHunch;
    tAcc += s;
    const sq = a.squat || 0;

    // Grundhaltung: Rücken rund, Kopf nach vorn gereckt, Knie leicht gebeugt
    const t = { ...j };
    t.pX = 0.1 * h + 0.15 * sq; t.pY = 0; t.pZ = 0;
    t.s1 = 0.16 * h + 0.14 * sq; t.s2 = 0.26 * h + 0.14 * sq; t.s3 = 0.3 * h + 0.1 * sq; t.sY = 0; t.sZ = 0;
    t.neck = -0.3 * h - 0.2 * sq; t.head = -0.3 * h - 0.14 * sq; t.headY = 0;
    t.jaw = 0.04; t.lCl = 0; t.rCl = 0;
    const lean = t.pX + t.s1 + t.s2 + t.s3;
    t.lSh = -lean + 0.06; t.rSh = -lean + 0.06; t.lShZ = 0.06; t.rShZ = -0.06;
    t.lEl = -0.28; t.rEl = -0.28; t.lWr = -0.1; t.rWr = 0; t.lCurl = 0.45; t.rCurl = 0.45;
    const hipBase = -(0.1 + 0.3 * h) - 0.75 * sq, kneeBase = 0.2 + 0.5 * h + 1.45 * sq;
    t.lH = hipBase; t.rH = hipBase - 0.04; t.lHz = 0.03; t.rHz = -0.03;
    t.lK = kneeBase; t.rK = kneeBase + 0.05; t.lT = 0; t.rT = 0; t.bodyX = 0;
    let liftAir = 0, fixedPy = null, footFlat = 1, footL = 0, footR = 0, k = Math.min(1, s * 24);

    if (a.state === 'run' || a.state === 'back') {
      const backward = a.state === 'back', dir = backward ? -1 : 1;
      const g = clamp((a.speed - 2.5) / 4.5, 0, 1);              // 0 = Gehen, 1 = Laufen
      const stride = backward ? 2.2 : lerpTo(1.55, 3.3, g);
      phase += s * a.speed / stride * Math.PI * 2 * dir;
      const sw = Math.sin(phase), cw = Math.cos(phase);
      const amp = backward ? 0.5 : lerpTo(0.34, 0.82, g), kneeSwing = backward ? 0.75 : lerpTo(0.55, 1.5, g);
      t.lH += -sw * amp; t.rH += sw * amp;
      t.lK += Math.pow(Math.max(0, cw), 1.4) * kneeSwing;
      t.rK += Math.pow(Math.max(0, -cw), 1.4) * kneeSwing;
      // Abrollen: hinteres Bein geht über den Ballen
      footL = Math.max(0, -sw) * Math.max(0, cw + 0.4) * lerpTo(0.5, 1.1, g) * (backward ? 0.3 : 1);
      footR = Math.max(0, sw) * Math.max(0, -cw + 0.4) * lerpTo(0.5, 1.1, g) * (backward ? 0.3 : 1);
      t.lT = -footL * 0.9; t.rT = -footR * 0.9;
      // Gegendrehung Becken/Brust, Beckenkippen
      t.pY = sw * lerpTo(0.09, 0.2, g) * -1; t.sY = sw * lerpTo(0.14, 0.32, g);
      t.pZ = cw * lerpTo(0.035, 0.07, g); t.sZ = -cw * lerpTo(0.03, 0.055, g);
      // Vorlage nach Tempo
      const extra = backward ? -0.05 : lerpTo(0.03, 0.26, g);
      t.s1 += extra * 0.4; t.s2 += extra * 0.6; t.neck -= extra * 0.5; t.head -= extra * 0.3;
      t.lSh += sw * lerpTo(0.28, 0.75, g) - extra; t.rSh += -sw * lerpTo(0.28, 0.75, g) - extra;
      t.lEl = -lerpTo(0.35, 1.35, g) - Math.max(0, -sw) * 0.3; t.rEl = -lerpTo(0.35, 1.35, g) - Math.max(0, sw) * 0.3;
      t.lShZ = lerpTo(0.06, 0.14, g); t.rShZ = -t.lShZ; t.lCurl = lerpTo(0.45, 0.9, g); t.rCurl = t.lCurl;
      t.head += Math.sin(phase * 2) * 0.02;
      if (!backward) liftAir = g * 0.07 * Math.abs(Math.sin(phase * 1)) * Math.abs(cw);
      k = Math.min(1, s * 34);
    } else if (a.state === 'idle') {
      phase += s * 1.3;
      const br = Math.sin(phase);
      t.s3 += br * 0.022; t.s2 -= br * 0.01; t.neck -= br * 0.012;
      t.lCl = br * 0.03; t.rCl = -br * 0.03;
      const shift = Math.sin(phase * 0.37);                        // Gewicht verlagern
      t.pZ = shift * 0.035; t.sZ = -shift * 0.03; t.lH -= shift * 0.04; t.rH += shift * 0.04;
      t.headY = Math.sin(phase * 0.23) * 0.22;
      t.lCurl += Math.sin(phase * 0.8) * 0.1;
      const clack = (tAcc % 5.3) < 0.5 ? Math.abs(Math.sin(tAcc * 30)) * 0.12 : 0;
      t.jaw = 0.04 + clack;
    } else if (a.state === 'air') {
      // vy > 0 steigt: Knie anziehen, Arme hoch. vy < 0 fällt: Beine strecken zur Landung
      const up = clamp(a.vy / 8, -1, 1), rise = Math.max(0, up), fall = Math.max(0, -up);
      t.lH = lerpTo(-0.7, -1.15, rise) + fall * 0.35; t.lK = lerpTo(0.85, 1.65, rise) - fall * 0.5;
      t.rH = lerpTo(-0.35, -0.2, rise) - fall * 0.2; t.rK = lerpTo(0.6, 0.55, rise) - fall * 0.2;
      t.lShZ = 0.28 + rise * 0.28 + fall * 0.55; t.rShZ = -0.2 - fall * 0.35;
      t.lSh += -0.5 * rise - 0.25 * fall; t.rSh += -0.3 * rise;
      t.lEl = -0.5; t.lCurl = 0.1 + rise * 0.5;
      t.s2 -= rise * 0.12; t.neck += rise * 0.1 - fall * 0.1; t.head += fall * 0.14;
      t.jaw = 0.05 + fall * 0.25;
      fixedPy = THIGH + SHIN + ANKLE_H - 0.03; footFlat = 0.55; footL = 0.35; footR = 0.3 + fall * 0.1;
      // Am Zenit: Spinne. Knie hoch und weit nach außen, Arme gespreizt und abgewinkelt, Finger als Krallen
      const apex = Math.pow(clamp(1 - Math.abs(a.vy) / 6.5, 0, 1), 0.7);
      t.lH = lerpTo(t.lH, -1.95, apex); t.rH = lerpTo(t.rH, -1.95, apex);
      t.lK = lerpTo(t.lK, 2.35, apex); t.rK = lerpTo(t.rK, 2.35, apex);
      t.lHz = lerpTo(t.lHz, 0.95, apex); t.rHz = lerpTo(t.rHz, -0.95, apex);
      t.lShZ = lerpTo(t.lShZ, 1.2, apex); t.rShZ = lerpTo(t.rShZ, -1.2, apex);
      t.lSh = lerpTo(t.lSh, -lean - 0.15, apex); t.rSh = lerpTo(t.rSh, -lean - 0.15, apex);
      t.lEl = lerpTo(t.lEl, -1.25, apex); t.rEl = lerpTo(t.rEl, -1.25, apex);
      t.lCurl = lerpTo(t.lCurl, 0.75, apex); t.rCurl = lerpTo(t.rCurl, 0.75, apex);
      t.s1 += apex * 0.14; t.s2 += apex * 0.14; t.neck -= apex * 0.2; t.head -= apex * 0.1; t.jaw = lerpTo(t.jaw, 0.38, apex);
      fixedPy += apex * 0.12; footFlat = lerpTo(footFlat, 0.2, apex); footL = lerpTo(footL, 0.9, apex); footR = lerpTo(footR, 0.9, apex);
    } else if (a.state === 'sit') {
      t.pX = -0.3; t.s1 = 0.26; t.s2 = 0.34; t.s3 = 0.34; t.neck = -0.28; t.head = -0.24;
      t.lH = -1.95; t.rH = -1.95; t.lK = 1.85; t.rK = 1.85; t.lHz = 0.34; t.rHz = -0.34;
      t.rSh = -1.05; t.rEl = -0.8; t.lSh = -1.25; t.lEl = -1.9; t.lShZ = 0.24; t.lWr = -0.3; t.lCurl = 1.1;
      t.head += Math.sin(tAcc * 0.8) * 0.03;
      fixedPy = 0.2; footFlat = 1; k = Math.min(1, s * 8);
    } else if (a.state === 'dead') {
      t.bodyX = -Math.PI / 2; t.pX = 0; t.pZ = 0.04;
      t.s1 = -0.08; t.s2 = -0.1; t.s3 = 0.03; t.neck = -0.25; t.head = -0.12; t.headY = 0.75; t.jaw = 0.5;
      t.lH = -0.3; t.rH = -0.14; t.lK = 0.75; t.rK = 0.18; t.lHz = 0.28; t.rHz = -0.2;
      t.lSh = -0.12; t.rSh = -0.2; t.lShZ = 0.95; t.rShZ = -0.72; t.lEl = -0.6; t.rEl = -0.25; t.lCurl = 0.9; t.rCurl = 0.8;
      t.lA = 0.8; t.rA = 0.9;
      fixedPy = 0.19; footFlat = 0; k = Math.min(1, s * 7);
    }

    if (a.channel) {
      t.lSh = -2.85 - lean * 0.4 + Math.sin(tAcc * 8) * 0.04; t.rSh = -2.75 - lean * 0.4; t.lShZ = 0.34; t.rShZ = -0.34;
      t.lEl = -0.22; t.rEl = -0.2; t.lCurl = 0.05 + Math.abs(Math.sin(tAcc * 11)) * 0.12; t.lCl = 0.14; t.rCl = 0.14;
      t.s2 -= 0.1; t.s3 -= 0.13 * (0.5 + h); t.neck -= 0.2; t.head -= 0.2; t.jaw = 0.42 + Math.sin(tAcc * 13) * 0.06;
    } else if (a.cast > 0) {
      t.rSh = lerpTo(t.rSh, -1.75, a.cast); t.lSh = lerpTo(t.lSh, -1.45, a.cast); t.rEl = lerpTo(t.rEl, -0.25, a.cast); t.lEl = lerpTo(t.lEl, -0.25, a.cast);
      t.lCurl = lerpTo(t.lCurl, 0, a.cast); t.s3 += a.cast * 0.1; t.sY += a.cast * 0.16; t.jaw = lerpTo(t.jaw, 0.34, a.cast);
      t.neck -= a.cast * 0.1;
    }

    for (const key in j) if (key in t && key !== 'py' && key !== 'lA' && key !== 'rA') j[key] = lerpTo(j[key], t[key], k);

    // Füße: Beckenhöhe folgt dem längeren Bein, Fuß liegt flach plus Abrollen
    const chain = (hip, knee) => THIGH * Math.cos(j.pX + hip) + SHIN * Math.cos(j.pX + hip + knee) + ANKLE_H + 0.03;
    const groundPy = Math.max(chain(j.lH, j.lK), chain(j.rH, j.rK)) + liftAir;
    j.py = lerpTo(j.py, fixedPy ?? groundPy, fixedPy !== null ? Math.min(1, s * 10) : Math.min(1, s * 40));
    const lAn = -(j.pX + j.lH + j.lK) * footFlat + footL, rAn = -(j.pX + j.rH + j.rK) * footFlat + footR;
    j.lA = lerpTo(j.lA, a.state === 'dead' ? t.lA : lAn, Math.min(1, s * 34));
    j.rA = lerpTo(j.rA, a.state === 'dead' ? t.rA : rAn, Math.min(1, s * 34));

    j.airY = lerpTo(j.airY, a.state === 'dead' ? 0.15 : 0, Math.min(1, s * 7));
    air.position.y = j.airY;
    air.rotation.x = j.bodyX;
    pelvis.position.y = j.py;
    pelvis.rotation.set(j.pX, j.pY, j.pZ);
    spine1.rotation.set(j.s1, j.sY * 0.3, j.sZ * 0.5);
    spine2.rotation.set(j.s2, j.sY * 0.35, j.sZ * 0.5);
    spine3.rotation.set(j.s3, j.sY * 0.35, 0);
    neck1.rotation.set(j.neck, -j.sY * 0.5, 0);
    head.rotation.set(j.head, j.headY - j.sY * 0.25, 0);
    jaw.rotation.x = j.jaw;

    armL.clav.rotation.z = j.lCl; armR.clav.rotation.z = -j.rCl;
    armL.shoulder.rotation.set(j.lSh, 0, j.lShZ); armR.shoulder.rotation.set(j.rSh, 0, j.rShZ);
    armL.elbow.rotation.x = j.lEl; armR.elbow.rotation.x = j.rEl;
    armL.wrist.rotation.x = j.lWr; armR.wrist.rotation.x = j.rWr;
    for (const [arm, curl] of [[armL, j.lCurl], [armR, j.rCurl]] as any) {
      for (const f of arm.fingers) {
        f.base.rotation.z = -arm.side * curl * 0.9;
        f.tip.rotation.z = -arm.side * curl * 0.8;
      }
    }

    legL.hip.rotation.set(j.lH, 0, j.lHz); legR.hip.rotation.set(j.rH, 0, j.rHz);
    legL.knee.rotation.x = j.lK; legR.knee.rotation.x = j.rK;
    legL.ankle.rotation.x = j.lA; legR.ankle.rotation.x = j.rA;
    legL.toe.rotation.x = j.lT; legR.toe.rotation.x = j.rT;

    // Lendenschurz: jedes Glied folgt dem vorherigen verzögert
    const fTarget = Math.min(j.lH, j.rH, 0) * 0.8 - j.pX - (a.state === 'air' && a.vy < 0 ? 0.7 : 0);
    const bTarget = Math.max(-j.lH - 0.3, -j.rH - 0.3, 0) * 0.55 - j.pX + (a.state === 'air' && a.vy < 0 ? 0.7 : 0) + (a.state === 'run' ? a.speed * 0.05 : 0);
    let fp = fTarget, bp = bTarget;
    for (let i = 0; i < 3; i++) {
      const follow = Math.min(1, s * (15 - i * 4));
      clothState.f[i] = lerpTo(clothState.f[i], fp, follow);
      clothState.b[i] = lerpTo(clothState.b[i], bp, follow);
      front[i].rotation.x = i ? (clothState.f[i] - clothState.f[i - 1]) : clothState.f[0];
      back[i].rotation.x = i ? (clothState.b[i] - clothState.b[i - 1]) : clothState.b[0];
      fp = clothState.f[i]; bp = clothState.b[i];
    }
    crystalGlow.scale.setScalar(0.4 + Math.sin(tAcc * 3.3) * 0.06 + (a.channel || a.cast > 0 ? 0.32 : 0));
  }
  return { root, update, anchors: { crystal, handL: armL.wrist, handR: armR.wrist } };
}

export const mage = buildMage();
scene.add(mage.root);
