// Spell-Kern: Slots, Tags, cast, Channel. Die Spells selbst liegen je in einer Datei, Registrierung in index.ts.

import { hooks, emit } from '../hooks';
// Werte je Spell (stat, rune, supported …) liegen in stats.ts, hier weitergereicht, damit die Aufrufer bleiben
import { hasTag, stat, runesOf, rune, hasRune, supported, echoCost, radiusMult, baseCharges } from './stats';
export { hasTag, stat, runesOf, rune, hasRune, supported, echoCost, radiusMult } from './stats';
import { spellAtAction } from '../hotbar';
import { clearEnergy } from '../vfx/energy';
import { state, player } from '../state';
import { dist2d, rand } from '../util';
import { groundAt } from '../collision';
import { zone } from '../world';
import { particles } from '../fx/particles';
import { mods, SPELLS, SPELL_AOE_HEIGHT, SPELL_SLOTS, SPELL_START, SPELL_ACTIONS, RANDOM_MAGE } from '../config';
import { manaCost, spellCd, maxHp } from '../formulas';
import { groundCursor, crystalBurst } from '../fx/spellFx';
import { showError, renderActionbar } from '../feedback';
import { damageMob, applyRoot } from '../mobs';
import { spendMana } from '../player';
import { boltFx, ICE_WHITE } from './fx';
import { MODIFIERS, activeModIds, modValue, randomMode } from '../modifiers';
import { buffDmgMul } from '../buffs';
import { batteryHit, consumeOvercharge } from '../battery';
import { BATTERY } from '../config';
import { dodgeRecovery, comboReady, consumeCombo, pdDmgMul, pdRateMul } from '../dodge';
import { berserkMul } from '../realMen';
import { legendDmgMul } from '../legends';
import { loadRuns, saveRuns } from '../leaderboard';
import { SUPPORTS } from './supports';
import { meterDmgMul, meterSlow, meterFrostFull, meterHeatHit, meterCast } from '../schoolMeter';
import { t } from '../i18n';

// Regeln der aktiven Modifikatoren. Funktionen statt Konstanten: index.ts ruft resetSpells, während der Import-Kreis mit formulas.ts noch läuft.
function activeMods() { return MODIFIERS.filter(m => activeModIds().includes(m.id)); }
export function modRule(key): any { return activeMods().find(m => m[key])?.[key]; }
// Nur Frost, Nur Feuer und die anderen Figuren lassen nur ihre Schule zu
// Fokus-Waffe: ein Spell außerhalb der Schule kommt für den Run in den Pool
export const spellAllowed = id => tagsAllowed(SPELLS[id].tags) || !!state.poolExtra?.includes(id);
// Pool der Figur (modifiers.ts pool): nur daraus kommen „Neuer Spell“-Karten. Ohne Pool gilt die Schule wie bisher
export const figurePool = (): string[] | undefined => modRule('pool')?.map(swapSpell);
// Legendäre Krieger-Waffe (realMen.ts, hooks.ts spellSwap): ersetzt einzelne Spells in Start-Kit und Pool
function swapSpell(id: string): string { return hooks.spellSwap.fn(id) ?? id; }
export function tagsAllowed(tags) { return activeMods().every(m => !m.onlyTag || tags.includes(m.onlyTag)); }

export function startKit() {
  const kit = (randomMode() ? RANDOM_MAGE.kit : modRule('startKit') ?? SPELL_START).map(id => id === 'drink' && modRule('noDrink') ? null : id && swapSpell(id));
  return [...kit, ...Array(SPELL_SLOTS - kit.length).fill(null)];
}

export function resetSpells() {
  state.slots = startKit();
  state.randomNext = {};
  state.spellStats = {};
  state.runes = {};
  state.supports = {};
  state.relicTaken = false;
  state.figRelicTaken = false;   // Relikt der Figur, eins pro Run (cards.ts)
  player.speedBuff = 1;          // Lauftempo aus Spells (Feuerspur)
  player.luck = 0;
  player.charges = {};
  player.spellCounts = {};
  player.casting = null;
  player.lastBlink = -1e9;
  clearSpellEffects();
}

// Dauerflächen und verzögerte Wirkungen enden mit dem Run oder dem Zonenwechsel
export function clearSpellEffects() {
  clearEnergy();
  for (const f of state.fields ?? []) f.visual?.remove();
  state.fields = [];
  state.scheduled = [];
}

export const hasSpell = id => state.slots.includes(id);
export const isGround = id => !!(SPELLS[id].ground || rune(id)?.ground);

// Wann der Spell wieder geht; mit Ladungen zählt die zuerst fertige
export const chargesOf = id => { const n = rune(id)?.charges ?? baseCharges(id), bonus = (state.bonusCharges?.[id] ?? 0);
  return bonus ? (n ?? 1) + bonus : n; };   // bonus: Buch
