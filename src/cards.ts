// Kartenarten, Seltenheit, Glück. Zahlen in config.ts unter CARD_*.

import { state, player } from './state';
import { pick } from './util';
import { dmgMult, manaCost, spellCd } from './formulas';
import { modFactor, randomMode } from './modifiers';
import { SPELLS, CARDS, CARD_RARITIES, CARD_KIND_WEIGHTS, CARD_RANK, CARD_SPELL_DMG, CARD_LUCK, CARD_COUNT, CARD_RELIC_LEVEL, FIG_RELIC, SLOT } from './config';
import { stat, hasSpell, hasTag, tagsAllowed, spellAllowed, modRule, runesOf, figurePool } from './spells/core';
import { SUPPORTS } from './spells/supports';
import { isUnlocked } from './meta';
import { t, fmtNum } from './i18n';

const pct = v => `${Math.round(v * 100)} %`;
const num = v => fmtNum(+v);
const tagList = tags => tags.map(x => t(`tag.${x}`)).join(', ');

const RANK_TEXT = {
  dmg: (name, m) => t('cardui.rank.dmg', { name, v: pct(CARD_RANK.dmg * m) }),
  mana: (name, m) => t('cardui.rank.mana', { name, v: pct(CARD_RANK.mana * m) }),
  radius: (name, m) => t('cardui.rank.radius', { name, v: pct(CARD_RANK.radius * m) }),
  tempo: (name, m) => t('cardui.rank.tempo', { name, v: pct(CARD_RANK.tempo * m) }),
  cd: (name, m) => t('cardui.rank.cd', { name, v: pct(CARD_RANK.cd * m) }),
  range: (name, m) => t('cardui.rank.range', { name, v: num(CARD_RANK.range * m) }),
  dur: (name, m) => t('cardui.rank.dur', { name, v: pct(CARD_RANK.dur * m) }),
};
// Mana-Rang multiplikativ: ×0,9 pro weißem Rang, so fallen die Kosten nicht linear an die Untergrenze
const manaAfter = (v, m) => Math.max(0.1, v * (1 - CARD_RANK.mana * m));   // PH: Untergrenze
const RANK_APPLY = {
  dmg: (s, m) => { s.dmg += CARD_RANK.dmg * m; },
  mana: (s, m) => { s.mana = manaAfter(s.mana, m); },
  radius: (s, m) => { s.radius += CARD_RANK.radius * m; },
  tempo: (s, m) => { s.tempo = (s.tempo ?? 1) + CARD_RANK.tempo * m; },   // Klingenstrich: Dauer der Aktion
  cd: (s, m) => { s.cd = Math.max(0.3, (s.cd ?? 1) - CARD_RANK.cd * m); },   // PH: Untergrenze
  range: (s, m) => { s.range = (s.range ?? 0) + CARD_RANK.range * m; },   // yd obendrauf
  dur: (s, m) => { s.dur = (s.dur ?? 1) + CARD_RANK.dur * m; s.radius += CARD_RANK.dur * m; },
};

function rankCards() {
  const list = [];
  for (const id of state.slots) {
    if (!id || !spellAllowed(id)) continue;   // Blink und Trinken bleiben im Kit, bekommen im Schul-Modus aber keine Karten
    for (const key of SPELLS[id].ranks ?? []) list.push({
      kind: 'rang', id: `rang-${id}-${key}`, spell: id, name: SPELLS[id].name, src: t('cardui.src.rank'),
      desc: m => RANK_TEXT[key](SPELLS[id].name, m),
      apply: m => { for (const t of SPELLS[id].rankTargets?.(key) ?? [id]) RANK_APPLY[key](stat(t), m); },   // ?-Magier: ganze Kategorie
    });
  }
  return list;
}

function newSpellCards() {
  if (randomMode()) return [];   // ?-Magier: keine Spell-Karten und keine Runen
  const pool = figurePool();      // Figuren: nur aus ihrem Pool von 9
  const ids = pool ? pool.filter(id => SPELLS[id] && !hasSpell(id)) : Object.keys(SPELLS).filter(id => !hasSpell(id) && !SPELLS[id].relic && !SPELLS[id].figRelic && !SPELLS[id].fixed && spellAllowed(id) && (!SPELLS[id].onlyMode || modRule('onlyTag') === SPELLS[id].onlyMode));
  return ids.map(id => ({
    kind: 'spell', id: `spell-${id}`, learn: id, name: SPELLS[id].name, src: t('cardui.src.spell', { tags: tagList(SPELLS[id].tags) }),
    desc: m => t('cardui.plusDmg', { desc: SPELLS[id].desc, v: pct(CARD_SPELL_DMG * m) }),
    apply: m => { stat(id).dmg += CARD_SPELL_DMG * m; },
  }));
}

