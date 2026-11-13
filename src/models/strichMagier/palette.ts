// Strichmagier: Farben der Schul-Looks (SKINS) und der Skins aus src/skins.ts (LOOKS), Lampen-Ausgleich.

import * as THREE from 'three';
import { t } from '../../i18n';
import { col } from './shared';

export const SKINS = {
  base: { name: t('skin.base.name'), ink: col(0x2b2b33), accent: col(0x2a2622), orb: col(0xe2b13c) },
  fire: { name: t('skin.fire.name'), ink: col(0x2a1c18), accent: col(0x7a2a10), orb: col(0xffb02e) },
  ice: { name: t('skin.ice.name'), ink: col(0x1f3550), accent: col(0x5d86a8), orb: col(0x9fe9ff), ice: col(0xe4f6ff) },
  arcane: { name: t('skin.arcane.name'), ink: col(0x2a1f45), accent: col(0x5b3a8f), orb: col(0xc58bff) },
  blitz: { name: t('skin.blitz.name'), ink: col(0x1b2336), accent: col(0x3a5f9e), orb: col(0xbff4ff) },
  plague: { name: t('skin.plague.name'), ink: col(0xffffff), accent: col(0xb9a3c9), orb: col(0x9cff5a) },
  qm: { name: t('skin.qm.name'), ink: col(0x141418), accent: col(0x2a2a32), orb: col(0xffd23a) },
};

// Skins (src/skins.ts, Viewer docs/ref/set-skins-magier.html): Farben des Grundkörpers, Teile baut buildStrichMagier im Block `look`.
// top Brust, sleeve Arme, pants Hüfte und Beine, shoe Füße, skin Hals und Hände, head Kopf, collar Kragen-Schal, ankle: Knöchel frei
const SKIN_TONE = col(0xf1dcc6).multiplyScalar(.3);   // Haut, dunkler als im Viewer: Lampe und Rand-Licht heben sie sonst über die Bloom-Schwelle // PH
// Babyblau unter der warmen Lampe (dunkel.ts, 0xffc48a) und ACES: Rot stark und Grün etwas gedämpft, sonst wird es cremeweiß und brennt aus. // PH
export const LAMP_COMP = new THREE.Color(.17, .3, .6);
// Muster Facette (Splitterkönig): Babyblau-Töne plus ein paar tiefere Blau-Dreiecke, damit das Muster der Referenz erkennbar bleibt // PH
export const FACETTE = { pal: ['#a9cbea', '#7fb4ea', '#d6e7f6', '#c2dbf1', '#5f9be0', '#eef5fb'].map(c => new THREE.Color(c).multiply(LAMP_COMP)) };
export const LOOKS = {
  blitz: { top: col(0x1f2a5c), sleeve: col(0x1f2a5c), pants: col(0x1f2a5c), shoe: col(0xe8e8e8), skin: SKIN_TONE, head: SKIN_TONE, collar: col(0x1f2a5c), eyes: true },
  seuche: { top: col(0x3b1f46), sleeve: col(0x2e1838), pants: col(0x2e1838), shoe: col(0x1a1018), skin: SKIN_TONE, head: col(0xd8cfb0).multiplyScalar(.5), collar: col(0x2e1838), eyes: true },
  glut: { top: col(0x1a1a1e), sleeve: col(0x1a1a1e), pants: col(0x9cc7ea).multiplyScalar(.5), shoe: col(0xe8e8e8), skin: SKIN_TONE, head: col(0x1a1a1e), collar: col(0x1a1a1e), eyes: true },
  frost14: { top: FACETTE, sleeve: col(0xeaf3fb).multiply(LAMP_COMP), pants: FACETTE, shoe: col(0x15151a), skin: SKIN_TONE, head: SKIN_TONE, collar: FACETTE, eyes: true, ankle: true },
};
