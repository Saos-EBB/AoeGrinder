// Arena: fester Kreis (~40 yd), Säulenring, kein Generator, keine Packs. Ort für den Boss-Modus: mit #boss in der URL startet dort
// nach kurzer Pause ein Boss (boss.ts), einer pro Run, sonst über Dev → „Boss jetzt“. Erreichbar über Dev → Zone oder ?zone=arena. Alle Zahlen // PH

import * as THREE from 'three';
import { addBox, addCircle } from '../collision';
import { toonMat } from '../toon';
import { state } from '../state';
import { t } from '../i18n';
import { colored } from './build';
import * as M from './models';

const A = { r: 40, wallR: 42, pillars: 16, pillarR: 34, braziers: 8, bossDelay: 3000 };

const floorA = new THREE.Color(0x4a4448), floorB = new THREE.Color(0x5a5258), ring = new THREE.Color(0x8a6a3a), out = new THREE.Color(0x0c0a0c);
let bossAt = 0, bossStarted = -1;   // bossStarted: state.now beim Start des Bosses in diesem Run, -1 = noch keiner

export const arena: any = {
  name: t('zone.arena.name'),
  toon: true,
  noPacks: true,
  edgeR: A.r - 4,                        // Wellen (waves.ts) kommen innen an der Wand
  rimR: A.r,                             // Minimap-Rand
  env: { fog: 0x14100c, fogNear: 30, fogFar: 130, top: 0x040302, mid: 0x0c0806, sunDisc: 0, sky: 0xb09080, ground: 0x2a1a14, hemi: 1.6, sun: 0xffc890, sunPower: 1.2, sunPos: [20, 80, 30] },
  height: () => 0,
  ground(c: THREE.Color, x: number, z: number) {
    const r = Math.hypot(x, z);
    if (r > A.r + 1) { c.copy(out); return; }
    c.copy(floorA).lerp(floorB, 0.5 + 0.5 * Math.sin(r * 0.6));    // Ringe im Pflaster
    if (Math.abs(r - A.r + 3) < 1 || Math.abs(r - 12) < 0.8) c.lerp(ring, 0.8);
  },
  props(ctx) {
    const mat = toonMat({ vertexColors: true });
    // Außenwand: Ring aus Blöcken
    const N = 28, segW = A.wallR * 2 * Math.PI / N + 0.6;
    const wall = colored([[new THREE.BoxGeometry(segW, 10, 3).translate(0, 5, 0), 0x3a3236], [new THREE.BoxGeometry(segW + 0.3, 0.8, 3.4).translate(0, 10.4, 0), 0x4a4044]]);
    const walls = Array.from({ length: N }, (_, i) => { const a = i / N * Math.PI * 2; return { x: Math.cos(a) * (A.wallR + 1.5), z: Math.sin(a) * (A.wallR + 1.5), ry: -a + Math.PI / 2 }; });
    for (const w of walls) addBox(w.x, w.z, segW, 3, w.ry);
    ctx.place([{ geo: wall, mat }], walls);
    // Säulenring und Glutschalen dazwischen
    const pillar = M.pillar(0x6a6064, 0x4a4044, 8), pillars = Array.from({ length: A.pillars }, (_, i) => { const a = (i + 0.5) / A.pillars * Math.PI * 2; return { x: Math.cos(a) * A.pillarR, z: Math.sin(a) * A.pillarR }; });
    for (const p of pillars) addCircle(p.x, p.z, pillar.r!);
    ctx.place([{ geo: pillar.geo, mat }], pillars);
    const braz = M.brazier(), spots = Array.from({ length: A.braziers }, (_, i) => { const a = i / A.braziers * Math.PI * 2; return { x: Math.cos(a) * (A.r - 2), z: Math.sin(a) * (A.r - 2) }; });
    for (const p of spots) addCircle(p.x, p.z, braz.r!, braz.h);
    ctx.place([{ geo: braz.geo, mat }, { geo: braz.glow!, mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.3), fog: false }) }], spots);
  },
  spawn: { x: 0, z: 0 },
  spawnOk: (x: number, z: number) => Math.hypot(x, z) < A.r - 4,
  mobs: ['skelett', 'gefallener', 'daemon', 'waechter', 'knochenwirker'],   // für Boss-Adds (boss.ts liest zone.mobs)
  packs: { count: 0, initialMobs: 0, sizeBonus: 0 },
  update() {
    // #boss: Boss starten, sobald keiner läuft (boss.ts dynamisch, sonst Import-Kreis zones → boss → world)
    if (location.hash !== '#boss' || document.body.classList.contains('menu')) return;
    if (state.now < bossStarted) { bossStarted = -1; bossAt = 0; }   // neuer Run (state.now beginnt bei 0): wieder ein Boss
    if (bossStarted >= 0) return;                                    // pro Run nur ein Boss, danach geht der Run normal weiter
    bossAt ||= state.now + A.bossDelay;
    if (state.now < bossAt) return;
    bossAt = state.now + A.bossDelay;
    import('../boss').then(b => { if (!b.bossBusy() && b.startBoss()) bossStarted = state.now; });
  },
  leave() { bossAt = 0; bossStarted = -1; },
};
