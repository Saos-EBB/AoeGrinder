// HUD-Elemente neben Leben, Mana und Leiste: Kompass, Splits, Spielerrahmen, Tracker, Mikro-Menü.
// Alle anderen Elemente füllt ui/hud.ts. Aktualisiert wird nur, was sich ändert; Kompass und Splits höchstens 10× pro Sekunde.

import { state, player } from '../../state';
import { $ } from '../../util';
import { maxHp, maxMana } from '../../formulas';
import { cam } from '../../camera';
import { META } from '../../meta';
import { modeId } from '../../modifiers';
import { currentFigure, openPause } from '../mainMenu';
import { toggleChar } from '../charWindow';
import { openBinds } from '../menus';
import { t } from '../../i18n';
import { run } from '../../score';
import { bestSplits } from '../../leaderboard';
import { placementOf } from './layout';

const put = (el: Element, text: string) => { if ((el as any)._t !== text) { (el as any)._t = text; el.textContent = text; } };
const fill = (el: HTMLElement, v: number) => { const s = Math.max(0, Math.min(1, v)).toFixed(3); if ((el as any)._v !== s) { (el as any)._v = s; el.style.setProperty('--v', s); } };
const shown = (id) => { const p = placementOf(id); return !!p && !p.hidden; };
const figureName = () => currentFigure()?.name ?? '';

// Beim ersten Frame, wenn alle Module ihr Markup eingehängt haben: Tracker übernimmt #siegeHud (siege.ts, boss.ts schreiben hinein)
let ready = false;
function init() {
  ready = true;
  // Beschriftungen und Wörter für die Varianten der Flavors (hud.css: bignum, massaker)
  ($('hudHp').querySelector('.hBar') as HTMLElement).dataset.label = t('hudEl.hp');
  ($('hudMana').querySelector('.hBar') as HTMLElement).dataset.label = t('hudEl.mana');
  $('scoreCombo').dataset.word = t('hudx.massacre');
  ($('hudCombo').querySelector('.cMulti') as HTMLElement).dataset.word = t('hudx.annihilation');
  const title = $('hudTracker').querySelector('.trTitle'), siege = document.getElementById('siegeHud');
  if (siege) title.replaceWith(siege);
}

