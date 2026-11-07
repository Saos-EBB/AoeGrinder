// Charakterfenster → Werte: was die Figur besonders macht. Stand jetzt plus Regeln in Kurzform, Zahlen direkt aus den Configs.

import { state, player } from '../state';
import { SPELLS, SCHOOL_METER, BATTERY, PLAGUE, RANDOM_MAGE, mods } from '../config';
import { modValue, randomMode } from '../modifiers';
import { mage } from '../models/mage';
import { meterSchool, meterValue, meterHeat, meterOverheated, meterDmgMul, meterFrostFull, arcCharges, arcDmgMul, arcCostMul } from '../schoolMeter';
import { batteryMode, batteryMax, overcharged, batteryCost } from '../battery';
import { shardMax } from '../figures';
import { nextOf } from '../spells/random';
import { warriorInfo } from '../realMen';
import { klingeInfo } from '../klinge';
import { COLORS } from './colors';

const kv = (a, b) => `<div class="cRow"><span>${a}</span><b>${b}</b></div>`;
const head = (name, color) => `<div class="cSub" style="color:${color}">${name}</div>`;
const note = text => `<p class="cNote">${text}</p>`;
const de = v => String(+v.toFixed(1)).replace('.', ',');
const pc = v => `${de(v * 100)} %`;
const plus = v => `+${de((v - 1) * 100)} %`;
const sec = ms => `${de(ms / 1000)} s`;
const name = id => SPELLS[id]?.name ?? id;

function fire() {
  const S = SCHOOL_METER.Feuer;
  return { name: S.name, color: S.color, rows: `
    ${kv('Stand', `${Math.round(meterHeat())} / ${S.max}${meterOverheated() ? ' · Überhitzt' : ''}`)}
    ${kv('Treffer-Schaden', plus(meterDmgMul()))}
    ${kv('Brand-Schaden', plus(meterDmgMul(true)))}
  `, rules: `Jeder Feuer-Treffer +${de(S.perHit)} Hitze, Brand-Ticks nicht. Nach ${sec(S.coolDelayMs)} ohne Treffer −${S.coolPerS} pro s.
      Pro Hitze +${pc(S.dmgPerHeat)} Treffer- und +${pc(S.burnPerHeat)} Brandschaden.
      Bei ${S.max} überhitzt: +${pc(S.overDmg + mods.emberCore)} Schaden, aber ${pc(S.overheatSelfPctPerS)} Leben pro s, bis unter ${S.overheatUntil}.
      Frost-Zauber halbieren die Hitze. Jeder Kill heilt ${pc(S.killHeal)} Leben.` };
}

function frost() {
  const M = SCHOOL_METER, S = M.Frost, hit = modValue('hitSlow');
  return { name: S.name, color: S.color, rows: `
    ${kv('Stand', `${Math.round(meterValue() * 100)} %${meterFrostFull() ? ' · voll' : ''}`)}
    ${kv('Eissplitter', `${state.shards ?? 0} / ${shardMax()}`)}
  `, rules: `Kill +${pc(M.perKill)}, Champion +${pc(M.perChampion)}. Nach ${sec(M.idleMs)} ohne Kill −${pc(M.decayPerS)} pro s${mods.permafrost ? ' (Permafrost bremst das)' : ''}.
      Voll: jeder Slow +${pc(S.slow)}, höchstens ${pc(S.slowMax)}.${hit ? ` Jeder Frost-Treffer verlangsamt ${pc(hit.pct)} für ${sec(hit.ms)}.` : ''}
      Jeder Treffer auf einen Eingefrorenen gibt 1 Eissplitter.` };
}

function arcane() {
  const S = SCHOOL_METER.Arkan;
  return { name: S.name, color: S.color, rows: `
    ${kv('Stand', `${arcCharges()} / ${S.max}`)}
    ${kv('Arkan-Schaden', plus(arcDmgMul()))}
    ${kv('Arkan-Kosten', plus(arcCostMul()))}
  `, rules: `${S.gain.map(name).join(', ')} geben je 1 Ladung. Pro Ladung +${pc(S.dmg)} Schaden und +${pc(S.cost)} Kosten auf Arkan-Zauber.
      ${sec(S.idleMs)} ohne Arkan-Zauber: alle Ladungen weg. ${name('barrage')} verbraucht sie.` };
}

function battery() {
  const B = BATTERY;
  return { name: 'Batterie', color: B.color, rows: `
    ${kv('Stand', `${Math.floor(player.mana)} / ${batteryMax()}${overcharged() ? ' · Überladen' : ''}`)}
  `, rules: `Statt Mana. Start mit ${B.start}, +${B.regenPerS} pro s, +${B.perHitTarget} pro getroffenem Gegner eines Blitz-Zaubers.
      Zauber kosten Ladung (${name('chain')}: ${batteryCost(SPELLS.chain)}).
      Voll = überladen: der nächste Blitz-Zauber macht ×${B.overMul} Schaden, betäubt ${sec(B.stunMs)} und leert die Batterie.
      ${name('recharge')} statt Trinken: ${sec(B.recharge.ms)} stehen, +${B.recharge.amount}.` };
}

