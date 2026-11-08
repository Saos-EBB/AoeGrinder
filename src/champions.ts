// Champion-Packs wie in Diablo 2: 3 Mobs gleichen Typs, mehr Leben und Schaden, mehr XP und Punkte, ein Affix (ab Level 40 zwei).
// Belohnung nur über XP und Punkte. Spawn in mobs.ts (spawnPack), Werte und Affixe hier in C. Kill: Wucht aus wucht.ts.

import { state, player } from './state';
import { $, pick, dist2d } from './util';
import { maxHp } from './formulas';
import { combatText } from './ui/hud';
import { ringFx } from './fx/spellFx';
import { burstFx, FIRE, EMBER } from './spells/fx';
import { schedule } from './spells/core';
import { hitstop } from './fx/impact';
import { W, addTrauma, decal } from './wucht';
import { t, has } from './i18n';

// Alle Zahlen PH
export const C = {
  chance: 0.2, minLevel: 6, secondAffixLevel: 40, size: 4,
  hp: 3, dmg: 1.3, xp: 3,                                   // XP und damit Punkte ×3
  plateColor: '#8fc4ff',                                    // Name und Affixe im Nameplate
  trauma: 0.6,                                              // Kill: starkes Wackeln, Hitstop W.hitstop.championMs, großer Riss W.decal.champion
  affixes: {
    fast: { name: t('affix.fast.name'), move: 1.5, attack: 1.3 },
    strong: { name: t('affix.strong.name'), dmg: 1.5 },
    fire: { name: t('affix.fire.name'), delayMs: 600, radius: 5, dmgPct: 0.12 },   // Explosion nach dem Tod, Schaden in Anteil der Spieler-Leben
    cold: { name: t('affix.cold.name'), slowMs: 2000 },        // 30 % Slow über player.slowUntil (CFG.curseSlow)
    stone: { name: t('affix.stone.name'), taken: 0.7 },                 // erhaltener Schaden, dazu immun gegen Knockback
  },
};
const AFFIX_IDS = Object.keys(C.affixes);

// Würfelt beim Pack-Spawn: null oder die Affixe des Packs
export function rollChampionPack() {
  if (player.level < C.minLevel || Math.random() >= (state.champChance ?? C.chance)) return null;   // champChance: Neumond am Mondsee
  return rollAffixes();
}
export function rollAffixes() {
  const first = pick(AFFIX_IDS);
  if (player.level < C.secondAffixLevel) return [first];
  return [first, pick(AFFIX_IDS.filter(a => a !== first))];
}

// Macht aus einem frisch gespawnten Mob einen Champion
export function makeChampion(m, affixes) {
  const A = C.affixes, has = a => affixes.includes(a);
  m.champion = { affixes };
  m.hp = m.maxHp = Math.round(m.maxHp * C.hp);
  m.dmgMulC = C.dmg * (has('strong') ? A.strong.dmg : 1);
  m.xpMul = C.xp;
  if (has('fast')) { m.speedMul *= A.fast.move; m.swingMul = A.fast.attack; }
  if (has('stone')) { m.takenMul = A.stone.taken; m.noKnock = true; }
  m.plate.style.color = C.plateColor;
  const line = document.createElement('div');
  line.className = 'champAffix';
  line.textContent = affixes.map(a => A[a].name).join(' · ');
  Object.assign(line.style, { fontSize: '10px', color: C.plateColor, textAlign: 'center', lineHeight: '1.1' });
  m.plate.appendChild(line);
}

// Treffer eines Champions am Spieler (mobs.ts hitPlayer)
export function championHitPlayer(m) {
  if (m.champion?.affixes.includes('cold')) player.slowUntil = Math.max(player.slowUntil, state.now + C.affixes.cold.slowMs);
}

// Tod eines Champions (mobs.ts killMob): Wucht, Feuer-Explosion, Text beim letzten des Packs
export function championDied(m, damagePlayer) {
  hitstop(W.hitstop.championMs);
  addTrauma(C.trauma);
  decal(m.pos, 3, W.decal.champion);
  const pos = m.pos.clone();
  if (m.champion.affixes.includes('fire')) {
    const F = C.affixes.fire;
    ringFx(pos, F.radius, [2.4, 0.35, 0.12], F.delayMs);   // Warnung: roter Bodenkreis
    schedule(F.delayMs, () => {
      burstFx(pos, F.radius, [FIRE, EMBER], 0xff7a30);
      addTrauma(0.3);
      if (!player.dead && dist2d(player.pos, pos) <= F.radius) damagePlayer(Math.round(maxHp() * F.dmgPct));
    });
  }
  const pack = state.mobs.filter(o => o.packId === m.packId && o.champion);
  if (pack.every(o => o.dead)) combatText(pos, t('msg.champsDown'), 'info', 3);
}

// Dev: Champion-Pack neben dem Spieler, Affix wählbar
export function devChampionUi(spawnAt) {
  $('devZones').insertAdjacentHTML('afterend', `<div class="title" style="text-align:left;margin:10px 0 6px">Dev: Champions</div>
    <div><select class="bindBtn" id="devChampAffix"><option value="">Zufall</option>${AFFIX_IDS.map(a => `<option value="${a}">${C.affixes[a].name}</option>`).join('')}</select>
    <button class="bindBtn" id="devChamp">Champion-Pack spawnen</button></div>`);
  $('devChamp').addEventListener('click', () => {
    const a = ($('devChampAffix') as HTMLSelectElement).value;
    spawnAt(player.pos.x + 8, player.pos.z + 8, a ? [a] : rollAffixes());
    $('settingsClose').click();
  });
}
