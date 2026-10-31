// Mob-Typen: Name, Modell und Fähigkeit (Schlüssel in abilities.ts oder null).

import { buildBoar } from './models/boar';
import { humanoid, quadruped, bat, raptor, glowMat } from './models/creatures';

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
  // Schlingendorntal (Werte PH)
  jungraptor: { name: 'Junger Schlingendornraptor', ability: null,
    build: raptor({ skin: 0x6f8f3a, stripe: 0x3d5a22, scale: [0.85, 0.85, 0.85] }) },
  peitschenraptor: { name: 'Peitschenschwanz-Raptor', ability: 'packFury',
    build: raptor({ skin: 0x9a5f2c, stripe: 0x4a2a14, tail: 5 }) },
  axtwerfer: { name: 'Bloodscalp-Axtwerfer', ability: 'axeThrower', hpMul: 0.85,
    build: humanoid({ skin: 0x4f7a9a, body: 0x6a4a2a, trim: 0x3f2a18, tusks: true, mohawk: 0xb5301c, weapon: 'axe', scale: [0.88, 1.15, 0.88], lean: 0.2 }) },
  medizinmann: { name: 'Kurzen-Medizinmann', ability: 'curse', hpMul: 0.9,
    build: humanoid({ skin: 0x8a5d3c, body: 0x53612e, trim: 0x2f3a1c, mask: 0xc8b070, mohawk: 0x2e8a4a, weapon: 'staff', glow: glowMat(0.5, 2, 0.8), lean: 0.15 }) },
  schattenpanther: { name: 'Schattenpanther', ability: 'pounce', stealth: true, aggro: 6, speedMul: 1.1,
    build: quadruped({ coat: 0x2a2c3a, dark: 0x14151e, eye: glowMat(2.2, 1.6, 0.3), tailLen: 1, ears: 0.15, snout: 0.26, scale: [1, 0.92, 1.15] }) },

  waechter: { name: 'Scharlachroter Wächter', ability: 'alarm', hpMul: 1.2,
    build: humanoid({ skin: 0xc9a488, body: 0xe8e2d4, tabard: 0xa81818, trim: 0x70161a, sleeve: 0xe8e2d4, helm: 0x8f9299, weapon: 'sword', shield: 0xa81818, lean: 0 }) },
};
