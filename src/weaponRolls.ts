// Mage-Waffen aus der Magischen Kiste, gewürfelt aus Schichten (Konzept „Magier-Waffen“, Viewer „Waffen-Baukasten“):
// Typ → Silhouette und Regel, Kopf → Fokus-Spell (Form zeigt die Schule), Schaft → Hauptwert, Element → Treffer-Effekt, Hersteller → Material und Eigenheit,
// Seltenheit → Stärke (×0,5 … ×5), ab lila ein Anhänger mit Zweitwert, orange ein Unikat-Modell (die alten 14 Waffen).
// Wirkung über vorhandene Wege: mods, stat(id), Pool, ein Treffer-Hook in damageMob. Nur Magier-Modi. Grundregel: nur erspielter Staub.

import { state, player } from './state';
import { SPELLS, CARD_RARITIES, mods } from './config';
import { meta, saveMeta } from './meta';
import { stat, tagsAllowed, applySlow, schedule } from './spells/core';
import { boltFx } from './spells/fx';
import * as THREE from 'three';
import { maxHp, maxMana, dmgMult } from './formulas';
import { ringFx } from './fx/spellFx';
import { WEAPONS } from './models/weapons/defs';
import { buildWeapon } from './models/weapons/index';
import { TYPES, HEADS, SHAFTS, ELEMENTS, MAKERS, EXTRAS, weaponNameOf, buildBaukastenWeapon } from './models/weapons/baukasten';
import { pick, dist2d } from './util';

// Alle Zahlen PH. Seltenheit: Index in CARD_RARITIES (grau 0 … orange 5), der Faktor kommt von dort (×0,5 … ×5)
export const ROLLS = {
  price: 120, invMax: 15,
  weights: [5, 20, 35, 25, 11, 4],                     // grau, weiß, grün, blau, lila, orange
  refund: [5, 10, 15, 25, 40, 60],
  types: ['staff', 'wand', 'book', 'relic'],          // alle vier Typen, ohne Nebenhand liegen Buch und Relikt in der Waffenhand (Kevin 2026-11-03)
  typeRule: { staff: { radius: 0.1, cast: 0.1 }, wand: { cast: -0.15, cd: -0.05, radius: -0.1 }, book: { charges: 1, manaCost: -0.1 }, relic: { dur: 0.1, aura: true } },
  aura: { everyMs: 3000, radius: 6, dmg: 20, share: 0.3 },   // Relikt: Puls mit dem Element-Effekt, Schaden × Level-Faktor, Chance × share
  focus: { dmg: 0.08, radius: 0.04 },                  // Kopf: Fokus-Spell, bei weiß
  values: { dmg: 0.03, crit: 0.02, cd: 0.03, mana: 0.05, hp: 0.05, regen: 0.03, speed: 0.02, radius: 0.03, dur: 0.05 },   // Schaft, bei weiß; Anhänger halb
  elementChance: [0, 0.25, 0.5, 1, 1, 1],              // Anteil der Waffen mit Element je Seltenheit
  procChance: 0.05,                                    // Element-Effekt pro Treffer bei weiß, × Seltenheit
  element: { slow: 0.2, slowMs: 2000, burn: 0.3, burnTicks: 3, mana: 0.02, chainMul: 0.4, chainN: 3, chainYd: 6, pullYd: 4, pull: 1,
    poisonMax: 5, poisonPct: 0.02, poisonMs: 5000, darkMul: 0.3, darkHeal: 0.2 },
  maker: { grab: { dmg: 0.1, cast: 0.1 }, stern: { crit: 0.05, critMana: 0.01 }, morra: { dur: 0.15, random: 0.05 }, vey: { cd: -0.05, mana: 0.1 }, brandt: { hp: 0.1, lifesteal: 0.02 } },
  notForMages: ['schlachtblech'],                      // Standardwaffe des Strichkriegers
  fallback: 'pilgerast',                               // leeres Inventar: Pilgerast ohne Effekt
};
// Die 20 Magier-Spells für den Kopf-Fokus, je Schule
export const FOCUS_SPELLS = ['nova', 'ae', 'bliz', 'coc', 'blink', 'flame', 'blast', 'hellfire', 'hurricane', 'frostorb', 'chain', 'voidorb', 'whirl', 'arc', 'icelance', 'glacier', 'fireball', 'meteor', 'barrage', 'surge'];
const VALUE_KEY = { Schaden: 'dmg', Crit: 'crit', Abklingzeit: 'cd', Mana: 'mana', Leben: 'hp', 'Regen im Kampf': 'regen', Lauftempo: 'speed', Radius: 'radius', Dauereffekte: 'dur' };
// Regel-Text der Typen, wie sie im Spiel wirken (der Viewer nennt beim Stab noch „Kanäle +1 Tick“, das ist nicht gebaut)
const TYPE_TEXT = { staff: 'Radius +10 %, Zauberzeit +10 %', wand: 'Zauberzeit −15 %, Abklingzeit −5 %, Radius −10 %', book: '+1 Ladung auf den Fokus-Spell, Manakosten −10 %', relic: 'Aura alle 3 s in 6 yd mit dem Element-Effekt, Dauereffekte +10 %' };
const VALUE_TEXT = Object.fromEntries(Object.entries(VALUE_KEY).map(([t, k]) => [k, t]));

