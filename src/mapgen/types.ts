// Gemeinsame Typen des Map-Generators. PackSpot, ThemeId, ThemeInfo sind die feste Schnittstelle zum Mob-Spawn (spawnPack).

export interface PackSpot { x: number; z: number; r: number }   // Mitte + Radius (yd), aus dem Layout
export type ThemeId = 'wald' | 'wueste' | 'kanaele' | 'kathedrale' | 'hoelle';
export interface ThemeInfo { id: ThemeId; difficulty: 1 | 2 | 3 | 4 | 5 }

export interface Spot { x: number; z: number }
// Deko aus dem Layout, das Theme liefert dazu Modell und Collider (build.ts)
export interface Deco { kind: string; x: number; z: number; ry?: number; s?: number }
export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }
export type LayoutId = 'offen' | 'kanaele' | 'raeume' | 'hallen';