function plague() {
  const P = PLAGUE;
  return { name: 'Seuche', color: COLORS.school.nature, rows: `
    ${kv('Male in der Nähe', String(state.mobs.filter(m => !m.dead && m.plague && m.plague.until > state.now).length))}
  `, rules: `Kein Mana: Zauber kosten einen Anteil der max. Leben (${name('sludge')} ${pc(SPELLS.sludge.lifePct)}). Keine Regeneration, kein Trinken.
      Markierende Zauber setzen Male, bis ${P.mark.max} Stapel, ${sec(P.mark.ms)}.
      ${name('contract')}: zieht zusammen, ${sec(P.contract.rootMs + 1000 * mods.toughSlime)} fest pro Stapel.
      ${name('drain')}: ${de(P.drain.dmg)} Einheiten pro Stapel, heilt ${pc(P.drain.heal + mods.leech)} pro Gegner.
      ${name('burst')}: Gift in Höhe des Entziehen-Schadens über ${sec(P.burst.ms)}. Alle drei verbrauchen die Male.` };
}

function warrior() {
  const { rageMul, qLength, R } = warriorInfo(), r = R.rage;
  return { name: 'Wut', color: COLORS.school.warrior ?? '#e05040', rows: `
    ${kv('Stand', `${Math.floor(player.mana)} / ${r.max}`)}
    ${kv('Schaden', `×${de(rageMul)}`)}
    ${kv('Schlagfolge', `${qLength} Schläge`)}
  `, rules: `Wut statt Mana. +${r.perMobHit} pro getroffenem Gegner (höchstens ${r.perSwingMax} pro Schlag), +${r.perHitTaken} wenn du getroffen wirst.
      Nach ${sec(r.idleMs)} ohne Treffer −${r.decayPerS} pro s.
      Schaden ×(1 + ${de(R.mult.rage)} × Wut/${r.max}) × (1 + fehlendes Leben): volle Wut bei wenig Leben fast ×3.
      Du nimmst ${pc(R.armor)} weniger Schaden. Schlagfolge startet mit ${R.q.start}, alle ${R.q.killsPerHit} Kills einer mehr, höchstens ${R.q.max}.` };
}

function klinge() {
  const { stance, name: sName, bar, inStanceMs, K } = klingeInfo(), B = K.bar, two = K.stance[2], three = K.stance[3];
  return { name: 'Haltung', color: COLORS.school.warrior ?? '#d8343c', rows: `
    ${kv('Stand', `${sName} · ${Math.floor(bar)} / ${B.max}`)}
    ${stance === 2 ? kv('Bis Zweihand III', sec(Math.max(0, B.toThreeMs - inStanceMs))) : ''}
  `, rules: `Leiste füllt sich durch Schaden: +${B.perUnit} pro ausgeteilter Einheit, +${B.perPctTaken} pro 1 % erlittener Leben.
      Voll: F wechselt in Zweihand, +${pc(two.dmg - 1)} Schaden und Blutung (${pc(K.bleed.share)} des Treffers über ${sec(K.bleed.ms)}, bis ${K.bleed.max} Stapel).
      Nach ${de(B.toThreeMs / 60000)} min Zweihand III: dazu +${pc(three.move - 1)} Tempo, Angriffstempo ×${three.rate}.
      ${sec(B.idleMs)} ohne Kill: −${B.drainPerS} pro s. Leer → zurück in Einhand.` };
}

function random() {
  const C = RANDOM_MAGE.cats;
  return { name: 'Würfel', color: COLORS.text, rows: `
    ${['rOff', 'rDef', 'rUtil', 'rDrink'].map(cat => kv(C[cat].name, `als Nächstes ${cat === 'rDrink' ? RANDOM_MAGE.drinks[nextOf(cat)].name : name(nextOf(cat))}`)).join('')}
  `, rules: `Die 4 Tasten würfeln nach jedem Zauber neu aus ihrer Kategorie. Es zählt nur die Abklingzeit der Kategorie
      (${['rOff', 'rDef', 'rUtil', 'rDrink'].map(cat => `${C[cat].name} ${sec(C[cat].cd)}`).join(', ')}).
      Seuchen-Zauber kosten hier Mana statt Leben.` };
}

// name, color: Überschrift; rows: Stand jetzt (nur im Lauf); rules: Regeln, auch fürs Hauptmenü
function figure() {
  if (mage.skin === 'krieger') return warrior();
  if (mage.skin === 'klinge') return klinge();
  if (batteryMode()) return battery();
  if (modValue('lifeCost')) return plague();
  const school = meterSchool();
  if (school === 'Feuer') return fire();
  if (school === 'Frost') return frost();
  if (school === 'Arkan') return arcane();
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
