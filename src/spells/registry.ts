// Spell-Registry (ARCH-05/10): Spell-ID → Definition. Laufzeit-Zustand, gefüllt von spells/index.ts (Object.assign) und realMen.ts (Krieger-Spells).
// Ohne Laufzeit-Imports (nur Typen), damit jedes Modul sie lesen kann, ohne in den Import-Kreis zu geraten. config.ts exportiert sie für den Übergang weiter.
import type { Vector3 } from 'three';
import type { Mob } from '../state';
export const SPELLS: any = {};

// Wirk-Kontext eines Zaubers (spells/core.ts makeCtx), den effect(c, point) bekommt. Nur Typ, kein Laufzeit-Import.
export interface CastCtx {
  id: string;
  castKey: number;
  hit(m: Mob, amount: number): boolean;
  hitProjectile(m: Mob, amount: number): boolean;   // Support Kette springt weiter
  radius(base: number): number;
  duration(base: number): number;
  cost?: number;   // gezahlte Mana bzw. Leben (release)
  over?: boolean;   // Batterie überladen (Blitz)
  forceCrit?: boolean;
  scaleOut?: () => number;   // Seuche: Platzen (plague.ts withScale)
  at?: Vector3;   // Nova an anderer Stelle (Set Splitterkönig, needle.ts)
}

// Dauerfläche eines Zaubers (spells/core.ts addField, state.fields). Spells hängen eigene Felder an (Index-Signatur).
export interface SpellField {
  c: CastCtx;
  pos: Vector3;
  radius: number;
  start: number;
  end: number;
  nextTick: number;
  tickMs: number;
  dur?: number;
  visual?: any;   // Optik aus vfx/* (update(pos, radius), remove(), je Look mehr)
  onTick?(f: SpellField): void;
  onUpdate?(f: SpellField, dt: number): void;
  onEnd?(f: SpellField): void;
  [extra: string]: any;
}
// Was addField bekommt: pos, radius, dur Pflicht, Zeiten setzt addField
export interface FieldOpts {
  pos: Vector3;
  radius: number;
  dur: number;
  tickMs?: number;
  visual?: any;
  onTick?(f: SpellField): void;
  onUpdate?(f: SpellField, dt: number): void;
  onEnd?(f: SpellField): void;
  [extra: string]: any;
}