// ---------- Mikro-Menü (Krypta): Charakter, Pause, Einstellungen, Tasten; darüber 4 Taschen (nur Deko) ----------
const MICRO: [string, string, () => void][] = [
  ['hudx.micro.char', 'M4 20V6l8-3 8 3v14', () => toggleChar()],
  ['hudx.micro.pause', 'M5 5h14v14H5z', () => openPause()],
  ['hudx.micro.settings', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3', () => { openPause(); $('pauseSettings').click(); }],
  ['hudx.micro.binds', 'M4 4h16v4H4zM4 10h16v10H4z', () => openBinds()],
];
const micro = $('hudMicro');
micro.innerHTML = `<div class="mBags" aria-hidden="true">${'<i class="mBag"></i>'.repeat(4)}</div>`;
for (const [key, d, run] of MICRO) {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = t(key);
  b.setAttribute('aria-label', t(key));
  b.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#f2d58a" stroke-width="1.8"><path d="${d}"/></svg>`;
  b.addEventListener('click', run);
  micro.append(b);
}

// ---------- Spielerrahmen ----------
const uf = $('hudUnit');
const ufEls = { portrait: uf.querySelector('.ufPortrait'), name: uf.querySelector('.ufName'), lvl: uf.querySelector('.ufLvl'),
  hp: uf.querySelector('.ufHp .fill') as HTMLElement, hpT: uf.querySelector('.ufHp span'), mana: uf.querySelector('.ufMana .fill') as HTMLElement, manaT: uf.querySelector('.ufMana span') };

// ---------- Kompass: Himmelsrichtungen und Rauten für Mob-Gruppen, Champions, Boss in Blickrichtung ----------
const COMPASS = { span: Math.PI, range: 90, everyMs: 100 };   // sichtbarer Winkel, Reichweite in yd // PH
const DIRS: [string, number][] = [['N', 0], ['NW', 45], ['W', 90], ['SW', 135], ['S', 180], ['SO', -135], ['O', -90], ['NO', -45]];
const cmp = $('hudCompass');
cmp.innerHTML = `${DIRS.map(([d]) => `<span class="cDir${d.length > 1 ? ' small' : ''}">${d}</span>`).join('')}<i class="cMid"></i>`;
const dirEls = [...cmp.querySelectorAll<HTMLElement>('.cDir')];
const marks: HTMLElement[] = [];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// Rechts im Bild liegt, was yaw − Winkel > 0 hat (wie die Minimap: rechts = Kamera-rechts)
const xOf = (a, yaw) => { const d = wrap(yaw - a); return Math.abs(d) > COMPASS.span / 2 ? null : 50 + d / COMPASS.span * 100; };
let cmpAt = -1e9;
function updateCompass() {
  const now = performance.now();
  if (now - cmpAt < COMPASS.everyMs) return;
  cmpAt = now;
  const yaw = player.facing + cam.offset;
  DIRS.forEach(([, deg], i) => { const x = xOf(deg * Math.PI / 180, yaw); dirEls[i].style.display = x === null ? 'none' : ''; if (x !== null) dirEls[i].style.left = `${x}%`; });
  // Gruppen: Mittelpunkt pro Pack, Farbe nach dem stärksten Mitglied
  const packs = new Map<number, { x: number; z: number; n: number; kind: number }>();
  for (const m of state.mobs) {
    if (m.dead || m.hidden) continue;
    const dx = m.pos.x - player.pos.x, dz = m.pos.z - player.pos.z;
    if (dx * dx + dz * dz > COMPASS.range * COMPASS.range) continue;
    const g = packs.get(m.packId) ?? { x: 0, z: 0, n: 0, kind: 0 };
    g.x += dx; g.z += dz; g.n++;
    g.kind = Math.max(g.kind, m.boss ? 2 : m.champion ? 1 : 0);
    packs.set(m.packId, g);
  }
  let i = 0;
  for (const g of packs.values()) {
    const x = xOf(Math.atan2(g.x / g.n, g.z / g.n), yaw);
    if (x === null) continue;
    const el = marks[i] ?? cmp.appendChild(Object.assign(document.createElement('b'), { className: 'cMark' }));
    marks[i++] = el;
    el.style.display = '';
    el.style.left = `${x}%`;
    el.dataset.kind = ['mob', 'champ', 'boss'][g.kind];
  }
  for (; i < marks.length; i++) marks[i].style.display = 'none';
}

// ---------- Splits: Zeit beim Erreichen von Lvl 15 … 100, Abstand zur Bestzeit (frostgrind.splits.v1) ----------
const fmt = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor(ms / 100) % 10}`;
const fmtDiff = ms => `${ms < 0 ? '−' : '+'}${fmt(Math.abs(ms))}`;
const sp = $('hudSplits');
sp.innerHTML = `<div class="spHead"></div>${META.splits.map(l => `<div class="spRow" data-l="${l}"><span>Lvl ${l}</span><b>—</b><i></i></div>`).join('')}<div class="spNow"></div>`;
const spRows = [...sp.querySelectorAll<HTMLElement>('.spRow')];
let spKey = '';
function updateSplits() {
  put(sp.querySelector('.spNow'), fmt(state.now));
  const key = `${modeId}|${JSON.stringify(run.splits)}`;
  if (key === spKey) return;
  spKey = key;
  put(sp.querySelector('.spHead'), `SPLITS · ${figureName()}`);
  const best = bestSplits();
  let next = true;
  for (const row of spRows) {
    const l = +row.dataset.l, t = run.splits[l], b = best[l];
    put(row.children[1], typeof t === 'number' ? fmt(t) : '—');
    const d = typeof t === 'number' && typeof b === 'number' && b !== t ? t - b : null;
    put(row.children[2], d === null ? '' : fmtDiff(d));
    row.dataset.diff = d === null ? '' : d <= 0 ? 'good' : 'bad';
    row.classList.toggle('next', next && typeof t !== 'number');
    if (typeof t !== 'number') next = false;
  }
}

// Ein Aufruf pro Frame aus updateHud; jedes Element nur, wenn es im Layout sichtbar ist
export function updateHudExtras() {
  if (!ready) init();
  if (shown('unitframe')) {
    const hpMax = maxHp(), manaMax = maxMana();
    put(ufEls.portrait, figureName().charAt(0));
    put(ufEls.name, figureName());
    put(ufEls.lvl, String(player.level));
    fill(ufEls.hp, player.hp / hpMax * (1 - (player.hpCut ?? 0)));
    put(ufEls.hpT, `${Math.ceil(Math.max(0, player.hp))} / ${hpMax}`);
    fill(ufEls.mana, player.mana / manaMax);
    put(ufEls.manaT, player.resLabel ?? `${Math.floor(player.mana)} / ${manaMax}`);
  }
  if (shown('compass')) updateCompass();
  if (shown('splits')) updateSplits();
}
