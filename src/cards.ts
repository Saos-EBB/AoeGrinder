// Kartenarten, Seltenheit, Glück. Zahlen in config.ts unter CARD_*.

import { state, player } from './state';
import { pick } from './util';
import { dmgMult, manaCost } from './formulas';
import { modFactor } from './modifiers';
import { SPELLS, CARDS, CARD_RARITIES, CARD_KIND_WEIGHTS, CARD_RANK, CARD_SPELL_DMG, CARD_LUCK, CARD_COUNT, CARD_RELIC_LEVEL } from './config';
import { stat, hasSpell, hasTag, tagsAllowed, spellAllowed, modRule, runesOf } from './spells/core';
import { SUPPORTS } from './spells/supports';
import { isUnlocked } from './meta';

const pct = v => `${Math.round(v * 100)} %`;
const num = v => String(v).replace('.', ',');

const RANK_TEXT = {
  dmg: (name, m) => `${name}: +${pct(CARD_RANK.dmg * m)} Schaden.`,
  mana: (name, m) => `${name}: −${pct(CARD_RANK.mana * m)} Mana.`,
  radius: (name, m) => `${name}: +${pct(CARD_RANK.radius * m)} Radius.`,
  tempo: (name, m) => `${name}: +${pct(CARD_RANK.tempo * m)} Tempo.`,
};
const RANK_APPLY = {
  dmg: (s, m) => { s.dmg += CARD_RANK.dmg * m; },
  mana: (s, m) => { s.mana = Math.max(0.1, s.mana - CARD_RANK.mana * m); },   // PH: Untergrenze
  radius: (s, m) => { s.radius += CARD_RANK.radius * m; },
  tempo: (s, m) => { s.tempo = (s.tempo ?? 1) + CARD_RANK.tempo * m; },   // Klingenstrich: Dauer der Aktion
};

function rankCards() {
  const list = [];
  for (const id of state.slots) {
    if (!id || !spellAllowed(id)) continue;   // Blink und Trinken bleiben im Kit, bekommen im Schul-Modus aber keine Karten
    for (const key of SPELLS[id].ranks ?? []) list.push({
      kind: 'rang', id: `rang-${id}-${key}`, spell: id, name: SPELLS[id].name, src: 'Rang',
      desc: m => RANK_TEXT[key](SPELLS[id].name, m),
      apply: m => RANK_APPLY[key](stat(id), m),
    });
  }
  return list;
}

function newSpellCards() {
  return Object.keys(SPELLS).filter(id => !hasSpell(id) && !SPELLS[id].relic && !SPELLS[id].fixed && spellAllowed(id) && (!SPELLS[id].onlyMode || modRule('onlyTag') === SPELLS[id].onlyMode)).map(id => ({
    kind: 'spell', id: `spell-${id}`, learn: id, name: SPELLS[id].name, src: `Neuer Spell · ${SPELLS[id].tags.join(', ')}`,
    desc: m => `${SPELLS[id].desc} +${pct(CARD_SPELL_DMG * m)} Schaden.`,
    apply: m => { stat(id).dmg += CARD_SPELL_DMG * m; },
  }));
}

function runeCards() {
  const list = [];
  for (const id of state.slots) {
    if (!id || !spellAllowed(id)) continue;
    for (const [i, r] of (runesOf(id) ?? []).entries()) {
      const atMax = state.runes[id] === r.id && (state.cardPicks[`rune-${id}-${r.id}`] || 1) >= (r.stages ?? 1);   // stages: dieselbe Rune mehrmals
      if (atMax || !isUnlocked(`rune:${id}:${i}`)) continue;
      list.push({
        kind: 'rune', id: `rune-${id}-${r.id}`, spell: id, name: r.name, src: `Rune · ${SPELLS[id].name}`,
        desc: m => `${r.desc} +${pct(CARD_SPELL_DMG * m)} Schaden.${state.runes[id] && state.runes[id] !== r.id ? ' Ersetzt die aktive Rune.' : ''}`,
        apply: m => { state.runes[id] = r.id; stat(id).dmg += CARD_SPELL_DMG * m; },
      });
    }
  }
  return list;
}

