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

// Geparkt am 2026-11-08 (Schlagfolge E): Fleischerhaken, Krieger-Legende ohne Platz in der Planung (Krieger: nur Leeroys Klinge und Sions Axt)
// LEG:  meat: { range: 20, stunMs: 1000 },
// LEGENDS: freshmeat: { kind: 'krieger', base: 'sword', name: t('legend.freshmeat.name'), desc: t('legend.freshmeat.desc') },
// EFFECTS:
  freshmeat() {
    const list = mobsInRadius(player.pos, LEG.meat.range, Infinity);
    const t = list.sort((a, b) => (+!!b.champion - +!!a.champion) || b.maxHp - a.maxHp)[0];
    if (!t) return showError(t('msg.noTarget'));
    boltFx({ x: player.pos.x, y: player.pos.y + 1.2, z: player.pos.z }, t.pos, [1.4, 1.2, 1], 300);
    pullMob(t, player.pos, Math.max(0, dist2d(t.pos, player.pos) - 1.5));
    applyRoot(t, LEG.meat.stunMs);
  },
// Imports dafür: dist2d aus './util', pullMob aus './mobs'
// Krieger-Legenden liefen bis dahin über die Waffenwahl im Menü (mage.warWeapon: 'leeroy' | 'freshmeat'), jetzt über warLegendary() in realMen.ts
