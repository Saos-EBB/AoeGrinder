// Ladebildschirm vor jedem Run (Mockup LoadDoom.dc.html): „BETRETE“ + Zonenname, Glut-Linie als Fortschritt, Bestzeit, Tipp, Mods.
// Das Spiel steht still, solange er offen ist (loadModal ist in BLOCKING, menus.ts). Dauer // PH

import { $ } from '../util';
import { zone } from '../world';
import { MODIFIERS, activeModIds } from '../modifiers';
import { META } from '../meta';
import { byTime, comboRuns } from '../leaderboard';
import { TIPS } from './tips';

const LOAD_MS = 1100;   // PH

document.body.insertAdjacentHTML('beforeend', `<div id="loadModal" class="modal">
  <svg class="loadLines" aria-hidden="true" viewBox="0 0 1600 900" preserveAspectRatio="none" fill="none" stroke="#ff3d1f" stroke-linecap="round">
    <path d="M0 780 L420 720 L700 760 L1000 700 L1300 750 L1600 710" stroke-width="2" opacity="0.5"/><path d="M0 820 L380 790 L760 820 L1120 780 L1600 800" stroke-width="1" opacity="0.35"/></svg>
  <div class="loadMid"><span class="loadPre">Betrete</span><span class="loadZone"></span><div class="loadBar"><div></div></div></div>
  <div class="loadBest"><span>Bestzeit</span><b></b></div>
  <div class="loadTip"></div>
  <div class="loadMods"></div>
</div>`);

const fmt = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor(ms / 100) % 10}`;

export function showLoad(done: () => void) {
  const m = $('loadModal');
  m.querySelector('.loadZone').textContent = zone.name;
  const best = byTime(comboRuns())[0]?.timeTo100;
  m.querySelector('.loadBest b').textContent = typeof best === 'number' ? fmt(best) : '—';
  m.querySelector('.loadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const mods = MODIFIERS.filter(x => activeModIds().includes(x.id) && !META.charMods.includes(x.id));
  m.querySelector('.loadMods').innerHTML = mods.map((x, i) => `<span class="${i ? '' : 'on'}"></span>`).join('');
  [...m.querySelectorAll('.loadMods span')].forEach((s, i) => { s.textContent = mods[i].name; });
  const bar = m.querySelector('.loadBar div') as HTMLElement;
  bar.style.transition = 'none';
  bar.style.width = '0';
  m.classList.add('show');
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${LOAD_MS}ms linear`; bar.style.width = '100%'; }));
  setTimeout(() => { m.classList.remove('show'); done(); }, LOAD_MS);
}
