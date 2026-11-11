// Setzt die Fenster und Menüs in hooks.ui ein (ARCH-02 Rest, E10): Spiel und Eingabe (run.ts, player/xp.ts, input.ts, gamepad.ts, mobile.ts, waves.ts)
// rufen hooks.ui.fn.*, statt ui/-Fenster zu importieren. main.ts ruft connectUi() als Erstes, vor jedem Ereignis.
import { hooks } from '../hooks';
import { showCards, closeBinds, closeResetConfirm, renderBinds, setBind } from './menus';
import { showRunResult } from './leaderboardView';
import { renderMenu, openPause, closePause, pauseOpen, menuOpen, cycleChar, cycleMap } from './mainMenu';
import { heroOpen, toggleHero, closeHero, heroCommand } from './heroWindow';

export function connectUi() {
  hooks.ui.set({ showCards, showRunResult, renderMenu, openPause, closePause, pauseOpen, menuOpen, cycleChar, cycleMap,
    heroOpen, toggleHero, closeHero, heroCommand, closeBinds, closeResetConfirm, renderBinds, setBind });
}
