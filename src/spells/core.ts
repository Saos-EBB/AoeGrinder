// Spell-Kern: Slots, Tags, cast, Channel. Die Spells selbst liegen je in einer Datei, Registrierung in index.ts.

import { state, player } from '../state';
import { dist2d } from '../util';
import { groundAt } from '../collision';
import { CFG, SPELLS, SPELL_AOE_HEIGHT, SPELL_SLOTS, SPELL_START, SPELL_ACTIONS } from '../config';
import { manaCost, spellCd } from '../formulas';
import { blizCursor, crystalBurst } from '../fx/spellFx';
import { showError, renderActionbar } from '../ui/hud';
import { damageMob } from '../mobs';
import { spendMana } from '../player';
import { boltFx, ICE_WHITE } from './fx';
import { MODIFIERS, activeModIds } from '../modifiers';
import { loadRuns } from '../leaderboard';
import { SUPPORTS } from './supports';

// Regeln der aktiven Modifikatoren. Funktionen statt Konstanten: index.ts ruft resetSpells, während der Import-Kreis mit formulas.ts noch läuft.
function activeMods() { return MODIFIERS.filter(m => activeModIds().includes(m.id)); }
export function modRule(key): any { return activeMods().find(m => m[key])?.[key]; }
// Nur Frost lässt nur Frost zu, Nur Feuer alles außer Frost
export function tagsAllowed(tags) { return activeMods().every(m => (!m.onlyTag || tags.includes(m.onlyTag)) && (!m.noTag || !tags.includes(m.noTag))); }

function startKit() {
  const kit = (modRule('startKit') ?? SPELL_START).map(id => id === 'drink' && modRule('noDrink') ? null : id);
  return [...kit, ...Array(SPELL_SLOTS - kit.length).fill(null)];
}

export function resetSpells() {
  state.slots = startKit();
  state.spellStats = {};
  state.runes = {};
  state.supports = {};
  state.relicTaken = false;
  player.luck = 0;
  player.charges = {};
  player.spellCounts = {};
  player.casting = null;
  player.lastBlink = -1e9;
  clearSpellEffects();
}

// Dauerflächen und verzögerte Wirkungen enden mit dem Run oder dem Zonenwechsel
export function clearSpellEffects() {
  for (const f of state.fields ?? []) f.visual?.remove();
  state.fields = [];
  state.scheduled = [];
}

export const hasTag = (id, tag) => SPELLS[id].tags.includes(tag);
export const stat = id => state.spellStats[id] ??= { dmg: 1, mana: 1, radius: 1 };
export const hasSpell = id => state.slots.includes(id);
export const rune = id => SPELLS[id].runes?.find(r => r.id === state.runes[id]);
export const hasRune = (id, runeId) => state.runes[id] === runeId;
export const isGround = id => !!(SPELLS[id].ground || rune(id)?.ground);

// Wann der Spell wieder geht; mit Ladungen zählt die zuerst fertige
export function cdEnd(id) {
  const n = rune(id)?.charges;
  if (!n) return player.cds[id] || 0;
  player.charges[id] ??= Array(n).fill(0);
  return Math.min(...player.charges[id]);
}
function startCd(id) {
  const cd = spellCd(id);
  if (!cd) return;
  if (!rune(id)?.charges) { player.cds[id] = state.now + cd; return; }
  const c = player.charges[id];
  c[c.indexOf(Math.min(...c))] = state.now + cd;
}

const supported = (key, id) => !!state.supports[key] && SUPPORTS.find(x => x.id === key).tags.some(t => hasTag(id, t));
export const echoCost = id => supported('echo', id) && !SPELLS[id].channel;
export const paysLife = id => supported('blood', id);
export const radiusMult = id => stat(id).radius * (supported('focus', id) ? 0.7 : 1) * (supported('wide', id) ? 1.3 : 1);
const damageMult = id => (supported('focus', id) ? 1.4 : 1) * (supported('wide', id) ? 0.9 : 1);

