// Meta: Knochenstaub, gesperrter Pool, Shop nach Abschluss, Splits, Inventar der Mage-Waffen (weaponRolls.ts). Waffen machen stärker, Kevins Entscheidung; nur erspielter Staub.
// Alle Zahlen in META, alles // PH außer den Entscheidungen von Kevin. Seltenheiten und Startset: docs/pool-liste.md

import { state, player } from './state';
import { SPELLS } from './config';
import { activeModIds, mobMode, siegeGoal, scoreMult } from './modifiers';
import { SUPPORTS } from './spells/supports';

export const META = {
  store: 'frostgrind.meta.v1',
  splits: [15, 30, 45, 60, 75, 90, 100],
  dust: { perLevel: 1, doneBonusAtTier3: 50 },         // Abschluss-Bonus wächst mit der Shop-Stufe
  price: { 'grün': 40, blau: 70, lila: 120, orange: 200, perBuy: 1.15 },
  charMods: ['frost', 'fire', 'arcane', 'blitz', 'plague', 'realmen', 'klinge'],    // Figuren, zählen nicht als Mod
  shop: {
    siegeTier: { 5: 1, 10: 2, 15: 3 }, endlessTier: 5, endlessMinMs: 20 * 60000,
    packsTier: 3, packsOneModTier: 5,
    offer: { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 }, offerPerExtraTier: 2,
    // Höchste Seltenheit pro Stufe; capped: davon höchstens so viele im Angebot
    top: { 1: ['blau'], 2: ['blau', 'lila'], 3: ['lila'], 4: ['lila', 'orange'] }, capped: 1,
    sure: { 3: { lila: 2 }, 4: { lila: 3, orange: 1 }, 5: { lila: 3, orange: 2 } },   // Mindestens so viele, damit hohe Stufen spürbar besser sind
  },
  rarity: {
    support: { wide: 'grün', focus: 'grün', potency: 'blau', chain: 'blau', boneChill: 'blau', echo: 'lila', blood: 'lila', bigEcho: 'orange' },
    relic: { ragnaros: 'orange', froststrike: 'orange' }, relicDefault: 'lila',
    rune: ['grün', 'blau', 'lila'],                    // nach Position im Spell
  },
};
const RANK = ['grün', 'blau', 'lila', 'orange'];
const FREE = ['grün'];

function load() {
  try { return { dust: 0, unlocked: [], bought: {}, bestTier: 0, offer: [], inv: [], equipped: null, nextWeapon: 0, ...JSON.parse(localStorage.getItem(META.store) || '{}') }; }
  catch { return { dust: 0, unlocked: [], bought: {}, bestTier: 0, offer: [], inv: [], equipped: null, nextWeapon: 0 }; }
}
// Waffen-Elemente, die es nicht mehr gibt (v28): Gift → Blut, Void → Arkan. Auch für Spielstand-Codes
const ELEMENT_REPLACE = { gift: 'blut', void: 'arkan' };
export function fixWeapon(w) { if (w?.s && ELEMENT_REPLACE[w.s.element]) w.s.element = ELEMENT_REPLACE[w.s.element]; return w; }
export const meta = load();
meta.inv.forEach(fixWeapon);
export const saveMeta = () => { try { localStorage.setItem(META.store, JSON.stringify(meta)); } catch { /* egal */ } };

// ---------- Pool ----------
export function catalog() {
  const out = [];
  for (const [id, s] of Object.entries<any>(SPELLS)) {
    if (s.relic) out.push({ key: `relic:${id}`, type: 'Relikt', name: s.name, rarity: META.rarity.relic[id] ?? META.rarity.relicDefault });
    (s.runes ?? []).forEach((r, i) => out.push({ key: `rune:${id}:${i}`, type: 'Rune', name: `${r.name} (${s.name})`, rarity: META.rarity.rune[i] ?? 'lila' }));
  }
  for (const x of SUPPORTS) out.push({ key: `support:${x.id}`, type: 'Support', name: x.name, rarity: META.rarity.support[x.id] ?? 'blau' });
  return out.filter(e => !FREE.includes(e.rarity));
}
// Nicht zwischenspeichern: realMen.ts trägt seine Spells erst während des Ladens ein
export const isUnlocked = key => meta.unlocked.includes(key) || !catalog().some(e => e.key === key);

