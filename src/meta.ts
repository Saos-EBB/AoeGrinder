// Meta: Knochenstaub, gesperrter Pool, Shop nach Abschluss, Splits, Inventar der Mage-Waffen (weaponRolls.ts). Waffen machen stärker, Kevins Entscheidung; nur erspielter Staub.
// Alle Zahlen in META, alles // PH außer den Entscheidungen von Kevin. Seltenheiten und Startset: docs/pool-liste.md

import { state, player } from './state';
import { SPELLS, CARD_RARITIES } from './config';
import { activeModIds, scoreMult } from './modifiers';
import { SUPPORTS } from './spells/supports';
import { TYPES, HEADS, ELEMENTS, MAKERS } from './models/weapons/baukasten';
import { STANDARD, cleanSkins, cleanAch, skinsFor, skinLock, setAch, type HeroClass, type SkinId } from './skins';
import { KEYS, readRaw, writeRaw, write, remove, keysWith } from './storage';
import { emit } from './hooks';

export const META = {
  backups: 3,                                          // so viele Sicherungen eines unlesbaren Stands bleiben liegen
  splits: [15, 30, 45, 60, 75, 90, 100],
  dust: { perLevel: 1, doneBonusAtTier3: 50 },         // Abschluss-Bonus wächst mit der Shop-Stufe
  price: { 'grün': 40, blau: 70, lila: 120, orange: 200, perBuy: 1.15 },
  charMods: ['frost', 'fire', 'blitz', 'plague', 'realmen'],    // Figuren, zählen nicht als Mod
  shop: {
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
const RANK = CARD_RARITIES.slice(2).map(r => r.id);   // grün … orange
const FREE = ['grün'];

// skins: gewählter Look pro Figur (skins.ts), fehlt oder kaputt → Standard. achievements: freigeschaltete Erfolge (skins.ts ACHIEVEMENTS), fehlt in alten Ständen.
// Nie einen echten Stand durch einen leeren ersetzen: Ist der Text kein JSON-Objekt, wird er unter KEYS.metaBackup + <ISO-Zeit> gesichert (höchstens
// META.backups Stück), dann Start mit Standard. Die Säuberung läuft Schritt für Schritt: schlägt einer fehl, fällt nur sein Feld auf Standard, der Rest bleibt.
const metaDefaults = () => ({ dust: 0, unlocked: [], bought: {}, bestTier: 0, offer: [], inv: [], equipped: null, nextWeapon: 0 });
let saveBlocked = false;   // Backup ließ sich nicht schreiben: dann den alten Text im Speicher nicht überschreiben
function backupMeta(raw: string, why: string) {
  const key = KEYS.metaBackup + new Date().toISOString();
  if (!writeRaw(key, raw)) {
    saveBlocked = true;
    console.error(`[meta] Spielstand ${why}, Sicherung fehlgeschlagen. Der gespeicherte Stand wird in dieser Sitzung nicht überschrieben.`);
    return;
  }
  const old = keysWith(KEYS.metaBackup);
  for (const k of old.slice(0, Math.max(0, old.length - META.backups))) remove(k);
  console.warn(`[meta] Spielstand ${why}, Rohtext gesichert unter ${key}`);
}
function load() {
  const raw = readRaw(KEYS.meta);
  let saved: any = {}, backedUp = false;
  const backup = (why: string) => { if (!backedUp && raw) backupMeta(raw, why); backedUp = true; };
  if (raw) {
    try { saved = JSON.parse(raw); } catch { saved = null; }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) { backup('nicht lesbar'); saved = {}; }
  }
  const m: any = { ...metaDefaults(), ...saved };
  const step = (name: string, fn: () => void, reset: () => void) => {
    try { fn(); } catch (e) { console.warn(`[meta] Säubern „${name}“ fehlgeschlagen, Feld auf Standard`, e); backup(`Feld ${name} kaputt`); reset(); }
  };
  step('skins', () => cleanSkinState(m), () => { m.skins = {}; try { m.achievements = cleanAch(m.achievements); } catch { m.achievements = []; } });
  step('stats', () => { m.stats = cleanStats(m.stats); }, () => { m.stats = cleanStats(null); });
  // Waffen einzeln: eine kaputte fällt raus (steht im Backup), die anderen bleiben
  if (!Array.isArray(m.inv)) step('inv', () => { throw new TypeError('inv ist keine Liste'); }, () => { m.inv = []; });
  m.inv = m.inv.filter((w, i) => { let ok = true; step(`inv[${i}]`, () => fixWeapon(w), () => { ok = false; }); return ok; });
  return m;
}
// Zähler über alle Runs (Meilensteine): kills, dust = erspielter Staub gesamt (nicht der Kontostand). Fehlt in alten Ständen → 0
const count = (v: any) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };   // ganze Zahl ≥ 0, NaN/Infinity → 0
export const cleanStats = (raw: any) => ({ kills: count(raw?.kills), dust: count(raw?.dust) });
// Erfolge und Skin-Wahl säubern (Laden, Spielstand-Code): ein gewählter, aber gesperrter Skin fällt auf Standard zurück
export function cleanSkinState(m) {
  m.achievements = cleanAch(m.achievements);
  m.skins = cleanSkins(m.skins);
  for (const f of Object.keys(m.skins) as HeroClass[]) { const lock = skinLock(f, m.skins[f]); if (lock && !m.achievements.includes(setAch(lock))) delete m.skins[f]; }
}
// Migration alter Baukasten-Waffen (Inventar beim Laden, Spielstand-Codes in ui/saveCode.ts, Dev-Schmied). Nie crashen: Unbekanntes fällt zurück.
// v28: Elemente Gift → Seuche (über Blut), Void → Arkan. Rework 2026-11-08 (Toon, Köpfe je Schule): Blut → Seuche, Dunkel → Arkan (Vorschlag, Kevin entscheidet noch, Alternative none),
// alte Köpfe nach ihrer Schule auf die neuen
const ELEMENT_REPLACE = { gift: 'seuche', void: 'arkan', blut: 'seuche', dunkel: 'arkan' };
const HEAD_REPLACE = {
  kristall: 'frostorb', splitter: 'frostorb', nadel: 'frostorb', siegel: 'frostorb', sichel: 'sichel',
  kaefig: 'glutschaedel', laterne: 'glutschaedel', herz: 'glutschaedel', klaue: 'dreizack', maul: 'dreizack',
  gabel: 'spulen', ring: 'ring', kugel: 'ring', rune: 'ring', auge: 'auge', schaedel: 'auge',
};
export function fixWeapon(w) {
  const s = w?.s;
  if (!s) return w;
  if (!TYPES[s.type]) s.type = 'staff';
  if (!MAKERS[s.maker]) s.maker = Object.keys(MAKERS)[0];
  s.element = ELEMENT_REPLACE[s.element] ?? s.element;
  if (!ELEMENTS[s.element]) s.element = 'none';
  if (!HEADS[s.head]) s.head = HEAD_REPLACE[s.head] ?? TYPES[s.type].heads[0];
  return w;
}
export const meta = load();
export const saveMeta = () => { if (!saveBlocked) write(KEYS.meta, meta); };

