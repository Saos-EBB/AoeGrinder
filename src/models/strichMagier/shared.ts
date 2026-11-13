// Strichmagier: Kleinkram, den mehrere Teile brauchen (Maße, Farben, fester Zufall, Facetten-Muster der Körper-Geometrie).
// Die beiden Zähler (FACET, SEED) sind Modul-Zustand wie vorher in strichMagier.ts, gesetzt über resetFacet/nextFacet und seedRnd.

import * as THREE from 'three';
import { V } from '../../util';
import { prep as kitPrep } from '../strichKit';

export const TAU = Math.PI * 2;
// Geometrie fürs Körper-Mesh (strichKit.ts prep): flick = Flammen-Verlauf, Attribut flick immer, Facetten-Muster der Skins
export const prep = (geo, color, m?, flick = false) => kitPrep(geo, color, m, { flick, flickAttr: true, facet: facetPick });
// Facetten-Muster (Skin Splitterkönig): jedes Dreieck eine Farbe aus color.pal, fest gestreut
let FACET = 1;
export const resetFacet = () => { FACET = 1; };
export const nextFacet = () => { FACET++; };
const facetPick = (tri, salt) => { const x = Math.sin((tri + 1) * 12.9898 + salt * 78.233 + FACET * 3.7) * 43758.5453; return x - Math.floor(x); };
export const col = h => new THREE.Color(h);

export const L1 = .46, L2 = .46, A1 = .31, A2 = .29;
// fest, damit die Figur immer gleich aussieht (Eiszapfen, Runen): seedRnd setzt den Startwert, srnd zieht
let SEED = 11; export const srnd = () => (SEED = (SEED * 9301 + 49297) % 233280) / 233280;
export const seedRnd = (s: number) => { SEED = s; };
export const UP = V(0, 1, 0);
export const rate = x => Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);   // Bruchteile über die Frames verteilt
