// Boss-Regeln aus dem Boss-Viewer (RULE). Eine Regel läuft einmal beim Kampfstart: (f, p) → hängt sich in f.hooks ein.
// Haken: tick(dt) jedes Bild, onPlayerHit(body), onDodged(body), dmgTaken(body, amount) → amount, onBodyDeath(body), onEnd(pos), bar() → Zusatztext der Boss-Leiste, cleanup().
// Einmalige Auslöser (HP-Schwelle, Zeit) prüft die Regel selbst in tick. Werte aus RULE_P (roster.ts) oder hier, alle // PH

import { state, player } from '../state';
import { meta, saveMeta } from '../meta';
import { mage } from '../models/mage';
import { rollWeapon, rollTier, inventoryFull } from '../weaponRolls';
import { CARD_RARITIES } from '../config';
import { boom, PAL } from '../vfx/energy';
import { addTrauma } from '../wucht';
import { textAt, impactFx, V, gy } from './core';

// Summe der Boss-Leben (boss.ts hängt sie an f.hp)
const hpFrac = f => { const { hp, max } = f.hp(); return hp / Math.max(1, max); };
const mainBody = f => f.bodies.find(b => b.mob && !b.mob.dead) ?? f.bodies[0];

export const RULE: Record<string, (f: any, p: any) => void> = {
  // Enrage: ab HP-Schwelle (hp) oder nach Zeit (after s). Tempo (Laufen und Ausholen) und Schaden steigen. Zeit-Enrage zeigt einen Timer an der Leiste
  enrage(f, p) {
    let on = false;
    const fire = () => {
      on = true;
      f.speedMul = (f.speedMul ?? 1) * (p.speed ?? 1);
      f.windMul = (f.windMul ?? 1) / (p.speed ?? 1);
      f.dmgMul = (f.dmgMul ?? 1) * (p.dmg ?? 1);
      for (const b of f.bodies) if (b.mob) { b.mob.bossTint = 'boss2'; impactFx(b.mob.pos, 6, 0xff2a2a, .8); textAt(b.mob.pos, 'ENRAGE', 'hurt', 3.5); }
    };
    f.hooks.tick.push(() => { if (!on && (p.after != null ? f.time >= p.after : hpFrac(f) <= (p.hp ?? .2))) fire(); });
    if (p.after != null) f.hooks.bar.push(() => on ? 'ENRAGE' : `Enrage in ${Math.ceil(p.after - f.time)} s`);
  },
  // Hinken: unter hp langsamer, holt länger aus
  hinken(f, p) {
    let on = false;
    f.hooks.tick.push(() => {
      if (on || hpFrac(f) > (p.hp ?? .25)) return;
      on = true;
      f.speedMul = (f.speedMul ?? 1) * (p.speed ?? .6);
      f.windMul = (f.windMul ?? 1) * (p.wind ?? 1.3);
      textAt(mainBody(f).mob.pos, 'hinkt', 'info', 3);
    });
  },
  // Enge Kammer: kleinere Arena
  arenaRadius(f, p) { f.setArena(p.r ?? 10); },
  // Dauer-Slow über den Spieler-Slow (30 %, CFG.curseSlow), solange der Kampf läuft
  slowAura(f) {
    f.hooks.tick.push(() => { player.slowUntil = Math.max(player.slowUntil, state.now + 300); });
    f.hooks.bar.push(() => 'Frost-Aura: Tempo −30 %');
  },
  // Garantierter Drop: Magier eine Waffe ab Grün, sonst Staub ×3. Inventar voll → Staub
  loot(f, p) {
    f.hooks.onEnd.push(pos => {
      const melee = mage.skin === 'krieger' || mage.skin === 'klinge';
      boom(V(pos.x, gy(pos) + 1, pos.z), 2, PAL.slime, .8, { ground: gy(pos), n: 40 });
      addTrauma(.4);
      if (melee || inventoryFull()) {
        const dust = (p.dust ?? 20) * 3;
        meta.dust += dust; saveMeta();
        textAt(pos, `+${dust} Knochenstaub`, 'xp', 4);
        return;
      }
      const w = rollWeapon(Math.max(2, rollTier()));
      meta.inv.push(w); saveMeta();
      textAt(pos, `Waffe: ${CARD_RARITIES[w.r].name}`, 'heal', 4);
    });
  },
};

// Regeln, die erst in einem späteren Schritt kommen, tun nichts
export function ruleOf(k) { return RULE[k] ?? (() => {}); }
