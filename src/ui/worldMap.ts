// Weltkarte (map-umbau-2 Phase 2): gemalte 2D-Karte (SVG) mit den 5 Themes als Orte, Wege Wald → Wüste → Kanäle → Kathedrale → Hölle,
// die Arena für sich. Ort = Name, Schwierigkeit (1–5 Totenköpfe), Bestzeit (Figur + Mods + Map wie der Map-Wechsler), gesperrt/offen.
// Öffnet über das Map-Feld oben links im Hauptmenü (ersetzt dessen ◀ ▶) oder Taste M; Klick auf einen offenen Ort wählt die Map.
// Darunter das Seed-Feld für Speedruns (leer = zufällig, mapgen/rng.ts). Eigenes Fenster, damit das Hauptmenü-Layout unberührt bleibt.

import { $ } from '../util';
import { state } from '../state';
import { zone, zoneId } from '../world';
import { THEMES } from '../mapgen/themes';
import { zoneIdOf } from '../mapgen/registry';
import { ORDER, themeOpen, UNLOCK_LEVEL, devMapsOpen, setDevMapsOpen } from '../mapgen/progress';
import { mapSeed, seedPinned, setMapSeed, unpinSeed } from '../mapgen/rng';
import { byTime, comboRuns } from '../leaderboard';
import { fmtTime } from './fmt';
import { selectMap, menuOpen, renderMenu } from './mainMenu';
import { t } from '../i18n';
import type { ThemeId } from '../mapgen/types';
import { esc, hex } from './dom';

// Lage der Orte auf der Karte (viewBox 800 × 470) // PH
const SPOT: Record<ThemeId, [number, number]> = { wald: [110, 350], wueste: [270, 220], kanaele: [440, 310], kathedrale: [580, 170], hoelle: [700, 70] };
const ARENA: [number, number] = [705, 385];
const glowHex = (c: { r: number; g: number; b: number }) => `rgb(${[c.r, c.g, c.b].map(v => Math.round(Math.min(1, v / 2.6) * 255)).join(',')})`;

document.head.insertAdjacentHTML('beforeend', `<style>
  #menuMap { cursor: pointer; }
  #menuMap .mapArrow { display: none; }
  #menuMap:hover { filter: brightness(1.15); }
  #worldModal { z-index: 4; }
  #worldModal .panel { width: min(900px, 96vw); max-width: none; max-height: 94vh; overflow: auto; text-align: left; }
  #worldModal .panel { display: flex; flex-direction: column; }
  #worldModal .panel > * { flex: none; }
  /* Karte schrumpft bei wenig Höhe (z. B. 1263 × 638), damit Seed, Hinweis und „Schließen“ ohne Scrollen im Bild bleiben */
  #worldSvg { width: 100%; height: auto; display: block; flex: 0 1 auto !important; min-height: 0; max-height: calc(94vh - 250px); }
  #worldSvg .place { cursor: pointer; }
  #worldSvg .place.locked { cursor: not-allowed; }
  #worldSvg .place:not(.locked):hover .orb { stroke-width: 5; }
  #worldSvg text { font-family: var(--font-body); paint-order: stroke; stroke: #1a1008; stroke-width: 3px; }
  #worldSeed { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; font: 600 14px var(--font-body); color: var(--fg-text); }
  #worldSeed input { width: 130px; height: 32px; padding: 0 8px; background: var(--fg-input, #0008); color: var(--fg-text); border: 1px solid var(--fg-line, #6b5426); font: 600 15px var(--font-body); }
  #worldSeed .smallBtn { width: auto; padding: 6px 12px; }
  #worldSeedNow { color: var(--fg-muted); font-weight: 500; }
  .seedLine { display: flex; gap: 8px; align-items: center; justify-content: center; font: 600 13px var(--font-body); color: var(--fg-muted); margin-top: 6px; }
  .seedLine .smallBtn { width: auto; padding: 3px 10px; }
</style>`);

document.body.insertAdjacentHTML('beforeend', `<div id="worldModal" class="modal"><div class="frame panel">
  <h1 class="title" style="font-size:26px">${t('world.title')}</h1>
  <svg id="worldSvg" viewBox="0 0 800 470" role="img" aria-label="${t('world.title')}"></svg>
  <div id="worldSeed">
    <label for="worldSeedIn">${t('world.seed')}</label>
    <input id="worldSeedIn" type="number" min="1" inputmode="numeric" placeholder="${t('world.seedRandom')}">
    <button class="smallBtn" id="worldSeedSet">${t('world.seedSet')}</button>
    <button class="smallBtn" id="worldSeedClear">${t('world.seedClear')}</button>
    <span id="worldSeedNow"></span>
    <button class="smallBtn" id="worldSeedCopy">${t('world.seedCopy')}</button>
  </div>
  <p id="worldHint" style="margin:8px 0 0">${t('world.hint', { lv: UNLOCK_LEVEL })}</p>
  <div class="row2"><button class="smallBtn" id="worldClose" style="width:auto;padding:6px 14px">${t('ui.close')}</button></div>
</div></div>`);
for (const id of ['worldSeedIn']) $(id).addEventListener('keydown', e => { e.stopPropagation(); if ((e as KeyboardEvent).key === 'Enter') applySeed(); });