export function cdEnd(id) {
  const n = chargesOf(id);
  if (!n) return player.cds[id] || 0;
  player.charges[id] ??= Array(n).fill(0);
  return Math.min(...player.charges[id]);
}
export function startCd(id) {
  const cd = spellCd(id);
  if (!cd) return;
  if (!chargesOf(id)) { player.cds[id] = state.now + cd; return; }
  cdEnd(id);                                // legt die Ladungen an, wenn der Start ohne Prüfung kommt
  const c = player.charges[id];
  c[c.indexOf(Math.min(...c))] = state.now + cd;
}

export const paysLife = id => supported('blood', id) || !!modValue('lifeCost');   // Blutopfer oder Seuchenmagier
export const damageMult = id => (supported('focus', id) ? 1.4 : 1) * (supported('wide', id) ? 0.9 : 1);


// Pro Wirkung ein Kontext; Wiederholungen tragen ihren eigenen Faktor, aber die ID ihres Casts
let inTick = false;   // Ticks von Kanälen und Flächen zählen als Schaden über Zeit (Wirksamkeit)
let tickEnd = 0;      // Ende der Fläche oder des Kanals, der gerade tickt
// Brand: ein Feuer-Tick lässt den Mob brennen, solange die Quelle läuft, höchstens BURN_STICK ms nach dem letzten Tick (Brandmal-Detonation)
const BURN_STICK = 3000;   // PH
export const burnLeft = m => m.burn && m.burn.until > state.now ? m.burn.dps * (m.burn.until - state.now) / 1000 : 0;
let castCounter = 0;
export const WET_BLITZ = 1.5;   // PH: Blitz-Schaden auf nasse Mobs
export function makeCtx(id, scale = 1, radiusScale = 1, castKey = ++castCounter) {
  areaSpell = id;
  const c: any = {
    id,
    castKey,
    hit(m, amount) {
      areaSpell = id;
      let dmg = amount * stat(id).dmg * scale * damageMult(id);
      if (inTick && state.supports.potency) dmg *= 1.2;
      if (supported('boneChill', id) && m.slowUntil > state.now) dmg *= 1.15;
      if (m.shockUntil > state.now) dmg *= 1.1;   // Bogenblitz-Rune Schock
      if (m.wetUntil > state.now && hasTag(id, 'Blitz')) dmg *= WET_BLITZ;   // nass (Schleuse der Kanäle, objects/themeObjects.ts)
      const frozen = m.rootUntil > state.now;
      if (frozen) dmg *= 1 + (mods.coldBurn ?? 0) + (mods.frozenDmg ?? 0);   // Kältebrand, Set Splitterkönig
      if (inTick && hasTag(id, 'Feuer')) dmg *= modValue('dotMul') ?? 1;   // Fire only: Brand und Flächen
      if (player.rebornUntil > state.now) dmg *= player.rebornMul;         // Phönix-Rune Wiedergeburt
      if (hasTag(id, 'Feuer')) dmg *= meterDmgMul(inTick);                  // Hitze: Treffer und Brand stärker
      dmg *= buffDmgMul() * pdDmgMul() * berserkMul() * legendDmgMul();     // Getränke des ?-Magiers, Perfekter Dodge, Berserker, Leeroy Jenkins
      if (modValue('lowHpDmg')) dmg *= 1 + modValue('lowHpDmg') * (1 - Math.max(0, player.hp) / maxHp());   // weniger Leben, mehr Schaden (kein Modus nutzt es seit v31)
      if (c.over) dmg *= BATTERY.overMul;                                    // Batterie überladen
      const landed = damageMob(m, dmg, id, castKey, { dark: hasTag(id, 'Dunkel'), forceCrit: c.forceCrit });
      const slow = modValue('hitSlow');                                      // Frost only: jeder Frost-Treffer verlangsamt
      if (landed && slow && !m.dead && hasTag(id, 'Frost')) applySlow(m, slow.pct, slow.ms);
      if (landed && !m.dead && meterFrostFull()) applySlow(m, 0, slow?.ms ?? 2000);   // Kill-Anzeige Frost voll: jeder Treffer, applySlow legt den Bonus drauf
      if (landed && hasTag(id, 'Blitz')) { batteryHit(); if (c.over && !m.dead) applyRoot(m, BATTERY.stunMs); }   // Batterie: Ladung pro Treffer, überladen betäubt
      if (landed && !inTick && hasTag(id, 'Feuer')) meterHeatHit();       // Hitze: jeder Feuer-Treffer, Brand-Ticks nicht
      if (landed && inTick && !m.dead && hasTag(id, 'Feuer')) m.burn = { dps: dmg, until: Math.min(tickEnd, state.now + BURN_STICK) };
      if (landed && hasTag(id, 'Feuer') && id !== 'gasoline') for (const fn of hooks.fireHit.fns) fn(m, id, dmg);   // Benzin zündet (hooks.ts)
      if (landed) for (const fn of hooks.anyHit.fns) fn(m, id, dmg, frozen);   // Eissplitter, Netz (hooks.ts)
      return landed;
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
    duration: base => base * (state.supports.potency ? 1.4 : 1) * mods.durMul * (stat(id).dur ?? 1),   // stat.dur: Rang-Karte des ?-Magiers
  };
  return c;
}

// Kristallhöhlen: ein Kristall auf der Linie Figur → Ziel spiegelt das Geschoss (zone.reflect, höchstens einmal).
// Gibt das Ziel zurück, das es wirklich trifft; null = Kristall hat es geschluckt (kein Ziel in der gespiegelten Richtung)
const CRYSTAL_BOLT = [2.2, 0.9, 2.4];   // PH
export function bounceShot(target) {
  const b = zone.reflect?.(player.pos, target);
  if (!b) return target;
  if (b.target) boltFx(b.at, b.target.pos, CRYSTAL_BOLT);
  else for (let i = 0; i < 10; i++) particles.spawn({ x: b.at.x, y: b.at.y, z: b.at.z, vx: rand(-4, 4), vy: rand(1, 5), vz: rand(-4, 4), life: rand(0.25, 0.5), color: CRYSTAL_BOLT, size: rand(0.15, 0.3) });   // geschluckt: Funken am Kristall
  return b.target;
}

// Flächen treffen nur nahe der Wirkfläche: der Boden unter center, damit ein Sprung die Fläche nicht mit anhebt.
// height = Infinity für Zielzauber, die nur ein Ziel im Umkreis suchen.
// Map-Objekte (objects/): jede Wirkfläche (endliche Höhe = Schaden, Infinity = nur Zielsuche) meldet sich mit dem Spell, der gerade wirkt.
// areaSpell: zuletzt erzeugter oder treffender Kontext bzw. tickende Fläche; Kegel zählen als Kreis (hooks.ts spellArea)
let areaSpell: string | null = null;
export function mobsInRadius(center, r, height = SPELL_AOE_HEIGHT) {
  if (height !== Infinity) for (const fn of hooks.spellArea.fns) fn(center, r, areaSpell);
  const y = groundAt(center.x, center.z, center.y);
  return state.mobs.filter(m => !m.dead && dist2d(m.pos, center) <= r && Math.abs(m.pos.y - y) < height);
}

// Stärkster Slow gilt; ein schwächerer verlängert ihn nicht, abgelaufener Slow zählt nicht mehr
export function applySlow(mob, pct, dur) {
  pct = meterSlow(pct);                     // Kill-Anzeige Frost voll
  if (mob.slowUntil <= state.now) mob.slowPct = 0;
  if (pct < mob.slowPct) return;
  mob.slowUntil = pct > mob.slowPct ? state.now + dur : Math.max(mob.slowUntil, state.now + dur);
  mob.slowPct = pct;
}

// Bodenziel: Maus wählt per Klick. Das Pad zielt selbst (gamepad.ts) und kommt mit fertigem Punkt.
function startTargeting(id) {
  player.targeting = player.targeting === id ? false : id;
  groundCursor.visible = !!player.targeting;
}

// Einstieg aus input.ts und gamepad.ts: bekommt die Aktion, sucht den Slot
export function cast(action, point?) {
  if (point && typeof player.targeting === 'string') return castSpell(player.targeting, point);
  const id = spellAtAction(action);   // Taste → Platz auf der Leiste → Slot (hotbar.ts)
  if (id) castSpell(id, point);
}

export function castSpell(id, point?) {
  if (state.paused || player.dead) return;
  const s = SPELLS[id];
  if (player.stunUntil > state.now && id !== 'blink') return showError(t('msg.youStunned'));
  if (player.iceUntil > state.now && id !== 'iceblock') return showError(t('msg.inIceblock'));
  if (player.meltUntil > state.now) return showError(t('msg.melted'));   // Seuchenmagier: Zerfließen
  if (dodgeRecovery()) return;                              // kurz nach dem Dodge kein Zauber
  if (s.press) return s.press(point);                     // Real Men, Eisblock, ?-Magier: eigene Kosten und Abklingzeit
  if (isGround(id) && !point && state.bossAim) point = state.bossAim.clone();   // Boss-Lock-on (boss.ts): Bodenzauber landen unter dem Boss
  if (isGround(id) && !point) return startTargeting(id);
  if (id === 'blink') player.stunUntil = 0;               // Blink löst Betäubung
  if (cdEnd(id) > state.now) return showError(t('msg.notReady'));
  const cost = manaCost(id);
  const life = paysLife(id), freeOk = comboReady('freeMana');   // Dodge-Kombo Normal: nächster Spell ohne Mana
  if (!freeOk && (life ? player.hp <= cost : player.mana < cost)) return showError(life ? t('msg.noLife') : t('msg.noMana'));
  if (isGround(id) && dist2d(player.pos, point) > (rune(id)?.range ?? s.range) + (stat(id).range ?? 0)) return showError(t('msg.outOfRange'));   // stat.range: Rang-Karte
  if (id === 'drink' && !player.grounded) return showError(t('msg.notInAir'));

  const fail = s.canCast?.();
  if (fail) return showError(fail);

  stopChannel(true);
  stopDrink();
  player.casting = null;
  player.targeting = false;
  groundCursor.visible = false;
  // Dodge-Kombos: Normal kein Mana, Fire only Feuerball crittet
  const opts = { free: freeOk && consumeCombo('freeMana'), crit: id === 'fireball' && consumeCombo('fireCrit') };
  let castTime = s.instantCast?.() ? 0 : s.castTime * mods.castMul * (stat(id).cast ?? 1) / pdRateMul();   // stat.cast: Wurfzeit je Spell (Set Glutprophet, gear/apply.ts)   // Perfekter Dodge: schneller zaubern   // castMul: Waffen-Typ und Hersteller
  if (!castTime) { noteCastStart(id); return release(id, point, opts); }
  player.casting = { id, point, start: state.now, end: state.now + castTime, total: castTime, delays: 0, hp: player.hp, opts };
  noteCastStart(id);
}

// Ein Spell fängt an (Zauberzeit, Kanal oder sofort). Der ?-Magier würfelt dann neu (random.ts, hooks.ts castStart)
export function noteCastStart(id) { meterCast(SPELLS[id].tags); for (const fn of hooks.castStart.fns) fn(id); }   // meterCast: Frost kühlt die Hitze

// Der Zauber wird wirksam: Kosten, Abklingzeit, Wirkung
function release(id, point, opts: any = {}) {
  const s = SPELLS[id], cost = opts.free ? 0 : manaCost(id);
  const life = paysLife(id);
  if (!opts.free && (life ? player.hp <= cost : player.mana < cost)) return showError(life ? t('msg.noLife') : t('msg.noMana'));
  if (life) player.hp -= cost; else spendMana(cost);
  startCd(id);
  if (id !== 'drink' && !s.channel) { player.castAnimUntil = state.now + 450; crystalBurst(s.cls); }
  if (id !== 'drink') emit('cast', id);   // Figur (figEvents.ts)
  const c: any = makeCtx(id);
  c.cost = cost;
  c.over = consumeOvercharge(s.tags);   // Blitz only: volle Batterie macht diesen Zauber stärker und leert sie
  c.forceCrit = !!opts.crit;
  s.effect(c, point);
  scheduleEchoes(id, point, c.castKey);
}

// damagePlayer trägt diese Quellen ein, wenn der letzte Schaden ein Tick war
const DOT_SOURCES = [t('fx.poison'), t('cause.lava'), t('meter.Feuer.full')];   // Ursachen-Texte wie in player.ts

// Zauber läuft: Bewegung bricht ab, Treffer schieben auf (Spec §7: maximal bis zur vollen Castzeit)
function updateCast() {
  const ct = player.casting;
  if (!ct) return;
  if ((Math.hypot(player.vel.x, player.vel.z) > 0 && !modValue('castWhileMoving')) || !player.grounded) { player.casting = null; return; }
  if (player.hp < ct.hp && !DOT_SOURCES.includes(player.lastHitBy)) {
    const delay = ct.delays < 5 ? 1000 - ct.delays * 200 : 200;
    ct.delays++;
    ct.end = Math.min(ct.end + delay, state.now + ct.total);
  }
  ct.hp = player.hp;
  player.castAnimUntil = state.now + 200;
  if (state.now < ct.end) return;
  player.casting = null;
  release(ct.id, ct.point, ct.opts);
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
    tickEnd = f.end;
    areaSpell = f.c?.id ?? areaSpell;
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
    tickEnd = ch.end;
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
  return [spells.join(', '), supports.join(', '), relic && `${t('hw.relic')}: ${SPELLS[relic].name}`, (state.runWeapon || state.heroWeapon) && `${t('hw.weapon')}: ${state.runWeapon || state.heroWeapon}`].filter(Boolean).join(' · ');
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
  saveRuns(runs);
}

export function learnSpell(id, slot) {
  state.slots[slot] = id;
  renderActionbar();
}
