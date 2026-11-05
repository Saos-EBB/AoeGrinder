import { state, player } from '../state';
import { iceAge, frozenGroundTick } from '../figures';
import { iceTex } from '../fx/spellFx';
import { fieldDecal } from './fx';
import { mods } from '../config';
import { blizRadius } from '../formulas';
import { blizStart, blizMove, blizStop } from '../fx/spellFx';
import { groundAt } from '../collision';
import { applyRoot } from '../mobs';
import { mobsInRadius, applySlow, startChannel, hasRune, addField } from './core';

const FIELD = { radius: 10, ms: 8000 }, EYE_MS = 8000, STORM_EYE_MS = 300;   // PH: Eisfeld, Frostauge, Sturmauge pro Rang

const WANDER_SPEED = 3;     // PH: yd/s
const LAST_TICK_ROOT = 4000;   // PH

// Ein Blizzard-Tick, auch für Eisfeld und Frostauge. Sturmauge: jeder Tick kürzt die Frostkugel-Abklingzeit
function tickAt(c, point, radius, last, k = 1) {
  for (const m of mobsInRadius(point, radius)) {
    if (!c.hit(m, bliz.tickDmg * k) || m.dead) continue;
    if (mods.blizSlow > 0) applySlow(m, mods.blizSlow, 1500);
    if (last && hasRune('bliz', 'lastfreeze')) applyRoot(m, LAST_TICK_ROOT, 'ice');
  }
  if (mods.stormEye && player.cds.frostorb > state.now) player.cds.frostorb -= STORM_EYE_MS * mods.stormEye;
}

export const bliz = {
  get name() { return iceAge() ? 'Eisfeld' : 'Blizzard'; },
  get desc() { return iceAge() ? 'Gefrorener Boden 10 yd für 8 s, ohne Kanal, die Blizzard-Ticks laufen von selbst.' : 'Kanal aufs Bodenziel, 8 Ticks.'; }, ranks: ['dmg', 'mana', 'radius'], tags: ['Frost', 'Fläche', 'Kanal'], cls: 'frost',
  mana: 320, cd: 0, tickDmg: 26, channel: 8000, range: 30, radius: 8, ground: true,   // Rang 1 Wowhead, Radius PH
  runes: [
    { id: 'walk', name: 'Wandelnder Sturm', desc: 'Laufen erlaubt, halber Schaden.' },
    { id: 'wander', name: 'Treibender Sturm', desc: 'Wandert zum Spieler.' },
    { id: 'lastfreeze', name: 'Letzter Frost', desc: 'Letzter Tick friert ein.' },
  ],
  effect(c, point) {
    // Eiszeit: Eisfeld. Frostauge: solange eine Frostkugel fliegt, läuft der Blizzard von selbst
    const eye = mods.frostEye && state.fields.some(f => f.orb);
    if (iceAge() || eye) {
      const radius = iceAge() ? c.radius(FIELD.radius) : blizRadius();
      addField(c, { pos: point, radius, dur: iceAge() ? FIELD.ms : EYE_MS, tickMs: 1000, visual: fieldDecal(iceTex, [0.35, 1, 2.1], iceAge() ? 0.5 : 0.25),
        onTick: f => { tickAt(c, f.pos, f.radius, false); if (iceAge()) frozenGroundTick(f); },
        onUpdate: f => { if (iceAge()) frozenGroundTick(f); },
      });
      return;
    }
    const ch = startChannel(c, point.clone(), bliz.channel);
    ch.mobile = hasRune('bliz', 'walk');
    blizStart(point, blizRadius());
  },
  tick(ch) {
    tickAt(ch.c, ch.point, blizRadius(), ch.nextTick > ch.end, ch.mobile ? 0.5 : 1);
  },
  channelUpdate(ch, dt) {
    if (!hasRune('bliz', 'wander')) return;
    const dx = player.pos.x - ch.point.x, dz = player.pos.z - ch.point.z, d = Math.hypot(dx, dz);
    if (d < 0.1) return;
    const step = Math.min(d, WANDER_SPEED * dt / 1000);
    ch.point.x += dx / d * step;
    ch.point.z += dz / d * step;
    ch.point.y = groundAt(ch.point.x, ch.point.z, ch.point.y);
    blizMove(ch.point, blizRadius());
  },
  onChannelEnd() {
    blizStop();
  },
};
