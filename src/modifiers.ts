// Modifikatoren und Modi als Daten, Teil 2 ergänzt nur Einträge. Alle Zahlen PH.
// Figuren (v31): startKit im Raster aus SLOT (config.ts): 5 Attacken, Trinken, Bewegung, Relikt. pool: 9 Fähigkeiten für „Neuer Spell“-Karten, relics: Relikt der Figur
// Wirkung: hp, mana, dmg, speed, packSize als Faktor, timeLimit in ms.

export const MODIFIERS = [
  { id: 'half', name: 'Halbe Werte', desc: '−50 % Leben, Mana, Schaden', scoreMult: 2, excludes: [], hp: 0.5, mana: 0.5, dmg: 0.5 },
  { id: 'wild', name: 'Wilde Mobs', desc: 'Mobs +30 % Tempo', scoreMult: 1.3, excludes: [], speed: 1.3 },
  { id: 'big', name: 'Große Packs', desc: 'doppelte Packgröße', scoreMult: 1, excludes: [], packSize: 2 },
  { id: 'time', name: 'Zeitlimit', desc: 'Run endet nach 10 Minuten', scoreMult: 1, excludes: [], timeLimit: 600000 },
  // Teil 2, ausgewertet in spells/core.ts: startKit, onlyTag, noDrink, noCards, noLuck
  { id: 'frost', name: 'Nur Frost', desc: 'nur Frost-Spells und -Karten, Blink und Trinken bleiben', scoreMult: 1.2, excludes: ['fire', 'arcane', 'realmen', 'klinge', 'blitz', 'plague'], startKit: ['nova', 'coc', 'icelance', 'whirl', 'bliz', 'drink', 'blink', null], onlyTag: 'Frost',
    pool: ['nova', 'whirl', 'coc', 'bliz', 'frostorb', 'icelance', 'frostbolt', 'needle', 'icebarrier'], relics: ['iceblock'],
    hitSlow: { pct: 0.2, ms: 2000 } },   // PH: jeder Frost-Treffer, stärkster Slow gilt
  { id: 'fire', name: 'Nur Feuer', desc: 'nur Feuer-Spells und -Karten, Blink und Trinken bleiben', scoreMult: 1.4, excludes: ['frost', 'arcane', 'realmen', 'klinge', 'blitz', 'plague'], startKit: ['fireball', 'flame', 'blast', 'hellfire', 'gasoline', 'drink', 'blink', null], onlyTag: 'Feuer',
    pool: ['fireball', 'flame', 'blast', 'hellfire', 'meteor', 'detonate', 'firetrail', 'firestorm', 'gasoline'], relics: ['phoenix'],
    dotMul: 1.5, baseCrit: 0.15, hp: 0.9 },   // PH: Dauerschaden mit Tag Feuer, Grund-Crit, Leben
  { id: 'arcane', name: 'Nur Arkan', desc: 'nur Arkan-Spells und -Karten, Trinken bleibt; schwebt, +10 % Tempo', scoreMult: 1.4, excludes: ['frost', 'fire', 'realmen', 'klinge', 'blitz', 'plague'], startKit: ['ae', 'arcmissiles', 'barrage', 'voidorb', 'surge', 'drink', 'blink', null], onlyTag: 'Arkan',
    pool: ['ae', 'arcmissiles', 'barrage', 'voidorb', 'arcmark', 'beam', 'arcorb', 'surge', 'arcstrike'], relics: ['archon', 'timewarp'],
    castWhileMoving: true, blinkCharges: 2, hp: 0.85, manaCost: 1.15 },   // PH: Zaubern und Kanäle im Laufen, Leben, Manakosten
  { id: 'blitz', name: 'Nur Blitz', desc: 'nur Blitz-Spells und -Karten, Batterie statt Mana, Aufladen statt Trinken, Blink bleibt', scoreMult: 1.4, excludes: ['frost', 'fire', 'arcane', 'realmen', 'klinge', 'plague'], startKit: ['chain', 'arc', 'strike', 'ball', 'discharge', 'recharge', 'blink', null], onlyTag: 'Blitz',
    pool: ['chain', 'arc', 'strike', 'ball', 'discharge', 'storm', 'quake', 'keeper', 'staticfield'], relics: ['stormelem'], noDrink: true,
    battery: true },   // PH: Batterie in battery.ts, Zahlen in BATTERY (config.ts)
  // Seuchenmagier (v31, ersetzt den Blutmagier): Zauber kosten Leben, kein Mana, keine Regeneration, kein Trinken. Spells in spells/plague.ts
  { id: 'plague', name: 'Nur Seuche', desc: 'Seuchenmagier: Zauber kosten Leben, Male und Gift, kein Mana, kein Trinken', scoreMult: 1.4, excludes: ['frost', 'fire', 'arcane', 'blitz', 'realmen', 'klinge'],
    startKit: ['sludge', 'slimewave', 'contract', 'drain', 'burst', null, 'melt', null], onlyTag: 'Seuche', noDrink: true, lifeCost: true,
    pool: ['sludge', 'slimetrap', 'slimewave', 'blackhole', 'poisoncloud', 'web', 'contract', 'drain', 'burst'], relics: ['pestilence'] },
  // Kein Magier: Skin in models/mage.ts, Regeln in realMen.ts
  { id: 'realmen', name: 'Real Men', desc: 'Strichkrieger mit Riesenschwert: Wut statt Mana, mehr Wut und weniger Leben machen mehr Schaden', scoreMult: 1, excludes: ['frost', 'fire', 'arcane', 'klinge', 'blitz', 'plague'], startKit: ['wQ', 'wE', 'wR', 'wExec', 'wCry', 'wEat', 'wLeap', 'wLast'], onlyTag: 'Krieger' },
  // Nahkämpfer aus klinge.ts: keine Ressource, nur Abklingzeiten
  { id: 'klinge', name: 'Klingenstrich', desc: 'Strichmännchen mit 2 Katanas, Einhand oder Zweihand, nur Abklingzeiten', scoreMult: 1, excludes: ['frost', 'fire', 'arcane', 'realmen', 'blitz', 'plague'], startKit: ['kQ', 'kE', 'kR', 'kAder', 'kSwap', 'kEat', 'kDash', 'kClones'], onlyTag: 'Klinge' },
  { id: 'nodrink', name: 'Kein Trinken', desc: 'kein Trinken, Mana nur über Regeneration', scoreMult: 1.5, excludes: [], noDrink: true },
  { id: 'classic', name: 'Classic pur', desc: 'keine Level-Karten, alle 2 Level ein Rang auf alle Spells', scoreMult: 1.5, excludes: ['noluck'], noCards: true },
  { id: 'noluck', name: 'Kein Glück', desc: 'Glück bleibt 0, immer 4 Karten', scoreMult: 1.2, excludes: ['classic'], noLuck: true },
];

