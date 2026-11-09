// Mob-Kategorien (map-umbau Phase 7): Ein Mob = Kategorie (Verhalten + Grundwerte) + Zusatz + Theme-Skin (Modell + Name).
// Kategorien und Zusätze gibt es einmal (Verhalten in abilities.ts: k_* und ZUSATZ), die Themes liefern nur Skins (models/mobSkins.ts).
// Schnittstelle zum Map-Generator: spawnPack(spot, theme, level) würfelt ein Pack und spawnt es um spot.
// Schwierigkeit des Themes (Leben/Schaden) wendet der Generator zentral an, hier nicht. Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from './state';
import { $, rand, randInt, pick, clamp, dist2d } from './util';
import { CFG, LEVEL_UNLOCKS, LEVEL_PACK_SPREAD } from './config';
import { camera } from './render';
import { spawnMob, enterCombat, onMobDeath, removeMob, damageMob, hitPlayer, rollPackSize } from './mobs';
import { zone } from './world';
import { ABILITIES, ZUSATZ, breakShield, telegraph } from './abilities';
import { rollChampionPack, makeChampion } from './champions';
import { schedule } from './spells/core';
import { burstFx } from './spells/fx';
import { addEffect } from './fx/spellFx';
import { strichMob } from './models/strichMob';
import { SKINS, TEST_SKINS } from './models/mobSkins';
import { t } from './i18n';
import type { PackSpot, ThemeId, ThemeInfo } from './mapgen/types';

// Kategorien relativ zu Normal: Leben, Schaden, Tempo, XP, Fähigkeit (abilities.ts). flee: nur der Hexer flieht
export const KINDS: Record<string, { hp: number; dmg: number; spd: number; xp: number; ability: string | null; flee?: boolean }> = {
  normal:   { hp: 1,   dmg: 1,   spd: 1,   xp: 1,   ability: null },
  schnell:  { hp: 0.6, dmg: 0.7, spd: 1.4, xp: 0.8, ability: 'k_schnell' },
  stark:    { hp: 1.8, dmg: 1.6, spd: 0.8, xp: 1.8, ability: 'k_stark' },
  aoe:      { hp: 1.3, dmg: 1.2, spd: 0.9, xp: 1.5, ability: 'k_aoe' },
  zauberer: { hp: 0.7, dmg: 1.1, spd: 1,   xp: 1.2, ability: 'k_zauberer' },
  werfer:   { hp: 0.8, dmg: 0.8, spd: 1,   xp: 1,   ability: 'k_werfer' },
  hexer:    { hp: 0.7, dmg: 1.1, spd: 1,   xp: 1.3, ability: 'k_hexer', flee: true },
  gross:    { hp: 5,   dmg: 2.5, spd: 0.7, xp: 8,   ability: 'k_gross' },
  lauerer:  { hp: 1,   dmg: 1.5, spd: 1.2, xp: 3,   ability: 'k_lauerer' },
};
export const KIND_IDS = Object.keys(KINDS);
export const ZUSATZ_IDS = ['heal', 'shield', 'haste', 'fliegt', 'platzt', 'teilt'];
const SUPPORT = ['heal', 'shield', 'haste'];           // höchstens 1 pro Pack
// Freischalten über die Level wie pickMobType: am Anfang Normal + 2, ab jedem LEVEL_UNLOCKS-Level eine mehr
export const UNLOCK_ORDER = ['normal', 'schnell', 'werfer', 'stark', 'zauberer', 'aoe', 'hexer'];
export const THEME_DIFF: Record<ThemeId, 1 | 2 | 3 | 4 | 5> = { wald: 1, wueste: 2, kanaele: 3, kathedrale: 4, hoelle: 5 };

const P = {
  special: [0.25, 0.5],       // Anteil Nicht-Normale im Pack, gewürfelt pro Pack
  zusatz: 0.15, zusatzHp: 0.7,
  big: [3, 4], bigEscort: 0.5,   // Groß: 1 pro 3–4 Packs, mit 50 % 2 Normale dabei
  lurkPerMin: 0.1, lurkDiff: 3, lurkDist: 6,
  burst: { r: 4, warnMs: 500, dmg: 1.5 },
  split: { n: 2, hp: 0.2, xp: 0.3, size: 0.55 },
  pillarMs: 1600,
};