const factor = tier => CARD_RARITIES[tier].mult;
const pct = v => `${v < 0 ? '−' : '+'}${String(Math.round(Math.abs(v) * 1000) / 10).replace('.', ',')} %`;
const isNew = w => w.v === 2;

function rollTier() {
  let r = Math.random() * ROLLS.weights.reduce((a, b) => a + b, 0);
  for (let t = 0; t < ROLLS.weights.length; t++) { r -= ROLLS.weights[t]; if (r < 0) return t; }
  return 0;
}
// Reihenfolge wie im Konzept: Seltenheit, Typ, Hersteller, Kopf (+ Fokus-Spell der Schule), Schaft, Element, Anhänger
export function rollWeapon() {
  const r = rollTier(), t = pick(ROLLS.types), head = pick(TYPES[t].heads), school = HEADS[head][1];
  const value = pick(Object.keys(VALUE_KEY)), shaft = Object.keys(SHAFTS).find(k => SHAFTS[k].values.includes(value));
  const els = Object.keys(ELEMENTS).filter(e => e !== 'none');
  const s: any = {
    seed: Math.floor(Math.random() * 1e9), rarity: r, type: t, maker: pick(Object.keys(MAKERS)), head, shaft, value,
    focus: pick(FOCUS_SPELLS.filter(id => SPELLS[id]?.tags.includes(school))),
    element: Math.random() < ROLLS.elementChance[r] ? pick(els) : 'none',
    extra: r >= 4 ? pick(Object.keys(EXTRAS)) : 'none', value2: pick(Object.keys(VALUE_KEY)),
  };
  if (r === 5) s.unique = pick(WEAPONS.filter(w => !ROLLS.notForMages.includes(w.id))).id;   // Unikat: eins der alten Modelle
  return { id: ++meta.nextWeapon, v: 2, r, s };
}

// Text: alte Waffen (e, m) wie bisher, neue aus den Schichten
const oldModelName = id => WEAPONS.find(x => x.id === id)?.name ?? id;
export function effectLines(w) {
  const f = factor(w.r);
  if (!isNew(w)) {
    if (w.e.startsWith('f:')) return [`Fokus ${SPELLS[w.e.slice(2)].name}: ${pct(ROLLS.focus.dmg * f)} Schaden, ${pct(ROLLS.focus.radius * f)} Radius`];
    return [`${pct((w.e === 'cd' ? -1 : 1) * ROLLS.values[w.e] * f)} ${VALUE_TEXT[w.e]}`];
  }
  const s = w.s, k = VALUE_KEY[s.value], k2 = VALUE_KEY[s.value2], el = ELEMENTS[s.element];
  const lines = [`${TYPES[s.type].name}: ${TYPE_TEXT[s.type]}`];
  if (w.r >= 1) lines.push(`Fokus ${SPELLS[s.focus].name}: ${pct(ROLLS.focus.dmg * f)} Schaden, ${pct(ROLLS.focus.radius * f)} Radius`);
  lines.push(`${pct((k === 'cd' ? -1 : 1) * ROLLS.values[k] * f)} ${s.value}`);
  if (s.element !== 'none') lines.push(`${el.name}: ${el.fx}, ${pct(ROLLS.procChance * f).slice(1)} pro Treffer`);
  lines.push(`${MAKERS[s.maker].name}: ${MAKERS[s.maker].trait}`);
  if (s.extra !== 'none') lines.push(`${EXTRAS[s.extra]}: ${pct((k2 === 'cd' ? -1 : 1) * ROLLS.values[k2] * f / 2)} ${s.value2}`);
  if (s.unique) lines.push(`Unikat: ${oldModelName(s.unique)}`);
  return lines;
}
export const effectText = w => effectLines(w).join(' · ');
export const weaponName = w => !isNew(w) ? `${oldModelName(w.m)} · ${effectText(w)}` : w.s.unique ? `${oldModelName(w.s.unique)} ${MAKERS[w.s.maker].gen}` : weaponNameOf(w.s);
export const rarityOf = w => CARD_RARITIES[w.r];

