// Dev-Panel (F10, Mockup Dev.dc.html): schwebendes Fenster. Titelleiste zieht, Ecke unten rechts ändert die Größe,
// Knöpfe durchsichtig / einklappen / schließen. Position und Größe in frostgrind.ui.v1.
// Inhalt: die Dev-Blöcke aus index.html (#devPanel) und die, die andere Module mit registerDev(key, el) anmelden (main.ts mountDev).
// Beim ersten Öffnen kommen sie in Gruppen; Gruppen, Reihenfolge und Unterzeilen stehen fest in DEV_LAYOUT, nicht in der Import-Reihenfolge.

import { $ } from '../util';
import { state } from '../state';
import { SCORE_VERSION } from '../config';
import { uiSettings, setUi } from './uiSettings';

const MIN = 300;   // kleinste Breite und Höhe in px
const panel = $('devPanel');

// Feste Ordnung: Gruppe, Name, Blöcke [Schlüssel, Unterzeile]. Schlüssel = ID des Blocks (index.html) oder Schlüssel aus registerDev
const DEV_LAYOUT = [
  ['spieler', 'Spieler & Level', [['devLevels', 'Level setzen'], ['devCards', 'Karte erzwingen'], ['devLuck', ''], ['devComplete', '']]],
  ['zone', 'Zone & Map', [['devZones', 'Zone'], ['devWorld', 'Weltkarte'], ['devPortal', 'Portal'], ['devObjects', 'Objekte']]],
  ['mobs', 'Mobs & Bosse', [['devChamp', 'Champion-Pack'], ['devBoss', 'Boss'], ['devKinds', 'Pack: Kategorie × Zusatz × Theme'], ['devMobAtk', '']]],
  ['waffen', 'Waffen', [['devInv', 'Inventar'], ['devForge', 'Waffen-Baukasten'], ['devLegend', 'Krieger-Legende']]],
  ['gear', 'Gear', [['devGearSet', 'Sets']]],
  ['kosmetik', 'Kosmetik', [['devKosmetik', '']]],
  ['meta', 'Meta & Staub', [['devMeta', '']]],
  ['anzeige', 'Anzeige', [['devPerf', ''], ['devColliders', ''], ['devFeat', 'Erfolgs-Meldung']]],
] as const;
type DevKey = (typeof DEV_LAYOUT)[number][2][number][0];
const blocks = new Map<string, HTMLElement>();
const onOpen: (() => void)[] = [];
// Block anmelden: el kommt sofort ins Panel (IDs darin sind gleich auffindbar), refresh läuft bei jedem Öffnen (F10)
export function registerDev(key: DevKey, el: HTMLElement, refresh?: () => void) {
  blocks.set(key, el);
  (panel.querySelector(':scope > .devBody') ?? panel).append(el);
  if (refresh) onOpen.push(refresh);
}

// Kopf, Inhalt, Griff; die vorhandenen Kinder wandern in .devBody
const icon = d => `<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${d}</svg>`;
const head = document.createElement('div');
head.className = 'devTitle';
head.innerHTML = `<span class="devGrip" aria-hidden="true">⠿</span><b>DEV</b><span class="devSub"></span>
  <span class="devBtns"><button type="button" data-a="ghost" title="Durchsichtig" aria-label="Durchsichtig">${icon('<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>')}</button><button type="button" data-a="fold" title="Einklappen" aria-label="Einklappen">${icon('<path d="M5 12h14"/>')}</button><button type="button" data-a="close" title="Schließen" aria-label="Schließen">${icon('<path d="M6 6l12 12M18 6L6 18"/>')}</button></span>`;
const body = document.createElement('div');
body.className = 'devBody';
const fps = document.createElement('div');
fps.id = 'devFps';
fps.textContent = 'FPS – · Calls – · Mobs –';
const grip = document.createElement('div');
grip.className = 'devResize';
grip.setAttribute('aria-label', 'Größe ändern');
panel.querySelector('.devHead')?.remove();
body.append(...panel.children);
panel.append(head, body, fps, grip);

