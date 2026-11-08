// Legendäre Waffen mit Combo (v31). Magier: orange Unikate aus der Magischen Kiste (3 % der orangen, Element-Waffen nur mit passendem Element).
// Nahkampf: Waffenwahl vor dem Run. Combo: Tastenfolge innerhalb von 3 s, falsche Taste setzt zurück, 60 s Abklingzeit, Icon im HUD.
// Die normale Tasten-Aktion läuft trotzdem (eigener keydown-Listener, der nichts abfängt). Alle Zahlen PH, Schaden in Einheiten (UNIT).

import * as THREE from 'three';
import { $, dist2d, pick } from './util';
import { state, player } from './state';
import { UNIT } from './config';
import { maxHp } from './formulas';
import { meta, saveMeta } from './meta';
import { camera, scene } from './render';
import { mage } from './models/mage';
import { applyRoot, enterCombat, startLeap, knockbackMob, onMobDeath } from './mobs';
import { mobsInRadius, makeCtx, addField } from './spells/core';
import { runChain } from './spells/chain';
import { igniteMob } from './spells/firestorm';
import { blinkTo } from './spells/blink';
import { boltFx, burstFx, orbVisual, areaParticles, FIRE, EMBER, ICE, ICE_WHITE } from './spells/fx';
import { combatText, showError } from './ui/hud';
import { forward } from './melee';
import { warLegendary, NOXUS } from './realMen';
import { t } from './i18n';

export const LEG = {
  combo: { keys: ['KeyQ', 'KeyE', 'Digit1'], labels: ['Q', 'E', '1'], windowMs: 1500, cdMs: 60000 },
  dropChance: 0.03,
  sheep: { ms: 4000, range: 45 },
  cow: { radius: 10, hp: 2, xp: 3, dust: 3, range: 40 },
  egg: { ms: 60000, hp: 0.5 },
  pyro: { jumps: 5, range: 8, mul: 2 },
  snow: { len: 20, speed: 10, radius: 2, grow: 0.1, dmg: 1.5, upMs: 1000 },
  leeroy: { yd: 10, pull: 20, ms: 8000, dmg: 0.5 },
};

// Alle Legenden: kind 'mage' kommt aus der Kiste (element: nur mit diesem Element), 'krieger' aus dem Feld legendary (realMen.ts, Dev-Panel). Geparkt: maybeLater/src/legends.parked.ts
export const LEGENDS = {
  sheep: { kind: 'mage', name: t('legend.sheep.name'), desc: t('legend.sheep.desc') },
  cow: { kind: 'mage', name: t('legend.cow.name'), desc: t('legend.cow.desc') },
  murky: { kind: 'mage', name: t('legend.murky.name'), desc: t('legend.murky.desc') },
  pyroclasm: { kind: 'mage', element: 'feuer', name: t('legend.pyroclasm.name'), desc: t('legend.pyroclasm.desc') },
  snowball: { kind: 'mage', element: 'frost', name: t('legend.snowball.name'), desc: t('legend.snowball.desc') },
  leeroy: { kind: 'krieger', base: 'sword', name: t('legend.leeroy.name'), desc: t('legend.leeroy.desc') },
  sion: { kind: 'krieger', base: 'sword', name: t('legend.sion.name'), desc: t('legend.sion.desc') },
};

// Kiste: orange Waffe, mit 3 % eine Legende. Element-Legenden nur, wenn die Waffe das Element hat
export function rollLegend(element) {
  if (Math.random() >= LEG.dropChance) return null;
  return pickLegend(element);
}
export const pickLegend = element => pick(Object.keys(LEGENDS).filter(id => LEGENDS[id].kind === 'mage' && (!LEGENDS[id].element || LEGENDS[id].element === element)));

// Aktive Legende des Runs: Magier über die angelegte Waffe, Nahkampf über die Waffenwahl
function activeLegend() {
  if (mage.skin === 'krieger') return LEGENDS[warLegendary()] ? warLegendary() : null;   // legendäre Waffe des Kriegers (realMen.ts)
  const w = meta.inv.find(x => x.id === meta.equipped);
  return LEGENDS[w?.s?.legend] ? w.s.legend : null;   // geparkte Legende (Achtfacher Stern) zählt nicht
}

