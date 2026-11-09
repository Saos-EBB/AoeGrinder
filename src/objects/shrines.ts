// Schreine wie in Diablo 2: benutzen (Taste) = 30 s Buff, Leuchten in eigener Farbe, Buff-Chip im HUD (ui/hud.ts zeigt buffs()).
// Erfahrung ×2, Schaden +50 %, Mana-Regen ×3, Abklingzeit −30 %, Monster-Schrein ruft ein Champion-Pack. Danach erlischt er. Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from '../state';
import { addBuff, buffXpMul } from '../buffs';
import { addXpMul } from '../xpBonus';
import { combatText } from '../ui/hud';
import { ringFx } from '../fx/spellFx';
import { particles } from '../fx/particles';
import { zone } from '../world';
import { spawnChampionKindPack } from '../mobKinds';
import { spawnChampionPack } from '../mobs';
import { rollAffixes } from '../champions';
import { colored, plain } from '../mapgen/build';
import { registerKind, planObjects, redraw, type Obj } from './objects';
import { rand } from '../util';
import { t } from '../i18n';

export const SHRINE = {
  perMap: 3, ms: 30000,
  types: {
    xp:      { color: [2.4, 1.9, 0.5],  buff: { xp: 1 } },        // Erfahrung ×2
    dmg:     { color: [2.6, 0.5, 0.35], buff: { dmg: 0.5 } },     // Schaden +50 %
    mana:    { color: [0.5, 1.1, 2.8],  buff: { regen: 2 } },     // Mana-Regen ×3
    cd:      { color: [0.6, 2.4, 2.2],  buff: { cd: 0.3 } },      // Abklingzeit −30 %
    monster: { color: [1.9, 0.5, 2.6],  buff: null },             // Champion-Pack
  } as Record<string, { color: number[]; buff: any }>,
  spentGlow: 0.18,      // Restleuchten nach Benutzen
};
const TYPES = Object.keys(SHRINE.types);
addXpMul(buffXpMul);

function body() {
  const base = new THREE.CylinderGeometry(1.1, 1.3, 0.5, 8).translate(0, 0.25, 0);
  const step = new THREE.CylinderGeometry(0.8, 0.95, 0.4, 8).translate(0, 0.7, 0);
  const pillarL = new THREE.BoxGeometry(0.28, 2.2, 0.28).translate(-0.7, 1.6, 0), pillarR = new THREE.BoxGeometry(0.28, 2.2, 0.28).translate(0.7, 1.6, 0);
  const top = new THREE.BoxGeometry(1.8, 0.25, 0.4).translate(0, 2.75, 0);
  return colored([[base, 0x6b6458], [step, 0x857d6e], [pillarL, 0x5a544a], [pillarR, 0x5a544a], [top, 0x6b6458]]);
}
const glow = () => plain([new THREE.OctahedronGeometry(0.42, 0).scale(1, 1.5, 1).translate(0, 1.7, 0), new THREE.TorusGeometry(0.75, 0.06, 6, 24).rotateX(Math.PI / 2).translate(0, 0.93, 0)]);
const col = (c: number[], k = 1) => new THREE.Color(c[0] * k, c[1] * k, c[2] * k);

function use(o: Obj) {
  if (o.data.used) return;
  const T = SHRINE.types[o.data.type];
  o.data.used = true;
  o.glow = col(T.color, SHRINE.spentGlow);
  redraw(o);
  const at = { x: o.x, y: o.y, z: o.z };
  ringFx(at, 6, T.color, 700);
  for (let i = 0; i < 30; i++) particles.spawn({ x: o.x + rand(-0.6, 0.6), y: o.y + rand(0.5, 2.5), z: o.z + rand(-0.6, 0.6), vy: rand(1, 4), life: rand(0.5, 1), color: T.color, size: rand(0.25, 0.5) });
  const name = t(`shrine.${o.data.type}`), css = `rgb(${T.color.map(v => Math.round(Math.min(1, v / 2.6) * 255)).join(',')})`;
  combatText(player.pos, name, 'info', 3, css);
  if (T.buff) addBuff({ id: `shrine_${o.data.type}`, name, until: state.now + SHRINE.ms, color: css, ...T.buff });
  else {
    const spot = { x: o.x + 6, z: o.z, r: 4 };
    if (zone.theme) spawnChampionKindPack(spot, zone.theme, player.level);
    else spawnChampionPack(spot.x, spot.z, rollAffixes());
  }
}

registerKind({
  id: 'shrine', name: 'Schrein', reserve: 6, radius: 1.3, body, glow,
  init(o, rng) { o.data.type = o.data.type ?? rng.pick(TYPES); o.glow = col(SHRINE.types[o.data.type].color); o.ry = 0; },
  onUse: use,
  useLabel: o => o.data.used ? null : t('shrine.use', { name: t(`shrine.${o.data.type}`) }),
  update(o) {   // Leuchten pulst, solange er unbenutzt ist
    if (o.data.used) return;
    const k = 0.8 + 0.25 * Math.sin(state.now / 300 + o.id);
    o.glow = col(SHRINE.types[o.data.type].color, k);
    redraw(o);
  },
});
planObjects({ kind: 'shrine', n: SHRINE.perMap, place: 'free' });
