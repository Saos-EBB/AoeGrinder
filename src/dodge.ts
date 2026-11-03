// Dodge für alle Modi: kurzer Sprung in Laufrichtung (ohne Eingabe nach hinten), i-Frames, 2 Ladungen. Perfekter Dodge, wenn ein Treffer in die i-Frames fällt.
// Pro Modus genau eine Kombo-Regel im Fenster nach dem Dodge (combo*). Alle Zahlen in DG.

import { state, player } from './state';
import { $ } from './util';
import { act } from './input';
import { pad } from './gamepad';
import { particles } from './fx/particles';
import { addTrauma } from './wucht';
import { hitstop } from './fx/impact';
import { combatText } from './ui/hud';
import { activeModIds } from './modifiers';
import { mods } from './config';

// Alle Zahlen PH
export const DG = {
  yd: 4, ms: 250, iframeMs: 200, recoveryMs: 100,     // Weg, Dauer, unverwundbar ab Start, danach kein Cast
  charges: 2, rechargeMs: 3000,
  tilt: 0.45, squash: 0.18, shake: 0.12, dust: 10,     // Optik: Kippen in Richtung, Stauchen über scale, Staub am Start
  perfect: { hitstopMs: 80, flashMs: 220 },            // Treffer in den i-Frames: Ladung zurück, Hitstop, weißer Rand
  // Kombo pro Modus im Fenster nach dem Dodge-Ende (ms); ein perfekter Dodge verdoppelt es
  combo: { normal: 1500, feuer: 2000, arkan: 1500, krieger: 1000, klinge: 1000, perfectMul: 2,
    miniNova: { radius: 3, rootMs: 2000 }, trailStepYd: 0.6, smashMul: 1.5, smashTrauma: 0.5, smashDecal: 6, klingeQMul: 2 },
};

let dodge = null;                 // { start, dx, dz, charge, perfect }
let charges = [0, 0];             // Zeitpunkt, ab dem die Ladung wieder bereit ist
let lastEnd = -1e9, lastPerfect = false;

export const dodgeActive = () => !!dodge && state.now < dodge.start + DG.ms;
export const dodgeIframes = () => !!dodge && state.now < dodge.start + DG.iframeMs;
export const dodgeRecovery = () => state.now < lastEnd + DG.recoveryMs;
export const dodgeCharges = () => charges.filter(t => t <= state.now).length;

// Modus für die Kombo-Regel: Normal, Fire only, Frost only, Arcane only, Strichkrieger, Klingenstrich
export function dodgeMode() {
  const ids = activeModIds();
  return ids.includes('fire') ? 'feuer' : ids.includes('frost') ? 'frost' : ids.includes('arcane') ? 'arkan' : ids.includes('realmen') ? 'krieger' : ids.includes('klinge') ? 'klinge' : 'normal';
}
// Kombo: welche Regel gerade gilt und bis wann. consumeCombo(kind) löst sie genau einmal aus
const KIND = { normal: 'freeMana', feuer: 'fireCrit', arkan: 'instant', krieger: 'smash', klinge: 'klingeQ' };
let combo = null;
export const comboActive = () => !!combo && state.now < combo.until;
export const comboReady = kind => comboActive() && combo.kind === kind;
export function consumeCombo(kind) {
  if (!comboReady(kind)) return false;
  combo = null;
  return true;
}
function startCombo(perfect) {
  const mode = dodgeMode(), ms = DG.combo[mode];
  if (!ms) return;
  combo = { kind: KIND[mode], until: state.now + ms * (perfect ? DG.combo.perfectMul : 1) * (mods.comboWindow ?? 1) };   // Karte Kombo-Meister
}

export function resetDodge() {
  dodge = null; lastEnd = -1e9; combo = null;
  charges = Array(DG.charges).fill(0);
  state.dodgeStats = { n: 0, perfect: 0 };
}

// Richtung aus WASD oder Stick, relativ zur Blickrichtung; ohne Eingabe nach hinten
function direction() {
  let fwd = (act('forward') ? 1 : 0) - (act('back') ? 1 : 0) + pad.move.y;
  let strafe = (act('strafeRight') ? 1 : 0) - (act('strafeLeft') ? 1 : 0) + pad.move.x;
  if (Math.hypot(fwd, strafe) < 0.2) { fwd = -1; strafe = 0; }
  const f = player.facing;
  const x = Math.sin(f) * fwd - Math.cos(f) * strafe, z = Math.cos(f) * fwd + Math.sin(f) * strafe, l = Math.hypot(x, z) || 1;
  return { dx: x / l, dz: z / l };
}