// ---------- Combo ----------
const combo = { step: 0, until: 0, readyAt: 0 };
export function resetLegends() { combo.step = 0; combo.until = 0; combo.readyAt = 0; state.leeroyUntil = 0; egg.until = 0; egg.mesh && (egg.mesh.visible = false); }
addEventListener('keydown', e => {
  if (e.repeat || state.paused || player.dead || !activeLegend()) return;
  const C = LEG.combo;
  if (state.now >= combo.readyAt) {
    if (combo.step && state.now > combo.until) combo.step = 0;
    if (e.code === C.keys[combo.step]) {
      combo.step++;
      combo.until = state.now + C.windowMs;
      if (combo.step === C.keys.length) { combo.step = 0; combo.readyAt = state.now + C.cdMs; fire(activeLegend()); }
    } else combo.step = e.code === C.keys[0] ? 1 : 0;   // falsche Taste setzt zurück, ein neues Q fängt gleich wieder an
    if (combo.step === 1) combo.until = state.now + C.windowMs;
  }
  updateIcon();
});

// ---------- Wirkungen ----------
function fire(id) {
  combatText(player.pos, LEGENDS[id].name, 'info', 3.2);
  EFFECTS[id]?.();
}
const visible = m => { const p = m.pos.clone().project(camera); return p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1; };
const nearest = (list, pos) => list.sort((a, b) => dist2d(a.pos, pos) - dist2d(b.pos, pos));

const EFFECTS = {
  sheep() {
    for (const m of mobsInRadius(player.pos, LEG.sheep.range, Infinity)) if (visible(m) && !m.boss) {
      m.rootUntil = Math.max(m.rootUntil, state.now + LEG.sheep.ms);   // Schafe laufen und schlagen nicht, Schaden bricht es nicht ab
      m.sheepUntil = state.now + LEG.sheep.ms;
      combatText(m.pos, t('msg.baa'), 'info', 2);
    }
  },
  cow() {
    const first = nearest(mobsInRadius(player.pos, LEG.cow.range, Infinity).filter(m => !m.cow), player.pos)[0];
    if (!first) return showError(t('msg.noPack'));
    for (const m of mobsInRadius(first.pos, LEG.cow.radius, Infinity)) {
      if (m.cow || m.boss) continue;
      m.cow = true;
      m.hp *= LEG.cow.hp; m.maxHp *= LEG.cow.hp;
      m.xpMul = (m.xpMul ?? 1) * LEG.cow.xp;
      combatText(m.pos, t('msg.moo'), 'info', 2);
    }
  },
  murky() {
    egg.pos = player.pos.clone();
    egg.until = state.now + LEG.egg.ms;
    egg.mesh ??= (() => { const g = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshLambertMaterial({ color: 0xc8e090, emissive: 0x304010 })); g.scale.y = 1.3; scene.add(g); return g; })();
    egg.mesh.position.set(egg.pos.x, egg.pos.y + 0.45, egg.pos.z);
    egg.mesh.visible = true;
  },
  pyroclasm() {
    const c = makeCtx('fireball'), first = nearest(mobsInRadius(player.pos, 30, Infinity), player.pos)[0];
    if (!first) return;
    const dmg = (85 + 100) / 2 * LEG.pyro.mul;   // doppelter Feuerball-Schaden (fireball.ts min/max)
    runChain(c, first, { jumps: LEG.pyro.jumps + 1, range: LEG.pyro.range, dmg, boltColor: FIRE, onHit: m => { if (!m.dead) igniteMob(c, m); } });
  },
  snowball() {
    const c = makeCtx('frostorb'), dir = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing)), seen = new Set();
    let k = 1;
    addField(c, { pos: player.pos, radius: LEG.snow.radius, dur: LEG.snow.len / LEG.snow.speed * 1000, tickMs: 1e9, visual: orbVisual(0xeaf6ff, 2.4),
      onUpdate(f, dt) {
        f.pos.addScaledVector(dir, LEG.snow.speed * dt / 1000);
        f.radius = LEG.snow.radius * k;
        areaParticles(f.pos, f.radius * 0.5, 40, dt, [ICE, ICE_WHITE], { up: 1, size: 0.35 });
        for (const m of mobsInRadius(f.pos, f.radius)) {
          if (seen.has(m)) continue;
          seen.add(m);
          if (c.hit(m, LEG.snow.dmg * UNIT * k) && !m.dead) { startLeap(m, m.pos.clone(), LEG.snow.upMs, () => {}); applyRoot(m, LEG.snow.upMs, 'ice'); }
          k += LEG.snow.grow;
        }
      },
    });
  },
  leeroy() {
    const from = player.pos.clone(), f = forward();
    blinkTo(from.x + f.x * LEG.leeroy.yd, from.z + f.z * LEG.leeroy.yd);
    for (const m of mobsInRadius(player.pos, LEG.leeroy.pull, Infinity)) { m.state = 'idle'; enterCombat(m, false); }
    state.leeroyUntil = state.now + LEG.leeroy.ms;   // core.ts: +50 % Schaden
    burstFx(player.pos, 4, [EMBER, FIRE], 0xff6030);
  },
  // Für Noxus!: Vernichtender Hieb sofort voll geladen, mehr Schaden (realMen.ts NOXUS)
  sion() {
    state.noxusUntil = state.now + NOXUS.ms;
    burstFx(player.pos, 4, [EMBER, FIRE], 0xd8121c);
  },
};
export const legendDmgMul = () => state.leeroyUntil > state.now ? 1 + LEG.leeroy.dmg : 1;