// Totenkopf (klein, gezeichnet)
const skull = (x: number, y: number, on: boolean) => `<g transform="translate(${x},${y})" opacity="${on ? 1 : 0.25}"><path d="M-5 0a5 5 0 1 1 10 0v2.5h-2v2h-6v-2h-2z" fill="${on ? '#efe0b8' : '#6b5d48'}"/><circle cx="-2" cy="0" r="1.3" fill="#1a1008"/><circle cx="2" cy="0" r="1.3" fill="#1a1008"/></g>`;

function placeSvg(id: ThemeId) {
  const th = THEMES[id], [x, y] = SPOT[id], open = themeOpen(id), zid = zoneIdOf(id), sel = zid === zoneId;
  const best = byTime(comboRuns(zid))[0]?.timeTo100, d = th.info.difficulty;
  const prev = ORDER[ORDER.indexOf(id) - 1];
  const sub = open ? t('world.best', { t: typeof best === 'number' ? fmtTime(best) : '—' }) : t('world.locked', { lv: UNLOCK_LEVEL, name: THEMES[prev].name });
  const skulls = Array.from({ length: 5 }, (_, i) => skull(x - 24 + i * 12, y + 58, i < d)).join('');
  return `<g class="place${open ? '' : ' locked'}" data-id="${id}" tabindex="${open ? 0 : -1}" role="button" aria-label="${esc(th.name)}">
    ${sel ? `<circle cx="${x}" cy="${y}" r="44" fill="none" stroke="#f5c96a" stroke-width="3" stroke-dasharray="6 4"/>` : ''}
    <circle class="orb" cx="${x}" cy="${y}" r="34" fill="${open ? hex(th.look.ground.a) : '#3a332a'}" stroke="${open ? glowHex(th.look.glow) : '#5a4e3c'}" stroke-width="3"/>
    <circle cx="${x}" cy="${y}" r="16" fill="${open ? hex(th.look.ground.b) : '#2a241d'}" opacity=".8"/>
    ${open ? '' : `<path d="M${x - 8} ${y - 1}h16v12h-16z M${x - 5} ${y - 1}v-5a5 5 0 0 1 10 0v5" fill="none" stroke="#a89878" stroke-width="2.5"/>`}
    <text x="${x}" y="${y + 50}" text-anchor="middle" font-size="18" font-weight="700" fill="${open ? '#f2e6c8' : '#8a7c66'}">${esc(th.name)}</text>
    ${skulls}
    <text x="${x}" y="${y + 82}" text-anchor="middle" font-size="13" fill="${open ? '#d9c79c' : '#8a7c66'}">${open ? esc(sub) : `<tspan x="${x}">${esc(t('world.lockedTitle'))}</tspan><tspan x="${x}" dy="15">${esc(sub)}</tspan>`}</text>
  </g>`;
}