const skinOf = (theme: string, cat: string) => SKINS[theme] ? SKINS[theme][cat] ?? null : TEST_SKINS[cat] ?? null;
const hex3 = (h, k = 2) => { const c = new THREE.Color(h); return [c.r * k, c.g * k, c.b * k]; };

// Verhalten aus Kategorie + Zusatz zu einer Fähigkeit zusammengesetzt (mobs.ts kennt nur mob.ability)
function composite(cat: string, zus: string) {
  const key = `kind:${cat}:${zus}`;
  if (ABILITIES[key]) return key;
  const A = ABILITIES[KINDS[cat].ability] ?? {}, Z = ZUSATZ[zus] ?? {};
  ABILITIES[key] = {
    onCombatStart(m) { A.onCombatStart?.(m); },
    onUpdate(m, dt) { Z.onUpdate?.(m, dt); return A.onUpdate?.(m, dt) ?? false; },
    onHit(m, dmg) { A.onHit?.(m, dmg); },
    onDamaged(m, amount, source) {
      if (m.kindShield) { breakShield(m); return 0; }   // Schild hält genau 1 Treffer
      if (Z.onDamaged) amount = Z.onDamaged(m, amount, source);
      return A.onDamaged ? A.onDamaged(m, amount, source) : amount;
    },
  };
  return key;
}

// Mob-Typ für spawnMob (typeOverride), pro Theme × Kategorie × Zusatz × Größe einmal
const types = new Map();
function kindType(theme: string, cat: string, zus: string, size = 1) {
  const id = `${theme}|${cat}|${zus}|${size}`;
  if (types.has(id)) return types.get(id);
  const def = skinOf(theme, cat), K = KINDS[cat];
  if (!def) return null;
  const type = {
    name: SKINS[theme] ? t(`mob.${theme}_${cat}.name`) : t(`kind.${cat}.name`),
    build: strichMob(def[0], def[1], zus, size), ability: composite(cat, zus),
    hpMul: K.hp * (zus !== 'none' ? P.zusatzHp : 1), dmgMul: K.dmg, speedMul: K.spd,
    rootImmune: zus === 'fliegt', fleeChance: 0,   // keine Panik-Flucht bei wenig Leben; der Hexer flieht über k_hexer (KINDS.flee)
    gl: def[1].gl,
  };
  types.set(id, type);
  return type;
}

// Ein Mob: Kategorie + Zusatz + Skin des Themes. size < 1: kleine Kopie (Zusatz „teilt“)
export function spawnKind(theme: string, cat: string, zus: string, pos, level: number, packId: number, size = 1) {
  const type = kindType(theme, cat, zus, size);
  if (!type) return null;
  const m: any = spawnMob(`${theme}_${cat}`, pos, level, packId, type);
  m.kind = { theme, cat, zus };
  m.xpMul = KINDS[cat].xp * (size < 1 ? P.split.xp : 1);
  m.kindColor = type.gl != null ? hex3(type.gl) : null;
  if (cat === 'gross') m.knockMul = 0.5;
  if (zus === 'fliegt') { m.slowK = 2; m.flies = true; }   // flies: ignoriert Wände (mobs.ts/collision.ts) und Lava
  return m;
}

// Pack-Zusammensetzung: Normal + 1–2 andere freigeschaltete Kategorien
const unlockedKinds = level => UNLOCK_ORDER.slice(0, 3 + LEVEL_UNLOCKS.filter(l => level >= l).length);
// Packgröße wie bei den alten Packs (mobs.ts rollPackSize: Level, Zonen-Bonus, Modifikatoren)
const packSize = () => Math.max(2, Math.round(rollPackSize()));
export function rollPackCats(level: number, size = packSize()) {
  const others = unlockedKinds(level).slice(1), chosen: string[] = [];
  const nCats = Math.min(others.length, randInt(1, 2));
  while (chosen.length < nCats) { const c = pick(others); if (!chosen.includes(c)) chosen.push(c); }
  const nSpecial = clamp(Math.round(size * rand(P.special[0], P.special[1])), 1, size - 1);
  const cats = Array.from({ length: size }, (_, i) => i < nSpecial ? chosen[i % chosen.length] : 'normal');
  return cats.sort(() => Math.random() - 0.5);
}
// Zusatz pro Mob: ~15 %, höchstens 1 Unterstützer (heal/shield/haste) pro Pack
export function rollZusatz(cats: string[]) {
  let support = false;
  return cats.map(c => {
    if (c === 'lauerer' || Math.random() >= P.zusatz) return 'none';
    const z = pick(support ? ZUSATZ_IDS.filter(z => !SUPPORT.includes(z)) : ZUSATZ_IDS);
    if (SUPPORT.includes(z)) support = true;
    return z;
  });
}