// Cow Level: tote Kühe geben Staub
onMobDeath(m => { if (m.cow) { meta.dust += LEG.cow.dust; saveMeta(); combatText(m.pos, t('msg.dust', { n: LEG.cow.dust }), 'xp', 2.2); } });

// ---------- Murky-Ei ----------
const egg: any = { pos: null, until: 0, mesh: null };
export function eggRevive() {
  if (!egg.until || state.now > egg.until || !activeLegend()) return false;
  egg.until = 0;
  egg.mesh.visible = false;
  player.pos.copy(egg.pos);
  player.hp = maxHp() * LEG.egg.hp;
  player.invulnUntil = state.now + 1000;
  combatText(player.pos, t('msg.egg'), 'heal', 3);
  return true;
}

// ---------- HUD ----------
const icon = document.createElement('div');
Object.assign(icon.style, { position: 'fixed', left: '50%', bottom: '118px', transform: 'translateX(-50%)', zIndex: '2', pointerEvents: 'none', display: 'none',
  font: '13px Georgia, serif', color: '#ffb84a', textShadow: '0 1px 3px #000', background: 'rgba(0,0,0,0.45)', border: '1px solid #ff9a2e', borderRadius: '4px', padding: '3px 8px' });
document.body.appendChild(icon);
let iconKey = '';
function updateIcon() {
  const id = activeLegend();
  const cd = Math.max(0, Math.ceil((combo.readyAt - state.now) / 1000));
  const key = !id || document.body.classList.contains('menu') ? '' : `${id}|${combo.step}|${cd}`;
  if (key === iconKey) return;
  iconKey = key;
  icon.style.display = key ? 'block' : 'none';
  if (!key) return;
  const keys = LEG.combo.labels.map((l, i) => `<b style="color:${i < combo.step ? '#ffe9a0' : '#8a6a3a'}">${l}</b>`).join(' ');
  icon.innerHTML = `★ ${LEGENDS[id].name} · ${cd ? `${cd} s` : keys}`;
}
export function updateLegends() {
  if (combo.step && state.now > combo.until) combo.step = 0;
  if (egg.mesh?.visible && state.now > egg.until) egg.mesh.visible = false;
  updateIcon();
}
(window as any).__legend = { LEG, LEGENDS, combo, fire, activeLegend, egg };