export const equipped = () => meta.inv.find(w => w.id === meta.equipped) ?? null;
// Modell der gewählten Waffe: neue aus dem Baukasten, Unikate und alte Waffen aus models/weapons
export function buildEquipped() {
  const w = equipped();
  if (!w) return buildWeapon(ROLLS.fallback);
  if (!isNew(w)) return buildWeapon(w.m);
  return w.s.unique ? buildWeapon(w.s.unique) : buildBaukastenWeapon(w.s);
}
export const inventoryFull = () => meta.inv.length >= ROLLS.invMax;

export function buyChest() {
  if (inventoryFull() || meta.dust < ROLLS.price) return null;
  meta.dust -= ROLLS.price;
  const w = rollWeapon();
  meta.inv.push(w);
  saveMeta();
  return w;
}
export function deleteWeapon(id) {
  const w = meta.inv.find(x => x.id === id);
  if (!w) return;
  meta.inv = meta.inv.filter(x => x !== w);
  meta.dust += ROLLS.refund[w.r];
  if (meta.equipped === id) meta.equipped = null;
  saveMeta();
}
export function equip(id) { meta.equipped = id; saveMeta(); }
// Dev: Inventar bis zum Limit mit Waffen aus der Kiste füllen, ohne Staub; leeren ohne Rückgabe
export function devFillInventory() {
  while (!inventoryFull()) meta.inv.push(rollWeapon());
  saveMeta();
}
export function devClearInventory() {
  meta.inv = [];
  meta.equipped = null;
  saveMeta();
}

// Werte auf mods/stat. cd und cast sind Anteile (−0,05 = 5 % weniger)
function applyValue(key, v) {
  if (key === 'dmg') mods.dmg += v;
  if (key === 'crit') mods.crit += v;
  if (key === 'cd') mods.cdMul = Math.max(0.1, mods.cdMul - v);
  if (key === 'mana') mods.manaMult += v;
  if (key === 'hp') mods.hpMult += v;
  if (key === 'regen') mods.castRegen += v;
  if (key === 'speed') mods.moveMul += v;
  if (key === 'radius') mods.radius += v;
  if (key === 'dur') mods.durMul += v;
}
function applyFocus(id, f) {
  const s = stat(id);
  s.dmg += ROLLS.focus.dmg * f;
  s.radius += ROLLS.focus.radius * f;
  if (!tagsAllowed(SPELLS[id].tags)) state.poolExtra.push(id);   // für diesen Run in den Pool
}

// Run-Start, nach resetSpells: Waffe anwenden. Nahkämpfer tragen keine.
export function applyRunWeapon(magier) {
  state.poolExtra = [];
  state.runWeapon = '';
  state.weaponHit = null;
  state.bonusCharges = {};
  state.weaponAura = null;
  const w = magier ? equipped() : null;
  if (!w) return;
  const f = factor(w.r);
  state.runWeapon = `${weaponName(w)} (${rarityOf(w).name})`;
  if (!isNew(w)) {                                              // alte Waffe: ein Effekt
    if (w.e.startsWith('f:')) applyFocus(w.e.slice(2), f);
    else applyValue(w.e, ROLLS.values[w.e] * f * (w.e === 'cd' ? 1 : 1));
    return;
  }
  const s = w.s, T = ROLLS.typeRule[s.type], M = ROLLS.maker[s.maker];
  if (T.radius) mods.radius += T.radius;
  if (T.cast) mods.castMul += T.cast;
  if (T.cd) applyValue('cd', -T.cd);
  if (T.charges && w.r >= 1) state.bonusCharges = { [s.focus]: T.charges };   // Buch: +1 Ladung auf den Fokus-Spell
  if (T.manaCost) mods.manaCostMul += T.manaCost;
  if (T.dur) mods.durMul += T.dur;
  if (T.aura && s.element !== 'none') state.weaponAura = { el: s.element, f, next: state.now + ROLLS.aura.everyMs, M };
  if (w.r >= 1) applyFocus(s.focus, f);
  applyValue(VALUE_KEY[s.value], ROLLS.values[VALUE_KEY[s.value]] * f);
  if (s.extra !== 'none') applyValue(VALUE_KEY[s.value2], ROLLS.values[VALUE_KEY[s.value2]] * f / 2);
  if (M.dmg) mods.dmg += M.dmg;
  if (M.cast) mods.castMul += M.cast;
  if (M.crit) mods.crit += M.crit;
  if (M.dur) mods.durMul += M.dur;
  if (M.random) applyValue(pick(Object.values(VALUE_KEY)), M.random);
  if (M.cd) applyValue('cd', -M.cd);
  if (M.mana) mods.manaMult += M.mana;
  if (M.hp) mods.hpMult += M.hp;
  const chance = s.element === 'none' ? 0 : ROLLS.procChance * f;
  if (chance || M.lifesteal || M.critMana) state.weaponHit = (m, dmg, crit, api) => weaponHit(m, dmg, crit, api, s.element, chance, M);
}