// ---------- Erfolge ----------
export const hasAch = (id: string) => meta.achievements.includes(id);
// true, wenn neu (dann zeigt der Aufrufer die Einblendung)
export function grantAch(id: string) { if (hasAch(id)) return false; meta.achievements.push(id); saveMeta(); return true; }

// ---------- Meilensteine (Kosmetik ⭐, gear.ts LOOKS ach) ----------
// Vorhanden war: meta.dust (nur Kontostand), player.kills und run.kills (nur im Run), boss.stats.hits (Treffer im Bosskampf, bosses/core.ts).
// Neu: meta.stats.kills (Kills gesamt, mobs.ts killMob) und meta.stats.dust (erspielter Staub gesamt, earnDust). Grenzen alle // PH
export const MILESTONES = { dust10k: 10000, kills1k: 1000, lvl100: 100 };   // lvl100 = LEVEL_MAX (config.ts), hier als Zahl: meta.ts läuft in Import-Kreisen vor config.ts
// Neuer Meilenstein → Bus ach (hooks.ts) → Einblendung (ui/achievements.ts); das Kosmetik-Teil ist damit frei (gear.ts hasLook)
export function milestone(id: string, quiet = false) { if (grantAch(id) && !quiet) emit('ach', id); }
export function checkMilestones(quiet = false) {
  const s = meta.stats;
  if (s.dust >= MILESTONES.dust10k) milestone('dust10k', quiet);
  if (s.kills >= MILESTONES.kills1k) milestone('kills1k', quiet);
}
// Staub aus dem Spiel (Run-Ende, Boss, Aufheben, Funde): Kontostand und Zähler. Nicht für Zerlegen (Rückgabe) und Dev. Speichern macht der Aufrufer
export function earnDust(n: number) { meta.dust += n; meta.stats.dust += n; checkMilestones(); }
// Jeder Kill (mobs.ts killMob). Gespeichert wird mit dem nächsten saveMeta (Run-Ende, Aufheben), nicht bei jedem Kill
export function countKill() { meta.stats.kills++; if (meta.stats.kills === MILESTONES.kills1k) checkMilestones(); }
// Dev: Zähler setzen (Test der Meilensteine)
export function devSetStats(o: { kills?: number; dust?: number }) { Object.assign(meta.stats, cleanStats({ ...meta.stats, ...o })); checkMilestones(); saveMeta(); }

// ---------- Skins ----------
export const skinUnlocked = (heroClass: HeroClass, id: SkinId) => { const lock = skinLock(heroClass, id); return !lock || hasAch(setAch(lock)); };
// Gültiger Skin der Figur: gespeicherte Wahl, wenn sie zur Waffe (Krieger) bzw. Schule (Magier) passt und frei ist, sonst Standard
export function skinOf(heroClass: HeroClass, need?: string | null): SkinId {
  const id = meta.skins?.[heroClass];
  return skinsFor(heroClass, need).some(s => s.id === id) && skinUnlocked(heroClass, id) ? id : STANDARD;
}
export function pickSkin(heroClass: HeroClass, id: SkinId) { if (!skinUnlocked(heroClass, id)) return; meta.skins = cleanSkins({ ...meta.skins, [heroClass]: id }); saveMeta(); }

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
  if (!completed) return 0;
  return n === 0 ? s.packsTier : s.packsOneModTier + n - 1;
}
export function awardDust(completed) {
  const tier = shopTier(completed);
  const bonus = tier ? Math.round(META.dust.doneBonusAtTier3 * tier / 3) : 0;
  const base = Math.round(player.level * META.dust.perLevel * scoreMult());
  const dust = base + bonus;
  earnDust(dust);
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
export function devReset() { Object.assign(meta, { dust: 0, unlocked: [], bought: {}, bestTier: 0, offer: [], inv: [], equipped: null, nextWeapon: 0, skins: {}, achievements: [], gear: {}, wear: {}, gearOver: [], nextGear: 0, looks: [], lookWear: {}, stats: cleanStats(null) }); saveMeta(); }
