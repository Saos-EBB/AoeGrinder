// Spell-ID → Bilddatei. Fehlt ein Eintrag, zeigt der Slot Name und Schulfarbe. Herkunft: docs/asset-audit.md (Kevin: selbstgemacht, CC0).
// @ts-ignore: Vite-Funktion
const files: Record<string, string> = import.meta.glob('../assets/icons/*.png', { eager: true, query: '?url', import: 'default' });
const icon = name => files[`../assets/icons/${name}.png`];

export const ICONS: Record<string, string> = {
  nova: icon('frostMissiles2'), coc: icon('frostMissiles'), bliz: icon('boltShower'), frostorb: icon('snowball'),
  icelance: icon('frostMissiles2'), glacier: icon('boltShower'), fireball: icon('fireball'), meteor: icon('flameNova'), arcmissiles: icon('plasmaBolt'), surge: icon('energySpear'),
  rOff: icon('flameNova'), rDef: icon('snowball'), rUtil: icon('energySpear'),   // ?-Magier: Kategorien, der nächste Wurf steht klein im Slot
  froststrike: icon('frostMissiles2'), frostbreath: icon('frostMissiles'),
  ae: icon('boltCurrent'), voidorb: icon('plasmaBolt'), blink: icon('energySpear'), chain: icon('boltCurrent'), arc: icon('boltShower'),
  flame: icon('flameBeam'), blast: icon('flameBolt'), hellfire: icon('flameAura'), firenova: icon('flameNova'), phoenix: icon('flameAura2'), detonate: icon('flameDrop'), ragnaros: icon('fireball'), wClap: icon('flameDrop'), wCry: icon('flameAura2'),
};
