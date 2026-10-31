// Spell-Kern: Slots, Tags, cast, Channel. Die Spells selbst liegen je in einer Datei, Registrierung in index.ts.

import { state, player } from '../state';
import { dist2d } from '../util';
import { CFG, SPELLS, SPELL_SLOTS, SPELL_START, SPELL_ACTIONS } from '../config';
import { manaCost, spellCd } from '../formulas';
import { heightAt } from '../world';
import { blizCursor, crystalBurst } from '../fx/spellFx';
import { showError, renderActionbar } from '../ui/hud';
import { damageMob } from '../mobs';
import { spendMana } from '../player';

export function resetSpells() {
  state.slots = [...SPELL_START, ...Array(SPELL_SLOTS - SPELL_START.length).fill(null)];
  state.spellStats = {};
}

export const hasTag = (id, tag) => SPELLS[id].tags.includes(tag);
export const stat = id => state.spellStats[id] ??= { dmg: 1, mana: 1, radius: 1 };
export const isGround = id => !!SPELLS[id].ground;

// Pro Wirkung ein Kontext; Wiederholungen tragen ihren eigenen Faktor
export function makeCtx(id, scale = 1, radiusScale = 1) {
  const c = {
    id,
    hit: (m, amount) => damageMob(m, amount * stat(id).dmg * scale, id),
    radius: base => base * stat(id).radius * radiusScale,
    duration: base => base,
  };
  return c;
}

export const mobsInRadius = (center, r) => state.mobs.filter(m => !m.dead && dist2d(m.pos, center) <= r);

// Stärkerer Slow gewinnt; abgelaufener Slow zählt nicht mehr
export function applySlow(mob, pct, dur) {
  if (mob.slowUntil <= state.now) mob.slowPct = 0;
  mob.slowPct = Math.max(mob.slowPct, pct);
  mob.slowUntil = Math.max(mob.slowUntil, state.now + dur);
}

// Bodenziel: Maus wählt per Klick, am Pad liegt das Ziel vor der Figur
function startTargeting(id) {
  if (state.lastInput === 'pad') {
    const x = player.pos.x + Math.sin(player.facing) * CFG.blizAimStart;
    const z = player.pos.z + Math.cos(player.facing) * CFG.blizAimStart;
    return castSpell(id, { x, y: heightAt(x, z), z, clone() { return { ...this }; } });
  }
  player.targeting = player.targeting === id ? false : id;
  blizCursor.visible = !!player.targeting;
}

// Einstieg aus input.ts und gamepad.ts: bekommt die Aktion, sucht den Slot
export function cast(action, point?) {
  if (point && typeof player.targeting === 'string') return castSpell(player.targeting, point);
  const id = state.slots[SPELL_ACTIONS.indexOf(action)];
  if (id) castSpell(id, point);
}

export function castSpell(id, point?) {
  if (state.paused || player.dead) return;
  const s = SPELLS[id];
  if (player.stunUntil > state.now && id !== 'blink') return showError('Du bist betäubt');
  if (isGround(id) && !point) return startTargeting(id);
  if (id === 'blink') player.stunUntil = 0;               // Blink löst Betäubung
  if (state.now < player.gcdUntil || (player.cds[id] || 0) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  const cost = manaCost(id);
  if (player.mana < cost) return showError('Nicht genug Mana');
  if (isGround(id) && dist2d(player.pos, point) > s.range) return showError('Außer Reichweite');
  if (id === 'drink' && !player.grounded) return showError('Du kannst das nicht im Sprung tun');

  stopChannel(true);
  stopDrink();
  spendMana(cost);
  player.gcdUntil = state.now + CFG.gcd;
  if (s.cd) player.cds[id] = state.now + spellCd(id);
  player.targeting = false;
  blizCursor.visible = false;
  if (id !== 'drink' && !s.channel) { player.castAnimUntil = state.now + 450; crystalBurst(s.cls); }
  s.effect(makeCtx(id), point);
}

// input.ts setzt für Taste 3 nur player.targeting = true. Erst hier steht fest, welcher Spell im Slot liegt.
function resolveSlot3() {
  if (player.targeting !== true) return;
  const id = state.slots[2];
  if (isGround(id)) { player.targeting = id; return; }
  player.targeting = false;
  state.padAim = null;
  blizCursor.visible = false;
  castSpell(id);
}

export function updateChannel() {
  resolveSlot3();
  const ch = player.channel;
  if (!ch) return;
  const s = SPELLS[ch.id];
  while (player.channel === ch && ch.nextTick <= state.now && ch.nextTick <= ch.end) {
    ch.nextTick += 1000;
    s.tick(ch);
  }
  if (player.channel === ch && state.now >= ch.end) stopChannel(true);
}

export function startChannel(c, point, dur) {
  player.channel = { id: c.id, c, point, start: state.now, end: state.now + c.duration(dur), nextTick: state.now + 1000, delays: 0 };
  return player.channel;
}

export function stopChannel(force = false) {
  const ch = player.channel;
  if (!ch) return;
  player.channel = null;
  SPELLS[ch.id].onChannelEnd?.(ch);
}
export function stopDrink() {
  player.drink = null;
}

export function learnSpell(id, slot) {
  state.slots[slot] = id;
  renderActionbar();
}
