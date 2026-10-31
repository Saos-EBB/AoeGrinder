import * as THREE from 'three';
import { rand, lerpTo, part, joint } from '../util';

// Eber: Körper, Kopf-Gelenk, 4 Beine
const boarGeo = {
  body: new THREE.BoxGeometry(0.95, 0.8, 1.5),
  hump: new THREE.BoxGeometry(0.7, 0.3, 0.8),
  head: new THREE.BoxGeometry(0.62, 0.55, 0.65),
  snout: new THREE.BoxGeometry(0.34, 0.26, 0.2),
  tusk: new THREE.ConeGeometry(0.06, 0.35, 5),
  leg: new THREE.BoxGeometry(0.2, 0.5, 0.2),
  tail: new THREE.BoxGeometry(0.06, 0.06, 0.3),
  ice: new THREE.BoxGeometry(1.6, 1.7, 2.3),
};
const tuskMat = new THREE.MeshLambertMaterial({ color: 0xf2ecd8 });
const snoutMat = new THREE.MeshLambertMaterial({ color: 0xc08a7a });
const iceMat = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.5, emissive: 0x2a5070 });

export function buildBoar(level) {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6b4426 });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3b2614 });
  const root = new THREE.Group();
  const body = joint(root, 0, 0.82, 0);
  body.add(part(boarGeo.body, bodyMat));
  body.add(part(boarGeo.hump, legMat, 0, 0.48, 0.15));
  const neck = joint(body, 0, 0.1, 0.72);
  neck.add(part(boarGeo.head, bodyMat, 0, -0.05, 0.28));
  neck.add(part(boarGeo.snout, snoutMat, 0, -0.15, 0.66));
  for (const sx of [-0.2, 0.2]) {
    const t = part(boarGeo.tusk, tuskMat, sx, -0.22, 0.58);
    t.rotation.x = -0.6;
    neck.add(t);
  }
  const tail = joint(body, 0, 0.2, -0.75);
  tail.add(part(boarGeo.tail, legMat, 0, 0, -0.15));
  const legs = [[-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5], [0.3, -0.5]].map(([x, z]) => {
    const hip = joint(body, x, -0.32, z);
    hip.add(part(boarGeo.leg, legMat, 0, -0.22, 0));
    return hip;
  });
  const ice = new THREE.Mesh(boarGeo.ice, iceMat);
  ice.position.y = 0.85; ice.visible = false;
  root.add(ice);
  root.scale.setScalar(0.9 + (level - 18) * 0.02);

  let phase = rand(0, 6);
  const j = { legs: 0, neckX: 0, bodyY: 0.82, rollZ: 0, tail: 0 };
  function update(dt, a) {
    const s = dt / 1000;
    ice.visible = !!a.frozen;
    bodyMat.color.set(a.state === 'dead' ? 0x5a5048 : a.slowed ? 0x6f7fa0 : 0x6b4426);
    bodyMat.emissive.setScalar(a.flash * 0.9);                 // kurzer weißer Treffer-Blitz
    if (a.frozen) return;                                      // eingefroren: Pose bleibt stehen
    const t = { legs: 0, neckX: 0, bodyY: 0.82, rollZ: 0, tail: Math.sin(performance.now() / 200) * 0.4 };
    if (a.state === 'run') {
      phase += s * a.speed * 2.2;
      t.legs = Math.sin(phase) * 0.8;
      t.bodyY = 0.82 + Math.abs(Math.cos(phase)) * 0.06;
      t.neckX = Math.sin(phase * 2) * 0.05;
    } else if (a.state === 'idle') {
      phase += s * 1.2;
      t.neckX = 0.25 + Math.sin(phase) * 0.1;                    // schnüffelt am Boden
    } else if (a.state === 'dead') {
      t.rollZ = Math.PI / 2; t.bodyY = 0.5; t.tail = 0;
    }
    if (a.attack > 0) t.neckX = Math.sin(a.attack * Math.PI) * 0.7;  // Kopfstoß
    const k = Math.min(1, s * 12);
    for (const key in j) j[key] = lerpTo(j[key], t[key], k);
    legs[0].rotation.x = j.legs; legs[3].rotation.x = j.legs;    // diagonale Paare
    legs[1].rotation.x = -j.legs; legs[2].rotation.x = -j.legs;
    neck.rotation.x = j.neckX;
    body.position.y = j.bodyY;
    body.rotation.z = j.rollZ;
    tail.rotation.y = j.tail;
  }
  return { root, update };
}