function supportCards() {
  // Ein Support bleibt im Angebot, solange er auf einen im Modus erlaubten Spell wirkt
  const works = x => Object.keys(SPELLS).some(id => tagsAllowed(SPELLS[id].tags) && x.tags.some(t => hasTag(id, t)));
  return SUPPORTS.filter(x => !state.supports[x.id] && works(x) && isUnlocked(`support:${x.id}`)).map(x => ({
    kind: 'support', id: `support-${x.id}`, tags: x.tags, name: x.name, src: `Support · ${x.tags.join(', ')}`,
    desc: m => `${x.desc} +${pct(CARD_SPELL_DMG * m)} Schaden auf diese Spells.`,
    apply: m => {
      state.supports[x.id] = true;
      for (const id of Object.keys(SPELLS)) if (x.tags.some(t => hasTag(id, t))) stat(id).dmg += CARD_SPELL_DMG * m;
    },
  }));
}

// Nur lila oder orange, max. 1 pro Run, ab Level 30
function relicCards(forced = false) {
  if (!forced && (state.relicTaken || player.level < CARD_RELIC_LEVEL)) return [];
  return Object.keys(SPELLS).filter(id => SPELLS[id].relic && spellAllowed(id) && (forced || isUnlocked(`relic:${id}`) || state.poolExtra?.includes(id))).map(id => ({
    kind: 'relic', id: `relic-${id}`, learn: id, minTier: 4, name: SPELLS[id].name, src: `Relikt · ${SPELLS[id].tags.join(', ')}`,
    desc: m => `${SPELLS[id].desc} CD ${SPELLS[id].cd / 1000} s. +${pct(CARD_SPELL_DMG * m)} Schaden.`,
    apply: m => { state.relicTaken = true; stat(id).dmg += CARD_SPELL_DMG * m; },
  }));
}

function talentCards() {
  const allowed = c => c.only ? c.only.includes(modRule('onlyTag')) : tagsAllowed(c.tags ?? []);
  return CARDS.filter(c => (state.cardRanks[c.id] || 0) < c.max && allowed(c) && (!c.needs || hasSpell(c.needs))).map(c => {
    const rank = state.cardRanks[c.id] || 0;
    return {
      kind: 'talent', id: c.id, name: c.name, src: `Talent · Rang ${rank + 1} / ${c.max}`,
      desc: m => c.desc(rank, m),
      apply: m => { c.apply(rank, m); state.cardRanks[c.id] = rank + 1; },
    };
  });
}

function luckCards() {
  if (modRule('noLuck')) return [];
  return [{
    kind: 'luck', id: 'luck', name: 'Glück', src: 'Glück',
    desc: m => `Glück +${num(CARD_LUCK * m)}: bessere und mehr Karten.`,
    apply: m => { player.luck += CARD_LUCK * m; },
  }];
}

