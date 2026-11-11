// Roll-Tabellen und reine Helfer der Waffen und des Gears (ARCH-06, aus weaponRolls.ts): Zahlen, Fokus-Liste, Wert-Kürzel, Seltenheits-Faktor.
// Zieht weder spells noch render.ts (nur config/i18n), damit gear/* und das Säubern (gear/clean.ts über gear/rules.ts) außerhalb des Import-Kreises bleiben.
// weaponRolls.ts exportiert alles weiter.

import { CARD_RARITIES } from './config';
import { fmtNum } from './i18n';

// Alle Zahlen PH. Seltenheit: Index in CARD_RARITIES (grau 0 … orange 5), der Faktor kommt von dort (×0,5 … ×5)
export const ROLLS = {
  price: 120, invMax: 25, devInvMax: 50,   // invMax 15 → 25 mit den Gear-Slots (gear/data.ts) // PH          // devInvMax: Dev-Füllen geht über das normale Limit
  weights: [5, 20, 35, 25, 11, 4],                     // grau, weiß, grün, blau, lila, orange
  refund: [5, 10, 15, 25, 40, 60],
  types: ['staff', 'wand', 'book', 'relic'],          // alle vier Typen, ohne Nebenhand liegen Buch und Relikt in der Waffenhand (Kevin 2026-11-03)
  typeRule: { staff: { radius: 0.1, cast: 0.1 }, wand: { cast: -0.15, cd: -0.05, radius: -0.1 }, book: { charges: 1, manaCost: -0.1 }, relic: { dur: 0.1, aura: true } },
  aura: { everyMs: 3000, radius: 6, dmg: 20, share: 0.3 },   // Relikt: Puls mit dem Element-Effekt, Schaden × Level-Faktor, Chance × share
  focus: { dmg: 0.08, radius: 0.04 },                  // Kopf: Fokus-Spell, bei weiß
  values: { dmg: 0.03, crit: 0.02, cd: 0.03, mana: 0.05, hp: 0.05, regen: 0.03, speed: 0.02, radius: 0.03, dur: 0.05 },   // Schaft, bei weiß; Anhänger halb
  elementChance: [0, 0.25, 0.5, 1, 1, 1],              // Anteil der Waffen mit Element je Seltenheit
  procChance: 0.05,                                    // Element-Effekt pro Treffer bei weiß, × Seltenheit
  element: { slow: 0.2, slowMs: 2000, burn: 0.3, burnTicks: 3, mana: 0.02, chainMul: 0.4, chainN: 3, chainYd: 6,
    infectStacks: 1 },
  maker: { grab: { dmg: 0.1, cast: 0.1 }, stern: { crit: 0.05, critMana: 0.01 }, morra: { dur: 0.15, random: 0.05 }, vey: { cd: -0.05, mana: 0.1 }, brandt: { hp: 0.1, lifesteal: 0.02 } },
  notForMages: ['schlachtblech', 'leeroyklinge', 'sionaxt', 'haarspray'],   // Waffen des Strichkriegers (Standard und legendär), Haarspray ist nur Kosmetik (gear/)
  fallback: 'pilgerast',                               // leeres Inventar: Pilgerast ohne Effekt
};
// Die Magier-Spells für den Kopf-Fokus, je Schule (Seuche seit 2026-11-08: die Köpfe Speischädel und Phiolen brauchen Seuchen-Spells)
export const FOCUS_SPELLS = ['nova', 'bliz', 'coc', 'blink', 'flame', 'blast', 'hellfire', 'frostorb', 'whirl', 'icelance', 'glacier', 'fireball', 'meteor', 'phoenix', 'detonate', 'chain', 'arc', 'strike', 'ball', 'discharge', 'storm',
  'sludge', 'slimetrap', 'slimewave', 'blackhole', 'poisoncloud', 'web', 'contract', 'drain', 'burst', 'melt'];
export const VALUE_KEY = { Schaden: 'dmg', Crit: 'crit', Abklingzeit: 'cd', Mana: 'mana', Leben: 'hp', 'Regen im Kampf': 'regen', Lauftempo: 'speed', Radius: 'radius', Dauereffekte: 'dur' };

export const factor = rarity => CARD_RARITIES[rarity].mult;
export const pct = v => `${v < 0 ? '−' : '+'}${fmtNum(Math.round(Math.abs(v) * 1000) / 10)} %`;
// Hauptwert als Zahl für ▲/▼ und Sortierung (ui/compare.ts): v in Prozent wie angezeigt (auf 0,1 gerundet), Abklingzeit negativ
export type MainValue = { key: string; v: number };
export const mainOf = (key: string, raw: number): MainValue => ({ key, v: (key === 'cd' ? -1 : 1) * Math.round(raw * 1000) / 10 });

export function rollRarity() {
  let r = Math.random() * ROLLS.weights.reduce((a, b) => a + b, 0);
  for (let t = 0; t < ROLLS.weights.length; t++) { r -= ROLLS.weights[t]; if (r < 0) return t; }
  return 0;
}
