// Relikte des Arkanmagiers (v31): Archon (offensiv) und Zeitkrümmung (defensiv). Nur eins pro Run (cards.ts figRelicCards).

import { state, player } from '../state';
import { UNIT } from '../config';
import { maxHp } from '../formulas';
import { arcCharges } from '../schoolMeter';
import { mobsOnLine, forward } from '../melee';
import { showError, combatText, renderActionbar } from '../ui/hud';
import { blinkFx, arcaneExplosionFx } from '../fx/spellFx';
import { archonLook, beamLook, warpLook, warpBack } from '../vfx/arcaneLook';
import { mobsInRadius, cdEnd, startCd, startChannel, noteCastStart, onAnyHit } from './core';
import { blinkTo } from './blink';
import { t } from '../i18n';

// Alle Werte PH. Archon: 10 s, CD 60 s, Kills verlängern (erster +1 s, jeder weitere 10 % weniger, mindestens 0,1 s)
const ARCHON = { ms: 10000, cd: 60000, kill: 1000, killDecay: 0.9, killMin: 100, beam: { len: 25, width: 2, dps: 3, ms: 3000 }, nova: { radius: 10, dmg: 4, cd: 2000 }, port: { yd: 15, cd: 3000 } };
const WARP = { ms: 4000, cd: 60000 };

// ---------- Archon ----------
export function archonActive() { return !!state.archon && state.archon.until > state.now; }
function startArchon() {
  state.archon = { until: state.now + ARCHON.ms, kills: 0, saved: state.slots.slice(0, 3) };
  state.slots.splice(0, 3, 'archBeam', 'archNova', 'archPort');
  renderActionbar();
  archonLook(archonActive);
  combatText(player.pos, 'Archon!', 'info', 3);
}
export function endArchon() {
  if (!state.archon) return;
  state.slots.splice(0, 3, ...state.archon.saved);
  state.archon = null;
  renderActionbar();
}
// Kills im Archon verlängern ihn
onAnyHit(m => {
  if (!m.dead || !archonActive()) return;
  const a = state.archon;
  a.until += Math.max(ARCHON.killMin, ARCHON.kill * ARCHON.killDecay ** a.kills);
  a.kills++;
});

export const archon = {
  name: t('spell.archon.name'), figRelic: true, desc: t('spell.archon.desc'), ranks: [], tags: ['Arkan'], cls: 'arcane',
  mana: 0, cd: ARCHON.cd,
  press() {
    if (archonActive()) return;
    if (cdEnd('archon') > state.now) return showError('Fähigkeit ist noch nicht bereit');
    if (arcCharges() < 4) return showError('Archon braucht 4 Ladungen');
    startCd('archon');
    noteCastStart('archon');
    startArchon();
  },
};

const archonSpell = (name, desc, cd, effect, extra = {}) => ({ name, desc, ranks: [], tags: ['Arkan'], cls: 'arcane', fixed: true, mana: 0, cd, effect, ...extra });
export const archBeam = archonSpell(t('spell.archBeam.name'), t('spell.archBeam.desc'), 0, c => {
  const ch = startChannel(c, player.pos, ARCHON.beam.ms);
  ch.mobile = true;
}, {
  channel: ARCHON.beam.ms,
  tick(ch) {
    const f = forward(), to = { x: player.pos.x + f.x * ARCHON.beam.len, y: player.pos.y, z: player.pos.z + f.z * ARCHON.beam.len };
    for (const m of mobsOnLine(player.pos, to, ARCHON.beam.width)) ch.c.hit(m, ARCHON.beam.dps * UNIT);
    beamLook(player.pos, to as any, .9, 1.4);
  },
});
export const archNova = archonSpell(t('spell.archNova.name'), t('spell.archNova.desc'), ARCHON.nova.cd, c => {
  const r = c.radius(ARCHON.nova.radius);
  for (const m of mobsInRadius(player.pos, r)) c.hit(m, ARCHON.nova.dmg * UNIT);
  arcaneExplosionFx(player.pos, r);
});
export const archPort = archonSpell(t('spell.archPort.name'), t('spell.archPort.desc'), ARCHON.port.cd, () => {
  const from = player.pos.clone(), f = forward();
  blinkTo(from.x + f.x * ARCHON.port.yd, from.z + f.z * ARCHON.port.yd);
  blinkFx(from, player.pos);
});

// ---------- Zeitkrümmung ----------
export const timewarp = {
  name: t('spell.timewarp.name'), figRelic: true, desc: t('spell.timewarp.desc'), ranks: [], tags: ['Arkan'], cls: 'arcane',
  mana: 0, cd: WARP.cd,
  press() {
    if (cdEnd('timewarp') > state.now) return showError('Fähigkeit ist noch nicht bereit');
    startCd('timewarp');
    noteCastStart('timewarp');
    state.warp = { pos: player.pos.clone(), hp: player.hp, at: state.now + WARP.ms };
    warpLook(player.pos, WARP.ms);
  },
};

// Pro Frame aus figures.ts
export function updateArcRelics() {
  if (state.archon && state.archon.until <= state.now) endArchon();
  const w = state.warp;
  if (w && state.now >= w.at && !player.dead) {
    const from = player.pos.clone();
    player.pos.copy(w.pos);
    player.hp = Math.min(maxHp(), w.hp);
    warpBack(from, player.pos);
    state.warp = null;
  }
}
