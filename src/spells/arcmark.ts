// Arkanes Mal: markiert Mobs, ein anderer Arkan-Treffer lässt das Mal platzen (Haken in core.ts, makeCtx).
// Die Anzeige über dem Mob (schwebendes Oktaeder) liegt in vfx/mobStatus.ts.

import { dist2d } from '../util';
import { state } from '../state';
import { ringFx } from '../fx/spellFx';
import { mobsInRadius, applySlow, hasRune, makeCtx, onArcaneHit } from './core';
import { burstFx, SHADOW, VOID } from './fx';

const MARK = { dur: 8000, popMul: 0.8 };   // PH; Anzeige über dem Mob: vfx/mobStatus.ts
const LAME = { pct: 0.6, ms: 3000 }, CHAIN_RANGE = 5, BIG = 1.5;             // PH

export const arcmark = {
  name: 'Arkanes Mal', desc: 'Bodenziel: markiert alle Mobs in 6 yd für 8 s. Trifft ein anderer Arkan-Spell, platzt das Mal: +80 % des Treffers als Extra-Schaden.', ranks: ['dmg', 'mana', 'radius'], tags: ['Arkan', 'Fläche', 'Kontrolle'], cls: 'arcane',
  mana: 120, cd: 6000, range: 30, radius: 6, ground: true,   // PH
  runes: [
    { id: 'lame', name: 'Lähmendes Mal', desc: 'Platzen verlangsamt um 60 % für 3 s statt Extra-Schaden.' },
    { id: 'chain', name: 'Kettenmal', desc: 'Platzen markiert 1 Mob in 5 yd neu.' },
    { id: 'big', name: 'Großes Mal', desc: 'Radius ×1,5.', radius: 9 },
  ],
  effect(c, point) {
    const r = c.radius(arcmark.radius) * (hasRune('arcmark', 'big') ? BIG : 1);
    for (const m of mobsInRadius(point, r)) m.markUntil = state.now + MARK.dur;
    ringFx(point, r, SHADOW, 500);
  },
};

// dmg: Schaden des auslösenden Treffers vor Wurf und Rüstung
onArcaneHit((m, id, dmg) => {
  if (id === 'arcmark' || !(m.markUntil > state.now)) return;
  m.markUntil = 0;
  burstFx(m.pos, 1.2, [SHADOW, VOID], 0xb070ff);
  if (hasRune('arcmark', 'lame')) { if (!m.dead) applySlow(m, LAME.pct, LAME.ms); }
  else makeCtx('arcmark').hit(m, dmg * MARK.popMul);
  if (!hasRune('arcmark', 'chain')) return;
  const next = mobsInRadius(m.pos, CHAIN_RANGE).filter(o => o !== m && !(o.markUntil > state.now)).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos))[0];
  if (next) next.markUntil = state.now + MARK.dur;
});
