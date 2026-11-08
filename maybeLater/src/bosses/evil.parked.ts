// Geparkt am 2026-11-08 aus src/bosses/evil.ts
import { buildKlinge } from '../models/klingeModel';
// MAGE: arkan: 'arkan'; STAFF: arkan: 'zirkelstab'
const KLINGE = { ansturm: 'dash', sog: 'wirbel', explosion: 'e' };
// buildEvil: const hero = mage ? buildStrichMagier(mage) : skin === 'klinge' ? buildKlinge({ bloom: true }) : buildStrichKrieger(…);
  if (skin === 'klinge') hero.setStance?.(2, true);   // zwei Katanas
// strike():
    else if (skin === 'klinge') {
      ability = KLINGE[ctl.atk] ?? null;
      if (!ability) { attack = 'q'; step = seq % 3; }
      dur = 900;
    }
// src/bosses/rules.ts: const melee = mage.skin === 'krieger' || mage.skin === 'klinge';
