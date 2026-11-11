// Spell-Registry (ARCH-05/10): Spell-ID → Definition. Laufzeit-Zustand, gefüllt von spells/index.ts (Object.assign) und realMen.ts (Krieger-Spells).
// Ohne Imports, damit jedes Modul sie lesen kann, ohne in den Import-Kreis zu geraten. config.ts exportiert sie für den Übergang weiter.
export const SPELLS: any = {};
