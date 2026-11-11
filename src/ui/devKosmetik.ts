// Dev: Kosmetik (F10 → Kosmetik). Looks freischalten/sperren, Meilenstein-Zähler setzen (meta.ts devSetStats),
// Meilenstein-Erfolg vergeben/entfernen, Figur-Ereignisse auslösen (figEvents.ts window.__fig). Nur Dev, ändert keine Werte im Spiel.

import { meta, saveMeta, milestone, devSetStats } from '../meta';
import { LOOKS, KOSMETIK_POOL } from '../gear';
import { MILESTONE_ACH } from '../skins';
import { mage } from '../models/mage';
import { renderMenu } from './mainMenu';
import { t } from '../i18n';

const EVENTS = ['kill', 'crit', 'cast', 'hit', 'level', 'streak', 'idle'];
const opts = (list: [string, string][]) => list.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
const looks = () => { if (!Array.isArray(meta.looks)) meta.looks = []; return meta.looks as string[]; };

// Block für ui/devGame.ts (mountDev)
export function devKosmetikBlock() {
  const box = document.createElement('div');
  box.id = 'devKosmetik';
  box.innerHTML = `<h3>Look</h3>
    <select class="bindBtn" id="devLook">${opts(Object.entries(LOOKS).map(([id, L]) => [id, `${t(L.name)} (${L.slot}${L.ach ? ', ⭐' : L.unlock ? ', Set' : ''})`]))}</select>
    <div class="devRow"><button class="bindBtn" data-a="lookOn">Freischalten</button><button class="bindBtn" data-a="lookOff">Sperren</button></div>
    <div class="devRow"><button class="bindBtn" data-a="allOn">Box-Looks alle frei</button><button class="bindBtn" data-a="allOff">Alle Looks sperren</button></div>
    <h3>Meilenstein-Zähler (über alle Runs)</h3>
    <div class="devRow"><label>Kills <input type="number" min="0" id="devMsKills"></label><label>Staub <input type="number" min="0" id="devMsDust"></label></div>
    <button class="bindBtn" data-a="stats">Zähler setzen</button>
    <h3>Meilenstein-Erfolg</h3>
    <select class="bindBtn" id="devMs">${opts(MILESTONE_ACH.map(id => [id, t(`ach.ms.${id}`)]))}</select>
    <div class="devRow"><button class="bindBtn" data-a="msOn">Vergeben</button><button class="bindBtn" data-a="msOff">Entfernen</button></div>
    <h3>Figur-Ereignis</h3>
    <select class="bindBtn" id="devFigEv">${opts(EVENTS.map(e => [e, e]))}</select>
    <div class="devRow"><button class="bindBtn" data-a="fire">Auslösen</button><button class="bindBtn" data-a="sprint">Laufen: Spiel</button></div>`;

  const val = (id: string) => box.querySelector<HTMLSelectElement | HTMLInputElement>(`#${id}`).value;
  const fill = () => { box.querySelector<HTMLInputElement>('#devMsKills').value = String(meta.stats?.kills ?? 0); box.querySelector<HTMLInputElement>('#devMsDust').value = String(meta.stats?.dust ?? 0); };
  fill();
  const sprintModes: (boolean | null)[] = [null, true, false], sprintText = ['Laufen: Spiel', 'Laufen: an', 'Laufen: aus'];
  let sprint = 0;

  box.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (!a) return;
    const fig = (window as any).__fig;
    if (a === 'lookOn' && !looks().includes(val('devLook'))) looks().push(val('devLook'));
    if (a === 'lookOff') meta.looks = looks().filter(id => id !== val('devLook'));
    if (a === 'allOn') meta.looks = [...new Set([...looks(), ...KOSMETIK_POOL])];
    if (a === 'allOff') meta.looks = [];
    if (a === 'stats') devSetStats({ kills: Math.max(0, Number(val('devMsKills')) || 0), dust: Math.max(0, Number(val('devMsDust')) || 0) });
    if (a === 'msOn') milestone(val('devMs'));
    if (a === 'msOff') meta.achievements = meta.achievements.filter(x => x !== val('devMs'));
    if (a === 'fire') fig?.fire(val('devFigEv'));
    if (a === 'sprint') { sprint = (sprint + 1) % 3; fig?.sprint(sprintModes[sprint]); (e.target as HTMLElement).closest('button').textContent = sprintText[sprint]; }
    if (a === 'fire' || a === 'sprint') return;
    saveMeta();
    fill();
    mage.refreshLook();
    renderMenu();
  });
  return box;
}
