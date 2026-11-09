// Dev-Panel (F10, Mockup Dev.dc.html): schwebendes Fenster. Titelleiste zieht, Ecke unten rechts ändert die Größe,
// Knöpfe durchsichtig / einklappen / schließen. Position und Größe in frostgrind.ui.v1.
// Der Inhalt sind die Dev-Knöpfe, die andere Module in #devPanel einhängen; beim ersten Öffnen werden sie in Gruppen sortiert.

import { $ } from '../util';
import { state } from '../state';
import { SCORE_VERSION } from '../config';
import { uiSettings, setUi } from './uiSettings';
import { renderDevZones } from './menus';

const MIN = 300;   // kleinste Breite und Höhe in px
const panel = $('devPanel');

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

// Gruppen wie im Mockup. Die alten „Dev: …“-Überschriften fallen weg, kleine Unterzeilen sagen, was ein Block tut
let sorted = false;
function sortGroups() {
  sorted = true;
  for (const t of [...body.querySelectorAll(':scope > .title')]) t.remove();
  const byId = id => document.getElementById(id);
  const parentOf = id => byId(id)?.parentElement;
  const groups: [string, [string, HTMLElement | null | undefined][]][] = [
    ['Spieler', [['', byId('devMobAtk')], ['', byId('devLuck')]]],
    ['Level', [['Level setzen', byId('devLevels')], ['Karte erzwingen', byId('devCards')], ['', byId('devComplete')]]],
    ['Spawn', [['Zone', byId('devZones')], ['Champion-Pack', parentOf('devChamp')], ['Boss', parentOf('devBoss')], ['Pack: Kategorie × Zusatz × Theme', byId('devKinds')]]],
    ['Build', [['Krieger-Legende', byId('devLegend')], ['Meta', byId('devMeta')], ['Waffen-Baukasten', byId('devForge')]]],
    ['Anzeige', [['', byId('devPerf')], ['', byId('devColliders')], ['Erfolgs-Meldung', byId('devFeat')]]],
  ];
  const rest = [...body.children];
  body.innerHTML = '';
  for (const [name, items] of groups) {
    const sec = document.createElement('section');
    sec.append(Object.assign(document.createElement('h2'), { textContent: name }));
    for (const [label, el] of items) {
      if (!el) continue;
      if (label) sec.append(Object.assign(document.createElement('h3'), { textContent: label }));
      sec.append(el);
    }
    body.append(sec);
  }
  // Was keiner Gruppe gehört (neue Dev-Knöpfe), landet unten statt zu verschwinden
  const left = rest.filter(e => !body.contains(e));
  if (left.length) {
    const sec = document.createElement('section');
    sec.append(Object.assign(document.createElement('h2'), { textContent: 'Sonstiges' }), ...left);
    body.append(sec);
  }
}

// Hinweis „Run zählt nicht“: Jede Bedienung im Panel markiert den laufenden Run. Die Rangliste filtert das (noch) nicht
const showSub = () => { (head.querySelector('.devSub') as HTMLElement).textContent = `F10 · ${SCORE_VERSION}${state.devUsed ? ' · Run zählt nicht' : ''}`; };
body.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) { state.devUsed = true; showSub(); } });
body.addEventListener('change', () => { state.devUsed = true; showSub(); });

// Position und Größe, immer im Bildschirm
const box = () => uiSettings.devPanel;
function place() {
  const b = box();
  b.w = Math.max(MIN, Math.min(b.w, innerWidth)); b.h = Math.max(MIN, Math.min(b.h, innerHeight));
  b.x = Math.max(0, Math.min(b.x, innerWidth - b.w)); b.y = Math.max(0, Math.min(b.y, innerHeight - 40));
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

export const devOpen = () => !panel.hidden;
addEventListener('keydown', e => {
  if (e.code !== 'F10' || state.rebinding) return;
  e.preventDefault();
  panel.hidden = !panel.hidden;
  if (panel.hidden) return;
  if (!sorted) sortGroups();
  renderDevZones();
  showSub();
  place();
});