// Vorschau: echter Wert vorher → nachher. Die Karte selbst wird nicht angewendet, nur ihr Faktor nachgerechnet.
const BASE_HIT = s => s.tickDmg ?? (s.min ? (s.min + s.max) / 2 : s.dmg ?? s.pulse ?? s.showDmg);
export function spellValue(id, dmgBonus = 0) {
  const base = BASE_HIT(SPELLS[id]);
  return base ? Math.round(base * (stat(id).dmg + dmgBonus) * dmgMult() * modFactor('dmg')) : 0;
}
const hitUnit = s => s.tickDmg ? ' pro Tick' : '';
function dmgLine(id, bonus) {
  const s = SPELLS[id], now = spellValue(id);
  return now ? `${s.name} ${now} → ${spellValue(id, bonus)}${hitUnit(s)}` : '';
}
export function cardPreview(c, m) {
  if (c.kind === 'rang') {
    const key = c.id.split('-').pop(), s = SPELLS[c.spell];
    if (key === 'dmg') return dmgLine(c.spell, CARD_RANK.dmg * m);
    if (key === 'mana') { const v = stat(c.spell).mana; return `${s.name} Mana ${manaCost(c.spell)} → ${Math.round(manaCost(c.spell) * Math.max(0.1, v - CARD_RANK.mana * m) / v)}`; }
    if (key === 'radius' && s.radius) return `${s.name} Radius ${(s.radius * stat(c.spell).radius).toFixed(1)} → ${(s.radius * (stat(c.spell).radius + CARD_RANK.radius * m)).toFixed(1)} yd`;
    return '';
  }
  if (c.kind === 'luck') return `Glück ${player.luck} → ${player.luck + CARD_LUCK * m}`;
  const id = c.spell ?? c.learn ?? (c.tags && state.slots.find(x => x && c.tags.some(t => hasTag(x, t))));
  return id && c.kind !== 'talent' ? dmgLine(id, CARD_SPELL_DMG * m) : '';
}
// Wie oft die Karte schon gewählt wurde, Talente zählen ihren Rang
export const cardStage = c => c.kind === 'talent' ? state.cardRanks[c.id] || 0 : state.cardPicks[c.id] || 0;

const POOLS = { rang: rankCards, spell: newSpellCards, rune: runeCards, support: supportCards, relic: relicCards, talent: talentCards, luck: luckCards };

// Classic pur: ein Rang auf jeden Wert jedes Spells im Slot
export function rankAllSpells() {
  for (const id of state.slots) {
    if (!id) continue;
    for (const key of SPELLS[id].ranks ?? []) RANK_APPLY[key](stat(id), 1);
  }
}

// Gewicht je Stufe: grundgewicht × (1 + luck/100) ^ stufe
export function rollRarity(minTier = 0) {
  const tiers = CARD_RARITIES.map((r, tier) => ({ tier, w: tier < minTier ? 0 : r.weight * (1 + player.luck / 100) ** tier }));
  let roll = Math.random() * tiers.reduce((sum, t) => sum + t.w, 0);
  for (const t of tiers) { roll -= t.w; if (roll < 0) return t.tier; }
  return minTier;
}

export const cardCount = () => Math.min(CARD_COUNT.max, CARD_COUNT.base + Math.floor(player.luck / CARD_COUNT.luckPerCard));

function pickKind(pools) {
  const kinds = Object.keys(pools).filter(k => pools[k].length);
  let roll = Math.random() * kinds.reduce((sum, k) => sum + CARD_KIND_WEIGHTS[k], 0);
  for (const k of kinds) { roll -= CARD_KIND_WEIGHTS[k]; if (roll < 0) return k; }
  return kinds[0];
}

const concernsOwnedSpell = c => !!c.spell || !!c.tags?.some(t => state.slots.some(id => id && hasTag(id, t)));

export function rollOffer() {
  const pools: any = {};
  for (const k in POOLS) pools[k] = POOLS[k]();
  const offer = [];
  for (let n = cardCount(); n > 0; n--) {
    const kind = pickKind(pools);
    if (!kind) break;
    const card = pick(pools[kind]);
    pools[kind] = pools[kind].filter(c => c !== card);
    offer.push({ ...card, tier: rollRarity(card.minTier) });
  }
  if (!offer.some(concernsOwnedSpell)) {         // Mindestens eine Karte betrifft einen eigenen Spell
    const card = pick(rankCards());
    offer[offer.length - 1] = { ...card, tier: rollRarity() };
  }
  return offer;
}

// Dev: Angebot aus einer Art in fester Seltenheit. Relikte auch unter Level 30, aber nie unter lila.
export function forcedOffer(kind, tier) {
  const pool = kind === 'relic' ? relicCards(true) : POOLS[kind]();
  return pool.sort(() => Math.random() - 0.5).slice(0, cardCount()).map(c => ({ ...c, tier: Math.max(tier, c.minTier ?? 0) }));
}
