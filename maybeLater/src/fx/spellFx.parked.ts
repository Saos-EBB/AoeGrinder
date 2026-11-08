// Geparkt am 2026-11-08 aus src/fx/spellFx.ts: Optik der Arcane Explosion (ae.ts, Archon-Explosion in arcRelics.ts).
// Braucht dort: import { aeLook } from '../vfx/arcaneLook' (geparkter Teil).

export function arcaneExplosionFx(pos, radius) {
  if (!vfxOld()) return aeLook(pos, radius);
  const c = new THREE.Vector3(pos.x, pos.y + 1, pos.z);
  groundDecalFx(runeTex, pos, radius, [1.8, 0.7, 2.4], 700, { additive: true, spin: 1.2, grow: 0.25 });
  flashFx(c, 0xd890ff, 6, 250);
  ringFx(pos, radius, ARCANE_PINK, 350);
  for (let i = 0; i < 180; i++) {                           // Kugel-Explosion
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize();
    const sp = rand(15, 24);
    particles.spawn({ x: c.x, y: c.y, z: c.z, vx: dir.x * sp, vy: dir.y * sp * 0.6, vz: dir.z * sp,
      drag: 3.2, life: rand(0.4, 0.7), color: pick([ARCANE, ARCANE_PINK]), size: rand(0.22, 0.5) });
  }
  for (let i = 0; i < 40; i++) {                            // Funken, die nachglühen und aufsteigen
    const a = rand(0, Math.PI * 2), r = rand(1, radius);
    particles.spawn({ x: pos.x + Math.cos(a) * r, y: pos.y + rand(0.3, 1.5), z: pos.z + Math.sin(a) * r,
      vy: rand(1, 3), life: rand(0.6, 1.1), color: ARCANE_PINK, size: rand(0.2, 0.35) });
  }
}


// Runen-Textur der alten Arcane-Explosion-Optik (vfxOld)
const runeTex = canvasTex((g, r) => {                     // Arkaner Runenkreis
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  for (const [rad, w] of [[0.95, 6], [0.82, 3], [0.55, 4], [0.45, 2]]) {
    g.lineWidth = w; g.beginPath(); g.arc(r, r, r * rad, 0, Math.PI * 2); g.stroke();
  }
  for (let i = 0; i < 6; i++) {                           // Hexagramm
    const a = i / 6 * Math.PI * 2, b = (i + 2) / 6 * Math.PI * 2;
    g.lineWidth = 3; g.beginPath();
    g.moveTo(r + Math.cos(a) * r * 0.55, r + Math.sin(a) * r * 0.55);
    g.lineTo(r + Math.cos(b) * r * 0.55, r + Math.sin(b) * r * 0.55); g.stroke();
  }
  for (let i = 0; i < 24; i++) {                          // Runenzeichen zwischen den Ringen
    const a = i / 24 * Math.PI * 2;
    g.save(); g.translate(r + Math.cos(a) * r * 0.885, r + Math.sin(a) * r * 0.885); g.rotate(a + Math.PI / 2);
    g.lineWidth = 3; g.beginPath();
    for (let k = 0; k < 3; k++) { g.moveTo(rand(-9, 9), rand(-11, 11)); g.lineTo(rand(-9, 9), rand(-11, 11)); }
    g.stroke(); g.restore();
  }
});
