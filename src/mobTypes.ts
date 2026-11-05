// Mob-Typen: Name, Modell und Fähigkeit (Schlüssel in abilities.ts oder null).

import { buildBoar } from './models/boar';
import { humanoid, quadruped, bat, raptor, bug, glowMat } from './models/creatures';

const DWARF = { skin: 0xb07a5a, scale: [1.22, 0.78, 1.22], lean: 0.08 };

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
  // Blackrock Depths (Werte PH)
  bauer: { name: 'Shadowforge-Bauer', ability: null,
    build: humanoid({ ...DWARF, body: 0x4a443c, trim: 0x2c2822, beard: 0x7a3a18, weapon: 'pick' }) },
  sanitaeter: { name: 'Anvilrage-Sanitäter', ability: 'medic', hpMul: 0.8, fleeChance: 1,
    build: humanoid({ ...DWARF, body: 0xb8ad90, robe: true, trim: 0x70161a, beard: 0xc0b8a8, weapon: 'staff', glow: glowMat(0.6, 2, 0.8) }) },
  offizier: { name: 'Anvilrage-Offizier', ability: 'divineShield', hpMul: 1.25,
    build: humanoid({ ...DWARF, body: 0x6e2a22, tabard: 0x2c2822, trim: 0x8f9299, helm: 0x8f9299, sleeve: 0x8f9299, beard: 0x3a2214, weapon: 'hammer', shield: 0x6e2a22 }) },
  feuerwache: { name: 'Feuerwache', ability: 'heatAura', rootMax: 2000, hpMul: 1.15,   // PH: Nova hält nur 2 s
    build: humanoid({ ...DWARF, skin: 0x5c2a1c, body: 0x2a1a14, trim: 0x8a3a12, helm: 0x3c2a22, beard: 0xd6541a, weapon: 'axe', eye: glowMat(3, 1.2, 0.2) }) },
  abgesandter: { name: 'Zwielicht-Abgesandter', ability: 'lavaPool', hpMul: 0.9,
    build: humanoid({ skin: 0x5f4a6a, body: 0x35224f, trim: 0x1c1230, robe: true, hood: true, sleeve: 0x35224f, weapon: 'staff', glow: glowMat(2.4, 0.5, 2), eye: glowMat(2, 0.5, 2.2), scale: [0.95, 1.12, 0.95], lean: 0.05 }) },

  // Winterquell (Werte PH)
  yeti: { name: 'Zottelyeti', ability: null, hpMul: 1.1,
    build: humanoid({ skin: 0xdfe8f2, body: 0xc9d6e6, trim: 0x8fa4c0, tusks: true, weapon: 'club', eye: glowMat(0.6, 1.6, 2.4), scale: [1.45, 1.3, 1.45], lean: 0.22 }) },
  frostsaebler: { name: 'Frostsäbler', ability: 'pounce', speedMul: 1.1,
    build: quadruped({ coat: 0xe6eef8, dark: 0x5a78a8, stripes: true, eye: glowMat(0.5, 1.8, 2.6), tailLen: 0.6, ears: 0.2, scale: [1.1, 1.05, 1.15] }) },
  eulenbestie: { name: 'Eulenbestie', ability: 'stomp', hpMul: 1.4, speedMul: 0.9,
    build: humanoid({ skin: 0x8a6a48, body: 0x6e5236, trim: 0xd8cfc0, eye: glowMat(2.4, 1.8, 0.3), scale: [1.3, 1.2, 1.3], lean: 0.3 }) },

  // Tanaris (Werte PH)
  hyaene: { name: 'Wüstenhyäne', ability: null,
    build: quadruped({ coat: 0xb09a68, dark: 0x4a3c28, stripes: true, hump: true, tailLen: 0.4, ears: 0.22, scale: [0.95, 0.95, 0.95] }) },
  dieb: { name: 'Wastewander-Dieb', ability: 'manaThief', hpMul: 0.9, speedMul: 1.05,
    build: humanoid({ skin: 0xb98e6a, body: 0xc2a878, trim: 0x6a5436, hood: true, sleeve: 0xc2a878, weapon: 'sword', lean: 0.2 }) },
  rohling: { name: 'Dunemaul-Rohling', ability: 'stomp', hpMul: 1.6, speedMul: 0.85, dmgMul: 1.2,
    build: humanoid({ skin: 0x8f7a4a, body: 0x6a5230, trim: 0x3e2f1c, tusks: true, weapon: 'club', scale: [1.5, 1.4, 1.5], lean: 0.25, eye: glowMat(1.8, 0.6, 0.1) }) },
  schwaermer: { name: 'Silithid-Schwärmer', ability: 'swarm', hpMul: 1.1,
    build: bug({ shell: 0xa88b3a, dark: 0x4f3d18, scale: [1.3, 1.3, 1.3] }) },
  schwaermling: { name: 'Schwärmling', ability: null, hpMul: 0.15, dmgMul: 1.6, speedMul: 1.2, noXp: true,
    build: bug({ shell: 0xc4a94a, dark: 0x5e4a1c, scale: [0.6, 0.6, 0.6] }) },
  skorpid: { name: 'Sandskorpid', ability: 'poison',
    build: bug({ shell: 0xb5752c, dark: 0x5c3414, tail: true, pincers: true }) },

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
