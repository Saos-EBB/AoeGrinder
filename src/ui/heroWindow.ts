// Ein Fenster für Waffen, Charakter und Ausrüstung (Handoff docs/handoffs/fenster.md, Vorlage docs/ref/charakterfenster/, Layout A).
// Links Figur mit Slots und Werten, rechts das Inventar. X und I öffnen und schließen es (input.ts charWin/gearWin), Esc schließt.
// Pausiert (menus.ts BLOCKING), geht auch während der Kartenwahl und aus dem Pause-Menü. Im Run nur ansehen, im Hauptmenü voll.

import { $ } from '../util';
import { syncPause } from './menus';
import { hideTip } from './tooltip';
import { t } from '../i18n';
import './heroWindow.css';

export type Tab = 'waffen' | 'kopf' | 'hals' | 'ruecken' | 'arme' | 'koerper' | 'kosmetik';

document.body.insertAdjacentHTML('beforeend', `<div id="heroModal" class="modal" role="dialog" aria-labelledby="hwName">
  <div id="hwBox">
    <div class="fg-panel hwLeft" data-sektor="SEKTOR 07 · ${t('hw.sekFig')}">
      <div class="hwHead"><h1 class="fg-title l" id="hwName"></h1><span class="hwLabel" id="hwLevel"></span></div>
      <div class="hwDoll" id="hwDoll"></div>
      <div id="hwSet"></div>
      <div class="hwStats" id="hwStats"></div>
    </div>
    <div class="fg-panel hwInv" data-sektor="SEKTOR 12 · ${t('hw.sekInv')}">
      <div class="hwInvHead"><h2 class="fg-title l">${t('hw.inv')}</h2><span id="hwWait"></span><button type="button" class="fg-btn alt" id="hwClose">${t('ui.close')}</button></div>
      <div class="hwBody" id="hwBody"></div>
    </div>
  </div>
</div>`);

let onClose: (() => void) | null = null, tab: Tab = 'waffen';
export const heroOpen = () => $('heroModal').classList.contains('show');
export const inRun = () => !$('startModal').classList.contains('show');

function render() {
  $('heroModal').classList.toggle('viewOnly', inRun());
}

export function openHero(opts: { tab?: Tab; done?: () => void } = {}) {
  onClose = opts.done ?? null;
  if (opts.tab) tab = opts.tab;
  $('heroModal').classList.add('show');
  render();
  syncPause();
}
export function closeHero() {
  hideTip();
  $('heroModal').classList.remove('show');
  syncPause();
  const done = onClose;
  onClose = null;
  done?.();
}
// Taste X oder I (gleiche Aktion), Pad-Knopf Charakter, HUD-Mikromenü, Pause-Menü: offen → zu, sonst auf.
// Nicht über anderen Fenstern außer Hauptmenü, Pause und Kartenwahl (Tod, Shop, Einstellungen, Laden …); zu nicht, solange eine Rückfrage darüber liegt.
const BELOW = ['startModal', 'pauseModal', 'cardModal', 'heroModal'];
const askOpen = () => !!document.querySelector('.modal.show:has(#askTitle), #gearKeepModal.show');
export function toggleHero() {
  if (heroOpen()) { if (!askOpen()) closeHero(); return; }
  if ([...document.querySelectorAll<HTMLElement>('.modal.show')].some(m => !BELOW.includes(m.id))) return;
  openHero();
}

$('hwClose').addEventListener('click', closeHero);
addEventListener('keydown', e => {
  if (!heroOpen() || askOpen()) return;
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeHero(); }
}, true);