function placeGroup(spot: PackSpot, theme: string, level: number, cats: string[], zus: string[], champ = null) {
  const packId = ++state.packCounter, spread = Math.min(Math.max(spot.r, 2), Math.max(LEVEL_PACK_SPREAD, Math.sqrt(cats.length) * 1.5));
  const out = [];
  cats.forEach((cat, i) => {
    const pos = new THREE.Vector3(spot.x, 0, spot.z);
    for (let tries = 0; tries < 6; tries++) {         // nur auf freiem Boden (zone.spawnOk), sonst Mitte des Platzes
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * spread, x = spot.x + Math.cos(a) * r, z = spot.z + Math.sin(a) * r;
      if (zone.spawnOk?.(x, z) ?? true) { pos.set(x, 0, z); break; }
    }
    const lvl = Math.max(1, level + [-1, 0, 0, 1, 1, 2][randInt(0, 5)]);
    const m = spawnKind(theme, cat, zus[i] ?? 'none', pos, lvl, packId);
    if (!m) return;
    if (champ) { makeChampion(m, champ); m.xpMul *= KINDS[cat].xp; }   // Champion-Affixe bleiben wie sie sind, Zusatz kommt dazu
    out.push(m);
  });
  return out;
}

// Groß-Zähler und Lauerer-Uhr laufen über alle Packs
const big = { count: 0, next: randInt(P.big[0], P.big[1]) };
const lurk = { last: null as number | null };
const history: string[] = [];   // letzte Packs (Dev/Tests): 'gross' oder 'pack'

export function spawnPack(spot: PackSpot, theme: ThemeInfo, level: number): void {
  rollLurker(theme, level);
  const champ = rollChampionPack();
  if (++big.count >= big.next) {
    big.count = 0; big.next = randInt(P.big[0], P.big[1]);
    const cats = Math.random() < P.bigEscort ? ['gross', 'normal', 'normal'] : ['gross'];
    history.push('gross'); if (history.length > 100) history.shift();
    placeGroup(spot, theme.id, level, cats, rollZusatz(cats), champ);
    return;
  }
  const cats = rollPackCats(level);
  history.push('pack'); if (history.length > 100) history.shift();
  placeGroup(spot, theme.id, level, cats, rollZusatz(cats), champ);
}

// Lauerer: höchstens 1, 10 % pro Minute, erst ab Schwierigkeit 3. Die Uhr läuft zwischen zwei Pack-Spawns
function rollLurker(theme: ThemeInfo, level: number) {
  if (lurk.last == null || state.now < lurk.last - 3600000) lurk.last = state.now;   // neuer Run: Uhr neu
  const min = (state.now - lurk.last) / 60000;
  lurk.last = state.now;
  if (theme.difficulty < P.lurkDiff || !skinOf(theme.id, 'lauerer')) return;
  if (state.mobs.some(m => !m.dead && m.kind?.cat === 'lauerer')) return;
  if (Math.random() < 1 - Math.pow(1 - P.lurkPerMin, min)) spawnLurker(theme.id, level);
}
// Taucht 6 yd hinter dir auf (von der Kamera aus gesehen)
export function spawnLurker(theme: string, level: number) {
  const fx = player.pos.x - camera.position.x, fz = player.pos.z - camera.position.z, l = Math.hypot(fx, fz) || 1;
  const pos = new THREE.Vector3(player.pos.x - fx / l * P.lurkDist, player.pos.y, player.pos.z - fz / l * P.lurkDist);
  const m = spawnKind(theme, 'lauerer', 'none', pos, level, ++state.packCounter);
  if (m) enterCombat(m, false);
  return m;
}

