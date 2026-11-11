// Spielstand-Code: Staub, Freischaltungen, Inventar, Gear (gear/), offene Maps der Weltkarte, Ranglisten (mit Seed) und Version als kompaktes JSON → Base64, dazu 4 Zeichen Prüfsumme gegen Tippfehler.
// Kein Schutz gegen Cheaten, Einzelspieler. Eingabe ersetzt den Spielstand nach Rückfrage.

import { $ } from '../util';
import { meta, saveMeta, cleanWeapon, cleanSkinState } from '../meta';
import { checkUnlocks } from '../gear/inventory';
import { heroModel } from '../models/heroModel';
import { renderMenu } from './mainMenu';
import { loadRuns, saveRuns } from '../leaderboard';   // nach mainMenu: das lädt leaderboard schon, Reihenfolge der Module bleibt
import { normalizeMeta } from '../metaNormalize';
import { askConfirm } from './confirm';
import { t } from '../i18n';

const SAVE_CODE = { version: 1, checkLen: 4 };

// Prüfsumme: einfacher Hash über den Base64-Teil, 4 Hex-Zeichen
const check = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 65521; return h.toString(16).padStart(SAVE_CODE.checkLen, '0'); };
const toB64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const fromB64 = s => new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));

function exportCode() {
  const data = { v: SAVE_CODE.version, d: meta.dust, u: meta.unlocked, b: meta.bought, t: meta.bestTier, o: meta.offer,
    i: meta.inv.map(w => w.v === 2 ? { r: w.r, s: w.s } : [w.e, w.r, w.m]), q: meta.inv.findIndex(w => w.id === meta.equipped), k: meta.skins, r: loadRuns(),   // k: Skins pro Figur, fehlt in alten Codes
    g: meta.gear, w: meta.wear, go: meta.gearOver, ng: meta.nextGear, lk: meta.looks, lw: meta.lookWear, ac: meta.achievements, mp: meta.maps, st: meta.stats, sc: meta.schema };   // sc: Schema-Version des Stands (storage.ts META_SCHEMA), fehlt in alten Codes; beim Laden ignoriert, normalizeMeta setzt sie   // st: Zähler über alle Runs (Meilensteine), fehlt in alten Codes → 0   // Gear, angelegt, wartende Funde, Zähler, Kosmetik, Erfolge: fehlen in alten Codes, alter Code überliest sie (bleibt Version 1); mp: offene Themes der Weltkarte (mapgen/progress.ts), fehlt in alten Codes → nur Wald
  const b64 = toB64(JSON.stringify(data));
  return b64 + check(b64);
}

// Gibt eine Fehlermeldung zurück oder null, wenn der Code passt. replace: wirklich laden.
function importCode(code, replace = true) {
  const s = String(code).replace(/\s+/g, '');
  if (s.length <= SAVE_CODE.checkLen) return t('code.short');
  const b64 = s.slice(0, -SAVE_CODE.checkLen);
  if (check(b64) !== s.slice(-SAVE_CODE.checkLen)) return t('code.bad');
  let data;
  try { data = JSON.parse(fromB64(b64)); } catch { return t('code.broken'); }
  if (data?.v !== SAVE_CODE.version) return t('code.version', { a: data?.v ?? '?', b: SAVE_CODE.version });
  if (!replace) return null;
  // Alte Waffen als [Effekt, Seltenheit, Modell], Baukasten-Waffen als { r, s }
  const inv = (data.i ?? []).map((w, n) => Array.isArray(w) ? { id: n + 1, e: w[0], r: w[1], m: w[2] } : cleanWeapon({ id: n + 1, v: 2, r: w.r, s: w.s }));
  Object.assign(meta, { dust: data.d ?? 0, unlocked: data.u ?? [], bought: data.b ?? {}, bestTier: data.t ?? 0, offer: data.o ?? [], inv,
    equipped: inv[data.q]?.id ?? null, nextWeapon: inv.length, skins: data.k, achievements: data.ac,
    gear: data.g, wear: data.w, gearOver: data.go, nextGear: data.ng, looks: data.lk, lookWear: data.lw, maps: data.mp, stats: data.st });
  normalizeMeta(meta);   // dieselbe Säuberung wie beim Start (metaNormalize.ts), mit Id-Dedupe
  checkUnlocks(true);   // alter Code ohne Erfolge, aber mit angelegtem 5/5: Erfolg nachtragen
  meta.skins = data.k;   // Skin aus dem Code erst jetzt prüfen: sein Set-Erfolg kann eben von checkUnlocks nachgetragen worden sein
  cleanSkinState(meta);   // gewählter, aber gesperrter Magier-Skin → Standard
  saveMeta();
  saveRuns(data.r ?? []);
  return null;
}

// Fenster: Textfeld, Kopieren oder Laden. Gebaut in mount (main.ts)
let modal: HTMLElement;
let mode = 'show';
function open(m) {
  mode = m;
  const text = $('codeText') as HTMLTextAreaElement;
  $('codeTitle').textContent = t(m === 'show' ? 'code.title' : 'code.enter');
  $('codeHint').textContent = m === 'show' ? t('code.copyHint', { n: exportCode().length }) : t('code.pasteHint');
  $('codeAction').textContent = t(m === 'show' ? 'code.copy' : 'code.load');
  $('codeMsg').textContent = '';
  text.value = m === 'show' ? exportCode() : '';
  text.readOnly = m === 'show';
  modal.classList.add('show');
  text.focus();
  if (m === 'show') text.select();
}
// Fenster und die zwei Einträge im „Mehr“-Menü; main.ts ruft das einmal beim Start
export function mount() {
  modal = document.createElement('div');
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
      <button class="smallBtn" id="codeClose" style="width:auto;padding:6px 14px">${t('ui.close')}</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  $('codeClose').addEventListener('click', () => modal.classList.remove('show'));
  $('codeAction').addEventListener('click', async () => {
    const text = $('codeText') as HTMLTextAreaElement;
    if (mode === 'show') {
      try { await navigator.clipboard.writeText(text.value); $('codeMsg').textContent = t('code.copied'); }
      catch { text.select(); $('codeMsg').textContent = t('code.copyFail'); }
      return;
    }
    const err = importCode(text.value, false);
    if (err) { $('codeMsg').textContent = err; return; }
    if (!await askConfirm(t('code.replaceTitle'), t('code.replaceText'), t('code.replace'))) return;
    importCode(text.value);
    modal.classList.remove('show');
    heroModel.refreshWeapon();
    heroModel.refreshSkin();
    renderMenu();
  });
  for (const [id, label, m] of [['menuCodeShow', t('code.show'), 'show'], ['menuCodeLoad', t('code.enter'), 'load']]) {
    const b = document.createElement('button');
    b.className = 'fg-btn alt';
    b.id = id;
    b.textContent = label;
    b.addEventListener('click', () => open(m));
    $('menuMoreList').appendChild(b);   // seltene Einträge im „Mehr“-Menü oben rechts (mainMenu.ts)
  }
}
(window as any).__save = { exportCode, importCode };
