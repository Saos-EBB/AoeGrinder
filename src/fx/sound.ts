// Synthetische Sounds über WebAudio, kein Download: Einschlag, Frost-Klirren, Blitzknistern, Feuer-Wumms. Alle Werte PH.
import { t } from '../i18n';

const VOLUME_KEY = 'frostgrind.volume.v1', DEFAULT_VOLUME = 0.6;
const MIN_GAP = { impact: 70, frost: 90, zap: 60, fire: 90 };   // ms je Art, sonst türmt sich ein 50er-Kettenblitz auf

let volume = DEFAULT_VOLUME;
try { const v = parseFloat(localStorage.getItem(VOLUME_KEY)); if (v >= 0 && v <= 1) volume = v; } catch { /* kein Storage */ }

let ctx = null, master = null, noiseBuf = null;
function audio() {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();   // viele Treffer zugleich dürfen nicht übersteuern
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export const getVolume = () => volume;
function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* kein Storage */ }
}

function envelope(t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(master);
  return g;
}
function tone(t, type, f0, f1, peak, attack, decay) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
  o.connect(envelope(t, peak, attack, decay));
  o.start(t);
  o.stop(t + attack + decay + 0.02);
}
function noise(t, filterType, f0, f1, q, peak, attack, decay) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
  s.connect(f).connect(envelope(t, peak, attack, decay));
  s.start(t, Math.random());
  s.stop(t + attack + decay + 0.02);
}

const SYNTH = {
  impact(t, k) {
    tone(t, 'sine', 120, 36, 0.8 * k, 0.004, 0.26);
    noise(t, 'lowpass', 2200, 180, 0.7, 0.42 * k, 0.002, 0.16);
  },
  frost(t, k) {
    for (let i = 0; i < 6; i++) {                 // Klirren: unharmonische, kurze Töne versetzt
      const at = t + i * 0.018 + Math.random() * 0.012, f = 2300 + Math.random() * 4200;
      tone(at, 'sine', f, f * 0.97, 0.12 * k, 0.001, 0.09 + Math.random() * 0.14);
    }
    noise(t, 'highpass', 5200, 3200, 0.6, 0.14 * k, 0.002, 0.2);
  },
  zap(t, k) {
    for (let i = 0; i < 5; i++) {                 // Knistern: kurze Stöße in unregelmäßigem Abstand
      const at = t + i * 0.015 + Math.random() * 0.008;
      noise(at, 'bandpass', 2600 + Math.random() * 3600, 1900, 3, 0.26 * k, 0.001, 0.016 + Math.random() * 0.02);
    }
  },
  fire(t, k) {
    tone(t, 'sine', 92, 40, 0.72 * k, 0.012, 0.4);
    noise(t, 'lowpass', 1300, 120, 0.8, 0.5 * k, 0.015, 0.5);
  },
};

const lastPlayed = {};
// kind: impact, frost, zap, fire. strength skaliert die Lautstärke.
export function playSound(kind, strength = 1) {
  try {
    const now = performance.now();
    if (now - (lastPlayed[kind] ?? -1e9) < MIN_GAP[kind]) return;
    lastPlayed[kind] = now;
    audio();
    if (ctx.state === 'suspended') ctx.resume();
    SYNTH[kind](ctx.currentTime, strength);
  } catch { /* kein Audio – egal */ }
}

// Regler, in Menü und Labor gleich
export function mountVolume(el, position) {
  el.insertAdjacentHTML(position, `<label for="volumeSlider" style="display:block;margin:6px 0 3px">${t('settings.volume')}: <span id="volumeValue"></span></label><input id="volumeSlider" type="range" min="0" max="100" step="5" style="width:100%;margin-bottom:10px">`);
  const slider = document.getElementById('volumeSlider') as HTMLInputElement, value = document.getElementById('volumeValue');
  const show = () => { value.textContent = `${Math.round(volume * 100)} %`; };
  slider.value = String(Math.round(volume * 100));
  show();
  slider.addEventListener('input', () => { setVolume(Number(slider.value) / 100); show(); });
  slider.addEventListener('change', () => playSound('impact', 0.7));
}
