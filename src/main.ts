import { state, player } from './state';
import { clamp, dist2d } from './util';
import { CFG, SPELLS, mods, PERF } from './config';
import { blizRadius, maxHp } from './formulas';
import { composer, tickHeat, renderer, camera } from './render';
import { drape, zone, updateZoneEvent } from './world';
import { particles } from './fx/particles';
import { mage } from './models/mage';
import { blizCursor, updateBlizFx, ambientParticles, updateEffects } from './fx/spellFx';
import { hitstopDt } from './fx/impact';
import { cam, updateCamera, updateAutoCam } from './camera';
import { refreshKeyLabels, updateHud, updatePerf, combatText } from './ui/hud';
import { binds, mouse, mouseBtn, pressSpell, pickGround } from './input';
import { updateRespawn, spawnMob, enterCombat, updateMob, separateMobs, sinkCorpse, removeMob } from './mobs';
import { updateAbilities } from './abilities';
import { updateSkinFx } from './skinFx';
import { updateRealMen, realMenAnim, warTimeScale } from './realMen';
import { updateWaves } from './waves';
import { cast } from './spells';
import { resetGame, updatePlayer, switchZone, updateCardQueue } from './player';
import { pad, pollGamepad, updatePadCamera } from './gamepad';
import './ui/theme.css';
import './ui/uiSettings';
import './ui/flavors';
import './ui/menus';
import './mobile';
import { mount as mountSaveCode } from './ui/saveCode';
import { mount as mountAchievements } from './ui/achievements';
// Für Tests: dieselben Modul-Instanzen wie im Spiel
import * as coreMod from './spells/core';
import * as configMod from './config';
import * as formulasMod from './formulas';
import * as playerMod from './player';
import * as cardsMod from './cards';
import * as weaponMod from './weaponRolls';
import * as metaMod from './meta';
import { initGear } from './gear';
import { normalizeMeta } from './metaNormalize';
import * as modifiersMod from './modifiers';
import * as supportsMod from './spells/supports';
import * as meterMod from './schoolMeter';
import * as buffsMod from './buffs';
import { menuYaw, enterMenu, menuShowcase } from './ui/mainMenu';
import { renderFigPreview } from './ui/figPreview';
import * as menuMod from './ui/mainMenu';
import './ui/settingsView';
import './ui/devPanel';
import * as cardsUiMod from './ui/menus';
import { updateWucht } from './wucht';
import { updateEnergy, figureLook } from './vfx/energy';
import { updateBolts } from './vfx/boltLook';
import { dodgeVisual, updateDodgeHud, mobAttackSlow } from './dodge';
import { initDunkel, updateDunkel } from './dunkel';
import { updateMinimap } from './ui/minimap';
import { updateSkinTalk } from './ui/skinTalk';
import { run } from './score';
import { updateMobStatus } from './vfx/mobStatus';
import { poisoned } from './plagueMarks';
import { phoenixRise } from './spells/phoenix';
import { updateFigures } from './figures';
import { updateLoot } from './loot';
import { updatePortal } from './portal';
import { updateMapProgress } from './mapgen/progress';
import './ui/worldMap';
import { syncObjects, updateObjects } from './objects';
import { updateLegends } from './legends';
import { meltScale } from './spells/plague';
import { meterStage, meterOverheated, meterSchool, meterValue } from './schoolMeter';
import { batteryMode, batteryMax } from './battery';
import { updateBoss, updateBossVisuals, bossBusy, bossTimeScale } from './boss';
import { updateFigEvents } from './figEvents';
import { hooks } from './hooks';
import { mountDev } from './ui/devGame';
// Start in fester Reihenfolge, wenn alle Module geladen sind (keine Seiteneffekt-Imports mehr für diese Teile)
mountSaveCode();       // Spielstand-Code: Fenster und Einträge im „Mehr“-Menü
mountAchievements();   // Einblendung neuer Erfolge, vor initGear (dort können Erfolge entstehen)
initGear(normalizeMeta);   // gespeicherten Stand säubern
hooks.figSay.set(text => combatText(player.pos, text, 'info', 3.2));   // Sprechblasen der Kosmetik über der Figur
hooks.switchZone.set(switchZone);   // Portal (portal.ts)
mountDev();   // Dev-Panel-Blöcke (ui/devGame.ts)

function update(dt) {
  updatePadCamera(dt);
  updatePlayer(dt);
  for (const m of state.mobs) updateMob(m, dt);
  separateMobs();
  updateAbilities(dt);
  updateSkinFx();
  updateRealMen(dt);
  updateZoneEvent(dt);
  updateFigures();
  updateLoot();   // Gear-Drops: Lichtsäulen, Aufheben
  updatePortal(); // Portale im Run (Level 25/50/75, Wellen: nach dem Boss)
  updateMapProgress();   // Weltkarte: Level 100 öffnet das nächste Theme
  updateObjects(dt);     // Map-Objekte: Schreine, Truhen, Fässer, Schatzdieb (objects/)
  updateLegends();
  updateBoss(dt);

  // Leichen nach 4 s entfernen, Packs nachspawnen
  state.mobs = state.mobs.filter(m => {
    if (m.dead && state.now - m.deathAt > 4000) { removeMob(m); return false; }
    return true;
  });
  if (!bossBusy()) updateRespawn();   // Boss-Kampf: kein Nachschub
  updateWaves(dt);
  updateCardQueue();
}

