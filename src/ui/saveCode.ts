// Spielstand-Code: Staub, Freischaltungen, Inventar, Ranglisten und Version als kompaktes JSON → Base64, dazu 4 Zeichen Prüfsumme gegen Tippfehler.
// Kein Schutz gegen Cheaten, Einzelspieler. Eingabe ersetzt den Spielstand nach Rückfrage.

import { $ } from '../util';
import { meta, saveMeta } from '../meta';
import { mage } from '../models/mage';
import { renderMenu } from './mainMenu';

export const SAVE_CODE = { version: 1, runsStore: 'frostgrind.runs.v1', checkLen: 4 };

// Prüfsumme: einfacher Hash über den Base64-Teil, 4 Hex-Zeichen
const check = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 65521; return h.toString(16).padStart(SAVE_CODE.checkLen, '0'); };
const toB64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const fromB64 = s => new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
const loadRunsRaw = () => { try { return JSON.parse(localStorage.getItem(SAVE_CODE.runsStore) || '[]'); } catch { return []; } };

export function exportCode() {
  const data = { v: SAVE_CODE.version, d: meta.dust, u: meta.unlocked, b: meta.bought, t: meta.bestTier, o: meta.offer,
    i: meta.inv.map(w => w.v === 2 ? { r: w.r, s: w.s } : [w.e, w.r, w.m]), q: meta.inv.findIndex(w => w.id === meta.equipped), r: loadRunsRaw() };
  const b64 = toB64(JSON.stringify(data));
  return b64 + check(b64);
}

// Gibt eine Fehlermeldung zurück oder null, wenn der Code passt. replace: wirklich laden.
export function importCode(code, replace = true) {
  const s = String(code).replace(/\s+/g, '');
  if (s.length <= SAVE_CODE.checkLen) return 'Der Code ist zu kurz.';
  const b64 = s.slice(0, -SAVE_CODE.checkLen);
  if (check(b64) !== s.slice(-SAVE_CODE.checkLen)) return 'Der Code ist falsch: Die Prüfsumme passt nicht. Ein Zeichen fehlt oder ist vertippt.';
  let data;
  try { data = JSON.parse(fromB64(b64)); } catch { return 'Der Code ist beschädigt.'; }
  if (data?.v !== SAVE_CODE.version) return `Der Code hat Version ${data?.v ?? '?'}, erwartet ist ${SAVE_CODE.version}.`;
  if (!replace) return null;
  // Alte Waffen als [Effekt, Seltenheit, Modell], Baukasten-Waffen als { r, s }
  const inv = (data.i ?? []).map((w, n) => Array.isArray(w) ? { id: n + 1, e: w[0], r: w[1], m: w[2] } : { id: n + 1, v: 2, r: w.r, s: w.s });
  Object.assign(meta, { dust: data.d ?? 0, unlocked: data.u ?? [], bought: data.b ?? {}, bestTier: data.t ?? 0, offer: data.o ?? [], inv,
    equipped: inv[data.q]?.id ?? null, nextWeapon: inv.length });
  saveMeta();
  try { localStorage.setItem(SAVE_CODE.runsStore, JSON.stringify(data.r ?? [])); } catch { /* kein Storage */ }
  return null;
}

// Fenster: Textfeld, Kopieren oder Laden
const modal = document.createElement('div');
modal.id = 'codeModal';
modal.className = 'modal';
modal.style.zIndex = '5';
modal.innerHTML = `<div class="frame panel" style="width:min(640px,94vw);max-width:none">
  <h1 class="title" style="font-size:24px" id="codeTitle"></h1>
  <p id="codeHint"></p>
  <textarea id="codeText" spellcheck="false" style="width:100%;height:140px;box-sizing:border-box;font:12px monospace;background:#000a;color:#efe0b8;border:1px solid #6b5426;border-radius:4px;padding:6px;word-break:break-all"></textarea>
  <p id="codeMsg" style="min-height:1.4em;color:#ff8a7a"></p>
  <div class="row2">
    <button class="smallBtn" id="codeAction" style="width:auto;padding:6px 14px"></button>
    <button class="smallBtn" id="codeClose" style="width:auto;padding:6px 14px">Schließen</button>
  </div>
</div>`;
document.body.appendChild(modal);
let mode = 'show';
function open(m) {
  mode = m;
  const text = $('codeText') as HTMLTextAreaElement;
  $('codeTitle').textContent = m === 'show' ? 'Spielstand-Code' : 'Code eingeben';
  $('codeHint').textContent = m === 'show' ? `Kopieren und sicher aufheben. ${exportCode().length} Zeichen.` : 'Code einfügen. Der jetzige Spielstand wird ersetzt.';
  $('codeAction').textContent = m === 'show' ? 'Kopieren' : 'Laden';
  $('codeMsg').textContent = '';
  text.value = m === 'show' ? exportCode() : '';
  text.readOnly = m === 'show';
  modal.classList.add('show');
  text.focus();
  if (m === 'show') text.select();
}
$('codeClose').addEventListener('click', () => modal.classList.remove('show'));
$('codeAction').addEventListener('click', async () => {
  const text = $('codeText') as HTMLTextAreaElement;
  if (mode === 'show') {
    try { await navigator.clipboard.writeText(text.value); $('codeMsg').textContent = 'Kopiert.'; }
    catch { text.select(); $('codeMsg').textContent = 'Kopieren ging nicht, bitte markierten Text selbst kopieren.'; }
    return;
  }
  const err = importCode(text.value, false);
  if (err) { $('codeMsg').textContent = err; return; }
  if (!confirm('Spielstand ersetzen?')) return;
  importCode(text.value);
  modal.classList.remove('show');
  mage.refreshWeapon();
  renderMenu();
});
for (const [id, label, m] of [['menuCodeShow', 'Code zeigen', 'show'], ['menuCodeLoad', 'Code eingeben', 'load']]) {
  const b = document.createElement('button');
  b.className = 'smallBtn';
  b.id = id;
  b.textContent = label;
  b.addEventListener('click', () => open(m));
  $('menuActions').appendChild(b);
}
(window as any).__save = { exportCode, importCode };