// Sektionen als Akkordeon: Kopfzeile ▸/▾ klappt auf/zu, offene Sektionen in frostgrind.ui.v1 (devPanel.open). Standard: nur die erste offen.
// Die alten „Dev: …“-Überschriften fallen weg, kleine Unterzeilen sagen, was ein Block tut
let sorted = false;
const openList = () => box().open ?? ['spieler'];
function sortGroups() {
  sorted = true;
  for (const t of [...body.querySelectorAll(':scope > .title')]) t.remove();
  const WRAPPED = new Set(['devGearSet']);   // Übergang: Block = umgebendes Element (bis registerDev)
  const found = new Map<string, HTMLElement | null>();   // vor dem Leeren suchen: danach hängen die Blöcke nicht mehr im Dokument
  for (const [, , items] of DEV_LAYOUT) for (const [id] of items) found.set(id, blocks.get(id) ?? (WRAPPED.has(id) ? document.getElementById(id)?.parentElement : document.getElementById(id)));
  const rest = [...body.children];
  body.innerHTML = '';
  const section = (key: string, name: string, els: HTMLElement[]) => {
    const sec = document.createElement('section');
    sec.className = 'devAcc';
    sec.dataset.k = key;
    const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'devAccHead' });
    btn.innerHTML = `<span class="devAccArrow" aria-hidden="true"></span><span>${name}</span>`;
    const inner = document.createElement('div');
    inner.className = 'devAccBody';
    inner.append(...els);
    sec.append(btn, inner);
    setOpen(sec, openList().includes(key));
    body.append(sec);
  };
  for (const [key, name, items] of DEV_LAYOUT) {
    const els: HTMLElement[] = [];
    for (const [id, label] of items) {
      const el = found.get(id);
      if (!el) continue;
      if (label) els.push(Object.assign(document.createElement('h3'), { textContent: label }));
      els.push(el);
    }
    if (els.length) section(key, name, els);
  }
  // Was keiner Gruppe gehört (neue Dev-Knöpfe), landet unten statt zu verschwinden
  const left = rest.filter(e => !body.contains(e)) as HTMLElement[];
  if (left.length) section('sonst', 'Sonstiges', left);
}
function setOpen(sec: HTMLElement, on: boolean) {
  sec.classList.toggle('open', on);
  const btn = sec.querySelector('.devAccHead');
  btn.setAttribute('aria-expanded', String(on));
  (btn.querySelector('.devAccArrow') as HTMLElement).textContent = on ? '▾' : '▸';
}
// Klick auf die Kopfzeile: auf/zu und merken. Zählt nicht als Dev-Bedienung (stopPropagation vor dem devUsed-Listener)
body.addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest('.devAccHead');
  if (!btn) return;
  e.stopImmediatePropagation();
  const sec = btn.parentElement as HTMLElement, on = !sec.classList.contains('open');
  setOpen(sec, on);
  box().open = [...body.querySelectorAll<HTMLElement>('.devAcc.open')].map(s => s.dataset.k);
  save();
});

// Hinweis „Run zählt nicht“: Jede Bedienung im Panel markiert den laufenden Run. Die Rangliste filtert das (noch) nicht
const showSub = () => { (head.querySelector('.devSub') as HTMLElement).textContent = `F10 · ${SCORE_VERSION}${state.devUsed ? ' · Run zählt nicht' : ''}`; };
body.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) { state.devUsed = true; showSub(); } });
body.addEventListener('change', () => { state.devUsed = true; showSub(); });

// Position und Größe, immer im Bildschirm
const box = () => uiSettings.devPanel;
function place() {
  const b = box();
  b.w = Math.max(MIN, Math.min(b.w, innerWidth)); b.h = Math.max(MIN, Math.min(b.h, innerHeight));
  b.x = Math.max(0, Math.min(b.x, innerWidth - b.w)); b.y = Math.max(0, Math.min(b.y, innerHeight - (b.fold ? 40 : b.h)));   // ganz im Bild, damit der Inhalt scrollt statt unten abzuschneiden
  Object.assign(panel.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: b.fold ? 'auto' : `${b.h}px` });
  panel.classList.toggle('ghost', !!b.ghost);
  panel.classList.toggle('folded', !!b.fold);
}
const save = () => setUi('devPanel', { ...box() });

let drag = null;
head.addEventListener('pointerdown', e => {
  if ((e.target as HTMLElement).closest('button')) return;
  drag = { mode: 'move', x: e.clientX, y: e.clientY, b: { ...box() } };
  head.setPointerCapture(e.pointerId);
});
grip.addEventListener('pointerdown', e => {
  drag = { mode: 'size', x: e.clientX, y: e.clientY, b: { ...box() } };
  grip.setPointerCapture(e.pointerId);
});
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, b = box();
  if (drag.mode === 'move') { b.x = drag.b.x + dx; b.y = drag.b.y + dy; } else { b.w = drag.b.w + dx; b.h = drag.b.h + dy; }
  place();
});
addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });
addEventListener('resize', place);

head.querySelector('.devBtns').addEventListener('click', e => {
  const a = (e.target as HTMLElement).closest('button')?.dataset.a, b = box();
  if (a === 'ghost') b.ghost = !b.ghost;
  if (a === 'fold') b.fold = !b.fold;
  if (a === 'close') { panel.hidden = true; return; }
  place();
  save();
});

addEventListener('keydown', e => {
  if (e.code !== 'F10' || state.rebinding) return;
  e.preventDefault();
  panel.hidden = !panel.hidden;
  if (panel.hidden) return;
  if (!sorted) sortGroups();
  for (const fn of onOpen) fn();   // z. B. Zonen-Knöpfe neu (ui/menus.ts renderDevZones)
  showSub();
  place();
});