// Taste „Ausweichen“ (Shift, Pad L2). before: Hook des Modus (Krieger bricht seinen Move ab) und Abbrüche
export function tryDodge(before) {
  if (state.paused || player.dead || !player.grounded || dodgeActive()) return false;
  if (player.iceUntil > state.now || player.stunUntil > state.now) return false;
  const i = charges.findIndex(t => t <= state.now);
  if (i < 0) return false;
  charges[i] = state.now + DG.rechargeMs;
  before?.();
  dodge = { start: state.now, ...direction(), charge: i, perfect: false };
  state.dodgeStats.n++;
  for (let k = 0; k < DG.dust; k++) {
    const a = Math.random() * Math.PI * 2;
    particles.spawn({ x: player.pos.x, y: player.pos.y + 0.2, z: player.pos.z, vx: Math.cos(a) * 1.5, vy: 0.6 + Math.random(), vz: Math.sin(a) * 1.5,
      drag: 2, life: 0.5 + Math.random() * 0.3, color: [0.45, 0.4, 0.34], size: 0.35 + Math.random() * 0.25, grow: 0.8 });
  }
  addTrauma(DG.shake);
  return true;
}

// Ein Angriff oder Geschoss hätte in den i-Frames getroffen (player.ts damagePlayer): höchstens einmal pro Dodge
export function perfectDodge() {
  if (!dodge || dodge.perfect) return;
  dodge.perfect = true;
  charges[dodge.charge] = state.now;
  state.dodgeStats.perfect++;
  hitstop(DG.perfect.hitstopMs);
  flash.style.transition = 'none'; flash.style.opacity = '1';
  requestAnimationFrame(() => { flash.style.transition = `opacity ${DG.perfect.flashMs}ms ease-out`; flash.style.opacity = '0'; });
  combatText(player.pos, 'Perfekt', 'info', 2.8);
}
export const lastDodgePerfect = () => !!dodge?.perfect || lastPerfect;

// Aus updatePlayer: setzt die Geschwindigkeit, solange der Dodge läuft. true = normale Steuerung aussetzen
export function dodgeVelocity(vel, onStep?) {
  if (!dodge) return false;
  if (state.now >= dodge.start + DG.ms) { lastPerfect = dodge.perfect; dodge = null; lastEnd = state.now; startCombo(lastPerfect); return false; }
  const speed = DG.yd / (DG.ms / 1000);
  vel.x = dodge.dx * speed; vel.z = dodge.dz * speed;
  if (onStep && state.now - (dodge.lastStep ?? -1e9) >= DG.combo.trailStepYd / speed * 1000) { dodge.lastStep = state.now; onStep(dodge); }   // Fire only: Feuerspur
  player.moveState = 'run';
  player.moveSpeed = speed;
  return true;
}

// Optik ohne Animation: Figur kippt in Dodge-Richtung und staucht sich kurz
export function dodgeVisual(root) {
  if (!dodgeActive()) { root.scale.setScalar(1); return; }
  const u = (state.now - dodge.start) / DG.ms, k = Math.sin(u * Math.PI);
  const local = Math.atan2(dodge.dx, dodge.dz) - player.facing;   // Richtung relativ zur Figur
  root.rotation.x += Math.cos(local) * DG.tilt * k;
  root.rotation.z -= Math.sin(local) * DG.tilt * k;
  root.scale.set(1 + DG.squash * k * 0.5, 1 - DG.squash * k, 1 + DG.squash * k * 0.5);
}

// Weißer Rand beim perfekten Dodge
const flash = document.createElement('div');
Object.assign(flash.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2', opacity: '0', boxShadow: 'inset 0 0 70px 18px rgba(255,255,255,0.85)' });
document.body.appendChild(flash);

// Anzeige: kleine Punkte unter der Lebensleiste, einer pro Ladung
const dots = document.createElement('div');
Object.assign(dots.style, { display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '3px', height: '8px' });
$('hudHp').appendChild(dots);
let shownKey = '';
const bar = document.getElementById('actionbar');
export function updateDodgeHud() {
  while (charges.length < DG.charges + (mods.dodgeCharges ?? 0)) charges.push(0);   // Karte Ausweichrolle
  const glow = comboActive() ? '0 0 16px 5px rgba(255,210,122,0.75)' : '';   // Kombo-Fenster: Leuchtrand um die Zauberleiste
  if (bar.style.boxShadow !== glow) bar.style.boxShadow = glow;
  const key = `${charges.length},${dodgeCharges()}`;
  if (key === shownKey) return;
  shownKey = key;
  dots.innerHTML = charges.map((t, i) => `<span style="width:8px;height:8px;border-radius:50%;border:1px solid #e8d8a8;background:${i < dodgeCharges() ? '#e8d8a8' : 'transparent'}"></span>`).join('');
}
