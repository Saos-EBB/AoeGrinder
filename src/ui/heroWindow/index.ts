// Ein Fenster für Waffen, Charakter und Ausrüstung (Handoff docs/handoffs/fenster.md, Vorlage docs/ref/charakterfenster/, Layout A).
// Links Figur mit Slots und Werten, rechts das Inventar. X und I öffnen und schließen es (Bind-IDs charWin/gearWin in input.ts), Esc schließt.
// Pausiert (menus.ts BLOCKING), geht auch während der Kartenwahl und aus dem Pause-Menü. Im Run nur ansehen, im Hauptmenü voll.
// Gear-Teile tragen Hersteller und Gruppe (gear/shown.ts makerOf/groupOf), fehlt eins → „—“.
// Geschnitten (E10, ARCH-06): state, left, inventory, filter, tree, keys; hier Zeichnen, Öffnen, Schließen und mount() (DOM-Gerüst und Listener).
import { $ } from '../../util';
import { meta } from '../../meta';
import { heroModel } from '../../models/heroModel';
import { SLOTS } from '../../gear/data';
import { gearInv } from '../../gear/inventory';
import { mountFigPreview, setFigPreview } from '../figPreview';
import { warmThumbs } from '../itemThumb';
import { hideTip } from '../tooltip';
import { syncPause } from '../menus';
import { uiSettings, setUi } from '../uiSettings';
import { t } from '../../i18n';
import '../heroWindow.css';
import { type Tab, hw, heroOpen, inRun, viewOnly } from './state';
import { renderLeft } from './left';
import { entries, renderSel, fitTabs, renderInv } from './inventory';
import { closeLists } from './filter';
import { askOpen, heroCommand, KEYS } from './keys';

// Öffentlich (ui/connect.ts, mainMenu.ts, shop.ts, hud/elements.ts): openHero, closeHero, toggleHero, heroCommand, heroOpen, mount
export { heroOpen } from './state';
export { toggleHero, heroCommand, type HeroCmd } from './keys';

warmThumbs(() => !inRun());   // Bild-Renderer im Hauptmenü vorab anlegen

export function render() {
  hideTip();
  $('heroModal').classList.toggle('viewOnly', viewOnly());
  renderLeft();
  renderInv();
}

export function openHero(opts: { tab?: Tab; done?: () => void } = {}) {
  hw.onClose = opts.done ?? null;
  if (opts.tab && opts.tab !== hw.tab) { hw.tab = opts.tab; hw.sel = null; }
  hw.seenW = uiSettings.weaponSeen;
  hw.seenG = uiSettings.gearSeen;
  mountFigPreview($('hwFig'));   // 3D-Ansicht der Figur, gezeichnet in main.ts (renderFigPreview)
  setFigPreview(true);
  $('heroModal').classList.add('show');
  render();
  syncPause();
}
export function closeHero() {
  hideTip();
  $('heroModal').classList.remove('show');
  setFigPreview(false);
  heroModel.previewWeapon(null);
  closeLists();
  setUi('weaponSeen', Math.max(uiSettings.weaponSeen, ...meta.inv.map(w => w.id)));   // ab jetzt nicht mehr NEU
  setUi('gearSeen', Math.max(uiSettings.gearSeen, ...SLOTS.flatMap(s => gearInv(s).map(g => g.id))));
  syncPause();
  const done = hw.onClose;
  hw.onClose = null;
  done?.();
}

// DOM-Gerüst und Fenster-Listener (E10): erst hier, nicht beim Import. main.ts ruft mount() in der Reihenfolge von früher
// (Escape-Kette der Capture-Listener; heroModal liegt im body wie vorher über gearKeepModal, gleicher z-index 5).
export function mount() {
  document.body.insertAdjacentHTML('beforeend', `<div id="heroModal" class="modal" role="dialog" aria-labelledby="hwName">
  <div id="hwBox">
    <div class="fg-panel hwLeft" data-sektor="SEKTOR 07 · ${t('hw.sekFig')}">
      <div class="hwHead"><h1 class="fg-title l" id="hwName"></h1><span class="hwLabel" id="hwLevel"></span></div>
      <div class="hwDoll"><div class="hwCol" id="hwSlotsL"></div><div class="hwFig" id="hwFig"></div><div class="hwCol" id="hwSlotsR"></div><span class="hwFigHint">${t('gear.figHint')}</span></div>
      <div id="hwSet"></div>
      <div class="hwStats" id="hwStats"></div>
    </div>
    <div class="fg-panel hwInv" data-sektor="SEKTOR 12 · ${t('hw.sekInv')}">
      <div class="hwInvHead"><h2 class="fg-title l">${t('hw.inv')}</h2><span id="hwWait"></span>
        <div class="hwToggle" role="group" aria-label="${t('hw.view')}"><button type="button" data-v="grid">${t('hw.grid')}</button><button type="button" data-v="tree">${t('hw.tree')}</button></div><button type="button" class="fg-btn alt" id="hwClose">${t('ui.close')}</button></div>
      <div class="hwTabs" id="hwTabs" role="tablist"></div>
      <div class="hwBar" id="hwBar"></div>
      <div class="hwActive"><span id="hwChips"></span><small id="hwCount"></small></div>
      <div class="hwFinds" id="hwFinds"></div>
      <div class="hwBody" id="hwBody"><div class="hwGrid" id="hwGrid"></div><div class="hwTree" id="hwTree" role="tree"></div></div>
      <div class="hwSel" id="hwSel"></div>
      <div class="hwFoot"><span id="hwDust"></span><button type="button" class="fg-btn alt" id="hwChest">${t('hw.toChest')}</button><button type="button" class="fg-btn alt" id="hwFuse" disabled title="${t('shop.soon')}"></button></div>
      <p class="hwHint" id="hwHint"></p>
    </div>
  </div>
</div>`);
  $('heroModal').addEventListener('pointerdown', e => { if (!(e.target as HTMLElement).closest('.hwDrop')) closeLists(); });
  new ResizeObserver(fitTabs).observe($('hwTabs'));
  document.fonts?.addEventListener?.('loadingdone', fitTabs);
  for (const b of document.querySelectorAll<HTMLElement>('.hwToggle button')) b.addEventListener('click', () => { setUi('heroView', b.dataset.v as 'grid' | 'tree'); renderInv(); });
  $('hwChest').addEventListener('click', () => {
    const fromShop = $('shopModal').classList.contains('show');
    closeHero();
    if (!fromShop && $('startModal').classList.contains('show')) $('menuShop').click();
  });

  $('hwClose').addEventListener('click', closeHero);
  addEventListener('keydown', e => { if (e.key === 'Shift' && !hw.shift && heroOpen()) { hw.shift = true; renderSel(entries(hw.tab)); } }, true);
  addEventListener('keyup', e => { if (e.key === 'Shift' && hw.shift) { hw.shift = false; if (heroOpen()) renderSel(entries(hw.tab)); } });
  addEventListener('keydown', e => {
    if (!heroOpen() || askOpen() || e.target instanceof HTMLInputElement) return;
    const cmd = e.key === '/' ? 'search' : KEYS[e.code];
    if (!cmd || e.ctrlKey || e.altKey || e.metaKey) return;
    if (cmd === 'enter' && document.activeElement instanceof HTMLButtonElement && document.activeElement.closest('#heroModal') && !document.activeElement.closest('.hwGrid, .hwTree')) return;   // fokussierter Knopf: der Browser klickt
    e.preventDefault();
    e.stopImmediatePropagation();
    heroCommand(cmd);
  }, true);
}