// Treffer-Hook aus damageMob (nur Spell-Treffer des Spielers). api: Funktionen aus mobs.ts, damit hier kein Import-Kreis entsteht
const E = ROLLS.element;
function weaponHit(m, dmg, crit, api, el, chance, M) {
  if (M.lifesteal) player.hp = Math.min(maxHp(), player.hp + dmg * M.lifesteal);
  if (M.critMana && crit && !player.rageMax) player.mana = Math.min(maxMana(), player.mana + maxMana() * M.critMana);
  if (!chance || Math.random() >= chance) return;
  if (el === 'frost' && !m.dead) applySlow(m, E.slow, E.slowMs);
  if (el === 'feuer') for (let i = 1; i <= E.burnTicks; i++) schedule(i * 1000, () => { if (!m.dead) api.burnMob(m, Math.max(1, Math.round(dmg * E.burn / E.burnTicks))); });
  if (el === 'arkan' && !player.rageMax) player.mana = Math.min(maxMana(), player.mana + maxMana() * E.mana);
  if (el === 'blitz') {
    const next = state.mobs.filter(o => !o.dead && o !== m && dist2d(o.pos, m.pos) <= E.chainYd).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos)).slice(0, E.chainN);
    for (const o of next) { boltFx(m.pos, o.pos, [2.4, 2.2, 0.8]); api.burnMob(o, Math.max(1, Math.round(dmg * E.chainMul))); }
  }
  if (el === 'void') for (const o of state.mobs) if (!o.dead && o !== m && dist2d(o.pos, m.pos) <= E.pullYd) api.pullMob(o, m.pos, E.pull);
  if (el === 'gift' && !m.dead) {
    const p = m.wPoison ??= { stacks: 0, until: 0 };
    const running = p.until > state.now;
    p.stacks = Math.min(E.poisonMax, p.stacks + 1);
    p.until = state.now + E.poisonMs;
    if (!running) { const tick = () => { if (m.dead || state.now > p.until) { p.stacks = 0; return; } api.burnMob(m, Math.max(1, Math.round(m.maxHp * E.poisonPct * p.stacks))); schedule(1000, tick); }; schedule(1000, tick); }
  }
  if (el === 'dunkel' && !m.dead) {
    const extra = Math.max(1, Math.round(dmg * E.darkMul));
    api.burnMob(m, extra);                                       // fester Schaden ohne Wurf und Rüstung wie Dunkel
    player.hp = Math.min(maxHp(), player.hp + extra * E.darkHeal);
  }
}

// Relikt: alle 3 s ein Puls um den Spieler, jeder Mob darin bekommt den Element-Effekt mit der Puls-Chance (einmal pro Frame aus updatePlayer)
export function updateWeaponAura(api) {
  const a = state.weaponAura, A = ROLLS.aura;
  if (!a || player.dead || state.now < a.next) return;
  a.next = state.now + A.everyMs;
  const dmg = A.dmg * dmgMult();
  ringFx(player.pos, A.radius, auraColor(a.el), 400);
  for (const m of state.mobs) if (!m.dead && dist2d(m.pos, player.pos) <= A.radius) weaponHit(m, dmg, false, api, a.el, 1, a.M);
}
const auraColor = el => { const c = new THREE.Color(ELEMENTS[el].color); return [c.r * 1.6, c.g * 1.6, c.b * 1.6]; };
