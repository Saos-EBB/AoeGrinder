export interface PackSpot { x: number; z: number; r: number }   // Mitte + Radius (yd), aus dem Layout
export type ThemeId = 'wald' | 'wueste' | 'kanaele' | 'kathedrale' | 'hoelle';
export interface ThemeInfo { id: ThemeId; difficulty: 1 | 2 | 3 | 4 | 5 }
