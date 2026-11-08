// Arkanes Mal: markiert Mobs, ein anderer Arkan-Treffer lässt das Mal platzen (Haken in core.ts, makeCtx).
// Die Anzeige über dem Mob (schwebendes Oktaeder) liegt in vfx/mobStatus.ts.

import { dist2d } from '../util';
import { state } from '../state';
import { mobsInRadius, applySlow, hasRune, makeCtx, onArcaneHit } from './core';
import { markLook, markPop } from '../vfx/arcaneLook';
import { t } from '../i18n';

const MARK = { dur: 8000, popMul: 0.8 };   // PH; Anzeige über dem Mob: vfx/mobStatus.ts
const LAME = { pct: 0.6, ms: 3000 }, CHAIN_RANGE = 5, BIG = 1.5;             // PH

export const arcmark = {
  name: t('spell.arcmark.name'), desc: t('spell.arcmark.desc'), ranks: ['dmg', 'mana', 'radius'], tags: ['Arkan', 'Fläche', 'Kontrolle'], cls: 'arcane',
  mana: 120, cd: 6000, range: 30, radius: 6, ground: true,   // PH
  runes: [
    { id: 'lame', name: t('spell.arcmark.runes.lame.name'), desc: t('spell.arcmark.runes.lame.desc') },
    { id: 'chain', name: t('spell.arcmark.runes.chain.name'), desc: t('spell.arcmark.runes.chain.desc') },
    { id: 'big', name: t('spell.arcmark.runes.big.name'), desc: t('spell.arcmark.runes.big.desc'), radius: 9 },
  ],
  effect(c, point) {
    const r = c.radius(arcmark.radius) * (hasRune('arcmark', 'big') ? BIG : 1);
    for (const m of mobsInRadius(point, r)) m.markUntil = state.now + MARK.dur;
    markLook(point, r);
  },
};

// dmg: Schaden des auslösenden Treffers vor Wurf und Rüstung
onArcaneHit((m, id, dmg) => {
  if (id === 'arcmark' || !(m.markUntil > state.now)) return;
  m.markUntil = 0;
  markPop(m.pos);
  if (hasRune('arcmark', 'lame')) { if (!m.dead) applySlow(m, LAME.pct, LAME.ms); }
  else makeCtx('arcmark').hit(m, dmg * MARK.popMul);
  if (!hasRune('arcmark', 'chain')) return;
  const next = mobsInRadius(m.pos, CHAIN_RANGE).filter(o => o !== m && !(o.markUntil > state.now)).sort((a, b) => dist2d(a.pos, m.pos) - dist2d(b.pos, m.pos))[0];
  if (next) next.markUntil = state.now + MARK.dur;
});