function runeCards() {
  if (randomMode()) return [];
  const list = [];
  for (const id of state.slots) {
    if (!id || !spellAllowed(id)) continue;
    for (const [i, r] of (runesOf(id) ?? []).entries()) {
      const atMax = state.runes[id] === r.id && (state.cardPicks[`rune-${id}-${r.id}`] || 1) >= (r.stages ?? 1);   // stages: dieselbe Rune mehrmals
      if (atMax || !isUnlocked(`rune:${id}:${i}`)) continue;
      list.push({
        kind: 'rune', id: `rune-${id}-${r.id}`, spell: id, name: r.name, src: t('cardui.src.rune', { spell: SPELLS[id].name }),
        desc: m => t('cardui.plusDmg', { desc: r.desc, v: pct(CARD_SPELL_DMG * m) }),
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
    kind: 'support', id: `support-${x.id}`, tags: x.tags, name: x.name, src: t('cardui.src.support', { tags: tagList(x.tags) }),
    desc: m => t('cardui.plusDmgSupport', { desc: x.desc, v: pct(CARD_SPELL_DMG * m) }),
    apply: m => {
      state.supports[x.id] = true;
      for (const id of Object.keys(SPELLS)) if (x.tags.some(t => hasTag(id, t))) stat(id).dmg += CARD_SPELL_DMG * m;
    },
  }));
}

// Nur lila oder orange, max. 1 pro Run, ab Level 30
function relicCards(forced = false) {
  if (!forced && (state.relicTaken || player.level < CARD_RELIC_LEVEL)) return [];
  return Object.keys(SPELLS).filter(id => SPELLS[id].relic && !SPELLS[id].figRelic && spellAllowed(id) && (forced || isUnlocked(`relic:${id}`) || state.poolExtra?.includes(id))).map(id => ({
    kind: 'relic', id: `relic-${id}`, learn: id, minTier: 4, name: SPELLS[id].name, src: t('cardui.src.relic', { tags: tagList(SPELLS[id].tags) }),
    desc: m => t('cardui.relicDesc', { desc: SPELLS[id].desc, cd: SPELLS[id].cd / 1000, v: pct(CARD_SPELL_DMG * m) }),
    apply: m => { state.relicTaken = true; stat(id).dmg += CARD_SPELL_DMG * m; },
  }));
}

// Relikt der Figur: immer blau, eins pro Run, liegt auf der Relikt-Taste und belegt keinen Attacken-Slot
function figRelicCards(forced = false) {
  if (!forced && (state.figRelicTaken || player.level < FIG_RELIC.level)) return [];
  return (modRule('relics') ?? []).filter(id => SPELLS[id] && !hasSpell(id)).map(id => ({
    kind: 'relic', id: `relic-${id}`, learn: id, learnSlot: SLOT.relic, fixedTier: FIG_RELIC.tier, name: SPELLS[id].name, src: t('cardui.src.figRelic'),
    desc: m => `${SPELLS[id].desc}${SPELLS[id].cd ? t('cardui.cd', { cd: SPELLS[id].cd / 1000 }) : ''}`,
    apply: () => { state.figRelicTaken = true; },
  }));
}

function talentCards() {
  const allowed = c => (c.notOnly?.includes(modRule('onlyTag')) ? false : c.always) || (c.only ? c.only.includes(modRule('onlyTag')) : tagsAllowed(c.tags ?? []));
  return CARDS.filter(c => (state.cardRanks[c.id] || 0) < c.max && allowed(c) && (!c.needs || hasSpell(c.needs)) && (c.offerChance == null || Math.random() < c.offerChance)).map(c => {   // offerChance: seltene Karten
    const rank = state.cardRanks[c.id] || 0;
    return {
      kind: 'talent', id: c.id, name: c.name, src: t('cardui.src.talent', { a: rank + 1, b: c.max }), minTier: c.minTier,   // minTier 5: immer orange
      desc: m => c.desc(rank, m),
      apply: m => { c.apply(rank, m); state.cardRanks[c.id] = rank + 1; },
    };
  });
}

function luckCards() {
  if (modRule('noLuck')) return [];
  return [{
    kind: 'luck', id: 'luck', name: t('cardui.luck'), src: t('cardui.luck'),
    desc: m => t('cardui.luckDesc', { n: CARD_LUCK * m }),
    apply: m => { player.luck += CARD_LUCK * m; },
  }];
}

// Vorschau: echter Wert vorher → nachher. Die Karte selbst wird nicht angewendet, nur ihr Faktor nachgerechnet.
const BASE_HIT = s => s.tickDmg ?? (s.min ? (s.min + s.max) / 2 : s.dmg ?? s.pulse ?? s.showDmg);
export function spellValue(id, dmgBonus = 0) {
  const base = BASE_HIT(SPELLS[id]);
  return base ? Math.round(base * (stat(id).dmg + dmgBonus) * dmgMult() * modFactor('dmg')) : 0;
}
const hitUnit = s => s.tickDmg ? t('cardui.perTick') : '';
function dmgLine(id, bonus) {
  const s = SPELLS[id], now = spellValue(id);
  return now ? `${s.name} ${now} → ${spellValue(id, bonus)}${hitUnit(s)}` : '';
}
export function cardPreview(c, m) {
  if (c.kind === 'rang') {
    const key = c.id.split('-').pop(), s = SPELLS[c.spell];
    if (key === 'dmg') return dmgLine(c.spell, CARD_RANK.dmg * m);
    if (key === 'mana') { const v = stat(c.spell).mana; return t('cardui.prev.mana', { name: s.name, a: manaCost(c.spell), b: Math.round(manaCost(c.spell) * manaAfter(v, m) / v) }); }
    if (key === 'range') { const now = (s.dist ?? s.range) + (stat(c.spell).range ?? 0); return t('cardui.prev.range', { name: s.name, a: now, b: now + CARD_RANK.range * m }); }
    if (key === 'cd') { const v = stat(c.spell).cd ?? 1, cd = spellCd(c.spell); return t('cardui.prev.cd', { name: s.name, a: +(cd / 1000).toFixed(1), b: +(cd * Math.max(0.3, v - CARD_RANK.cd * m) / v / 1000).toFixed(1) }); }
    if (key === 'radius' && s.radius) return t('cardui.prev.radius', { name: s.name, a: num((s.radius * stat(c.spell).radius).toFixed(1)), b: num((s.radius * (stat(c.spell).radius + CARD_RANK.radius * m)).toFixed(1)) });
    return '';
  }
  if (c.kind === 'luck') return t('cardui.prev.luck', { a: player.luck, b: player.luck + CARD_LUCK * m });
  const id = c.spell ?? c.learn ?? (c.tags && state.slots.find(x => x && c.tags.some(t => hasTag(x, t))));
  return id && c.kind !== 'talent' ? dmgLine(id, CARD_SPELL_DMG * m) : '';
}
// Wie oft die Karte schon gewählt wurde, Talente zählen ihren Rang
// Was die Karte verdrängt: aktive Rune desselben Spells, Echo und Großes Echo schließen sich aus, voller Spell-Slot. null = nichts.
export function cardReplaces(c) {
  if (c.kind === 'rune') {
    const cur = state.runes[c.spell], rune = cur && cur !== c.id.split('-').pop() && SPELLS[c.spell].runes?.find(r => r.id === cur);
    return rune ? { label: t('cardui.replaces'), name: rune.name } : null;
  }
  if (c.id === 'support-bigEcho' && state.supports.echo) return { label: t('cardui.replaces'), name: t('support.echo.name') };
  if (c.id === 'support-echo' && state.supports.bigEcho) return { label: t('cardui.notWith'), name: t('support.bigEcho.name') };
  if (c.kind === 'spell' && !state.slots.includes(null)) return { label: t('cardui.slotsFull'), name: t('cardui.anySpell') };
  return null;
}

export const cardStage = c => c.kind === 'talent' ? state.cardRanks[c.id] || 0 : state.cardPicks[c.id] || 0;

const POOLS = { rang: rankCards, spell: newSpellCards, rune: runeCards, support: supportCards, relic: () => [...relicCards(), ...figRelicCards()], talent: talentCards, luck: luckCards };

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
    offer.push({ ...card, tier: card.fixedTier ?? rollRarity(card.minTier) });
  }
  if (!offer.some(concernsOwnedSpell)) {         // Mindestens eine Karte betrifft einen eigenen Spell
    const card = pick(rankCards());
    offer[offer.length - 1] = { ...card, tier: rollRarity() };
  }
  return offer;
}

// Dev: Angebot aus einer Art in fester Seltenheit. Relikte auch unter Level 30, aber nie unter lila.
export function forcedOffer(kind, tier) {
  const pool = kind === 'relic' ? [...figRelicCards(true), ...relicCards(true)] : POOLS[kind]();
  return pool.sort(() => Math.random() - 0.5).slice(0, cardCount()).map(c => ({ ...c, tier: c.fixedTier ?? Math.max(tier, c.minTier ?? 0) }));
}
