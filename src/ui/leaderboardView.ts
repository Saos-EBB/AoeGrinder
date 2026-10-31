// Modus-Auswahl im Startbildschirm. Hängt sich selbst ein, damit menus.ts und index.html unberührt bleiben.

import { MODES, MODIFIERS, modeId, setMode, toggleCustomMod, activeModIds, scoreMult } from '../modifiers';
import { resetGame } from '../player';

const fmtMult = v => `×${String(Math.round(v * 100) / 100).replace('.', ',')}`;
const $ = id => document.getElementById(id);

document.head.insertAdjacentHTML('beforeend', `<style>
  #startModal .panel { max-height: 96vh; overflow: auto; }
  #modePick { margin: 10px 0 14px; text-align: left; }
  #modeBtns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  #modeMods { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 12px; margin-top: 8px; font-size: 13px; }
  #modeMods label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
  #modeInfo { margin-top: 6px; font-size: 13px; color: #c9b88a; }
</style>`);
$('startBtn').insertAdjacentHTML('beforebegin', `<div id="modePick"><div class="title" style="margin-bottom:6px">Modus</div>
  <div id="modeBtns"></div><div id="modeMods"></div><div id="modeInfo"></div></div>`);

// Modifikatoren wirken beim Aufbau des Runs: Mobs und Werte neu
function changed() {
  resetGame();
  renderPick();
}

function renderPick() {
  const btns = $('modeBtns'), box = $('modeMods');
  btns.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button');
    b.className = 'bindBtn' + (m.id === modeId ? ' selected' : '');
    b.textContent = m.name;
    b.addEventListener('click', () => { setMode(m.id); changed(); });
    btns.appendChild(b);
  }
  box.innerHTML = '';
  if (modeId === 'custom') for (const mod of MODIFIERS) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = activeModIds().includes(mod.id);
    input.addEventListener('change', () => { toggleCustomMod(mod.id); changed(); });
    label.append(input, `${mod.name} (${fmtMult(mod.scoreMult)})`);
    label.title = mod.desc;
    box.appendChild(label);
  }
  const names = MODIFIERS.filter(m => activeModIds().includes(m.id)).map(m => m.desc).join(' · ');
  $('modeInfo').textContent = `${names || 'Keine Modifikatoren'} · Punkte ${fmtMult(scoreMult())}`;
}
renderPick();