// Pro Wirkung ein Kontext; Wiederholungen tragen ihren eigenen Faktor, aber die ID ihres Casts
let inTick = false;   // Ticks von Kanälen und Flächen zählen als Schaden über Zeit (Wirksamkeit)
let castCounter = 0;
export function makeCtx(id, scale = 1, radiusScale = 1, castKey = ++castCounter) {
  const c = {
    id,
    castKey,
    hit(m, amount) {
      let dmg = amount * stat(id).dmg * scale * damageMult(id);
      if (inTick && state.supports.potency) dmg *= 1.2;
      if (supported('boneChill', id) && m.slowUntil > state.now) dmg *= 1.15;
      if (m.cagedUntil > state.now && (id === 'chain' || id === 'voidorb')) dmg *= 1.5;   // Knochengefängnis
      if (m.shockUntil > state.now) dmg *= 1.1;   // Bogenblitz-Rune
      return damageMob(m, dmg, id, castKey);
    },
    // Geschoss-Treffer: Support "Kette" springt zu den 2 nächsten
    hitProjectile(m, amount) {
      const landed = c.hit(m, amount);
      if (!landed || !supported('chain', id)) return landed;
      const next = mobsInRadius(m.pos, 10, Infinity).filter(o => o !== m).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos)).slice(0, 2);
      for (const o of next) { boltFx(m.pos, o.pos, ICE_WHITE); c.hit(o, amount); }
      return landed;
    },
    radius: base => base * radiusMult(id) * radiusScale,
    duration: base => base * (state.supports.potency ? 1.4 : 1),
  };
  return c;
}

// Flächen treffen nur nahe der Wirkfläche: der Boden unter center, damit ein Sprung die Fläche nicht mit anhebt.
// height = Infinity für Zielzauber, die nur ein Ziel im Umkreis suchen.
export function mobsInRadius(center, r, height = SPELL_AOE_HEIGHT) {
  const y = groundAt(center.x, center.z, center.y);
  return state.mobs.filter(m => !m.dead && dist2d(m.pos, center) <= r && Math.abs(m.pos.y - y) < height);
}

// Stärkerer Slow gewinnt; abgelaufener Slow zählt nicht mehr
export function applySlow(mob, pct, dur) {
  if (mob.slowUntil <= state.now) mob.slowPct = 0;
  mob.slowPct = Math.max(mob.slowPct, pct);
  mob.slowUntil = Math.max(mob.slowUntil, state.now + dur);
}

