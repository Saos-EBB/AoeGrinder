// Mob-Typen: Name, Modell und Fähigkeit (Schlüssel in abilities.ts oder null).

import { buildBoar } from './models/boar';
import { humanoid, quadruped, bat, glowMat } from './models/creatures';

export const MOB_TYPES: any = {
  wildeber: { name: 'Wildeber', build: buildBoar, ability: null },

  // Tirisfal (Werte PH)
  skelett: { name: 'Klapperskelett', ability: null,
    build: humanoid({ skin: 0xc9bf9f, bones: true, weapon: 'sword', eye: glowMat(0.4, 1.8, 0.6), lean: 0.12 }) },
  dunkelhund: { name: 'Verfluchter Dunkelhund', ability: 'leapBite', speedMul: 1.05,
    build: quadruped({ coat: 0x55505e, dark: 0x2b2833, ribs: true, eye: glowMat(0.5, 2.2, 0.5), tailLen: 0.5, ears: 0.26 }) },
  knochenwirker: { name: 'Knochenwirker', ability: 'shadowCaster', hpMul: 0.75,
    build: humanoid({ skin: 0xb5ac92, bones: true, body: 0x2b1f3d, robe: true, hood: true, weapon: 'staff', eye: glowMat(1.2, 0.4, 2.2), lean: 0.1 }) },
  fledermaus: { name: 'Vampir-Fledermaus', ability: 'drainBite', rootImmune: true, hpMul: 0.8, speedMul: 1.1,
    build: bat({ fur: 0x3a2a2a, wing: 0x241a22 }) },
  waechter: { name: 'Scharlachroter Wächter', ability: 'alarm', hpMul: 1.2,
    build: humanoid({ skin: 0xc9a488, body: 0xe8e2d4, tabard: 0xa81818, trim: 0x70161a, sleeve: 0xe8e2d4, helm: 0x8f9299, weapon: 'sword', shield: 0xa81818, lean: 0 }) },
};
