// Kartenarten, Seltenheit, Glück. Zahlen in config.ts unter CARD_*.

import { state, player } from './state';
import { pick } from './util';
import { SPELLS, CARDS, CARD_RARITIES, CARD_KIND_WEIGHTS, CARD_RANK, CARD_SPELL_DMG, CARD_LUCK, CARD_COUNT, CARD_RELIC_LEVEL } from './config';
import { stat, hasSpell, hasTag } from './spells/core';
import { SUPPORTS } from './spells/supports';

const pct = v => `${Math.round(v * 100)} %`;
const num = v => String(v).replace('.', ',');

const RANK_TEXT = {
  dmg: (name, m) => `${name}: +${pct(CARD_RANK.dmg * m)} Schaden.`,
  mana: (name, m) => `${name}: −${pct(CARD_RANK.mana * m)} Mana.`,
  radius: (name, m) => `${name}: +${pct(CARD_RANK.radius * m)} Radius.`,
};
const RANK_APPLY = {
  dmg: (s, m) => { s.dmg += CARD_RANK.dmg * m; },
  mana: (s, m) => { s.mana = Math.max(0.1, s.mana - CARD_RANK.mana * m); },   // PH: Untergrenze
  radius: (s, m) => { s.radius += CARD_RANK.radius * m; },
};

function rankCards() {
  const list = [];
  for (const id of state.slots) {
    if (!id) continue;
    for (const key of SPELLS[id].ranks ?? []) list.push({
      kind: 'rang', id: `rang-${id}-${key}`, spell: id, name: SPELLS[id].name, src: 'Rang',
      desc: m => RANK_TEXT[key](SPELLS[id].name, m),
      apply: m => RANK_APPLY[key](stat(id), m),
    });
  }
  return list;
}

function newSpellCards() {
  return Object.keys(SPELLS).filter(id => !hasSpell(id) && !SPELLS[id].relic).map(id => ({
    kind: 'spell', id: `spell-${id}`, learn: id, name: SPELLS[id].name, src: `Neuer Spell · ${SPELLS[id].tags.join(', ')}`,
    desc: m => `${SPELLS[id].desc} +${pct(CARD_SPELL_DMG * m)} Schaden.`,
    apply: m => { stat(id).dmg += CARD_SPELL_DMG * m; },
  }));
}

function runeCards() {
  const list = [];
  for (const id of state.slots) {
    if (!id) continue;
    for (const r of SPELLS[id].runes ?? []) {
      if (state.runes[id] === r.id) continue;
      list.push({
        kind: 'rune', id: `rune-${id}-${r.id}`, spell: id, name: r.name, src: `Rune · ${SPELLS[id].name}`,
        desc: m => `${r.desc} +${pct(CARD_SPELL_DMG * m)} Schaden.${state.runes[id] ? ' Ersetzt die aktive Rune.' : ''}`,
        apply: m => { state.runes[id] = r.id; stat(id).dmg += CARD_SPELL_DMG * m; },
      });
    }
  }
  return list;
}

function supportCards() {
  return SUPPORTS.filter(x => !state.supports[x.id]).map(x => ({
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
  return Object.keys(SPELLS).filter(id => SPELLS[id].relic).map(id => ({
    kind: 'relic', id: `relic-${id}`, learn: id, minTier: 4, name: SPELLS[id].name, src: `Relikt · ${SPELLS[id].tags.join(', ')}`,
    desc: m => `${SPELLS[id].desc} CD ${SPELLS[id].cd / 1000} s. +${pct(CARD_SPELL_DMG * m)} Schaden.`,
    apply: m => { state.relicTaken = true; stat(id).dmg += CARD_SPELL_DMG * m; },
  }));
}

function talentCards() {
  return CARDS.filter(c => (state.cardRanks[c.id] || 0) < c.max).map(c => {
    const rank = state.cardRanks[c.id] || 0;
    return {
      kind: 'talent', id: c.id, name: c.name, src: `Talent · Rang ${rank + 1} / ${c.max}`,
      desc: m => c.desc(rank, m),
      apply: m => { c.apply(rank, m); state.cardRanks[c.id] = rank + 1; },
    };
  });
}

function luckCards() {
  return [{
    kind: 'luck', id: 'luck', name: 'Glück', src: 'Glück',
    desc: m => `Glück +${num(CARD_LUCK * m)}: bessere und mehr Karten.`,
    apply: m => { player.luck += CARD_LUCK * m; },
  }];
}

const POOLS = { rang: rankCards, spell: newSpellCards, rune: runeCards, support: supportCards, relic: relicCards, talent: talentCards, luck: luckCards };

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
