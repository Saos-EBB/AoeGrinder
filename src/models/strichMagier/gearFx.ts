// Strichmagier: Gear-Funken und Aura (Partikel ins Spiel), Zahlen GEAR_FX auch für den Lampen-Ausgleich in buildStrichMagier.

import { V, rand as rnd } from '../../util';
import { rate, TAU } from './shared';

export const GEAR_FX = { spark: 2, sparkOrange: 4.5, aura: 6, r: .4, y0: .45, y1: 2.1, fillY: 2.4, dimFrom: 1.6, dimMin: .08 };   // Funken pro Sekunde ab Blau (Orange mehr), Aura-Partikel pro Sekunde je Teil, Bahn um die Figur; Lampen-Ausgleich ab dimFrom bis zur Höhe des Fülllichts (dunkel.ts D.fill.height) // PH
// Gear: Funken in Elementfarbe ab Blau (Viewer: steigen um die Figur auf), Orange-Aura als Partikel um das Teil
const _gfp = V(), _gfs = V();
export function updateGearFx(F, s, sp) {
  const G = F.gear;
  if (G.el != null) for (let n = rate(s * (G.rar >= 5 ? GEAR_FX.sparkOrange : GEAR_FX.spark)); n > 0; n--) {
    const a = Math.random() * TAU;
    F.root.localToWorld(_gfp.set(Math.cos(a) * GEAR_FX.r, GEAR_FX.y0 + Math.random() * (GEAR_FX.y1 - GEAR_FX.y0), Math.sin(a) * GEAR_FX.r));
    sp(_gfp, G.el);
  }
  for (const f of G.fx) if (f.aura) for (let n = rate(s * GEAR_FX.aura); n > 0; n--) {
    f.bone.getWorldPosition(_gfp); const r = f.aura * .25 * f.bone.getWorldScale(_gfs).x;
    sp(_gfp.add(_gfs.set(rnd(-r, r), rnd(-r, r), rnd(-r, r))), f.color);
  }
}
