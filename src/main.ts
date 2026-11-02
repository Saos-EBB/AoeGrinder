import { state, player } from './state';
import { clamp, dist2d } from './util';
import { CFG, SPELLS, mods } from './config';
import { blizRadius } from './formulas';
import { scene, composer, tickHeat } from './render';
import { drape, zone, updateZoneEvent } from './world';
import { particles } from './fx/particles';
import { mage } from './models/mage';
import { blizCursor, updateBlizFx, ambientParticles, updateEffects } from './fx/spellFx';
import { hitstopDt } from './fx/impact';
import { cam, updateCamera, updateAutoCam } from './camera';
import { refreshKeyLabels, updateHud, updatePerf } from './ui/hud';
import { binds, mouse, mouseBtn, pressSpell, pickGround } from './input';
import { updateRespawn, spawnMob, enterCombat, updateMob, separateMobs, sinkCorpse, removeMob } from './mobs';
import { updateAbilities } from './abilities';
import { updateSkinFx } from './skinFx';
import { updateRealMen, realMenAnim } from './realMen';
import { updateHeroes, heroAnim } from './heroes';
import { updateSiege } from './siege';
import { cast } from './spells';
import { resetGame, updatePlayer, switchZone } from './player';
import { pad, pollGamepad, updatePadCamera } from './gamepad';
import './ui/menus';
import { menuYaw, enterMenu } from './ui/mainMenu';

function update(dt) {
  updatePadCamera(dt);
  updatePlayer(dt);
  for (const m of state.mobs) updateMob(m, dt);
  separateMobs();
  updateAbilities(dt);
  updateSkinFx();
  updateRealMen(dt);
  updateHeroes(dt);
  updateZoneEvent(dt);

  // Leichen nach 4 s entfernen, Packs nachspawnen
  state.mobs = state.mobs.filter(m => {
    if (m.dead && state.now - m.deathAt > 4000) { removeMob(m); return false; }
    return true;
  });
  updateRespawn();
  updateSiege(dt);
}

function updateVisuals(dt) {
  updateAutoCam(dt, mouseBtn.left);
  updateCamera();
  if (player.targeting && !state.padAim) pickGround();

  mage.root.position.copy(player.pos);
  mage.root.rotation.y = player.facing + menuYaw();
  const castT = clamp((player.castAnimUntil - state.now) / 450, 0, 1);
  const landT = clamp((state.now - player.landAt) / 300, 0, 1);    // Landung: kurz einknicken, im Lauf schwächer
  const squat = Math.sin(Math.min(1, landT * 2.4) * Math.PI / 2) * (1 - landT) * (player.moveState === 'idle' ? 0.95 : 0.5);
  mage.update(dt, {
    state: player.dead && !player.won ? 'dead' : player.dead ? 'idle' : player.drink ? 'sit' : !player.grounded ? 'air' : state.paused ? 'idle' : player.moveState,   // Pause: keine Schritte, sonst entstehen Spuren
    speed: player.moveSpeed, vy: player.vel.y, squat,
    channel: !!player.channel, cast: Math.sin(castT * Math.PI), ...realMenAnim(), ...heroAnim(),
  });
  if (state.paused && mage.trail) mage.trail.update(-Math.max(0, dt) / 1000);   // Spuren altern in der Pause nicht

  for (const m of state.mobs) {
    const attackT = (state.now - m.attackAt) / 400;
    m.model.update(dt, {
      state: m.dead ? 'dead' : m.moving ? 'run' : 'idle', speed: m.speed || CFG.mobSpeed,
      frozen: !m.dead && m.rootUntil > state.now, slowed: m.slowUntil > state.now,
      attack: attackT >= 0 && attackT < 1 ? attackT : 0,
      flash: clamp(1 - (state.now - (m.hitAt ?? -1e9)) / 140, 0, 1),
    });
    if (m.dead) sinkCorpse(m);
  }

  if (player.targeting) {
    const aim = state.padAim || mouse.ground;
    drape(blizCursor, aim, blizRadius());
    blizCursor.material.color.set(dist2d(player.pos, aim) <= SPELLS.bliz.range ? 0x7fd0ff : 0xff5050);
  }
  updateBlizFx(state.paused ? 0 : dt);
  ambientParticles(state.paused ? 0 : dt);
  particles.update(state.paused ? 0 : dt);
  updateEffects();
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(50, t - last);
  last = t;
  pollGamepad();
  const simDt = hitstopDt(dt);
  if (!state.paused && simDt > 0) { state.now += simDt; update(simDt); }
  updateVisuals(dt);
  tickHeat(t);
  composer.render();
  updatePerf(t);
  updateHud();
  requestAnimationFrame(loop);
}

resetGame();
enterMenu();
refreshKeyLabels();
requestAnimationFrame(loop);

// Für Tests
(window as any).__game = { player, get mobs() { return state.mobs; }, get mods() { return mods; }, cast, pressSpell, CFG, cam, binds: () => binds, pad, mage, state, get zone() { return zone; }, switchZone, spawnMob, enterCombat };
