// Fenster heroWindow.ts → Alle Werte (im Run) und Hauptmenü (Regeln): was die Figur besonders macht. Stand jetzt plus Regeln in Kurzform, Zahlen direkt aus den Configs.

import { state, player } from '../state';
import { SPELLS, SCHOOL_METER, BATTERY, PLAGUE, RANDOM_MAGE, mods } from '../config';
import { modValue, randomMode, isWarrior } from '../modifiers';
import { meterSchool, meterValue, meterHeat, meterOverheated, meterDmgMul, meterFrostFull } from '../schoolMeter';
import { batteryMode, batteryMax, overcharged, batteryCost } from '../battery';
import { shardMax } from '../figures';
import { nextOf } from '../spells/random';
import { warriorInfo } from '../realMen';
import { COLORS } from './colors';
import { t, fmtNum } from '../i18n';

const kv = (a, b) => `<div class="cRow"><span>${a}</span><b>${b}</b></div>`;
const head = (name, color) => `<div class="cSub" style="color:${color}">${name}</div>`;
const note = text => `<p class="cNote">${text}</p>`;
const de = v => fmtNum(+v.toFixed(1));
const pc = v => `${de(v * 100)} %`;
const plus = v => `+${de((v - 1) * 100)} %`;
const sec = ms => `${de(ms / 1000)} s`;
const name = id => SPELLS[id]?.name ?? id;

function fire() {
  const S = SCHOOL_METER.Feuer;
  return { name: S.name, color: S.color, rows: `
    ${kv(t('ci.now'), `${Math.round(meterHeat())} / ${S.max}${meterOverheated() ? ` · ${S.full}` : ''}`)}
    ${kv(t('ci.fire.hit'), plus(meterDmgMul()))}
    ${kv(t('ci.fire.burn'), plus(meterDmgMul(true)))}
  `, rules: t('ci.fire.rules', { hit: de(S.perHit), delay: sec(S.coolDelayMs), cool: S.coolPerS, dmg: pc(S.dmgPerHeat), burn: pc(S.burnPerHeat), max: S.max,
    over: pc(S.overDmg + mods.emberCore), self: pc(S.overheatSelfPctPerS), until: S.overheatUntil, heal: pc(S.killHeal) }) };
}

function frost() {
  const M = SCHOOL_METER, S = M.Frost, hit = modValue('hitSlow');
  return { name: S.name, color: S.color, rows: `
    ${kv(t('ci.now'), `${Math.round(meterValue() * 100)} %${meterFrostFull() ? ` · ${t('ci.full')}` : ''}`)}
    ${kv(t('res.shards'), `${state.shards ?? 0} / ${shardMax()}`)}
  `, rules: t('ci.frost.rules', { kill: pc(M.perKill), champ: pc(M.perChampion), idle: sec(M.idleMs), decay: pc(M.decayPerS), perma: mods.permafrost ? t('ci.frost.perma') : '',
    slow: pc(S.slow), max: pc(S.slowMax), hit: hit ? t('ci.frost.hit', { pct: pc(hit.pct), ms: sec(hit.ms) }) : '' }) };
}

function battery() {
  const B = BATTERY;
  return { name: t('res.battery'), color: B.color, rows: `
    ${kv(t('ci.now'), `${Math.floor(player.mana)} / ${batteryMax()}${overcharged() ? ` · ${t('ci.overcharged')}` : ''}`)}
  `, rules: t('ci.bat.rules', { start: B.start, regen: B.regenPerS, hit: B.perHitTarget, chain: name('chain'), chainCost: batteryCost(SPELLS.chain), mul: B.overMul, stun: sec(B.stunMs),
    recharge: name('recharge'), ms: sec(B.recharge.ms), amount: B.recharge.amount }) };
}

function plague() {
  const P = PLAGUE;
  return { name: t('tag.Seuche'), color: COLORS.school.nature, rows: `
    ${kv(t('ci.plague.near'), String(state.mobs.filter(m => !m.dead && m.plague && m.plague.until > state.now).length))}
  `, rules: t('ci.plague.rules', { sludge: name('sludge'), life: pc(SPELLS.sludge.lifePct), max: P.mark.max, ms: sec(P.mark.ms), contract: name('contract'),
    root: sec(P.contract.rootMs + 1000 * mods.toughSlime), drain: name('drain'), dmg: de(P.drain.dmg), heal: pc(P.drain.heal + mods.leech), burst: name('burst'), burstMs: sec(P.burst.ms) }) };
}

function warrior() {
  const { rageMul, qLength, R } = warriorInfo(), r = R.rage;
  return { name: t('res.rage'), color: COLORS.school.warrior ?? '#e05040', rows: `
    ${kv(t('ci.now'), `${Math.floor(player.mana)} / ${r.max}`)}
    ${kv(t('stat.dmg'), `×${de(rageMul)}`)}
    ${kv(name('wQ'), t('ci.war.hits', { n: qLength }))}
  `, rules: t('ci.war.rules', { hit: r.perMobHit, swing: r.perSwingMax, taken: r.perHitTaken, idle: sec(r.idleMs), decay: r.decayPerS, mult: de(R.mult.rage), max: r.max,
    armor: pc(R.armor), q: name('wQ'), start: R.q.start, kills: R.q.killsPerHit, qmax: R.q.max }) };
}

function random() {
  const C = RANDOM_MAGE.cats;
  return { name: t('ci.dice'), color: COLORS.text, rows: `
    ${['rOff', 'rDef', 'rUtil', 'rDrink'].map(cat => kv(C[cat].name, t('ci.dice.next', { name: cat === 'rDrink' ? RANDOM_MAGE.drinks[nextOf(cat)].name : name(nextOf(cat)) }))).join('')}
  `, rules: t('ci.dice.rules', { cds: ['rOff', 'rDef', 'rUtil', 'rDrink'].map(cat => `${C[cat].name} ${sec(C[cat].cd)}`).join(', ') }) };
}

// name, color: Überschrift; rows: Stand jetzt (nur im Lauf); rules: Regeln, auch fürs Hauptmenü
function figure() {
  if (isWarrior()) return warrior();
  if (batteryMode()) return battery();
  if (modValue('lifeCost')) return plague();
  const school = meterSchool();
  if (school === 'Feuer') return fire();
  if (school === 'Frost') return frost();
  if (randomMode()) return random();
  return null;
}
export function figureInfo() {
  const f = figure();
  return f ? `${head(f.name, f.color)}${f.rows}${note(f.rules)}` : '';
}
export function figureRules() {
  const f = figure();
  return f && { name: f.name, color: f.color, rules: f.rules };
}
