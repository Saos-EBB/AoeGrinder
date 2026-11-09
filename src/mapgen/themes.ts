// Themes der generierten Maps: Layout, Schwierigkeit, Licht/Nebel, Bodenfarben, Wand- und Prop-Sets, Gefahr, Landmarke, Mobs.
// Mobs sind vorerst die alten Typen (mobTypes.ts) als Platzhalter. Alle Werte // PH

import * as THREE from 'three';
import { t } from '../i18n';
import type { ThemeId, ThemeInfo, LayoutId } from './types';
import type { Look } from './build';
import * as M from './models';

export interface Theme {
  id: ThemeId;
  info: ThemeInfo;
  name: string;
  layout: LayoutId;
  env: any;
  look: Look;
  mobs: string[];                           // alte Typen, mobs[0] = Start-Mob (pickMobType)
  packs: { count: number; initialMobs: number; sizeBonus: number };
  hazard: 'none' | 'storm' | 'water' | 'dark' | 'lava';
  storm?: any;
  fogExtra?: number;
}

const glow = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

export const THEMES: Record<ThemeId, Theme> = {
  wald: {
    id: 'wald', info: { id: 'wald', difficulty: 1 }, name: t('zone.wald.name'), layout: 'offen', hazard: 'none',
    env: { fog: 0xe8c9a4, fogNear: 45, fogFar: 185, top: 0x2c4f8c, mid: 0x9fb4d0, sunDisc: 1, sky: 0xb8c8ff, ground: 0x6a4a2a, hemi: 1.25, sun: 0xffb070, sunPower: 2.1, sunPos: [120, 45, -60] },
    look: {
      ground: { a: 0x3f6e22, b: 0x6e9a36, path: 0x8a6a42, wall: 0x22301a },
      rim: { kinds: ['pine', 'pine', 'oak', 'rock'], perCell: 3 },
      glow: glow(0.6, 2.4, 1.2),
      props: { pine: M.pine, oak: M.oak, rock: () => M.rock(0x8a857a), boulder: () => M.boulder(0x7a756a) },
      landmark: M.giantTree,
    },
    mobs: ['skelett', 'dunkelhund', 'knochenwirker', 'fledermaus', 'waechter'],
    packs: { count: 10, initialMobs: 30, sizeBonus: 0 },
  },
  wueste: {
    id: 'wueste', info: { id: 'wueste', difficulty: 2 }, name: t('zone.wueste.name'), layout: 'offen', hazard: 'storm',
    env: { fog: 0xfff2d6, fogNear: 55, fogFar: 195, heat: 1, top: 0x0b3a9c, mid: 0x3f8ae6, sunDisc: 1, sky: 0xffffff, ground: 0xd9b67e, hemi: 1.25, sun: 0xffffff, sunPower: 2.5, sunPos: [25, 160, -30] },
    storm: { every: 180000, dur: 35000, color: 0xc9a468, near: 5, far: 20 },   // wie Tanaris (zones.ts)
    look: {
      ground: { a: 0xc9a46a, b: 0xe0c48a, path: 0xa88654, wall: 0x6a4a2a },
      rim: { kinds: ['boulder', 'boulder', 'rock'], perCell: 2 },
      glow: glow(2.6, 1.8, 0.5),
      props: { cactus: M.cactus, rock: () => M.rock(0xae8c5c), boulder: () => M.boulder(0x9a7448), bones: M.bones },
      landmark: M.obelisk,
    },
    mobs: ['hyaene', 'dieb', 'rohling', 'schwaermer', 'skorpid'],
    packs: { count: 10, initialMobs: 30, sizeBonus: 0 },
  },
  kanaele: {
    id: 'kanaele', info: { id: 'kanaele', difficulty: 3 }, name: t('zone.kanaele.name'), layout: 'kanaele', hazard: 'water', fogExtra: 0.02,
    env: { fog: 0x0a1612, fogNear: 20, fogFar: 90, top: 0x020404, mid: 0x061010, sunDisc: 0, sky: 0x6a8a80, ground: 0x10181a, hemi: 1.3, sun: 0xa8c8b8, sunPower: 0.9, sunPos: [20, 80, 30] },
    look: {
      ground: { a: 0x4a524c, b: 0x5a625a, path: 0x3a423e, wall: 0x1a201e },
      wall: M.sewerWall,
      water: 0x1f4a44,
      glow: glow(2.4, 1.6, 0.4),
      props: { bridge: M.bridge, grate: M.grate, barrel: M.barrel, rock: () => M.rubble(0x4a524c), rubble: () => M.rubble(0x4a524c) },
      landmark: M.sluice,
    },
    mobs: ['ertrunkener', 'hoehlenfledermaus', 'geist', 'kristallgolem', 'axtwerfer'],
    packs: { count: 10, initialMobs: 30, sizeBonus: 0 },
  },
  kathedrale: {
    id: 'kathedrale', info: { id: 'kathedrale', difficulty: 4 }, name: t('zone.kathedrale2.name'), layout: 'hallen', hazard: 'dark', fogExtra: 0.025,
    env: { fog: 0x10121a, fogNear: 30, fogFar: 130, top: 0x04050a, mid: 0x0a0c14, sunDisc: 0, sky: 0x8a90b0, ground: 0x1a1414, hemi: 1.2, sun: 0xc8ccff, sunPower: 0.9, sunPos: [30, 80, 40] },
    look: {
      ground: { a: 0x5a5e6a, b: 0x4a4e5a, path: 0x6a3a34, wall: 0x14161c, hole: 0x020203 },
      wall: M.nave,
      glow: glow(3, 1.5, 0.4),
      props: { pillar: () => M.pillar(), bench: M.bench, candles: M.candles, rubble: () => M.rubble(0x5a5e6a), rock: () => M.rubble(0x5a5e6a) },
      landmark: M.belltower,
    },
    mobs: ['skelett', 'gefallener', 'knochenwirker', 'daemon', 'waechter'],
    packs: { count: 10, initialMobs: 30, sizeBonus: 0 },
  },
  hoelle: {
    id: 'hoelle', info: { id: 'hoelle', difficulty: 5 }, name: t('zone.hoelle.name'), layout: 'raeume', hazard: 'lava',
    env: { fog: 0x4a1409, fogNear: 25, fogFar: 115, heat: 0.45, top: 0x040202, mid: 0x0b0403, sunDisc: 0, sky: 0x9a7c70, ground: 0xff7a3a, hemi: 2.5, sun: 0xff8a40, sunPower: 1.6, sunPos: [25, -60, 15] },
    look: {
      ground: { a: 0x34302f, b: 0x4a3230, path: 0x5a2a1a, wall: 0x120807 },
      wall: M.hellWall,
      lava: 0xff5a14,
      glow: glow(3, 0.9, 0.2),
      props: { spikes: M.spikes, brazier: M.brazier, bones: M.bones, rock: () => M.rock(0x3a2a26), pillar: () => M.pillar(0x3a2220, 0x2a1614, 7) },
      landmark: M.hellgate,
    },
    mobs: ['gefallener', 'daemon', 'abgesandter', 'feuerwache', 'fledermaus'],
    packs: { count: 10, initialMobs: 30, sizeBonus: 0 },
  },
};
