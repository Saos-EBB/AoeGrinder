// Geparkt am 2026-11-08 aus src/ui/charInfo.ts. Imports dafür: arcCharges, arcDmgMul, arcCostMul (schoolMeter.parked.ts), klingeInfo aus '../klinge'.
// figure(): if (mage.skin === 'klinge') return klinge();  …  if (school === 'Arkan') return arcane();

function arcane() {
  const S = SCHOOL_METER.Arkan;
  return { name: S.name, color: S.color, rows: `
    ${kv(t('ci.now'), `${arcCharges()} / ${S.max}`)}
    ${kv(t('ci.arc.dmg'), plus(arcDmgMul()))}
    ${kv(t('ci.arc.cost'), plus(arcCostMul()))}
  `, rules: t('ci.arc.rules', { gain: S.gain.map(name).join(', '), dmg: pc(S.dmg), cost: pc(S.cost), idle: sec(S.idleMs), barrage: name('barrage') }) };
}

function klinge() {
  const { stance, name: sName, bar, inStanceMs, K } = klingeInfo(), B = K.bar, two = K.stance[2], three = K.stance[3];
  return { name: t('ci.stance'), color: COLORS.school.warrior ?? '#d8343c', rows: `
    ${kv(t('ci.now'), `${sName} · ${Math.floor(bar)} / ${B.max}`)}
    ${stance === 2 ? kv(t('ci.blade.toThree', { name: t('klinge.stance.3.name') }), sec(Math.max(0, B.toThreeMs - inStanceMs))) : ''}
  `, rules: t('ci.blade.rules', { unit: B.perUnit, taken: B.perPctTaken, dmg: pc(two.dmg - 1), share: pc(K.bleed.share), ms: sec(K.bleed.ms), max: K.bleed.max,
    min: de(B.toThreeMs / 60000), move: pc(three.move - 1), rate: three.rate, idle: sec(B.idleMs), drain: B.drainPerS }) };
}

