// Verdorbene Figuren: das echte Spielermodell (Strichkrieger, Klingenstrich, Strichmagier) als Boss.
// Dunkel rot-schwarz getönt, ×1.5 groß. Die Angriffe aus bosses/attacks.ts steuern die Pose über model.ctl:
// arms fällt beim Ausholen, steigt beim Schlag. Beim Schlag spielt die Figur die passende Animation aus dem Spiel,
// die Magier heben den Stab mit dem Ausholen (anim.cast). Welcher Angriff läuft, setzt boss.ts in ctl.atk.

import * as THREE from 'three';
import { scene } from '../render';
import { buildStrichKrieger } from '../models/strichKrieger';
import { buildKlinge } from '../models/klingeModel';
import { buildStrichMagier } from '../models/strichMagier';
import { buildWeapon } from '../models/weapons/index';

const EVIL = {
  scale: 1.5,                        // PH ×1.5 laut Handoff
  tint: new THREE.Color(0.75, 0.22, 0.24),   // PH Vertex-Farben × diese Farbe
  glow: new THREE.Color(0.035, 0.002, 0.004),   // PH Grundglühen, damit die Figur im Dunkeln lesbar bleibt
  flash: 0.9,                        // PH Treffer-Blitz (Glühen + Weiß)
  strikeFrom: -1.8,                  // arms unter diesem Wert = ausgeholt, steigt es wieder: Schlag
};
// Roster-Skin → Spiel-Skin der Strichmagier
const MAGE = { feuer: 'feuer', eis: 'frost', arkan: 'arkan' };
const STAFF = { feuer: 'glutrute', eis: 'grenzwaechter', arkan: 'zirkelstab' };
// Angriff (ATT-Schlüssel) → Animation der Figur
const KRIEGER = { explosion: 'qs', slam: 'exec', ring: 'cry', kette: 'q1', ansturm: 'e' };
const KLINGE = { ansturm: 'dash', sog: 'wirbel', explosion: 'e' };

function tint(root) {
  const mats = [];
  root.traverse(o => {
    if (!o.isMesh || !o.material || o.material.isShaderMaterial || !('emissive' in o.material)) return;   // Energie-Shader (Aura, Effekte) bleiben
    o.material = o.material.clone();
    o.material.color.multiply(EVIL.tint);
    o.material.emissive.copy(EVIL.glow);
    mats.push(o.material);
  });
  return mats;
}

export function buildEvil(spec) {
  const skin = spec.skin, mage = MAGE[skin];
  const hero = mage ? buildStrichMagier(mage) : skin === 'klinge' ? buildKlinge({ bloom: true }) : buildStrichKrieger({ bloom: true, weapon: 'sword' });
  const root = hero.root, extras = [hero.scarf, hero.fx?.group].filter(o => o && o !== root && o.isObject3D);
  for (const o of extras) scene.add(o);
  let staff = null, clock = 0;
  if (mage) {
    staff = buildWeapon(STAFF[skin]);
    const mount = new THREE.Group();
    hero.anchors.crystal.parent.add(mount);
    mount.add(staff.root);
    mount.rotation.set(staff.pitch, staff.yaw, 0);
    mount.position.y = staff.cane ? staff.gripY - 0.85 : 0;
  }
  const mats = tint(root);
  root.scale.setScalar(EVIL.scale);
  if (skin === 'klinge') hero.setStance?.(2, true);   // zwei Katanas
  const ctl: any = { arms: 0, lean: 0, atk: null };
  let prev = 0, low = 0, seq = 0, ability = null, attack = null, step = 0, dur = 0, flashOn = -1;
  // Schlag: passende Animation starten
  function strike() {
    seq++;
    ability = attack = null;
    if (skin === 'krieger') ability = KRIEGER[ctl.atk] ?? `q${1 + seq % 3}`;
    else if (skin === 'klinge') {
      ability = KLINGE[ctl.atk] ?? null;
      if (!ability) { attack = 'q'; step = seq % 3; }
      dur = 900;
    }
  }
  return {
    root, ctl, parts: {}, height: 2 * EVIL.scale, evil: true,
    // Beim Entfernen des Mobs (mobs.ts removeMob): Effekte in Weltkoordinaten mit weg
    onRemove() {
      for (const o of extras) scene.remove(o);
      staff?.dispose();
    },
    update(dt, a) {
      const s = Math.max(0, dt) / 1000;
      clock += s;
      if (ctl.arms < EVIL.strikeFrom) low = 1;
      if (low && ctl.arms > prev + 0.05) { low = 0; if (!mage) strike(); }
      prev = ctl.arms;
      const f = Math.round((a.flash || 0) * 4) / 4;
      if (f !== flashOn) { flashOn = f; for (const m of mats) m.emissive.copy(EVIL.glow).lerp(new THREE.Color(1, 0.85, 0.85), f * EVIL.flash); }
      const cast = mage ? Math.max(0, Math.min(1, -ctl.arms / 2.6)) : 0;
      hero.update(dt, {
        state: a.state, speed: (a.speed || 5) * 1.4, frozen: a.frozen, cast, channel: mage && ctl.atk === 'pfuetze',
        ability, attack, step, seq, dur, rate: 1, hold: false, rage: 0.15,   // PH Wut-Aura nur als Schimmer
      });
      staff?.update(s, clock);
      if (staff) staff.combat = cast > 0;
      root.rotation.x = ctl.lean * 0.5;
    },
  };
}
