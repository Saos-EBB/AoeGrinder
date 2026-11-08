// Laufende Zustände der Figuren (v31), die keinem einzelnen Spell gehören: Frost-Eissplitter, Eiszeit, gefrorener Boden.
// Pro Frame aus main.ts (updateFigures). Treffer kommen über onAnyHit aus core.ts.

import { state, player } from './state';
import { mods, SLOT } from './config';
import { modValue } from './modifiers';
import { onAnyHit, mobsInRadius, applySlow } from './spells/core';
import { renderActionbar } from './ui/hud';
import { updateArcRelics, endArchon } from './spells/arcRelics';
import { t } from './i18n';

const figure = () => modValue('onlyTag');

// ---------- Frost: Eissplitter ----------
// Jeder Treffer auf einen eingefrorenen Gegner gibt 1 Splitter. Maximum 15, Splitterhagel hebt es, nie über 50 // PH
export const SHARDS = { max: 15, cap: 50 };
export const shardMax = () => Math.min(SHARDS.cap, SHARDS.max + (mods.shardMax ?? 0));
export function takeShards() { const n = state.shards ?? 0; state.shards = 0; return n; }
onAnyHit((m, id, dmg, frozen) => {
  if (figure() !== 'Frost' || !frozen) return;
  state.shards = Math.min(shardMax(), (state.shards ?? 0) + 1);
});

// ---------- Frost: gefrorener Boden (Eiszeit) ----------
// Spieler darauf +20 % Tempo (player.ts liest iceGroundUntil), Gegner −40 % // PH
export const ICE_GROUND = { playerSpeed: 1.2, mobSlow: 0.4 };
export const iceAge = () => !!mods.iceAge && figure() === 'Frost';
export function frozenGroundTick(f) {
  for (const m of mobsInRadius(f.pos, f.radius)) applySlow(m, ICE_GROUND.mobSlow, 300);
  if (Math.hypot(player.pos.x - f.pos.x, player.pos.z - f.pos.z) <= f.radius) player.iceGroundUntil = state.now + 150;
}

export function resetFigures() {
  state.shards = 0;
  state.archon = null; state.warp = null;
  state.keeper = 0; state.chainCount = 0;
  player.iceGroundUntil = 0;
}

export function updateFigures() {
  updateArcRelics();
  if (figure() === 'Frost') {
    player.resNote = t('res.shardNote', { a: state.shards ?? 0, b: shardMax() });
    if (mods.iceAge && state.slots[SLOT.move] !== 'iceage') { state.slots[SLOT.move] = 'iceage'; renderActionbar(); }   // Eiszeit liegt auf der Bewegungs-Taste
  }
}