function updateVisuals(dt) {
  syncObjects();   // neue Map / neuer Run: Objekte neu setzen (auch im Hauptmenü)
  updateAutoCam(dt, mouseBtn.left);
  updateDunkel(dt);
  updateCamera();
  if (player.targeting && !state.padAim) pickGround();

  mage.root.position.copy(player.pos);
  mage.root.rotation.y = player.facing + menuYaw();
  const rise = phoenixRise();                                      // Phönix: Figur wächst aus dem Boden hoch
  const melt = meltScale();                                        // Seuchenmagier: zerfließt
  mage.root.scale.set(1, Math.min(0.15 + 0.85 * rise, melt), 1);
  const castT = clamp((player.castAnimUntil - state.now) / 450, 0, 1);
  const landT = clamp((state.now - player.landAt) / 300, 0, 1);    // Landung: kurz einknicken, im Lauf schwächer
  const squat = Math.sin(Math.min(1, landT * 2.4) * Math.PI / 2) * (1 - landT) * (player.moveState === 'idle' ? 0.95 : 0.5);
  const show = menuShowcase();   // Hauptmenü: Ladungsstufen durchlaufen
  mage.setMeter(show ? show.meter : figureLook.meter ?? (batteryMode() ? player.mana / batteryMax() : meterSchool() ? (meterOverheated() ? 1 : meterValue()) : 0));
  mage.update(dt, {
    state: player.dead && !player.won ? 'dead' : player.dead ? 'idle' : player.drink ? (player.drink.pose === 'charge' ? 'idle' : 'sit') : !player.grounded ? 'air' : state.paused ? 'idle' : player.moveState,   // Pause: keine Schritte, sonst entstehen Spuren
    speed: player.moveSpeed, vy: player.vel.y, squat,
    channel: !!player.channel, cast: Math.sin(castT * Math.PI), stage: show ? show.stage : meterStage(), smoke: meterOverheated(), charge: player.drink?.pose === 'charge', over: !!player.overcharged, drinkSkin: player.drink?.skin, lowHp: player.hp / Math.max(1, maxHp()), kills: run.kills, ...realMenAnim(), ...(show ? { rage: show.meter * (player.rageMax > 1 ? player.rageMax : 100), berserk: show.stage === 3, h3: show.stage === 3 } : {}),
  });
  updateFigEvents(mage.hero?.element ?? null);   // Werte und Ereignisse für die Figur (Kosmetik)
  dodgeVisual(mage.root);
  updateDodgeHud();
  if (state.paused && mage.trail) mage.trail.update(-Math.max(0, dt) / 1000);   // Spuren altern in der Pause nicht

  updateBossVisuals(dt);
  frameNo++;
  for (const m of state.mobs) {
    // Hinter dem Nebel: weder zeichnen noch animieren. Im Halbdunkel jeden 2. Frame mit doppeltem dt.
    const d = camera.position.distanceTo(m.pos), show = d < PERF.mobHideYd;
    if (m.model.root.visible !== show) m.model.root.visible = show;
    if (!show) { m.animDt = 0; if (m.dead) sinkCorpse(m); continue; }
    m.animDt = (m.animDt ?? 0) + dt;
    if (d > PERF.mobHalfYd && (frameNo + m.packId) % 2) continue;
    const mdt = m.animDt;
    m.animDt = 0;
    const attackT = (state.now - m.attackAt) / 400 * mobAttackSlow();   // Dev: Angriffe sichtbar langsamer
    m.model.update(mdt, {
      state: m.dead ? 'dead' : m.moving ? 'run' : 'idle', speed: m.speed || CFG.mobSpeed,
      frozen: !m.dead && m.rootUntil > state.now, iced: !m.dead && m.rootUntil > state.now && m.rootLook === 'ice', slowed: m.slowUntil > state.now,
      poisoned: !m.dead && poisoned(m), feared: !m.dead && m.state === 'flee',
      attack: attackT >= 0 && attackT < 1 ? attackT : 0,
      flash: clamp(1 - (state.now - (m.hitAt ?? -1e9)) / 140, 0, 1), champion: m.bossTint ?? !!m.champion,
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
  updateEnergy(state.paused ? 0 : dt / 1000);
  updateBolts(state.paused ? 0 : dt / 1000);
  updateMobStatus(state.paused ? 0 : dt / 1000);
  updateWucht();
}

let last = performance.now(), frameNo = 0;
function loop(t) {
  const dt = Math.min(50, t - last);
  last = t;
  pollGamepad();
  const simDt = hitstopDt(dt) * bossTimeScale() * warTimeScale();   // Boss-Tod: Stopp und Zeitlupe; Finisher-Stufe: Zeitlupe
  if (!state.paused && simDt > 0) { state.now += simDt; update(simDt); }
  updateVisuals(dt);
  tickHeat(t);
  renderFigPreview();   // Charakterfenster (heroWindow.ts): Figur in die Vorschau, wird gleich übermalt
  composer.render();
  updatePerf(t);
  updateHud();
  updateMinimap();
  updateSkinTalk(dt);   // Sprechblasen der Krieger-Skins
  requestAnimationFrame(loop);
}

resetGame();
initDunkel();
enterMenu();
refreshKeyLabels();
requestAnimationFrame(loop);

// Für Tests
(window as any).__game = { player, get mobs() { return state.mobs; }, get mods() { return mods; }, cast, pressSpell, CFG, cam, binds: () => binds, pad, mage, state, renderer, get zone() { return zone; }, switchZone, spawnMob, enterCombat,
  m: { menu: menuMod, cardsUi: cardsUiMod, core: coreMod, config: configMod, formulas: formulasMod, player: playerMod, cards: cardsMod, weapons: weaponMod, meta: metaMod, modifiers: modifiersMod, supports: supportsMod, meter: meterMod, buffs: buffsMod } };