export const MODES = [
  { id: 'normal', name: '?-Magier', mods: [] },   // ID bleibt, damit die Rangliste weiterläuft; 4 Zufalls-Tasten (randomMage.ts)
  { id: 'hard', name: 'Hardmode', mods: ['half'] },
  { id: 'sprint', name: 'Sprint', mods: ['time'] },
  { id: 'frostonly', name: 'Frost only', mods: ['frost'] },
  { id: 'fireonly', name: 'Fire only', mods: ['fire'] },
  { id: 'arcaneonly', name: 'Arcane only', mods: ['arcane'] },
  { id: 'blitzonly', name: 'Blitz only', mods: ['blitz'] },
  { id: 'plagueonly', name: 'Seuchenmagier', mods: ['plague'] },
  { id: 'realmen', name: 'Strichkrieger', mods: ['realmen'] },
  { id: 'klinge', name: 'Klingenstrich', mods: ['klinge'] },
  { id: 'classic', name: 'Classic', mods: ['classic'] },
  { id: 'custom', name: 'Eigene Mischung', mods: null },   // frei wählbar
];

export let modeId = 'normal';
// ?-Magier: der Modus normal ohne Mods würfelt seine Spells (spells/random.ts)
export const randomMode = () => modeId === 'normal';
let customMods = [];

export const activeModIds = () => MODES.find(m => m.id === modeId).mods ?? customMods;
const active = () => MODIFIERS.filter(m => activeModIds().includes(m.id));

export function setMode(id) { modeId = id; }
// Unabhängig vom Modus: 'packs' wie gehabt, 'siege' siehe siege.ts
export let mobMode = 'packs';
export function setMobMode(id) { mobMode = id; }
export let cardPaceId = 'staffel';         // Kartentakt: CARD_PACES in config.ts
export function setCardPace(id) { cardPaceId = id; }
export let siegeGoal = 0;                 // Minuten bis zum Abschluss, 0 = endlos
export function setSiegeGoal(min) { siegeGoal = min; }
export function setCustomMods(ids) { customMods = ids; }
export function toggleCustomMod(id) {
  const mod = MODIFIERS.find(m => m.id === id);
  customMods = customMods.includes(id) ? customMods.filter(x => x !== id) : [...customMods.filter(x => !mod.excludes.includes(x)), id];
}

// Wert eines Modus-Feldes, der erste aktive Modifikator mit dem Feld gilt
export const modValue = key => active().find(m => m[key] !== undefined)?.[key];
export const modFactor = key => active().reduce((f, m) => f * (m[key] ?? 1), 1);
export const scoreMult = () => modFactor('scoreMult');
export const timeLimit = () => active().find(m => m.timeLimit)?.timeLimit ?? 0;
