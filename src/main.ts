import { state, player } from './state';
import { rand, clamp, dist2d, lerpTo } from './util';
import { CFG, SPELLS, mods } from './config';
import { blizRadius } from './formulas';
import { scene, composer, tickHeat } from './render';
import { heightAt, drape, zone, updateZoneEvent } from './world';
import { particles } from './fx/particles';
import { mage } from './models/mage';
import { blizCursor, blizFx, FROST_WHITE, ambientParticles, updateEffects, resetShard } from './fx/spellFx';
import { cam, updateCamera } from './camera';
import { refreshKeyLabels, updateHud, updatePerf } from './ui/hud';
import { binds, mouse, pressSpell, pickGround } from './input';
import { updateRespawn, spawnMob, enterCombat, updateMob, separateMobs, sinkCorpse, removeMob } from './mobs';
import { updateAbilities } from './abilities';
import { cast } from './spells';
import { resetGame, updatePlayer, switchZone } from './player';
import { pad, pollGamepad, updatePadCamera } from './gamepad';
import './ui/menus';

function update(dt) {
  updatePadCamera(dt);
  updatePlayer(dt);
  for (const m of state.mobs) updateMob(m, dt);
  separateMobs();
  updateAbilities(dt);
  updateZoneEvent(dt);

  // Leichen nach 4 s entfernen, Packs nachspawnen
  state.mobs = state.mobs.filter(m => {
    if (m.dead && state.now - m.deathAt > 4000) { removeMob(m); return false; }
    return true;
  });
  updateRespawn();
}

function updateVisuals(dt) {
  updateCamera();
  if (player.targeting && !state.padAim) pickGround();

  mage.root.position.copy(player.pos);
  mage.root.rotation.y = player.facing;
  const castT = clamp((player.castAnimUntil - state.now) / 450, 0, 1);
  const landT = clamp((state.now - player.landAt) / 300, 0, 1);    // Landung: kurz einknicken, im Lauf schwächer
  const squat = Math.sin(Math.min(1, landT * 2.4) * Math.PI / 2) * (1 - landT) * (player.moveState === 'idle' ? 0.95 : 0.5);
  mage.update(dt, {
    state: player.dead ? 'dead' : player.drink ? 'sit' : !player.grounded ? 'air' : player.moveState,
    speed: player.moveSpeed, vy: player.vel.y, squat,
    channel: !!player.channel, cast: Math.sin(castT * Math.PI),
  });

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
  if (blizFx.g.visible) {
    const cl = blizFx.cloud;
    cl.rotation.y += dt / 1000 * 0.4;
    cl.scale.setScalar(lerpTo(cl.scale.x, blizRadius() / 8, Math.min(1, dt / 150)));   // Wolke baut sich auf
    for (const sh of blizFx.shards) {
      sh.position.y -= sh.userData.speed * (state.paused ? 0 : dt) / 1000;
      if (sh.position.y < 0) {
        const wx = blizFx.g.position.x + sh.position.x, wz = blizFx.g.position.z + sh.position.z;
        for (let i = 0; i < 3; i++) particles.spawn({ x: wx, y: heightAt(wx, wz) + 0.1, z: wz,
          vx: rand(-2, 2), vy: rand(1, 3), vz: rand(-2, 2), grav: 6, life: rand(0.2, 0.4), color: FROST_WHITE, size: rand(0.12, 0.25) });
        resetShard(sh, false);
      }
    }
  }
  ambientParticles(state.paused ? 0 : dt);
  particles.update(state.paused ? 0 : dt);
  updateEffects();
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(50, t - last);
  last = t;
  pollGamepad();
  if (!state.paused) { state.now += dt; update(dt); }
  updateVisuals(dt);
  tickHeat(t);
  composer.render();
  updatePerf(t);
  updateHud();
  requestAnimationFrame(loop);
}

resetGame();
refreshKeyLabels();
requestAnimationFrame(loop);

// Für Tests
(window as any).__game = { player, get mobs() { return state.mobs; }, get mods() { return mods; }, cast, pressSpell, CFG, cam, binds: () => binds, pad, mage, state, get zone() { return zone; }, switchZone, spawnMob, enterCombat };
