// Modifikatoren und Modi als Daten, Teil 2 ergänzt nur Einträge. Alle Zahlen PH.
// Figuren (v31): startKit im Raster aus SLOT (config.ts): 5 Attacken, Trinken, Bewegung, Relikt. pool: 9 Fähigkeiten für „Neuer Spell“-Karten, relics: Relikt der Figur
// Wirkung: hp, mana, dmg, speed, packSize als Faktor, timeLimit in ms.
import { t } from './i18n';

export const MODIFIERS = [
  { id: 'half', name: t('mod.half.name'), desc: t('mod.half.desc'), scoreMult: 2, excludes: [], hp: 0.5, mana: 0.5, dmg: 0.5 },
  { id: 'wild', name: t('mod.wild.name'), desc: t('mod.wild.desc'), scoreMult: 1.3, excludes: [], speed: 1.3 },
  { id: 'big', name: t('mod.big.name'), desc: t('mod.big.desc'), scoreMult: 1, excludes: [], packSize: 2 },
  { id: 'time', name: t('mod.time.name'), desc: t('mod.time.desc'), scoreMult: 1, excludes: [], timeLimit: 600000 },
  // Teil 2, ausgewertet in spells/core.ts: startKit, onlyTag, noDrink, noCards, noLuck
  { id: 'frost', name: t('mod.frost.name'), desc: t('mod.frost.desc'), scoreMult: 1.2, excludes: ['fire', 'realmen', 'blitz', 'plague'], startKit: ['nova', 'coc', 'icelance', 'whirl', 'bliz', 'drink', 'blink', null], onlyTag: 'Frost',
    pool: ['nova', 'whirl', 'coc', 'bliz', 'frostorb', 'icelance', 'frostbolt', 'needle', 'icebarrier'], relics: ['iceblock'],
    hitSlow: { pct: 0.2, ms: 2000 } },   // PH: jeder Frost-Treffer, stärkster Slow gilt
  { id: 'fire', name: t('mod.fire.name'), desc: t('mod.fire.desc'), scoreMult: 1.4, excludes: ['frost', 'realmen', 'blitz', 'plague'], startKit: ['fireball', 'flame', 'blast', 'hellfire', 'gasoline', 'drink', 'blink', null], onlyTag: 'Feuer',
    pool: ['fireball', 'flame', 'blast', 'hellfire', 'meteor', 'detonate', 'firetrail', 'firestorm', 'gasoline'], relics: ['phoenix'],
    dotMul: 1.5, baseCrit: 0.15, hp: 0.9 },   // PH: Dauerschaden mit Tag Feuer, Grund-Crit, Leben
  { id: 'blitz', name: t('mod.blitz.name'), desc: t('mod.blitz.desc'), scoreMult: 1.4, excludes: ['frost', 'fire', 'realmen', 'plague'], startKit: ['chain', 'arc', 'strike', 'ball', 'discharge', 'recharge', 'blink', null], onlyTag: 'Blitz',
    pool: ['chain', 'arc', 'strike', 'ball', 'discharge', 'storm', 'quake', 'keeper', 'staticfield'], relics: ['stormelem'], noDrink: true,
    battery: true },   // PH: Batterie in battery.ts, Zahlen in BATTERY (config.ts)
  // Seuchenmagier (v31, ersetzt den Blutmagier): Zauber kosten Leben, kein Mana, keine Regeneration, kein Trinken. Spells in spells/plague.ts
  { id: 'plague', name: t('mod.plague.name'), desc: t('mod.plague.desc'), scoreMult: 1.4, excludes: ['frost', 'fire', 'blitz', 'realmen'],
    startKit: ['sludge', 'slimewave', 'contract', 'drain', 'burst', null, 'melt', null], onlyTag: 'Seuche', noDrink: true, lifeCost: true,
    pool: ['sludge', 'slimetrap', 'slimewave', 'blackhole', 'poisoncloud', 'web', 'contract', 'drain', 'burst'], relics: ['pestilence'] },
  // Kein Magier: Skin in models/mage.ts, Regeln in realMen.ts
  { id: 'realmen', name: t('mod.realmen.name'), desc: t('mod.realmen.desc'), scoreMult: 1, excludes: ['frost', 'fire', 'blitz', 'plague'], startKit: ['wQ', 'wR', 'wCharge', 'wShout', 'wCry', 'wEat', 'wLeap', null], onlyTag: 'Krieger',
    pool: ['wQ', 'wE', 'wR', 'wExec', 'wCry', 'wLast', 'wCharge', 'wClap', 'wShout'], relics: ['wBerserk'] },
  { id: 'nodrink', name: t('mod.nodrink.name'), desc: t('mod.nodrink.desc'), scoreMult: 1.5, excludes: [], noDrink: true },
  { id: 'classic', name: t('mod.classic.name'), desc: t('mod.classic.desc'), scoreMult: 1.5, excludes: ['noluck'], noCards: true },
  { id: 'noluck', name: t('mod.noluck.name'), desc: t('mod.noluck.desc'), scoreMult: 1.2, excludes: ['classic'], noLuck: true },
];

export const MODES = [
  { id: 'normal', name: t('mode.normal.name'), mods: [] },   // ID bleibt, damit die Rangliste weiterläuft; 4 Zufalls-Tasten (spells/random.ts)
  { id: 'hard', name: t('mode.hard.name'), mods: ['half'] },
  { id: 'sprint', name: t('mode.sprint.name'), mods: ['time'] },
  { id: 'frostonly', name: t('mode.frostonly.name'), mods: ['frost'] },
  { id: 'fireonly', name: t('mode.fireonly.name'), mods: ['fire'] },
  { id: 'blitzonly', name: t('mode.blitzonly.name'), mods: ['blitz'] },
  { id: 'plagueonly', name: t('mode.plagueonly.name'), mods: ['plague'] },
  { id: 'realmen', name: t('mode.realmen.name'), mods: ['realmen'] },
  { id: 'classic', name: t('mode.classic.name'), mods: ['classic'] },
  { id: 'custom', name: t('mode.custom.name'), mods: null },   // frei wählbar
];

export let modeId = 'normal';
// ?-Magier: der Modus normal ohne Mods würfelt seine Spells (spells/random.ts)
export const randomMode = () => modeId === 'normal';
let customMods = [];

export const activeModIds = () => MODES.find(m => m.id === modeId).mods ?? customMods;
const active = () => MODIFIERS.filter(m => activeModIds().includes(m.id));

export function setMode(id) { modeId = id; }
// Unabhängig vom Modus: 'packs' wie gehabt, 'waves' siehe waves.ts
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
