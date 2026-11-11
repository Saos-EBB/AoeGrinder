// Erfahrung, Level-ups und Kartentakt des Spielers (ARCH-06, aus player.ts).
import { state, player } from '../state';
import { $ } from '../util';
import { LEVEL_MAX, CARD_CLASSIC_EVERY, CARD_PACES, LEVEL_UP_HEAL } from '../config';
import { xpNeeded, maxHp, maxMana } from '../formulas';
import { levelUpFx } from '../fx/spellFx';
import { rankAllSpells } from '../cards';
import { announceNewMobs } from '../mobs';
import { modRule } from '../spells';
import { noteSplits } from '../leaderboard';
import { mobMode, cardPaceId } from '../modifiers';
import { t } from '../i18n';
import { milestone, MILESTONES } from '../meta';
import { hooks, emit } from '../hooks';
import { completeRun } from '../run';
const ui = hooks.ui;   // Fenster und Menüs (hooks.ts UiApi, ui/connect.ts setzt ein)

// boss.ts (hooks.ts xpHold): im Bosskampf wird XP gesammelt und erst nach dem Kampf gutgeschrieben (kein Level-up mitten im Kampf)
let heldXp = 0;
export const resetHeldXp = () => { heldXp = 0; };   // run.ts Run-Reset (rank 40)
export function releaseXp() { const xp = heldXp; heldXp = 0; if (xp > 0) gainXp(xp); }
export function levelRefill() {       // Ding heilt wenig und füllt Mana auf, außer bei Kein Trinken (nur Regeneration) und Wut
  player.hp = Math.min(maxHp(), player.hp + maxHp() * LEVEL_UP_HEAL);
  if (!modRule('noDrink') && !player.rageMax) player.mana = maxMana();
}
export function gainXp(xp) {
  if (hooks.xpHold.fn()) { heldXp += xp; return; }
  const fromLevel = player.level;
  player.xp += xp;
  while (player.level < LEVEL_MAX && player.xp >= xpNeeded()) {
    player.xp -= xpNeeded();
    player.level++;
    levelRefill();
    if (!modRule('noCards')) state.pendingLevelUps += cardAtLevel(player.level) ? 1 : 0;
    else if (player.level % CARD_CLASSIC_EVERY === 0) rankAllSpells();   // Classic pur: statt Karten ein Rang, das Spiel läuft weiter
  }
  if (player.level >= LEVEL_MAX) player.xp = 0;
  if (player.level >= MILESTONES.lvl100) milestone('lvl100');   // Meilenstein: Level 100 in einem Run
  announceNewMobs(fromLevel);
  noteSplits(fromLevel);
  if (mobMode === 'packs' && player.level >= LEVEL_MAX && fromLevel < LEVEL_MAX) return hooks.runEnd.fn() ? undefined : completeRun(t('cause.lv100'));   // #boss: erst der finale Boss (boss.ts, hooks.ts runEnd)
  if (player.level > fromLevel) { levelUpFx(); emit('level', player.level); }
  updateCardQueue();
}

const cardPace = () => CARD_PACES.find(p => p.id === cardPaceId);
export function cardAtLevel(level) {
  return level % cardPace().levels.find(b => level <= b.to).every === 0;
}

// Auch mehrere Level auf einmal öffnen nur ein Fenster, die übrigen kommen frühestens nach der Lücke des Kartentakts
export function updateCardQueue() {
  if (state.pendingLevelUps <= 0) { state.cardRush = false; return; }
  if ((state.now < state.nextCardAt && !state.cardRush) || player.dead || $('cardModal').classList.contains('show')) return;
  state.nextCardAt = state.now + cardPace().gap;
  ui.fn.showCards();
}
