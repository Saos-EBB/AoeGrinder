// Bedienung des Charakterfensters ohne Maus (E10, aus heroWindow.ts): X/I öffnen und schließen, Befehle für Tastatur und Pad.
import { $ } from '../../util';
import { weaponCardData } from '../weaponCard';
import { hideTip, tipAt } from '../tooltip';
import { setUi } from '../uiSettings';
import { type Tab, hw, heroOpen } from './state';
import { TABS, entries, setTab, wearEntry, salvageEntry, tipOf, renderInv } from './inventory';
import { closeLists, listsOpen } from './filter';
import { treeView, isOpenF, setFolder, treeRows } from './tree';
import { render, openHero, closeHero } from './index';

// Taste X oder I (gleiche Aktion), Pad-Knopf Charakter, HUD-Mikromenü, Pause-Menü: offen → zu, sonst auf.
// Nicht über anderen Fenstern außer Hauptmenü, Pause und Kartenwahl (Tod, Shop, Einstellungen, Laden …); zu nicht, solange eine Rückfrage darüber liegt.
const BELOW = ['startModal', 'pauseModal', 'cardModal', 'heroModal'];
export const askOpen = () => !!document.querySelector('.modal.show:has(#askTitle), #gearKeepModal.show');
export function toggleHero() {
  if (heroOpen()) { if (!askOpen()) closeHero(); return; }
  if ([...document.querySelectorAll<HTMLElement>('.modal.show')].some(m => !BELOW.includes(m.id))) return;
  openHero();
}

// ---------- Bedienung ohne Maus: Tastatur und Pad (gamepad.ts) über dieselben Befehle ----------
export type HeroCmd = 'left' | 'right' | 'up' | 'down' | 'enter' | 'delete' | 'prevTab' | 'nextTab' | 'view' | 'search' | 'close';
// Auswahl sichtbar machen: hinscrollen und die Karte am Eintrag zeigen
function showSel() {
  const node = document.querySelector<HTMLElement>(`#heroModal [data-key="${CSS.escape(hw.sel ?? '')}"]`);
  if (!node) { hideTip(); return; }
  node.scrollIntoView({ block: 'nearest' });
  const e = (treeView() ? treeRows().find(r => r.key === hw.sel)?.entry : entries(hw.tab).find(x => x.key === hw.sel)) ?? null;
  if (!e) { hideTip(); return; }
  tipAt(node, () => e.kind === 'w' ? weaponCardData(e.item) : tipOf(e));
}
function moveSel(step: number) {
  if (treeView()) {
    const rows = treeRows(), i = rows.findIndex(r => r.key === hw.sel), next = rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? 0 : i + step))];
    if (next) { hw.sel = next.key; if (next.tab !== hw.tab) { hw.tab = next.tab; setUi('heroTab', hw.tab); } }
  } else {
    const list = entries(hw.tab), i = list.findIndex(x => x.key === hw.sel);
    const next = list[i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + step))];
    if (next) hw.sel = next.key;
  }
  render();
  showSel();
}
function stepTab(d: number) { setTab(TABS[(TABS.indexOf(hw.tab) + d + TABS.length) % TABS.length]); if (treeView()) { hw.sel = `f:${hw.tab}`; render(); } showSel(); }
export function heroCommand(cmd: HeroCmd) {
  if (!heroOpen() || askOpen()) return;
  const tree = treeView(), row = tree ? treeRows().find(r => r.key === hw.sel) : null, cur = tree ? row?.entry : entries(hw.tab).find(x => x.key === hw.sel);
  if (cmd === 'close') { if (listsOpen()) closeLists(); else closeHero(); return; }
  if (cmd === 'up') return moveSel(tree ? -1 : -10);
  if (cmd === 'down') return moveSel(tree ? 1 : 10);
  if (cmd === 'left') {
    if (!tree) return moveSel(-1);
    if (row?.folder && isOpenF(row.folder)) { setFolder(row.folder, false); render(); showSel(); return; }   // Ordner zu
    if (row?.parent) { hw.sel = row.parent; render(); showSel(); }                                             // zum Eltern-Ordner
    return;
  }
  if (cmd === 'right') {
    if (!tree) return moveSel(1);
    if (row?.folder && !isOpenF(row.folder)) { setFolder(row.folder, true); render(); showSel(); return; }  // Ordner auf
    return moveSel(1);
  }
  if (cmd === 'enter') {
    if (row?.folder) { setFolder(row.folder, !isOpenF(row.folder)); render(); showSel(); return; }
    if (cur) { wearEntry(cur); showSel(); }
    return;
  }
  if (cmd === 'delete') { if (cur) salvageEntry(cur).then(showSel); return; }
  if (cmd === 'prevTab') return stepTab(-1);
  if (cmd === 'nextTab') return stepTab(1);
  if (cmd === 'view') { setUi('heroView', tree ? 'grid' : 'tree'); renderInv(); showSel(); return; }
  if (cmd === 'search') { const q = document.getElementById('hwQ') as HTMLInputElement | null; if (q && !$('hwBar').hidden) { hideTip(); q.focus(); q.select(); } }
}
// Pfeile wählen (im Baum → ← auf/zu), Enter rüstet aus, Entf zerlegt (Rückfrage), / sucht, Q/E bzw. Bild↑/↓ wechseln den Tab, Tab schaltet Raster/Baum,
// Shift vergleicht (Karte und Zeile unten), Esc schließt. Tasten, die hier etwas tun, gehen nicht weiter ans Spiel
export const KEYS: Record<string, HeroCmd> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'enter', NumpadEnter: 'enter', Delete: 'delete',
  KeyQ: 'prevTab', KeyE: 'nextTab', PageUp: 'prevTab', PageDown: 'nextTab', Tab: 'view', Slash: 'search', NumpadDivide: 'search', Escape: 'close' };