// Tod: Platzt (Explosion 4 yd, Ring 0,5 s vorher), Teilt (2 kleine), Groß (Lichtsäule)
onMobDeath(m => {
  if (!m.kind) return;
  const { theme, cat, zus } = m.kind, pos = m.pos.clone();
  if (m.kindShield) breakShield(m);
  m.healCast = null;
  if (zus === 'platzt') {
    const B = P.burst;
    telegraph(pos, B.r, [2.4, 0.3, 0.15], B.warnMs);
    schedule(B.warnMs, () => {
      burstFx(pos, B.r, [[2.4, 0.5, 0.15], [1.6, 0.25, 0.1]], 0xff5a30);
      if (!player.dead && dist2d(player.pos, pos) <= B.r) hitPlayer(m, B.dmg);   // über hitPlayer: Theme-Schwierigkeit (dmgMulT) gilt
    });
  }
  if (zus === 'teilt') schedule(150, () => {
    for (let i = 0; i < P.split.n; i++) {
      const a = i / P.split.n * Math.PI * 2 + rand(0, 1), p = new THREE.Vector3(pos.x + Math.cos(a) * 1.2, pos.y, pos.z + Math.sin(a) * 1.2);
      const c = spawnKind(theme, cat, 'none', p, m.level, m.packId, P.split.size);
      if (!c) continue;
      c.hp = c.maxHp = Math.max(1, Math.round(m.maxHp * P.split.hp));
      enterCombat(c, false);
    }
  });
  if (cat === 'gross') lightPillar(pos);
});
function lightPillar(pos) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  mesh.position.set(pos.x, pos.y + 15, pos.z);
  addEffect(mesh, P.pillarMs, k => { mesh.material.opacity = 0.7 * (1 - k); mesh.scale.set(1 + k * 0.6, 1, 1 + k * 0.6); });
}

// ───────── Dev: Pack spawnen, Kategorie × Zusatz × Theme (Theme nur als Skin-Wahl, die Map bleibt)
const opt = (v, label) => `<option value="${v}">${label}</option>`;
const DE = { normal: 'Normal', schnell: 'Schnell', stark: 'Stark', aoe: 'AoE', zauberer: 'Zauberer', werfer: 'Werfer', hexer: 'Hexer', gross: 'Groß', lauerer: 'Lauerer' };
const ZDE = { heal: 'Heilen', shield: 'Schild', haste: 'Tempo', fliegt: 'Fliegt', platzt: 'Platzt', teilt: 'Teilt' };
$('devZones').insertAdjacentHTML('afterend', `<div id="devKinds">
  <select class="bindBtn" id="devKTheme">${Object.keys(THEME_DIFF).map(k => opt(k, k)).join('')}${opt('test', 'test')}</select>
  <select class="bindBtn" id="devKCat">${opt('regeln', 'Pack nach Regeln')}${KIND_IDS.map(k => opt(k, DE[k])).join('')}</select>
  <select class="bindBtn" id="devKZus">${opt('zufall', 'Zusatz: Regeln')}${opt('none', 'kein Zusatz')}${ZUSATZ_IDS.map(k => opt(k, ZDE[k])).join('')}</select>
  <select class="bindBtn" id="devKN">${[1, 3, 6].map(n => opt(n, `× ${n}`)).join('')}</select>
  <button class="bindBtn" id="devKSpawn">Pack spawnen</button></div>`);
const val = id => ($(id) as HTMLSelectElement).value;
// Vor dem Spieler (Blickrichtung der Kamera), 12 yd
export function devSpot(dist = 12): PackSpot {
  const fx = player.pos.x - camera.position.x, fz = player.pos.z - camera.position.z, l = Math.hypot(fx, fz) || 1;
  return { x: player.pos.x + fx / l * dist, z: player.pos.z + fz / l * dist, r: 4 };
}
export function devSpawn(theme: string, cat: string, zus: string, n = 1, spot = devSpot()) {
  const info: ThemeInfo = { id: theme as ThemeId, difficulty: THEME_DIFF[theme] ?? 3 };
  if (cat === 'regeln') return spawnPack(spot, info, player.level);
  if (cat === 'lauerer') return spawnLurker(theme, player.level);
  const cats = Array(n).fill(cat), z = zus === 'zufall' ? rollZusatz(cats) : cats.map(() => zus);
  return placeGroup(spot, theme, player.level, cats, z);
}
$('devKSpawn').addEventListener('click', () => devSpawn(val('devKTheme'), val('devKCat'), val('devKZus'), +val('devKN')));
(window as any).__kinds = { spawnMob, removeMob, damageMob, enterCombat, camera, spawnPack, spawnKind, spawnLurker, devSpawn, devSpot, rollPackCats, rollZusatz, KINDS, big, lurk, history, P, CFG };