export function priceOf(e) {
  return Math.round(META.price[e.rarity] * META.price.perBuy ** (meta.bought[e.type] || 0));
}
export function buy(e) {
  const cost = priceOf(e);
  if (meta.dust < cost || meta.unlocked.includes(e.key)) return false;
  meta.dust -= cost;
  meta.unlocked.push(e.key);
  meta.bought[e.type] = (meta.bought[e.type] || 0) + 1;
  saveMeta();
  return true;
}

// ---------- Shop-Stufe und Staub ----------
export const modCount = () => activeModIds().filter(id => !META.charMods.includes(id)).length;
// 0 = kein Shop. Tod vor dem Abschluss öffnet keinen, der Staub bleibt.
export function shopTier(completed) {
  const n = modCount(), s = META.shop;
  if (mobMode === 'siege') {
    if (!siegeGoal) return state.now >= s.endlessMinMs ? s.endlessTier + n : 0;
    return completed ? s.siegeTier[siegeGoal] + n : 0;
  }
  if (!completed) return 0;
  return n === 0 ? s.packsTier : s.packsOneModTier + n - 1;
}
export function awardDust(completed) {
  const tier = shopTier(completed);
  const bonus = tier ? Math.round(META.dust.doneBonusAtTier3 * tier / 3) : 0;
  const base = Math.round(player.level * META.dust.perLevel * scoreMult());
  const dust = base + bonus;
  meta.dust += dust;
  meta.bestTier = Math.max(meta.bestTier, tier);
  saveMeta();
  return { dust, tier, base, bonus };   // base/bonus: Zeilen der Staub-Rechnung im Run-Ende
}
// Shop im Hauptmenü: letztes Angebot bleibt stehen, damit neu Öffnen nichts neu würfelt. Ohne Abschluss gilt Stufe 1.
export const menuTier = () => Math.max(1, meta.bestTier);
export function keepOffer(offer) { meta.offer = offer.map(e => e.key); saveMeta(); }
export function menuOffer() {
  const all = catalog();
  let offer = meta.offer.map(k => all.find(e => e.key === k)).filter(Boolean);
  if (!offer.length || offer.every(e => meta.unlocked.includes(e.key))) { offer = rollShop(menuTier()); keepOffer(offer); }
  return offer;
}
export function rollShop(tier) {
  const s = META.shop, locked = catalog().filter(e => !meta.unlocked.includes(e.key));
  const top = s.top[tier] ?? ['orange'], max = RANK.indexOf(top[top.length - 1]);
  const allowed = locked.filter(e => RANK.indexOf(e.rarity) <= max).sort(() => Math.random() - 0.5);
  const count = s.offer[Math.min(tier, 5)] + Math.max(0, tier - 5) * s.offerPerExtraTier;
  // Gedeckelte Stufen zeigen die oberste Seltenheit nur einzeln
  const capRarity = top.length > 1 ? top[1] : null;
  const picks = [];
  for (const [rarity, n] of Object.entries<any>(s.sure[Math.min(tier, 5)] ?? {})) picks.push(...allowed.filter(e => e.rarity === rarity).slice(0, n));
  let capped = picks.filter(e => e.rarity === capRarity).length;
  for (const e of allowed) {
    if (picks.includes(e)) continue;
    if (picks.length >= count) break;
    if (e.rarity === capRarity && ++capped > s.capped) continue;
    picks.push(e);
  }
  return picks;
}

// ---------- Dev ----------
export function devSetDust(v) { meta.dust = v; saveMeta(); }
export function devUnlockAll() { meta.unlocked = catalog().map(e => e.key); saveMeta(); }
export function devReset() { Object.assign(meta, { dust: 0, unlocked: [], bought: {}, bestTier: 0, offer: [], inv: [], equipped: null, nextWeapon: 0 }); saveMeta(); }
