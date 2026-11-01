// Dev-Auswahl der Waffe im Esc-Menü. Es gibt noch kein Loot- oder Ausrüstungssystem (Relikte sind Spells).
// Die Abschnitte hängen sich selbst ins Menü, index.html und ui/menus.ts bleiben unberührt.

import { WEAPONS } from './index';

export function initWeaponMenu(mage) {
  const anchor = document.getElementById('devPerf');
  if (!anchor) return () => {};
  const title = document.createElement('div');
  title.className = 'title'; title.style.cssText = 'text-align:left;margin-bottom:6px'; title.textContent = 'Dev: Waffe';
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-bottom:4px';
  const cycle = document.createElement('button');
  cycle.className = 'bindBtn'; cycle.style.cssText = 'width:100%;margin-bottom:14px';
  let timer = 0;
  const pick = id => { mage.setWeapon(id); render(); };
  const render = () => {
    box.innerHTML = '';
    for (const w of WEAPONS) {
      const b = document.createElement('button');
      b.className = 'bindBtn' + (w.id === mage.weapon.id ? ' selected' : '');
      b.textContent = w.name; b.title = w.arch;
      b.addEventListener('click', () => pick(w.id));
      box.appendChild(b);
    }
    cycle.textContent = `Alle 15 durchschalten: ${timer ? 'an' : 'aus'}`;
  };
  cycle.addEventListener('click', () => {
    if (timer) { clearInterval(timer); timer = 0; }
    else timer = window.setInterval(() => pick(WEAPONS[(WEAPONS.findIndex(w => w.id === mage.weapon.id) + 1) % WEAPONS.length].id), 2500);
    render();
  });
  anchor.before(title, box, cycle);
  render();
  return render;
}
