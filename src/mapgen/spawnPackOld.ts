// Pack auf einem Platz der generierten Map, mit den ALTEN Mob-Typen (pickMobType). Platzhalter, bis die neuen Mob-Kategorien kommen:
// Die ersetzen nur den Import in mobs.ts, die Signatur bleibt spawnPack(spot, theme, level).

import * as THREE from 'three';
import { state } from '../state';
import { rand, randInt } from '../util';
import { LEVEL_PACK_SPREAD } from '../config';
import { zone } from '../world';
import { spawnMob, pickMobType, rollPackSize, spawnChampionPack } from '../mobs';
import { rollChampionPack } from '../champions';
import type { PackSpot, ThemeInfo } from './types';

export function spawnPack(spot: PackSpot, _theme: ThemeInfo, level: number): void {
  const champ = rollChampionPack();                    // Champion-Pack statt normalem Pack (champions.ts)
  if (champ) return spawnChampionPack(spot.x, spot.z, champ);
  const size = rollPackSize();
  const spread = Math.min(spot.r, Math.max(LEVEL_PACK_SPREAD, Math.sqrt(size) * 1.5));
  const packId = ++state.packCounter;
  for (let i = 0; i < size; i++) {
    const pos = new THREE.Vector3(spot.x, 0, spot.z);
    for (let tries = 0; tries < 6; tries++) {         // nur auf freiem Boden, sonst Mitte des Platzes
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * spread, x = spot.x + Math.cos(a) * r, z = spot.z + Math.sin(a) * r;
      if (zone.spawnOk?.(x, z) ?? true) { pos.set(x, 0, z); break; }
    }
    spawnMob(pickMobType(), pos, Math.max(1, level + [-1, 0, 0, 1, 1, 2][randInt(0, 5)]), packId);
  }
}