function render() {
  const pts = ORDER.map(id => SPOT[id]);
  // Weg: geschwungene Linie von Ort zu Ort, offen = durchgezogen, gesperrt = gestrichelt
  const roads = pts.slice(1).map((p, i) => {
    const a = pts[i], mx = (a[0] + p[0]) / 2, my = (a[1] + p[1]) / 2 - 30;
    const open = themeOpen(ORDER[i + 1]);
    return `<path d="M${a[0]} ${a[1]} Q${mx} ${my} ${p[0]} ${p[1]}" fill="none" stroke="${open ? '#c9a45c' : '#5a4e3c'}" stroke-width="${open ? 5 : 3}" stroke-dasharray="${open ? '0' : '8 8'}" stroke-linecap="round"/>`;
  }).join('');
  const [ax, ay] = ARENA;
  $('worldSvg').innerHTML = `
    <defs><radialGradient id="wmBg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#4a3a24"/><stop offset="1" stop-color="#1c140b"/></radialGradient></defs>
    <rect width="800" height="470" fill="url(#wmBg)"/>
    <path d="M0 430 C120 400 200 455 330 420 S560 400 800 440 V470 H0z" fill="#2a3a20" opacity=".5"/>
    <path d="M520 0 C560 40 640 30 680 0z M600 470 C640 430 760 420 800 400 V470z" fill="#3a1a10" opacity=".55"/>
    ${roads}
    <g opacity=".85"><rect x="${ax - 70}" y="${ay - 38}" width="140" height="76" fill="#00000055" stroke="#6b5426" stroke-dasharray="4 4"/>
      <circle cx="${ax}" cy="${ay - 6}" r="18" fill="#5a4a3a" stroke="#a89878" stroke-width="2"/>
      ${Array.from({ length: 8 }, (_, i) => `<circle cx="${ax + Math.cos(i * Math.PI / 4) * 18}" cy="${ay - 6 + Math.sin(i * Math.PI / 4) * 18}" r="3" fill="#cdbb98"/>`).join('')}
      <text x="${ax}" y="${ay + 26}" text-anchor="middle" font-size="14" font-weight="700" fill="#d9c79c">${esc(t('world.arena'))}</text></g>
    ${ORDER.map(placeSvg).join('')}`;
  const pinned = seedPinned();
  $('worldSeedNow').textContent = t(pinned ? 'world.seedNowFixed' : 'world.seedNow', { n: mapSeed() });
  ($('worldSeedIn') as HTMLInputElement).value = pinned ? String(mapSeed()) : '';
}

$('worldSvg').addEventListener('click', e => {
  const g = (e.target as Element).closest('.place') as SVGGElement | null;
  if (!g || g.classList.contains('locked')) return;
  if (selectMap(zoneIdOf(g.dataset.id as ThemeId))) render();
});
$('worldSvg').addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') ((e.target as Element).closest('.place') as any)?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

function applySeed() {
  const v = Number(($('worldSeedIn') as HTMLInputElement).value);
  if (Number.isFinite(v) && v >= 1) setMapSeed(v); else unpinSeed();
  selectMap(zoneId);   // Map mit dem Seed neu bauen
  render();
}
$('worldSeedSet').addEventListener('click', applySeed);
$('worldSeedClear').addEventListener('click', () => { ($('worldSeedIn') as HTMLInputElement).value = ''; applySeed(); });
$('worldSeedCopy').addEventListener('click', () => copySeed($('worldSeedNow')));

export async function copySeed(msgEl?: HTMLElement) {
  try { await navigator.clipboard.writeText(String(mapSeed())); if (msgEl) msgEl.textContent = t('world.seedCopied', { n: mapSeed() }); }
  catch { /* ohne Zwischenablage: die Zahl steht sichtbar da */ }
}

export const worldOpen = () => $('worldModal').classList.contains('show');
export function openWorld() { render(); $('worldModal').classList.add('show'); }
export function closeWorld() { $('worldModal').classList.remove('show'); renderMenu(); }
$('worldClose').addEventListener('click', closeWorld);
$('menuMap').addEventListener('click', openWorld);
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || state.rebinding) return;
  if (worldOpen() && e.code === 'Escape') { e.stopImmediatePropagation(); closeWorld(); return; }
  if (e.code === 'KeyM' && menuOpen() && !document.querySelector('.modal.show:not(#startModal)')) { e.preventDefault(); openWorld(); }
}, true);

// Seed im Run: Pause-Menü (Zeile mit Kopieren); das Run-Ende zeigt ihn in leaderboardView.ts
const pauseBox = document.querySelector('#pauseModal .pauseBox');
pauseBox?.insertAdjacentHTML('beforeend', `<div class="seedLine"><span id="pauseSeed"></span><button class="smallBtn" id="pauseSeedCopy">${t('world.seedCopy')}</button></div>`);
const showPauseSeed = () => { const el = document.getElementById('pauseSeed'); if (el) el.textContent = zone.gen ? t(seedPinned() ? 'world.seedNowFixed' : 'world.seedNow', { n: mapSeed() }) : ''; };
document.getElementById('pauseSeedCopy')?.addEventListener('click', () => copySeed(document.getElementById('pauseSeed')));
new MutationObserver(showPauseSeed).observe($('pauseModal'), { attributes: true, attributeFilter: ['class'] });

// Dev: alle Maps offen
$('devZones').insertAdjacentHTML('afterend', `<div id="devWorld"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="devMapsOpen"${devMapsOpen() ? ' checked' : ''}> Weltkarte: alles offen</label></div>`);
$('devMapsOpen').addEventListener('change', e => { setDevMapsOpen((e.target as HTMLInputElement).checked); if (worldOpen()) render(); });

(window as any).__world = { open: openWorld, close: closeWorld, render };
