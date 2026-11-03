import { cameraKick } from './fx/impact';

// Wucht: Treffer fühlen sich über Timing und Wirkung auf die Umgebung an. Screenshake (Trauma), Hitstop-Anlässe, Kamera-Ruck,
// Boden-Spuren, Trümmer und Knockback. Alle Zahlen in W. Hitstop, Kamera-Ruck und Lichtblitz selbst liegen in fx/impact.ts.

// Alle Zahlen PH
export const W = {
  // Trauma 0..1 steigt mit Treffern, fällt pro Sekunde. Versatz = Trauma² × max. frameCap: so viel Trauma höchstens pro Frame (30 Blizzard-Ticks bleiben ruhig)
  shake: { max: 0.45, decay: 1.4, freq: 22, frameCap: 0.18, spellK: 0.5, hurtK: 1.4, strong: 1.8 },
  // Spielzeit läuft im Hitstop mit scale weiter; höchstens einer pro gap. Anlässe: Crit auf Einzelziel, Champion-Kill, Krieger-Smash, Spieler verliert ≥ hurtPct Leben
  hitstop: { scale: 0.05, gap: 200, critMs: 50, smashMs: 70, championMs: 90, hurtMs: 80, hurtPct: 0.15 },
  // Großer Treffer: ab diesem Anteil am Mob-Leben. Kamera-Ruck nach vorn (fx/impact.ts cameraKick), höchstens einmal pro gap
  big: { frac: 0.2, kick: 0.22, gap: 120 },
};

// Einstellung „Bildschirmwackeln“: an, aus, stark
const SHAKE_STORE = 'frostgrind.shake.v1';
export const SHAKE_MODES = ['an', 'aus', 'stark'];
let shakeMode = (() => { try { const v = localStorage.getItem(SHAKE_STORE); return SHAKE_MODES.includes(v) ? v : 'an'; } catch { return 'an'; } })();
export const shakeModeNow = () => shakeMode;
export function setShakeMode(m) {
  shakeMode = m;
  try { localStorage.setItem(SHAKE_STORE, m); } catch { /* egal */ }
}

let trauma = 0, frameAdd = 0, clock = 0;
// Treffer, Schaden, Einschläge: Trauma dazu, gedeckelt pro Frame
export function addTrauma(amount) {
  const room = W.shake.frameCap - frameAdd;
  if (room <= 0 || amount <= 0) return;
  const a = Math.min(room, amount);
  frameAdd += a;
  trauma = Math.min(1, trauma + a);
}
// Einmal pro Frame aus updateCamera: Versatz der Kamera aus zwei Sinus-Schwingungen, kein Zufall pro Frame
export function shakeOffset(dtMs) {
  const s = dtMs / 1000;
  clock += s;
  frameAdd = 0;
  trauma = Math.max(0, trauma - W.shake.decay * s);
  const k = shakeMode === 'aus' ? 0 : trauma * trauma * W.shake.max * (shakeMode === 'stark' ? W.shake.strong : 1);
  const f = W.shake.freq;
  return { x: k * (Math.sin(clock * f) + 0.5 * Math.sin(clock * f * 2.3 + 1.7)) / 1.5, y: k * (Math.sin(clock * f * 1.3 + 0.6) + 0.5 * Math.sin(clock * f * 2.9 + 3.1)) / 1.5 };
}

// Großer Treffer am Mob (mobs.ts damageMob): Kamera-Ruck. school: 0 Feuer, 1 Frost, 2 Arkan, 3 Krieger
let lastBig = -1e9;
export function bigHit(mob, school) {
  const now = performance.now();
  if (now - lastBig < W.big.gap) return;
  lastBig = now;
  cameraKick(W.big.kick);
}
