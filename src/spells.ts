import { state, player } from './state';
import { rand, dist2d } from './util';
import { CFG, SPELLS, mods } from './config';
import { manaCost, spellCd, blizRadius } from './formulas';
import { heightAt, collide, drape } from './world';
import { blizCursor, blizFx, novaFx, arcaneExplosionFx, coneOfColdFx, blinkFx, crystalBurst, resetShard } from './fx/spellFx';
import { showError } from './ui/hud';
import { damageMob, applyRoot } from './mobs';
import { spendMana } from './player';

export function cast(id, point?) {
  if (state.paused || player.dead) return;
  if (state.now < player.gcdUntil || (player.cds[id] || 0) > state.now) return showError('Fähigkeit ist noch nicht bereit');
  const cost = manaCost(id);
  if (player.mana < cost) return showError('Nicht genug Mana');
  if (id === 'bliz' && dist2d(player.pos, point) > SPELLS.bliz.range) return showError('Außer Reichweite');
  if (id === 'drink' && !player.grounded) return showError('Du kannst das nicht im Sprung tun');

  stopChannel();
  stopDrink();
  spendMana(cost);
  player.gcdUntil = state.now + CFG.gcd;
  if (SPELLS[id].cd) player.cds[id] = state.now + spellCd(id);
  if (id !== 'drink' && id !== 'bliz') { player.castAnimUntil = state.now + 450; crystalBurst(SPELLS[id].cls); }
  SPELL_EFFECTS[id](point);
}

const mobsInRadius = (center, r) => state.mobs.filter(m => !m.dead && dist2d(m.pos, center) <= r);

const SPELL_EFFECTS = {
  nova() {
    const s = SPELLS.nova;
    for (const m of mobsInRadius(player.pos, s.radius)) {
      if (damageMob(m, rand(s.min, s.max), 'nova') && !m.dead) applyRoot(m, s.root);
    }
    novaFx(player.pos, s.radius);
  },
  ae() {
    const s = SPELLS.ae;
    for (const m of mobsInRadius(player.pos, s.radius)) damageMob(m, rand(s.min, s.max), 'ae');
    arcaneExplosionFx(player.pos, s.radius);
  },
  bliz(point) {
    player.channel = { id: 'bliz', point: point.clone(), start: state.now, end: state.now + SPELLS.bliz.channel, nextTick: state.now + 1000, delays: 0 };
    player.targeting = false;
    blizCursor.visible = false;
    blizFx.g.position.copy(point);
    drape(blizFx.disc, point, blizRadius());
    for (const sh of blizFx.shards) resetShard(sh, true);
    blizFx.g.visible = blizFx.disc.visible = true;
    blizFx.cloud.scale.setScalar(blizRadius() / 8 * 0.2);
  },
  coc() {
    const s = SPELLS.coc;
    for (const m of mobsInRadius(player.pos, s.range)) {
      const angleToMob = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      const diff = Math.abs(Math.atan2(Math.sin(angleToMob - player.facing), Math.cos(angleToMob - player.facing)));
      if (diff > s.angle / 2) continue;
      if (damageMob(m, rand(s.min, s.max), 'coc') && !m.dead) applySlow(m, s.slow, s.slowDur);
    }
    coneOfColdFx(s.range, s.angle);
  },
  blink() {
    const from = player.pos.clone();
    player.pos.x += Math.sin(player.facing) * SPELLS.blink.dist;
    player.pos.z += Math.cos(player.facing) * SPELLS.blink.dist;
    collide(player.pos, 0.45);
    player.pos.y = heightAt(player.pos.x, player.pos.z);
    player.grounded = true;
    player.vel.set(0, 0, 0);
    blinkFx(from, player.pos);
  },
  drink() {
    player.drink = { start: state.now, end: state.now + SPELLS.drink.dur };
  },
};

// Stärkerer Slow gewinnt; abgelaufener Slow zählt nicht mehr
function applySlow(mob, pct, dur) {
  if (mob.slowUntil <= state.now) mob.slowPct = 0;
  mob.slowPct = Math.max(mob.slowPct, pct);
  mob.slowUntil = Math.max(mob.slowUntil, state.now + dur);
}

export function updateChannel() {
  const ch = player.channel;
  if (!ch) return;
  while (ch.nextTick <= state.now && ch.nextTick <= ch.end) {
    ch.nextTick += 1000;
    for (const m of mobsInRadius(ch.point, blizRadius())) {
      if (damageMob(m, SPELLS.bliz.tick, 'bliz') && !m.dead && mods.blizSlow > 0) applySlow(m, mods.blizSlow, 1500);
    }
  }
  if (state.now >= ch.end) stopChannel();
}

export function stopChannel() {
  player.channel = null;
  blizFx.g.visible = blizFx.disc.visible = false;
}
export function stopDrink() {
  player.drink = null;
}
