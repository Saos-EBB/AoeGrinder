// Geparkt am 2026-11-08 aus src/legends.ts
// Achtfacher Stern (Magier-Legende, Element Arkan): feuert Arkane Geschosse (geparkt). Donnerzorn (thunderfury): Legende des Klingenstrichs.

// LEG
  barrage: { n: 8, range: 30, dmg: 1.3, hasteMs: 10000, haste: 0.25 },
  thunder: { n: 10, range: 12, dmg: 1.2, slow: 0.2, slowMs: 5000 },

// LEGENDS
  barrage: { kind: 'mage', element: 'arkan', name: t('legend.barrage.name'), desc: t('legend.barrage.desc') },
  thunderfury: { kind: 'klinge', name: t('legend.thunderfury.name'), desc: t('legend.thunderfury.desc') },

// activeLegend()
  if (mage.skin === 'klinge') return LEGENDS[mage.klingeWeapon] ? mage.klingeWeapon : null;

// EFFECTS
  barrage() {
    const c = makeCtx('arcmissiles'), targets = nearest(mobsInRadius(player.pos, LEG.barrage.range, Infinity), player.pos);
    if (!targets.length) return;
    for (let i = 0; i < LEG.barrage.n; i++) {
      const t = targets[i % targets.length];
      schedule(i * 90, () => { if (t.dead) return; boltFx({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z }, t.pos, SHADOW, 140); c.hit(t, LEG.barrage.dmg * UNIT); });
    }
    state.castHasteUntil = state.now + LEG.barrage.hasteMs;   // core.ts: Zauberzeit / 1,25
  },
  thunderfury() {
    const c = makeCtx('chain'), first = nearest(mobsInRadius(player.pos, LEG.thunder.range, Infinity), player.pos)[0];
    if (!first) return;
    runChain(c, first, { jumps: LEG.thunder.n, range: LEG.thunder.range, dmg: LEG.thunder.dmg * UNIT, boltColor: BOLT, onHit: m => { if (!m.dead) applySlow(m, LEG.thunder.slow, LEG.thunder.slowMs); } });
  },

export const legendCastMul = () => state.castHasteUntil > state.now ? 1 + LEG.barrage.haste : 1;
// resetLegends setzte dazu state.castHasteUntil = 0; spells/core.ts cast() teilte castTime durch legendCastMul()
// Imports dafür: SHADOW, BOLT aus './spells/fx', runChain aus './spells/chain'
