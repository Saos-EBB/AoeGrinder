// Modifikatoren und Modi als Daten, Teil 2 ergänzt nur Einträge. Alle Zahlen PH.
// Wirkung: hp, mana, dmg, speed, packSize als Faktor, timeLimit in ms.

export const MODIFIERS = [
  { id: 'half', name: 'Halbe Werte', desc: '−50 % Leben, Mana, Schaden', scoreMult: 2, excludes: [], hp: 0.5, mana: 0.5, dmg: 0.5 },
  { id: 'wild', name: 'Wilde Mobs', desc: 'Mobs +30 % Tempo', scoreMult: 1.3, excludes: [], speed: 1.3 },
  { id: 'big', name: 'Große Packs', desc: 'doppelte Packgröße', scoreMult: 1, excludes: [], packSize: 2 },
  { id: 'time', name: 'Zeitlimit', desc: 'Run endet nach 10 Minuten', scoreMult: 1, excludes: [], timeLimit: 600000 },
  // Teil 2, ausgewertet in spells/core.ts: startKit, onlyTag, noTag, noDrink, noCards, noLuck
  { id: 'frost', name: 'Nur Frost', desc: 'nur Frost-Spells und -Karten, Blink und Trinken bleiben', scoreMult: 1.2, excludes: ['fire', 'arcane', 'realmen'], startKit: ['nova', 'whirl', 'bliz', 'coc', 'blink', 'drink'], onlyTag: 'Frost' },
  { id: 'fire', name: 'Nur Feuer', desc: 'Feuer-Start, keine Frost-Karten', scoreMult: 1.4, excludes: ['frost', 'arcane', 'realmen'], startKit: ['blast', 'flame', 'hellfire', null, 'blink', 'drink'], noTag: 'Frost' },
  { id: 'arcane', name: 'Nur Arkan', desc: 'nur Arkan-Spells und -Karten, Trinken bleibt; schwebt, +10 % Tempo', scoreMult: 1.4, excludes: ['frost', 'fire', 'realmen'], startKit: ['ae', 'voidorb', null, null, 'blink', 'drink'], onlyTag: 'Arkan' },
  // Kein Magier: Skin in models/mage.ts, Regeln in realMen.ts
  { id: 'realmen', name: 'Real Men', desc: 'Skelett-Krieger mit Zweihänder und Wut statt Mana', scoreMult: 1, excludes: ['frost', 'fire', 'arcane'], startKit: ['wAttack', 'wWhirl', 'wSmash', 'wClap', 'wCry', 'wCharge'], onlyTag: 'Krieger' },
  { id: 'nodrink', name: 'Kein Trinken', desc: 'kein Trinken, Mana nur über Regeneration', scoreMult: 1.5, excludes: [], noDrink: true },
  { id: 'classic', name: 'Classic pur', desc: 'keine Level-Karten, alle 2 Level ein Rang auf alle Spells', scoreMult: 1.5, excludes: ['noluck'], noCards: true },
  { id: 'noluck', name: 'Kein Glück', desc: 'Glück bleibt 0, immer 4 Karten', scoreMult: 1.2, excludes: ['classic'], noLuck: true },
];

export const MODES = [
  { id: 'normal', name: 'Normal', mods: [] },
  { id: 'hard', name: 'Hardmode', mods: ['half'] },
  { id: 'sprint', name: 'Sprint', mods: ['time'] },
  { id: 'frostonly', name: 'Frost only', mods: ['frost'] },
  { id: 'fireonly', name: 'Fire only', mods: ['fire'] },
  { id: 'arcaneonly', name: 'Arcane only', mods: ['arcane'] },
  { id: 'realmen', name: 'Real Men', mods: ['realmen'] },
  { id: 'classic', name: 'Classic', mods: ['classic'] },
  { id: 'custom', name: 'Eigene Mischung', mods: null },   // frei wählbar
];

export let modeId = 'normal';
let customMods = [];

export const activeModIds = () => MODES.find(m => m.id === modeId).mods ?? customMods;
const active = () => MODIFIERS.filter(m => activeModIds().includes(m.id));

export function setMode(id) { modeId = id; }
// Unabhängig vom Modus: 'packs' wie gehabt, 'siege' siehe siege.ts
export let mobMode = 'packs';
export function setMobMode(id) { mobMode = id; }
export function toggleCustomMod(id) {
  const mod = MODIFIERS.find(m => m.id === id);
  customMods = customMods.includes(id) ? customMods.filter(x => x !== id) : [...customMods.filter(x => !mod.excludes.includes(x)), id];
}

export const modFactor = key => active().reduce((f, m) => f * (m[key] ?? 1), 1);
export const scoreMult = () => modFactor('scoreMult');
export const timeLimit = () => active().find(m => m.timeLimit)?.timeLimit ?? 0;
