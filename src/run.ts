// Run-Lebenszyklus (ARCH-06, aus player.ts): neuer Run (resetGame über onRunReset), Map neu, Dev-Zonenwechsel und -Level, Abschluss und Tod.
import * as THREE from 'three';
import { state, player } from './state';
import { $ } from './util';
import { CFG, resetMods, LEVEL_START, CARD_CLASSIC_EVERY } from './config';
import { maxHp, maxMana } from './formulas';
import { heightAt, zone, zoneId, buildWorld } from './world';
import { groundCursor } from './fx/spellFx';
import { cam } from './camera';
import { fmtTime } from './ui/fmt';
import { rankAllSpells } from './cards';
import { useMeleeBinds } from './input';
import { fillPacks, removeMob, announceNewMobs } from './mobs';
import { clearAbilities } from './abilities';
import './score';   // resetScore meldet sich per onRunReset an; Import bleibt für die Lade-Reihenfolge
import { stopChannel, stopDrink, modRule } from './spells';
import { startHeroRun, endHeroRun } from './models/heroModel';
import './waves';   // resetWaves meldet sich per onRunReset an; Import bleibt für die Lade-Reihenfolge
import { isWarrior } from './modifiers';
import './figures';   // resetFigures meldet sich per onRunReset an; Import bleibt für die Lade-Reihenfolge
import { t } from './i18n';
import './loot';   // resetLoot meldet sich per onRunReset an; Import bleibt für die Lade-Reihenfolge
import './portal';   // resetPortal meldet sich per onRunReset an; Import bleibt für die Lade-Reihenfolge
import { hooks, onRunReset } from './hooks';
import { resetHeldXp, cardAtLevel, updateCardQueue } from './player/xp';
const ui = hooks.ui;   // Fenster und Menüs (hooks.ts UiApi, ui/connect.ts setzt ein)

// Neuer Run auf einer generierten Map: Map mit neuem Seed neu bauen (vor resetGame, das den Spieler auf zone.spawn setzt)
export function newRunMap() { if (zone.gen) buildWorld(zoneId); }

// Neuer Run: alle Teile, die sich per onRunReset (hooks.ts runReset) angemeldet haben, in rank-Reihenfolge (ARCH-05).
// Die Ränge stehen in hooks.ts; die Teile des Spielers (bis E10 in player.ts) folgen hier.
export function resetGame() {
  for (const fn of hooks.runReset.fns) fn();
}
onRunReset(() => {
  startHeroRun();
  for (const m of state.mobs) removeMob(m);
  clearAbilities();
  state.mobs = [];
}, 10);
onRunReset(resetMods, 20);
// 30 score.ts resetScore
onRunReset(() => {
  state.cardRanks = {};
  state.cardPicks = {};
  state.now = 0;
  state.runNo = (state.runNo ?? 0) + 1;   // objects/: neuer Run = Objekte neu
  state.pendingLevelUps = 0;
  resetHeldXp();
  state.nextCardAt = 0;
  state.cardRush = false;
  state.newMob = null;
  state.autorun = false;
  Object.assign(player, {
    pos: new THREE.Vector3(zone.spawn.x, heightAt(zone.spawn.x, zone.spawn.z), zone.spawn.z), vel: new THREE.Vector3(), grounded: true,
    facing: Math.PI, slowUntil: 0, stunUntil: 0, iceUntil: 0, poison: null, moveState: 'idle', moveSpeed: CFG.runSpeed, landAt: -1e9, level: LEVEL_START, xp: 0,
    lastManaUse: -1e9, nextRegen: CFG.regenTick, cds: {}, castAnimUntil: 0,
    channel: null, drink: null, targeting: false, lastCombat: -1e9, dead: false, won: false, kills: 0, invulnUntil: 0, rebornUntil: 0, riseAt: -1e9,
  });
  cam.offset = 0;
  player.hp = maxHp();
  player.mana = maxMana();
}, 40);
// 50 realMen.ts, 60 dodge.ts, 70 schoolMeter.ts, 80 figures.ts, 90 legends.ts
onRunReset(() => { player.shield = 0; }, 100);
// 110 buffs.ts
onRunReset(() => useMeleeBinds(isWarrior()), 120);
// 130 battery.ts, 140 spells/plague.ts, 150 loot.ts, 160 portal.ts, 170 waves.ts, 180 leaderboard.ts resetSplits
onRunReset(() => {
  state.devUsed = false;   // Dev-Panel markiert den Run (ui/devPanel.ts)
  groundCursor.visible = false;
  stopChannel();
  fillPacks();
}, 190);

// Dev: Zone wechseln. Mobs weg, Welt neu, Spieler in die Mitte; Level und Karten bleiben
export function switchZone(id) {
  for (const m of state.mobs) removeMob(m);
  clearAbilities();
  state.mobs = [];
  state.autorun = false;
  stopChannel(); stopDrink();
  player.targeting = false;
  groundCursor.visible = false;
  buildWorld(id);
  player.pos.set(zone.spawn.x, heightAt(zone.spawn.x, zone.spawn.z), zone.spawn.z);
  player.vel.set(0, 0, 0);
  player.grounded = true;
  player.facing = Math.PI;
  player.slowUntil = player.stunUntil = 0;
  player.poison = null;
  cam.offset = 0;
  fillPacks();
}

// Dev: Level setzen. Mobs kommen neu, damit die Freischaltung sofort zu sehen ist. Im Run gibt es nach oben die Karten des Kartentakts, ohne Lücke; bisherige Karten bleiben
export function setLevel(level) {
  const fromLevel = player.level;
  player.level = level;
  player.xp = 0;
  player.hp = maxHp();
  player.mana = maxMana();
  switchZone(zoneId);
  announceNewMobs(fromLevel);
  if ($('startModal').classList.contains('show')) return;
  for (let lvl = fromLevel + 1; lvl <= level; lvl++) {
    if (!modRule('noCards')) state.pendingLevelUps += cardAtLevel(lvl) ? 1 : 0;
    else if (lvl % CARD_CLASSIC_EVERY === 0) rankAllSpells();
  }
  state.cardRush = state.pendingLevelUps > 0;
  updateCardQueue();
}

// Abschluss: Level 100 bei Packs, Zeitziel in der Belagerung. Läuft durch den normalen Ergebnis-Screen.
export function completeRun(reason) {
  if (player.dead) return;
  player.won = true;
  player.lastHitBy = reason;
  state.pendingLevelUps = 0;
  $('cardModal').classList.remove('show');
  die();
}

export function die() {
  player.dead = true;
  player.hp = 0;
  endHeroRun();
  ui.fn.showRunResult();
  stopChannel(); stopDrink();
  state.paused = true;
  setTimeout(() => {
    $('deathStats').innerHTML = t('end.deathStats', { lv: player.level, kills: player.kills, time: fmtTime(state.now) });
    $('deathModal').classList.add('show');
  }, 900);
}