// Bodenziel: Maus wählt per Klick. Das Pad zielt selbst (gamepad.ts) und kommt mit fertigem Punkt.
function startTargeting(id) {
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
  if (state.now < player.gcdUntil || cdEnd(id) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  const cost = manaCost(id);
  const life = paysLife(id);
  if (life ? player.hp <= cost : player.mana < cost) return showError(life ? 'Nicht genug Leben' : 'Nicht genug Mana');
  if (isGround(id) && dist2d(player.pos, point) > (rune(id)?.range ?? s.range)) return showError('Außer Reichweite');
  if (id === 'drink' && !player.grounded) return showError('Du kannst das nicht im Sprung tun');

  const fail = s.canCast?.();
  if (fail) return showError(fail);

  stopChannel(true);
  stopDrink();
  player.casting = null;
  player.gcdUntil = state.now + CFG.gcd;
  player.targeting = false;
  blizCursor.visible = false;
  const castTime = s.instantCast?.() ? 0 : s.castTime;
  if (!castTime) return release(id, point);
  player.casting = { id, point, start: state.now, end: state.now + castTime, total: castTime, delays: 0, hp: player.hp };
}

// Der Zauber wird wirksam: Kosten, Abklingzeit, Wirkung
function release(id, point) {
  const s = SPELLS[id], cost = manaCost(id);
  const life = paysLife(id);
  if (life ? player.hp <= cost : player.mana < cost) return showError(life ? 'Nicht genug Leben' : 'Nicht genug Mana');
  if (life) player.hp -= cost; else spendMana(cost);
  startCd(id);
  if (id !== 'drink' && !s.channel) { player.castAnimUntil = state.now + 450; crystalBurst(s.cls); }
  const c: any = makeCtx(id);
  c.cost = cost;
  s.effect(c, point);
  scheduleEchoes(id, point, c.castKey);
}

// damagePlayer trägt diese Quellen ein, wenn der letzte Schaden ein Tick war
const DOT_SOURCES = ['Gift', 'Lava'];

// Zauber läuft: Bewegung bricht ab, Treffer schieben auf (Spec §7: maximal bis zur vollen Castzeit)
function updateCast() {
  const ct = player.casting;
  if (!ct) return;
  if (Math.hypot(player.vel.x, player.vel.z) > 0 || !player.grounded) { player.casting = null; return; }
  if (player.hp < ct.hp && !DOT_SOURCES.includes(player.lastHitBy)) {
    const delay = ct.delays < 5 ? 1000 - ct.delays * 200 : 200;
    ct.delays++;
    ct.end = Math.min(ct.end + delay, state.now + ct.total);
  }
  ct.hp = player.hp;
  player.castAnimUntil = state.now + 200;
  if (state.now < ct.end) return;
  player.casting = null;
  release(ct.id, ct.point);
}

// PH: Faktoren von Großes Echo. Ein Kanal würde sich selbst abbrechen, deshalb wiederholt keins der Echos ihn.
function scheduleEchoes(id, point, key) {
  if (SPELLS[id].channel) return;
  if (supported('bigEcho', id)) {
    schedule(500, () => SPELLS[id].effect(makeCtx(id, 1.2, 1.2, key), point));
    schedule(1000, () => SPELLS[id].effect(makeCtx(id, 1.4, 1.4, key), point));
  } else if (supported('echo', id)) schedule(500, () => SPELLS[id].effect(makeCtx(id, 0.7, 1, key), point));
}

// Fläche mit Ticks und optionalem onUpdate pro Frame
export function addField(c, f) {
  const field = { c, tickMs: 1000, ...f, pos: f.pos.clone(), start: state.now, end: state.now + c.duration(f.dur), nextTick: state.now + (f.tickMs ?? 1000) };
  state.fields.push(field);
  field.visual?.update(field.pos, field.radius);
  return field;
}

export const schedule = (delay, fn) => state.scheduled.push({ at: state.now + delay, fn });

function updateFields(dt) {
  for (const f of [...state.fields]) {
    f.onUpdate?.(f, dt);
    f.pos.y = groundAt(f.pos.x, f.pos.z, f.pos.y);   // wandernde Flächen bleiben am Boden
    inTick = true;
    while (f.nextTick <= state.now && f.nextTick <= f.end) { f.nextTick += f.tickMs; f.onTick?.(f); }
    inTick = false;
    if (state.now >= f.end) {
      f.onEnd?.(f);
      f.visual?.remove();
      state.fields.splice(state.fields.indexOf(f), 1);
    } else f.visual?.update(f.pos, f.radius);
  }
  const due = state.scheduled.filter(e => e.at <= state.now);
  state.scheduled = state.scheduled.filter(e => e.at > state.now);
  for (const e of due) e.fn();
}

// Läuft einmal pro Frame aus updatePlayer
let lastUpdate = 0;
export function updateChannel() {
  const dt = Math.max(0, state.now - lastUpdate);
  lastUpdate = state.now;
  updateFields(dt);
  updateCast();
  const ch = player.channel;
  if (!ch) return;
  const s = SPELLS[ch.id];
  s.channelUpdate?.(ch, dt);
  while (player.channel === ch && ch.nextTick <= state.now && ch.nextTick <= ch.end) {
    ch.nextTick += 1000;
    inTick = true;
    s.tick(ch);
    inTick = false;
  }
  if (player.channel === ch && state.now >= ch.end) stopChannel(true);
}

export function startChannel(c, point, dur) {
  player.channel = { id: c.id, c, point, start: state.now, end: state.now + c.duration(dur), nextTick: state.now + 1000, delays: 0 };
  return player.channel;
}

export function stopChannel(force = false) {
  const ch = player.channel;
  if (!ch || (ch.mobile && !force)) return;   // Rune "laufen erlaubt": Bewegung bricht nicht ab
  player.channel = null;
  SPELLS[ch.id].onChannelEnd?.(ch);
}
export function stopDrink() {
  player.drink = null;
}

// Build des Runs als Text: Spells mit aktiver Rune · Supports · Relikt
function buildText() {
  const owned = state.slots.filter(id => id && !SPELLS[id].fixed);
  const spells = owned.filter(id => !SPELLS[id].relic).map(id => rune(id) ? `${SPELLS[id].name} (${rune(id).name})` : SPELLS[id].name);
  const supports = SUPPORTS.filter(x => state.supports[x.id]).map(x => x.name);
  const relic = owned.find(id => SPELLS[id].relic);
  return [spells.join(', '), supports.join(', '), relic && `Relikt: ${SPELLS[relic].name}`].filter(Boolean).join(' · ');
}

// recordRun speichert beim Tod mit leerem build. Pro Frame geprüft, weil leaderboard.ts und player.ts Blau gehören: der Frame nach dem Tod trägt es nach.
let buildSaved = false;
export function saveRunBuild() {
  if (!player.dead) { buildSaved = false; return; }
  if (buildSaved) return;
  buildSaved = true;
  const runs = loadRuns(), last = runs[runs.length - 1];
  if (!last) return;
  last.build = buildText();
  try { localStorage.setItem('frostgrind.runs.v1', JSON.stringify(runs)); } catch { /* kein Storage */ }
}

export function learnSpell(id, slot) {
  state.slots[slot] = id;
  renderActionbar();
}
